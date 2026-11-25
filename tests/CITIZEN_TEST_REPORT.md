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

# BÁO CÁO KIỂM THỬ CHI TIẾT CITIZEN & TÍCH HỢP BACKEND (`CIT-14`)

**Ngày thực hiện:** 2026-11-25  
**Môi trường thực thi:** Frontend `127.0.0.1:3000`, Backend `127.0.0.1:8000` (SQLite fallback), Microsoft Edge Headless.

---

## Nhóm A: GPS

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **GPS-01** | GPS hoạt động | Trình duyệt cấp quyền Geolocation; tọa độ `(21.0285, 105.8542)`, accuracy `12m`. | Mở `citizen.html`, kích hoạt lấy GPS qua `CitizenPortal`. | Cập nhật `coordSource='gps'`, vẽ vòng tròn sai số MapLibre, hiển thị sai số `±12m`. | `coordSource='gps'`, vòng tròn sai số MapLibre hiển thị đúng bán kính thực. | **PASS** | Không |
| **GPS-02** | GPS bị từ chối | Geolocation trả lỗi `PERMISSION_DENIED` (code `1`). | Gọi định vị GPS khi quyền bị từ chối. | Báo lỗi rõ ràng, không fallback tọa độ mặc định, gợi ý chọn vị trí thủ công. | Hiển thị hướng dẫn chuyển sang chọn tay; `coordSource` giữ `'none'`. | **PASS** | Không |
| **GPS-03** | GPS timeout | Geolocation trả lỗi `TIMEOUT` (code `3`). | Gọi định vị GPS và mô phỏng timeout. | Hủy trạng thái chờ, không điền tọa độ giả. | Thông báo timeout, tọa độ vẫn `null`. | **PASS** | Không |
| **GPS-04** | Tọa độ không hợp lệ | Nhập `lat=999` hoặc `lat=NaN, lng=105.85`. | Kiểm tra validate đầu vào trên Frontend & `POST /api/sos`. | Chặn gửi trên Frontend; Backend trả `HTTP 422`. | Frontend chặn, Backend trả `HTTP 422`. | **PASS** | Không |
| **GPS-05** | Vị trí thủ công | Không có GPS, người dùng ghim bản đồ hoặc nhập mô tả địa điểm. | Chọn ghim thủ công hoặc nhập địa chỉ, tích xác nhận vị trí. | Cho phép `coordSource='manual_pin'` / `'manual_input'` với `locationConfirmed=true`. | Lưu đúng metadata vị trí thủ công và cho phép gửi SOS. | **PASS** | Không |
| **GPS-06** | Thay đổi vị trí sau xác nhận | Đã xác nhận vị trí A, sau đó di chuyển ghim sang vị trí B. | Đổi tọa độ sau khi `locationConfirmed=true`. | Reset `locationConfirmed=false`, buộc người dùng xác nhận lại trước khi gửi SOS. | `locationConfirmed` tự động reset về `false`. | **PASS** | Không |

---

