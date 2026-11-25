"""
Phase 5 (CIT-06) PWA, Service Worker, and Manifest Tests (PWA-01..PWA-22).
Combines static/manifest checks, real Edge Headless SW + Cache Storage + IndexedDB tests,
and explicit SKIPPED markers for physical Android/iOS devices when not connected.
"""
import functools
import http.server
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import unittest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'


class _PwaTestHandler(http.server.SimpleHTTPRequestHandler):
    state = {
        'weather_calls': 0,
        'sos_calls': 0,
        'seen_cids': {},
        'next_id': 500,
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
        if self.path.startswith('/api/weather'):
            self.state['weather_calls'] += 1
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'temp_c': 28.5,
                'updated_at': '2026-11-25T11:00:00Z'
            }).encode('utf-8'))
            return
        if self.path.startswith('/api/sos'):
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"type":"FeatureCollection","features":[{"properties":{"id":1,"phone":"0999888777"}}]}')
            return
        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(length).decode('utf-8') if length else '{}'
        data = json.loads(raw or '{}')

        if self.path == '/_pwa_done':
            self.state['done_results'] = data
            if self.state['done_event']:
                self.state['done_event'].set()
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return

        if self.path == '/api/sos':
            self.state['sos_calls'] += 1
            cid = data.get('client_event_id')
            replay = cid in self.state['seen_cids']
            if not replay:
                self.state['next_id'] += 1
                self.state['seen_cids'][cid] = self.state['next_id']
            rec_id = self.state['seen_cids'][cid]
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'type': 'Feature',
                'properties': {'id': rec_id, 'client_event_id': cid, 'idempotent_replay': replay}
            }).encode('utf-8'))
            return

        self.send_response(404)
        self._cors()
        self.end_headers()


def _build_pwa_runner_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <link rel="manifest" href="/manifest-citizen.json">
  <title>Phase 5 PWA Runner</title>
