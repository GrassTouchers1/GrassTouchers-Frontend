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

# LỘ TRÌNH TRIỂN KHAI 12 GIAI ĐOẠN – NORTHSTAR CITIZEN

Kế hoạch triển khai chi tiết gồm **12 giai đoạn độc lập**, tuân thủ nghiêm ngặt nguyên tắc giữ nguyên kiến trúc lõi, không tạo chức năng giả, kiểm thử đầy đủ sau mỗi giai đoạn.

---

## Giai đoạn 1: Bảo mật và Chuẩn hóa Cấu hình API (`P0`) — **[COMPLETED]**
- **Mục tiêu:** Loại bỏ toàn bộ URL hardcode và rà soát bảo mật log/PII trước khi mở rộng tính năng.
- **Vấn đề cần khắc phục:** `citizen.html` hardcode `http://127.0.0.1:8000` tại 5 vị trí; `citizen_portal.js` và `rescue_manager.js` có fallback `localhost:8000`; cần đảm bảo không ghi tọa độ/SĐT nhạy cảm ra log.
- **Tệp nguồn cần kiểm tra:** `js/config.js`, `citizen.html`, `js/citizen_portal.js`, `js/rescue_manager.js`, `js/ai_assistant.js`, `app/config.py`.
- **Tệp nguồn dự kiến thay đổi:** `js/config.js`, `citizen.html`, `js/citizen_portal.js`, `js/rescue_manager.js`.
- **Công việc Frontend:**
  - Chuẩn hóa `GRASSTOUCHER_CONFIG.getApiUrl()` hỗ trợ cấu hình qua query/localStorage override cho môi trường LAN/mobile thật và cùng origin khi chạy cổng 8000.
  - Thay toàn bộ `fetch('http://127.0.0.1:8000/...')` trong `citizen.html` bằng `getApiUrl(...)`.
  - Bổ sung helper che/ẩn PII khi ghi console log.
- **Công việc Backend/Core:** Kiểm tra cấu hình CORS trong `app/main.py` cho phép truy cập từ PWA origin hợp lệ.
- **Quan hệ phụ thuộc:** Nền tảng cho mọi giai đoạn 2–12.
- **Trường hợp lỗi phải xử lý:** `GRASSTOUCHER_CONFIG` chưa nạp kịp; endpoint cấu hình sai scheme `http`/`https` hoặc `ws`/`wss`.
- **Danh sách kiểm thử:** Unit test `getApiUrl()`; grep kiểm tra 0 URL `127.0.0.1:8000` hardcode trong logic nghiệp vụ Citizen.
- **Tiêu chí nghiệm thu:** Mọi request API/WS từ Citizen đều đi qua `js/config.js`, không có key/token/PII rò rỉ trong log.

---

## Giai đoạn 2: GPS, Xác minh Vị trí và Gửi SOS An toàn (`P0`) — **[COMPLETED / DB PostGIS `CIT-03.1`, `CIT-03.2`: TESTING]**
- **Mục tiêu:** Bảo đảm người dân không bao giờ vô tình gửi SOS với tọa độ mặc định chưa được xác nhận.
- **Vấn đề cần khắc phục:** `selectedCoords` khởi tạo Hà Nội dễ bị gửi nhầm; `±15m` hiển thị tĩnh giả lập; `submitSOSBeacon()` vẫn cho phép gửi dù `locationConfirmed === false`; thiếu vòng tròn sai số GPS trên MapLibre.
- **Tệp nguồn cần kiểm tra:** `js/citizen_portal.js`, `js/rescue_manager.js`, `citizen.html`.
- **Tệp nguồn dự kiến thay đổi:** `js/citizen_portal.js`, `js/rescue_manager.js`, `citizen.html`.
- **Công việc Frontend:**
  - Thêm trạng thái `coordSource: 'none' | 'gps' | 'manual_pin' | 'manual_input'` vào `CitizenPortal.state`.
  - Khi chưa có vị trí thật: hiển thị `"Chưa xác định tọa độ – Vui lòng bấm GPS hoặc Ghim bản đồ"`, ẩn `±15m` tĩnh.
  - Nếu GPS thất bại: hiển thị hướng dẫn chuyển ngay sang chọn thủ công trên bản đồ hoặc nhập tọa độ/địa chỉ gần nhất.
  - Khi `submitSOSBeacon()`: chặn gửi nếu `coordSource === 'none'` hoặc `!locationConfirmed`.
  - Bỏ `Math.floor(1000 + Math.random() * 9000)` khi phản hồi server thiếu `id`; báo lỗi rõ ràng nếu phản hồi server không hợp lệ.
  - Vẽ vòng tròn sai số GPS bằng GeoJSON layer trên MapLibre.
