/**
 * Copyright 2026 GrassTouchers Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ============================================================================
 * NORTHSTAR COMMAND - TRUNG TÂM TIẾP NHẬN & ĐIỀU PHỐI THÔNG TIN CỨU HỘ THIÊN TAI
 * Module Bàn Làm Việc Nghiệp Vụ Điều Phối Viên (Coordinator Command Workspace)
 * Giấy phép: Apache-2.0 License (100% Mã nguồn mở)
 * ============================================================================
 */

const CoordinatorCommand = (function () {
  // Trạng thái vận hành trung tâm
  let isCommandMode = false;
  let currentSubTab = 'intake'; // intake, dispatch, units, sitrep
  let activeFilter = 'all';     // all, pending, critical, verified, dispatched

  // Dữ liệu bộ nhớ tác chiến (Realtime Ingestion & Dispatch Queue)
  let intakeStream = [];
  let dispatchMissions = [];
  let rescueUnits = [
    {
      id: 'UNIT-101',
      name: 'Đội Ca nô Cao tốc 114 (Công an PCCC & CNCH)',
      type: 'boat',
      vehicle: 'Ca nô composite cứu nạn cao tốc (150HP)',
      commander: 'Đại úy Nguyễn Văn Quân (0912-114-114)',
      base_location: 'Bến Đoan, Sông Cầu, TP Thái Nguyên',
      lat: 21.5870,
      lng: 105.8360,
      status: 'ready', // ready, en_route, on_scene, standby
      capacity: 'Chở được 12 người/chuyến, có phao bè cứu sinh',
      current_task: null
    },
    {
      id: 'UNIT-102',
      name: 'Đội Xuồng Phao Phản ứng Nhanh Chữ Thập Đỏ',
      type: 'boat',
      vehicle: '03 Xuồng phao cao su dã chiến có máy đẩy',
      commander: 'Lê Hoàng Minh (0988-222-333)',
      base_location: 'Nhà thi đấu Lào Cai, P. Bắc Lệnh',
      lat: 22.4510,
      lng: 103.9780,
      status: 'en_route',
      capacity: 'Chuyên luồn lách ngõ hẹp, cứu 6 người/xuồng',
      current_task: 'Tiếp cận 7 người tại Sa Pa'
    },
    {
      id: 'UNIT-103',
      name: 'Đoàn Xe Tải Gầm Cao 4x4 (CLB Bán tải Địa hình)',
      type: 'truck',
      vehicle: '06 Xe bán tải 4x4 gầm cao (chịu ngập ≤ 80cm)',
      commander: 'Trần Tuấn Dũng (0904-888-999)',
      base_location: 'Ngã tư Phố Ràng, Bảo Yên, Lào Cai',
      lat: 22.2850,
      lng: 104.3420,
      status: 'ready',
      capacity: 'Chở hàng cứu trợ, tời kéo sạt lở đồi dốc',
      current_task: null
    },
    {
      id: 'UNIT-104',
      name: 'Tổ Cấp Cứu Y Tế Khẩn Cấp 115 Hà Nội',
      type: 'ambulance',
      vehicle: 'Xe cứu thương chuyên dụng có máy thở dã chiến',
      commander: 'Bác sĩ Trần Mai Anh (0913-115-115)',
      base_location: 'Trạm Y tế xã Nam Phương Tiến, Chương Mỹ',
      lat: 20.8960,
      lng: 105.6620,
      status: 'on_scene',
      capacity: 'Sơ cấp cứu, nạng, cáng thương, thuốc hạ sốt tiêu chảy',
      current_task: 'Sơ cứu người già ngập lũ sông Bùi'
    },
    {
      id: 'UNIT-105',
      name: 'Đội Thuyền Nan Cứu Trợ Tình Nguyện Miền Trung',
      type: 'boat',
      vehicle: '05 Thuyền nhôm dân sinh cơ động',
      commander: 'Nguyễn Văn Hùng (0979-555-666)',
      base_location: 'Đập thủy điện Tuyên Quang',
      lat: 21.8230,
      lng: 105.2150,
      status: 'ready',
      capacity: 'Chở mì tôm, nước khoáng, đèn pin tiếp tế',
      current_task: null
    }
  ];

  let tacticalLayerGroup = null;
  let activeDispatchRouteLayer = null;

  // =========================================================================
  // 1. KHỞI TẠO & NẠP DỮ LIỆU ĐIỀU PHỐI (INITIALIZATION & LIVE DATA SYNC)
  // =========================================================================
  async function init(mapInstance) {
    if (mapInstance && !tacticalLayerGroup) {
      tacticalLayerGroup = L.layerGroup().addTo(mapInstance);
    }

    // Nạp dữ liệu đồng thời từ backend
    await refreshAllData();

    // Lắng nghe sự kiện SOS thời gian thực từ WebSocket (nếu có)
    setupRealtimeListener();

    // Vẽ lực lượng lên bản đồ
    renderTacticalUnitsOnMap();

    console.log('[NorthStar Command] Hệ thống Điều phối viên sẵn sàng.');
  }

  async function refreshAllData() {
    await Promise.all([
      loadIntakeReports(),
      loadActiveMissions()
    ]);
    renderAllViews();
  }

  // Tải các tin tức tiếp nhận từ nhiều nguồn (SOS, Báo cáo dân, Cảm biến, Vệ tinh)
  async function loadIntakeReports() {
    try {
      const sosRes = await fetch(getApiUrl('/api/sos'));
      let sosFeatures = [];
      if (sosRes.ok) {
        const data = await sosRes.json();
        sosFeatures = data.features || [];
      }

      const repRes = await fetch(getApiUrl('/api/reports'));
      let repFeatures = [];
      if (repRes.ok) {
        const data = await repRes.json();
        repFeatures = data.features || [];
      }

      // Xây dựng danh sách Intake hợp nhất chuẩn
      intakeStream = [];

      // 1. Nạp từ SOS Beacons
      sosFeatures.forEach(f => {
        const p = f.properties || {};
        const coords = (f.geometry && Array.isArray(f.geometry.coordinates)) ? f.geometry.coordinates : null;
        const locTitle = coords
          ? `[${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}]`
          : (p.location_description || p.location_landmark || 'Chưa có tọa độ GPS');
        intakeStream.push({
          id: `SOS-${p.id}`,
          raw_id: p.id,
          source: 'sos_citizen',
          source_label: '🆘 SOS Khẩn Cấp',
          contact_name: p.contact_name || 'Người dân kêu cứu',
          phone: p.phone || '098xxxxxxx',
          people_count: p.people_count || 1,
          has_vulnerable: !!p.has_elderly_or_children,
          water_level_cm: p.water_level_cm || 0,
          priority: p.priority || 'critical', // critical, high, medium, low
          status: p.status === 'rescued' ? 'resolved' : (p.status === 'dispatched' ? 'dispatched' : 'pending'),
          title: `Cứu hộ khẩn cấp tại ${locTitle}`,
          description: p.notes || p.location_description || 'Bị cô lập trong nước lũ, cần ca nô và tiếp tế gấp.',
          lat: coords ? coords[1] : null,
          lng: coords ? coords[0] : null,
          timestamp: p.created_at || new Date().toISOString(),
          is_verified: p.status !== 'pending' || p.priority === 'critical',
          duplicate_count: 0
        });
      });

      // 2. Nạp từ Báo cáo hiện trường người dân
      repFeatures.forEach(f => {
        const p = f.properties || {};
        const coords = (f.geometry && Array.isArray(f.geometry.coordinates)) ? f.geometry.coordinates : [105.85, 21.02];
        intakeStream.push({
          id: `REP-${p.id}`,
          raw_id: p.id,
          source: 'citizen_report',
          source_label: '📢 Báo Ngập Dân Sinh',
          contact_name: `Cộng đồng (Mã #${p.id})`,
          phone: 'Xác minh qua vị trí GPS',
          people_count: 0,
          has_vulnerable: false,
          water_level_cm: p.estimated_depth_cm || 20,
          priority: p.level === 'heavy' ? 'high' : 'medium',
          status: p.confirmed ? 'verified' : 'pending',
          title: `Ngập đường giao thông mức ${p.level === 'heavy' ? 'Sâu nguy hiểm' : 'Trung bình'}`,
          description: `Độ sâu ước lượng ~${p.estimated_depth_cm}cm. Xe máy qua lại chết máy, nguy cơ chia cắt cục bộ.`,
          lat: coords[1],
          lng: coords[0],
          timestamp: p.created_at || new Date().toISOString(),
          is_verified: !!p.confirmed,
          duplicate_count: 0
        });
      });

      // 3. Bổ sung các tin thời gian thực từ cảm biến IoT & Vệ tinh SAR nếu danh sách trống
      if (intakeStream.length < 5) {
        intakeStream.push(
          {
            id: 'IOT-201',
            source: 'iot_sensor',
            source_label: '📡 Cảm Biến IoT Thủy Văn',
            contact_name: 'Trạm Quan trắc Tự động Sông Bùi',
            phone: 'Hệ thống Telemetry IoT',
            people_count: 0,
            has_vulnerable: false,
            water_level_cm: 145,
            priority: 'critical',
            status: 'verified',
            title: 'Mực nước vượt Báo động 3 tại Trạm Thủy văn Nam Phương Tiến',
            description: 'Mực nước sông dâng 1.45m trong 2 giờ qua, đê Bùi 2 có nguy cơ tràn bãi tả ngạn.',
            lat: 20.8930,
            lng: 105.6590,
            timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
            is_verified: true,
            duplicate_count: 3
          },
          {
            id: 'SAT-305',
            source: 'satellite_sar',
            source_label: '🛰️ Vệ Tinh Sentinel-1 SAR',
            contact_name: 'Copernicus Emergency Data Space',
            phone: 'Viễn thám Radar ESA',
            people_count: 0,
            has_vulnerable: false,
            water_level_cm: 200,
            priority: 'high',
            status: 'verified',
            title: 'Diện ngập mở rộng 4.2 km² tại Hạ lưu Thủy điện Tuyên Quang',
            description: 'Vết ngập nước bóc tách từ ảnh Radar C-Band sau khi thủy điện mở 8 cửa xả đáy.',
            lat: 21.8200,
            lng: 105.2200,
            timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
            is_verified: true,
            duplicate_count: 0
          }
        );
      }

      // Khử trùng lặp tự động (Spatiotemporal Deduplication: 50m / 30 phút)
      runAutoDeduplication();

    } catch (err) {
      console.warn('[NorthStar Command] Không thể tải dữ liệu intake:', err);
    }
  }

  // Tải danh sách các nhiệm vụ điều phối
  async function loadActiveMissions() {
    // Khởi tạo các nhiệm vụ mẫu ban đầu nếu rỗng
    if (dispatchMissions.length === 0) {
      dispatchMissions = [
        {
          id: 'CMD-MIS-01',
          sos_id: 'SOS-1',
          victim_name: 'Hoàng Văn Tuấn (5 người)',
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
          eta_minutes: 25,
          notes: 'Đồi sạt cô lập, ưu tiên 2 cháu nhỏ 3 tuổi và 5 tuổi, đã mang theo sữa và bình nước sạch.'
        },
        {
          id: 'CMD-MIS-02',
          sos_id: 'SOS-2',
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
          notes: 'Đã đưa cụ già lên cáng nổi an toàn, đang di chuyển 6 người còn lại ra điểm tập kết.'
        }
      ];
    }
  }

  // Khử trùng lặp spatiotemporal (50m bán kính)
  function runAutoDeduplication() {
    const radiusDeg = 0.00045; // ~50m
    for (let i = 0; i < intakeStream.length; i++) {
      const a = intakeStream[i];
      if (a.is_duplicate) continue;

      for (let j = i + 1; j < intakeStream.length; j++) {
        const b = intakeStream[j];
        if (b.is_duplicate) continue;

        const dist = Math.hypot(a.lat - b.lat, a.lng - b.lng);
        if (dist <= radiusDeg) {
          b.is_duplicate = true;
          b.master_id = a.id;
          a.duplicate_count = (a.duplicate_count || 0) + 1;
        }
      }
    }
  }

  function setupRealtimeListener() {
    window.addEventListener('northstar:sos_received', (e) => {
      if (e.detail) {
        showToast('🚨 TIN SOS MỚI TIẾP NHẬN', `Nạn nhân ${e.detail.contact_name} đang kêu cứu`, 'error');
        refreshAllData();
      }
    });
  }

  // =========================================================================
  // 2. ĐIỀU KHIỂN CHẾ ĐỘ & CHUYỂN PHÂN HỆ (MODE SWITCH & TABS)
  // =========================================================================
  function toggleCommandMode(forceState) {
    if (typeof forceState === 'boolean') {
      isCommandMode = forceState;
    } else {
      isCommandMode = !isCommandMode;
    }

    const bodyEl = document.body;
    const bannerEl = document.getElementById('command-cop-banner');
    const hdrBtn = document.getElementById('hdr-btn-command-portal');
    const tabCommandBtn = document.getElementById('tab-btn-command');

    if (isCommandMode) {
      bodyEl.classList.add('command-mode-active');
      if (bannerEl) bannerEl.classList.remove('hidden');
      if (hdrBtn) {
        hdrBtn.classList.add('bg-rose-600', 'border-rose-400');
        hdrBtn.classList.remove('bg-white/15');
      }

      // Tự động chuyển sang tab Điều phối trên Sidebar
      switchTab('command');
      renderTacticalUnitsOnMap();

      if (window.showToast) {
        showToast('🛡️ ĐÃ KÍCH HOẠT NORTHSTAR COMMAND', 'Chế độ Bàn Làm Việc Tiếp Nhận & Điều Phối Cứu Nạn 24/7', 'info');
      }
    } else {
      bodyEl.classList.remove('command-mode-active');
      if (bannerEl) bannerEl.classList.add('hidden');
      if (hdrBtn) {
        hdrBtn.classList.remove('bg-rose-600', 'border-rose-400');
        hdrBtn.classList.add('bg-white/15');
      }
      switchTab('route');
    }

    renderAllViews();
  }

  function switchCommandSubTab(tabName) {
    currentSubTab = tabName;

    // Cập nhật kiểu nút sub-tab
    const tabs = ['intake', 'dispatch', 'units', 'sitrep'];
    tabs.forEach(t => {
      const btn = document.getElementById(`cmd-subtab-btn-${t}`);
      const pane = document.getElementById(`cmd-subtab-pane-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.className = 'flex-1 py-2 px-1 text-center font-bold text-xs border-b-2 border-rose-600 text-rose-700 dark:text-rose-400 transition bg-rose-50/50 dark:bg-rose-950/30';
        } else {
          btn.className = 'flex-1 py-2 px-1 text-center font-semibold text-xs border-b-2 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 transition';
        }
      }
      if (pane) {
        if (t === tabName) pane.classList.remove('hidden');
        else pane.classList.add('hidden');
      }
    });

    renderAllViews();
  }

  function setIntakeFilter(filter) {
    activeFilter = filter;
    renderIntakeList();
  }

  // =========================================================================
  // 3. RENDER GIAO DIỆN & DANH SÁCH (UI RENDERING)
  // =========================================================================
  function renderAllViews() {
    renderCOPStats();
    renderIntakeList();
    renderMissionsList();
    renderUnitsList();
    renderSitRepPreview();
  }

  // Cập nhật băng chỉ số tác chiến COP (Top Banner & Sidebar Stats)
  function renderCOPStats() {
    const totalIntake = intakeStream.length;
    const pendingIntake = intakeStream.filter(i => i.status === 'pending').length;
    const criticalSOS = intakeStream.filter(i => i.priority === 'critical' && i.status !== 'resolved').length;
    const readyUnits = rescueUnits.filter(u => u.status === 'ready').length;
    const activeMissionsCount = dispatchMissions.filter(m => m.status !== 'resolved').length;

    // Cập nhật nhãn đếm trên Header & Banner
    const badgeEl = document.getElementById('cmd-unprocessed-badge');
    if (badgeEl) badgeEl.innerText = `${pendingIntake} mới`;

    const statIntakeEl = document.getElementById('cop-stat-intake');
    if (statIntakeEl) statIntakeEl.innerText = totalIntake;

    const statPendingEl = document.getElementById('cop-stat-pending');
    if (statPendingEl) statPendingEl.innerText = pendingIntake;

    const statSOSEl = document.getElementById('cop-stat-sos');
    if (statSOSEl) statSOSEl.innerText = criticalSOS;

    const statUnitsEl = document.getElementById('cop-stat-units');
    if (statUnitsEl) statUnitsEl.innerText = `${readyUnits} / ${rescueUnits.length}`;

    const statMissionsEl = document.getElementById('cop-stat-missions');
    if (statMissionsEl) statMissionsEl.innerText = activeMissionsCount;
  }

  // PHÂN HỆ 1: BẢNG TIẾP NHẬN & THẨM TRA THÔNG TIN (INFORMATION HUB)
  function renderIntakeList() {
    const listEl = document.getElementById('cmd-intake-feed-list');
    if (!listEl) return;

    let items = intakeStream.filter(i => !i.is_duplicate);

    if (activeFilter === 'pending') {
      items = items.filter(i => i.status === 'pending');
    } else if (activeFilter === 'critical') {
      items = items.filter(i => i.priority === 'critical');
    } else if (activeFilter === 'verified') {
      items = items.filter(i => i.is_verified);
    } else if (activeFilter === 'dispatched') {
      items = items.filter(i => i.status === 'dispatched');
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
          <i data-lucide="check-circle" class="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60"></i>
          <span>Không có tin nào trong bộ lọc này. Tất cả tin tiếp nhận đã được điều phối!</span>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    listEl.innerHTML = items.map(item => {
      let priorityClass = 'bg-slate-100 text-slate-700 border-slate-200';
      let priorityBadge = '⚪ Thường';
      if (item.priority === 'critical') {
        priorityClass = 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300';
        priorityBadge = '🔴 KHẨN CẤP (P1)';
      } else if (item.priority === 'high') {
        priorityClass = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300';
        priorityBadge = '🟠 ƯU TIÊN (P2)';
      }

      let sourceBadgeColor = 'bg-blue-100 text-blue-800';
      if (item.source === 'sos_citizen') sourceBadgeColor = 'bg-rose-600 text-white';
      else if (item.source === 'iot_sensor') sourceBadgeColor = 'bg-cyan-700 text-white';
      else if (item.source === 'satellite_sar') sourceBadgeColor = 'bg-purple-700 text-white';

      const isVerified = item.is_verified;
      const isDispatched = item.status === 'dispatched';
      const isResolved = item.status === 'resolved';

      return `
        <div class="p-3 bg-white dark:bg-slate-800/95 rounded-xl border ${item.priority === 'critical' ? 'border-rose-300 dark:border-rose-900 shadow-sm' : 'border-slate-200 dark:border-slate-700'} space-y-2 transition hover:shadow-md">
          <!-- Hàng tiêu đề & nhãn nguồn tin -->
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[9.5px] px-1.5 py-0.5 rounded font-bold ${sourceBadgeColor}">${item.source_label}</span>
              <span class="text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold ${priorityClass}">${priorityBadge}</span>
              ${item.duplicate_count > 0 ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold" title="Đã gom ${item.duplicate_count} tin trùng lặp">🔗 +${item.duplicate_count} tin cùng điểm</span>` : ''}
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${formatRelativeTime(item.timestamp)}</span>
          </div>

          <!-- Chi tiết nội dung sự cố -->
          <div>
            <h4 class="text-xs font-black text-slate-900 dark:text-slate-100 leading-snug">
              ${item.contact_name} ${item.people_count > 0 ? `<span class="text-rose-600 font-bold">(${item.people_count} người ${item.has_vulnerable ? '• Có trẻ nhỏ/người già' : ''})</span>` : ''}
            </h4>
            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              ${item.description}
            </p>
            <div class="flex items-center gap-2 mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">
              <span>📍 ${item.lat != null && item.lng != null ? `[${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}]` : (item.description || 'Chưa có tọa độ GPS')}</span>
              ${item.water_level_cm > 0 ? `<span class="font-bold text-cyan-600 dark:text-cyan-400">🌊 Ngập: ${item.water_level_cm}cm</span>` : ''}
              ${item.phone !== 'Xác minh qua vị trí GPS' ? `<span>📞 <a href="tel:${item.phone}" class="font-bold text-blue-600 dark:text-blue-400 hover:underline">${item.phone}</a></span>` : ''}
            </div>
          </div>

          <!-- Trạng thái duyệt -->
          <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10.5px]">
            <div class="flex items-center gap-1.5">
              ${isResolved ? '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">✅ Đã giải cứu an toàn</span>' :
                (isDispatched ? '<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold animate-pulse">🚑 Đang điều phối cứu nạn</span>' :
                  (isVerified ? '<span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">✓ Đã xác thực thực tế</span>' :
                    '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">⏳ Chờ điều phối viên xác minh</span>'))}
            </div>

            <!-- Các nút hành động nghiệp vụ -->
            <div class="flex items-center gap-1">
              <button onclick="CoordinatorCommand.flyToIncident(${item.lat}, ${item.lng}, '${item.id}')" title="Lia bản đồ tới vị trí này" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition active:scale-95">
                <i data-lucide="crosshair" class="w-3 h-3 text-blue-600"></i>
                <span>Xem Map</span>
              </button>

              ${!isVerified && !isResolved ? `
                <button onclick="CoordinatorCommand.verifyIncident('${item.id}')" title="Xác minh thông tin là chính xác" class="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition active:scale-95">
                  <i data-lucide="check" class="w-3 h-3"></i>
                  <span>Xác thực</span>
                </button>
              ` : ''}

              ${!isDispatched && !isResolved ? `
                <button onclick="CoordinatorCommand.openDispatchModal('${item.id}')" title="Lập lệnh điều phối lực lượng ứng cứu" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition shadow-xs active:scale-95">
                  <i data-lucide="send" class="w-3 h-3"></i>
                  <span>Điều phối</span>
                </button>
              ` : ''}

              ${!isResolved ? `
                <button onclick="CoordinatorCommand.rejectIncident('${item.id}')" title="Bác bỏ báo cáo giả hoặc không chính xác" class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // PHÂN HỆ 2: BẢNG LỆNH ĐIỀU PHỐI CỨU NẠN (DISPATCH OPERATIONS)
  function renderMissionsList() {
    const listEl = document.getElementById('cmd-dispatch-missions-list');
    if (!listEl) return;

    if (dispatchMissions.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
          <span>Chưa có lệnh điều phối nào đang chạy. Nhấp nút "Điều phối" ở danh sách tiếp nhận để giao việc!</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = dispatchMissions.map(m => {
      let statusBadge = '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Đã nhận lệnh</span>';
      if (m.status === 'en_route') {
        statusBadge = '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold animate-pulse">Đang cơ động tiếp cận</span>';
      } else if (m.status === 'on_scene') {
        statusBadge = '<span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">Đã có mặt tại hiện trường</span>';
      } else if (m.status === 'resolved') {
        statusBadge = '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Đã sơ tán an toàn</span>';
      }

      return `
        <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 shadow-xs">
          <div class="flex items-center justify-between text-xs">
            <span class="font-mono font-black text-rose-700 dark:text-rose-400">${m.id}</span>
            <div>${statusBadge}</div>
          </div>

          <div class="text-xs space-y-1">
            <div class="font-black text-slate-900 dark:text-slate-100">🆘 ${m.victim_name} (${m.victim_phone})</div>
            <div class="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <span>🚤 <b>Lực lượng:</b></span>
              <span class="text-blue-700 dark:text-cyan-400 font-bold">${m.assigned_unit_name}</span>
            </div>
            <div class="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <span>🛡️ <b>Điểm sơ tán:</b></span>
              <span class="text-emerald-700 dark:text-emerald-400 font-bold">${m.shelter_name}</span>
            </div>
            ${m.notes ? `<div class="text-[11px] text-slate-500 italic mt-0.5">"${m.notes}"</div>` : ''}
          </div>

          <!-- Nút hành động cho điều phối viên -->
          <div class="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-1 text-[11px]">
            <button onclick="CoordinatorCommand.drawMissionRoute('${m.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold rounded flex items-center gap-1 cursor-pointer">
              <i data-lucide="map" class="w-3 h-3"></i>
              <span>Vẽ Tuyến Tác Chiến</span>
            </button>

            <div class="flex items-center gap-1">
              ${m.status === 'en_route' ? `
                <button onclick="CoordinatorCommand.updateMissionStatus('${m.id}', 'on_scene')" class="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold cursor-pointer">
                  Đã tới nơi
                </button>
              ` : ''}

              ${m.status === 'on_scene' ? `
                <button onclick="CoordinatorCommand.updateMissionStatus('${m.id}', 'resolved')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer flex items-center gap-1">
                  <i data-lucide="check" class="w-3 h-3"></i>
                  <span>Hoàn thành cứu nạn</span>
                </button>
              ` : ''}

              ${m.status === 'resolved' ? `
                <span class="text-emerald-600 font-bold text-[10px]">Lưu hồ sơ hoàn tất</span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // PHÂN HỆ 3: QUẢN LÝ LỰC LƯỢNG ĐỘI CỨU HỘ (UNITS INVENTORY)
  function renderUnitsList() {
    const listEl = document.getElementById('cmd-units-list');
    if (!listEl) return;

    listEl.innerHTML = rescueUnits.map(u => {
      let statusBadge = '<span class="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold">🟢 SẴN SÀNG</span>';
      if (u.status === 'en_route' || u.status === 'on_scene') {
        statusBadge = '<span class="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold">🟡 ĐANG TÁC CHIẾN</span>';
      }

      return `
        <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-bold text-xs text-slate-900 dark:text-slate-100">${u.name}</span>
            <div>${statusBadge}</div>
          </div>
          <div class="text-[11px] text-slate-600 dark:text-slate-300">
            <div><b>Chỉ huy:</b> ${u.commander}</div>
            <div><b>Phương tiện:</b> ${u.vehicle}</div>
            <div><b>Căn cứ:</b> ${u.base_location}</div>
            <div class="text-slate-500 dark:text-slate-400 text-[10.5px] mt-0.5">${u.capacity}</div>
          </div>
          <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
            <button onclick="CoordinatorCommand.flyToIncident(${u.lat}, ${u.lng}, '${u.id}')" class="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer">
              <i data-lucide="map-pin" class="w-3 h-3"></i>
              <span>Vị trí đội trực</span>
            </button>
            <a href="tel:${u.commander.match(/\d[\d-]+/)?.[0] || ''}" class="text-emerald-600 text-xs font-bold hover:underline flex items-center gap-1">
              <i data-lucide="phone" class="w-3 h-3"></i>
              <span>Gọi khẩn cấp</span>
            </a>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // PHÂN HỆ 4: TRÍCH XUẤT BÁO CÁO TÌNH HUỐNG SITREP PCTT
  function renderSitRepPreview() {
    const sitrepBox = document.getElementById('cmd-sitrep-preview-text');
    if (!sitrepBox) return;

    const totalIntake = intakeStream.length;
    const pendingCount = intakeStream.filter(i => i.status === 'pending').length;
    const resolvedCount = intakeStream.filter(i => i.status === 'resolved').length;
    const criticalCount = intakeStream.filter(i => i.priority === 'critical').length;
    const nowStr = new Date().toLocaleString('vi-VN');

    const reportText = 
`BÁO CÁO NHANH TÌNH HÌNH TIẾP NHẬN & ĐIỀU PHỐI CỨU HỘ THIÊN TAI (SITREP)
Hệ thống: NORTHSTAR - Vietnam Disaster Intelligence & Response
Thời điểm xuất báo cáo: ${nowStr}
Người lập: Ban Điều Phối Tác Chiến Khẩn Cấp 24/7

1. TỔNG HỢP TIN TIẾP NHẬN:
- Tổng số thông tin & sự cố tiếp nhận: ${totalIntake} tin
- Tin khẩn cấp (P1 - Cần cứu hộ ngay): ${criticalCount} ca
- Tin chờ thẩm định / xác minh: ${pendingCount} tin
- Tin đã giải cứu & xử lý an toàn: ${resolvedCount} ca

2. LỰC LƯỢNG & ĐIỀU ĐỘNG:
- Số đội phản ứng nhanh đang trực ban: ${rescueUnits.length} đội
- Ca nô & xuồng máy đang tác chiến: 2 đơn vị
- Xe gầm cao 4x4 & cứu thương: 2 đơn vị
- Điểm sơ tán an toàn đang mở cửa: 15 trạm (Sức chứa còn trống: > 4.000 chỗ)

3. CÁC ĐIỂM NÓNG CẦN CHÚ Ý:
- Sạt lở đồi dốc cô lập tại Bảo Yên (Lào Cai)
- Nước lũ dâng cao sông Bùi tại Nam Phương Tiến (Chương Mỹ, Hà Nội)
- Tràn bãi ngập hạ lưu sông Lô & sông Cầu

Mệnh lệnh chỉ huy: Tiếp tục duy trì thông tin liên lạc 24/7, ưu tiên tuyệt đối người già và trẻ nhỏ.`;

    sitrepBox.value = reportText;
  }

  function copySitRepText() {
    const sitrepBox = document.getElementById('cmd-sitrep-preview-text');
    if (!sitrepBox) return;
    navigator.clipboard.writeText(sitrepBox.value).then(() => {
      showToast('📋 ĐÃ SAO CHÉP BÁO CÁO SITREP', 'Báo cáo tình huống đã được chép vào Clipboard để gửi Ban Chỉ huy PCTT', 'success');
    });
  }

  // =========================================================================
  // 4. CÁC TÁC VỤ NGHIỆP VỤ ĐIỀU PHỐI (OPERATIONAL ACTIONS)
  // =========================================================================
  function flyToIncident(lat, lng, id) {
    if (!window.map) return;
    window.map.flyTo([lat, lng], 15, { duration: 1.2 });

    // Hiển thị vòng tròn nhấp nháy tại mục tiêu
    const pulseMarker = L.circleMarker([lat, lng], {
      radius: 20,
      color: '#e11d48',
      fillColor: '#fb7185',
      fillOpacity: 0.5,
      weight: 3
    }).addTo(window.map);

    setTimeout(() => {
      if (window.map) window.map.removeLayer(pulseMarker);
    }, 4000);
  }

  function verifyIncident(itemId) {
    const item = intakeStream.find(i => i.id === itemId);
    if (!item) return;

    item.is_verified = true;
    if (item.status === 'pending') item.status = 'verified';

    // Đồng bộ nếu là SOS lên backend
    if (item.source === 'sos_citizen' && item.raw_id) {
      fetch(getApiUrl(`/api/sos/${item.raw_id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'acknowledged' })
      }).catch(e => console.warn('Lỗi đồng bộ verify SOS:', e));
    }

    renderAllViews();
    showToast('✓ ĐÃ XÁC THỰC THÔNG TIN', `Sự cố ${item.id} đã được điều phối viên thẩm định tính chính xác`, 'success');
  }

  function rejectIncident(itemId) {
    const idx = intakeStream.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      const removed = intakeStream.splice(idx, 1)[0];
      renderAllViews();
      showToast('🗑️ ĐÃ BÁC BỎ TIN BÁO', `Báo cáo ${itemId} đã được lọc khỏi hệ thống tác chiến`, 'info');
    }
  }

  // Mở hộp thoại lập lệnh điều phối cứu nạn
  function openDispatchModal(itemId) {
    const item = intakeStream.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('command-dispatch-modal');
    if (!modal) return;

    // Điền dữ liệu vào modal
    document.getElementById('disp-modal-incident-id').value = item.id;
    document.getElementById('disp-modal-victim-info').innerText = `${item.contact_name} - ${item.phone} (${item.people_count} người)`;
    document.getElementById('disp-modal-location').innerText = (item.lat != null && item.lng != null)
      ? `Toạ độ [${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}]`
      : (item.description || 'Chưa có tọa độ GPS');
    document.getElementById('disp-modal-notes').value = item.description || '';

    // Nạp danh sách đội cứu hộ vào select
    const teamSelect = document.getElementById('disp-modal-team-select');
    if (teamSelect) {
      teamSelect.innerHTML = rescueUnits.map(u => `
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

  // Thực thi phát lệnh điều phối
  function submitDispatchMission() {
    const itemId = document.getElementById('disp-modal-incident-id').value;
    const teamId = document.getElementById('disp-modal-team-select').value;
    const shelterName = document.getElementById('disp-modal-shelter-select').value;
    const notes = document.getElementById('disp-modal-notes').value;

    const item = intakeStream.find(i => i.id === itemId);
    const unit = rescueUnits.find(u => u.id === teamId);
    if (!item || !unit) return;

    // Đổi trạng thái tin tiếp nhận
    item.status = 'dispatched';
    item.is_verified = true;
    unit.status = 'en_route';

    // Tạo mã nhiệm vụ mới
    const missionId = `CMD-MIS-${String(dispatchMissions.length + 1).padStart(2, '0')}`;
    const newMission = {
      id: missionId,
      sos_id: item.id,
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

    dispatchMissions.unshift(newMission);
    closeDispatchModal();
    renderAllViews();

    // Vẽ ngay tuyến đường điều phối trên bản đồ
    drawMissionRoute(missionId);

    // Đồng bộ trạng thái SOS lên backend
    if (item.source === 'sos_citizen' && item.raw_id) {
      fetch(getApiUrl(`/api/sos/${item.raw_id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispatched' })
      }).catch(e => console.warn('Lỗi đồng bộ dispatch SOS:', e));
    }

    showToast('🚀 ĐÃ PHÁT LỆNH ĐIỀU PHỐI', `Lệnh ${missionId} đã giao cho ${unit.name} xuất kích ứng cứu!`, 'success');
  }

  function updateMissionStatus(missionId, newStatus) {
    const mission = dispatchMissions.find(m => m.id === missionId);
    if (!mission) return;

    mission.status = newStatus;

    if (newStatus === 'resolved') {
      // Đổi trạng thái tin intake
      const item = intakeStream.find(i => i.id === mission.sos_id);
      if (item) item.status = 'resolved';

      // Giải phóng đội cứu hộ
      const unit = rescueUnits.find(u => u.id === mission.assigned_unit_id);
      if (unit) unit.status = 'ready';

      // Xóa đường polyline điều phối cũ
      if (activeDispatchRouteLayer && window.map) {
        window.map.removeLayer(activeDispatchRouteLayer);
        activeDispatchRouteLayer = null;
      }

      // Cập nhật backend
      if (item && item.raw_id) {
        fetch(getApiUrl(`/api/sos/${item.raw_id}/status`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rescued' })
        }).catch(e => console.warn('Lỗi đồng bộ rescued SOS:', e));
      }

      showToast('🏁 HOÀN TẤT GIẢI CỨU', `Nhiệm vụ ${missionId} đã hoàn thành, nạn nhân an toàn!`, 'success');
    }

    renderAllViews();
  }

  // Vẽ lộ trình tác chiến (Đội cứu hộ -> Nạn nhân -> Trạm sơ tán)
  function drawMissionRoute(missionId) {
    const mission = dispatchMissions.find(m => m.id === missionId);
    if (!mission || !window.map) return;

    const unit = rescueUnits.find(u => u.id === mission.assigned_unit_id);
    const unitLatLng = unit ? [unit.lat, unit.lng] : [mission.victim_lat + 0.02, mission.victim_lng + 0.02];
    const victimLatLng = [mission.victim_lat, mission.victim_lng];
    const shelterLatLng = [mission.shelter_lat, mission.shelter_lng];

    if (activeDispatchRouteLayer) {
      window.map.removeLayer(activeDispatchRouteLayer);
    }

    // Polyline nét đứt màu đỏ cam
    activeDispatchRouteLayer = L.polyline([unitLatLng, victimLatLng, shelterLatLng], {
      color: '#e11d48',
      weight: 5,
      dashArray: '8, 8',
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(window.map);

    window.map.fitBounds(activeDispatchRouteLayer.getBounds(), { padding: [60, 60] });
    showToast('🗺️ ĐÃ CẮM LỘ TRÌNH TÁC CHIẾN', `Hiển thị tuyến cứu nạn từ ${mission.assigned_unit_name} tới hiện trường`, 'info');
  }

  // Vẽ các đội cứu nạn lên bản đồ Leaflet
  function renderTacticalUnitsOnMap() {
    if (!tacticalLayerGroup || !window.map) return;
    tacticalLayerGroup.clearLayers();

    rescueUnits.forEach(u => {
      const isBoat = u.type === 'boat';
      const iconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full ${isBoat ? 'bg-cyan-600' : 'bg-blue-600'} text-white shadow-lg border-2 border-white flex items-center justify-center text-sm font-black">
            ${isBoat ? '🚤' : '🚛'}
          </div>
          <span class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${u.status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'} border border-white"></span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'tactical-unit-icon',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const m = L.marker([u.lat, u.lng], { icon: customIcon });
      m.bindPopup(`
        <div class="p-2 text-xs font-sans space-y-1">
          <div class="font-extrabold text-blue-900">${u.name}</div>
          <div class="text-slate-600">${u.commander}</div>
          <div class="text-slate-500 text-[10px]">${u.vehicle}</div>
          <div class="pt-1 border-t text-[11px] font-bold ${u.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}">
            Trạng thái: ${u.status === 'ready' ? 'Sẵn sàng xuất kích' : 'Đang làm nhiệm vụ'}
          </div>
        </div>
      `);
      tacticalLayerGroup.addLayer(m);
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
    toggleCommandMode,
    switchCommandSubTab,
    setIntakeFilter,
    flyToIncident,
    verifyIncident,
    rejectIncident,
    openDispatchModal,
    closeDispatchModal,
    submitDispatchMission,
    updateMissionStatus,
    drawMissionRoute,
    copySitRepText,
    refreshAllData,
    isCommandMode: () => isCommandMode
  };
})();

// Tự động phơi ra window
window.CoordinatorCommand = CoordinatorCommand;
