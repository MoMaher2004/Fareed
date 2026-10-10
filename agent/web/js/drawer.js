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
    window.Events.on('drawer:update-chat-title', ({ chatId, title }) => {
      if (!elements.drawer) return;
      
      const chatItem = elements.drawer.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
      if (chatItem) {
        const labelEl = chatItem.querySelector('.chat-item-label');
        if (labelEl && labelEl.textContent !== title) {
          // Trigger animation
          labelEl.classList.add('title-updating');
          labelEl.textContent = title;
          
          // Remove animation class after it finishes
          setTimeout(() => {
            labelEl.classList.remove('title-updating');
          }, 800); // Match this with the CSS animation duration
        }
      }
    });
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

    const instructionsBtn = window.DomUtils.el('button', {
      type: 'button',
      class: 'drawer-action-btn'
    },
      window.DomUtils.el('i', { class: 'bi bi-journal-text' }),
      'Instructions'
    );

    instructionsBtn.addEventListener('click', () => {
      if (window.Instructions) {
        window.Instructions.openInstructionsPanel();
      }
      closeOnMobile();
    });

    elements.actions.append(instructionsBtn);

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

  function openRenameModal(chat) {
    const input = window.DomUtils.el('input', {
      type: 'text',
      class: 'form-control',
      value: chat.title || ''
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newTitle = input.value.trim();
        if (newTitle) {
          window.Communication.updateChatTitle(chat.id, newTitle);
          modal.close();
        }
      }
    });
    
    const body = window.DomUtils.el('div', {}, input);
    const saveBtn = window.DomUtils.el('button', { class: 'btn btn-primary', type: 'button' }, 'Save');
    const cancelBtn = window.DomUtils.el('button', { class: 'btn btn-outline-secondary', type: 'button' }, 'Cancel');
    
    const modal = window.DomUtils.showModal({
      title: 'Rename Chat',
      body,
      footer: window.DomUtils.el('div', { class: 'd-flex gap-2 justify-content-end w-100' }, cancelBtn, saveBtn)
    });

    cancelBtn.addEventListener('click', () => modal.close());
    saveBtn.addEventListener('click', () => {
      const newTitle = input.value.trim();
      if (newTitle) {
        window.Communication.updateChatTitle(chat.id, newTitle);
        modal.close();
      }
    });
    
    setTimeout(() => input.focus(), 100);
  }

  function openDeleteModal(chat) {
    const body = window.DomUtils.el('div', {},
      window.DomUtils.el('p', { class: 'mb-2' }, 'Are you sure you want to delete this chat?'),
      window.DomUtils.el('p', { class: 'fw-bold mb-1 text-break' }, chat.title || 'Untitled'),
      window.DomUtils.el('p', { class: 'text-muted small text-break mb-0' }, `ID: ${chat.id}`)
    );

    const deleteBtn = window.DomUtils.el('button', { class: 'btn btn-danger', type: 'button' }, 'Delete');
    const cancelBtn = window.DomUtils.el('button', { class: 'btn btn-outline-secondary', type: 'button' }, 'Cancel');

    const modal = window.DomUtils.showModal({
      title: 'Delete Chat',
      body,
      footer: window.DomUtils.el('div', { class: 'd-flex gap-2 justify-content-end w-100' }, cancelBtn, deleteBtn)
    });

    cancelBtn.addEventListener('click', () => modal.close());
    deleteBtn.addEventListener('click', () => {
      window.Communication.deleteChat(chat.id);
      modal.close();
    });
  }

  function createChatItem(chat) {
    const button = window.DomUtils.el('button', {
      type: 'button',
      class: `chat-item ${chat.id === window.AppState.currentChatId ? 'active' : ''}`,
      'data-chat-id': chat.id
    });

    const labelEl = window.DomUtils.el('span', { class: 'chat-item-label' }, chat.title || chat.id);
    
    // 3-dots Dropdown Container
    const dropdownContainer = window.DomUtils.el('div', { class: 'chat-item-options dropdown' });
    const dotsBtn = window.DomUtils.el('button', {
      type: 'button',
      class: 'chat-dots-btn',
      'data-bs-toggle': 'dropdown',
      'aria-expanded': 'false',
      'aria-label': 'Chat options'
    }, window.DomUtils.el('i', { class: 'bi bi-three-dots-vertical' }));

    dotsBtn.addEventListener('click', (e) => e.stopPropagation());

    const menu = window.DomUtils.el('ul', { class: 'dropdown-menu dropdown-menu-end shadow-sm' });

    // 1. Pin / Unpin Option
    const isPinned = Boolean(chat.pinned);
    const pinIcon = isPinned ? 'bi-pin-angle-fill' : 'bi-pin-angle';
    const pinLabel = isPinned ? 'Unpin' : 'Pin';
    
    const pinItem = window.DomUtils.el('li', {},
      window.DomUtils.el('button', { class: 'dropdown-item d-flex align-items-center gap-2', type: 'button' },
        window.DomUtils.el('i', { class: `bi ${pinIcon}` }),
        pinLabel
      )
    );
    pinItem.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      window.Communication.togglePinningChat(chat.id);
    });

    // 2. Rename Option
    const renameItem = window.DomUtils.el('li', {},
      window.DomUtils.el('button', { class: 'dropdown-item d-flex align-items-center gap-2', type: 'button' },
        window.DomUtils.el('i', { class: 'bi bi-pencil' }),
        'Rename'
      )
    );
    renameItem.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      openRenameModal(chat);
    });

    // 3. Delete Option
    const deleteItem = window.DomUtils.el('li', {},
      window.DomUtils.el('button', { class: 'dropdown-item text-danger d-flex align-items-center gap-2', type: 'button' },
        window.DomUtils.el('i', { class: 'bi bi-trash' }),
        'Delete'
      )
    );
    deleteItem.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteModal(chat);
    });

    menu.append(
      pinItem, 
      renameItem, 
      window.DomUtils.el('li', {}, window.DomUtils.el('hr', { class: 'dropdown-divider' })), 
      deleteItem
    );
    
    dropdownContainer.append(dotsBtn, menu);
    button.append(labelEl, dropdownContainer);

    button.addEventListener('click', (e) => {
      if (e.target.closest('.dropdown-menu')) return;
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
