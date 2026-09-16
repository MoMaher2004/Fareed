(function () {
  function routingConfig() {
    return (window.APP_CONFIG && APP_CONFIG.routing) || {};
  }

  function normalizedPrefix() {
    let prefix = routingConfig().chatPrefix || '/chat/';
    if (!prefix.startsWith('/')) prefix = `/${prefix}`;
    if (!prefix.endsWith('/')) prefix = `${prefix}/`;
    return prefix;
  }

  function buildChatUrl(chatId) {
    const cfg = routingConfig();
    if (!chatId) {
      return cfg.useHash ? `${window.location.pathname}#` : (cfg.basePath || '/');
    }

    const prefix = normalizedPrefix();
    if (cfg.useHash) {
      return `${window.location.pathname}#${prefix}${encodeURIComponent(chatId)}`;
    }

    return `${cfg.basePath || ''}${prefix}${encodeURIComponent(chatId)}`;
  }

  function getChatId() {
    try {
      const cfg = routingConfig();
      const prefix = normalizedPrefix();
      const source = cfg.useHash
        ? window.location.hash.replace(/^#/, '')
        : window.location.pathname;

      if (!source) return null;

      const index = source.indexOf(prefix);
      if (index === -1) return null;

      const rest = source.slice(index + prefix.length);
      const id = rest.split(/[/?#]/)[0];
      return id ? decodeURIComponent(id) : null;
    } catch (error) {
      console.warn('Router.getChatId failed', error);
      return null;
    }
  }

  function buildRootUrl() {
    const cfg = routingConfig();

    if (cfg.useHash) {
      return window.location.pathname + window.location.search;
    }

    return cfg.basePath || '/';
  }

  function setRoot(replace = true) {
    const url = buildRootUrl();

    try {
      window.history[replace ? 'replaceState' : 'pushState'](
        { chatId: null },
        '',
        url
      );
    } catch (error) {
      if (routingConfig().useHash) {
        window.location.hash = '';
      }
    }

    window.AppState.currentChatId = null;
    window.Events.emit('router:chatId', null);
  }

  function navigateToRoot() {
    if (window.Chat && typeof window.Chat.startNewChat === 'function') {
      window.Chat.startNewChat();
    } else {
      setRoot(false);
    }
  }

  function setChatId(chatId, replace = false) {
    if (!chatId) return;

    const url = buildChatUrl(chatId);
    const cfg = routingConfig();

    try {
      if (cfg.useHash) {
        if (replace) {
          window.location.replace(url);
        } else {
          window.location.hash = url.split('#')[1] || '';
        }
      } else {
        window.history[replace ? 'replaceState' : 'pushState']({ chatId }, '', url);
      }
    } catch (error) {
      console.warn('Router.setChatId failed', error);
    }

    window.AppState.currentChatId = chatId;
    window.Events.emit('router:chatId', chatId);
  }

  function navigateToChat(chatId) {
    if (!chatId) return;
    setChatId(chatId, false);
    if (window.Chat) window.Chat.openChat(chatId);
  }

  function init(onChange) {
    const cfg = routingConfig();
    const eventName = cfg.useHash ? 'hashchange' : 'popstate';

    window.addEventListener(eventName, () => {
      if (typeof onChange === 'function') onChange(getChatId());
    });

    if (typeof onChange === 'function') onChange(getChatId());
  }

  window.Router = {
    buildChatUrl,
    getChatId,
    setChatId,
    navigateToChat,
    navigateToRoot,
    setRoot,
    init
  };
})();
