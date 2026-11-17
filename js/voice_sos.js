/**
 * ===================================================================
 * NorthStar AI Voice Emergency SOS Module (Multimodal Rescue Assistant)
 * Cấp cứu bằng Giọng nói Đa phương thức:
 * 1. Thu âm qua MediaRecorder + SpeechRecognition thời gian thực
 * 2. Giải mã âm thanh siêu tốc qua Groq Whisper LPU (~0.3s)
 * 3. Bóc tách thực thể (Số người, Mức độ ngập, Nhu cầu) qua Groq LLM
 * 4. Tự động ghim Beacon SOS lên bản đồ tác chiến
 * 5. Phản hồi âm thanh tiếng Việt qua Web Speech Synthesis
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
  let countdownTimer = null;

  // Khởi tạo nhận diện giọng nói trình duyệt nếu có (Web Speech API)
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
        updateTranscriptDisplay(currentTranscript + interimTranscript);
      };

      speechRecognizer.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
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
    if (countdownTimer) clearInterval(countdownTimer);
    const modal = document.getElementById('voice-sos-modal');
    if (modal) modal.classList.add('hidden');
  }

  function resetState() {
    isRecording = false;
    currentTranscript = '';
    audioChunks = [];
    if (countdownTimer) clearInterval(countdownTimer);

    setUIState('idle');
  }

  function updateTranscriptDisplay(text) {
    const displayEl = document.getElementById('voice-sos-transcript');
    if (displayEl) {
      displayEl.innerHTML = text ? `"${text.trim()}"` : '<span class="text-slate-400 italic">Đang lắng nghe tiếng nói của bạn... Hãy nói to: Số người, địa chỉ và tình trạng ngập!</span>';
    }
  }

  function setUIState(state) {
    const micBtn = document.getElementById('voice-sos-mic-btn');
    const statusText = document.getElementById('voice-sos-status');
    const waveEl = document.getElementById('voice-sos-wave');
    const resultBox = document.getElementById('voice-sos-result');
    const actionsBox = document.getElementById('voice-sos-actions');

    if (!micBtn || !statusText) return;

    if (state === 'idle') {
      micBtn.className = 'w-24 h-24 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white flex flex-col items-center justify-center shadow-2xl transition transform hover:scale-105 active:scale-95 cursor-pointer border-4 border-white/80';
      statusText.innerHTML = '<span class="font-extrabold text-slate-800 dark:text-white">Bấm để Nói</span><span class="text-xs text-slate-500 block mt-0.5">Nhấn 1 lần để bắt đầu ghi âm</span>';
      if (waveEl) waveEl.classList.add('hidden');
      if (resultBox) resultBox.classList.add('hidden');
      if (actionsBox) actionsBox.classList.add('hidden');
      updateTranscriptDisplay('');
    } else if (state === 'recording') {
      micBtn.className = 'w-24 h-24 rounded-full bg-red-600 text-white flex flex-col items-center justify-center shadow-2xl animate-pulse cursor-pointer border-4 border-red-300 ring-8 ring-red-400/30';
      statusText.innerHTML = '<span class="font-black text-rose-600 animate-pulse">ĐANG GHI ÂM...</span><span class="text-xs text-slate-500 block mt-0.5">Bấm lại nút này khi nói xong</span>';
      if (waveEl) waveEl.classList.remove('hidden');
      if (resultBox) resultBox.classList.add('hidden');
    } else if (state === 'processing') {
      micBtn.className = 'w-24 h-24 rounded-full bg-slate-700 text-white flex flex-col items-center justify-center shadow-lg opacity-80 cursor-wait';
      statusText.innerHTML = '<span class="font-bold text-blue-600 dark:text-cyan-400 flex items-center gap-1.5 justify-center"><span class="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span> AI Groq Whisper đang bóc tách...</span><span class="text-xs text-slate-500 block mt-0.5">Chuyển âm thanh thành tọa độ & mệnh lệnh cứu hộ</span>';
      if (waveEl) waveEl.classList.add('hidden');
    } else if (state === 'success') {
      micBtn.className = 'w-20 h-20 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-4 border-emerald-200';
      statusText.innerHTML = '<span class="font-black text-emerald-600">ĐÃ TIẾP NHẬN TÍN HIỆU CỨU HỘ!</span>';
      if (waveEl) waveEl.classList.add('hidden');
      if (resultBox) resultBox.classList.remove('hidden');
      if (actionsBox) actionsBox.classList.remove('hidden');
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      stopRecording(true);
    } else {
      await startRecording();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      currentTranscript = '';
      recordingStartTime = Date.now();

      // Sử dụng MediaRecorder
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

      mediaRecorder.start(250); // Thu mỗi 250ms
      isRecording = true;

      // Khởi động nhận diện trình duyệt song song để hiển thị chữ chạy thời gian thực
      if (speechRecognizer) {
        try { speechRecognizer.start(); } catch (e) {}
      }

      setUIState('recording');
    } catch (err) {
      console.error('Không thể truy cập Microphone:', err);
      alert('Vui lòng cho phép trình duyệt truy cập Microphone để sử dụng tính năng kêu cứu bằng giọng nói!');
    }
  }

  function stopRecording(shouldProcess = true) {
    if (!isRecording) return;
    isRecording = false;

    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch (e) {}
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (!shouldProcess) {
      setUIState('idle');
      return;
    }

    setUIState('processing');

    // Chờ 300ms gom đủ chunks cuối cùng rồi gửi lên Backend
    setTimeout(() => {
      sendVoiceSOS();
    }, 400);
  }

  async function sendVoiceSOS() {
    const audioBlob = new Blob(audioChunks, { type: mediaRecorder ? mediaRecorder.mimeType : 'audio/webm' });

    // Lấy tọa độ GPS người dùng hoặc tâm bản đồ
    let userLat = 21.0285;
    let userLng = 105.8542;

    if (window.map) {
      const center = window.map.getCenter();
      userLat = center.lat;
      userLng = center.lng;
    }

    // Thử lấy Geolocation GPS thực tế của thiết bị
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          executeDispatch(audioBlob, userLat, userLng);
        },
        () => {
          executeDispatch(audioBlob, userLat, userLng);
        },
        { timeout: 3000, enableHighAccuracy: true }
      );
    } else {
      executeDispatch(audioBlob, userLat, userLng);
    }
  }

  async function executeDispatch(audioBlob, lat, lng) {
    try {
      let data = null;

      // 1. Ưu tiên gửi audio lên Groq Whisper LPU
      if (audioBlob && audioBlob.size > 500) {
        const url = getApiUrl(`/api/ai/voice-sos?lat=${lat}&lng=${lng}&auto_create_beacon=true&contact_name=${encodeURIComponent('Nạn nhân Voice SOS')}`);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
          body: audioBlob
        });

        if (res.ok) {
          data = await res.json();
        }
      }

      // 2. Nếu Whisper chưa có kết quả hoặc rớt mạng, fallback sang text nhận diện từ Web Speech API
      if (!data || data.status !== 'success' || !data.transcript) {
        if (currentTranscript && currentTranscript.trim().length > 3) {
          const textRes = await fetch(getApiUrl('/api/ai/voice-sos/text'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: currentTranscript.trim(),
              lat: lat,
              lng: lng,
              contact_name: 'Nạn nhân Voice SOS',
              contact_phone: '0999999999',
              auto_create_beacon: true
            })
          });
          if (textRes.ok) {
            data = await textRes.json();
          }
        }
      }

      if (data && data.status === 'success') {
        renderSuccessResult(data, lat, lng);
      } else {
        throw new Error(data ? data.message : 'Không nhận diện được giọng nói');
      }
    } catch (e) {
      console.error('Lỗi gửi Voice SOS:', e);
      setUIState('idle');
      const displayEl = document.getElementById('voice-sos-transcript');
      if (displayEl) {
        displayEl.innerHTML = `<span class="text-rose-600 font-bold">⚠️ Không nhận diện được âm thanh hoặc mất kết nối. Vui lòng nói to rõ hơn hoặc nhập số điện thoại gọi 114 trực tiếp!</span>`;
      }
    }
  }

  function renderSuccessResult(data, lat, lng) {
    setUIState('success');

    const transcriptEl = document.getElementById('voice-sos-transcript');
    if (transcriptEl) {
      transcriptEl.innerHTML = `<b>Lời kêu cứu nhận diện được:</b><br><span class="text-slate-900 dark:text-cyan-200 text-sm font-semibold">"${data.transcript}"</span>`;
    }

    const cls = data.classification || {};
    const prioColor = cls.urgency === 'critical' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300';

    const resultBox = document.getElementById('voice-sos-result');
    if (resultBox) {
      resultBox.innerHTML = `
        <div class="p-3 bg-rose-50/90 dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-slate-700 space-y-2 text-xs">
          <div class="flex items-center justify-between pb-1 border-b border-rose-200/60 dark:border-slate-700">
            <span class="font-extrabold uppercase text-[11px] text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <span>🚨 BÓC TÁCH CẤP CỨU AI</span>
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

          <div class="pt-1 border-t border-rose-200/60 dark:border-slate-700 flex items-center justify-between text-[10px] text-slate-500">
            <span>Đã ghim mốc GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
            <span class="font-semibold text-emerald-600 dark:text-emerald-400">✓ Đã chuyển tới 114</span>
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

    // Phản hồi giọng nói thông báo cho người dùng
    if (window.VoiceWarning && typeof window.VoiceWarning.speak === 'function') {
      window.VoiceWarning.speak("Hệ thống đã nhận diện lời kêu cứu của bạn và phát tín hiệu định vị khẩn cấp tới đội cứu nạn. Hãy giữ bình tĩnh, giữ ấm cơ thể và chờ xuồng cứu hộ tiếp cận!");
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
    stopRecording
  };
})();

window.VoiceSOSManager = VoiceSOSManager;
