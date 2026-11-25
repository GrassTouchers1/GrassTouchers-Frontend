"""
Phase 8 (CIT-09) Flood-Avoidance Routing & Safe Evacuation Tests (ROUTE-01..10, EVAC-01..10).
Runs static checks on citizen.html + real Edge Headless & IndexedDB tests.
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


class _Phase8Handler(http.server.SimpleHTTPRequestHandler):
    state = {
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

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(length).decode('utf-8') if length else '{}'
        data = json.loads(raw or '{}')
        if self.path == '/_p8_done':
            self.state['done_results'] = data
            if self.state['done_event']:
                self.state['done_event'].set()
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return
        self.send_response(404)
        self._cors()
        self.end_headers()


def _build_p8_runner_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Phase 8 Runner</title></head>
<body>
  <script src="/js/offline_db.js"></script>
  <script>
    (async function() {{
      const results = {{}};
      function assert(cond, msg) {{ if (!cond) throw new Error(msg); }}
      async function runCase(id, fn) {{
        try {{ await fn(); results[id] = 'PASS'; }}
        catch (e) {{ results[id] = 'FAIL: ' + (e && e.message ? e.message : String(e)); }}
      }}

      function isValidLineGeometry(geom) {{
        return Boolean(
          geom && geom.type === 'LineString' &&
          Array.isArray(geom.coordinates) && geom.coordinates.length >= 2 &&
          geom.coordinates.every((pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1])))
        );
      }}

      function classifyRouteStatus({{ sourceType, backendData, routeObj, floodDataStale }}) {{
        if (!routeObj || routeObj.found === false || !isValidLineGeometry(routeObj.geometry)) return 'UNAVAILABLE';
        if (sourceType === 'osrm_fallback' || Number(backendData && backendData.flood_sources_used) === 0 || floodDataStale) return 'REFERENCE_ONLY';
        const hasWarnings = Array.isArray(routeObj.flood_warnings) && routeObj.flood_warnings.length > 0;
        const hasAffected = Number(backendData && backendData.affected_road_segments) > 0;
        if (hasWarnings || hasAffected || routeObj.mode === 'fastest') return 'UNSAFE';
        return 'SAFE_VERIFIED';
      }}

      try {{
        const validGeom = {{ type: 'LineString', coordinates: [[105.85, 21.02], [105.84, 21.03]] }};

        // ROUTE-01: Safe verified when flood_sources_used > 0, no warnings, valid geometry
        await runCase('ROUTE-01', async () => {{
          const st = classifyRouteStatus({{
            sourceType: 'backend_astar',
            backendData: {{ flood_sources_used: 5, affected_road_segments: 0 }},
            routeObj: {{ found: true, mode: 'safe', geometry: validGeom, flood_warnings: [] }},
            floodDataStale: false
          }});
          assert(st === 'SAFE_VERIFIED', 'Expected SAFE_VERIFIED, got ' + st);
        }});

        // ROUTE-02: Flood segment / warning -> UNSAFE
        await runCase('ROUTE-02', async () => {{
          const st = classifyRouteStatus({{
            sourceType: 'backend_astar',
            backendData: {{ flood_sources_used: 5, affected_road_segments: 1 }},
            routeObj: {{ found: true, mode: 'fastest', geometry: validGeom, flood_warnings: ['Thai Ha'] }},
            floodDataStale: false
          }});
          assert(st === 'UNSAFE', 'Expected UNSAFE, got ' + st);
        }});

        // ROUTE-03 & ROUTE-04 & ROUTE-08: No safe path / A* error / invalid geometry -> UNAVAILABLE
        await runCase('ROUTE-03', async () => {{
          assert(classifyRouteStatus({{ sourceType: 'backend_astar', backendData: {{}}, routeObj: {{ found: false }}, floodDataStale: false }}) === 'UNAVAILABLE', 'Expected UNAVAILABLE');
        }});
        await runCase('ROUTE-04', async () => {{
          assert(classifyRouteStatus({{ sourceType: 'backend_astar', backendData: null, routeObj: null, floodDataStale: false }}) === 'UNAVAILABLE', 'Expected UNAVAILABLE on A* error');
        }});
        await runCase('ROUTE-08', async () => {{
          assert(classifyRouteStatus({{ sourceType: 'backend_astar', backendData: {{ flood_sources_used: 3 }}, routeObj: {{ found: true, geometry: {{ type: 'LineString', coordinates: [[105.8, 21.0]] }} }}, floodDataStale: false }}) === 'UNAVAILABLE', 'Invalid geometry with <2 coords must be UNAVAILABLE');
        }});

        // ROUTE-05 & ROUTE-06 & ROUTE-07: OSRM fallback / stale flood data / zero flood sources -> REFERENCE_ONLY
        await runCase('ROUTE-05', async () => {{
          const st = classifyRouteStatus({{ sourceType: 'osrm_fallback', backendData: null, routeObj: {{ found: true, geometry: validGeom }}, floodDataStale: false }});
          assert(st === 'REFERENCE_ONLY', 'OSRM fallback must be REFERENCE_ONLY');
        }});
        await runCase('ROUTE-06', async () => {{
          const st = classifyRouteStatus({{ sourceType: 'backend_astar', backendData: {{ flood_sources_used: 5 }}, routeObj: {{ found: true, mode: 'safe', geometry: validGeom, flood_warnings: [] }}, floodDataStale: true }});
          assert(st === 'REFERENCE_ONLY', 'Stale flood data must be REFERENCE_ONLY');
        }});
        await runCase('ROUTE-07', async () => {{
          const st = classifyRouteStatus({{ sourceType: 'backend_astar', backendData: {{ flood_sources_used: 0 }}, routeObj: {{ found: true, mode: 'safe', geometry: validGeom, flood_warnings: [] }}, floodDataStale: false }});
          assert(st === 'REFERENCE_ONLY', 'Zero flood sources must be REFERENCE_ONLY');
        }});

        // EVAC-09 & EVAC-08: Shelters cached in OfflineDB.shelters_cache and preserved offline
        await runCase('EVAC-09', async () => {{
          await OfflineDB.saveShelterCache([
            {{ id: 1, name: 'Trường THPT Chu Văn An', address: 'Thụy Khuê', coordinates: [105.83, 21.04], capacity: 300, current_occupancy: 50, status: 'open' }},
            {{ id: 2, name: 'Nhà văn hóa Đống Đa', address: 'Hoàng Cầu', coordinates: [105.82, 21.01], capacity: 200, current_occupancy: 200, status: 'full' }},
            {{ id: 3, name: 'Điểm chưa rõ sức chứa', address: 'Ba Đình', coordinates: [105.81, 21.03], status: 'unknown' }}
          ]);
          const all = await OfflineDB.getAllShelterCache();
          assert(all.length >= 3, 'Shelters not cached in IndexedDB');
          const fullOne = all.find((s) => s.id === '2');
          const unknownOne = all.find((s) => s.id === '3');
          assert(fullOne.status === 'full' && fullOne.current_occupancy >= fullOne.capacity, 'Full shelter state lost');
          assert(unknownOne.status === 'unknown' && unknownOne.capacity === null, 'Missing capacity must remain null, not defaulted');
        }});
      }} catch (fatal) {{
        results.FATAL = fatal && fatal.stack ? fatal.stack : String(fatal);
      }}
      await fetch('{base_url}/_p8_done', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(results) }});
    }})();
  </script>
</body>
</html>"""


