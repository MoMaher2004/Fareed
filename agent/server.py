from dotenv import load_dotenv

load_dotenv()  # Load .env (DB credentials, API keys) before any module reads os.getenv()

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
from llms.LLMClient import LLMClient
from tools.Message import Message
from tools.Chat import Chat
import asyncio
from fastapi.responses import FileResponse
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from utils.system_message import system_message
from tools.DB import DB
import traceback
from tools.Tool import Tool
from termcolor import cprint
from utils.Parser import Parser
from tools.summarizer import summarizer, startup_summarizer

# Initialize llm_client and app
llm_client = LLMClient(model_name="deepseek-v4-pro")
app = FastAPI()


@app.on_event("startup")
async def startup():
    await DB.init()
    await startup_summarizer()


BASE_DIR = Path(__file__).resolve().parent


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
user_sessions = {}  # Maps client_id -> chat_id
active_connections = {}  # Maps client_id -> WebSocket
histories = {}  # Maps chat_id -> {messages: [(role, content)], summary, locked: False, title, tool_requests: {tool_call_id: {name, args, type}}}


async def broadcast_to_chat(chat_id, event_type, data):
    """Broadcast a message to all clients in a chat"""
    message = {"type": event_type, **data}
    for client_id, ws in list(active_connections.items()):
        if user_sessions.get(client_id) == chat_id:
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {e}")


async def create_chat():
    """Create a new chat, cache it and return its ID"""
    chat = await Chat.add_chat()
    histories[chat["id"]] = {
        "messages": [],
        "summary": None,
        "summary_pointer": 0,
        "locked": False,
        "title": None,
        "tool_requests": {},
        "parser": Parser()
    }
    await broadcast_to_chat(chat["id"], "chat_lock", {"value": False})
    return chat["id"]

def tokenEstimator(messages):
    text = json.dumps(messages, ensure_ascii=False)
    return len(text) // 3

async def start_chat_loop(chat_id: str, tools_schema = []):
    exit_loop = False
    while exit_loop == False:
        response_message = []
        reasoning_message = []
        async for chunk in llm_client.stream(
            [
                system_message(),
                {
                    "role": "system",
                    "content": f"""
                    Conversation summary:
                    {histories[chat_id]["summary"]}
                    """
                },
                *histories[chat_id]["messages"][histories[chat_id]["summary_pointer"]:]
            ],
            tools_schema
        ):
            """
            chunk types: tool_calls, message, reasoning, error, end
            """
            if chunk.get("type") == "tool_calls":
                assistant_message = {
                    'role': 'assistant',
                    'content': ''.join(response_message) if len(response_message) > 0 else None,
                    'reasoning_content': ''.join(reasoning_message) if len(reasoning_message) > 0 else None,
                    'tool_calls': chunk.get("tool_calls"),
                }

                await Message.save_message(chat_id, assistant_message)
                histories[chat_id]["messages"].append(assistant_message)

                for tool_call in chunk.get("tool_calls"):
                    await Tool.update_tool_call_status(tool_call["id"], "running")
                    await broadcast_to_chat(chat_id, "tool_start", {"tool_call_id": tool_call["id"], "name": tool_call["name"], "arguments": tool_call["arguments"]})
                    result = await Tool.request_tool(
                        modelName=llm_client.model.name,
                        tool_call_id=tool_call["id"],
                        tool_name=tool_call["name"],
                        arguments=tool_call["arguments"],
                        schema=tools_schema
                    )
                    await Tool.update_tool_call_status(tool_call["id"], result.get("status"))

                    if result.get('type') == "tool_response":
                        if result.get('tools_schema') and len(result.get('tools_schema')) > 0:
                            tools_schema.extend(result.get('tools_schema'))
                        if result.get('status') in ['error', 'success', 'denied']:
                            tool_message = {
                                    "role": "tool",
                                    "content": result.get("content") if result.get("status") == 'success' else 'denied' if result.get("status") == 'denied' else f"error",
                                    "tool_call_id": tool_call["id"],
                                    "status": result.get('status'),
                                    "full_content": result.get("content") if result.get("status") == 'success' else 'denied' if result.get("status") == 'denied' else f"error: {result.get('content')}"
                                }
                            await Message.save_message(chat_id, tool_message)
                            histories[chat_id]["messages"].append(tool_message)
                            await broadcast_to_chat(chat_id, "tool_result", {"tool_call_id": tool_call["id"], "result": tool_message.get('full_content'), "status": result.get('status')})
                        elif result.get('status') == "waiting approval":
                            histories[chat_id]["tool_requests"][tool_call["id"]] = {
                                    "name": tool_call["name"],
                                    "arguments": tool_call["arguments"],
                                    "type": tool_call["type"],
                                }
                            await broadcast_to_chat(
                                chat_id, "request_tool", {"requests": [{"tool": result.get('tool'), "options": result.get('options'), "tool_call_id": tool_call["id"], "name": result['tool']['name'], "arguments": result['tool']['arguments']}]}
                            )
                            await asyncio.sleep(0)
                            exit_loop = True
                    
            elif chunk.get("type") == "message":
                response_message += chunk["content"]
                parsed_chunk = histories[chat_id]["parser"].parse(chunk["content"])
                for c in parsed_chunk:
                    await broadcast_to_chat(
                        chat_id, "message", {"content_type": c.get("type"), "content": c.get("content")}
                    )
                await asyncio.sleep(0)
            elif chunk.get("type") == "reasoning":
                reasoning_message += chunk["content"]
                await broadcast_to_chat(
                    chat_id, "reasoning", {"content": chunk["content"]}
                )
                await asyncio.sleep(0)
            elif chunk.get("type") == "error":
                await broadcast_to_chat(
                    chat_id, "error", {"content": chunk["content"]}
                )
                await asyncio.sleep(0)
            elif chunk.get("type") == "end":
                yield {'type': 'update_settings', "tools_schema": []}
                tools_schema = []
                assistant_message = {
                    'role': 'assistant',
                    'content': ''.join(response_message) if len(response_message) > 0 else None,
                    'reasoning_content': ''.join(reasoning_message) if len(reasoning_message) > 0 else None,
                }
                
                await Message.save_message(chat_id, assistant_message)
                histories[chat_id]["messages"].append(assistant_message)
                histories[chat_id]['locked'] = False
                await broadcast_to_chat(chat_id, "chat_lock", {"value": False})
                await broadcast_to_chat(chat_id, "end", {})
                exit_loop = True
            else:
                await broadcast_to_chat(
                    chat_id, "error", {"content": "chunk type is unknown"}
                )
                await asyncio.sleep(0)
                exit_loop = True

        # summarize
        no_messages_not_included = 15
        summary_pointer = histories[chat_id]["summary_pointer"]
        messages = histories[chat_id]["messages"]

        unsummarized_messages = messages[summary_pointer:]

        if (
            tokenEstimator(unsummarized_messages) >= 10000
            and len(messages) - no_messages_not_included > summary_pointer
        ):
            safe_pointer = summary_pointer
            max_boundary = len(messages) - no_messages_not_included

            for i in range(summary_pointer, max_boundary):
                message = messages[i]

                if (
                    message.get("role") == "assistant"
                    and not message.get("tool_calls")
                ):
                    safe_pointer = i + 1

            if safe_pointer > summary_pointer:
                new_summary = await summarizer(
                    messages[summary_pointer:safe_pointer],
                    oldSummary=histories[chat_id]["summary"],
                    notes=None
                )

                histories[chat_id]["summary"] = new_summary
                histories[chat_id]["summary_pointer"] = safe_pointer


