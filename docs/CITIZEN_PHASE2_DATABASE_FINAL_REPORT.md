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

# BÁO CÁO HOÀN THIỆN MIGRATION & POSTGRESQL/POSTGIS (`CIT-03.1`, `CIT-03.2`)

## 1. Kiểm tra & Gia cố Downgrade Migration `0003`
- **Vấn đề phát hiện ở bản nháp đầu của `0003_nullable_sos_geom_and_location_meta.py`:** `downgrade()` thực hiện `DROP COLUMN IF EXISTS location_landmark, location_description, ...` trước khi kiểm tra `geom IS NULL`, có nguy cơ làm mất mô tả địa điểm của các bản ghi SOS không có tọa độ.
- **Cách khắc phục (`CIT-03.2`):**
  - Bao bọc toàn bộ `downgrade()` trong một khối giao dịch `DO $$ ... END $$;`.
  - Thực hiện `SELECT COUNT(*) INTO null_geom_count FROM community_sos WHERE geom IS NULL;` **trước mọi thao tác sửa/xóa cột**.
  - Nếu `null_geom_count > 0`, gọi `RAISE EXCEPTION` để dừng rollback ngay lập tức, bảo toàn 100% 6 cột metadata và dữ liệu cũ.
  - Chỉ khi `null_geom_count = 0` mới khôi phục `ALTER COLUMN geom SET NOT NULL` và gỡ 6 cột metadata; giữ nguyên chỉ mục GiST `idx_community_sos_geom`.

## 2. Đối chiếu Đồng bộ Schema
| Trường | Alembic `0003` (PostgreSQL) | `SOSCreate` (`app/schemas.py`) | `fallback_sos` (SQLite) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `geom` / `lat,lng` | `geometry(Point, 4326)` (Nullable) | `Optional[float]` + validator | `REAL` (Nullable) | Hỗ trợ `0.0` (`is not None`) |
| `location_source` | `TEXT NOT NULL DEFAULT 'manual'` | `Literal['gps','manual','approximate','unknown']` | `TEXT DEFAULT 'manual'` | Phân biệt nguồn |
| `location_accuracy_m` | `DOUBLE PRECISION` | `Optional[float]` | `REAL` | NULL nếu không có GPS |
| `location_captured_at` | `TIMESTAMPTZ` | `Optional[str]` | `TEXT` | ISO-8601 |
| `location_confirmed` | `BOOLEAN NOT NULL DEFAULT FALSE` | `bool = False` | `INTEGER DEFAULT 0` | Ép `bool()` khi đọc |
| `location_description` | `TEXT` | `Optional[str]` | `TEXT` | Bắt buộc >=3 ký tự nếu thiếu tọa độ |
| `location_landmark` | `TEXT` | `Optional[str]` | `TEXT` | Điểm mốc hỗ trợ cứu hộ |

*(Lưu ý: Dự án Backend sử dụng `psycopg` + SQL thuần/Alembic, không sử dụng SQLAlchemy ORM `models.py`.)*

## 3. Kết quả Kiểm tra Kết nối PostgreSQL (Không lộ mật khẩu)
- **Host:** `localhost` | **Port:** `5432` | **Database:** `floodnav` | **User:** `postgres`
- **Cơ chế xác thực:** `DATABASE_URL` có đặt mật khẩu trong `.env` (`Password set: True`).
- **Trạng thái dịch vụ Windows:** `postgresql-x64-18` đang chạy (`Running`).
- **Trạng thái kết nối thực tế:** **FAILED** (`OperationalError: FATAL: password authentication failed for user "postgres"`).
- **PostGIS extension & Alembic version trên DB:** Không thể truy vấn trực tiếp do lỗi xác thực kết nối.

### Hướng dẫn khắc phục dành cho Quản trị viên (Admin)
1. Kiểm tra lại mật khẩu tài khoản `postgres` trên máy chủ PostgreSQL 18 hoặc cập nhật đúng `DATABASE_URL` trong tệp `.env` cục bộ của `GrassToucher-backend`.
2. Đảm bảo database `floodnav` và extension `postgis` đã được khởi tạo (`python db/setup_db.py`).
3. Chạy `.\venv\Scripts\alembic.exe upgrade head` để áp dụng migration `0003_nullable_sos_geom`.
4. Chạy lại `.\venv\Scripts\python.exe -m unittest tests/test_postgis_sos.py -v` để xác minh `test_postgres_live_srid_and_null_geom_if_available` và `test_postgres_downgrade_cases_when_connected` chuyển từ `SKIPPED` sang `PASS`.

## 4. Phân loại Kết quả Kiểm thử (PASS / FAIL / SKIPPED)
- **Alembic Offline SQL (`alembic upgrade/downgrade --sql`):** **PASS** (sinh DDL hợp lệ, kiểm tra `WHERE geom IS NULL` trước `DROP COLUMN`).
- **Backend `tests/test_postgis_sos.py` (12 tests):** **10 PASS, 0 FAIL, 2 SKIPPED** (`0.464s`):
  - **PASS (10):** `POSTGIS-01..08` trên API + SQLite fallback, `test_migration_0003_downgrade_checks_null_before_drop`, `test_schema_sync_migration_pydantic_and_sqlite`.
  - **SKIPPED (2):** `test_postgres_live_srid_and_null_geom_if_available`, `test_postgres_downgrade_cases_when_connected` (do lỗi xác thực PostgreSQL local).
- **Backend `tests/test_all_endpoints.py` (13 tests):** **13 PASS, 0 FAIL** trên SQLite fallback (`8.294s`).

## 5. Kết luận Nghiệm thu
- `CIT-03.1` & `CIT-03.2` giữ trạng thái **`TESTING`** cho tới khi quản trị viên xác thực kết nối PostgreSQL thật và chạy qua 2 bài test PostGIS live đang bị `SKIPPED`.
- Không triển khai IndexedDB (Giai đoạn 3) trong nhiệm vụ này.
