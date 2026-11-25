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
  let rescueLayerVisibility = {
    disasters: true,
    shelters: true,
    sos: true
  };
  let activeRescuePopup = null;
  let evacuationRouteGeoJson = { type: 'FeatureCollection', features: [] };
  let rescueShelterEventsBound = false;
  let rescueShelterMap = {};

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
      if (!rescueLayerVisibility.disasters) el.style.display = 'none';
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
        <div onclick="NorthStarRescue.flyToPoint(${coords[1]}, ${coords[0]})" class="p-2.5 rounded-xl border border-slate-800 hover:border-amber-500/70 bg-slate-950 hover:bg-slate-900 cursor-pointer transition shadow-sm">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-bold text-white">${p.title}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold border ${badgeClass}">${p.hazard_type}</span>
          </div>
          <div class="text-[11px] text-slate-300 mt-1 line-clamp-2">${p.description || ''}</div>
          <div class="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Bán kính ảnh hưởng: ${p.radius_m}m</span>
            <span>•</span>
            <span class="text-sky-400 font-semibold hover:underline">Xem trên bản đồ</span>
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

    const features = [];
    rescueShelterMap = {};

    allShelters.forEach((s, idx) => {
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

      const key = String(p.id || p.shelter_id || `rescue_sh_${idx}`);
      rescueShelterMap[key] = { p, latLng };
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [latLng[1], latLng[0]] },
        properties: {
          shelterKey: key,
          name: p.name || 'Trạm trú ẩn an toàn'
        }
      });
    });

    const vis = rescueLayerVisibility.shelters ? 'visible' : 'none';
    if (!mapInst.getSource('rescue-shelters-source')) {
      mapInst.addSource('rescue-shelters-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 12
      });

      mapInst.addLayer({
        id: 'rescue-shelter-clusters',
        type: 'circle',
        source: 'rescue-shelters-source',
        filter: ['has', 'point_count'],
        layout: { visibility: vis },
        paint: {
          'circle-color': '#059669',
          'circle-radius': ['step', ['get', 'point_count'], 13, 5, 17, 15, 21],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#d1fae5'
        }
      });

      mapInst.addLayer({
        id: 'rescue-shelter-cluster-count',
        type: 'symbol',
        source: 'rescue-shelters-source',
        filter: ['has', 'point_count'],
        layout: {
          visibility: vis,
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Noto Sans Bold'],
          'text-size': 11
        },
        paint: { 'text-color': '#ffffff' }
      });

      mapInst.addLayer({
        id: 'rescue-shelter-unclustered',
        type: 'circle',
        source: 'rescue-shelters-source',
        filter: ['!', ['has', 'point_count']],
        layout: { visibility: vis },
        paint: {
          'circle-color': '#10b981',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5.5, 10, 7.5, 13, 9.5],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      if (!rescueShelterEventsBound) {
        rescueShelterEventsBound = true;
        mapInst.on('click', 'rescue-shelter-clusters', (e) => {
          const clicked = mapInst.queryRenderedFeatures(e.point, { layers: ['rescue-shelter-clusters'] });
          if (!clicked.length) return;
          const clusterId = clicked[0].properties.cluster_id;
          mapInst.getSource('rescue-shelters-source').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            mapInst.easeTo({ center: clicked[0].geometry.coordinates, zoom });
          });
        });

        mapInst.on('click', 'rescue-shelter-unclustered', (e) => {
          if (!e.features || !e.features.length) return;
          const key = e.features[0].properties.shelterKey;
          const entry = rescueShelterMap[key];
          if (!entry) return;
          const { p, latLng } = entry;
          const percent = Math.min(100, Math.round((p.current_occupancy / Math.max(1, p.capacity)) * 100));
          let capColor = 'text-emerald-400 bg-emerald-950 border-emerald-800';
          if (percent >= 90) capColor = 'text-rose-400 bg-rose-950 border-rose-800';
          else if (percent >= 70) capColor = 'text-amber-400 bg-amber-950 border-amber-800';
          const safeName = String(p.name || 'Trạm trú ẩn').replace(/'/g, "\\'");
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
              <button onclick="NorthStarRescue.routeToShelter(${latLng[1]}, ${latLng[0]}, '${safeName}')" class="mt-2.5 w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer">
                <span>🧭 Dẫn Đường Sơ Tán Đến Đây</span>
              </button>
            </div>
          `;
          if (activeRescuePopup) activeRescuePopup.remove();
          activeRescuePopup = new maplibregl.Popup({ className: 'flood-custom-popup', maxWidth: '330px', closeButton: true, closeOnClick: true })
            .setLngLat([latLng[1], latLng[0]])
            .setHTML(popupHtml)
            .addTo(mapInst);
        });

        ['rescue-shelter-clusters', 'rescue-shelter-unclustered'].forEach(layerId => {
          mapInst.on('mouseenter', layerId, () => { mapInst.getCanvas().style.cursor = 'pointer'; });
          mapInst.on('mouseleave', layerId, () => { mapInst.getCanvas().style.cursor = ''; });
        });
      }
    } else {
      mapInst.getSource('rescue-shelters-source').setData({ type: 'FeatureCollection', features });
    }
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
        <div class="p-3 rounded-xl border border-slate-800 bg-slate-950 hover:border-emerald-500/70 hover:shadow-sm transition">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-bold text-white">${p.name}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">${p.status}</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5 line-clamp-1">${p.address || ''}</div>
          
          <div class="mt-2 space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-400">Chỗ tiếp nhận:</span>
              <span class="font-bold text-slate-200">${p.current_occupancy}/${p.capacity} (${p.available_slots} còn trống)</span>
            </div>
            <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full ${percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${percent}%"></div>
            </div>
          </div>

          <div class="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            ${p.contact_phone ? `<a href="tel:${p.contact_phone}" class="text-[11px] text-sky-400 font-semibold hover:underline flex items-center gap-1">📞 ${p.contact_phone}</a>` : '<span></span>'}
            <button onclick="NorthStarRescue.routeToShelter(${coords[0]}, ${coords[1]}, '${p.name.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded-lg text-xs font-bold transition cursor-pointer">
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
    if (window.NorthStarAuth && ['guest', 'citizen'].includes(window.NorthStarAuth.getRole())) return;
    try {
      const headers = {};
      const token = window.NorthStarAuth && typeof window.NorthStarAuth.getToken === 'function' ? window.NorthStarAuth.getToken() : null;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(getApiUrl('/api/sos'), { headers });
      if (!res.ok) return;
      const data = await res.json();
      allSOSBeacons = data.features || [];
      renderSOSLayers();
      renderSOSSidebar();
      if (window.NorthStarMapLibre && typeof window.NorthStarMapLibre.syncAllLayers === 'function') {
        window.NorthStarMapLibre.syncAllLayers();
      }
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
      if (!rescueLayerVisibility.sos) el.style.display = 'none';
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
      const coords = (f.geometry && Array.isArray(f.geometry.coordinates)) ? f.geometry.coordinates : null;
      const mapBtn = coords
        ? `<button onclick="NorthStarRescue.flyToPoint(${coords[1]}, ${coords[0]})" class="text-[11px] text-sky-400 font-semibold hover:underline cursor-pointer">Vị trí bản đồ</button>`
        : `<span class="text-[11px] text-amber-400 font-semibold">📍 ${p.location_description || p.location_landmark || 'Chưa có tọa độ GPS'}</span>`;

      return `
        <div class="p-2.5 rounded-xl border border-rose-800/60 bg-rose-950/30 hover:bg-rose-950/50 transition shadow-sm">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-bold text-rose-200">🆘 ${p.contact_name} (${p.people_count} người)</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-900 text-rose-200 border border-rose-700">${p.priority}</span>
          </div>
          <div class="text-[11px] text-slate-300 mt-1">SĐT: <a href="tel:${p.phone}" class="text-sky-400 font-bold">${p.phone}</a> ${p.has_elderly_or_children ? '• Có trẻ nhỏ/người già' : ''}</div>
          ${p.notes ? `<div class="text-[11px] text-slate-400 italic mt-0.5 line-clamp-2">"${p.notes}"</div>` : ''}
          <div class="mt-2 flex items-center justify-between">
            ${mapBtn}
            <button onclick="NorthStarRescue.resolveSOS(${p.id})" class="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer">Đánh dấu đã cứu</button>
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
  // 5. GỬI TÍN HIỆU SOS KHẨN CẤP (CIT-03 + COP SYNC)
  // ==========================================
  function renderSOSSubmissionState(submitState, { ticketCode = null, trackingToken = null, localId = null, message = '' } = {}) {
    const resultCard = document.getElementById('citizen-sos-result-card');
    const ticketDisplay = document.getElementById('citizen-sos-ticket-code');
    const syncBadge = document.getElementById('citizen-sos-sync-badge');
    const feedbackMsg = document.getElementById('citizen-sos-feedback-msg');
    const tokenRow = document.getElementById('citizen-sos-tracking-token-row');
    const tokenDisplay = document.getElementById('citizen-sos-tracking-token');
    if (!resultCard || !ticketDisplay || !syncBadge || !feedbackMsg) return;

    resultCard.classList.remove('hidden');

    if (tokenRow && tokenDisplay) {
      if (submitState === 'SERVER_RECEIVED' && trackingToken) {
        tokenDisplay.textContent = trackingToken;
        tokenRow.classList.remove('hidden');
      } else {
        tokenDisplay.textContent = '';
        tokenRow.classList.add('hidden');
      }
    }

    if (submitState === 'SENDING') {
      ticketDisplay.textContent = 'ĐANG CHỜ MÁY CHỦ...';
      syncBadge.textContent = 'SENDING';
      syncBadge.className = 'text-[9.5px] font-black px-2 py-0.5 rounded-full bg-sky-950/90 text-sky-300 border border-sky-600 animate-pulse';
      feedbackMsg.textContent = '⏳ Đang truyền yêu cầu cứu hộ tới máy chủ Ban chỉ huy...';
    } else if (submitState === 'SERVER_RECEIVED') {
      ticketDisplay.textContent = ticketCode;
      syncBadge.textContent = 'ĐÃ TIẾP NHẬN (MÁY CHỦ)';
      syncBadge.className = 'text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-600 shadow-xs';
      feedbackMsg.textContent = message || '✅ Máy chủ Chỉ huy đã tiếp nhận thông tin cứu nạn khẩn cấp của bạn.';
    } else if (submitState === 'PENDING_OFFLINE') {
      ticketDisplay.textContent = localId || 'CHƯA CÓ MÃ MÁY CHỦ';
      syncBadge.textContent = 'LƯU TRÊN MÁY (CHƯA GỬI)';
      syncBadge.className = 'text-[9.5px] font-black px-2 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-600 animate-pulse';
      feedbackMsg.innerHTML = message ||
        '<strong class="text-amber-300">⚠️ ĐANG NGOẠI TUYẾN:</strong> Bản nháp cục bộ (chưa phải mã hồ sơ chính thức) đã được lưu trên máy. ' +
        'Hệ thống sẽ tự động gửi khi có mạng trở lại. Nếu khẩn cấp, hãy gọi ngay hotline <strong>114</strong> hoặc <strong>112</strong>!';
    } else {
      ticketDisplay.textContent = 'CHƯA CẤP MÃ HỒ SƠ';
      syncBadge.textContent = 'GỬI THẤT BẠI';
      syncBadge.className = 'text-[9.5px] font-black px-2 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-600';
      feedbackMsg.textContent = message || '❌ Không thể xác nhận tiếp nhận từ máy chủ. Vui lòng kiểm tra thông tin và thử lại.';
    }
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function submitSOSBeacon() {
    const name = document.getElementById('sos-input-name')?.value.trim() || '';
    const phone = document.getElementById('sos-input-phone')?.value.trim() || '';
    const people = parseInt(document.getElementById('sos-input-people')?.value || '1', 10);
    const hasVulnerable = document.getElementById('sos-input-vulnerable')?.checked || false;
    const waterDepth = parseFloat(document.getElementById('sos-input-depth')?.value || '0');
    const priority = document.getElementById('sos-select-priority')?.value || 'high';
    const notes = document.getElementById('sos-input-notes')?.value.trim() || '';
    const locDesc = document.getElementById('sos-location-description')?.value.trim() || '';
    const locLandmark = document.getElementById('sos-location-landmark')?.value.trim() || '';

    if (!name || phone.length < 8) {
      alert('Vui lòng nhập họ tên và số điện thoại hợp lệ (tối thiểu 8 ký tự) để lực lượng cứu nạn có thể liên hệ lại.');
      return;
    }

    const portalState = window.CitizenPortal ? window.CitizenPortal.state : null;
    const fallbackCoords = (!portalState && window.coords && window.coords.origin) ? window.coords.origin : null;
    const rawCoords = portalState ? portalState.selectedCoords : fallbackCoords;
    const hasValidCoords = !!(
      rawCoords &&
      typeof rawCoords.lat === 'number' &&
      typeof rawCoords.lng === 'number' &&
      Number.isFinite(rawCoords.lat) &&
      Number.isFinite(rawCoords.lng)
    );
    const hasTextLocation = locDesc.length >= 3 || locLandmark.length >= 3;

    if (portalState) {
      if (!hasValidCoords && !hasTextLocation) {
        alert(
          '⚠️ CHƯA CÓ VỊ TRÍ CỨU HỘ!\n\n' +
          'Vui lòng bấm nút "GPS", hoặc "Ghim bản đồ", hoặc nhập mô tả địa điểm / điểm mốc (tối thiểu 3 ký tự) trước khi gửi SOS.'
        );
        return;
      }
      if (!portalState.locationConfirmed) {
        alert(
          '⚠️ BẠN CHƯA XÁC NHẬN VỊ TRÍ!\n\n' +
          'Vui lòng kiểm tra tọa độ / mô tả địa điểm và tích chọn ô "Tôi xác nhận vị trí / mô tả này là chính xác" trước khi gửi.'
        );
        const checkEl = document.getElementById('citizen-confirm-location-check');
        if (checkEl) checkEl.focus();
        return;
      }
    }

    let finalCoords = hasValidCoords ? rawCoords : null;
    if (!portalState && !finalCoords && window.map) {
      const c = window.map.getCenter();
      finalCoords = { lng: c.lng, lat: c.lat };
    }

    const locationSource = finalCoords
      ? (portalState && portalState.locationSource === 'gps' ? 'gps' : 'manual')
      : 'unknown';

    const payload = {
      contact_name: name,
      phone: phone,
      lng: finalCoords ? finalCoords.lng : null,
      lat: finalCoords ? finalCoords.lat : null,
      location_source: locationSource,
      location_accuracy_m: (finalCoords && locationSource === 'gps' && portalState) ? portalState.locationAccuracy : null,
      location_captured_at: (portalState && portalState.locationCapturedAt) || null,
      location_confirmed: true,
      location_description: locDesc || null,
      location_landmark: locLandmark || null,
      people_count: Number.isFinite(people) && people >= 1 ? people : 1,
      has_elderly_or_children: hasVulnerable,
      water_level_cm: Number.isFinite(waterDepth) && waterDepth >= 0 ? waterDepth : 0,
      priority: priority,
      notes: notes || null
    };

    const clientEventId = (window.OfflineSyncManager && typeof window.OfflineSyncManager.generateClientEventId === 'function')
      ? window.OfflineSyncManager.generateClientEventId()
      : `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    payload.client_event_id = clientEventId;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await handleOfflineSOSDraft({ ...payload, client_event_id: clientEventId });
      return;
    }

    const submitBtn = document.getElementById('btn-submit-sos');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Đang gửi máy chủ...';
    }
    renderSOSSubmissionState('SENDING');

    try {
      let savedBeacon = null;
      const authHeaders = { 'Content-Type': 'application/json' };
      const authToken = window.NorthStarAuth && typeof window.NorthStarAuth.getToken === 'function' ? window.NorthStarAuth.getToken() : null;
      if (authToken) authHeaders['Authorization'] = `Bearer ${authToken}`;

      if (typeof NorthStarApi !== 'undefined' && typeof NorthStarApi.fetchJson === 'function') {
        savedBeacon = await NorthStarApi.fetchJson('/api/sos', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
      } else {
        const res = await fetch(getApiUrl('/api/sos'), {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = new Error(`Máy chủ từ chối yêu cầu (HTTP ${res.status})`);
          err.status = res.status;
          err.type = 'HTTP';
          throw err;
        }
        savedBeacon = await res.json();
      }

      const rawId = savedBeacon?.properties?.id ?? savedBeacon?.id;
      const numericId = Number(rawId);
      if (!savedBeacon || rawId === null || rawId === undefined || !Number.isInteger(numericId) || numericId <= 0) {
        console.error('[NorthStar SOS] Phản hồi máy chủ thiếu ID hồ sơ hợp lệ (Protocol Error).');
        renderSOSSubmissionState('FAILED', {
          message: '⚠️ Máy chủ phản hồi thành công nhưng chưa cấp mã hồ sơ hợp lệ (lỗi giao thức API). Vui lòng thử gửi lại hoặc gọi hotline 114.'
        });
        return;
      }

      const ticketCode = `#SOS-2026-${String(numericId).padStart(4, '0')}`;
      const trackingToken = savedBeacon?.properties?.tracking_token || null;

      if (window.OfflineSyncManager && typeof window.OfflineSyncManager.enqueueSOS === 'function') {
        const savedRec = await window.OfflineSyncManager.enqueueSOS(payload, {
          client_event_id: clientEventId,
          sync_status: 'ACKNOWLEDGED',
          server_id: numericId,
          acknowledged_at: new Date().toISOString(),
          triggerSync: false
        }).catch(() => null);
        if (trackingToken && savedRec && window.OfflineDB && typeof window.OfflineDB.updateSOS === 'function') {
          await window.OfflineDB.updateSOS(savedRec.local_id, { tracking_token: trackingToken }).catch(() => {});
        }
      }

      try {
        localStorage.setItem('northstar_last_sos_ticket', ticketCode);
      } catch (e) {}

      renderSOSSubmissionState('SERVER_RECEIVED', {
        ticketCode,
        trackingToken,
        message: '✅ Máy chủ Chỉ huy đã tiếp nhận thông tin cứu nạn khẩn cấp của bạn. Đội cứu hộ đang xử lý.'
      });

      const receiptEl = document.getElementById('sos-sent-receipt');
      if (receiptEl) {
        receiptEl.classList.remove('hidden');
        const codeEl = document.getElementById('sos-sent-ticket-code');
        if (codeEl) codeEl.textContent = ticketCode;
      }
      const trackInput = document.getElementById('citizen-tracking-input');
      if (trackInput) trackInput.value = ticketCode;

      if (document.getElementById('sos-input-notes')) document.getElementById('sos-input-notes').value = '';

      if (typeof loadSOSBeacons === 'function') {
        await loadSOSBeacons();
      }

      if (window.CommandUIController) {
        if (typeof window.CommandUIController.registerNewSOS === 'function') {
          window.CommandUIController.registerNewSOS(savedBeacon);
        } else if (typeof window.CommandUIController.refreshSystemData === 'function') {
          window.CommandUIController.refreshSystemData();
        }
      }

      window.dispatchEvent(new CustomEvent('northstar:sos_beacon_created', { detail: savedBeacon }));
    } catch (err) {
      if (err && (err.status === 400 || err.status === 401 || err.status === 409 || err.status === 422 || err.type === 'JSON_PARSE')) {
        renderSOSSubmissionState('FAILED', {
          message: `❌ ${err.message || 'Dữ liệu SOS không hợp lệ hoặc phản hồi máy chủ sai định dạng.'}`
        });
      } else {
        console.warn('[NorthStar SOS] Lỗi kết nối máy chủ, chuyển sang lưu bản nháp cục bộ:', err?.message || err);
        await handleOfflineSOSDraft({ ...payload, client_event_id: clientEventId }, err?.message);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="radio" class="w-4 h-4"></i><span>Gửi Yêu Cầu Cứu Hộ SOS</span>';
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  async function handleOfflineSOSDraft(payload, reason = null) {
    let draftItem = null;
    if (window.OfflineSyncManager && typeof window.OfflineSyncManager.enqueueSOS === 'function') {
      draftItem = await window.OfflineSyncManager.enqueueSOS(payload, {
        client_event_id: payload?.client_event_id,
        sync_status: 'PENDING_OFFLINE',
        triggerSync: false
      });
    } else if (window.OfflineSyncManager && typeof window.OfflineSyncManager.enqueueSOSDraft === 'function') {
      draftItem = await window.OfflineSyncManager.enqueueSOSDraft(payload);
    } else {
      const localId = `SOS-DRAFT-${Date.now()}`;
      draftItem = { local_id: localId };
      try {
        localStorage.setItem('northstar_last_sos_ticket', localId);
      } catch (e) {}
    }

    const localId = draftItem?.local_id || draftItem?.id || `SOS-DRAFT-${Date.now()}`;
    renderSOSSubmissionState('PENDING_OFFLINE', { localId });

    if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
      window.CommandUIController.showToast('📦 ĐÃ LƯU BẢN NHÁP TRÊN MÁY', 'Dữ liệu chưa gửi máy chủ. Sẽ tự động tải lên khi có sóng.', 'warning');
    }
    try {
      window.dispatchEvent(new CustomEvent('northstar:sos_offline_saved', {
        detail: { payload, draft: draftItem }
      }));
    } catch (_) {}
  }

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

  function resetSOSForm() {
    const resultCard = document.getElementById('citizen-sos-result-card');
    if (resultCard) resultCard.classList.add('hidden');
    if (document.getElementById('sos-input-notes')) document.getElementById('sos-input-notes').value = '';
  }

  function confirmSendSOSBeacon() {
    const confirmBox = document.getElementById('sos-confirm-overlay');
    if (confirmBox) confirmBox.classList.add('hidden');
    window._skipSosConfirmOnce = true;
    submitSOSBeacon();
  }

  async function resolveSOS(sosId) {
    if (!confirm('Xác nhận nạn nhân này đã được cứu hộ an toàn?')) return;
    try {
      if (window.map) {
        window.map.closePopup();
      }

      const headers = { 'Content-Type': 'application/json' };
      const token = window.NorthStarAuth && typeof window.NorthStarAuth.getToken === 'function' ? window.NorthStarAuth.getToken() : null;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(getApiUrl(`/api/sos/${sosId}/status`), {
        method: 'PATCH',
        headers,
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
    rescueLayerVisibility[layerType] = !!show;
    const markers = activeRescueMarkers[layerType];
    if (Array.isArray(markers)) {
      markers.forEach(marker => {
        const el = marker && typeof marker.getElement === 'function' ? marker.getElement() : null;
        if (el) {
          el.style.display = show ? 'flex' : 'none';
        }
      });
    }
    if (layerType === 'shelters') {
      const mapInst = getMapLibre();
      if (mapInst) {
        const vis = show ? 'visible' : 'none';
        ['rescue-shelter-clusters', 'rescue-shelter-cluster-count', 'rescue-shelter-unclustered'].forEach(id => {
          if (mapInst.getLayer(id)) {
            mapInst.setLayoutProperty(id, 'visibility', vis);
          }
        });
      }
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
    confirmSendSOSBeacon,
    copyTicketCode,
    resetSOSForm,
    resolveSOS,
    flyToPoint,
    toggleLayer,
  };
})();

window.NorthStarRescue = NorthStarRescue;
