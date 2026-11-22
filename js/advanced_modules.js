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
 * NorthStar Advanced Intelligence & Operations Modules
 * Bao gồm:
 * 1. TimelineSimulator: Mô phỏng diễn biến ngập lụt theo dòng thời gian (T+0h -> T+24h)
 * 2. SarFloodManager: Hiển thị đa giác diện ngập viễn thám vệ tinh Sentinel-1 SAR C-Band
 * 3. RescueDispatchManager: Điều phối cứu nạn đa điểm tuần tự tối ưu (Greedy TSP)
 * 4. SitRepReporter: Xuất Báo cáo Tác chiến Chỉ huy PCTT chuẩn QĐ 18/2021/QĐ-TTg & Heatmap
 */

// ============================================================================
// 1. TIMELINE SIMULATOR (MÔ PHỎNG DÒNG THỜI GIAN LŨ T+0H -> T+24H)
// ============================================================================
const TimelineSimulator = (function () {
  let isPlaying = false;
  let timerId = null;
  let currentStepIdx = 0;
  const steps = [0, 3, 6, 12, 24];

  async function loadStep(hour) {
    try {
      const res = await fetch(getApiUrl(`/api/simulation/timeline?hour=${hour}`));
      if (!res.ok) return;
      const data = await res.json();

      // Cập nhật nhãn và mô tả
      const labelEl = document.getElementById('timeline-step-label');
      const descEl = document.getElementById('timeline-step-desc');
      const sliderEl = document.getElementById('timeline-slider');
      const rainBadge = document.getElementById('timeline-rain-badge');

      if (labelEl) labelEl.innerText = data.current_step.label;
      if (descEl) descEl.innerText = data.current_step.description;
      if (sliderEl) sliderEl.value = hour;
      if (rainBadge) rainBadge.innerText = `🌧️ ${data.current_step.rainfall_mm}mm (${data.current_step.weather_state})`;

      // Cập nhật các điểm ngập trên bản đồ
      if (data.points && window.renderFloodPoints) {
        // Ánh xạ sang cấu trúc tương thích với renderFloodPoints
        const mappedPoints = data.points.map(p => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          depth_cm: p.simulated_depth_cm,
          threshold_cm: p.threshold_cm,
          status: p.status,
          source: 'ai',
          last_reading_at: new Date().toISOString()
        }));
        window.renderFloodPoints(mappedPoints);
      }

      if (window.showToast) {
        showToast(data.current_step.label, `Mưa mô phỏng: ${data.current_step.rainfall_mm}mm | ${data.danger_count} trạm báo động đỏ`, 'info');
      }
    } catch (e) {
      console.warn("Lỗi tải timeline simulation:", e);
    }
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    const btn = document.getElementById('timeline-play-btn');
    if (isPlaying) {
      if (btn) btn.innerHTML = '<i data-lucide="pause" class="w-4 h-4"></i>';
      timerId = setInterval(() => {
        currentStepIdx = (currentStepIdx + 1) % steps.length;
        loadStep(steps[currentStepIdx]);
      }, 3500);
    } else {
      if (btn) btn.innerHTML = '<i data-lucide="play" class="w-4 h-4"></i>';
      if (timerId) clearInterval(timerId);
      timerId = null;
    }
    if (window.lucide) lucide.createIcons();
  }

  function setHour(hour) {
    const idx = steps.indexOf(parseInt(hour, 10));
    if (idx !== -1) currentStepIdx = idx;
    loadStep(hour);
  }

  function toggleBar() {
    const bar = document.getElementById('timeline-simulation-bar');
    if (bar) bar.classList.toggle('hidden');
  }

  return {
    loadStep,
    togglePlay,
    setHour,
    toggleBar
  };
})();