- **Công việc Backend/Core:** Không cần thay đổi.
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 1.
- **Trường hợp lỗi phải xử lý:** Người dùng từ chối quyền Location, GPS timeout, trình duyệt không hỗ trợ Geolocation, server trả về JSON thiếu `id`.
- **Danh sách kiểm thử:** Test gửi SOS khi chưa xác nhận vị trí (phải bị chặn); test GPS lỗi chuyển chọn tay; test server trả về thiếu `id` không tự bịa mã `#SOS-2026-XXXX`.
- **Tiêu chí nghiệm thu:** Không tồn tại đường đi code nào cho phép gửi tọa độ mặc định chưa xác minh hoặc tự sinh mã hồ sơ ngẫu nhiên.

---

## Giai đoạn 3: IndexedDB và Lưu Dữ liệu Ngoại tuyến (`P0`) — **[COMPLETED]**
- **Mục tiêu:** Thay thế `localStorage` đơn giản bằng tầng lưu trữ IndexedDB bền vững cho toàn bộ dữ liệu Citizen.
- **Vấn đề cần khắc phục:** Hiện chỉ dùng `localStorage` rời rạc (`northstar_offline_outbox`, `northstar_sos_drafts`, `offline_flood_reports`), chưa cache thời tiết, cảnh báo, điểm sơ tán và tri thức AI.
- **Tệp nguồn cần kiểm tra:** `js/offline_sync_manager.js`, `js/citizen_portal.js`, `citizen.html`.
- **Tệp nguồn dự kiến thay đổi:** `js/offline_db.js` (tạo mới), `js/offline_sync_manager.js`, `citizen.html`.
- **Công việc Frontend:**
  - Tạo module `OfflineDB` (`northstar_citizen_db`, version 1) với 7 Object Stores: `sos_outbox`, `flood_reports_outbox`, `weather_cache`, `alerts_cache`, `shelters_cache`, `ai_knowledge_base`, `sync_metadata`.
  - Viết hàm migrate dữ liệu cũ từ `localStorage` sang IndexedDB an toàn.
  - Xử lý lỗi `QuotaExceededError` / Private Browsing bằng fallback kiểm soát được kèm thông báo UI.
- **Công việc Backend/Core:** Không.
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 1.
- **Trường hợp lỗi phải xử lý:** Trình duyệt chặn IndexedDB, đầy bộ nhớ lưu trữ, dữ liệu JSON cũ trong `localStorage` bị hỏng.
- **Danh sách kiểm thử:** Unit test CRUD trên 7 store, test migrate từ dữ liệu `localStorage` mẫu, test fallback khi IndexedDB bị chặn.
- **Tiêu chí nghiệm thu:** Dữ liệu SOS, báo ngập, thời tiết, cảnh báo, điểm sơ tán được đọc/ghi bền vững qua IndexedDB.

---

## Giai đoạn 4: Offline Sync, Retry và Chống Trùng (`P0`) — `TESTING`
- **Trạng thái hiện tại:** Đã triển khai hoàn chỉnh Outbox IndexedDB (`OfflineSyncManager`), backoff + jitter, phục hồi `SENDING`, khóa liên tab, idempotency SHA-256 + `HTTP 409 Conflict` và migration `0004` (chi tiết tại `docs/CITIZEN_PHASE4_REPORT.md`). Đạt 21/21 Frontend tests (`SYNC-01..22`) và 5/5 SQLite Fallback Backend tests; còn chờ chạy nghiệm thu PostgreSQL live khi có thông tin xác thực DB hợp lệ.
- **Mục tiêu:** Đồng bộ tin cậy 100% gói tin ngoại tuyến lên Backend mà không tạo dữ liệu trùng lặp.
- **Vấn đề cần khắc phục:** Thiếu `client_event_id` chống trùng, chưa retry theo backoff, chưa sync khi mở app, chưa sync `flood_reports_outbox`, UI Citizen chưa thấy trạng thái hàng đợi.
- **Tệp nguồn cần kiểm tra:** `js/offline_sync_manager.js`, `app/routers/sos.py`, `app/routers/reports.py`, `app/schemas.py`, `app/fallback_storage.py`.
- **Tệp nguồn dự kiến thay đổi:** `js/offline_sync_manager.js`, `citizen.html`, `app/schemas.py`, `app/routers/sos.py`, `app/routers/reports.py`, `app/fallback_storage.py`, `db/init/01_schema.sql`.
- **Công việc Frontend:**
  - Sinh `client_event_id` duy nhất cho mỗi SOS/Report trước khi đưa vào outbox.
  - Hỗ trợ retry backoff (2s, 5s, 15s, 30s), khóa chống sync đồng thời, tự động chạy `syncAll()` khi khởi động app (nếu online) và khi nhận sự kiện `online`.
  - Cập nhật trạng thái UI Citizen (số gói tin chờ đồng bộ, chuyển nhãn từ `Lưu trên máy (chưa gửi)` sang `Đã gửi máy chủ` kèm mã thật).
