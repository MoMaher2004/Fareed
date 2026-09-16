(function () {
  const elements = {};
  let autoScroll = true;
  let streamCtx = null;

  function init() {
    elements.scroll = document.getElementById('chat-scroll');
    elements.messages = document.getElementById('chat-messages');
    elements.jump = document.getElementById('jump-latest');

    if (elements.scroll) {
      elements.scroll.addEventListener('scroll', () => {
        autoScroll = window.DomUtils.isNearBottom(elements.scroll, window.APP_CONFIG.ui.scrollThreshold);
        updateJumpButton();
      }, { passive: true });
    }

    if (elements.jump) {
      elements.jump.addEventListener('click', () => {
        autoScroll = true;
        window.DomUtils.scrollToBottom(elements.scroll, true);
        updateJumpButton();
      });
    }

    window.Events.on('chat:contentChanged', () => onContentChanged(false));
  }

  function startNewChat({ updateUrl = true } = {}) {
    const previousChatId = window.AppState.currentChatId;

    // Send remove_chat_session signal before leaving the old chat.
    if (previousChatId && window.Communication.removeChatSession) {
      window.Communication.removeChatSession(previousChatId)
        .catch((error) => {
          console.warn('Failed to send remove_chat_session:', error);
        });
    }

    finalizeStreamingMessage();

    window.AppState.currentChatId = null;

    if (updateUrl) {
      window.Router.setRoot(true);
    }

    clearMessages();

    if (window.HotAnswers) {
      window.HotAnswers.clear();
    }

    if (window.Drawer && typeof window.Drawer.renderChats === 'function') {
      window.Drawer.renderChats();
    }

    showWelcome();

    window.Events.emit('sendState', 'enabled');
  }

  function extractUserText(content) {
    if (content === null || content === undefined) return '';

    if (typeof content === 'string') return content;

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (!item) return '';
          if (typeof item === 'string') return item;
          if (typeof item === 'object') {
            return item.content || item.text || '';
          }
          return String(item);
        })
        .filter(Boolean)
        .join('\n');
    }

    if (typeof content === 'object') {
      return content.content || content.text || window.FormattingUtils.prettyJson(content);
    }

    return String(content);
  }

  function normalizeHistoryToolResult(entry) {
    return {
      callId:
        entry.tool_call_id ||
        entry.toolCallId ||
        entry.call_id ||
        entry.callId ||
        entry.id ||
        null,

      name:
        entry.name ||
        entry.tool ||
        entry.tool_name ||
        null,

      arguments:
        entry.arguments ??
        entry.args ??
        undefined,

      result:
        entry.result ??
        entry.response ??
        entry.output ??
        null,

      error:
        entry.error ??
        null,

      status:
        entry.status || 'done'
    };
  }

  function extractToolCallId(chunk) {
    if (!chunk || typeof chunk !== 'object') return null;

    return (
      chunk.tool_call_id ||
      chunk.toolCallId ||
      chunk.call_id ||
      chunk.callId ||
      chunk.id ||
      chunk.tool_id ||
      (chunk.content && typeof chunk.content === 'object'
        ? chunk.content.tool_call_id ||
          chunk.content.toolCallId ||
          chunk.content.call_id ||
          chunk.content.callId ||
          chunk.content.id ||
          chunk.content.tool_id
        : null) ||
      null
    );
  }

  function renderBackendHistory(rawMessages) {
    if (!Array.isArray(rawMessages)) return;

    window.HotAnswers.clear();

    let assistantController = null;
    let lastMessageHotAnswers = []; // Tracks hot answers for the current/last assistant turn

    function ensureAssistantController() {
      if (assistantController) return assistantController;

      const id = `assistant_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      assistantController = window.MessageComponents.createAssistantMessage({ id });
      appendRoot(assistantController.root);

      return assistantController;
    }

    function finalizeAssistantController() {
      if (assistantController) {
        assistantController.finalize();
        assistantController = null;
      }
    }

    rawMessages.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;

      // -----------------------------
      // USER MESSAGE
      // -----------------------------
      if (entry.role === 'user') {
        finalizeAssistantController();
        lastMessageHotAnswers = []; // Reset hot answers when a new user turn starts

        const userRoot = window.MessageComponents.createUserMessage({
          id: `user_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          content: extractUserText(entry.content)
        });

        appendRoot(userRoot);
        return;
      }

      // -----------------------------
      // TOOL START IN HISTORY
      // -----------------------------
      if (entry.type === 'tool_start' || entry.type === 'tool_call') {
        const controller = ensureAssistantController();

        controller.startTool({
          callId: entry.tool_call_id || entry.toolCallId || entry.call_id || entry.callId || null,
          name: entry.name || entry.tool || entry.tool_name || 'tool',
          arguments: entry.arguments ?? entry.args ?? entry.input ?? null
        });

        return;
      }

      // -----------------------------
      // TOOL RESULT IN HISTORY
      // -----------------------------
      if (
        entry.type === 'tool_result' ||
        entry.type === 'tool_response' ||
        entry.tool_call_id ||
        entry.toolCallId ||
        entry.result !== undefined
      ) {
        const controller = ensureAssistantController();
        controller.completeTool(normalizeHistoryToolResult(entry));
        return;
      }

      // -----------------------------
      // ASSISTANT ENTRIES
      // -----------------------------
      if (entry.role === 'assistant') {
        const controller = ensureAssistantController();

        if (entry.type === 'reasoning') {
          controller.appendReasoning(entry.content ?? '');
          return;
        }

        if (entry.type === 'message') {
          const blocks = Array.isArray(entry.content)
            ? entry.content
            : [{ type: 'text', content: entry.content }];

          blocks.forEach((block) => {
            if (!block || typeof block !== 'object') return;

            const blockType = block.type || 'text';
            const attributes = block.attributes || {};

            switch (blockType) {
              case 'text':
              case 'markdown':
                controller.addMarkdownSegmentFinal(block.content ?? '');
                break;

              case 'code':
                controller.addCode({
                  code: block.content ?? '',
                  filename: attributes.filename || block.filename || 'code.txt',
                  language: attributes.lang || attributes.language || block.language || 'text'
                });
                break;

              case 'command':
              case 'bash':
              case 'shell':
                controller.addCommand({
                  command: block.content ?? '',
                  filename: attributes.filename || block.filename || 'command.sh'
                });
                break;

              case 'image':
                controller.addImage({
                  src: block.content || block.url || block.src || '',
                  alt: attributes.alt || block.alt || 'image'
                });
                break;

              case 'audio':
                controller.addAudio({
                  src: block.content || block.url || block.src || ''
                });
                break;

              case 'youtube_embed':
              case 'youtube':
                controller.addYouTube({
                  url: block.content || block.url || ''
                });
                break;

              case 'hotanswer':
              case 'hot_answer':
                // Collect instead of rendering inline
                const label = String(block.content ?? '').trim();
                if (label) lastMessageHotAnswers.push(label);
                break;

              default:
                controller.addUnsupported(blockType);
                break;
            }
          });

          return;
        }

        if (entry.content !== undefined && entry.content !== null) {
          controller.addMarkdownSegmentFinal(
            typeof entry.content === 'string'
              ? entry.content
              : window.FormattingUtils.prettyJson(entry.content)
          );
        }

        return;
      }

      console.debug('Unknown history entry ignored:', entry);
    });

    finalizeAssistantController();

    // Render ONLY the hot answers from the very last assistant message above the composer
    if (lastMessageHotAnswers.length > 0) {
      window.HotAnswers.render(lastMessageHotAnswers);
    }
  }

  function normalizeToolStart(chunk) {
    const content =
      chunk.content && typeof chunk.content === 'object'
        ? chunk.content
        : {};

    return {
      callId: extractToolCallId(chunk),

      name:
        chunk.name ||
        chunk.tool ||
        chunk.tool_name ||
        content.name ||
        content.tool ||
        content.tool_name ||
        'tool',

      arguments:
        chunk.arguments ??
        chunk.args ??
        chunk.input ??
        content.arguments ??
        content.args ??
        content.input ??
        null
    };
  }

  function normalizeToolResult(chunk) {
    const content =
      chunk.content && typeof chunk.content === 'object'
        ? chunk.content
        : {};

    return {
      callId: extractToolCallId(chunk),

      name:
        chunk.name ||
        chunk.tool ||
        chunk.tool_name ||
        content.name ||
        content.tool ||
        content.tool_name ||
        null,

      arguments:
        chunk.arguments ??
        chunk.args ??
        content.arguments ??
        content.args ??
        undefined,

      result:
        chunk.result ??
        chunk.response ??
        chunk.output ??
        content.result ??
        content.response ??
        content.output ??
        null,

      error:
        chunk.error ??
        content.error ??
        null,

      status:
        chunk.status ??
        content.status ??
        null
    };
  }

  function clearMessages() {
    if (elements.messages) window.DomUtils.clear(elements.messages);
    streamCtx = null;
    autoScroll = true;
    window.AppState.isStreaming = false;
    window.AppState.streamingMessageId = null;
    updateJumpButton();
  }

  function appendRoot(root) {
    if (!elements.messages) return;
    elements.messages.append(root);
    onContentChanged(true);
  }

  function ensureStreamContext() {
    if (streamCtx) return streamCtx;

    const id = `assistant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const controller = window.MessageComponents.createAssistantMessage({ id });
    appendRoot(controller.root);

    streamCtx = controller;
    window.AppState.isStreaming = true;
    window.AppState.streamingMessageId = id;
    return controller;
  }

  function extractText(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      return value.message || value.text || value.content || window.FormattingUtils.prettyJson(value);
    }
    return String(value ?? '');
  }

  function extractUrl(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      return value.url || value.src || value.link || '';
    }
    return '';
  }

  function handleChunk(chunk) {
    if (!chunk || typeof chunk !== 'object') return;

    try {
      switch (chunk.type) {
        case 'end':
          finalizeStreamingMessage();
          break;

        case 'tool_request':
          if (window.ToolRequestPanel) window.ToolRequestPanel.handleChunk(chunk);
          break;

        case 'reasoning':
          if (!window.APP_CONFIG.features.reasoning) return;
          ensureStreamContext().appendReasoning(extractText(chunk.content));
          notifyContentChanged();
          break;

        case 'tool_usage':
          if (!window.APP_CONFIG.features.toolUsage) return;
          ensureStreamContext().addToolUsage(normalizeToolUsage(chunk.content));
          notifyContentChanged();
          break;

        case 'error':
          ensureStreamContext().addError(extractText(chunk.content));
          notifyContentChanged();
          break;

        case 'message':
          handleMessageChunk(chunk);
          notifyContentChanged();
          break;

        case 'tool_start':
        case 'tool_call':
        case 'tool_use':
          if (!window.APP_CONFIG.features.toolUsage) return;
          ensureStreamContext().startTool(normalizeToolStart(chunk));
          notifyContentChanged();
          break;

        case 'tool_result':
        case 'tool_response':
        case 'tool_done':
          if (!window.APP_CONFIG.features.toolUsage) return;
          ensureStreamContext().completeTool(normalizeToolResult(chunk));
          notifyContentChanged();
          break;

        default:
          console.debug('Unknown chunk type ignored:', chunk.type);
      }
    } catch (error) {
      console.error('Failed to handle chunk', error);
    }
  }

  function normalizeToolUsage(content) {
    if (content && typeof content === 'object') return content;
    return { name: 'tool', result: content };
  }

  function handleMessageChunk(chunk) {
    const contentType = chunk.content_type || chunk.contentType || 'text';
    const content = chunk.content ?? '';
    const metadata = chunk.metadata || {};

    // Hot answers are message chunks, but they are rendered above the composer,
    // not inside the assistant message.
    if (contentType === 'hotanswers' || contentType === 'suggestions') {
      const items = Array.isArray(content)
        ? content
        : metadata.items || metadata.answers || metadata.hot_answers || [];

      if (items.length) {
        window.HotAnswers.render(items);
      } else {
        window.HotAnswers.clear();
      }

      return;
    }

    if (contentType === 'hotanswer' || contentType === 'suggestion') {
      window.HotAnswers.addItem(content);
      return;
    }

    const controller = ensureStreamContext();

    switch (contentType) {
      case 'text':
      case 'markdown':
        controller.appendMarkdown(extractText(content));
        break;

      case 'code': {
        const codeData = typeof content === 'object' && content !== null ? content : { code: content };

        controller.appendCode({
          blockId:
            metadata.block_id ||
            metadata.blockId ||
            codeData.block_id ||
            codeData.blockId ||
            null,

          mode:
            metadata.mode ||
            codeData.mode ||
            'append',

          filename:
            metadata.filename ||
            codeData.filename ||
            'code.txt',

          language:
            metadata.language ||
            codeData.language ||
            'text',

          code: String(codeData.code ?? '')
        });

        break;
      }

      case 'command': {
        const commandData = typeof content === 'object' && content !== null ? content : { command: content };
        controller.appendCommand({
          blockId:
            metadata.block_id ||
            metadata.blockId ||
            commandData.block_id ||
            commandData.blockId ||
            null,

          mode:
            metadata.mode ||
            commandData.mode ||
            'append',
          command: String(commandData.command ?? commandData.content ?? ''),
          filename: metadata.filename || commandData.filename || 'command.sh'
        });
        break;
      }

      case 'image':
        controller.addImage({ src: extractUrl(content), alt: metadata.alt || 'image' });
        break;

      case 'audio':
        controller.addAudio({ src: extractUrl(content) });
        break;

      case 'youtube_embed':
      case 'youtube':
        controller.addYouTube({ url: extractUrl(content) });
        break;

      default:
        controller.addUnsupported(contentType);
    }
  }

  function finalizeStreamingMessage() {
    if (streamCtx) {
      streamCtx.finalize();
      streamCtx = null;
    }

    window.AppState.isStreaming = false;
    window.AppState.streamingMessageId = null;
    window.Events.emit('stream:ended');
  }

  function notifyContentChanged() {
    window.Events.emit('chat:contentChanged');
  }

  function onContentChanged(force) {
    if (!elements.scroll) return;
    if (force || autoScroll) {
      window.DomUtils.scrollToBottom(elements.scroll);
    }
    updateJumpButton();
  }

  function updateJumpButton() {
    if (!elements.jump || !elements.scroll) return;
    const shouldShow = !autoScroll && elements.scroll.scrollHeight > elements.scroll.clientHeight + 200;
    elements.jump.classList.toggle('d-none', !shouldShow);
  }

  async function loadChatList() {
    try {
      const chats = await window.Communication.getChatList();
      window.AppState.chats = Array.isArray(chats) ? chats : [];
      window.Events.emit('chats:updated', window.AppState.chats);
    } catch (error) {
      console.warn('Failed to load chat list', error);
    }
  }

  async function openChat(chatId) {
    if (!chatId) return;

    // Stop any active streaming response before switching/opening a chat.
    finalizeStreamingMessage();

    // Set the current chat ID.
    window.AppState.currentChatId = chatId;

    // Update the URL.
    window.Router.setChatId(chatId, true);

    // Clear the current chat view.
    clearMessages();

    // Remove old hot answers from the previous chat.
    if (window.HotAnswers) {
      window.HotAnswers.clear();
    }

    try {
      // Tell the backend that the user joined this chat.
      await window.Communication.joinChat(chatId);

      // Do not render history here.
      //
      // The backend can send history at any time:
      //
      // {
      //   type: 'history',
      //   messages: [...]
      // }
      //
      // Rendering is handled globally by:
      //
      // Events.on('server:history', payload => {
      //   Chat.applyServerHistory(payload);
      // });
    } catch (error) {
      console.error('Failed to join chat:', error);
      addSystemError('Unable to join chat.');
    }
  }

  async function createChat(temporary = false) {
    try {
      const chat = await window.Communication.createChat({ temporary });
      window.AppState.chats = [chat, ...window.AppState.chats.filter((item) => item.id !== chat.id)];
      window.Events.emit('chats:updated', window.AppState.chats);
      await openChat(chat.id);
      return chat;
    } catch (error) {
      console.error('Failed to create chat', error);
      window.DomUtils.toast('Could not create chat.', 'danger');
      return null;
    }
  }

  async function sendMessage(text) {
    const value = String(text ?? '').trim();
    if (!value) return;

    if (window.AppState.sendState !== 'enabled' || window.AppState.isStreaming) {
      window.DomUtils.toast('Please wait for the current response.', 'warning');
      return;
    }

    finalizeStreamingMessage();

    const userRoot = window.MessageComponents.createUserMessage({
      id: `user_${Date.now()}`,
      content: value
    });

    appendRoot(userRoot);
    window.HotAnswers.clear();
    window.Events.emit('sendState', 'processing');

    // ✅ FIX: Just use the current chat ID. 
    // If it is null (new chat), we send it without an ID.
    // The backend will create the chat and send back the real ID 
    // via the 'chatId' or 'chat_created' event, which will update the URL automatically.
    const chatId = window.AppState.currentChatId;

    try {
      await window.Communication.sendMessage({
        chatId,
        content: value,
        s_system_message: Boolean(window.AppState.systemMessage)
      });
    } catch (error) {
      console.error('Failed to send message', error);
      addSystemError('Failed to send message.');
      window.Events.emit('sendState', 'enabled');
    }
  }

  function renderHistory(messages) {
    const list = Array.isArray(messages) ? messages.slice(-window.APP_CONFIG.limits.maxMessageHistoryRender) : [];

    list.forEach((message) => {
      if (!message || typeof message !== 'object') return;

      if (message.role === 'user') {
        appendRoot(window.MessageComponents.createUserMessage({
          id: message.id || `user_${Math.random().toString(36).slice(2, 8)}`,
          content: message.content || ''
        }));
        return;
      }

      if (message.role === 'assistant') {
        const controller = window.MessageComponents.createAssistantMessage({
          id: message.id || `assistant_${Math.random().toString(36).slice(2, 8)}`
        });

        const blocks = Array.isArray(message.blocks) && message.blocks.length
          ? message.blocks
          : [{ type: 'markdown', content: message.content || '' }];

        blocks.forEach((block) => {
          switch (block.type) {
            case 'markdown':
              controller.addMarkdownFinal(block.content || '');
              break;
            case 'code':
              controller.addCode(block);
              break;
            case 'command':
              controller.addCommand(block);
              break;
            case 'image':
              controller.addImage(block);
              break;
            case 'audio':
              controller.addAudio(block);
              break;
            case 'youtube_embed':
            case 'youtube':
              controller.addYouTube(block);
              break;
            case 'tool_usage':
              controller.addToolUsage(block);
              break;
            case 'reasoning':
              controller.appendReasoning(block.content || '');
              break;
            case 'error':
              controller.addError(block.content || block.message || 'Error');
              break;
            case 'tool_start':
              controller.startTool(block);
              break;
            case 'tool_result':
              controller.completeTool(block);
              break;
            default:
              break;
          }
        });

        controller.finalize();
        appendRoot(controller.root);
      }
    });
  }

  function addSystemError(message) {
    appendRoot(window.DomUtils.el('div', { class: 'message system-message' },
      window.ErrorComponent.create(message).root
    ));
  }

  function showWelcome() {
    clearMessages();
    if (!elements.messages) return;

    elements.messages.append(window.DomUtils.el('div', { class: 'empty-state' },
      window.DomUtils.el('i', { class: 'bi bi-stars' }),
      window.DomUtils.el('h2', {}, 'Agent Console'),
      window.DomUtils.el('p', {}, 'Start a new chat or select an existing conversation from the left drawer.')
    ));
  }

  function applyServerHistory(payload = {}) {
    const chatId = payload.chatId || payload.chat_id || null;
    const messages = payload.messages || [];

    if (chatId) {
      window.AppState.currentChatId = chatId;
      window.Router.setChatId(chatId, true);
    }

    finalizeStreamingMessage();
    clearMessages();
    renderBackendHistory(messages);

    window.Events.emit('sendState', 'enabled');
  }

  window.Chat = {
    init,
    clearMessages,
    startNewChat,
    openChat,
    createChat,
    sendMessage,
    handleChunk,
    loadChatList,
    addSystemError,
    applyServerHistory,
    showWelcome
  };
})();
