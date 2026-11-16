# 🗺️ GrassTouchers Frontend – Interactive Smart Flood Map & PWA Navigation

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![OSI Approved](https://img.shields.io/badge/OSI-Approved%20Open%20Source-brightgreen.svg)](https://opensource.org/licenses)
[![Leaflet](https://img.shields.io/badge/Map-Leaflet.js-green.svg?logo=leaflet)](https://leafletjs.com/)
[![OpenStreetMap](https://img.shields.io/badge/Tiles-OpenStreetMap-brightgreen.svg)](https://www.openstreetmap.org/)
[![Web Speech API](https://img.shields.io/badge/Voice-W3C%20Web%20Speech-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
[![PWA Ready](https://img.shields.io/badge/PWA-Mobile%20First-purple.svg)](https://web.dev/progressive-web-apps/)

> **Giao diện Web PWA bản đồ thông minh cảnh báo và dẫn đường tránh điểm ngập lụt Hà Nội.**  
> 100% Mã nguồn mở, hoạt động trực tiếp trên trình duyệt, tích hợp cảnh báo giọng nói tiếng Việt offline.

---

## ✨ 1. Tính năng nổi bật

- 📍 **Bản đồ tương tác OpenStreetMap (Leaflet.js):**
  - Hiển thị trực quan 130 trạm quan trắc và điểm ngập cục bộ tại Hà Nội.
  - Phân loại màu sắc trực quan: **Xanh** (An toàn $<5\text{cm}$), **Vàng** (Cảnh báo $5-20\text{cm}$), **Đỏ** (Nguy hiểm $\ge 20\text{cm}$).
- 🚗 **Dẫn đường so sánh thông minh (Dual-route View):**
  - Hiển thị song song 2 lộ trình: **Đường nhanh nhất** (màu xám/đỏ khi gặp ngập) và **Đường an toàn né ngập** (màu xanh lá).
- 🔊 **Cảnh báo giọng nói tiếng Việt (W3C Web Speech API):**
  - Cảnh báo tức thì khi phương tiện sắp đi vào vùng ngập sâu: *"Đã phát hiện điểm ngập phía trước. Hệ thống đã tự động đổi lộ trình an toàn."*
  - Chạy 100% trên trình duyệt client, không tốn phí, không phụ thuộc Google Cloud TTS.
- ⚡ **Theo dõi GPS & Re-routing thời gian thực (WebSocket):**
  - Kết nối liên tục với backend, tự động đổi hướng đi ngay khi cảm biến phía trước báo nước dâng cao.
- 🌧️ **Giả lập mưa bão & Xe chạy (Simulator Suite):**
  - Tích hợp bảng điều khiển giả lập mưa bão dồn dập (15–60 phút) để kiểm tra khả năng ứng biến của lộ trình.
  - Mô phỏng xe chạy GPS dọc theo tuyến đường để trải nghiệm như đang lái xe thực tế.

---

## 🚀 2. Hướng dẫn Khởi chạy

### Cách 1: Sử dụng Python tích hợp (Đơn giản nhất)
Mở terminal tại thư mục này và gõ:
```bash
python -m http.server 3000
```
Sau đó mở trình duyệt truy cập: **[http://localhost:3000](http://localhost:3000)**

### Cách 2: Sử dụng Node.js / npx
```bash
npx serve -l 3000 .
```

### Cách 3: Dùng extension "Live Server" trong VS Code
Nhấp chuột phải vào file [index.html](index.html) và chọn **"Open with Live Server"**.

---

## ⚙️ 3. Cấu hình Kết nối Backend

File cấu hình đặt tại [js/config.js](js/config.js):
```javascript
const GRASSTOUCHER_CONFIG = {
    API_BASE_URL: "http://localhost:8000",
    WS_BASE_URL: "ws://localhost:8000/ws/navigation"
};
```
Khi triển khai lên server production, bạn chỉ cần thay đổi địa chỉ domain tại file này.

---

## 📄 4. Giấy phép Bản quyền (License)
Phát hành theo giấy phép **Apache License 2.0 (OSI-Approved)**. Xem chi tiết tại [LICENSE](LICENSE).  
Quy định đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md).
