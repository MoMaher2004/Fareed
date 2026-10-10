(function () {
  let hasConnectedOnce = false;

  function updateConnectionStatus(status) {
    window.AppState.connection = status;
    const badge = document.getElementById('connection-status');
    if (!badge) return;

    badge.textContent = status;
    badge.className = `topbar-status status-${status}`;
  }

  function handleRouterChange(chatId) {
    if (chatId) {
      if (chatId !== window.AppState.currentChatId) {
        window.Chat.openChat(chatId);
      }
    } else {
      if (window.Chat.startNewChat) {
        window.Chat.startNewChat({ updateUrl: false });
      } else if (window.Chat.showWelcome) {
        window.Chat.showWelcome();
      }
    }
  }

  function init() {
    window.ThemeManager.init();
    window.Chat.init();
    window.Drawer.init();
    window.Composer.init();
    window.ToolRequestPanel.init();
    window.Feedback.init();
    window.Instructions.init();
    window.FileUpload.init();
    window.FileUploadIndicator.init();

    if (window.visualViewport) {
      const setAppHeight = () => {
        document.documentElement.style.setProperty('--app-height', `${window.visualViewport.height}px`);
      };
      setAppHeight();
      window.visualViewport.addEventListener('resize', setAppHeight);
    }

    // --- Core Stream & UI Events ---
    window.Events.on('chunk', (chunk) => window.Chat.handleChunk(chunk));

    window.Events.on('chatId', (chatId) => {
      if (!chatId) return;
      window.AppState.currentChatId = chatId;
      window.Router.setChatId(chatId, true);
    });

    window.Events.on('hotAnswers', (items) => {
      window.HotAnswers.render(items);
    });

    // Handle Title Update (Using 'title' parameter now)
    window.Events.on('server:chat_title_updated', ({ chatId, title }) => {
      if (!chatId || !title) return;

      const chat = window.AppState.chats.find(c => c.id === chatId);
      if (chat) chat.title = title;

      if (chatId === window.AppState.currentChatId) {
        const topbarTitle = document.querySelector('.topbar-title');
        if (topbarTitle) topbarTitle.textContent = title;
        document.title = `${title} - Agent Console`;
      }
      
      window.Events.emit('drawer:update-chat-title', { chatId, title });
    });

    // Handle Pinning Toggle
    window.Events.on('server:toggle_pinning_chat', ({ chatId }) => {
      if (!chatId) return;
      const chat = window.AppState.chats.find(c => c.id === chatId);
      if (chat) {
        chat.pinned = !chat.pinned;
        // This triggers the drawer to re-render and move the chat between Pinned/History lists
        window.Events.emit('chats:updated', window.AppState.chats); 
      }
    });

    // Handle Chat Deletion
    window.Events.on('server:delete_chat', ({ chatId }) => {
      if (!chatId) return;
      
      // Remove from state
      window.AppState.chats = window.AppState.chats.filter(c => c.id !== chatId);
      window.Events.emit('chats:updated', window.AppState.chats);

      // If the deleted chat was currently open, act like "New Chat" was clicked
      if (chatId === window.AppState.currentChatId) {
        if (window.Chat.startNewChat) {
          window.Chat.startNewChat({ updateUrl: true });
        } else {
          window.AppState.currentChatId = null;
          window.Router.setRoot(true);
          if (window.Chat.clearMessages) window.Chat.clearMessages();
          if (window.Chat.showWelcome) window.Chat.showWelcome();
        }
      }
    });

    window.Events.on('sendState', (state) => {
      window.Composer.setSendState(state);
    });

    window.Events.on('connectionStatus', (status) => {
      updateConnectionStatus(status);

      // Auto-rejoin chat if we reconnect after a drop
      if (status === 'connected') {
        if (hasConnectedOnce && window.AppState.currentChatId) {
          window.Communication.joinChat(window.AppState.currentChatId);
        }
        hasConnectedOnce = true;
      }
    });

    window.Events.on('drawer:action', (action) => {
      window.DomUtils.toast(`${action.label || action.id} will be implemented later.`, 'secondary');
    });

    window.Events.on('message:edited', (payload) => {
      console.info('Message edited', payload);
    });

    // --- Server Pushed Events ---
    
    window.Events.on('server:history', (payload) => {
      console.log('Received history event', payload);
      window.Chat.applyServerHistory(payload);
    });

    window.Events.on('server:chats_list', (chats) => {
      window.AppState.chats = Array.isArray(chats) ? chats : [];
      window.Events.emit('chats:updated', window.AppState.chats);
    });

    window.Events.on('server:chat_created', (payload) => {
      const chatId = typeof payload === 'string' ? payload : payload.chatId;
      const title = typeof payload === 'object' && payload.title ? payload.title : 'New chat';
      const temporary = typeof payload === 'object' ? Boolean(payload.temporary) : false;

      if (!chatId) return;

      window.AppState.currentChatId = chatId;
      window.Router.setChatId(chatId, true);

      const exists = window.AppState.chats.some((chat) => chat.id === chatId);

      if (!exists) {
        window.AppState.chats = [
          {
            id: chatId,
            title,
            pinned: false,
            temporary
          },
          ...window.AppState.chats
        ];

        window.Events.emit('chats:updated', window.AppState.chats);
      }
    });

    window.Events.on('server:tool_request', (chunk) => {
      window.ToolRequestPanel.handleChunk(chunk);
    });

    window.Events.on('server:hot_answers', (items) => {
      window.HotAnswers.render(items);
    });

    window.Events.on('server:send_state', (state) => {
      window.Composer.setSendState(state);
    });

    window.Events.on('server:connection_status', (status) => {
      updateConnectionStatus(status);
    });

    // --- NEW: Chat Title Update Event ---
    window.Events.on('server:chat_title_updated', ({ chatId, title }) => {
      if (!chatId || !title) return;

      // 1. Update state silently (avoid full drawer re-render to preserve animation)
      const chat = window.AppState.chats.find(c => c.id === chatId);
      if (chat) {
        chat.title = title;
      }

      // 2. Update Topbar and Document title if it's the currently active chat
      if (chatId === window.AppState.currentChatId) {
        const topbarTitle = document.querySelector('.topbar-title');
        if (topbarTitle) topbarTitle.textContent = title;
        document.title = `${title} - Agent Console`;
      }
      
      // 3. Tell the drawer to animate the specific DOM node
      window.Events.emit('drawer:update-chat-title', { chatId, title });
    });

    window.Events.on('server:models_list', (models) => {
      window.AppState.models = models || {};
      if (window.Composer.populateModelDropdown) {
        window.Composer.populateModelDropdown(models);
      }
    });

    window.Events.on('server:current_model_setting', ({ model, effort }) => {
      window.AppState.currentModel = model;
      window.AppState.currentEffort = effort;
      if (window.Composer.setModelSettings) {
        window.Composer.setModelSettings(model, effort);
      }
    });

    // --- Initialization ---
    window.Router.init(handleRouterChange);
    window.Communication.connect();
    window.Chat.loadChatList();

    // --- Public API ---
    window.AgentUI = {
      config: window.APP_CONFIG,
      state: window.AppState,
      events: window.Events,
      communication: window.Communication,
      chat: window.Chat,
      composer: window.Composer,
      router: window.Router,
      theme: window.ThemeManager,

      sendMessage(text) {
        return window.Chat.sendMessage(text);
      },

      createChat(temporary = false) {
        return window.Chat.createChat(temporary);
      },

      openChat(chatId) {
        return window.Chat.openChat(chatId);
      },

      setTheme(theme) {
        return window.ThemeManager.set(theme);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();