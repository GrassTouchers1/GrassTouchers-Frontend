# KẾ HOẠCH TRIỂN KHAI GIAO DIỆN NORTHSTAR COMMAND
## COMMAND UI IMPLEMENTATION PLAN (PHASE 2)

**Hệ thống:** NORTHSTAR COMMAND  
**Mục tiêu:** Kế hoạch kỹ thuật chi tiết để chuyển đổi toàn diện giao diện frontend sang Trung tâm Điều phối Cứu hộ Thiên tai Hợp nhất.  

---

## 1. CÁC BƯỚC THỰC THI (PHASE 3 ROADMAP)

### BƯỚC 1: XÂY DỰNG LAYOUT SHELL CHUẨN ENTERPRISE COMMAND
1. **Header Điều hành Trung tâm:**
   - Nhận diện thương hiệu chính thức: `NORTHSTAR COMMAND` (Unified Disaster Intelligence & Emergency Response Center).
   - Đèn chỉ báo trạng thái: `🟢 TRỰC CHIẾN 24/7 (Sẵn sàng)`.
   - Bộ chọn vùng giám sát chiến thuật: Toàn Miền Bắc / Hà Nội / Thái Nguyên / Lào Cai / Yên Bái / Cao Bằng / Tuyên Quang.
   - Đồng hồ thời gian thực và thời điểm đồng bộ dữ liệu gần nhất.
   - Bộ chọn vai trò người dùng (Role Switcher): Command Director, Dispatcher, Data Analyst, Information Verifier, Rescue Coordinator.
   - Nút chuyển đổi góc nhìn (View Switcher): Xem thử giao diện người dân (Citizen View Preview) hoặc chế độ toàn màn hình tác chiến.
2. **Tactical Sidebar 8 Khối Chức Năng:**
   - Xây dựng sidebar cố định bên trái, hỗ trợ thu gọn (collapsed 64px) / mở rộng (expanded 420px).
   - Tổ chức 8 menu nhóm:
     1. `OVERVIEW` (Command Dashboard COP)
     2. `INFORMATION CENTER` (Information Hub, SOS Requests, Disaster Reports, Verification Queue)
     3. `DISASTER MONITORING` (Weather, Storm Tracking, Rainfall, River Levels, Flood Intelligence)
     4. `GIS & MAP` (Disaster Map, Hazard Zones, Rescue Locations, Safe Zones, Infrastructure)
     5. `RESOURCE MANAGEMENT` (Rescue Teams, Volunteer Organizations, Vehicles, Relief Supplies)
     6. `COMMAND OPERATIONS` (Rescue Missions, Relief Missions, Evacuation Support, Assignments)
     7. `REPORTS` (Situation Reports SitRep, Operational Statistics, Data Sources, Audit Logs)
     8. `SYSTEM` (User Management, Roles & Permissions, System Settings)
3. **Thanh Trạng Thái Hệ Thống (Bottom Status Bar):**
   - Hiển thị kết nối PostGIS, trạng thái API Open-Meteo, kết nối WebSocket và phiên làm việc.

---

### BƯỚC 2: XÂY DỰNG CONTROLLER ĐIỀU PHỐI TRUNG TÂM (`js/command_ui_controller.js`)
1. Quản lý trạng thái view đang kích hoạt (`currentView: 'dashboard' | 'intake' | 'sos' | ...`).
2. Tích hợp dữ liệu thời gian thực từ các API backend (`/api/sos`, `/api/reports`, `/api/shelters`, `/api/disasters`, `/api/weather`, `/api/rescue/dispatch`).
3. Cung cấp các hàm nghiệp vụ:
   - `switchCommandView(viewId)`: Chuyển đổi linh hoạt giữa các màn hình nghiệp vụ mà không cần tải lại trang (Single Page Command Interface).
   - `filterIntake(source, priority, status)`: Bộ lọc dòng tin tiếp nhận.
   - `verifyIncident(id)` / `rejectIncident(id)` / `deduplicateIncident(id)`: Thẩm định dữ liệu.
   - `openDispatchModal(incidentId)` / `submitDispatchMission()`: Lập lệnh điều động lực lượng.
   - `drawTacticalMissionRoute(missionId)`: Cắm mốc và vẽ tuyến đường điều phối trên bản đồ Leaflet.
   - `generateSitRepDocument()`: Trích xuất báo cáo tình huống PCTT chuẩn.
   - `switchUserRole(roleId)`: Cập nhật giao diện theo ma trận phân quyền 6 vai trò.

