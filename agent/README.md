### Messages broadcasted to UI

- {type: "request_tool", tool, options}
- {type: "message", content_type, content}
- {type: "reasoning", content}
- {type: "error", content}
- {type: "history", messages, locked}
- {type: "chat_created", chat_id}
- {type: "chats_list", chats}
- {type: "chat_lock", value}

### Messages to server

- {type: "join_chat", chat_id}
- {type: "tool_request", tool_call_id, action}
- {type: "message", message, is_system_message}
- {type: "get_chats_list"}

## Problems to solve

### Big problems

- summary is called multible times

### Small problems

- audio needs more controllers
- IDEs need run button and select server (i think they are just disabled in configurations)
- code IDE needs coloring

## TODO

- make command/code controllers stick at top of page
- make stop generating button
- make stop tool execution button
- add the ability to queue a user message between tool executions
- add cost calculator
- add pagination to chats list
