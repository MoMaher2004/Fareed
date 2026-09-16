(function () {
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null) continue;

      if (key === 'class' || key === 'className') {
        node.className = value;
      } else if (key === 'style' && typeof value === 'string') {
        node.style.cssText = value;
      } else if (key === 'dataset') {
        Object.assign(node.dataset, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'html') {
        node.innerHTML = value;
      } else if (typeof value === 'boolean') {
        if (value) node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(value));
      }
    }

    children.flat(Infinity).forEach((child) => {
      if (child === null || child === undefined) return;
      if (child.nodeType) {
        node.appendChild(child);
      } else {
        node.appendChild(document.createTextNode(String(child)));
      }
    });

    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function isNearBottom(scrollEl, threshold = 120) {
    if (!scrollEl) return true;
    return scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <= threshold;
  }

  function scrollToBottom(scrollEl, smooth = false) {
    if (!scrollEl) return;
    scrollEl.scrollTo({
      top: scrollEl.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  async function copyText(text) {
    const value = String(text ?? '');
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        return true;
      } catch (fallbackError) {
        console.error('Copy failed', fallbackError);
        return false;
      }
    }
  }

  function iconButton(iconClass, label, onClick, extraClass = '') {
    const icon = el('i', { class: `bi ${iconClass}` });
    const button = el('button', {
      type: 'button',
      class: `icon-btn ${extraClass}`.trim(),
      'aria-label': label,
      title: label
    }, icon);

    button.addEventListener('click', (event) => {
      if (button.disabled) return;
      onClick(button, event);
    });

    return button;
  }

  function setButtonLoading(button, fallbackIcon = 'bi-circle') {
    if (!button) return;
    const icon = button.querySelector('i');
    button.dataset.initialIcon = icon ? icon.className : `bi ${fallbackIcon}`;
    button.disabled = true;
    if (icon) icon.className = 'bi bi-arrow-repeat spin';
  }

  function setButtonIdle(button, iconClass) {
    if (!button) return;
    button.disabled = false;
    const icon = button.querySelector('i');
    if (icon && iconClass) icon.className = `bi ${iconClass}`;
    else if (icon && button.dataset.initialIcon) icon.className = button.dataset.initialIcon;
  }

  function flashButton(button, initialIcon, successIcon = 'bi-check') {
    if (!button) return;
    const icon = button.querySelector('i');
    if (!icon) return;
    icon.className = `bi ${successIcon}`;
    window.setTimeout(() => {
      icon.className = `bi ${initialIcon}`;
    }, 1200);
  }

  function showModal({ title, body, footer, size = 'lg', staticBackdrop = false } = {}) {
    const root = el('div', { class: 'modal fade', tabindex: '-1', role: 'dialog' });
    const dialog = el('div', { class: `modal-dialog modal-dialog-centered modal-${size}` });
    const content = el('div', { class: 'modal-content' });

    const header = el('div', { class: 'modal-header' },
      el('h5', { class: 'modal-title' }, title || ''),
      el('button', { type: 'button', class: 'btn-close', 'aria-label': 'Close' })
    );

    const bodyEl = el('div', { class: 'modal-body' });
    if (typeof body === 'string') bodyEl.textContent = body;
    else if (body) bodyEl.append(body);

    content.append(header);
    content.append(bodyEl);

    if (footer) {
      const footerEl = el('div', { class: 'modal-footer' });
      if (typeof footer === 'string') footerEl.textContent = footer;
      else footerEl.append(footer);
      content.append(footerEl);
    }

    dialog.append(content);
    root.append(dialog);
    document.body.appendChild(root);

    let modalInstance = null;

    const close = () => {
      if (modalInstance) modalInstance.hide();
      else root.remove();
    };

    header.querySelector('.btn-close').addEventListener('click', close);

    if (window.bootstrap && window.bootstrap.Modal) {
      modalInstance = new bootstrap.Modal(root, {
        backdrop: staticBackdrop ? 'static' : true,
        keyboard: !staticBackdrop
      });
      root.addEventListener('hidden.bs.modal', () => root.remove());
      modalInstance.show();
    } else {
      root.style.display = 'block';
    }

    return { root, close, bodyEl };
  }

  function toast(message, variant = 'secondary', icon = null) {
    let container = document.getElementById('app-toast-container');
    if (!container) {
      container = el('div', { id: 'app-toast-container' });
      document.body.appendChild(container);
    }

    const icons = {
      success: 'bi-check-circle',
      danger: 'bi-exclamation-triangle',
      warning: 'bi-exclamation-circle',
      info: 'bi-info-circle',
      secondary: 'bi-info-circle'
    };

    const toastEl = el('div', {
      class: `toast align-items-center border-0 text-bg-${variant}`,
      role: 'alert',
      'aria-live': 'polite',
      'aria-atomic': 'true'
    },
      el('div', { class: 'd-flex' },
        el('div', { class: 'toast-body d-flex align-items-center gap-2' },
          el('i', { class: `bi ${icon || icons[variant] || icons.secondary}` }),
          message
        ),
        el('button', { type: 'button', class: 'btn-close btn-close-white me-2 m-auto', 'data-bs-dismiss': 'toast', 'aria-label': 'Close' })
      )
    );

    container.appendChild(toastEl);

    if (window.bootstrap && window.bootstrap.Toast) {
      const instance = new bootstrap.Toast(toastEl, { delay: 2600 });
      toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
      instance.show();
    } else {
      window.setTimeout(() => toastEl.remove(), 2600);
    }
  }

  window.DomUtils = {
    el,
    clear,
    isNearBottom,
    scrollToBottom,
    copyText,
    iconButton,
    setButtonLoading,
    setButtonIdle,
    flashButton,
    showModal,
    toast
  };
})();
