(function () {
  function create(message) {
    return window.DomUtils.el(
      'div',
      { class: 'alert alert-danger d-flex align-items-start gap-2 error-component', role: 'alert' },
      window.DomUtils.el('i', { class: 'bi bi-exclamation-triangle-fill mt-1' }),
      window.DomUtils.el('div', { class: 'error-text' }, String(message ?? 'Unknown error'))
    );
  }

  window.ErrorComponent = { create };
})();
