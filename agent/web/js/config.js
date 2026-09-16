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
    useHash: false,
    basePath: '',
    chatPrefix: '/chat/'
  },

  backend: {
    useMock: false,
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
    temporaryChat: false,
    reasoning: true,
    toolUsage: true,
    feedback: false,
    hotAnswers: true,
    codeExecution: false,
    commands: true,
    youtubeEmbed: true,
    systemToggle: false
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
