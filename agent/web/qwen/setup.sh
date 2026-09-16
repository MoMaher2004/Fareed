#!/usr/bin/env bash
set -euo pipefail

mkdir -p css js/components js/utils

cat > index.html <<'HTML_EOF'
<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Console</title>

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.3/styles/github-dark.min.css" rel="stylesheet">

  <script defer src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dompurify@3.1.5/dist/purify.min.js"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.3/highlight.min.js"></script>

  <link rel="stylesheet" href="css/styles.css">

  <script defer src="js/config.js"></script>
  <script defer src="js/state.js"></script>
  <script defer src="js/utils/dom.js"></script>
  <script defer src="js/utils/download.js"></script>
  <script defer src="js/utils/formatting.js"></script>
  <script defer src="js/theme.js"></script>
  <script defer src="js/router.js"></script>
  <script defer src="js/markdown.js"></script>

  <script defer src="js/components/error.js"></script>
  <script defer src="js/components/image.js"></script>
  <script defer src="js/components/audio.js"></script>
  <script defer src="js/components/youtube-embed.js"></script>
  <script defer src="js/components/tool-usage.js"></script>
  <script defer src="js/components/reasoning.js"></script>
  <script defer src="js/components/code.js"></script>
  <script defer src="js/components/command.js"></script>
  <script defer src="js/components/message.js"></script>
  <script defer src="js/components/hot-answers.js"></script>

  <script defer src="js/communication.js"></script>
  <script defer src="js/chat.js"></script>
  <script defer src="js/composer.js"></script>
  <script defer src="js/drawer.js"></script>
  <script defer src="js/tool-request.js"></script>
  <script defer src="js/feedback.js"></script>
  <script defer src="js/app.js"></script>
</head>
<body>
  <div id="app-shell" class="app-shell">
    <aside id="app-drawer" class="app-drawer" aria-label="Chat navigation">
      <div class="drawer-header">
        <div class="drawer-brand">
          <span class="drawer-logo"><i class="bi bi-stars"></i></span>
          <span>Agent Console</span>
        </div>
        <button id="drawer-close" class="icon-btn d-lg-none" type="button" aria-label="Close navigation">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div id="drawer-actions" class="drawer-actions" aria-label="Drawer actions"></div>

      <div class="drawer-section">
        <h6 class="drawer-section-title">Pinned</h6>
        <div id="pinned-chats" class="chat-list"></div>
      </div>

      <div class="drawer-section drawer-section-grow">
        <h6 class="drawer-section-title">History</h6>
        <div id="chat-history" class="chat-list"></div>
      </div>

      <div class="drawer-footer small text-muted">
        Configuration-driven drawer. Add future actions in <code>config.js</code>.
      </div>
    </aside>

    <div id="drawer-backdrop" class="drawer-backdrop" aria-hidden="true"></div>

    <main class="app-main">
      <header class="topbar">
        <button id="drawer-toggle" class="icon-btn" type="button" aria-label="Toggle navigation">
          <i class="bi bi-list"></i>
        </button>

        <div class="topbar-title">AI Agent Chat</div>

        <div class="topbar-tools">
          <span id="connection-status" class="topbar-status status-offline">offline</span>
          <button id="theme-toggle" class="icon-btn" type="button" aria-label="Toggle theme">
            <i class="bi bi-moon-stars"></i>
          </button>
        </div>
      </header>

      <section id="chat-scroll" class="chat-container" aria-live="polite" aria-label="Chat messages">
        <div id="chat-messages" class="chat-messages"></div>
        <button id="jump-latest" class="jump-latest d-none" type="button" aria-label="Scroll to latest message">
          <i class="bi bi-arrow-down"></i>
        </button>
      </section>

      <div id="hot-answers" class="hot-answers d-none" aria-label="Suggested answers"></div>

      <section id="composer" class="composer" aria-label="Message composer">
        <div id="composer-normal" class="composer-normal">
          <div class="composer-left">
            <div class="dropdown" id="attach-wrapper">
              <button class="icon-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Add attachment">
                <i class="bi bi-paperclip"></i>
              </button>
              <ul class="dropdown-menu">
                <li><button class="dropdown-item" type="button" data-attach="document"><i class="bi bi-file-earmark-text me-2"></i>Document</button></li>
                <li><button class="dropdown-item" type="button" data-attach="image"><i class="bi bi-image me-2"></i>Image</button></li>
                <li><button class="dropdown-item" type="button" data-attach="video"><i class="bi bi-camera-video me-2"></i>Video</button></li>
                <li><button class="dropdown-item" type="button" data-attach="file"><i class="bi bi-folder2-open me-2"></i>Other file</button></li>
              </ul>
            </div>

            <button id="system-message-toggle" class="chip" type="button" aria-pressed="false" title="Send as system message">
              <i class="bi bi-sliders"></i>
              <span class="d-none d-sm-inline">System</span>
            </button>
          </div>

          <textarea id="composer-input" rows="1" placeholder="Message the agent..." aria-label="Message input"></textarea>

          <div class="composer-right">
            <button id="voice-btn" class="icon-btn" type="button" aria-label="Voice input">
              <i class="bi bi-mic"></i>
            </button>
            <button id="send-btn" class="send-btn" type="button" aria-label="Send message">
              <i class="bi bi-arrow-up"></i>
            </button>
          </div>
        </div>

        <div id="composer-recording" class="composer-recording d-none" aria-label="Recording controls">
          <button id="rec-cancel" class="icon-btn danger" type="button" aria-label="Cancel recording">
            <i class="bi bi-x-lg"></i>
          </button>

          <canvas id="waveform" width="600" height="64" aria-hidden="true"></canvas>

          <div id="rec-error" class="rec-error d-none" role="alert">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>Transcription failed.</span>
            <button id="rec-retry" class="btn btn-sm btn-outline-danger" type="button">Retry</button>
          </div>

          <button id="rec-confirm" class="icon-btn primary" type="button" aria-label="Confirm recording">
            <i class="bi bi-check-lg"></i>
          </button>
        </div>
      </section>
    </main>

    <aside id="tool-request-panel" class="tool-panel" aria-label="Tool requests" aria-hidden="true">
      <div class="tool-panel-inner">
        <div class="tool-panel-header">
          <div>
            <i class="bi bi-tools me-2"></i>Tool requests
          </div>
          <span id="tool-request-count" class="badge text-bg-primary">0</span>
        </div>
        <div id="tool-request-list" class="tool-request-list"></div>
        <div class="tool-panel-footer">
          Active tool requests must be resolved before continuing.
        </div>
      </div>
    </aside>
  </div>

  <div class="modal fade" id="feedback-modal" tabindex="-1" aria-labelledby="feedback-title" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="feedback-title" class="modal-title">Response feedback</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="btn-group w-100 mb-3" role="group" aria-label="Feedback sentiment">
            <button id="feedback-positive" type="button" class="btn btn-outline-success">
              <i class="bi bi-hand-thumbs-up me-1"></i>Positive
            </button>
            <button id="feedback-negative" type="button" class="btn btn-outline-danger">
              <i class="bi bi-hand-thumbs-down me-1"></i>Negative
            </button>
          </div>

          <div id="feedback-options" class="feedback-options mb-3" aria-label="Quick feedback options"></div>

          <div class="form-floating">
            <textarea id="feedback-comment" class="form-control" placeholder="Additional feedback" style="height:110px"></textarea>
            <label for="feedback-comment">Additional comments</label>
          </div>

          <div id="feedback-error" class="text-danger small mt-2 d-none" role="alert"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancel</button>
          <button id="feedback-submit" class="btn btn-primary" type="button">Submit</button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
HTML_EOF

cat > css/styles.css <<'CSS_EOF'
:root {
  --bg: #f5f7fb;
  --panel: #ffffff;
  --panel-soft: rgba(255, 255, 255, 0.72);
  --border: #dfe5ee;
  --text: #111827;
  --muted: #64748b;
  --accent: #4f6df5;
  --accent-soft: rgba(79, 109, 245, 0.12);
  --user-bubble: #e8edff;
  --danger: #dc3545;
  --code-bg: #0d1117;
  --code-header: #161b22;
  --code-border: #26324a;
  --code-text: #e6edf3;
  --drawer-width: 290px;
  --tool-width: 360px;
  --shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
}

[data-bs-theme="dark"] {
  --bg: #0b1220;
  --panel: #0f172a;
  --panel-soft: rgba(15, 23, 42, 0.72);
  --border: #26324a;
  --text: #e5e7eb;
  --muted: #94a3b8;
  --accent: #6c8cff;
  --accent-soft: rgba(108, 140, 255, 0.16);
  --user-bubble: #273454;
  --shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button {
  font: inherit;
}

.app-shell {
  display: flex;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.app-drawer {
  width: var(--drawer-width);
  min-width: var(--drawer-width);
  background: var(--panel);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: margin-left 0.22s ease, transform 0.22s ease;
  z-index: 1040;
}

.app-shell.drawer-collapsed .app-drawer {
  margin-left: calc(-1 * var(--drawer-width));
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}

.drawer-logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--accent);
  background: var(--accent-soft);
}

.drawer-actions {
  padding: 14px;
  display: grid;
  gap: 8px;
}

.drawer-action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}

.drawer-action-btn:hover {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.drawer-action-btn:active {
  transform: translateY(1px);
}

.drawer-action-btn:focus-visible,
.icon-btn:focus-visible,
.send-btn:focus-visible,
.hot-answer-btn:focus-visible,
.tool-option-btn:focus-visible,
.feedback-option:focus-visible,
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.drawer-section {
  padding: 12px 14px;
  min-height: 0;
}

.drawer-section-grow {
  flex: 1;
  overflow: auto;
}

.drawer-section-title {
  margin: 0 0 8px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.chat-list {
  display: grid;
  gap: 6px;
}

.chat-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.chat-item:hover {
  background: var(--accent-soft);
}

.chat-item.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
}

.chat-item-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-item-meta {
  color: var(--muted);
  font-size: 0.8rem;
  flex: 0 0 auto;
}

.drawer-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1035;
}

.drawer-backdrop.show {
  opacity: 1;
  pointer-events: auto;
}

.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
}

.topbar {
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 82%, transparent);
  backdrop-filter: blur(10px);
}

.topbar-title {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-status {
  font-size: 0.78rem;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--muted);
}

