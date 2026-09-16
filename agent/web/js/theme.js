(function () {
  function storageKey() {
    return (window.APP_CONFIG && APP_CONFIG.theme && APP_CONFIG.theme.storageKey) || 'agent-ui-theme';
  }

  function defaultTheme() {
    return (window.APP_CONFIG && APP_CONFIG.theme && APP_CONFIG.theme.default) || 'dark';
  }

  function getSavedTheme() {
    try {
      return localStorage.getItem(storageKey());
    } catch (error) {
      return null;
    }
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.body.setAttribute('data-theme', theme);
    window.AppState.theme = theme;

    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
      icon.className = theme === 'dark' ? 'bi bi-sun-stars' : 'bi bi-moon-stars';
    }
  }

  window.ThemeManager = {
    init() {
      const saved = getSavedTheme();
      apply(saved || defaultTheme());

      const toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.addEventListener('click', () => this.toggle());
      }
    },

    get() {
      return document.documentElement.getAttribute('data-bs-theme') || 'dark';
    },

    set(theme) {
      const next = theme === 'light' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem(storageKey(), next);
      } catch (error) {
        // Storage is optional.
      }
      window.Events.emit('theme:changed', next);
    },

    toggle() {
      this.set(this.get() === 'dark' ? 'light' : 'dark');
    }
  };
})();
