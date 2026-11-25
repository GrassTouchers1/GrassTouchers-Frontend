"""
Phase 10 (CIT-11) AI Online/Offline, Offline Knowledge, & Citizen UI/UX Tests (AI-01..10, UX-01..10).
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


class _Phase10Handler(http.server.SimpleHTTPRequestHandler):
    state = {'done_event': None, 'done_results': None}

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
        if self.path == '/_p10_done':
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


def _build_p10_runner_html(base_url):
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Phase 10 Runner</title></head>
<body>
  <div id="citizen-emergency-banner" role="region" aria-label="Hành động khẩn cấp" style="max-width:320px;">
    <button type="button" aria-label="Mở biểu mẫu SOS">SOS</button>
    <a href="tel:112" aria-label="Gọi 112">112</a>
  </div>
  <div id="ai-assistant-panel" class="hidden">
    <span id="ai-provider-dot"></span><span id="ai-provider-label"></span>
    <div id="ai-assistant-thread"></div>
    <input id="ai-assistant-input" value="">
  </div>
  <script>window.GRASSTOUCHER_CONFIG = {{ API_BASE_URL: '{base_url}' }};</script>
  <script src="/js/config.js"></script>
  <script src="/js/offline_db.js"></script>
  <script src="/js/offline_knowledge.js"></script>
  <script src="/js/ai_assistant.js"></script>
  <script>
    (async function() {{
      const results = {{}};
      function assert(cond, msg) {{ if (!cond) throw new Error(msg); }}
      async function runCase(id, fn) {{
        try {{ await fn(); results[id] = 'PASS'; }}
        catch (e) {{ results[id] = 'FAIL: ' + (e && e.message ? e.message : String(e)); }}
      }}
      try {{
        let chatCalls = 0;
        let chatMode = 'ok';
        const origFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {{
          const url = typeof input === 'string' ? input : input.url;
          if (url.includes('/api/ai/chat')) {{
            chatCalls += 1;
            if (chatMode === '500') return new Response('err', {{ status: 500 }});
            if (chatMode === 'timeout') {{ const e = new Error('Timeout'); e.name = 'AbortError'; throw e; }}
            return new Response(JSON.stringify({{
              reply: 'Phản hồi trực tuyến từ NORTHSTAR AI.',
              provider_used: 'Groq LLaMA',
              is_fallback: false,
              suggested_actions: []
            }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
          }}
          if (url.includes('/api/ai/status')) {{
            return new Response(JSON.stringify({{ status: 'online', active_provider: 'groq' }}), {{ status: 200 }});
          }}
          return origFetch(input, init);
        }};

        // AI-01: Online ask
        await runCase('AI-01', async () => {{
          const res = await AIAssistant.send('Tình hình ngập?');
          assert(chatCalls >= 1 && res.reply.includes('trực tuyến'), 'AI-01 online failed');
        }});

        // AI-02 & AI-03 & AI-04 & AI-09: Offline ask -> 0 network calls, answers from knowledge with source
        await runCase('AI-02', async () => {{
          const beforeCalls = chatCalls;
          Object.defineProperty(navigator, 'onLine', {{ configurable: true, get: () => false }});
          const res = await AIAssistant.send('An toàn điện khi ngập lụt');
          delete navigator.onLine;
          assert(chatCalls === beforeCalls, 'AI-03 failed: must not call network when offline');
          assert(res.found === true && res.source && res.reviewed_at, 'AI-04/AI-09 failed: missing match/source/reviewed_at');
        }});
        results['AI-03'] = results['AI-02'];
        results['AI-04'] = results['AI-02'];
        results['AI-09'] = results['AI-02'];

        // AI-05: Out-of-scope question -> admits missing data
        await runCase('AI-05', async () => {{
          const res = await OfflineKnowledgeEngine.answer('Giá vàng hôm nay bao nhiêu?');
          assert(res.found === false && res.reply.includes('Chưa có dữ liệu') && res.reply.includes('112'), 'AI-05 must admit missing data');
        }});

        // AI-10: Real-time weather/route question offline -> refuses to fabricate
        await runCase('AI-10', async () => {{
          const res = await OfflineKnowledgeEngine.answer('Thời tiết hiện tại ngoài trời thế nào?');
          assert(res.found === false && res.reply.includes('không thể xác minh dữ liệu thời gian thực'), 'AI-10 must refuse real-time fabrication');
        }});

        // AI-06 & AI-07: Timeout & 500 -> clean fallback to OfflineKnowledgeEngine
        await runCase('AI-06', async () => {{
          chatMode = 'timeout';
          const res = await AIAssistant.send('Hướng dẫn sơ tán');
          assert(res.fallback_from_error === true && res.reply.includes('sơ tán'), 'AI-06 timeout fallback failed');
        }});
        await runCase('AI-07', async () => {{
          chatMode = '500';
          const res = await AIAssistant.send('Sạt lở đất');
          assert(res.fallback_from_error === true && res.reply.includes('sạt lở'), 'AI-07 500 fallback failed');
          chatMode = 'ok';
        }});

        // AI-08: Malformed knowledge entries handled gracefully
        await runCase('AI-08', async () => {{
          OfflineKnowledgeEngine.resetCacheForTest();
          const res = await OfflineKnowledgeEngine.answer('bão', {{ customEntries: [null, {{ bad: true }}] }});
          assert(res.found === false && typeof res.reply === 'string', 'AI-08 malformed knowledge must not crash');
          OfflineKnowledgeEngine.resetCacheForTest();
        }});

        // UX-01 & UX-10: 320px mobile banner no horizontal overflow
        await runCase('UX-01', async () => {{
          const banner = document.getElementById('citizen-emergency-banner');
          assert(banner.scrollWidth <= 325, 'Banner overflows 320px: ' + banner.scrollWidth);
        }});
        results['UX-10'] = results['UX-01'];
      }} catch (fatal) {{
        results.FATAL = fatal && fatal.stack ? fatal.stack : String(fatal);
      }}
      await fetch('{base_url}/_p10_done', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(results) }});
    }})();
  </script>
</body>
</html>"""


