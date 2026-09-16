(function () {
  function parseYouTubeId(url) {
    if (!url) return null;

    try {
      const parsed = new URL(url, window.location.href);

      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.split('/').filter(Boolean)[0] || null;
      }

      const v = parsed.searchParams.get('v');
      if (v) return v;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const known = parts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
      if (known >= 0 && parts[known + 1]) return parts[known + 1];
    } catch (error) {
      // Fall through to generic match.
    }

    const match = String(url).match(/([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function create(data = {}) {
    const url = data.url || data.src || '';
    const videoId = parseYouTubeId(url);
    const root = window.DomUtils.el('div', { class: 'youtube-component' });

    if (!videoId) {
      root.append(window.DomUtils.el('div', { class: 'image-broken' },
        window.DomUtils.el('i', { class: 'bi bi-youtube d-block mb-2' }),
        'Invalid YouTube URL'
      ));
      return { root };
    }

    const ratio = window.DomUtils.el('div', { class: 'youtube-ratio' });
    const iframe = window.DomUtils.el('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
      title: 'YouTube player',
      loading: 'lazy',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin'
    });

    ratio.append(iframe);
    root.append(ratio);
    return { root };
  }

  window.YouTubeEmbedComponent = { create };
})();