</head>
<body>
  <pre id="pwa-output">RUNNING</pre>
  <script src="/js/config.js"></script>
  <script src="/js/offline_db.js"></script>
  <script src="/js/offline_sync_manager.js"></script>
  <script>
    (async function() {{
      const results = {{}};
      function assert(cond, msg) {{
        if (!cond) throw new Error(msg);
      }}
      async function runCase(id, fn) {{
        try {{
          await fn();
          results[id] = 'PASS';
        }} catch (e) {{
          results[id] = 'FAIL: ' + (e && e.message ? e.message : String(e));
        }}
      }}
      try {{
        // PWA-05, PWA-06, PWA-07: SW registration & precache report
        const reg = await navigator.serviceWorker.register('/sw.js', {{ scope: '/' }});
        await navigator.serviceWorker.ready;
        // Wait briefly for controller claim
        if (!navigator.serviceWorker.controller) {{
          await new Promise((resolve) => {{
            const timer = setTimeout(resolve, 1500);
            navigator.serviceWorker.addEventListener('controllerchange', () => {{
              clearTimeout(timer);
              resolve();
            }}, {{ once: true }});
          }});
        }}

        await runCase('PWA-05', async () => {{
          assert(!!reg && !!reg.active, 'SW not active');
          assert(reg.scope.endsWith('/'), 'Unexpected SW scope: ' + reg.scope);
        }});

        await runCase('PWA-06', async () => {{
          const keys = await caches.keys();
          const staticKey = keys.find((k) => k.startsWith('northstar-static-'));
          assert(!!staticKey, 'Missing northstar-static-* cache');
          const cache = await caches.open(staticKey);
          const citizenCached = await cache.match('/citizen.html') || await cache.match('./citizen.html');
          const dbCached = await cache.match('/js/offline_db.js') || await cache.match('./js/offline_db.js');
          assert(!!citizenCached && !!dbCached, 'citizen.html or offline_db.js missing in STATIC_CACHE');
        }});

        await runCase('PWA-07', async () => {{
          const ctrl = navigator.serviceWorker.controller || reg.active;
          const report = await new Promise((resolve, reject) => {{
            const mc = new MessageChannel();
            const t = setTimeout(() => reject(new Error('Timeout getting precache report')), 3000);
            mc.port1.onmessage = (ev) => {{ clearTimeout(t); resolve(ev.data); }};
            ctrl.postMessage({{ type: 'GET_PRECACHE_REPORT' }}, [mc.port2]);
          }});
          assert(Array.isArray(report.failed) && report.failed.length === 0, 'Precache failed URLs: ' + JSON.stringify(report.failed));
          assert(Array.isArray(report.cached) && report.cached.length >= 18, 'Too few precached assets: ' + report.cached.length);
        }});

        // PWA-08, PWA-09, PWA-10, PWA-11: Offline cache serving + SOS saved in IndexedDB
        await runCase('PWA-08', async () => {{
          const keys = await caches.keys();
          const staticKey = keys.find((k) => k.startsWith('northstar-static-'));
          const cache = await caches.open(staticKey);
          const resp = await cache.match('/citizen.html') || await cache.match('./citizen.html');
          assert(resp && resp.status === 200, 'Cached citizen.html not available for offline');
        }});

        await runCase('PWA-11', async () => {{
          const saved = await OfflineSyncManager.enqueueSOS({{
            lat: 21.0285, lng: 105.8542, contact_name: 'PWA User', phone: '0911222333', location_confirmed: true
          }}, {{ triggerSync: false }});
          assert(saved.sync_status === 'PENDING_OFFLINE', 'Expected PENDING_OFFLINE');
          const all = await OfflineDB.getAllSOS();
          assert(all.some((r) => r.client_event_id === saved.client_event_id), 'SOS not persisted in IndexedDB');
        }});

        // PWA-12: Cache update does not delete IndexedDB
        await runCase('PWA-12', async () => {{
          await caches.open('northstar-old-v1');
          const before = await OfflineDB.getAllSOS();
          assert(before.length >= 1, 'Expected existing SOS in IndexedDB');
          await caches.delete('northstar-old-v1');
          const after = await OfflineDB.getAllSOS();
          assert(after.length === before.length, 'IndexedDB data lost after cache cleanup');
        }});

        // PWA-13 & PWA-14: Weather API cached, SOS API NOT cached in Cache Storage
        await runCase('PWA-13', async () => {{
          const r = await fetch('{base_url}/api/weather?lat=21.02&lng=105.85');
          assert(r.ok, 'Weather fetch failed');
          await new Promise((res) => setTimeout(res, 150));
          const keys = await caches.keys();
          const wKey = keys.find((k) => k.startsWith('northstar-weather-'));
          assert(!!wKey, 'Missing northstar-weather-* cache');
          const wCache = await caches.open(wKey);
          const matched = await wCache.match('{base_url}/api/weather?lat=21.02&lng=105.85');
          assert(!!matched, 'Weather response not cached in WEATHER_CACHE');
        }});

        await runCase('PWA-14', async () => {{
          const r = await fetch('{base_url}/api/sos');
          assert(r.ok, 'SOS GET failed');
          await new Promise((res) => setTimeout(res, 150));
          const keys = await caches.keys();
          for (const k of keys) {{
            const c = await caches.open(k);
            const m = await c.match('{base_url}/api/sos');
            assert(!m, 'Sensitive /api/sos response was cached in ' + k);
          }}
        }});

        // PWA-15 & PWA-16: Background Sync capability check + OfflineSyncManager fallback
        await runCase('PWA-15_16', async () => {{
          const hasBgSync = 'SyncManager' in window && !!reg.sync;
          results.bgSyncSupported = hasBgSync;
          // Either Background Sync or OfflineSyncManager syncNow must acknowledge without losing client_event_id
          const before = await OfflineDB.getAllSOS();
          const cid = before[0].client_event_id;
          window.GRASSTOUCHER_CONFIG = window.GRASSTOUCHER_CONFIG || {{}};
          window.GRASSTOUCHER_CONFIG.API_BASE_URL = '{base_url}';
          const syncRes = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
          const after = await OfflineDB.getAllSOS();
          assert(after[0].client_event_id === cid && after[0].sync_status === 'ACKNOWLEDGED', 'Expected ACKNOWLEDGED with same client_event_id, got ' + after[0].sync_status + ' (syncRes=' + JSON.stringify(syncRes) + ')');
        }});

        // PWA-18 & PWA-19: Local MapLibre + geojson cached
        await runCase('PWA-18_19', async () => {{
          const keys = await caches.keys();
          const staticKey = keys.find((k) => k.startsWith('northstar-static-'));
          const c = await caches.open(staticKey);
          const ml = await c.match('/js/vendor/maplibre-gl.js') || await c.match('./js/vendor/maplibre-gl.js');
          const geo = await c.match('/data/northern_provinces.geojson') || await c.match('./data/northern_provinces.geojson');
          assert(!!ml && !!geo, 'Local maplibre-gl.js or northern_provinces.geojson missing from cache');
        }});
      }} catch (fatal) {{
        results.FATAL = fatal && fatal.stack ? fatal.stack : String(fatal);
      }}
      document.getElementById('pwa-output').textContent = JSON.stringify(results, null, 2);
      await fetch('{base_url}/_pwa_done', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(results)
      }});
    }})();
  </script>
