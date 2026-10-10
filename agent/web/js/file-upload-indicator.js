(function () {
  const elements = {};
  const uploadCards = new Map();

  function init() {
    elements.container = document.getElementById('file-upload-indicators');
    if (!elements.container) {
      elements.container = document.createElement('div');
      elements.container.id = 'file-upload-indicators';
      elements.container.className = 'file-upload-indicators';
      const composer = document.getElementById('composer');
      if (composer) composer.parentNode.insertBefore(elements.container, composer);
    }

    if (window.FileUpload) {
      window.FileUpload.onStatusChange(handleStatusChange);
    }
    
    window.Events.on('fileUpload:removed', (fileId) => {
      const card = uploadCards.get(fileId);
      if (card) {
        card.remove();
        uploadCards.delete(fileId);
      }
    });
  }

  function handleStatusChange(upload) {
    if (!elements.container) return;

    let card = uploadCards.get(upload.fileId);

    if (!card) {
      card = createUploadCard(upload);
      elements.container.append(card);
      uploadCards.set(upload.fileId, card);
    }

    updateUploadCard(card, upload);
  }

  function createUploadCard(upload) {
    const card = document.createElement('div');
    card.className = 'file-upload-card';
    card.dataset.fileId = upload.fileId;

    const iconContainer = document.createElement('div');
    iconContainer.className = 'file-upload-icon';
    const fileIcon = document.createElement('i');
    fileIcon.className = `bi ${upload.icon}`;
    iconContainer.append(fileIcon);

    // Cancel / Close button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'file-upload-cancel';
    cancelBtn.innerHTML = '<i class="bi bi-x"></i>';
    cancelBtn.title = 'Cancel upload';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Always trigger cancellation (which sends the event and removes the card)
      if (window.FileUpload && window.FileUpload.cancelUpload) {
        window.FileUpload.cancelUpload(upload.fileId);
      }
    });

    const statusIcon = document.createElement('div');
    statusIcon.className = 'file-upload-status';

    const nameEl = document.createElement('div');
    nameEl.className = 'file-upload-name';
    nameEl.textContent = upload.name;
    nameEl.title = upload.name;

    card.append(iconContainer, cancelBtn, statusIcon, nameEl);
    return card;
  }

  function updateUploadCard(card, upload) {
    const statusIcon = card.querySelector('.file-upload-status');
    const cancelBtn = card.querySelector('.file-upload-cancel');
    statusIcon.innerHTML = '';

    card.classList.remove('upload-active', 'upload-success', 'upload-failed', 'upload-cancelled');

    if (upload.status === 'uploading') {
      const spinner = document.createElement('i');
      spinner.className = 'bi bi-arrow-repeat spin';
      statusIcon.append(spinner);
      card.classList.add('upload-active');
      cancelBtn.title = 'Cancel upload';
    } else if (upload.status === 'success') {
      const check = document.createElement('i');
      check.className = 'bi bi-check-circle-fill';
      statusIcon.append(check);
      card.classList.add('upload-success');
      cancelBtn.title = 'Remove file';
    } else if (upload.status === 'failed') {
      const x = document.createElement('i');
      x.className = 'bi bi-x-circle-fill';
      statusIcon.append(x);
      card.classList.add('upload-failed');
      cancelBtn.title = 'Dismiss';
    } else if (upload.status === 'cancelled') {
      card.classList.add('upload-cancelled');
      // Immediately remove from UI if cancelled
      window.FileUpload.removeUpload(upload.fileId);
    }
  }

  window.FileUploadIndicator = { init };
})();