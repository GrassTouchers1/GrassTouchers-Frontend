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

# BÁO CÁO NGHIỆM THU GIAI ĐOẠN 2 – GPS, XÁC MINH VỊ TRÍ VÀ QUY TRÌNH GỬI SOS (`CIT-02`, `CIT-03`)

## 1. Các tệp đã kiểm tra
- `GrassTouchers-Frontend/citizen.html`
- `GrassTouchers-Frontend/js/config.js`
- `GrassTouchers-Frontend/js/citizen_portal.js`
- `GrassTouchers-Frontend/js/rescue_manager.js`
- `GrassTouchers-Frontend/js/offline_sync_manager.js`
- `GrassToucher-backend/app/schemas.py`
- `GrassToucher-backend/app/routers/sos.py`
- `GrassToucher-backend/app/fallback_storage.py`
- `GrassToucher-backend/db/alembic/versions/0002_multi_hazard_schema.py`

## 2. Các tệp đã thay đổi
- **Frontend (`GrassTouchers-Frontend`)**:
  - `citizen.html`: Bỏ tọa độ mặc định và `±15m` tĩnh khỏi khối SOS; thêm hiển thị trạng thái GPS, thời gian lấy GPS, hộp lỗi GPS kèm nút thử lại/chọn bản đồ, và trường nhập mô tả địa điểm + điểm mốc khi mất GPS.
  - `js/citizen_portal.js`: Triển khai 6 trạng thái GPS (`UNKNOWN`, `LOCATING`, `GPS_DETECTED`, `MANUAL_SELECTED`, `USER_CONFIRMED`, `LOCATION_ERROR`), vòng tròn sai số GeoJSON theo mét trên MapLibre, tự xóa `USER_CONFIRMED` khi tọa độ thay đổi, và gắn `window.CitizenPortal = CitizenPortal`.
  - `js/rescue_manager.js`: Bỏ hộp thoại `confirm()` gửi bừa tọa độ mặc định; tách 4 trạng thái gửi (`SENDING`, `SERVER_RECEIVED`, `PENDING_OFFLINE`, `FAILED`); bỏ `Math.random()` giả lập mã hồ sơ; báo lỗi giao thức khi server trả về thiếu `id`.
  - `js/offline_sync_manager.js`: Bỏ `Math.random()` giả lập mã hồ sơ trong `syncQueue()`.
  - `tests/test_phase2_gps_sos.py`: Bộ kiểm thử tự động Nhóm A, Nhóm B, Nhóm C.
- **Backend (`GrassToucher-backend`)**:
  - `app/schemas.py`: Mở rộng `SOSCreate` hỗ trợ `lng`/`lat` là `None` kèm validator yêu cầu mô tả địa điểm/điểm mốc tối thiểu 3 ký tự khi thiếu tọa độ, và các metadata (`location_source`, `location_accuracy_m`, `location_captured_at`, `location_confirmed`, `location_description`, `location_landmark`).
  - `app/fallback_storage.py`: Cho phép `lng`, `lat` nullable trong `fallback_sos` (kèm tự di trú bảng cũ) và lưu đầy đủ metadata vị trí.
  - `app/routers/sos.py`: Hỗ trợ `geometry: None` trong GeoJSON khi mất GPS, kiểm tra `id` hợp lệ khi lưu.

## 3. Những lỗi đã khắc phục
1. `CitizenPortal` không gắn vào `window.CitizenPortal`, khiến `rescue_manager.js` luôn đọc `portalState = null` và rơi về tọa độ mặc định Hà Nội.
2. `selectedCoords` khởi tạo cứng `{ lat: 21.0285, lng: 105.8542 }` và `±15m` hiển thị tĩnh trong HTML dù chưa lấy GPS.
3. `submitSOSBeacon()` cho phép bỏ qua xác nhận vị trí qua `confirm()` và vẫn gửi tọa độ mặc định.
4. `Math.floor(1000 + Math.random() * 9000)` giả lập mã hồ sơ `#SOS-2026-XXXX` khi server thiếu `id`.
5. `accuracyCircle` chỉ hoạt động trên Leaflet, chưa vẽ vòng tròn theo mét trên MapLibre GL JS.

## 4. Thiết kế GPS mới (`CIT-02`)
- Khởi đầu: `selectedCoords = null`, `locationStatus = 'UNKNOWN'`, `locationAccuracy = null`.
- 6 trạng thái đồng bộ trực tiếp ra DOM qua `updateLocationStatusUI()`: `UNKNOWN`, `LOCATING`, `GPS_DETECTED`, `MANUAL_SELECTED`, `USER_CONFIRMED`, `LOCATION_ERROR`.
- Khi GPS thành công: kiểm tra `lat/lng` hữu hạn, chỉ ghi `accuracy` khi trình duyệt cung cấp giá trị số hợp lệ, lưu `locationCapturedAt`, vẽ polygon GeoJSON WGS84 theo bán kính mét thực tế trên MapLibre.
- Khi thay đổi tọa độ (GPS mới, ghim bản đồ, hoặc kéo thả marker): tự động xóa `USER_CONFIRMED` và xóa vòng tròn GPS cũ nếu chuyển sang chọn thủ công.
- Khi GPS lỗi (`PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT`, không hỗ trợ): giữ `selectedCoords = null`, hiển thị lỗi cụ thể cùng nút **Thử lấy GPS lại**, **Chọn trên bản đồ**, và ô nhập **Mô tả địa điểm / Điểm mốc**.

