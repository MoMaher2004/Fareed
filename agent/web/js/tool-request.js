(function () {
  const elements = {};

  function init() {
    elements.panel = document.getElementById('tool-request-panel');
    elements.list = document.getElementById('tool-request-list');
    elements.count = document.getElementById('tool-request-count');
  }

  function normalizeOptions(options) {
    if (!Array.isArray(options)) return [];

    return options
      .map((option) => {
        if (typeof option === 'string') {
          return {
            id: option,
            label: option,
            value: option
          };
        }

        if (option && typeof option === 'object') {
          const id =
            option.id ||
            option.value ||
            option.name ||
            option.label ||
            'action';

          const label =
            option.label ||
            option.text ||
            option.title ||
            option.name ||
            id;

          return {
            id,
            label,
            value: option.value ?? option.id ?? id,
            style: option.style && typeof option.style === 'object' ? option.style : null
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  function extractToolName(request) {
    if (!request || typeof request !== 'object') return 'tool';

    if (request.tool && typeof request.tool === 'object') {
      return request.tool.name || request.tool.tool || request.tool.tool_name || 'tool';
    }

    return (
      request.tool_name ||
      request.tool ||
      request.name ||
      'tool'
    );
  }

  function extractToolArguments(request) {
    if (!request || typeof request !== 'object') return null;

    if (request.tool && typeof request.tool === 'object') {
      if (request.tool.arguments !== undefined) return request.tool.arguments;
      if (request.tool.args !== undefined) return request.tool.args;
      if (request.tool.input !== undefined) return request.tool.input;
    }

    if (request.arguments !== undefined) return request.arguments;
    if (request.args !== undefined) return request.args;
    if (request.input !== undefined) return request.input;

    return null;
  }

  function extractRequestId(request) {
    if (!request || typeof request !== 'object') return null;

    return (
      request.tool_call_id ||
      request.toolCallId ||
      request.call_id ||
      request.callId ||
      request.request_id ||
      request.requestId ||
      request.id ||
      null
    );
  }

  function normalizeRequests(chunk) {
    const content = chunk && chunk.content;

    let list = [];

    if (Array.isArray(content)) {
      list = content;
    } else if (content && Array.isArray(content.requests)) {
      list = content.requests;
    } else if (content && typeof content === 'object') {
      list = [content];
    } else if (chunk && typeof chunk === 'object') {
      // Supports flat chunks like:
      // {
      //   type: 'request_tool',
      //   tool_call_id: '...',
      //   tool: { name, arguments },
      //   options: [...]
      // }
      list = [chunk];
    }

    return list
      .map((request, index) => {
        if (!request || typeof request !== 'object') return null;

        const toolName = extractToolName(request);
        const id = extractRequestId(request) || `request_${Date.now()}_${index}`;

        return {
          id,
          tool_call_id: id,
          tool: toolName,
          title: request.title || `Tool: ${toolName}`,
          description: request.description || request.reason || '',
          arguments: extractToolArguments(request),
          options: normalizeOptions(request.options),
          resolved: false,
          pending: false,
          raw: request
        };
      })
      .filter(Boolean)
      .slice(0, (window.APP_CONFIG && window.APP_CONFIG.ui && window.APP_CONFIG.ui.maxVisibleToolRequests) || 20);
  }

  function handleChunk(chunk) {
    window.AppState.toolRequests = normalizeRequests(chunk);
    render();
  }

  function render() {
    if (!elements.panel || !elements.list) return;

    window.DomUtils.clear(elements.list);

    const unresolved = window.AppState.toolRequests.filter((request) => !request.resolved);

    if (elements.count) {
      elements.count.textContent = String(unresolved.length);
    }

    if (!unresolved.length) {
      hide();
      return;
    }

    show();

    unresolved.forEach((request) => {
      elements.list.append(createRequestCard(request));
    });
  }

  function show() {
    if (!elements.panel) return;

    elements.panel.classList.add('open');
    elements.panel.setAttribute('aria-hidden', 'false');

    document.getElementById('app-shell')?.classList.add('tool-open');
  }

  function hide() {
    if (!elements.panel) return;

    elements.panel.classList.remove('open');
    elements.panel.setAttribute('aria-hidden', 'true');

    document.getElementById('app-shell')?.classList.remove('tool-open');
  }

  function createRequestCard(request) {
    const card = window.DomUtils.el('div', { class: 'tool-request-card' });

    card.append(
      window.DomUtils.el('div', { class: 'tool-request-title' }, request.title)
    );

    if (request.description) {
      card.append(
        window.DomUtils.el('div', { class: 'tool-request-desc' }, request.description)
      );
    }

    card.append(
      window.DomUtils.el('div', { class: 'tool-request-meta' },
        `Tool: ${request.tool}`,
        request.tool_call_id ? `Tool call ID: ${request.tool_call_id}` : ''
      )
    );

    if (request.arguments !== null && request.arguments !== undefined) {
      const argsDetails = window.DomUtils.el('details', { class: 'tool-request-args-details' },
        window.DomUtils.el('summary', {}, 'Arguments'),
        window.DomUtils.el('pre', { class: 'tool-request-args' },
          window.FormattingUtils.prettyJson(request.arguments)
        )
      );

      card.append(argsDetails);
    }

    const actions = window.DomUtils.el('div', { class: 'tool-request-actions' });

    if (!request.options.length) {
      card.append(
        window.DomUtils.el('div', { class: 'text-muted small' }, 'No options provided.')
      );
    }

    request.options.forEach((option) => {
      const button = window.DomUtils.el('button', {
        type: 'button',
        class: (window.APP_CONFIG.toolRequestDefaults && window.APP_CONFIG.toolRequestDefaults.buttonClass) ||
          'btn btn-sm tool-option-btn'
      }, option.label);

      applyStyle(button, option.style);

      button.addEventListener('click', () => {
        selectOption(request, option, button, actions);
      });

      actions.append(button);
    });

    card.append(actions);

    return card;
  }

  function applyStyle(button, style) {
    try {
      if (!style || typeof style !== 'object') return;

      if (typeof style.background === 'string') button.style.backgroundColor = style.background;
      if (typeof style.backgroundColor === 'string') button.style.backgroundColor = style.backgroundColor;
      if (typeof style.color === 'string') button.style.color = style.color;
      if (typeof style.fontColor === 'string') button.style.color = style.fontColor;
      if (typeof style.border === 'string') button.style.border = style.border;
      if (typeof style.borderColor === 'string') button.style.borderColor = style.borderColor;
    } catch (error) {
      console.warn('Ignoring malformed tool option style', error);
    }
  }

  function selectOption(request, option, button, actions) {
    if (request.resolved || request.pending) return;

    request.pending = true;

    actions.querySelectorAll('button').forEach((item) => {
      item.disabled = true;
    });

    button.classList.add('selected');

    const payload = {
      chatId: window.AppState.currentChatId,

      // Compatible fields.
      requestId: request.id,
      request_id: request.id,

      // Your backend uses tool_call_id as the request id.
      tool_call_id: request.tool_call_id || request.id,

      tool: request.tool,

      optionId: option.id,
      option_id: option.id,
      option: option.id,

      optionValue: option.value ?? option.id,
      value: option.value ?? option.id
    };

    window.Communication.sendToolResponse(payload)
      .then(() => {
        request.resolved = true;

        window.AppState.toolRequests = window.AppState.toolRequests.filter(
          (item) => item.id !== request.id
        );

        render();
      })
      .catch(() => {
        request.pending = false;

        actions.querySelectorAll('button').forEach((item) => {
          item.disabled = false;
        });

        button.classList.remove('selected');

        window.DomUtils.toast('Failed to send tool response.', 'danger');
      });
  }

  window.ToolRequestPanel = {
    init,
    handleChunk,
    render
  };
})();