class TestPhase10AIAndUX(unittest.TestCase):
    def test_knowledge_base_15_topics_and_ux_accessibility_contract(self):
        kb_path = os.path.join(FRONTEND_DIR, 'data', 'offline_knowledge_vi.json')
        self.assertTrue(os.path.isfile(kb_path))
        with open(kb_path, 'r', encoding='utf-8') as f:
            kb = json.load(f)
        entries = kb.get('entries', [])
        self.assertGreaterEqual(len(entries), 15)
        topics = {e['topic'] for e in entries}
        for req in [
            'storm', 'heavy_rain', 'flood', 'flash_flood', 'landslide',
            'evacuation', 'electrical_safety', 'water_food', 'first_aid',
            'child_safety', 'elderly_support', 'battery_saving',
            'no_signal_comms', 'sos_guide', 'citizen_usage'
        ]:
            self.assertIn(req, topics, f'Missing knowledge topic: {req}')
        for e in entries:
            self.assertTrue(e.get('source') and e.get('reviewed_at') and e.get('approval_status'))

        # UX-02..UX-09 static accessibility checks on citizen.html
        with open(os.path.join(FRONTEND_DIR, 'citizen.html'), 'r', encoding='utf-8') as f:
            html = f.read()
        self.assertNotIn('user-scalable=no', html)
        self.assertIn('id="citizen-emergency-banner"', html)
        self.assertIn('href="tel:112"', html)
        self.assertIn('aria-label=', html)
        self.assertIn('js/offline_knowledge.js', html)

    def test_ai_01_to_10_and_ux_in_edge_headless(self):
        if not os.path.exists(EDGE_PATH):
            self.skipTest('Microsoft Edge not found')
        r_path = os.path.join(FRONTEND_DIR, '_test_p10.html')
        handler = functools.partial(_Phase10Handler, directory=FRONTEND_DIR)
        httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        port = httpd.server_address[1]
        base_url = f'http://127.0.0.1:{port}'
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        profile_dir = tempfile.mkdtemp(prefix='edge_p10_')
        try:
            with open(r_path, 'w', encoding='utf-8') as f:
                f.write(_build_p10_runner_html(base_url))
            _Phase10Handler.state['done_event'] = threading.Event()
            _Phase10Handler.state['done_results'] = None
            p = subprocess.Popen(
                [EDGE_PATH, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={profile_dir}', f'{base_url}/_test_p10.html'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            self.assertTrue(_Phase10Handler.state['done_event'].wait(timeout=20), 'Phase 10 runner timed out')
            p.terminate()
            p.wait(timeout=4)
            res = _Phase10Handler.state['done_results'] or {}
            self.assertNotIn('FATAL', res, res.get('FATAL'))
            for k in ['AI-01', 'AI-02', 'AI-03', 'AI-04', 'AI-05', 'AI-06', 'AI-07', 'AI-08', 'AI-09', 'AI-10', 'UX-01', 'UX-10']:
                self.assertEqual(res.get(k), 'PASS', f'{k} failed: {res.get(k)}')
        finally:
            httpd.shutdown()
            httpd.server_close()
            if os.path.exists(r_path):
                os.remove(r_path)
            shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
