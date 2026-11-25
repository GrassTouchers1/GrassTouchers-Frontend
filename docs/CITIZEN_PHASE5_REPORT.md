# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 5 – PWA, SERVICE WORKER VÀ MANIFEST (`CIT-06`)

**Ngày cập nhật:** 2026-11-25  
**Phân hệ:** NORTHSTAR CITIZEN (`GrassTouchers-Frontend`, nhánh `thuan`)  
**Trạng thái nghiệm thu:** `TESTING` *(Đạt toàn bộ kiểm thử tĩnh, Manifest và Edge Headless Service Worker / Cache Storage / IndexedDB / Background Sync; kiểm thử cài đặt trên thiết bị vật lý Android `PWA-21` và iOS `PWA-22` đang `SKIPPED` do không có thiết bị thật kết nối trong môi trường kiểm thử).*

---

## 1. Kiến trúc PWA & Manifest
- **Manifest riêng cho Citizen (`manifest-citizen.json`)**:
  - `name`: `"NORTHSTAR Citizen"`, `short_name`: `"Citizen"`.
  - `start_url`: `"./citizen.html"`, `scope`: `"./"`, `display`: `"standalone"`.
  - `theme_color` / `background_color`: `"#0f172a"`.
  - Bộ icon thực tế trong `assets/icons/`: `citizen-192.png` (`192x192`), `citizen-512.png` (`512x512`), `citizen-icon.svg` (`any`).
  - Giữ nguyên `manifest.json` (`start_url: "./index.html"`) cho phân hệ Command (`index.html`).
- **Đăng ký & Vòng đời cập nhật an toàn (`citizen.html`)**:
  - `<link rel="manifest" href="manifest-citizen.json">`, `<link rel="icon">`, `<link rel="apple-touch-icon">`.
  - Đăng ký `./sw.js` (`scope: './'`) thống nhất với `index.html` để tránh xung đột scope giữa Citizen và Command.
  - Xử lý `beforeinstallprompt` (`#btn-citizen-install-pwa`), `updatefound` (`#citizen-pwa-update-banner` + `#btn-citizen-pwa-update`), kiểm tra `OfflineSyncManager.getStatusSummary().sending === 0` trước khi gửi `SKIP_WAITING`, và reload an toàn qua `controllerchange` chỉ khi người dùng chủ động cập nhật.

---

## 2. Service Worker & Chiến lược Cache (`sw.js`)
- **Phiên bản cache tách biệt (`CACHE_VERSION = 'v20261125-p5'`)**:
  - `STATIC_CACHE`: `northstar-static-v20261125-p5`
  - `RUNTIME_CACHE`: `northstar-runtime-v20261125-p5`
  - `WEATHER_CACHE`: `northstar-weather-v20261125-p5`
  - `TILE_CACHE`: `northstar-tiles-v20261125-p5` (giới hạn tối đa `MAX_TILE_ENTRIES = 120`)
- **Precache chống lỗi 404**:
  - Loại bỏ các đường dẫn không tồn tại trước đây (`./css/tailwind.css`, `./data/vietnam_northern_provinces.geojson`).
  - Precache 21 tài nguyên thực tế (HTML, CSS, JS Citizen & Command, `js/vendor/maplibre-gl.js`, `css/maplibre-gl.css`, `data/northern_provinces.geojson`, `manifest-citizen.json`, `manifest.json`, icons) bằng `Promise.allSettled` và báo cáo qua `GET_PRECACHE_REPORT`.
  - Khi `activate`: chỉ xóa các Cache Storage cũ không nằm trong `ACTIVE_CACHES`; **không chạm vào IndexedDB (`northstar_citizen_db`)**.