// ============================================================================
// 2. SAR FLOOD MANAGER (VIỄN THÁM VỆ TINH SENTINEL-1 SAR C-BAND)
// ============================================================================
const SarFloodManager = (function () {
  let isVisible = false;
  let sarData = null;
  let activePopup = null;

  function getMapInstance() {
    if (!window.map) return null;
    return window.map._maplibre || window.map;
  }

  function setupSarLayers(mapInst) {
    if (!mapInst || !sarData) return;
    if (!mapInst.getSource('sar-flood-source')) {
      mapInst.addSource('sar-flood-source', {
        type: 'geojson',
        data: sarData
      });

      mapInst.addLayer({
        id: 'sar-flood-fill',
        type: 'fill',
        source: 'sar-flood-source',
        layout: { visibility: isVisible ? 'visible' : 'none' },
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': 0.35
        }
      });

      mapInst.addLayer({
        id: 'sar-flood-line',
        type: 'line',
        source: 'sar-flood-source',
        layout: { visibility: isVisible ? 'visible' : 'none' },
        paint: {
          'line-color': '#0284c7',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.9
        }
      });

      mapInst.on('click', 'sar-flood-fill', (e) => {
        if (!e.features || !e.features.length) return;
        const p = e.features[0].properties;
        const popupContent = `
          <div class="p-2 text-slate-800 font-sans max-w-xs">
            <div class="flex items-center justify-between text-cyan-700 font-bold text-xs pb-1 border-b border-cyan-100">
              <span class="flex items-center gap-1">🛰️ SENTINEL-1 SAR</span>
              <span class="text-[9.5px] px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 font-extrabold uppercase">${p.severity || 'C-BAND'}</span>
            </div>
            <h4 class="font-extrabold text-sm text-slate-900 mt-1">${p.title || 'Vùng ngập SAR'}</h4>
            <p class="text-xs text-slate-600 mt-1">${p.description || ''}</p>
            <div class="mt-2 text-[11px] bg-cyan-50/80 p-2 rounded border border-cyan-200/80 space-y-0.5">
              <div><b>Độ tin cậy mặt nước:</b> <span class="text-cyan-800 font-bold">${p.water_confidence || 95}%</span></div>
              <div><b>Ước tính diện tích:</b> ~${p.area_km2 || 12.5} km²</div>
              <div><b>Mực nước ước đoán:</b> ${p.water_depth_est || '1.2m'}</div>
              <div><b>Cảm biến:</b> ${p.sensor || 'Sentinel-1A'} (${p.satellite_pass || 'Descending'})</div>
            </div>
          </div>
        `;
        if (activePopup) activePopup.remove();
        if (window.maplibregl) {
          activePopup = new window.maplibregl.Popup({ maxWidth: '320px', className: 'c2-dark-glass-popup' })
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(mapInst);
        }
      });

      mapInst.on('mouseenter', 'sar-flood-fill', () => { mapInst.getCanvas().style.cursor = 'pointer'; });
      mapInst.on('mouseleave', 'sar-flood-fill', () => { mapInst.getCanvas().style.cursor = ''; });
    }
  }

  async function init() {
    const mapInst = getMapInstance();
    if (!mapInst) return;
    try {
      const res = await fetch(getApiUrl('/api/satellite/sar-flood-polygons'));
      if (!res.ok) return;
      sarData = await res.json();
      if (mapInst.isStyleLoaded && mapInst.isStyleLoaded()) {
        setupSarLayers(mapInst);
      } else if (mapInst.once) {
        mapInst.once('load', () => setupSarLayers(mapInst));
      }
    } catch (e) {
      console.warn("Lỗi tải lớp viễn thám SAR:", e);
    }
  }

  function toggle(enabled) {
    isVisible = enabled;
    const mapInst = getMapInstance();
    if (!mapInst) return;
    if (!mapInst.getSource('sar-flood-source') && sarData) {
      setupSarLayers(mapInst);
    }
    const vis = enabled ? 'visible' : 'none';
    if (mapInst.getLayer('sar-flood-fill')) mapInst.setLayoutProperty('sar-flood-fill', 'visibility', vis);
    if (mapInst.getLayer('sar-flood-line')) mapInst.setLayoutProperty('sar-flood-line', 'visibility', vis);

    if (enabled && window.showToast) {
      showToast("🛰️ Đã bật Lớp Vùng ngập Vệ tinh", "Hiển thị các đa giác viễn thám Sentinel-1 SAR C-Band", "info");
    }
  }

  return {
    init,
    toggle,
    get isVisible() { return isVisible; }
  };
})();

