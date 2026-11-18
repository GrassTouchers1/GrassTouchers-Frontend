# BÁO CÁO KIỂM TOÁN VÀ PHÂN LOẠI CHỨC NĂNG GIAO DIỆN HIỆN TẠI
## NORTHSTAR COMMAND UI MIGRATION AUDIT (PHASE 1)

**Dự án:** NORTHSTAR COMMAND  
**Mục tiêu:** Chuyển đổi toàn diện giao diện từ FloodNav / Ứng dụng bản đồ dân sự sang **Trung tâm Tiếp nhận Thông tin, Giám sát Thiên tai & Điều phối Cứu trợ Cứu nạn Hợp nhất (NORTHSTAR COMMAND)**.  
**Ngày thực hiện:** 18/11/2026  
**Phiên bản kiểm toán:** v2.0-Command  

---

## 1. TỔNG QUAN TÀI NGUYÊN FRONTEND HIỆN TẠI

Hệ thống frontend hiện tại (`GrassTouchers-Frontend`) được xây dựng trên nền tảng HTML5, Tailwind CSS, Vanilla JavaScript Modular (Zero-Conflict) và Leaflet GIS Engine:

| Thành phần file | Kích thước / Quy mô | Vai trò hiện tại | Đánh giá tính sẵn sàng cho Command |
|---|---|---|---|
| `index.html` | ~2,270 dòng (149 KB) | Màn hình giao diện duy nhất chứa Header, Sidebar và Map Canvas | Cần tái cấu trúc layout thành Enterprise Command Center với Sidebar điều hành chuẩn 8 nhóm |
| `css/style.css` | ~730 dòng | Toàn bộ style giao diện, Dark Mode, animation xung radar, popup contrast | Giữ nguyên 100%, bổ sung quy tắc cho Command Sidebar, KPI Cards và Tactical COP Layout |
| `js/map_core.js` | ~3,420 dòng | GIS Controller chính: nạp Leaflet, 4 lớp bản đồ nền, nạp 130 trạm ngập, clustering, định tuyến | Giữ nguyên toàn bộ logic GIS, chuyển sang phục vụ bản đồ tác chiến trung tâm COP |
| `js/coordinator_command.js` | ~620 dòng | Module nghiệp vụ điều phối viên: Information Hub, Dispatch Queue, Fleet Units, SitRep | Nâng cấp thành Controller cốt lõi cho toàn bộ giao diện Command |
| `js/rescue_manager.js` | ~650 dòng | Quản lý cứu nạn: WebSocket real-time, vùng thiên tai, trạm sơ tán, tính lộ trình sơ tán khẩn cấp | Giữ nguyên và tái sử dụng cho các phân hệ Cứu hộ & Sơ tán |
| `js/advanced_modules.js` | ~440 dòng | Viễn thám SAR Sentinel-1, Mô phỏng timeline T+24h, Tối ưu hóa điều phối đa điểm TSP, Báo cáo PCTT | Giữ nguyên và tích hợp trực tiếp vào menu Command Operations & Reports |
| `js/voice_sos.js` | ~670 dòng | Cấp cứu giọng nói tiếng Việt AI (Whisper LPU + Groq phân loại rủi ro) | Chuyển thành nguồn tin tự động đổ vào Information Hub |
| `js/dashboard.js` | ~150 dòng | Biểu đồ ngập lụt đô thị và phân bố mực nước | Tích hợp vào phân hệ Báo cáo thống kê & Flood Intelligence |
| `js/storm_simulator.js` | ~390 dòng | Giả lập kịch bản mưa bão (0mm -> 100mm) và dâng nước trạm quan trắc | Tích hợp vào phân hệ Giám sát thiên tai & Diễn biến mưa lũ |
| `js/vehicle_sim.js` | ~160 dòng | Mô phỏng xe di chuyển dọc tuyến đường | Tái sử dụng để mô phỏng phương tiện cứu hộ (Ca nô, xe 4x4) di chuyển |
| `js/ai_assistant.js` | ~230 dòng | Trợ lý AI trực ban thiên tai 24/7 | Giữ nguyên floating widget hỗ trợ tra cứu nhanh cho điều phối viên |
| `js/config.js` | ~40 dòng | Cấu hình API Endpoint và WebSocket Base URL | Giữ nguyên |

