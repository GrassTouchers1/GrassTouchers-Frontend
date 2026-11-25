"""
Phase 11 (CIT-12) SOS Relay, P2P & Satellite Gateway Adapter Tests (RELAY-01..15).
Runs in Microsoft Edge Headless using real WebCrypto (ECDSA-P256 + SHA-256) and IndexedDB.
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


class _Phase11Handler(http.server.SimpleHTTPRequestHandler):
    state = {'done_event': None, 'done_results': None, 'seen': {}, 'next_id': 600}

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

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(length).decode('utf-8') if length else '{}'
        data = json.loads(raw or '{}')
        if self.path == '/_p11_done':
            self.state['done_results'] = data
            if self.state['done_event']:
                self.state['done_event'].set()
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return
        if self.path == '/api/sos/relay':
            cid = data.get('client_event_id')
            replay = cid in self.state['seen']
            if not replay:
                self.state['next_id'] += 1
                self.state['seen'][cid] = self.state['next_id']
            self.send_response(201)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'type': 'Feature',
                'properties': {
                    'id': self.state['seen'][cid],
                    'client_event_id': cid,
                    'idempotent_replay': replay
                }
            }).encode('utf-8'))
            return
        self.send_response(404)
        self._cors()
        self.end_headers()


def _build_p11_runner_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Phase 11 Runner</title></head>
<body>
  <script>window.GRASSTOUCHER_CONFIG = {{ API_BASE_URL: '{base_url}' }};</script>
  <script src="/js/config.js"></script>
  <script src="/js/offline_db.js"></script>
  <script src="/js/sos_relay.js"></script>
  <script src="/js/satellite_gateway_adapter.js"></script>
  <script>
    (async function() {{
      const results = {{}};
      function assert(cond, msg) {{ if (!cond) throw new Error(msg); }}
      async function runCase(id, fn) {{
        try {{ await fn(); results[id] = 'PASS'; }}
        catch (e) {{ results[id] = 'FAIL: ' + (e && e.message ? e.message : String(e)); }}
      }}
      try {{
        let samplePacket = null;
        // RELAY-01, RELAY-02, RELAY-15: Create packet, verify schema & PII minimization
        await runCase('RELAY-01', async () => {{
          samplePacket = await SOSRelayManager.createRelayPacket({{
            client_event_id: 'evt-relay-0001',
            payload: {{
              lat: 21.0285, lng: 105.8542, location_source: 'gps',
              people_count: 2, priority: 'high', phone: '0912345678', contact_name: 'Secret Name'
            }}
          }});
          assert(!!samplePacket.message_id && samplePacket.client_event_id === 'evt-relay-0001', 'Missing IDs');
          assert(samplePacket.integrity_metadata.algorithm === 'SHA-256', 'Missing SHA-256');
          assert(samplePacket.authentication_metadata.scheme === 'ECDSA-P256', 'Missing ECDSA-P256 signature');
        }});
        results['RELAY-02'] = results['RELAY-01'];

        await runCase('RELAY-15', async () => {{
          const raw = JSON.stringify(samplePacket);
          assert(!raw.includes('0912345678') && !raw.includes('Secret Name'), 'Unmasked PII leaked in relay packet');
          assert(samplePacket.payload.contact_phone_masked === '***5678', 'Expected masked phone');
        }});

        // RELAY-03 & RELAY-04 & RELAY-05: Encode/decode share string & relay hop increment
        await runCase('RELAY-03', async () => {{
          const encoded = SOSRelayManager.encodeForShare(samplePacket);
          assert(encoded.startsWith('NORTHSTAR-RELAY-V1:'), 'Invalid share prefix');
          const decoded = SOSRelayManager.decodeFromShare(encoded);
          const accepted = await SOSRelayManager.verifyAndAcceptRelayPacket(decoded, 'relay-B');
          assert(accepted.ok && accepted.packet.hop_count === 1 && accepted.packet.relay_history.length === 1, 'Relay hop failed');
        }});
        results['RELAY-04'] = results['RELAY-03'];
        results['RELAY-05'] = results['RELAY-03'];

        // RELAY-06 & RELAY-07: Forward to Backend + idempotent deduplication
        await runCase('RELAY-06', async () => {{
          const r1 = await SOSRelayManager.forwardRelayPacketToBackend(samplePacket);
          const r2 = await SOSRelayManager.forwardRelayPacketToBackend(samplePacket);
          assert(r1.properties.id === r2.properties.id && r2.properties.idempotent_replay === true, 'Relay deduplication failed');
        }});
        results['RELAY-07'] = results['RELAY-06'];

        // RELAY-08: Expired packet rejected
        await runCase('RELAY-08', async () => {{
          const expired = await SOSRelayManager.createRelayPacket({{ client_event_id: 'evt-exp-1', payload: {{ lat: 21.0, lng: 105.8 }} }}, {{ ttlMs: -5000 }});
          const res = await SOSRelayManager.verifyAndAcceptRelayPacket(expired);
          assert(!res.ok && res.reason === 'EXPIRED', 'Expired packet must be rejected');
        }});

        // RELAY-09: Hop count exceeded rejected
        await runCase('RELAY-09', async () => {{
          const overHop = {{ ...samplePacket, hop_count: 3, max_hops: 3 }};
          const res = await SOSRelayManager.verifyAndAcceptRelayPacket(overHop);
          assert(!res.ok && res.reason === 'MAX_HOPS_EXCEEDED', 'Over-hop packet must be rejected');
        }});

        // RELAY-10: Tampered location/payload rejected
        await runCase('RELAY-10', async () => {{
          const tampered = JSON.parse(JSON.stringify(samplePacket));
          tampered.location.lat = 99.999;
          const res = await SOSRelayManager.verifyAndAcceptRelayPacket(tampered);
          assert(!res.ok && res.reason === 'INTEGRITY_TAMPERED', 'Tampered packet must be rejected');
        }});

        // RELAY-11 & RELAY-12: Web Bluetooth unsupported / permission denied simulation
        await runCase('RELAY-11', async () => {{
          const res = await SOSRelayManager.probeWebBluetooth();
          if (!res.supported) {{
            assert(res.reason === 'BLUETOOTH_UNSUPPORTED', 'Expected BLUETOOTH_UNSUPPORTED');
          }} else {{
            assert(true);
          }}
        }});
        await runCase('RELAY-12', async () => {{
          const origBt = navigator.bluetooth;
          Object.defineProperty(navigator, 'bluetooth', {{
            configurable: true,
            value: {{ requestDevice: async () => {{ const e = new Error('Denied'); e.name = 'NotAllowedError'; throw e; }} }}
          }});
          const res = await SOSRelayManager.probeWebBluetooth();
          delete navigator.bluetooth;
          if (origBt) Object.defineProperty(navigator, 'bluetooth', {{ configurable: true, value: origBt }});
          assert(res.reason === 'PERMISSION_DENIED', 'Expected PERMISSION_DENIED');
        }});

        // RELAY-13 & RELAY-14: SatelliteGatewayAdapter NOT_CONFIGURED and never fakes CONNECTED/ACK
        await runCase('RELAY-13', async () => {{
          SatelliteGatewayAdapter.resetForTest();
          assert(SatelliteGatewayAdapter.getStatus().state === 'NOT_CONFIGURED', 'Initial state must be NOT_CONFIGURED');
          const connRes = await SatelliteGatewayAdapter.connect();
          assert(!connRes.ok && connRes.state === 'NOT_CONFIGURED', 'Must not fake CONNECTED');
        }});
        await runCase('RELAY-14', async () => {{
          const sendRes = await SatelliteGatewayAdapter.sendSOS(samplePacket);
          assert(!sendRes.ok && sendRes.state !== 'ACKNOWLEDGED', 'Must not fake satellite ACKNOWLEDGED');
        }});
      }} catch (fatal) {{
        results.FATAL = fatal && fatal.stack ? fatal.stack : String(fatal);
      }}
      await fetch('{base_url}/_p11_done', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(results) }});
    }})();
  </script>
</body>
</html>"""


