(function () {
  function createUserMessage({ id, content }) {
    let currentContent = String(content ?? '');
    let editing = false;
    let textarea = null;

    const bubble = window.DomUtils.el('div', { class: 'message-bubble user-bubble' }, currentContent);

    const copyButton = window.DomUtils.iconButton('bi-clipboard', 'Copy message', async (button) => {
      await window.DomUtils.copyText(editing && textarea ? textarea.value : currentContent);
      window.DomUtils.flashButton(button, 'bi-clipboard', 'bi-check');
    });

    const editButton = window.DomUtils.iconButton('bi-pencil', 'Edit message', () => {
      startEdit();
    });

    const actions = window.DomUtils.el('div', { class: 'message-actions' }, copyButton, editButton);
    
    // Wrap bubble and actions in a column layout
    const wrapper = window.DomUtils.el('div', { class: 'user-message-wrapper' }, bubble, actions);
    const root = window.DomUtils.el('div', { class: 'message user-message', 'data-message-id': id || '' }, wrapper);

    function startEdit() {
      if (editing) return;
      editing = true;

      textarea = window.DomUtils.el('textarea', { class: 'form-control edit-area', rows: 3 }, currentContent);
      const save = window.DomUtils.el('button', { type: 'button', class: 'btn btn-sm btn-primary' }, 'Save');
      const cancel = window.DomUtils.el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' }, 'Cancel');
      const editActions = window.DomUtils.el('div', { class: 'edit-actions' }, save, cancel);

      save.addEventListener('click', () => {
        currentContent = textarea.value;
        finishEdit();
        window.Events.emit('message:edited', { id, content: currentContent });
      });

      cancel.addEventListener('click', () => {
        finishEdit();
      });

      // Replace wrapper contents with edit mode
      wrapper.replaceChildren(textarea, editActions);
      textarea.focus();
    }

    function finishEdit() {
      editing = false;
      bubble.textContent = currentContent;
      // Restore normal view
      wrapper.replaceChildren(bubble, actions);
    }

    return root;
  }

  function createAssistantMessage({ id }) {
    const contentEl = window.DomUtils.el('div', { class: 'message-content' });

    const copyButton = window.DomUtils.iconButton('bi-clipboard', 'Copy response', async (button) => {
      await window.DomUtils.copyText(controller.getCopyText());
      window.DomUtils.flashButton(button, 'bi-clipboard', 'bi-check');
    });

    const feedbackButton = window.DomUtils.iconButton('bi-hand-thumbs-up', 'Feedback', () => {
      if (window.Feedback) window.Feedback.open(id);
    });

    const actions = window.DomUtils.el('div', { class: 'message-actions' });
    if (window.APP_CONFIG.features.feedback) {
      actions.append(copyButton, feedbackButton);
    } else {
      actions.append(copyButton);
    }

    const avatar = window.DomUtils.el('div', { class: 'assistant-avatar', 'aria-hidden': 'true' },
      window.DomUtils.el('i', { class: 'bi bi-stars' })
    );

    const main = window.DomUtils.el('div', { class: 'message-main' }, contentEl, actions);
    const root = window.DomUtils.el('div', {
      class: 'message assistant-message streaming',
      'data-message-id': id || ''
    }, avatar, main);

    const controller = {
      root,
      contentEl,
      markdownText: '',
      markdownEl: null,
      markdownScheduled: false,
      reasoning: null,
      rawBlocks: [],
      hotAnswersEl: null,

      activeRichBlock: null,
      richBlocks: Object.create(null),
      richComponents: [],

      toolActivities: Object.create(null),
      toolPending: [],

      breakRichBlock() {
        this.activeRichBlock = null;
      },

      addMarkdownSegmentFinal(text) {
        this.breakRichBlock();

        const segment = window.DomUtils.el('div', { class: 'markdown-body' });
        segment.innerHTML = window.MarkdownRenderer.render(text);

        contentEl.append(segment);

        this.markdownText += String(text ?? '') + '\n\n';

        if (window.hljs) {
          segment.querySelectorAll('pre code').forEach((block) => {
            try {
              hljs.highlightElement(block);
            } catch (error) {
              // Highlighting is optional.
            }
          });
        }
      },

      addHotAnswer(label) {
        const value = String(label ?? '').trim();
        if (!value) return;

        if (!this.hotAnswersEl) {
          this.hotAnswersEl = window.DomUtils.el('div', { class: 'history-hot-answers' });
          contentEl.append(this.hotAnswersEl);
        }

        const button = window.DomUtils.el('button', {
          type: 'button',
          class: 'hot-answer-btn history-hot-answer'
        }, value);

        button.addEventListener('click', () => {
          if (window.Chat) {
            window.Chat.sendMessage(value);
          }
        });

        this.hotAnswersEl.append(button);
      },

      startTool(data) {
        if (!window.APP_CONFIG.features.toolUsage) return null;

        this.breakRichBlock();

        const component = window.ToolUsageComponent.create({
          callId: data.callId || '',
          name: data.name || 'tool',
          arguments: data.arguments ?? null,
          status: 'running'
        });

        const entry = {
          callId: data.callId || null,
          name: data.name || 'tool',
          component,
          status: 'running'
        };

        // Primary lookup by tool_call_id.
        if (entry.callId) {
          this.toolActivities[entry.callId] = entry;
        }

        // Fallback queue for name/order matching if no id.
        this.toolPending.push(entry);

        contentEl.append(component.root);
        return entry;
      },

      completeTool(data) {
        if (!window.APP_CONFIG.features.toolUsage) return;

        let entry = null;

        // 1. Exact match by tool_call_id.
        if (data.callId && this.toolActivities[data.callId]) {
          entry = this.toolActivities[data.callId];
        }

        // 2. Fallback: match by tool name among running sections.
        if (!entry && data.name) {
          entry = this.toolPending.find(
            (item) => item.status === 'running' && item.name === data.name
          ) || null;
        }

        // 3. Fallback: oldest running section.
        if (!entry) {
          entry = this.toolPending.find((item) => item.status === 'running') || null;
        }

        // Update the existing section in place.
        if (entry) {
          entry.component.update({
            result: data.result ?? null,
            status: data.error ? 'error' : (data.status || 'done')
          });

          entry.status = data.error ? 'error' : 'done';
          this.toolPending = this.toolPending.filter((item) => item !== entry);
          return;
        }

        // No matching tool_start: render a completed section standalone.
        const component = window.ToolUsageComponent.create({
          callId: data.callId || '',
          name: data.name || 'tool',
          arguments: data.arguments ?? null,
          result: data.result ?? null,
          status: data.error ? 'error' : 'done'
        });

        contentEl.append(component.root);
      },

      registerRichComponent(component) {
        this.richComponents.push(component);
      },

      updateRawBlock(entry) {
        if (!entry) return;
        this.rawBlocks[entry.rawIndex] = entry.component.getMarkdown();
      },

      getExplicitCodeKey(data) {
        if (!data.blockId) return null;
        return `code:${data.blockId}`;
      },

      getExplicitCommandKey(data) {
        if (!data.blockId) return null;
        return `command:${data.blockId}`;
      },

      getImplicitCodeKey(data) {
        return `code:${data.filename || ''}:${data.language || ''}`;
      },

      getImplicitCommandKey(data) {
        return `command:${data.filename || ''}`;
      },

      ensureMarkdown() {
        if (!this.markdownEl) {
          this.markdownEl = window.DomUtils.el('div', { class: 'markdown-body streaming-markdown' });
          contentEl.append(this.markdownEl);
        }
        return this.markdownEl;
      },

      scheduleMarkdownRender() {
        if (this.markdownScheduled) return;
        this.markdownScheduled = true;

        requestAnimationFrame(() => {
          this.markdownScheduled = false;
          if (!this.markdownEl) return;
          this.markdownEl.innerHTML = window.MarkdownRenderer.render(this.markdownText);
        });
      },

      appendMarkdown(text) {
        this.breakRichBlock();

        this.ensureMarkdown();
        this.markdownText += String(text ?? '');
        this.scheduleMarkdownRender();
      },

      addMarkdownFinal(text) {
        this.breakRichBlock();
        this.ensureMarkdown();
        this.markdownText += String(text ?? '');
        this.markdownEl.innerHTML = window.MarkdownRenderer.render(this.markdownText);
        this.highlight();
      },

      addCode(data) {
        this.breakRichBlock();
        const component = window.CodeComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`\n\`\`\`${data.language || ''}\n${data.code || ''}\n\`\`\``);
      },

      appendCode(data) {
        const chunkText = String(data.code ?? '');
        const explicitKey = this.getExplicitCodeKey(data);
        const implicitKey = this.getImplicitCodeKey(data);

        let entry = null;

        // If backend explicitly says which block this chunk belongs to, use it.
        if (explicitKey && this.richBlocks[explicitKey]) {
          entry = this.richBlocks[explicitKey];
        }

        // Otherwise, append only if this is the currently active code block.
        if (
          !entry &&
          this.activeRichBlock &&
          this.activeRichBlock.kind === 'code' &&
          this.activeRichBlock.key === implicitKey
        ) {
          entry = this.activeRichBlock;
        }

        if (entry && entry.kind === 'code') {
          if (data.mode === 'replace') {
            entry.component.replace(chunkText);
          } else {
            entry.component.append(chunkText);
          }

          this.updateRawBlock(entry);
          this.activeRichBlock = entry;
          return;
        }

        // Create a new code viewer.
        const component = window.CodeComponent.create(
          {
            filename: data.filename,
            language: data.language,
            code: chunkText
          },
          { streaming: true }
        );

        const rawIndex = this.rawBlocks.push(component.getMarkdown()).length - 1;
        const key = explicitKey || implicitKey;

        entry = {
          kind: 'code',
          key,
          component,
          rawIndex
        };

        this.richBlocks[key] = entry;
        this.activeRichBlock = entry;

        contentEl.append(component.root);
        this.registerRichComponent(component);
      },

      addCommand(data) {
        if (!window.APP_CONFIG.features.commands) return;

        this.breakRichBlock();

        const component = window.CommandComponent.create(data, { streaming: false });

        contentEl.append(component.root);
        this.rawBlocks.push(component.getMarkdown());
        this.registerRichComponent(component);
      },
      
      appendCommand(data) {
        if (!window.APP_CONFIG.features.commands) return;

        const chunkText = String(data.command ?? data.content ?? '');
        const explicitKey = this.getExplicitCommandKey(data);
        const implicitKey = this.getImplicitCommandKey(data);

        let entry = null;

        if (explicitKey && this.richBlocks[explicitKey]) {
          entry = this.richBlocks[explicitKey];
        }

        if (
          !entry &&
          this.activeRichBlock &&
          this.activeRichBlock.kind === 'command' &&
          this.activeRichBlock.key === implicitKey
        ) {
          entry = this.activeRichBlock;
        }

        if (entry && entry.kind === 'command') {
          if (data.mode === 'replace') {
            entry.component.replace(chunkText);
          } else {
            entry.component.append(chunkText);
          }

          this.updateRawBlock(entry);
          this.activeRichBlock = entry;
          return;
        }

        const component = window.CommandComponent.create(
          {
            filename: data.filename,
            command: chunkText
          },
          { streaming: true }
        );

        const rawIndex = this.rawBlocks.push(component.getMarkdown()).length - 1;
        const key = explicitKey || implicitKey;

        entry = {
          kind: 'command',
          key,
          component,
          rawIndex
        };

        this.richBlocks[key] = entry;
        this.activeRichBlock = entry;

        contentEl.append(component.root);
        this.registerRichComponent(component);
      },

      addImage(data) {
        this.breakRichBlock();
        const component = window.ImageComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`[image: ${data.src || data.url || ''}]`);
      },

      addAudio(data) {
        this.breakRichBlock();
        const component = window.AudioComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`[audio: ${data.src || data.url || ''}]`);
      },

      addYouTube(data) {
        if (!window.APP_CONFIG.features.youtubeEmbed) return;
        this.breakRichBlock();
        const component = window.YouTubeEmbedComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`[youtube: ${data.url || ''}]`);
      },

      addToolUsage(data) {
        if (!window.APP_CONFIG.features.toolUsage) return;
        this.breakRichBlock();
        const component = window.ToolUsageComponent.create(data);
        contentEl.append(component.root);
      },

      appendReasoning(text) {
        if (!window.APP_CONFIG.features.reasoning) return;
        if (!this.reasoning) {
          this.reasoning = window.ReasoningComponent.create();
          contentEl.prepend(this.reasoning.root);
        }
        this.reasoning.append(text);
      },

      addError(message) {
        this.breakRichBlock();
        contentEl.append(window.ErrorComponent.create(message).root);
      },

      addUnsupported(contentType) {
        this.breakRichBlock();
        contentEl.append(window.DomUtils.el('div', { class: 'text-muted small' },
          `Unsupported content type: ${contentType || 'unknown'}`
        ));
      },

      highlight() {
        if (!window.hljs) return;
        this.root.querySelectorAll('pre code').forEach((block) => {
          try {
            hljs.highlightElement(block);
          } catch (error) {
            // Highlighting is optional.
          }
        });
      },

      finalize() {
        if (this.markdownEl) {
          this.markdownEl.innerHTML = window.MarkdownRenderer.render(this.markdownText);
          this.markdownEl.classList.remove('streaming-markdown');
          this.highlight();
        }

        if (this.reasoning && typeof this.reasoning.finalize === 'function') {
          this.reasoning.finalize();
        }

        // Close any tool sections still waiting for a result.
        this.toolPending.slice().forEach((entry) => {
          if (entry.status === 'running') {
            const current = entry.component.getState();
            entry.component.update({
              result: current.result ?? 'No result received.',
              status: 'done'
            });
            entry.status = 'done';
          }
        });
        this.toolPending = [];

        this.richComponents.forEach((component) => {
          if (component && typeof component.finalize === 'function') {
            component.finalize();
          }
        });

        this.activeRichBlock = null;

        root.classList.remove('streaming');
        window.AppState.isStreaming = false;
        window.AppState.streamingMessageId = null;
        window.Events.emit('assistant:finalized', { id });
      },

      getCopyText() {
        const parts = [];
        if (this.markdownText.trim()) parts.push(this.markdownText.trim());
        if (this.rawBlocks.length) parts.push(this.rawBlocks.join('\n'));
        return parts.join('\n\n');
      }
    };

    return controller;
  }

  window.MessageComponents = {
    createUserMessage,
    createAssistantMessage
  };
})();
