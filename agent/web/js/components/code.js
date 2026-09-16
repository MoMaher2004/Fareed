(function () {
  function highlightElement(codeEl) {
    if (!window.hljs) return;

    try {
      hljs.highlightElement(codeEl);
    } catch (error) {
      // Highlighting is optional.
    }
  }

  function create(data = {}, options = { streaming: false }) {
    const filename = data.filename || 'code.txt';
    const language = data.language || 'text';

    let code = String(data.code ?? '');

    const pre = window.DomUtils.el('pre', {
      class: 'code-viewer-body',
      style: `max-height:${window.APP_CONFIG.codeViewer.maxHeight}px`
    });

    const codeEl = window.DomUtils.el('code', { class: `language-${language}` }, code);
    pre.append(codeEl);

    if (!options.streaming) {
      highlightElement(codeEl);
    }

    function getText() {
      return code;
    }

    function append(text) {
      code += String(text ?? '');
      codeEl.textContent = code;
    }

    function replace(text) {
      code = String(text ?? '');
      codeEl.textContent = code;
    }

    function finalize() {
      highlightElement(codeEl);
    }

    function getMarkdown() {
      return `\n\`\`\`${language || 'text'}\n${code}\n\`\`\``;
    }

    const copyBtn = window.DomUtils.iconButton('bi-clipboard', 'Copy code', async (button) => {
      await window.DomUtils.copyText(getText());
      window.DomUtils.flashButton(button, 'bi-clipboard', 'bi-check');
    });

    const downloadBtn = window.DomUtils.iconButton('bi-download', 'Download code', () => {
      window.DownloadUtils.downloadText(filename, getText());
    });

    const expandBtn = window.DomUtils.iconButton('bi-arrows-fullscreen', 'Expand code', () => {
      const body = window.DomUtils.el('pre', { class: 'code-viewer-body expanded-code' }, getText());
      window.DomUtils.showModal({ title: filename, body, size: 'xl' });
    });

    const actions = window.DomUtils.el('div', { class: 'component-actions' }, copyBtn, downloadBtn);

    if (window.APP_CONFIG.features.codeExecution) {
      const runBtn = window.DomUtils.iconButton('bi-play-fill', 'Run code', (button) => {
        runCode(button);
      });

      actions.append(runBtn);
    }

    actions.append(expandBtn);

    const header = window.DomUtils.el('div', { class: 'component-header' },
      window.DomUtils.el('div', { class: 'component-title' },
        window.DomUtils.el('i', { class: 'bi bi-file-earmark-code' }),
        window.DomUtils.el('span', { class: 'component-filename' }, filename)
      ),
      window.DomUtils.el('div', { class: 'component-meta' },
        window.DomUtils.el('span', { class: 'badge language-badge' }, language)
      ),
      actions
    );

    const root = window.DomUtils.el('article', { class: 'code-component' }, header, pre);

    function runCode(button) {
      window.DomUtils.setButtonLoading(button, 'bi-play-fill');

      window.Communication.requestAvailableServers()
        .then((servers) => {
          window.DomUtils.setButtonIdle(button, 'bi-play-fill');
          openServerPicker(Array.isArray(servers) ? servers : [], {
            filename,
            language,
            code: getText()
          }, button);
        })
        .catch(() => {
          window.DomUtils.setButtonIdle(button, 'bi-play-fill');
          window.DomUtils.toast('Could not load execution servers.', 'danger');
        });
    }

    function openServerPicker(servers, payload, originButton) {
      const body = window.DomUtils.el('div', { class: 'list-group list-group-flush' });

      if (!servers.length) {
        body.append(window.DomUtils.el('div', { class: 'text-muted p-3' }, 'No execution servers available.'));
      }

      servers.forEach((server) => {
        const isOnline = !server.status || server.status === 'online' || server.status === 'available';

        const item = window.DomUtils.el('button', {
          type: 'button',
          class: 'list-group-item list-group-item-action server-item'
        },
          window.DomUtils.el('div', { class: 'd-flex justify-content-between align-items-center gap-2' },
            window.DomUtils.el('strong', {}, server.name || server.id || 'Server'),
            window.DomUtils.el('span', { class: `badge text-bg-${isOnline ? 'success' : 'secondary'}` }, server.status || 'unknown')
          ),
          window.DomUtils.el('div', { class: 'small text-muted' }, server.description || '')
        );

        if (!isOnline) item.disabled = true;

        item.addEventListener('click', () => {
          close();

          window.Communication.requestCodeExecution({
            ...payload,
            serverId: server.id,
            serverName: server.name
          })
            .then(() => {
              window.DomUtils.toast(`Execution requested on ${server.name || server.id}.`, 'success');
              if (originButton) window.DomUtils.flashButton(originButton, 'bi-play-fill', 'bi-check');
            })
            .catch(() => {
              window.DomUtils.toast('Execution request failed.', 'danger');
            });
        });

        body.append(item);
      });

      const { close } = window.DomUtils.showModal({
        title: 'Select execution server',
        body,
        size: 'md'
      });
    }

    return {
      root,
      append,
      replace,
      finalize,
      getText,
      getMarkdown
    };
  }

  window.CodeComponent = { create };
})();