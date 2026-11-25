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

# BÁO CÁO KIỂM TOÁN HỆ THỐNG – NORTHSTAR CITIZEN

Tài liệu kiểm toán bổ sung toàn diện cho phân hệ **NORTHSTAR CITIZEN** (cổng Người dân & Nạn nhân) trước khi bước vào triển khai mã nguồn.

---

## 1. Kiểm toán GPS và Xác minh Vị trí SOS

### 1.1. Hiện trạng mã nguồn đã kiểm tra
- `js/citizen_portal.js`:
  - `state.selectedCoords` khởi tạo cứng `{ lat: 21.0285, lng: 105.8542 }` (dòng 25) và `state.locationConfirmed = false`.
  - `locateGPSWithAccuracy()` sử dụng `navigator.geolocation.getCurrentPosition` với `enableHighAccuracy: true, timeout: 10000, maximumAge: 0`. Khi lỗi chỉ hiển thị toast cảnh báo, không mở luồng chọn thủ công.
  - `renderSOSMarker()` hỗ trợ kéo thả `maplibregl.Marker`, nhưng vòng tròn sai số `accuracyCircle` chỉ được vẽ ở nhánh Leaflet (`L.circle`), chưa có layer vòng tròn sai số trên MapLibre GL JS.
- `citizen.html`:
  - Thẻ `#citizen-sos-coord-display` hiển thị sẵn `21.0285° B, 105.8542° Đ` (dòng 528) và `#citizen-gps-accuracy` hiển thị sẵn `±15m` (dòng 552) ngay cả khi thiết bị chưa từng lấy GPS.
  - Tab Báo ngập (`#citizen-report-lat`, `#citizen-report-lng`) cũng điền sẵn `21.0285` / `105.8030`.
- `js/rescue_manager.js`:
  - `submitSOSBeacon()` (dòng 645–669): khi `locationConfirmed === false`, chỉ hiện hộp thoại `confirm(...)`. Nếu người dùng bấm `OK`, hệ thống **vẫn cho phép gửi SOS với tọa độ mặc định** `21.0285, 105.8542` (hoặc `105.8030, 21.0285`).

### 1.2. Rủi ro thực tế
- Nạn nhân ở tỉnh khác hoặc mất GPS có thể gửi nhầm tín hiệu SOS về trung tâm Hà Nội (`21.0285, 105.8542`) nếu bấm `OK` qua hộp thoại xác nhận nhanh.
- Hiển thị `±15m` tĩnh trên UI tạo cảm giác sai lệch rằng GPS đã định vị chính xác.

### 1.3. Giải pháp khắc phục & Tiêu chí nghiệm thu
- Tách bạch trạng thái tọa độ: `source = 'none' | 'gps' | 'manual_pin' | 'manual_input'`. Không coi tọa độ mặc định lúc khởi tạo là vị trí hợp lệ để gửi SOS.
- Bắt buộc có ít nhất một nguồn vị trí thực (`gps` hoặc `manual_pin`/`manual_input`) **và** người dùng tick xác nhận vị trí thực tế mới cho phép gửi SOS (hoặc mở modal bắt buộc chọn vị trí trên bản đồ / nhập địa chỉ khi GPS thất bại).
- Ẩn `#citizen-gps-accuracy-wrapper` khi chưa có dữ liệu GPS thật; vẽ vòng tròn sai số bằng GeoJSON layer trên MapLibre khi có `accuracy`.

---

## 2. Kiểm toán Cơ sở Dữ liệu Ngoại tuyến (IndexedDB vs localStorage)

### 2.1. Hiện trạng
- Toàn bộ dữ liệu ngoại tuyến hiện dùng `localStorage`:
  - `northstar_offline_outbox` (`js/offline_sync_manager.js`)
  - `northstar_sos_drafts` (`js/offline_sync_manager.js`)
  - `northstar_last_sos_ticket` (`js/rescue_manager.js`, `citizen.html`)
  - `offline_flood_reports` (`citizen.html`)
- Thời tiết, cảnh báo thiên tai, điểm sơ tán và tri thức AI ngoại tuyến **chưa được lưu bền vững** trong IndexedDB.

### 2.2. Kế hoạch thiết kế IndexedDB (`northstar_citizen_db`, v1)
| Object Store | KeyPath | Indexes | Mục đích |
| :--- | :--- | :--- | :--- |
| `sos_outbox` | `client_event_id` | `status`, `created_at` | Lưu bản nháp SOS khi offline, trạng thái đồng bộ (`queued`, `syncing`, `synced`, `failed`), mã hồ sơ server trả về. |
| `flood_reports_outbox` | `client_event_id` | `status`, `created_at` | Lưu báo cáo ngập cộng đồng khi offline để tự động đồng bộ. |
| `weather_cache` | `cache_key` | `updated_at` | Lưu bản tin thời tiết thật gần nhất kèm nguồn và thời điểm đo gốc. |
| `alerts_cache` | `cache_key` | `updated_at` | Lưu cảnh báo thiên tai thật gần nhất từ `/api/disasters` kèm `issued_at` gốc. |
| `shelters_cache` | `id` | `status` | Lưu danh sách điểm sơ tán thật từ `/api/shelters` phục vụ tra cứu offline. |
| `ai_knowledge_base` | `topic_id` | `category`, `keywords` | Lưu kho tri thức sinh tồn, sơ cứu, an toàn điện, lũ quét ngoại tuyến. |
| `sync_metadata` | `key` | — | Lưu mốc thời gian đồng bộ cuối, phiên bản schema migration. |

