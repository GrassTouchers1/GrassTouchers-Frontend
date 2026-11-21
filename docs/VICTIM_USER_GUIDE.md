<!--
Copyright 2026 GrassTouchers Team

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# HƯỚNG DẪN SỬ DỤNG PHÂN HỆ DÂN SỰ & CỨU NẠN CỘNG ĐỒNG (VICTIM PORTAL)
## DỰ ÁN NORTHSTAR – OLYMPIC TIN HỌC SINH VIÊN VIỆT NAM 2026 (KHỐI PHẦN MỀM NGUỒN MỞ)

---

## 1. TỔNG QUAN VỀ PHÂN HỆ NGƯỜI DÂN (VICTIM PORTAL)
Phân hệ **Người dân / Nạn nhân (Victim Portal)** là thành phần cốt lõi của hệ sinh thái phần mềm cứu nạn khẩn cấp **NORTHSTAR**. Được thiết kế theo triết lý **Mobile-First Responsive** và chuẩn **Progressive Web App (PWA)**, cổng thông tin mang đến cho người dân trải nghiệm tối ưu, thao tác 1-chạm đơn giản ngay trên trình duyệt điện thoại di động mà không cần cài đặt ứng dụng phức tạp.

- **Đường dẫn truy cập trực tiếp:** `http://localhost:3000/citizen.html` (hoặc thông qua nút chuyển đổi nhanh trên thanh điều hướng Command COP).
- **Phân định độc lập:** Tách biệt hoàn toàn khỏi Bảng điều hành tác chiến Chỉ huy (`index.html`), bảo vệ luồng chỉ huy nghiệp vụ và tối ưu hóa băng thông mạng cho người dân vùng bão lũ.
- **Tiêu chuẩn mã nguồn mở:** 100% tuân thủ giấy phép **Apache-2.0**, sử dụng bản đồ mở OpenStreetMap và API dữ liệu mở.

```
+-------------------------------------------------------------------------+
|                  NORTHSTAR CITIZEN PORTAL (citizen.html)                |
+-------------------------------------------------------------------------+
| [Thời Tiết & Báo Động] [Ghim Tọa Độ & SOS] [Tra Cứu] [Báo Ngập Cộng Đồng] |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          | (Khi có kết nối mạng)                             | (Khi mất mạng)
          v                                                   v
+------------------------+                        +-----------------------+
| FastAPI Server (:8000) |                        | Offline Queue Manager |
| POST /api/sos          |                        | IndexedDB/LocalCache  |
| Mã: #SOS-2026-XXXX     |                        | Gán nhãn [Ngoại tuyến]|
+------------------------+                        +-----------------------+
```

---

## 2. HƯỚNG DẪN CHI TIẾT CÁC TÍNH NĂNG CHÍNH

### 2.1. Xem Thời Tiết Thường Ngày & Cảnh Báo Thiên Tai Thời Gian Thực (VIC-02, VIC-03, V-01)
- **Mục tiêu:** Cung cấp thông tin dự báo thời tiết 24h và các bản tin khẩn cấp từ Trung tâm Dự báo KTTV Quốc gia (NCHMF) cùng Open-Meteo.
- **Cách sử dụng:**
  1. Mở Cổng Dân sự `citizen.html`, chọn Tab **"Thời Tiết"**.
  2. Bảng chỉ số hiển thị tức thì nhiệt độ (°C), lượng mưa hiện hành (mm/h), độ ẩm (%) và tốc độ gió (km/h).
  3. Danh sách **"Bản Tin Cảnh Báo Thiên Tai Hiện Hành"** hiển thị các đợt lũ quét, ngập lụt đô thị và tình hình xả lũ của các hồ thủy điện (Hòa Bình, Tuyên Quang).
  4. Người dân theo dõi trực quan cấp độ rủi ro (Bình thường / Cảnh báo / Khẩn cấp).

