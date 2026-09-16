(function () {
  function container() {
    return document.getElementById('hot-answers');
  }

  function maxItems() {
    return (window.APP_CONFIG.limits && window.APP_CONFIG.limits.maxHotAnswers) || 5;
  }

  function normalizeItem(item) {
    if (!item) return null;

    if (typeof item === 'string') {
      const label = item.trim();
      if (!label) return null;

      return {
        label,
        value: label
      };
    }

    if (typeof item === 'object') {
      const label = item.label || item.text || item.title || '';
      const value = item.value || item.prompt || label;

      if (!label) return null;

      return { label, value };
    }

    return null;
  }

  function normalizeList(items) {
    if (!Array.isArray(items)) return [];

    return items
      .map(normalizeItem)
      .filter(Boolean);
  }

  function createButton(item) {
    const button = window.DomUtils.el('button', {
      type: 'button',
      class: 'hot-answer-btn'
    }, item.label);

    button.addEventListener('click', () => {
      if (window.Chat) {
        clear();
        window.Chat.sendMessage(item.value);
      }
    });

    return button;
  }

  function hideIfEmpty() {
    const root = container();
    if (!root) return;

    if (!root.children.length) {
      root.classList.add('d-none');
    }
  }

  function clear() {
    const root = container();
    if (!root) return;

    window.DomUtils.clear(root);
    root.classList.add('d-none');
    window.AppState.hotAnswers = [];
  }

  function addItem(item) {
    if (!window.APP_CONFIG.features.hotAnswers) return;

    const root = container();
    if (!root) return;

    const normalized = normalizeItem(item);
    if (!normalized) return;

    // Avoid duplicates.
    const alreadyExists = window.AppState.hotAnswers.some(
      (existing) => existing.value === normalized.value
    );

    if (alreadyExists) return;

    // Respect maximum limit.
    if (window.AppState.hotAnswers.length >= maxItems()) {
      window.AppState.hotAnswers.shift();

      if (root.firstChild) {
        root.removeChild(root.firstChild);
      }
    }

    window.AppState.hotAnswers.push(normalized);
    root.append(createButton(normalized));
    root.classList.remove('d-none');

    window.Events.emit('hotAnswers:updated', window.AppState.hotAnswers);
  }

  function addItems(items) {
    normalizeList(items).forEach((item) => {
      addItem(item);
    });
  }

  function render(items) {
    clear();
    addItems(items);
  }

  window.HotAnswers = {
    render,
    addItem,
    addItems,
    clear
  };
})();