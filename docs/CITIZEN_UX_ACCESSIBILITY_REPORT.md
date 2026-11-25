# BÁO CÁO UX & KHẢ NĂNG TIẾP CẬN (ACCESSIBILITY) NORTHSTAR CITIZEN

1. **Zoom & Viewport**: Đã loại bỏ `user-scalable=no` và `maximum-scale=1.0` trong `citizen.html`, cho phép người dùng phóng to nội dung trên thiết bị di động.
2. **Truy cập khẩn cấp 1 chạm**: Bổ sung `#citizen-emergency-banner` ngay trên thanh điều hướng tab với nút `[SOS] GỬI CỨU HỘ KHẨN CẤP` và `GỌI 112` (`href="tel:112"`), không phụ thuộc chỉ màu sắc.
3. **Trình đọc màn hình & Bàn phím**: Bổ sung `role="region"`, `role="status"`, `aria-live="polite"`, `aria-label` cho các nút khẩn cấp và trợ lý AI; hỗ trợ phím `Escape` đóng panel AI.
4. **Responsive**: Kiểm tra hiển thị trên khung nhỏ `320px` không tràn ngang (`scrollWidth <= 325`) và không che khuất nút khẩn cấp.
5. **Điểm trú ẩn & Người yếu thế**: Hiển thị trung thực trạng thái/sức chứa từ Backend và ghi rõ khi chưa có dữ liệu đánh giá tiếp cận cho người khuyết tật/trẻ nhỏ/người cao tuổi.
