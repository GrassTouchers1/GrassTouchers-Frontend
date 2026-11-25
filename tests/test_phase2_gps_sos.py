# Copyright 2026 GrassTouchers Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Kiểm thử Giai đoạn 2 (CIT-02 & CIT-03): GPS, Xác minh Vị trí & Quy trình Gửi SOS NORTHSTAR CITIZEN.
Bao gồm: Nhóm A (TEST-GPS-01..07), Nhóm B (TEST-SOS-01..10), và Nhóm C (Tích hợp Backend thực).
"""

import http.server
import json
import math
import os
import re
import shutil
import subprocess
import threading
import time
import unittest
import urllib.error
import urllib.request

FRONTEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_URL = "http://127.0.0.1:8000"


def _post_json(path, payload):
    url = f"{BACKEND_URL}{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


class _MockSosHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Mock-Mode")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"type":"FeatureCollection","features":[]}')

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        _ = self.rfile.read(length)
        if self.path == "/api/sos":
            mode = self.headers.get("X-Mock-Mode", "ok")
            if mode == "500":
                self.send_response(500)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"detail":"Mock 500"}')
            elif mode == "no_id":
                self.send_response(201)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"type":"Feature","properties":{"status":"pending"}}')
            elif mode == "slow":
                time.sleep(1.5)
                self.send_response(201)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"type":"Feature","properties":{"id":999}}')
            else:
                self.send_response(201)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"type":"Feature","properties":{"id":42,"status":"pending"}}')


class TestPhase2GpsAndSos(unittest.TestCase):
    """Bộ kiểm thử đầy đủ Nhóm A (GPS), Nhóm B (SOS) và Nhóm C (Tích hợp Backend)."""

    def test_01_static_no_fake_ticket_or_default_sos_coords(self):
        """TEST-SOS-09 & TEST-SOS-10: Không còn Math.random() sinh ticketCode và không fallback tọa độ Hà Nội trong submitSOSBeacon."""
        with open(os.path.join(FRONTEND_DIR, "js", "rescue_manager.js"), "r", encoding="utf-8") as f:
            rm_src = f.read()
        with open(os.path.join(FRONTEND_DIR, "js", "offline_sync_manager.js"), "r", encoding="utf-8") as f:
            osm_src = f.read()

        self.assertNotIn("Math.random() * 9000", rm_src)
        self.assertNotIn("Math.random() * 9000", osm_src)

        sos_section = rm_src.split("async function submitSOSBeacon()")[1].split("function handleOfflineSOSDraft")[0]
        self.assertNotIn("21.0285", sos_section)
        self.assertNotIn("105.8542", sos_section)
        self.assertNotIn("105.8030", sos_section)

        with open(os.path.join(FRONTEND_DIR, "js", "citizen_portal.js"), "r", encoding="utf-8") as f:
            cp_src = f.read()
        self.assertIn("selectedCoords: null", cp_src)

    def test_02_backend_sos_gps_manual_null_and_invalid(self):
        """TEST-SOS-01, 02, 03, 04, 08 & Nhóm C: Kiểm thử tích hợp trực tiếp POST /api/sos trên Backend."""
        # 1. GPS confirmed
        status, data = _post_json("/api/sos", {
            "contact_name": "Nguyen Van Test",
            "phone": "0900000001",
            "lat": 21.0375,
            "lng": 105.7825,
            "location_source": "gps",
            "location_accuracy_m": 25.0,
            "location_captured_at": "2026-11-25T03:00:00Z",
            "location_confirmed": True,
            "people_count": 2,
            "priority": "high",
        })
        self.assertEqual(status, 201)
        self.assertIsInstance(data.get("properties", {}).get("id"), int)
        self.assertEqual(data["properties"]["location_source"], "gps")
        self.assertEqual(data["properties"]["location_accuracy_m"], 25.0)
        self.assertTrue(data["properties"]["location_confirmed"])

        # 2. Manual confirmed
        status_m, data_m = _post_json("/api/sos", {
            "contact_name": "Tran Thi Manual",
            "phone": "0900000002",
            "lat": 21.0111,
            "lng": 105.8222,
            "location_source": "manual",
            "location_confirmed": True,
            "people_count": 1,
            "priority": "critical",
        })
        self.assertEqual(status_m, 201)
        self.assertEqual(data_m["properties"]["location_source"], "manual")
        self.assertIsNone(data_m["properties"]["location_accuracy_m"])

        # 3. GPS failed -> null coordinates + description (TEST-SOS-03)
        status_n, data_n = _post_json("/api/sos", {
            "contact_name": "Le Van Mất GPS",
            "phone": "0900000003",
            "lat": None,
            "lng": None,
            "location_source": "unknown",
            "location_confirmed": True,
            "location_description": "Ngo 10 duong Lang, gan cau Cong Moc",
            "location_landmark": "Gan cay xang duong Lang",
            "people_count": 3,
            "priority": "high",
        })
        self.assertEqual(status_n, 201)
        self.assertIsNone(data_n.get("geometry"))
        self.assertEqual(data_n["properties"]["location_source"], "unknown")

        # 4. Invalid SOS: null coords AND empty description -> 422 (TEST-SOS-04)
        status_inv, _ = _post_json("/api/sos", {
            "contact_name": "Invalid User",
            "phone": "0900000004",
            "lat": None,
            "lng": None,
            "location_source": "unknown",
            "location_description": "",
            "location_landmark": "",
        })
        self.assertEqual(status_inv, 422)

    def test_03_headless_edge_gps_and_sos_workflow(self):
        """TEST-GPS-01..07 & TEST-SOS-05..08: Thực thi JS thật trên Edge Headless."""
        edge_path = shutil.which("msedge") or os.path.join(
            os.environ.get("ProgramFiles(x86)", ""), "Microsoft", "Edge", "Application", "msedge.exe"
        )
        if not edge_path or not os.path.isfile(edge_path):
            self.skipTest("Không tìm thấy Microsoft Edge")

        with open(os.path.join(FRONTEND_DIR, "js", "config.js"), "r", encoding="utf-8") as f:
            config_js = f.read()
        with open(os.path.join(FRONTEND_DIR, "js", "citizen_portal.js"), "r", encoding="utf-8") as f:
            portal_js = f.read()
        with open(os.path.join(FRONTEND_DIR, "js", "rescue_manager.js"), "r", encoding="utf-8") as f:
            rescue_js = f.read()

        done_event = threading.Event()
        reported = {}
        mock_srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _MockSosHandler)
        mock_port = mock_srv.server_address[1]
        threading.Thread(target=mock_srv.serve_forever, daemon=True).start()

        class _Runner(http.server.BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass

            def do_POST(self):
                if self.path == "/report":
                    length = int(self.headers.get("Content-Length", "0"))
                    reported["json"] = json.loads(self.rfile.read(length).decode("utf-8"))
                    self.send_response(204)
                    self.end_headers()
                    done_event.set()

            def do_GET(self):
                if self.path == "/js/config.js":
                    self.send_response(200)
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(config_js.encode("utf-8"))
                elif self.path == "/js/citizen_portal.js":
                    self.send_response(200)
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(portal_js.encode("utf-8"))
                elif self.path == "/js/rescue_manager.js":
                    self.send_response(200)
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(rescue_js.encode("utf-8"))
                elif self.path == "/test_phase2.html":
                    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
  <div id="citizen-loc-verify-badge">Chưa xác định</div>
  <div id="citizen-gps-status-text"><span></span></div>
  <div id="citizen-gps-time-display"></div>
  <div id="citizen-sos-coord-display">Chưa xác định tọa độ</div>
  <div id="citizen-gps-accuracy-wrapper" class="hidden"><span id="citizen-gps-accuracy">--</span></div>
  <div id="citizen-gps-error-box" class="hidden"><div id="citizen-gps-error-msg"></div></div>
  <input id="sos-location-description" value="" />
  <input id="sos-location-landmark" value="" />
  <input id="citizen-confirm-location-check" type="checkbox" />
  <input id="sos-input-name" value="Nguyen Van Test" />
  <input id="sos-input-phone" value="0987654321" />
  <input id="sos-input-people" value="2" />
  <input id="sos-input-vulnerable" type="checkbox" />
  <select id="sos-input-depth"><option value="100" selected>100</option></select>
  <select id="sos-select-priority"><option value="high" selected>high</option></select>
  <textarea id="sos-input-notes"></textarea>
  <button id="btn-submit-sos">Submit</button>
  <div id="citizen-sos-result-card" class="hidden">
    <span id="citizen-sos-sync-badge"></span>
    <span id="citizen-sos-ticket-code"></span>
    <p id="citizen-sos-feedback-msg"></p>
  </div>
<script>
// Minimal MapLibre mock & non-blocking alert capture
window._alerts = [];
window.alert = (msg) => {{ window._alerts.push(String(msg)); }};
window._geoSources = {{}};
window.maplibregl = {{
  Map: function() {{}},
  Marker: function() {{
    this.setLngLat = () => this;
    this.addTo = () => this;
    this.on = () => this;
    this.getLngLat = () => ({{ lat: 21.03, lng: 105.78 }});
  }}
}};
window.map = {{
  flyTo: () => {{}},
  isStyleLoaded: () => true,
  getSource: (id) => window._geoSources[id] || null,
  addSource: (id, obj) => {{
    window._geoSources[id] = {{
      data: obj.data,
      setData: function(d) {{ this.data = d; }}
    }};
  }},
  addLayer: () => {{}}
}};
</script>
<script src="/js/config.js"></script>
<script src="/js/citizen_portal.js"></script>
<script src="/js/rescue_manager.js"></script>
<script>
(async () => {{
  const out = {{}};
  try {{
    // TEST-GPS-01: Initial state
    CitizenPortal.init();
    out.gps01_coordsNull = CitizenPortal.state.selectedCoords === null;
    out.gps01_status = CitizenPortal.state.locationStatus;
    out.gps01_accHidden = document.getElementById('citizen-gps-accuracy-wrapper').classList.contains('hidden');
    out.gps01_coordText = document.getElementById('citizen-sos-coord-display').textContent.trim();

    // TEST-GPS-02 & TEST-GPS-07: GPS success + GeoJSON circle
    let geoMode = 'ok';
    Object.defineProperty(navigator, 'geolocation', {{
      configurable: true,
      value: {{
        getCurrentPosition: (ok, err) => {{
          if (geoMode === 'ok') {{
            ok({{ coords: {{ latitude: 21.0375, longitude: 105.7825, accuracy: 42.4 }} }});
          }} else if (geoMode === 'denied') {{
            err({{ code: 1, message: 'User denied' }});
          }} else if (geoMode === 'timeout') {{
            err({{ code: 3, message: 'Timeout' }});
          }}
        }}
      }}
    }});

    CitizenPortal.locateGPSWithAccuracy();
    out.gps02_status = CitizenPortal.state.locationStatus;
    out.gps02_acc = CitizenPortal.state.locationAccuracy;
    out.gps02_hasTime = !!CitizenPortal.state.locationCapturedAt;
    const accSrc = window._geoSources['citizen-gps-accuracy-source'];
    out.gps07_hasCircle = !!(accSrc && accSrc.data.features.length === 1 && accSrc.data.features[0].properties.radius_m === 42);

    // TEST-GPS-06: Confirm -> then change coords -> confirm must clear!
    CitizenPortal.onLocationVerifiedChange(true);
    out.gps06_confirmed = CitizenPortal.state.locationStatus;
    CitizenPortal.setSOSLocation(21.0150, 105.8250, null, 'manual');
    out.gps06_cleared = CitizenPortal.state.locationConfirmed === false;
    out.gps05_manualStatus = CitizenPortal.state.locationStatus;
    out.gps05_source = CitizenPortal.state.locationSource;
    out.gps07_circleClearedOnManual = !!(accSrc && accSrc.data.features.length === 0);

    // TEST-GPS-03 & TEST-GPS-04: Permission denied & Timeout on fresh reset
    CitizenPortal.state.selectedCoords = null;
    geoMode = 'denied';
    CitizenPortal.locateGPSWithAccuracy();
    out.gps03_status = CitizenPortal.state.locationStatus;
    out.gps03_coordsStillNull = CitizenPortal.state.selectedCoords === null;

    geoMode = 'timeout';
    CitizenPortal.locateGPSWithAccuracy();
    out.gps04_status = CitizenPortal.state.locationStatus;
    out.gps04_coordsStillNull = CitizenPortal.state.selectedCoords === null;

    // Prepare verified manual location for SOS protocol tests
    CitizenPortal.setSOSLocation(21.0150, 105.8250, null, 'manual');
    CitizenPortal.onLocationVerifiedChange(true);

    // TEST-SOS-08: Server returns valid ID 42
    GRASSTOUCHER_CONFIG.setApiBaseUrl('http://127.0.0.1:{mock_port}');
    await NorthStarRescue.submitSOSBeacon();
    out.sos08_ticket = document.getElementById('citizen-sos-ticket-code').textContent.trim();
    out.sos08_badge = document.getElementById('citizen-sos-sync-badge').textContent.trim();

    // Helper to inject X-Mock-Mode header via fetch wrapper for 500, no_id, timeout
    const origFetch = window.fetch;
    let currentMockMode = 'no_id';
    window.fetch = (u, opts = {{}}) => {{
      const headers = Object.assign({{}}, opts.headers || {{}}, {{ 'X-Mock-Mode': currentMockMode }});
      return origFetch(u, Object.assign({{}}, opts, {{ headers }}));
    }};

    // TEST-SOS-07: Server 201 without ID
    currentMockMode = 'no_id';
    await NorthStarRescue.submitSOSBeacon();
    out.sos07_ticket = document.getElementById('citizen-sos-ticket-code').textContent.trim();
    out.sos07_badge = document.getElementById('citizen-sos-sync-badge').textContent.trim();

    // TEST-SOS-05: Server 500 -> PENDING_OFFLINE
    currentMockMode = '500';
    await NorthStarRescue.submitSOSBeacon();
    out.sos05_badge = document.getElementById('citizen-sos-sync-badge').textContent.trim();

    // TEST-SOS-06: Timeout -> PENDING_OFFLINE
    currentMockMode = 'slow';
    GRASSTOUCHER_CONFIG.DEFAULT_TIMEOUT_MS = 250;
    await NorthStarRescue.submitSOSBeacon();
    out.sos06_badge = document.getElementById('citizen-sos-sync-badge').textContent.trim();

    window.fetch = origFetch;
  }} catch (e) {{
    out.fatal = String(e);
  }}
  await fetch('/report', {{ method: 'POST', body: JSON.stringify(out) }});
}})();
</script>
</body></html>"""
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(html.encode("utf-8"))

        runner_srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Runner)
        runner_port = runner_srv.server_address[1]
        threading.Thread(target=runner_srv.serve_forever, daemon=True).start()

        proc = subprocess.Popen(
            [edge_path, "--headless", "--disable-gpu", f"http://127.0.0.1:{runner_port}/test_phase2.html"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            self.assertTrue(done_event.wait(timeout=15), "Edge headless timeout")
            d = reported["json"]
            self.assertNotIn("fatal", d)
            self.assertTrue(d["gps01_coordsNull"])
            self.assertEqual(d["gps01_status"], "UNKNOWN")
            self.assertTrue(d["gps01_accHidden"])
            self.assertEqual(d["gps01_coordText"], "Chưa xác định tọa độ")
            self.assertEqual(d["gps02_status"], "GPS_DETECTED")
            self.assertEqual(d["gps02_acc"], 42)
            self.assertTrue(d["gps02_hasTime"])
            self.assertTrue(d["gps07_hasCircle"])
            self.assertEqual(d["gps06_confirmed"], "USER_CONFIRMED")
            self.assertTrue(d["gps06_cleared"])
            self.assertEqual(d["gps05_manualStatus"], "MANUAL_SELECTED")
            self.assertEqual(d["gps05_source"], "manual")
            self.assertTrue(d["gps07_circleClearedOnManual"])
            self.assertEqual(d["gps03_status"], "LOCATION_ERROR")
            self.assertTrue(d["gps03_coordsStillNull"])
            self.assertEqual(d["gps04_status"], "LOCATION_ERROR")
            self.assertTrue(d["gps04_coordsStillNull"])
            self.assertEqual(d["sos08_ticket"], "#SOS-2026-0042")
            self.assertEqual(d["sos08_badge"], "ĐÃ TIẾP NHẬN (MÁY CHỦ)")
            self.assertEqual(d["sos07_ticket"], "CHƯA CẤP MÃ HỒ SƠ")
            self.assertEqual(d["sos07_badge"], "GỬI THẤT BẠI")
            self.assertEqual(d["sos05_badge"], "LƯU TRÊN MÁY (CHƯA GỬI)")
            self.assertEqual(d["sos06_badge"], "LƯU TRÊN MÁY (CHƯA GỬI)")
        finally:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                pass
            mock_srv.shutdown()
            runner_srv.shutdown()
            mock_srv.server_close()
            runner_srv.server_close()


if __name__ == "__main__":
    unittest.main()
