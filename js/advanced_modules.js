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
  let sarLayerGroup = null;
  let isVisible = false;

  async function init() {
    if (!window.map) return;
    sarLayerGroup = L.layerGroup();
    try {
      const res = await fetch(getApiUrl('/api/satellite/sar-flood-polygons'));
      if (!res.ok) return;
      const data = await res.json();

      L.geoJSON(data, {
        style: function (feature) {
          return {
            color: '#0284c7',
            weight: 2.5,
            opacity: 0.9,
            fillColor: '#38bdf8',
            fillOpacity: 0.35,
            dashArray: '6, 6'
          };
        },
        onEachFeature: function (feature, layer) {
          const p = feature.properties;
          const popupContent = `
            <div class="p-2 text-slate-800 font-sans max-w-xs">
              <div class="flex items-center justify-between text-cyan-700 font-bold text-xs pb-1 border-b border-cyan-100">
                <span class="flex items-center gap-1">🛰️ SENTINEL-1 SAR</span>
                <span class="text-[9.5px] px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 font-extrabold uppercase">${p.severity}</span>
              </div>
              <h4 class="font-extrabold text-sm text-slate-900 mt-1">${p.title}</h4>
              <p class="text-xs text-slate-600 mt-1">${p.description}</p>
              <div class="mt-2 text-[11px] bg-cyan-50/80 p-2 rounded border border-cyan-200/80 space-y-0.5">
                <div><b>Độ tin cậy mặt nước:</b> <span class="text-cyan-800 font-bold">${p.water_confidence}%</span></div>
                <div><b>Ước tính diện tích:</b> ~${p.area_km2} km²</div>
                <div><b>Mực nước ước đoán:</b> ${p.water_depth_est}</div>
                <div><b>Cảm biến:</b> ${p.sensor} (${p.satellite_pass})</div>
              </div>
            </div>
          `;
          layer.bindPopup(popupContent, { maxWidth: 300 });
        }
      }).addTo(sarLayerGroup);

      // Thêm vào bản đồ nếu đang được bật
      if (isVisible) {
        sarLayerGroup.addTo(window.map);
      }
    } catch (e) {
      console.warn("Lỗi tải lớp viễn thám SAR:", e);
    }
  }

  function toggle(enabled) {
    isVisible = enabled;
    if (!sarLayerGroup || !window.map) return;
    if (enabled) {
      sarLayerGroup.addTo(window.map);
      if (window.showToast) {
        showToast("🛰️ Đã bật Lớp Vùng ngập Vệ tinh", "Hiển thị 5 đa giác viễn thám Sentinel-1 SAR C-Band", "info");
      }
    } else {
      window.map.removeLayer(sarLayerGroup);
    }
  }

  return {
    init,
    toggle
  };
})();

// ============================================================================
// 3. RESCUE DISPATCH MANAGER (ĐIỀU PHỐI CỨU HỘ ĐA ĐIỂM TSP)
// ============================================================================
const RescueDispatchManager = (function () {
  let dispatchPolyline = null;
  let dispatchMarkers = [];

  async function runOptimization() {
    const vehicle = document.getElementById('dispatch-vehicle-select')?.value || 'truck';
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
      // Lấy vị trí xuất phát từ toạ độ hiện tại hoặc tâm bản đồ
      const center = window.map ? window.map.getCenter() : { lat: 21.0285, lng: 105.8542 };
      const payload = {
        start_lat: center.lat,
        start_lng: center.lng,
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

      // Xóa các marker và route cũ nếu có
      if (dispatchPolyline && window.map) window.map.removeLayer(dispatchPolyline);
      dispatchMarkers.forEach(m => window.map.removeLayer(m));
      dispatchMarkers = [];

      // Vẽ đường lộ trình tuần tự
      if (data.route_polyline && window.map) {
        dispatchPolyline = L.polyline(data.route_polyline, {
          color: '#e11d48',
          weight: 4,
          dashArray: '8, 8',
          opacity: 0.9
        }).addTo(window.map);
        window.map.fitBounds(dispatchPolyline.getBounds(), { padding: [40, 40] });
      }

      // Đánh dấu các mốc thứ tự 1, 2, 3...
      data.ordered_stops.forEach(s => {
        const badgeColor = s.type === 'start' ? '#2563eb' : (s.type === 'shelter' ? '#059669' : '#e11d48');
        const markerIcon = L.divIcon({
          className: 'dispatch-stop-icon',
          html: `
            <div style="background-color: ${badgeColor};" class="w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center shadow-lg border-2 border-white">
              ${s.step}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        const m = L.marker([s.lat, s.lng], { icon: markerIcon }).addTo(window.map);
        m.bindPopup(`
          <div class="p-1.5 text-xs font-sans">
            <b>Chặng ${s.step}: ${s.title}</b>
            <div class="text-slate-600 mt-1">${s.action}</div>
            <div class="text-[10px] text-slate-400 mt-1">Cách chặng trước: ~${s.distance_from_prev_km} km</div>
          </div>
        `);
        dispatchMarkers.push(m);
      });

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
            <button onclick="RescueDispatchManager.clearDispatch()" class="w-full mt-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border transition">
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
    if (dispatchPolyline && window.map) window.map.removeLayer(dispatchPolyline);
    dispatchMarkers.forEach(m => window.map.removeLayer(m));
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