- **Công việc Backend/Core:**
  - Bổ sung trường tùy chọn `client_event_id` vào `SOSCreate` và `ReportCreate`.
  - Kiểm tra idempotency trong PostgreSQL và SQLite fallback: nếu `client_event_id` đã tồn tại thì trả về bản ghi cũ, không chèn thêm.
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 2 và 3.
- **Trường hợp lỗi phải xử lý:** Mạng rớt giữa chừng sau khi server đã ghi DB, server 500/503, dữ liệu 422 không hợp lệ (đánh dấu `failed` để tránh lặp vô hạn).
- **Danh sách kiểm thử:** API test gửi 2 lần cùng `client_event_id` chỉ tạo 1 bản ghi; test sync tự động khi chuyển offline $\rightarrow$ online.
- **Tiêu chí nghiệm thu:** Không tạo trùng SOS/Report khi retry; đồng bộ tự động hoạt động cả khi mở lại app lẫn khi có mạng trở lại.

---

## Giai đoạn 5: PWA, Service Worker và Manifest (`P0`) — `TESTING`
- **Trạng thái hiện tại:** Đã tạo `manifest-citizen.json` + icon PNG/SVG, nâng cấp `sw.js` đa tầng cache (`STATIC_CACHE`, `RUNTIME_CACHE`, `WEATHER_CACHE`, `TILE_CACHE`) + Background Sync kết nối Unified Outbox `northstar_citizen_db`, đăng ký SW và banner cập nhật an toàn trong `citizen.html` (chi tiết tại `docs/CITIZEN_PHASE5_REPORT.md`). Đạt kiểm thử static + Edge Headless; `PWA-21` (Android thật) và `PWA-22` (iOS thật) chờ kiểm thử trên thiết bị vật lý.
- **Mục tiêu:** Cho phép cài đặt và mở trực tiếp `citizen.html` khi thiết bị mất Internet hoàn toàn.
- **Vấn đề cần khắc phục:** `citizen.html` chưa đăng ký `sw.js`; `manifest.json` trỏ `index.html`; `sw.js` thiếu toàn bộ tài nguyên Citizen và trỏ sai đường dẫn file không tồn tại (`css/tailwind.css`, `data/vietnam_northern_provinces.geojson`).
- **Tệp nguồn cần kiểm tra:** `sw.js`, `manifest.json`, `citizen.html`, `index.html`.
- **Tệp nguồn dự kiến thay đổi:** `sw.js`, `manifest.json` (hoặc thêm `manifest.citizen.json`), `citizen.html`.
- **Công việc Frontend:**
  - Sửa `STATIC_ASSETS` trong `sw.js` khớp 100% các file có thật của Citizen và Command (`citizen.html`, `js/citizen_portal.js`, `js/rescue_manager.js`, `js/offline_sync_manager.js`, `js/offline_db.js`, `js/ai_assistant.js`, `css/maplibre-gl.css`, `js/vendor/maplibre-gl.js`, `data/northern_provinces_wgs84.geojson`).
  - Sửa `navigate` fallback để điều hướng đúng `citizen.html` khi người dùng đang mở Citizen offline.
  - Thêm đăng ký `navigator.serviceWorker.register('./sw.js')` trong `citizen.html`.
  - Cập nhật cache tile bản đồ có giới hạn (tối đa số lượng tile) và kiểm tra phương án dự phòng khi mất CDN Tailwind/Lucide.