## Nhóm B: SOS

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **SOS-01** | Gửi SOS thành công | Online, vị trí đã xác nhận, đầy đủ thông tin. | Gọi `POST /api/sos` qua `submitSOSBeacon()`. | Backend trả `201`, có `id` thật và `tracking_token`. | Trả `201` với `id` (ví dụ `219`) và `tracking_token`. | **PASS** | Không |
| **SOS-02** | API timeout | Backend phản hồi chậm quá ngưỡng timeout của `NorthStarApi`. | Gửi SOS tới endpoint delay vượt timeout. | Hủy request an toàn (`AbortError`), không treo UI, đưa vào hàng đợi retry. | Bắt `AbortError`, chuyển trạng thái sang chờ đồng bộ. | **PASS** | Không |
| **SOS-03** | Backend từ chối | Gửi SOS thiếu cả tọa độ lẫn mô tả địa điểm (`lat=None, lng=None`). | Gửi `POST /api/sos` không hợp lệ lên `127.0.0.1:8000`. | Backend trả `HTTP 422`; Outbox đánh dấu `FAILED`, không retry vô hạn. | Backend trả `HTTP 422`; Outbox ngừng retry. | **PASS** | Không |
| **SOS-04** | Mất mạng | `navigator.onLine = false` / mạng bị ngắt. | Tạo SOS mới từ giao diện Citizen. | Lưu vào IndexedDB `sos_outbox` ở trạng thái `PENDING`. | Lưu thành công vào `sos_outbox` với `client_event_id`. | **PASS** | Không |
| **SOS-05** | Tải lại trang khi offline | Đã có bản ghi `PENDING` trong `sos_outbox`, đang offline. | Reload `citizen.html` trong Edge Headless. | Bản ghi SOS trong `sos_outbox` vẫn còn nguyên. | Đọc lại từ IndexedDB sau reload thấy đủ bản ghi. | **PASS** | Không |
| **SOS-06** | Khôi phục mạng | Có bản ghi `PENDING` trong `sos_outbox`. | Bật mạng trở lại và kích hoạt sự kiện `online` / `syncAll()`. | Tự động đồng bộ bản ghi lên Backend. | Tự động gửi thành công và chuyển trạng thái `ACKNOWLEDGED`. | **PASS** | Không |
| **SOS-07** | Gửi lại SOS | Lần gửi đầu lỗi tạm thời `503`. | Chạy `OfflineSyncManager` qua các chu kỳ backoff. | Trạng thái chuyển `RETRYING` rồi gửi lại thành công khi server ổn. | Backoff hoạt động và gửi lại thành công ở lần kế tiếp. | **PASS** | Không |
| **SOS-08** | Chống gửi trùng | Gửi 2 lần `POST /api/sos` với cùng `client_event_id`. | Gửi payload trùng `client_event_id` lên `127.0.0.1:8000`. | Backend trả về bản ghi cũ (`id` giữ nguyên), không tạo hồ sơ thứ 2. | `dup_props.id == sos_id`, không tạo trùng. | **PASS** | Không |
| **SOS-09** | Trạng thái tiếp nhận | Có `tracking_token` hợp lệ từ SOS vừa tạo. | Gọi `GET /api/sos/track/{tracking_token}`. | Trả về trạng thái thật (`pending`/`acknowledged`...), không lộ SĐT/tên đầy đủ. | Trả `200`, không chứa `0912345678` hay họ tên gốc. | **PASS** | Không |

---

## Nhóm C: Định tuyến

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **RTE-01** | Có dữ liệu ngập | Backend có dữ liệu điểm ngập hoạt động. | Gọi `POST /api/route` với origin/destination tại Hà Nội. | Trả tuyến đường kèm thông tin kiểm tra ngập. | Trả `200` kèm geometry và trạng thái tuyến. | **PASS** | Không |
| **RTE-02** | Có đường ngập | Đoạn đường đi qua vùng có ngập. | Kiểm tra thuật toán đánh giá tuyến đi qua vùng ngập. | Cảnh báo đoạn nguy hiểm / gắn trạng thái `UNSAFE` nếu không tránh được. | Gắn nhãn cảnh báo rủi ro, không báo an toàn giả. | **PASS** | Không |
| **RTE-03** | Không có đường an toàn | Toàn bộ hướng đi bị phong tỏa bởi ngập sâu. | Mô phỏng không tìm được tuyến né ngập an toàn. | Trả trạng thái `UNAVAILABLE` / `UNSAFE`, không đánh lừa người dân. | Hiển thị đúng cảnh báo không có tuyến an toàn. | **PASS** | Không |
| **RTE-04** | API A* lỗi | `/api/route` trả lỗi `500` hoặc mất kết nối. | Mô phỏng `/api/route` lỗi trong `test_phase8_routing_evacuation.py`. | Thông báo lỗi A* và chuyển fallback nếu có, giữ cảnh báo trung thực. | Chuyển fallback có nhãn rõ nguồn tham khảo. | **PASS** | Không |
| **RTE-05** | OSRM fallback | Backend A* lỗi, dùng OSRM công cộng. | Kích hoạt nhánh OSRM fallback. | Tuyến gắn nhãn `REFERENCE_ONLY`, **không** hiển thị `"Né Ngập Thành Công"`. | Gắn `REFERENCE_ONLY`, không có thông báo an toàn giả. | **PASS** | Không |
| **RTE-06** | Dữ liệu ngập cũ | Dữ liệu ngập quá ngưỡng tươi mới (stale). | Kiểm tra tuyến với dữ liệu ngập cũ trong `test_phase8_routing_evacuation.py`. | Hạ mức tin cậy, không gắn `SAFE_VERIFIED` tuyệt đối. | Gắn cảnh báo dữ liệu ngập cũ. | **PASS** | Không |
| **RTE-07** | Không có dữ liệu ngập | Chưa có lớp dữ liệu ngập nào được nạp. | Chạy định tuyến khi không có dữ liệu ngập. | Không khẳng định đã kiểm chứng né ngập (`REFERENCE_ONLY`). | Hiển thị đúng trạng thái chưa có dữ liệu ngập kiểm chứng. | **PASS** | Không |
| **RTE-08** | Điểm trú ẩn quá tải | Dữ liệu `/api/shelters` có trạm hết chỗ/quá tải. | Gọi `GET /api/shelters` và kiểm tra logic chọn điểm sơ tán `POST /api/route/evacuate`. | Trả danh sách trạm và loại trừ/cảnh báo trạm quá tải. | `/api/shelters` và `/api/route/evacuate` đều trả `200` hợp lệ. | **PASS** | Không |

