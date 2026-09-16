
import Parser from './Parser.js';

// ============================================
// FAREED AI ASSISTANT - FRONTEND (Socket.IO)
// ============================================
const BASE_URL = window.location.origin.slice(0, window.location.origin.lastIndexOf(':')) + ':5000' || 'http://localhost:5000';
document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const fileUpload = document.getElementById('fileUpload');
    const attachmentPreview = document.getElementById('attachmentPreview');
    const systemMsgToggle = document.getElementById('systemMsgToggle');
    const themeToggle = document.getElementById('themeToggle');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const historyList = document.getElementById('historyList');
    const chatsList = document.getElementById('chatsList');
    const newchatBtn = document.getElementById('newchatBtn');
    const dropZone = document.getElementById('dropZone');

    let uploadedFiles = [];
    let isCallActive = false;
    let recognition = null;
    let socket = null;
    let currentChatId = null;  // null until created
    let isReceivingChunks = false;
    let messageBuffer = '';
    let settings = { autoScroll: true, codeWrap: true, animSpeed: 300, baseUrl: BASE_URL };

    // ============================================
    // SPEECH RECOGNITION
    // ============================================
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (e) => {
            userInput.value = Array.from(e.results).map(r => r[0].transcript).join(' ');
            autoResizeTextarea();
        };
        recognition.onend = () => voiceInputBtn.classList.remove('recording');
        recognition.onerror = (e) => {
            console.warn('Voice input error:', e.error);
            voiceInputBtn.classList.remove('recording');
        };
    }

    voiceInputBtn.addEventListener('click', () => {
        if (!recognition) return alert('Voice input not supported.');
        if (isCallActive) return alert('End voice call first.');
        if (recognition.state === 'inactive') {
            recognition.start();
            voiceInputBtn.classList.add('recording');
        } else {
            recognition.stop();
        }
    });

    // ============================================
    // THEME TOGGLE
    // ============================================
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-bs-theme') === 'dark';
        html.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
        themeToggle.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
        localStorage.setItem('fareed-theme', isDark ? 'light' : 'dark');
    });
    const savedTheme = localStorage.getItem('fareed-theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
        themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="bi bi-moon-stars-fill"></i>' : '<i class="bi bi-sun-fill"></i>';
    }

    // ============================================
    // FILE HANDLING (drag & drop, preview)
    // ============================================
    function handleFiles(e) {
        const files = Array.from(e.target.files);
        uploadedFiles.push(...files);
        renderAttachmentPreview();
    }

    function renderAttachmentPreview() {
        attachmentPreview.innerHTML = '';
        uploadedFiles.forEach((file, idx) => {
            const chip = document.createElement('div');
            chip.className = 'attachment-chip';
            let icon = '';
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                icon = img.outerHTML;
            } else {
                const ext = file.name.split('.').pop();
                const iconClass = getFileIcon(ext);
                icon = `<i class="bi ${iconClass}"></i>`;
            }
            chip.innerHTML = `${icon}<span class="text-truncate">${file.name}</span><i class="bi bi-x" data-idx="${idx}"></i>`;
            attachmentPreview.appendChild(chip);
        });
        attachmentPreview.classList.toggle('d-none', uploadedFiles.length === 0);
        updateSendButtonState();
    }

    function getFileIcon(ext) {
        const icons = {
            'pdf': 'bi-file-earmark-pdf-fill', 'txt': 'bi-file-earmark-text-fill',
            'py': 'bi-file-earmark-code-fill', 'html': 'bi-file-earmark-code-fill',
            'css': 'bi-file-earmark-code-fill', 'js': 'bi-file-earmark-code-fill',
            'json': 'bi-file-earmark-code-fill', 'mp3': 'bi-file-earmark-music-fill',
            'wav': 'bi-file-earmark-music-fill', 'mp4': 'bi-file-earmark-play-fill'
        };
        return icons[ext] || 'bi-file-earmark-fill';
    }

    attachmentPreview.addEventListener('click', (e) => {
        if (e.target.classList.contains('bi-x')) {
            const idx = parseInt(e.target.dataset.idx);
            uploadedFiles.splice(idx, 1);
            const dt = new DataTransfer();
            uploadedFiles.forEach(f => dt.items.add(f));
            fileUpload.files = dt.files;
            renderAttachmentPreview();
        }
    });

    fileUpload.addEventListener('change', handleFiles);
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });
    dropZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        uploadedFiles.push(...files);
        renderAttachmentPreview();
    });

    // ============================================
    // WEBSOCKET INITIALIZATION (FastAPI Native)
    // ============================================
    let streamTimeout = null;
    
    function resetStreamTimeout() {
        if (streamTimeout) clearTimeout(streamTimeout);
        streamTimeout = setTimeout(() => {
            if (isReceivingChunks && messageBuffer) {
                if (Parser.typingDiv) {
                    Parser.typingDiv.removeAttribute('id');
                    const content = Parser.typingDiv.querySelector('.message-content');
                    if (content) {
                        content.querySelectorAll('.typing-dots').forEach(el => el.remove());
                    }
                }
                addToHistory(
                    'assistant',
                    messageBuffer,
                    '🤖'
                );
                messageBuffer = '';
                Parser.typingDiv = null;
                isReceivingChunks = false;
                updateSendButtonState();
            }
        }, 1200); // 1.2s after last chunk, consider stream ended
    }
    
    function initWebSocket() {
        const wsUrl = `${BASE_URL}/chat`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('✅ WebSocket connected');
            if (currentChatId) {
                socket.send(JSON.stringify({
                    type: 'join_chat',
                    chat_id: currentChatId
                }));
            }
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const eventType = data.type;
                
                if (eventType === 'server_message') {
                    // Handle streaming messages
                    if (data.chat_id !== currentChatId) return;
                    
                    if (!isReceivingChunks) {
                        messageBuffer = '';
                        isReceivingChunks = true;
                    }
                    
                    messageBuffer += data.message || '';
                    
                    if (Parser.typingDiv == null) {
                        Parser.typingDiv = document.getElementById('typing');
                    }

                    Parser.parse(data.message)
                    resetStreamTimeout();
                    
                } else if (eventType === 'server_error') {
                    // Handle errors
                    removeTyping();
                    addMessage('system', `⚠️ ${data.error}`);
                    isReceivingChunks = false;
                    updateSendButtonState();
                }
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };
        
        socket.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            addMessage('system', '⚠️ Connection error occurred');
        };
        
        socket.onclose = () => {
            console.log('⚠️ WebSocket disconnected');
            addMessage('system', '⚠️ Connection closed');
            // setTimeout(() => {
            //     console.log("retrying WebSocket connection in 3 seconds...");
            // }, 3000);
            // initWebSocket()
        };
    }

    window.initWebSocket = initWebSocket;

    function showTyping() {

        Parser.typingDiv = document.createElement('div');

        Parser.typingDiv.id = 'typing';

        Parser.typingDiv.className = 'message ai-message';

        Parser.typingDiv.innerHTML = `
            <div class="message-header">
                🤖 Fareed
            </div>

            <div class="message-content">
                <span class="typing-dots">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </span>
            </div>
        `;

        chatMessages.appendChild(Parser.typingDiv);

        if (settings.autoScroll) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        return Parser.typingDiv;
    }

    // ============================================
    // SEND MESSAGE (with auto chat creation)
    // ============================================
    window.sendMessage = async function sendMessage(text = null) {
        const messageText = text || userInput.value.trim();
        document.getElementById('hotAnswers').innerHTML = '';
        // Ensure we have a valid chat_id
        if (!currentChatId) {
            try {
                const res = await fetch(`${settings.baseUrl}/chats`, { method: 'POST' });
                if (!res.ok) throw new Error('Failed to create chat');
                const data = await res.json();
                currentChatId = data.id;
                if (socket?.connected) socket.emit('join_chat', { chat_id: currentChatId });
                await loadchats();
            } catch (err) {
                console.error(err);
                addMessage('system', '⚠️ Could not start a new chat. Please refresh.');
                return;
            }
        }

        const isSystem = systemMsgToggle.checked;
        const filesToSend = [...uploadedFiles];

        // Display user message
        addMessage('user', messageText, filesToSend.length);
        addToHistory('user', messageText, '👤');

        // Clear input & attachments
        userInput.value = '';
        autoResizeTextarea();
        // uploadedFiles = [];
        // fileUpload.value = '';
        attachmentPreview.innerHTML = '';
        attachmentPreview.classList.add('d-none');
        updateSendButtonState();
        showTyping();

        const payload = {
            type: 'client_message',
            chat_id: currentChatId,
            message: messageText,
            is_system_message: isSystem ? true : false
        };

        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        } else {
            removeTyping();
            addMessage('system', '⚠️ Not connected. Retrying...');
            setTimeout(() => sendMessage(messageText), 2000);
        }
    }

    // ============================================
    // UI HELPERS
    // ============================================
    function updateSendButtonState() {
        const hasContent = userInput.value.trim().length > 0 || uploadedFiles.length > 0;
        sendBtn.disabled = !hasContent || isReceivingChunks || isCallActive;
    }

    function autoResizeTextarea() {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
        updateSendButtonState();
    }

    userInput.addEventListener('input', () => {
        autoResizeTextarea();
        updateSendButtonState();
    });

    sendBtn.addEventListener('click', () => sendMessage());
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // New chat button
    newchatBtn.addEventListener('click', async () => {
        try {
            const res = await fetch(`${settings.baseUrl}/chats`, { method: 'POST' });
            const data = await res.json();
            currentChatId = data.chat_id;
            chatMessages.innerHTML = '';
            historyList.innerHTML = '';
            addMessage('ai', "Hi, I'm Fareed. How can I help you?");
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'join_chat',
                    chat_id: currentChatId
                }));
            }
            bootstrap.Offcanvas.getInstance(document.getElementById('chatsDrawer'))?.hide();
            loadchats();
        } catch (err) {
            console.error('New chat error:', err);
            addMessage('system', '⚠️ Failed to start new chat.');
        }
    });

    // Load all chats from REST API
    async function loadchats() {
        try {
            const res = await fetch(`${settings.baseUrl}/chats`);
            let chats = await res.json();
            if (!Array.isArray(chats)) chats = chats.chats || [];
            renderchatsList(chats);
        } catch (err) {
            console.error('Load chats failed:', err);
            renderchatsList([]);
        }
    }

    function renderchatsList(chats) {
        chatsList.innerHTML = '';
        chats.forEach(conv => {
            const card = document.createElement('div');
            card.className = `chat-card${conv.id === currentChatId ? ' active' : ''}`;
            card.innerHTML = `
                <div class="chat-title">${escapeHtml(conv.title || 'Untitled')}</div>
                <div class="chat-meta"><span>${conv.updated_at}</span></div>
            `;
            card.addEventListener('click', () => loadchat(conv.id));
            chatsList.appendChild(card);
        });
    }

    async function loadchat(chatId) {
        try {
            const res = await fetch(`${settings.baseUrl}/chats/${chatId}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            chatMessages.innerHTML = '';
            historyList.innerHTML = '';
            currentChatId = chatId;
            if (data?.length) {
                console.log("a")
                for(const i in data) {
                    let msg = data[i];
                    if (msg.role === 'user') {
                        addMessage('user', msg.content);
                        addToHistory('user', msg.content, '👤');
                    } else if (msg.role === 'assistant') {
                        addMessage('ai', msg.content, 0, true, i == data.length - 1);
                        addToHistory('assistant', msg.content, '🤖');
                    } else if (msg.role === 'system') {
                        addMessage('system', msg.content);
                    }
                }
            } else {
                addMessage('ai', "chat loaded. Ask me anything!");
            }
            document.querySelectorAll('.chat-card').forEach(c => c.classList.remove('active'));
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'join_chat',
                    chat_id: chatId
                }));
            }
        } catch (err) {
            console.error('Load chat error:', err);
            addMessage('system', '⚠️ Could not load chat.');
        }
    }

    function addToHistory(role, content, icon = '📝') {
        const item = document.createElement('div');
        item.className = 'history-item';
        const typeClass = { 'user':'user', 'assistant':'assistant' }[role] || 'system';
        const short = content.length > 80 ? content.substring(0, 80).replace(/<[^>]*>/g, '') + '...' : content.replace(/<[^>]*>/g, '');
        item.innerHTML = `
            <div class="history-header" onclick="window.toggleHistoryItem(this)">
                <span class="history-type ${typeClass}">${role}</span>
                <span class="history-toggle"><i class="bi bi-chevron-down"></i></span>
            </div>
            <div class="history-meta">${icon} ${new Date().toLocaleTimeString()}</div>
            <div class="history-preview text-truncate">${escapeHtml(short)}</div>
            <div class="history-content">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
        `;
        historyList.prepend(item);
    }

    window.toggleHistoryItem = function(header) {
        header.closest('.history-item').classList.toggle('expanded');
    };

    function addMessage(role, content, fileCount = 0, renderAtEnd = false, lastMessage = false) {
        const div = document.createElement('div');
        div.className = `message ${role}-message`;
        const headers = { 'user':'👤 You', 'ai':'🤖 Fareed', 'system':'⚙️ System' };
        let displayContent = content;
        if (fileCount > 0) displayContent += `<br><span class="opacity-75 fs-sm"><i class="bi bi-paperclip"></i> ${fileCount} file(s)</span>`;

        // For ai messages, use Parser to render structured content (code blocks, images, etc.)
        if (role === 'ai' && content) {
            div.innerHTML = `<div class="message-header">${headers[role] || role}</div>`;
            chatMessages.appendChild(div);
            Parser.parseFull(content, div, renderAtEnd, lastMessage);
        } else {
            div.innerHTML = `<div class="message-header">${headers[role] || role}</div><div class="message-content">${displayContent}</div>`;
            chatMessages.appendChild(div);
        }

        if (settings.autoScroll) chatMessages.scrollTop = chatMessages.scrollHeight;
        setTimeout(() => div.querySelectorAll('pre code').forEach(b => Prism.highlightElement(b)), 50);
    }

    function removeTyping() {
        document.getElementById('typing')?.remove();
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Initialization
    initWebSocket();
    autoResizeTextarea();
    updateSendButtonState();
    loadchats();
    // loadchat(1); // Load default chat on start (optional)
});
