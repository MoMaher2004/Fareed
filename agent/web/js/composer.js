(function () {
  const elements = {};
  let sendState = 'enabled';

  const voice = {
    mediaStream: null,
    mediaRecorder: null,
    audioContext: null,
    analyser: null,
    animationId: null,
    chunks: [],
    audioBlob: null,
    heights: []
  };

  function init() {
    elements.normal = document.getElementById('composer-normal');
    elements.recording = document.getElementById('composer-recording');
    elements.input = document.getElementById('composer-input');
    elements.sendBtn = document.getElementById('send-btn');
    elements.attachWrapper = document.getElementById('attach-wrapper');
    elements.voiceBtn = document.getElementById('voice-btn');
    elements.systemToggle = document.getElementById('system-message-toggle');
    elements.recCancel = document.getElementById('rec-cancel');
    elements.recConfirm = document.getElementById('rec-confirm');
    elements.recRetry = document.getElementById('rec-retry');
    elements.recError = document.getElementById('rec-error');
    elements.waveform = document.getElementById('waveform');

    if (!window.APP_CONFIG.features.attachments && elements.attachWrapper) {
      elements.attachWrapper.remove();
      elements.attachWrapper = null;
    } else if (elements.attachWrapper) {
      elements.attachWrapper.querySelectorAll('[data-attach]').forEach((item) => {
        item.addEventListener('click', () => {
          const type = item.getAttribute('data-attach') || 'file';
          window.Communication.sendAttachment({ type })
            .then((result) => {
              if (result && result.message) window.DomUtils.toast(result.message, 'info');
              else window.DomUtils.toast('Attachment action placeholder.', 'info');
            })
            .catch(() => window.DomUtils.toast('Attachment action failed.', 'danger'));
        });
      });
    }

    if (!window.APP_CONFIG.features.voiceInput && elements.voiceBtn) {
      elements.voiceBtn.remove();
      elements.voiceBtn = null;
    } else if (elements.voiceBtn) {
      elements.voiceBtn.addEventListener('click', startRecording);
      elements.recCancel.addEventListener('click', cancelRecording);
      elements.recConfirm.addEventListener('click', confirmRecording);
      elements.recRetry.addEventListener('click', retryTranscription);
    }

    if (!window.APP_CONFIG.features.systemToggle && elements.systemToggle) {
      elements.systemToggle.remove();
      elements.systemToggle = null;
    }

    if (elements.systemToggle) {
      elements.systemToggle.addEventListener('click', () => {
        window.AppState.systemMessage = !window.AppState.systemMessage;
        elements.systemToggle.classList.toggle('active', window.AppState.systemMessage);
        elements.systemToggle.setAttribute('aria-pressed', String(window.AppState.systemMessage));
      });
    }

    elements.input.addEventListener('input', () => {
      autoresize();
      updateSendButton();
    });

    elements.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });

    elements.sendBtn.addEventListener('click', submit);
    updateSendButton();
  }

  function autoresize() {
    if (!elements.input) return;
    elements.input.style.height = 'auto';
    elements.input.style.height = `${Math.min(elements.input.scrollHeight, 200)}px`;
  }

  function canSend() {
    return Boolean(
      elements.input &&
      elements.input.value.trim() &&
      sendState === 'enabled'
    );
  }

  function updateSendButton() {
    if (!elements.sendBtn) return;
    elements.sendBtn.disabled = !canSend();
    elements.sendBtn.classList.toggle('processing', sendState === 'processing' || sendState === 'loading');
  }

  function setSendState(state) {
    sendState = state;
    window.AppState.sendState = state;
    window.AppState.sendEnabled = state === 'enabled';
    updateSendButton();
  }

  function clearInput() {
    if (!elements.input) return;
    elements.input.value = '';
    autoresize();
    updateSendButton();
  }

  function submit() {
    if (!canSend()) return;
    const text = elements.input.value;
    clearInput();
    window.Chat.sendMessage(text);
  }

  function setRecordingMode(mode) {
    window.AppState.recording = mode;

    if (mode === 'idle') {
      elements.normal.classList.remove('d-none');
      elements.recording.classList.add('d-none');
      elements.recError.classList.add('d-none');
      window.DomUtils.setButtonIdle(elements.recConfirm, 'bi-check-lg');
      elements.recConfirm.disabled = false;
      elements.recCancel.disabled = false;
      if (elements.input) elements.input.disabled = false;
      return;
    }

    elements.normal.classList.add('d-none');
    elements.recording.classList.remove('d-none');

    if (mode === 'recording') {
      elements.recError.classList.add('d-none');
      window.DomUtils.setButtonIdle(elements.recConfirm, 'bi-check-lg');
      elements.recConfirm.disabled = false;
      elements.recCancel.disabled = false;
      if (elements.input) elements.input.disabled = true;
    }

    if (mode === 'processing') {
      elements.recError.classList.add('d-none');
      window.DomUtils.setButtonLoading(elements.recConfirm, 'bi-check-lg');
      elements.recConfirm.disabled = true;
      elements.recCancel.disabled = true;
      if (elements.input) elements.input.disabled = true;
    }

    if (mode === 'error') {
      elements.recError.classList.remove('d-none');
      window.DomUtils.setButtonIdle(elements.recConfirm, 'bi-check-lg');
      elements.recConfirm.disabled = true;
      elements.recCancel.disabled = false;
      if (elements.input) elements.input.disabled = true;
    }
  }

  async function startRecording() {
    try {
      voice.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voice.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      const source = voice.audioContext.createMediaStreamSource(voice.mediaStream);
      voice.analyser = voice.audioContext.createAnalyser();
      voice.analyser.fftSize = 256;
      source.connect(voice.analyser);

      voice.chunks = [];
      voice.audioBlob = null;
      voice.heights = [];

      voice.mediaRecorder = new MediaRecorder(voice.mediaStream);
      voice.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size) voice.chunks.push(event.data);
      };
      voice.mediaRecorder.start();

      setRecordingMode('recording');
      drawWaveform();
    } catch (error) {
      console.error('Microphone unavailable', error);
      window.DomUtils.toast('Microphone unavailable.', 'danger');
      setRecordingMode('idle');
    }
  }

  function drawWaveform() {
    const canvas = elements.waveform;
    if (!canvas || !voice.analyser) return;

    const ctx = canvas.getContext('2d');
    const data = new Uint8Array(voice.analyser.frequencyBinCount);

    function frame() {
      if (!voice.analyser) return;

      voice.analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
      }

      const rms = Math.sqrt(sum / data.length);
      const barHeight = Math.max(2, Math.min(canvas.height - 8, rms * canvas.height * 2.2));

      voice.heights.push(barHeight);
      const barWidth = 6;
      const maxBars = Math.floor(canvas.width / barWidth);
      if (voice.heights.length > maxBars) {
        voice.heights = voice.heights.slice(voice.heights.length - maxBars);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#6c8cff';
      ctx.fillStyle = accent;

      voice.heights.forEach((height, index) => {
        const x = index * barWidth;
        const y = (canvas.height - height) / 2;
        ctx.fillRect(x, y, 4, height);
      });

      voice.animationId = requestAnimationFrame(frame);
    }

    frame();
  }

  function stopAudioPipeline() {
    if (voice.animationId) {
      cancelAnimationFrame(voice.animationId);
      voice.animationId = null;
    }

    voice.analyser = null;

    if (voice.audioContext) {
      voice.audioContext.close().catch(() => {});
      voice.audioContext = null;
    }

    voice.heights = [];
  }

  function stopTracks() {
    if (voice.mediaStream) {
      voice.mediaStream.getTracks().forEach((track) => track.stop());
      voice.mediaStream = null;
    }

    if (voice.mediaRecorder && voice.mediaRecorder.state !== 'inactive') {
      try {
        voice.mediaRecorder.stop();
      } catch (error) {
        // Already stopped.
      }
    }

    voice.mediaRecorder = null;
  }

  function stopRecordingToBlob() {
    return new Promise((resolve) => {
      if (!voice.mediaRecorder) {
        resolve(null);
        return;
      }

      voice.mediaRecorder.onstop = () => {
        const blob = new Blob(voice.chunks, { type: voice.mediaRecorder.mimeType || 'audio/webm' });
        resolve(blob);
      };

      try {
        voice.mediaRecorder.stop();
      } catch (error) {
        resolve(null);
      }
    });
  }

  async function confirmRecording() {
    if (!voice.mediaRecorder) return;

    setRecordingMode('processing');
    const blob = await stopRecordingToBlob();
    stopAudioPipeline();
    stopTracks();

    await sendTranscription(blob);
  }

  async function sendTranscription(blob) {
    if (!blob || !blob.size) {
      setRecordingMode('error');
      return;
    }

    voice.audioBlob = blob;
    setRecordingMode('processing');

    try {
      const result = await window.Communication.requestTranscription(blob);
      if (!result || !result.text) throw new Error('Empty transcription');

      elements.input.value = result.text;
      autoresize();
      updateSendButton();
      voice.audioBlob = null;
      setRecordingMode('idle');
      window.DomUtils.toast('Transcription inserted into composer.', 'success');
      elements.input.focus();
    } catch (error) {
      console.error('Transcription failed', error);
      setRecordingMode('error');
    }
  }

  function retryTranscription() {
    if (!voice.audioBlob) return;
    sendTranscription(voice.audioBlob);
  }

  function cancelRecording() {
    stopAudioPipeline();
    stopTracks();
    voice.chunks = [];
    voice.audioBlob = null;
    setRecordingMode('idle');
  }

  window.Composer = {
    init,
    clearInput,
    setSendState
  };
})();
