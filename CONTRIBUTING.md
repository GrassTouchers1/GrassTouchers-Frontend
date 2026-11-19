# Quy định Đóng góp Mã Nguồn Mở (Contributing Guidelines)

Dự án **NORTHSTAR / GrassTouchers** là hệ thống cứu hộ thiên tai mã nguồn mở được phát hành theo giấy phép **Apache License 2.0 (OSI-Approved)**.

---

## 📜 1. Tiêu chí Mã Nguồn Mở & Trải nghiệm Người dùng
- Giao diện thân thiện, responsive di động, hỗ trợ PWA offline.
- Tận dụng các công nghệ mở chuẩn W3C: **OpenStreetMap tiles**, **Leaflet.js**, **Web Speech Synthesis API** (không phụ thuộc dịch vụ Cloud TTS trả phí).
- Không nhúng mã theo dõi (analytics/tracking) hoặc khóa bản quyền thương mại.

---

## 🛠️ 2. Quy trình Phát triển & Đóng góp
1. **Fork & Clone:**
   ```bash
   git clone https://github.com/GrassTouchers1/GrassTouchers-Frontend.git
   cd GrassTouchers-Frontend
   ```
2. **Khởi chạy máy chủ Web tĩnh:**
   ```bash
   python -m http.server 3000
   ```
3. Mở trình duyệt tại `http://localhost:3000`.
4. Tạo nhánh phát triển tính năng: `git checkout -b feature/ten-tinh-nang`.
5. Tạo Pull Request (PR) mô tả rõ mục đích, đính kèm ảnh chụp màn hình kiểm thử.

---

## 🐛 3. Hệ thống Quản lý Lỗi Phần mềm (Bug Tracker)
Dự án sử dụng chính thức **GitHub Issues** làm hệ thống quản lý lỗi phần mềm (Bug Tracker) công khai và minh bạch:
- 🔗 **Kho quản lý lỗi:** [https://github.com/GrassTouchers1/GrassTouchers-Frontend/issues](https://github.com/GrassTouchers1/GrassTouchers-Frontend/issues)
- Khi phát hiện sự cố, lỗi hiển thị hoặc lỗi kết nối, vui lòng tạo một Issue mới theo mẫu **Bug Report** có sẵn trong thư mục `.github/ISSUE_TEMPLATE/bug_report.md`.
- Đối với ý tưởng mới hoặc yêu cầu bổ sung tính năng, vui lòng tạo Issue theo mẫu **Feature Request**.
- Đội ngũ bảo trì cam kết phản hồi và phân loại nhãn (labels: `bug`, `enhancement`, `documentation`) trong vòng 24 giờ.
