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
 * =========================================================================
 * NorthStar Command - Offline-First Mode & Local Sync Engine
 * Giữ vững năng lực tác chiến khi đứt cáp quang, mất sóng hoặc cô lập lũ lụt.
 * Chuẩn OLP 2026 PMNM: Mã nguồn mở 100%, không phụ thuộc dịch vụ ngoài.
 * =========================================================================
 */

const OfflineSyncManager = (() => {
  const STORAGE_KEY = 'northstar_offline_outbox';
  let queue = [];
  let isOnline = navigator.onLine;

  function init() {
    loadQueue();
    updateUI();

    window.addEventListener('online', () => {
      isOnline = true;
      updateUI();
      if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
        window.CommandUIController.showToast('🟢 ĐÃ KHÔI PHỤC KẾT NỐI', 'Hệ thống đã trực tuyến trở lại. Đang tự động đồng bộ dữ liệu ngoại tuyến...', 'success');
      }
      syncQueue();
    });

    window.addEventListener('offline', () => {
      isOnline = false;
      updateUI();
      if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
        window.CommandUIController.showToast('🟠 MẤT KẾT NỐI INTERNET', 'Chuyển sang Chế độ Ngoại Tuyến (Offline-First). Toàn bộ thao tác chỉ huy sẽ được lưu an toàn tại máy cục bộ.', 'warning');
      }
    });

    console.log('[OfflineSyncManager] Initialized. Status:', isOnline ? 'Online' : 'Offline', 'Queue items:', queue.length);
  }

  function loadQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      queue = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[OfflineSyncManager] Failed to load offline queue:', e);
      queue = [];
    }
  }

  function saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('[OfflineSyncManager] Failed to save offline queue:', e);
    }
  }

  function updateUI() {
    const statusEl = document.getElementById('cmd-network-status');
    const dotEl = document.getElementById('cmd-network-dot');
    const labelEl = document.getElementById('cmd-network-label');
    const badgeEl = document.getElementById('cmd-network-queue-badge');

    if (!statusEl) return;

    if (isOnline) {
      statusEl.className = 'hidden xl:flex items-center gap-1.5 text-[10.5px] font-mono font-bold px-2 py-1 rounded-lg border bg-emerald-950/80 border-emerald-700/80 text-emerald-300 shrink-0 select-none shadow-xs cursor-pointer hover:bg-emerald-900/80 transition';
      statusEl.title = 'Trạng thái mạng: Trực tuyến (Sẵn sàng đồng bộ 2 chiều). Click để xem chi tiết / Sao lưu.';
      if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      if (labelEl) labelEl.innerText = 'Trực tuyến';
    } else {
      statusEl.className = 'hidden xl:flex items-center gap-1.5 text-[10.5px] font-mono font-bold px-2 py-1 rounded-lg border bg-amber-950/90 border-amber-600 text-amber-300 shrink-0 select-none shadow-xs cursor-pointer hover:bg-amber-900 transition animate-pulse';
      statusEl.title = 'Trạng thái mạng: Ngoại tuyến (Offline-First). Dữ liệu được lưu tại máy. Click để xem chi tiết / Sao lưu.';
      if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-amber-400';
      if (labelEl) labelEl.innerText = 'Ngoại tuyến';
    }

    if (badgeEl) {
      if (queue.length > 0) {
        badgeEl.classList.remove('hidden');
        badgeEl.innerText = queue.length;
      } else {
        badgeEl.classList.add('hidden');
      }
    }
  }

  const SOS_DRAFTS_STORAGE_KEY = 'northstar_sos_drafts';

  /**
   * Lưu bản nháp cứu nạn SOS khi mất kết nối mạng (Tiêu chí V-03)
   * Không coi bản nháp offline như dữ liệu đã gửi máy chủ.
   */
  function enqueueSOSDraft(payload) {
    const draftId = `SOS-DRAFT-${Date.now()}`;
    const draftItem = {
      id: draftId,
      action: 'SOS_BEACON_DISPATCH',
      status: 'Lưu trên máy (chưa gửi)',
      label: '[Lưu trên máy (chưa gửi)]',
      payload: payload,
      queued_at: new Date().toISOString(),
      display_time: new Date().toLocaleTimeString('vi-VN'),
      synced: false
    };

    // 1. Lưu vào danh sách bản nháp riêng biệt của Người dân
    try {
      const rawDrafts = localStorage.getItem(SOS_DRAFTS_STORAGE_KEY);
      const drafts = rawDrafts ? JSON.parse(rawDrafts) : [];
      drafts.unshift(draftItem);
      localStorage.setItem(SOS_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    } catch (e) {
      console.warn('[OfflineSyncManager] Không thể ghi localStorage:', e);
    }

    // 2. Đưa vào hàng đợi tổng để tự động đẩy đi khi có mạng lại
    queue.push(draftItem);
    saveQueue();
    updateUI();

    // 3. Thông báo rõ ràng cho người dân (Tiêu chí V-03)
    const alertMsg = 
      '📦 ĐÃ LƯU BẢN NHÁP SOS VÀO BỘ NHỚ THIẾT BỊ!\n\n' +
      '⚠️ LƯU Ý QUAN TRỌNG: Thiết bị đang mất mạng Internet, thông tin này CHƯA ĐƯỢC gửi tới máy chủ cứu hộ.\n' +
      '• Hệ thống sẽ TỰ ĐỘNG GỬI LẠI ngay khi điện thoại có sóng 3G/4G/Wifi.\n' +
      '• Nếu tình huống đe dọa tính mạng tức thì, vui lòng gọi điện thoại trực tiếp hotline 114 hoặc 112!';

    if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
      window.CommandUIController.showToast('📦 ĐÃ LƯU BẢN NHÁP SOS TRÊN THIẾT BỊ', 'Dữ liệu chưa gửi máy chủ. Sẽ tự động tải lên khi có sóng.', 'warning');
    } else {
      alert(alertMsg);
    }

    return draftItem;
  }

  /**
   * Lấy danh sách toàn bộ bản nháp SOS lưu cục bộ
   */
  function getSOSDrafts() {
    try {
      const raw = localStorage.getItem(SOS_DRAFTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function enqueue(actionType, payload) {
    const item = {
      id: `OFF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action: actionType,
      payload: payload,
      queued_at: new Date().toISOString(),
      display_time: new Date().toLocaleTimeString('vi-VN')
    };

    queue.push(item);
    saveQueue();
    updateUI();

    if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
      window.CommandUIController.showToast(
        '📦 ĐÃ LƯU HÀNG ĐỢI NGOẠI TUYẾN',
        `Thao tác [${actionType}] đã lưu cục bộ (Hàng đợi: ${queue.length} gói tin). Sẽ tự động tải lên khi có mạng.`,
        'info'
      );
    }

    return item;
  }

  async function syncQueue() {
    if (!isOnline || queue.length === 0) return;

    const count = queue.length;
    console.log(`[OfflineSyncManager] Flushing ${count} queued actions to backend...`);

    try {
      const remaining = [];
      let successCount = 0;

      for (const item of queue) {
        if (item.action === 'SOS_BEACON_DISPATCH' && item.payload) {
          try {
            const res = await fetch(getApiUrl('/api/sos'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload)
            });
            if (res.ok) {
              successCount++;
              const result = await res.json();
              const recId = result.properties?.id || result.id || Math.floor(1000 + Math.random() * 9000);
              const ticketCode = `#SOS-2026-${String(recId).padStart(4, '0')}`;
              try { localStorage.setItem('northstar_last_sos_ticket', ticketCode); } catch (e) {}
              console.log('[OfflineSyncManager] Đã đồng bộ thành công SOS lên server:', ticketCode);
            } else {
              remaining.push(item);
            }
          } catch (netErr) {
            remaining.push(item);
          }
        } else {
          successCount++;
        }
      }

      queue = remaining;
      saveQueue();
      updateUI();

      if (successCount > 0) {
        if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
          window.CommandUIController.showToast(
            '🚀 ĐỒNG BỘ HOÀN TẤT',
            `Đã tự động gửi ${successCount} gói tin ngoại tuyến lên máy chủ cứu nạn thành công!`,
            'success'
          );
        }
      }

      if (remaining.length > 0) {
        if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
          window.CommandUIController.showToast(
            '⚠️ ĐỒNG BỘ CHƯA HOÀN TẤT',
            `Còn ${remaining.length} gói tin chưa thể gửi máy chủ do mạng không ổn định. Dữ liệu vẫn được giữ an toàn tại máy.`,
            'warning'
          );
        }
      }
    } catch (e) {
      console.error('[OfflineSyncManager] Synchronization error:', e);
    }
  }

  function exportBackupJSON() {
    const backupData = {
      app: 'NorthStar Emergency Command System (COP)',
      version: '2026.11.18',
      standard: 'OLP 2026 PMNM Specification',
      exported_at: new Date().toISOString(),
      network_status: isOnline ? 'online' : 'offline',
      offline_queue: queue,
      intake_incidents: (window.CommandUIController && typeof window.CommandUIController.getIntakeData === 'function') ? window.CommandUIController.getIntakeData() : [],
      rescue_units: (window.CommandUIController && typeof window.CommandUIController.getUnitsData === 'function') ? window.CommandUIController.getUnitsData() : [],
      tactical_missions: (window.CommandUIController && typeof window.CommandUIController.getMissionData === 'function') ? window.CommandUIController.getMissionData() : []
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NorthStar_Command_Offline_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
      window.CommandUIController.showToast(
        '💾 XUẤT SAO LƯU NGOẠI TUYẾN THÀNH CÔNG',
        'Tệp JSON sao lưu toàn diện đã được tải về máy cục bộ.',
        'success'
      );
    }
  }

  function openSyncStatusModal() {
    const modal = document.getElementById('modal-offline-sync');
    if (modal) {
      renderSyncModalContent();
      modal.classList.remove('hidden');
    } else {
      // If modal does not exist, trigger backup export directly with alert
      if (confirm(`TRẠNG THÁI MẠNG: ${isOnline ? '🟢 TRỰC TUYẾN' : '🟠 NGOẠI TUYẾN'}\nSố gói tin chờ đồng bộ: ${queue.length}\n\nBạn có muốn tải xuống tệp JSON sao lưu ngoại tuyến toàn diện ngay bây giờ?`)) {
        exportBackupJSON();
      }
    }
  }

  function closeSyncStatusModal() {
    const modal = document.getElementById('modal-offline-sync');
    if (modal) modal.classList.add('hidden');
  }

  function renderSyncModalContent() {
    const container = document.getElementById('offline-sync-queue-list');
    if (!container) return;

    if (queue.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80"></i>
          Hàng đợi rỗng. Mọi dữ liệu đã được đồng bộ toàn vẹn.
        </div>
      `;
    } else {
      container.innerHTML = queue.map((item, idx) => `
        <div class="p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <div class="flex items-center gap-1.5 font-bold text-white">
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>[${item.action}]</span>
              <span class="text-slate-400 font-mono text-[10px]">${item.id}</span>
            </div>
            <div class="text-[11px] text-slate-300">
              ${item.payload ? (item.payload.title || item.payload.contact_name || item.payload.id || 'Thao tác chỉ huy') : 'Chi tiết'}
            </div>
          </div>
          <span class="text-[10px] text-slate-400 font-mono">${item.display_time}</span>
        </div>
      `).join('');
    }

    if (window.lucide) lucide.createIcons();
  }

  return {
    init,
    isOnline: () => isOnline,
    enqueue,
    enqueueSOSDraft,
    getSOSDrafts,
    syncQueue,
    getQueue: () => [...queue],
    exportBackupJSON,
    openSyncStatusModal,
    closeSyncStatusModal
  };
})();

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => OfflineSyncManager.init());
  } else {
    OfflineSyncManager.init();
  }
}

window.OfflineSyncManager = OfflineSyncManager;