.status-connected {
  color: #198754;
  border-color: color-mix(in srgb, #198754 35%, var(--border));
}

.status-disconnected,
.status-offline {
  color: var(--muted);
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  position: relative;
  padding: 24px 0;
}

.chat-messages {
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 0 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.message {
  min-width: 0;
}

.message-row {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 10px;
}

.user-bubble {
  background: var(--user-bubble);
  color: var(--text);
  padding: 10px 14px;
  border-radius: 16px 16px 4px 16px;
  max-width: min(75%, 760px);
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: var(--shadow);
}

.assistant-message {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.assistant-avatar {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 11px;
  display: grid;
  place-items: center;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
}

.message-main {
  flex: 1;
  min-width: 0;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.message-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.message:hover .message-actions,
.message:focus-within .message-actions {
  opacity: 1;
}

@media (hover: none) {
  .message-actions {
    opacity: 1;
  }
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  border-radius: 10px;
  display: inline-grid;
  place-items: center;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease, opacity 0.15s ease;
}

.icon-btn:hover {
  background: var(--accent-soft);
  color: var(--text);
}

.icon-btn:active {
  transform: translateY(1px);
}

.icon-btn:disabled {
  opacity: 0.55;
  pointer-events: none;
}

.icon-btn.primary {
  color: var(--accent);
}

.icon-btn.danger:hover {
  background: rgba(220, 53, 69, 0.12);
  color: var(--danger);
}

.send-btn {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  display: inline-grid;
  place-items: center;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
}

.send-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 86%, #fff);
}

.send-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.send-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.send-btn.processing {
  opacity: 0.8;
}

.chip {
  border: 1px solid var(--border);
  color: var(--muted);
  background: transparent;
  border-radius: 999px;
  padding: 7px 11px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.chip:hover {
  background: var(--accent-soft);
  color: var(--text);
}

.chip.active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
  background: var(--accent-soft);
}

.markdown-body {
  min-width: 0;
  overflow-wrap: break-word;
  line-height: 1.65;
}

.markdown-body > *:first-child {
  margin-top: 0;
}

.markdown-body > *:last-child {
  margin-bottom: 0;
}

.markdown-body pre {
  background: var(--code-bg);
  color: var(--code-text);
  border: 1px solid var(--code-border);
  border-radius: 12px;
  padding: 12px;
  overflow: auto;
}

.markdown-body code {
  background: color-mix(in srgb, var(--muted) 18%, transparent);
  padding: 2px 5px;
  border-radius: 6px;
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--border);
  padding: 8px 10px;
}

.markdown-body blockquote {
  margin: 12px 0;
  padding: 8px 14px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 10px 10px 0;
}

.streaming-markdown::after {
  content: "▋";
  margin-left: 3px;
  color: var(--accent);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.component-card,
.code-component,
.command-component,
.image-component,
.audio-component,
.youtube-component,
.tool-usage,
.reasoning-block,
.error-component {
  min-width: 0;
}

.code-component,
.command-component {
  border: 1px solid var(--code-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--code-bg);
  color: var(--code-text);
}

.component-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  background: var(--code-header);
  border-bottom: 1px solid var(--code-border);
}

.component-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.component-filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
}

.component-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.component-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.language-badge {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-weight: 600;
}

.code-viewer-body {
  margin: 0;
  padding: 13px;
  overflow: auto;
  background: var(--code-bg);
  color: var(--code-text);
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.45;
}

.expanded-code {
  max-height: 70vh;
}

.command-component .component-header {
  background: #111827;
}

.image-component {
  margin: 0;
  width: min(100%, 760px);
}

.image-frame {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--muted) 10%, transparent);
  min-height: 120px;
}

.chat-image {
  width: 100%;
  height: auto;
  display: block;
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: zoom-in;
}

.chat-image.loaded {
  opacity: 1;
}

.image-skeleton {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--muted);
}

.image-broken {
  padding: 28px 16px;
  text-align: center;
  color: var(--muted);
}

.audio-component {
  width: min(100%, 560px);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px;
  background: var(--panel);
}

.audio-component audio {
  width: 100%;
}

.youtube-component {
  width: min(100%, 760px);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  background: #000;
}

.youtube-ratio {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
}

.youtube-ratio iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.tool-usage,
.reasoning-block {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
  overflow: hidden;
}

.tool-usage summary,
.reasoning-block summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  color: var(--muted);
  transition: background 0.15s ease, color 0.15s ease;
}

.tool-usage summary::-webkit-details-marker,
.reasoning-block summary::-webkit-details-marker {
  display: none;
}

.tool-usage summary:hover,
.reasoning-block summary:hover {
  background: var(--accent-soft);
  color: var(--text);
}

.tool-usage-body,
.reasoning-content {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  font-size: 0.9rem;
  color: var(--text);
}

.reasoning-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--muted);
}

.detail-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  color: var(--muted);
}

.detail-value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.detail-value pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.error-component {
  border-radius: 12px;
}

.hot-answers {
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 0 20px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hot-answer-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  border-radius: 999px;
  padding: 7px 12px;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.hot-answer-btn:hover {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border));
}

.hot-answer-btn:active {
  transform: translateY(1px);
}

.composer {
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  backdrop-filter: blur(10px);
  padding: 14px 20px 18px;
}

.composer-normal {
  width: min(920px, 100%);
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 18px;
  padding: 8px;
  box-shadow: var(--shadow);
}

.composer-left,
.composer-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

#composer-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: var(--text);
  max-height: 200px;
  padding: 7px 4px;
  line-height: 1.5;
}

.composer-recording {
  width: min(920px, 100%);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  background: var(--bg);
  border-radius: 18px;
  padding: 10px;
  box-shadow: var(--shadow);
}

#waveform {
  flex: 1;
  width: 100%;
  height: 64px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--muted) 8%, transparent);
}

.rec-error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--danger);
  font-size: 0.92rem;
}

.tool-panel {
  width: 0;
  overflow: hidden;
  background: var(--panel);
  border-left: 1px solid var(--border);
  transition: width 0.22s ease;
  flex: 0 0 auto;
}

.app-shell.tool-open .tool-panel {
  width: var(--tool-width);
}

.tool-panel-inner {
  width: var(--tool-width);
  min-width: var(--tool-width);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tool-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 700;
}

.tool-request-list {
  flex: 1;
  overflow: auto;
  padding: 14px;
  display: grid;
  gap: 12px;
  align-content: start;
}

.tool-request-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  background: var(--bg);
}

.tool-request-title {
  font-weight: 700;
  margin-bottom: 6px;
}

.tool-request-desc {
  color: var(--muted);
  font-size: 0.92rem;
  margin-bottom: 8px;
}

.tool-request-meta {
  color: var(--muted);
  font-size: 0.84rem;
  display: grid;
  gap: 3px;
  margin-bottom: 10px;
}

.tool-request-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tool-option-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
}

.tool-option-btn.selected {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
}

.tool-panel-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.86rem;
}

.jump-latest {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  width: 42px;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel);
  color: var(--text);
  box-shadow: var(--shadow);
  display: grid;
  place-items: center;
  z-index: 20;
}

.empty-state {
  min-height: 55vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  text-align: center;
  color: var(--muted);
}

.empty-state i {
  font-size: 2.5rem;
  color: var(--accent);
}

.edit-area {
  width: 100%;
  max-width: 760px;
}

.edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: flex-end;
}

.feedback-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 38px;
}

.feedback-option.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  color: var(--accent);
}

.server-item {
  background: var(--panel);
  color: var(--text);
  border-color: var(--border);
}

.server-item:hover:not(:disabled) {
  background: var(--accent-soft);
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

#app-toast-container {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2000;
  display: grid;
  gap: 10px;
}

@media (max-width: 991.98px) {
  .app-drawer {
    position: fixed;
    inset: 0 auto 0 0;
    margin: 0 !important;
    transform: translateX(-102%);
    box-shadow: var(--shadow);
  }

  .app-drawer.open {
    transform: translateX(0);
  }

  .tool-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(92vw, var(--tool-width));
    transform: translateX(105%);
    transition: transform 0.22s ease;
    z-index: 1060;
    box-shadow: var(--shadow);
  }

  .app-shell.tool-open .tool-panel {
    width: min(92vw, var(--tool-width));
    transform: translateX(0);
  }

  .tool-panel-inner {
    width: 100%;
    min-width: 0;
  }

  .user-bubble {
    max-width: 88%;
  }

  .detail-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
CSS_EOF

cat > js/config.js <<'CONFIG_EOF'
window.APP_CONFIG = {
  app: {
    name: 'Agent Console',
    version: '1.0.0'
  },

  theme: {
    default: 'dark',
    storageKey: 'agent-ui-theme'
  },

  routing: {
    useHash: true,
    basePath: '',
    chatPrefix: '/chat/'
  },

  backend: {
    useMock: true,
    apiUrl: '/api',
    wsUrl: '',
    sseUrl: '',
    uploadUrl: '/api/uploads',
    transcriptionUrl: '/api/transcribe',
    executionUrl: '/api/execute'
  },

  features: {
    voiceInput: false,
    attachments: false,
    temporaryChat: true,
    reasoning: true,
    toolUsage: true,
    feedback: true,
    hotAnswers: true,
    codeExecution: true,
    commands: true,
    youtubeEmbed: true
  },

  ui: {
    scrollThreshold: 130,
    autoScroll: true,
    animationSpeed: 'fast',
    maxVisibleToolRequests: 20
  },

  codeViewer: {
    maxHeight: 320,
    expandedMaxHeight: '70vh'
  },

  limits: {
    maxHotAnswers: 5,
    maxMessageHistoryRender: 500
  },

  drawer: {
    customActions: [
      { id: 'models', label: 'Models', icon: 'bi-cpu' },
      { id: 'projects', label: 'Projects', icon: 'bi-folder2' },
      { id: 'settings', label: 'Settings', icon: 'bi-gear' }
    ]
  },

  feedbackOptions: {
    positive: [
      'Implemented my idea correctly',
      'Implemented my idea better than expected',
      'Clear answer',
      'Useful answer'
    ],
    negative: [
      'Answer is inaccurate',
      'Model misunderstood my request',
      'Wrong tool was used',
      'Response was incomplete',
      'Response was unnecessarily complicated'
    ]
  },

  toolRequestDefaults: {
    buttonClass: 'btn btn-sm tool-option-btn',
    background: '',
    color: '',
    borderColor: ''
  }
};
CONFIG_EOF

cat > js/state.js <<'STATE_EOF'
(function () {
  const listeners = Object.create(null);

  window.Events = {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
      return () => this.off(event, fn);
    },

    off(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((item) => item !== fn);
    },

    emit(event, payload) {
      const subs = listeners[event];
      if (!subs || !subs.length) return;
      subs.slice().forEach((fn) => {
        try {
          fn(payload);
        } catch (error) {
          console.error(`Event handler error for ${event}`, error);
        }
      });
    }
  };

  window.AppState = {
    theme: 'dark',
    connection: 'offline',
    currentChatId: null,
    chats: [],
    sendEnabled: true,
    sendState: 'enabled',
    isStreaming: false,
    streamingMessageId: null,
    toolRequests: [],
    drawerOpen: window.innerWidth >= 992,
    recording: 'idle',
    transcription: 'idle',
    systemMessage: false,
    hotAnswers: []
  };

  window.StateStore = {
    set(patch) {
      Object.assign(window.AppState, patch || {});
      window.Events.emit('state:change', window.AppState);
    }
  };
})();
STATE_EOF

cat > js/utils/dom.js <<'DOM_EOF'
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
DOM_EOF

cat > js/utils/download.js <<'DOWNLOAD_EOF'
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
DOWNLOAD_EOF

cat > js/utils/formatting.js <<'FORMATTING_EOF'
(function () {
  function formatTime(timestamp) {
    try {
      return new Date(timestamp || Date.now()).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  }

  function prettyJson(value) {
    try {
      if (typeof value === 'string') return value;
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value ?? '');
    }
  }

  function truncate(text, length = 90) {
    const value = String(text ?? '');
    return value.length > length ? `${value.slice(0, length)}…` : value;
  }

  window.FormattingUtils = {
    formatTime,
    prettyJson,
    truncate
  };
})();
FORMATTING_EOF

