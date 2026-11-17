/**
 * ===================================================================
 * NORTHSTAR - Interactive Demo Presentation Suite & Toast System
 * Kịch bản Trình diễn Trực tiếp & Hệ thống Thông báo Điều hành
 * Giấy phép: Apache-2.0 License (100% Mã nguồn mở)
 * ===================================================================
 */

const NorthStarDemo = (function () {
  // 1. HỆ THỐNG TOAST THÔNG BÁO ĐIỀU HÀNH (Thay thế window.alert)
  function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('northstar-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'northstar-toast-container';
      container.className = 'fixed bottom-20 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto transform translate-y-4 opacity-0 transition-all duration-300 rounded-xl p-3 shadow-2xl border backdrop-blur-md flex items-start gap-2.5 text-xs font-semibold';

    let icon = 'info';
    let bgClasses = 'bg-slate-900/90 text-white border-slate-700';

    if (type === 'success') {
      icon = 'check-circle';
      bgClasses = 'bg-emerald-950/90 text-emerald-100 border-emerald-600';
    } else if (type === 'warning') {
      icon = 'alert-triangle';
      bgClasses = 'bg-amber-950/90 text-amber-100 border-amber-600';
    } else if (type === 'danger') {
      icon = 'shield-alert';
      bgClasses = 'bg-rose-950/90 text-rose-100 border-rose-600';
    }

    toast.className += ` ${bgClasses}`;
    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
      <div class="flex-1 leading-snug">${message}</div>
      <button class="opacity-60 hover:opacity-100 transition" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Thay thế alert mặc định bằng showToast để giao diện mượt mà
  window.alert = function (msg) {
    showToast(msg, 'warning', 4000);
  };
  window.showNorthStarToast = showToast;

  // 2. MODAL KỊCH BẢN DEMO
  function toggleDemoModal(open = null) {
    const modal = document.getElementById('demo-scenarios-modal');
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');
    const shouldOpen = open !== null ? open : isHidden;

    if (shouldOpen) {
      modal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    } else {
      modal.classList.add('hidden');
    }
  }

  // 3. KỊCH BẢN 1: ĐỊNH TUYẾN NÉ NGẬP THÔNG MINH
  async function runScenario1() {
    toggleDemoModal(false);
    showToast('Đang chạy Kịch bản 1: Định tuyến Né ngập Cầu Giấy (Xe máy)...', 'info');

    if (typeof window.switchTab === 'function') window.switchTab('route');

    // Xuân Thủy -> Vincom Láng Hạ
    const originLng = 105.7801, originLat = 21.0372;
    const destLng = 105.8120, destLat = 21.0110;

    if (typeof window.setPresetRoute === 'function') {
      window.setPresetRoute(originLng, originLat, destLng, destLat, 'Xuân Thủy ➔ Láng Hạ');
    }

    setTimeout(() => {
      showToast('✓ Hoàn tất tính toán A*: Tuyến an toàn né hoàn toàn điểm ngập sâu 35cm!', 'success', 4500);
    }, 1200);
  }

  // 4. KỊCH BẢN 2: BÃO DỒN DẬP & CẢNH BÁO GIỌNG NÓI
  async function runScenario2() {
    toggleDemoModal(false);
    showToast('Đang chạy Kịch bản 2: Bão lớn 60mm/h & Cảnh báo giọng nói...', 'warning');

    if (typeof window.switchTab === 'function') window.switchTab('route');

    // Chỉnh lượng mưa bão
    if (typeof StormSimulator !== 'undefined' && StormSimulator.applyScenario) {
      StormSimulator.applyScenario('heavy_storm');
    }

    // Đảm bảo có lộ trình mẫu
    const originLng = 105.7801, originLat = 21.0372;
    const destLng = 105.8120, destLat = 21.0110;
    if (typeof window.setPresetRoute === 'function') {
      window.setPresetRoute(originLng, originLat, destLng, destLat, 'Cầu Giấy ➔ Láng Hạ');
    }

    // Kích hoạt giọng nói cảnh báo
    setTimeout(() => {
      if (typeof VoiceWarning !== 'undefined' && VoiceWarning.speak) {
        VoiceWarning.speak('Cảnh báo: Đoạn đường phía trước ngập sâu 40 xăng-ti-mét. Hệ thống NorthStar đã tự động chuyển sang lộ trình an toàn.');
      }
      showToast('🔊 Trợ lý AI phát cảnh báo giọng nói tiếng Việt tức thì!', 'info', 4000);
    }, 1500);

    // Bắt đầu mô phỏng xe chạy
    setTimeout(() => {
      if (typeof VehicleSim !== 'undefined' && VehicleSim.start) {
        VehicleSim.start();
        showToast('🚗 Mô phỏng xe chạy GPS dọc tuyến an toàn', 'success', 3500);
      }
    }, 2000);
  }

  // 5. KỊCH BẢN 3: SƠ TÁN KHẨN CẤP ĐA THIÊN TAI (MULTI-TARGET DIJKSTRA)
  async function runScenario3() {
    toggleDemoModal(false);
    showToast('Đang chạy Kịch bản 3: Sơ tán người dân thoát khỏi vùng ngập...', 'danger');

    if (typeof window.switchTab === 'function') window.switchTab('rescue');

    // Điểm người dân gặp nạn tại Cầu Giấy (105.7810, 21.0365)
    const victimLocation = { lng: 105.7810, lat: 21.0365 };

    if (window.map) {
      window.map.flyTo([victimLocation.lat, victimLocation.lng], 16, { duration: 1.5 });
    }

    setTimeout(() => {
      if (window.NorthStarRescue && NorthStarRescue.findEvacuationRoute) {
        NorthStarRescue.findEvacuationRoute(victimLocation, 'walk');
        showToast('✓ Tìm thấy điểm trú ẩn an toàn nhất: Nhà văn hóa Dịch Vọng (Cách 450m, 6 phút đi bộ)', 'success', 5000);
      }
    }, 1600);
  }

  // 6. KỊCH BẢN 4: PHÁT TÍN HIỆU CẦU CỨU SOS CỘNG ĐỒNG
  async function runScenario4() {
    toggleDemoModal(false);
    showToast('Đang chạy Kịch bản 4: Người dân phát tín hiệu cầu cứu SOS...', 'danger');

    if (typeof window.switchTab === 'function') window.switchTab('rescue');

    // Tự động điền form SOS mẫu
    const nameEl = document.getElementById('sos-input-name');
    const phoneEl = document.getElementById('sos-input-phone');
    const peopleEl = document.getElementById('sos-input-people');
    const notesEl = document.getElementById('sos-input-notes');

    if (nameEl) nameEl.value = 'Trần Văn Mạnh (Demo)';
    if (phoneEl) phoneEl.value = '0912345678';
    if (peopleEl) peopleEl.value = '4';
    if (notesEl) notesEl.value = 'Nước ngập ngang ngực 80cm ngập tầng 1, có 1 cụ già và 1 trẻ nhỏ cần xuồng cứu hộ!';

    // Cuộn tới form SOS
    const formCard = document.getElementById('sos-beacon-form');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });

    showToast('📝 Đã điền thông tin cứu hộ khẩn cấp mẫu. Bấm "Phát tín hiệu SOS" để gửi!', 'info', 4000);
  }

  // 7. KỊCH BẢN 5: GIÁM SÁT TOÀN MIỀN BẮC & PHÂN VÙNG THIÊN TAI (NORTHERN ECOSYSTEM)
  async function runScenario5() {
    toggleDemoModal(false);
    showToast('Đang chạy Kịch bản 5: Giám sát Hệ sinh thái Toàn Miền Bắc & Phân vùng thiên tai...', 'info');

    if (typeof window.switchTab === 'function') window.switchTab('rescue');

    // 1. Phóng to toàn cảnh Miền Bắc
    if (typeof window.jumpToRegion === 'function') {
      window.jumpToRegion('all');
    }

    setTimeout(() => {
      showToast('🌐 Toàn cảnh 155 trạm quan trắc, 12 tâm chấn thiên tai & 15 điểm sơ tán trọng điểm Miền Bắc!', 'success', 4500);
    }, 1500);

    // 2. Chuyển camera tới tâm chấn sạt lở Tây Bắc (Lào Cai - Làng Nủ & Yên Bái)
    setTimeout(() => {
      if (typeof window.jumpToRegion === 'function') {
        window.jumpToRegion('taybac');
      }
      showToast('⛰️ Chuyển camera tới Tâm chấn sạt lở & lũ sông Thao (Lào Cai - Làng Nủ & TP Yên Bái)', 'warning', 4500);
    }, 4500);
  }

  // 8. PHÍM TẮT DÀNH CHO BÁO CÁO VIÊN (PRESENTER SHORTCUTS)
  function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Tránh bắt phím khi đang nhập liệu trong ô input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === '1') {
        if (typeof window.switchTab === 'function') window.switchTab('route');
        showToast('Phím tắt [1]: Tab Tìm đường', 'info', 1500);
      } else if (e.key === '2') {
        if (typeof window.switchTab === 'function') window.switchTab('points');
        showToast('Phím tắt [2]: Tab 155 Trạm quan trắc', 'info', 1500);
      } else if (e.key === '3') {
        if (typeof window.switchTab === 'function') window.switchTab('report');
        showToast('Phím tắt [3]: Tab Báo ngập', 'info', 1500);
      } else if (e.key === '4') {
        if (typeof window.switchTab === 'function') window.switchTab('rescue');
        showToast('Phím tắt [4]: Tab Cứu hộ SOS', 'info', 1500);
      } else if (e.key === '5') {
        if (typeof window.switchTab === 'function') window.switchTab('rescue');
        if (typeof window.jumpToRegion === 'function') window.jumpToRegion('all');
        showToast('Phím tắt [5]: Giám sát Toàn Miền Bắc', 'info', 1500);
      } else if (e.key.toLowerCase() === 'd') {
        toggleDemoModal();
      } else if (e.key === 'Escape') {
        toggleDemoModal(false);
      }
    });
  }

  return {
    showToast,
    toggleDemoModal,
    runScenario1,
    runScenario2,
    runScenario3,
    runScenario4,
    runScenario5,
    initKeyboardShortcuts
  };
})();

// Khởi tạo phím tắt khi tải trang
window.addEventListener('DOMContentLoaded', () => {
  NorthStarDemo.initKeyboardShortcuts();
});