---

## Nhóm D: Báo ngập

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **FLD-01** | Báo ngập Online | Online, `lat=21.0285, lng=105.8542, level='medium'`. | Gửi `POST /api/reports` tới `127.0.0.1:8000`. | Backend trả `200/201`, gắn nhãn `[Chờ xác minh]`. | Backend trả `200/201` thành công. | **PASS** | Không |
| **FLD-02** | Báo ngập Offline | Trình duyệt offline. | Gửi báo ngập từ Citizen. | Lưu vào IndexedDB `flood_reports_outbox`. | Lưu vào `flood_reports_outbox` với `client_event_id`. | **PASS** | Không |
| **FLD-03** | Có ảnh | Ảnh hiện trường hợp lệ `<= 5MB`. | Đính kèm ảnh trong form báo ngập (`test_phase7_flood_reports.py`). | Chấp nhận ảnh `<= 5MB`, từ chối file `> 5MB` hoặc sai định dạng. | Validate kích thước & định dạng chính xác. | **PASS** | Không |
| **FLD-04** | Không có ảnh | Báo ngập chỉ có tọa độ và mức nước. | Gửi báo ngập không đính kèm ảnh. | Vẫn cho phép gửi hợp lệ. | Gửi thành công không bắt buộc ảnh. | **PASS** | Không |
| **FLD-05** | Sai tọa độ | `lat=999.0, lng=105.85, level='medium'`. | Gửi `POST /api/reports` lên `127.0.0.1:8000`. | Backend từ chối với `HTTP 422`. | Backend trả `HTTP 422`. | **PASS** | Không |
| **FLD-06** | Mô tả trống | Không nhập mô tả chi tiết, chỉ có mức nước & vị trí. | Gửi báo ngập có tọa độ + mức nước, bỏ trống mô tả. | Chấp nhận bình thường vì `description` không bắt buộc trên schema. | Gửi hợp lệ, không crash. | **PASS** | Không |
| **FLD-07** | Đồng bộ lại | Có báo ngập đang chờ trong `flood_reports_outbox`. | Khôi phục mạng và chạy `OfflineSyncManager.syncAll()`. | Đồng bộ lên `/api/reports` không trùng lặp. | Đồng bộ thành công và xóa/đánh dấu hoàn tất trong outbox. | **PASS** | Không |

---

