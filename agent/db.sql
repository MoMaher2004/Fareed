PRAGMA foreign_keys = ON;

-- =========================
-- CHAT
-- =========================
CREATE TABLE CHAT (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    summary TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- TOOL
-- =========================
CREATE TABLE TOOL (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT NOT NULL,
    input_schema TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER DEFAULT 1
);

-- =========================
-- MESSAGE
-- =========================
CREATE TABLE MESSAGE (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES CHAT(id) ON DELETE CASCADE
);

-- =========================
-- MEMORY
-- =========================
CREATE TABLE MEMORY (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES CHAT(id) ON DELETE CASCADE
);

-- =========================
-- CRON_JOB
-- =========================
CREATE TABLE CRON_JOB (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time DATETIME NOT NULL,
    next_runtime DATETIME,
    last_runtime DATETIME,
    dead_time DATETIME NOT NULL,
    importance TEXT NOT NULL DEFAULT "ignorable",
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    on_pass_action TEXT NOT NULL,
    is_done INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- CHAT_FEEDBACK
-- =========================
CREATE TABLE CHAT_FEEDBACK (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    expected_behavior TEXT,
    actual_behavior TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES CHAT(id) ON DELETE CASCADE
);

-- =========================
-- TOOL_CALL
-- =========================
CREATE TABLE TOOL_CALL (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    tool_id INTEGER,
    input_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES MESSAGE(id) ON DELETE SET NULL,
    FOREIGN KEY (tool_id) REFERENCES TOOL(id) ON DELETE SET NULL
);

-- =========================
-- TOOL_RESULT
-- =========================
CREATE TABLE TOOL_RESULT (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_call_id INTEGER NOT NULL,
    output_payload TEXT NOT NULL,
    summarized_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tool_call_id) REFERENCES TOOL_CALL(id) ON DELETE CASCADE
);

-- =========================
-- TOOL_CALL_FEEDBACK
-- =========================
CREATE TABLE TOOL_CALL_FEEDBACK (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_call_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    expected_behavior TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tool_call_id) REFERENCES TOOL_CALL(id) ON DELETE CASCADE
);

-- =========================
-- TOOL_EXAMPLE
-- =========================
CREATE TABLE TOOL_EXAMPLE (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    input_text TEXT NOT NULL,
    input_params TEXT NOT NULL DEFAULT "{}",
    expected_output TEXT,
    FOREIGN KEY (tool_id) REFERENCES TOOL(id) ON DELETE CASCADE
);

-- =========================
-- TOOL_INSTRUCTION
-- =========================
CREATE TABLE TOOL_INSTRUCTION (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (tool_id) REFERENCES TOOL(id) ON DELETE CASCADE
);

-- =========================
-- TOOL_INSTRUCTION_HISTORY
-- =========================
CREATE TABLE TOOL_INSTRUCTION_HISTORY (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_instruction_id INTEGER NOT NULL,
    old_prompt TEXT NOT NULL,
    new_prompt TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    is_applied INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tool_instruction_id) REFERENCES TOOL_INSTRUCTION(id) ON DELETE CASCADE
);