### 2.2. Ghim & Xác Nhận Tọa Độ Hiện Trường Tương Tác (VIC-04, V-04)
- **Mục tiêu:** Khắc phục triệt để tình trạng lệch tọa độ GPS trong điều kiện mưa bão hoặc nhà cao tầng che khuất sóng vệ tinh.
- **Cách sử dụng:**
  1. Chuyển sang Tab **"Gửi SOS"**.
  2. Nhấp nút **"📍 Tự lấy vị trí GPS"**: Trình duyệt yêu cầu cấp quyền và lấy tọa độ chính xác nhất, đồng thời hiển thị vòng tròn sai số (Accuracy Circle).
  3. **Ghim tương tác:** Người dân có thể kéo thả ghim màu đỏ hoặc bấm trực tiếp trên bản đồ để điều chỉnh vị trí chính xác đến từng nóc nhà.
  4. Hệ thống phát tín hiệu rung xúc giác nhẹ (**Haptic Feedback**) và bật thanh điều khiển nổi *"Đang chọn vị trí cứu hộ"* trên bản đồ.
  5. Bấm **"Xác Nhận Vị Trí Này"** trên thanh nổi để chốt tọa độ vào biểu mẫu cứu nạn.

### 2.3. Gửi Yêu Cầu Cứu Nạn Khẩn Cấp (SOS Beacon) & Cơ Chế Ngoại Tuyến (VIC-05, VIC-07, V-02, V-03)
- **Mục tiêu:** Cho phép người dân gửi báo động cứu nạn kèm thông tin chi tiết (số người, người già, trẻ nhỏ, độ sâu nước ngập).
- **Cách sử dụng:**
  1. Điền thông tin người liên hệ: Họ tên, Số điện thoại.
  2. Nhập số người đang mắc kẹt và tích chọn nếu có người già/trẻ em/người bệnh.
  3. Chọn mức ngập hiện tại: Dưới 0.5m / Từ 0.5m - 1.5m / Trên 1.5m (ngập nóc nhà).
  4. Nhấn nút **"GỬI YÊU CẦU CỨU NẠN KHẨN CẤP"**:
     - **Trường hợp Trực tuyến (Online):** Dữ liệu gửi trực tiếp tới máy chủ Chỉ huy qua `POST /api/sos`. Hệ thống trả về mã hồ sơ chính thức `#SOS-2026-XXXX`.
     - **Trường hợp Ngoại tuyến (Offline):** Nếu mất sóng di động, module `offline_sync_manager.js` tự động lưu trữ yêu cầu vào bộ nhớ máy, cấp mã tạm `#SOS-2026-PENDING-OFFLINE` kèm gắn nhãn `[Chờ kết nối]`. Khi có mạng trở lại, hệ thống tự động đẩy lên máy chủ mà không làm mất thông tin.

### 2.4. Tra Cứu Tiến Độ Cứu Hộ Bằng Mã Hồ Sơ (VIC-05, V-02, V-03)
- **Mục tiêu:** Giảm bớt sự hoang mang cho người dân bằng cách cho phép theo dõi trực quan vị trí và trạng thái lực lượng ứng cứu.
- **Cách sử dụng:**
  1. Chuyển sang Tab **"Tra Cứu"**.
  2. Nhập mã hồ sơ (ví dụ: `#SOS-2026-0001` hoặc mã được lưu tự động sau khi gửi).
  3. Hệ thống hiển thị thanh tiến trình 4 giai đoạn rõ ràng:
     - **Tiếp nhận:** Yêu cầu đã ghi nhận vào cơ sở dữ liệu tác chiến.
     - **Xác minh:** Ban chỉ huy đã liên hệ và phân loại mức độ khẩn cấp.
     - **Điều phối:** Đội xuồng ca nô cứu hộ đang trên đường tiếp cận.
     - **Hoàn thành:** Nạn nhân đã được sơ tán an toàn về trạm tạm trú.