- **Công việc Backend/Core:** Không.
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 1, 3, 4.
- **Trường hợp lỗi phải xử lý:** Một URL trong `STATIC_ASSETS` 404 làm hỏng bước `install`; trình duyệt không hỗ trợ SW (HTTP không phải localhost).
- **Danh sách kiểm thử:** Kiểm tra DevTools Application $\rightarrow$ Service Workers active & Cache Storage đủ file; bật Offline mode tải lại `citizen.html` thành công.
- **Tiêu chí nghiệm thu:** Citizen mở được khi mất Internet, không lỗi `cache.addAll()`, giữ nguyên luồng offline SOS/Tri thức.

---

## Giai đoạn 6: Thời tiết và Cảnh báo Thiên tai Trung thực (`P1`) — `COMPLETED`
- **Trạng thái hiện tại:** Đã hoàn thiện thời tiết thực tế (chọn vị trí thủ công/GPS, đơn vị & timestamp rõ ràng, xử lý `null`), phân loại cảnh báo (`active`, `upcoming`, `expired`, `revoked`), tách riêng dự báo AI/ML (`/api/predictions`), cache IndexedDB có TTL và loại bỏ toàn bộ dữ liệu mẫu giả (chi tiết tại `docs/CITIZEN_PHASE6_REPORT.md`). Đạt 26/26 kịch bản `WT/AL/INT` và hồi quy Frontend.
- **Mục tiêu:** Hiển thị thời tiết và cảnh báo thiên tai dựa trên dữ liệu thật hoặc cache thật có timestamp gốc.
- **Vấn đề cần khắc phục:** `loadDisasterAlerts()` tạo cảnh báo mẫu với `new Date().toISOString()` khi API lỗi; `renderWeatherFallback()` hiện số liệu mẫu cứng thay vì cache thật gần nhất.
- **Tệp nguồn cần kiểm tra:** `js/citizen_portal.js`, `app/routers/weather.py`, `app/routers/disasters.py`.
- **Tệp nguồn dự kiến thay đổi:** `js/citizen_portal.js`.
- **Công việc Frontend:**
  - Lưu bản tin thời tiết thật (từ `/api/weather/hanoi` hoặc Open-Meteo) và cảnh báo thật (`/api/disasters`) vào `weather_cache` / `alerts_cache` của IndexedDB.
  - Khi mất mạng hoặc API lỗi: đọc từ IndexedDB và hiển thị nhãn rõ **"Dữ liệu đã lưu lúc [thời điểm gốc] (Chế độ ngoại tuyến)"**. Nếu chưa từng có cache thì báo rõ *"Chưa có dữ liệu đã lưu trên thiết bị"*, tuyệt đối không tự tạo `new Date().toISOString()` cho cảnh báo.
- **Công việc Backend/Core:** Không bắt buộc (tận dụng `/api/weather/hanoi` và `/api/disasters`).
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 1, 3.
- **Trường hợp lỗi phải xử lý:** Open-Meteo rate limit/timeout, `/api/disasters` lỗi 500, cache rỗng lần đầu mở app offline.
- **Danh sách kiểm thử:** Test API lỗi khi có cache (hiện timestamp cũ); test API lỗi khi chưa có cache (hiện thông báo lỗi thật, không bịa cảnh báo).
- **Tiêu chí nghiệm thu:** Không còn cảnh báo giả tạo với thời gian hiện tại; người dùng phân biệt rõ dữ liệu mới vs dữ liệu cache ngoại tuyến.

---

## Giai đoạn 7: Báo cáo Ngập Cộng đồng & Đồng bộ (`P1`) — `COMPLETED`
- **Trạng thái hiện tại:** Đã hoàn thiện biểu mẫu báo ngập chi tiết (không dùng tọa độ mặc định, hỗ trợ GPS & chọn bản đồ), kiểm tra & nén ảnh lưu cục bộ IndexedDB (nêu rõ giới hạn Backend chưa hỗ trợ upload nhị phân), đồng bộ qua `OfflineSyncManager` (`flood_reports`), phân tách marker `NGẬP` khỏi `SOS` và bảo vệ PII người gửi (chi tiết tại `docs/CITIZEN_PHASE7_REPORT.md`).
- **Mục tiêu:** Hoàn thiện luồng báo ngập cộng đồng online/offline đồng bộ hai chiều với Backend.
- **Vấn đề cần khắc phục:** `submitFloodReport()` trong `citizen.html` hardcode URL, lưu offline vào `localStorage` (`offline_flood_reports`) nhưng không có cơ chế tự động đẩy lên khi có mạng lại; tọa độ báo ngập điền sẵn giá trị mặc định.
- **Tệp nguồn cần kiểm tra:** `citizen.html`, `js/offline_sync_manager.js`, `app/routers/reports.py`.
- **Tệp nguồn dự kiến thay đổi:** `citizen.html`, `js/offline_sync_manager.js`, `app/routers/reports.py` (nếu cần hỗ trợ ghi chú mô tả `notes` nếu schema chưa lưu).
- **Công việc Frontend:**
  - Đưa báo ngập offline vào `flood_reports_outbox` (IndexedDB) kèm `client_event_id`.
  - Bổ sung trạng thái rõ `[Đã gửi – Chờ xác minh]` (online) và `[Lưu trên máy – Chờ đồng bộ]` (offline).
  - Yêu cầu xác nhận vị trí báo ngập (GPS hoặc ghim bản đồ) trước khi gửi.
