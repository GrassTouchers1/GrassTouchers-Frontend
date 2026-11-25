"""
Phase 4 (CIT-05) Offline Sync, Retry & Idempotency Tests (SYNC-01..SYNC-22).
Runs in Microsoft Edge Headless against real IndexedDB + local mock HTTP server.
"""
import functools
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import tempfile
import threading
import unittest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

TEST_STATE = {
    'mode': 'ok',
    'sos_calls': [],
    'report_calls': [],
    'seen_ids': {},
    'next_id': 100,
    'fail_times': 0,
}


class _MockApiAndStaticHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Expose-Headers', 'Retry-After')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(length).decode('utf-8') if length else '{}'
        data = json.loads(raw or '{}')
        mode = TEST_STATE['mode']

        if self.path == '/_done':
            TEST_STATE['done_results'] = data
            TEST_STATE['done_event'].set()
            self.send_response(200)
            self._send_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return

        if self.path == '/api/sos':
            TEST_STATE['sos_calls'].append(data)
        elif self.path == '/api/reports':
            TEST_STATE['report_calls'].append(data)
        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()
            return

        if mode == '503':
            self.send_response(503)
            self._send_cors()
            self.end_headers()
            self.wfile.write(b'{"detail":"Service Unavailable"}')
            return

        if mode == '429':
            self.send_response(429)
            self._send_cors()
            self.send_header('Retry-After', '3')
            self.end_headers()
            self.wfile.write(b'{"detail":"Too Many Requests"}')
            return

        if mode in ('400', '409', '422'):
            code = int(mode)
            self.send_response(code)
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({'detail': f'Error {code}'}).encode('utf-8'))
            return

        if mode == 'missing_id':
            self.send_response(200)
            self._send_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return

        if mode == 'flaky_once' and TEST_STATE['fail_times'] > 0:
            TEST_STATE['fail_times'] -= 1
            self.send_response(503)
            self._send_cors()
            self.end_headers()
            self.wfile.write(b'{"detail":"Transient"}')
            return

        cid = data.get('client_event_id')
        replay = False
        if cid and cid in TEST_STATE['seen_ids']:
            rec_id = TEST_STATE['seen_ids'][cid]
            replay = True
        else:
            TEST_STATE['next_id'] += 1
            rec_id = TEST_STATE['next_id']
            if cid:
                TEST_STATE['seen_ids'][cid] = rec_id

        self.send_response(200)
        self._send_cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        if self.path == '/_done':
            TEST_STATE['done_results'] = data
            TEST_STATE['done_event'].set()
            self.send_response(200)
            self._send_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return

        if self.path == '/api/sos':
            body = {
                'type': 'Feature',
                'properties': {
                    'id': rec_id,
                    'client_event_id': cid,
                    'idempotent_replay': replay,
                },
            }
        else:
            body = {
                'id': rec_id,
                'client_event_id': cid,
                'idempotent_replay': replay,
            }
        self.wfile.write(json.dumps(body).encode('utf-8'))


