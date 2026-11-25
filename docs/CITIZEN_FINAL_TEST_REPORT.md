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

# BÁO CÁO KIỂM THỬ TỔNG THỂ – NORTHSTAR CITIZEN (`CIT-13`)

**Ngày chạy kiểm thử:** 2026-11-25  
**Môi trường kiểm thử:** Windows 11, Python 3.x, FastAPI Uvicorn (`127.0.0.1:8000`), HTTP Static Server (`127.0.0.1:3000`), Microsoft Edge Headless, SQLite Fallback (`PostgreSQL 127.0.0.1:5432` offline/auth error).

---

## 1. Tổng hợp kết quả thực thi Test Suites

| Bộ kiểm thử | Số test chạy | PASS | FAIL | SKIPPED | Ghi chú cụ thể |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Frontend Suite (Giai đoạn 1–11 + Audit + Workflow)** | 36 | 34 | 0 | 2 | `PWA-21` (Android thật), `PWA-22` (iOS thật) |
| **Phase 12 E2E Acceptance (`test_phase12_e2e_acceptance.py`)** | 1 | 1 | 0 | 0 | Kiểm thử live `/api/health`, `/api/sos`, idempotency, `/api/sos/track/{token}`, `/api/shelters`, `/api/route/evacuate`, Edge Headless `citizen.html` |
| **Backend Suite (`unittest discover -s tests`)** | 52 | 49 | 0 | 3 | 3 test PostgreSQL/PostGIS live & rollback (`test_postgis_sos.py`, `test_phase4_idempotency.py`) bị `SKIPPED` do PostgreSQL chưa kết nối được |
| **Alembic SQL Migration (`alembic upgrade head --sql`)** | 5 bản (`0001`→`0005`) | 5 | 0 | 0 | Sinh DDL PostgreSQL/PostGIS hợp lệ |

---

## 2. Phân loại kết quả theo 11 Nhóm Kiểm thử (Nhóm A–K)

| Nhóm | Phạm vi | Kết quả | Chi tiết bằng chứng |
| :--- | :--- | :---: | :--- |
| **Nhóm A – GPS** | GPS thành công/thất bại, từ chối quyền, timeout, chọn tay, đổi vị trí, sai số, không tọa độ | **PASS** | `test_phase2_gps_sos.py` (`TEST-GPS-01..07`); không gửi tọa độ mặc định. |
| **Nhóm B – SOS** | Online, offline, không GPS, có mô tả, server nhận/từ chối, timeout, reload, đồng bộ lại, chống trùng | **PASS** | `test_phase2_gps_sos.py`, `test_phase4_offline_sync.py`, `test_phase12_e2e_acceptance.py`. |
| **Nhóm C – IndexedDB** | 7 Object Stores, CRUD, migration từ `localStorage`, reload, quota, hết hạn, giữ bản nháp SOS | **PASS** | `test_offline_db.py` (`DB-01..20` trên Edge Headless). |
| **Nhóm D – Offline Sync** | `PENDING`, `SENDING`, `RETRYING`, `ACKNOWLEDGED`, `FAILED`, retry backoff, idempotency, đồng thời | **PASS** | `test_phase4_offline_sync.py` (`SYNC-01..22`) + Backend idempotency. |
| **Nhóm E – PWA** | Cài app, mở offline, cache đầy đủ, SW update, giữ IndexedDB sau update, tài nguyên | **PASS_WITH_LIMITATIONS** | `PWA-01..20` PASS trên Edge Headless; `PWA-21..22` (Android/iOS thật) `SKIPPED`. |
| **Nhóm F – Thời tiết & Cảnh báo** | Online/offline, lỗi API, cache cũ, cảnh báo chính thức, dự báo, mô phỏng, timestamp, nguồn | **PASS** | `test_phase6_weather_alerts.py` (`WT-01..09`, `AL-01..09`, `INT-01..08`). |
| **Nhóm G – Báo cáo ngập** | Online/offline, ảnh `<=5MB`, vị trí, đồng bộ, chống trùng, trạng thái xác minh | **PASS** | `test_phase7_flood_reports.py` (`FLOOD-01..15`). |
| **Nhóm H – Định tuyến** | A* (`121.89 ms`), dữ liệu ngập, OSRM fallback, tuyến không an toàn, shelters, evacuate, không dữ liệu | **PASS** | `test_phase8_routing_evacuation.py` + E2E `/api/shelters`, `/api/route/evacuate`. |
| **Nhóm I – Theo dõi SOS** | Token hợp lệ/sai/hết hạn, cô lập hồ sơ, che PII, trạng thái thật | **PASS_WITH_LIMITATIONS** | `test_phase9_sos_tracking.py` PASS; `GET /api/sos` chặn `X-NorthStar-Client: citizen` (`403`), nhưng chưa có auth token cho Command. |
| **Nhóm J – AI** | Online/offline, kho 15 chủ đề, nguồn, ngoài phạm vi, lỗi API, không bịa | **PASS** | `test_phase10_ai_ux.py` (`AI-01..10`, `UX-01..10`). |
| **Nhóm K – SOS Relay** | Xuất gói tin, QR/chuỗi chia sẻ, tiếp nhận, xác minh SHA-256/ECDSA, chuyển tiếp, chống trùng, Gateway | **PASS_WITH_LIMITATIONS** | `test_phase11_relay_satellite.py` (`RELAY-01..15`) & `test_phase11_relay_backend.py` PASS; chưa có phần cứng Web Bluetooth / Satellite thật. |

---

## 3. Kiểm thử Cơ sở dữ liệu (PostgreSQL/PostGIS vs SQLite Fallback)

- **SQLite Fallback (`app/fallback_storage.py`):** Đã kiểm thử thực tế toàn bộ luồng SOS, `NULL` geometry, `client_event_id` idempotency, `tracking_token_hash`, báo cáo ngập và định tuyến A*.
- **PostgreSQL/PostGIS:** Chưa kết nối được trong môi trường máy chủ test hiện tại (`FATAL: password authentication failed for user "postgres"` trên `127.0.0.1:5432`). Do đó, 3 test kết nối trực tiếp PostgreSQL và rollback migration `0003` được giữ ở trạng thái **`SKIPPED`** theo đúng nguyên tắc trung thực, không đánh đồng SQLite fallback với PostgreSQL production.