def format_history(chat_id, messages):
    formated_history = []
    for m in messages:
        if m["role"] == "user": formated_history.append(m)
        elif m["role"] == "tool":
            formated_history.append({
                "tool_call_id": m["tool_call_id"],
                "result": m["content"]
            })
        elif m["role"] == "assistant":
            if m.get("reasoning_content"): formated_history.append({
                "role": "assistant",
                "type": "reasoning",
                "content": m.get("reasoning_content")
            })
            if m.get("content"): formated_history.append({
                "role": "assistant",
                "type": "message",
                "content": histories[chat_id]["parser"].parse_message(m.get("content"))
            })
            if m.get("tool_calls") and len(m.get("tool_calls")) > 0: formated_history.extend([{
                "role": "assistant",
                "type": "tool_start",
                "tool_call_id": tc.get("id"),
                "name": tc.get("name"),
                "arguments": tc.get("arguments")
            } for tc in m.get("tool_calls")])
    return formated_history

async def cleanup_chat_when_empty(chat_id):
    while True:
        await asyncio.sleep(10)

        if chat_id not in histories:
            break

        users_in_chat = any(
            current_chat_id == chat_id
            for current_chat_id in user_sessions.values()
        )

        if not users_in_chat and not histories[chat_id]["locked"]:
            del histories[chat_id]
            break