cat > js/theme.js <<'THEME_EOF'
(function () {
  function storageKey() {
    return (window.APP_CONFIG && APP_CONFIG.theme && APP_CONFIG.theme.storageKey) || 'agent-ui-theme';
  }

  function defaultTheme() {
    return (window.APP_CONFIG && APP_CONFIG.theme && APP_CONFIG.theme.default) || 'dark';
  }

  function getSavedTheme() {
    try {
      return localStorage.getItem(storageKey());
    } catch (error) {
      return null;
    }
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.body.setAttribute('data-theme', theme);
    window.AppState.theme = theme;

    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
      icon.className = theme === 'dark' ? 'bi bi-sun-stars' : 'bi bi-moon-stars';
    }
  }

  window.ThemeManager = {
    init() {
      const saved = getSavedTheme();
      apply(saved || defaultTheme());

      const toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.addEventListener('click', () => this.toggle());
      }
    },

    get() {
      return document.documentElement.getAttribute('data-bs-theme') || 'dark';
    },

    set(theme) {
      const next = theme === 'light' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem(storageKey(), next);
      } catch (error) {
        // Storage is optional.
      }
      window.Events.emit('theme:changed', next);
    },

    toggle() {
      this.set(this.get() === 'dark' ? 'light' : 'dark');
    }
  };
})();
THEME_EOF

cat > js/router.js <<'ROUTER_EOF'
(function () {
  function routingConfig() {
    return (window.APP_CONFIG && APP_CONFIG.routing) || {};
  }

  function normalizedPrefix() {
    let prefix = routingConfig().chatPrefix || '/chat/';
    if (!prefix.startsWith('/')) prefix = `/${prefix}`;
    if (!prefix.endsWith('/')) prefix = `${prefix}/`;
    return prefix;
  }

  function buildChatUrl(chatId) {
    const cfg = routingConfig();
    if (!chatId) {
      return cfg.useHash ? `${window.location.pathname}#` : (cfg.basePath || '/');
    }

    const prefix = normalizedPrefix();
    if (cfg.useHash) {
      return `${window.location.pathname}#${prefix}${encodeURIComponent(chatId)}`;
    }

    return `${cfg.basePath || ''}${prefix}${encodeURIComponent(chatId)}`;
  }

  function getChatId() {
    try {
      const cfg = routingConfig();
      const prefix = normalizedPrefix();
      const source = cfg.useHash
        ? window.location.hash.replace(/^#/, '')
        : window.location.pathname;

      if (!source) return null;

      const index = source.indexOf(prefix);
      if (index === -1) return null;

      const rest = source.slice(index + prefix.length);
      const id = rest.split(/[/?#]/)[0];
      return id ? decodeURIComponent(id) : null;
    } catch (error) {
      console.warn('Router.getChatId failed', error);
      return null;
    }
  }

  function setChatId(chatId, replace = false) {
    if (!chatId) return;

    const url = buildChatUrl(chatId);
    const cfg = routingConfig();

    try {
      if (cfg.useHash) {
        if (replace) {
          window.location.replace(url);
        } else {
          window.location.hash = url.split('#')[1] || '';
        }
      } else {
        window.history[replace ? 'replaceState' : 'pushState']({ chatId }, '', url);
      }
    } catch (error) {
      console.warn('Router.setChatId failed', error);
    }

    window.AppState.currentChatId = chatId;
    window.Events.emit('router:chatId', chatId);
  }

  function navigateToChat(chatId) {
    if (!chatId) return;
    setChatId(chatId, false);
    if (window.Chat) window.Chat.openChat(chatId);
  }

  function init(onChange) {
    const cfg = routingConfig();
    const eventName = cfg.useHash ? 'hashchange' : 'popstate';

    window.addEventListener(eventName, () => {
      if (typeof onChange === 'function') onChange(getChatId());
    });

    if (typeof onChange === 'function') onChange(getChatId());
  }

  window.Router = {
    buildChatUrl,
    getChatId,
    setChatId,
    navigateToChat,
    init
  };
})();
ROUTER_EOF

cat > js/markdown.js <<'MARKDOWN_EOF'
(function () {
  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (match) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match]));
  }

  if (window.marked) {
    try {
      if (typeof marked.use === 'function') {
        marked.use({ gfm: true, breaks: true });
      } else if (typeof marked.setOptions === 'function') {
        marked.setOptions({ gfm: true, breaks: true });
      }
    } catch (error) {
      console.warn('Markdown configuration failed', error);
    }
  }

  function render(text) {
    const source = String(text ?? '');
    if (!source.trim()) return '';

    if (window.marked && window.DOMPurify) {
      try {
        let html = marked.parse(source);
        html = DOMPurify.sanitize(html, {
          ADD_ATTR: ['target', 'rel']
        });
        return html;
      } catch (error) {
        console.warn('Markdown render failed, falling back to plain text', error);
      }
    }

    return `<p>${escapeHtml(source).replace(/\n/g, '<br>')}</p>`;
  }

  window.MarkdownRenderer = {
    render,
    escapeHtml
  };
})();
MARKDOWN_EOF

cat > js/components/error.js <<'ERROR_EOF'
(function () {
  function create(message) {
    return window.DomUtils.el(
      'div',
      { class: 'alert alert-danger d-flex align-items-start gap-2 error-component', role: 'alert' },
      window.DomUtils.el('i', { class: 'bi bi-exclamation-triangle-fill mt-1' }),
      window.DomUtils.el('div', { class: 'error-text' }, String(message ?? 'Unknown error'))
    );
  }

  window.ErrorComponent = { create };
})();
ERROR_EOF

cat > js/components/image.js <<'IMAGE_EOF'
(function () {
  function isValidUrl(src) {
    try {
      const url = new URL(src, window.location.href);
      return ['http:', 'https:', 'data:'].includes(url.protocol);
    } catch (error) {
      return false;
    }
  }

  function create(data = {}) {
    const src = data.src || data.url || '';
    const alt = data.alt || 'Assistant image';
    const root = window.DomUtils.el('figure', { class: 'image-component' });
    const frame = window.DomUtils.el('div', { class: 'image-frame' });
    const skeleton = window.DomUtils.el('div', { class: 'image-skeleton' },
      window.DomUtils.el('i', { class: 'bi bi-image' })
    );

    frame.append(skeleton);
    root.append(frame);

    if (!isValidUrl(src)) {
      skeleton.remove();
      frame.append(window.DomUtils.el('div', { class: 'image-broken' },
        window.DomUtils.el('i', { class: 'bi bi-image-alt d-block mb-2' }),
        'Image unavailable'
      ));
      return { root };
    }

    const img = window.DomUtils.el('img', {
      class: 'chat-image',
      loading: 'lazy',
      alt,
      src
    });

    img.addEventListener('load', () => {
      skeleton.remove();
      img.classList.add('loaded');
    });

    img.addEventListener('error', () => {
      skeleton.remove();
      img.remove();
      frame.append(window.DomUtils.el('div', { class: 'image-broken' },
        window.DomUtils.el('i', { class: 'bi bi-image-alt d-block mb-2' }),
        'Failed to load image'
      ));
    });

    img.addEventListener('click', () => {
      if (!img.classList.contains('loaded')) return;
      const expanded = window.DomUtils.el('img', {
        src,
        alt,
        class: 'img-fluid rounded'
      });
      window.DomUtils.showModal({ title: 'Image preview', body: expanded, size: 'xl' });
    });

    frame.append(img);
    return { root };
  }

  window.ImageComponent = { create };
})();
IMAGE_EOF

cat > js/components/audio.js <<'AUDIO_EOF'
(function () {
  function create(data = {}) {
    const src = data.src || data.url || '';
    const root = window.DomUtils.el('div', { class: 'audio-component' });

    if (!src) {
      root.append(window.ErrorComponent.create('Audio source is missing.'));
      return { root };
    }

    const status = window.DomUtils.el('div', { class: 'small text-muted mb-2' }, 'Loading audio…');
    const audio = window.DomUtils.el('audio', { controls: true, preload: 'metadata' });

    audio.src = src;

    audio.addEventListener('loadeddata', () => {
      status.textContent = 'Audio ready.';
    });

    audio.addEventListener('canplay', () => {
      status.textContent = 'Audio ready.';
    });

    audio.addEventListener('error', () => {
      status.textContent = 'Audio failed to load.';
      status.classList.add('text-danger');
    });

    root.append(status, audio);
    return { root };
  }

  window.AudioComponent = { create };
})();
AUDIO_EOF