// ============================================================================
// 3. RESCUE DISPATCH MANAGER (ĐIỀU PHỐI CỨU HỘ ĐA ĐIỂM TSP/VRP)
// ============================================================================
const RescueDispatchManager = (function () {
  let dispatchMarkers = [];

  function getMapInstance() {
    if (!window.map) return null;
    return window.map._maplibre || window.map;
  }

  function setupDispatchRouteLayer(mapInst, coords) {
    if (!mapInst) return;
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords // [[lng, lat], ...]
        }
      }]
    };

    if (mapInst.getSource('dispatch-route-source')) {
      mapInst.getSource('dispatch-route-source').setData(geojson);
    } else {
      mapInst.addSource('dispatch-route-source', {
        type: 'geojson',
        data: geojson
      });
      mapInst.addLayer({
        id: 'dispatch-route-layer',
        type: 'line',
        source: 'dispatch-route-source',
        paint: {
          'line-color': '#e11d48',
          'line-width': 4.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.95
        }
      });
    }
  }

  async function runOptimization() {
    const mapInst = getMapInstance();
    const vehicleSelect = document.getElementById('dispatch-vehicle-type');
    const vehicle = vehicleSelect ? vehicleSelect.value : 'boat';
    const statusEl = document.getElementById('dispatch-result-box');

    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.innerHTML = `
        <div class="flex items-center gap-2 text-blue-600 font-bold py-3 justify-center">
          <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Đang tối ưu hóa thứ tự chặng cứu hộ tuần tự...</span>
        </div>
      `;
    }

    try {
      const center = mapInst && typeof mapInst.getCenter === 'function' ? mapInst.getCenter() : { lat: 21.0285, lng: 105.8542 };
      const centerLat = center.lat !== undefined ? center.lat : center[1];
      const centerLng = center.lng !== undefined ? center.lng : center[0];

      const payload = {
        start_lat: centerLat,
        start_lng: centerLng,
        vehicle_type: vehicle,
        team_name: "Đội Cứu nạn Phản ứng Nhanh NorthStar"
      };

      const res = await fetch(getApiUrl('/api/rescue/dispatch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Xóa các marker cũ
      clearDispatch();

      // Vẽ đường lộ trình tuần tự bằng MapLibre LineString
      if (data.route_polyline && data.route_polyline.length && mapInst) {
        const lineCoords = data.route_polyline.map(p => [p[1], p[0]]); // [lng, lat]
        setupDispatchRouteLayer(mapInst, lineCoords);

        // Fit bounds
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
        lineCoords.forEach(c => {
          if (c[0] < minLng) minLng = c[0];
          if (c[0] > maxLng) maxLng = c[0];
          if (c[1] < minLat) minLat = c[1];
          if (c[1] > maxLat) maxLat = c[1];
        });
        if (minLng !== Infinity && typeof mapInst.fitBounds === 'function') {
          mapInst.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 800 });
        }
      }

      // Đánh dấu các mốc thứ tự 1, 2, 3... bằng maplibregl.Marker
      if (data.ordered_stops && window.maplibregl && mapInst) {
        data.ordered_stops.forEach(s => {
          const badgeColor = s.type === 'start' ? '#2563eb' : (s.type === 'shelter' ? '#059669' : '#e11d48');
          const el = document.createElement('div');
          el.className = 'dispatch-stop-icon';
          el.style.cursor = 'pointer';
          el.innerHTML = `
            <div style="background-color: ${badgeColor};" class="w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center shadow-lg border-2 border-white">
              ${s.step}
            </div>
          `;

          const popup = new window.maplibregl.Popup({ offset: 12, className: 'c2-dark-glass-popup' })
            .setHTML(`
              <div class="p-1.5 text-xs font-sans text-slate-800">
                <b>Chặng ${s.step}: ${s.title}</b>
                <div class="text-slate-600 mt-1">${s.action}</div>
                <div class="text-[10px] text-slate-400 mt-1">Cách chặng trước: ~${s.distance_from_prev_km} km</div>
              </div>
            `);

          const m = new window.maplibregl.Marker({ element: el })
            .setLngLat([s.lng, s.lat])
            .setPopup(popup)
            .addTo(mapInst);

          dispatchMarkers.push(m);
        });
      }

      // Hiển thị kết quả tóm tắt trên sidebar
      if (statusEl) {
        statusEl.innerHTML = `
          <div class="bg-rose-50/80 rounded-xl p-3 border border-rose-200 space-y-2">
            <div class="flex items-center justify-between font-bold text-xs text-rose-800">
              <span>🚑 KẾ HOẠCH ĐIỀU PHỐI ĐÃ LẬP</span>
              <span class="text-[10px] bg-rose-200 px-1.5 py-0.5 rounded">${data.dispatch_id}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div><b>Tổng số điểm:</b> ${data.total_stops} mốc dừng</div>
              <div><b>Nạn nhân:</b> <span class="text-rose-600 font-bold">${data.total_people_rescued} người</span></div>
              <div><b>Quãng đường:</b> ~${data.total_distance_km} km</div>
              <div><b>Thời gian ước tính:</b> ~${data.estimated_duration_min} phút</div>
            </div>
            <div class="text-[10.5px] text-slate-600 space-y-1 pt-1.5 border-t border-rose-200/60 max-h-40 overflow-y-auto">
              ${data.ordered_stops.map(s => `
                <div class="flex items-start gap-1.5">
                  <span class="font-bold text-rose-700 flex-shrink-0">[${s.step}]</span>
                  <span>${s.title} <small class="text-slate-400">(${s.action})</small></span>
                </div>
              `).join('')}
            </div>
            <button onclick="RescueDispatchManager.clearDispatch()" class="w-full mt-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border transition cursor-pointer">
              Xóa lộ trình điều phối
            </button>
          </div>
        `;
      }

      if (window.showToast) {
        showToast("✅ Đã Tối Ưu Lộ Trình Cứu Hộ", `Lập lộ trình cứu nạn ${data.total_people_rescued} người qua ${data.total_stops} chặng`, "success");
      }
    } catch (e) {
      console.warn("Lỗi tối ưu cứu hộ đa điểm:", e);
      if (statusEl) {
        statusEl.innerHTML = `<div class="p-2 bg-rose-100 text-rose-800 rounded text-xs font-bold">Lỗi: Không thể kết nối dịch vụ điều phối.</div>`;
      }
    }
  }

  function clearDispatch() {
    const mapInst = getMapInstance();
    if (mapInst && mapInst.getSource('dispatch-route-source')) {
      mapInst.getSource('dispatch-route-source').setData({ type: 'FeatureCollection', features: [] });
    }
    dispatchMarkers.forEach(m => {
      if (m && typeof m.remove === 'function') m.remove();
    });
    dispatchMarkers = [];
    const statusEl = document.getElementById('dispatch-result-box');
    if (statusEl) {
      statusEl.classList.add('hidden');
      statusEl.innerHTML = '';
    }
  }

  return {
    runOptimization,
    clearDispatch
  };
})();

