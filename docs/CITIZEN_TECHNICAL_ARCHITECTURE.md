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

# TÀI LIỆU KIẾN TRÚC KỸ THUẬT – NORTHSTAR CITIZEN (`v1.0.0-olp2026`)

## 1. Tổng quan Kiến trúc Frontend & Backend
- **Frontend (`GrassTouchers-Frontend`):** Kiến trúc Vanilla ES6+ PWA không cần bước build phức tạp. Điểm vào Citizen là `citizen.html`, sử dụng `js/config.js` (`NorthStarApi`) để điều hướng API/WebSocket theo môi trường và gắn header `X-NorthStar-Client: citizen`.
- **Backend (`GrassToucher-backend`):** FastAPI + Uvicorn, sử dụng PostgreSQL/PostGIS làm CSDL chính (Alembic migrations `0001..0005`) và cơ chế **SQLite Fallback** (`app/fallback_storage.py`) tự động kích hoạt khi PostgreSQL không khả dụng.

## 2. Các API chính phục vụ Citizen
- `POST /api/sos` & `POST /api/sos/relay`: Tiếp nhận SOS trực tiếp hoặc chuyển tiếp, hỗ trợ `geom NULL` + metadata vị trí, khử trùng bằng `client_event_id` + SHA-256 `payload_hash`, cấp `tracking_token`.
- `GET /api/sos/track/{tracking_token}`: Tra cứu tiến độ cứu hộ riêng tư bằng token băm SHA-256, che PII (SĐT, họ tên). `GET /api/sos` chặn header `X-NorthStar-Client: citizen` (`HTTP 403`).
- `POST /api/reports`: Tiếp nhận báo ngập cộng đồng kèm `client_event_id` chống trùng.
- `GET /api/shelters`, `POST /api/route`, `POST /api/route/evacuate`: Danh sách điểm trú ẩn và định tuyến A* né ngập trên đồ thị `hanoi_drive.graphml`.
- `POST /api/ai/chat`, `GET /api/ai/status`: Trợ lý AI trực tuyến (Groq/fallback).

## 3. IndexedDB (`js/offline_db.js`)
CSDL `northstar_citizen_db` (version 1) gồm **7 Object Stores**:
1. `sos_outbox`: Hàng đợi SOS chờ đồng bộ (`client_event_id` làm khóa/chỉ mục).
2. `flood_reports_outbox`: Hàng đợi báo ngập cộng đồng.
3. `weather_cache`: Cache thời tiết kèm timestamp & nguồn.
4. `alerts_cache`: Cache cảnh báo thiên tai.
5. `shelters_cache`: Cache điểm trú ẩn và tuyến sơ tán tham khảo.
6. `ai_knowledge_base`: Bộ tri thức sinh tồn ngoại tuyến (`offline_knowledge_vi.json`).
7. `sync_metadata`: Trạng thái đồng bộ và khóa liên tab.

## 4. Service Worker (`sw.js`)
- Áp dụng kiến trúc cache đa tầng: `STATIC_CACHE` (app shell `citizen.html`, JS/CSS/icons/knowledge JSON), `RUNTIME_CACHE`, `WEATHER_CACHE`, `TILE_CACHE`.
- Không cache các endpoint chứa PII như `/api/sos` vào `CacheStorage`.
- Hỗ trợ Background Sync và cơ chế cập nhật phiên bản an toàn, **không xóa IndexedDB** khi nâng cấp SW.

## 5. Sync Manager & SOS Store-and-Forward (`js/offline_sync_manager.js`)
- Luồng **Store-and-Forward**: mọi SOS/Report khi tạo đều gắn `client_event_id` duy nhất và ghi vào `IndexedDB` trước khi gửi hoặc khi mạng lỗi.
- Máy trạng thái: `PENDING` → `SENDING` → `RETRYING` (exponential backoff + jitter) → `ACKNOWLEDGED` hoặc `FAILED` (với lỗi `422` không retry vô hạn).
- Tự động phục hồi các mục bị kẹt ở `SENDING` khi app mở lại và chống ghi trùng bằng `client_event_id` trên Backend.
- Bổ sung `SOSRelayManager` (`js/sos_relay.js`) đóng gói `northstar.sos.relay.v1` ký `SHA-256` + `ECDSA-P256` để chuyển tiếp thủ công qua thiết bị trung gian, và `SatelliteGatewayAdapter` (`js/satellite_gateway_adapter.js`) với 7 trạng thái cho phần cứng mở rộng.

## 6. AI Online / Offline (`js/ai_assistant.js`, `js/offline_knowledge.js`)
- **Online:** Gửi câu hỏi tới `POST /api/ai/chat` kèm timeout & retry có kiểm soát.
- **Offline / Fallback:** Truy vấn cục bộ `data/offline_knowledge_vi.json` (15 chủ đề sinh tồn Việt Nam có nguồn & ngày kiểm duyệt) với 0 request mạng; từ chối bịa đặt câu trả lời cho các truy vấn thời gian thực hoặc ngoài phạm vi.