---

### BƯỚC 3: XÂY DỰNG CÁC MÀN HÌNH NGHIỆP VỤ CHI TIẾT
1. **Màn hình mặc định: Command Dashboard (COP):**
   - 6 thẻ KPI chỉ số tác chiến thời gian thực.
   - Bản đồ GIS điều hành trung tâm.
   - Dòng cảnh báo sự cố khẩn cấp (Emergency Feed).
   - Bảng theo dõi tiến độ nhiệm vụ điều phối.
2. **Màn hình Information Hub:**
   - Dòng tin tiếp nhận thời gian thực từ 5 nguồn với đầy đủ thông tin vị trí, số người mắc kẹt, độ sâu ngập, nút lia bản đồ, xác thực, khử trùng lặp và phân công.
3. **Màn hình Quản lý SOS (SOS Management):**
   - Danh sách các ca cứu hộ SOS, cắm mốc tọa độ chính xác, phân loại đối tượng ưu tiên (người già, trẻ nhỏ), nút gọi hotline và nút mở lệnh cứu nạn.
4. **Màn hình Giám sát Thời tiết & Lượng mưa (Weather Monitoring):**
   - Dữ liệu quan trắc và dự báo từ Open-Meteo, biểu đồ lượng mưa theo giờ, mô phỏng bão.
5. **Màn hình Trí tuệ Ngập lụt (Flood Intelligence):**
   - Trạng thái 130 trạm đo thủy văn vượt các cấp báo động 1, 2, 3 và lớp viễn thám Sentinel-1 SAR.
6. **Màn hình Quản lý Lực lượng Đội Cứu nạn (Rescue Teams):**
   - Danh bạ các đội Ca nô 114, Xuồng phao Chữ thập đỏ, Xe tải 4x4, Tổ cấp cứu 115 kèm trạng thái sẵn sàng xuất kích.
7. **Màn hình Điểm Sơ tán An toàn (Safe Zones):**
   - Quản lý sức chứa, số người đang tạm trú, nhu yếu phẩm dự trữ và thông tin trạm trưởng.
8. **Màn hình Điều phối Nhiệm vụ (Command Operations):**
   - Lập kế hoạch điều động, thuật toán gợi ý lộ trình cứu nạn tuần tự tối ưu (Greedy TSP).
9. **Màn hình Báo cáo Tác chiến PCTT (Situation Reports - SitRep):**
   - Trích xuất văn bản báo cáo chuẩn gửi cơ quan thẩm quyền, hỗ trợ sao chép nhanh và in văn bản.
10. **Màn hình Ma trận Phân quyền (Roles & Permissions):**
    - Hiển thị ma trận phân quyền 6 vai trò điều hành.

---

### BƯỚC 4: BẢO TOÀN CÁC MODULE DÙNG CHUNG CHO CITIZEN & RESPONSE
1. Đóng gói các form người dân (Form gửi SOS, Form báo ngập, Thuật toán tìm đường né ngập A*) vào các Shared Components độc lập.
2. Cung cấp nút **"Góc nhìn Người dân (Citizen Preview)"** trên Header để điều phối viên có thể kiểm tra trải nghiệm thực tế của người dân trên bản đồ công cộng bất kỳ lúc nào.

---
*Kế hoạch triển khai kỹ thuật NORTHSTAR COMMAND v2.0.*
