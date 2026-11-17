/**
 * NorthStar AI Emergency Assistant & Pluggable Provider Widget
 * Tích hợp Groq Cloud API & Offline Rule-based Mock Provider:
 * - Hỏi đáp ngôn ngữ tự nhiên về tình trạng ngập lụt, cứu hộ, sơ tán
 * - Hướng dẫn kỹ năng sinh tồn, an toàn điện, lũ quét, lọc nước
 * - Nút kích hoạt hành động 1-click tích hợp sâu vào bản đồ NorthStar
 * - Hiển thị trạng thái AI Provider trực tuyến / ngoại tuyến
 */

const AIAssistant = (function () {
  let isOpen = false;
  let currentProviderInfo = null;

  async function fetchStatus() {
    try {
      const res = await fetch(getApiUrl('/api/ai/status'));
      if (!res.ok) return;
      const data = await res.json();
      currentProviderInfo = data;
      renderStatusBadge(data);
    } catch (e) {
      console.warn("Không thể lấy trạng thái AI Provider:", e);
      renderStatusBadge({
        status: "offline_fallback",
        active_provider: "mock_offline",
        model: "offline"
      });
    }
  }

  function renderStatusBadge(data) {
    const labelEl = document.getElementById('ai-provider-label');
    const dotEl = document.getElementById('ai-provider-dot');
    if (!labelEl || !dotEl) return;

    if (data.status === 'online' && data.active_provider.includes('groq')) {
      labelEl.textContent = '⚡ Groq LLaMA 3.3';
      dotEl.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse';
    } else if (data.status === 'offline_fallback' || data.active_provider.includes('mock')) {
      labelEl.textContent = '🛡️ Ngoại tuyến';
      dotEl.className = 'w-1.5 h-1.5 rounded-full bg-cyan-400';
    } else if (data.status === 'disabled') {
      labelEl.textContent = 'AI Tắt';
      dotEl.className = 'w-1.5 h-1.5 rounded-full bg-slate-400';
    } else {
      labelEl.textContent = data.active_provider || 'AI Ready';
      dotEl.className = 'w-1.5 h-1.5 rounded-full bg-cyan-400';
    }
  }

  function toggle() {
    isOpen = !isOpen;
    const panel = document.getElementById('ai-assistant-panel');
    const badge = document.getElementById('ai-assistant-badge');
    if (!panel) return;

    if (isOpen) {
      panel.classList.remove('hidden');
      if (badge) badge.classList.add('hidden');
      fetchStatus();
      const input = document.getElementById('ai-assistant-input');
      if (input) input.focus();
    } else {
      panel.classList.add('hidden');
    }
  }

  function appendMessage(sender, text, actions = [], providerUsed = null, isFallback = false) {
    const thread = document.getElementById('ai-assistant-thread');
    if (!thread) return;

    const isUser = sender === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`;

    let actionsHtml = '';
    if (actions && actions.length > 0) {
      actionsHtml = `
        <div class="mt-2 pt-1.5 border-t border-indigo-100 dark:border-slate-700 flex flex-wrap gap-1.5">
          ${actions.map(a => `
            <button onclick="AIAssistant.handleAction('${a.action}', '${a.tab || ''}')" class="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 text-indigo-700 dark:text-cyan-300 font-bold text-[10.5px] rounded-lg border border-indigo-200 dark:border-slate-600 shadow-2xs transition active:scale-95 cursor-pointer">
              ${a.label}
            </button>
          `).join('')}
        </div>
      `;
    }

    let footnoteHtml = '';
    if (!isUser && providerUsed) {
      footnoteHtml = `
        <div class="mt-1 text-[9px] text-slate-400 dark:text-slate-400 flex items-center justify-between border-t border-slate-200/50 dark:border-slate-700/50 pt-1">
          <span>Nguồn: ${providerUsed}</span>
          ${isFallback ? '<span class="text-amber-600 dark:text-amber-400 font-semibold">Chế độ Ngoại tuyến</span>' : '<span class="text-emerald-600 dark:text-emerald-400 font-semibold">Groq LPU Tốc độ cao</span>'}
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="max-w-[85%] rounded-2xl p-2.5 text-xs ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-xs shadow-sm font-medium'
          : 'bg-indigo-50/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-indigo-100 dark:border-slate-700 rounded-bl-xs shadow-xs font-normal'
      }">
        <div class="leading-relaxed whitespace-pre-wrap">${formatMarkdownSimple(text)}</div>
        ${actionsHtml}
        ${footnoteHtml}
      </div>
    `;

    thread.appendChild(msgDiv);
    thread.scrollTop = thread.scrollHeight;
  }

  function formatMarkdownSimple(text) {
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      .replace(/`(.*?)`/g, '<code class="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');
    return formatted;
  }

  async function send(query = null) {
    const input = document.getElementById('ai-assistant-input');
    const msg = query || (input ? input.value.trim() : '');
    if (!msg) return;

    if (input && !query) input.value = '';

    appendMessage('user', msg);

    // Hiển thị bóng chat đang tra cứu
    const thread = document.getElementById('ai-assistant-thread');
    const loadingId = 'ai-loading-indicator';
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'flex justify-start';
    loadingDiv.innerHTML = `
      <div class="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl p-2 px-3 text-xs flex items-center gap-1.5 font-medium">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
        Trợ lý AI đang tra cứu dữ liệu thiên tai...
      </div>
    `;
    thread.appendChild(loadingDiv);
    thread.scrollTop = thread.scrollHeight;

    try {
      const center = window.map ? window.map.getCenter() : { lat: 21.0285, lng: 105.8542 };
      const res = await fetch(getApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: msg,
          lat: center.lat,
          lng: center.lng,
          include_live_context: true
        })
      });

      const indicator = document.getElementById(loadingId);
      if (indicator) indicator.remove();

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      appendMessage('bot', data.reply, data.suggested_actions, data.provider_used, data.is_fallback);
    } catch (e) {
      console.warn("Lỗi kết nối /api/ai/chat:", e);
      const indicator = document.getElementById(loadingId);
      if (indicator) indicator.remove();
      appendMessage('bot', "⚠️ Không thể kết nối tới máy chủ Trợ lý AI. Hệ thống đang bảo lưu kết nối ngoại tuyến an toàn.");
    }
  }

  function handleAction(action, tab) {
    if (action === 'open_sos') {
      if (window.openSOSModal) window.openSOSModal();
      else if (window.switchTab) window.switchTab('sos');
    } else if (action === 'switch_tab' && tab) {
      if (window.switchTab) window.switchTab(tab);
    }
    const panel = document.getElementById('ai-assistant-panel');
    if (panel && window.innerWidth < 640) toggle();
  }

  // Tiện ích phân tích báo cáo thiên tai cho Tab "Báo ngập"
  async function analyzeReport(content) {
    try {
      const res = await fetch(getApiUrl('/api/ai/analyze-report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn("Lỗi phân tích báo cáo AI:", e);
      return null;
    }
  }

  // Tiện ích phân loại yêu cầu cứu trợ khẩn cấp cho Tab "Cứu hộ SOS"
  async function classifyEmergency(message, phone = null, locationText = null) {
    try {
      const res = await fetch(getApiUrl('/api/ai/classify-emergency'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          contact_phone: phone,
          location_text: locationText
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn("Lỗi phân loại cứu nạn AI:", e);
      return null;
    }
  }

  // Khởi động lấy trạng thái ban đầu khi tải script
  setTimeout(fetchStatus, 1500);

  return {
    toggle,
    send,
    handleAction,
    fetchStatus,
    analyzeReport,
    classifyEmergency
  };
})();
