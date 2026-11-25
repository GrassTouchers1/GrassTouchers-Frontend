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
Kiểm thử Giai đoạn 1 (CIT-01): Bảo mật & Chuẩn hóa Cấu hình API NORTHSTAR CITIZEN.
"""

import http.server
import json
import os
import re
import shutil
import subprocess
import threading
import time
import unittest
import urllib.request

FRONTEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CITIZEN_FILES = [
    "citizen.html",
    os.path.join("js", "citizen_portal.js"),
    os.path.join("js", "rescue_manager.js"),
    os.path.join("js", "offline_sync_manager.js"),
    os.path.join("js", "ai_assistant.js"),
]


class _MockApiHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/mock/ok":
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
        elif self.path == "/mock/404":
            self.send_response(404)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": "Not found"}).encode("utf-8"))
        elif self.path == "/mock/500":
            self.send_response(500)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": "Internal error"}).encode("utf-8"))
        elif self.path == "/mock/bad-json":
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"{invalid_json")
        elif self.path == "/mock/slow":
            time.sleep(1.2)
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"slow": true}')
        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()


class TestPhase1SecurityAndConfig(unittest.TestCase):
    """Kiểm tra toàn diện tiêu chí nghiệm thu Giai đoạn 1."""

    def test_01_no_hardcoded_localhost_urls_in_citizen_modules(self):
        """Không còn URL 127.0.0.1:8000 hoặc localhost:8000 hardcode trong các tệp Citizen."""
        pattern = re.compile(r"127\.0\.0\.1:8000|localhost:8000", re.IGNORECASE)
        matches = []
        for rel_path in CITIZEN_FILES:
            full_path = os.path.join(FRONTEND_DIR, rel_path)
            with open(full_path, "r", encoding="utf-8") as f:
                for line_no, line in enumerate(f, start=1):
                    if pattern.search(line):
                        matches.append(f"{rel_path}:{line_no}")
        self.assertEqual(matches, [], f"Phát hiện URL hardcode chưa loại bỏ: {matches}")

    def test_02_gitignore_protects_env_files(self):
        """Kiểm tra .gitignore của Frontend bảo vệ các tệp .env."""
        gitignore_path = os.path.join(FRONTEND_DIR, ".gitignore")
        with open(gitignore_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn(".env", content)

    def test_03_backend_cors_header(self):
        """Kiểm tra CORS header từ Backend khi Citizen chạy trên cổng 3000."""
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/health",
            headers={"Origin": "http://localhost:3000"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn(resp.headers.get("Access-Control-Allow-Origin"), ["*", "http://localhost:3000"])

    def test_04_js_config_and_api_helper_in_headless_browser(self):
        """Thực thi trực tiếp js/config.js trên Edge headless để kiểm tra dev/prod/timeout/404/500/JSON/abort."""
        edge_path = shutil.which("msedge") or os.path.join(
            os.environ.get("ProgramFiles(x86)", ""), "Microsoft", "Edge", "Application", "msedge.exe"
        )
        if not edge_path or not os.path.isfile(edge_path):
            self.skipTest("Không tìm thấy Microsoft Edge trên hệ thống")

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _MockApiHandler)
        mock_port = server.server_address[1]
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()

        with open(os.path.join(FRONTEND_DIR, "js", "config.js"), "r", encoding="utf-8") as f:
            config_js = f.read()

        # Serve temporary runner via in-memory handler? Use a data: or local http route on a second handler
        results_holder = {}

        done_event = threading.Event()
        reported_data = {}

        class _RunnerHandler(http.server.BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass

            def do_POST(self):
                if self.path == "/report":
                    length = int(self.headers.get("Content-Length", "0"))
                    body = self.rfile.read(length).decode("utf-8")
                    reported_data["json"] = json.loads(body)
                    self.send_response(204)
                    self.end_headers()
                    done_event.set()

            def do_GET(self):
                if self.path == "/js/config.js":
                    self.send_response(200)
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(config_js.encode("utf-8"))
                elif self.path.startswith("/runner.html"):
                    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><script src="/js/config.js"></script></head>
<body><pre id="out">PENDING</pre>
<script>
(async () => {{
  const res = {{}};
  try {{
    // 1. Dev mode
    res.devApiUrl = GRASSTOUCHER_CONFIG.getApiUrl('/api/health');

    // 2. Production same-origin (empty Base URL)
    GRASSTOUCHER_CONFIG.setApiBaseUrl('');
    res.prodRelativeUrl = GRASSTOUCHER_CONFIG.getApiUrl('/api/health');
    res.prodValid = GRASSTOUCHER_CONFIG.validateConfig().valid;

    // 3. Invalid Base URL handling
    try {{
      GRASSTOUCHER_CONFIG.setApiBaseUrl('ftp://invalid-scheme');
      res.invalidRejected = false;
    }} catch (e) {{
      res.invalidRejected = true;
    }}

    // 4. Point to mock server for HTTP/timeout/JSON/Abort tests
    GRASSTOUCHER_CONFIG.setApiBaseUrl('http://127.0.0.1:{mock_port}');
    const okData = await NorthStarApi.fetchJson('/mock/ok');
    res.okPass = okData && okData.ok === true;

    try {{ await NorthStarApi.fetchJson('/mock/404'); }} catch (e) {{ res.err404 = e.type + ':' + e.status; }}
    try {{ await NorthStarApi.fetchJson('/mock/500'); }} catch (e) {{ res.err500 = e.type + ':' + e.status; }}
    try {{ await NorthStarApi.fetchJson('/mock/bad-json'); }} catch (e) {{ res.errJson = e.type; }}
    try {{ await NorthStarApi.fetchJson('/mock/slow', {{ timeoutMs: 250 }}); }} catch (e) {{ res.errTimeout = e.type; }}

    const ac = new AbortController();
    const pAbort = NorthStarApi.fetchJson('/mock/slow', {{ signal: ac.signal }});
    ac.abort();
    try {{ await pAbort; }} catch (e) {{ res.errAbort = e.type; }}

    const redacted = NorthStarApi.sanitizeForLog({{ phone: '0900000000', lat: 21.0, token: 'abc', safe: 'ok' }});
    res.sanitized = redacted.phone === '[REDACTED]' && redacted.lat === '[REDACTED]' && redacted.token === '[REDACTED]' && redacted.safe === 'ok';
  }} catch (fatal) {{
    res.fatal = String(fatal);
  }}
  await fetch('/report', {{ method: 'POST', body: JSON.stringify(res) }});
}})();
</script></body></html>"""
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(html.encode("utf-8"))

        runner_srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _RunnerHandler)
        runner_port = runner_srv.server_address[1]
        t2 = threading.Thread(target=runner_srv.serve_forever, daemon=True)
        t2.start()

        proc = subprocess.Popen(
            [
                edge_path,
                "--headless",
                "--disable-gpu",
                f"http://127.0.0.1:{runner_port}/runner.html",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            finished = done_event.wait(timeout=12)
            self.assertTrue(finished, "Edge headless không gửi kết quả /report trong thời gian quy định")
            data = reported_data["json"]
            self.assertNotIn("fatal", data)
            self.assertEqual(data.get("prodRelativeUrl"), "/api/health")
            self.assertTrue(data.get("prodValid"))
            self.assertTrue(data.get("invalidRejected"))
            self.assertTrue(data.get("okPass"))
            self.assertEqual(data.get("err404"), "HTTP:404")
            self.assertEqual(data.get("err500"), "HTTP:500")
            self.assertEqual(data.get("errJson"), "JSON_PARSE")
            self.assertEqual(data.get("errTimeout"), "TIMEOUT")
            self.assertEqual(data.get("errAbort"), "ABORTED")
            self.assertTrue(data.get("sanitized"))
        finally:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                pass
            server.shutdown()
            runner_srv.shutdown()
            server.server_close()
            runner_srv.server_close()


if __name__ == "__main__":
    unittest.main()