def _build_runner_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Phase 4 Offline Sync Runner</title></head>
<body>
  <div id="citizen-network-status">
    <span id="citizen-network-dot"></span>
    <span id="citizen-network-label">Trực tuyến</span>
    <span id="citizen-sync-pending-badge" class="hidden">0</span>
  </div>
  <span id="citizen-sync-status-text"></span>
  <button id="btn-citizen-manual-sync" class="hidden"></button>
  <span id="citizen-sos-sync-badge" class="hidden"></span>
  <pre id="test-output">RUNNING</pre>

  <script src="/js/config.js"></script>
  <script src="/js/offline_db.js"></script>
  <script src="/js/offline_sync_manager.js"></script>
  <script>
    (async function() {{
      const results = {{}};
      try {{
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
      async function resetAll() {{
        localStorage.clear();
        const sos = await OfflineDB.getAllSOS();
        for (const r of sos) await OfflineDB.deleteSOS(r.local_id);
        const rpts = await OfflineDB.getAllFloodReports();
        for (const r of rpts) await OfflineDB.deleteFloodReport(r.local_id);
      }}

      window.GRASSTOUCHER_CONFIG = window.GRASSTOUCHER_CONFIG || {{}};
      window.GRASSTOUCHER_CONFIG.API_BASE_URL = '{base_url}';

      // SYNC-01: Stable UUID client_event_id
      await runCase('SYNC-01', async () => {{
        const cid = OfflineSyncManager.generateClientEventId();
        assert(typeof cid === 'string' && cid.length >= 20, 'Invalid client_event_id');
      }});

      // SYNC-02 & SYNC-03: Enqueue SOS & Flood Report in IndexedDB
      await runCase('SYNC-02', async () => {{
        await resetAll();
        const saved = await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85, contact_name: 'A', contact_phone: '0911111111' }}, {{ triggerSync: false }});
        assert(saved.sync_status === 'PENDING_OFFLINE', 'Expected PENDING_OFFLINE');
        const all = await OfflineDB.getAllSOS();
        assert(all.length === 1 && all[0].client_event_id === saved.client_event_id, 'Missing in sos_queue');
      }});

      await runCase('SYNC-03', async () => {{
        await resetAll();
        const saved = await OfflineSyncManager.enqueueFloodReport({{ lat: 21.03, lng: 105.80, level: 'high' }}, {{ triggerSync: false }});
        assert(saved.sync_status === 'PENDING_OFFLINE', 'Expected PENDING_OFFLINE');
        const all = await OfflineDB.getAllFloodReports();
        assert(all.length === 1 && all[0].client_event_id === saved.client_event_id, 'Missing in flood_reports');
      }});

      // SYNC-04: Skip when offline
      await runCase('SYNC-04', async () => {{
        await resetAll();
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ triggerSync: false }});
        Object.defineProperty(navigator, 'onLine', {{ configurable: true, get: () => false }});
        const res = await OfflineSyncManager.syncNow();
        delete navigator.onLine;
        assert(res.skipped && res.reason === 'offline', 'Should skip when offline');
      }});

      // SYNC-05 & SYNC-06: Acknowledge SOS & Flood Report with valid numeric server_id
      await runCase('SYNC-05', async () => {{
        await resetAll();
        const saved = await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85, people_count: 2 }}, {{ triggerSync: false }});
        const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        assert(res.acknowledged === 1, 'Expected 1 acknowledged SOS');
        const all = await OfflineDB.getAllSOS();
        assert(all.length === 1, 'SOS record must not be deleted');
        assert(all[0].sync_status === 'ACKNOWLEDGED' && Number.isInteger(all[0].server_id), 'Expected ACKNOWLEDGED with numeric server_id');
        assert(all[0].client_event_id === saved.client_event_id, 'client_event_id changed');
      }});

      await runCase('SYNC-06', async () => {{
        await resetAll();
        await OfflineSyncManager.enqueueFloodReport({{ lat: 21.03, lng: 105.80, level: 'medium' }}, {{ triggerSync: false }});
        const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        assert(res.acknowledged === 1, 'Expected 1 acknowledged report');
        const all = await OfflineDB.getAllFloodReports();
        assert(all[0].sync_status === 'ACKNOWLEDGED' && Number.isInteger(all[0].server_id), 'Report not acknowledged');
      }});

      // SYNC-07: Missing numeric ID in response -> not ACKNOWLEDGED
      await runCase('SYNC-07', async () => {{
        await resetAll();
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ triggerSync: false }});
        const origSend = OfflineSyncManager._sendItem;
        OfflineSyncManager._sendItem = async () => ({{ ok: true }});
        const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        OfflineSyncManager._sendItem = origSend;
        assert(res.retried === 1, 'Should retry when ID missing');
        const all = await OfflineDB.getAllSOS();
        assert(all[0].sync_status === 'PENDING_OFFLINE', 'Must remain PENDING_OFFLINE');
      }});

      // SYNC-08 & SYNC-09: Backoff & manual force retry
      await runCase('SYNC-08', async () => {{
        await resetAll();
        const saved = await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ triggerSync: false }});
        const origSend = OfflineSyncManager._sendItem;
        OfflineSyncManager._sendItem = async () => {{ const e = new Error('503'); e.status = 503; e.type = 'HTTP'; throw e; }};
        const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        OfflineSyncManager._sendItem = origSend;
        assert(res.retried === 1, 'Expected retried=1 on 503');
        const all = await OfflineDB.getAllSOS();
        assert(all[0].retry_count === 1 && !!all[0].next_retry_at, 'Expected retry_count=1 and next_retry_at');
        assert(all[0].client_event_id === saved.client_event_id, 'client_event_id must stay stable');
      }});

      await runCase('SYNC-09', async () => {{
        // Automatic sync respects next_retry_at; manual forces immediate send
        const autoRes = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        assert(autoRes.skippedBackoff === 1, 'Auto sync should skip backoff item');
        const manualRes = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true, manual: true }});
        assert(manualRes.acknowledged === 1, 'Manual sync should force send');
      }});

      // SYNC-10: 429 Retry-After classification
      await runCase('SYNC-10', async () => {{
        const c = OfflineSyncManager.classifySyncError({{ status: 429, type: 'HTTP', retryAfter: '3' }});
        assert(c.retryable === true && c.retryAfterMs === 3000, 'Expected retryAfterMs=3000');
      }});

      // SYNC-11: Permanent 400/409/422 -> FAILED immediately
      await runCase('SYNC-11', async () => {{
        await resetAll();
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ triggerSync: false }});
        const origSend = OfflineSyncManager._sendItem;
        OfflineSyncManager._sendItem = async () => {{ const e = new Error('Conflict'); e.status = 409; e.type = 'HTTP'; throw e; }};
        const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        OfflineSyncManager._sendItem = origSend;
        assert(res.failed === 1, 'Expected failed=1 on 409');
        const all = await OfflineDB.getAllSOS();
        assert(all[0].sync_status === 'FAILED', 'Expected FAILED status');
      }});

      // SYNC-12: Max retries exhausted -> FAILED
      await runCase('SYNC-12', async () => {{
        await resetAll();
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ retry_count: OfflineSyncManager.MAX_RETRIES - 1, triggerSync: false }});
        const origSend = OfflineSyncManager._sendItem;
        OfflineSyncManager._sendItem = async () => {{ const e = new Error('500'); e.status = 500; e.type = 'HTTP'; throw e; }};
        const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        OfflineSyncManager._sendItem = origSend;
        assert(res.failed === 1, 'Expected FAILED after MAX_RETRIES');
      }});

      // SYNC-13 & SYNC-14: Stuck SENDING recovery
      await runCase('SYNC-13', async () => {{
        await resetAll();
        const oldIso = new Date(Date.now() - 60000).toISOString();
        const saved = await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ sync_status: 'SENDING', last_attempt_at: oldIso, triggerSync: false }});
        const recovered = await OfflineSyncManager.recoverStuckSending();
        assert(recovered === 1, 'Expected 1 stuck item recovered');
        const got = await OfflineDB.getSOS(saved.local_id);
        assert(got.sync_status === 'PENDING_OFFLINE' && got.client_event_id === saved.client_event_id, 'Recovered item must keep client_event_id');
      }});

      await runCase('SYNC-14', async () => {{
        await resetAll();
        const freshIso = new Date(Date.now() - 1000).toISOString();
        const saved = await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ sync_status: 'SENDING', last_attempt_at: freshIso, triggerSync: false }});
        const recovered = await OfflineSyncManager.recoverStuckSending();
        assert(recovered === 0, 'Fresh SENDING should not be reset');
        const got = await OfflineDB.getSOS(saved.local_id);
        assert(got.sync_status === 'SENDING', 'Fresh SENDING must remain SENDING');
      }});

      // SYNC-15: In-tab mutex
      await runCase('SYNC-15', async () => {{
        await resetAll();
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ triggerSync: false }});
        let sendCalls = 0;
        const origSend = OfflineSyncManager._sendItem;
        OfflineSyncManager._sendItem = async () => {{
          sendCalls += 1;
          await new Promise((r) => setTimeout(r, 80));
          return {{ properties: {{ id: 777 }} }};
        }};
        const [r1, r2] = await Promise.all([
          OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }}),
          OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }})
        ]);
        OfflineSyncManager._sendItem = origSend;
        assert(sendCalls === 1 && r1 === r2, 'In-tab mutex must deduplicate concurrent syncNow');
      }});

      // SYNC-16 & SYNC-17: Cross-tab lock
      await runCase('SYNC-16', async () => {{
        await resetAll();
        localStorage.setItem('northstar_sync_tab_lock', JSON.stringify({{ owner: 'other-tab', acquiredAt: Date.now(), expiresAt: Date.now() + 15000 }}));
        const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        assert(res.skipped && res.reason === 'cross_tab_locked', 'Expected cross_tab_locked');
      }});

      await runCase('SYNC-17', async () => {{
        await resetAll();
        localStorage.setItem('northstar_sync_tab_lock', JSON.stringify({{ owner: 'dead-tab', acquiredAt: Date.now() - 30000, expiresAt: Date.now() - 5000 }}));
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ triggerSync: false }});
        const res = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        assert(res.acknowledged === 1, 'Expired lock should be stolen');
      }});

      // SYNC-18: Legacy localStorage queue migration
      await runCase('SYNC-18', async () => {{
        await resetAll();
        localStorage.setItem('northstar_offline_sync_queue', JSON.stringify([{{
          event_type: 'SOS_BEACON_DISPATCH',
          client_event_id: 'legacy-evt-123456',
          payload: {{ lat: 21.01, lng: 105.81, contact_name: 'Legacy', contact_phone: '0900000000' }}
        }}]));
        await OfflineSyncManager._migrateLegacyLocalStorageQueue();
        assert(localStorage.getItem('northstar_offline_sync_queue') === null, 'Legacy key should be removed');
        const all = await OfflineDB.getAllSOS();
        assert(all.length === 1 && all[0].client_event_id === 'legacy-evt-123456', 'Legacy item not migrated');
      }});

      // SYNC-19: Online / visibilitychange listener
      await runCase('SYNC-19', async () => {{
        await resetAll();
        OfflineSyncManager._bindGlobalListeners();
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ triggerSync: false }});
        window.dispatchEvent(new Event('online'));
        let acked = false;
        for (let i = 0; i < 20; i++) {{
          await new Promise((r) => setTimeout(r, 50));
          const all = await OfflineDB.getAllSOS();
          if (all[0] && all[0].sync_status === 'ACKNOWLEDGED') {{
            acked = true;
            break;
          }}
        }}
        assert(acked, 'online event should trigger sync');
      }});

      // SYNC-20: Citizen DOM UI updates
      await runCase('SYNC-20', async () => {{
        await resetAll();
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85 }}, {{ triggerSync: false }});
        await OfflineSyncManager.refreshSyncUI();
        const badge = document.getElementById('citizen-sync-pending-badge');
        const label = document.getElementById('citizen-network-label');
        assert(badge.textContent === '1' && !badge.classList.contains('hidden'), 'Pending badge should show 1, got ' + badge.textContent);
        assert(label.textContent.includes('Chờ đồng bộ'), 'Network label should reflect pending sync, got: ' + label.textContent);
      }});

      // SYNC-21: Idempotent replay against HTTP endpoint
      await runCase('SYNC-21', async () => {{
        await resetAll();
        const cid = OfflineSyncManager.generateClientEventId();
        await OfflineSyncManager.enqueueSOS({{ lat: 21.02, lng: 105.85, contact_name: 'Replay' }}, {{ client_event_id: cid, triggerSync: false }});
        const r1 = await OfflineSyncManager.syncNow({{ ignoreOfflineCheck: true }});
        const firstId = r1.details[0].server_id;
        // Simulate re-send with same client_event_id
        const resp2 = await OfflineSyncManager._sendItem('SOS_BEACON_DISPATCH', {{
          client_event_id: cid,
          payload: {{ lat: 21.02, lng: 105.85, contact_name: 'Replay' }}
        }});
        assert(resp2.properties.id === firstId && resp2.properties.idempotent_replay === true, 'Expected idempotent replay');
      }});

      // SYNC-22: IndexedDB persistence across manager re-init
      await runCase('SYNC-22', async () => {{
        await OfflineSyncManager.init();
        const all = await OfflineDB.getAllSOS();
        assert(all.length === 1 && all[0].sync_status === 'ACKNOWLEDGED', 'Persisted ACKNOWLEDGED item should survive re-init');
      }});

      document.getElementById('test-output').textContent = JSON.stringify(results, null, 2);
      }} catch (fatal) {{
        results.FATAL = fatal && fatal.stack ? fatal.stack : String(fatal);
        document.getElementById('test-output').textContent = JSON.stringify(results);
      }}
      await fetch('{base_url}/_done', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(results)
      }});
    }})();
  </script>