### 2.3. Di chuyển dữ liệu cũ & Xử lý lỗi lưu trữ
- Khi khởi động, chạy hàm migrate 1 lần đọc các key `localStorage` cũ (`northstar_offline_outbox`, `northstar_sos_drafts`, `offline_flood_reports`) đưa vào IndexedDB rồi đánh dấu `migrated_v1`.
- Xử lý lỗi `QuotaExceededError`, trình duyệt ẩn danh (Private Mode chặn IndexedDB) bằng fallback an toàn sang `localStorage` hoặc bộ nhớ tạm phiên làm việc kèm cảnh báo rõ ràng trên UI.

---

## 3. Kiểm toán Offline Sync Manager (Frontend & Backend)

### 3.1. Hiện trạng
- `OfflineSyncManager.syncQueue()` hiện chỉ lắng nghe sự kiện `online` (không tự động quét lại khi mở app nếu trình duyệt đã có mạng sẵn với hàng đợi tồn đọng).
- Chưa có `client_event_id` gửi lên Backend $\rightarrow$ nếu mạng chập chờn (timeout sau khi server đã ghi DB), lần retry tiếp theo sẽ tạo **bản ghi SOS trùng lặp**.
- Chưa đồng bộ `offline_flood_reports`.
- `OfflineSyncManager.updateUI()` cập nhật các ID của Command (`cmd-network-status`) nên giao diện Citizen không hiển thị số lượng gói tin đang chờ đồng bộ.

### 3.2. Thiết kế lại (Frontend + Backend)
- **Frontend**:
  - Sinh `client_event_id` (UUID v4 hoặc chuẩn an toàn) ngay lúc tạo SOS/Report offline.
  - Cơ chế retry với exponential backoff (ví dụ 2s, 5s, 15s, 30s) và khóa chống chạy song song (`isSyncing`).
  - Tự động kích hoạt `syncAll()` khi: (a) mở ứng dụng và `navigator.onLine === true`, (b) sự kiện `online`, (c) người dùng bấm nút "Đồng bộ ngay".
  - Cập nhật trạng thái từ `queued` $\rightarrow$ `synced` trong cả `sos_outbox` lẫn giao diện Citizen (`#citizen-sos-sync-badge`, badge đếm hàng đợi).
- **Backend**:
  - Bổ sung cột/trường tùy chọn `client_event_id` cho `SOSCreate` và `ReportCreate` (kiểm tra trùng lặp idempotency trước khi `INSERT`, nếu đã tồn tại thì trả về bản ghi cũ với HTTP 200/201).

---

## 4. Kiểm toán Theo dõi Trạng thái SOS & Quyền riêng tư

### 4.1. Hiện trạng
- `citizen.html:2389` (`trackTicket`) **không gọi API**, tự gán cứng `"ĐANG ĐIỀU PHỐI ĐỘI CỨU HỘ"` cho mọi mã không phải bản nháp.
- `GET /api/sos` hiện trả về **toàn bộ danh sách SOS** kèm họ tên, số điện thoại, tọa độ chi tiết của mọi nạn nhân khác. Nếu Frontend gọi `GET /api/sos` để lọc 1 mã ticket sẽ gây **lộ thông tin cá nhân (PII)** của người dân khác.

### 4.2. Phương án khắc phục
- Bổ sung endpoint chuyên biệt trên Backend: `GET /api/sos/track/{ticket_id}` (kèm tham số xác thực nhẹ như `phone_last4` hoặc `access_token` trả về lúc tạo SOS).
- Dữ liệu trả về chỉ gồm trạng thái xử lý (`pending`, `acknowledged`, `dispatched`, `on_scene`, `rescued`), thời gian cập nhật gần nhất, ghi chú điều phối công khai — **không trả danh sách hồ sơ của người khác**.

---

## 5. Kiểm toán Bản đồ Ngoại tuyến & Định tuyến

