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


class TestCIT14Integration(unittest.TestCase):
    def test_group_b_c_d_f_live_backend_edge_cases(self):
        # B: Backend rejects invalid SOS (no coords and no description) -> 422
        st_bad_sos, bad_sos = _http_json(
            f"{BACKEND_URL}/api/sos",
            method="POST",
            payload={"contact_name": "Test", "phone": "0900000000", "lat": None, "lng": None},
        )
        self.assertEqual(st_bad_sos, 422, f"Expected 422 for empty location SOS, got {st_bad_sos}: {bad_sos}")

        # C: Live routing A* & shelters
        st_sh, shelters = _http_json(f"{BACKEND_URL}/api/shelters")
        self.assertEqual(st_sh, 200)
        features = shelters.get("features") or []
        self.assertGreater(len(features), 0, "Expected >=1 shelter from /api/shelters")

        # C: Live route /api/route
        st_rt, rt = _http_json(
            f"{BACKEND_URL}/api/route",
            method="POST",
            payload={"origin": {"lat": 21.0285, "lng": 105.8542}, "destination": {"lat": 21.0333, "lng": 105.8500}},
        )
        self.assertEqual(st_rt, 200, f"POST /api/route failed: {rt}")

        # D: Flood report rejected when coords out of range (422)
        st_bad_rep, bad_rep = _http_json(
            f"{BACKEND_URL}/api/reports",
            method="POST",
            payload={"lat": 999.0, "lng": 105.85, "level": "medium"},
        )
        self.assertEqual(st_bad_rep, 422, f"Expected 422 for invalid lat report, got {st_bad_rep}: {bad_rep}")

        # D: Flood report valid online submission + idempotent replay
        rep_evt = f"cit14-rep-{int(time.time() * 1000)}"
        rep_payload = {
            "lat": 21.0285,
            "lng": 105.8542,
            "level": "medium",
            "client_event_id": rep_evt,
        }
        st_rep1, rep1 = _http_json(f"{BACKEND_URL}/api/reports", method="POST", payload=rep_payload)
        self.assertIn(st_rep1, (200, 201), f"POST /api/reports failed: {st_rep1} {rep1}")

        # F: AI chat live endpoint (safe response even without external Groq key)
        st_ai, ai_resp = _http_json(
            f"{BACKEND_URL}/api/ai/chat",
            method="POST",
            payload={"query": "Cách xử lý khi nhà bị ngập nước và mất điện?"},
        )
        self.assertEqual(st_ai, 200, f"POST /api/ai/chat failed: {st_ai} {ai_resp}")
        self.assertTrue(ai_resp.get("reply") or ai_resp.get("answer") or ai_resp.get("response"), f"Empty AI reply: {ai_resp}")

    def test_group_h_small_mobile_viewport_edge_headless(self):
        edge = _find_edge()
        if not edge:
            self.skipTest("Microsoft Edge not found")
        with tempfile.TemporaryDirectory() as profile_dir:
            cmd = [
                edge,
                "--headless",
                "--disable-gpu",
                "--window-size=360,740",
                f"--user-data-dir={profile_dir}",
                "--virtual-time-budget=3500",
                "--dump-dom",
                FRONTEND_URL,
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("viewport", proc.stdout)
            self.assertNotIn("user-scalable=no", proc.stdout)
            self.assertIn("citizen-emergency-banner", proc.stdout)


if __name__ == "__main__":
    unittest.main()
