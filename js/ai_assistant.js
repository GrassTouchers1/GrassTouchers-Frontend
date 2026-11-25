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
 * NORTHSTAR AI Emergency Assistant (Online API + Offline Knowledge Engine, Phase 10 / CIT-11)
 * - Online: gọi /api/ai/chat với timeout 8s, tối đa 1 lần retry có kiểm soát.
 * - Offline / API lỗi: chuyển ngay sang OfflineKnowledgeEngine (truy vấn JSON cục bộ, không phải LLM offline).
 */
const AIAssistant = (function () {
  'use strict';

  let isOpen = false;
  let currentProviderInfo = null;
  const conversationHistory = [];
  const AI_TIMEOUT_MS = 8000;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMarkdownSimple(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      .replace(/`(.*?)`/g, '<code class="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');
  }

  async function fetchStatus() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      renderStatusBadge({ status: 'offline_knowledge', active_provider: 'offline_knowledge', model: 'local_json' });
      return;
    }
    try {
      const data = (typeof NorthStarApi !== 'undefined' && typeof NorthStarApi.fetchJson === 'function')
        ? await NorthStarApi.fetchJson('/api/ai/status', { timeoutMs: 5000 })
        : await (await fetch(getApiUrl('/api/ai/status'))).json();
      currentProviderInfo = data;
      renderStatusBadge(data);
    } catch (_) {
      renderStatusBadge({ status: 'offline_knowledge', active_provider: 'offline_knowledge', model: 'local_json' });
    }
  }

  function renderStatusBadge(data) {
    const labelEl = document.getElementById('ai-provider-label');
    const dotEl = document.getElementById('ai-provider-dot');
    if (!labelEl || !dotEl) return;

    if (data && data.status === 'online') {
      labelEl.textContent = 'Trợ lý AI Online';
      dotEl.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
    } else if (data && data.status === 'disabled') {
      labelEl.textContent = 'AI Tắt';
      dotEl.className = 'w-1.5 h-1.5 rounded-full bg-slate-400';
    } else {
      labelEl.textContent = 'Tri thức Offline';
      dotEl.className = 'w-1.5 h-1.5 rounded-full bg-amber-400';
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
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
      const input = document.getElementById('ai-assistant-input');
      if (input) input.focus();
    } else {
      panel.classList.add('hidden');
    }
  }

  function appendMessage(sender, text, actions = [], meta = {}) {
    const thread = document.getElementById('ai-assistant-thread');
    if (!thread) return;

    const isUser = sender === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;

    let actionsHtml = '';
    if (actions && actions.length > 0) {
      actionsHtml = `
        <div class="mt-2 pt-1.5 border-t border-slate-700 flex flex-wrap gap-1.5">
          ${actions.map((a) => `
            <button type="button" onclick="AIAssistant.handleAction('${escapeHtml(a.action)}', '${escapeHtml(a.tab || '')}')"
              class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-cyan-300 font-bold text-[10.5px] rounded-lg border border-slate-600 cursor-pointer">
              ${escapeHtml(a.label)}
            </button>
          `).join('')}
        </div>`;
    }

    let footnoteHtml = '';
    if (!isUser && meta.providerUsed) {
      const modeLabel = meta.isFallback ? 'Chế độ Ngoại tuyến (Kho tri thức)' : 'Trợ lý AI Online';
      const reviewed = meta.reviewedAt ? ` • Kiểm duyệt: ${escapeHtml(meta.reviewedAt)}` : '';
      footnoteHtml = `
        <div class="mt-1 text-[9.5px] text-slate-400 flex flex-wrap items-center justify-between gap-1 border-t border-slate-700/60 pt-1">
          <span>Nguồn: ${escapeHtml(meta.providerUsed)}${reviewed}</span>
          <span class="${meta.isFallback ? 'text-amber-400' : 'text-emerald-400'} font-semibold">${modeLabel}</span>
        </div>`;
    }

    msgDiv.innerHTML = `
      <div class="max-w-[85%] rounded-2xl p-2.5 text-xs ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-xs shadow-sm font-medium'
          : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-xs shadow-xs font-normal'
      }">
        <div class="leading-relaxed whitespace-pre-wrap">${formatMarkdownSimple(text)}</div>
        ${actionsHtml}
        ${footnoteHtml}
      </div>`;

    thread.appendChild(msgDiv);
    thread.scrollTop = thread.scrollHeight;
  }

  async function callOnlineAI(msg, lat, lng) {
    const attemptOnce = async () => {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tId = controller ? setTimeout(() => controller.abort(), AI_TIMEOUT_MS) : null;
      try {
        const url = (typeof getApiUrl === 'function') ? getApiUrl('/api/ai/chat') : '/api/ai/chat';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller ? controller.signal : undefined,
          body: JSON.stringify({
            query: msg,
            lat: lat,
            lng: lng,
            include_live_context: true
          })
        });
        if (tId) clearTimeout(tId);
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        return await res.json();
      } catch (err) {
        if (tId) clearTimeout(tId);
        throw err;
      }
    };

    try {
      return await attemptOnce();
    } catch (firstErr) {
      // Controlled single retry only on transient network/5xx error (not 4xx or Abort)
      if (firstErr && firstErr.status && firstErr.status >= 400 && firstErr.status < 500) {
        throw firstErr;
      }
      if (firstErr && firstErr.name === 'AbortError') {
        throw firstErr;
      }
      return await attemptOnce();
    }
  }

  async function send(query = null) {
    const input = document.getElementById('ai-assistant-input');
    const msg = query || (input ? input.value.trim() : '');
    if (!msg) return null;

    if (input && !query) input.value = '';
    conversationHistory.push({ role: 'user', text: msg, at: new Date().toISOString() });
    if (conversationHistory.length > 20) conversationHistory.shift();

    appendMessage('user', msg);

    // Offline short-circuit: NEVER wait for API timeout or hit network when offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      renderStatusBadge({ status: 'offline_knowledge' });
      const offRes = (typeof OfflineKnowledgeEngine !== 'undefined')
        ? await OfflineKnowledgeEngine.answer(msg)
        : { reply: 'Đang ngoại tuyến và chưa có kho tri thức cục bộ. Gọi 112 / 114 khi khẩn cấp.', provider_used: 'Offline', is_fallback: true };
      conversationHistory.push({ role: 'assistant', text: offRes.reply, mode: 'offline_knowledge' });
      appendMessage('bot', offRes.reply, [], {
        providerUsed: offRes.provider_used || offRes.source,
        reviewedAt: offRes.reviewed_at,
        isFallback: true
      });
      return offRes;
    }

    const thread = document.getElementById('ai-assistant-thread');
    const loadingId = 'ai-loading-indicator';
    if (thread) {
      const loadingDiv = document.createElement('div');
      loadingDiv.id = loadingId;
      loadingDiv.className = 'flex justify-start';
      loadingDiv.innerHTML = `
        <div class="bg-slate-800 text-slate-300 rounded-2xl p-2 px-3 text-xs flex items-center gap-1.5 font-medium" role="status" aria-live="polite">
          <span>Đang tra cứu trợ lý AI...</span>
        </div>`;
      thread.appendChild(loadingDiv);
      thread.scrollTop = thread.scrollHeight;
    }

    let lat = null;
    let lng = null;
    try {
      if (window.CitizenPortal && window.CitizenPortal.state && window.CitizenPortal.state.selectedCoords) {
        lat = window.CitizenPortal.state.selectedCoords.lat;
        lng = window.CitizenPortal.state.selectedCoords.lng;
      }
    } catch (_) {}

    try {
      const data = await callOnlineAI(msg, lat, lng);
      const indicator = document.getElementById(loadingId);
      if (indicator) indicator.remove();

      const replyText = data && data.reply ? data.reply : 'Không nhận được nội dung phản hồi từ máy chủ AI.';
      conversationHistory.push({ role: 'assistant', text: replyText, mode: 'online' });
      appendMessage('bot', replyText, data.suggested_actions || [], {
        providerUsed: data.provider_used || 'NORTHSTAR AI',
        isFallback: Boolean(data.is_fallback)
      });
      return data;
    } catch (err) {
      const indicator = document.getElementById(loadingId);
      if (indicator) indicator.remove();

      const offRes = (typeof OfflineKnowledgeEngine !== 'undefined')
        ? await OfflineKnowledgeEngine.answer(msg)
        : {
          reply: '⚠️ Không thể kết nối tới máy chủ AI. Vui lòng gọi 112 / 114 nếu đang gặp tình huống khẩn cấp.',
          provider_used: 'Offline Fallback',
          is_fallback: true
        };
      const fallbackReply = `⚠️ Máy chủ AI tạm thời không phản hồi. Đang tra cứu từ kho tri thức cục bộ:\n\n${offRes.reply}`;
      conversationHistory.push({ role: 'assistant', text: fallbackReply, mode: 'offline_fallback' });
      appendMessage('bot', fallbackReply, [], {
        providerUsed: offRes.provider_used || offRes.source,
        reviewedAt: offRes.reviewed_at,
        isFallback: true
      });
      return { ...offRes, fallback_from_error: true };
    }
  }

  function handleAction(action, tab) {
    let targetTab = tab;
    if (action === 'open_sos' || tab === 'sos' || tab === 'rescue') {
      targetTab = 'rescue';
      if (typeof window.openSOSModal === 'function') window.openSOSModal();
    }
    if (window.CitizenPortalApp && typeof window.CitizenPortalApp.switchTab === 'function') {
      window.CitizenPortalApp.switchTab(targetTab || 'rescue');
    }
    const panel = document.getElementById('ai-assistant-panel');
    if (panel && window.innerWidth < 640 && isOpen) toggle();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) toggle();
    });
  }

  async function analyzeReport(content) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
    try {
      const res = await fetch(getApiUrl('/api/ai/analyze-report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  async function classifyEmergency(message, phone = null, locationText = null) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
    try {
      const res = await fetch(getApiUrl('/api/ai/classify-emergency'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contact_phone: phone, location_text: locationText })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  return {
    toggle,
    send,
    handleAction,
    analyzeReport,
    classifyEmergency,
    fetchStatus,
    getHistory: () => [...conversationHistory]
  };
})();

if (typeof window !== 'undefined') {
  window.AIAssistant = AIAssistant;
}
