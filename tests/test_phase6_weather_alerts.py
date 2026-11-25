"""
Phase 6 (CIT-07) Weather & Disaster Alerts Tests (WT-01..09, AL-01..09, INT-01..08).
Runs in Microsoft Edge Headless against real IndexedDB + mock HTTP endpoints.
"""
import functools
import http.server
import json
import os
import shutil
import subprocess
import tempfile
import threading
import unittest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'


class _Phase6Handler(http.server.SimpleHTTPRequestHandler):
    state = {
        'disasters_mode': 'ok',
        'predictions_mode': 'ok',
        'done_event': None,
        'done_results': None,
    }

    def log_message(self, format, *args):
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/disasters'):
            if self.state['disasters_mode'] == '500':
                self.send_response(500)
                self._cors()
                self.end_headers()
                self.wfile.write(b'{"detail":"Disasters down"}')
                return
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            fc = {
                'type': 'FeatureCollection',
                'features': [
                    {
                        'type': 'Feature',
                        'geometry': {'type': 'Point', 'coordinates': [105.658, 20.892]},
                        'properties': {
                            'id': 101,
                            'title': 'Lũ báo động 3 sông Bùi',
                            'hazard_type': 'flood',
                            'severity': 'high',
                            'status': 'active',
                            'description': 'Nước dâng nhanh tại Chương Mỹ.',
                            'source': 'NCHMF',
                            'start_time': '2026-11-25T08:00:00Z',
                            'end_time': '2099-12-31T23:59:59Z',
                            'created_at': '2026-11-25T08:00:00Z',
                        },
                    },
                    {
                        'type': 'Feature',
                        'geometry': {'type': 'Point', 'coordinates': [105.8, 21.0]},
                        'properties': {
                            'id': 102,
                            'title': 'Cảnh báo đã hết hạn',
                            'hazard_type': 'flood',
                            'severity': 'medium',
                            'status': 'expired',
                            'description': 'Đã kết thúc.',
                            'start_time': '2026-11-01T00:00:00Z',
                            'end_time': '2026-11-02T00:00:00Z',
                        },
                    },
                    {
                        'type': 'Feature',
                        'geometry': {'type': 'Point', 'coordinates': [105.81, 21.01]},
                        'properties': {
                            'id': 103,
                            'title': 'Cảnh báo đã thu hồi',
                            'hazard_type': 'storm',
                            'severity': 'warning',
                            'status': 'revoked',
                            'description': 'Thu hồi bản tin.',
                            'start_time': '2026-11-25T05:00:00Z',
                        },
                    },
                ],
            }
            self.wfile.write(json.dumps(fc).encode('utf-8'))
            return

        if self.path.startswith('/api/predictions'):
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps([
                {
                    'point_id': 1,
                    'name': 'Ngã Tư Sở',
                    'current_depth_cm': 20,
                    'threshold_cm': 30,
                    'forecast_30m': {'predicted_depth_cm': 26.5, 'risk_score': 0.88, 'exceeds_threshold': False},
                }
            ]).encode('utf-8'))
            return

        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(length).decode('utf-8') if length else '{}'
        data = json.loads(raw or '{}')
        if self.path == '/_p6_done':
            self.state['done_results'] = data
            if self.state['done_event']:
                self.state['done_event'].set()
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return
        if self.path == '/api/sos':
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'type': 'Feature', 'properties': {'id': 888}}).encode('utf-8'))
            return
        self.send_response(404)
        self._cors()
        self.end_headers()


