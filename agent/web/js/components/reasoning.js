(function () {
  function create() {
    const content = window.DomUtils.el('div', { class: 'reasoning-content' });
    const details = window.DomUtils.el('details', { class: 'reasoning-block' },
      window.DomUtils.el('summary', {},
        window.DomUtils.el('i', { class: 'bi bi-lightbulb' }),
        'Reasoning'
      ),
      content
    );

    return {
      root: details,
      append(text) {
        content.textContent += String(text ?? '');
      },
      finalize() {
        // Reasoning is rendered only from backend-provided data.
      }
    };
  }

  window.ReasoningComponent = { create };
})();
