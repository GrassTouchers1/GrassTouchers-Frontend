# 🗺️ NORTHSTAR Frontend – Multi-Hazard GIS & Disaster Response PWA

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![OSI Approved](https://img.shields.io/badge/OSI-Approved%20Open%20Source-brightgreen.svg)](https://opensource.org/licenses)
[![Leaflet](https://img.shields.io/badge/Map-Leaflet.js-green.svg?logo=leaflet)](https://leafletjs.com/)
[![OpenStreetMap](https://img.shields.io/badge/Tiles-OpenStreetMap-brightgreen.svg)](https://www.openstreetmap.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Cache-purple.svg)](https://web.dev/progressive-web-apps/)
[![Web Speech API](https://img.shields.io/badge/Voice-W3C%20Web%20Speech-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

> **Giao diện Web PWA bản đồ số đa thiên tai, điều hành ứng phó khẩn cấp và dẫn đường cứu hộ (Kế thừa FloodNav).**  
> 100% Mã nguồn mở, hoạt động trực tiếp trên trình duyệt, hỗ trợ Service Worker caching ngoại tuyến và cảnh báo giọng nói tiếng Việt.

---

## ✨ 1. Tính năng nổi bật

- 🌍 **Bản đồ GIS Đa thiên tai Đa tầng (Multi-Hazard Layer Control):**
  - Tích hợp 4 lớp dữ liệu trực quan: **Trạm đo ngập IoT**, **Vùng thiên tai nguy hiểm** (lũ lụt, sạt lở, bão), **Điểm sơ tán an toàn**, và **Yêu cầu cứu trợ SOS**.
  - Phân loại màu sắc nguy cơ trực quan: Xanh (An toàn), Vàng (Cảnh báo), Đỏ/Cam (Nguy hiểm).
- 🚨 **Mô-đun Cứu hộ SOS & Điểm Trú ẩn (NorthStar Rescue Hub):**
  - **1-Click SOS Beacon:** Người dân phát tín hiệu cầu cứu khẩn cấp kèm tọa độ GPS thực địa, số điện thoại và số lượng người cần cứu trợ.
  - **Định tuyến Sơ tán Khẩn cấp:** 1 chạm tính toán lộ trình đi bộ hoặc xe máy né vùng nguy hiểm đến điểm trú ẩn còn sức chứa gần nhất.
- 🚗 **Dẫn đường so sánh thông minh (Dual-route View):**
  - Hiển thị song song 2 lộ trình: **Đường nhanh nhất** và **Đường an toàn né ngập/thiên tai**.
- 🔊 **Cảnh báo giọng nói tiếng Việt (W3C Web Speech API):**
  - Cảnh báo tức thì khi phương tiện tiếp cận vùng ngập sâu hoặc chướng ngại vật thiên tai mà không phụ thuộc cloud API.
- ⚡ **Theo dõi GPS & Re-routing thời gian thực (WebSocket):**
  - Kênh WebSocket hai chiều theo dõi GPS và nhận thông báo phát thanh cứu hộ khẩn cấp từ trung tâm chỉ huy.
- 📦 **PWA & Offline First:**
  - Tích hợp Service Worker (`sw.js`) và `manifest.json` tự động lưu bộ đệm các tài nguyên giao diện, cho phép mở bản đồ ngay cả khi mất sóng Internet tạm thời.


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