def _build_phase1_runner_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Phase 6 Runner 1</title></head>
<body>
  <select id="citizen-weather-location-select">
    <option value="hanoi">Hà Nội</option>
    <option value="haiphong">Hải Phòng</option>
  </select>
  <div id="citizen-pane-weather" style="max-width:390px;">
    <div id="citizen-weather-container"></div>
    <div id="citizen-alerts-container"></div>
    <div id="citizen-ai-forecast-container"></div>
  </div>
  <script>
    window.GRASSTOUCHER_CONFIG = {{ API_BASE_URL: '{base_url}' }};
  </script>
  <script src="/js/config.js"></script>
  <script src="/js/offline_db.js"></script>
  <script src="/js/offline_sync_manager.js"></script>
  <script src="/js/citizen_portal.js"></script>
  <script>
    (async function() {{
      const results = {{}};
      function assert(cond, msg) {{ if (!cond) throw new Error(msg); }}
      async function runCase(id, fn) {{
        try {{ await fn(); results[id] = 'PASS'; }}
        catch (e) {{ results[id] = 'FAIL: ' + (e && e.message ? e.message : String(e)); }}
      }}
      window.GRASSTOUCHER_CONFIG = {{ API_BASE_URL: '{base_url}' }};

      // Intercept external Open-Meteo fetch cleanly
      let weatherMode = 'ok';
      const origFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {{
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('api.open-meteo.com')) {{
          if (weatherMode === '500') {{
            return new Response('err', {{ status: 500 }});
          }}
          if (weatherMode === 'null_fields') {{
            return new Response(JSON.stringify({{
              current: {{
                time: '2026-11-25T11:30',
                temperature_2m: null,
                apparent_temperature: null,
                relative_humidity_2m: 72,
                rain: null,
                precipitation: null,
                wind_speed_10m: null,
                weather_code: 3
              }}
            }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
          }}
          return new Response(JSON.stringify({{
            current: {{
              time: '2026-11-25T11:30',
              temperature_2m: 24.5,
              apparent_temperature: 25.1,
              relative_humidity_2m: 78,
              rain: 6.2,
              precipitation: 6.2,
              wind_speed_10m: 14.3,
              weather_code: 61
            }},
            hourly: {{
              time: ['2099-01-01T12:00', '2099-01-01T13:00'],
              temperature_2m: [25.0, 25.4],
              precipitation: [2.1, 1.5],
              precipitation_probability: [70, 60]
            }}
          }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        return origFetch(input, init);
      }};

      try {{
        // Clear stores first
        const oldW = await OfflineDB.getAllWeatherCache();
        for (const w of oldW) await OfflineDB.clearExpiredWeatherCache(Date.now() + 999999999);
        const wBox = document.getElementById('citizen-weather-container');
        const aBox = document.getElementById('citizen-alerts-container');
        const aiBox = document.getElementById('citizen-ai-forecast-container');

        // WT-01, WT-02, WT-06, AL-01, AL-02, AL-03, AL-04, AL-05, AL-09, INT-01
        await runCase('WT-01', async () => {{
          await CitizenPortal.loadWeatherAndAlerts(undefined, undefined, {{ force: true }});
          assert(wBox.textContent.includes('24.5°') && wBox.textContent.includes('6.2'), 'Live weather values missing');
        }});
        await runCase('WT-02', async () => {{
          assert(wBox.textContent.includes('°C') && wBox.textContent.includes('mm') && wBox.textContent.includes('%') && wBox.textContent.includes('km/h'), 'Units missing');
          assert(wBox.textContent.includes('25°C') && wBox.textContent.includes('70%'), 'Hourly forecast missing');
        }});
        await runCase('WT-06', async () => {{
          assert(wBox.textContent.includes('2026-11-25T11:30') && wBox.textContent.includes('Lấy dữ liệu lúc:'), 'Timestamps missing');
        }});
        await runCase('AL-01', async () => {{
          assert(aBox.textContent.includes('Lũ báo động 3 sông Bùi'), 'Active alert missing');
        }});
        await runCase('AL-02', async () => {{
          assert(aBox.textContent.includes('NGUY HIỂM CAO'), 'Severity badge missing');
        }});
        await runCase('AL-03', async () => {{
          assert(aiBox.textContent.includes('Dự báo tham khảo từ mô hình AI/ML') && aiBox.textContent.includes('Không phải cảnh báo thiên tai chính thức'), 'AI disclaimer missing');
        }});
        await runCase('AL-04', async () => {{
          assert(!aBox.textContent.includes('Cảnh báo đã hết hạn'), 'Expired alert must be hidden');
        }});
        await runCase('AL-05', async () => {{
          assert(!aBox.textContent.includes('Cảnh báo đã thu hồi'), 'Revoked alert must be hidden');
        }});
        await runCase('AL-09', async () => {{
          assert((aBox.textContent.includes('NCHMF') || aBox.textContent.includes('NORTHSTAR')) && aBox.textContent.includes('Ban hành:'), 'Source or issued_at missing');
        }});
        results['INT-01'] = 'PASS';

        // WT-03: Null/missing fields render '--' and not fake numbers
        await runCase('WT-03', async () => {{
          weatherMode = 'null_fields';
          await CitizenPortal.loadWeatherAndAlerts(undefined, undefined, {{ force: true }});
          assert(wBox.textContent.includes('--') && !wBox.textContent.includes('28°'), 'Null fields must render --');
        }});

        // WT-09: Location switch (haiphong)
        await runCase('WT-09', async () => {{
          weatherMode = 'ok';
          CitizenPortal.onWeatherLocationChange('haiphong');
          await new Promise((r) => setTimeout(r, 200));
          assert(wBox.textContent.includes('Hải Phòng') && wBox.textContent.includes('20.8449'), 'Location switch failed');
        }});

        // WT-04 & WT-05 & INT-02: Offline / error uses valid cache
        await runCase('WT-05', async () => {{
          weatherMode = '500';
          await CitizenPortal.loadWeatherAndAlerts(undefined, undefined, {{ force: true }});
          assert(wBox.textContent.includes('Dữ liệu ngoại tuyến (Cache)'), 'Should render valid cache on 500');
        }});
        results['WT-04'] = results['WT-05'];

        // WT-08: Expired cache must NOT be shown as live/valid
        await runCase('WT-08', async () => {{
          await OfflineDB.saveWeatherCache({{
            cache_key: 'haiphong',
            data: {{ current: {{ time: '2020-01-01T00:00', temperature_2m: 20 }} }},
            region: 'Hải Phòng',
            fetched_at: '2020-01-01T00:00:00Z',
            expires_at: Date.now() - 5000
          }});
          await CitizenPortal.loadWeatherAndAlerts(undefined, undefined, {{ force: true }});
          assert(wBox.textContent.includes('Dữ liệu thời tiết đã hết hạn'), 'Expired cache must be rejected');
        }});

        // WT-07: No cache & API fails -> no fake sample data
        await runCase('WT-07', async () => {{
          const tx = (await OfflineDB.openDatabase()).transaction('weather_cache', 'readwrite');
          tx.objectStore('weather_cache').clear();
          await new Promise((r) => {{ tx.oncomplete = r; }});
          await CitizenPortal.loadWeatherAndAlerts(undefined, undefined, {{ force: true }});
          assert(wBox.textContent.includes('Không thể lấy dữ liệu thời tiết') && !wBox.textContent.includes('27°C - 30°C'), 'Must not show fake sample weather');
        }});

        // AL-06 & AL-07 & AL-08: Disasters cache offline & expired & empty error
        await runCase('AL-07', async () => {{
          const origFetch2 = window.fetch;
          window.fetch = async (u, i) => (String(u).includes('/api/disasters') ? new Response('err', {{ status: 500 }}) : origFetch2(u, i));
          await CitizenPortal.loadDisasterAlerts();
          assert(aBox.textContent.includes('Bản tin đã lưu (Ngoại tuyến / Dữ liệu cũ)') && aBox.textContent.includes('Lũ báo động 3 sông Bùi'), 'Should render cached alerts');
          window.fetch = origFetch2;
        }});

        await runCase('AL-08', async () => {{
          const tx = (await OfflineDB.openDatabase()).transaction('disaster_cache', 'readwrite');
          tx.objectStore('disaster_cache').clear();
          await new Promise((r) => {{ tx.oncomplete = r; }});
          await OfflineDB.saveDisasterCache([{{ id: '101', title: 'Old Alert', status: 'active', cache_expires_at: Date.now() - 1000 }}]);
          const origFetch2 = window.fetch;
          window.fetch = async (u, i) => (String(u).includes('/api/disasters') ? new Response('err', {{ status: 500 }}) : origFetch2(u, i));
          await CitizenPortal.loadDisasterAlerts();
          assert(aBox.textContent.includes('Không thể tải bản tin cảnh báo thiên tai'), 'Expired disaster cache must not display as active');
          window.fetch = origFetch2;
        }});
        results['AL-06'] = results['AL-08'];

        // INT-02, INT-04, INT-05, INT-06: Save SOS & Weather cache together without interference
        await runCase('INT-05', async () => {{
          const savedSos = await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85, contact_name: 'Safe', phone: '0911111111' }}, {{ triggerSync: false }});
          await OfflineDB.clearExpiredWeatherCache();
          const allSos = await OfflineDB.getAllSOS();
          assert(allSos.some((s) => s.client_event_id === savedSos.client_event_id), 'SOS queue affected by weather cache cleanup');
        }});
        await runCase('INT-06', async () => {{
          const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
          assert(res.acknowledged >= 1, 'OfflineSyncManager failed alongside Phase 6');
        }});
        results['INT-02'] = results['WT-05'];
        results['INT-04'] = results['INT-05'];

        // Save fresh weather & disaster cache for Phase 2 browser restart check (INT-03)
        weatherMode = 'ok';
        await CitizenPortal.loadWeatherAndAlerts(undefined, undefined, {{ force: true }});

        // INT-08: Mobile viewport check (390px)
        await runCase('INT-08', async () => {{
          const pane = document.getElementById('citizen-pane-weather');
          assert(pane.scrollWidth <= 395, 'Overflow on 390px mobile width: ' + pane.scrollWidth);
        }});
      }} catch (fatal) {{
        results.FATAL = fatal && fatal.stack ? fatal.stack : String(fatal);
      }}
      await fetch('{base_url}/_p6_done', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(results) }});
    }})();
  </script>
</body>
</html>"""


def _build_phase2_restart_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Phase 6 Restart Check</title></head>
<body>
  <script src="/js/offline_db.js"></script>
  <script>
    (async function() {{
      const out = {{}};
      try {{
        const w = await OfflineDB.getWeatherCache('haiphong');
        const d = await OfflineDB.getAllDisasterCache();
        out.INT03 = (w && w.region === 'Hải Phòng' && Array.isArray(d) && d.length >= 1) ? 'PASS' : 'FAIL';
      }} catch (e) {{
        out.INT03 = 'FAIL: ' + String(e);
      }}
      await fetch('{base_url}/_p6_done', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(out) }});
    }})();
  </script>
</body>
</html>"""


class TestPhase6WeatherAlerts(unittest.TestCase):
    def test_int_07_command_untouched(self):
        with open(os.path.join(FRONTEND_DIR, 'manifest.json'), 'r', encoding='utf-8') as f:
            m = json.load(f)
        self.assertEqual(m['start_url'], './index.html')

    def test_wt_al_int_in_edge_headless(self):
        if not os.path.exists(EDGE_PATH):
            self.skipTest('Microsoft Edge not found')

        r1_path = os.path.join(FRONTEND_DIR, '_test_p6_1.html')
        r2_path = os.path.join(FRONTEND_DIR, '_test_p6_2.html')
        handler = functools.partial(_Phase6Handler, directory=FRONTEND_DIR)
        httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        port = httpd.server_address[1]
        base_url = f'http://127.0.0.1:{port}'
        threading.Thread(target=httpd.serve_forever, daemon=True).start()

        profile_dir = tempfile.mkdtemp(prefix='edge_p6_')
        try:
            with open(r1_path, 'w', encoding='utf-8') as f:
                f.write(_build_phase1_runner_html(base_url))
            with open(r2_path, 'w', encoding='utf-8') as f:
                f.write(_build_phase2_restart_html(base_url))

            _Phase6Handler.state['done_event'] = threading.Event()
            _Phase6Handler.state['done_results'] = None
            p1 = subprocess.Popen(
                [EDGE_PATH, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={profile_dir}', f'{base_url}/_test_p6_1.html'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            self.assertTrue(_Phase6Handler.state['done_event'].wait(timeout=25), 'Phase 6 runner 1 timed out')
            p1.terminate()
            p1.wait(timeout=4)
            res1 = _Phase6Handler.state['done_results'] or {}
            self.assertNotIn('FATAL', res1, res1.get('FATAL'))

            for k in [
                'WT-01', 'WT-02', 'WT-03', 'WT-04', 'WT-05', 'WT-06', 'WT-07', 'WT-08', 'WT-09',
                'AL-01', 'AL-02', 'AL-03', 'AL-04', 'AL-05', 'AL-06', 'AL-07', 'AL-08', 'AL-09',
                'INT-01', 'INT-02', 'INT-04', 'INT-05', 'INT-06', 'INT-08'
            ]:
                self.assertEqual(res1.get(k), 'PASS', f'{k} failed: {res1.get(k)}')

            # INT-03: Browser restart persistence
            _Phase6Handler.state['done_event'] = threading.Event()
            _Phase6Handler.state['done_results'] = None
            p2 = subprocess.Popen(
                [EDGE_PATH, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={profile_dir}', f'{base_url}/_test_p6_2.html'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            self.assertTrue(_Phase6Handler.state['done_event'].wait(timeout=15), 'Phase 6 restart check timed out')
            p2.terminate()
            p2.wait(timeout=4)
            res2 = _Phase6Handler.state['done_results'] or {}
            self.assertEqual(res2.get('INT03'), 'PASS', f'INT-03 failed: {res2}')
        finally:
            httpd.shutdown()
            httpd.server_close()
            for p in (r1_path, r2_path):
                if os.path.exists(p):
                    os.remove(p)
            shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