</body>
</html>
"""


class TestPhase4OfflineSyncBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.exists(EDGE_PATH):
            raise unittest.SkipTest('Microsoft Edge not found for headless IndexedDB tests')
        cls.runner_rel = '_test_phase4_runner.html'
        cls.runner_path = os.path.join(FRONTEND_DIR, cls.runner_rel)

        handler = functools.partial(_MockApiAndStaticHandler, directory=FRONTEND_DIR)
        cls.httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        cls.port = cls.httpd.server_address[1]
        cls.base_url = f'http://127.0.0.1:{cls.port}'
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

        with open(cls.runner_path, 'w', encoding='utf-8') as f:
            f.write(_build_runner_html(cls.base_url))

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, 'httpd'):
            cls.httpd.shutdown()
            cls.httpd.server_close()
        if hasattr(cls, 'runner_path') and os.path.exists(cls.runner_path):
            os.remove(cls.runner_path)

    def test_sync_01_to_22_in_edge_headless(self):
        TEST_STATE['done_event'] = threading.Event()
        TEST_STATE['done_results'] = None
        profile_dir = tempfile.mkdtemp(prefix='edge_p4_')
        proc = None
        try:
            cmd = [
                EDGE_PATH,
                '--headless=new',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                f'--user-data-dir={profile_dir}',
                f'{self.base_url}/{self.runner_rel}',
            ]
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            finished = TEST_STATE['done_event'].wait(timeout=20)
            self.assertTrue(finished, 'Edge Headless Phase 4 runner timed out')
            results = TEST_STATE['done_results'] or {}
            self.assertNotIn('FATAL', results, f"JS Fatal error: {results.get('FATAL')}")
            for idx in range(1, 23):
                key = f'SYNC-{idx:02d}'
                self.assertEqual(results.get(key), 'PASS', f'{key} failed: {results.get(key)} | all={results}')
        finally:
            if proc is not None:
                proc.terminate()
                try:
                    proc.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    proc.kill()
            shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
