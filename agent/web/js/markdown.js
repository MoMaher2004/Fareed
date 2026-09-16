(function () {
  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (match) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match]));
  }

  if (window.marked) {
    try {
      if (typeof marked.use === 'function') {
        marked.use({ gfm: true, breaks: true });
      } else if (typeof marked.setOptions === 'function') {
        marked.setOptions({ gfm: true, breaks: true });
      }
    } catch (error) {
      console.warn('Markdown configuration failed', error);
    }
  }

  function render(text) {
    const source = String(text ?? '');
    if (!source.trim()) return '';

    if (window.marked && window.DOMPurify) {
      try {
        let html = marked.parse(source);
        html = DOMPurify.sanitize(html, {
          ADD_ATTR: ['target', 'rel']
        });
        return html;
      } catch (error) {
        console.warn('Markdown render failed, falling back to plain text', error);
      }
    }

    return `<p>${escapeHtml(source).replace(/\n/g, '<br>')}</p>`;
  }

  window.MarkdownRenderer = {
    render,
    escapeHtml
  };
})();