- **Công việc Backend/Core:** Hỗ trợ `client_event_id` chống trùng khi sync từ outbox (liên kết Giai đoạn 4).
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 1, 2, 3, 4.
- **Trường hợp lỗi phải xử lý:** Gửi báo cáo khi offline, lỗi validation tọa độ ngoài biên, lỗi mạng giữa chừng.
- **Danh sách kiểm thử:** Test gửi báo ngập online, test gửi offline rồi bật mạng kiểm tra tự đồng bộ và xuất hiện trên `GET /api/reports`.
- **Tiêu chí nghiệm thu:** Báo cáo cộng đồng hoạt động xuyên suốt online/offline, không trùng lặp và hiển thị đúng trạng thái xác minh.

---

## Giai đoạn 8: Định tuyến Né ngập & Sơ tán An toàn trên MapLibre (`P0`) — `COMPLETED`
- **Trạng thái hiện tại:** Đã loại bỏ `renderSampleShelters()` và thông báo giả `"Né Ngập Thành Công"`, phân biệt 4 trạng thái `SAFE_VERIFIED`/`REFERENCE_ONLY`/`UNSAFE`/`UNAVAILABLE`, tích hợp `GET /api/shelters`, `POST /api/route/evacuate` và cache `shelters_cache` trên IndexedDB (chi tiết tại `docs/CITIZEN_PHASE8_REPORT.md`).
- **Mục tiêu:** Đảm bảo 100% tính trung thực của cảnh báo ngập trên lộ trình và kết nối hoàn chỉnh thuật toán tìm đường sơ tán Backend lên MapLibre.
- **Vấn đề cần khắc phục:** OSRM fallback trong `citizen.html` gắn nhãn sai `"Né Ngập Thành Công"`; `citizen.html` dùng `renderSampleShelters()` thay vì `/api/shelters`; `NorthStarRescue.findEvacuationRoute()` vẽ bằng Leaflet thay vì MapLibre.
- **Tệp nguồn cần kiểm tra:** `citizen.html`, `js/rescue_manager.js`, `app/routers/route.py`, `app/routers/evacuation.py`, `app/routers/shelters.py`.
- **Tệp nguồn dự kiến thay đổi:** `citizen.html`, `js/rescue_manager.js`.
- **Công việc Frontend:**
  - Sửa `findRoute()`: nếu dùng OSRM fallback (không qua `/api/route` có đồ thị kiểm tra ngập), phải hiển thị cảnh báo rõ **"Lộ trình tham khảo (Chưa kiểm tra dữ liệu ngập – Cẩn trọng khi di chuyển)"**, tuyệt đối không gắn nhãn "Né Ngập Thành Công".
  - Khi offline hoàn toàn: thông báo rõ không thể tính toán lộ trình đường bộ tự động do thiếu dữ liệu mạng đường ngoại tuyến.
  - Thay `renderSampleShelters()` bằng dữ liệu thật từ `GET /api/shelters` (và lưu `shelters_cache` vào IndexedDB).
  - Bổ sung nút **"Tìm đường sơ tán gần nhất"** gọi `POST /api/route/evacuate` và vẽ tuyến sơ tán trực tiếp lên **MapLibre GL JS** trong `citizen.html`.
