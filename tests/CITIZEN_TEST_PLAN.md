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

# KẾ HOẠCH KIỂM THỬ TOÀN BỘ CITIZEN & TÍCH HỢP BACKEND (`CIT-14`)

**Phạm vi:** Phân hệ NORTHSTAR Citizen (`GrassTouchers-Frontend`) tích hợp với Backend FastAPI (`GrassToucher-backend`).  
**Môi trường kiểm thử:**
- Frontend: `http://127.0.0.1:3000/citizen.html` (Python HTTP server) + Microsoft Edge Headless (`IndexedDB`, `Service Worker`, `WebCrypto`).
- Backend: `http://127.0.0.1:8000` (FastAPI + Uvicorn, chế độ SQLite Fallback khi PostgreSQL `127.0.0.1:5432` offline).

---

## 1. Cấu trúc 8 Nhóm Kiểm thử (Nhóm A – Nhóm H)

| Nhóm | Tên nhóm | Bộ test tự động liên kết | Số test case |
| :---: | :--- | :--- | :---: |
| **A** | GPS & Xác nhận vị trí | `tests/test_phase2_gps_sos.py` | 6 (`GPS-01..06`) |
| **B** | SOS & Offline Sync Idempotency | `tests/test_phase2_gps_sos.py`, `tests/test_phase4_offline_sync.py`, `tests/test_phase12_e2e_acceptance.py`, `tests/test_cit14_integration.py` | 9 (`SOS-01..09`) |
| **C** | Định tuyến né ngập & Sơ tán | `tests/test_phase8_routing_evacuation.py`, `tests/test_cit14_integration.py` | 8 (`RTE-01..08`) |
| **D** | Báo ngập cộng đồng | `tests/test_phase7_flood_reports.py`, `tests/test_cit14_integration.py` | 7 (`FLD-01..07`) |
| **E** | Thời tiết & Cảnh báo thiên tai | `tests/test_phase6_weather_alerts.py` | 7 (`WTH-01..07`) |
| **F** | Trợ lý AI Online/Offline | `tests/test_phase10_ai_ux.py`, `tests/test_cit14_integration.py` | 5 (`AIA-01..05`) |
| **G** | PWA & Service Worker | `tests/test_phase5_pwa.py` | 6 (`PWA-01..06`) |
| **H** | Thiết bị & Điều kiện mạng/quyền | `tests/test_phase5_pwa.py`, `tests/test_cit14_integration.py`, `tests/test_phase2_gps_sos.py` | 6 (`DEV-01..06`) |

---

## 2. Tiêu chí Đạt / Không đạt (Pass / Fail / Skipped Criteria)
- **PASS:** Hành vi thực tế khớp hoàn toàn kết quả mong đợi, không phát sinh lỗi P0, không có dữ liệu/cảnh báo giả.
- **FAIL:** Sai lệch hành vi, mất dữ liệu SOS, gửi tọa độ mặc định, trùng bản ghi, hoặc crash giao diện/API.
- **SKIPPED:** Chỉ áp dụng cho các trường hợp phụ thuộc thiết bị phần cứng thật không gắn trong môi trường chạy kiểm thử (ví dụ Android/iOS vật lý).
