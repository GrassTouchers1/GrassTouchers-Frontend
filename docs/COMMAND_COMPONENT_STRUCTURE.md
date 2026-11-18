# CẤU TRÚC THÀNH PHẦN GIAO DIỆN NORTHSTAR COMMAND
## COMMAND COMPONENT STRUCTURE (PHASE 2)

**Hệ thống:** NORTHSTAR COMMAND  
**Mục tiêu:** Định nghĩa cấu trúc phân rã thành phần giao diện (UI Components), cây quan hệ và cơ chế giao tiếp giữa các thành phần.  

---

## 1. CÂY THÀNH PHẦN GIAO DIỆN (COMPONENT TREE)

```
<AppRoot> (index.html)
│
├── <CommandHeader> (Thanh tiêu đề điều hành trung tâm)
│   ├── <BrandIdentity> (Logo NORTHSTAR COMMAND & Slogan)
│   ├── <SystemStatusPill> (Chấm xanh nhấp nháy 🟢 Trực chiến 24/7)
│   ├── <RegionFocusSelector> (Chọn vùng: Toàn Miền Bắc, Hà Nội, Thái Nguyên,...)
│   ├── <RealtimeSyncBadge> (Đồng bộ thời gian thực + Nút refresh)
│   ├── <QuickIncidentSearch> (Ô tìm kiếm mã SOS, SĐT, địa bàn)
│   ├── <RoleSwitcherDropdown> (Chuyển vai trò: Giám đốc, Điều phối, Thẩm định,...)
│   ├── <NotificationHub> (Chuông báo động sự cố & tin khẩn cấp mới)
│   └── <ViewModeToggle> (Nút chuyển góc nhìn [🛡️ COMMAND] <-> [🌐 CITIZEN PREVIEW])
│
├── <CommandCOPBanner> (Băng chỉ số tác chiến nổi đỉnh bản đồ)
│   ├── <KPITotalIntake> (Tổng tin tiếp nhận & số tin chờ duyệt)
│   ├── <KPICriticalSOS> (Số ca cứu hộ khẩn cấp P1 chưa xử lý)
│   ├── <KPIActiveUnits> (Số đội cứu hộ ca nô / xe 4x4 đang sẵn sàng)
│   ├── <KPIDispatchMissions> (Số nhiệm vụ điều phối đang di chuyển / tại hiện trường)
│   └── <QuickActionButtons> (+ Tạo ca khẩn, Lập lộ trình, Xuất SitRep)
│
├── <MainWorkArea> (Vùng làm việc trung tâm chia 2 phần)
│   │
│   ├── <TacticalSidebar> (Thanh điều hướng nghiệp vụ bên trái)
│   │   ├── <SidebarHeader> (Tiêu đề phân hệ & Nút thu gọn / mở rộng)
│   │   ├── <SidebarAccordionGroup> (8 Khối chức năng: Overview, Intake, Monitoring,...)
│   │   └── <SidebarActiveViewPane> (Container chứa nội dung phân hệ đang chọn)
│   │       ├── <ViewDashboardPane> (Dashboard tổng quan COP)
│   │       ├── <ViewIntakePane> (Dòng tin Information Hub + Bộ lọc 5 nguồn)
│   │       ├── <ViewSOSPane> (Bảng quản lý SOS & Điều phối ca cứu hộ)
│   │       ├── <ViewWeatherPane> (Giám sát thời tiết Open-Meteo & Lượng mưa)
│   │       ├── <ViewFloodPane> (Mực nước trạm thủy văn & Đa giác Sentinel-1 SAR)
│   │       ├── <ViewRescueFleetPane> (Quản lý các đội cứu nạn & Trạng thái xe/xuồng)
│   │       ├── <ViewSheltersPane> (Quản lý điểm sơ tán an toàn & Sức chứa)
│   │       ├── <ViewDispatchOpsPane> (Hàng đợi điều phối & Vẽ tuyến tác chiến)
│   │       ├── <ViewSitRepPane> (Trích xuất Báo cáo Tác chiến PCTT)
│   │       └── <ViewRolesPane> (Ma trận quyền hạn 6 vai trò người dùng)
│   │
│   └── <GISMapCanvasContainer> (Khung bản đồ Leaflet điều hành trung tâm)
│       ├── <LeafletMapCore> (Bản đồ nền OSM, OSM DE, Esri Dark, Esri Street)
│       ├── <MultiHazardLayersGroup> (Vùng ngập, lũ quét, sạt lở, trạm thủy văn)
│       ├── <SOSMarkersCluster> (Cụm điểm SOS nhấp nháy phát xung radar đỏ)
│       ├── <RescueUnitsLayer> (Vị trí ca nô, xuồng phao, xe bán tải 4x4)
│       ├── <SafeSheltersLayer> (Vị trí trạm sơ tán an toàn biểu tượng khiên xanh)
│       ├── <TacticalDispatchRouteLine> (Tuyến đường điều phối nét đứt đỏ/vàng)
│       ├── <MapFloatingTools> (Công cụ đo cự ly, vẽ vùng nguy cơ dã chiến)
│       └── <HazardLegendFooter> (Bảng chú giải các cấp độ cảnh báo)
│
├── <CommandModalsContainer> (Tập hợp các hộp thoại tác chiến nổi)
│   ├── <QuickDispatchModal> (Form phát lệnh giao nhiệm vụ cho đội cứu hộ)
│   ├── <SitRepExportModal> (Bản xem & in Báo cáo Tác chiến PCTT chuẩn QĐ 18)
│   ├── <VerifyReportModal> (Xác minh & đối soát báo cáo người dân)
│   └── <OpenDataLicenseModal> (Minh bạch nguồn dữ liệu mở Open-Meteo, GloFAS, GPM)
│
└── <SharedModulesContainer> (Các module nghiệp vụ dùng chung bảo toàn)
    ├── <SharedRouteFinder> (Thuật toán tìm đường né ngập thông minh A*)
    ├── <SharedCitizenReporter> (Form báo ngập dân sinh)
    ├── <SharedCitizenSOS> (Form gửi SOS & Cấp cứu giọng nói Whisper AI)
    └── <VoiceAssistantWidget> (Trợ lý trực ban âm thanh & tổng đài AI 24/7)
```

