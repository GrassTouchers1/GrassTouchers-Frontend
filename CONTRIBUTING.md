# Quy định Đóng góp Mã Nguồn Mở (Contributing Guidelines)

Dự án **GrassTouchers Frontend** là ứng dụng Web PWA bản đồ thông minh mã nguồn mở được phát hành theo giấy phép **Apache License 2.0 (OSI-Approved)**.

---

## 📜 1. Tiêu chí Mã Nguồn Mở & Trải nghiệm Người dùng
- Giao diện thân thiện, responsive di động, hỗ trợ PWA offline.
- Tận dụng các công nghệ mở chuẩn W3C: **OpenStreetMap tiles**, **Leaflet.js**, **Web Speech Synthesis API** (không phụ thuộc dịch vụ Cloud TTS trả phí).
- Không nhúng mã theo dõi (analytics/tracking) hoặc khóa bản quyền thương mại.

---

## 🛠️ 2. Quy trình Phát triển

1. **Fork & Clone:**
   ```bash
   git clone https://github.com/GrassTouchers1/GrassTouchers-Frontend.git
   cd GrassTouchers-Frontend
   ```
2. **Khởi chạy máy chủ Web tĩnh:**
   - Dùng Python:
     ```bash
     python -m http.server 3000
     ```
   - Hoặc dùng Node.js:
     ```bash
     npx serve -l 3000 .
     ```
3. Mở trình duyệt tại `http://localhost:3000`.
4. Đảm bảo backend `GrassToucher-backend` đang chạy tại `http://localhost:8000` để các API và WebSocket hoạt động trơn tru.
5. Tạo Pull Request mô tả chi tiết các cải tiến UI/UX hoặc tính năng mới.