cat > js/components/youtube-embed.js <<'YOUTUBE_EOF'
(function () {
  function parseYouTubeId(url) {
    if (!url) return null;

    try {
      const parsed = new URL(url, window.location.href);

      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.split('/').filter(Boolean)[0] || null;
      }

      const v = parsed.searchParams.get('v');
      if (v) return v;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const known = parts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
      if (known >= 0 && parts[known + 1]) return parts[known + 1];
    } catch (error) {
      // Fall through to generic match.
    }

    const match = String(url).match(/([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function create(data = {}) {
    const url = data.url || data.src || '';
    const videoId = parseYouTubeId(url);
    const root = window.DomUtils.el('div', { class: 'youtube-component' });

    if (!videoId) {
      root.append(window.DomUtils.el('div', { class: 'image-broken' },
        window.DomUtils.el('i', { class: 'bi bi-youtube d-block mb-2' }),
        'Invalid YouTube URL'
      ));
      return { root };
    }

    const ratio = window.DomUtils.el('div', { class: 'youtube-ratio' });
    const iframe = window.DomUtils.el('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
      title: 'YouTube player',
      loading: 'lazy',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin'
    });

    ratio.append(iframe);
    root.append(ratio);
    return { root };
  }

  window.YouTubeEmbedComponent = { create };
})();
YOUTUBE_EOF

cat > js/components/tool-usage.js <<'TOOL_USAGE_EOF'
(function () {
  function create(data = {}) {
    const name = data.name || data.tool || 'tool';
    const id = data.id || data.tool_id || '';
    const args = data.arguments ?? data.args ?? {};
    const result = data.result ?? data.response ?? '';

    const details = window.DomUtils.el('details', { class: 'tool-usage' });
    const summary = window.DomUtils.el('summary', {},
      window.DomUtils.el('i', { class: 'bi bi-gear' }),
      `Tool: ${name}`
    );

    const body = window.DomUtils.el('div', { class: 'tool-usage-body' });

    body.append(
      window.DomUtils.el('div', { class: 'detail-row' },
        window.DomUtils.el('div', { class: 'detail-label' }, 'Tool name'),
        window.DomUtils.el('div', { class: 'detail-value' }, String(name))
      ),
      window.DomUtils.el('div', { class: 'detail-row' },
        window.DomUtils.el('div', { class: 'detail-label' }, 'Tool ID'),
        window.DomUtils.el('div', { class: 'detail-value' }, String(id || '—'))
      ),
      window.DomUtils.el('div', { class: 'detail-row' },
        window.DomUtils.el('div', { class: 'detail-label' }, 'Arguments'),
        window.DomUtils.el('div', { class: 'detail-value' },
          window.DomUtils.el('pre', {}, window.FormattingUtils.prettyJson(args))
        )
      ),
      window.DomUtils.el('div', { class: 'detail-row' },
        window.DomUtils.el('div', { class: 'detail-label' }, 'Result'),
        window.DomUtils.el('div', { class: 'detail-value' },
          window.DomUtils.el('pre', {}, window.FormattingUtils.prettyJson(result))
        )
      )
    );

    details.append(summary, body);
    return { root: details };
  }

  window.ToolUsageComponent = { create };
})();
TOOL_USAGE_EOF

cat > js/components/reasoning.js <<'REASONING_EOF'
(function () {
  function create() {
    const content = window.DomUtils.el('div', { class: 'reasoning-content' });
    const details = window.DomUtils.el('details', { class: 'reasoning-block' },
      window.DomUtils.el('summary', {},
        window.DomUtils.el('i', { class: 'bi bi-lightbulb' }),
        'Reasoning'
      ),
      content
    );

    return {
      root: details,
      append(text) {
        content.textContent += String(text ?? '');
      },
      finalize() {
        // Reasoning is rendered only from backend-provided data.
      }
    };
  }

  window.ReasoningComponent = { create };
})();
REASONING_EOF

cat > js/components/code.js <<'CODE_EOF'
(function () {
  function create(data = {}) {
    const filename = data.filename || 'code.txt';
    const language = data.language || 'text';
    const code = String(data.code ?? '');

    const pre = window.DomUtils.el('pre', {
      class: 'code-viewer-body',
      style: `max-height:${window.APP_CONFIG.codeViewer.maxHeight}px`
    });

    const codeEl = window.DomUtils.el('code', { class: `language-${language}` }, code);
    pre.append(codeEl);

    if (window.hljs) {
      try {
        hljs.highlightElement(codeEl);
      } catch (error) {
        // Highlighting is optional.
      }
    }

    const copyBtn = window.DomUtils.iconButton('bi-clipboard', 'Copy code', async (button) => {
      await window.DomUtils.copyText(code);
      window.DomUtils.flashButton(button, 'bi-clipboard', 'bi-check');
    });

    const downloadBtn = window.DomUtils.iconButton('bi-download', 'Download code', () => {
      window.DownloadUtils.downloadText(filename, code);
    });

    const expandBtn = window.DomUtils.iconButton('bi-arrows-fullscreen', 'Expand code', () => {
      const body = window.DomUtils.el('pre', { class: 'code-viewer-body expanded-code' }, code);
      window.DomUtils.showModal({ title: filename, body, size: 'xl' });
    });

    const actions = window.DomUtils.el('div', { class: 'component-actions' }, copyBtn, downloadBtn);

    if (window.APP_CONFIG.features.codeExecution) {
      const runBtn = window.DomUtils.iconButton('bi-play-fill', 'Run code', (button) => {
        runCode(button);
      });
      actions.append(runBtn);
    }

    actions.append(expandBtn);

    const header = window.DomUtils.el('div', { class: 'component-header' },
      window.DomUtils.el('div', { class: 'component-title' },
        window.DomUtils.el('i', { class: 'bi bi-file-earmark-code' }),
        window.DomUtils.el('span', { class: 'component-filename' }, filename)
      ),
      window.DomUtils.el('div', { class: 'component-meta' },
        window.DomUtils.el('span', { class: 'badge language-badge' }, language)
      ),
      actions
    );

    const root = window.DomUtils.el('article', { class: 'code-component' }, header, pre);

    function runCode(button) {
      window.DomUtils.setButtonLoading(button, 'bi-play-fill');

      window.Communication.requestAvailableServers()
        .then((servers) => {
          window.DomUtils.setButtonIdle(button, 'bi-play-fill');
          openServerPicker(Array.isArray(servers) ? servers : [], { filename, language, code }, button);
        })
        .catch(() => {
          window.DomUtils.setButtonIdle(button, 'bi-play-fill');
          window.DomUtils.toast('Could not load execution servers.', 'danger');
        });
    }

    function openServerPicker(servers, payload, originButton) {
      const body = window.DomUtils.el('div', { class: 'list-group list-group-flush' });

      if (!servers.length) {
        body.append(window.DomUtils.el('div', { class: 'text-muted p-3' }, 'No execution servers available.'));
      }

      servers.forEach((server) => {
        const isOnline = !server.status || server.status === 'online' || server.status === 'available';

        const item = window.DomUtils.el('button', {
          type: 'button',
          class: 'list-group-item list-group-item-action server-item'
        },
          window.DomUtils.el('div', { class: 'd-flex justify-content-between align-items-center gap-2' },
            window.DomUtils.el('strong', {}, server.name || server.id || 'Server'),
            window.DomUtils.el('span', { class: `badge text-bg-${isOnline ? 'success' : 'secondary'}` }, server.status || 'unknown')
          ),
          window.DomUtils.el('div', { class: 'small text-muted' }, server.description || '')
        );

        if (!isOnline) item.disabled = true;

        item.addEventListener('click', () => {
          close();

          window.Communication.requestCodeExecution({
            ...payload,
            serverId: server.id,
            serverName: server.name
          })
            .then(() => {
              window.DomUtils.toast(`Execution requested on ${server.name || server.id}.`, 'success');
              if (originButton) window.DomUtils.flashButton(originButton, 'bi-play-fill', 'bi-check');
            })
            .catch(() => {
              window.DomUtils.toast('Execution request failed.', 'danger');
            });
        });

        body.append(item);
      });

      const { close } = window.DomUtils.showModal({
        title: 'Select execution server',
        body,
        size: 'md'
      });
    }

    return { root, raw: code };
  }

  window.CodeComponent = { create };
})();
CODE_EOF

cat > js/components/command.js <<'COMMAND_EOF'
(function () {
  function create(data = {}) {
    const command = String(data.command ?? data.content ?? '');
    const filename = data.filename || 'command.sh';

    const pre = window.DomUtils.el('pre', {
      class: 'code-viewer-body',
      style: `max-height:${window.APP_CONFIG.codeViewer.maxHeight}px`
    }, command);

    const copyBtn = window.DomUtils.iconButton('bi-clipboard', 'Copy command', async (button) => {
      await window.DomUtils.copyText(command);
      window.DomUtils.flashButton(button, 'bi-clipboard', 'bi-check');
    });

    const downloadBtn = window.DomUtils.iconButton('bi-download', 'Download as Bash script', () => {
      const script = command.startsWith('#!')
        ? command
        : `#!/usr/bin/env bash\nset -e\n\n${command}\n`;
      window.DownloadUtils.downloadText(filename, script, 'text/x-shellscript;charset=utf-8');
    });

    const expandBtn = window.DomUtils.iconButton('bi-arrows-fullscreen', 'Expand command', () => {
      const body = window.DomUtils.el('pre', { class: 'code-viewer-body expanded-code' }, command);
      window.DomUtils.showModal({ title: filename, body, size: 'lg' });
    });

    const header = window.DomUtils.el('div', { class: 'component-header' },
      window.DomUtils.el('div', { class: 'component-title' },
        window.DomUtils.el('i', { class: 'bi bi-terminal' }),
        window.DomUtils.el('span', { class: 'component-filename' }, filename)
      ),
      window.DomUtils.el('div', { class: 'component-meta' },
        window.DomUtils.el('span', { class: 'badge language-badge' }, 'bash')
      ),
      window.DomUtils.el('div', { class: 'component-actions' }, copyBtn, downloadBtn, expandBtn)
    );

    const root = window.DomUtils.el('article', { class: 'command-component' }, header, pre);
    return { root, raw: command };
  }

  window.CommandComponent = { create };
})();
COMMAND_EOF

cat > js/components/message.js <<'MESSAGE_EOF'
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
    const row = window.DomUtils.el('div', { class: 'message-row' }, bubble, actions);
    const root = window.DomUtils.el('div', { class: 'message user-message', 'data-message-id': id || '' }, row);

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

      row.replaceChildren(textarea, editActions);
      textarea.focus();
    }

    function finishEdit() {
      editing = false;
      bubble.textContent = currentContent;
      row.replaceChildren(bubble, actions);
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
        this.ensureMarkdown();
        this.markdownText += String(text ?? '');
        this.scheduleMarkdownRender();
      },

      addMarkdownFinal(text) {
        this.ensureMarkdown();
        this.markdownText += String(text ?? '');
        this.markdownEl.innerHTML = window.MarkdownRenderer.render(this.markdownText);
        this.highlight();
      },

      addCode(data) {
        const component = window.CodeComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`\n\`\`\`${data.language || ''}\n${data.code || ''}\n\`\`\``);
      },

      addCommand(data) {
        if (!window.APP_CONFIG.features.commands) return;
        const component = window.CommandComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`\n\`\`\`bash\n${data.command || data.content || ''}\n\`\`\``);
      },

      addImage(data) {
        const component = window.ImageComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`[image: ${data.src || data.url || ''}]`);
      },

      addAudio(data) {
        const component = window.AudioComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`[audio: ${data.src || data.url || ''}]`);
      },

      addYouTube(data) {
        if (!window.APP_CONFIG.features.youtubeEmbed) return;
        const component = window.YouTubeEmbedComponent.create(data);
        contentEl.append(component.root);
        this.rawBlocks.push(`[youtube: ${data.url || ''}]`);
      },

      addToolUsage(data) {
        if (!window.APP_CONFIG.features.toolUsage) return;
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
        contentEl.append(window.ErrorComponent.create(message).root);
      },

      addUnsupported(contentType) {
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
MESSAGE_EOF

cat > js/components/hot-answers.js <<'HOT_ANSWERS_EOF'
(function () {
  function container() {
    return document.getElementById('hot-answers');
  }

  function normalize(items) {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        if (typeof item === 'string') return { label: item, value: item };
        if (item && typeof item === 'object') {
          const label = item.label || item.text || item.title || '';
          const value = item.value || item.prompt || label;
          return label ? { label, value } : null;
        }
        return null;
      })
      .filter(Boolean);
  }

  function render(items) {
    const root = container();
    if (!root) return;

    window.DomUtils.clear(root);

    const enabled = window.APP_CONFIG.features.hotAnswers;
    const list = normalize(items).slice(0, window.APP_CONFIG.limits.maxHotAnswers);

    window.AppState.hotAnswers = list;

    if (!enabled || !list.length) {
      root.classList.add('d-none');
      return;
    }

    list.forEach((item) => {
      const button = window.DomUtils.el('button', {
        type: 'button',
        class: 'hot-answer-btn'
      }, item.label);

      button.addEventListener('click', () => {
        if (window.Chat) window.Chat.sendMessage(item.value);
      });

      root.append(button);
    });

    root.classList.remove('d-none');
  }

  function clear() {
    const root = container();
    if (!root) return;
    window.DomUtils.clear(root);
    root.classList.add('d-none');
    window.AppState.hotAnswers = [];
  }

  window.HotAnswers = { render, clear };
})();
HOT_ANSWERS_EOF

