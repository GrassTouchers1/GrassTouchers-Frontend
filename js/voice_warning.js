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
 * ========================================================
 * FloodNav - Voice Navigation & Audio Warning Module
 * Phụ trách chính: Thành viên 3 (Independent Frontend)
 * Công nghệ: W3C Web Speech Synthesis API (100% Client-side, Free, Offline)
 * ========================================================
 */

const VoiceWarning = (function () {
  const STORAGE_KEY = 'northstar_voice_muted';
  let isEnabled = (function () {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1';
    } catch (e) {
      return true;
    }
  })();
  let synth = window.speechSynthesis;
  let vietnameseVoice = null;

  function initVoices() {
    if (!synth) return;
    const voices = synth.getVoices();
    // Tìm giọng đọc tiếng Việt nếu có trên hệ điều hành / trình duyệt
    vietnameseVoice = voices.find(v => v.lang.toLowerCase().startsWith('vi')) || null;
  }

  if (window.speechSynthesis) {
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = initVoices;
    }
    initVoices();
  }

  function speak(text, force = false) {
    if ((!isEnabled && !force) || !synth) return;
    try {
      synth.cancel(); // Dừng câu đọc trước nếu đang đọc dở
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'vi-VN';
      utter.rate = 1.05; // Tốc độ vừa phải
      utter.pitch = 1.0;
      if (vietnameseVoice) utter.voice = vietnameseVoice;
      synth.speak(utter);
    } catch (e) {
      console.warn('Voice synthesis error:', e);
    }
  }

  function updateMuteButtonUI() {
    const btn = document.getElementById('btn-voice-toggle');
    const icon = document.getElementById('voice-toggle-icon');
    const label = document.getElementById('voice-toggle-label');
    if (btn) {
      if (isEnabled) {
        btn.className = 'flex p-1.5 2xl:px-2 2xl:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-xs items-center gap-1 transition cursor-pointer shrink-0';
        btn.title = 'Đang bật âm cảnh báo (Nhấn để tắt âm / Phím M)';
      } else {
        btn.className = 'flex p-1.5 2xl:px-2 2xl:py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/60 text-rose-300 font-bold text-xs items-center gap-1 transition cursor-pointer shrink-0';
        btn.title = 'Đã tắt âm cảnh báo (Nhấn để bật lại / Phím M)';
      }
    }
    if (icon) {
      icon.setAttribute('data-lucide', isEnabled ? 'volume-2' : 'volume-x');
      if (window.lucide) lucide.createIcons();
    }
    if (label) {
      label.textContent = isEnabled ? 'Âm thanh' : 'Đã tắt âm';
    }
    document.querySelectorAll('audio, video').forEach(el => {
      el.muted = !isEnabled;
    });
  }

  function setMuted(muted) {
    isEnabled = !muted;
    try {
      localStorage.setItem(STORAGE_KEY, isEnabled ? '0' : '1');
    } catch (e) {}

    if (!isEnabled && synth) {
      try { synth.cancel(); } catch (e) {}
    }

    updateMuteButtonUI();

    if (typeof window.showToast === 'function') {
      window.showToast(isEnabled ? '🔊 Đã bật âm thanh cảnh báo' : '🔇 Đã tắt âm thanh cảnh báo', isEnabled ? 'info' : 'warning');
    }
    if (isEnabled) {
      speak('Đã bật cảnh báo giọng nói tiếng Việt.', true);
    }
  }

  function toggleVoice() {
    setMuted(isEnabled);
  }

  window.addEventListener('DOMContentLoaded', updateMuteButtonUI);

  function speakRouteResult(data) {
    if (!data) return;
    const safe = data.safe;
    const fastest = data.fastest;

    if (!safe || !safe.found) {
      speak("Cảnh báo khẩn cấp: Không tìm thấy đường an toàn. Mọi ngả đường đều ngập sâu vượt ngưỡng xe của bạn.");
      return;
    }

    if (data.same_route) {
      speak(`Đã tìm thấy lộ trình an toàn nhất dài ${(safe.distance_m / 1000).toFixed(1)} ki lô mét, dự kiến di chuyển trong ${Math.round(safe.duration_min)} phút.`);
    } else {
      const warnCount = fastest && fastest.flood_warnings ? fastest.flood_warnings.length : 0;
      speak(`Đã phát hiện ${warnCount} điểm ngập trên đường ngắn nhất. Hệ thống đã tự động chuyển sang tuyến đường né ngập an toàn.`);
    }
  }

  // Tương thích ngược với các lệnh gọi speakRoutePlan(safe, same_route)
  function speakRoutePlan(safe, same_route) {
    speakRouteResult({ safe, same_route });
  }

  return {
    speak,
    toggleVoice,
    setMuted,
    isMuted: () => !isEnabled,
    speakRouteResult,
    speakRoutePlan,
    isEnabled: () => isEnabled
  };
})();

window.VoiceWarning = VoiceWarning;
