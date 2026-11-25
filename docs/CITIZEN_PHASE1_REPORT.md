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

# BÁO CÁO NGHIỆM THU GIAI ĐOẠN 1 – BẢO MẬT VÀ CHUẨN HÓA CẤU HÌNH API (CIT-01)

## 1. Những vấn đề phát hiện trước khi sửa
1. **URL hardcode trong Citizen**:
   - `citizen.html` hardcode `http://127.0.0.1:8000` tại 5 điểm gọi API (`/api/reports` GET, `/api/predictions`, `/api/flood-points`, `/api/route`, `/api/reports` POST).
   - `js/citizen_portal.js` kiểm tra truthy `GRASSTOUCHER_CONFIG.API_BASE_URL` khiến chế độ production same-origin (`""`) bị rơi về `http://localhost:8000/api/disasters`.
   - `js/rescue_manager.js` có fallback `ws://localhost:8000/ws/navigation`.
2. **Thiếu helper xử lý lỗi API thống nhất**: Các lời gọi `fetch` trước đây thiếu timeout chuẩn hóa, thiếu `AbortController`, và phân loại lỗi (Timeout / HTTP / JSON / Network / Aborted).
3. **Bảo vệ tệp môi trường**:
   - `GrassTouchers-Frontend/.gitignore` chưa liệt kê `.env` và `.env.*`.
   - `GrassToucher-backend/.env.example` chưa có biến `DATABASE_URL` tương ứng với `app/db.py`.
   - Kiểm tra `git log --all --full-history -- .env` và quét mẫu key/token trong mã nguồn xác nhận `.env` chưa từng bị commit và không có API key lộ trong mã nguồn.

## 2. Những tệp đã thay đổi
- `GrassTouchers-Frontend/js/config.js`
- `GrassTouchers-Frontend/citizen.html`
- `GrassTouchers-Frontend/js/citizen_portal.js`
- `GrassTouchers-Frontend/js/rescue_manager.js`
- `GrassTouchers-Frontend/.gitignore`
- `GrassToucher-backend/.env.example`
- `GrassTouchers-Frontend/tests/test_phase1_config_api.py` (bộ test kiểm chứng Giai đoạn 1)
- `GrassTouchers-Frontend/docs/CITIZEN_IMPLEMENTATION_TRACKER.md`
- `GrassTouchers-Frontend/docs/CITIZEN_FINAL_ROADMAP.md`
- `GrassTouchers-Frontend/docs/CITIZEN_PHASE1_REPORT.md`

## 3. Những nội dung đã triển khai
- Nâng cấp `js/config.js`:
  - Tự động nhận diện môi trường `development` (cổng dev riêng như `3000`, `5173`, ...) và `production` (same-origin / reverse proxy trả về `""`).
  - Hỗ trợ `validateConfig()`, `setApiBaseUrl()`, `getApiUrl()`, `getWsUrl()`, `DEFAULT_TIMEOUT_MS = 12000`.
  - Xây dựng `NorthStarApi.fetchJson()` tích hợp `AbortController`, timeout, phân loại lỗi `NorthStarApiError` (`TIMEOUT`, `ABORTED`, `NETWORK`, `HTTP`, `JSON_PARSE`, `CONFIG`) với thông điệp tiếng Việt thân thiện, không thay thế lỗi bằng dữ liệu giả.
  - Bổ sung `NorthStarApi.sanitizeForLog()` để che các trường nhạy cảm (`phone`, `contact_name`, `password`, `api_key`, `token`, `secret`, `lat`, `lng`).
- Thay toàn bộ 5 điểm hardcode `http://127.0.0.1:8000` trong `citizen.html` bằng `NorthStarApi.fetchJson(...)`.
- Chuẩn hóa `loadDisasterAlerts()` trong `js/citizen_portal.js` và `connectRealtimeWebSocket()` trong `js/rescue_manager.js` dùng chung cấu hình từ `js/config.js`.
- Cập nhật `.gitignore` Frontend và `.env.example` Backend (chỉ dùng giá trị placeholder).

