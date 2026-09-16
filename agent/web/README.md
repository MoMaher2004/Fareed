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

