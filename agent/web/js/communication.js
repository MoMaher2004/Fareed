(function () {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const mockState = {
    pendingTool: null
  };

  function emitChunk(chunk) {
    window.Events.emit('chunk', chunk);
  }

  function emitSendState(state) {
    window.Events.emit('sendState', state);
  }

  function emitHotAnswers(items) {
    window.Events.emit('hotAnswers', items);
  }

  function mockChatList() {
    return [
      { id: 'chat-demo-1', title: 'Product brainstorm', pinned: true, temporary: false, updated_at: Date.now() - 86400000 },
      { id: 'chat-demo-2', title: 'Deployment checklist', pinned: false, temporary: false, updated_at: Date.now() - 172800000 },
      { id: 'chat-demo-3', title: 'Temporary scratchpad', pinned: false, temporary: true, updated_at: Date.now() - 3600000 }
    ];
  }

  function mockHistory(chatId) {
    if (chatId === 'chat-demo-1') {
      return {
        chatId,
        messages: [
          { role: 'user', id: 'u1', content: 'What can this frontend render?' },
          {
            role: 'assistant',
            id: 'a1',
            blocks: [
              { type: 'markdown', content: 'This UI supports Markdown, code blocks, Linux commands, media, and tool activity.' },
              {
                type: 'code',
                filename: 'example.js',
                language: 'javascript',
                code: 'function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet("Agent"));'
              }
            ]
          }
        ],
        hotAnswers: [
          { label: 'Show a Linux command', value: 'Show a Linux command' },
          { label: 'Trigger a tool request', value: 'Trigger a tool request' },
          { label: 'Trigger an error', value: 'Trigger an error' }
        ]
      };
    }

    if (chatId === 'chat-demo-2') {
      return {
        chatId,
        messages: [
          { role: 'user', id: 'u2', content: 'Give me a deployment checklist.' },
          {
            role: 'assistant',
            id: 'a2',
            blocks: [
              { type: 'markdown', content: '### Deployment checklist\n\n- Verify build\n- Run tests\n- Check secrets\n- Confirm rollback plan' },
              { type: 'command', command: 'git status && npm run build && npm run test' }
            ]
          }
        ],
        hotAnswers: []
      };
    }

    return { chatId, messages: [], hotAnswers: [] };
  }

  async function mockStreamRich(chatId, prompt) {
    emitChunk({ type: 'reasoning', content: `Considering request: "${prompt}".\n` });
    await sleep(220);
    emitChunk({ type: 'reasoning', content: 'Selecting a response format that demonstrates supported blocks.\n' });
    await sleep(220);

    const markdownParts = [
      'Here is a **mock streamed response**.\n\n',
      'It demonstrates incremental rendering, Markdown, and rich components.\n\n',
      '| Feature | Status |\n|---|---|\n| Streaming | OK |\n| Rich blocks | OK |\n'
    ];

    for (const part of markdownParts) {
      emitChunk({ type: 'message', content_type: 'markdown', content: part });
      await sleep(170);
    }

    emitChunk({
      type: 'message',
      content_type: 'code',
      content: 'def hello():\n    print("Hello from mock backend")\n\nhello()',
      metadata: { filename: 'hello.py', language: 'python' }
    });
    await sleep(220);

    emitChunk({
      type: 'message',
      content_type: 'command',
      content: 'python3 hello.py',
      metadata: { filename: 'run.sh' }
    });
    await sleep(220);

    emitChunk({
      type: 'message',
      content_type: 'image',
      content: 'https://picsum.photos/seed/agent-ui/900/500',
      metadata: { alt: 'Mock demo image' }
    });
    await sleep(120);

    emitChunk({
      type: 'message',
      content_type: 'audio',
      content: 'https://www.w3schools.com/html/horse.mp3'
    });
    await sleep(120);

    emitChunk({
      type: 'message',
      content_type: 'youtube_embed',
      content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    await sleep(120);

    emitChunk({
      type: 'tool_usage',
      content: {
        name: 'web_search',
        id: 'tool_web_1',
        arguments: { query: prompt },
        result: { summary: 'Mock search completed successfully.', sources: ['mock.example'] }
      }
    });
    await sleep(120);

    emitChunk({ type: 'end', content: '', metadata: { chatId } });
  }

  const mockBackend = {
    async connect() {
      await sleep(250);
      window.Events.emit('connectionStatus', 'connected');
    },

    async disconnect() {
      window.Events.emit('connectionStatus', 'disconnected');
    },

    isConnected() {
      return true;
    },

    async getChatList() {
      await sleep(200);
      return mockChatList();
    },

    async loadChatHistory() {
      return this.getChatList();
    },

    async createChat({ temporary = false } = {}) {
      await sleep(180);
      const id = `chat_${Math.random().toString(36).slice(2, 10)}`;
      return {
        id,
        title: temporary ? 'Temporary chat' : 'New chat',
        temporary,
        pinned: false,
        updated_at: Date.now()
      };
    },

    async loadChat(chatId) {
      await sleep(260);
      return mockHistory(chatId);
    },

    async joinChat(chatId) {
      console.info('Mock joinChat:', chatId);
      return { ok: true };
    },

    async sendMessage({ chatId, content }) {
      emitSendState('processing');
      await sleep(200);

      const safeChatId = chatId || `chat_${Math.random().toString(36).slice(2, 10)}`;
      window.Events.emit('chatId', safeChatId);

      const text = String(content || '').toLowerCase();

      if (text.includes('error')) {
        emitChunk({ type: 'error', content: 'Mock backend error: something failed safely and did not crash the UI.' });
        await sleep(180);
        emitChunk({ type: 'end', content: '', metadata: { chatId: safeChatId } });
        emitSendState('enabled');
        return;
      }

      if (text.includes('tool')) {
        emitChunk({ type: 'reasoning', content: 'The user requested a protected action.\n' });
        await sleep(220);
        emitChunk({
          type: 'tool_request',
          content: {
            requests: [
              {
                id: `req_${Math.random().toString(36).slice(2, 9)}`,
                tool: 'web_search',
                title: 'Tool: web_search',
                description: 'The agent wants to search the web. Choose an action.',
                options: [
                  { id: 'approve', label: 'Approve', style: { background: '#198754', color: '#fff', borderColor: '#198754' } },
                  { id: 'deny', label: 'Deny', style: { color: '#dc3545' } },
                  { id: 'reject', label: 'Reject' }
                ]
              }
            ]
          }
        });
        mockState.pendingTool = { chatId: safeChatId, prompt: content };
        emitSendState('disabled');
        return;
      }

      await mockStreamRich(safeChatId, content);
      emitSendState('enabled');
      emitHotAnswers([
        { label: 'Show a Linux command', value: 'Show a Linux command' },
        { label: 'Trigger a tool request', value: 'Trigger a tool request' },
        { label: 'Trigger an error', value: 'Trigger an error' }
      ]);
    },

    async sendToolResponse({ requestId, optionId }) {
      await sleep(260);

      const pending = mockState.pendingTool;
      mockState.pendingTool = null;

      if (!pending) return { ok: true };

      emitChunk({
        type: 'tool_usage',
        content: {
          name: 'web_search',
          id: requestId || 'tool_web_1',
          arguments: { approved_option: optionId },
          result: { state: optionId === 'approve' ? 'approved' : 'denied' }
        }
      });

      await sleep(220);

      emitChunk({
        type: 'message',
        content_type: 'markdown',
        content: optionId === 'approve'
          ? 'The tool request was approved. Continuing with the mocked answer.\n'
          : 'The tool request was not approved. Continuing safely without the tool.\n'
      });

      await sleep(220);
      emitChunk({ type: 'end', content: '', metadata: { chatId: pending.chatId } });
      emitSendState('enabled');

      return { ok: true };
    },

    async sendFeedback(payload) {
      await sleep(300);
      console.info('Mock feedback received', payload);
      return { ok: true };
    },

    async requestTranscription(blob) {
      await sleep(900);

      if (!blob || !blob.size) {
        throw new Error('Empty audio');
      }

      return { text: 'This is a mock transcription inserted into the composer.' };
    },

    async requestCodeExecution(payload) {
      await sleep(450);
      console.info('Mock code execution requested', payload);
      return { ok: true };
    },

    async requestAvailableServers() {
      await sleep(300);
      return [
        { id: 'srv-local', name: 'Local sandbox', status: 'online', description: 'Runs code in an isolated local environment.' },
        { id: 'srv-cloud', name: 'Cloud runner', status: 'online', description: 'Remote execution environment with more resources.' },
        { id: 'srv-offline', name: 'Legacy server', status: 'offline', description: 'Currently unavailable.' }
      ];
    },

    async sendAttachment(payload) {
      await sleep(200);
      console.info('Mock attachment payload', payload);
      return { ok: false, message: 'Attachment upload is not implemented yet.' };
    }
  };

  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let intentionalClose = false;
  const pendingQueue = [];

  function getWebSocketUrl() {
    return (
      (window.APP_CONFIG && window.APP_CONFIG.backend && window.APP_CONFIG.backend.wsUrl) ||
      'ws://localhost:5000/chat'
    );
  }

  function setConnectionState(state) {
    window.Events.emit('connectionStatus', state);
  }

  function flushPendingQueue() {
    const socket = realBackend.websocket;

    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    while (pendingQueue.length) {
      const payload = pendingQueue.shift();

      try {
        socket.send(JSON.stringify(payload));
      } catch (error) {
        console.error('Failed to send queued payload', payload, error);
      }
    }
  }

  function scheduleReconnect() {
    if (intentionalClose) return;
    if (reconnectTimer) return;

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
    reconnectAttempts += 1;

    setConnectionState('reconnecting');

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      realBackend.connect();
    }, delay);
  }

  function sendToServer(payload, options = { queue: true }) {
    const socket = realBackend.websocket;

    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(payload));
        return true;
      } catch (error) {
        console.error('Failed to send payload', payload, error);
        return false;
      }
    }

    if (options.queue) {
      if (payload && payload.type === 'join_chat') {
        const existingJoinIndex = pendingQueue.findIndex(
          (item) => item && item.type === 'join_chat'
        );

        if (existingJoinIndex !== -1) {
          pendingQueue.splice(existingJoinIndex, 1);
        }
      }

      pendingQueue.push(payload);

      if (pendingQueue.length > 100) {
        pendingQueue.shift();
      }

      realBackend.connect();
      return true;
    }

    console.warn('WebSocket is not connected. Cannot send payload:', payload);
    return false;
  }

  function handleServerMessage(raw) {
    let data = raw;

    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch (error) {
        console.error('Invalid JSON from server', raw);
        return;
      }
    }

    if (!data || typeof data !== 'object') return;

    const type = data.type || data.event;

    if (!type) {
      console.warn('Server message has no type', data);
      return;
    }

    switch (type) {
      case 'history':
        window.Events.emit('server:history', data);
        break;

      case 'chats_list':
      case 'chat_list':
        window.Events.emit('server:chats_list', data.chats || data.items || []);
        break;

      case 'update_chat_id':
        window.Events.emit('server:chat_created', data.chat_id || data.chatId || data.id);
        break;

      case 'request_tool':
      case 'tool_request':
        window.Events.emit('server:tool_request', {
          type: 'tool_request',
          content: data.requests
            ? { requests: data.requests }
            : data.content || data
        });
        break;

      case 'hot_answers':
        window.Events.emit(
          'server:hot_answers',
          data.items || data.answers || data.hot_answers || []
        );
        break;

      case 'chat_lock': {
        const locked = data.locked ?? data.lock ?? data.value ?? data.content ?? true;
        const state = locked ? 'disabled' : 'enabled';
        window.Events.emit('server:send_state', state);
        window.Events.emit('sendState', state);
        break;
      }

      case 'send_state':
      case 'sendState': {
        const state = data.state || data.value || 'enabled';
        window.Events.emit('server:send_state', state);
        window.Events.emit('sendState', state);
        break;
      }

      case 'connection_status':
        window.Events.emit('server:connection_status', data.status || 'disconnected');
        break;

      case 'message':
      case 'reasoning':
      case 'tool_result':
      case 'tool_start':
      case 'tool_usage':
      case 'error':
      case 'end':
        window.Events.emit('chunk', data);
        break;

      default:
        console.warn('Unknown server message type:', type);
    }
  }

  const realBackend = {
    websocket: null,

    connect() {
      if (
        this.websocket &&
        (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      intentionalClose = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      const wsUrl = getWebSocketUrl();

      try {
        this.websocket = new WebSocket(wsUrl);
      } catch (error) {
        console.error('Failed to create WebSocket connection', error);
        scheduleReconnect();
        return;
      }

      this.websocket.onopen = () => {
        reconnectAttempts = 0;
        setConnectionState('connected');
        flushPendingQueue();
      };

      this.websocket.onmessage = (event) => {
        handleServerMessage(event.data);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.websocket.onclose = () => {
        this.websocket = null;
        setConnectionState('disconnected');

        if (!intentionalClose) {
          scheduleReconnect();
        }
      };
    },

    disconnect() {
      intentionalClose = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      setConnectionState('disconnected');
    },

    removeChatSession() {
      const ok = sendToServer({
        type: 'remove_chat_session'
      });

      return ok
        ? Promise.resolve({ ok: true })
        : Promise.reject(new Error('Failed to send remove_chat_session.'));
    },

    isConnected() {
      return Boolean(this.websocket && this.websocket.readyState === WebSocket.OPEN);
    },

    sendMessage(payload) {
      if (typeof payload === 'string') {
        payload = { content: payload };
      }

      const message = payload?.content ?? payload?.message ?? '';
      const is_system_message = Boolean(payload?.s_system_message ?? payload?.is_system_message);
      const chat_id = payload?.chatId ?? payload?.chat_id;

      const ok = sendToServer({
        type: 'message',
        message,
        is_system_message,
        chat_id
      });

      return ok
        ? Promise.resolve()
        : Promise.reject(new Error('WebSocket is not connected.'));
    },

    joinChat(chatId) {
      const ok = sendToServer({
        type: 'join_chat',
        chat_id: chatId
      });

      return ok
        ? Promise.resolve()
        : Promise.reject(new Error('Failed to queue join_chat.'));
    },

    sendToolResponse(payload) {
      const ok = sendToServer({
        type: 'tool_response',
        ...(payload || {})
      });

      return ok
        ? Promise.resolve({ ok: true })
        : Promise.reject(new Error('WebSocket is not connected.'));
    },

    sendFeedback(payload) {
      const ok = sendToServer({
        type: 'feedback',
        ...(payload || {})
      });

      return ok
        ? Promise.resolve({ ok: true })
        : Promise.reject(new Error('WebSocket is not connected.'));
    },

    requestTranscription() {
      return Promise.reject(new Error('Transcription not implemented.'));
    },

    requestCodeExecution() {
      console.warn('Communication.requestCodeExecution: real backend not implemented.');
      return Promise.resolve();
    },

    requestAvailableServers() {
      console.warn('Communication.requestAvailableServers: real backend not implemented.');
      return Promise.resolve([]);
    },

    loadChatHistory() {
      return Promise.resolve([]);
    },

    loadChat(chatId) {
      return this.joinChat(chatId);
    },

    createChat() {
      return Promise.resolve({ id: `chat_${Date.now()}`, title: 'New chat' });
    },

    getChatList() {
      return Promise.resolve([]);
    },

    sendAttachment() {
      return Promise.resolve({ ok: false });
    }
  };

  const backend = window.APP_CONFIG.backend.useMock ? mockBackend : realBackend;

  window.Communication = {
    connect: () => backend.connect(),
    disconnect: () => backend.disconnect(),

    isConnected: () => {
      if (typeof backend.isConnected === 'function') {
        return backend.isConnected();
      }

      return true;
    },

    sendMessage: (payload) => backend.sendMessage(payload),
    sendToolResponse: (payload) => backend.sendToolResponse(payload),
    sendFeedback: (payload) => backend.sendFeedback(payload),
    requestTranscription: (blob) => backend.requestTranscription(blob),
    requestCodeExecution: (payload) => backend.requestCodeExecution(payload),
    requestAvailableServers: () => backend.requestAvailableServers(),
    loadChatHistory: () => backend.loadChatHistory(),
    loadChat: (chatId) => backend.loadChat(chatId),
    removeChatSession: (chatId) => backend.removeChatSession(chatId),
    createChat: (options) => backend.createChat(options),
    getChatList: () => backend.getChatList(),
    sendAttachment: (payload) => backend.sendAttachment(payload),
    joinChat: (chatId) => backend.joinChat(chatId)
  };
})();