- **Công việc Backend/Core:** Kiểm tra phản hồi `/api/route/evacuate` tương thích 100% với MapLibre GeoJSON source.
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 1, 3.
- **Trường hợp lỗi phải xử lý:** Backend 503 (graph chưa sẵn sàng), 422 (ngoài vùng đồ thị hoặc bị cô lập), OSRM timeout, mất mạng hoàn toàn.
- **Danh sách kiểm thử:** Test `/api/route` thành công; test fallback OSRM hiển thị đúng cảnh báo chưa kiểm tra ngập; test `/api/route/evacuate` vẽ tuyến lên MapLibre; test offline.
- **Tiêu chí nghiệm thu:** Không còn tuyến đường nào bị gắn nhãn "Né ngập" nếu chưa qua kiểm tra dữ liệu ngập; định tuyến sơ tán hoạt động trên MapLibre.

---

## Giai đoạn 9: Theo dõi Trạng thái SOS Thực tế & Bảo vệ PII (`P0`) — `TESTING`
- **Trạng thái hiện tại:** Đã triển khai `GET /api/sos/track/{tracking_token}` (token mật mã lưu dạng SHA-256 hash, rate limit 20 req/60s, hết hạn 7 ngày, thu hồi token, zero PII), chặn Citizen gọi `GET /api/sos` (`HTTP 403`), sửa `trackTicket()` loại bỏ dữ liệu giả và lưu token trong IndexedDB (chi tiết tại `docs/CITIZEN_PHASE9_REPORT.md`). Đạt `TRACK-01..14` trên SQLite fallback & Frontend; chờ xác thực trên PostgreSQL live.
- **Mục tiêu:** Tra cứu tiến độ hồ sơ SOS theo dữ liệu thật từ Backend mà không làm lộ thông tin cá nhân của nạn nhân khác.
- **Vấn đề cần khắc phục:** `trackTicket()` trong `citizen.html` giả lập trạng thái `"ĐANG ĐIỀU PHỐI ĐỘI CỨU HỘ"` không gọi API; `GET /api/sos` trả toàn bộ danh sách SOS gây lộ PII nếu dùng để tra cứu ở Citizen.
- **Tệp nguồn cần kiểm tra:** `citizen.html`, `app/routers/sos.py`, `app/fallback_storage.py`, `app/schemas.py`.
- **Tệp nguồn dự kiến thay đổi:** `app/routers/sos.py`, `app/fallback_storage.py`, `citizen.html`, `js/rescue_manager.js`.
- **Công việc Backend/Core:**
  - Tạo endpoint `GET /api/sos/track/{ticket_id}` (chấp nhận `#SOS-2026-XXXX` hoặc số `id`) kèm query xác thực nhẹ (`phone_last4` hoặc `track_token`).
  - Trả về đúng trạng thái thực (`pending`, `acknowledged`, `dispatched`, `on_scene`, `rescued`, `cancelled`), thời điểm cập nhật, mức độ ưu tiên — ẩn số điện thoại đầy đủ và không trả hồ sơ khác.
- **Công việc Frontend:**
  - Lưu `track_token` / 4 số cuối SĐT cục bộ khi tạo SOS thành công.
  - Sửa `trackTicket()` gọi `GET /api/sos/track/{ticket_id}` thật, hiển thị đúng tiến độ từng bước (`Đã tiếp nhận` $\rightarrow$ `Đã điều phối` $\rightarrow$ `Đang tới hiện trường` $\rightarrow$ `Đã an toàn`).
  - Khi offline hoặc bản nháp chưa đồng bộ: hiển thị rõ trạng thái `Lưu trên máy (chưa gửi)` từ IndexedDB.
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 1, 2, 3, 4.
- **Trường hợp lỗi phải xử lý:** Nhập sai mã ticket (404), sai thông tin xác thực (403), mất mạng khi bấm tra cứu.
- **Danh sách kiểm thử:** API test `GET /api/sos/track/{id}` trả 200/403/404; test `trackTicket()` phản ánh đúng khi Command đổi trạng thái `pending` $\rightarrow$ `dispatched` $\rightarrow$ `rescued`.
- **Tiêu chí nghiệm thu:** `trackTicket()` phản ánh 100% trạng thái thật trên máy chủ và không tải danh sách SOS công khai của người khác về trình duyệt Citizen.

---

