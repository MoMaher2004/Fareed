(function () {
  function create(data = {}) {
    const src = data.src || data.url || '';
    const root = window.DomUtils.el('div', { class: 'audio-component' });

    if (!src) {
      root.append(window.ErrorComponent.create('Audio source is missing.'));
      return { root };
    }

    const status = window.DomUtils.el('div', { class: 'small text-muted mb-2' }, 'Loading audio…');
    const audio = window.DomUtils.el('audio', { controls: true, preload: 'metadata' });

    audio.src = src;

    audio.addEventListener('loadeddata', () => {
      status.textContent = 'Audio ready.';
    });

    audio.addEventListener('canplay', () => {
      status.textContent = 'Audio ready.';
    });

    audio.addEventListener('error', () => {
      status.textContent = 'Audio failed to load.';
      status.classList.add('text-danger');
    });

    root.append(status, audio);
    return { root };
  }

  window.AudioComponent = { create };
})();
