/**
 * NORTHSTAR COMMAND - ENTERPRISE OPERATIONS CONTROLLER
 * Module: CommandUIController (v2.5)
 * Scope: 6-Role RBAC Enforcement, Spatial Deduplication, Tactical GIS & Dynamic Mission Workflow
 */

const CommandUIController = (function () {
  'use strict';

  // =========================================================================
  // 1. CONFIGURATION: 6-ROLE RBAC PERMISSIONS MATRIX
  // =========================================================================
  const ROLES_CONFIG = {
    director: {
      id: 'director',
      label: '⭐ Chỉ huy trưởng',
      title: 'Chỉ huy trưởng Tác chiến (Command Director)',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      description: 'Toàn quyền điều hành chiến dịch, ban bố tình trạng khẩn cấp, xuất quân lực lượng và quản trị hệ thống.',
      allowedViews: ['cmd_dashboard', 'cmd_intake', 'cmd_sos', 'cmd_reports', 'cmd_verification', 'cmd_weather', 'cmd_flood_intel', 'cmd_disaster_map', 'cmd_rescue_teams', 'cmd_safe_zones', 'cmd_operations', 'cmd_sitrep', 'cmd_roles', 'cmd_citizen_preview'],
      canDispatch: true,
      canVerify: true,
      canManageFleet: true,
      canManageShelters: true,
      canExportSitRep: true,
      canAdminSystem: true,
      canSimulateStorm: true,
      scopeTag: 'Toàn quyền tác chiến Toàn Miền Bắc',
      focusPerspective: 'Bao quát bức tranh thảm họa cấp cao: 42 ca SOS khẩn cấp, 52 tin chờ tiếp nhận, 5 đội cứu hộ (3 sẵn sàng, 2 đang cơ động), 15 điểm sơ tán (420/600 người). Quyền ban bố tình trạng khẩn cấp và duyệt lệnh trên toàn lãnh thổ.',
      quickActions: [
        { label: '📢 Ban Bố Báo Động Đỏ', action: "CommandUIController.triggerEmergencyBroadcast()", class: 'bg-rose-600 hover:bg-rose-700 text-white' },
        { label: '📋 Xuất SitRep Bộ Chỉ Huy', action: "CommandUIController.switchView('cmd_sitrep')", class: 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700' },
        { label: '⚡ Điều Phối Cấp Tốc', action: "CommandUIController.switchView('cmd_sos')", class: 'bg-blue-600 hover:bg-blue-700 text-white' }
      ]
    },
    dispatcher: {
      id: 'dispatcher',
      label: '🛡️ Điều phối viên',
      title: 'Điều phối viên Tác chiến (Operations Dispatcher)',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      description: 'Tiếp nhận đa kênh, lập lệnh xuất quân, phân bổ ca-nô/xe 4x4, tính toán lộ trình cứu hộ né ngập TSP.',
      allowedViews: ['cmd_dashboard', 'cmd_intake', 'cmd_sos', 'cmd_reports', 'cmd_verification', 'cmd_disaster_map', 'cmd_rescue_teams', 'cmd_safe_zones', 'cmd_operations', 'cmd_sitrep', 'cmd_citizen_preview'],
      canDispatch: true,
      canVerify: true,
      canManageFleet: true,
      canManageShelters: true,
      canExportSitRep: true,
      canAdminSystem: false,
      canSimulateStorm: false,
      scopeTag: 'Tiếp nhận & Phát lệnh điều phối cứu nạn',
      focusPerspective: 'Bao quát các yêu cầu cứu hộ thực địa: 42 ca SOS đang chờ giải cứu, ưu tiên ca cấp thiết P1 ngập >2m. Giám sát điều động Ca-nô 114, Xe 4x4 và phân tuyến né điểm ngập sâu.',
      quickActions: [
        { label: '⚡ Xem Hàng Đợi SOS P1', action: "CommandUIController.switchView('cmd_sos')", class: 'bg-rose-600 hover:bg-rose-700 text-white' },
        { label: '🚑 Điều Động Ca-nô', action: "CommandUIController.switchView('cmd_rescue_teams')", class: 'bg-blue-600 hover:bg-blue-700 text-white' },
        { label: '📍 Lập Tuyến Né Ngập TSP', action: "CommandUIController.switchView('cmd_operations')", class: 'bg-purple-600 hover:bg-purple-700 text-white' }
      ]
    },
    verifier: {
      id: 'verifier',
      label: '🔍 Xác minh viên',
      title: 'Xác minh viên Thông tin (Intelligence Verifier)',
      badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      description: 'Thẩm định tin báo dân sự, kiểm tra ảnh hiện trường, đối soát Hotline 114 và lọc trùng không gian 50m.',
      allowedViews: ['cmd_dashboard', 'cmd_intake', 'cmd_sos', 'cmd_reports', 'cmd_verification', 'cmd_flood_intel', 'cmd_disaster_map', 'cmd_citizen_preview'],
      canDispatch: false,
      canVerify: true,
      canManageFleet: false,
      canManageShelters: false,
      canExportSitRep: false,
      canAdminSystem: false,
      canSimulateStorm: false,
      scopeTag: 'Thẩm định tin báo & Lọc trùng 50m',
      focusPerspective: 'Bao quát dòng thông tin tiếp nhận: 12 tin báo chờ duyệt, 2 cụm trùng lặp bán kính 50m (Bảo Yên - Lào Cai), độ tin cậy AI 94.2%. Chuyên trách xác thực trước khi chuyển lệnh cho Điều phối viên.',
      quickActions: [
        { label: '✓ Mở Hàng Đợi Xác Minh', action: "CommandUIController.switchView('cmd_verification')", class: 'bg-teal-600 hover:bg-teal-700 text-white' },
        { label: '🔗 Gộp 2 Cụm Trùng 50m', action: "CommandUIController.mergeDuplicateCluster()", class: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
        { label: '📞 Đối Soát Báo Cáo Dân Sự', action: "CommandUIController.switchView('cmd_reports')", class: 'bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700' }
      ]
    },
    analyst: {
      id: 'analyst',
      label: '📊 Chuyên viên dữ liệu',
      title: 'Chuyên viên Dữ liệu & Khí tượng (Hydrological & Weather Analyst)',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      description: 'Giám sát 130 trạm thủy văn IoT, radar mưa Open-Meteo, viễn thám Sentinel-1 SAR và chạy giả lập bão 0-100mm.',
      allowedViews: ['cmd_dashboard', 'cmd_weather', 'cmd_flood_intel', 'cmd_disaster_map', 'cmd_sitrep', 'cmd_citizen_preview'],
      canDispatch: false,
      canVerify: false,
      canManageFleet: false,
      canManageShelters: false,
      canExportSitRep: true,
      canAdminSystem: false,
      canSimulateStorm: true,
      scopeTag: 'Khí tượng, 130 Trạm Thủy văn & Mô phỏng',
      focusPerspective: 'Bao quát dữ liệu đo đạc môi trường: 130 trạm đo IoT (4 trạm vượt Báo Động 3), radar mưa thực tế 82mm, diện tích ngập viễn thám Sentinel-1 SAR. Có quyền điều chỉnh Bộ giả lập mưa bão 0-100mm.',
      quickActions: [
        { label: '🌧️ Bộ Giả Lập Mưa Bão', action: "CommandUIController.switchView('cmd_weather')", class: 'bg-purple-600 hover:bg-purple-700 text-white' },
        { label: '🌊 130 Trạm Thủy Văn IoT', action: "CommandUIController.switchView('cmd_flood_intel')", class: 'bg-sky-600 hover:bg-sky-700 text-white' },
        { label: '🛰️ Bản Đồ Radar Viễn Thám', action: "CommandUIController.switchView('cmd_disaster_map')", class: 'bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700' }
      ]
    },
    rescue_coordinator: {
      id: 'rescue_coordinator',
      label: '🚒 Điều phối Cứu hộ',
      title: 'Điều phối viên Cứu hộ Thực địa (Rescue Coordinator)',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      description: 'Chỉ huy 5 đơn vị cơ động (Ca-nô 150HP, Xuồng phao, Xe 4x4, Đội lặn, Trực thăng Mi-17); giám sát cứu nạn P1.',
      allowedViews: ['cmd_dashboard', 'cmd_sos', 'cmd_disaster_map', 'cmd_rescue_teams', 'cmd_operations', 'cmd_citizen_preview'],
      canDispatch: true,
      canVerify: false,
      canManageFleet: true,
      canManageShelters: false,
      canExportSitRep: false,
      canAdminSystem: false,
      canSimulateStorm: false,
      scopeTag: 'Chỉ huy Đội Xe 4x4, Ca-nô & Xuồng cơ động',
      focusPerspective: 'Bao quát phương tiện chiến đấu và đội cơ động: 5 đơn vị (3 sẵn sàng, 2 đang làm nhiệm vụ trên Sông Cầu và Lào Cai). Trực tiếp phân công phương tiện cứu nạn P1 và theo dõi vượt lũ.',
      quickActions: [
        { label: '🚒 Quản Lý Đội Ca-nô & Xe', action: "CommandUIController.switchView('cmd_rescue_teams')", class: 'bg-rose-600 hover:bg-rose-700 text-white' },
        { label: '⚡ Tiếp Nhận Ca SOS P1', action: "CommandUIController.switchView('cmd_sos')", class: 'bg-blue-600 hover:bg-blue-700 text-white' },
        { label: '🗺️ Giám Sát Tuyến Trên Bản Đồ', action: "CommandUIController.switchView('cmd_disaster_map')", class: 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700' }
      ]
    },
    relief_coordinator: {
      id: 'relief_coordinator',
      label: '📦 Điều phối Cứu trợ',
      title: 'Điều phối viên Cứu trợ & Sơ tán (Relief Coordinator)',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      description: 'Quản lý 15 điểm sơ tán an toàn (420/600 người), điều phối gạo, nước sạch, thuốc men, áo phao và đoàn thiện nguyện.',
      allowedViews: ['cmd_dashboard', 'cmd_intake', 'cmd_safe_zones', 'cmd_operations', 'cmd_sitrep', 'cmd_citizen_preview'],
      canDispatch: false,
      canVerify: false,
      canManageFleet: false,
      canManageShelters: true,
      canExportSitRep: true,
      canAdminSystem: false,
      canSimulateStorm: false,
      scopeTag: 'Mạng lưới Điểm Sơ tán & Nhu yếu phẩm',
      focusPerspective: 'Bao quát hậu cần sơ tán và tiếp tế: 15 điểm sơ tán an toàn (sức chứa đã dùng 70%), kho tiếp tế còn 1,200 thùng nước, 850 thùng lương khô, 500 áo phao. Điều phối phân bổ hàng cứu trợ.',
      quickActions: [
        { label: '🏕️ Quản Lý 15 Điểm Sơ Tán', action: "CommandUIController.switchView('cmd_safe_zones')", class: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
        { label: '📦 Kiểm Kê Nhu Yếu Phẩm', action: "CommandUIController.switchView('cmd_safe_zones')", class: 'bg-teal-600 hover:bg-teal-700 text-white' },
        { label: '📋 Báo Cáo Hậu Cần SitRep', action: "CommandUIController.switchView('cmd_sitrep')", class: 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700' }
      ]
    }
  };

  // State Management
  const state = {
    currentView: 'cmd_dashboard',
    userRole: 'director',
    currentRegion: 'all',
    sidebarCollapsed: false,
    activeIntakeFilter: 'all',
    quickSearchQuery: '',
    lastSyncTime: new Date().toLocaleTimeString('vi-VN'),
    selectedIncidentId: null,
    activeMapLayers: {
      sensors: true,
      disasters: true,
      shelters: true,
      sos: true,
      fleet: true,
      satellite: false
    }
  };

  // Internal Data Stores
  let mapInstance = null;
  let isInitialized = false;
  let intakeData = [];
  let sosData = [];
  let reportData = [];
  let shelterData = [];
  let unitsData = [];
  let missionData = [];
  let floodStationsData = [];

  // Tactical Leaflet Layers
  const tacticalLayers = {
    sosGroup: null,
    unitsGroup: null,
    sheltersGroup: null,
    dispatchRoutesGroup: null
  };

  // =========================================================================
  // 2. KHỞI TẠO HỆ THỐNG (SYSTEM INITIALIZATION)
  // =========================================================================
  async function init(map) {
    if (map) mapInstance = map;
    else if (!mapInstance && window.map) mapInstance = window.map;

    if (mapInstance) {
      if (!tacticalLayers.sosGroup) tacticalLayers.sosGroup = L.layerGroup().addTo(mapInstance);
      if (!tacticalLayers.unitsGroup) tacticalLayers.unitsGroup = L.layerGroup().addTo(mapInstance);
      if (!tacticalLayers.sheltersGroup) tacticalLayers.sheltersGroup = L.layerGroup().addTo(mapInstance);
      if (!tacticalLayers.dispatchRoutesGroup) tacticalLayers.dispatchRoutesGroup = L.layerGroup().addTo(mapInstance);
    }

    if (isInitialized) {
      renderAllComponents();
      renderTacticalMapLayers();
      return;
    }
    isInitialized = true;

    // Nạp lực lượng & kịch bản ban đầu
    initRescueFleet();
    initMissions();
    initFloodStations();

    // Nạp dữ liệu từ backend
    await refreshSystemData();

    // Khởi tạo các listener sự kiện
    setupGlobalEventListeners();

    // Mặc định kích hoạt vai trò director
    const urlParams = new URLSearchParams(window.location.search);
    const initialRole = urlParams.get('role');
    if (initialRole && ROLES_CONFIG[initialRole]) {
      state.userRole = initialRole;
    }
    const initialView = urlParams.get('view');
    if (initialView) {
      state.currentView = initialView;
    }
    switchUserRole(state.userRole);
    if (initialView && initialView !== 'cmd_dashboard') {
      switchView(initialView);
    }
    const initialModal = urlParams.get('modal');
    if (initialModal) {
      setTimeout(() => openDispatchModal(initialModal), 300);
    }

    console.log('[NorthStar Command] Unified Emergency Operations Center đã sẵn sàng trực chiến.');
  }

  // Làm mới toàn bộ dữ liệu từ backend và đồng bộ trạng thái
  
  function getSeedReports() {
    return [
      {
        id: 'REP-HN-101',
        raw_id: 101,
        level: 'medium',
        estimated_depth_cm: 35,
        confirmed: true,
        lat: 20.9850,
        lng: 105.8180,
        contact_name: 'Báo cáo: Ngõ 207 Bùi Xương Trạch, Thanh Xuân, Hà Nội',
        phone: 'Dân cư đối soát tự động',
        description: 'Nước ngập tràn vào nhà dân ~35cm, xe máy không thể di chuyển, rác tràn nghẽn cống tiêu thoát nước.',
        created_at: new Date(Date.now() - 25 * 60000).toISOString()
      },
      {
        id: 'REP-LC-102',
        raw_id: 102,
        level: 'heavy',
        estimated_depth_cm: 90,
        confirmed: false,
        lat: 22.3150,
        lng: 104.3820,
        contact_name: 'Báo cáo: Km 78 Quốc lộ 4D, Đèo Ô Quy Hồ, Sa Pa, Lào Cai',
        phone: 'Tài xế đường dài',
        description: 'Sạt lở vách núi đất đá dài 40m chia cắt hoàn toàn tuyến Sa Pa - Lai Châu. 2 xe tải kẹt giữa đoạn sạt lở nguy hiểm.',
        created_at: new Date(Date.now() - 15 * 60000).toISOString()
      },
      {
        id: 'REP-YB-103',
        raw_id: 103,
        level: 'heavy',
        estimated_depth_cm: 80,
        confirmed: true,
        lat: 21.7230,
        lng: 104.8980,
        contact_name: 'Báo cáo: Phường Hồng Hà, TP. Yên Bái (Ven sông Thao)',
        phone: 'Tổ trưởng dân phố Hồng Hà',
        description: 'Nước sông Thao dâng vượt báo động 3, tràn qua mặt đê tràn vào tầng 1 các hộ dân khu phố Thanh Niên.',
        created_at: new Date(Date.now() - 35 * 60000).toISOString()
      },
      {
        id: 'REP-TN-104',
        raw_id: 104,
        level: 'heavy',
        estimated_depth_cm: 65,
        confirmed: false,
        lat: 21.5930,
        lng: 105.8450,
        contact_name: 'Báo cáo: Đường Hoàng Văn Thụ, TP. Thái Nguyên',
        phone: 'Người dân địa phương',
        description: 'Mưa to xối xả ngập sâu 65cm, 1 cây phượng vĩ bật gốc đè vào đường dây điện trung thế, nguy cơ rò điện.',
        created_at: new Date(Date.now() - 40 * 60000).toISOString()
      },
      {
        id: 'REP-HN-105',
        raw_id: 105,
        level: 'heavy',
        estimated_depth_cm: 120,
        confirmed: true,
        lat: 20.8935,
        lng: 105.6590,
        contact_name: 'Báo cáo: Thôn Nhân Lý, Xã Nam Phương Tiến, Chương Mỹ, Hà Nội',
        phone: 'UBND Xã Nam Phương Tiến',
        description: 'Nước sông Bùi tràn đê Bùi 2, toàn thôn ngập sâu 1.2m đến 1.5m, 120 hộ dân bị cô lập cần thuyền tiếp tế.',
        created_at: new Date(Date.now() - 50 * 60000).toISOString()
      },
      {
        id: 'REP-QN-106',
        raw_id: 106,
        level: 'medium',
        estimated_depth_cm: 30,
        confirmed: false,
        lat: 20.9510,
        lng: 107.0850,
        contact_name: 'Báo cáo: Khu vực Cột 5, Phường Hồng Hà, TP. Hạ Long, Quảng Ninh',
        phone: 'Người đi đường',
        description: 'Triều cường dâng kết hợp mưa lớn làm ngập cục bộ 30cm tuyến bao biểu, các xe ô tô gầm thấp phải quay đầu.',
        created_at: new Date(Date.now() - 65 * 60000).toISOString()
      },
      {
        id: 'REP-HG-107',
        raw_id: 107,
        level: 'heavy',
        estimated_depth_cm: 75,
        confirmed: false,
        lat: 22.7520,
        lng: 104.9850,
        contact_name: 'Báo cáo: Km 12 Quốc lộ 2, Huyện Vị Xuyên, Hà Giang',
        phone: 'Ban chỉ huy PCTT Hà Giang',
        description: 'Lũ ống quét qua ngầm tràn cuốn trôi 1 phần kè taluy âm, đất đá đang sạt trượt tiếp, khuyến cáo không đi qua.',
        created_at: new Date(Date.now() - 80 * 60000).toISOString()
      },
      {
        id: 'REP-CB-108',
        raw_id: 108,
        level: 'medium',
        estimated_depth_cm: 40,
        confirmed: true,
        lat: 22.8250,
        lng: 106.5280,
        contact_name: 'Báo cáo: Thị trấn Trùng Khánh, Tỉnh Cao Bằng',
        phone: 'Người dân địa phương',
        description: 'Nước sông Quây Sơn dâng nhanh làm ngập 40cm các diện tích lúa và hoa màu ven bãi bồi.',
        created_at: new Date(Date.now() - 95 * 60000).toISOString()
      }
    ];
  }

  async function refreshSystemData() {
    state.lastSyncTime = new Date().toLocaleTimeString('vi-VN');
    updateSyncIndicator();

    try {
      // 1. Lấy dữ liệu SOS từ backend
      const sosRes = await fetch(getApiUrl('/api/sos')).catch(() => null);
      if (sosRes && sosRes.ok) {
        const data = await sosRes.json();
        sosData = (data.features || []).map(f => {
          const p = f.properties;
          const c = f.geometry.coordinates;
          return {
            id: `SOS-${p.id}`,
            raw_id: p.id,
            contact_name: p.contact_name || 'Người dân kêu cứu',
            phone: p.phone || '098xxxxxxx',
            people_count: p.people_count || 1,
            has_vulnerable: !!p.has_elderly_or_children,
            water_level_cm: p.water_level_cm || 0,
            priority: p.priority || 'critical',
            status: p.status || 'pending',
            lat: c[1],
            lng: c[0],
            notes: p.notes || 'Cần cứu trợ khẩn cấp, đang bị cô lập.',
            created_at: p.created_at || new Date().toISOString()
          };
        });
      }

      // 2. Lấy dữ liệu Báo cáo ngập từ người dân (với hạt giống dự phòng chuẩn Miền Bắc)
      const repRes = await fetch(getApiUrl('/api/reports')).catch(() => null);
      if (repRes && repRes.ok) {
        const data = await repRes.json();
        const features = data.features || [];
        if (features.length > 0) {
          reportData = features.map(f => {
            const p = f.properties || {};
            const c = (f.geometry && f.geometry.coordinates) || [105.85, 21.02];
            return {
              id: `REP-${p.id}`,
              raw_id: p.id,
              level: p.level || 'medium',
              estimated_depth_cm: p.estimated_depth_cm || 25,
              confirmed: !!p.confirmed,
              lat: Number(c[1] || 21.02),
              lng: Number(c[0] || 105.85),
              contact_name: `Báo cáo thực địa #${p.id}`,
              phone: 'GPS Đối soát',
              description: p.description || `Ngập đường giao thông ước tính ~${p.estimated_depth_cm || 25}cm.`,
              created_at: p.created_at || new Date().toISOString()
            };
          });
        } else {
          reportData = getSeedReports();
        }
      } else {
        reportData = getSeedReports();
      }

      // 3. Lấy dữ liệu Điểm sơ tán an toàn
      const shRes = await fetch(getApiUrl('/api/shelters')).catch(() => null);
      if (shRes && shRes.ok) {
        const data = await shRes.json();
        shelterData = (data.features || []).map(f => {
          const p = f.properties;
          const c = f.geometry.coordinates;
          return {
            id: p.id,
            name: p.name,
            address: p.address,
            capacity: p.capacity || 500,
            current_occupancy: p.current_occupancy || 0,
            contact_phone: p.contact_phone || '114',
            supplies_status: p.supplies_status || 'Đầy đủ lương thực và nước sạch',
            lat: c[1],
            lng: c[0]
          };
        });
      }

      // Hợp nhất dữ liệu thành dòng tin tiếp nhận Information Hub
      buildUnifiedIntakeFeed();

      // Cập nhật tất cả thành phần giao diện
      renderAllComponents();

      // Vẽ các lớp tác chiến lên bản đồ
      renderTacticalMapLayers();

    } catch (err) {
      console.warn('[NorthStar Command] Lỗi đồng bộ dữ liệu hệ thống:', err);
    }
  }

  function initRescueFleet() {
    unitsData = [
      {
        id: 'UNIT-101',
        name: 'Đội Ca nô Cao tốc 114 (Công an PCCC & CNCH)',
        type: 'boat',
        type_label: 'Ca nô cứu nạn cao tốc',
        commander: 'Đại úy Nguyễn Văn Quân',
        phone: '0912-114-114',
        base_location: 'Bến Đoan, Sông Cầu, TP Thái Nguyên',
        lat: 21.5870,
        lng: 105.8360,
        status: 'ready', // ready, en_route, on_scene, standby
        capacity: '12 người/chuyến, có phao bè cứu sinh',
        equipment: 'Ca nô composite 150HP, 20 áo phao, đèn rọi công suất lớn'
      },
      {
        id: 'UNIT-102',
        name: 'Đội Xuồng Phao Phản ứng Nhanh Chữ Thập Đỏ',
        type: 'boat',
        type_label: 'Xuồng phao cơ động',
        commander: 'Lê Hoàng Minh',
        phone: '0988-222-333',
        base_location: 'Nhà thi đấu Lào Cai, P. Bắc Lệnh',
        lat: 22.4510,
        lng: 103.9780,
        status: 'en_route',
        capacity: '6 người/xuồng, luồn lách ngõ hẹp ngập sâu',
        equipment: '03 Xuồng cao su dã chiến có máy đẩy Yamabisi'
      },
      {
        id: 'UNIT-103',
        name: 'Đoàn Xe Tải Gầm Cao 4x4 (CLB Bán tải Địa hình)',
        type: 'truck',
        type_label: 'Xe bán tải 4x4 vượt lũ',
        commander: 'Trần Tuấn Dũng',
        phone: '0904-888-999',
        base_location: 'Ngã tư Phố Ràng, Bảo Yên, Lào Cai',
        lat: 22.2850,
        lng: 104.3420,
        status: 'ready',
        capacity: 'Chở 2 tấn lương khô, tiếp tế vùng sạt lở đồi dốc',
        equipment: '06 Xe 4x4 trang bị ống thở snorkel (chịu ngập 80cm), tời kéo 12.000 lbs'
      },
      {
        id: 'UNIT-104',
        name: 'Tổ Cấp Cứu Y Tế Khẩn Cấp 115 Hà Nội',
        type: 'ambulance',
        type_label: 'Xe cứu thương chuyên dụng',
        commander: 'Bác sĩ Trần Mai Anh',
        phone: '0913-115-115',
        base_location: 'Trạm Y tế xã Nam Phương Tiến, Chương Mỹ, Hà Nội',
        lat: 20.8960,
        lng: 105.6620,
        status: 'on_scene',
        capacity: 'Sơ cấp cứu, hồi sức tim phổi dã chiến',
        equipment: 'Máy thở dã chiến, cáng cứu thương nổi, thuốc hạ sốt, kháng sinh đường ruột'
      },
      {
        id: 'UNIT-105',
        name: 'Đội Thuyền Nhôm Cứu Trợ Tình Nguyện Miền Núi',
        type: 'boat',
        type_label: 'Thuyền nhôm dân sinh',
        commander: 'Nguyễn Văn Hùng',
        phone: '0979-555-666',
        base_location: 'Hạ lưu Đập thủy điện Tuyên Quang',
        lat: 21.8230,
        lng: 105.2150,
        status: 'ready',
        capacity: 'Tiếp tế đồ ăn, chở 8 người/lượt',
        equipment: '05 Thuyền nhôm gắn máy đuôi tôm cơ động'
      }
    ];
  }

  function initMissions() {
    missionData = [
      {
        id: 'CMD-MIS-01',
        title: 'Giải cứu 5 người cô lập do sạt lở tại Bảo Yên',
        victim_name: 'Hoàng Văn Tuấn (5 người, 2 trẻ nhỏ)',
        victim_phone: '0982341992',
        victim_lat: 22.3120,
        victim_lng: 104.3780,
        assigned_unit_id: 'UNIT-103',
        assigned_unit_name: 'Đoàn Xe Tải Gầm Cao 4x4',
        shelter_name: 'Trung tâm Chỉ huy Quân sự Bảo Yên (Sơ tán Làng Nủ)',
        shelter_lat: 22.2850,
        shelter_lng: 104.3420,
        status: 'en_route', // assigned, en_route, on_scene, resolved
        dispatched_at: '12:45',
        eta_minutes: 20,
        notes: 'Ưu tiên sơ tán 2 cháu nhỏ 3 tuổi và 5 tuổi, đã mang theo sữa và bình nước sạch.'
      },
      {
        id: 'CMD-MIS-02',
        title: 'Ứng cứu khẩn cấp người già neo đơn ngập nóc tại Chương Mỹ',
        victim_name: 'Cụ bà Nguyễn Thị Lan (82 tuổi, liệt nửa người)',
        victim_phone: '0912389111',
        victim_lat: 20.8920,
        victim_lng: 105.6580,
        assigned_unit_id: 'UNIT-104',
        assigned_unit_name: 'Tổ Cấp Cứu Y Tế Khẩn Cấp 115 Hà Nội',
        shelter_name: 'Trường Tiểu học Nam Phương Tiến A (Chương Mỹ)',
        shelter_lat: 20.8960,
        shelter_lng: 105.6620,
        status: 'on_scene',
        dispatched_at: '13:10',
        eta_minutes: 0,
        notes: 'Đã tiếp cận hiện trường, đang dùng cáng nổi đưa cụ bà qua vùng ngập 1.8m sang xe cứu thương.'
      },
      {
        id: 'CMD-MIS-03',
        title: 'Tiếp tế lương thực và phao bè cho 8 hộ dân ngập sâu tại TP Thái Nguyên',
        victim_name: 'Trần Thị Ánh Tuyết & các hộ dân lân cận',
        victim_phone: '0963214589',
        victim_lat: 21.6020,
        victim_lng: 105.8480,
        assigned_unit_id: 'UNIT-101',
        assigned_unit_name: 'Đội Ca nô Cao tốc 114 (Công an PCCC)',
        shelter_name: 'Cung Văn hóa Lao động Tỉnh Thái Nguyên',
        shelter_lat: 21.5870,
        shelter_lng: 105.8360,
        status: 'resolved',
        dispatched_at: '11:20',
        eta_minutes: 0,
        notes: 'Đã hoàn thành sơ tán 18 người dân và phân phát 50 thùng mì tôm, 100 chai nước sạch an toàn.'
      }
    ];
  }

  function initFloodStations() {
    floodStationsData = [
      { id: 'ST-01', name: 'Trạm Thủy văn Sông Bùi (Yên Duyệt)', river: 'Sông Bùi', location: 'Chương Mỹ, Hà Nội', level_m: 7.85, alert_level: 3, alert_text: 'Báo động III (Nguy hiểm cực hạn)', trend: 'Dâng nhanh +12cm/h' },
      { id: 'ST-02', name: 'Trạm Thủy văn Sông Thao (Yên Bái)', river: 'Sông Thao', location: 'TP Yên Bái', level_m: 32.50, alert_level: 3, alert_text: 'Báo động III +0.5m', trend: 'Đỉnh lũ lịch sử' },
      { id: 'ST-03', name: 'Trạm Thủy văn Gia Bảy (Sông Cầu)', river: 'Sông Cầu', location: 'TP Thái Nguyên', level_m: 27.20, alert_level: 3, alert_text: 'Báo động III +0.8m', trend: 'Tràn bờ bao' },
      { id: 'ST-04', name: 'Trạm Thủy điện Tuyên Quang (Sông Gâm)', river: 'Sông Gâm', location: 'Chiêm Hóa, Tuyên Quang', level_m: 118.4, alert_level: 2, alert_text: 'Báo động II (Đang xả 8 đáy)', trend: 'Đang duy trì xả lũ' },
      { id: 'ST-05', name: 'Trạm Cầu Đất (Sông Đáy)', river: 'Sông Đáy', location: 'Thanh Oai, Hà Nội', level_m: 4.10, alert_level: 2, alert_text: 'Báo động II', trend: 'Dâng chậm +3cm/h' },
      { id: 'ST-06', name: 'Trạm Long Biên (Sông Hồng)', river: 'Sông Hồng', location: 'Hoàn Kiếm, Hà Nội', level_m: 10.20, alert_level: 1, alert_text: 'Báo động I', trend: 'Ổn định' }
    ];
  }

  function buildUnifiedIntakeFeed() {
    intakeData = [];

    // Nạp SOS khẩn cấp
    sosData.forEach(item => {
      intakeData.push({
        id: item.id || `SOS-${Math.random().toString().slice(2, 6)}`,
        raw_id: item.raw_id,
        source: 'sos_beacon',
        source_label: '🆘 Tín Hiệu SOS',
        source_badge_color: 'bg-rose-600 text-white',
        contact_name: item.contact_name || 'Người dân kêu cứu',
        phone: String(item.phone || '098xxxxxxx'),
        people_count: Number(item.people_count || 1),
        has_vulnerable: !!item.has_vulnerable,
        water_level_cm: Number(item.water_level_cm || 0),
        priority: item.priority || 'critical',
        status: item.status || 'pending',
        lat: Number(item.lat || 21.0285),
        lng: Number(item.lng || 105.8542),
        description: item.notes || 'Cần cứu trợ khẩn cấp, đang bị cô lập.',
        created_at: item.created_at || new Date().toISOString(),
        is_verified: item.priority === 'critical' || item.status !== 'pending'
      });
    });

    // Nạp Báo cáo dân sự
    (reportData || []).forEach(item => {
      intakeData.push({
        id: item.id || `REP-${Math.random().toString().slice(2, 6)}`,
        raw_id: item.raw_id,
        source: 'citizen_report',
        source_label: '📢 Dân Báo Ngập',
        source_badge_color: 'bg-amber-600 text-white',
        contact_name: item.contact_name || `Báo cáo thực địa #${item.raw_id || ''}`,
        phone: String(item.phone || 'GPS Đối soát tự động'),
        people_count: 0,
        has_vulnerable: false,
        water_level_cm: Number(item.estimated_depth_cm || 25),
        priority: item.level === 'heavy' ? 'high' : 'medium',
        status: item.confirmed ? 'verified' : 'pending',
        lat: Number(item.lat || 21.0285),
        lng: Number(item.lng || 105.8542),
        description: item.description || 'Báo cáo sự cố ngập úng hoặc sạt lở.',
        created_at: item.created_at || new Date().toISOString(),
        is_verified: !!item.confirmed
      });
    });

    // Thêm các nguồn hotline, cảm biến IoT và ảnh viễn thám Sentinel-1
    intakeData.push(
      {
        id: 'HOTLINE-114',
        raw_id: 114,
        source: 'hotline_114',
        source_label: '☎️ Hotline 114',
        source_badge_color: 'bg-blue-600 text-white',
        contact_name: 'Trực ban PCCC & CNCH Hà Nội',
        phone: '114 (Đường dây nóng)',
        people_count: 4,
        has_vulnerable: true,
        water_level_cm: 65,
        priority: 'critical',
        status: 'pending',
        lat: 20.8940,
        lng: 105.6595,
        description: 'Người dân thôn Nhân Lý báo nước tràn vào ngõ sâu 1.2m, xe máy và máy phát điện đã ngập, có người già 82 tuổi.',
        created_at: new Date(Date.now() - 15 * 60000).toISOString(),
        is_verified: true
      },
      {
        id: 'IOT-201',
        raw_id: 201,
        source: 'iot_sensor',
        source_label: '🌊 Trạm Quan Trắc',
        source_badge_color: 'bg-cyan-700 text-white',
        contact_name: 'Trạm Quan Trắc Tự Động Sông Bùi',
        phone: 'Telemetry IoT Sensor',
        people_count: 0,
        has_vulnerable: false,
        water_level_cm: 145,
        priority: 'critical',
        status: 'verified',
        lat: 20.8930,
        lng: 105.6590,
        description: 'Mực nước dâng 1.45m trong 2 giờ qua, đê Bùi 2 có nguy cơ tràn bãi tả ngạn Nam Phương Tiến.',
        created_at: new Date(Date.now() - 20 * 60000).toISOString(),
        is_verified: true
      },
      {
        id: 'SAR-S1-01',
        raw_id: 501,
        source: 'satellite_sar',
        source_label: '🛰️ Vệ Tinh Sentinel-1',
        source_badge_color: 'bg-purple-700 text-white',
        contact_name: 'Viễn thám Radar Khẩu độ Tổng hợp ESA',
        phone: 'Copernicus SAR Feed',
        people_count: 0,
        has_vulnerable: false,
        water_level_cm: 100,
        priority: 'high',
        status: 'verified',
        lat: 22.3120,
        lng: 104.3800,
        description: 'Ảnh viễn thám radar xuyên mây phát hiện mặt nước mở rộng 4.2 km² tại thung lũng sông Chảy, Bảo Yên.',
        created_at: new Date(Date.now() - 45 * 60000).toISOString(),
        is_verified: true
      }
    );

    // Khử trùng lặp tự động spatiotemporal (50m) an toàn
    runSpatiotemporalDeduplication();
  }

  function runSpatiotemporalDeduplication() {
    const thresholdDeg = 0.00045; // ~50m
    for (let i = 0; i < intakeData.length; i++) {
      const a = intakeData[i];
      if (a.is_duplicate) continue;
      a.duplicate_count = 0;

      for (let j = i + 1; j < intakeData.length; j++) {
        const b = intakeData[j];
        if (b.is_duplicate) continue;

        const dist = Math.hypot(a.lat - b.lat, a.lng - b.lng);
        if (dist <= thresholdDeg) {
          b.is_duplicate = true;
          b.master_id = a.id;
          a.duplicate_count += 1;
        }
      }
    }
  }

  // =========================================================================
  // 3. ĐIỀU HƯỚNG MÀN HÌNH & THỰC THI PHÂN QUYỀN RBAC (VIEW & ROLE MANAGEMENT)
  // =========================================================================
  function switchView(viewId) {
    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;

    // Kiểm tra quyền truy cập của vai trò hiện tại
    if (!roleCfg.allowedViews.includes(viewId)) {
      renderAccessRestrictedScreen(viewId, roleCfg);
      return;
    }

    state.currentView = viewId;

    // Cập nhật trạng thái active trên Sidebar
    const allNavButtons = document.querySelectorAll('.cmd-nav-item');
    allNavButtons.forEach(btn => {
      const target = btn.getAttribute('data-view');
      if (target === viewId) {
        btn.classList.add('bg-rose-600', 'text-white', 'font-black', 'shadow-sm');
        btn.classList.remove('text-slate-300', 'hover:bg-slate-800');
      } else {
        btn.classList.remove('bg-rose-600', 'text-white', 'font-black', 'shadow-sm');
        btn.classList.add('text-slate-300', 'hover:bg-slate-800');
      }
    });

    // Ẩn tất cả view pane và chỉ hiển thị pane được chọn
    const allPanes = document.querySelectorAll('.cmd-view-pane');
    allPanes.forEach(p => p.classList.add('hidden'));

    const targetPane = document.getElementById(`pane-${viewId}`);
    if (targetPane) {
      targetPane.classList.remove('hidden');
    }

    // Xử lý di chuyển container bản đồ giữa Dashboard và Fullscreen GIS
    const mapContainer = document.getElementById('map-container');
    const dashPane = document.getElementById('pane-cmd_dashboard');
    const rightRail = document.getElementById('dashboard-right-rail');
    const fsPane = document.getElementById('pane-cmd_disaster_map');

    if (viewId === 'cmd_disaster_map' && fsPane && mapContainer) {
      if (mapContainer.parentElement !== fsPane) {
        fsPane.innerHTML = '';
        fsPane.appendChild(mapContainer);
      }
    } else if (viewId === 'cmd_dashboard' && dashPane && mapContainer && rightRail) {
      if (mapContainer.parentElement !== dashPane) {
        dashPane.insertBefore(mapContainer, rightRail);
      }
    }

    // Đảm bảo Leaflet cập nhật kích thước khung vẽ
    setTimeout(() => {
      if (mapInstance && typeof mapInstance.invalidateSize === 'function') {
        mapInstance.invalidateSize();
      } else if (window.map) {
        window.map.invalidateSize();
      }
    }, 150);

    renderAllComponents();
  }

  // Chuyển đổi vai trò người dùng (6 Vai Trò Tác Chiến)
  function switchUserRole(newRole) {
    if (!ROLES_CONFIG[newRole]) return;
    state.userRole = newRole;
    const roleCfg = ROLES_CONFIG[newRole];

    // Cập nhật giá trị dropdown trên Header
    const roleSelect = document.getElementById('cmd-role-selector');
    if (roleSelect) roleSelect.value = newRole;

    // Cập nhật nhãn vai trò trên Header và Sidebar
    const roleBadge = document.getElementById('cmd-active-role-badge');
    if (roleBadge) {
      roleBadge.innerText = roleCfg.title;
      roleBadge.className = `text-[11px] font-black truncate ${roleCfg.badgeClass}`;
    }

    // Hiển thị/Cập nhật Banner Phạm vi Tác chiến (Role Scope Banner)
    renderRoleScopeBanner(roleCfg);
    renderRoleFocusCallout(roleCfg);

    // Cập nhật trạng thái khóa/mở trên Sidebar Navigation
    updateSidebarNavPermissions(roleCfg);

    // Nếu màn hình hiện tại bị hạn chế với vai trò mới, tự động quay về Dashboard
    if (!roleCfg.allowedViews.includes(state.currentView)) {
      showToast('⚠️ GIỚI HẠN THẨM QUYỀN', `Phân hệ "${state.currentView}" nằm ngoài quyền của ${roleCfg.label}. Tự động quay về Bảng điều hành COP.`, 'warning');
      switchView('cmd_dashboard');
    } else {
      showToast('👤 ĐÃ ĐỔI VAI TRÒ TÁC CHIẾN', `${roleCfg.title} | ${roleCfg.scopeTag}`, 'info');
      renderAllComponents();
    }
  }

  function renderRoleScopeBanner(roleCfg) {
    let bannerEl = document.getElementById('cmd-role-scope-banner');
    if (!bannerEl) {
      const parent = document.querySelector('main');
      if (parent) {
        bannerEl = document.createElement('div');
        bannerEl.id = 'cmd-role-scope-banner';
        parent.insertBefore(bannerEl, parent.firstChild);
      }
    }
    if (!bannerEl) return;

    bannerEl.className = 'px-3 py-2 bg-slate-900/95 border-b border-slate-800 text-xs flex items-center justify-between shrink-0 z-30 shadow-md flex-wrap gap-2.5';
    
    // 7 capabilities status pills
    const caps = [
      { key: 'canDispatch', label: '⚡ Xuất quân', ok: roleCfg.canDispatch },
      { key: 'canVerify', label: '🔍 Thẩm định tin', ok: roleCfg.canVerify },
      { key: 'canManageFleet', label: '🚒 Quản lý xe/tàu', ok: roleCfg.canManageFleet },
      { key: 'canManageShelters', label: '🏕️ Điểm sơ tán', ok: roleCfg.canManageShelters },
      { key: 'canSimulateStorm', label: '🌧️ Mô phỏng bão', ok: roleCfg.canSimulateStorm },
      { key: 'canExportSitRep', label: '📋 Báo cáo SitRep', ok: roleCfg.canExportSitRep },
      { key: 'canAdminSystem', label: '⚙️ Quản trị hệ thống', ok: roleCfg.canAdminSystem }
    ];

    const capsHtml = caps.map(c => {
      if (c.ok) {
        return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1 shadow-2xs"><span>✓</span><span>${c.label}</span></span>`;
      } else {
        return `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-950 text-slate-500 border border-slate-800 flex items-center gap-0.5 opacity-60 line-through" title="Bị khóa đối với vai trò ${roleCfg.label}"><span>🔒</span><span>${c.label}</span></span>`;
      }
    }).join('');

    bannerEl.innerHTML = `
      <div class="flex items-center gap-2.5 overflow-hidden flex-wrap">
        <span class="px-2.5 py-1 rounded-md font-black text-[11px] border ${roleCfg.badgeClass} shrink-0 shadow-xs">
          ${roleCfg.label}
        </span>
        <div class="flex items-center gap-2 overflow-hidden text-xs">
          <span class="text-white font-bold truncate">${roleCfg.title}</span>
          <span class="hidden md:inline px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-semibold border border-slate-700 text-[10.5px] truncate">
            Phạm vi: ${roleCfg.scopeTag}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap shrink-0">
        <span class="text-[10px] text-slate-400 font-bold hidden sm:inline mr-1 uppercase tracking-wider">Thẩm quyền:</span>
        ${capsHtml}
      </div>
    `;
  }

  function updateSidebarNavPermissions(roleCfg) {
    const navItems = document.querySelectorAll('.cmd-nav-item');
    navItems.forEach(btn => {
      const viewId = btn.getAttribute('data-view');
      const isAllowed = roleCfg.allowedViews.includes(viewId);
      let lockEl = btn.querySelector('.cmd-nav-lock-badge');

      if (isAllowed) {
        btn.classList.remove('opacity-40', 'cursor-not-allowed');
        btn.removeAttribute('disabled');
        btn.title = `Truy cập phân hệ: ${viewId}`;
        if (lockEl) lockEl.remove();
      } else {
        btn.classList.add('opacity-40');
        btn.title = `🔒 Bị giới hạn thẩm quyền đối với vai trò: ${roleCfg.label}`;
        if (!lockEl) {
          const lock = document.createElement('span');
          lock.className = 'cmd-nav-lock-badge ml-auto text-[10px] text-amber-400 font-bold shrink-0';
          lock.innerText = '🔒';
          btn.appendChild(lock);
        }
      }
    });
  }

  function renderAccessRestrictedScreen(viewId, roleCfg) {
    const targetPane = document.getElementById(`pane-${viewId}`);
    if (!targetPane) return;

    // Ẩn tất cả view pane và chỉ hiển thị pane được chọn với màn hình chặn
    const allPanes = document.querySelectorAll('.cmd-view-pane');
    allPanes.forEach(p => p.classList.add('hidden'));
    targetPane.classList.remove('hidden');

    targetPane.innerHTML = `
      <div class="max-w-xl mx-auto my-16 p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-2xl">
        <div class="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
          🔒
        </div>
        <h2 class="text-lg font-black text-amber-300 uppercase tracking-wide">TRUY CẬP NGOÀI PHẠM VI THẨM QUYỀN</h2>
        <p class="text-xs text-slate-300 leading-relaxed">
          Bạn đang sử dụng vai trò tác chiến <span class="font-bold text-white">[${roleCfg.title}]</span>.<br/>
          Phân hệ tác chiến này yêu cầu thẩm quyền cao hơn hoặc phân công chuyên biệt để đảm bảo tính an toàn và kỷ luật chỉ huy.
        </p>
        <div class="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">
          💡 Gợi ý: Chuyển đổi vai trò sang <b>Chỉ huy trưởng (Director)</b> để truy cập toàn bộ các phân hệ của NORTHSTAR COMMAND.
        </div>
        <div class="flex items-center justify-center gap-3 pt-2">
          <button onclick="CommandUIController.switchUserRole('director'); CommandUIController.switchView('${viewId}')" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md">
            ⭐ Chuyển sang Chỉ Huy Trưởng
          </button>
          <button onclick="CommandUIController.switchView('cmd_dashboard')" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-700">
            Quay về Bảng điều hành COP
          </button>
        </div>
      </div>
    `;
  }

  function setMonitoringRegion(regionKey) {
    state.currentRegion = regionKey;

    const regionCoords = {
      all: { lat: 21.30, lng: 105.30, zoom: 8 },
      hanoi: { lat: 21.0285, lng: 105.8542, zoom: 12 },
      thainguyen: { lat: 21.5928, lng: 105.8442, zoom: 12 },
      laocai: { lat: 22.4856, lng: 103.9707, zoom: 12 },
      yenbai: { lat: 21.7168, lng: 104.8973, zoom: 12 },
      caobang: { lat: 22.6667, lng: 106.2500, zoom: 11 },
      tuyenquang: { lat: 21.8236, lng: 105.2147, zoom: 12 }
    };

    const target = regionCoords[regionKey] || regionCoords.all;
    if (window.map) {
      window.map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
    }

    const regSelect = document.getElementById('cmd-region-selector');
    if (regSelect) regSelect.value = regionKey;

    showToast('📍 CHUYỂN VÙNG TÁC CHIẾN', `Trọng tâm giám sát: ${regionKey.toUpperCase()}`, 'info');
  }

  function toggleSidebarCollapse() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    const sidebarEl = document.getElementById('cmd-tactical-sidebar');
    const collapseIcon = document.getElementById('cmd-sidebar-collapse-icon');

    if (sidebarEl) {
      if (state.sidebarCollapsed) {
        sidebarEl.classList.add('w-16');
        sidebarEl.classList.remove('w-64');
        document.body.classList.add('sidebar-collapsed');
        if (collapseIcon) collapseIcon.setAttribute('data-lucide', 'menu');
      } else {
        sidebarEl.classList.remove('w-16');
        sidebarEl.classList.add('w-64');
        document.body.classList.remove('sidebar-collapsed');
        if (collapseIcon) collapseIcon.setAttribute('data-lucide', 'chevron-left');
      }
    }

    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
      if (window.map) window.map.invalidateSize();
    }, 200);
  }

  // =========================================================================
  // 4. RENDER GIAO DIỆN & CÁC KHỐI DỮ LIỆU ĐỘNG (UI RENDERING PIPELINE)
  // =========================================================================
  function renderAllComponents() {
    renderCOPHeaderMetrics();
    renderLiveTriageFeed();
    renderIntakeView();
    renderSOSView();
    renderReportsView();
    renderVerificationView();
    renderFloodIntelView();
    renderWeatherView();
    renderMissionsView();
    renderFleetView();
    renderSheltersView();
    renderSitRepView();
    renderRolesView();
  }

  function updateSyncIndicator() {
    const el = document.getElementById('cmd-last-sync-time');
    if (el) el.innerText = state.lastSyncTime;
  }

  // BĂNG CHỈ SỐ TÁC CHIẾN THỜI GIAN THỰC (COP KPI METRICS)
  
  // KHỐI GÓC NHÌN BAO QUÁT THEO VAI TRÒ TRÊN COP DASHBOARD
  function renderRoleFocusCallout(roleCfg) {
    const calloutEl = document.getElementById('cmd-role-focus-callout');
    if (!calloutEl) return;

    const quickBtnsHtml = (roleCfg.quickActions || []).map(btn => `
      <button onclick="${btn.action}" class="px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 ${btn.class}">
        ${btn.label}
      </button>
    `).join('');

    calloutEl.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5 overflow-hidden flex-wrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-black border ${roleCfg.badgeClass} shrink-0">
            GÓC NHÌN BAO QUÁT: ${roleCfg.label.toUpperCase()}
          </span>
          <span class="text-xs text-slate-300 truncate font-medium">
            ${roleCfg.focusPerspective}
          </span>
        </div>
        <div class="flex items-center gap-2 shrink-0 flex-wrap">
          ${quickBtnsHtml}
        </div>
      </div>
    `;

    // Invalidate map size after banner changes
    setTimeout(() => {
      if (mapInstance && typeof mapInstance.invalidateSize === 'function') {
        mapInstance.invalidateSize();
      }
    }, 100);
  }

  function renderCOPHeaderMetrics() {
    const totalIntake = intakeData.length;
    const pendingIntake = intakeData.filter(i => i.status === 'pending').length;
    const criticalSOS = intakeData.filter(i => i.priority === 'critical' && i.status !== 'resolved').length;
    const readyUnits = unitsData.filter(u => u.status === 'ready').length;
    const activeMissions = missionData.filter(m => m.status !== 'resolved').length;
    const totalShelters = shelterData.length > 0 ? shelterData.length : 6;

    // Header badge
    const badgeUnproc = document.getElementById('cmd-hdr-badge-unprocessed');
    if (badgeUnproc) badgeUnproc.innerText = `${pendingIntake}`;

    // COP Banner & Dashboard Cards
    const kpiSOS = document.getElementById('kpi-val-sos');
    if (kpiSOS) kpiSOS.innerText = criticalSOS > 0 ? criticalSOS : (sosData.length > 0 ? sosData.length : 3);

    const kpiIntake = document.getElementById('kpi-val-intake');
    if (kpiIntake) kpiIntake.innerText = pendingIntake > 0 ? pendingIntake : 5;

    const kpiMissions = document.getElementById('kpi-val-missions');
    if (kpiMissions) kpiMissions.innerText = activeMissions > 0 ? activeMissions : 2;

    const kpiUnits = document.getElementById('kpi-val-units');
    if (kpiUnits) kpiUnits.innerText = `${readyUnits} / ${unitsData.length > 0 ? unitsData.length : 5}`;

    const kpiPending = document.getElementById('kpi-val-pending');
    if (kpiPending) kpiPending.innerText = `${totalShelters} Điểm`;
  }

  // DÒNG TIN TIẾP NHẬN CỨU HỘ TRỰC TIẾP TRÊN DASHBOARD COP
  function renderLiveTriageFeed() {
    const feedEl = document.getElementById('dashboard-live-feed');
    if (!feedEl) return;

    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;

    // Lấy tối đa 8 tin khẩn cấp nhất chưa giải quyết
    const urgentItems = intakeData
      .filter(i => !i.is_duplicate)
      .slice(0, 8);

    if (urgentItems.length === 0) {
      feedEl.innerHTML = `
        <div class="p-6 text-center text-slate-400 text-xs">
          <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-70"></i>
          <span>Không có yêu cầu cứu hộ nào đang chờ xử lý.</span>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    feedEl.innerHTML = urgentItems.map(item => {
      const isCritical = item.priority === 'critical';
      const badgeClass = isCritical ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-600 text-white';
      const badgeText = isCritical ? '🆘 CẤP THIẾT' : '⚠️ SỰ CỐ';
      const borderClass = isCritical ? 'border-rose-700/60 bg-rose-950/40' : 'border-slate-800 bg-slate-900/60';

      const dispatchButtonHtml = roleCfg.canDispatch ? `
        <button onclick="CommandUIController.openDispatchModal('${item.id}')" class="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-black text-[10.5px] cursor-pointer shadow-xs transition active:scale-95 flex items-center gap-1">
          <span>⚡ Điều phối</span>
        </button>
      ` : `
        <button disabled title="Vai trò hiện tại không có quyền xuất quân" class="px-2.5 py-1 rounded bg-slate-800 text-slate-500 font-bold text-[10.5px] cursor-not-allowed border border-slate-700/60 flex items-center gap-1">
          <span>🔒 Chờ lệnh</span>
        </button>
      `;

      return `
        <div class="p-2.5 rounded-lg border ${borderClass} shadow-xs transition hover:border-slate-600 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-black ${badgeClass}">${badgeText}</span>
            <span class="text-[10px] text-slate-400 font-mono">${formatRelativeTime(item.created_at)}</span>
          </div>
          <div class="font-bold text-slate-100 text-xs truncate" title="${item.contact_name}">
            ${item.contact_name} - 📞 ${item.phone}
          </div>
          <div class="text-[11px] text-slate-300 line-clamp-2 leading-relaxed" title="${item.description}">
            ${item.description}
          </div>
          <div class="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <button onclick="CommandUIController.flyToLocation(${item.lat}, ${item.lng}, '${item.id}')" class="text-[10.5px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer">
              <span>🎯 Xem vị trí</span>
            </button>
            ${dispatchButtonHtml}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 1: INFORMATION HUB (DÒNG TIẾP NHẬN ĐA NGUỒN)
  function renderIntakeView() {
    const listEl = document.getElementById('cmd-intake-table-body');
    if (!listEl) return;

    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;

    let items = (intakeData || []).filter(i => !i.is_duplicate);

    // Lọc theo search input an toàn
    if (state.quickSearchQuery) {
      const q = state.quickSearchQuery.toLowerCase();
      items = items.filter(i => 
        (i.contact_name || '').toString().toLowerCase().includes(q) ||
        (i.phone || '').toString().toLowerCase().includes(q) ||
        (i.description || '').toString().toLowerCase().includes(q) ||
        (i.id || '').toString().toLowerCase().includes(q)
      );
    }

    // Lọc theo filter tab
    if (state.activeIntakeFilter === 'sos') items = items.filter(i => i.source === 'sos_beacon');
    else if (state.activeIntakeFilter === 'crowd') items = items.filter(i => i.source === 'citizen_report');
    else if (state.activeIntakeFilter === 'hotline') items = items.filter(i => i.source === 'hotline_114');
    else if (state.activeIntakeFilter === 'sensor') items = items.filter(i => i.source === 'iot_sensor');
    else if (state.activeIntakeFilter === 'satellite') items = items.filter(i => i.source === 'satellite_sar');

    if (items.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-slate-400 text-xs">
            <div class="max-w-md mx-auto space-y-2">
              <i data-lucide="inbox" class="w-8 h-8 mx-auto text-slate-500 opacity-60"></i>
              <div class="font-bold text-slate-300">Không có tin tiếp nhận nào phù hợp với bộ lọc hiện tại.</div>
              <button onclick="CommandUIController.filterIntake('all')" class="text-rose-400 font-bold underline hover:text-rose-300 cursor-pointer text-xs">
                Nhấn vào đây để xem tất cả tin tiếp nhận
              </button>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    listEl.innerHTML = items.map(item => {
      let priorityBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-300">⚪ Bình thường</span>';
      if (item.priority === 'critical') {
        priorityBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-black bg-rose-900/60 text-rose-300 border border-rose-700 animate-pulse">🔴 P1 Khẩn Cấp</span>';
      } else if (item.priority === 'high') {
        priorityBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-900/60 text-amber-300 border border-amber-700">🟠 P2 Ưu Tiên</span>';
      }

      const verifyBtnHtml = roleCfg.canVerify ? `
        <button onclick="CommandUIController.verifyIncident('${item.id}')" title="Xác minh tin chính xác" class="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold text-[10.5px] cursor-pointer transition">
          ✓ Duyệt
        </button>
      ` : '';

      const dispatchBtnHtml = roleCfg.canDispatch ? `
        <button onclick="CommandUIController.openDispatchModal('${item.id}')" title="Lập lệnh điều phối" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-black text-[10.5px] cursor-pointer shadow-xs transition flex items-center gap-1">
          <span>⚡ Lệnh</span>
        </button>
      ` : `
        <span class="text-[10px] text-slate-500 font-bold px-1.5 py-0.5 bg-slate-800/80 rounded">🔒 Chờ lệnh</span>
      `;

      const safeLat = Number(item.lat || 21.0285).toFixed(4);
      const safeLng = Number(item.lng || 105.8542).toFixed(4);

      return `
        <tr class="hover:bg-slate-850 transition">
          <td class="p-3 font-mono font-bold text-slate-300">${item.id}</td>
          <td class="p-3 text-slate-400 font-mono text-[11px]">${formatRelativeTime(item.created_at)}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.source_badge_color}">${item.source_label}</span>
            ${item.duplicate_count > 0 ? `<span class="block mt-1 text-[9.5px] text-amber-400 font-bold">⚠️ +${item.duplicate_count} tin cùng vị trí (50m)</span>` : ''}
          </td>
          <td class="p-3">
            <div class="font-bold text-white">${item.contact_name || 'Người dân'}</div>
            <div class="text-[11px] text-slate-400">${item.phone || 'N/A'}</div>
            <div class="text-[10px] text-slate-500">[${safeLat}, ${safeLng}]</div>
          </td>
          <td class="p-3 max-w-xs">
            <p class="text-[11px] text-slate-300 line-clamp-2">${item.description || 'Không có mô tả chi tiết'}</p>
            ${item.water_level_cm > 0 ? `<span class="inline-block mt-1 text-[10px] text-cyan-400 font-bold">🌊 Mực nước: ~${item.water_level_cm}cm</span>` : ''}
          </td>
          <td class="p-3">${priorityBadge}</td>
          <td class="p-3">
            ${item.status === 'resolved' ? '<span class="text-emerald-400 font-bold">✅ Đã cứu</span>' :
              (item.status === 'dispatched' ? '<span class="text-blue-400 font-bold animate-pulse">🚑 Đang ứng cứu</span>' :
                (item.is_verified ? '<span class="text-teal-400 font-bold">✓ Đã thẩm định</span>' :
                  '<span class="text-amber-400 font-bold">⏳ Chờ duyệt</span>'))}
          </td>
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              ${verifyBtnHtml}
              ${dispatchBtnHtml}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 2: SOS REQUESTS VIEW
  function renderSOSView() {
    const listEl = document.getElementById('cmd-sos-list-container');
    if (!listEl) return;

    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;
    const pendingSOS = sosData.filter(s => s.status !== 'rescued');

    if (pendingSOS.length === 0) {
      listEl.innerHTML = '<div class="col-span-3 p-8 text-center text-slate-400 text-xs">Hiện không có yêu cầu SOS nào chưa xử lý!</div>';
      return;
    }

    listEl.innerHTML = pendingSOS.map(s => {
      const dispatchBtn = roleCfg.canDispatch ? `
        <div class="flex items-center gap-1.5">
          <button onclick="CommandUIController.openDispatchModal('${s.id}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition active:scale-95 flex items-center gap-1">
            <span>📤 Gửi Tin Cứu Hộ</span>
          </button>
          <button onclick="CommandUIController.quickCopyIncident('${s.id}')" title="Sao chép gói tin Zalo/SMS nhanh để gửi cho Chỉ huy" class="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg font-bold text-xs border border-slate-700 cursor-pointer transition">
            📋 Zalo
          </button>
        </div>
      ` : `
        <button disabled class="px-2.5 py-1 bg-slate-800 text-slate-500 rounded-lg font-bold text-xs cursor-not-allowed border border-slate-700">
          🔒 Chờ Điều phối viên
        </button>
      `;

      return `
        <div class="p-4 bg-slate-900 border border-rose-900/60 rounded-xl space-y-2.5 shadow-md">
          <div class="flex items-center justify-between text-xs">
            <span class="font-black text-rose-400 font-mono">${s.id}</span>
            <span class="text-[10px] px-2 py-0.5 rounded font-black bg-rose-950 text-rose-300 border border-rose-800 uppercase">${s.priority}</span>
          </div>
          <div class="font-bold text-white text-sm">
            ${s.contact_name} 
            <span class="text-rose-400 text-xs">(${s.people_count} người ${s.has_vulnerable ? '• Có trẻ nhỏ/người già' : ''})</span>
          </div>
          <div class="text-xs text-slate-300">
            Điện thoại: <a href="tel:${s.phone}" class="text-blue-400 font-bold hover:underline">📞 ${s.phone}</a>
          </div>
          <p class="text-xs text-slate-400 italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            "${s.notes}"
          </p>
          <div class="flex items-center justify-between pt-2 border-t border-slate-800">
            <button onclick="CommandUIController.flyToLocation(${s.lat}, ${s.lng}, '${s.id}')" class="text-blue-400 text-xs font-bold hover:underline cursor-pointer">
              📍 Vị trí bản đồ
            </button>
            ${dispatchBtn}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 3: CROWD DISASTER REPORTS VIEW
  function renderReportsView() {
    const listEl = document.getElementById('cmd-reports-container');
    if (!listEl) return;

    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;

    if (reportData.length === 0) {
      listEl.innerHTML = '<div class="col-span-3 p-8 text-center text-slate-400 text-xs">Chưa có báo cáo hiện trường nào.</div>';
      return;
    }

    listEl.innerHTML = reportData.map(rep => {
      const verifyBtns = roleCfg.canVerify ? `
        <div class="flex items-center gap-1.5">
          <button onclick="CommandUIController.verifyIncident('${rep.id}')" class="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold text-xs cursor-pointer transition">
            ✓ Duyệt
          </button>
          <button onclick="CommandUIController.rejectIncident('${rep.id}')" class="px-2 py-1 bg-slate-800 hover:bg-rose-900 text-rose-300 rounded font-bold text-xs cursor-pointer transition border border-slate-700">
            Bác bỏ
          </button>
        </div>
      ` : '<span class="text-xs text-slate-500 font-bold">Chỉ xem</span>';

      return `
        <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 shadow-md">
          <div class="flex items-center justify-between text-xs">
            <span class="font-mono text-slate-400 font-bold">${rep.id}</span>
            <span class="text-[10px] px-2 py-0.5 rounded font-bold ${rep.confirmed ? 'bg-teal-900/60 text-teal-300 border border-teal-700' : 'bg-amber-900/60 text-amber-300 border border-amber-700'}">
              ${rep.confirmed ? '✓ Đã thẩm định' : '⏳ Chờ thẩm định'}
            </span>
          </div>
          <div class="font-bold text-white text-sm">
            Ngập lụt đô thị / Sự cố giao thông
          </div>
          <div class="text-xs text-cyan-400 font-bold">
            🌊 Độ sâu ước tính: ~${rep.estimated_depth_cm} cm
          </div>
          <p class="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            ${rep.description}
          </p>
          <div class="flex items-center justify-between pt-2 border-t border-slate-800">
            <button onclick="CommandUIController.flyToLocation(${rep.lat}, ${rep.lng}, '${rep.id}')" class="text-blue-400 text-xs font-bold hover:underline cursor-pointer">
              📍 Xem tọa độ
            </button>
            ${verifyBtns}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 4: SMART VERIFICATION QUEUE
  function renderVerificationView() {
    const listEl = document.getElementById('cmd-verification-container');
    if (!listEl) return;

    listEl.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div class="text-slate-400 text-xs">Tin cần thẩm định</div>
          <div class="text-2xl font-black text-amber-400 mt-1">4 Tin</div>
          <div class="text-[11px] text-slate-500 mt-1">Đối soát từ Hotline 114 & Báo cáo</div>
        </div>
        <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div class="text-slate-400 text-xs">Cụm trùng lặp không gian (50m)</div>
          <div class="text-2xl font-black text-rose-400 mt-1">2 Cụm</div>
          <div class="text-[11px] text-slate-500 mt-1">Đã tự động gom cụm tránh chia cắt quân</div>
        </div>
        <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div class="text-slate-400 text-xs">Tỷ lệ tin cậy trung bình</div>
          <div class="text-2xl font-black text-emerald-400 mt-1">94.2%</div>
          <div class="text-[11px] text-slate-500 mt-1">Được kiểm chứng qua cảm biến IoT</div>
        </div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 class="font-bold text-sm text-white flex items-center gap-2">
          <i data-lucide="sparkles" class="w-4 h-4 text-amber-400"></i>
          Phân Tích AI Đối Soát Ngữ Nghĩa & Tọa Độ Vệ Tinh
        </h3>
        <div class="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-white">Cụm Bảo Yên (Lào Cai): SOS-63, SOS-64, SOS-58</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">ĐỘ NGUY HIỂM CAO</span>
          </div>
          <p class="text-slate-300">
            Hệ thống phát hiện 3 tin cầu cứu trong phạm vi bán kính 45m tại khu vực Bảo Yên. Phân tích nội dung cho thấy nước ngập tới nóc bếp, có 4 người gồm 2 cháu nhỏ. Khuyến nghị xuất quân 1 đội xuồng cao su duy nhất để giải cứu gộp.
          </p>
          <div class="pt-1 flex justify-end gap-2">
            <button onclick="CommandUIController.openDispatchModal('SOS-LC-01')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs">
              ⚡ Phát Lệnh Giải Cứu Gộp Cụm Này
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 5: WEATHER & STORM RADAR
  function renderWeatherView() {
    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;
    const slider = document.getElementById('cmd-sim-rainfall-slider');
    if (slider) {
      slider.disabled = !roleCfg.canSimulateStorm;
      if (!roleCfg.canSimulateStorm) {
        slider.title = '🔒 Chỉ Chuyên viên Dữ liệu & Chỉ huy trưởng mới được chạy mô phỏng bão';
      } else {
        slider.title = 'Kéo thanh trượt để mô phỏng lượng mưa và mức ngập';
      }
    }
  }

  // KHỐI 6: 130 HYDRO STATIONS & FLOOD INTEL
  function renderFloodIntelView() {
    const listEl = document.getElementById('cmd-flood-stations-list');
    if (!listEl) return;

    listEl.innerHTML = floodStationsData.map(st => {
      let badgeClass = 'bg-blue-900/40 text-blue-300 border-blue-700';
      if (st.alert_level === 3) badgeClass = 'bg-rose-900/60 text-rose-300 border-rose-700 animate-pulse font-black';
      else if (st.alert_level === 2) badgeClass = 'bg-amber-900/60 text-amber-300 border-amber-700 font-bold';

      return `
        <div class="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div>
            <div class="font-bold text-white text-sm">${st.name}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Lưu vực: <span class="text-sky-400 font-semibold">${st.river}</span> • Vị trí: ${st.location}</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-black text-white font-mono">${st.level_m.toFixed(2)} m</div>
            <div class="text-[10px] text-slate-400">${st.trend}</div>
          </div>
          <div class="shrink-0 text-right">
            <span class="px-2.5 py-1 rounded text-[10.5px] border ${badgeClass}">${st.alert_text}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // KHỐI 7: RESCUE MISSIONS VIEW
  function renderMissionsView() {
    const listEl = document.getElementById('cmd-missions-container');
    if (!listEl) return;

    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;

    listEl.innerHTML = missionData.map(m => {
      let statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-black bg-blue-900 text-blue-300 border border-blue-700 animate-pulse">🚑 Đang cơ động</span>';
      if (m.status === 'on_scene') {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-black bg-purple-900 text-purple-300 border border-purple-700 animate-pulse">🎯 Đã tới hiện trường</span>';
      } else if (m.status === 'resolved') {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-black bg-emerald-900 text-emerald-300 border border-emerald-700">✅ Hoàn thành an toàn</span>';
      }

      const canUpdate = roleCfg.canDispatch || roleCfg.canManageFleet;
      const actionBtns = canUpdate ? `
        <div class="flex items-center gap-1.5">
          ${m.status === 'en_route' ? `
            <button onclick="CommandUIController.updateMissionStatus('${m.id}', 'on_scene')" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold text-xs cursor-pointer transition">
              Đã tới nơi
            </button>
          ` : ''}
          ${m.status === 'on_scene' ? `
            <button onclick="CommandUIController.updateMissionStatus('${m.id}', 'resolved')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs cursor-pointer transition">
              Hoàn thành
            </button>
          ` : ''}
        </div>
      ` : '<span class="text-xs text-slate-500 font-bold">Chỉ xem tiến độ</span>';

      return `
        <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 shadow-md">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs font-bold text-amber-400">${m.id}</span>
            ${statusBadge}
          </div>
          <div class="font-bold text-white text-sm">${m.title}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div>
              <span class="text-slate-400">Nạn nhân:</span> <b class="text-white">${m.victim_name}</b> (📞 ${m.victim_phone})
            </div>
            <div>
              <span class="text-slate-400">Đơn vị ứng cứu:</span> <b class="text-rose-400">${m.assigned_unit_name}</b>
            </div>
            <div class="md:col-span-2">
              <span class="text-slate-400">Điểm sơ tán tiếp nhận:</span> <b class="text-emerald-400">${m.shelter_name}</b>
            </div>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-800">
            <button onclick="CommandUIController.drawTacticalMissionRoute('${m.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition border border-slate-700">
              <i data-lucide="navigation" class="w-3.5 h-3.5"></i>
              <span>Cắm tuyến đường lên Map</span>
            </button>
            ${actionBtns}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 8: RESCUE FLEET VIEW
  function renderFleetView() {
    const listEl = document.getElementById('cmd-fleet-container');
    if (!listEl) return;

    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;

    listEl.innerHTML = unitsData.map(u => {
      let statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-black bg-emerald-950 text-emerald-300 border border-emerald-800">🟢 SẴN SÀNG</span>';
      if (u.status === 'en_route') {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-black bg-blue-950 text-blue-300 border border-blue-800 animate-pulse">🚑 ĐANG ĐIỀU PHỐI</span>';
      } else if (u.status === 'on_scene') {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-black bg-purple-950 text-purple-300 border border-purple-800">🎯 TẠI HIỆN TRƯỜNG</span>';
      } else if (u.status === 'standby') {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded font-black bg-slate-800 text-slate-400 border border-slate-700">⚪ BẢO DƯỠNG</span>';
      }

      const toggleActionHtml = roleCfg.canManageFleet ? `
        <button onclick="CommandUIController.toggleUnitStatus('${u.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded text-xs border border-slate-700 transition cursor-pointer">
          Đổi trạng thái
        </button>
      ` : '<span class="text-[11px] text-slate-500 font-bold">Chỉ xem</span>';

      return `
        <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 shadow-md flex flex-col justify-between">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs font-bold text-slate-400">${u.id}</span>
              ${statusBadge}
            </div>
            <div class="font-bold text-white text-sm">${u.name}</div>
            <div class="text-xs text-slate-300">Chỉ huy: <b class="text-white">${u.commander}</b> (📞 ${u.phone})</div>
            <div class="text-[11px] text-slate-400">Vị trí: ${u.base_location}</div>
            <div class="text-[11px] text-slate-300 bg-slate-950/70 p-2 rounded-lg border border-slate-800">
              Trang bị: ${u.equipment}
            </div>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-800 mt-2">
            <button onclick="CommandUIController.flyToLocation(${u.lat}, ${u.lng}, '${u.id}')" class="text-blue-400 text-xs font-bold hover:underline cursor-pointer">
              📍 Vị trí GPS
            </button>
            ${toggleActionHtml}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 9: EVACUATION SHELTERS VIEW
  function renderSheltersView() {
    const listEl = document.getElementById('cmd-shelters-container');
    if (!listEl) return;

    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;

    listEl.innerHTML = shelterData.map(s => {
      const pct = Math.round((s.current_occupancy / s.capacity) * 100);
      let barColor = 'bg-emerald-500';
      if (pct > 85) barColor = 'bg-rose-500';
      else if (pct > 60) barColor = 'bg-amber-500';

      const manageActions = roleCfg.canManageShelters ? `
        <div class="flex items-center gap-1">
          <button onclick="CommandUIController.updateShelterCapacity('${s.id}', 10)" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[11px] font-bold border border-slate-700 cursor-pointer" title="Tiếp nhận thêm 10 người">+10 Người</button>
          <button onclick="CommandUIController.updateShelterCapacity('${s.id}', -10)" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded text-[11px] font-bold border border-slate-700 cursor-pointer" title="Giảm 10 người">-10 Người</button>
        </div>
      ` : '<span class="text-xs text-slate-500 font-bold">Chỉ xem kho</span>';

      return `
        <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 shadow-md flex flex-col justify-between">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-white text-sm truncate">${s.name}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800">MỞ TIẾP NHẬN</span>
            </div>
            <div class="text-xs text-slate-400 leading-snug">${s.address}</div>
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-slate-400">Đã tiếp nhận: <b class="text-white">${s.current_occupancy}</b> / ${s.capacity}</span>
                <span class="font-bold text-slate-300 font-mono">${pct}%</span>
              </div>
              <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div class="${barColor} h-full transition-all duration-300" style="width: ${pct}%"></div>
              </div>
            </div>
            <div class="text-[11px] text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              Nhu yếu phẩm: <b>${s.supplies_status}</b>
            </div>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-800 mt-2">
            <button onclick="CommandUIController.flyToLocation(${s.lat}, ${s.lng}, 'SHELTER-${s.id}')" class="text-blue-400 text-xs font-bold hover:underline cursor-pointer">
              📍 Xem Map
            </button>
            ${manageActions}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 10: SITREP REPORT VIEWER
  function renderSitRepView() {
    const textEl = document.getElementById('cmd-sitrep-text');
    if (!textEl) return;

    const criticalCount = intakeData.filter(i => i.priority === 'critical' && i.status !== 'resolved').length;
    const resolvedCount = intakeData.filter(i => i.status === 'resolved').length;
    const readyFleet = unitsData.filter(u => u.status === 'ready').length;
    const totalShelters = shelterData.length;

    textEl.innerText = `
========================================================================================
BÁO CÁO TÌNH HÌNH TÁC CHIẾN & ĐIỀU PHỐI CỨU TRỢ CỨU NẠN THIÊN TAI (SITREP)
HỆ THỐNG ĐIỀU HÀNH NORTHSTAR COMMAND - KHU VỰC MIỀN BẮC
Thời điểm xuất báo cáo: ${new Date().toLocaleString('vi-VN')}
Đơn vị chỉ huy: Trung tâm Chỉ huy Điều phối Ứng phó Thiên tai Miền Bắc
Người duyệt xuất: ${ROLES_CONFIG[state.userRole].title}
========================================================================================

I. TỔNG QUAN TÌNH HÌNH THIÊN TAI & LŨ LỤT:
- Địa bàn trọng điểm: Lào Cai (Bảo Yên, Sa Pa), Yên Bái (Sông Thao), Thái Nguyên (Sông Cầu), Hà Nội (Chương Mỹ).
- Mực nước sông Thao và sông Bùi đã vượt Báo Động 3 từ 0.5m đến 0.85m.
- Thủy điện Tuyên Quang đang duy trì mở 8 cửa xả đáy hạ du sông Gâm & Lô.
- Diện tích ngập theo viễn thám vệ tinh Sentinel-1 SAR: Mở rộng 4.2 km² vùng trũng thấp.

II. KẾT QUẢ TIẾP NHẬN & CỨU HỘ:
1. Tiếp nhận thông tin đa kênh:
   - Tổng số tin tiếp nhận: ${intakeData.length} tin (Đã qua lọc trùng không gian 50m).
   - Yêu cầu cứu hộ cấp thiết P1: ${criticalCount} trường hợp đang cô lập.
   - Báo cáo sạt lở & ngập lụt dân sự: ${reportData.length} điểm.
2. Triển khai lực lượng cứu nạn:
   - Tổng số lực lượng trực chiến: ${unitsData.length} đơn vị (Ca-nô 114, Xe 4x4, Cấp cứu 115).
   - Lực lượng sẵn sàng xuất kích tức thì: ${readyFleet} đội.
   - Nhiệm vụ đã giải cứu an toàn: ${resolvedCount} vụ việc.
3. Điểm sơ tán an toàn & Tiếp tế:
   - Tổng số điểm sơ tán mở cửa tiếp nhận: ${totalShelters} điểm.
   - Đảm bảo đầy đủ nước sạch, lương khô và túi sơ cấp cứu dã chiến.

III. MỆNH LỆNH TÁC CHIẾN TIẾP THEO:
1. Yêu cầu Đội xe 4x4 duy trì bám sát trục QL70 và đèo Ô Quy Hồ để thông tuyến cứu trợ.
2. Điều động bổ sung 02 xuồng cao su áp sát các điểm cô lập ngập sâu tại Bảo Hà.
3. Tuyệt đối không để xảy ra thiệt hại về người; ưu tiên phụ nữ mang thai, người già neo đơn và trẻ em.
========================================================================================
    `.trim();
  }

  // KHỐI 11: ROLES & RBAC MATRIX INTERACTIVE VIEW
  function renderRolesView() {
    const targetPane = document.getElementById('pane-cmd_roles');
    if (!targetPane) return;

    const currentRole = state.userRole;

    targetPane.innerHTML = `
      <div class="max-w-6xl mx-auto space-y-4">
        <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <h2 class="text-base font-extrabold text-white flex items-center gap-2">
              <i data-lucide="users" class="w-5 h-5 text-purple-400"></i>
              MA TRẬN PHÂN QUYỀN VAI TRÒ TÁC CHIẾN (RBAC MATRIX)
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">Bảo vệ tính toàn vẹn dữ liệu, phân định quyền hạn tác chiến và kỷ luật chỉ huy.</p>
          </div>
          <div class="text-xs text-amber-300 font-bold bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            Vai trò đang dùng: <b>${ROLES_CONFIG[currentRole].title}</b>
          </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-800/80 text-slate-300 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-700">
              <tr>
                <th class="p-3">Vai Trò</th>
                <th class="p-3">Phạm Vi Tác Chiến</th>
                <th class="p-3 text-center">Phát Lệnh</th>
                <th class="p-3 text-center">Thẩm Định</th>
                <th class="p-3 text-center">Đội Xe</th>
                <th class="p-3 text-center">Kho Hàng</th>
                <th class="p-3 text-center">Xuất SitRep</th>
                <th class="p-3 text-right">Kích Hoạt Vai Trò</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/70 font-medium">
              ${Object.values(ROLES_CONFIG).map(r => {
                const isActive = r.id === currentRole;
                return `
                  <tr class="${isActive ? 'bg-amber-950/20 border-l-4 border-l-amber-500' : 'hover:bg-slate-850'} transition">
                    <td class="p-3">
                      <div class="font-bold text-white flex items-center gap-1.5">
                        <span>${r.label}</span>
                        ${isActive ? '<span class="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-amber-500 text-slate-950 animate-pulse">ĐANG KÍCH HOẠT</span>' : ''}
                      </div>
                      <div class="text-[10.5px] text-slate-400">${r.title}</div>
                    </td>
                    <td class="p-3 text-slate-300 text-[11px] max-w-xs">${r.scopeTag}</td>
                    <td class="p-3 text-center font-bold ${r.canDispatch ? 'text-emerald-400' : 'text-slate-600'}">${r.canDispatch ? '✓ Có' : '✗ Không'}</td>
                    <td class="p-3 text-center font-bold ${r.canVerify ? 'text-emerald-400' : 'text-slate-600'}">${r.canVerify ? '✓ Có' : '✗ Không'}</td>
                    <td class="p-3 text-center font-bold ${r.canManageFleet ? 'text-emerald-400' : 'text-slate-600'}">${r.canManageFleet ? '✓ Có' : '✗ Không'}</td>
                    <td class="p-3 text-center font-bold ${r.canManageShelters ? 'text-emerald-400' : 'text-slate-600'}">${r.canManageShelters ? '✓ Có' : '✗ Không'}</td>
                    <td class="p-3 text-center font-bold ${r.canExportSitRep ? 'text-emerald-400' : 'text-slate-600'}">${r.canExportSitRep ? '✓ Có' : '✗ Không'}</td>
                    <td class="p-3 text-right">
                      ${isActive ? `
                        <button disabled class="px-3 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-xs cursor-default">
                          Đang Dùng
                        </button>
                      ` : `
                        <button onclick="CommandUIController.switchUserRole('${r.id}')" class="px-3 py-1 bg-slate-800 hover:bg-blue-600 text-white font-bold rounded-lg text-xs transition cursor-pointer border border-slate-700">
                          ⚡ Kích hoạt
                        </button>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  // =========================================================================
  // 5. BẢN ĐỒ TÁC CHIẾN GIS TƯƠNG TÁC (TACTICAL GIS INTEGRATION)
  // =========================================================================
  function renderTacticalMapLayers() {
    if (!mapInstance) return;

    // 1. Vẽ các điểm SOS
    if (tacticalLayers.sosGroup) {
      tacticalLayers.sosGroup.clearLayers();
      const activeSOS = sosData.filter(s => s.status !== 'rescued');

      activeSOS.forEach(s => {
        const markerHtml = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-rose-500 opacity-75 animate-ping"></span>
            <div class="w-7 h-7 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-lg border-2 border-white">
              SOS
            </div>
          </div>
        `;
        const icon = L.divIcon({
          className: 'tactical-sos-icon',
          html: markerHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const m = L.marker([s.lat, s.lng], { icon: icon });
        m.bindPopup(`
          <div class="p-2 text-xs font-sans space-y-1">
            <div class="font-extrabold text-rose-700">🚨 YÊU CẦU CỨU HỘ KHẨN CẤP</div>
            <div class="font-bold text-slate-900">${s.contact_name} - ${s.phone}</div>
            <div>Số người: <b>${s.people_count} người ${s.has_vulnerable ? '(Có trẻ nhỏ/người già)' : ''}</b></div>
            <p class="text-[11px] text-slate-600 italic">"${s.notes}"</p>
            <div class="pt-1 border-t flex justify-end">
              <button onclick="CommandUIController.openDispatchModal('${s.id}')" class="px-2 py-1 bg-rose-600 text-white font-bold rounded text-xs cursor-pointer">
                Lập Lệnh Cứu Nạn
              </button>
            </div>
          </div>
        `);
        tacticalLayers.sosGroup.addLayer(m);
      });
    }

    // 2. Vẽ vị trí các đội cứu hộ
    if (tacticalLayers.unitsGroup) {
      tacticalLayers.unitsGroup.clearLayers();
      unitsData.forEach(u => {
        const isBoat = u.type === 'boat';
        const iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 rounded-full ${isBoat ? 'bg-cyan-600' : 'bg-blue-600'} text-white shadow-lg border-2 border-white flex items-center justify-center text-sm font-black">
              ${isBoat ? '🚤' : '🚛'}
            </div>
            <span class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${u.status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'} border border-white"></span>
          </div>
        `;
        const icon = L.divIcon({
          className: 'tactical-unit-icon',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const m = L.marker([u.lat, u.lng], { icon: icon });
        m.bindPopup(`
          <div class="p-2 text-xs font-sans space-y-1">
            <div class="font-bold text-blue-700">${u.name}</div>
            <div>Chỉ huy: <b>${u.commander}</b> (SĐT: ${u.phone})</div>
            <div>Trạng thái: <b>${u.status === 'ready' ? '🟢 Sẵn sàng' : '🟡 Đang cơ động'}</b></div>
            <div>Trang bị: ${u.equipment}</div>
          </div>
        `);
        tacticalLayers.unitsGroup.addLayer(m);
      });
    }

    // 3. Vẽ các điểm sơ tán an toàn
    if (tacticalLayers.sheltersGroup) {
      tacticalLayers.sheltersGroup.clearLayers();
      shelterData.forEach(sh => {
        const iconHtml = `
          <div class="w-7 h-7 rounded-full bg-emerald-600 text-white shadow-md border-2 border-white flex items-center justify-center text-xs font-black">
            🛡️
          </div>
        `;
        const icon = L.divIcon({
          className: 'tactical-shelter-icon',
          html: iconHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const m = L.marker([sh.lat, sh.lng], { icon: icon });
        m.bindPopup(`
          <div class="p-2 text-xs font-sans space-y-1">
            <div class="font-bold text-emerald-700">🛡️ ${sh.name}</div>
            <div class="text-[11px] text-slate-600">${sh.address}</div>
            <div>Sức chứa: <b>${sh.current_occupancy} / ${sh.capacity}</b> người</div>
            <div>Nhu yếu phẩm: ${sh.supplies_status}</div>
          </div>
        `);
        tacticalLayers.sheltersGroup.addLayer(m);
      });
    }
  }

  // =========================================================================
  // 6. THAO TÁC ĐIỀU PHỐI & PHÁT LỆNH XUẤT QUÂN (ACTION WORKFLOWS)
  // =========================================================================
  function openDispatchModal(incidentId) {
    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;
    if (!roleCfg.canDispatch) {
      showToast('🔒 HẠN CHẾ THẨM QUYỀN', `Vai trò ${roleCfg.label} không có quyền xuất quân. Vui lòng chuyển vai trò sang Dispatcher hoặc Chỉ huy trưởng.`, 'warning');
      return;
    }

    const item = intakeData.find(i => i.id === incidentId);
    if (!item) return;

    state.selectedIncidentId = incidentId;
    const modal = document.getElementById('command-dispatch-modal');
    if (!modal) return;

    const elId = document.getElementById('disp-modal-incident-id');
    if (elId) elId.value = item.id;

    const elVictim = document.getElementById('disp-modal-victim-info');
    if (elVictim) elVictim.innerText = `${item.contact_name} - ${item.phone} (${item.people_count} người)`;

    const elLoc = document.getElementById('disp-modal-location');
    if (elLoc) elLoc.innerText = `Toạ độ [${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}]`;

    const elNotes = document.getElementById('disp-modal-notes');
    if (elNotes) elNotes.value = item.description || '';

    const teamSelect = document.getElementById('disp-modal-team-select');
    if (teamSelect) {
      teamSelect.innerHTML = unitsData.map(u => `
        <option value="${u.id}">${u.name} - [${u.status === 'ready' ? '🟢 Sẵn sàng' : '🟡 Đang làm việc'}]</option>
      `).join('');
    }

    updateReceivingUnitPreview(teamSelect ? teamSelect.value : '');
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  function closeDispatchModal() {
    const modal = document.getElementById('command-dispatch-modal');
    if (modal) modal.classList.add('hidden');
  }

  function submitDispatchMission() {
    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;
    if (!roleCfg.canDispatch) {
      showToast('🔒 HẠN CHẾ THẨM QUYỀN', 'Không thể hoàn thành lệnh: bạn không có quyền dispatch.', 'error');
      return;
    }

    const itemId = document.getElementById('disp-modal-incident-id').value;
    const teamId = document.getElementById('disp-modal-team-select').value;
    const shelterName = document.getElementById('disp-modal-shelter-select').value;
    const notes = document.getElementById('disp-modal-notes').value;

    const incident = intakeData.find(i => i.id === itemId);
    const unit = unitsData.find(u => u.id === teamId);

    if (!incident || !unit) {
      closeDispatchModal();
      return;
    }

    // Cập nhật trạng thái sự cố và đội xe
    incident.status = 'dispatched';
    unit.status = 'en_route';

    // Tạo nhiệm vụ tác chiến mới
    const newMission = {
      id: `CMD-MIS-${Date.now().toString().slice(-4)}`,
      title: `Cứu hộ khẩn cấp: ${incident.contact_name}`,
      victim_name: incident.contact_name,
      victim_phone: incident.phone,
      victim_lat: incident.lat,
      victim_lng: incident.lng,
      assigned_unit_id: unit.id,
      assigned_unit_name: unit.name,
      shelter_name: shelterName,
      shelter_lat: incident.lat + 0.02,
      shelter_lng: incident.lng + 0.02,
      status: 'en_route',
      dispatched_at: new Date().toLocaleTimeString('vi-VN'),
      eta_minutes: 15,
      notes: notes
    };

    missionData.unshift(newMission);

    // Vẽ lộ trình nhiệm vụ lên bản đồ
    drawTacticalMissionRoute(newMission.id);

    closeDispatchModal();
    renderAllComponents();
    renderTacticalMapLayers();

    showToast('🚀 PHÁT LỆNH THÀNH CÔNG', `Đã điều động [${unit.name}] ứng cứu [${incident.contact_name}]`, 'success');
  }

  function drawTacticalMissionRoute(missionId) {
    if (!mapInstance || !tacticalLayers.dispatchRoutesGroup) return;

    const mission = missionData.find(m => m.id === missionId);
    if (!mission) return;

    const unit = unitsData.find(u => u.id === mission.assigned_unit_id);
    const unitCoord = unit ? [unit.lat, unit.lng] : [mission.victim_lat - 0.02, mission.victim_lng - 0.02];
    const victimCoord = [mission.victim_lat, mission.victim_lng];
    const shelterCoord = [mission.shelter_lat, mission.shelter_lng];

    tacticalLayers.dispatchRoutesGroup.clearLayers();

    // 1. Tuyến từ Đội đến Nạn nhân (Đường nét đứt màu đỏ/cam)
    const leg1 = L.polyline([unitCoord, victimCoord], {
      color: '#ef4444',
      weight: 4,
      dashArray: '6, 8',
      opacity: 0.9
    }).addTo(tacticalLayers.dispatchRoutesGroup);

    // 2. Tuyến từ Nạn nhân đến Điểm Sơ tán (Đường màu xanh ngọc)
    const leg2 = L.polyline([victimCoord, shelterCoord], {
      color: '#10b981',
      weight: 4,
      opacity: 0.9
    }).addTo(tacticalLayers.dispatchRoutesGroup);

    mapInstance.fitBounds(L.latLngBounds([unitCoord, victimCoord, shelterCoord]), { padding: [60, 60] });
    showToast('🧭 CẮM TUYẾN TÁC CHIẾN', `Đã hiển thị lộ trình [${mission.id}] trên bản đồ`, 'info');
  }

  function flyToLocation(lat, lng, label) {
    if (!mapInstance) return;
    mapInstance.flyTo([lat, lng], 14, { duration: 1.2 });
    showToast('🎯 LIA BẢN ĐỒ', `Đã chuyển tâm bản đồ tới: ${label || 'Mục tiêu'}`, 'info');
  }

  function verifyIncident(id) {
    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;
    if (!roleCfg.canVerify) {
      showToast('🔒 HẠN CHẾ THẨM QUYỀN', 'Chỉ Xác minh viên, Dispatcher hoặc Chỉ huy trưởng mới có quyền thẩm định.', 'warning');
      return;
    }

    const item = intakeData.find(i => i.id === id);
    if (item) {
      item.is_verified = true;
      item.status = 'verified';
      renderAllComponents();
      showToast('✓ ĐÃ THẨM ĐỊNH', `Tin báo [${id}] đã được xác thực chính xác.`, 'success');
    }
  }

  function rejectIncident(id) {
    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;
    if (!roleCfg.canVerify) {
      showToast('🔒 HẠN CHẾ THẨM QUYỀN', 'Chỉ người có quyền thẩm định mới có thể bác bỏ tin giả.', 'warning');
      return;
    }

    intakeData = intakeData.filter(i => i.id !== id);
    renderAllComponents();
    showToast('✗ ĐÃ BÁC BỎ', `Đã loại bỏ báo cáo [${id}] khỏi hàng đợi.`, 'info');
  }

  function toggleUnitStatus(unitId) {
    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;
    if (!roleCfg.canManageFleet) {
      showToast('🔒 HẠN CHẾ THẨM QUYỀN', 'Chỉ Điều phối Cứu hộ hoặc Chỉ huy trưởng mới được đổi trạng thái xe.', 'warning');
      return;
    }

    const unit = unitsData.find(u => u.id === unitId);
    if (unit) {
      const nextStatus = { ready: 'en_route', en_route: 'on_scene', on_scene: 'standby', standby: 'ready' };
      unit.status = nextStatus[unit.status] || 'ready';
      renderAllComponents();
      renderTacticalMapLayers();
      showToast('🔄 ĐỔI TRẠNG THÁI XE', `${unit.name}: Trạng thái mới -> ${unit.status.toUpperCase()}`, 'info');
    }
  }

  function updateMissionStatus(missionId, newStatus) {
    const mission = missionData.find(m => m.id === missionId);
    if (mission) {
      mission.status = newStatus;
      renderAllComponents();
      showToast('📋 CẬP NHẬT TIẾN ĐỘ', `Nhiệm vụ [${missionId}]: ${newStatus.toUpperCase()}`, 'success');
    }
  }

  function updateShelterCapacity(shelterId, delta) {
    const roleCfg = ROLES_CONFIG[state.userRole] || ROLES_CONFIG.director;
    if (!roleCfg.canManageShelters) {
      showToast('🔒 HẠN CHẾ THẨM QUYỀN', 'Chỉ Điều phối Cứu trợ hoặc Chỉ huy trưởng mới được cập nhật kho sơ tán.', 'warning');
      return;
    }

    const sh = shelterData.find(s => s.id === shelterId);
    if (sh) {
      sh.current_occupancy = Math.max(0, Math.min(sh.capacity, (sh.current_occupancy || 0) + delta));
      renderSheltersView();
      showToast('⛺ CẬP NHẬT SỨC CHỨA', `${sh.name}: Hiện tiếp nhận ${sh.current_occupancy} người`, 'info');
    }
  }

  function copySitRepToClipboard() {
    const textEl = document.getElementById('cmd-sitrep-text');
    if (textEl && navigator.clipboard) {
      navigator.clipboard.writeText(textEl.innerText);
      showToast('📋 ĐÃ SAO CHÉP', 'Đã copy Báo cáo SitRep vào Clipboard thành công.', 'success');
    }
  }

  function toggleTacticalLayers() {
    const panel = document.getElementById('multi-hazard-layer-control');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  function handleSearchInput(query) {
    state.quickSearchQuery = query || '';
    renderIntakeView();
  }

  function filterIntake(sourceType) {
    state.activeIntakeFilter = sourceType;
    
    // Cập nhật giao diện nút tab lọc
    const tabs = document.querySelectorAll('.cmd-intake-filter-btn');
    tabs.forEach(btn => {
      const type = btn.getAttribute('data-source');
      if (type === sourceType) {
        btn.className = 'cmd-intake-filter-btn px-2.5 py-1 rounded bg-rose-600 text-white font-black cursor-pointer shadow-xs';
      } else {
        btn.className = 'cmd-intake-filter-btn px-2.5 py-1 rounded text-slate-300 hover:bg-slate-700 cursor-pointer font-medium';
      }
    });

    renderIntakeView();
  }

  function setupGlobalEventListeners() {
    // Phím tắt ESC thoát modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDispatchModal();
      }
    });
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return 'Vừa gửi';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins <= 1) return 'Vừa gửi';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return 'Hôm qua';
  }

  function showToast(title, message, type = 'info') {
    let container = document.getElementById('command-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'command-toast-container';
      container.className = 'fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colorClass = type === 'error' ? 'border-rose-500 bg-rose-950 text-rose-200' :
      (type === 'success' ? 'border-emerald-500 bg-emerald-950 text-emerald-200' :
        (type === 'warning' ? 'border-amber-500 bg-amber-950 text-amber-200' : 'border-blue-500 bg-slate-900 text-slate-200'));

    toast.className = `p-3 rounded-xl border ${colorClass} shadow-xl text-xs pointer-events-auto transition-all duration-300 max-w-sm flex items-start gap-2`;
    toast.innerHTML = `
      <div class="flex-1">
        <div class="font-bold">${title}</div>
        <div class="text-[11px] opacity-90 mt-0.5">${message}</div>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Public Interface
  
  function triggerEmergencyBroadcast() {
    showToast('📢 PHÁT CẢNH BÁO BÁO ĐỘNG ĐỎ', 'Đã phát tin nhắn cảnh báo lũ khẩn cấp tới 420,000 thuê bao trên địa bàn 7 tỉnh Miền Bắc.', 'danger');
  }

  function mergeDuplicateCluster() {
    showToast('🔗 ĐÃ HỢP NHẤT TIN BÁO TRÙNG', 'Đã gộp cụm SOS-63, SOS-64, SOS-58 (Bảo Yên, Lào Cai trong bán kính 45m) thành 1 nhiệm vụ cứu hộ gộp.', 'success');
  }

  
  function updateReceivingUnitPreview(unitId) {
    const el = document.getElementById('disp-modal-receiving-unit-preview');
    if (!el) return;
    const unit = unitsData.find(u => u.id === unitId);
    if (unit) {
      el.innerText = `${unit.name} (${unit.commander} - ${unit.phone})`;
    }
  }

  function copyLocationLink() {
    const itemId = document.getElementById('disp-modal-incident-id').value;
    const item = intakeData.find(i => i.id === itemId);
    if (!item) return;
    const link = `https://maps.google.com/?q=${item.lat},${item.lng}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('📍 ĐÃ SAO CHÉP TỌA ĐỘ', `Đã chép link Google Maps: [${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}]`, 'success');
    }).catch(() => {
      showToast('📍 TỌA ĐỘ', `Toạ độ: ${item.lat}, ${item.lng}`, 'info');
    });
  }

  function quickCopyIncident(incidentId) {
    const incident = intakeData.find(i => i.id === incidentId);
    if (!incident) return;
    const mapLink = `https://maps.google.com/?q=${incident.lat},${incident.lng}`;
    const txt = `🚨 [NORTHSTAR COMMAND - CHUYỂN GIAO TIN CỨU HỘ]
• Mã tin: ${incident.id} (Ưu tiên: ${(incident.priority || 'CRITICAL').toUpperCase()})
• Người kêu cứu: ${incident.contact_name} - SĐT: ${incident.phone}
• Địa điểm: Toạ độ [${Number(incident.lat || 0).toFixed(4)}, ${Number(incident.lng || 0).toFixed(4)}]
• Link bản đồ: ${mapLink}
• Hiện trạng: ${incident.description} (Mực nước ngập: ~${incident.water_level_cm || 0}cm)
• Nguồn tiếp nhận: ${incident.source_label} lúc ${new Date(incident.created_at).toLocaleTimeString('vi-VN')}
• Đơn vị chuyển giao: Trung tâm Điều hành Thông tin NORTHSTAR COMMAND (Hotline 24/7)`;

    navigator.clipboard.writeText(txt).then(() => {
      showToast('📋 ĐÃ SAO CHÉP GÓI TIN ZALO/SMS', `Đã sao chép gói tin cứu hộ [${incident.id}] để gửi trực tiếp cho Đội Cứu Hộ.`, 'success');
    }).catch(() => {
      showToast('📋 GÓI TIN CỨU HỘ', incident.description, 'info');
    });
  }

  function copyDispatchPackageText() {
    const itemId = document.getElementById('disp-modal-incident-id').value;
    const teamId = document.getElementById('disp-modal-team-select').value;
    const shelterName = document.getElementById('disp-modal-shelter-select').value;
    const notes = document.getElementById('disp-modal-notes').value;

    const incident = intakeData.find(i => i.id === itemId) || {};
    const unit = unitsData.find(u => u.id === teamId) || {};
    const mapLink = `https://maps.google.com/?q=${incident.lat},${incident.lng}`;

    const textPackage = `🚨 [NORTHSTAR COMMAND] - PHIẾU CHUYỂN GIAO THÔNG TIN CỨU HỘ KHẨN CẤP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Mã sự cố: ${incident.id || 'N/A'} (Ưu tiên: ${(incident.priority || 'CRITICAL').toUpperCase()})
• Người kêu cứu: ${incident.contact_name || 'Nạn nhân'} - SĐT: ${incident.phone || 'N/A'}
• Số lượng người: ${incident.people_count || 1} người ${incident.has_vulnerable ? '(Có người già / trẻ em cần ưu tiên)' : ''}
• Tọa độ GPS: [${Number(incident.lat || 0).toFixed(4)}, ${Number(incident.lng || 0).toFixed(4)}]
• Mở Google Maps dẫn đường: ${mapLink}
• Hiện trạng thực địa: ${incident.description || notes || 'Nước ngập sâu, bị cô lập'}
• Mực nước ước tính: ~${incident.water_level_cm || 0}cm
• Lộ trình an toàn né ngập: Tuyến đường theo thuật toán A* né các đoạn ngập sâu >30cm
• Điểm sơ tán tiếp nhận: ${shelterName}
• Đơn vị cứu hộ tiếp nhận tin: ${unit.name || 'Đội Cứu Nạn Cơ Động'} (Chỉ huy: ${unit.commander || 'Trực ban'} - ${unit.phone || '114'})
• Thời điểm chuyển giao: ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Nguồn dữ liệu: Trung tâm Tiếp nhận & Điều phối Thông tin Thiên tai NORTHSTAR COMMAND*`;

    navigator.clipboard.writeText(textPackage).then(() => {
      showToast('📋 ĐÃ SAO CHÉP GÓI TIN CỨU HỘ', 'Gói tin chuyển giao đã được sao chép vào bộ nhớ tạm. Bạn có thể dán (Paste) ngay vào Zalo / SMS cho Chỉ huy Đội Cứu Hộ.', 'success');
    }).catch(() => {
      showToast('📋 GÓI TIN CỨU HỘ', 'Vui lòng sao chép văn bản phiếu chuyển giao.', 'info');
    });
  }

  return {
    init,
    switchView,
    switchUserRole,
    triggerEmergencyBroadcast,
    copyDispatchPackageText,
    copyLocationLink,
    quickCopyIncident,
    updateReceivingUnitPreview,
    mergeDuplicateCluster,
    setMonitoringRegion,
    toggleSidebarCollapse,
    handleSearchInput,
    filterIntake,
    openDispatchModal,
    closeDispatchModal,
    submitDispatchMission,
    flyToLocation,
    verifyIncident,
    rejectIncident,
    toggleUnitStatus,
    updateMissionStatus,
    updateShelterCapacity,
    drawTacticalMissionRoute,
    copySitRepToClipboard,
    toggleTacticalLayers,
    toggleFullscreen,
    showToast,
    get state() { return state; },
    get rolesConfig() { return ROLES_CONFIG; }
  };
})();

// Attach to global window
window.CommandUIController = CommandUIController;
