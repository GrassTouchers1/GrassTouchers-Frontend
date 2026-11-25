# KIẾN TRÚC SATELLITE GATEWAY ADAPTER (MỞ RỘNG PHẦN CỨNG)

**Luồng:** `Điện thoại Citizen` → `SatelliteGatewayAdapter (SDK/BLE/Serial Bridge)` → `Gateway vệ tinh phần cứng chuyên dụng` → `Mạng vệ tinh (Iridium / Globalstar / NTN)` → `Backend NORTHSTAR`

- **Trạng thái adapter:** `NOT_CONFIGURED` → `DISCONNECTED` → `CONNECTING` → `CONNECTED` → `TRANSMITTING` → `ACKNOWLEDGED` / `FAILED`.
- **Điều kiện triển khai:** Cần phần cứng Gateway/modem vệ tinh ngoài hoặc thiết bị hỗ trợ 3GPP NTN + thuê bao dịch vụ vệ tinh của nhà cung cấp.
- **Nguyên tắc trung thực:** Trình duyệt PWA phổ thông không thể tự phát sóng vệ tinh; adapter giữ `NOT_CONFIGURED` hoặc `FAILED` nếu không có thiết bị kết nối thật.
