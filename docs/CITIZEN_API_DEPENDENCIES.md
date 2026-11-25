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

# PHỤ THUỘC API GIỮA CITIZEN FRONTEND VÀ BACKEND

Tài liệu đối chiếu các API mà phân hệ NORTHSTAR CITIZEN gọi tới Backend (`GrassToucher-backend`) và dịch vụ bên ngoài.

---

## 1. Bảng Đối chiếu API Hiện có

| Chức năng Citizen | Endpoint | Method | Trạng thái Backend | Hiện trạng tích hợp trên Citizen |
| :--- | :--- | :--- | :--- | :--- |
| Thời tiết Hà Nội | `/api/weather/hanoi` | `GET` | Đã có (`weather.py`) | `citizen_portal.js` đang gọi trực tiếp Open-Meteo thay vì đi qua Backend. |
| Cảnh báo thiên tai | `/api/disasters` | `GET` | Đã có (`disasters.py`) | Đã gọi, nhưng khi lỗi lại tạo dữ liệu giả với thời gian hiện tại (cần sửa). |
| Điểm ngập chính thức | `/api/flood-points` | `GET` | Đã có (`flood_points.py`) | Đang gọi cứng `http://127.0.0.1:8000/api/flood-points` trong `citizen.html`. |
| Dự báo ngập AI 30p/60p | `/api/predictions` | `GET` | Đã có (`prediction.py`) | Đang gọi cứng `http://127.0.0.1:8000/api/predictions` trong `citizen.html`. |
| Gửi tín hiệu SOS | `/api/sos` | `POST` | Đã có (`sos.py`) | Đã gọi qua `getApiUrl()`, nhưng thiếu `client_event_id` chống trùng khi retry. |
| Tra cứu trạng thái SOS | `/api/sos` (hiện tại) | `GET` | Trả toàn bộ danh sách SOS | **Rủi ro riêng tư**; `trackTicket()` trong `citizen.html` hiện chưa gọi API này mà trả kết quả giả. |
| Báo ngập cộng đồng | `/api/reports` | `GET`, `POST` | Đã có (`reports.py`) | Đang gọi cứng `http://127.0.0.1:8000/api/reports`; thiếu `client_event_id` và auto-sync offline. |
| Tìm đường né ngập A* | `/api/route` | `POST` | Đã có (`route.py`) | Đang gọi cứng `http://127.0.0.1:8000/api/route`; fallback OSRM đang báo nhầm là "Né Ngập Thành Công". |
| Điểm sơ tán an toàn | `/api/shelters` | `GET` | Đã có (`shelters.py`) | `citizen.html` đang dùng danh sách mẫu cứng `renderSampleShelters()` thay vì gọi API này. |
| Tìm đường sơ tán khẩn cấp | `/api/route/evacuate` | `POST` | Đã có (`evacuation.py`) | Có hàm trong `rescue_manager.js` (dùng Leaflet), chưa gắn vào UI MapLibre của `citizen.html`. |
| Trợ lý AI trực tuyến | `/api/ai/chat`, `/api/ai/status` | `POST`, `GET` | Đã có (`ai_assistant.py`) | Đã kết nối từ `js/ai_assistant.js`. |
| Kênh thời gian thực | `/ws/navigation` | `WS` | Đã có (`websocket_nav.py`) | Kết nối trong `rescue_manager.js`. |
| Vệ tinh viễn thám | `/api/satellite/...` | `GET` | Đã có (`satellite.py`) | Chỉ là dữ liệu polygon SAR Sentinel-1; **chưa có** API gateway gửi/nhận tin nhắn SOS qua vệ tinh. |

---

## 2. Các API Backend cần Bổ sung / Mở rộng (theo Kế hoạch 12 Giai đoạn)

1. **`GET /api/sos/track/{ticket_id}`** (Giai đoạn 9):
   - Tham số query xác thực nhẹ (ví dụ `phone_last4` hoặc `track_token`).
   - Chỉ trả về trạng thái xử lý, thời gian cập nhật, đơn vị tiếp nhận (không trả danh sách hồ sơ của nạn nhân khác).
2. **Hỗ trợ `client_event_id` (Idempotency) ở `POST /api/sos` và `POST /api/reports`** (Giai đoạn 4 & 7):
   - Kiểm tra trùng `client_event_id` trong DB/Fallback SQLite để chống tạo trùng bản ghi khi client retry đồng bộ.
3. **Hỗ trợ đánh dấu chuyển tiếp SOS (`relay_metadata`) ở `POST /api/sos`** (Giai đoạn 11):
   - Ghi nhận rõ `relayed_by` / `relay_channel` khi một thiết bị khác chuyển tiếp hộ gói tin SOS.
4. **Satellite Gateway Extension Interface** (Giai đoạn 11):
   - Chưa có phần cứng vệ tinh thực tế; chỉ định nghĩa contract chuẩn bị mở rộng và báo rõ giới hạn thiết bị.
