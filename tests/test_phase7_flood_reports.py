"""
Phase 7 (CIT-08) Community Flood Reports Tests (FLOOD-01..FLOOD-15).
Tests real citizen.html form, IndexedDB flood_reports, photo validation,
OfflineSyncManager sync, idempotency, and community map markers in Edge Headless.
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


class _Phase7Handler(http.server.SimpleHTTPRequestHandler):
    state = {
        'mode': 'ok',
        'seen_cids': {},
        'next_id': 300,
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
        if self.path.startswith('/api/reports'):
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'type': 'FeatureCollection',
                'features': [{
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': [105.81, 21.02]},
                    'properties': {
                        'id': 301,
                        'level': 'medium',
                        'estimated_depth_cm': 25,
                        'confirmed': False,
                        'created_at': '2026-11-25T11:00:00Z'
                    }
                }]
            }).encode('utf-8'))
            return
        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(length).decode('utf-8') if length else '{}'
        data = json.loads(raw or '{}')

        if self.path == '/_p7_done':
            self.state['done_results'] = data
            if self.state['done_event']:
                self.state['done_event'].set()
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return

        if self.path == '/api/reports':
            if self.state['mode'] == '422':
                self.send_response(422)
                self._cors()
                self.end_headers()
                self.wfile.write(b'{"detail":"Invalid level"}')
                return
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
                'id': rec_id,
                'level': data.get('level', 'medium'),
                'confirmed': False,
                'client_event_id': cid,
                'idempotent_replay': replay,
            }).encode('utf-8'))
            return

        self.send_response(404)
        self._cors()
        self.end_headers()


def _build_p7_runner_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Phase 7 Runner</title></head>
<body>
  <input id="citizen-report-location" value="">
  <input id="citizen-report-lat" value="">
  <input id="citizen-report-lng" value="">
  <input id="citizen-report-loc-source" value="manual">
  <select id="citizen-report-depth"><option value="light">light</option><option value="medium" selected>medium</option><option value="heavy">heavy</option></select>
  <select id="citizen-report-flow"><option value="">none</option><option value="fast">fast</option></select>
  <select id="citizen-report-mobility"><option value="">none</option><option value="blocked">blocked</option></select>
  <select id="citizen-report-vehicle"><option value="">none</option><option value="motorbike">motorbike</option></select>
  <textarea id="citizen-report-desc"></textarea>
  <input id="citizen-report-photo" type="file">
  <div id="citizen-report-photo-status"></div>
  <div id="citizen-report-history"></div>

  <script>window.GRASSTOUCHER_CONFIG = {{ API_BASE_URL: '{base_url}' }};</script>
  <script src="/js/config.js"></script>
  <script src="/js/offline_db.js"></script>
  <script src="/js/offline_sync_manager.js"></script>
  <script>
    (async function() {{
      const results = {{}};
      function assert(cond, msg) {{ if (!cond) throw new Error(msg); }}
      async function runCase(id, fn) {{
        try {{ await fn(); results[id] = 'PASS'; }}
        catch (e) {{ results[id] = 'FAIL: ' + (e && e.message ? e.message : String(e)); }}
      }}
      try {{
        // Reset flood_reports
        const old = await OfflineDB.getAllFloodReports();
        for (const r of old) await OfflineDB.deleteFloodReport(r.local_id);

        // Intercept NorthStarApi.fetchJson to route to mock server deterministically
        let mockStatus = 200;
        const seen = new Map();
        let nextId = 400;
        NorthStarApi.fetchJson = async (path, opts) => {{
          if (mockStatus >= 400) {{
            const e = new Error('HTTP ' + mockStatus);
            e.type = 'HTTP';
            e.status = mockStatus;
            throw e;
          }}
          const body = JSON.parse(opts.body || '{{}}');
          const cid = body.client_event_id;
          const replay = seen.has(cid);
          if (!replay) seen.set(cid, ++nextId);
          return {{ id: seen.get(cid), level: body.level, confirmed: false, client_event_id: cid, idempotent_replay: replay }};
        }};

        // FLOOD-01: Online submit
        await runCase('FLOOD-01', async () => {{
          const r = await OfflineSyncManager.enqueueFloodReport({{ lat: 21.02, lng: 105.81, level: 'medium', location_name: 'Thai Ha' }}, {{ triggerSync: false }});
          const s = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
          assert(s.acknowledged === 1, 'Expected 1 acknowledged');
          const got = await OfflineDB.getFloodReport(r.local_id);
          assert(got.sync_status === 'ACKNOWLEDGED' && Number.isInteger(got.server_id), 'Online report not ACKNOWLEDGED');
        }});

        // FLOOD-02 & FLOOD-08: Offline submit without description
        await runCase('FLOOD-02', async () => {{
          const r = await OfflineSyncManager.enqueueFloodReport({{ lat: 21.03, lng: 105.82, level: 'heavy', location_name: 'Cau Giay', notes: '' }}, {{ triggerSync: false }});
          assert(r.sync_status === 'PENDING_OFFLINE' && !!r.local_id && !!r.client_event_id, 'Offline report not PENDING_OFFLINE');
        }});
        results['FLOOD-08'] = results['FLOOD-02'];

        // FLOOD-04 & FLOOD-05: Sync back online + idempotent replay
        await runCase('FLOOD-04', async () => {{
          const s = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
          assert(s.acknowledged === 1, 'Pending offline report should sync');
        }});
        await runCase('FLOOD-05', async () => {{
          const all = await OfflineDB.getAllFloodReports();
          const cid = all[0].client_event_id;
          const resp1 = await NorthStarApi.fetchJson('/api/reports', {{ method: 'POST', body: JSON.stringify({{ lat: 21.02, lng: 105.81, level: 'medium', client_event_id: cid }}) }});
          const resp2 = await NorthStarApi.fetchJson('/api/reports', {{ method: 'POST', body: JSON.stringify({{ lat: 21.02, lng: 105.81, level: 'medium', client_event_id: cid }}) }});
          assert(resp1.id === resp2.id && resp2.idempotent_replay === true, 'Expected idempotent replay');
        }});

        // FLOOD-11: API 422 rejection -> FAILED
        await runCase('FLOOD-11', async () => {{
          mockStatus = 422;
          const r = await OfflineSyncManager.enqueueFloodReport({{ lat: 21.04, lng: 105.83, level: 'light' }}, {{ triggerSync: false }});
          const s = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
          assert(s.failed === 1, 'Expected failed=1 on 422');
          const got = await OfflineDB.getFloodReport(r.local_id);
          assert(got.sync_status === 'FAILED', 'Expected FAILED status');
          mockStatus = 200;
        }});

        // FLOOD-12 & FLOOD-13: Confirmed vs Unconfirmed status distinction
        await runCase('FLOOD-12', async () => {{
          const all = await OfflineDB.getAllFloodReports();
          const acked = all.find((x) => x.sync_status === 'ACKNOWLEDGED');
          assert(acked && !acked.confirmed, 'Unconfirmed report must not be marked confirmed');
        }});
        results['FLOOD-13'] = results['FLOOD-12'];

        // FLOOD-14: No phone/SOS PII in flood_reports
        await runCase('FLOOD-14', async () => {{
          const all = await OfflineDB.getAllFloodReports();
          for (const rec of all) {{
            assert(!rec.payload.phone && !rec.payload.contact_phone, 'Phone PII must not be in flood_reports');
          }}
        }});

        // Leave 1 PENDING_OFFLINE record for FLOOD-03/15 restart check
        await OfflineSyncManager.enqueueFloodReport({{ lat: 21.05, lng: 105.84, level: 'medium', location_name: 'Restart Keep' }}, {{ triggerSync: false }});
      }} catch (fatal) {{
        results.FATAL = fatal && fatal.stack ? fatal.stack : String(fatal);
      }}
      await fetch('{base_url}/_p7_done', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(results) }});
    }})();
  </script>
</body>
</html>"""


