/**
 * NorthStar AI Emergency Assistant & Dispatcher Widget
 * Trợ lý AI Trực ban Thiên tai 24/7:
 * - Hỏi đáp ngôn ngữ tự nhiên về tình trạng ngập lụt, cứu hộ, sơ tán
 * - Hướng dẫn kỹ năng sinh tồn, an toàn điện, lũ quét, lọc nước
 * - Nút kích hoạt hành động 1-click tích hợp sâu vào bản đồ NorthStar
 */

const AIAssistant = (function () {
  let isOpen = false;

  function toggle() {
    isOpen = !isOpen;
    const panel = document.getElementById('ai-assistant-panel');
    const badge = document.getElementById('ai-assistant-badge');
    if (!panel) return;

    if (isOpen) {
      panel.classList.remove('hidden');
      if (badge) badge.classList.add('hidden');
      const input = document.getElementById('ai-assistant-input');
      if (input) input.focus();
    } else {
      panel.classList.add('hidden');
    }
  }

  function appendMessage(sender, text, actions = []) {
    const thread = document.getElementById('ai-assistant-thread');
    if (!thread) return;

    const isUser = sender === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`;

    let actionsHtml = '';
    if (actions && actions.length > 0) {
      actionsHtml = `
        <div class="mt-2 pt-1.5 border-t border-indigo-100 flex flex-wrap gap-1.5">
          ${actions.map(a => `
            <button onclick="AIAssistant.handleAction('${a.action}', '${a.tab || ''}')" class="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-bold text-[10.5px] rounded-lg border border-indigo-200 shadow-2xs transition active:scale-95 cursor-pointer">
              ${a.label}
            </button>
          `).join('')}
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="max-w-[85%] rounded-2xl p-2.5 text-xs ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-xs shadow-sm font-medium'
          : 'bg-indigo-50/90 text-slate-800 border border-indigo-100 rounded-bl-xs shadow-xs font-normal'
      }">
        <div class="leading-relaxed whitespace-pre-wrap">${formatMarkdownSimple(text)}</div>
        ${actionsHtml}
      </div>
    `;

    thread.appendChild(msgDiv);
    thread.scrollTop = thread.scrollHeight;
  }

  function formatMarkdownSimple(text) {
    // Chuyển đổi định dạng bold, list đơn giản sang HTML
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g, '<i>$1</i>');
    return formatted;
  }

  async function send(query = null) {
    const input = document.getElementById('ai-assistant-input');
    const msg = query || (input ? input.value.trim() : '');
    if (!msg) return;

    if (input && !query) input.value = '';

    appendMessage('user', msg);

    // Hiển thị bóng chat đang trả lời
    const thread = document.getElementById('ai-assistant-thread');
    const loadingId = 'ai-loading-indicator';
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'flex justify-start';
    loadingDiv.innerHTML = `
      <div class="bg-slate-100 text-slate-500 rounded-2xl p-2 px-3 text-xs flex items-center gap-1.5 font-medium">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
        Trợ lý AI đang tra cứu dữ liệu thiên tai...
      </div>
    `;
    thread.appendChild(loadingDiv);
    thread.scrollTop = thread.scrollHeight;

    try {
      const center = window.map ? window.map.getCenter() : { lat: 21.0285, lng: 105.8542 };
      const res = await fetch(getApiUrl('/api/ai/assistant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          lat: center.lat,
          lng: center.lng
        })
      });

      const indicator = document.getElementById(loadingId);
      if (indicator) indicator.remove();

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      appendMessage('bot', data.reply, data.suggested_actions);
    } catch (e) {
      console.warn("Lỗi kết nối AI Assistant:", e);
      const indicator = document.getElementById(loadingId);
      if (indicator) indicator.remove();
      appendMessage('bot', "⚠️ Không thể kết nối tới máy chủ Trợ lý AI. Vui lòng kiểm tra lại mạng hoặc thử lại sau giây lát.");
    }
  }

  function handleAction(action, tab) {
    if (action === 'open_sos') {
      if (window.openSOSModal) window.openSOSModal();
      else if (window.switchTab) window.switchTab('sos');
    } else if (action === 'switch_tab' && tab) {
      if (window.switchTab) window.switchTab(tab);
    }
    // Tự động thu gọn panel nếu người dùng chọn hành động bản đồ
    const panel = document.getElementById('ai-assistant-panel');
    if (panel && window.innerWidth < 640) toggle();
  }

  return {
    toggle,
    send,
    handleAction
  };
})();