# WebSocket endpoint
@app.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    active_connections[client_id] = websocket
    tools_schema = []

    try:
        chats = await Chat.get_chats()
        await websocket.send_json({"type": "chats_list", "chats": chats})
        await asyncio.sleep(0)
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "join_chat":
                chat_id = data.get("chat_id")
                if chat_id not in histories:
                    chat = await Chat.get_chat(chat_id)
                    if chat is None:
                        await websocket.send_json(
                            {"type": "error", "message": "Chat not found"}
                        )
                    else:
                        histories[chat_id] = {
                            "messages": chat["messages"],
                            "summary": chat["summary"],
                            "title": chat["title"],
                            "summary_pointer": chat["summary_pointer"] or 0,
                            "tool_requests": chat.get("tool_requests", {}),
                            "locked": False,
                            "parser": Parser()
                        }
                        for m in chat['messages']:
                            if m.get("tool_calls"):
                                for tc in m['tool_calls']:
                                    if tc.get("status") == "running":
                                        await Tool.update_tool_call_status(tc["id"], "error")
                                        tool_message = {
                                            "role": "tool",
                                            "content": "unexpected shutdown due to chat termination while execution",
                                            "tool_call_id": tc["id"],
                                            "status": "error",
                                            "full_content": "unexpected shutdown due to chat termination while execution"
                                        }
                                        await Message.save_message(chat_id, tool_message)
                                        histories[chat_id]["messages"].append(tool_message)
                        user_sessions[client_id] = chat_id
                        await websocket.send_json({"type": "update_chat_id", "chat_id": str(chat_id)})
                        await websocket.send_json({"type": "chat_lock", "value": histories[chat_id]["locked"]})
                        await websocket.send_json(
                            {
                                "type": "history",
                                "messages": format_history(chat_id, histories[chat_id]["messages"]),
                            }
                        )
                else:
                    user_sessions[client_id] = chat_id
                    await websocket.send_json({"type": "update_chat_id", "chat_id": str(chat_id)})
                    await websocket.send_json({"type": "chat_lock", "value": (len(histories[chat_id].get("tool_requests", {})) > 0)})
                    await websocket.send_json(
                        {
                            "type": "history",
                            "messages": format_history(chat_id, histories[chat_id]["messages"]),
                        }
                    )
                await broadcast_to_chat(
                    chat_id,
                    "request_tool",
                    {"requests": [{"tool": {"name": v['name'], "arguments": v['arguments']}, "options": ["approve", "deny"], "type": v["type"], "tool_call_id": k, "name": v['name'], "arguments": v['arguments']} for k, v in histories[chat_id].get("tool_requests", {}).items()]}
                )

            elif event_type == "tool_response":
                if client_id not in user_sessions:
                    await websocket.send_json(
                        {"type": "error", "message": "You must join a chat first"}
                    )
                    continue
                chat_id = user_sessions[client_id]
                tool_call_id = data.get("tool_call_id")
                request = histories[user_sessions[client_id]]["tool_requests"][tool_call_id]
                action = data.get("action") or data.get("option")
                await Tool.update_tool_call_status(tool_call_id, "running")
                result = await Tool.process_tool_request(tool_call_id, action, request)
                await Tool.update_tool_call_status(tool_call_id, result.get("status"))
                tool_message = {
                    "role": "tool",
                    "content": result.get("content") if result.get("status") == 'success' else 'denied' if result.get("status") == 'denied' else f"error",
                    "tool_call_id": tool_call_id,
                    "status": result.get('status'),
                    "full_content": result.get("content") if result.get("status") == 'success' else 'denied' if result.get("status") == 'denied' else f"error: {result.get('content')}"
                }
                await Message.save_message(chat_id, tool_message)
                histories[chat_id]["messages"].append(tool_message)
                await broadcast_to_chat(chat_id, "tool_result", {"tool_call_id": tool_call_id, "result": tool_message.get('full_content'), "status": result.get('status')})
                del histories[user_sessions[client_id]]["tool_requests"][tool_call_id]
                if len(histories[user_sessions[client_id]]["tool_requests"]) == 0:
                    async for _ in start_chat_loop(chat_id, tools_schema=tools_schema):
                        if _['type'] == 'update_settings' and _['tools_schema'] and len(_['tools_schema']) > 0:
                            tools_schema = _['tools_schema']
            elif event_type == "message":
                chat_id = None
                if client_id not in user_sessions:
                    chat_id = await create_chat()
                    await asyncio.sleep(0)
                    user_sessions[client_id] = chat_id
                    await websocket.send_json({"type": "update_chat_id", "chat_id": str(chat_id)})
                else:
                    chat_id = user_sessions[client_id]

                if histories[chat_id].get("locked"):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Chat is locked. No further messages can be sent.",
                        }
                    )
                    continue

                histories[chat_id]['locked'] = True
                await broadcast_to_chat(chat_id, "chat_lock", {"value": True})
                message = data.get("message")
                is_system_message = data.get("is_system_message", False)

                formated_message = {
                    "role": "system" if is_system_message else "user",
                    "content": message,
                }
                await Message.save_message(chat_id, formated_message)
                histories[chat_id]["messages"].append(formated_message)

                async for _ in start_chat_loop(chat_id, tools_schema=tools_schema):
                    if _['type'] == 'update_settings':
                        tools_schema = _['tools_schema']

            elif event_type == "get_chats_list":
                chats = await Chat.get_chats()
                await ws.send_json({"type": "chats_list", "chats": chats})
                await asyncio.sleep(0)

            elif event_type == "remove_chat_session":
                asyncio.create_task(cleanup_chat_when_empty(user_sessions.get(client_id)))
                del user_sessions[client_id]

    except Exception as e:
        cprint(traceback.print_exc(), "red")
    finally:
        chat_id = user_sessions.get(client_id)

        if client_id in user_sessions:
            del user_sessions[client_id]

        if client_id in active_connections:
            del active_connections[client_id]

        if chat_id is not None and chat_id in histories:
            asyncio.create_task(cleanup_chat_when_empty(chat_id))

# REST endpoints

@app.get("/")
async def ui():
    return FileResponse(BASE_DIR / "web" / "index.html")

@app.get("/chat/{chat_id}")
async def chat_ui(chat_id: str):
    return FileResponse(BASE_DIR / "web" / "index.html")


app.mount("/", StaticFiles(directory="web"), name="web")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=5000, log_level="info")
