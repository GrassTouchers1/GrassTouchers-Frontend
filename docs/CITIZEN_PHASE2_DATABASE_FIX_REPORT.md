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

# BÁO CÁO BỔ SUNG GIAI ĐOẠN 2 – POSTGRESQL/POSTGIS CHO SOS KHÔNG CÓ TỌA ĐỘ (`CIT-03.1`)

## 1. Migration đã tạo
- **Tệp migration Alembic:** `GrassToucher-backend/db/alembic/versions/0003_nullable_sos_geom_and_location_meta.py`
  - `revision`: `0003_nullable_sos_geom` (kế thừa từ `0002_multi_hazard_schema`).
  - `upgrade()`:
    - `ALTER TABLE community_sos ALTER COLUMN geom DROP NOT NULL;`
    - Bổ sung 6 cột metadata vị trí (`location_source`, `location_accuracy_m`, `location_captured_at`, `location_confirmed`, `location_description`, `location_landmark`).
    - Giữ nguyên toàn bộ dữ liệu cũ và chỉ mục không gian `idx_community_sos_geom` (GiST).
  - `downgrade()`: Kiểm tra `COUNT(*) FROM community_sos WHERE geom IS NULL` **trước** khi xóa cột hoặc đặt lại `NOT NULL`; nếu còn bản ghi `geom IS NULL` thì `RAISE EXCEPTION` dừng rollback an toàn (đã gia cố ở `CIT-03.2`, xem [CITIZEN_PHASE2_DATABASE_FINAL_REPORT.md](file:///d:/OpenSource_2026/GrassTouchers-Frontend/docs/CITIZEN_PHASE2_DATABASE_FINAL_REPORT.md)).

## 2. Các tệp thay đổi
- `GrassToucher-backend/db/alembic/versions/0003_nullable_sos_geom_and_location_meta.py` (tạo mới)
- `GrassToucher-backend/app/routers/sos.py`:
  - `create_sos_beacon`: Hỗ trợ lưu trực tiếp vào PostgreSQL cả khi `lng/lat` hợp lệ (`ST_SetSRID(ST_MakePoint(%s, %s), 4326)`) lẫn khi `lng/lat` là `NULL` (`geom = NULL`), dùng `is not None` (không dùng truthy để tránh lỗi với `0.0`).
  - `list_sos_beacons` & `update_sos_status`: Dùng `CASE WHEN geom IS NOT NULL THEN ST_X(geom) ELSE NULL END AS lng` và tương tự cho `lat` để truy vấn không lỗi khi `geom IS NULL`.
- `GrassToucher-backend/tests/test_postgis_sos.py` (tạo mới – `POSTGIS-01`..`08`).
- `GrassTouchers-Frontend/js/rescue_manager.js`: Thêm guard cho `feat.geometry === null` trong `renderSOSLayers()` và `renderSOSSidebar()`.

## 3. Các bài kiểm thử đã chạy

| Mã kiểm thử | Mô tả | Kết quả API + SQLite Fallback | Kết quả PostgreSQL thực tế |
| :--- | :--- | :---: | :---: |
| `alembic upgrade --sql` | Kiểm tra sinh SQL migration `0002 -> 0003` | **PASS** (Hợp lệ) | Chưa chạy online (lỗi auth) |
| `POSTGIS-01` | SOS có `lat/lng` hợp lệ | **PASS** (HTTP 201, Point) | **CHƯA ĐẠT** (Skipped) |
| `POSTGIS-02` | SOS `lat=null, lng=null` + mô tả địa điểm | **PASS** (HTTP 201, `geometry=null`) | **CHƯA ĐẠT** (Skipped) |
| `POSTGIS-03` | SOS có `lat`, `lng=null` | **PASS** (HTTP 422 từ chối) | N/A (Chặn ở Pydantic) |
| `POSTGIS-04` | SOS có `lng`, `lat=null` | **PASS** (HTTP 422 từ chối) | N/A (Chặn ở Pydantic) |
| `POSTGIS-05` | `lat=null, lng=null` và mô tả rỗng | **PASS** (HTTP 422 từ chối) | N/A (Chặn ở Pydantic) |
| `POSTGIS-06` | Tọa độ ngoài `[-90..90]`, `[-180..180]` | **PASS** (HTTP 422 từ chối) | N/A (Chặn ở Pydantic) |
| `POSTGIS-07` | `lat=0.0, lng=0.0` (không nhầm truthy) | **PASS** (HTTP 201, `[0.0, 0.0]`) | **CHƯA ĐẠT** (Skipped) |
| `POSTGIS-08` | `GET /api/sos` khi có bản ghi `geom=NULL` | **PASS** (HTTP 200, không lỗi) | **CHƯA ĐẠT** (Skipped) |

## 4. Kết quả PostgreSQL thực tế vs SQLite Fallback
- **Kết quả SQLite Fallback & Frontend**:
  - Backend `tests/test_postgis_sos.py`: **8/8 tests PASS** (`test_postgres_live_srid_and_null_geom_if_available` bị **SKIP**).
  - Frontend `unittest discover -s tests`: **19/19 tests PASS**.
- **Kết quả PostgreSQL thực tế**: **CHƯA ĐẠT / CHƯA THỂ KIỂM CHỨNG TRỰC TIẾP**. Dịch vụ `postgresql-x64-18` đang chạy trên máy, nhưng cấu hình xác thực trong `.env` hiện tại trả về `FATAL: password authentication failed for user "postgres"`. Theo nguyên tắc bảo mật, không tự ý thay đổi mật khẩu/thông tin đăng nhập DB của nhóm.

## 5. Các vấn đề còn tồn tại
- Cần người quản lý dự án cung cấp/cấu hình đúng `DATABASE_URL` hợp lệ trong `.env` cục bộ và chạy `alembic upgrade head` + `python -m unittest tests/test_postgis_sos.py` để xác nhận nghiệm thu trên PostgreSQL/PostGIS thực tế.
- Vì chưa chạy kiểm thử trực tiếp trên PostgreSQL thật, `CIT-03.1` giữ trạng thái **`TESTING`** trong `CITIZEN_IMPLEMENTATION_TRACKER.md`.
