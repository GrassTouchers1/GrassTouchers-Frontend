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

# HỆ THỐNG THEO DÕI LỖI (BUG TRACKER) – NORTHSTAR CITIZEN

Tài liệu tổng hợp các lỗi quan trọng đã phát hiện, đã xử lý hoặc đang theo dõi cho bản phát hành `v1.0.0-olp2026` (bên cạnh kênh công khai trên GitHub Issues theo `.github/ISSUE_TEMPLATE/`).

---

| Issue ID | Mô tả lỗi | Mức độ ưu tiên | Cách tái hiện | Trạng thái xử lý |
| :--- | :--- | :---: | :--- | :--- |
| **BUG-CIT-001** | Hardcode `http://127.0.0.1:8000` trong `citizen.html`, khiến thiết bị LAN/mobile không kết nối được Backend. | **P0** | Mở `citizen.html` từ IP LAN khác `127.0.0.1`. | **RESOLVED (`CIT-01`)** — Chuẩn hóa toàn bộ qua `NorthStarApi.fetchJson()` & `getApiUrl()` trong `js/config.js`. |
| **BUG-CIT-002** | `selectedCoords` mặc định trỏ Hà Nội & `Math.random()` tự sinh mã SOS giả khi server không trả `id`. | **P0** | Bấm gửi SOS khi chưa định vị GPS hoặc khi server lỗi JSON. | **RESOLVED (`CIT-02`, `CIT-03`)** — Bắt buộc xác nhận vị trí (`coordSource !== 'none'`), bỏ `Math.random()`. |
| **BUG-CIT-003** | OSRM fallback hiển thị thông báo giả `"Né Ngập Thành Công"` dù chưa kiểm tra lớp ngập. | **P0** | Tắt Backend A* để kích hoạt OSRM fallback và tìm đường. | **RESOLVED (`CIT-09`)** — Gắn nhãn trung thực `REFERENCE_ONLY` / `UNSAFE` / `UNAVAILABLE`. |
| **BUG-CIT-004** | Citizen từng có thể gọi `GET /api/sos` trả về danh sách SOS và PII của nạn nhân khác. | **P0** | Gọi `GET /api/sos` từ phân hệ Citizen. | **RESOLVED (`CIT-10`)** — Dùng `GET /api/sos/track/{tracking_token}` che PII; chặn `X-NorthStar-Client: citizen` (`403`). |
| **BUG-CIT-005** | `GET /api/sos` vẫn trả `200` nếu client bên ngoài gọi trực tiếp không gửi header `X-NorthStar-Client: citizen` (do Command chưa có JWT). | **P1** | Gửi `GET http://127.0.0.1:8000/api/sos` không kèm header `X-NorthStar-Client: citizen`. | **OPEN (Post-v1.0.0)** — Đã ghi nhận tại `CITIZEN_KNOWN_LIMITATIONS.md`; bổ sung JWT cho Command trong `CITIZEN_NEXT_ROADMAP.md`. |
| **BUG-CIT-006** | PostgreSQL cục bộ (`127.0.0.1:5432`) lỗi xác thực `.env` (`password authentication failed for user "postgres"`), khiến 3 test PostgreSQL/PostGIS live bị `SKIPPED`. | **P1** | Chạy `tests/test_postgis_sos.py` trên máy chưa cấu hình mật khẩu Postgres khớp `.env`. | **OPEN (Env/Staging)** — Hệ thống chạy ổn định trên SQLite fallback và `alembic --sql` đạt; cần kiểm thử lại trên cụm Postgres Staging. |