---

## 2. BẢNG PHÂN LOẠI TÍNH NĂNG THEO NGUYÊN TẮC BẢO TOÀN (4 NHÓM A, B, C, D)

Tuân thủ nghiêm ngặt nguyên tắc **Zero Code Deletion** và bảo toàn tuyệt đối logic nghiệp vụ cho các phân hệ tương lai:

### GROUP A – KEEP & REUSE (Giữ lại & Sử dụng trực tiếp cho COMMAND)

1. **Leaflet GIS Map Core (`js/map_core.js`):**
   - Cơ chế hiển thị bản đồ 4 lớp (OSM France, OSM DE Quốc tế tốc độ cao, Esri Dark Gray, Esri Street).
   - Cơ chế tự động failover fallback ảnh tile khi mạng nghẽn.
   - Marker Clustering cho trạm đo và điểm báo cáo ngập.
   - Định vị GPS, công cụ đo khoảng cách, nhảy nhanh vùng địa phương (Toàn Miền Bắc, Hà Nội, Thái Nguyên, Lào Cai, Yên Bái,...).
2. **WebSocket Navigation & Realtime Broadcast (`js/rescue_manager.js`):**
   - Kênh WebSocket `ws://.../ws/navigation` nhận thông báo sự cố khẩn cấp, cảnh báo đổi tuyến và broadcast SOS.
3. **Mô-đun Viễn thám Sentinel-1 SAR (`js/advanced_modules.js` - SarFloodManager):**
   - Hiển thị đa giác ngập lụt bóc tách từ radar xuyên mây bão của ESA.
4. **Mô-đun Tối ưu hóa Điều phối Đa điểm TSP (`js/advanced_modules.js` - RescueDispatchManager):**
   - Thuật toán giải bài toán người du lịch tham lam (Greedy TSP) tìm thứ tự giải cứu tối ưu theo loại phương tiện (Ca nô, xe tải, xe con).
5. **Mô-đun Mô phỏng Dòng Thời Gian Lũ (`js/advanced_modules.js` - TimelineSimulator):**
   - Dự báo kịch bản ngập lụt theo các mốc T+0h, T+3h, T+6h, T+12h, T+24h.
6. **Mô-đun Cấp cứu Giọng nói AI Whisper (`js/voice_sos.js`):**
   - Thu âm micro, chuyển văn bản và phân loại đối tượng ưu tiên bằng LPU AI.
7. **Hệ thống PWA & Offline Storage (`sw.js`, `manifest.json`):**
   - Bộ đệm lưu trữ ngoại tuyến dữ liệu trạm ngập và điểm sơ tán.

---

### GROUP B – REDESIGN (Nghiệp vụ phù hợp nhưng cần thiết kế lại giao diện COMMAND)

1. **Main Layout & Navigation:**
   - *Hiện trạng:* Giao diện bản đồ toàn màn hình mang tính chất ứng dụng tìm đường, thanh menu hẹp, các nút phân tán.
   - *Thiết kế lại:* Chuyển đổi thành **Enterprise Command Center Layout** với Sidebar điều phối chuyên biệt 8 khối chức năng, Header hiển thị thông tin điều hành COP (Common Operating Picture) và thanh trạng thái hệ thống 24/7.
2. **Command Dashboard (Trung tâm Điều hành Tác chiến):**
   - *Hiện trạng:* Nằm ẩn trong tab cứu hộ phụ.
   - *Thiết kế lại:* Trở thành **Màn hình Mặc định (Default Screen)** khi mở ứng dụng với 6 thẻ KPI chỉ số tác chiến thời gian thực, bản đồ điều hành tổng hợp, dòng sự cố khẩn cấp và bảng theo dõi nhiệm vụ cứu nạn.
