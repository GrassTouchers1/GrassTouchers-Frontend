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

# BIÊN BẢN DIỄN TẬP & NGHIỆM THU CUỐI CÙNG – NORTHSTAR CITIZEN (`CIT-16`)

**Ngày lập:** 2026-11-25  
**Vai trò đánh giá:** Nhóm Kiểm thử Độc lập & Ban Giám khảo OLP 2026  
**Phiên bản đánh giá:** `v1.0.0-olp2026` (`dist/northstar-citizen-v1.0.0-olp2026.tar.gz`)

---

## 1. Kết quả Diễn tập 6 Kịch bản Cứu hộ Toàn trình (`tests/test_cit16_rescue_drill.py`)

| Kịch bản | Quy trình diễn tập đã kiểm tra thực tế | Kết quả đánh giá | Ghi chú kỹ thuật & Giới hạn |
| :---: | :--- | :---: | :--- |
| **1** | **Người dân theo dõi thiên tai:** Mở `citizen.html`, xác định vị trí, xem thời tiết/cảnh báo, kiểm tra khu vực nguy hiểm (`/api/reports`), xem nơi trú ẩn (`/api/shelters`). | **PASS** | Edge Headless tải sạch `citizen.html`; `/api/reports` và `/api/shelters` trả GeoJSON hợp lệ (`200`). |
| **2** | **Người dân cần cứu trợ:** Xác định GPS, nhập thông tin, gửi SOS (`POST /api/sos`), Backend nhận, Command (`GET /api/sos`) nhìn thấy bản ghi, Citizen nhận `id` & `tracking_token` thật. | **PASS WITH LIMITATIONS** | Luồng SOS hoạt động thực tế; ghi nhận Command `GET /api/sos` chưa có JWT riêng (chỉ chặn header `X-NorthStar-Client: citizen`). |
| **3** | **Mất Internet:** Tắt mạng, mở Citizen PWA, tạo SOS lưu IndexedDB (`sos_outbox`), reload trang giữ nguyên dữ liệu, bật mạng đồng bộ chống trùng (`client_event_id`) — Command nhận đúng 1 bản ghi. | **PASS WITH LIMITATIONS** | Đạt trên Edge Headless + SQLite fallback; chưa kiểm thử trên điện thoại Android/iOS thật (`PWA-21/22` `SKIPPED`) và PostgreSQL live (`SKIPPED`). |
| **4** | **Tìm đường tránh ngập:** Chọn xuất phát/đến, nhận dữ liệu ngập, chạy A* (`/api/route`, `/api/route/evacuate`), kiểm tra cảnh báo tuyến & trường hợp dữ liệu không đầy đủ (OSRM fallback). | **PASS** | A* chạy `121.89 ms`; OSRM fallback gắn `REFERENCE_ONLY`, không có thông báo an toàn giả. |
| **5** | **Trợ lý AI:** Hỏi online (`POST /api/ai/chat`), tắt mạng hỏi kho tri thức 15 chủ đề kèm nguồn & ngày kiểm duyệt, hỏi ngoài phạm vi từ chối bịa đặt. | **PASS** | Hoạt động chính xác cả Online lẫn Offline (0 request mạng khi offline). |
| **6** | **Chuyển tiếp SOS (`A -> B -> C`):** Đóng gói `northstar.sos.relay.v1` ký SHA-256/ECDSA, chuyển qua B (`hop_count=2 <= max_hops=3`), C đẩy `POST /api/sos/relay` lên Backend, chống gửi trùng `client_event_id`, giữ `relay_history`. | **PASS WITH LIMITATIONS** | Giao thức phần mềm & API Relay đạt; chưa có phần cứng Web Bluetooth Mesh / Satellite Gateway vật lý. |

---

## 2. Đánh giá Chi tiết từng Chức năng (Phân loại chuẩn Ban Giám khảo)

| Chức năng | Trạng thái | Căn cứ kiểm thử |
| :--- | :---: | :--- |
| Cấu hình API & Bảo mật log (`js/config.js`) | **PASS** | `test_phase1_config_api.py`, `SECRET_LEAKS=[]`. |
| GPS thực, Vòng tròn sai số & Xác nhận vị trí | **PASS** | `test_phase2_gps_sos.py` (`TEST-GPS-01..07`). |
| Lưu trữ ngoại tuyến IndexedDB (7 Stores) | **PASS** | `test_offline_db.py` (`DB-01..20`). |
| Offline Sync, Backoff & Idempotency | **PASS WITH LIMITATIONS** | `test_phase4_offline_sync.py` PASS; SQLite fallback PASS; PostgreSQL live `SKIPPED`. |
| PWA & Service Worker (`sw.js`) | **PASS WITH LIMITATIONS** | `PWA-01..20` Edge Headless PASS; Android/iOS vật lý `SKIPPED`. |
| Thời tiết & Cảnh báo thiên tai | **PASS** | `test_phase6_weather_alerts.py` (26 kịch bản PASS). |
| Báo cáo ngập cộng đồng | **PASS** | `test_phase7_flood_reports.py` + `test_cit14_integration.py` PASS. |
| Định tuyến né ngập A* & Sơ tán | **PASS** | `test_phase8_routing_evacuation.py` + E2E live PASS. |
| Tra cứu SOS riêng tư (`/api/sos/track/{token}`) | **PASS WITH LIMITATIONS** | `test_phase9_sos_tracking.py` PASS; `GET /api/sos` phía Command thiếu JWT. |
| Trợ lý AI Online/Offline & UX Mobile | **PASS** | `test_phase10_ai_ux.py` (`AI-01..10`, `UX-01..10`) PASS. |
| SOS Relay (`northstar.sos.relay.v1`) | **PASS WITH LIMITATIONS** | `test_phase11_relay_satellite.py` + `test_cit16_rescue_drill.py` PASS; BLE phần cứng chưa có thiết bị thật. |
| Truyền thông qua Vệ tinh vật lý (`SatelliteGatewayAdapter`) | **NOT IMPLEMENTED** *(chỉ mới có Adapter 7 trạng thái sẵn sàng tích hợp phần cứng)* | `js/satellite_gateway_adapter.js` không giả lập `CONNECTED`/`ACKNOWLEDGED`. |

---

## 3. Nhận xét Mức độ Sẵn sàng Dự thi OLP 2026

**Kết luận:** **READY FOR COMPETITION (Đủ điều kiện dự thi OLP 2026 với các giới hạn được công khai minh bạch).**

- **Điểm mạnh đạt chuẩn thi đấu:** Không còn lỗi P0; luồng cốt lõi cứu hộ (GPS xác nhận → SOS thật → lưu IndexedDB khi mất mạng → đồng bộ chống trùng `client_event_id` → Command tiếp nhận → định tuyến A* → AI ngoại tuyến → đóng gói nguồn mở Apache-2.0 `tar.gz`) đã được chứng minh chạy thực tế end-to-end.
- **Điểm trừ / Hạn chế không che giấu:** (1) PostgreSQL/PostGIS chưa được chạy live trong môi trường test cục bộ do lỗi xác thực `.env` (đang chạy SQLite fallback); (2) Chưa kiểm thử trên điện thoại Android/iOS vật lý; (3) Endpoint `GET /api/sos` phía Command cần bổ sung JWT ở giai đoạn hậu thi đấu; (4) Kết nối Satellite Gateway & BLE Mesh vật lý mới dừng ở tầng kiến trúc/giao thức phần mềm.
