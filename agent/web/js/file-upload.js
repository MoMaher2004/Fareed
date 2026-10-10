(function () {
  const activeUploads = new Map();
  const statusListeners = [];

  // ─── Pure JS Incremental SHA-256 Implementation ────────────────────
  class IncrementalSHA256 {
    constructor() {
      this.h = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
      ]);
      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.length = 0;
    }

    update(data) {
      let offset = 0;
      this.length += data.length;

      if (this.bufferLength > 0) {
        const needed = 64 - this.bufferLength;
        if (data.length < needed) {
          this.buffer.set(data, this.bufferLength);
          this.bufferLength += data.length;
          return this;
        }
        this.buffer.set(data.subarray(0, needed), this.bufferLength);
        this._processBlock(this.buffer, 0);
        offset = needed;
        this.bufferLength = 0;
      }

      while (offset + 64 <= data.length) {
        this._processBlock(data, offset);
        offset += 64;
      }

      if (offset < data.length) {
        this.buffer.set(data.subarray(offset), 0);
        this.bufferLength = data.length - offset;
      }
      return this;
    }

    _processBlock(data, offset) {
      const w = new Uint32Array(64);
      for (let i = 0; i < 16; i++) {
        w[i] = (data[offset + i * 4] << 24) |
               (data[offset + i * 4 + 1] << 16) |
               (data[offset + i * 4 + 2] << 8) |
               (data[offset + i * 4 + 3]);
      }
      for (let i = 16; i < 64; i++) {
        const s0 = (w[i - 15] >>> 7 | w[i - 15] << 25) ^ (w[i - 15] >>> 18 | w[i - 15] << 14) ^ (w[i - 15] >>> 3);
        const s1 = (w[i - 2] >>> 17 | w[i - 2] << 15) ^ (w[i - 2] >>> 19 | w[i - 2] << 13) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let a = this.h[0], b = this.h[1], c = this.h[2], d = this.h[3];
      let e = this.h[4], f = this.h[5], g = this.h[6], h = this.h[7];

      const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
      ];

      for (let i = 0; i < 64; i++) {
        const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }

      this.h[0] = (this.h[0] + a) | 0; this.h[1] = (this.h[1] + b) | 0;
      this.h[2] = (this.h[2] + c) | 0; this.h[3] = (this.h[3] + d) | 0;
      this.h[4] = (this.h[4] + e) | 0; this.h[5] = (this.h[5] + f) | 0;
      this.h[6] = (this.h[6] + g) | 0; this.h[7] = (this.h[7] + h) | 0;
    }

    finalize() {
      const bitLength = this.length * 8;
      const padLen = (this.bufferLength < 56) ? (56 - this.bufferLength) : (120 - this.bufferLength);
      const pad = new Uint8Array(padLen);
      pad[0] = 0x80;
      this.update(pad);
      
      const lenBytes = new Uint8Array(8);
      const high = Math.floor(bitLength / 0x100000000);
      const low = bitLength >>> 0;
      lenBytes[0] = (high >>> 24) & 0xff; lenBytes[1] = (high >>> 16) & 0xff;
      lenBytes[2] = (high >>> 8) & 0xff;  lenBytes[3] = high & 0xff;
      lenBytes[4] = (low >>> 24) & 0xff;  lenBytes[5] = (low >>> 16) & 0xff;
      lenBytes[6] = (low >>> 8) & 0xff;   lenBytes[7] = low & 0xff;
      
      this.update(lenBytes);

      let hex = '';
      for (let i = 0; i < 8; i++) {
        hex += (this.h[i] >>> 0).toString(16).padStart(8, '0');
      }
      return hex;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────
  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getFileIcon(type) {
    if (!type) return 'bi-file-earmark';
    const t = String(type).toLowerCase();
    
    // Generic types from backend history
    if (t === 'image') return 'bi-file-earmark-image';
    if (t === 'video') return 'bi-file-earmark-play';
    if (t === 'audio') return 'bi-file-earmark-music';
    if (t === 'document' || t === 'pdf') return 'bi-file-earmark-pdf';
    if (t === 'archive' || t === 'zip') return 'bi-file-earmark-zip';
    if (t === 'code' || t === 'text') return 'bi-file-earmark-code';

    // Standard MIME types
    if (t.startsWith('image/')) return 'bi-file-earmark-image';
    if (t === 'application/pdf') return 'bi-file-earmark-pdf';
    if (t.startsWith('video/')) return 'bi-file-earmark-play';
    if (t.startsWith('audio/')) return 'bi-file-earmark-music';
    if (t.includes('zip') || t.includes('compressed')) return 'bi-file-earmark-zip';
    if (t.includes('word') || t.includes('document')) return 'bi-file-earmark-word';
    if (t.includes('excel') || t.includes('spreadsheet')) return 'bi-file-earmark-excel';
    if (t.includes('powerpoint') || t.includes('presentation')) return 'bi-file-earmark-slides';
    if (t.includes('javascript') || t.includes('json') || t.includes('xml') ||
        t.includes('html') || t.includes('css') || t.startsWith('text/')) {
      return 'bi-file-earmark-code';
    }
    return 'bi-file-earmark';
  }

  function notifyStatusChange(upload) {
    statusListeners.forEach((listener) => listener(upload));
    window.Events.emit('fileUpload:statusChanged', upload);
  }

  function onStatusChange(listener) {
    statusListeners.push(listener);
  }

  // ─── File Upload Logic ─────────────────────────────────────────────
  async function startUpload(file) {
    const config = window.APP_CONFIG.fileUpload || {};
    const chunkSize = config.chunkSize || 64 * 1024;

    const fileId = generateUUID();
    const uploadState = {
      fileId,
      file,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      status: 'uploading',
      progress: 0,
      icon: getFileIcon(file.type),
      fileType: null,
      cancelled: false,
      message: null
    };
    
    activeUploads.set(fileId, uploadState);
    notifyStatusChange(uploadState);

    try {
      // 1. Send start metadata
      window.Communication.startFileUpload({
        name: file.name,
        size: file.size,
        mime_type: file.type,
        chunk_size: chunkSize,
        file_id: fileId
      });

      // 2. Initialize Incremental Hasher
      const hasher = new IncrementalSHA256();

      // 3. Send binary chunks and hash them simultaneously
      const totalChunks = Math.ceil(file.size / chunkSize);
      for (let i = 0; i < totalChunks; i++) {
        if (uploadState.cancelled || uploadState.status === 'failed') return;

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunkData = new Uint8Array(await file.slice(start, end).arrayBuffer());

        // Hash the actual binary content of this chunk
        hasher.update(chunkData);

        // Send the chunk to backend
        window.Communication.sendFileChunk(fileId, chunkData);

        uploadState.progress = Math.round(((i + 1) / totalChunks) * 100);
        notifyStatusChange(uploadState);
        
        // Yield to event loop
        await new Promise(r => setTimeout(r, 0)); 
      }

      if (uploadState.cancelled || uploadState.status === 'failed') return;

      // 4. Finalize hash and send finish event
      const sha256 = hasher.finalize();
      window.Communication.finishFileUpload(fileId, sha256);

    } catch (error) {
      console.error('Upload failed:', error);
      uploadState.status = 'failed';
      uploadState.message = error.message || 'Upload failed';
      notifyStatusChange(uploadState);
    }
  }

  function cancelUpload(fileId) {
    if (window.Communication && typeof window.Communication.cancelFileUpload === 'function') {
      window.Communication.cancelFileUpload(fileId).catch(err => {
        console.warn('Failed to send cancel_file_upload:', err);
      });
    }
    activeUploads.delete(fileId);
    window.Events.emit('fileUpload:removed', fileId);
    const upload = activeUploads.get(fileId);
    if (upload && upload.status === 'uploading') {
      upload.cancelled = true;
      upload.status = 'cancelled';
      notifyStatusChange(upload);
      window.Communication.cancelFileUpload(fileId);
    }
  }

  function removeUpload(fileId) {
    activeUploads.delete(fileId);
    window.Events.emit('fileUpload:removed', fileId);
  }

  function clearAll() {
    const ids = Array.from(activeUploads.keys());
    ids.forEach(id => {
      activeUploads.delete(id);
      window.Events.emit('fileUpload:removed', id);
    });
  }

  function init() {
    window.Events.on('fileUpload:requestUpload', (file) => {
      startUpload(file);
    });

    window.Events.on('server:file_upload_status', (data) => {
      const { file_id, status, file_type, message } = data;
      const upload = activeUploads.get(file_id);
      if (upload) {
        if (status === 'success') {
          upload.status = 'success';
          upload.fileType = file_type;
        } else if (status === 'failed') {
          upload.status = 'failed';
          upload.message = message || 'Upload failed';
        }
        notifyStatusChange(upload);
      }
    });
  }

  window.FileUpload = {
    init,
    cancelUpload,
    removeUpload,
    clearAll,
    onStatusChange,
    getFileIcon,
    generateUUID
  };
})();