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
Kiểm thử Giai đoạn 3 (CIT-04): IndexedDB thật (northstar_citizen_db) trên Microsoft Edge Headless.
Bao gồm toàn bộ 20 kịch bản DB-01 đến DB-20 (kể cả kiểm thử tải lại trang giữ nguyên dữ liệu).
"""

import http.server
import json
import os
import shutil
import subprocess
import tempfile
import threading
import unittest

FRONTEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestOfflineIndexedDB(unittest.TestCase):
    """Kiểm thử IndexedDB thật trên Edge Headless."""

    def _run_edge_page(self, page_path, user_data_dir, port):
        edge_path = shutil.which("msedge") or os.path.join(
            os.environ.get("ProgramFiles(x86)", ""), "Microsoft", "Edge", "Application", "msedge.exe"
        )
        if not edge_path or not os.path.isfile(edge_path):
            self.skipTest("Không tìm thấy Microsoft Edge trên hệ thống")

        proc = subprocess.Popen(
            [
                edge_path,
                "--headless",
                "--disable-gpu",
                f"--user-data-dir={user_data_dir}",
                f"http://127.0.0.1:{port}{page_path}",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return proc

    def test_db_01_to_20_real_indexeddb_and_reload_persistence(self):
        """Thực thi DB-01..DB-20 (gồm DB-15 tải lại trang) trên IndexedDB thật của Edge Headless."""
        with open(os.path.join(FRONTEND_DIR, "js", "offline_db.js"), "r", encoding="utf-8") as f:
            offline_db_js = f.read()

        done1 = threading.Event()
        done2 = threading.Event()
        results = {}

        class _Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass

            def do_POST(self):
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                if self.path == "/report1":
                    results["phase1"] = body
                    self.send_response(204)
                    self.end_headers()
                    done1.set()
                elif self.path == "/report2":
                    results["phase2"] = body
                    self.send_response(204)
                    self.end_headers()
                    done2.set()

            def do_GET(self):
                if self.path == "/js/offline_db.js":
                    self.send_response(200)
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(offline_db_js.encode("utf-8"))
                elif self.path == "/phase1.html":
                    html = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><script src="/js/offline_db.js"></script></head>
<body><script>
(async () => {
  const out = {};
  try {
    await OfflineDB.deleteDatabase().catch(() => {});

    // DB-01 & DB-02: Mở database & kiểm tra đủ 7 Object Stores
    const db = await OfflineDB.openDatabase();
    out.db01_opened = !!db && db.name === 'northstar_citizen_db';
    out.db01_version = await OfflineDB.getDatabaseVersion();
    out.db02_stores = Array.from(db.objectStoreNames).sort();

    // DB-03: Lưu và đọc SOS
    await OfflineDB.saveSOS({
      local_id: 'SOS-LOCAL-100',
      client_event_id: 'EVT-100',
      payload: { contact_name: 'Tester', phone: '0900000100', lat: 21.03, lng: 105.78 },
      sync_status: 'PENDING_OFFLINE'
    });
    const sos1 = await OfflineDB.getSOS('SOS-LOCAL-100');
    out.db03_ok = !!sos1 && sos1.local_id === 'SOS-LOCAL-100' && sos1.client_event_id === 'EVT-100';

    // DB-04: Lưu SOS có tọa độ null và mô tả địa điểm
    await OfflineDB.saveSOS({
      local_id: 'SOS-NULL-200',
      payload: { contact_name: 'NoGPS', phone: '0900000200', lat: null, lng: null, location_description: 'Gan cau Giay' },
      sync_status: 'PENDING_OFFLINE'
    });
    const sosNull = await OfflineDB.getSOS('SOS-NULL-200');
    out.db04_ok = !!sosNull && sosNull.payload.lat === null && sosNull.payload.location_description === 'Gan cau Giay';

    // DB-05: Cập nhật SOS
    await OfflineDB.updateSOS('SOS-LOCAL-100', { retry_count: 2, last_error: 'Timeout' });
    const sosUpdated = await OfflineDB.getSOS('SOS-LOCAL-100');
    out.db05_ok = sosUpdated.retry_count === 2 && sosUpdated.last_error === 'Timeout';
    out.db03_pendingCount = await OfflineDB.countPendingSOS();

    // DB-06: Lưu và đọc báo cáo ngập
    await OfflineDB.saveFloodReport({
      local_id: 'REP-100',
      location: { lat: 21.02, lng: 105.81 },
      description: 'Ngap 30cm',
      sync_status: 'PENDING_OFFLINE'
    });
    const rep = await OfflineDB.getFloodReport('REP-100');
    out.db06_ok = !!rep && rep.description === 'Ngap 30cm';

    // DB-07 & DB-19: Thời tiết + dữ liệu mẫu bị từ chối + xóa hết hạn
    try {
      await OfflineDB.saveWeatherCache({ cache_key: 'bad', data: { temp: 99 }, is_sample: true });
      out.db07_sampleRejected = false;
    } catch (e) {
      out.db07_sampleRejected = e.type === 'VALIDATION';
    }
    await OfflineDB.saveWeatherCache({
      cache_key: 'hanoi_valid',
      data: { temp: 24 },
      data_updated_at: '2026-11-25T03:00:00Z',
      ttl_ms: 3600000
    });
    await OfflineDB.saveWeatherCache({
      cache_key: 'hanoi_expired',
      data: { temp: 22 },
      expires_at: Date.now() - 5000
    });
    const clearedCount = await OfflineDB.clearExpiredWeatherCache(Date.now());
    const validW = await OfflineDB.getWeatherCache('hanoi_valid');
    const expW = await OfflineDB.getWeatherCache('hanoi_expired');
    out.db07_ok = !!validW && validW.data.temp === 24;
    out.db19_ok = clearedCount === 1 && !expW && !!validW;

    // DB-08: Cảnh báo thiên tai (giữ nguyên issued_at gốc)
    await OfflineDB.saveDisasterCache({
      id: 'DIS-1',
      title: 'Canh bao lu',
      issued_at: '2026-11-24T12:00:00Z',
      source: 'NCHMF'
    });
    const dis = await OfflineDB.getDisasterCache('DIS-1');
    out.db08_ok = !!dis && dis.issued_at === '2026-11-24T12:00:00Z';

    // DB-09: Điểm trú ẩn (giữ nguyên status thực tế)
    await OfflineDB.saveShelterCache([
      { id: 'SH-1', name: 'Truong A', status: 'full', capacity: 100 },
      { id: 'SH-2', name: 'Truong B', status: 'closed', capacity: 50 }
    ]);
    const sh1 = await OfflineDB.getShelterCache('SH-1');
    const allSh = await OfflineDB.getAllShelterCache();
    out.db09_ok = !!sh1 && sh1.status === 'full' && allSh.length === 2;

    // DB-10: Kho kiến thức AI (chỉ lưu bản đã kiểm duyệt + tìm kiếm tiếng Việt)
    await OfflineDB.saveKnowledge([
      { id: 'K-1', topic: 'dien', title: 'An toàn điện khi ngập', content: 'Ngắt cầu dao tổng ngay lập tức', keywords: ['dien giat', 'cau dao'], moderation_status: 'approved' },
      { id: 'K-2', topic: 'bad', title: 'Chưa duyệt', content: 'Nội dung chưa kiểm tra', verified: false }
    ]);
    const kRes = await OfflineDB.searchKnowledge('cầu dao điện');
    const kAll = await OfflineDB.getAllKnowledge();
    out.db10_ok = kRes.length === 1 && kRes[0].id === 'K-1' && kAll.length === 1;

    // DB-11: Metadata
    await OfflineDB.saveMetadata('custom_meta', { step: 3 });
    const metaVal = await OfflineDB.getMetadata('custom_meta');
    out.db11_ok = !!metaVal && metaVal.step === 3;

    // DB-12 & DB-14: Migration localStorage thành công & chạy lại không tạo trùng
    localStorage.setItem('northstar_sos_drafts', JSON.stringify([
      { id: 'SOS-DRAFT-501', queued_at: '2026-11-25T01:00:00Z', payload: { contact_name: 'Mig1', phone: '0900000501', lat: 21.01, lng: 105.81 } }
    ]));
    localStorage.setItem('offline_flood_reports', JSON.stringify([
      { local_id: 'REP-OLD-601', lat: 21.02, lng: 105.82, level: 'medium', location_name: 'Cau Giay' }
    ]));
    const mig1 = await OfflineDB.migrateFromLocalStorage({ force: true });
    const mig2 = await OfflineDB.migrateFromLocalStorage();
    const mig3 = await OfflineDB.migrateFromLocalStorage({ force: true });
    out.db12_ok = mig1.status === 'COMPLETED' && mig1.migrated_count === 2 && !!(await OfflineDB.getSOS('SOS-DRAFT-501')) && !!(await OfflineDB.getFloodReport('REP-OLD-601'));
    out.db14_ok = mig2.skipped_already_completed === true && mig3.migrated_count === 0;

    // DB-13: Migration có lỗi JSON không làm mất dữ liệu localStorage cũ
    localStorage.setItem('northstar_offline_outbox', '{bad_json');
    const migErr = await OfflineDB.migrateFromLocalStorage({ force: true });
    out.db13_ok = migErr.error_count >= 1 && localStorage.getItem('northstar_sos_drafts') !== null && localStorage.getItem('northstar_offline_outbox') === '{bad_json';

    // DB-16: Lỗi quota (Blob > 5MB) & storage estimate
    const bigBlob = new Blob([new Uint8Array(5 * 1024 * 1024 + 10)]);
    try {
      await OfflineDB.saveFloodReport({ local_id: 'REP-BIG', photo_blob: bigBlob });
      out.db16_quotaRejected = false;
    } catch (e) {
      out.db16_quotaRejected = e.type === 'QUOTA_EXCEEDED';
    }
    const est = await OfflineDB.getStorageEstimate();
    out.db16_estOk = typeof est.usage === 'number';

    // DB-17: Đóng và mở lại database
    OfflineDB.closeDatabase();
    const reopened = await OfflineDB.openDatabase();
    out.db17_ok = !!reopened && !!(await OfflineDB.getSOS('SOS-LOCAL-100'));

    // DB-18: Xử lý onversionchange
    let vcEventFired = false;
    window.addEventListener('northstar:db_versionchange', () => { vcEventFired = true; });
    reopened.onversionchange();
    out.db18_ok = vcEventFired;
    await OfflineDB.openDatabase();

    // DB-20: Dọn cache không thiết yếu tuyệt đối không xóa SOS đang chờ
    await OfflineDB.cleanupExpiredNonEssentialCache(Date.now() + 999999999);
    out.db20_ok = !!(await OfflineDB.getSOS('SOS-LOCAL-100')) && !!(await OfflineDB.getSOS('SOS-NULL-200')) && !!(await OfflineDB.getFloodReport('REP-100'));
  } catch (err) {
    out.fatal = String(err && err.stack ? err.stack : err);
  }
  await fetch('/report1', { method: 'POST', body: JSON.stringify(out) });
})();
</script></body></html>"""
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(html.encode("utf-8"))
                elif self.path == "/phase2_reload.html":
                    # DB-15: Tải lại trang (phiên trình duyệt mới) vẫn đọc được dữ liệu đã lưu ở phase1
                    html = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><script src="/js/offline_db.js"></script></head>
