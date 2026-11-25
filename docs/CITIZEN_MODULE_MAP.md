<!--
  Copyright (C) 2026 NORTHSTAR Contributors
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at:
      http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

# BẢN ĐỒ MÔ-ĐUN PHÂN HỆ NORTHSTAR CITIZEN

Tài liệu ánh xạ các tệp mã nguồn, vai trò, đối tượng toàn cục và quan hệ phụ thuộc trong phân hệ Citizen.

---

## 1. Sơ đồ Phụ thuộc Tổng thể

```text
citizen.html (Shell PWA & CitizenPortalApp)
 ├── css/maplibre-gl.css, css/style.css
 ├── manifest.json, sw.js (Service Worker PWA)
 ├── js/config.js              ──► GRASSTOUCHER_CONFIG / getApiUrl()
 ├── js/offline_sync_manager.js──► OfflineSyncManager (Queue, Sync, Drafts)
 ├── js/rescue_manager.js      ──► NorthStarRescue (SOS, Shelters, Evacuation, WS)
 ├── js/citizen_portal.js      ──► CitizenPortal (Weather, Alerts, GPS, Map Pin)
 ├── js/ai_assistant.js        ──► AIAssistant (Online AI & Offline Knowledge)
 └── [Mở rộng theo kế hoạch]
      ├── js/offline_db.js         (IndexedDB Storage Layer)
      ├── js/sos_relay.js          (Peer-to-Peer / QR / Share SOS Relay)
      └── js/satellite_adapter.js  (Satellite Gateway Extension Adapter)
```

---

## 2. Chi tiết Từng Mô-đun

| Tệp nguồn | Vai trò hiện tại | Phụ thuộc đầu vào | Vấn đề cần nâng cấp |
| :--- | :--- | :--- | :--- |
| `citizen.html` | Giao diện Citizen Mobile PWA, bản đồ MapLibre GL JS, tab Weather/SOS/Route/Report/Tracking. | `config.js`, `maplibre-gl.js`, các module JS Citizen. | Chưa đăng ký `sw.js`; hardcode `127.0.0.1:8000`; `trackTicket()` giả lập; OSRM fallback gắn nhãn sai; chưa tích hợp `/api/route/evacuate`. |
| `js/config.js` | Cấu hình `API_BASE_URL`, `WS_BASE_URL`, `getApiUrl(path)`. | `window.location` | Cần hỗ trợ cấu hình linh hoạt cho LAN/HTTPS/PWA cài đặt trên điện thoại thật. |
| `js/citizen_portal.js` | Tải thời tiết Open-Meteo, cảnh báo `/api/disasters`, GPS `locateGPSWithAccuracy()`, ghim bản đồ. | `config.js`, `window.map`, `CitizenPortalApp` | Bỏ tạo cảnh báo giả với `new Date()`; bổ sung cache thời tiết/cảnh báo thật; ẩn `±15m` giả khi chưa chạy GPS; vẽ vòng tròn sai số trên MapLibre. |
| `js/rescue_manager.js` | Gửi SOS (`/api/sos`), tải vùng thiên tai/sơ tán/SOS, định tuyến sơ tán (`/api/route/evacuate`). | `config.js`, `CitizenPortal`, `OfflineSyncManager` | Bỏ `Math.random()` sinh mã SOS giả; chặn gửi SOS khi chưa có vị trí thực; đồng bộ layer MapLibre thay vì chỉ phụ thuộc Leaflet `L`. |
| `js/offline_sync_manager.js` | Hàng đợi `localStorage`, lưu bản nháp SOS, đồng bộ khi có sự kiện `online`. | `config.js` | Nâng cấp sang IndexedDB; thêm `client_event_id`, backoff retry, đồng bộ khi mở app, đồng bộ báo cáo ngập, cập nhật UI Citizen. |
| `js/ai_assistant.js` | Widget chat AI trực tuyến (`/api/ai/chat`), phân tích báo cáo, phân loại SOS. | `config.js`, `window.map` | Bổ sung bộ tri thức ngoại tuyến cục bộ hoạt động thực sự khi mất Internet mà không gọi API. |
| `sw.js` | Service Worker cache tĩnh & điều hướng offline. | Cache API | Sửa danh sách `STATIC_ASSETS` khớp file thật, thêm toàn bộ tài nguyên Citizen, thêm fallback cho `citizen.html`. |
| `manifest.json` | Khai báo Web App Manifest. | `citizen.html` / `index.html` | Đảm bảo Citizen PWA có manifest/start_url chuẩn xác khi cài đặt độc lập. |
