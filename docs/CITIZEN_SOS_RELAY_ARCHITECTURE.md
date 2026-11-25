# KIẾN TRÚC SOS RELAY THỦ CÔNG (P2P PWA)

**Luồng:** `Điện thoại A (mất Internet)` → `Xuất gói NORTHSTAR-RELAY-V1 (Web Share / Copy / QR)` → `Thiết bị trung gian B (xác minh SHA-256 + ECDSA-P256, tăng hop_count)` → `POST /api/sos/relay` → `Backend NORTHSTAR`

- **Giao thức:** JSON + Base64URL (`NORTHSTAR-RELAY-V1:...`), HTTPS tới Backend khi thiết bị B có mạng.
- **Thiết bị cần có:** Hai điện thoại có trình duyệt hỗ trợ PWA/WebCrypto.
- **Giới hạn:** Là chuyển tiếp thủ công từng chặng, không phải mạng mesh tự động; tối đa `max_hops = 3`, thời hạn `6 giờ`.
- **Xác nhận & Chống trùng:** Backend chống trùng theo `client_event_id` gốc và trả `idempotent_replay: true` nếu gói gốc đã được đồng bộ trước đó.