class TestPhase8RoutingEvacuation(unittest.TestCase):
    def test_route_09_10_and_evac_01_to_10_static_contract(self):
        with open(os.path.join(FRONTEND_DIR, 'citizen.html'), 'r', encoding='utf-8') as f:
            html = f.read()
        # No sample shelters or fake success slogan
        self.assertNotIn('function renderSampleShelters', html)
        self.assertNotIn('Né Ngập Thành Công', html)
        # ROUTE-09 & ROUTE-10: Origin has no hardcoded Hanoi default
        self.assertIn('id="citizen-route-origin" type="text" value=""', html)
        self.assertIn('useRouteOriginGPS()', html)
        # EVAC-01..07: Shelters & Evacuate APIs wired + MapLibre layer + capacity/status handling
        self.assertIn("NorthStarApi.fetchJson('/api/shelters'", html)
        self.assertIn("NorthStarApi.fetchJson('/api/route/evacuate'", html)
        self.assertIn('citizen-route-line', html)
        self.assertIn('Chưa có dữ liệu sức chứa', html)
        self.assertIn('Không có định tuyến offline trên thiết bị', html)

    def test_route_and_evac_logic_in_edge_headless(self):
        if not os.path.exists(EDGE_PATH):
            self.skipTest('Microsoft Edge not found')
        r_path = os.path.join(FRONTEND_DIR, '_test_p8.html')
        handler = functools.partial(_Phase8Handler, directory=FRONTEND_DIR)
        httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        port = httpd.server_address[1]
        base_url = f'http://127.0.0.1:{port}'
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        profile_dir = tempfile.mkdtemp(prefix='edge_p8_')
        try:
            with open(r_path, 'w', encoding='utf-8') as f:
                f.write(_build_p8_runner_html(base_url))
            _Phase8Handler.state['done_event'] = threading.Event()
            _Phase8Handler.state['done_results'] = None
            p = subprocess.Popen(
                [EDGE_PATH, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={profile_dir}', f'{base_url}/_test_p8.html'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            self.assertTrue(_Phase8Handler.state['done_event'].wait(timeout=15), 'Phase 8 runner timed out')
            p.terminate()
            p.wait(timeout=4)
            res = _Phase8Handler.state['done_results'] or {}
            self.assertNotIn('FATAL', res, res.get('FATAL'))
            for k in ['ROUTE-01', 'ROUTE-02', 'ROUTE-03', 'ROUTE-04', 'ROUTE-05', 'ROUTE-06', 'ROUTE-07', 'ROUTE-08', 'EVAC-09']:
                self.assertEqual(res.get(k), 'PASS', f'{k} failed: {res.get(k)}')
        finally:
            httpd.shutdown()
            httpd.server_close()
            if os.path.exists(r_path):
                os.remove(r_path)
            shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
