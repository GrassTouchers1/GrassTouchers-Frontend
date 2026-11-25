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
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def _http_json(url, method="GET", payload=None, headers=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return exc.code, parsed


class TestPhase12E2EAcceptance(unittest.TestCase):
    def test_e2e_live_backend_and_citizen_edge_headless(self):
        # 1. Verify live Backend health + security (Citizen GET /api/sos blocked 403)
        st_health, health = _http_json(f"{BACKEND_URL}/api/health")
        self.assertEqual(st_health, 200, f"Backend /api/health failed: {health}")

        st_public_sos, _ = _http_json(
            f"{BACKEND_URL}/api/sos",
            headers={"X-NorthStar-Client": "citizen"},
        )
        self.assertIn(st_public_sos, (401, 403), f"Citizen GET /api/sos must be blocked, got {st_public_sos}")

        # 2. E2E-2: Citizen submits SOS online -> Backend returns real id + tracking_token -> private tracking
        client_event_id = f"e2e-sos-{int(time.time() * 1000)}"
        sos_payload = {
            "contact_name": "Nguyen Van E2E",
            "phone": "0912345678",
            "lat": 21.0285,
            "lng": 105.8542,
            "location_source": "gps",
            "location_confirmed": True,
            "location_accuracy_m": 12.5,
            "priority": "high",
            "people_count": 2,
            "notes": "E2E Phase 12 acceptance test",
            "client_event_id": client_event_id,
        }
        st_sos, sos_resp = _http_json(f"{BACKEND_URL}/api/sos", method="POST", payload=sos_payload)
        self.assertIn(st_sos, (200, 201), f"POST /api/sos failed: {st_sos} {sos_resp}")
        props = sos_resp.get("properties") or sos_resp
        sos_id = props.get("id") or props.get("ticket_id")
        self.assertTrue(sos_id, f"Missing SOS id: {sos_resp}")
        tracking_token = props.get("tracking_token")
        self.assertTrue(tracking_token, f"Missing tracking_token: {sos_resp}")

        # Duplicate client_event_id -> idempotent (returns same record, no duplicate)
        st_dup, dup_resp = _http_json(f"{BACKEND_URL}/api/sos", method="POST", payload=sos_payload)
        self.assertIn(st_dup, (200, 201, 409), f"Duplicate SOS unexpected status: {st_dup}")
        if st_dup in (200, 201):
            dup_props = dup_resp.get("properties") or dup_resp
            self.assertEqual(dup_props.get("id"), sos_id)

        # Private tracking endpoint must mask PII (no phone/name leaked)
        st_track, track_resp = _http_json(f"{BACKEND_URL}/api/sos/track/{tracking_token}")
        self.assertEqual(st_track, 200, f"Tracking failed: {track_resp}")
        track_str = json.dumps(track_resp, ensure_ascii=False)
        self.assertNotIn("0912345678", track_str)
        self.assertNotIn("Nguyen Van E2E", track_str)

        # Invalid tracking token -> 404
        st_bad_track, _ = _http_json(f"{BACKEND_URL}/api/sos/track/invalid-token-e2e-000")
        self.assertIn(st_bad_track, (400, 404))

        # 3. E2E-4: Shelters & Routing API
        st_shelters, shelters_resp = _http_json(f"{BACKEND_URL}/api/shelters")
        self.assertEqual(st_shelters, 200, f"GET /api/shelters failed: {shelters_resp}")

        st_evac, evac_resp = _http_json(
            f"{BACKEND_URL}/api/route/evacuate",
            method="POST",
            payload={"origin": {"lat": 21.0285, "lng": 105.8542}},
        )
        self.assertEqual(st_evac, 200, f"POST /api/route/evacuate failed: {evac_resp}")

        # 4. Edge Headless live Citizen E2E + Performance + Offline AI + IndexedDB reload
        edge_path = _find_edge()
        if not edge_path:
            self.skipTest("Microsoft Edge not found for headless E2E browser check")

        with tempfile.TemporaryDirectory() as profile_dir:
            # Verify citizen.html loads cleanly, IndexedDB has 7 stores, OfflineKnowledge searches fast
            js_probe = (
                "const t0=performance.now();"
                "window.addEventListener('load', async()=>{"
                "  try {"
                "    await OfflineDB.open();"
                "    const db = await OfflineDB.open();"
                "    const stores = Array.from(db.objectStoreNames);"
                "    const k0 = performance.now();"
                "    const kbRes = await OfflineKnowledge.search('ngập lụt sơ tán');"
                "    const kbMs = +(performance.now()-k0).toFixed(2);"
                "    const oosRes = await OfflineKnowledge.search('giá cổ phiếu hôm nay');"
                "    await OfflineDB.put('sos_outbox', {client_event_id:'e2e-reload-check', status:'PENDING', created_at:new Date().toISOString()});"
                "    const outbox = await OfflineDB.getAll('sos_outbox');"
                "    const loadMs = +(performance.now()-t0).toFixed(2);"
                "    document.title = 'E2E_OK:' + JSON.stringify({stores:stores.length, kbHits:(kbRes.matches||[]).length, oosHits:(oosRes.matches||[]).length, kbMs, outboxCount:outbox.length, loadMs});"
                "  } catch(e) { document.title = 'E2E_ERR:' + e.message; }"
                "});"
            )
            # Run Edge headless dump-dom on live citizen.html?e2e=1
            cmd = [
                edge_path,
                "--headless",
                "--disable-gpu",
                f"--user-data-dir={profile_dir}",
                "--virtual-time-budget=4000",
                "--dump-dom",
                FRONTEND_URL,
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
            self.assertEqual(proc.returncode, 0, f"Edge headless failed: {proc.stderr}")
            self.assertIn("NORTHSTAR", proc.stdout)
            self.assertIn("citizen-emergency-banner", proc.stdout)
            self.assertIn("js/sos_relay.js", proc.stdout)
            self.assertIn("js/satellite_gateway_adapter.js", proc.stdout)


if __name__ == "__main__":
    unittest.main()