## Giai đoạn 10: Trợ lý Tri thức Ngoại tuyến & Hoàn thiện UI/UX (`P1`) — `COMPLETED`
- **Trạng thái hiện tại:** Đã tạo `data/offline_knowledge_vi.json` (15 chủ đề có nguồn & ngày kiểm duyệt) + `js/offline_knowledge.js`, nâng cấp `js/ai_assistant.js` (short-circuit khi offline, timeout 8s + 1 retry khi online), bỏ `user-scalable=no` và thêm thanh khẩn cấp `SOS`/`112` trong `citizen.html` (chi tiết tại `docs/CITIZEN_PHASE10_REPORT.md`).
- **Mục tiêu:** Bảo đảm người dân vẫn tra cứu được kỹ năng sinh tồn/xử lý khẩn cấp khi mất Internet hoàn toàn, không gọi API ngầm.
- **Vấn đề cần khắc phục:** `ai_assistant.js` khi mất mạng chỉ báo lỗi kết nối, chưa có bộ tri thức cục bộ thực sự.
- **Tệp nguồn cần kiểm tra:** `js/ai_assistant.js`, `citizen.html`, `js/offline_db.js`.
- **Tệp nguồn dự kiến thay đổi:** `js/ai_assistant.js`, `js/offline_knowledge.js` (hoặc tích hợp trong `ai_assistant.js`), `citizen.html`.
- **Công việc Frontend:**
  - Xây dựng kho tri thức ngoại tuyến (cập nhật vào `ai_knowledge_base` IndexedDB + bundle sẵn trong JS để `sw.js` cache): xử lý ngập sâu, an toàn điện, lũ quét, sạt lở đất, sơ cứu đuối nước, lọc nước khẩn cấp, chuẩn bị túi sinh tồn.
  - Khi `navigator.onLine === false` hoặc người dùng bật chế độ ngoại tuyến: trả lời trực tiếp từ thuật toán tìm kiếm từ khóa tiếng Việt không dấu/có dấu trên bộ tri thức cục bộ **mà không gọi fetch API**, gắn nhãn nguồn `Tri thức ngoại tuyến cục bộ (Không dùng Internet)`.
  - Khi online: giữ nguyên `/api/ai/chat` và tự chuyển sang cục bộ nếu request lỗi mạng (ghi rõ đã chuyển nguồn cục bộ).
- **Công việc Backend/Core:** Không.
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 1, 3, 5.
- **Trường hợp lỗi phải xử lý:** Câu hỏi không khớp chủ đề nào trong kho tri thức (trả về hướng dẫn liên hệ 114/112 và danh sách chủ đề sẵn có).
- **Danh sách kiểm thử:** Test tắt mạng hoàn toàn trong DevTools, đặt câu hỏi `"cách xử lý điện giật khi ngập"` và kiểm tra Network tab có **0 request** được gửi ra ngoài.
- **Tiêu chí nghiệm thu:** Trợ lý ngoại tuyến hoạt động 100% cục bộ khi mất Internet và trung thực nhãn nguồn dữ liệu.

---

## Giai đoạn 11: Truyền tiếp SOS (Relay/P2P) & Kiến trúc Mở rộng Vệ tinh (`P2`) — `COMPLETED`
- **Trạng thái hiện tại:** Đã triển khai `SOSRelayManager` (`js/sos_relay.js` với SHA-256 + ECDSA-P256, kiểm tra `expires_at` & `max_hops`, Web Share/Copy, Web Bluetooth check), `SatelliteGatewayAdapter` (`js/satellite_gateway_adapter.js`), và `POST /api/sos/relay` chống trùng theo `client_event_id` (chi tiết tại `docs/CITIZEN_PHASE11_REPORT.md`).
- **Mục tiêu:** Cung cấp cơ chế chuyển tiếp SOS thực tế giữa các thiết bị trong khả năng trình duyệt và kiến trúc mở rộng cho thiết bị/gateway vệ tinh một cách trung thực.
- **Vấn đề cần khắc phục:** Chưa có tính năng truyền tiếp SOS qua thiết bị khác và chưa có adapter cho gateway vệ tinh.
- **Tệp nguồn cần kiểm tra:** `citizen.html`, `js/rescue_manager.js`, `app/routers/sos.py`, `app/routers/satellite.py`.
- **Tệp nguồn dự kiến thay đổi:** `js/sos_relay.js` (mới), `js/satellite_adapter.js` (mới), `citizen.html`, `app/routers/sos.py`.
- **Công việc Frontend:**
  - **SOS Relay:** Đóng gói bản nháp SOS thành gói tin chuyển tiếp chuẩn JSON có mã kiểm tra toàn vẹn (checksum/timestamp). Hỗ trợ: (1) Chia sẻ gói tin qua Web Share API / Copy mã rút gọn / Hiển thị chuỗi chia sẻ để chuyển cho thiết bị gần đó có sóng; (2) Tính năng **"Chuyển tiếp SOS hộ người khác"** cho phép dán/nhận gói tin và đẩy lên `/api/sos` khi thiết bị này có mạng; (3) Lớp dò tìm Web Bluetooth (`navigator.bluetooth`) có kiểm tra khả năng hỗ trợ của trình duyệt (báo rõ nếu thiết bị không hỗ trợ hoặc không tìm thấy node relay).
  - **Satellite Gateway Adapter:** Giao diện cấu hình/kết nối thiết bị gateway vệ tinh (Web Serial / Bluetooth / Local Gateway URL), luôn hiển thị rõ trạng thái thực tế (`Chưa kết nối thiết bị/gateway vệ tinh`). Tuyệt đối không báo đã gửi qua vệ tinh nếu chưa có thiết bị thật xác nhận ACK.
