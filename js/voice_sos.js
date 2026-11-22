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
 * NorthStar AI Voice Emergency SOS Module (Multimodal Rescue Assistant)
 * Cấp cứu bằng Giọng nói Đa phương thức:
 * 1. Thu âm qua MediaRecorder + SpeechRecognition thời gian thực
 * 2. Hiển thị văn bản nhận diện được vào ô nhập liệu có thể chỉnh sửa
 * 3. Chuyển âm thanh sang văn bản qua Groq Whisper LPU (~0.3s)
 * 4. Tự động nhận diện địa danh từ lời nói và nắn chỉnh tọa độ chính xác
 * 5. Cho phép nạn nhân tự do chọn/chấm vị trí chính xác trên bản đồ
 * 6. Bóc tách thực thể khẩn cấp và ghim Beacon SOS chuẩn xác lên bản đồ tác chiến
 * 7. Phản hồi giọng nói tiếng Việt qua Web Speech Synthesis
 * 
 * Giấy phép: Apache-2.0 License (100% Mã nguồn mở)
 * ===================================================================
 */

const VoiceSOSManager = (function () {
  let mediaRecorder = null;
  let audioChunks = [];
  let speechRecognizer = null;
  let isRecording = false;
  let currentTranscript = '';
  let recordingStartTime = 0;

  // Tọa độ vị trí cứu hộ đã chọn
  let selectedLat = 21.0285;
  let selectedLng = 105.8542;
  let selectedLocLabel = 'Tâm bản đồ';
  let isMapPicking = false;
  let tempSOSMarker = null;

  // Bản đồ địa danh cứu nạn khẩn cấp tại Việt Nam
  const VIETNAM_GEO_LOOKUP = [
    { keys: ['thái nguyên', 'thai nguyen', 'hoàng văn thụ', 'quang vinh', 'chùa hang', 'gia bẩy', 'sông cầu'], lat: 21.5928, lng: 105.8442, name: 'TP. Thái Nguyên' },
    { keys: ['làng nủ', 'lang nu', 'bảo yên', 'bao yen', 'phố ràng'], lat: 22.3167, lng: 104.3833, name: 'Thôn Làng Nủ, Bảo Yên, Lào Cai' },
    { keys: ['lào cai', 'lao cai'], lat: 22.4856, lng: 103.9707, name: 'TP. Lào Cai' },
    { keys: ['yên bái', 'yen bai', 'hồng hà', 'sông thao'], lat: 21.7167, lng: 104.8833, name: 'TP. Yên Bái' },
    { keys: ['cầu giấy', 'cau giay', 'hoa bằng', 'yên hòa'], lat: 21.0370, lng: 105.7800, name: 'Quận Cầu Giấy, Hà Nội' },
    { keys: ['chương mỹ', 'chuong my', 'nam phương tiến', 'sông bùi'], lat: 20.8920, lng: 105.6580, name: 'Huyện Chương Mỹ, Hà Nội' },
    { keys: ['nam từ liêm'], lat: 21.0120, lng: 105.7650, name: 'Quận Nam Từ Liêm, Hà Nội' },
    { keys: ['ba đình', 'ba dinh'], lat: 21.0340, lng: 105.8250, name: 'Quận Ba Đình, Hà Nội' },
    { keys: ['đống đa', 'dong da'], lat: 21.0180, lng: 105.8280, name: 'Quận Đống Đa, Hà Nội' },
    { keys: ['hoàn kiếm', 'hoan kiem'], lat: 21.0285, lng: 105.8542, name: 'Quận Hoàn Kiếm, Hà Nội' },
    { keys: ['phong châu', 'phú thọ', 'tam nông'], lat: 21.3117, lng: 105.2890, name: 'Cầu Phong Châu, Phú Thọ' },
    { keys: ['tuyên quang'], lat: 21.8200, lng: 105.2200, name: 'TP. Tuyên Quang' },
    { keys: ['hạ long', 'quảng ninh'], lat: 20.9500, lng: 107.0800, name: 'TP. Hạ Long, Quảng Ninh' },
    { keys: ['cát hải', 'hải phòng'], lat: 20.8000, lng: 106.9100, name: 'Huyện Cát Hải, Hải Phòng' },
    { keys: ['hiệp hòa', 'bắc giang'], lat: 21.3200, lng: 106.0500, name: 'Huyện Hiệp Hòa, Bắc Giang' },
    { keys: ['nguyên bình', 'cao bằng'], lat: 22.6100, lng: 105.9700, name: 'Huyện Nguyên Bình, Cao Bằng' }
  ];

  // Khởi tạo nhận diện giọng nói Web Speech API (Client-side real-time stream)
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      speechRecognizer = new SpeechRecognition();
      speechRecognizer.lang = 'vi-VN';
      speechRecognizer.continuous = true;
      speechRecognizer.interimResults = true;

      speechRecognizer.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const fullText = (currentTranscript + interimTranscript).trim();
        updateTextInput(fullText);
        detectLocationFromText(fullText);
      };

      speechRecognizer.onerror = (event) => {
        console.warn('[VoiceSOS] SpeechRecognition event:', event.error);
      };
    }
  }

  function openModal() {
    const modal = document.getElementById('voice-sos-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    resetState();
    initLocation();
    if (window.lucide) lucide.createIcons();
  }

  function closeModal() {
    stopRecording(false);
    cancelMapPick();
    const modal = document.getElementById('voice-sos-modal');
    if (modal) modal.classList.add('hidden');
  }

  function resetState() {
    isRecording = false;
    currentTranscript = '';
    audioChunks = [];
    const inputEl = document.getElementById('voice-sos-text-input');
    if (inputEl) inputEl.value = '';
    onTextInputChange();
    setUIState('idle');
  }

  /**
   * Khởi tạo tọa độ cứu hộ ban đầu dựa theo vị trí người dùng trên bản đồ:
   * 1. Ưu tiên điểm bắt đầu người dùng đã ghim (coords.origin)
   * 2. Nếu không có, lấy tâm bản đồ đang xem
   */
  function initLocation() {
    let lat = null;
    let lng = null;
    let label = 'Tâm bản đồ';

    if (window.coords && window.coords.origin) {
      const o = window.coords.origin;
      const oLat = o.lat !== undefined ? o.lat : (Array.isArray(o) ? o[0] : null);
      const oLng = o.lng !== undefined ? o.lng : (Array.isArray(o) ? o[1] : null);
      if (oLat && oLng) {
        lat = parseFloat(oLat);
        lng = parseFloat(oLng);
        label = 'Điểm đã ghim';
      }
    }

    if ((!lat || !lng) && window.map) {
      const c = window.map.getCenter();
      lat = c.lat;
      lng = c.lng;
      label = 'Tâm bản đồ';
    }

    if (!lat || !lng) {
      lat = 21.0285;
      lng = 105.8542;
      label = 'Mặc định';
    }

    selectedLat = lat;
    selectedLng = lng;
    selectedLocLabel = label;
    updateLocationDisplay();
  }

  function updateLocationDisplay() {
    const input = document.getElementById('voice-sos-location-display');
    const tag = document.getElementById('voice-sos-loc-tag');
    if (input) {
      input.value = `${selectedLat.toFixed(4)}, ${selectedLng.toFixed(4)} (${selectedLocLabel})`;
    }
    if (tag) {
      tag.innerText = selectedLocLabel;
    }
  }

  /**
   * Bóc tách địa danh cứu nạn trực tiếp từ văn bản lời nói:
   * Ví dụ: "Tôi ở số 15 Hoàng Văn Thụ Thái Nguyên..." -> Nhận diện Thái Nguyên
   */
  function detectLocationFromText(text) {
    if (!text) return;
    const lower = text.toLowerCase();
    for (const item of VIETNAM_GEO_LOOKUP) {
      if (item.keys.some(k => lower.includes(k))) {
        selectedLat = item.lat;
        selectedLng = item.lng;
        selectedLocLabel = item.name;
        updateLocationDisplay();
        const tag = document.getElementById('voice-sos-loc-tag');
        if (tag) {
          tag.innerText = `✓ Nhận diện: ${item.name}`;
          tag.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 font-bold border border-emerald-300 animate-pulse';
        }
        break;
      }
    }
  }

  /**
   * Cho phép nạn nhân trực tiếp bấm chấm vị trí trên bản đồ MapLibre GL JS
   */
  function pickLocationOnMap() {
    const modal = document.getElementById('voice-sos-modal');
    const banner = document.getElementById('voice-sos-map-picker-banner');
    if (!window.map) {
      alert('Bản đồ chưa sẵn sàng.');
      return;
    }

    isMapPicking = true;
    if (modal) modal.classList.add('hidden');
    if (banner) banner.classList.remove('hidden');

    const container = window.map.getCanvas ? window.map.getCanvas() : window.map.getContainer();
    if (container) container.style.cursor = 'crosshair';

    // Đăng ký sự kiện nhấp chuột 1 lần trên MapLibre map
    window.map.once('click', handleMapClickPick);
  }

  function handleMapClickPick(e) {
    if (!isMapPicking) return;
    const lat = e.lngLat ? e.lngLat.lat : (e.latlng ? e.latlng.lat : e.lat);
    const lng = e.lngLat ? e.lngLat.lng : (e.latlng ? e.latlng.lng : e.lng);
    selectedLat = lat;
    selectedLng = lng;
    selectedLocLabel = 'Điểm chấm trên bản đồ';

    // Ghim marker tạm thời bằng MapLibre Marker
    if (tempSOSMarker && typeof tempSOSMarker.remove === 'function') {
      tempSOSMarker.remove();
      tempSOSMarker = null;
    }

    const mapInst = window.map._maplibre || window.map;
    if (window.maplibregl && mapInst) {
      const el = document.createElement('div');
      el.className = 'w-7 h-7 rounded-full bg-rose-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black animate-pulse';
      el.innerText = '📍';
      tempSOSMarker = new window.maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(mapInst);
    }

    finishMapPick();
  }

  function finishMapPick() {
    isMapPicking = false;
    if (window.map) {
      window.map.getContainer().style.cursor = '';
    }
    const banner = document.getElementById('voice-sos-map-picker-banner');
    const modal = document.getElementById('voice-sos-modal');
    if (banner) banner.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
    updateLocationDisplay();
  }

  function cancelMapPick() {
    if (!isMapPicking) return;
    isMapPicking = false;
    if (window.map) {
      window.map.getContainer().style.cursor = '';
      window.map.off('click', handleMapClickPick);
    }
    const banner = document.getElementById('voice-sos-map-picker-banner');
    const modal = document.getElementById('voice-sos-modal');
    if (banner) banner.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
  }

  function setLocationPreset(presetKey) {
    if (presetKey === 'map_center' && window.map) {
      const c = window.map.getCenter();
      selectedLat = c.lat;
      selectedLng = c.lng;
      selectedLocLabel = 'Tâm bản đồ';
    } else if (presetKey === 'thai_nguyen') {
      selectedLat = 21.5928;
      selectedLng = 105.8442;
      selectedLocLabel = 'TP. Thái Nguyên';
    } else if (presetKey === 'lang_nu') {
      selectedLat = 22.3167;
      selectedLng = 104.3833;
      selectedLocLabel = 'Thôn Làng Nủ, Lào Cai';
    } else if (presetKey === 'cau_giay') {
      selectedLat = 21.0370;
      selectedLng = 105.7800;
      selectedLocLabel = 'Quận Cầu Giấy, Hà Nội';
    } else if (presetKey === 'device_gps') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            selectedLat = pos.coords.latitude;
            selectedLng = pos.coords.longitude;
            selectedLocLabel = 'GPS Thiết bị';
            updateLocationDisplay();
          },
          (err) => {
            alert('Không thể lấy GPS từ thiết bị. Đang sử dụng tọa độ bản đồ.');
          },
          { timeout: 4000, enableHighAccuracy: true }
        );
      }
    }
    updateLocationDisplay();
  }

  function updateTextInput(text) {
    const inputEl = document.getElementById('voice-sos-text-input');
    if (inputEl && text) {
      inputEl.value = text;
      onTextInputChange();
    }
  }

  function onTextInputChange() {
    const inputEl = document.getElementById('voice-sos-text-input');
    const charCountEl = document.getElementById('voice-sos-char-count');
    const clearBtn = document.getElementById('voice-sos-clear-btn');
    if (!inputEl) return;

    const len = inputEl.value.trim().length;
    if (charCountEl) {
      charCountEl.innerText = `${len} ký tự`;
    }
    if (clearBtn) {
      if (len > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    // Nhận diện địa danh ngay khi người dùng gõ
    detectLocationFromText(inputEl.value);
  }

  function clearText() {
    const inputEl = document.getElementById('voice-sos-text-input');
    if (inputEl) {
      inputEl.value = '';
      currentTranscript = '';
      onTextInputChange();
      inputEl.focus();
    }
  }

  function appendQuickTag(tagText) {
    const inputEl = document.getElementById('voice-sos-text-input');
    if (!inputEl) return;
    const currentVal = inputEl.value.trim();
    if (currentVal.length > 0) {
      inputEl.value = `${currentVal}, ${tagText}`;
    } else {
      inputEl.value = tagText;
    }
    onTextInputChange();
    inputEl.focus();
  }

  function setUIState(state) {
    const micBtn = document.getElementById('voice-sos-mic-btn');
    const statusText = document.getElementById('voice-sos-status');
    const waveEl = document.getElementById('voice-sos-wave');
    const resultBox = document.getElementById('voice-sos-result');
    const submitBtn = document.getElementById('voice-sos-submit-btn');

    if (!micBtn || !statusText) return;

    if (state === 'idle') {
      micBtn.className = 'w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white flex flex-col items-center justify-center shadow-2xl transition transform hover:scale-105 active:scale-95 cursor-pointer border-4 border-white/80';
      statusText.innerHTML = '<span class="font-extrabold text-slate-800 dark:text-white text-sm">Bấm Micro để Nói hoặc Gõ trực tiếp</span><span class="text-xs text-slate-500 block">Nói: Số người mắc kẹt, địa chỉ, tình trạng ngập lụt</span>';
      if (waveEl) waveEl.classList.add('hidden');
      if (resultBox) resultBox.classList.add('hidden');
      if (submitBtn) {
        submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4 text-white"></i><span>XÁC NHẬN & GỬI CỨU HỘ NGAY</span>';
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60', 'cursor-wait');
      }
    } else if (state === 'recording') {
      micBtn.className = 'w-20 h-20 rounded-full bg-red-600 text-white flex flex-col items-center justify-center shadow-2xl animate-pulse cursor-pointer border-4 border-red-300 ring-8 ring-red-400/30';
      statusText.innerHTML = '<span class="font-black text-rose-600 animate-pulse">🔴 ĐANG LẮNG NGHE...</span><span class="text-xs text-slate-500 block mt-0.5">Bấm lại nút Micro khi nói xong</span>';
      if (waveEl) waveEl.classList.remove('hidden');
      if (resultBox) resultBox.classList.add('hidden');
    } else if (state === 'transcribing') {
      micBtn.className = 'w-20 h-20 rounded-full bg-indigo-600 text-white flex flex-col items-center justify-center shadow-lg opacity-90 cursor-wait';
      statusText.innerHTML = '<span class="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 justify-center"><span class="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span> Đang nhận diện qua Groq Whisper...</span><span class="text-xs text-slate-500 block mt-0.5">Đang nạp văn bản & định vị địa danh</span>';
      if (waveEl) waveEl.classList.add('hidden');
    } else if (state === 'review') {
      micBtn.className = 'w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex flex-col items-center justify-center shadow-md cursor-pointer transition';
      statusText.innerHTML = '<span class="font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1"><span>✏️</span> Vui lòng kiểm tra lại nội dung & vị trí</span><span class="text-xs text-slate-500 block mt-0.5">Kiểm tra tọa độ bên dưới rồi bấm <b>Gửi Cứu Hộ</b></span>';
      if (waveEl) waveEl.classList.add('hidden');
      if (resultBox) resultBox.classList.add('hidden');
      if (submitBtn) {
        submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4 text-white"></i><span>XÁC NHẬN & GỬI CỨU HỘ NGAY</span>';
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60', 'cursor-wait');
      }
    } else if (state === 'dispatching') {
      if (submitBtn) {
        submitBtn.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span><span>AI Đang điều phối & cắm mốc cứu hộ...</span>';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-60', 'cursor-wait');
      }
      statusText.innerHTML = '<span class="font-bold text-blue-600 dark:text-cyan-400 flex items-center justify-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span> Đang truyền tin cứu hộ tới Ban Chỉ huy...</span>';
    } else if (state === 'success') {
      micBtn.className = 'w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-4 border-emerald-200';
      statusText.innerHTML = '<span class="font-black text-emerald-600">✓ ĐÃ TIẾP NHẬN TÍN HIỆU CỨU HỘ!</span>';
      if (waveEl) waveEl.classList.add('hidden');
      if (resultBox) resultBox.classList.remove('hidden');
      if (submitBtn) {
        submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-white"></i><span>TÍN HIỆU ĐÃ PHÁT THÀNH CÔNG</span>';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-80');
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  async function toggleRecording() {
    if (isRecording) {
      await stopRecording(true);
    } else {
      await startRecording();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      recordingStartTime = Date.now();

      const options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/mp4';
      }

      mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250);
      isRecording = true;

      if (speechRecognizer) {
        try { speechRecognizer.start(); } catch (e) {}
      }

      setUIState('recording');
    } catch (err) {
      console.error('[VoiceSOS] Lỗi mở microphone:', err);
      alert('Không thể mở Microphone. Vui lòng cho phép quyền truy cập hoặc bạn có thể tự tay gõ lời kêu cứu vào ô bên dưới!');
    }
  }

  async function stopRecording(shouldTranscribe = true) {
    if (!isRecording) return;
    isRecording = false;

    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch (e) {}
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (!shouldTranscribe) {
      setUIState('idle');
      return;
    }

    setUIState('transcribing');

    setTimeout(async () => {
      await fetchAudioTranscription();
      setUIState('review');

      const inputEl = document.getElementById('voice-sos-text-input');
      if (inputEl) {
        inputEl.focus();
        detectLocationFromText(inputEl.value);
      }
    }, 350);
  }

  async function fetchAudioTranscription() {
    const audioBlob = new Blob(audioChunks, { type: mediaRecorder ? mediaRecorder.mimeType : 'audio/webm' });
    if (!audioBlob || audioBlob.size < 500) {
      return;
    }

    try {
      const url = getApiUrl('/api/ai/voice-sos/transcribe');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
        body: audioBlob
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.transcript && data.transcript.trim().length > 0) {
          currentTranscript = data.transcript.trim();
          updateTextInput(currentTranscript);
          detectLocationFromText(currentTranscript);
        }
      }
    } catch (err) {
      console.warn('[VoiceSOS] Whisper cloud transcription warning:', err);
    }
  }

  function retryRecording() {
    clearText();
    startRecording();
  }

  /**
   * Phát tín hiệu cứu hộ SOS chính xác tuyệt đối theo vị trí đã xác nhận
   */
  async function confirmAndSend() {
    const inputEl = document.getElementById('voice-sos-text-input');
    const textToSend = inputEl ? inputEl.value.trim() : '';

    if (!textToSend || textToSend.length < 3) {
      alert('Vui lòng nói hoặc gõ thông tin kêu cứu (Ví dụ: Nhà ngập sâu, có 3 người mắc kẹt tại số 12 đường...) trước khi bấm gửi!');
      if (inputEl) inputEl.focus();
      return;
    }

    // Kiểm tra và bảo đảm tọa độ hợp lệ
    if (!selectedLat || !selectedLng || isNaN(selectedLat) || isNaN(selectedLng)) {
      initLocation();
    }

    setUIState('dispatching');
    dispatchValidatedSOS(textToSend, selectedLat, selectedLng);
  }

  async function dispatchValidatedSOS(text, lat, lng) {
    const phoneInput = document.getElementById('voice-sos-phone');
    const nameInput = document.getElementById('voice-sos-contact-name');
    const contactPhone = phoneInput && phoneInput.value.trim() ? phoneInput.value.trim() : '0999999999';
    const contactName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Nạn nhân Voice SOS';

    try {
      const res = await fetch(getApiUrl('/api/ai/voice-sos/text'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          lat: lat,
          lng: lng,
          contact_name: contactName,
          contact_phone: contactPhone,
          auto_create_beacon: true
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      if (data && data.status === 'success') {
        const finalLat = data.resolved_lat || lat;
        const finalLng = data.resolved_lng || lng;
        renderSuccessResult(data, finalLat, finalLng);
      } else {
        throw new Error(data ? data.message : 'Lỗi phân tích cứu nạn');
      }
    } catch (err) {
      console.error('[VoiceSOS] Lỗi gửi cứu hộ:', err);
      alert('Không thể kết nối đến máy chủ điều phối cứu hộ. Vui lòng kiểm tra lại kết nối mạng hoặc gọi trực tiếp 114!');
      setUIState('review');
    }
  }

  function renderSuccessResult(data, lat, lng) {
    setUIState('success');

    // Xóa marker tạm nếu có
    if (tempSOSMarker && window.map) {
      window.map.removeLayer(tempSOSMarker);
      tempSOSMarker = null;
    }

    const cls = data.classification || {};
    const prioColor = cls.urgency === 'critical' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200' : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200';
    const locTag = data.location_label ? `<span class="text-rose-600 font-bold">(${data.location_label})</span>` : '';

    const resultBox = document.getElementById('voice-sos-result');
    if (resultBox) {
      resultBox.innerHTML = `
        <div class="p-3.5 bg-rose-50/95 dark:bg-slate-800 rounded-2xl border border-rose-200 dark:border-slate-700 space-y-2 text-xs shadow-md">
          <div class="flex items-center justify-between pb-1.5 border-b border-rose-200/60 dark:border-slate-700">
            <span class="font-extrabold uppercase text-[11px] text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <span>🚨 KẾT QUẢ ĐIỀU PHỐI CỨU NẠN AI</span>
            </span>
            <span class="px-2 py-0.5 rounded font-black text-[10px] border uppercase ${prioColor}">
              ${cls.urgency ? cls.urgency.toUpperCase() : 'NGUY CẤP'}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-200">
            <div><b>Nạn nhân mắc kẹt:</b> <span class="font-bold text-rose-600">${cls.people_affected || 1} người</span></div>
            <div><b>Đối tượng:</b> <span>${(cls.vulnerable_groups && cls.vulnerable_groups.length) ? cls.vulnerable_groups.join(', ') : 'Người dân'}</span></div>
            <div class="col-span-2"><b>Nhu cầu cấp thiết:</b> <span class="font-semibold text-blue-700 dark:text-cyan-300">${(cls.needs && cls.needs.length) ? cls.needs.join('; ') : 'Cứu trợ khẩn cấp'}</span></div>
          </div>

          <div class="pt-1.5 border-t border-rose-200/60 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
            <b>Mệnh lệnh tác chiến:</b> <i>${cls.recommended_action || 'Điều phối xuồng máy tiếp cận giải cứu ngay lập tức.'}</i>
          </div>

          <div class="pt-1.5 border-t border-rose-200/60 dark:border-slate-700 flex items-center justify-between text-[10.5px] text-slate-500">
            <span>Tọa độ đã ghim: <b>${lat.toFixed(4)}, ${lng.toFixed(4)}</b> ${locTag}</span>
            <span class="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span>✓ Đã truyền tin tới 114</span>
            </span>
          </div>
        </div>
      `;
    }

    // Tự động reload danh sách SOS trên bản đồ để hiện cờ đỏ tức thời
    if (window.NorthStarRescue && typeof window.NorthStarRescue.loadSOSBeacons === 'function') {
      window.NorthStarRescue.loadSOSBeacons();
    }

    // Tự động bay camera tới điểm SOS vừa tạo với zoom rõ ràng
    if (window.map) {
      window.map.flyTo([lat, lng], 16, { duration: 1.5 });
    }

    // Phản hồi âm thanh giọng nói tiếng Việt
    if (window.VoiceWarning && typeof window.VoiceWarning.speak === 'function') {
      window.VoiceWarning.speak("Hệ thống đã nhận diện lời kêu cứu của bạn và phát tín hiệu định vị khẩn cấp tới đội cứu nạn. Hãy giữ bình tĩnh, di chuyển lên vị trí cao và chờ xuồng cứu hộ tiếp cận!");
    }
  }

  // Khởi tạo khi nạp script
  window.addEventListener('DOMContentLoaded', () => {
    initSpeechRecognition();
  });

  return {
    openModal,
    closeModal,
    toggleRecording,
    startRecording,
    stopRecording,
    retryRecording,
    clearText,
    appendQuickTag,
    onTextInputChange,
    initLocation,
    updateLocationDisplay,
    detectLocationFromText,
    pickLocationOnMap,
    cancelMapPick,
    setLocationPreset,
    confirmAndSend
  };
})();

window.VoiceSOSManager = VoiceSOSManager;
