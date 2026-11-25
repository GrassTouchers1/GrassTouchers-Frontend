# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 11 – SOS RELAY, P2P & SATELLITE GATEWAY (`CIT-12`)

**Ngày cập nhật:** 2026-11-25  
**Phân hệ:** NORTHSTAR CITIZEN (`GrassTouchers-Frontend` & `GrassToucher-backend`, nhánh `thuan`)  
**Trạng thái nghiệm thu:** `COMPLETED` *(Đạt toàn bộ 15 kịch bản `RELAY-01..15` trên Edge Headless + WebCrypto + IndexedDB và kiểm thử Backend `/api/sos/relay`; ghi nhận rõ Web Bluetooth phần cứng & Gateway vệ tinh thật chưa có thiết bị vật lý).*

---

## 1. Các thành phần đã triển khai
- **[sos_relay.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/js/sos_relay.js)** (`SOSRelayManager`):
  - Chuẩn hóa gói tin `northstar.sos.relay.v1` với đầy đủ trường `message_id`, `client_event_id`, `origin_device_id`, `created_at`, `expires_at`, `location`, `location_source`, `payload` (ẩn danh SĐT `***XXXX`), `hop_count`, `max_hops`, `relay_history`, `integrity_metadata` (`SHA-256`), `authentication_metadata` (`ECDSA-P256`).
  - Hỗ trợ xuất/đọc chuỗi chia sẻ (`NORTHSTAR-RELAY-V1:...`), Web Share API / Clipboard, kiểm tra `expires_at`, `hop_count < max_hops`, chống giả mạo nội dung, chống trùng `client_event_id` và thăm dò Web Bluetooth (`probeWebBluetooth`) an toàn.
  - Ghi rõ đây là **chuyển tiếp thủ công**, không phải mạng mesh tự động.
- **[satellite_gateway_adapter.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/js/satellite_gateway_adapter.js)** (`SatelliteGatewayAdapter`):
  - Quản lý đủ 7 trạng thái `NOT_CONFIGURED`, `DISCONNECTED`, `CONNECTING`, `CONNECTED`, `TRANSMITTING`, `ACKNOWLEDGED`, `FAILED`.
  - Không bao giờ giả lập `CONNECTED` hoặc `ACKNOWLEDGED` khi chưa có thiết bị/SDK vệ tinh thật.
- **Backend `POST /api/sos/relay` ([sos.py](file:///d:/OpenSource_2026/GrassToucher-backend/app/routers/sos.py))**:
  - Kiểm tra `expires_at` (`410`), `hop_count <= max_hops` (`422`), và chống trùng theo `client_event_id`.
- **Precache & Tích hợp**: Đã thêm `sos_relay.js` và `satellite_gateway_adapter.js` vào [sw.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/sw.js) và [citizen.html](file:///d:/OpenSource_2026/GrassTouchers-Frontend/citizen.html).

---

## 2. Kết quả kiểm thử
- Frontend ([test_phase11_relay_satellite.py](file:///d:/OpenSource_2026/GrassTouchers-Frontend/tests/test_phase11_relay_satellite.py)): `RELAY-01..15` **PASS** (Web Bluetooth permission denial & Satellite Gateway không kết nối được kiểm thử bằng simulation trung thực).
- Backend ([test_phase11_relay_backend.py](file:///d:/OpenSource_2026/GrassToucher-backend/tests/test_phase11_relay_backend.py)): **PASS**.
