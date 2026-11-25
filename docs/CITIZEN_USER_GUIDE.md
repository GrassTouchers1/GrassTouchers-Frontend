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

# HƯỚNG DẪN SỬ DỤNG – NORTHSTAR CITIZEN (`citizen.html`)

## 1. Cài đặt (PWA) & Đăng nhập
- **Truy cập:** Mở `citizen.html` trên trình duyệt di động hoặc máy tính (`http://127.0.0.1:3000/citizen.html`).
- **Cài đặt lên màn hình chính (PWA):** Trên Chrome/Edge/Safari, chọn **"Cài đặt ứng dụng"** hoặc **"Thêm vào màn hình chính"** (`manifest-citizen.json`). Sau lần tải đầu tiên, ứng dụng có thể mở lại ngay cả khi mất Internet.
- **Đăng nhập:** Phân hệ Citizen **không bắt buộc đăng nhập tài khoản** để người dân gửi cứu nạn nhanh nhất trong tình huống khẩn cấp. Khi gửi SOS thành công, hệ thống cấp một **`tracking_token` riêng tư** để chỉ bạn tra cứu được tiến độ hồ sơ của mình.

## 2. Xem Thời tiết & Cảnh báo thiên tai
- Bảng Thời tiết hiển thị nhiệt độ, lượng mưa, **thời gian cập nhật** và **nguồn dữ liệu**. Khi mất mạng, ứng dụng hiển thị bản cache gần nhất từ `IndexedDB` kèm nhãn thời gian cũ.
- Bảng Cảnh báo phân tách rõ **Cảnh báo chính thức** với **Dự báo AI/ML** hoặc **Dữ liệu mô phỏng**.

## 3. Chọn vị trí & Gửi SOS khẩn cấp
1. **Xác định vị trí:** Nhấn nút lấy **GPS** (bản đồ hiển thị vòng tròn sai số) hoặc **chọn vị trí thủ công** trên bản đồ / nhập mô tả địa điểm khi mất GPS.
2. **Xác nhận vị trí:** Kiểm tra lại điểm ghim và xác nhận vị trí. Hệ thống **không bao giờ tự gửi tọa độ mặc định**.
3. **Gửi SOS:** Nhập họ tên, số điện thoại, số người cần cứu, mức độ khẩn cấp và nhấn Gửi SOS.
   - Nếu đang có mạng: nhận mã hồ sơ thật và `tracking_token` để theo dõi tại mục **Tra cứu SOS**.
   - Nếu mất mạng: SOS được lưu an toàn vào hàng đợi ngoại tuyến và tự động gửi khi có mạng lại.
4. **Trường hợp khẩn cấp tính mạng:** Luôn ưu tiên gọi trực tiếp **112 / 114 / 115** trên banner khẩn cấp `#citizen-emergency-banner`.

## 4. Tìm đường né ngập & Nơi sơ tán
- Chọn điểm xuất phát và điểm đến (hoặc chọn **Điểm trú ẩn** từ danh sách `/api/shelters`).
- Hệ thống ưu tiên thuật toán **A\*** kiểm tra lớp ngập từ Backend (`/api/route`, `/api/route/evacuate`).
- Luôn chú ý nhãn trạng thái tuyến: `SAFE_VERIFIED` (đã đối chiếu dữ liệu ngập) khác với `REFERENCE_ONLY` (tham khảo khi thiếu dữ liệu ngập hoặc dùng OSRM fallback) và `UNSAFE` / `UNAVAILABLE`.

## 5. Báo ngập cộng đồng
- Mở mục **Báo ngập**, chọn vị trí, mức độ ngập (`light` / `medium` / `heavy`), đính kèm ảnh hiện trường (`<= 5MB`, tùy chọn) và gửi.
- Báo cáo mới luôn mang nhãn **`[Chờ xác minh]`** cho đến khi điều phối viên kiểm chứng. Nếu mất mạng, báo cáo được lưu vào `IndexedDB` và tự động đồng bộ sau.

## 6. Trợ lý AI Online / Offline
- **Khi có mạng:** Hỏi đáp qua `/api/ai/chat`.
- **Khi mất mạng hoặc API lỗi:** Tự động chuyển sang **Kho tri thức sinh tồn ngoại tuyến (15 chủ đề tiếng Việt)** kèm nguồn và ngày kiểm duyệt. AI ngoại tuyến không trả lời các câu hỏi thời gian thực hoặc ngoài phạm vi kho tri thức.

## 7. Chế độ Offline & Trạng thái đồng bộ
- Thanh trạng thái hiển thị rõ **Online / Offline** và số lượng bản tin chờ đồng bộ (`PENDING`, `SENDING`, `RETRYING`, `ACKNOWLEDGED`, `FAILED`).
- Bạn có thể đóng hoặc tải lại trang khi offline; dữ liệu trong `northstar_citizen_db` vẫn được bảo toàn và tự động đồng bộ khi có Internet trở lại mà không tạo trùng hồ sơ.