### 2.5. Báo Ngập Cộng Đồng Kèm Gắn Nhãn [Chờ Xác Minh] (VIC-06)
- **Mục tiêu:** Phát huy sức mạnh cộng đồng (Crowdsourcing) trong việc cảnh báo các điểm nước sâu, nắp cống hở, sạt lở đường xá.
- **Cách sử dụng:**
  1. Chuyển sang Tab **"Báo Ngập"**.
  2. Nhập vị trí đường ngập và bấm nút GPS để tự động điền kinh độ/vĩ độ.
  3. Chọn mức nước ước lượng (Ngập nhẹ 10-20cm, Ngập sâu 25-40cm, Ngập nguy hiểm >50cm).
  4. Nhập mô tả thực địa (nước chảy xiết, trôi xe, cây gãy đổ).
  5. Bấm **"Gửi Báo Cáo Điểm Ngập"**: Điểm báo lập tức xuất hiện trên bản đồ dân sự với biểu tượng ⚠️ màu vàng hổ phách và nhãn `[Chờ xác minh]` theo đúng quy chuẩn an toàn thông tin.

---

## 3. HƯỚNG DẪN KIỂM THỬ LIÊN THÔNG TỰ ĐỘNG (VIC-08 & SYS-02)

Dự án cung cấp bộ kịch bản kiểm thử tích hợp tự động hoàn chỉnh tại `tests/test_citizen_workflow.py`.

### 3.1. Chạy Kiểm Thử
Mở cửa sổ dòng lệnh tại thư mục gốc `GrassTouchers-Frontend` và chạy lệnh:
```bash
python -m unittest tests/test_citizen_workflow.py
```

### 3.2. Tiêu Chí Đánh Giá Thành Công (Acceptance Criteria)
- `test_01_weather_and_hazard_alerts`: Kiểm tra API Open-Meteo và NCHMF phản hồi trạng thái 200 kèm danh sách dự báo.
- `test_02_submit_sos_beacon_with_ticket`: Kiểm tra tạo hồ sơ SOS và xác thực sinh mã chuẩn `#SOS-2026-XXXX`.
- `test_03_track_sos_ticket_progress`: Kiểm tra tra cứu hành trình tiến độ hồ sơ từ máy chủ.
- `test_04_crowdsourced_flood_report`: Kiểm tra gửi báo ngập cộng đồng kèm trạng thái xác thực.
- `test_05_reports_geojson_layer_rendering`: Kiểm tra chuyển đổi và kết xuất điểm báo ngập chuẩn GeoJSON FeatureCollection.
- `test_06_offline_first_storage_schema`: Kiểm tra khả năng đóng gói JSON ngoại tuyến an toàn khi ngắt mạng.

---

## 4. TUÂN THỦ QUY CHẾ OLYMPIC TIN HỌC PMNM 2026
1. **Bản quyền mã nguồn mở:** Tất cả các tệp mã nguồn HTML, JS, CSS, Python đều chứa tiêu đề bản quyền chuẩn **Apache License Version 2.0**.
2. **Không có đường dẫn cục bộ:** Mọi tham chiếu tài nguyên, API đều sử dụng đường dẫn tương đối hoặc cổng dịch vụ tiêu chuẩn (`/api/...`, `http://127.0.0.1:8000`), không sử dụng đường dẫn cứng ổ đĩa (`C:\...` hoặc `D:\...`).
3. **Thư viện mã nguồn mở 100%:**
   - **Leaflet.js:** Bản đồ tương tác Web GIS (Giấy phép BSD 2-Clause).
   - **OpenStreetMap / OSM France:** Nguồn dữ liệu bản đồ nền mở không yêu cầu khóa thương mại (ODbL / CC-BY-SA).
   - **Open-Meteo:** API thời tiết mã nguồn mở (CC-BY 4.0).
   - **Lucide Icons:** Bộ biểu tượng giao diện mở hiện đại (Giấy phép ISC).
   - **Tailwind CSS:** Khung giao diện tiện ích mở (Giấy phép MIT).
