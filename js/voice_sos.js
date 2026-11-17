/**
 * ===================================================================
 * NorthStar AI Voice Emergency SOS Module (Multimodal Rescue Assistant)
 * Cấp cứu bằng Giọng nói Đa phương thức:
 * 1. Thu âm qua MediaRecorder + SpeechRecognition thời gian thực
 * 2. Hiển thị văn bản nhận diện được vào ô nhập liệu có thể chỉnh sửa
 * 3. Chuyển âm thanh sang văn bản qua Groq Whisper LPU (~0.3s)
 * 4. Người dùng có quyền xem, sửa từ ngữ, số người, địa chỉ trước khi gửi
 * 5. Bóc tách thực thể khẩn cấp và tự động ghim Beacon SOS lên bản đồ tác chiến
 * 6. Phản hồi giọng nói trấn an nạn nhân qua Web Speech Synthesis
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
    if (window.lucide) lucide.createIcons();
  }

  function closeModal() {
    stopRecording(false);
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
      statusText.innerHTML = '<span class="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 justify-center"><span class="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span> Đang nhận diện qua Groq Whisper...</span><span class="text-xs text-slate-500 block mt-0.5">Đang nạp văn bản vào ô chỉnh sửa</span>';
      if (waveEl) waveEl.classList.add('hidden');
    } else if (state === 'review') {
      micBtn.className = 'w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex flex-col items-center justify-center shadow-md cursor-pointer transition';
      statusText.innerHTML = '<span class="font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1"><span>✏️</span> Vui lòng kiểm tra lại nội dung</span><span class="text-xs text-slate-500 block mt-0.5">Bạn có thể sửa chữ bên dưới rồi bấm <b>Gửi Cứu Hộ</b></span>';
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
      statusText.innerHTML = '<span class="font-bold text-blue-600 dark:text-cyan-400 flex items-center justify-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span> Đang gửi lệnh cứu hộ tới Ban Chỉ huy...</span>';
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

      // Sử dụng WebM hoặc MP4 container tùy hỗ trợ của trình duyệt
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

      // Khởi động nhận diện giọng nói trình duyệt Web Speech song song
      if (speechRecognizer) {
        try { speechRecognizer.start(); } catch (e) {}
      }

      setUIState('recording');
    } catch (err) {
      console.error('[VoiceSOS] Lỗi mở microphone:', err);
      alert('Không thể mở Microphone. Vui lòng kiểm tra quyền truy cập của trình duyệt hoặc bạn có thể tự tay gõ lời kêu cứu vào ô bên dưới!');
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

    // Chờ 300ms gom đủ chunk âm thanh cuối cùng
    setTimeout(async () => {
      await fetchAudioTranscription();
      setUIState('review');

      // Tự động focus vào ô văn bản để người dùng nhận biết rõ ràng họ có thể sửa
      const inputEl = document.getElementById('voice-sos-text-input');
      if (inputEl) {
        inputEl.focus();
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
        }
      }
    } catch (err) {
      console.warn('[VoiceSOS] Whisper cloud transcription warning:', err);
      // Giữ nguyên transcript từ Web Speech API nếu Whisper không phản hồi
    }
  }

  function retryRecording() {
    clearText();
    startRecording();
  }

  /**
   * Bước quan trọng: Người dùng đã xem xét nội dung (đã sửa hoặc đồng ý)
   * và bấm nút "XÁC NHẬN & GỬI CỨU HỘ NGAY".
   */
  async function confirmAndSend() {
    const inputEl = document.getElementById('voice-sos-text-input');
    const textToSend = inputEl ? inputEl.value.trim() : '';

    if (!textToSend || textToSend.length < 3) {
      alert('Vui lòng nói hoặc gõ thông tin kêu cứu (Ví dụ: Nhà ngập sâu, có 3 người mắc kẹt tại số 12 đường...) trước khi bấm gửi!');
      if (inputEl) inputEl.focus();
      return;
    }

    setUIState('dispatching');

    // Lấy tọa độ GPS thiết bị hoặc tâm bản đồ
    let userLat = 21.0285;
    let userLng = 105.8542;

    if (window.map) {
      const center = window.map.getCenter();
      userLat = center.lat;
      userLng = center.lng;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          dispatchValidatedSOS(textToSend, userLat, userLng);
        },
        () => {
          dispatchValidatedSOS(textToSend, userLat, userLng);
        },
        { timeout: 3000, enableHighAccuracy: true }
      );
    } else {
      dispatchValidatedSOS(textToSend, userLat, userLng);
    }
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
        renderSuccessResult(data, lat, lng);
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

    const cls = data.classification || {};
    const prioColor = cls.urgency === 'critical' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200' : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200';

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
            <span>Đã ghim mốc GPS: <b>${lat.toFixed(4)}, ${lng.toFixed(4)}</b></span>
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

    // Tự động bay camera tới điểm SOS vừa tạo
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
    confirmAndSend
  };
})();

window.VoiceSOSManager = VoiceSOSManager;
