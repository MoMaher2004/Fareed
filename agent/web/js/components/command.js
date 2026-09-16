(function () {
  function create(data = {}, options = { streaming: false }) {
    let command = String(data.command ?? data.content ?? '');
    const filename = data.filename || 'command.sh';

    const pre = window.DomUtils.el('pre', {
      class: 'code-viewer-body',
      style: `max-height:${window.APP_CONFIG.codeViewer.maxHeight}px`
    }, command);

    function getText() {
      return command;
    }

    function append(text) {
      command += String(text ?? '');
      pre.textContent = command;
    }

    function replace(text) {
      command = String(text ?? '');
      pre.textContent = command;
    }

    function finalize() {
      // Command blocks usually do not need syntax highlighting.
    }

    function getMarkdown() {
      return `\n\`\`\`bash\n${command}\n\`\`\``;
    }

    function getScript() {
      return command.startsWith('#!')
        ? command
        : `#!/usr/bin/env bash\nset -e\n\n${command}\n`;
    }

    const copyBtn = window.DomUtils.iconButton('bi-clipboard', 'Copy command', async (button) => {
      await window.DomUtils.copyText(getText());
      window.DomUtils.flashButton(button, 'bi-clipboard', 'bi-check');
    });

    const downloadBtn = window.DomUtils.iconButton('bi-download', 'Download as Bash script', () => {
      window.DownloadUtils.downloadText(filename, getScript(), 'text/x-shellscript;charset=utf-8');
    });

    const expandBtn = window.DomUtils.iconButton('bi-arrows-fullscreen', 'Expand command', () => {
      const body = window.DomUtils.el('pre', { class: 'code-viewer-body expanded-code' }, getText());
      window.DomUtils.showModal({ title: filename, body, size: 'lg' });
    });

    const header = window.DomUtils.el('div', { class: 'component-header' },
      window.DomUtils.el('div', { class: 'component-title' },
        window.DomUtils.el('i', { class: 'bi bi-terminal' }),
        window.DomUtils.el('span', { class: 'component-filename' }, filename)
      ),
      window.DomUtils.el('div', { class: 'component-meta' },
        window.DomUtils.el('span', { class: 'badge language-badge' }, 'bash')
      ),
      window.DomUtils.el('div', { class: 'component-actions' }, copyBtn, downloadBtn, expandBtn)
    );

    const root = window.DomUtils.el('article', { class: 'command-component' }, header, pre);

    return {
      root,
      append,
      replace,
      finalize,
      getText,
      getMarkdown
    };
  }

  window.CommandComponent = { create };
})();