3. **Information Hub (Trung tâm Tiếp nhận & Thẩm tra):**
   - *Hiện trạng:* Danh sách báo cáo người dân nằm ở tab riêng biệt, thiếu bộ lọc đa nguồn.
   - *Thiết kế lại:* Hợp nhất 5 nguồn tin (SOS Người dân, Voice AI, Báo ngập, Trạm đo IoT, Vệ tinh SAR) vào một bảng dữ liệu tác chiến có bộ lọc mức độ ưu tiên, nút **[Lia bản đồ]**, **[Xác thực]**, **[Khử trùng lặp 50m]**, **[Lập lệnh điều phối]** và **[Bác bỏ tin giả]**.
4. **SOS & Rescue Management (Quản lý Yêu cầu Cứu hộ):**
   - *Hiện trạng:* Chỉ có form gửi SOS đơn giản và danh sách điểm sơ tán.
   - *Thiết kế lại:* Màn hình chuyên dụng cho Điều phối viên: xem chi tiết nạn nhân, số người, người già/trẻ nhỏ, mức nước ngập, bản đồ vị trí, chỉ định Đội cứu hộ (114, Chữ thập đỏ, Xe 4x4, Đội 115) và Trạm sơ tán tiếp nhận, vẽ tuyến cứu nạn trực tiếp.
5. **Weather & River Monitoring (Giám sát Thời tiết & Mực nước sông):**
   - *Hiện trạng:* Huy hiệu thời tiết nhỏ ở header và selectbox mô phỏng mưa.
   - *Thiết kế lại:* Phân hệ giám sát chuyên sâu: tích hợp dữ liệu thời tiết thực tế Open-Meteo, lượng mưa theo giờ, trạng thái các trạm thủy văn vượt Báo động 1, 2, 3 và mô phỏng bão.
6. **Fleet & Shelter Resource Management (Quản lý Lực lượng & Điểm sơ tán):**
   - *Hiện trạng:* Chưa có bảng quản lý danh bạ lực lượng trực ban.
   - *Thiết kế lại:* Quản lý chi tiết từng đội cơ động (vị trí trực, loại phương tiện, cơ số người, số điện thoại chỉ huy, trạng thái sẵn sàng / đang làm nhiệm vụ) và sức chứa các điểm sơ tán.
7. **Situation Report (SitRep Generator):**
   - *Hiện trạng:* Nút nhỏ nằm trong menu phụ.
   - *Thiết kế lại:* Màn hình trích xuất báo cáo tác chiến chuẩn Ban Chỉ huy PCTT & TKCN, xuất văn bản 1-click để gửi cơ quan thẩm quyền.

---

### GROUP C – MOVE TO SHARED MODULES (Bảo toàn cho CITIZEN & RESPONSE)

Các chức năng này không phải trọng tâm trên màn hình điều hành của Điều phối viên, nhưng là tài nguyên cốt lõi cho người dân và đội phản ứng. Chúng được đóng gói thành các **Shared Modules** và truy cập thông qua **Chế độ Chuyển đổi Góc nhìn (Portal Switcher)** trên Header:

1. **Thuật toán Tìm đường né ngập thông minh $A^*$ (`SharedRouteFinder`):**
   - Vẫn được bảo toàn nguyên vẹn trong `js/map_core.js` để người điều phối có thể tra cứu tuyến tránh ngập khi hướng dẫn phương tiện sơ tán, hoặc khi người dân truy cập chế độ Citizen.
2. **Form Báo ngập Hiện trường của Người dân (`SharedCitizenReporter`):**
   - Đóng gói thành modal/drawer độc lập, cho phép người dân gửi báo cáo hoặc cho phép điều phối viên nhập nhanh tin báo nhận qua điện thoại hotline.
3. **Form Phát tín hiệu Kêu cứu SOS & Ghi âm Giọng nói (`SharedCitizenSOS`):**
   - Giữ nguyên trong hệ sinh thái để kết nối trực tiếp với backend `/api/sos`, khi người dân gửi SOS thì hệ thống Command sẽ lập tức nhận tín hiệu và báo động đỏ.