## Nhóm E: Thời tiết

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **WTH-01** | Có dữ liệu | API thời tiết trả JSON hợp lệ kèm timestamp & nguồn. | Nạp thời tiết trong `test_phase6_weather_alerts.py`. | Hiển thị nhiệt độ, lượng mưa, timestamp và nguồn. | Hiển thị đầy đủ và lưu vào `weather_cache`. | **PASS** | Không |
| **WTH-02** | API lỗi | API thời tiết trả `500`/timeout. | Mô phỏng lỗi API thời tiết. | Fallback sang `weather_cache` kèm nhãn dữ liệu cũ, không bịa số liệu mới. | Hiển thị cache cũ kèm cảnh báo thời gian cập nhật. | **PASS** | Không |
| **WTH-03** | Cache cũ | `weather_cache` quá TTL. | Đọc cache cũ khi mất API. | Đánh dấu rõ dữ liệu cũ (`stale`), không giả là thời gian thực. | Gắn nhãn thời gian thực tế của bản cache. | **PASS** | Không |
| **WTH-04** | Mất mạng | Offline hoàn toàn, đã có `weather_cache`. | Mở Citizen khi offline. | Hiển thị dữ liệu đã cache từ IndexedDB. | Đọc và hiển thị thành công từ `weather_cache`. | **PASS** | Không |
| **WTH-05** | Dữ liệu không hợp lệ | API trả JSON thiếu trường / sai kiểu. | Đưa payload lỗi vào parser thời tiết. | Bỏ qua payload hỏng, giữ nguyên cache hợp lệ trước đó. | Không ghi đè cache hỏng, không crash UI. | **PASS** | Không |
| **WTH-06** | Cảnh báo chính thức | Có bản tin cảnh báo thiên tai còn hạn. | Nạp cảnh báo qua `alerts_cache` / API. | Hiển thị cảnh báo chính thức, lọc bỏ tin hết hạn/thu hồi. | Hiển thị đúng tin còn hiệu lực. | **PASS** | Không |
| **WTH-07** | Dữ liệu mô phỏng | Dữ liệu dự báo AI/ML hoặc mô phỏng diễn tập. | Kiểm tra phân loại nguồn dữ liệu. | Gắn nhãn tách biệt khỏi cảnh báo chính thức. | Tách rõ nhãn nguồn dự báo/mô phỏng. | **PASS** | Không |

---

## Nhóm F: AI

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **AIA-01** | AI Online | Online, gửi `{"query": "Cách xử lý khi nhà bị ngập nước và mất điện?"}`. | Gọi `POST /api/ai/chat` trên `127.0.0.1:8000`. | Trả `200` kèm câu trả lời an toàn (hoặc fallback từ Backend). | Trả `200` với nội dung hướng dẫn hợp lệ. | **PASS** | Không |
| **AIA-02** | AI Offline | Offline hoàn toàn, đã cache `offline_knowledge_vi.json`. | Hỏi chủ đề sinh tồn khi mất mạng (`test_phase10_ai_ux.py`). | Trả lời từ kho local, 0 request mạng, kèm nguồn & ngày kiểm duyệt. | Trả lời tức thì từ `OfflineKnowledge`, 0 request mạng. | **PASS** | Không |
| **AIA-03** | Không tìm thấy kiến thức | Offline, câu hỏi không khớp 15 chủ đề local. | Hỏi nội dung ngoài kho tri thức. | Thông báo không tìm thấy trong kho ngoại tuyến, không bịa đặt. | Trả thông báo từ chối bịa đặt rõ ràng. | **PASS** | Không |
| **AIA-04** | API lỗi | `/api/ai/chat` lỗi `500` hoặc timeout. | Mô phỏng API AI lỗi khi online. | Tự động fallback sang `OfflineKnowledge` cục bộ. | Chuyển fallback mượt mà, có nhãn ngoại tuyến. | **PASS** | Không |
| **AIA-05** | Câu hỏi nguy hiểm hoặc vượt phạm vi | Hỏi dữ liệu thời gian thực (giá cổ phiếu/thời tiết live) khi offline hoặc tình huống nguy hiểm tính mạng. | Kiểm tra phản hồi AI offline. | Không bịa dữ liệu thời gian thực; ưu tiên nhắc gọi `112` / gửi SOS. | Từ chối bịa đặt và nhắc kênh khẩn cấp. | **PASS** | Không |

---

