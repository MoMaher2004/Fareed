(function () {
  function isValidUrl(src) {
    try {
      const url = new URL(src, window.location.href);
      return ['http:', 'https:', 'data:'].includes(url.protocol);
    } catch (error) {
      return false;
    }
  }

  function create(data = {}) {
    const src = data.src || data.url || '';
    const alt = data.alt || 'Assistant image';
    const root = window.DomUtils.el('figure', { class: 'image-component' });
    const frame = window.DomUtils.el('div', { class: 'image-frame' });
    const skeleton = window.DomUtils.el('div', { class: 'image-skeleton' },
      window.DomUtils.el('i', { class: 'bi bi-image' })
    );

    frame.append(skeleton);
    root.append(frame);

    if (!isValidUrl(src)) {
      skeleton.remove();
      frame.append(window.DomUtils.el('div', { class: 'image-broken' },
        window.DomUtils.el('i', { class: 'bi bi-image-alt d-block mb-2' }),
        'Image unavailable'
      ));
      return { root };
    }

    const img = window.DomUtils.el('img', {
      class: 'chat-image',
      loading: 'lazy',
      alt,
      src
    });

    img.addEventListener('load', () => {
      skeleton.remove();
      img.classList.add('loaded');
    });

    img.addEventListener('error', () => {
      skeleton.remove();
      img.remove();
      frame.append(window.DomUtils.el('div', { class: 'image-broken' },
        window.DomUtils.el('i', { class: 'bi bi-image-alt d-block mb-2' }),
        'Failed to load image'
      ));
    });

    img.addEventListener('click', () => {
      if (!img.classList.contains('loaded')) return;
      const expanded = window.DomUtils.el('img', {
        src,
        alt,
        class: 'img-fluid rounded'
      });
      window.DomUtils.showModal({ title: 'Image preview', body: expanded, size: 'xl' });
    });

    frame.append(img);
    return { root };
  }

  window.ImageComponent = { create };
})();