// ============================================================================
// 4. SITREP REPORTER (XUẤT BÁO CÁO TÁC CHIẾN CHỈ HUY PCTT)
// ============================================================================
const SitRepReporter = (function () {
  async function openReportModal() {
    const modal = document.getElementById('sitrep-modal');
    const content = document.getElementById('sitrep-modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
      <div class="py-8 text-center text-slate-500 font-bold">
        <svg class="animate-spin h-6 w-6 mx-auto mb-2 text-blue-600" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        Đang tổng hợp dữ liệu tác chiến PCTT toàn miền Bắc...
      </div>
    `;

    try {
      const res = await fetch(getApiUrl('/api/reports/sitrep?format=json'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const k = d.kpi_summary;

      content.innerHTML = `
        <div class="space-y-4 text-xs font-sans text-slate-800">
          <!-- Header công văn -->
          <div class="flex items-start justify-between pb-3 border-b border-slate-200">
            <div>
              <div class="font-extrabold text-sm uppercase text-blue-900">${d.agency}</div>
              <div class="text-[11px] text-slate-500 font-medium">Hệ thống Giám sát Thiên tai NorthStar</div>
              <div class="text-[10px] text-slate-400 font-mono mt-0.5">Mã tài liệu: ${d.doc_code}</div>
            </div>
            <div class="text-right">
              <span class="inline-block px-2.5 py-1 bg-rose-100 text-rose-800 font-extrabold rounded-full text-[11px] uppercase border border-rose-300">
                TÁC CHIẾN KHẨN CẤP
              </span>
              <div class="text-[10.5px] text-slate-500 mt-1 italic">${d.timestamp_str}</div>
            </div>
          </div>

          <!-- 4 Khối Chỉ số KPI Tác chiến -->
          <div class="grid grid-cols-4 gap-2 text-center">
            <div class="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              <span class="text-[10px] font-bold text-slate-500 uppercase block">Điểm ngập nguy hiểm</span>
              <span class="text-xl font-black text-rose-600">${k.danger_points_count}</span>
              <span class="text-[10px] text-slate-400 block">/ ${k.monitoring_stations} trạm</span>
            </div>
            <div class="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              <span class="text-[10px] font-bold text-slate-500 uppercase block">Yêu cầu SOS</span>
              <span class="text-xl font-black text-amber-700">${k.active_sos_requests}</span>
              <span class="text-[10px] text-amber-800 font-bold block">${k.high_priority_sos} rất khẩn cấp</span>
            </div>
            <div class="bg-blue-50 p-2.5 rounded-xl border border-blue-200">
              <span class="text-[10px] font-bold text-slate-500 uppercase block">Nạn nhân mắc kẹt</span>
              <span class="text-xl font-black text-blue-700">${k.total_stranded_people}</span>
              <span class="text-[10px] text-slate-400 block">người cần hỗ trợ</span>
            </div>
            <div class="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
              <span class="text-[10px] font-bold text-slate-500 uppercase block">Chỗ sơ tán trống</span>
              <span class="text-xl font-black text-emerald-700">${k.shelter_available_slots}</span>
              <span class="text-[10px] text-slate-400 block">/ ${k.shelter_total_capacity} chỗ</span>
            </div>
          </div>

          <!-- Danh sách trạm ngập nguy cấp -->
          <div>
            <h5 class="font-extrabold text-slate-900 dark:text-slate-100 mb-1.5 uppercase text-[11px] flex items-center gap-1.5">
              <span>⚠️ DANH SÁCH ĐIỂM NGẬP ĐẶC BIỆT NGUY CẤP (VƯỢT NGƯỠNG AN TOÀN)</span>
            </h5>
            <div class="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 rounded-lg overflow-hidden">
              <table class="w-full text-left text-[11px]">
                <thead class="bg-slate-100 dark:bg-slate-700/80 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-600">
                  <tr>
                    <th class="p-1.5 pl-2">STT</th>
                    <th class="p-1.5">Tên trạm / Vị trí</th>
                    <th class="p-1.5 text-center">Mực nước</th>
                    <th class="p-1.5 text-center">Ngưỡng tràn</th>
                    <th class="p-1.5 pr-2">Điều tiết giao thông</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/70">
                  ${d.critical_hotspots.map((p, idx) => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                      <td class="p-1.5 pl-2 font-bold text-slate-400 dark:text-slate-400">${idx + 1}</td>
                      <td class="p-1.5 font-bold text-slate-900 dark:text-white">${p.name}</td>
                      <td class="p-1.5 text-center font-bold text-rose-600 dark:text-rose-400">${p.depth_cm} cm</td>
                      <td class="p-1.5 text-center text-slate-500 dark:text-slate-400 font-mono">${p.threshold_cm} cm</td>
                      <td class="p-1.5 pr-2 text-rose-700 dark:text-rose-300 font-bold text-[10px]">CẤM XE MÁY & Ô TÔ</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Mệnh lệnh tác chiến -->
          <div>
            <h5 class="font-extrabold text-slate-900 dark:text-slate-100 mb-1.5 uppercase text-[11px]">📋 MỆNH LỆNH & PHƯƠNG ÁN TÁC CHIẾN TRỌNG TÂM</h5>
            <ul class="space-y-1 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200">
              ${d.tactical_directives.map(dir => `<li class="flex items-start gap-1.5"><span>•</span><span>${dir}</span></li>`).join('')}
            </ul>
          </div>

          <!-- Nút hành động in & đóng -->
          <div class="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button onclick="document.getElementById('sitrep-modal').classList.add('hidden')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition">
              Đóng
            </button>
            <a href="${getApiUrl('/api/reports/sitrep?format=html')}" target="_blank" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 !text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-1.5 no-underline">
              🖨️ In Báo Cáo / Xuất Bản Chuẩn A4
            </a>
          </div>
        </div>
      `;
    } catch (e) {
      console.warn("Lỗi tải SitRep:", e);
      content.innerHTML = `<div class="p-4 text-center text-rose-600 font-bold">Không thể tải dữ liệu báo cáo tác chiến.</div>`;
    }
  }

  return {
    openReportModal
  };
})();

// Tự động khởi tạo sau khi DOM sẵn sàng
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    SarFloodManager.init();
  }, 1000);
});
