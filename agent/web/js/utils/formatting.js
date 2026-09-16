(function () {
  function formatTime(timestamp) {
    try {
      return new Date(timestamp || Date.now()).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  }

  function prettyJson(value) {
    try {
      if (typeof value === 'string') return value;
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value ?? '');
    }
  }

  function truncate(text, length = 90) {
    const value = String(text ?? '');
    return value.length > length ? `${value.slice(0, length)}…` : value;
  }

  window.FormattingUtils = {
    formatTime,
    prettyJson,
    truncate
  };
})();
