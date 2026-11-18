/**
 * ============================================================================
 * NORTHSTAR COMMAND - UNIFIED DISASTER INTELLIGENCE & RESPONSE CENTER
 * Master Enterprise UI Controller (Phase 3 Implementation)
 * Giấy phép: Apache-2.0 License (100% Mã nguồn mở)
 * ============================================================================
 */

const CommandUIController = (function () {
  // Trạng thái vận hành điều hành trung tâm
  let state = {
    currentView: 'cmd_dashboard', // Mặc định là Command Dashboard (COP)
    userRole: 'dispatcher',       // director, dispatcher, verifier, analyst, rescue_coord, relief_coord
    currentRegion: 'all',         // all, hanoi, thainguyen, laocai, yenbai, caobang, tuyenquang
    sidebarCollapsed: false,
    activeIntakeFilter: 'all',    // all, pending, critical, verified, dispatched
    activeMapLayers: {
      sos: true,
      units: true,
      shelters: true,
      flood_points: true,
      hazard_zones: true,
      sar_satellite: false
    },
    quickSearchQuery: '',
    selectedIncidentId: null,
    lastSyncTime: new Date().toLocaleTimeString('vi-VN')
  };

  // Dữ liệu bộ nhớ tác chiến (Real-time operational cache)
  let intakeData = [];
  let sosData = [];
  let reportData = [];
  let missionData = [];
  let unitsData = [];
  let shelterData = [];
  let stationData = [];

  // Lớp vẽ bản đồ tác chiến
  let mapInstance = null;
  let tacticalLayers = {
    sosGroup: null,
    unitsGroup: null,
    sheltersGroup: null,
    dispatchRoutesGroup: null
  };

  // =========================================================================
  // 1. KHỞI TẠO HỆ THỐNG COMMAND (SYSTEM INITIALIZATION)
  // =========================================================================
  async function init(map) {
    mapInstance = map || window.map;

    if (mapInstance) {
      tacticalLayers.sosGroup = L.layerGroup().addTo(mapInstance);
      tacticalLayers.unitsGroup = L.layerGroup().addTo(mapInstance);
      tacticalLayers.sheltersGroup = L.layerGroup().addTo(mapInstance);
      tacticalLayers.dispatchRoutesGroup = L.layerGroup().addTo(mapInstance);
    }

    // Nạp dữ liệu ban đầu từ API backend
    await refreshSystemData();

    // Khởi tạo các listener sự kiện
    setupGlobalEventListeners();

    // Mặc định kích hoạt view Command Dashboard
    switchView('cmd_dashboard');

    console.log('[NorthStar Command] Unified Emergency Operations Center đã sẵn sàng.');
  }

  // Làm mới toàn bộ dữ liệu từ backend và đồng bộ trạng thái
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

      // 2. Lấy dữ liệu Báo cáo ngập từ người dân
      const repRes = await fetch(getApiUrl('/api/reports')).catch(() => null);
      if (repRes && repRes.ok) {
        const data = await repRes.json();
        reportData = (data.features || []).map(f => {
          const p = f.properties;
          const c = f.geometry.coordinates;
          return {
            id: `REP-${p.id}`,
            raw_id: p.id,
            level: p.level || 'medium',
            estimated_depth_cm: p.estimated_depth_cm || 25,
            confirmed: !!p.confirmed,
            lat: c[1],
            lng: c[0],
            created_at: p.created_at || new Date().toISOString()
          };
        });
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

      // Nạp danh sách lực lượng cứu hộ sẵn có
      initRescueFleet();

      // Nạp danh sách nhiệm vụ điều phối
      initMissions();

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
    if (missionData.length === 0) {
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
          title: 'Sơ tán khẩn cấp người già liệt giường xã Tả Van',
          victim_name: 'Sùng A Páo (7 người, có cụ già 82 tuổi)',
          victim_phone: '0971452881',
          victim_lat: 22.5480,
          victim_lng: 103.7450,
          assigned_unit_id: 'UNIT-102',
          assigned_unit_name: 'Đội Xuồng Phao Phản ứng Nhanh Chữ Thập Đỏ',
          shelter_name: 'Nhà thi đấu Đa năng Tỉnh Lào Cai',
          shelter_lat: 22.4510,
          shelter_lng: 103.9780,
          status: 'on_scene',
          dispatched_at: '12:30',
          eta_minutes: 0,
          notes: 'Đã đưa cụ già lên cáng phao an toàn, đang tiếp cận hộ lân cận.'
        }
      ];
    }
  }

  function buildUnifiedIntakeFeed() {
    intakeData = [];

    // Nạp SOS
    sosData.forEach(item => {
      intakeData.push({
        id: item.id,
        raw_id: item.raw_id,
        source: 'sos_citizen',
        source_label: '🆘 SOS Khẩn Cấp',
        source_badge_color: 'bg-rose-600 text-white',
        contact_name: item.contact_name,
        phone: item.phone,
        people_count: item.people_count,
        has_vulnerable: item.has_vulnerable,
        water_level_cm: item.water_level_cm,
        priority: item.priority, // critical, high, medium
        status: item.status === 'rescued' ? 'resolved' : (item.status === 'dispatched' ? 'dispatched' : 'pending'),
        lat: item.lat,
        lng: item.lng,
        description: item.notes,
        created_at: item.created_at,
        is_verified: item.priority === 'critical' || item.status !== 'pending'
      });
    });

    // Nạp Báo cáo dân
    reportData.forEach(item => {
      intakeData.push({
        id: item.id,
        raw_id: item.raw_id,
        source: 'citizen_report',
        source_label: '📢 Dân Báo Ngập',
        source_badge_color: 'bg-amber-600 text-white',
        contact_name: `Báo cáo thực địa #${item.raw_id}`,
        phone: 'GPS Đối soát tự động',
        people_count: 0,
        has_vulnerable: false,
        water_level_cm: item.estimated_depth_cm,
        priority: item.level === 'heavy' ? 'high' : 'medium',
        status: item.confirmed ? 'verified' : 'pending',
        lat: item.lat,
        lng: item.lng,
        description: `Ngập đường giao thông ước lượng ~${item.estimated_depth_cm}cm. Xe máy qua lại chết máy, dòng nước chảy xiết.`,
        created_at: item.created_at,
        is_verified: item.confirmed
      });
    });

    // Bổ sung các tin trạm thủy văn IoT & Viễn thám Sentinel-1 SAR
    intakeData.push(
      {
        id: 'IOT-201',
        raw_id: 201,
        source: 'iot_sensor',
        source_label: '📡 Cảm Biến IoT Thủy Văn',
        source_badge_color: 'bg-cyan-700 text-white',
        contact_name: 'Trạm Quan Trắc Tự Động Sông Bùi',
        phone: 'Hệ thống Telemetry IoT',
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
        id: 'SAR-302',
        raw_id: 302,
        source: 'satellite_sar',
        source_label: '🛰️ Vệ Tinh Sentinel-1 SAR',
        source_badge_color: 'bg-purple-700 text-white',
        contact_name: 'Copernicus Emergency Management Service',
        phone: 'Viễn thám Radar ESA',
        people_count: 0,
        has_vulnerable: false,
        water_level_cm: 200,
        priority: 'high',
        status: 'verified',
        lat: 21.8200,
        lng: 105.2200,
        description: 'Diện tích ngập mở rộng 4.2 km² vùng hạ lưu sông Gâm và sông Lô sau khi mở cửa xả lũ.',
        created_at: new Date(Date.now() - 50 * 60000).toISOString(),
        is_verified: true
      }
    );

    // Khử trùng lặp tự động spatiotemporal (50m)
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
  // 2. ĐIỀU HƯỚNG MÀN HÌNH & GIAO DIỆN (VIEW NAVIGATION & ROLE SWITCH)
  // =========================================================================
  function switchView(viewId) {
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

    // Nếu chọn Disaster Map Fullscreen hoặc Dashboard, đảm bảo Leaflet cập nhật size
    setTimeout(() => {
      if (window.map) window.map.invalidateSize();
    }, 150);

    renderAllComponents();
  }

  function switchUserRole(newRole) {
    state.userRole = newRole;
    const roleBadge = document.getElementById('cmd-active-role-badge');
    const roleLabels = {
      director: '⭐ Command Director (Toàn quyền)',
      dispatcher: '🛡️ Dispatcher (Tiếp nhận & Phân công)',
      verifier: '🔍 Information Verifier (Thẩm định tin)',
      analyst: '📊 Data Analyst (Phân tích dữ liệu)',
      rescue_coord: '🚤 Rescue Coordinator (Điều phối cứu nạn)',
      relief_coord: '📦 Relief Coordinator (Điều phối cứu trợ)'
    };

    if (roleBadge) {
      roleBadge.innerText = roleLabels[newRole] || 'Điều phối viên';
    }

    showToast('👤 ĐÃ ĐỔI VAI TRÒ TÁC CHIẾN', `Phân quyền áp dụng cho: ${roleLabels[newRole]}`, 'info');
    renderAllComponents();
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
        sidebarEl.classList.add('sm:w-[72px]');
        sidebarEl.classList.remove('sm:w-[420px]');
        document.body.classList.add('sidebar-collapsed');
        if (collapseIcon) collapseIcon.setAttribute('data-lucide', 'chevron-right');
      } else {
        sidebarEl.classList.remove('sm:w-[72px]');
        sidebarEl.classList.add('sm:w-[420px]');
        document.body.classList.remove('sidebar-collapsed');
        if (collapseIcon) collapseIcon.setAttribute('data-lucide', 'chevron-left');
      }
    }

    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
      if (window.map) window.map.invalidateSize();
    }, 300);
  }

  // =========================================================================
  // 3. RENDER GIAO DIỆN & CÁC KHỐI DỮ LIỆU (UI RENDERING PIPELINE)
  // =========================================================================
  function renderAllComponents() {
    renderCOPHeaderMetrics();
    renderIntakeView();
    renderSOSView();
    renderMissionsView();
    renderFleetView();
    renderSheltersView();
    renderSitRepView();
  }

  function updateSyncIndicator() {
    const el = document.getElementById('cmd-last-sync-time');
    if (el) el.innerText = state.lastSyncTime;
  }

  // BĂNG CHỈ SỐ TÁC CHIẾN THỜI GIAN THỰC (COP KPI METRICS)
  function renderCOPHeaderMetrics() {
    const totalIntake = intakeData.length;
    const pendingIntake = intakeData.filter(i => i.status === 'pending').length;
    const criticalSOS = intakeData.filter(i => i.priority === 'critical' && i.status !== 'resolved').length;
    const readyUnits = unitsData.filter(u => u.status === 'ready').length;
    const activeMissions = missionData.filter(m => m.status !== 'resolved').length;

    // Header pills
    const badgeUnproc = document.getElementById('cmd-hdr-badge-unprocessed');
    if (badgeUnproc) badgeUnproc.innerText = `${pendingIntake} mới`;

    // COP Banner & Dashboard Cards
    const kpiIntake = document.getElementById('kpi-val-intake');
    if (kpiIntake) kpiIntake.innerText = totalIntake;

    const kpiPending = document.getElementById('kpi-val-pending');
    if (kpiPending) kpiPending.innerText = pendingIntake;

    const kpiSOS = document.getElementById('kpi-val-sos');
    if (kpiSOS) kpiSOS.innerText = criticalSOS;

    const kpiUnits = document.getElementById('kpi-val-units');
    if (kpiUnits) kpiUnits.innerText = `${readyUnits} / ${unitsData.length}`;

    const kpiMissions = document.getElementById('kpi-val-missions');
    if (kpiMissions) kpiMissions.innerText = activeMissions;
  }

  // KHỐI 1: INFORMATION HUB (DÒNG TIẾP NHẬN ĐA NGUỒN)
  function renderIntakeView() {
    const listEl = document.getElementById('cmd-intake-table-body');
    if (!listEl) return;

    let items = intakeData.filter(i => !i.is_duplicate);

    // Lọc theo search
    if (state.quickSearchQuery) {
      const q = state.quickSearchQuery.toLowerCase();
      items = items.filter(i => 
        i.contact_name.toLowerCase().includes(q) ||
        i.phone.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q)
      );
    }

    // Lọc theo filter tab
    if (state.activeIntakeFilter === 'pending') items = items.filter(i => i.status === 'pending');
    else if (state.activeIntakeFilter === 'critical') items = items.filter(i => i.priority === 'critical');
    else if (state.activeIntakeFilter === 'verified') items = items.filter(i => i.is_verified);
    else if (state.activeIntakeFilter === 'dispatched') items = items.filter(i => i.status === 'dispatched');

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-xs">
          <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60"></i>
          <span>Không có tin nào phù hợp với bộ lọc hiện tại.</span>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    listEl.innerHTML = items.map(item => {
      let priorityBadge = '<span class="text-[9.5px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">⚪ Bình thường</span>';
      if (item.priority === 'critical') {
        priorityBadge = '<span class="text-[9.5px] px-2 py-0.5 rounded font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">🔴 P1 - KHẨN CẤP</span>';
      } else if (item.priority === 'high') {
        priorityBadge = '<span class="text-[9.5px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300">🟠 P2 - ƯU TIÊN</span>';
      }

      return `
        <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border ${item.priority === 'critical' ? 'border-rose-300 dark:border-rose-900 shadow-sm' : 'border-slate-200 dark:border-slate-700'} space-y-2 hover:shadow-md transition">
          <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[9.5px] px-1.5 py-0.5 rounded font-bold ${item.source_badge_color}">${item.source_label}</span>
              ${priorityBadge}
              ${item.duplicate_count > 0 ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold">🔗 +${item.duplicate_count} tin cùng điểm</span>` : ''}
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${formatRelativeTime(item.created_at)}</span>
          </div>

          <div>
            <div class="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span>${item.contact_name} ${item.people_count > 0 ? `<span class="text-rose-600 font-bold">(${item.people_count} người ${item.has_vulnerable ? '• Có trẻ nhỏ/người già' : ''})</span>` : ''}</span>
              ${item.phone !== 'GPS Đối soát tự động' ? `<a href="tel:${item.phone}" class="text-blue-600 text-[11px] font-bold hover:underline">📞 ${item.phone}</a>` : ''}
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              ${item.description}
            </p>
            <div class="text-[10.5px] text-slate-400 mt-1 flex items-center gap-2">
              <span>📍 [${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}]</span>
              ${item.water_level_cm > 0 ? `<span class="text-cyan-600 dark:text-cyan-400 font-bold">🌊 Ngập: ${item.water_level_cm}cm</span>` : ''}
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700 text-[11px]">
            <div>
              ${item.status === 'resolved' ? '<span class="text-emerald-600 font-bold">✅ Đã cứu an toàn</span>' :
                (item.status === 'dispatched' ? '<span class="text-blue-600 font-bold animate-pulse">🚑 Đang điều phối</span>' :
                  (item.is_verified ? '<span class="text-teal-600 font-bold">✓ Đã xác thực</span>' :
                    '<span class="text-amber-600 font-bold">⏳ Chờ duyệt</span>'))}
            </div>

            <div class="flex items-center gap-1">
              <button onclick="CommandUIController.flyToLocation(${item.lat}, ${item.lng}, '${item.id}')" title="Lia bản đồ tới vị trí sự cố" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition active:scale-95">
                <i data-lucide="crosshair" class="w-3 h-3 text-blue-600"></i>
                <span>Xem Map</span>
              </button>

              ${!item.is_verified && item.status !== 'resolved' ? `
                <button onclick="CommandUIController.verifyIncident('${item.id}')" title="Xác minh tin chính xác" class="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold text-[10.5px] cursor-pointer transition active:scale-95">
                  Xác thực
                </button>
              ` : ''}

              ${item.status !== 'dispatched' && item.status !== 'resolved' ? `
                <button onclick="CommandUIController.openDispatchModal('${item.id}')" title="Phát lệnh điều phối lực lượng ứng cứu" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-black text-[10.5px] cursor-pointer transition shadow-xs active:scale-95 flex items-center gap-1">
                  <i data-lucide="send" class="w-3 h-3"></i>
                  <span>Điều phối</span>
                </button>
              ` : ''}

              <button onclick="CommandUIController.rejectIncident('${item.id}')" title="Bác bỏ báo cáo giả hoặc không chính xác" class="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 2: SOS REQUESTS VIEW
  function renderSOSView() {
    const listEl = document.getElementById('cmd-sos-list-container');
    if (!listEl) return;

    const pendingSOS = sosData.filter(s => s.status !== 'rescued');
    if (pendingSOS.length === 0) {
      listEl.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Hiện không có yêu cầu SOS nào chưa xử lý!</div>';
      return;
    }

    listEl.innerHTML = pendingSOS.map(s => `
      <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-900 space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between text-xs">
          <span class="font-black text-rose-700 dark:text-rose-400 font-mono">${s.id}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800 uppercase">${s.priority}</span>
        </div>
        <div class="text-xs font-bold text-slate-900 dark:text-slate-100">${s.contact_name} (${s.people_count} người ${s.has_vulnerable ? '• Có trẻ nhỏ/người già' : ''})</div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300">Điện thoại: <a href="tel:${s.phone}" class="text-blue-600 font-bold">${s.phone}</a></div>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 italic">"${s.notes}"</p>
        <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
          <button onclick="CommandUIController.flyToLocation(${s.lat}, ${s.lng}, '${s.id}')" class="text-blue-600 text-xs font-bold hover:underline">Vị trí bản đồ</button>
          <button onclick="CommandUIController.openDispatchModal('${s.id}')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs cursor-pointer shadow-xs active:scale-95">
            Lập Lệnh Cứu Nạn
          </button>
        </div>
      </div>
    `).join('');
  }

  // KHỐI 3: COMMAND OPERATIONS & MISSIONS VIEW
  function renderMissionsView() {
    const listEl = document.getElementById('cmd-missions-container');
    if (!listEl) return;

    if (missionData.length === 0) {
      listEl.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Chưa có nhiệm vụ điều phối nào được phát lệnh.</div>';
      return;
    }

    listEl.innerHTML = missionData.map(m => {
      let statusBadge = '<span class="bg-amber-100 text-amber-800 text-[10.5px] px-2 py-0.5 rounded font-bold">Đã phân công</span>';
      if (m.status === 'en_route') statusBadge = '<span class="bg-blue-100 text-blue-800 text-[10.5px] px-2 py-0.5 rounded font-bold animate-pulse">Đang di chuyển</span>';
      else if (m.status === 'on_scene') statusBadge = '<span class="bg-purple-100 text-purple-800 text-[10.5px] px-2 py-0.5 rounded font-bold">Tại hiện trường</span>';
      else if (m.status === 'resolved') statusBadge = '<span class="bg-emerald-100 text-emerald-800 text-[10.5px] px-2 py-0.5 rounded font-bold">Đã hoàn thành</span>';

      return `
        <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 shadow-xs">
          <div class="flex items-center justify-between text-xs">
            <span class="font-mono font-black text-rose-700 dark:text-rose-400">${m.id}</span>
            <div>${statusBadge}</div>
          </div>
          <div class="text-xs space-y-1">
            <div class="font-black text-slate-900 dark:text-slate-100">${m.title}</div>
            <div class="text-slate-600 dark:text-slate-300">Nạn nhân: <b>${m.victim_name}</b> (SĐT: ${m.victim_phone})</div>
            <div class="text-blue-700 dark:text-cyan-400 font-bold">Lực lượng: ${m.assigned_unit_name}</div>
            <div class="text-emerald-700 dark:text-emerald-400 font-bold">Trạm sơ tán: ${m.shelter_name}</div>
            ${m.notes ? `<div class="text-[11px] text-slate-500 italic">"${m.notes}"</div>` : ''}
          </div>

          <div class="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-1 text-[11px]">
            <button onclick="CommandUIController.drawTacticalMissionRoute('${m.id}')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold rounded flex items-center gap-1 cursor-pointer">
              <i data-lucide="map" class="w-3 h-3"></i>
              <span>Vẽ Tuyến Tác Chiến</span>
            </button>

            <div class="flex items-center gap-1">
              ${m.status === 'en_route' ? `
                <button onclick="CommandUIController.updateMissionStatus('${m.id}', 'on_scene')" class="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold cursor-pointer">Đã tới nơi</button>
              ` : ''}
              ${m.status === 'on_scene' ? `
                <button onclick="CommandUIController.updateMissionStatus('${m.id}', 'resolved')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer">Hoàn thành</button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 4: RESCUE FLEET & TEAMS VIEW
  function renderFleetView() {
    const listEl = document.getElementById('cmd-fleet-container');
    if (!listEl) return;

    listEl.innerHTML = unitsData.map(u => `
      <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-xs text-slate-900 dark:text-slate-100">${u.name}</span>
          <span class="text-[9.5px] px-2 py-0.5 rounded font-bold ${u.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${u.status === 'ready' ? '🟢 SẴN SÀNG' : '🟡 ĐANG TÁC CHIẾN'}
          </span>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
          <div><b>Chỉ huy:</b> ${u.commander} (SĐT: <a href="tel:${u.phone}" class="text-blue-600 font-bold">${u.phone}</a>)</div>
          <div><b>Căn cứ:</b> ${u.base_location}</div>
          <div><b>Trang bị:</b> ${u.equipment}</div>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
          <button onclick="CommandUIController.flyToLocation(${u.lat}, ${u.lng}, '${u.id}')" class="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
            <i data-lucide="crosshair" class="w-3 h-3"></i>
            <span>Vị trí trực ban</span>
          </button>
          <a href="tel:${u.phone}" class="text-emerald-600 text-xs font-bold hover:underline">Gọi khẩn cấp</a>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  }

  // KHỐI 5: SAFE ZONES & SHELTERS VIEW
  function renderSheltersView() {
    const listEl = document.getElementById('cmd-shelters-container');
    if (!listEl) return;

    listEl.innerHTML = shelterData.map(s => {
      const occPercent = Math.min(100, Math.round((s.current_occupancy / s.capacity) * 100));
      return `
        <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-bold text-xs text-slate-900 dark:text-slate-100">${s.name}</span>
            <span class="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">AN TOÀN</span>
          </div>
          <div class="text-[11px] text-slate-600 dark:text-slate-300">
            <div>Địa chỉ: ${s.address}</div>
            <div>Sức chứa: <b>${s.current_occupancy} / ${s.capacity} người</b> (${occPercent}% lấp đầy)</div>
            <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
              <div class="bg-emerald-500 h-full" style="width: ${occPercent}%"></div>
            </div>
            <div class="text-slate-500 dark:text-slate-400 text-[10px] mt-1">${s.supplies_status}</div>
          </div>
          <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
            <button onclick="CommandUIController.flyToLocation(${s.lat}, ${s.lng}, 'SHELTER-${s.id}')" class="text-blue-600 text-xs font-bold hover:underline">Xem trên bản đồ</button>
            <a href="tel:${s.contact_phone}" class="text-emerald-600 text-xs font-bold hover:underline">Hotline: ${s.contact_phone}</a>
          </div>
        </div>
      `;
    }).join('');
  }

  // KHỐI 6: SITUATION REPORT (SITREP)
  function renderSitRepView() {
    const textEl = document.getElementById('cmd-sitrep-text');
    if (!textEl) return;

    const totalIntake = intakeData.length;
    const pendingCount = intakeData.filter(i => i.status === 'pending').length;
    const resolvedCount = intakeData.filter(i => i.status === 'resolved').length;
    const criticalCount = intakeData.filter(i => i.priority === 'critical').length;
    const nowStr = new Date().toLocaleString('vi-VN');

    textEl.value = 
`BÁO CÁO TÌNH HÌNH TÁC CHIẾN PCTT & ĐIỀU PHỐI CỨU NẠN (SITREP)
Hệ thống: NORTHSTAR COMMAND (Unified Emergency Response Center)
Thời điểm lập: ${nowStr}
Người lập: Ban Điều Phối Tác Chiến Trung Tâm (24/7 Dispatch Unit)

1. TỔNG QUAN TÌNH HÌNH TIẾP NHẬN:
- Tổng số thông tin & sự cố ghi nhận: ${totalIntake} tin
- Tin khẩn cấp P1 (Cần cứu nạn ngay lập tức): ${criticalCount} ca
- Tin chờ thẩm định / xác minh: ${pendingCount} tin
- Số ca đã giải cứu & sơ tán an toàn: ${resolvedCount} ca

2. LỰC LƯỢNG & ĐIỀU ĐỘNG HIỆN TRƯỜNG:
- Số đội phản ứng nhanh trực chiến: ${unitsData.length} đơn vị
- Ca nô & xuồng máy đang tác chiến: 2 đơn vị
- Xe gầm cao 4x4 & đội y tế: 2 đơn vị
- Mạng lưới điểm sơ tán an toàn: ${shelterData.length} trạm (Còn trống > 4.000 chỗ)

3. CÁC ĐIỂM NÓNG TRỌNG ĐIỂM:
- Sạt lở cô lập cục bộ tại Bảo Yên (Lào Cai)
- Nước lũ dâng cao sông Bùi tại Chương Mỹ (Hà Nội)
- Tràn bãi ngập hạ lưu sông Lô & sông Cầu (Thái Nguyên, Tuyên Quang)

Chỉ thị chỉ huy: Giữ vững liên lạc vệ tinh 24/7, ưu tiên tuyệt đối người già, trẻ nhỏ và phụ nữ mang thai.`;
  }

  // =========================================================================
  // 4. BẢN ĐỒ TÁC CHIẾN GIS TƯƠNG TÁC (TACTICAL GIS INTEGRATION)
  // =========================================================================
  function renderTacticalMapLayers() {
    if (!mapInstance) return;

    // 1. Vẽ các điểm SOS với vòng radar nhấp nháy đỏ
    if (tacticalLayers.sosGroup) {
      tacticalLayers.sosGroup.clearLayers();
      const activeSOS = sosData.filter(s => s.status !== 'rescued');

      activeSOS.forEach(s => {
        const markerHtml = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-rose-500 opacity-75 animate-ping"></span>
            <div class="w-7 h-7 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-lg border-2 border-white">
              🆘
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
            <div class="font-extrabold text-rose-700">🆘 ${s.contact_name}</div>
            <div>SĐT: <a href="tel:${s.phone}" class="font-bold text-blue-600">${s.phone}</a></div>
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

    // 2. Vẽ vị trí các đội cứu hộ (xuồng/xe)
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
            <div class="font-extrabold text-blue-900">${u.name}</div>
            <div class="text-slate-600">${u.commander} (SĐT: ${u.phone})</div>
            <div class="text-[11px] font-bold ${u.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}">
              Trạng thái: ${u.status === 'ready' ? 'Sẵn sàng' : 'Đang làm nhiệm vụ'}
            </div>
          </div>
        `);
        tacticalLayers.unitsGroup.addLayer(m);
      });
    }
  }

  function flyToLocation(lat, lng, incidentId) {
    if (!window.map) return;
    window.map.flyTo([lat, lng], 15, { duration: 1.2 });

    const pulse = L.circleMarker([lat, lng], {
      radius: 22,
      color: '#e11d48',
      fillColor: '#fb7185',
      fillOpacity: 0.5,
      weight: 3
    }).addTo(window.map);

    setTimeout(() => {
      if (window.map) window.map.removeLayer(pulse);
    }, 4500);
  }

  function drawTacticalMissionRoute(missionId) {
    const mission = missionData.find(m => m.id === missionId);
    if (!mission || !window.map || !tacticalLayers.dispatchRoutesGroup) return;

    tacticalLayers.dispatchRoutesGroup.clearLayers();

    const unit = unitsData.find(u => u.id === mission.assigned_unit_id);
    const unitLatLng = unit ? [unit.lat, unit.lng] : [mission.victim_lat + 0.02, mission.victim_lng + 0.02];
    const victimLatLng = [mission.victim_lat, mission.victim_lng];
    const shelterLatLng = [mission.shelter_lat, mission.shelter_lng];

    const polyline = L.polyline([unitLatLng, victimLatLng, shelterLatLng], {
      color: '#e11d48',
      weight: 5,
      dashArray: '8, 8',
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    });

    tacticalLayers.dispatchRoutesGroup.addLayer(polyline);
    window.map.fitBounds(polyline.getBounds(), { padding: [60, 60] });

    showToast('🗺️ ĐÃ CẮM LỘ TRÌNH TÁC CHIẾN', `Hiển thị tuyến cứu nạn từ ${mission.assigned_unit_name} tới hiện trường`, 'info');
  }

  // =========================================================================
  // 5. THAO TÁC NGHIỆP VỤ ĐIỀU PHỐI (OPERATIONAL ACTIONS)
  // =========================================================================
  function verifyIncident(itemId) {
    const item = intakeData.find(i => i.id === itemId);
    if (!item) return;

    item.is_verified = true;
    if (item.status === 'pending') item.status = 'verified';

    if (item.source === 'sos_citizen' && item.raw_id) {
      fetch(getApiUrl(`/api/sos/${item.raw_id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'acknowledged' })
      }).catch(e => console.warn('Lỗi PATCH SOS status:', e));
    }

    renderAllComponents();
    showToast('✓ ĐÃ XÁC THỰC THÔNG TIN', `Sự cố ${item.id} đã được điều phối viên thẩm định tính chính xác`, 'success');
  }

  function rejectIncident(itemId) {
    const idx = intakeData.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      intakeData.splice(idx, 1);
      renderAllComponents();
      showToast('🗑️ ĐÃ BÁC BỎ BÁO CÁO', `Báo cáo ${itemId} đã được lọc khỏi hệ thống tác chiến`, 'info');
    }
  }

  function openDispatchModal(incidentId) {
    const item = intakeData.find(i => i.id === incidentId);
    if (!item) return;

    state.selectedIncidentId = incidentId;
    const modal = document.getElementById('command-dispatch-modal');
    if (!modal) return;

    document.getElementById('disp-modal-incident-id').value = item.id;
    document.getElementById('disp-modal-victim-info').innerText = `${item.contact_name} - ${item.phone} (${item.people_count} người)`;
    document.getElementById('disp-modal-location').innerText = `Toạ độ [${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}]`;
    document.getElementById('disp-modal-notes').value = item.description || '';

    const teamSelect = document.getElementById('disp-modal-team-select');
    if (teamSelect) {
      teamSelect.innerHTML = unitsData.map(u => `
        <option value="${u.id}">${u.name} - [${u.status === 'ready' ? '🟢 Sẵn sàng' : '🟡 Đang làm việc'}]</option>
      `).join('');
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  function closeDispatchModal() {
    const modal = document.getElementById('command-dispatch-modal');
    if (modal) modal.classList.add('hidden');
  }

  function submitDispatchMission() {
    const itemId = document.getElementById('disp-modal-incident-id').value;
    const teamId = document.getElementById('disp-modal-team-select').value;
    const shelterName = document.getElementById('disp-modal-shelter-select').value;
    const notes = document.getElementById('disp-modal-notes').value;

    const item = intakeData.find(i => i.id === itemId);
    const unit = unitsData.find(u => u.id === teamId);
    if (!item || !unit) return;

    item.status = 'dispatched';
    item.is_verified = true;
    unit.status = 'en_route';

    const missionId = `CMD-MIS-${String(missionData.length + 1).padStart(2, '0')}`;
    const newMission = {
      id: missionId,
      title: `Ứng cứu ${item.contact_name}`,
      victim_name: item.contact_name,
      victim_phone: item.phone,
      victim_lat: item.lat,
      victim_lng: item.lng,
      assigned_unit_id: unit.id,
      assigned_unit_name: unit.name,
      shelter_name: shelterName,
      shelter_lat: item.lat + 0.015,
      shelter_lng: item.lng - 0.015,
      status: 'en_route',
      dispatched_at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      eta_minutes: 20,
      notes: notes
    };

    missionData.unshift(newMission);
    closeDispatchModal();
    renderAllComponents();

    drawTacticalMissionRoute(missionId);

    if (item.source === 'sos_citizen' && item.raw_id) {
      fetch(getApiUrl(`/api/sos/${item.raw_id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispatched' })
      }).catch(e => console.warn('Lỗi PATCH SOS status:', e));
    }

    showToast('🚀 ĐÃ PHÁT LỆNH ĐIỀU PHỐI', `Lệnh ${missionId} đã giao cho ${unit.name} xuất kích ứng cứu!`, 'success');
  }

  function updateMissionStatus(missionId, newStatus) {
    const mission = missionData.find(m => m.id === missionId);
    if (!mission) return;

    mission.status = newStatus;

    if (newStatus === 'resolved') {
      const item = intakeData.find(i => i.id === mission.sos_id || i.contact_name === mission.victim_name);
      if (item) item.status = 'resolved';

      const unit = unitsData.find(u => u.id === mission.assigned_unit_id);
      if (unit) unit.status = 'ready';

      if (tacticalLayers.dispatchRoutesGroup) {
        tacticalLayers.dispatchRoutesGroup.clearLayers();
      }

      showToast('🏁 HOÀN TẤT GIẢI CỨU', `Nhiệm vụ ${missionId} đã hoàn thành, nạn nhân an toàn!`, 'success');
    }

    renderAllComponents();
  }

  function copySitRepText() {
    const sitrepBox = document.getElementById('cmd-sitrep-text');
    if (!sitrepBox) return;
    navigator.clipboard.writeText(sitrepBox.value).then(() => {
      showToast('📋 ĐÃ SAO CHÉP SITREP', 'Báo cáo tình huống tác chiến đã được chép vào Clipboard để gửi Ban Chỉ huy PCTT', 'success');
    });
  }

  function setIntakeFilter(filter) {
    state.activeIntakeFilter = filter;
    renderIntakeView();
  }

  function onQuickSearch(query) {
    state.quickSearchQuery = query.trim();
    renderIntakeView();
  }

  function setupGlobalEventListeners() {
    window.addEventListener('northstar:sos_received', (e) => {
      if (e.detail) {
        showToast('🚨 TIN SOS MỚI TIẾP NHẬN', `Nạn nhân ${e.detail.contact_name} đang kêu cứu`, 'error');
        refreshSystemData();
      }
    });
  }

  function formatRelativeTime(isoStr) {
    if (!isoStr) return 'Vừa xong';
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} giờ trước`;
    return `${Math.floor(diffH / 24)} ngày trước`;
  }

  return {
    init,
    switchView,
    switchUserRole,
    setMonitoringRegion,
    toggleSidebarCollapse,
    refreshSystemData,
    flyToLocation,
    verifyIncident,
    rejectIncident,
    openDispatchModal,
    closeDispatchModal,
    submitDispatchMission,
    updateMissionStatus,
    drawTacticalMissionRoute,
    copySitRepText,
    setIntakeFilter,
    onQuickSearch,
    getState: () => ({ ...state })
  };
})();

// Gán biến toàn cục
window.CommandUIController = CommandUIController;
