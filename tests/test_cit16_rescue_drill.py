# Copyright (C) 2026 NORTHSTAR Contributors
# SPDX-License-Identifier: Apache-2.0

import json
import os
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request

FRONTEND_URL = "http://127.0.0.1:3000/citizen.html"
BACKEND_URL = "http://127.0.0.1:8000"


def _find_edge():
    for p in (
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ):
        if os.path.exists(p):
            return p
    return None


def _http_json(url, method="GET", payload=None, headers=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        try:
            return exc.code, json.loads(body)
        except Exception:
            return exc.code, {"raw": body}


class TestCIT16RescueDrill(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Wait up to 10s for Backend /api/health
        for _ in range(20):
            try:
                st, _ = _http_json(f"{BACKEND_URL}/api/health")
                if st == 200:
                    return
            except Exception:
                pass
            time.sleep(0.5)
        raise RuntimeError("Backend 127.0.0.1:8000 did not become ready in time")

    def test_drill_1_to_6_end_to_end(self):
        # Kich ban 1: Nguoi dan theo doi thien tai (citizen.html + reports hazard + shelters)
        edge = _find_edge()
        self.assertIsNotNone(edge, "Edge required for Citizen drill")
        with tempfile.TemporaryDirectory() as profile_dir:
            proc = subprocess.run(
                [
                    edge,
                    "--headless",
                    "--disable-gpu",
                    f"--user-data-dir={profile_dir}",
                    "--virtual-time-budget=3500",
                    "--dump-dom",
                    FRONTEND_URL,
                ],
                capture_output=True,
                text=True,
                timeout=25,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("NORTHSTAR", proc.stdout)

        st_rep, reports_geojson = _http_json(f"{BACKEND_URL}/api/reports")
        self.assertEqual(st_rep, 200)
        self.assertEqual(reports_geojson.get("type"), "FeatureCollection")

        st_sh, shelters_geojson = _http_json(f"{BACKEND_URL}/api/shelters")
        self.assertEqual(st_sh, 200)
        self.assertGreater(len(shelters_geojson.get("features") or []), 0)

        # Kich ban 2: Nguoi dan can cuu tro -> Backend nhan -> Command thay -> Citizen nhan ma ho so
        evt_k2 = f"drill-k2-{int(time.time() * 1000)}"
        st_s2, sos_k2 = _http_json(
            f"{BACKEND_URL}/api/sos",
            method="POST",
            payload={
                "contact_name": "Tran Thi Drill K2",
                "phone": "0988777666",
                "lat": 21.0285,
                "lng": 105.8542,
                "location_source": "gps",
                "location_confirmed": True,
                "priority": "critical",
                "people_count": 3,
                "notes": "CIT-16 Kich ban 2",
                "client_event_id": evt_k2,
            },
        )
        self.assertIn(st_s2, (200, 201))
        sos_id = (sos_k2.get("properties") or {}).get("id")
        tracking_token = (sos_k2.get("properties") or {}).get("tracking_token")
        self.assertTrue(sos_id and tracking_token)

        # Command endpoint receives the SOS
        st_cmd, cmd_list = _http_json(f"{BACKEND_URL}/api/sos")
        self.assertEqual(st_cmd, 200)
        cmd_ids = [f.get("properties", {}).get("id") for f in (cmd_list.get("features") or [])]
        self.assertIn(sos_id, cmd_ids)

        # Kich ban 3: Mat Internet -> Luu IndexedDB -> Reload -> Bat mang -> Dong bo chong trung
        evt_k3 = f"drill-k3-{int(time.time() * 1000)}"
        payload_k3 = {
            "contact_name": "Le Van Drill K3",
            "phone": "0977666555",
            "lat": 21.0301,
            "lng": 105.8511,
            "location_source": "gps",
            "location_confirmed": True,
            "priority": "high",
            "people_count": 1,
            "notes": "CIT-16 Kich ban 3 offline sync",
            "client_event_id": evt_k3,
        }
        st_3a, r_3a = _http_json(f"{BACKEND_URL}/api/sos", method="POST", payload=payload_k3)
        st_3b, r_3b = _http_json(f"{BACKEND_URL}/api/sos", method="POST", payload=payload_k3)
        self.assertIn(st_3a, (200, 201))
        self.assertIn(st_3b, (200, 201))
        id_3a = (r_3a.get("properties") or {}).get("id")
        id_3b = (r_3b.get("properties") or {}).get("id")
        self.assertEqual(id_3a, id_3b)
        st_cmd3, cmd_list3 = _http_json(f"{BACKEND_URL}/api/sos")
        self.assertEqual(st_cmd3, 200)
        matching_k3 = [
            f for f in (cmd_list3.get("features") or [])
            if f.get("properties", {}).get("id") == id_3a
        ]
        self.assertEqual(len(matching_k3), 1)

        # Kich ban 4: Tim duong tranh ngap
        st_rt, rt = _http_json(
            f"{BACKEND_URL}/api/route",
            method="POST",
            payload={"origin": {"lat": 21.0285, "lng": 105.8542}, "destination": {"lat": 21.0333, "lng": 105.8500}},
        )
        self.assertEqual(st_rt, 200)

        # Kich ban 5: Tro ly AI Online
        st_ai, ai_resp = _http_json(
            f"{BACKEND_URL}/api/ai/chat",
            method="POST",
            payload={"query": "Khi nước dâng nhanh vào nhà cần làm gì?"},
        )
        self.assertEqual(st_ai, 200)
        self.assertTrue(ai_resp.get("reply") or ai_resp.get("answer") or ai_resp.get("response"))

        # Kich ban 6: Chuyen tiep SOS A -> B -> C -> Backend /api/sos/relay chong trung
        evt_k6 = f"drill-k6-relay-{int(time.time() * 1000)}"
        relay_packet = {
            "schema_version": "northstar.sos.relay.v1",
            "message_id": f"msg-{evt_k6}",
            "client_event_id": evt_k6,
            "origin_device_id": "device-A-offline",
            "created_at": "2026-11-25T05:00:00Z",
            "expires_at": "2026-11-26T05:00:00Z",
            "location": {"lat": 21.0290, "lng": 105.8530},
            "location_source": "gps",
            "payload": {
                "contact_name": "Pham Thi Relay A",
                "phone": "***4444",
                "priority": "critical",
                "people_count": 2,
                "notes": "Relayed A->B->C",
            },
            "hop_count": 2,
            "max_hops": 3,
            "relay_history": ["device-A-offline", "device-B-relay", "device-C-uplink"],
        }
        st_rel1, rel1 = _http_json(f"{BACKEND_URL}/api/sos/relay", method="POST", payload=relay_packet)
        st_rel2, rel2 = _http_json(f"{BACKEND_URL}/api/sos/relay", method="POST", payload=relay_packet)
        self.assertIn(st_rel1, (200, 201), f"Relay failed: {st_rel1} {rel1}")
        self.assertIn(st_rel2, (200, 201))
        rel_id1 = (rel1.get("properties") or rel1).get("id")
        rel_id2 = (rel2.get("properties") or rel2).get("id")
        self.assertEqual(rel_id1, rel_id2)


if __name__ == "__main__":
    unittest.main()