<body><script>
(async () => {
  const out = {};
  try {
    const sos = await OfflineDB.getSOS('SOS-LOCAL-100');
    const sosNull = await OfflineDB.getSOS('SOS-NULL-200');
    const rep = await OfflineDB.getFloodReport('REP-100');
    out.db15_sosPersisted = !!sos && sos.client_event_id === 'EVT-100';
    out.db15_nullSosPersisted = !!sosNull && sosNull.payload.lat === null;
    out.db15_reportPersisted = !!rep && rep.description === 'Ngap 30cm';
  } catch (err) {
    out.fatal = String(err);
  }
  await fetch('/report2', { method: 'POST', body: JSON.stringify(out) });
})();
</script></body></html>"""
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(html.encode("utf-8"))

        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()

        user_data_dir = tempfile.mkdtemp(prefix="northstar_idb_test_")
        proc1 = None
        proc2 = None
        try:
            proc1 = self._run_edge_page("/phase1.html", user_data_dir, port)
            self.assertTrue(done1.wait(timeout=15), "Edge Headless phase1 timeout")
            proc1.terminate()
            proc1.wait(timeout=4)

            p1 = results["phase1"]
            self.assertNotIn("fatal", p1)
            self.assertTrue(p1["db01_opened"])
            self.assertEqual(p1["db01_version"], 1)
            self.assertEqual(
                p1["db02_stores"],
                sorted([
                    "sos_queue",
                    "flood_reports",
                    "weather_cache",
                    "disaster_cache",
                    "shelters_cache",
                    "knowledge_cache",
                    "sync_metadata",
                ]),
            )
            self.assertTrue(p1["db03_ok"])
            self.assertEqual(p1["db03_pendingCount"], 2)
            self.assertTrue(p1["db04_ok"])
            self.assertTrue(p1["db05_ok"])
            self.assertTrue(p1["db06_ok"])
            self.assertTrue(p1["db07_sampleRejected"])
            self.assertTrue(p1["db07_ok"])
            self.assertTrue(p1["db08_ok"])
            self.assertTrue(p1["db09_ok"])
            self.assertTrue(p1["db10_ok"])
            self.assertTrue(p1["db11_ok"])
            self.assertTrue(p1["db12_ok"])
            self.assertTrue(p1["db13_ok"])
            self.assertTrue(p1["db14_ok"])
            self.assertTrue(p1["db16_quotaRejected"])
            self.assertTrue(p1["db16_estOk"])
            self.assertTrue(p1["db17_ok"])
            self.assertTrue(p1["db18_ok"])
            self.assertTrue(p1["db19_ok"])
            self.assertTrue(p1["db20_ok"])

            # DB-15: Mở lại trang mới trên cùng user_data_dir để kiểm chứng dữ liệu bền vững sau reload
            proc2 = self._run_edge_page("/phase2_reload.html", user_data_dir, port)
            self.assertTrue(done2.wait(timeout=15), "Edge Headless phase2 reload timeout")
            p2 = results["phase2"]
            self.assertNotIn("fatal", p2)
            self.assertTrue(p2["db15_sosPersisted"])
            self.assertTrue(p2["db15_nullSosPersisted"])
            self.assertTrue(p2["db15_reportPersisted"])
        finally:
            for p in (proc1, proc2):
                if p is not None:
                    try:
                        p.terminate()
                        p.wait(timeout=3)
                    except Exception:
                        pass
            srv.shutdown()
            srv.server_close()
            shutil.rmtree(user_data_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
