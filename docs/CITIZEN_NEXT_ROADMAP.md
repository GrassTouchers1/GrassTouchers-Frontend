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

# LỘ TRÌNH PHÁT TRIỂN TIẾP THEO – NORTHSTAR CITIZEN (SAU `v1.0.0-olp2026`)

1. **Xác thực bắt buộc cho Command (`P0` sau OLP 2026):**
   - Bổ sung JWT / API Key cho Command (`index.html`) để khóa hoàn toàn `GET /api/sos` khỏi mọi truy cập nặc danh không có quyền điều phối (`BUG-CIT-005`).
2. **Nghiệm thu PostgreSQL/PostGIS Staging & Production (`P0` triển khai thực tế):**
   - Chạy `alembic upgrade head`, kiểm thử rollback `0003`, chỉ mục GiST và truy vấn không gian thực tế trên cụm PostgreSQL/PostGIS.
3. **Kiểm thử hiện trường trên Android & iOS thật (`P1`):**
   - Đo thực tế cài đặt PWA ("Add to Home Screen"), Background Sync trên Chrome Android, chế độ Safari iOS khi mất mạng và GPS yếu.
4. **Tích hợp phần cứng Web Bluetooth / LoRa / Satellite Gateway thật (`P2`):**
   - Kết nối `SOSRelayManager` và `SatelliteGatewayAdapter` với thiết bị LoRa/Meshtastic hoặc thiết bị vệ tinh thực tế qua BLE GATT / Web Serial.
5. **Đóng gói Bản đồ Vector Offline khu vực (MBTiles/PMTiles) (`P2`):**
   - Cho phép người dân tải trước gói bản đồ địa phương gọn nhẹ trước mùa bão lũ.