## 4. Các bài kiểm thử đã chạy
1. `python -m unittest discover -s tests -v` (`GrassTouchers-Frontend`):
   - `test_citizen_workflow.py` (8 tests)
   - `test_compliance_audit.py` (4 tests)
   - `test_phase1_config_api.py` (4 tests, bao gồm thực thi thực tế `js/config.js` trên Microsoft Edge headless kiểm tra dev/prod/missing base URL/invalid URL/HTTP 404/HTTP 500/JSON lỗi/Timeout/AbortController/`sanitizeForLog` và kiểm tra CORS thật từ Backend).
2. `.\venv\Scripts\python.exe -m unittest tests/test_all_endpoints.py -v` (`GrassToucher-backend`, 13 tests).

## 5. Kết quả thực tế
- **Frontend**: **16/16 tests PASSED** (`OK`, 2.356s).
- **Backend**: **13/13 tests PASSED** (`OK`, 8.597s) — lưu ý: chạy trên **SQLite fallback** do PostgreSQL trên máy hiện đang offline (`password authentication failed`), không phải kiểm thử PostgreSQL production.
- Quét `127.0.0.1:8000` và `localhost:8000` trên các mô-đun Citizen (`citizen.html`, `citizen_portal.js`, `rescue_manager.js`, `offline_sync_manager.js`, `ai_assistant.js`): **0 kết quả**.

## 6. Rủi ro còn tồn tại
- `app/db.py` có chuỗi fallback phát triển cục bộ khi không đặt biến môi trường `DATABASE_URL`; đã giữ nguyên theo nguyên tắc không tự ý đổi thông tin đăng nhập DB của nhóm.
- PostgreSQL local chưa hoạt động nên chưa kiểm chứng được kết nối PostGIS thật (vẫn chạy ổn định qua SQLite fallback).
- Các lỗi nghiệp vụ của các giai đoạn sau (chỉ định phạm vi không sửa ở GĐ1) vẫn tồn tại theo đúng kế hoạch.

## 7. Các hạng mục chưa được triển khai (thuộc Giai đoạn 2–12)
- GPS & chặn gửi SOS bằng tọa độ mặc định (GĐ2).
- IndexedDB & di chuyển `localStorage` (GĐ3).
- `client_event_id`, retry backoff, đồng bộ báo ngập (GĐ4 & GĐ7).
- Service Worker `sw.js`, `manifest.json` cho PWA offline (GĐ5).
- Loại bỏ cảnh báo giả ở `citizen_portal.js`, OSRM fallback label, `trackTicket()` API thật, AI offline (GĐ6, 8, 9, 10, 11).

## 8. Đánh giá tiêu chí nghiệm thu Giai đoạn 1
| Tiêu chí nghiệm thu | Trạng thái |
| :--- | :---: |
| Không còn API localhost hardcode trong các mô-đun Citizen | **ĐẠT** |
| Các mô-đun sử dụng chung cấu hình API (`js/config.js`) | **ĐẠT** |
| Cấu hình Development / Production hoạt động | **ĐẠT** |
| Không có khóa bí mật mới đưa vào mã nguồn | **ĐẠT** |
| `.env.example` có cấu trúc placeholder phù hợp | **ĐẠT** |
| `.gitignore` bảo vệ các tệp môi trường thật | **ĐẠT** |
| Lỗi API (Timeout, Abort, HTTP 404/500, JSON, Network) được xử lý đúng | **ĐẠT** |
| Các chức năng Citizen cũ không bị hỏng | **ĐẠT** |
| Các bài kiểm thử liên quan đạt | **ĐẠT** |

**Kết luận Giai đoạn 1 (`CIT-01`):** **ĐẠT 9/9 tiêu chí nghiệm thu (`COMPLETED`)**. Dừng lại chờ đánh giá của người quản lý dự án trước khi chuyển sang Giai đoạn 2.
