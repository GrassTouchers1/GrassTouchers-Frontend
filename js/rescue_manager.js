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
 * ===================================================================
 * NORTHSTAR - Multi-Hazard GIS & Emergency Rescue Management Module
 * Quản lý Vùng Thiên Tai, Điểm Sơ Tán An Toàn & Tín Hiệu Kêu Cứu SOS
 * Giấy phép: Apache-2.0 License (100% Mã nguồn mở)
 * ===================================================================
 */

const NorthStarRescue = (function () {
  let activeRescueMarkers = {
    disasters: [],
    shelters: [],
    sos: []
  };
  let activeRescuePopup = null;
  let evacuationRouteGeoJson = { type: 'FeatureCollection', features: [] };

  let allShelters = [];
  let allDisasters = [];
  let allSOSBeacons = [];

  function getMapLibre() {
    if (window.map && window.map._maplibre) return window.map._maplibre;
    if (window.map && typeof window.map.getSource === 'function') return window.map;
    return null;
  }

  function initRescueLayers(map) {
    const mapInst = getMapLibre();
    if (mapInst && mapInst.isStyleLoaded && mapInst.isStyleLoaded()) {
      setupRescueSourcesAndLayers(mapInst);
    } else if (mapInst) {
      mapInst.once('load', () => setupRescueSourcesAndLayers(mapInst));
    }
    connectRealtimeWebSocket();
  }

  function setupRescueSourcesAndLayers(mapInst) {
    if (!mapInst) return;
    if (!mapInst.getSource('evacuation-route-source')) {
      mapInst.addSource('evacuation-route-source', {
        type: 'geojson',
        data: evacuationRouteGeoJson
      });
      mapInst.addLayer({
        id: 'evacuation-route-layer',
        type: 'line',
        source: 'evacuation-route-source',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 6,
          'line-dasharray': [2, 1],
          'line-opacity': 0.95
        }
      });
    }
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
    const mapInst = getMapLibre();
    if (!mapInst) return;

    activeRescueMarkers.disasters.forEach(m => m.remove());
    activeRescueMarkers.disasters = [];

    allDisasters.forEach(d => {
      const p = d.properties || d;
      let latLng = null;
      if (d.geometry && d.geometry.coordinates) {
        latLng = [d.geometry.coordinates[1], d.geometry.coordinates[0]];
      } else if (p.latitude && p.longitude) {
        latLng = [parseFloat(p.latitude), parseFloat(p.longitude)];
      } else if (p.lat && p.lng) {
        latLng = [parseFloat(p.lat), parseFloat(p.lng)];
      }
      if (!latLng || isNaN(latLng[0]) || isNaN(latLng[1])) return;

      const radius = p.radius_meters || 500;
      let color = '#f59e0b';
      if (p.severity === 'critical') color = '#ef4444';
      else if (p.severity === 'high') color = '#ea580c';

      const hazardLabels = {
        flood: 'LŨ LỤT & NGẬP SÂU',
        landslide: 'SẠT LỞ ĐẤT',
        storm: 'BÃO & DÔNG LỐC',
        surge: 'TRIỀU CƯỜNG'
      };
      const hazardName = hazardLabels[String(p.hazard_type).toLowerCase()] || String(p.hazard_type).toUpperCase();

      let severityBadge = '<span class="text-[9.5px] px-1.5 py-0.5 rounded font-extrabold bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wide">CẢNH BÁO</span>';
      if (p.severity === 'critical') {
        severityBadge = '<span class="text-[9.5px] px-1.5 py-0.5 rounded font-black bg-rose-950 text-rose-300 border border-rose-800 uppercase tracking-wide animate-pulse">ĐẶC BIỆT NGUY CẤP</span>';
      } else if (p.severity === 'high') {
        severityBadge = '<span class="text-[9.5px] px-1.5 py-0.5 rounded font-black bg-amber-950 text-amber-300 border border-amber-800 uppercase tracking-wide">RẤT NGUY HIỂM</span>';
      }

      const popupHtml = `
        <div class="p-2.5 max-w-[310px] text-slate-100 font-sans select-none">
          <div class="flex items-center justify-between gap-1.5 pb-1.5 border-b border-slate-800">
            <span class="font-black text-xs uppercase tracking-tight flex items-center gap-1" style="color: ${color}">
              <span>⚠️ CẢNH BÁO: ${hazardName}</span>
            </span>
            ${severityBadge}
          </div>
          <h4 class="font-black text-[14.5px] text-white mt-2 leading-snug tracking-tight">${p.title}</h4>
          <p class="text-xs text-slate-300 mt-1.5 leading-relaxed font-normal">${p.description || 'Khu vực nguy cơ cao, hạn chế di chuyển qua lại.'}</p>
          <div class="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span class="flex items-center gap-1">📡 Bán kính ảnh hưởng:</span>
            <b class="text-amber-300 font-bold font-mono">~${radius}m</b>
          </div>
        </div>
      `;

      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center cursor-pointer';
      el.innerHTML = `
        <span class="absolute w-8 h-8 rounded-full opacity-75 animate-ping" style="background-color: ${color}"></span>
        <div class="w-7 h-7 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold" style="background-color: ${color}">
          ⚠️
        </div>
      `;

      const popup = new maplibregl.Popup({ className: 'flood-custom-popup', maxWidth: '330px', closeButton: true, closeOnClick: true })
        .setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([latLng[1], latLng[0]])
        .setPopup(popup)
        .addTo(mapInst);

      activeRescueMarkers.disasters.push(marker);
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
    const mapInst = getMapLibre();
    if (!mapInst) return;

    activeRescueMarkers.shelters.forEach(m => m.remove());
    activeRescueMarkers.shelters = [];

    allShelters.forEach(s => {
      const p = s.properties || s;
      let latLng = null;
      if (s.geometry && s.geometry.coordinates) {
        latLng = [s.geometry.coordinates[1], s.geometry.coordinates[0]];
      } else if (p.latitude && p.longitude) {
        latLng = [parseFloat(p.latitude), parseFloat(p.longitude)];
      } else if (p.lat && p.lng) {
        latLng = [parseFloat(p.lat), parseFloat(p.lng)];
      }
      if (!latLng || isNaN(latLng[0]) || isNaN(latLng[1])) return;

      const percent = Math.min(100, Math.round((p.current_occupancy / p.capacity) * 100));
      let capColor = 'text-emerald-400 bg-emerald-950 border-emerald-800';
      if (percent >= 90) capColor = 'text-rose-400 bg-rose-950 border-rose-800';
      else if (percent >= 70) capColor = 'text-amber-400 bg-amber-950 border-amber-800';

      const el = document.createElement('div');
      el.className = 'w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white hover:scale-110 transition cursor-pointer';
      el.innerHTML = '<span class="text-sm">🛡️</span>';
      el.title = `${p.name} (${percent}% sức chứa)`;

      const popupHtml = `
        <div class="p-2.5 max-w-[310px] text-slate-100 font-sans select-none">
          <div class="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span class="font-extrabold text-xs text-emerald-400 flex items-center gap-1">🛡️ TRẠM TRÚ ẨN AN TOÀN</span>
            <span class="text-[9.5px] px-1.5 py-0.2 rounded font-bold border ${capColor}">${percent}% SỨC CHỨA</span>
          </div>
          <h4 class="font-black text-sm text-white mt-2 leading-snug">${p.name}</h4>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed">${p.address || 'Khu vực an toàn đã được thẩm định'}</p>
          <div class="mt-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
            <div class="flex justify-between text-slate-300">
              <span>Đang tiếp nhận:</span>
              <b class="text-white">${p.current_occupancy} / ${p.capacity} người</b>
            </div>
            <div class="flex justify-between text-slate-400 text-[10px]">
              <span>Liên hệ: ${p.contact_person || 'Ban Chỉ huy'}</span>
              <a href="tel:${p.contact_phone}" class="text-cyan-400 font-bold">${p.contact_phone || '114'}</a>
            </div>
          </div>
          <button onclick="NorthStarRescue.routeToShelter(${latLng[1]}, ${latLng[0]}, '${p.name.replace(/'/g, "\'")}')" class="mt-2.5 w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer">
            <span>🧭 Dẫn Đường Sơ Tán Đến Đây</span>
          </button>
        </div>
      `;

      const popup = new maplibregl.Popup({ className: 'flood-custom-popup', maxWidth: '330px', closeButton: true, closeOnClick: true })
        .setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([latLng[1], latLng[0]])
        .setPopup(popup)
        .addTo(mapInst);

      activeRescueMarkers.shelters.push(marker);
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
    const mapInst = getMapLibre();
    if (!mapInst) return;

    activeRescueMarkers.sos.forEach(m => m.remove());
    activeRescueMarkers.sos = [];

    const activeSOS = allSOSBeacons.filter(b => {
      const p = b.properties || b;
      return p.status === 'active' || p.status === 'pending' || p.status === 'verified';
    });

    activeSOS.forEach(s => {
      const p = s.properties || s;
      let latLng = null;
      if (s.geometry && s.geometry.coordinates) {
        latLng = [s.geometry.coordinates[1], s.geometry.coordinates[0]];
      } else if (p.lat && p.lng) {
        latLng = [parseFloat(p.lat), parseFloat(p.lng)];
      }
      if (!latLng || isNaN(latLng[0]) || isNaN(latLng[1])) return;

      const pNorm = (p.final_priority || p.priority || 'P3').toUpperCase();
      let color = '#ef4444';
      if (pNorm === 'P2' || pNorm === 'HIGH') color = '#f59e0b';
      else if (pNorm === 'P3' || pNorm === 'MEDIUM') color = '#0284c7';
      else if (pNorm === 'P4' || pNorm === 'LOW') color = '#64748b';

      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center cursor-pointer';
      el.innerHTML = `
        <span class="absolute w-8 h-8 rounded-full opacity-75 animate-ping" style="background-color: ${color}"></span>
        <div class="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shadow-lg border-2 border-white select-none" style="background-color: ${color}">
          SOS
        </div>
      `;

      const popupHtml = `
        <div class="p-2.5 max-w-[310px] text-slate-100 font-sans select-none">
          <div class="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span class="font-extrabold text-xs text-rose-400 flex items-center gap-1">🚨 YÊU CẦU CỨU HỘ KHẨN CẤP</span>
            <span class="text-[10px] px-2 py-0.5 rounded font-black bg-rose-950 text-rose-300 border border-rose-800">${pNorm}</span>
          </div>
          <h4 class="font-black text-sm text-white mt-2 leading-snug">${p.contact_name} (${p.people_count} người)</h4>
          <p class="text-xs text-slate-300 mt-1 italic leading-relaxed">"${p.description || p.notes || 'Cần hỗ trợ di tản khẩn cấp!'}"</p>
          <div class="mt-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
            <div class="text-slate-300">SĐT: <a href="tel:${p.phone}" class="text-amber-300 font-bold">${p.phone}</a></div>
            <div class="text-slate-400 text-[10px]">Địa bàn: ${p.location_text || (p.district ? p.district + ', ' + p.province : 'Khu vực ngập sâu')}</div>
          </div>
          <button onclick="CommandUIController.openDispatchModal('${p.id || p.raw_id}')" class="mt-2.5 w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer">
            <span>⚡ Lập Lệnh Cứu Nạn (Điều Phối)</span>
          </button>
        </div>
      `;

      const popup = new maplibregl.Popup({ className: 'flood-custom-popup', maxWidth: '330px', closeButton: true, closeOnClick: true })
        .setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([latLng[1], latLng[0]])
        .setPopup(popup)
        .addTo(mapInst);

      activeRescueMarkers.sos.push(marker);
    });
  }

  function renderSOSSidebar() {
    const listEl = document.getElementById('rescue-sos-list');
    if (!listEl) return;
    const activeBeacons = allSOSBeacons.filter(b => !['rescued', 'resolved', 'cancelled', 'dispatched', 'on_scene'].includes(b.properties.status));
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
    const mapInst = getMapLibre();
    if (!mapInst || !routeData || !routeData.geometry || !routeData.geometry.coordinates) return;

    const coords = routeData.geometry.coordinates; // [[lng, lat], ...]
    evacuationRouteGeoJson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      }]
    };

    if (mapInst.getSource('evacuation-route-source')) {
      mapInst.getSource('evacuation-route-source').setData(evacuationRouteGeoJson);
    }

    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    coords.forEach(c => {
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    });
    if (minLng <= maxLng && minLat <= maxLat) {
      mapInst.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 800 });
    }
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

    // Lấy toạ độ GPS hoặc tâm bản đồ
    let coords = window.coords ? window.coords.origin : null;
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

    try {
      const res = await fetch(getApiUrl('/api/sos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const savedBeacon = await res.json();

      alert('✅ ĐÃ PHÁT TÍN HIỆU CỨU HỘ KHẨN CẤP THÀNH CÔNG!\nLực lượng cứu hộ và chính quyền địa phương đã nhận được toạ độ của bạn.');
      // Xoá trắng form
      if (document.getElementById('sos-input-notes')) document.getElementById('sos-input-notes').value = '';
      
      // 1. Cập nhật marker cứu hộ trên bản đồ
      await loadSOSBeacons();

      // 2. Đồng bộ lập tức sang Trung Tâm Tiếp Nhận & COP Command Center
      if (window.CommandUIController) {
        if (typeof window.CommandUIController.registerNewSOS === 'function') {
          window.CommandUIController.registerNewSOS(savedBeacon);
        } else if (typeof window.CommandUIController.refreshSystemData === 'function') {
          window.CommandUIController.refreshSystemData();
        }
      }

      // 3. Bắn event đồng bộ toàn cục
      window.dispatchEvent(new CustomEvent('northstar:sos_beacon_created', { detail: savedBeacon }));

    } catch (err) {
      alert(`Không thể gửi tín hiệu SOS: ${err.message}. Vui lòng gọi trực tiếp hotline 114 hoặc 112.`);
    }
  }

  async function resolveSOS(sosId) {
    if (!confirm('Xác nhận nạn nhân này đã được cứu hộ an toàn?')) return;
    try {
      if (window.map) {
        window.map.closePopup();
      }

      await fetch(getApiUrl(`/api/sos/${sosId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rescued' })
      });
      
      // 1. Cập nhật marker trên bản đồ (Ẩn tín hiệu ngay để không gây rối mắt)
      await loadSOSBeacons();

      // 2. Đồng bộ trạng thái đã an toàn sang Trung Tâm Tiếp Nhận, COP & Kho Hồ Sơ Đã Xử Lý
      if (window.CommandUIController) {
        if (typeof window.CommandUIController.updateSOSStatus === 'function') {
          window.CommandUIController.updateSOSStatus(sosId, 'rescued');
        } else if (typeof window.CommandUIController.refreshSystemData === 'function') {
          window.CommandUIController.refreshSystemData();
        }
        if (typeof window.CommandUIController.showToast === 'function') {
          window.CommandUIController.showToast('✅ ĐÃ CỨU HỘ AN TOÀN', 'Tín hiệu đã được ẩn khỏi bản đồ và lưu trữ vào Kho Hồ Sơ Đã Xử Lý!', 'success');
        }
      }

      // 3. Bắn event toàn cục
      window.dispatchEvent(new CustomEvent('northstar:sos_resolved', { detail: { id: sosId } }));
    } catch (err) {
      console.error(err);
    }
  }

  function flyToPoint(lat, lng) {
    const mapInst = getMapLibre();
    if (mapInst) {
      mapInst.flyTo({ center: [lng, lat], zoom: 15.5, duration: 1200 });
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
    resolveSOS,
    flyToPoint,
    toggleLayer,
  };
})();

window.NorthStarRescue = NorthStarRescue;
