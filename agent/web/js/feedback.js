(function () {
  const elements = {};
  let modal = null;
  let currentMessageId = null;
  let sentiment = null;

  function init() {
    elements.modal = document.getElementById('feedback-modal');
    if (!elements.modal) return;

    elements.positive = document.getElementById('feedback-positive');
    elements.negative = document.getElementById('feedback-negative');
    elements.options = document.getElementById('feedback-options');
    elements.comment = document.getElementById('feedback-comment');
    elements.error = document.getElementById('feedback-error');
    elements.submit = document.getElementById('feedback-submit');

    if (window.bootstrap && window.bootstrap.Modal) {
      modal = new bootstrap.Modal(elements.modal);
    }

    elements.positive.addEventListener('click', () => setSentiment('positive'));
    elements.negative.addEventListener('click', () => setSentiment('negative'));
    elements.submit.addEventListener('click', submit);
    elements.modal.addEventListener('hidden.bs.modal', reset);
  }

  function open(messageId) {
    if (!window.APP_CONFIG.features.feedback) return;

    currentMessageId = messageId;
    sentiment = null;
    reset();

    if (modal) modal.show();
    else if (elements.modal) elements.modal.classList.add('show');
  }

  function setSentiment(value) {
    sentiment = value;
    elements.positive.classList.toggle('active', value === 'positive');
    elements.negative.classList.toggle('active', value === 'negative');
    elements.positive.classList.toggle('btn-success', value === 'positive');
    elements.negative.classList.toggle('btn-danger', value === 'negative');
    renderOptions();
  }

  function renderOptions() {
    if (!elements.options) return;
    window.DomUtils.clear(elements.options);

    const options = (window.APP_CONFIG.feedbackOptions && window.APP_CONFIG.feedbackOptions[sentiment]) || [];

    if (!options.length) {
      elements.options.append(window.DomUtils.el('div', { class: 'text-muted small' }, 'No quick options configured.'));
      return;
    }

    options.forEach((label) => {
      const button = window.DomUtils.el('button', {
        type: 'button',
        class: 'btn btn-sm btn-outline-secondary feedback-option'
      }, label);

      button.addEventListener('click', () => {
        button.classList.toggle('active');
      });

      elements.options.append(button);
    });
  }

  async function submit() {
    if (!sentiment) {
      showError('Choose positive or negative feedback first.');
      return;
    }

    const reasons = Array.from(elements.options.querySelectorAll('.feedback-option.active'))
      .map((button) => button.textContent.trim());

    const comment = elements.comment.value.trim();

    elements.submit.disabled = true;
    elements.submit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

    try {
      await window.Communication.sendFeedback({
        messageId: currentMessageId,
        sentiment,
        reasons,
        comment
      });

      window.DomUtils.toast('Feedback sent.', 'success');
      if (modal) modal.hide();
    } catch (error) {
      showError('Could not send feedback.');
    } finally {
      elements.submit.disabled = false;
      elements.submit.textContent = 'Submit';
    }
  }

  function showError(message) {
    if (!elements.error) return;
    elements.error.textContent = message;
    elements.error.classList.remove('d-none');
  }

  function reset() {
    sentiment = null;
    currentMessageId = null;

    elements.positive.classList.remove('active', 'btn-success');
    elements.negative.classList.remove('active', 'btn-danger');
    elements.comment.value = '';
    elements.error.classList.add('d-none');
    elements.submit.disabled = false;
    elements.submit.textContent = 'Submit';

    window.DomUtils.clear(elements.options);
    elements.options.append(window.DomUtils.el('div', { class: 'text-muted small' }, 'Select a sentiment to see quick options.'));
  }

  window.Feedback = { init, open };
})();
