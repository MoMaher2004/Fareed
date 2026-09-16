(function () {
  const elements = {};

  function init() {
    elements.shell = document.getElementById('app-shell');
    elements.drawer = document.getElementById('app-drawer');
    elements.backdrop = document.getElementById('drawer-backdrop');
    elements.actions = document.getElementById('drawer-actions');
    elements.pinned = document.getElementById('pinned-chats');
    elements.history = document.getElementById('chat-history');
    elements.toggle = document.getElementById('drawer-toggle');
    elements.close = document.getElementById('drawer-close');

    if (elements.toggle) elements.toggle.addEventListener('click', toggle);
    if (elements.close) elements.close.addEventListener('click', closeOnMobile);
    if (elements.backdrop) elements.backdrop.addEventListener('click', closeOnMobile);

    window.addEventListener('resize', update);
    window.Events.on('chats:updated', renderChats);

    renderActions();
    renderChats();
    update();
  }

  function renderActions() {
    if (!elements.actions) return;
    window.DomUtils.clear(elements.actions);

    const newChat = window.DomUtils.el('button', { type: 'button', class: 'drawer-action-btn' },
      window.DomUtils.el('i', { class: 'bi bi-plus-lg' }),
      'New Chat'
    );

    newChat.addEventListener('click', () => {
      window.Chat.startNewChat();
      closeOnMobile();
    });

    elements.actions.append(newChat);

    if (window.APP_CONFIG.features.temporaryChat) {
      const tempChat = window.DomUtils.el('button', { type: 'button', class: 'drawer-action-btn' },
        window.DomUtils.el('i', { class: 'bi bi-hourglass-split' }),
        'Temporary Chat'
      );

      tempChat.addEventListener('click', async () => {
        await window.Chat.createChat(true);
        closeOnMobile();
      });

      elements.actions.append(tempChat);
    }

    const customActions = (window.APP_CONFIG.drawer && window.APP_CONFIG.drawer.customActions) || [];
    customActions.forEach((action) => {
      if (!action || !action.id) return;

      const button = window.DomUtils.el('button', { type: 'button', class: 'drawer-action-btn' },
        window.DomUtils.el('i', { class: `bi ${action.icon || 'bi-dot'}` }),
        action.label || action.id
      );

      button.addEventListener('click', () => {
        window.Events.emit('drawer:action', action);
      });

      elements.actions.append(button);
    });
  }

  function renderChats() {
    if (!elements.pinned || !elements.history) return;

    window.DomUtils.clear(elements.pinned);
    window.DomUtils.clear(elements.history);

    const chats = Array.isArray(window.AppState.chats) ? window.AppState.chats : [];
    const pinned = chats.filter((chat) => chat && chat.pinned);
    const history = chats.filter((chat) => chat && !chat.pinned);

    pinned.forEach((chat) => elements.pinned.append(createChatItem(chat)));
    history.forEach((chat) => elements.history.append(createChatItem(chat)));

    if (!pinned.length) {
      elements.pinned.append(window.DomUtils.el('div', { class: 'small text-muted px-2' }, 'No pinned chats.'));
    }

    if (!history.length) {
      elements.history.append(window.DomUtils.el('div', { class: 'small text-muted px-2' }, 'No chat history.'));
    }
  }

  function createChatItem(chat) {
    const button = window.DomUtils.el('button', {
      type: 'button',
      class: `chat-item ${chat.id === window.AppState.currentChatId ? 'active' : ''}`
    },
      window.DomUtils.el('span', { class: 'chat-item-label' }, chat.title || chat.id),
      window.DomUtils.el('span', { class: 'chat-item-meta' },
        chat.temporary ? window.DomUtils.el('i', { class: 'bi bi-hourglass-split' }) : '',
        chat.pinned ? window.DomUtils.el('i', { class: 'bi bi-pin-angle ms-2' }) : ''
      )
    );

    button.addEventListener('click', () => {
      window.Router.navigateToChat(chat.id);
      closeOnMobile();
    });

    return button;
  }

  function toggle() {
    window.AppState.drawerOpen = !window.AppState.drawerOpen;
    update();
  }

  function closeOnMobile() {
    if (window.innerWidth < 992) {
      window.AppState.drawerOpen = false;
      update();
    }
  }

  function update() {
    if (!elements.drawer || !elements.shell) return;

    const isMobile = window.innerWidth < 992;

    if (isMobile) {
      elements.shell.classList.remove('drawer-collapsed');
      elements.drawer.classList.toggle('open', window.AppState.drawerOpen);
      elements.backdrop.classList.toggle('show', window.AppState.drawerOpen);
    } else {
      elements.drawer.classList.remove('open');
      elements.backdrop.classList.remove('show');
      elements.shell.classList.toggle('drawer-collapsed', !window.AppState.drawerOpen);
    }

    if (isMobile && !window.AppState.drawerOpen) {
      elements.drawer.setAttribute('aria-hidden', 'true');
      elements.drawer.setAttribute('inert', '');
    } else {
      elements.drawer.removeAttribute('aria-hidden');
      elements.drawer.removeAttribute('inert');
    }
  }

  window.Drawer = { init, renderChats, update };
})();
