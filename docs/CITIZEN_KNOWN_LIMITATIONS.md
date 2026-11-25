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

# CÁC GIỚI HẠN ĐÃ BIẾT – NORTHSTAR CITIZEN (`v1.0.0-olp2026`)

1. **PostgreSQL/PostGIS Live Tests (`SKIPPED`):**
   - Trong môi trường kiểm thử cục bộ, PostgreSQL (`127.0.0.1:5432`) chưa kết nối được do sai mật khẩu cấu hình `.env` (`FATAL: password authentication failed for user "postgres"`).
   - Hệ thống đã chạy và kiểm thử đầy đủ trên SQLite fallback + sinh DDL Alembic `0001..0005` (`--sql`), nhưng chưa nghiệm thu trực tiếp trên PostgreSQL/PostGIS đang chạy.
2. **Thiết bị di động vật lý (`PWA-21`, `PWA-22` – `SKIPPED`):**
   - Các kịch bản PWA, IndexedDB, Offline Sync đã được kiểm thử tự động trên Edge Headless; chưa thực hiện kiểm thử trực tiếp trên điện thoại Android và iPhone vật lý.
3. **Bảo mật đầu cuối `GET /api/sos` phía Command (`PASS_WITH_LIMITATIONS`):**
   - Citizen bị chặn bởi header `X-NorthStar-Client: citizen` (`HTTP 403`) và sử dụng endpoint riêng `/api/sos/track/{tracking_token}`.
   - Tuy nhiên, nếu gọi trực tiếp `GET /api/sos` không kèm header `X-NorthStar-Client: citizen`, Backend vẫn trả về danh sách SOS (`HTTP 200`) vì phân hệ Command (`index.html`) chưa áp dụng cơ chế đăng nhập/JWT bắt buộc.
4. **Phần cứng Web Bluetooth & Satellite Gateway (`CIT-12`, `CIT-16`):**
   - Giao thức `northstar.sos.relay.v1` (WebCrypto SHA-256 + ECDSA-P256), chia sẻ chuỗi/QR, `POST /api/sos/relay` (`A -> B -> C`) và `SatelliteGatewayAdapter` (7 trạng thái) đã hoàn chỉnh ở tầng phần mềm.
   - Truyền thông phần cứng vệ tinh thực tế hiện ở trạng thái **`NOT IMPLEMENTED`** ở tầng driver thiết bị vật lý (chưa có thiết bị BLE/LoRa/Gateway vệ tinh thật để kiểm thử).
5. **Bản đồ Offline & AI Online:**
   - MapLibre vector/raster tiles phụ thuộc vào các tile đã được xem/cache trước đó (`TILE_CACHE`); khu vực chưa từng tải tile khi online sẽ không có nền bản đồ chi tiết khi offline.
   - AI Online phụ thuộc kết nối tới Backend & `GROQ_API_KEY`; khi mất mạng hoặc lỗi API, hệ thống tự động chuyển về kho tri thức 15 chủ đề cục bộ.