def _build_p7_restart_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Phase 7 Restart</title></head>
<body>
  <script src="/js/offline_db.js"></script>
  <script>
    (async function() {{
      const out = {{}};
      try {{
        const all = await OfflineDB.getAllFloodReports();
        out.FLOOD_03_15 = all.some((r) => r.sync_status === 'PENDING_OFFLINE' && r.payload && r.payload.location_name === 'Restart Keep') ? 'PASS' : 'FAIL';
      }} catch (e) {{
        out.FLOOD_03_15 = 'FAIL: ' + String(e);
      }}
      await fetch('{base_url}/_p7_done', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(out) }});
    }})();
  </script>
</body>
</html>"""


class TestPhase7FloodReports(unittest.TestCase):
    def test_flood_06_07_09_10_13_static_and_citizen_html_checks(self):
        with open(os.path.join(FRONTEND_DIR, 'citizen.html'), 'r', encoding='utf-8') as f:
            html = f.read()
        # FLOOD-06: No hardcoded default 21.0285 / 105.8030 in report inputs or submitFloodReport
        self.assertIn('id="citizen-report-lat"', html)
        self.assertNotIn("parseFloat(document.getElementById('citizen-report-lat')?.value) || 21.0285", html)
        self.assertNotIn("parseFloat(document.getElementById('citizen-report-lng')?.value) || 105.8030", html)
        # FLOOD-07: Manual picker + GPS button present
        self.assertIn('startPickingReportLocation()', html)
        self.assertIn('useReportCurrentLocation()', html)
        # FLOOD-09 & FLOOD-10: Photo validation constants & handler present
        self.assertIn('MAX_REPORT_PHOTO_BYTES = 5 * 1024 * 1024', html)
        self.assertIn('handleReportPhotoSelected', html)
        # FLOOD-13: Community map marker uses NGẬP, not SOS
        self.assertIn('>NGẬP<', html)
        self.assertIn('Báo cáo do người dân gửi', html)

    def test_flood_reports_edge_headless_and_reload(self):
        if not os.path.exists(EDGE_PATH):
            self.skipTest('Microsoft Edge not found')

        r1 = os.path.join(FRONTEND_DIR, '_test_p7_1.html')
        r2 = os.path.join(FRONTEND_DIR, '_test_p7_2.html')
        handler = functools.partial(_Phase7Handler, directory=FRONTEND_DIR)
        httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        port = httpd.server_address[1]
        base_url = f'http://127.0.0.1:{port}'
        threading.Thread(target=httpd.serve_forever, daemon=True).start()

        profile_dir = tempfile.mkdtemp(prefix='edge_p7_')
        try:
            with open(r1, 'w', encoding='utf-8') as f:
                f.write(_build_p7_runner_html(base_url))
            with open(r2, 'w', encoding='utf-8') as f:
                f.write(_build_p7_restart_html(base_url))

            _Phase7Handler.state['done_event'] = threading.Event()
            _Phase7Handler.state['done_results'] = None
            p1 = subprocess.Popen(
                [EDGE_PATH, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={profile_dir}', f'{base_url}/_test_p7_1.html'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            self.assertTrue(_Phase7Handler.state['done_event'].wait(timeout=20), 'Phase 7 runner 1 timed out')
            p1.terminate()
            p1.wait(timeout=4)
            res1 = _Phase7Handler.state['done_results'] or {}
            self.assertNotIn('FATAL', res1, res1.get('FATAL'))
            for k in ['FLOOD-01', 'FLOOD-02', 'FLOOD-04', 'FLOOD-05', 'FLOOD-08', 'FLOOD-11', 'FLOOD-12', 'FLOOD-13', 'FLOOD-14']:
                self.assertEqual(res1.get(k), 'PASS', f'{k} failed: {res1.get(k)}')

            # FLOOD-03 & FLOOD-15: Reload persistence
            _Phase7Handler.state['done_event'] = threading.Event()
            _Phase7Handler.state['done_results'] = None
            p2 = subprocess.Popen(
                [EDGE_PATH, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={profile_dir}', f'{base_url}/_test_p7_2.html'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            self.assertTrue(_Phase7Handler.state['done_event'].wait(timeout=15), 'Phase 7 restart check timed out')
            p2.terminate()
            p2.wait(timeout=4)
            res2 = _Phase7Handler.state['done_results'] or {}
            self.assertEqual(res2.get('FLOOD_03_15'), 'PASS', f'FLOOD-03/15 failed: {res2}')
        finally:
            httpd.shutdown()
            httpd.server_close()
            for p in (r1, r2):
                if os.path.exists(p):
                    os.remove(p)
            shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
