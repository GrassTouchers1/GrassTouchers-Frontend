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

# KỊCH BẢN KIỂM THỬ END-TO-END (E2E) – NORTHSTAR CITIZEN (`CIT-14`)

**Ngày kiểm thử:** 2026-11-25  
**Tệp kiểm thử thực thi:** `tests/test_phase12_e2e_acceptance.py`, `tests/test_cit14_integration.py`, `tests/test_phase4_offline_sync.py`, `tests/test_phase10_ai_ux.py`.

---

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **E2E-01** | Theo dõi thiên tai bình thường | Backend `127.0.0.1:8000` & Frontend `127.0.0.1:3000` đang chạy. | 1. Mở `citizen.html` trên Edge Headless.<br>2. Xác định vị trí.<br>3. Kiểm tra thời tiết & cảnh báo.<br>4. Gọi `GET /api/shelters`. | Trang tải thành công, banner khẩn cấp hiển thị, dữ liệu thời tiết/cảnh báo có nguồn & timestamp, `/api/shelters` trả `200` kèm danh sách trạm. | Edge Headless render đầy đủ `citizen.html`, `/api/health` trả `200`, `/api/shelters` trả `200` với `>0` trạm trú ẩn. | **PASS** | Không |
| **E2E-02** | Người dân gửi SOS & tra cứu riêng tư | Vị trí đã xác nhận (`lat=21.0285, lng=105.8542`), online. | 1. Gửi `POST /api/sos` kèm `client_event_id`.<br>2. Kiểm tra phản hồi Backend.<br>3. Gọi `GET /api/sos/track/{tracking_token}`.<br>4. Thử gọi `GET /api/sos` với header `X-NorthStar-Client: citizen`. | `POST /api/sos` trả `201` có `id` thật & `tracking_token`; `/track/{token}` trả `200` không lộ SĐT/họ tên; `GET /api/sos` từ Citizen bị chặn `403`. | Đạt đúng toàn bộ; phát hiện lưu ý bảo mật: `GET /api/sos` không gửi header `X-NorthStar-Client: citizen` vẫn trả `200` do Command chưa có JWT. | **PASS** *(có ghi chú Command auth)* | Không (đã ghi nhận P1 cho giai đoạn sau) |
| **E2E-03** | Mất Internet, lưu SOS, reload & đồng bộ chống trùng | Đã mở `citizen.html` và precache SW; có `client_event_id` duy nhất. | 1. Ngắt mạng.<br>2. Tạo SOS lưu vào IndexedDB `sos_outbox`.<br>3. Reload trang `citizen.html`.<br>4. Bật mạng lại và đồng bộ.<br>5. Gửi lặp lại cùng `client_event_id` lên `POST /api/sos`. | Trang vẫn mở offline, SOS còn nguyên sau reload, đồng bộ lên Backend thành công và chỉ tồn tại đúng 1 hồ sơ (`id` trùng khớp). | `sos_outbox` giữ nguyên sau reload trên Edge Headless; gửi lặp `client_event_id` lên `127.0.0.1:8000` trả về đúng cùng `id` ban đầu. | **PASS** | Không |
| **E2E-04** | Định tuyến né ngập & sơ tán an toàn | Điểm xuất phát `(21.0285, 105.8542)`, điểm đến `(21.0333, 105.8500)`. | 1. Gọi `POST /api/route`.<br>2. Gọi `POST /api/route/evacuate`.<br>3. Kiểm tra phân loại an toàn & nhánh OSRM fallback. | Trả `200` kèm geometry tuyến đường; nếu fallback OSRM thì gắn `REFERENCE_ONLY` (không báo `"Né Ngập Thành Công"` giả). | `/api/route` và `/api/route/evacuate` đều trả `200`; `test_phase8_routing_evacuation.py` xác nhận không có thông báo an toàn giả. | **PASS** | Không |
| **E2E-05** | Trợ lý AI Online & Offline | Online -> Offline; đã cache `offline_knowledge_vi.json`. | 1. Gọi `POST /api/ai/chat` khi online.<br>2. Ngắt mạng.<br>3. Hỏi kiến thức ngập lụt/sơ tán.<br>4. Hỏi câu ngoài phạm vi. | Online trả `200`; Offline trả lời từ kho 15 chủ đề kèm nguồn & ngày kiểm duyệt; câu ngoài phạm vi không bịa đặt. | `POST /api/ai/chat` trả `200`; Offline trả lời từ `OfflineKnowledge`, 0 request mạng, từ chối bịa câu trả lời ngoài phạm vi. | **PASS** | Không |