cat > js/communication.js <<'COMMUNICATION_EOF'
(function () {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const mockState = {
    pendingTool: null
  };

  function emitChunk(chunk) {
    window.Events.emit('chunk', chunk);
  }

  function emitSendState(state) {
    window.Events.emit('sendState', state);
  }

  function emitHotAnswers(items) {
    window.Events.emit('hotAnswers', items);
  }

  function mockChatList() {
    return [
      { id: 'chat-demo-1', title: 'Product brainstorm', pinned: true, temporary: false, updated_at: Date.now() - 86400000 },
      { id: 'chat-demo-2', title: 'Deployment checklist', pinned: false, temporary: false, updated_at: Date.now() - 172800000 },
      { id: 'chat-demo-3', title: 'Temporary scratchpad', pinned: false, temporary: true, updated_at: Date.now() - 3600000 }
    ];
  }

  function mockHistory(chatId) {
    if (chatId === 'chat-demo-1') {
      return {
        chatId,
        messages: [
          { role: 'user', id: 'u1', content: 'What can this frontend render?' },
          {
            role: 'assistant',
            id: 'a1',
            blocks: [
              { type: 'markdown', content: 'This UI supports **Markdown**, code blocks, Linux commands, media, and tool activity.' },
              {
                type: 'code',
                filename: 'example.js',
                language: 'javascript',
                code: 'function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet("Agent"));'
              }
            ]
          }
        ],
        hotAnswers: [
          { label: 'Show a Linux command', value: 'Show a Linux command' },
          { label: 'Trigger a tool request', value: 'Trigger a tool request' },
          { label: 'Trigger an error', value: 'Trigger an error' }
        ]
      };
    }

    if (chatId === 'chat-demo-2') {
      return {
        chatId,
        messages: [
          { role: 'user', id: 'u2', content: 'Give me a deployment checklist.' },
          {
            role: 'assistant',
            id: 'a2',
            blocks: [
              { type: 'markdown', content: '### Deployment checklist\n\n- Verify build\n- Run tests\n- Check secrets\n- Confirm rollback plan' },
              { type: 'command', command: 'git status && npm run build && npm run test' }
            ]
          }
        ],
        hotAnswers: []
      };
    }

    return { chatId, messages: [], hotAnswers: [] };
  }

  async function mockStreamRich(chatId, prompt) {
    emitChunk({ type: 'reasoning', content: `Considering request: "${prompt}".\n` });
    await sleep(220);
    emitChunk({ type: 'reasoning', content: 'Selecting a response format that demonstrates supported blocks.\n' });
    await sleep(220);

    const markdownParts = [
      'Here is a **mock streamed response**.\n\n',
      'It demonstrates incremental rendering, Markdown, and rich components.\n\n',
      '| Feature | Status |\n|---|---|\n| Streaming | OK |\n| Rich blocks | OK |\n'
    ];

    for (const part of markdownParts) {
      emitChunk({ type: 'message', content_type: 'markdown', content: part });
      await sleep(170);
    }

    emitChunk({
      type: 'message',
      content_type: 'code',
      content: 'def hello():\n    print("Hello from mock backend")\n\nhello()',
      metadata: { filename: 'hello.py', language: 'python' }
    });
    await sleep(220);

    emitChunk({
      type: 'message',
      content_type: 'command',
      content: 'python3 hello.py',
      metadata: { filename: 'run.sh' }
    });
    await sleep(220);

    emitChunk({
      type: 'message',
      content_type: 'image',
      content: 'https://picsum.photos/seed/agent-ui/900/500',
      metadata: { alt: 'Mock demo image' }
    });
    await sleep(120);

    emitChunk({
      type: 'message',
      content_type: 'audio',
      content: 'https://www.w3schools.com/html/horse.mp3'
    });
    await sleep(120);

    emitChunk({
      type: 'message',
      content_type: 'youtube_embed',
      content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    await sleep(120);

    emitChunk({
      type: 'tool_usage',
      content: {
        name: 'web_search',
        id: 'tool_web_1',
        arguments: { query: prompt },
        result: { summary: 'Mock search completed successfully.', sources: ['mock.example'] }
      }
    });
    await sleep(120);

    emitChunk({ type: 'end', content: '', metadata: { chatId } });
  }

  const mockBackend = {
    async connect() {
      await sleep(250);
      window.Events.emit('connectionStatus', 'connected');
    },

    async disconnect() {
      window.Events.emit('connectionStatus', 'disconnected');
    },

    async getChatList() {
      await sleep(200);
      return mockChatList();
    },

    async loadChatHistory() {
      return this.getChatList();
    },

    async createChat({ temporary = false } = {}) {
      await sleep(180);
      const id = `chat_${Math.random().toString(36).slice(2, 10)}`;
      return {
        id,
        title: temporary ? 'Temporary chat' : 'New chat',
        temporary,
        pinned: false,
        updated_at: Date.now()
      };
    },

    async loadChat(chatId) {
      await sleep(260);
      return mockHistory(chatId);
    },

    async sendMessage({ chatId, content }) {
      emitSendState('processing');
      await sleep(200);

      const safeChatId = chatId || `chat_${Math.random().toString(36).slice(2, 10)}`;
      window.Events.emit('chatId', safeChatId);

      const text = String(content || '').toLowerCase();

      if (text.includes('error')) {
        emitChunk({ type: 'error', content: 'Mock backend error: something failed safely and did not crash the UI.' });
        await sleep(180);
        emitChunk({ type: 'end', content: '', metadata: { chatId: safeChatId } });
        emitSendState('enabled');
        return;
      }

      if (text.includes('tool')) {
        emitChunk({ type: 'reasoning', content: 'The user requested a protected action.\n' });
        await sleep(220);
        emitChunk({
          type: 'tool_request',
          content: {
            requests: [
              {
                id: `req_${Math.random().toString(36).slice(2, 9)}`,
                tool: 'web_search',
                title: 'Tool: web_search',
                description: 'The agent wants to search the web. Choose an action.',
                options: [
                  { id: 'approve', label: 'Approve', style: { background: '#198754', color: '#fff', borderColor: '#198754' } },
                  { id: 'deny', label: 'Deny', style: { color: '#dc3545' } },
                  { id: 'reject', label: 'Reject' }
                ]
              }
            ]
          }
        });
        mockState.pendingTool = { chatId: safeChatId, prompt: content };
        emitSendState('disabled');
        return;
      }

      await mockStreamRich(safeChatId, content);
      emitSendState('enabled');
      emitHotAnswers([
        { label: 'Show a Linux command', value: 'Show a Linux command' },
        { label: 'Trigger a tool request', value: 'Trigger a tool request' },
        { label: 'Trigger an error', value: 'Trigger an error' }
      ]);
    },

    async sendToolResponse({ requestId, optionId }) {
      await sleep(260);

      const pending = mockState.pendingTool;
      mockState.pendingTool = null;

      if (!pending) return { ok: true };

      emitChunk({
        type: 'tool_usage',
        content: {
          name: 'web_search',
          id: requestId || 'tool_web_1',
          arguments: { approved_option: optionId },
          result: { state: optionId === 'approve' ? 'approved' : 'denied' }
        }
      });

      await sleep(220);

      emitChunk({
        type: 'message',
        content_type: 'markdown',
        content: optionId === 'approve'
          ? 'The tool request was approved. Continuing with the mocked answer.\n'
          : 'The tool request was not approved. Continuing safely without the tool.\n'
      });

      await sleep(220);
      emitChunk({ type: 'end', content: '', metadata: { chatId: pending.chatId } });
      emitSendState('enabled');
      return { ok: true };
    },

    async sendFeedback(payload) {
      await sleep(300);
      console.info('Mock feedback received', payload);
      return { ok: true };
    },

    async requestTranscription(blob) {
      await sleep(900);
      if (!blob || !blob.size) {
        throw new Error('Empty audio');
      }
      return { text: 'This is a mock transcription inserted into the composer.' };
    },

    async requestCodeExecution(payload) {
      await sleep(450);
      console.info('Mock code execution requested', payload);
      return { ok: true };
    },

    async requestAvailableServers() {
      await sleep(300);
      return [
        { id: 'srv-local', name: 'Local sandbox', status: 'online', description: 'Runs code in an isolated local environment.' },
        { id: 'srv-cloud', name: 'Cloud runner', status: 'online', description: 'Remote execution environment with more resources.' },
        { id: 'srv-offline', name: 'Legacy server', status: 'offline', description: 'Currently unavailable.' }
      ];
    },

    async sendAttachment(payload) {
      await sleep(200);
      console.info('Mock attachment payload', payload);
      return { ok: false, message: 'Attachment upload is not implemented yet.' };
    }
  };

  const realBackend = {
    connect() {
      window.Events.emit('connectionStatus', 'offline');
      console.warn('Communication.connect: real backend not implemented.');
      return Promise.resolve();
    },
    disconnect() {
      return Promise.resolve();
    },
    sendMessage() {
      console.warn('Communication.sendMessage: real backend not implemented.');
      return Promise.resolve();
    },
    sendToolResponse() {
      console.warn('Communication.sendToolResponse: real backend not implemented.');
      return Promise.resolve();
    },
    sendFeedback() {
      console.warn('Communication.sendFeedback: real backend not implemented.');
      return Promise.resolve();
    },
    requestTranscription() {
      return Promise.reject(new Error('Transcription not implemented.'));
    },
    requestCodeExecution() {
      console.warn('Communication.requestCodeExecution: real backend not implemented.');
      return Promise.resolve();
    },
    requestAvailableServers() {
      console.warn('Communication.requestAvailableServers: real backend not implemented.');
      return Promise.resolve([]);
    },
    loadChatHistory() {
      return Promise.resolve([]);
    },
    loadChat() {
      return Promise.resolve({ messages: [] });
    },
    createChat() {
      return Promise.resolve({ id: `chat_${Date.now()}`, title: 'New chat' });
    },
    getChatList() {
      return Promise.resolve([]);
    },
    sendAttachment() {
      return Promise.resolve({ ok: false });
    }
  };

  const backend = window.APP_CONFIG.backend.useMock ? mockBackend : realBackend;

  window.Communication = {
    connect: () => backend.connect(),
    disconnect: () => backend.disconnect(),
    sendMessage: (payload) => backend.sendMessage(payload),
    sendToolResponse: (payload) => backend.sendToolResponse(payload),
    sendFeedback: (payload) => backend.sendFeedback(payload),
    requestTranscription: (blob) => backend.requestTranscription(blob),
    requestCodeExecution: (payload) => backend.requestCodeExecution(payload),
    requestAvailableServers: () => backend.requestAvailableServers(),
    loadChatHistory: () => backend.loadChatHistory(),
    loadChat: (chatId) => backend.loadChat(chatId),
    createChat: (options) => backend.createChat(options),
    getChatList: () => backend.getChatList(),
    sendAttachment: (payload) => backend.sendAttachment(payload)
  };
})();
COMMUNICATION_EOF

cat > js/chat.js <<'CHAT_EOF'
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
    const controller = ensureStreamContext();
    const contentType = chunk.content_type || chunk.contentType || 'text';
    const content = chunk.content ?? '';
    const metadata = chunk.metadata || {};

    switch (contentType) {
      case 'text':
      case 'markdown':
        controller.appendMarkdown(extractText(content));
        break;

      case 'code': {
        const codeData = typeof content === 'object' && content !== null ? content : { code: content };
        controller.addCode({
          filename: metadata.filename || codeData.filename || 'code.txt',
          language: metadata.language || codeData.language || 'text',
          code: String(codeData.code ?? '')
        });
        break;
      }

      case 'command': {
        const commandData = typeof content === 'object' && content !== null ? content : { command: content };
        controller.addCommand({
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

    window.AppState.currentChatId = chatId;
    window.Router.setChatId(chatId, true);
    clearMessages();

    try {
      const data = await window.Communication.loadChat(chatId);
      if (data && Array.isArray(data.messages)) {
        renderHistory(data.messages);
      }

      if (data && Array.isArray(data.hotAnswers)) {
        window.HotAnswers.render(data.hotAnswers);
      } else {
        window.HotAnswers.clear();
      }

      window.Events.emit('sendState', 'enabled');
    } catch (error) {
      console.error('Failed to open chat', error);
      addSystemError('Unable to load chat.');
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

    let chatId = window.AppState.currentChatId;

    if (!chatId) {
      try {
        const chat = await window.Communication.createChat({ temporary: false });
        chatId = chat.id;
        window.AppState.currentChatId = chatId;
        window.AppState.chats = [chat, ...window.AppState.chats];
        window.Events.emit('chats:updated', window.AppState.chats);
        window.Router.setChatId(chatId, false);
      } catch (error) {
        window.DomUtils.toast('Could not start a new chat.', 'danger');
        return;
      }
    }

    const userRoot = window.MessageComponents.createUserMessage({
      id: `user_${Date.now()}`,
      content: value
    });

    appendRoot(userRoot);
    window.HotAnswers.clear();
    window.Events.emit('sendState', 'processing');

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

  window.Chat = {
    init,
    clearMessages,
    openChat,
    createChat,
    sendMessage,
    handleChunk,
    loadChatList,
    addSystemError,
    showWelcome
  };
})();
CHAT_EOF

cat > js/composer.js <<'COMPOSER_EOF'
(function () {
  const elements = {};
  let sendState = 'enabled';

  const voice = {
    mediaStream: null,
    mediaRecorder: null,
    audioContext: null,
    analyser: null,
    animationId: null,
    chunks: [],
    audioBlob: null,
    heights: []
  };

  function init() {
    elements.normal = document.getElementById('composer-normal');
    elements.recording = document.getElementById('composer-recording');
    elements.input = document.getElementById('composer-input');
    elements.sendBtn = document.getElementById('send-btn');
    elements.attachWrapper = document.getElementById('attach-wrapper');
    elements.voiceBtn = document.getElementById('voice-btn');
    elements.systemToggle = document.getElementById('system-message-toggle');
    elements.recCancel = document.getElementById('rec-cancel');
    elements.recConfirm = document.getElementById('rec-confirm');
    elements.recRetry = document.getElementById('rec-retry');
    elements.recError = document.getElementById('rec-error');
    elements.waveform = document.getElementById('waveform');

    if (!window.APP_CONFIG.features.attachments && elements.attachWrapper) {
      elements.attachWrapper.remove();
      elements.attachWrapper = null;
    } else if (elements.attachWrapper) {
      elements.attachWrapper.querySelectorAll('[data-attach]').forEach((item) => {
        item.addEventListener('click', () => {
          const type = item.getAttribute('data-attach') || 'file';
          window.Communication.sendAttachment({ type })
            .then((result) => {
              if (result && result.message) window.DomUtils.toast(result.message, 'info');
              else window.DomUtils.toast('Attachment action placeholder.', 'info');
            })
            .catch(() => window.DomUtils.toast('Attachment action failed.', 'danger'));
        });
      });
    }

    if (!window.APP_CONFIG.features.voiceInput && elements.voiceBtn) {
      elements.voiceBtn.remove();
      elements.voiceBtn = null;
    } else if (elements.voiceBtn) {
      elements.voiceBtn.addEventListener('click', startRecording);
      elements.recCancel.addEventListener('click', cancelRecording);
      elements.recConfirm.addEventListener('click', confirmRecording);
      elements.recRetry.addEventListener('click', retryTranscription);
    }

    if (elements.systemToggle) {
      elements.systemToggle.addEventListener('click', () => {
        window.AppState.systemMessage = !window.AppState.systemMessage;
        elements.systemToggle.classList.toggle('active', window.AppState.systemMessage);
        elements.systemToggle.setAttribute('aria-pressed', String(window.AppState.systemMessage));
      });
    }

    elements.input.addEventListener('input', () => {
      autoresize();
      updateSendButton();
    });

    elements.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });

    elements.sendBtn.addEventListener('click', submit);
    updateSendButton();
  }

  function autoresize() {
    if (!elements.input) return;
    elements.input.style.height = 'auto';
    elements.input.style.height = `${Math.min(elements.input.scrollHeight, 200)}px`;
  }

  function canSend() {
    return Boolean(
      elements.input &&
      elements.input.value.trim() &&
      sendState === 'enabled' &&
      !window.AppState.isStreaming
    );
  }

  function updateSendButton() {
    if (!elements.sendBtn) return;
    elements.sendBtn.disabled = !canSend();
    elements.sendBtn.classList.toggle('processing', sendState === 'processing' || sendState === 'loading');
  }

  function setSendState(state) {
    sendState = state;
    window.AppState.sendState = state;
    window.AppState.sendEnabled = state === 'enabled';
    updateSendButton();
  }

  function clearInput() {
    if (!elements.input) return;
    elements.input.value = '';
    autoresize();
    updateSendButton();
  }

  function submit() {
    if (!canSend()) return;
    const text = elements.input.value;
    clearInput();
    window.Chat.sendMessage(text);
  }

  function setRecordingMode(mode) {
    window.AppState.recording = mode;

    if (mode === 'idle') {
      elements.normal.classList.remove('d-none');
      elements.recording.classList.add('d-none');
      elements.recError.classList.add('d-none');
      window.DomUtils.setButtonIdle(elements.recConfirm, 'bi-check-lg');
      elements.recConfirm.disabled = false;
      elements.recCancel.disabled = false;
      if (elements.input) elements.input.disabled = false;
      return;
    }

    elements.normal.classList.add('d-none');
    elements.recording.classList.remove('d-none');

    if (mode === 'recording') {
      elements.recError.classList.add('d-none');
      window.DomUtils.setButtonIdle(elements.recConfirm, 'bi-check-lg');
      elements.recConfirm.disabled = false;
      elements.recCancel.disabled = false;
      if (elements.input) elements.input.disabled = true;
    }

    if (mode === 'processing') {
      elements.recError.classList.add('d-none');
      window.DomUtils.setButtonLoading(elements.recConfirm, 'bi-check-lg');
      elements.recConfirm.disabled = true;
      elements.recCancel.disabled = true;
      if (elements.input) elements.input.disabled = true;
    }

    if (mode === 'error') {
      elements.recError.classList.remove('d-none');
      window.DomUtils.setButtonIdle(elements.recConfirm, 'bi-check-lg');
      elements.recConfirm.disabled = true;
      elements.recCancel.disabled = false;
      if (elements.input) elements.input.disabled = true;
    }
  }

  async function startRecording() {
    try {
      voice.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voice.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      const source = voice.audioContext.createMediaStreamSource(voice.mediaStream);
      voice.analyser = voice.audioContext.createAnalyser();
      voice.analyser.fftSize = 256;
      source.connect(voice.analyser);

      voice.chunks = [];
      voice.audioBlob = null;
      voice.heights = [];

      voice.mediaRecorder = new MediaRecorder(voice.mediaStream);
      voice.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size) voice.chunks.push(event.data);
      };
      voice.mediaRecorder.start();

      setRecordingMode('recording');
      drawWaveform();
    } catch (error) {
      console.error('Microphone unavailable', error);
      window.DomUtils.toast('Microphone unavailable.', 'danger');
      setRecordingMode('idle');
    }
  }

  function drawWaveform() {
    const canvas = elements.waveform;
    if (!canvas || !voice.analyser) return;

    const ctx = canvas.getContext('2d');
    const data = new Uint8Array(voice.analyser.frequencyBinCount);

    function frame() {
      if (!voice.analyser) return;

      voice.analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
      }

      const rms = Math.sqrt(sum / data.length);
      const barHeight = Math.max(2, Math.min(canvas.height - 8, rms * canvas.height * 2.2));

      voice.heights.push(barHeight);
      const barWidth = 6;
      const maxBars = Math.floor(canvas.width / barWidth);
      if (voice.heights.length > maxBars) {
        voice.heights = voice.heights.slice(voice.heights.length - maxBars);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#6c8cff';
      ctx.fillStyle = accent;

      voice.heights.forEach((height, index) => {
        const x = index * barWidth;
        const y = (canvas.height - height) / 2;
        ctx.fillRect(x, y, 4, height);
      });

      voice.animationId = requestAnimationFrame(frame);
    }

    frame();
  }

  function stopAudioPipeline() {
    if (voice.animationId) {
      cancelAnimationFrame(voice.animationId);
      voice.animationId = null;
    }

    voice.analyser = null;

    if (voice.audioContext) {
      voice.audioContext.close().catch(() => {});
      voice.audioContext = null;
    }

    voice.heights = [];
  }

  function stopTracks() {
    if (voice.mediaStream) {
      voice.mediaStream.getTracks().forEach((track) => track.stop());
      voice.mediaStream = null;
    }

    if (voice.mediaRecorder && voice.mediaRecorder.state !== 'inactive') {
      try {
        voice.mediaRecorder.stop();
      } catch (error) {
        // Already stopped.
      }
    }

    voice.mediaRecorder = null;
  }

  function stopRecordingToBlob() {
    return new Promise((resolve) => {
      if (!voice.mediaRecorder) {
        resolve(null);
        return;
      }

      voice.mediaRecorder.onstop = () => {
        const blob = new Blob(voice.chunks, { type: voice.mediaRecorder.mimeType || 'audio/webm' });
        resolve(blob);
      };

      try {
        voice.mediaRecorder.stop();
      } catch (error) {
        resolve(null);
      }
    });
  }

  async function confirmRecording() {
    if (!voice.mediaRecorder) return;

    setRecordingMode('processing');
    const blob = await stopRecordingToBlob();
    stopAudioPipeline();
    stopTracks();

    await sendTranscription(blob);
  }

  async function sendTranscription(blob) {
    if (!blob || !blob.size) {
      setRecordingMode('error');
      return;
    }

    voice.audioBlob = blob;
    setRecordingMode('processing');

    try {
      const result = await window.Communication.requestTranscription(blob);
      if (!result || !result.text) throw new Error('Empty transcription');

      elements.input.value = result.text;
      autoresize();
      updateSendButton();
      voice.audioBlob = null;
      setRecordingMode('idle');
      window.DomUtils.toast('Transcription inserted into composer.', 'success');
      elements.input.focus();
    } catch (error) {
      console.error('Transcription failed', error);
      setRecordingMode('error');
    }
  }

  function retryTranscription() {
    if (!voice.audioBlob) return;
    sendTranscription(voice.audioBlob);
  }

  function cancelRecording() {
    stopAudioPipeline();
    stopTracks();
    voice.chunks = [];
    voice.audioBlob = null;
    setRecordingMode('idle');
  }

  window.Composer = {
    init,
    clearInput,
    setSendState
  };
})();
COMPOSER_EOF

cat > js/drawer.js <<'DRAWER_EOF'
(function () {
  const elements = {};

  function init() {
    elements.shell = document.getElementById('app-shell');
    elements.drawer = document.getElementById('app-drawer');
    elements.backdrop = document.getElementById('drawer-backdrop');
    elements.actions = document.getElementById('drawer-actions');
    elements.pinned = document.getElementById('pinned-chats');
    elements.history = document.getElementById('chat-history');
    elements.toggle = document.getElementById('drawer-toggle');
    elements.close = document.getElementById('drawer-close');

    if (elements.toggle) elements.toggle.addEventListener('click', toggle);
    if (elements.close) elements.close.addEventListener('click', closeOnMobile);
    if (elements.backdrop) elements.backdrop.addEventListener('click', closeOnMobile);

    window.addEventListener('resize', update);
    window.Events.on('chats:updated', renderChats);

    renderActions();
    renderChats();
    update();
  }

  function renderActions() {
    if (!elements.actions) return;
    window.DomUtils.clear(elements.actions);

    const newChat = window.DomUtils.el('button', { type: 'button', class: 'drawer-action-btn' },
      window.DomUtils.el('i', { class: 'bi bi-plus-lg' }),
      'New Chat'
    );

    newChat.addEventListener('click', async () => {
      await window.Chat.createChat(false);
      closeOnMobile();
    });

    elements.actions.append(newChat);

    if (window.APP_CONFIG.features.temporaryChat) {
      const tempChat = window.DomUtils.el('button', { type: 'button', class: 'drawer-action-btn' },
        window.DomUtils.el('i', { class: 'bi bi-hourglass-split' }),
        'Temporary Chat'
      );

      tempChat.addEventListener('click', async () => {
        await window.Chat.createChat(true);
        closeOnMobile();
      });

      elements.actions.append(tempChat);
    }

    const customActions = (window.APP_CONFIG.drawer && window.APP_CONFIG.drawer.customActions) || [];
    customActions.forEach((action) => {
      if (!action || !action.id) return;

      const button = window.DomUtils.el('button', { type: 'button', class: 'drawer-action-btn' },
        window.DomUtils.el('i', { class: `bi ${action.icon || 'bi-dot'}` }),
        action.label || action.id
      );

      button.addEventListener('click', () => {
        window.Events.emit('drawer:action', action);
      });

      elements.actions.append(button);
    });
  }

  function renderChats() {
    if (!elements.pinned || !elements.history) return;

    window.DomUtils.clear(elements.pinned);
    window.DomUtils.clear(elements.history);

    const chats = Array.isArray(window.AppState.chats) ? window.AppState.chats : [];
    const pinned = chats.filter((chat) => chat && chat.pinned);
    const history = chats.filter((chat) => chat && !chat.pinned);

    pinned.forEach((chat) => elements.pinned.append(createChatItem(chat)));
    history.forEach((chat) => elements.history.append(createChatItem(chat)));

    if (!pinned.length) {
      elements.pinned.append(window.DomUtils.el('div', { class: 'small text-muted px-2' }, 'No pinned chats.'));
    }

    if (!history.length) {
      elements.history.append(window.DomUtils.el('div', { class: 'small text-muted px-2' }, 'No chat history.'));
    }
  }

  function createChatItem(chat) {
    const button = window.DomUtils.el('button', {
      type: 'button',
      class: `chat-item ${chat.id === window.AppState.currentChatId ? 'active' : ''}`
    },
      window.DomUtils.el('span', { class: 'chat-item-label' }, chat.title || chat.id),
      window.DomUtils.el('span', { class: 'chat-item-meta' },
        chat.temporary ? window.DomUtils.el('i', { class: 'bi bi-hourglass-split' }) : '',
        chat.pinned ? window.DomUtils.el('i', { class: 'bi bi-pin-angle ms-2' }) : ''
      )
    );

    button.addEventListener('click', () => {
      window.Router.navigateToChat(chat.id);
      closeOnMobile();
    });

    return button;
  }

  function toggle() {
    window.AppState.drawerOpen = !window.AppState.drawerOpen;
    update();
  }

  function closeOnMobile() {
    if (window.innerWidth < 992) {
      window.AppState.drawerOpen = false;
      update();
    }
  }

  function update() {
    if (!elements.drawer || !elements.shell) return;

    const isMobile = window.innerWidth < 992;

    if (isMobile) {
      elements.shell.classList.remove('drawer-collapsed');
      elements.drawer.classList.toggle('open', window.AppState.drawerOpen);
      elements.backdrop.classList.toggle('show', window.AppState.drawerOpen);
    } else {
      elements.drawer.classList.remove('open');
      elements.backdrop.classList.remove('show');
      elements.shell.classList.toggle('drawer-collapsed', !window.AppState.drawerOpen);
    }

    elements.drawer.setAttribute('aria-hidden', String(!window.AppState.drawerOpen && isMobile));
  }

  window.Drawer = { init, renderChats, update };
})();
DRAWER_EOF

cat > js/tool-request.js <<'TOOL_REQUEST_EOF'
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
        if (typeof option === 'string') return { id: option, label: option };
        if (option && typeof option === 'object') {
          return {
            id: option.id || option.value || option.label || 'action',
            label: option.label || option.text || option.id || 'Action',
            value: option.value ?? option.id,
            style: option.style && typeof option.style === 'object' ? option.style : null
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  function normalizeRequests(chunk) {
    const content = chunk && chunk.content;

    let list = [];
    if (Array.isArray(content)) list = content;
    else if (content && Array.isArray(content.requests)) list = content.requests;
    else if (content && typeof content === 'object') list = [content];

    return list
      .map((request, index) => ({
        id: request.id || request.request_id || `request_${Date.now()}_${index}`,
        tool: request.tool || request.name || 'tool',
        title: request.title || `Tool: ${request.tool || request.name || 'tool'}`,
        description: request.description || request.reason || '',
        options: normalizeOptions(request.options),
        resolved: false,
        pending: false,
        raw: request
      }))
      .slice(0, window.APP_CONFIG.ui.maxVisibleToolRequests || 20);
  }

  function handleChunk(chunk) {
    window.AppState.toolRequests = normalizeRequests(chunk);
    render();
  }

  function render() {
    if (!elements.panel || !elements.list) return;

    window.DomUtils.clear(elements.list);

    const unresolved = window.AppState.toolRequests.filter((request) => !request.resolved);
    if (elements.count) elements.count.textContent = String(unresolved.length);

    if (!unresolved.length) {
      hide();
      return;
    }

    show();
    unresolved.forEach((request) => elements.list.append(createRequestCard(request)));
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
    const card = window.DomUtils.el('div', { class: 'tool-request-card' },
      window.DomUtils.el('div', { class: 'tool-request-title' }, request.title)
    );

    if (request.description) {
      card.append(window.DomUtils.el('div', { class: 'tool-request-desc' }, request.description));
    }

    card.append(window.DomUtils.el('div', { class: 'tool-request-meta' },
      `Tool: ${request.tool}`,
      request.id ? `ID: ${request.id}` : ''
    ));

    const actions = window.DomUtils.el('div', { class: 'tool-request-actions' });

    request.options.forEach((option) => {
      const button = window.DomUtils.el('button', {
        type: 'button',
        class: window.APP_CONFIG.toolRequestDefaults.buttonClass || 'btn btn-sm tool-option-btn'
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

    window.Communication.sendToolResponse({
      chatId: window.AppState.currentChatId,
      requestId: request.id,
      tool: request.tool,
      optionId: option.id,
      optionValue: option.value ?? option.id
    })
      .then(() => {
        request.resolved = true;
        window.AppState.toolRequests = window.AppState.toolRequests.filter((item) => item.id !== request.id);
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
TOOL_REQUEST_EOF

cat > js/feedback.js <<'FEEDBACK_EOF'
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
FEEDBACK_EOF

cat > js/app.js <<'APP_EOF'
(function () {
  function updateConnectionStatus(status) {
    window.AppState.connection = status;
    const badge = document.getElementById('connection-status');
    if (!badge) return;

    badge.textContent = status;
    badge.className = `topbar-status status-${status}`;
  }

  function handleRouterChange(chatId) {
    if (chatId) {
      if (chatId !== window.AppState.currentChatId) {
        window.Chat.openChat(chatId);
      }
    } else {
      window.Chat.showWelcome();
    }
  }

  function init() {
    window.ThemeManager.init();
    window.Chat.init();
    window.Drawer.init();
    window.Composer.init();
    window.ToolRequestPanel.init();
    window.Feedback.init();

    window.Events.on('chunk', (chunk) => window.Chat.handleChunk(chunk));

    window.Events.on('chatId', (chatId) => {
      if (!chatId) return;
      window.AppState.currentChatId = chatId;
      window.Router.setChatId(chatId, true);
    });

    window.Events.on('hotAnswers', (items) => {
      window.HotAnswers.render(items);
    });

    window.Events.on('sendState', (state) => {
      window.Composer.setSendState(state);
    });

    window.Events.on('connectionStatus', (status) => {
      updateConnectionStatus(status);
    });

    window.Events.on('drawer:action', (action) => {
      window.DomUtils.toast(`${action.label || action.id} will be implemented later.`, 'secondary');
    });

    window.Events.on('message:edited', (payload) => {
      console.info('Message edited', payload);
    });

    window.Router.init(handleRouterChange);
    window.Communication.connect();
    window.Chat.loadChatList();

    window.AgentUI = {
      config: window.APP_CONFIG,
      state: window.AppState,
      events: window.Events,
      communication: window.Communication,
      chat: window.Chat,
      composer: window.Composer,
      router: window.Router,
      theme: window.ThemeManager,

      sendMessage(text) {
        return window.Chat.sendMessage(text);
      },

      createChat(temporary = false) {
        return window.Chat.createChat(temporary);
      },

      openChat(chatId) {
        return window.Chat.openChat(chatId);
      },

      setTheme(theme) {
        return window.ThemeManager.set(theme);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
APP_EOF

cat > README.md <<'README_EOF'
# Agent Console Frontend

A production-oriented, configuration-driven frontend for a custom AI agent or chatbot.

The UI is built with:

- HTML5
- CSS3
- Vanilla JavaScript
- Bootstrap 5
- Bootstrap Icons
- Optional CDN libraries:
  - `marked` for Markdown rendering
  - `DOMPurify` for HTML sanitization
  - `highlight.js` for syntax highlighting

No React, Vue, Angular, Svelte, jQuery, or Tailwind is used.

---

## Project structure

```text
/
├── index.html
├── README.md
├── css/
│   └── styles.css
└── js/
    ├── config.js
    ├── app.js
    ├── communication.js
    ├── router.js
    ├── state.js
    ├── chat.js
    ├── composer.js
    ├── drawer.js
    ├── tool-request.js
    ├── feedback.js
    ├── markdown.js
    ├── theme.js
    ├── components/
    │   ├── message.js
    │   ├── code.js
    │   ├── command.js
    │   ├── image.js
    │   ├── audio.js
    │   ├── youtube-embed.js
    │   ├── tool-usage.js
    │   ├── reasoning.js
    │   ├── error.js
    │   └── hot-answers.js
    └── utils/
        ├── dom.js
        ├── download.js
        └── formatting.js
```

Important files:

- `config.js`: central configuration and feature flags.
- `state.js`: event bus and shared application state.
- `communication.js`: backend abstraction layer and mock backend.
- `chat.js`: chat rendering, chunk dispatching, streaming lifecycle.
- `composer.js`: message input, send state, system message, voice, attachments.
- `tool-request.js`: right-side tool request panel.
- `router.js`: chat ID and URL handling.

---

## Configuration

All central configuration lives in `js/config.js`.

### Feature flags

```javascript
features: {
  voiceInput: false,
  attachments: false,
  temporaryChat: true,
  reasoning: true,
  toolUsage: true,
  feedback: true,
  hotAnswers: true,
  codeExecution: true,
  commands: true,
  youtubeEmbed: true
}
```

Behavior:

- When `voiceInput` is `false`, the microphone button is not rendered.
- When `attachments` is `false`, the attachment button is not rendered.
- When `temporaryChat` is `false`, the Temporary Chat action is hidden.
- When `reasoning` is `false`, reasoning chunks are ignored.
- When `toolUsage` is `false`, tool usage blocks are ignored.
- When `feedback` is `false`, assistant feedback buttons are hidden.
- When `hotAnswers` is `false`, hot answer chips are hidden.
- When `codeExecution` is `false`, code blocks do not show Run.
- When `commands` is `false`, Linux command blocks are ignored.
- When `youtubeEmbed` is `false`, YouTube embed blocks are ignored.

### Theme configuration

```javascript
theme: {
  default: 'dark',
  storageKey: 'agent-ui-theme'
}
```

Dark mode is the default theme.

Theme switching is implemented in `js/theme.js` and uses:

- `data-bs-theme` for Bootstrap theme support
- CSS variables in `css/styles.css`
- `localStorage` persistence

Public API:

```javascript
AgentUI.setTheme('light');
AgentUI.setTheme('dark');
```

---

## Routing

Routing is centralized in `js/router.js`.

Exposed functions:

```javascript
Router.getChatId()
Router.setChatId(chatId, replace)
Router.navigateToChat(chatId)
Router.buildChatUrl(chatId)
Router.init(onChange)
```

By default the app uses hash routing:

```text
index.html#/chat/chat-demo-1
```

This makes the demo work when opened directly from the file system.

For path-based routing:

```javascript
routing: {
  useHash: false,
  basePath: '',
  chatPrefix: '/chat/'
}
```

Example URL:

```text
/chat/chat-demo-1
```

When the backend emits a chat ID event, the frontend updates the current chat ID and URL:

```javascript
Events.emit('chatId', 'chat_123');
```

---

## Communication layer

All backend communication should be implemented in:

```text
js/communication.js
```

The UI never calls WebSocket, SSE, fetch, or endpoint URLs directly from components.

The communication layer exposes:

```javascript
Communication.connect()
Communication.disconnect()
Communication.sendMessage(payload)
Communication.sendToolResponse(payload)
Communication.sendFeedback(payload)
Communication.requestTranscription(blob)
Communication.requestCodeExecution(payload)
Communication.requestAvailableServers()
Communication.loadChatHistory()
Communication.loadChat(chatId)
Communication.createChat(options)
Communication.getChatList()
Communication.sendAttachment(payload)
```

### Where to implement your backend protocol

Replace or extend the `realBackend` object inside `communication.js`.

Examples:

```javascript
// WebSocket
const socket = new WebSocket(APP_CONFIG.backend.wsUrl);

socket.onmessage = (event) => {
  const chunk = JSON.parse(event.data);
  Events.emit('chunk', chunk);
};
```

```javascript
// SSE
const source = new EventSource(APP_CONFIG.backend.sseUrl);

source.onmessage = (event) => {
  const chunk = JSON.parse(event.data);
  Events.emit('chunk', chunk);
};
```

```javascript
// HTTP send message
async sendMessage(payload) {
  const response = await fetch(`${APP_CONFIG.backend.apiUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}
```

### Uploads

Implement:

```javascript
Communication.sendAttachment(payload)
```

Use `APP_CONFIG.backend.uploadUrl` if helpful.

### Transcription

Implement:

```javascript
Communication.requestTranscription(blob)
```

The method should return:

```javascript
{ text: 'transcribed text' }
```

The transcription is inserted into the composer but is not sent automatically.

### Code execution

Implement:

```javascript
Communication.requestAvailableServers()
Communication.requestCodeExecution(payload)
```

`requestAvailableServers()` should return an array of servers:

```javascript
[
  {
    id: 'server-1',
    name: 'Production runner',
    status: 'online',
    description: 'Executes code in a sandbox',
    metadata: {}
  }
]
```

`requestCodeExecution(payload)` receives:

```javascript
{
  serverId: 'server-1',
  serverName: 'Production runner',
  filename: 'script.py',
  language: 'python',
  code: 'print("hello")'
}
```

---

## Chunk format

The backend sends chunks. Every chunk should contain:

```javascript
{
  type: 'message' | 'reasoning' | 'tool_request' | 'tool_usage' | 'error' | 'end',
  content_type: 'text' | 'markdown' | 'code' | 'command' | 'image' | 'audio' | 'youtube_embed',
  content: any,
  metadata: optional object
}
```

Incoming chunks must be emitted to the frontend as:

```javascript
Events.emit('chunk', chunk);
```

The central dispatcher is:

```javascript
Chat.handleChunk(chunk)
```

### Chunk types

#### `message`

Adds content to the active assistant message.

Example:

```javascript
{
  type: 'message',
  content_type: 'markdown',
  content: 'Hello **world**'
}
```

Supported `content_type` values:

- `text`
- `markdown`
- `code`
- `command`
- `image`
- `audio`
- `youtube_embed`

#### `reasoning`

Renders backend-provided reasoning in a compact expandable block.

```javascript
{
  type: 'reasoning',
  content: 'The model is analyzing the request.'
}
```

The frontend never invents reasoning.

#### `tool_usage`

Renders a compact expandable tool activity.

```javascript
{
  type: 'tool_usage',
  content: {
    name: 'web_search',
    id: 'tool_123',
    arguments: { query: 'weather' },
    result: { summary: 'Sunny' }
  }
}
```

#### `tool_request`

Replaces the active tool request list.

```javascript
{
  type: 'tool_request',
  content: {
    requests: [
      {
        id: 'req_123',
        tool: 'web_search',
        title: 'Tool: web_search',
        description: 'Allow web search?',
        options: [
          {
            id: 'approve',
            label: 'Approve',
            value: 'approve',
            style: {
              background: '#198754',
              color: '#ffffff',
              borderColor: '#198754'
            }
          },
          {
            id: 'deny',
            label: 'Deny'
          }
        ]
      }
    ]
  }
}
```

Important:

- A new `tool_request` chunk replaces the old list.
- The right panel appears only while unresolved requests exist.
- The user cannot dismiss unresolved requests manually.

#### `error`

Displays an error block.

```javascript
{
  type: 'error',
  content: 'The backend failed to complete the request.'
}
```

#### `end`

Finalizes the current assistant response.

```javascript
{
  type: 'end',
  content: '',
  metadata: { chatId: 'chat_123' }
}
```

All chunks before `end` belong to the same assistant message.

---

## Chat API

### Create chat

```javascript
AgentUI.createChat(false); // normal chat
AgentUI.createChat(true);  // temporary chat
```

Or:

```javascript
Chat.createChat(false);
```

### Load chat

```javascript
Chat.openChat('chat-demo-1');
```

This:

- loads chat data through `Communication.loadChat(chatId)`
- renders history
- updates the URL
- sets the current chat ID

### Open chat from URL

```javascript
Router.navigateToChat('chat-demo-1');
```

### Update chat ID from backend

```javascript
Events.emit('chatId', 'chat_123');
```

The frontend updates:

```javascript
AppState.currentChatId
```

and updates the URL.

---

## Tool requests

Tool requests appear in the right panel.

To show tool requests, emit a chunk:

```javascript
Events.emit('chunk', {
  type: 'tool_request',
  content: {
    requests: [...]
  }
});
```

### Options

Each request option may contain:

```javascript
{
  id: 'approve',
  label: 'Approve',
  value: 'approve',
  style: {
    background: '#198754',
    color: '#fff',
    borderColor: '#198754'
  }
}
```

Missing style values fall back to frontend defaults.

Malformed style values are ignored safely.

### Selected option response

When the user selects an option, the frontend calls:

```javascript
Communication.sendToolResponse({
  chatId,
  requestId,
  tool,
  optionId,
  optionValue
});
```

Implement this method to send the response to your backend.

---

## Feedback

Feedback is opened from assistant messages.

The modal supports:

- positive sentiment
- negative sentiment
- configurable quick options
- free-text comment

Quick options are configured in `config.js`:

```javascript
feedbackOptions: {
  positive: [...],
  negative: [...]
}
```

When submitted, the frontend calls:

```javascript
Communication.sendFeedback({
  messageId,
  sentiment,
  reasons,
  comment
});
```

Example payload:

```javascript
{
  messageId: 'assistant_123',
  sentiment: 'positive',
  reasons: ['Clear answer', 'Useful answer'],
  comment: 'Very helpful.'
}
```

---

## Code execution

The Run button does not execute code in the browser.

Flow:

1. User clicks Run on a code block.
2. Frontend calls:

```javascript
Communication.requestAvailableServers()
```

3. Backend returns available servers.
4. User selects a server.
5. Frontend calls:

```javascript
Communication.requestCodeExecution({
  serverId,
  serverName,
  filename,
  language,
  code
})
```

The server list is not hard-coded in the UI.

---

## Adding components

To add a new content type:

1. Create a component file:

```text
js/components/my-component.js
```

2. Expose a factory:

```javascript
window.MyComponent = {
  create(data) {
    const root = document.createElement('div');
    root.textContent = data.content || '';
    return { root };
  }
};
```

3. Add the script to `index.html`.

4. Handle the content type in `chat.js`:

```javascript
case 'my_type':
  controller.addMyType(content, metadata);
  break;
```

5. Add a method to the assistant controller in `components/message.js`:

```javascript
addMyType(data) {
  const component = window.MyComponent.create(data);
  contentEl.append(component.root);
}
```

Future component ideas:

- PDF preview
- charts
- citations
- terminal
- browser preview
- maps
- image generation
- interactive widgets

---

## Adding drawer items

The drawer is configuration-driven.

Add actions in `config.js`:

```javascript
drawer: {
  customActions: [
    { id: 'models', label: 'Models', icon: 'bi-cpu' },
    { id: 'projects', label: 'Projects', icon: 'bi-folder2' },
    { id: 'settings', label: 'Settings', icon: 'bi-gear' }
  ]
}
```

The drawer emits:

```javascript
Events.on('drawer:action', (action) => {
  console.log(action.id);
});
```

You can implement the action behavior later.

---

## Feature flags

Feature flags are located in:

```javascript
APP_CONFIG.features
```

Example:

```javascript
AgentUI.config.features.voiceInput = true;
```

For persistent changes, edit `js/config.js`.

---

## Public frontend API

The frontend exposes:

```javascript
window.AgentUI
```

### Common examples

Send a message:

```javascript
AgentUI.sendMessage('Hello agent');
```

Create a chat:

```javascript
AgentUI.createChat(false);
AgentUI.createChat(true);
```

Open a chat:

```javascript
AgentUI.openChat('chat-demo-1');
```

Change theme:

```javascript
AgentUI.setTheme('light');
AgentUI.setTheme('dark');
```

Access state:

```javascript
console.log(AgentUI.state.currentChatId);
console.log(AgentUI.state.sendState);
console.log(AgentUI.state.toolRequests);
```

Subscribe to events:

```javascript
AgentUI.events.on('chunk', (chunk) => {
  console.log('Chunk received', chunk);
});

AgentUI.events.on('sendState', (state) => {
  console.log('Send state changed', state);
});
```

Use the communication layer directly:

```javascript
AgentUI.communication.requestAvailableServers()
  .then(console.log);
```

---

## Mock / demo mode

Mock mode is enabled by:

```javascript
backend: {
  useMock: true
}
```

The mock backend simulates:

- streamed assistant messages
- Markdown
- code blocks
- Linux commands
- images
- audio
- YouTube embeds
- reasoning
- tool usage
- tool requests
- errors
- hot answers
- chat list
- chat history
- chat IDs

Demo prompts:

- Type `tool` to trigger a tool request.
- Type `error` to trigger an error.
- Type anything else to receive a rich streamed response.

To connect a real backend:

1. Set `backend.useMock = false`.
2. Implement the methods in `js/communication.js`.
3. Emit incoming chunks with:

```javascript
Events.emit('chunk', chunk);
```

---

## Performance notes

The frontend is designed for streaming performance:

- Markdown streaming is rendered with `requestAnimationFrame` batching.
- The chat is not rebuilt after every chunk.
- Streaming chunks append to the active assistant message.
- Scroll behavior only auto-scrolls when the user is near the bottom.
- Media components use lazy loading where appropriate.
- Buttons and components use event listeners attached in JavaScript, not inline handlers.

---

## Accessibility notes

The UI uses:

- semantic landmarks
- buttons with `aria-label`
- accessible Bootstrap modals
- focus-visible outlines
- keyboard-friendly controls
- reduced-motion support

README_EOF

chmod +x index.html 2>/dev/null || true

echo "Project created successfully."
echo "Open index.html in a browser or serve the directory with a static file server."