---

## 2. QUY CHUẨN TƯƠNG TÁC GIỮA CÁC THÀNH PHẦN (COMPONENT COMMUNICATION)

1. **Từ Sidebar sang Bản đồ (Sidebar -> Map):**
   - Khi nhấp **[Xem Map]** trên bất kỳ sự cố nào tại `Information Hub` hoặc `SOS Queue`, sự kiện kích hoạt `CoordinatorCommand.flyToIncident(lat, lng, id)`: bản đồ Leaflet ngay lập tức lia mượt mà tới tọa độ, phóng to cấp 15, kích hoạt vòng sóng xung kích đỏ (`pulseMarker`) và mở popup tác chiến.
2. **Từ Form Điều phối sang Bản đồ (Dispatch Modal -> Map):**
   - Khi điều phối viên bấm **[Phát Lệnh & Cắm Tuyến]**, hàm `drawMissionRoute(missionId)` lấy tọa độ 3 thực thể (Đội cứu hộ, Nạn nhân, Trạm sơ tán) và vẽ ngay đường Polyline chiến thuật nét đứt lên bản đồ, tự động căn khung hình chữ nhật (`fitBounds`) bao trọn toàn bộ hành trình.
3. **Từ Bản đồ sang Bảng Chi tiết (Map Marker Click -> Detail Drawer):**
   - Nhấp vào bất kỳ điểm SOS hoặc trạm quan trắc trên bản đồ sẽ hiển thị popup nghiệp vụ điều phối với nút **"Phân công cứu hộ"** hoặc **"Xem lịch sử mực nước"**, tự động đồng bộ trạng thái mở tương ứng trên Sidebar.
4. **Bộ Chuyển Đổi Vai Trò (Role Switcher -> UI Permission Gates):**
   - Thay đổi vai trò người dùng trên Header sẽ kích hoạt cập nhật các quyền hiển thị: ví dụ, chỉ vai trò `Command Director` hoặc `Dispatcher` mới có nút **Phát lệnh điều phối**, trong khi `Information Verifier` tập trung vào công cụ **Thẩm định & Khử trùng lặp**.

---
*Tài liệu cấu trúc thành phần giao diện NORTHSTAR COMMAND v2.0.*
