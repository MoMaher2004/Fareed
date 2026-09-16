(function () {
  function pretty(value) {
    return window.FormattingUtils.prettyJson(value);
  }

  function create(data = {}) {
    const state = {
      callId: data.callId || data.tool_call_id || data.id || data.tool_id || '',
      name: data.name || data.tool || 'tool',
      arguments: data.arguments ?? data.args ?? null,
      result: data.result ?? data.response ?? null,
      status: data.status || (
        data.result !== undefined && data.result !== null ? 'done' : 'running'
      )
    };

    const statusIcon = window.DomUtils.el('i', { class: 'bi bi-arrow-repeat spin' });
    const titleLabel = window.DomUtils.el('span', { class: 'tool-usage-title' }, `Tool: ${state.name}`);
    const summary = window.DomUtils.el('summary', {}, statusIcon, titleLabel);

    const nameValue = window.DomUtils.el('div', { class: 'detail-value tool-usage-name' }, String(state.name));

    const callIdValue = window.DomUtils.el('div', { class: 'detail-value tool-usage-call-id' }, String(state.callId || '—'));

    const argsValue = window.DomUtils.el('pre', { class: 'tool-usage-args' },
      state.arguments === null || state.arguments === undefined ? '—' : pretty(state.arguments)
    );

    const resultValue = window.DomUtils.el('pre', { class: 'tool-usage-result' },
      state.result === null || state.result === undefined ? 'Waiting for result…' : pretty(state.result)
    );

    const body = window.DomUtils.el('div', { class: 'tool-usage-body' },
      window.DomUtils.el('div', { class: 'detail-row' },
        window.DomUtils.el('div', { class: 'detail-label' }, 'Tool name'),
        nameValue
      ),
      window.DomUtils.el('div', { class: 'detail-row' },
        window.DomUtils.el('div', { class: 'detail-label' }, 'Tool call ID'),
        callIdValue
      ),
      window.DomUtils.el('div', { class: 'detail-row' },
        window.DomUtils.el('div', { class: 'detail-label' }, 'Arguments'),
        window.DomUtils.el('div', { class: 'detail-value' }, argsValue)
      ),
      window.DomUtils.el('div', { class: 'detail-row' },
        window.DomUtils.el('div', { class: 'detail-label' }, 'Result'),
        window.DomUtils.el('div', { class: 'detail-value' }, resultValue)
      )
    );

    const root = window.DomUtils.el('details', { class: 'tool-usage' }, summary, body);

    function setStatus(status) {
      state.status = status;
      root.classList.remove('tool-running', 'tool-done', 'tool-error');

      if (status === 'running') {
        statusIcon.className = 'bi bi-arrow-repeat spin';
        root.classList.add('tool-running');
      } else if (status === 'error') {
        statusIcon.className = 'bi bi-x-circle-fill';
        root.classList.add('tool-error');
      } else {
        statusIcon.className = 'bi bi-check-circle-fill';
        root.classList.add('tool-done');
      }
    }

    function update(data2 = {}) {
      if (data2.name || data2.tool) {
        state.name = data2.name || data2.tool;
        titleLabel.textContent = `Tool: ${state.name}`;
        nameValue.textContent = String(state.name);
      }

      if (data2.callId || data2.tool_call_id || data2.id) {
        state.callId = data2.callId || data2.tool_call_id || data2.id;
        callIdValue.textContent = String(state.callId);
      }

      if (data2.arguments !== undefined || data2.args !== undefined) {
        state.arguments = data2.arguments ?? data2.args;
        argsValue.textContent =
          state.arguments === null || state.arguments === undefined
            ? '—'
            : pretty(state.arguments);
      }

      if (data2.result !== undefined || data2.response !== undefined) {
        state.result = data2.result ?? data2.response;
        resultValue.textContent = pretty(state.result);
      }

      if (data2.status) {
        setStatus(data2.status);
      }
    }

    setStatus(state.status);

    return {
      root,
      update,
      setStatus,
      getState: () => ({ ...state })
    };
  }

  window.ToolUsageComponent = { create };
})();