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

    window.Events.on('chunk', (chunk) => window.Chat.handleChunk(chunk));

    window.Events.on('chatId', (chatId) => {
      if (!chatId) return;
      window.AppState.currentChatId = chatId;
      window.Router.setChatId(chatId, true);
    });

    window.Events.on('hotAnswers', (items) => {
      window.HotAnswers.render(items);
    });

    window.Events.on('sendState', (state) => {
      window.Composer.setSendState(state);
    });

    window.Events.on('connectionStatus', (status) => {
      updateConnectionStatus(status);

      if (status === 'connected') {
        // If this is a reconnection and we already have an open chat,
        // rejoin it so the backend can resend history/state if needed.
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

    window.Events.on('server:history', (payload) => {
      console.log('Received history event', payload);
      Chat.applyServerHistory(payload);
    });

    window.Events.on('server:chats_list', (chats) => {
      AppState.chats = Array.isArray(chats) ? chats : [];
      window.Events.emit('chats:updated', AppState.chats);
    });

    window.Events.on('server:chat_created', (chatId) => {
      if (!chatId) return;

      AppState.currentChatId = chatId;
      Router.setChatId(chatId, true);

      const exists = AppState.chats.some((chat) => chat.id === chatId);

      if (!exists) {
        AppState.chats = [
          {
            id: chatId,
            title: 'New chat',
            pinned: false,
            temporary: false,
            updated_at: Date.now()
          },
          ...AppState.chats
        ];

        window.Events.emit('chats:updated', AppState.chats);
      }
    });

    window.Events.on('server:tool_request', (chunk) => {
      ToolRequestPanel.handleChunk(chunk);
    });

    window.Events.on('server:hot_answers', (items) => {
      HotAnswers.render(items);
    });

    window.Events.on('server:send_state', (state) => {
      Composer.setSendState(state);
    });

    window.Events.on('server:connection_status', (status) => {
      updateConnectionStatus(status);
    });

    window.Router.init(handleRouterChange);
    window.Communication.connect();
    window.Chat.loadChatList();

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