</body>
</html>
"""


class TestPhase5PWA(unittest.TestCase):
    def test_pwa_01_to_04_manifest_and_assets(self):
        # PWA-01..04: manifest-citizen.json + manifest.json non-interference
        with open(os.path.join(FRONTEND_DIR, 'manifest-citizen.json'), 'r', encoding='utf-8') as f:
            mc = json.load(f)
        self.assertEqual(mc['name'], 'NORTHSTAR Citizen')
        self.assertEqual(mc['short_name'], 'Citizen')
        self.assertEqual(mc['start_url'], './citizen.html')
        self.assertEqual(mc['scope'], './')
        self.assertEqual(mc['display'], 'standalone')
        self.assertGreaterEqual(len(mc['icons']), 2)
        for icon in mc['icons']:
            rel = icon['src'].lstrip('./')
            self.assertTrue(os.path.isfile(os.path.join(FRONTEND_DIR, rel)), f'Missing icon: {rel}')

        with open(os.path.join(FRONTEND_DIR, 'manifest.json'), 'r', encoding='utf-8') as f:
            cmd_manifest = json.load(f)
        self.assertEqual(cmd_manifest['start_url'], './index.html')

    def test_pwa_07_and_20_static_assets_exist_and_no_sw_conflict(self):
        with open(os.path.join(FRONTEND_DIR, 'sw.js'), 'r', encoding='utf-8') as f:
            sw_src = f.read()
        m = re.search(r'const STATIC_ASSETS\s*=\s*\[(.*?)\];', sw_src, re.S)
        self.assertIsNotNone(m, 'STATIC_ASSETS not found in sw.js')
        urls = re.findall(r"'([^']+)'", m.group(1))
        self.assertIn('./citizen.html', urls)
        self.assertIn('./index.html', urls)
        self.assertIn('./manifest-citizen.json', urls)
        for u in urls:
            if u == './':
                continue
            rel = u.lstrip('./')
            self.assertTrue(os.path.isfile(os.path.join(FRONTEND_DIR, rel)), f'Precache 404 risk: {u}')

        # PWA-20: Both citizen.html and index.html register ./sw.js
        with open(os.path.join(FRONTEND_DIR, 'citizen.html'), 'r', encoding='utf-8') as f:
            c_html = f.read()
        with open(os.path.join(FRONTEND_DIR, 'index.html'), 'r', encoding='utf-8') as f:
            i_html = f.read()
        self.assertIn('manifest-citizen.json', c_html)
        self.assertIn("register('./sw.js'", c_html)
        self.assertIn("register('./sw.js'", i_html)

    def test_pwa_browser_edge_headless_sw_cache_sync(self):
        if not os.path.exists(EDGE_PATH):
            self.skipTest('Microsoft Edge not found for headless PWA tests')

        runner_rel = '_test_phase5_pwa_runner.html'
        runner_path = os.path.join(FRONTEND_DIR, runner_rel)
        handler = functools.partial(_PwaTestHandler, directory=FRONTEND_DIR)
        httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        port = httpd.server_address[1]
        base_url = f'http://127.0.0.1:{port}'
        threading.Thread(target=httpd.serve_forever, daemon=True).start()

        _PwaTestHandler.state['done_event'] = threading.Event()
        _PwaTestHandler.state['done_results'] = None
        profile_dir = tempfile.mkdtemp(prefix='edge_p5_')
        proc = None
        try:
            with open(runner_path, 'w', encoding='utf-8') as f:
                f.write(_build_pwa_runner_html(base_url))

            cmd = [
                EDGE_PATH,
                '--headless=new',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                f'--user-data-dir={profile_dir}',
                f'{base_url}/{runner_rel}',
            ]
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            finished = _PwaTestHandler.state['done_event'].wait(timeout=25)
            self.assertTrue(finished, 'Edge Headless PWA runner timed out')
            results = _PwaTestHandler.state['done_results'] or {}
            self.assertNotIn('FATAL', results, f"JS Fatal: {results.get('FATAL')}")
            for k in ['PWA-05', 'PWA-06', 'PWA-07', 'PWA-08', 'PWA-11', 'PWA-12', 'PWA-13', 'PWA-14', 'PWA-15_16', 'PWA-18_19']:
                self.assertEqual(results.get(k), 'PASS', f'{k} failed: {results.get(k)} | all={results}')
        finally:
            if proc is not None:
                proc.terminate()
                try:
                    proc.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    proc.kill()
            httpd.shutdown()
            httpd.server_close()
            if os.path.exists(runner_path):
                os.remove(runner_path)
            shutil.rmtree(profile_dir, ignore_errors=True)

    def test_pwa_21_android_real_device(self):
        self.skipTest('PWA-21: No physical Android device attached in CI/local test environment')

    def test_pwa_22_ios_real_device(self):
        self.skipTest('PWA-22: No physical iOS device attached in CI/local test environment')


if __name__ == '__main__':
    unittest.main(verbosity=2)
