# KIẾN TRÚC GIAO DIỆN ĐIỀU HÀNH NORTHSTAR COMMAND
## COMMAND UI ARCHITECTURE (PHASE 2)

**Hệ thống:** NORTHSTAR COMMAND  
**Định vị:** Unified Disaster Intelligence & Emergency Response Coordination Center  
**Phong cách thiết kế:** Enterprise Tactical Command Center (EOC), GIS-Centric Common Operating Picture (COP)  
**Tiêu chuẩn:** W3C Web Accessibility, Responsive Design, Zero-Latency Incident Triage  

---

## 1. MÔ HÌNH BỐ CỤC TỔNG THỂ (MAIN LAYOUT SHELL)

Giao diện NORTHSTAR COMMAND được thiết kế theo cấu trúc điều hành tác chiến 4 vùng chức năng độc lập nhưng đồng bộ dữ liệu thời gian thực:

```
+---------------------------------------------------------------------------------------------------------+
| [TOP HEADER] Logo NORTHSTAR COMMAND | Trạng thái: 🟢 LIVE | Khu vực: [Miền Bắc v] | Sync: 13:30 | User v |
+-------------------+---------------------------------------------------------+---------------------------+
| [TACTICAL SIDEBAR]| [MAIN COMMAND WORKSPACE - GIS MAP / DATA VIEW]          | [TACTICAL COP RIGHT PANEL]|
| - Thu gọn/Mở rộng |                                                         |                           |
| - 8 Khối nghiệp vụ| - Bản đồ GIS Leaflet COP tương tác 100%                 | - Hàng đợi khẩn cấp       |
|   (Overview,      | - Lớp phủ Tactical: SOS, Đội cứu hộ, Safe Shelters,     | - Dòng cảnh báo real-time |
|    Information,   |   Vùng ngập SAR, Trạm thủy văn, Tuyến điều phối         | - Nút phát lệnh nhanh     |
|    Monitoring,    | - Hoặc Bảng dữ liệu nghiệp vụ (Data Table View)         |                           |
|    GIS Map,       |   theo từng màn hình được chọn trên Sidebar             |                           |
|    Resources,     |                                                         |                           |
|    Operations,    |                                                         |                           |
|    Reports,       |                                                         |                           |
|    System)        |                                                         |                           |
+-------------------+---------------------------------------------------------+---------------------------+
| [STATUS BAR] Hệ thống: Sẵn sàng 24/7 | PostGIS: Hoạt động | API Open-Meteo: 200 OK | Socket: Connected           |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. NGUYÊN TẮC THIẾT KẾ TRỰC QUAN (VISUAL & UX PRINCIPLES)

1. **GIS-Centric First:** Bản đồ là trái tim của trung tâm điều phối. Mọi thông tin tiếp nhận (SOS, báo cáo, cảm biến, bão lũ) đều có thể được phản ánh trực quan lên không gian địa lý với 1 cú nhấp chuột.
2. **Tactical Color Coding (Hệ màu tác chiến chuẩn PCTT):**
   - **Đỏ khẩn cấp (`#e11d48` / `#dc2626`):** Tín hiệu SOS chưa xử lý, có người già/trẻ nhỏ mắc kẹt, lũ vượt Báo động 3, sạt lở chia cắt.
   - **Cam ưu tiên (`#ea580c` / `#f97316`):** Ngập sâu trung bình, trạm đo vượt Báo động 2, gió bão cấp 10.
   - **Vàng chú ý (`#ca8a04` / `#eab308`):** Mưa lớn, cảnh báo trạm đo vượt Báo động 1, tin báo chờ xác minh.
   - **Xanh lục an toàn (`#16a34a` / `#10b981`):** Điểm sơ tán an toàn, tuyến đường khô ráo, nhiệm vụ đã giải cứu thành công.
   - **Xanh dương tác chiến (`#2563eb` / `#0284c7`):** Đội cứu nạn cơ động, ca nô, xe đặc chủng, trạm thủy văn.
   - **Xám trung tính (`#475569` / `#64748b`):** Dữ liệu lưu trữ, tin không hoạt động hoặc tin trùng lặp.
3. **Zero Waste Motion (Không thao tác thừa):** Điều phối viên không phải cuộn trang vô ích để tìm nút bấm. Mọi hành động quan trọng (Xem bản đồ, Thẩm định tin, Phân công đội, Vẽ tuyến cứu nạn) đều nằm ngay trên thẻ sự cố.
4. **Data Sincerity (Trung thực về dữ liệu):** Không bao giờ giả lập dữ liệu tĩnh làm giả số liệu thực tế. Mọi chỉ số đều ghi rõ nguồn gốc (Open-Meteo, Copernicus GloFAS, NASA GPM, Trạm thủy văn, Báo cáo cộng đồng).

---

## 3. CƠ CHẾ CHUYỂN ĐỔI CHẾ ĐỘ VIEW (VIEW CONTROLLER)

Hệ thống hỗ trợ 2 chế độ hiển thị linh hoạt cho Điều phối viên:
1. **Split-Screen Mode (Chế độ Song song):**
   - Sidebar nghiệp vụ ở bên trái (chiếm 380px – 440px).
   - Bản đồ GIS điều hành ở bên phải (chiếm toàn bộ không gian còn lại).
   - Phù hợp nhất khi trực ban tiếp nhận và điều phối phương tiện trên bản đồ.
2. **Full-Data Table Mode (Chế độ Bảng Tác chiến Toàn màn hình):**
   - Mở rộng bảng dữ liệu (Data Table) của Information Hub, Quản lý SOS, hoặc Danh mục trạm thủy văn ra toàn màn hình để lọc, đối soát, gộp tin trùng và xuất dữ liệu thống kê.

---

## 4. QUẢN LÝ TRẠNG THÁI TOÀN CỤC (GLOBAL STATE MANAGEMENT)

Bộ nhớ vận hành phía client được điều phối tập trung qua các store:
- `CommandState.currentView`: Màn hình nghiệp vụ đang kích hoạt (dashboard, information_hub, sos_manager, weather_monitoring, flood_intelligence, rescue_teams, shelters, dispatch_operations, sitrep_reports, system_settings).
- `CommandState.activeFilter`: Bộ lọc nguồn tin, mức độ khẩn cấp, địa bàn hành chính.
- `CommandState.selectedIncident`: Sự cố đang được chọn để xem chi tiết hoặc phân công.
- `CommandState.activeMissionRoute`: Tuyến đường điều phối tác chiến đang được vẽ trên Leaflet.
- `CommandState.userRole`: Vai trò của phiên đăng nhập (Command Director, Dispatcher, Data Analyst, Information Verifier, Rescue Coordinator).

---
*Tài liệu kiến trúc giao diện NORTHSTAR COMMAND v2.0.*