- **Chiến lược theo loại request**:
  - **SOS / Reports / Auth / AI (`/api/sos`, `/api/reports`, `/api/auth`, `/api/ai`) & mọi request non-GET**: Network Only — **không cache trong Cache Storage** để tránh lưu PII.
  - **Thời tiết & Cảnh báo (`/api/weather`, `/api/disasters`, `/api/flood`, `/api/shelters`, `open-meteo.com`)**: Network First với fallback `WEATHER_CACHE`; nếu chưa có cache trả `503` JSON thông báo rõ chưa có dữ liệu ngoại tuyến.
  - **Tile bản đồ (`arcgisonline.com`, `tile.openstreetmap.org`, `cartocdn.com`)**: Cache First trong `TILE_CACHE` có giới hạn 120 tile.
  - **Điều hướng HTML**: Network First, fallback `./citizen.html` cho Citizen và `./index.html` cho Command.
  - **Tài nguyên tĩnh cùng origin & CDN (`cdn.tailwindcss.com`, `unpkg.com`, `cdn.jsdelivr.net`)**: Cache First (`STATIC_CACHE` / `RUNTIME_CACHE`).

---

## 3. Kết nối Background Sync với Unified Outbox
- `OfflineSyncManager.init()` lưu `api_base_url` vào `sync_metadata` trong `northstar_citizen_db`.
- Khi trình duyệt hỗ trợ `SyncManager` và `sw.js` nhận sự kiện `sync` (`tag === 'northstar-offline-sync'`), `syncOutboxFromSW()` đọc trực tiếp `sos_queue` và `flood_reports` từ `northstar_citizen_db`, giữ nguyên `client_event_id`, gửi lên `/api/sos` hoặc `/api/reports`, cập nhật `ACKNOWLEDGED` khi nhận được `id` số hợp lệ và gửi `SYNC_COMPLETED` về tab Citizen.
- Trên trình duyệt không hỗ trợ Background Sync, `OfflineSyncManager` tự động đồng bộ khi ứng dụng mở / sự kiện `online` / `visibilitychange`.

---

## 4. Tài nguyên CDN & Bản đồ ngoại tuyến
- **Thư viện cục bộ**: `maplibre-gl.js` và `maplibre-gl.css` đã được vendored cục bộ (BSD-3-Clause); `data/northern_provinces.geojson` được precache trong `STATIC_CACHE`.
- **Thư viện CDN**: Tailwind CDN và Lucide CDN được cache vào `RUNTIME_CACHE` sau lần tải đầu tiên; không tuyên bố hoạt động offline ở lần truy cập đầu tiên khi chưa tải tài nguyên.
- **Giới hạn bản đồ ngoại tuyến**: Giao diện MapLibre và dữ liệu ranh giới tỉnh đã cache mở được khi offline; các tile nền (`TILE_CACHE`) chỉ hiển thị trong phạm vi khu vực đã xem và giới hạn 120 tile; **không có định tuyến offline trên thiết bị** vì thuật toán A* chạy ở Backend.

---

## 5. Kết quả kiểm thử (`tests/test_phase5_pwa.py` & hồi quy Frontend)
- `test_phase5_pwa.py`:
  - `PWA-01..04` (Manifest & icon): **PASS**
  - `PWA-07` & `PWA-20` (Tất cả `STATIC_ASSETS` tồn tại trên đĩa, không xung đột SW giữa Citizen và Command): **PASS**
  - `PWA-05, 06, 07, 08, 11, 12, 13, 14, 15_16, 18_19` (Edge Headless thực tế: đăng ký SW, precache `failed=0`, cache Citizen, lưu SOS IndexedDB khi offline, giữ IndexedDB khi xóa cache cũ, cache Weather API, không cache `/api/sos`, Background Sync / Outbox sync giữ nguyên `client_event_id`): **PASS**
  - `PWA-21` (Android thật) & `PWA-22` (iOS thật): **SKIPPED** (không có thiết bị vật lý kết nối).
- Toàn bộ hồi quy Frontend (`test_phase4_offline_sync.py`, `test_offline_db.py`, `test_phase2_gps_sos.py`, `test_phase1_config_api.py`, `test_compliance_audit.py`, `test_citizen_workflow.py`): **PASS**.
