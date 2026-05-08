document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chatMessages');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const fileUpload = document.getElementById('fileUpload');
  const attachmentPreview = document.getElementById('attachmentPreview');
  const systemMsgToggle = document.getElementById('systemMsgToggle');
  const themeToggle = document.getElementById('themeToggle');
  const voiceCallBtn = document.getElementById('voiceCallBtn');
  const voiceInputBtn = document.getElementById('voiceInputBtn');
  const voiceCallOverlay = document.getElementById('voiceCallOverlay');
  const endCallBtn = document.getElementById('endCallBtn');
  const historyList = document.getElementById('historyList');
  const hotAnswers = document.querySelectorAll('.btn-suggestion');

  let uploadedFiles = [];
  let isCallActive = false;
  let recognition = null;

  // Initialize Speech Recognition (Voice Input)
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      userInput.value = Array.from(e.results).map(r => r[0].transcript).join(' ');
      userInput.dispatchEvent(new Event('input')); // Trigger auto-resize if implemented
    };
    recognition.onend = () => voiceInputBtn.classList.remove('text-danger');
    recognition.onerror = (e) => console.warn('Voice input error:', e.error);
  }

  // Theme Toggle
  themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-bs-theme') === 'dark';
    html.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
    themeToggle.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
  });

  // Voice Input Toggle
  voiceInputBtn.addEventListener('click', () => {
    if (!recognition) return alert('Voice input not supported in this browser.');
    if (isCallActive) return alert('End voice call first.');
    recognition.state === 'inactive' ? (recognition.start(), voiceInputBtn.classList.add('text-danger')) : recognition.stop();
  });

  // File Upload & Preview
  fileUpload.addEventListener('change', (e) => {
    uploadedFiles = Array.from(e.target.files);
    attachmentPreview.innerHTML = '';
    uploadedFiles.forEach((file, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      const icon = file.type.startsWith('image/') ? `<img src="${URL.createObjectURL(file)}" alt="${file.name}">` : `<i class="bi bi-file-earmark-${file.name.split('.').pop()}"></i>`;
      chip.innerHTML = `${icon} <span>${file.name}</span> <i class="bi bi-x" data-idx="${idx}"></i>`;
      attachmentPreview.appendChild(chip);
    });
    uploadedFiles.length > 0 ? attachmentPreview.classList.remove('d-none') : attachmentPreview.classList.add('d-none');
  });

  attachmentPreview.addEventListener('click', (e) => {
    if (e.target.classList.contains('bi-x')) {
      const idx = parseInt(e.target.dataset.idx);
      uploadedFiles.splice(idx, 1);
      const dt = new DataTransfer();
      uploadedFiles.forEach(f => dt.items.add(f));
      fileUpload.files = dt.files;
      fileUpload.dispatchEvent(new Event('change'));
    }
  });

  // Send Message
  const sendMessage = async (text = null) => {
    const messageText = text || userInput.value.trim();
    const isSystem = systemMsgToggle.checked;
    if (!messageText && uploadedFiles.length === 0) return;

    addMessage('user', messageText, uploadedFiles.length);
    addToHistory('user', messageText, uploadedFiles.length > 0 ? '📎' : '👤');
    
    userInput.value = '';
    uploadedFiles = [];
    fileUpload.value = '';
    attachmentPreview.innerHTML = '';
    attachmentPreview.classList.add('d-none');

    showTyping();
    try {
      // 🔌 BACKEND INTEGRATION POINT
      // const res = await fetch('/api/chat', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ message: messageText, isSystem, model: document.getElementById('modelSelector').value, files: [] }) // Handle files via FormData in production
      // });
      // const data = await res.json();

      // Simulated AI Response
      setTimeout(() => {
        removeTyping();
        const mockResponse = `Here's a sample integration:\n\`\`\`python\nimport requests\nres = requests.get("https://api.fareed.ai/v1/query", params={"q": "${messageText}"})\nprint(res.json())\n\`\`\`\nRun it with:\n\`\`\`terminal\npython main.py\n\`\`\`\nLet me know if you need adjustments!`;
        addMessage('ai', mockResponse);
        addToHistory('ai', mockResponse, '🤖');
        
        // Simulate Tool Call/Response
        if (Math.random() > 0.5) {
          addToHistory('tool', `tool_call: search_db("${messageText}")`, '🛠️');
          setTimeout(() => addToHistory('response', `{"status": "ok", "data": ["result1", "result2"]}`, '📦'), 500);
        }
      }, 1200);
    } catch (err) {
      removeTyping();
      addMessage('system', '⚠️ Failed to reach Fareed backend.');
    }
  };

  sendBtn.addEventListener('click', () => sendMessage());
  userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  // Hot Answers
  hotAnswers.forEach(btn => btn.addEventListener('click', () => sendMessage(btn.dataset.query)));

  // Voice Call UI
  voiceCallBtn.addEventListener('click', () => {
    isCallActive = true;
    userInput.disabled = true;
    userInput.placeholder = 'Voice call active...';
    voiceCallOverlay.classList.remove('d-none');
    setTimeout(() => document.getElementById('callStatusText').textContent = '🔊 Connected to Fareed', 1500);
  });

  endCallBtn.addEventListener('click', () => {
    isCallActive = false;
    userInput.disabled = false;
    userInput.placeholder = 'Type your message...';
    voiceCallOverlay.classList.add('d-none');
    // 🔌 BACKEND: Send call termination signal
  });

  // UI Helpers
  function addMessage(role, text, fileCount = 0) {
    const div = document.createElement('div');
    div.className = `message ${role}-message`;
    const icon = role === 'user' ? '👤 You' : role === 'system' ? '⚙️ System' : '🤖 Fareed';
    let content = formatMessage(text);
    if (fileCount > 0) content += `<br><span class="opacity-75 fs-sm"><i class="bi bi-paperclip"></i> ${fileCount} file(s)</span>`;
    div.innerHTML = `<div class="message-header">${icon}</div><div class="message-content">${content}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    highlightCodeBlocks(div);
  }

  function formatMessage(text) {
    return text
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
        const id = 'code-' + Math.random().toString(36).substr(2, 6);
        return `<div class="code-wrapper"><pre class="code-block" id="${id}"><code class="language-${lang || 'plaintext'}">${escapeHtml(code.trim())}</code></pre><div class="code-actions"><button onclick="copyToClipboard('${id}')"><i class="bi bi-clipboard"></i> Copy</button></div></div>`;
      })
      .replace(/```terminal\n([\s\S]*?)```/g, (_, cmd) => {
        const id = 'term-' + Math.random().toString(36).substr(2, 6);
        return `<div class="terminal-box" id="${id}"><div class="mb-1">$ ${escapeHtml(cmd.trim())}</div><div class="terminal-actions"><button onclick="copyToClipboard('${id}')"><i class="bi bi-clipboard"></i> Copy</button><button onclick="handleTerminal('${id}','accept')">✅ Accept</button><button onclick="handleTerminal('${id}','decline')">❌ Decline</button></div></div>`;
      })
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(unsafe) { return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  window.copyToClipboard = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const text = el.querySelector('code') ? el.querySelector('code').textContent : el.querySelector('.mb-1')?.textContent.replace('$ ', '');
    navigator.clipboard.writeText(text || '');
  };

  window.handleTerminal = (id, action) => {
    console.log(`Terminal command ${action}: ${id}`);
    // 🔌 BACKEND: Send accept/decline payload
    const btns = document.querySelectorAll(`#${id} .terminal-actions button`);
    btns.forEach(b => b.disabled = true);
    document.querySelector(`#${id}`).insertAdjacentHTML('beforeend', `<div class="mt-2 text-success fs-sm">${action === 'accept' ? '✅ Command approved.' : '⛔ Command declined.'}</div>`);
  };

  function highlightCodeBlocks(container) {
    container.querySelectorAll('pre code').forEach(block => Prism.highlightElement(block));
  }

  function showTyping() {
    const div = document.createElement('div');
    div.id = 'typing';
    div.className = 'message ai-message';
    div.innerHTML = `<div class="message-header">🤖 Fareed</div><div class="message-content"><span class="typing-dots">Thinking<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeTyping() { document.getElementById('typing')?.remove(); }

  function addToHistory(role, text, icon = '📝') {
    const item = document.createElement('div');
    item.className = `history-item type-${role}`;
    const shortText = text.length > 60 ? text.substring(0, 60) + '...' : text;
    item.innerHTML = `<div class="history-meta"><span>${icon} ${role.toUpperCase()}</span><span class="opacity-50">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div><div class="text-truncate">${escapeHtml(shortText)}</div>`;
    historyList.prepend(item);
  }

  // Auto-resize textarea
  userInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight > 150 ? 150 : this.scrollHeight) + 'px'; });
});