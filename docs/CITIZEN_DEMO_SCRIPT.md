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

# KỊCH BẢN TRÌNH DIỄN OLP 2026 – NORTHSTAR CITIZEN (7–10 PHÚT)

**Nguyên tắc trình diễn:** Chỉ trình diễn các chức năng hoạt động thực tế; minh bạch nguồn dữ liệu, chế độ SQLite fallback vs PostgreSQL, và không giới thiệu tính năng mô phỏng phần cứng như phần cứng thật.

---

## Chuẩn bị trước giờ trình diễn
1. Khởi chạy Backend: `run_backend.bat` (cổng `8000`).
2. Khởi chạy Frontend: `run_frontend.bat` hoặc `python -m http.server 3000` (cổng `3000`).
3. Mở 2 tab trình duyệt Edge/Chrome:
   - Tab 1: `http://127.0.0.1:3000/citizen.html` (NORTHSTAR Citizen PWA).
   - Tab 2: `http://127.0.0.1:3000/index.html` (NORTHSTAR Command).
4. **Phương án dự phòng (Backup Plan):** Nếu Wi-Fi hội trường mất kết nối ra Internet (Open-Meteo / Groq / Map tiles), Service Worker và IndexedDB vẫn phục vụ `citizen.html`, kho tri thức AI offline 15 chủ đề, và Backend cục bộ `127.0.0.1:8000` vẫn nhận SOS, định tuyến A* cục bộ (`hanoi_drive.graphml`) bình thường.

---

## Trình tự trình diễn (9 phút)

1. **0:00 – 0:45 | Giới thiệu Citizen & Kiến trúc Offline-First:** Mở `citizen.html`, chỉ ra banner khẩn cấp `#citizen-emergency-banner`, thanh trạng thái mạng & hàng đợi đồng bộ IndexedDB (`northstar_citizen_db`).
2. **0:45 – 1:30 | Xem Thời tiết & Cảnh báo thiên tai:** Hiển thị dữ liệu thời tiết kèm timestamp & nguồn dữ liệu; phân biệt rõ cảnh báo chính thức với dự báo AI/ML.
3. **1:30 – 2:15 | Xác định vị trí GPS / Ghim bản đồ:** Bấm nút định vị GPS (hoặc chọn vị trí thủ công trên MapLibre), chỉ ra vòng tròn sai số và bước xác nhận vị trí bắt buộc (không gửi tọa độ mặc định).
4. **2:15 – 3:15 | Gửi SOS Online & Tra cứu riêng tư:** Gửi tín hiệu SOS -> Backend trả mã hồ sơ thật + `tracking_token` -> tra cứu bằng `trackTicket()` không lộ PII.
5. **3:15 – 4:00 | Command tiếp nhận SOS:** Chuyển sang Tab 2 (`index.html`), xác nhận yêu cầu SOS vừa gửi xuất hiện trên bản đồ điều phối Command.
6. **4:00 – 5:00 | Tắt Internet & Tạo SOS Ngoại tuyến:** Bật chế độ Offline trong DevTools -> tạo SOS mới -> SOS lưu vào IndexedDB `sos_outbox` (`PENDING`) -> Reload trang `citizen.html` (PWA mở được nhờ Service Worker, bản ghi SOS vẫn còn).
7. **5:00 – 6:00 | Khôi phục mạng & Đồng bộ chống trùng:** Tắt chế độ Offline -> `OfflineSyncManager` tự động đồng bộ lên Backend bằng `client_event_id` -> Command chỉ nhận đúng 1 hồ sơ duy nhất.
8. **6:00 – 7:15 | Định tuyến né ngập A* & Tìm nơi sơ tán:** Chọn điểm đến / điểm trú ẩn từ `/api/shelters`, chạy định tuyến né ngập (`/api/route/evacuate`), chỉ ra phân loại `SAFE_VERIFIED` vs `REFERENCE_ONLY` (không gắn nhãn an toàn giả).
9. **7:15 – 8:15 | Trợ lý AI Ngoại tuyến:** Trong trạng thái Offline, hỏi về kỹ năng sơ tán ngập lụt -> trả lời tức thì từ `offline_knowledge_vi.json` kèm nguồn & ngày kiểm duyệt; hỏi câu ngoài phạm vi (ví dụ thời tiết/tỉ số hiện tại) -> AI từ chối bịa đặt.
10. **8:15 – 9:00 | Diễn tập Chuyển tiếp SOS `A -> B -> C` (`northstar.sos.relay.v1`):** Xuất gói tin SOS ký số `ECDSA-P256` + `SHA-256` từ thiết bị A mất mạng, chuyển qua B, đẩy qua C lên `POST /api/sos/relay` chống trùng; trình bày trung thực giới hạn chưa có phần cứng BLE Mesh / vệ tinh vật lý.
