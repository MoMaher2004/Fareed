(function () {
  const listeners = Object.create(null);

  window.Events = {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
      return () => this.off(event, fn);
    },

    off(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((item) => item !== fn);
    },

    emit(event, payload) {
      const subs = listeners[event];
      if (!subs || !subs.length) return;
      subs.slice().forEach((fn) => {
        try {
          fn(payload);
        } catch (error) {
          console.error(`Event handler error for ${event}`, error);
        }
      });
    }
  };

  window.AppState = {
    theme: 'dark',
    connection: 'offline',
    currentChatId: null,
    chats: [],
    sendEnabled: true,
    sendState: 'enabled',
    isStreaming: false,
    streamingMessageId: null,
    toolRequests: [],
    drawerOpen: window.innerWidth >= 992,
    recording: 'idle',
    transcription: 'idle',
    systemMessage: false,
    hotAnswers: []
  };

  window.StateStore = {
    set(patch) {
      Object.assign(window.AppState, patch || {});
      window.Events.emit('state:change', window.AppState);
    }
  };
})();
