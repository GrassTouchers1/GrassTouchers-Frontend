/**
 * ===================================================================
 * NORTHSTAR - Multi-Hazard GIS & Emergency Rescue Management Module
 * Quản lý Vùng Thiên Tai, Điểm Sơ Tán An Toàn & Tín Hiệu Kêu Cứu SOS
 * Giấy phép: Apache-2.0 License (100% Mã nguồn mở)
 * ===================================================================
 */

const NorthStarRescue = (function () {
  let disasterLayerGroup = null;
  let shelterLayerGroup = null;
  let sosLayerGroup = null;
  let evacuationRouteLayer = null;

  let allShelters = [];
  let allDisasters = [];
  let allSOSBeacons = [];

  function initRescueLayers(map) {
    if (!map) return;
    if (!disasterLayerGroup) disasterLayerGroup = L.layerGroup().addTo(map);
    if (!shelterLayerGroup) shelterLayerGroup = L.layerGroup().addTo(map);
    if (!sosLayerGroup) sosLayerGroup = L.layerGroup().addTo(map);
    connectRealtimeWebSocket();
  }

  // ==========================================
  // WEBSOCKET REAL-TIME CLIENT
  // ==========================================
  let socket = null;
  let socketReconnectTimer = null;

  function connectRealtimeWebSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = (typeof GRASSTOUCHER_CONFIG !== 'undefined' && GRASSTOUCHER_CONFIG.WS_BASE_URL)
      ? GRASSTOUCHER_CONFIG.WS_BASE_URL
      : 'ws://localhost:8000/ws/navigation';

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[NorthStar WS] Đã kết nối kênh thời gian thực:', wsUrl);
        setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'reroute_required') {
            console.warn('[NorthStar WS] Phát hiện điểm nguy hiểm phía trước:', msg);
            if (typeof VoiceAssistant !== 'undefined' && VoiceAssistant.speak) {
              VoiceAssistant.speak('Phía trước có đoạn ngập nguy hiểm mới phát sinh. Hệ thống đang tự động chuyển hướng an toàn.');
            }
          } else if (msg.type === 'sos_broadcast') {
            loadSOSBeacons();
          } else if (msg.type === 'hazard_broadcast') {
            loadDisasters();
          }
        } catch (e) {
          console.error(e);
        }
      };

      socket.onclose = () => {
        clearTimeout(socketReconnectTimer);
        socketReconnectTimer = setTimeout(connectRealtimeWebSocket, 5000);
      };

      socket.onerror = (err) => {
        console.debug('[NorthStar WS] Lỗi kết nối socket:', err);
      };
    } catch (e) {
      console.debug('[NorthStar WS] Không thể mở socket:', e);
    }
  }

  // ==========================================
  // 1. TẢI VÀ VẼ VÙNG THIÊN TAI (DISASTERS)
  // ==========================================
  async function loadDisasters() {
    try {
      const res = await fetch(getApiUrl('/api/disasters'));
      if (!res.ok) return;
      const data = await res.json();
      allDisasters = data.features || [];
      renderDisasterLayers();
      renderDisastersSidebar();
    } catch (err) {
      console.warn('Lỗi tải dữ liệu vùng thiên tai:', err);
    }
  }

  function renderDisasterLayers() {
    if (!window.map || !disasterLayerGroup) return;
    disasterLayerGroup.clearLayers();

    allDisasters.forEach(feat => {
      const p = feat.properties;
      const coords = feat.geometry.coordinates;
      const latLng = [coords[1], coords[0]];
      const radius = p.radius_m || 200;

      let color = '#f97316'; // flood
      let fillColor = '#fb923c';
      let icon = 'waves';

      if (p.hazard_type === 'landslide') {
        color = '#dc2626';
        fillColor = '#ef4444';
        icon = 'mountain';
      } else if (p.hazard_type === 'storm') {
        color = '#eab308';
        fillColor = '#fde047';
        icon = 'wind';
      }

      // Vẽ vòng tròn bán kính vùng nguy cơ
      const circle = L.circle(latLng, {
        radius: radius,
        color: color,
        weight: 2,
        fillColor: fillColor,
        fillOpacity: 0.25,
        dashArray: p.severity === 'critical' ? '4, 4' : null,
      });

      // Marker biểu tượng nguy hiểm
      const markerHtml = `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-8 h-8 rounded-full opacity-75 animate-ping" style="background-color: ${color}"></span>
          <div class="w-7 h-7 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold" style="background-color: ${color}">
            ⚠️
          </div>
        </div>
      `;
      const customIcon = L.divIcon({
        className: 'disaster-hazard-icon',
        html: markerHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker(latLng, { icon: customIcon });

      const hazardLabels = {
        flood: 'LŨ LỤT & NGẬP SÂU',
        landslide: 'SẠT LỞ ĐẤT',
        storm: 'BÃO & DÔNG LỐC',
        surge: 'TRIỀU CƯỜNG'
      };
      const hazardName = hazardLabels[String(p.hazard_type).toLowerCase()] || String(p.hazard_type).toUpperCase();

      let severityBadge = '<span class="text-[9.5px] px-1.5 py-0.5 rounded font-extrabold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">CẢNH BÁO</span>';
      if (p.severity === 'critical') {
        severityBadge = '<span class="text-[9.5px] px-1.5 py-0.5 rounded font-black bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-wide animate-pulse">ĐẶC BIỆT NGUY CẤP</span>';
      } else if (p.severity === 'high') {
        severityBadge = '<span class="text-[9.5px] px-1.5 py-0.5 rounded font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wide">RẤT NGUY HIỂM</span>';
      }

      const popupHtml = `
        <div class="p-2.5 max-w-[310px] text-slate-800 dark:text-slate-100 font-sans">
          <div class="flex items-center justify-between gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <span class="font-extrabold text-xs uppercase tracking-tight flex items-center gap-1" style="color: ${color}">
              <span>⚠️ CẢNH BÁO: ${hazardName}</span>
            </span>
            ${severityBadge}
          </div>
          <h4 class="font-black text-[14.5px] text-slate-900 dark:text-white mt-2 leading-snug tracking-tight">${p.title}</h4>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed font-normal">${p.description || 'Khu vực nguy cơ cao, hạn chế di chuyển qua lại.'}</p>
          <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span class="flex items-center gap-1">📡 Bán kính ảnh hưởng:</span>
            <b class="text-slate-700 dark:text-slate-200 font-bold font-mono">~${radius}m</b>
          </div>
        </div>
      `;
      circle.bindPopup(popupHtml, { className: 'flood-custom-popup', maxWidth: 330, minWidth: 280 });
      marker.bindPopup(popupHtml, { className: 'flood-custom-popup', maxWidth: 330, minWidth: 280 });

      disasterLayerGroup.addLayer(circle);
      disasterLayerGroup.addLayer(marker);
    });
  }

  function renderDisastersSidebar() {
    const listEl = document.getElementById('rescue-disasters-list');
    if (!listEl) return;
    if (!allDisasters.length) {
      listEl.innerHTML = '<div class="text-xs text-slate-500 py-2">Hiện không có cảnh báo thiên tai diện rộng.</div>';
      return;
    }

    listEl.innerHTML = allDisasters.map(f => {
      const p = f.properties;
      const coords = f.geometry.coordinates;
      let badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
      if (p.severity === 'critical') badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';

      return `
        <div onclick="NorthStarRescue.flyToPoint(${coords[1]}, ${coords[0]})" class="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-slate-50 cursor-pointer transition shadow-sm">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-bold text-slate-900">${p.title}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold border ${badgeClass}">${p.hazard_type}</span>
          </div>
          <div class="text-[11px] text-slate-600 mt-1 line-clamp-2">${p.description || ''}</div>
          <div class="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Bán kính ảnh hưởng: ${p.radius_m}m</span>
            <span>•</span>
            <span class="text-blue-600 font-semibold hover:underline">Xem trên bản đồ</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // 2. TẢI VÀ VẼ ĐIỂM SƠ TÁN AN TOÀN (SHELTERS)
  // ==========================================
  async function loadShelters() {
    try {
      const res = await fetch(getApiUrl('/api/shelters'));
      if (!res.ok) return;
      const data = await res.json();
      allShelters = data.features || [];
      renderShelterLayers();
      renderSheltersSidebar();
    } catch (err) {
      console.warn('Lỗi tải dữ liệu điểm sơ tán:', err);
    }
  }

  function renderShelterLayers() {
    if (!window.map || !shelterLayerGroup) return;
    shelterLayerGroup.clearLayers();

    allShelters.forEach(feat => {
      const p = feat.properties;
      const coords = feat.geometry.coordinates;
      const latLng = [coords[1], coords[0]];

      const markerHtml = `
        <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white hover:scale-110 transition cursor-pointer">
          <span class="text-xs font-bold">🛡️</span>
        </div>
      `;
      const shelterIcon = L.divIcon({
        className: 'shelter-map-icon',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker(latLng, { icon: shelterIcon });
      const percent = Math.min(100, Math.round((p.current_occupancy / p.capacity) * 100));

      const popupHtml = `
        <div class="p-2.5 max-w-xs text-slate-800 font-sans">
          <div class="flex items-center gap-1.5 text-emerald-700 font-bold text-xs uppercase">
            <span>🛡️ ĐIỂM SƠ TÁN AN TOÀN</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">${p.status}</span>
          </div>
          <h4 class="font-bold text-sm text-slate-900 mt-1">${p.name}</h4>
          <p class="text-xs text-slate-500 mt-0.5">${p.address || ''}</p>
          
          <div class="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="text-slate-600">Sức chứa:</span>
              <span class="font-bold text-slate-900">${p.current_occupancy} / ${p.capacity} (${percent}%)</span>
            </div>
            <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full ${percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${percent}%"></div>
            </div>
            <div class="text-[11px] text-slate-600">
              <b>Vật tư:</b> ${p.supplies_status || 'Sẵn sàng'}
            </div>
            ${p.contact_phone ? `<div class="text-[11px] text-slate-700"><b>Hotline:</b> <a href="tel:${p.contact_phone}" class="text-blue-600 font-bold hover:underline">${p.contact_phone}</a></div>` : ''}
          </div>

          <button onclick="NorthStarRescue.routeToShelter(${coords[0]}, ${coords[1]}, '${p.name.replace(/'/g, "\\'")}')" class="w-full mt-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center justify-center gap-1.5 cursor-pointer">
            <span>Dẫn đường sơ tán tới đây</span>
          </button>
        </div>
      `;
      marker.bindPopup(popupHtml, { className: 'flood-custom-popup', maxWidth: 330, minWidth: 280 });
      shelterLayerGroup.addLayer(marker);
    });
  }

  function renderSheltersSidebar() {
    const listEl = document.getElementById('rescue-shelters-list');
    if (!listEl) return;
    if (!allShelters.length) {
      listEl.innerHTML = '<div class="text-xs text-slate-500 py-2">Đang tải danh sách trạm sơ tán...</div>';
      return;
    }

    listEl.innerHTML = allShelters.map(f => {
      const p = f.properties;
      const coords = f.geometry.coordinates;
      const percent = Math.min(100, Math.round((p.current_occupancy / p.capacity) * 100));

      return `
        <div class="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-sm transition">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-bold text-slate-900">${p.name}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">${p.status}</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-0.5 line-clamp-1">${p.address || ''}</div>
          
          <div class="mt-2 space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-500">Chỗ tiếp nhận:</span>
              <span class="font-bold text-slate-800">${p.current_occupancy}/${p.capacity} (${p.available_slots} còn trống)</span>
            </div>
            <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full ${percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${percent}%"></div>
            </div>
          </div>

          <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            ${p.contact_phone ? `<a href="tel:${p.contact_phone}" class="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-1">📞 ${p.contact_phone}</a>` : '<span></span>'}
            <button onclick="NorthStarRescue.routeToShelter(${coords[0]}, ${coords[1]}, '${p.name.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition">
              Sơ tán tới đây
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // 3. TẢI VÀ VẼ TÍN HIỆU SOS (BEACONS)
  // ==========================================
  async function loadSOSBeacons() {
    try {
      const res = await fetch(getApiUrl('/api/sos'));
      if (!res.ok) return;
      const data = await res.json();
      allSOSBeacons = data.features || [];
      renderSOSLayers();
      renderSOSSidebar();
    } catch (err) {
      console.warn('Lỗi tải tín hiệu SOS:', err);
    }
  }

  function renderSOSLayers() {
    if (!window.map || !sosLayerGroup) return;
    sosLayerGroup.clearLayers();

    allSOSBeacons.forEach(feat => {
      const p = feat.properties;
      const coords = feat.geometry.coordinates;
      const latLng = [coords[1], coords[0]];

      if (p.status === 'rescued' || p.status === 'cancelled') return;

      const markerHtml = `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-10 h-10 rounded-full bg-rose-500 opacity-75 animate-ping"></span>
          <div class="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl border-2 border-white text-xs font-black">
            SOS
          </div>
        </div>
      `;
      const sosIcon = L.divIcon({
        className: 'sos-beacon-icon',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker(latLng, { icon: sosIcon });
      const popupHtml = `
        <div class="p-2.5 max-w-[290px] text-slate-800 font-sans">
          <div class="flex items-center justify-between text-rose-600 font-bold text-xs pb-1 border-b border-rose-100">
            <span class="flex items-center gap-1">🚨 YÊU CẦU CỨU HỘ KHẨN CẤP</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-rose-100 text-rose-700 border border-rose-200">${p.priority.toUpperCase()}</span>
          </div>
          <h4 class="font-extrabold text-sm text-slate-900 mt-1.5 leading-snug">${p.contact_name} - ${p.phone}</h4>
          <div class="text-xs text-slate-600 mt-1.5 space-y-1 bg-slate-50/80 p-2 rounded-lg border border-slate-200/70">
            <div class="flex justify-between items-center">
              <span class="text-slate-500 font-medium">Số người mắc kẹt:</span>
              <span class="font-bold text-slate-800">${p.people_count} người ${p.has_elderly_or_children ? '⚠️' : ''}</span>
            </div>
            ${p.has_elderly_or_children ? '<div class="text-[10.5px] text-amber-700 font-semibold">(Có trẻ nhỏ / người già neo đơn)</div>' : ''}
            <div class="flex justify-between items-center">
              <span class="text-slate-500 font-medium">Mực nước ngập:</span>
              <span class="font-bold text-rose-600">~${p.water_level_cm} cm</span>
            </div>
            ${p.notes ? `<div class="pt-1 mt-1 border-t border-slate-200/60 text-[11px] text-slate-600 leading-relaxed italic">"${p.notes}"</div>` : ''}
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 flex gap-2">
            <a href="tel:${p.phone}" style="color: #ffffff !important; text-decoration: none !important;" class="flex-1 py-2 px-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 active:from-emerald-800 active:to-green-800 !text-white rounded-lg text-center text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer no-underline">
              <svg class="w-3.5 h-3.5 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              <span class="!text-white font-black" style="color: #ffffff !important;">Gọi nạn nhân</span>
            </a>
            <button onclick="NorthStarRescue.resolveSOS(${p.id})" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer">
              <span>Đã an toàn</span>
            </button>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml, { className: 'flood-custom-popup', maxWidth: 330, minWidth: 280 });
      sosLayerGroup.addLayer(marker);
    });
  }

  function renderSOSSidebar() {
    const listEl = document.getElementById('rescue-sos-list');
    if (!listEl) return;
    const activeBeacons = allSOSBeacons.filter(b => b.properties.status !== 'rescued' && b.properties.status !== 'cancelled');
    if (!activeBeacons.length) {
      listEl.innerHTML = '<div class="text-xs text-slate-500 py-2">Hiện chưa có tín hiệu kêu cứu SOS chưa xử lý.</div>';
      return;
    }

    listEl.innerHTML = activeBeacons.map(f => {
      const p = f.properties;
      const coords = f.geometry.coordinates;

      return `
        <div class="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition shadow-sm">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-bold text-rose-900">🆘 ${p.contact_name} (${p.people_count} người)</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-200 text-rose-900">${p.priority}</span>
          </div>
          <div class="text-[11px] text-slate-600 mt-1">SĐT: <a href="tel:${p.phone}" class="text-blue-600 font-bold">${p.phone}</a> ${p.has_elderly_or_children ? '• Có trẻ nhỏ/người già' : ''}</div>
          ${p.notes ? `<div class="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">"${p.notes}"</div>` : ''}
          <div class="mt-2 flex items-center justify-between">
            <button onclick="NorthStarRescue.flyToPoint(${coords[1]}, ${coords[0]})" class="text-[11px] text-blue-600 font-semibold hover:underline">Vị trí bản đồ</button>
            <button onclick="NorthStarRescue.resolveSOS(${p.id})" class="text-[11px] text-slate-500 hover:text-emerald-600 font-medium">Đánh dấu đã cứu</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // 4. THUẬT TOÁN TÌM ĐƯỜNG SƠ TÁN KHẨN CẤP
  // ==========================================
  async function findEvacuationRoute(originCoords = null, vehicle = 'walk') {
    const resultCard = document.getElementById('evacuation-result-card');
    const loadingEl = document.getElementById('evacuation-loading');

    // Xác định toạ độ xuất phát
    let orig = originCoords;
    if (!orig) {
      if (window.coords && window.coords.origin) {
        orig = window.coords.origin;
      } else {
        // Fallback: tâm bản đồ hiện tại
        const center = window.map ? window.map.getCenter() : { lat: 21.0285, lng: 105.8030 };
        orig = { lng: center.lng, lat: center.lat };
      }
    }

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (resultCard) resultCard.classList.add('hidden');

    try {
      const res = await fetch(getApiUrl('/api/route/evacuate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: orig,
          vehicle: vehicle
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Lỗi tính toán đường sơ tán (HTTP ${res.status})`);
      }

      const routeData = await res.json();
      renderEvacuationRouteOnMap(routeData);
      renderEvacuationResultCard(routeData);
    } catch (err) {
      alert(`Không thể tìm lộ trình sơ tán an toàn: ${err.message}`);
    } finally {
      if (loadingEl) loadingEl.classList.add('hidden');
    }
  }

  function renderEvacuationRouteOnMap(routeData) {
    if (!window.map) return;
    if (evacuationRouteLayer) window.map.removeLayer(evacuationRouteLayer);

    const geom = routeData.geometry;
    if (!geom || !geom.coordinates) return;

    // Chuyển đổi [lng, lat] -> [lat, lng]
    const latLngs = geom.coordinates.map(c => [c[1], c[0]]);

    evacuationRouteLayer = L.polyline(latLngs, {
      color: '#10b981', // Xanh lá cây an toàn
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '8, 8'
    }).addTo(window.map);

    window.map.fitBounds(evacuationRouteLayer.getBounds(), { padding: [50, 50] });
  }

  function renderEvacuationResultCard(routeData) {
    const card = document.getElementById('evacuation-result-card');
    if (!card) return;

    const sh = routeData.shelter;
    document.getElementById('evac-shelter-name').innerText = sh.name;
    document.getElementById('evac-distance').innerText = `${(routeData.distance_m / 1000).toFixed(2)} km`;
    document.getElementById('evac-duration').innerText = `~${routeData.duration_min} phút (${routeData.vehicle === 'walk' ? 'Đi bộ' : 'Phương tiện'})`;
    document.getElementById('evac-shelter-capacity').innerText = `${sh.current_occupancy}/${sh.capacity} người`;
    
    const hotlineEl = document.getElementById('evac-shelter-hotline');
    if (hotlineEl) {
      if (sh.contact_phone) {
        hotlineEl.href = `tel:${sh.contact_phone}`;
        hotlineEl.innerText = sh.contact_phone;
        hotlineEl.parentElement.classList.remove('hidden');
      } else {
        hotlineEl.parentElement.classList.add('hidden');
      }
    }

    card.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  function routeToShelter(lng, lat, name) {
    // Điều hướng từ vị trí hiện tại tới điểm sơ tán cụ thể
    if (typeof window.switchTab === 'function') window.switchTab('route');
    if (typeof window.setDestinationPoint === 'function') {
      window.setDestinationPoint(lng, lat, name);
    }
  }

  // ==========================================
  // 5. GỬI TÍN HIỆU SOS KHẨN CẤP
  // ==========================================
  async function submitSOSBeacon() {
    const name = document.getElementById('sos-input-name')?.value.trim();
    const phone = document.getElementById('sos-input-phone')?.value.trim();
    const people = parseInt(document.getElementById('sos-input-people')?.value || '1', 10);
    const hasVulnerable = document.getElementById('sos-input-vulnerable')?.checked || false;
    const waterDepth = parseFloat(document.getElementById('sos-input-depth')?.value || '0');
    const priority = document.getElementById('sos-select-priority')?.value || 'high';
    const notes = document.getElementById('sos-input-notes')?.value.trim();

    if (!name || !phone) {
      alert('Vui lòng nhập họ tên và số điện thoại liên hệ để lực lượng cứu nạn có thể gọi lại.');
      return;
    }

    // Tiêu chí V-04: Vị trí cần được người dùng xác nhận/chỉnh sửa, không mặc định luôn chính xác
    if (window.CitizenPortal && !window.CitizenPortal.state.locationConfirmed) {
      const targetCoords = window.CitizenPortal.state.selectedCoords || { lat: 21.0285, lng: 105.8542 };
      const confirmProceed = confirm(
        '⚠️ BẠN CHƯA XÁC NHẬN VỊ TRÍ CHÍNH XÁC!\n\n' +
        'Vị trí hiện tại: ' + targetCoords.lat.toFixed(4) + '° B, ' + targetCoords.lng.toFixed(4) + '° Đ.\n\n' +
        'Bấm OK để gửi vị trí này, hoặc bấm CANCEL để chọn lại vị trí chính xác trên bản đồ.'
      );
      if (!confirmProceed) {
        if (typeof window.CitizenPortal.startPickingSOSLocation === 'function') {
          window.CitizenPortal.startPickingSOSLocation();
        }
        return;
      }
    }

    // Lấy toạ độ đã được người dân xác nhận từ CitizenPortal
    let coords = (window.CitizenPortal && window.CitizenPortal.state.selectedCoords)
      ? window.CitizenPortal.state.selectedCoords
      : (window.coords ? window.coords.origin : null);

    if (!coords && window.map) {
      const c = window.map.getCenter();
      coords = { lng: c.lng, lat: c.lat };
    }
    if (!coords) coords = { lng: 105.8030, lat: 21.0285 };

    const payload = {
      contact_name: name,
      phone: phone,
      lng: coords.lng,
      lat: coords.lat,
      people_count: people,
      has_elderly_or_children: hasVulnerable,
      water_level_cm: waterDepth,
      priority: priority,
      notes: notes
    };

    const submitBtn = document.getElementById('btn-submit-sos');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Đang gửi máy chủ...';
    }

    try {
      const res = await fetch(getApiUrl('/api/sos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Máy chủ từ chối yêu cầu (Mã lỗi: HTTP ${res.status})`);

      const result = await res.json();
      const recordId = result.properties?.id || result.id || Math.floor(1000 + Math.random() * 9000);
      const ticketCode = `#SOS-2026-${String(recordId).padStart(4, '0')}`;

      // Lưu mã hồ sơ vào bộ nhớ máy để người dân tra cứu tiến độ (VIC-05)
      try {
        localStorage.setItem('northstar_last_sos_ticket', ticketCode);
      } catch (e) {}

      // Tiêu chí V-02: Hiển thị mã yêu cầu tiếp nhận khi hệ thống xác nhận thành công
      const resultCard = document.getElementById('citizen-sos-result-card');
      const ticketDisplay = document.getElementById('citizen-sos-ticket-code');
      const syncBadge = document.getElementById('citizen-sos-sync-badge');
      const feedbackMsg = document.getElementById('citizen-sos-feedback-msg');

      if (resultCard && ticketDisplay && syncBadge && feedbackMsg) {
        ticketDisplay.textContent = ticketCode;
        syncBadge.textContent = 'ĐÃ GỬI MÁY CHỦ';
        syncBadge.className = 'text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-600 shadow-xs';
        feedbackMsg.textContent = '✅ Máy chủ Chỉ huy đã tiếp nhận toạ độ và thông tin cứu nạn khẩn cấp của bạn. Đội cứu hộ đang được điều phối.';
        resultCard.classList.remove('hidden');
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Xoá trắng trường ghi chú sau khi gửi thành công
      if (document.getElementById('sos-input-notes')) document.getElementById('sos-input-notes').value = '';

      if (typeof loadSOSBeacons === 'function') {
        await loadSOSBeacons();
      }
    } catch (err) {
      // Tiêu chí V-02: Không báo thành công nếu chưa có xác nhận từ hệ thống
      console.error('[NorthStar SOS Error]:', err);
      alert(`⚠️ KHÔNG THỂ GỬI TÍN HIỆU CỨU HỘ LÊN MÁY CHỦ:\n${err.message}\n\nVui lòng gọi ngay Hotline khẩn cấp 114 hoặc 112 để được trợ giúp!`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="radio" class="w-4 h-4"></i><span>Gửi Yêu Cầu Cứu Hộ SOS</span>';
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  /**
   * Sao chép mã hồ sơ tiếp nhận vào Clipboard (Tiêu chí V-02)
   */
  function copyTicketCode() {
    const code = document.getElementById('citizen-sos-ticket-code')?.textContent || '#SOS-2026-0001';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        alert(`📋 Đã sao chép mã hồ sơ: ${code}\nBạn có thể gửi mã này qua SMS cho người thân hoặc lực lượng cứu nạn.`);
      }).catch(() => {
        prompt('Mã hồ sơ cứu hộ của bạn (Copy):', code);
      });
    } else {
      prompt('Mã hồ sơ cứu hộ của bạn (Copy):', code);
    }
  }

  /**
   * Làm sạch và đóng thẻ kết quả SOS
   */
  function resetSOSForm() {
    const resultCard = document.getElementById('citizen-sos-result-card');
    if (resultCard) resultCard.classList.add('hidden');
    if (document.getElementById('sos-input-notes')) document.getElementById('sos-input-notes').value = '';
  }
  }

  async function resolveSOS(sosId) {
    if (!confirm('Xác nhận nạn nhân này đã được cứu hộ an toàn?')) return;
    try {
      await fetch(getApiUrl(`/api/sos/${sosId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rescued' })
      });
      await loadSOSBeacons();
    } catch (err) {
      console.error(err);
    }
  }

  function flyToPoint(lat, lng) {
    if (window.map) {
      window.map.flyTo([lat, lng], 15, { duration: 1.2 });
    }
  }

  function toggleLayer(layerType, show) {
    if (!window.map) return;
    if (layerType === 'disasters' && disasterLayerGroup) {
      show ? window.map.addLayer(disasterLayerGroup) : window.map.removeLayer(disasterLayerGroup);
    } else if (layerType === 'shelters' && shelterLayerGroup) {
      show ? window.map.addLayer(shelterLayerGroup) : window.map.removeLayer(shelterLayerGroup);
    } else if (layerType === 'sos' && sosLayerGroup) {
      show ? window.map.addLayer(sosLayerGroup) : window.map.removeLayer(sosLayerGroup);
    }
  }

  return {
    initRescueLayers,
    loadDisasters,
    loadShelters,
    loadSOSBeacons,
    findEvacuationRoute,
    routeToShelter,
    submitSOSBeacon,
    copyTicketCode,
    resetSOSForm,
    resolveSOS,
    flyToPoint,
    toggleLayer,
  };
})();

window.NorthStarRescue = NorthStarRescue;