4. **Cổng Trải Nghiệm Người Dân (Citizen Portal Preview):**
   - Một chế độ xem thử (Preview Mode) cho phép điều phối viên kiểm tra xem người dân đang nhìn thấy thông tin cảnh báo nào trên bản đồ công cộng.

---

### GROUP D – DEPRECATE OR ARCHIVE (Loại bỏ khỏi COMMAND sau khi đối soát)

1. **Các tiêu đề định vị cũ:** Loại bỏ các cụm từ "Hệ thống định tuyến thông minh Hà Nội", "FloodNav" khỏi thanh điều hướng chính của COMMAND. Thay thế bằng danh xưng chính thức: **NORTHSTAR COMMAND – Unified Disaster Intelligence & Emergency Response Coordination Center**.
2. **Các nút menu lặp lại:** Gộp các nút trùng lặp ở Header và Mobile dropdown thành một hệ thống điều hướng tập trung tại Sidebar.
3. **Giao diện dạng website giới thiệu:** Thay thế toàn bộ bằng giao diện phần mềm điều hành chuyên nghiệp (Emergency Operations Center - EOC).

---

## 3. BẢNG TỔNG HỢP KIỂM TOÁN TƯƠNG THÍCH API BACKEND

| API Endpoint Backend | Phương thức | Dữ liệu trả về | Trạng thái tích hợp trong COMMAND |
|---|---|---|---|
| `/api/sos` | GET / POST | Danh sách & Tạo tín hiệu SOS GeoJSON | ✅ Đã tích hợp vào Information Hub & SOS Management |
| `/api/sos/{id}/status` | PATCH | Cập nhật trạng thái `pending/acknowledged/dispatched/rescued` | ✅ Đã tích hợp vào quy trình phân công & hoàn thành nhiệm vụ |
| `/api/reports` | GET / POST | Danh sách & Tạo báo cáo ngập dân sinh | ✅ Đã tích hợp vào Information Hub (lọc & khử trùng lặp) |
| `/api/shelters` | GET / POST | Danh sách điểm sơ tán an toàn GeoJSON | ✅ Đã tích hợp vào Quản lý Điểm sơ tán & Hỗ trợ sơ tán |
| `/api/disasters` | GET / POST | Đa giác vùng thiên tai, lũ lụt, sạt lở | ✅ Đã tích hợp vào Bản đồ Thiên tai & Hazard Zones |
| `/api/rescue/dispatch` | POST | Tính toán lộ trình điều phối cứu nạn đa điểm TSP | ✅ Đã tích hợp vào Phân hệ Điều phối Nhiệm vụ (Command Operations) |
| `/api/route/evacuate` | POST | Lộ trình sơ tán an toàn tới điểm cứu nạn gần nhất | ✅ Đã tích hợp vào Hỗ trợ Sơ tán (Evacuation Support) |
| `/api/weather` | GET | Lượng mưa, nhiệt độ, dự báo thời tiết Open-Meteo | ✅ Đã tích hợp vào Giám sát Thời tiết & Lượng mưa |
| `/api/simulation/timeline` | GET | Diễn biến ngập lụt theo dòng thời gian T+0h -> T+24h | ✅ Đã tích hợp vào Diễn biến Ngập lũ (Flood Intelligence) |
| `/api/satellite/sar-inundation` | GET | Đa giác viễn thám ngập nước Sentinel-1 SAR | ✅ Đã tích hợp vào Lớp Viễn thám Bản đồ Tác chiến |
| `/api/sitrep/generate` | GET | Báo cáo tác chiến PCTT tự động | ✅ Đã tích hợp vào Phân hệ Báo cáo SitRep |
| `/api/ai/analyze-report` | POST | Thẩm định ngữ nghĩa & trích xuất thực thể AI | ✅ Đã tích hợp vào Hàng chờ Xác minh (Verification Queue) |

---
*Tài liệu đã được xác lập và phê duyệt bởi Principal Frontend Architect & Product Strategist.*