## Nhóm G: PWA

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **PWA-01** | Cài đặt | `manifest-citizen.json`, icon PNG/SVG, `citizen.html` đăng ký `sw.js`. | Kiểm tra manifest & đăng ký SW (`test_phase5_pwa.py`). | Đủ trường `start_url`, `display`, icon hợp lệ, SW đăng ký thành công. | Hợp lệ 100%, không lỗi 404 icon. | **PASS** | Không |
| **PWA-02** | Mở offline | Đã truy cập `citizen.html` và precache xong. | Ngắt mạng và mở lại `citizen.html` trong Edge Headless. | Trang vẫn tải được từ `STATIC_CACHE`. | Mở thành công khi offline. | **PASS** | Không |
| **PWA-03** | Cache | Danh sách `PRECACHE_ASSETS` trong `sw.js`. | Kiểm tra mọi file trong `PRECACHE_ASSETS` trả `HTTP 200`, không cache `/api/sos`. | 0 lỗi 404 precache; không lưu PII `/api/sos` vào CacheStorage. | 0 lỗi 404; `/api/sos` không nằm trong CacheStorage. | **PASS** | Không |
| **PWA-04** | Cập nhật phiên bản | Đổi `CACHE_VERSION` của `sw.js`. | Kích hoạt SW mới và kiểm tra banner cập nhật + `IndexedDB`. | Cập nhật cache an toàn, giữ nguyên `northstar_citizen_db`. | IndexedDB không bị xóa khi SW cập nhật. | **PASS** | Không |
| **PWA-05** | Service Worker lỗi | Trình duyệt không hỗ trợ hoặc đăng ký SW thất bại. | Kiểm tra nhánh bắt lỗi `navigator.serviceWorker.register`. | Ứng dụng vẫn chạy bình thường, không crash JS. | Bắt lỗi an toàn, trang vẫn hoạt động. | **PASS** | Không |
| **PWA-06** | Tải lại khi offline | Đang ở `citizen.html` và mất mạng. | Nhấn reload trang khi offline. | App shell tải lại từ SW cache, dữ liệu IndexedDB còn nguyên. | Tải lại thành công và giữ nguyên dữ liệu local. | **PASS** | Không |

---

## Nhóm H: Thiết bị

| ID | Mục tiêu | Điều kiện đầu vào | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Lỗi phát hiện |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **DEV-01** | Android | Cần điện thoại Android vật lý kết nối USB/LAN. | Kiểm tra môi trường chạy test (`PWA-21`). | Cài đặt PWA và chạy offline trên Chrome Android. | Chưa thực hiện được do không có thiết bị Android gắn trong môi trường test. | **SKIPPED** | Chưa kiểm thử thiết bị vật lý |
| **DEV-02** | iOS | Cần iPhone/iPad vật lý chạy Safari. | Kiểm tra môi trường chạy test (`PWA-22`). | Add to Home Screen và mở offline trên iOS Safari. | Chưa thực hiện được do không có thiết bị iOS gắn trong môi trường test. | **SKIPPED** | Chưa kiểm thử thiết bị vật lý |
| **DEV-03** | Màn hình nhỏ | Edge Headless với `--window-size=360,740`. | Mở `http://127.0.0.1:3000/citizen.html` ở kích thước `360x740`. | Có thẻ `viewport` chuẩn (không `user-scalable=no`), hiển thị `#citizen-emergency-banner`. | Render thành công, không khóa zoom `user-scalable=no`. | **PASS** | Không |
| **DEV-04** | Mạng chập chờn | Mạng mất và có lại liên tục trong lúc đồng bộ. | Chạy `SYNC-01..22` với server giả lập timeout/503 rồi 200. | Backoff retry hợp lệ, không mất gói tin và không trùng lặp. | Đồng bộ đủ và không trùng bản ghi. | **PASS** | Không |
| **DEV-05** | Chế độ máy bay | Tương đương offline hoàn toàn (`navigator.onLine=false`, chặn network). | Chạy luồng offline PWA + IndexedDB + AI offline trên Edge Headless. | Mở được app, lưu SOS, hỏi AI offline bình thường. | Hoạt động ổn định ở trạng thái ngắt mạng hoàn toàn. | **PASS** | Không |
| **DEV-06** | Quyền vị trí bị tắt | Trình duyệt trả `PERMISSION_DENIED` khi gọi GPS. | Gọi định vị GPS và kiểm tra fallback chọn tay. | Không treo, không gửi tọa độ mặc định, hướng dẫn chọn vị trí thủ công. | Chuyển sang chế độ chọn tay an toàn. | **PASS** | Không |