### 5.1. Phân tích 5 lớp ngoại tuyến
| Lớp thành phần | Hiện trạng | Giới hạn & Phương án xử lý |
| :--- | :--- | :--- |
| **1. Cache giao diện (App Shell)** | `sw.js` thiếu `citizen.html` và các script Citizen; liệt kê file không tồn tại khiến `cache.addAll` lỗi; `citizen.html` chưa đăng ký `sw.js`; dùng CDN Tailwind & Lucide. | Cập nhật `STATIC_ASSETS` đúng thực tế, đăng ký `sw.js` trong `citizen.html`, cache tài nguyên cục bộ (từng bước loại bỏ phụ thuộc CDN bắt buộc). |
| **2. Cache dữ liệu địa lý** | `northern_provinces_wgs84.geojson` có sẵn cục bộ; dữ liệu trạm ngập/điểm sơ tán chưa cache IndexedDB. | Cache GeoJSON trạm ngập và điểm sơ tán gần nhất vào IndexedDB kèm timestamp. |
| **3. Cache tile bản đồ** | Bản đồ nền dùng Esri ArcGIS online tiles, chưa cache tile trong SW. | Có thể cache có giới hạn (LRU cache tile đã xem gần nhất) trong `sw.js`, hiển thị thông báo rõ vùng bản đồ chưa tải trước khi offline. |
| **4. Dữ liệu mạng đường** | Đồ thị đường `hanoi_drive.graphml` nằm ở Backend/Core (~vài MB), không nằm trên trình duyệt. | Trình duyệt không có sẵn đồ thị đường bộ ngoại tuyến. |
| **5. Định tuyến ngoại tuyến** | `citizen.html:2747` fallback sang OSRM và **vẫn gắn nhãn "Né Ngập Thành Công"** dù OSRM không kiểm tra ngập; khi offline hoàn toàn không thể gọi cả Backend lẫn OSRM. | Sửa dứt điểm: nếu dùng OSRM phải ghi rõ **"Lộ trình tham khảo (Chưa kiểm tra dữ liệu ngập)"**. Khi offline hoàn toàn, thông báo rõ không thể tính toán lộ trình đường bộ tự động và chỉ cung cấp hướng dẫn khoảng cách/hướng chim bay tới điểm sơ tán đã cache. |

---

## 6. Kiểm toán Bảo mật và Dữ liệu Cá nhân

- **API Key / Token / `.env`**: Backend dùng `.env` (đã nằm trong `.gitignore`); không có key bí mật nào bị hardcode trong Frontend (`GrassTouchers-Frontend`). Tiếp tục duy trì tuyệt đối không in key/token ra log hay đưa vào tài liệu.
- **Tọa độ SOS & Số điện thoại**:
  - Hiện lộ toàn bộ qua `GET /api/sos` (cần tách endpoint tra cứu riêng cho Citizen).
  - Trong `console.log` và thông báo lỗi không được ghi số điện thoại hoặc tọa độ nhạy cảm của người dùng thực.
  - Dữ liệu trong IndexedDB cần có nút "Xóa dữ liệu cục bộ" sau khi hoàn tất cứu hộ và tự động làm sạch bản nháp đã đồng bộ cũ theo chính sách lưu giữ.
- **Hardcode URL**: `citizen.html` đang hardcode `http://127.0.0.1:8000` ở 5 chỗ (dòng 1292, 1405, 1493, 2724, 2910); `citizen_portal.js` và `rescue_manager.js` có fallback `http://localhost:8000` / `ws://localhost:8000`. Phải quy về `js/config.js` (`getApiUrl()`).

---

## 7. Kiểm toán Chiến lược Kiểm thử

Cần phân tách rạch ròi 7 tầng kiểm thử trong các giai đoạn tiếp theo:
1. **Unit Test (Frontend & Backend)**: Kiểm tra hàm thuần (validate GPS, IndexedDB wrapper, backoff sync, offline AI matcher, Pydantic schemas).
2. **Integration Test**: Kiểm tra phối hợp `CitizenPortal` $\leftrightarrow$ `OfflineSyncManager` $\leftrightarrow$ `NorthStarRescue` $\leftrightarrow$ `sw.js`.
3. **API Test**: Kiểm tra từng endpoint `/api/sos`, `/api/sos/track`, `/api/reports`, `/api/route`, `/api/route/evacuate`, `/api/weather/*`, `/api/ai/*` (cả case 200/201 và 4xx/5xx).
4. **End-to-End (E2E) Test**: Kịch bản người dùng từ mở PWA $\rightarrow$ mất mạng $\rightarrow$ lưu SOS $\rightarrow$ có mạng $\rightarrow$ đồng bộ $\rightarrow$ tra cứu trạng thái.
5. **Kiểm thử trên điện thoại thật / Mobile Viewport**: Kiểm tra GPS thật, quyền Location, chế độ Offline/Airplane Mode, cài đặt PWA Home Screen.
6. **Kiểm thử với PostgreSQL/PostGIS hoạt động**: Bắt buộc ghi nhận riêng biệt kết quả chạy trên PostgreSQL thật (Spatial query `ST_DWithin`, `ST_MakePoint`).
7. **Kiểm thử với Fallback SQLite**: Hiện tại bộ test Backend (28/28) đang chạy trên **SQLite fallback** do PostgreSQL offline. Không được đánh đồng kết quả này với kiểm thử production PostgreSQL.
