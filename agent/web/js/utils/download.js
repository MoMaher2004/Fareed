(function () {
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
    downloadBlob(filename, new Blob([String(text ?? '')], { type: mime }));
  }

  window.DownloadUtils = {
    downloadBlob,
    downloadText
  };
})();