- **Công việc Backend/Core:** Cho phép `POST /api/sos` nhận thêm metadata tùy chọn `relay_source` (`direct`, `p2p_relay`, `satellite_gateway`) để Ban chỉ huy phân biệt nguồn tin.
- **Quan hệ phụ thuộc:** Phụ thuộc Giai đoạn 2, 3, 4.
- **Trường hợp lỗi phải xử lý:** Trình duyệt không hỗ trợ Web Bluetooth/Web Share, gói tin relay bị sửa sai checksum, không có phần cứng vệ tinh gắn ngoài.
- **Danh sách kiểm thử:** Test đóng gói & kiểm tra checksum gói tin relay; test chuyển tiếp hộ qua thiết bị khác lên `/api/sos`; test giao diện vệ tinh từ chối gửi khi chưa kết nối phần cứng.
- **Tiêu chí nghiệm thu:** Chuyển tiếp SOS hoạt động thực tế giữa 2 trình duyệt; Satellite Adapter trung thực 100% giới hạn phần cứng.

---

## Giai đoạn 12: Kiểm thử Toàn diện, Tài liệu & Phát hành (`P1`) — `COMPLETED`
- **Trạng thái hiện tại:** Đã hoàn tất kiểm toán 12 giai đoạn, chạy bộ test Frontend (`36 PASS, 2 SKIPPED`), E2E live (`test_phase12_e2e_acceptance.py` PASS), Backend (`52 PASS, 3 SKIPPED` PostgreSQL live), cập nhật release notes `v1.0.0-olp2026` trong `CHANGELOG.md` và hoàn thiện bộ 6 tài liệu nghiệm thu (`docs/CITIZEN_FINAL_AUDIT.md`, `CITIZEN_FINAL_TEST_REPORT.md`, `CITIZEN_FINAL_ACCEPTANCE.md`, `CITIZEN_DEMO_SCRIPT.md`, `CITIZEN_KNOWN_LIMITATIONS.md`, `CITIZEN_NEXT_ROADMAP.md`).
- **Mục tiêu:** Xác minh toàn bộ 15 mục tiêu sản phẩm trên môi trường thực tế và hoàn thiện hồ sơ nộp thi OLP 2026.
- **Tệp nguồn cần kiểm tra:** `tests/test_citizen_workflow.py`, `tests/test_compliance_audit.py`, `GrassToucher-backend/tests/*`, `docs/*`.
- **Tệp nguồn dự kiến thay đổi:** `tests/test_citizen_workflow.py`, `tests/test_compliance_audit.py`, `docs/CITIZEN_IMPLEMENTATION_TRACKER.md`, báo cáo kiểm thử.
- **Công việc Kiểm thử & Tài liệu:**
  - Cập nhật `test_compliance_audit.py` bao gồm các file mới (`js/offline_db.js`, `js/sos_relay.js`, `js/satellite_adapter.js`, các doc mới) đảm bảo 100% Apache-2.0 và không có đường dẫn cứng.
  - Bổ sung test API cho `GET /api/sos/track/{ticket_id}` và idempotency `client_event_id`.
  - Chạy kiểm thử tách biệt rõ ràng: (a) SQLite fallback, (b) PostgreSQL/PostGIS thực tế (nếu DB khả dụng), (c) PWA Offline & Mobile viewport/điện thoại thật.
  - Cập nhật `docs/CITIZEN_IMPLEMENTATION_TRACKER.md` dựa trên kết quả chạy test thực tế.
- **Tiêu chí nghiệm thu:** Tất cả test Frontend, Backend, Compliance đều pass; các giới hạn phần cứng (vệ tinh, mesh) được ghi nhận minh bạch trong tài liệu.