class TestPhase11RelaySatellite(unittest.TestCase):
    def test_relay_01_to_15_in_edge_headless(self):
        if not os.path.exists(EDGE_PATH):
            self.skipTest('Microsoft Edge not found')
        r_path = os.path.join(FRONTEND_DIR, '_test_p11.html')
        handler = functools.partial(_Phase11Handler, directory=FRONTEND_DIR)
        httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        port = httpd.server_address[1]
        base_url = f'http://127.0.0.1:{port}'
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        profile_dir = tempfile.mkdtemp(prefix='edge_p11_')
        try:
            with open(r_path, 'w', encoding='utf-8') as f:
                f.write(_build_p11_runner_html(base_url))
            _Phase11Handler.state['done_event'] = threading.Event()
            _Phase11Handler.state['done_results'] = None
            p = subprocess.Popen(
                [EDGE_PATH, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={profile_dir}', f'{base_url}/_test_p11.html'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            self.assertTrue(_Phase11Handler.state['done_event'].wait(timeout=20), 'Phase 11 runner timed out')
            p.terminate()
            p.wait(timeout=4)
            res = _Phase11Handler.state['done_results'] or {}
            self.assertNotIn('FATAL', res, res.get('FATAL'))
            for i in range(1, 16):
                key = f'RELAY-{i:02d}'
                self.assertEqual(res.get(key), 'PASS', f'{key} failed: {res.get(key)}')
        finally:
            httpd.shutdown()
            httpd.server_close()
            if os.path.exists(r_path):
                os.remove(r_path)
            shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
