(function () {
  const state = {
    instructions: [],
    modal: null,
    addModal: null
  };

  // ─── Name Validation ───────────────────────────────────────────────
  function isValidName(name) {
    // Only alphanumeric and underscore allowed
    return /^[a-zA-Z0-9_]+$/.test(name);
  }

  // ─── Instructions List Modal ───────────────────────────────────────
  function openInstructionsPanel() {
    const body = window.DomUtils.el('div', { class: 'instructions-panel' });

    const addBtn = window.DomUtils.el('button', {
      type: 'button',
      class: 'btn btn-primary w-100 mb-3 d-flex align-items-center justify-content-center gap-2'
    },
      window.DomUtils.el('i', { class: 'bi bi-plus-lg' }),
      'Add Instruction'
    );
    addBtn.addEventListener('click', () => {
      state.modal.close();
      openAddInstructionModal();
    });

    const listContainer = window.DomUtils.el('div', { class: 'instructions-list' });
    renderInstructionsList(listContainer);

    body.append(addBtn, listContainer);

    state.modal = window.DomUtils.showModal({
      title: 'Instruction Management',
      body,
      size: 'lg'
    });

    // Re-render when list updates while modal is open
    window.Events.on('server:instructions_list', () => {
      if (state.modal && listContainer.isConnected) {
        renderInstructionsList(listContainer);
      }
    });
  }

  function renderInstructionsList(container) {
    window.DomUtils.clear(container);

    if (!state.instructions.length) {
      container.append(
        window.DomUtils.el('div', { class: 'text-muted text-center py-3' }, 'No instructions found.')
      );
      return;
    }

    state.instructions.forEach((instruction) => {
      const item = window.DomUtils.el('div', { class: 'instruction-item' });

      const nameEl = window.DomUtils.el('span', { class: 'instruction-name' }, instruction.name || instruction.id);

      const deleteBtn = window.DomUtils.el('button', {
        type: 'button',
        class: 'icon-btn danger',
        title: 'Delete instruction'
      }, window.DomUtils.el('i', { class: 'bi bi-trash' }));

      deleteBtn.addEventListener('click', () => {
        if (window.Communication.deleteInstruction) {
          window.Communication.deleteInstruction(instruction.id);
        }
        // Remove from local state immediately
        state.instructions = state.instructions.filter(i => i.id !== instruction.id);
        renderInstructionsList(container);
      });

      item.append(nameEl, deleteBtn);
      container.append(item);
    });
  }

  // ─── Add Instruction Modal ─────────────────────────────────────────
  function openAddInstructionModal() {
    const keywords = [];
    const embeddingInputs = [];

    // --- Name Input ---
    const nameInput = window.DomUtils.el('input', {
      type: 'text',
      class: 'form-control',
      placeholder: 'instruction_name'
    });
    const nameError = window.DomUtils.el('div', { class: 'text-danger small mt-1 d-none' },
      'Name can only contain letters, numbers, and underscores.'
    );

    nameInput.addEventListener('input', () => {
      if (nameInput.value && !isValidName(nameInput.value)) {
        nameError.classList.remove('d-none');
        nameInput.classList.add('is-invalid');
      } else {
        nameError.classList.add('d-none');
        nameInput.classList.remove('is-invalid');
      }
    });

    // --- Instructions Textarea ---
    const instructionsTextarea = window.DomUtils.el('textarea', {
      class: 'form-control',
      rows: 8,
      placeholder: '{"key": "value"}'
    });

    // --- Keywords Input ---
    const keywordInput = window.DomUtils.el('input', {
      type: 'text',
      class: 'form-control',
      placeholder: 'Type a keyword and press space'
    });
    const keywordTags = window.DomUtils.el('div', { class: 'keyword-tags mt-2' });

    function addKeyword(word) {
      const trimmed = word.trim();
      if (!trimmed) return;
      if (keywords.includes(trimmed)) return;
      keywords.push(trimmed);
      renderKeywordTags();
    }

    function removeKeyword(word) {
      const idx = keywords.indexOf(word);
      if (idx !== -1) keywords.splice(idx, 1);
      renderKeywordTags();
    }

    function renderKeywordTags() {
      window.DomUtils.clear(keywordTags);
      keywords.forEach((kw) => {
        const tag = window.DomUtils.el('span', { class: 'keyword-tag' },
          kw,
          window.DomUtils.el('i', { class: 'bi bi-x-circle-fill keyword-remove' })
        );
        tag.querySelector('.keyword-remove').addEventListener('click', () => {
          removeKeyword(kw);
        });
        keywordTags.append(tag);
      });
    }

    keywordInput.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        addKeyword(keywordInput.value);
        keywordInput.value = '';
      }
    });

    // --- Embeddings Inputs ---
    const embeddingsContainer = window.DomUtils.el('div', { class: 'embeddings-container' });

    function addEmbeddingInput(value = '') {
      const row = window.DomUtils.el('div', { class: 'embedding-row d-flex align-items-center gap-2 mb-2' });
      const input = window.DomUtils.el('input', {
        type: 'text',
        class: 'form-control',
        placeholder: 'Embedding text',
        value
      });
      const removeBtn = window.DomUtils.el('button', {
        type: 'button',
        class: 'icon-btn danger embedding-remove-btn',
        title: 'Remove embedding'
      }, window.DomUtils.el('i', { class: 'bi bi-x-lg' }));

      removeBtn.addEventListener('click', () => {
        // Only remove if there's more than one input
        if (embeddingsContainer.children.length > 1) {
          row.remove();
          embeddingInputs.splice(embeddingInputs.indexOf(input), 1);
        }
      });

      row.append(input, removeBtn);
      embeddingsContainer.append(row);
      embeddingInputs.push(input);
    }

    // Start with one embedding input
    addEmbeddingInput();

    const addEmbeddingBtn = window.DomUtils.el('button', {
      type: 'button',
      class: 'btn btn-sm btn-outline-secondary mt-1'
    },
      window.DomUtils.el('i', { class: 'bi bi-plus me-1' }),
      'Add Embedding'
    );
    addEmbeddingBtn.addEventListener('click', () => addEmbeddingInput());

    // --- Build Form Body ---
    const body = window.DomUtils.el('div', {},
      // Name
      window.DomUtils.el('div', { class: 'mb-3' },
        window.DomUtils.el('label', { class: 'form-label fw-bold' }, 'Name'),
        nameInput,
        nameError
      ),
      // Instructions
      window.DomUtils.el('div', { class: 'mb-3' },
        window.DomUtils.el('label', { class: 'form-label fw-bold' }, 'Instructions (JSON)'),
        instructionsTextarea
      ),
      // Keywords
      window.DomUtils.el('div', { class: 'mb-3' },
        window.DomUtils.el('label', { class: 'form-label fw-bold' }, 'Keywords'),
        keywordInput,
        keywordTags
      ),
      // Embeddings
      window.DomUtils.el('div', { class: 'mb-3' },
        window.DomUtils.el('label', { class: 'form-label fw-bold' }, 'Embeddings'),
        embeddingsContainer,
        addEmbeddingBtn
      )
    );

    // --- Footer Buttons ---
    const cancelBtn = window.DomUtils.el('button', { type: 'button', class: 'btn btn-outline-secondary' }, 'Cancel');
    const submitBtn = window.DomUtils.el('button', { type: 'button', class: 'btn btn-primary' }, 'Submit');

    cancelBtn.addEventListener('click', () => state.addModal.close());

    submitBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();

      // Validate name
      if (!name || !isValidName(name)) {
        nameError.classList.remove('d-none');
        nameInput.classList.add('is-invalid');
        return;
      }

      const instructions = instructionsTextarea.value.trim();
      const embeddings = embeddingInputs
        .map(input => input.value.trim())
        .filter(v => v.length > 0);

      const payload = {
        name,
        instructions,
        keywords: [...keywords],
        embeddings
      };

      if (window.Communication.addInstruction) {
        window.Communication.addInstruction(payload);
      }

      state.addModal.close();
    });

    state.addModal = window.DomUtils.showModal({
      title: 'Add Instruction',
      body,
      footer: window.DomUtils.el('div', { class: 'd-flex gap-2 justify-content-end w-100' }, cancelBtn, submitBtn),
      size: 'lg'
    });
  }

  // ─── Public API ────────────────────────────────────────────────────
  function init() {
    window.Events.on('server:instructions_list', (instructions) => {
      state.instructions = Array.isArray(instructions) ? instructions : [];
    });
  }

  window.Instructions = {
    init,
    openInstructionsPanel,
    setInstructions(list) {
      state.instructions = Array.isArray(list) ? list : [];
    }
  };
})();