## 5. Thiết kế SOS mới (`CIT-03`)
- Chặn gửi nếu không có cả tọa độ hợp lệ lẫn mô tả địa điểm/điểm mốc (≥ 3 ký tự), và bắt buộc tích xác nhận vị trí.
- Truyền `lng: null, lat: null, location_source: 'unknown'` kèm `location_description` / `location_landmark` khi mất GPS.
- Phân tách rõ 4 trạng thái: `SENDING`, `SERVER_RECEIVED`, `PENDING_OFFLINE`, `FAILED`.
- Chỉ hiển thị `#SOS-2026-XXXX` khi server trả về `id` số nguyên dương hợp lệ; lỗi 400/422 báo `FAILED` rõ ràng thay vì đưa dữ liệu sai vào hàng đợi offline.

## 6. Thay đổi API Backend
- `POST /api/sos` (`SOSCreate`): `lng` và `lat` trở thành `Optional[float]`; bổ sung `location_source`, `location_accuracy_m`, `location_captured_at`, `location_confirmed`, `location_description`, `location_landmark` với giá trị mặc định tương thích ngược hoàn toàn với các client/test cũ.

## 7. Bảng kiểm thử & 8. Kết quả PASS/FAIL

| Mã kiểm thử | Mô tả | Phương thức | Kết quả |
| :--- | :--- | :--- | :---: |
| `TEST-GPS-01` | Khởi đầu `UNKNOWN`, không tọa độ/accuracy giả | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-GPS-02` | GPS thành công: tọa độ thật, sai số thật (`42m`), thời điểm lấy | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-GPS-03` | Từ chối quyền GPS (`code=1`) $\rightarrow$ `LOCATION_ERROR`, `coords=null` | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-GPS-04` | GPS timeout (`code=3`) $\rightarrow$ `LOCATION_ERROR`, không tọa độ giả | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-GPS-05` | Chọn thủ công trên bản đồ $\rightarrow$ `MANUAL_SELECTED`, `source='manual'` | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-GPS-06` | Đổi tọa độ sau khi xác nhận $\rightarrow$ xóa `USER_CONFIRMED` | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-GPS-07` | Vòng tròn sai số GeoJSON theo mét & xóa khi chuyển thủ công | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-01` | Gửi SOS với GPS đã xác nhận tới Backend `/api/sos` | Integration API (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-02` | Gửi SOS với vị trí thủ công đã xác nhận tới Backend `/api/sos` | Integration API (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-03` | GPS thất bại, gửi `null` coords + mô tả địa điểm $\rightarrow$ HTTP 201 | Integration API (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-04` | SOS `null` coords và mô tả rỗng $\rightarrow$ Backend từ chối HTTP 422 | Integration API (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-05` | Server trả HTTP 500 $\rightarrow$ `PENDING_OFFLINE` (`LƯU TRÊN MÁY`) | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-06` | API timeout $\rightarrow$ `PENDING_OFFLINE` | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-07` | Server trả HTTP 201 thiếu `id` $\rightarrow$ `FAILED` (`CHƯA CẤP MÃ HỒ SƠ`) | Edge Headless (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-08` | Server trả `id=42` $\rightarrow$ `SERVER_RECEIVED` (`#SOS-2026-0042`) | Edge Headless & Backend API | **PASS** |
| `TEST-SOS-09` | Không còn `Math.random()` tạo `ticketCode` giả | Static Audit (`test_phase2_gps_sos.py`) | **PASS** |
| `TEST-SOS-10` | Không còn tọa độ mặc định Hà Nội trong `submitSOSBeacon()` | Static Audit (`test_phase2_gps_sos.py`) | **PASS** |
| Bộ test GĐ1 & cũ | `test_citizen_workflow.py`, `test_compliance_audit.py`, `test_phase1_config_api.py` | `unittest` (`19/19 OK`) | **PASS** |
| Bộ test Backend | `tests/test_all_endpoints.py` | `unittest` (`13/13 OK` trên SQLite fallback) | **PASS** |

## 9. Các lỗi còn tồn tại & 10. Phụ thuộc môi trường
- **Cập nhật nhiệm vụ bổ sung `CIT-03.1`**: Đã tạo Alembic migration `0003_nullable_sos_geom` cho phép `community_sos.geom` nhận `NULL` và lưu 6 cột metadata vị trí, đồng thời cập nhật `app/routers/sos.py` + `js/rescue_manager.js` xử lý an toàn `geom = NULL` và tọa độ `0.0`. Chi tiết xem tại `docs/CITIZEN_PHASE2_DATABASE_FIX_REPORT.md`.
- **PostgreSQL local chưa xác thực được**: Dịch vụ `postgresql-x64-18` đang chạy nhưng `.env` báo `password authentication failed for user "postgres"`. Vì vậy 8/8 bài kiểm thử `POSTGIS-01..08` hiện mới đạt trên API + **SQLite fallback**, phần kiểm thử trực tiếp trên PostgreSQL/PostGIS thật vẫn chưa đạt (`SKIPPED`).
- Chức năng đồng bộ `IndexedDB` + `client_event_id` idempotency (GĐ 3 & 4) và `trackTicket()` API thật (GĐ 9) giữ nguyên phạm vi cho các giai đoạn sau.
