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
from tools.DB import DB, dict_row
import traceback
from tools.Tool import Tool
from termcolor import cprint
from utils.Parser import Parser
from tools.summarizer import summarizer, startup_summarizer, generate_title
from tools.notebook import Notebook
from tools import Instruction
from uuid import UUID
from tools.OpenAI_STT import OpenAI_STT
import hashlib
import os
import uuid

app = FastAPI()

default_tool_schema = [Tool.tools_pack_schema(), *Notebook.schema(), *Instruction.schema()]

@app.on_event("startup")
async def startup():
    await DB.init()
    await startup_summarizer()


BASE_DIR = Path(__file__).resolve().parent

Path(os.getenv("SHARED_DIR")).mkdir(parents=True, exist_ok=True)
Path(os.getenv("TEMP_DIR")).mkdir(parents=True, exist_ok=True)

stt = OpenAI_STT()

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
model_sessions = {}  # Maps client_id -> model_client
active_connections = {}  # Maps client_id -> WebSocket
histories = {}  # Maps chat_id -> {messages: [(role, content)], summary, locked: False, title, tool_requests: {tool_call_id: {name, args, type}}}

def get_file_type(mime_type):
    if not mime_type:
        return "other"

    if mime_type.startswith("image/"):
        return "image"

    if mime_type.startswith("video/"):
        return "video"

    if mime_type.startswith("audio/"):
        return "audio"

    if mime_type == "application/pdf":
        return "pdf"

    if mime_type in {
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.oasis.opendocument.text",
        "text/plain",
        "text/rtf",
    }:
        return "document"

    if mime_type in {
        "application/json",
        "application/xml",
        "text/xml",
        "text/html",
        "text/css",
        "text/javascript",
        "application/javascript",
        "text/x-python",
        "text/x-java-source",
    }:
        return "code"

    if mime_type in {
        "application/zip",
        "application/x-7z-compressed",
        "application/x-rar-compressed",
        "application/gzip",
    }:
        return "archive"

    if mime_type in {
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
    }:
        return "spreadsheet"

    if mime_type in {
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }:
        return "presentation"

    return "other"

def make_json_safe(value):
    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, dict):
        return {
            key: make_json_safe(val)
            for key, val in value.items()
        }

    if isinstance(value, list):
        return [
            make_json_safe(item)
            for item in value
        ]

    if isinstance(value, tuple):
        return [
            make_json_safe(item)
            for item in value
        ]

    return value

async def broadcast_to_chat(chat_id, event_type, data):
    """Broadcast a message to all clients in a chat"""
    message = {"type": event_type, **make_json_safe(data)}
    for client_id, ws in list(active_connections.items()):
        if user_sessions.get(client_id) == chat_id:
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {e}")

async def global_broadcast(event_type, data):
    message = {"type": event_type, **make_json_safe(data)}
    for client_id, ws in list(active_connections.items()):
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
        "parser": Parser(),
        "notebook": Notebook(),
        "uploads": {}
    }
    await broadcast_to_chat(chat["id"], "chat_lock", {"value": False})
    return chat["id"]

def tokenEstimator(messages):
    # text = json.dumps(messages, ensure_ascii=False)
    sum = 0
    for m in messages:
        sum += len((m.get("content", "") or "") + (m.get("reasoning", "") or ""))
    return sum // 3

async def start_chat_loop(chat_id: str, tools_schema = [], llm_client = None):
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
                histories[chat_id]["notebook"].notesToSystemMessage(),
                *histories[chat_id]["messages"][histories[chat_id]["summary_pointer"] or 0:]
            ],
            [*tools_schema, *default_tool_schema]
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
                    result = None
                    if tool_call["name"] in ["addNotes", "modifyNote", "deleteNotes", "deleteGroup", "search_instructions", "get_instruction"]:
                        if tool_call["name"] == "addNotes": result = histories[chat_id]["notebook"].addNotes(**tool_call["arguments"])
                        if tool_call["name"] == "modifyNote": result = histories[chat_id]["notebook"].modifyNote(**tool_call["arguments"])
                        if tool_call["name"] == "deleteNotes": result = histories[chat_id]["notebook"].deleteNotes(**tool_call["arguments"])
                        if tool_call["name"] == "deleteGroup": result = histories[chat_id]["notebook"].deleteGroup(**tool_call["arguments"])
                        if tool_call["name"] == "search_instructions": result = await Instruction.search_instructions(**tool_call["arguments"])
                        if tool_call["name"] == "get_instruction": result = await Instruction.get_instruction(**tool_call["arguments"])
                        await Chat.update_notes(chat_id, histories[chat_id]["notebook"].notes)
                        result["type"] = "tool_response"
                    else:
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
        no_messages_not_included = 10
        summary_pointer = histories[chat_id]["summary_pointer"]
        messages = histories[chat_id]["messages"]

        unsummarized_messages = messages[summary_pointer:]

        if (
            tokenEstimator(unsummarized_messages) >= 1000
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
                    notes=histories[chat_id]["notebook"].notes
                )
                histories[chat_id]["summary"] = new_summary
                histories[chat_id]["summary_pointer"] = safe_pointer
                await Chat.update_summary(chat_id, new_summary, safe_pointer)


def format_history(chat_id, messages):
    formated_history = []
    for m in messages:
        if m["role"] == "user":
            formated_history.append(m)
        elif m["role"] == "tool":
            formated_history.append({
                "tool_call_id": m["tool_call_id"],
                "result": m["content"],
                "status": m["status"],
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

def byte_type_map(b):
    types = ["file_chunk_recieved", "transcription"]
    return "unknown" if len(types) - 1 > int(b) else types[b]

# WebSocket chat endpoint
@app.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    active_connections[client_id] = websocket
    model = "gpt-5.6-luna"
    effort = LLMClient.models[model].efforts[0]
    model_sessions[client_id] = LLMClient(model_name=model, reasoning_effort=effort)
    tools_schema = []
    await websocket.send_json({"type": "models_list", "models": {n: m.efforts for n, m in LLMClient.models.items()}})
    await websocket.send_json({"type": "current_model_setting", "model": model, "effort": effort})
    instructions_list = await Instruction.get_instructions_list()
    await websocket.send_json({"type": "instructions_list", "instructions": instructions_list})
    await asyncio.sleep(0)

    try:
        chats = await Chat.get_chats()
        await websocket.send_json({"type": "chats_list", "chats": chats})
        await asyncio.sleep(0)
        while True:
            data = await websocket.receive()
            event_type = None
            if data.get("text") is not None:
                data = json.loads(data["text"])
                event_type = data.get("type")
            elif data.get("bytes") is not None:
                event_type = byte_type_map(data["bytes"][0])
                data = data["bytes"][1:]

            if event_type == "join_chat":
                chat_id = data.get("chat_id")
                if chat_id not in histories:
                    chat = await Chat.get_chat(chat_id)
                    for m in chat["messages"]:
                        if len(m.get("uploads", {})):
                            for f in m["uploads"]:
                                f["type"] = get_file_type(f["mime_type"])
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
                            "parser": Parser(),
                            "notebook": Notebook(),
                            "uploads": {}
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
                    async for _ in start_chat_loop(chat_id, tools_schema=tools_schema, llm_client=model_sessions[client_id]):
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

                message = data.get("message")
                is_system_message = data.get("is_system_message", False)

                formated_message = {
                    "role": "system" if is_system_message else "user",
                    "content": message,
                    "uploads": list(histories[chat_id].get("uploads", {}).values())
                }
                histories[chat_id]['locked'] = True
                await broadcast_to_chat(chat_id, "user_message", formated_message)
                await broadcast_to_chat(chat_id, "chat_lock", {"value": True})
                histories[chat_id]["uploads"] = {}
                if len(histories[chat_id]["messages"]) == 0:
                    title = await generate_title(message)
                    histories[chat_id]["title"] = title
                    await Chat.update_title(chat_id, title)
                    await global_broadcast("update_chat_title", {"title": title, "chat_id": str(chat_id)})
                await Message.save_message(chat_id, formated_message)
                histories[chat_id]["messages"].append(formated_message)

                async for _ in start_chat_loop(chat_id, tools_schema=tools_schema, llm_client=model_sessions[client_id]):
                    if _['type'] == 'update_settings':
                        tools_schema = _['tools_schema']

            elif event_type == "get_chats_list":
                chats = await Chat.get_chats()
                await websocket.send_json({"type": "chats_list", "chats": chats})
                await asyncio.sleep(0)

            elif event_type == "update_chat_title":
                title = data.get('title')
                chat_id = data.get('chat_id')
                await Chat.update_title(chat_id, title)
                await global_broadcast("update_chat_title", {"title": title, "chat_id": chat_id})

            elif event_type == "toggle_pinning_chat":
                chat_id = data.get('chat_id')
                await Chat.toggle_pinning_chat(chat_id)
                await global_broadcast("toggle_pinning_chat", {"chat_id": chat_id})

            elif event_type == "delete_chat":
                chat_id = data.get('chat_id')
                await Chat.delete_chat(chat_id)
                await global_broadcast("delete_chat", {"chat_id": chat_id})

            elif event_type == "delete_instruction":
                instruction_id = data.get('id')
                await Instruction.delete_instruction(instruction_id)
                instructions_list = await Instruction.get_instructions_list()
                await global_broadcast("instructions_list", {"instructions": instructions_list})

            elif event_type == "add_instruction":
                name = data.get('name')
                instructions = data.get('instructions')
                keywords = data.get('keywords')
                embeddings = data.get('embeddings')
                await Instruction.add_instruction(name=name, instructions=instructions, keywords=keywords, descriptions=embeddings)
                instructions_list = await Instruction.get_instructions_list()
                await global_broadcast("instructions_list", {"instructions": instructions_list})

            elif event_type == "stop_current_stream":
                await model_sessions[client_id].stop_stream()
            elif event_type == "update_model_settings":
                model = data.get("model")
                effort = data.get("effort")
                try:
                    model_sessions[client_id] = LLMClient(model_name=model, reasoning_effort=effort)
                    await websocket.send_json({"type": "current_model_setting", "model": model, "effort": effort})
                    await asyncio.sleep(0)
                except Exception as e:
                    await websocket.send_json({"type": "error", "content": traceback.print_exc()})
                    await asyncio.sleep(0)

            elif event_type == "remove_chat_session":
                asyncio.create_task(cleanup_chat_when_empty(user_sessions.get(client_id)))
                user_sessions.pop(client_id, None)
            elif event_type == "start_file_upload":
                file_name = data["name"]
                file_size = data["size"]
                mime_type = data["mime_type"]
                chunk_size = data["chunk_size"]
                file_id = data["file_id"]
                chat_id = None
                if user_sessions.get(client_id) is None:
                    chat_id = await create_chat()
                    user_sessions[client_id] = chat_id
                else:
                    chat_id = user_sessions[client_id]
                histories[chat_id].get("uploads", {})[file_id] = {
                    "file_id": file_id,
                    "file_name": file_name,
                    "file_size": file_size,
                    "mime_type": mime_type,
                    "chunk_size": chunk_size,
                    "encoding": hashlib.sha256(),
                    "file": open(Path(os.getenv("TEMP_DIR"), file_id), "wb"),
                }
            elif event_type == "file_chunk_recieved":
                file_id = str(uuid.UUID(bytes=data[:16]))
                chunk = data[16:]
                chat_id = user_sessions[client_id]
                histories[chat_id]["uploads"][file_id]["file"].write(chunk)
                histories[chat_id]["uploads"][file_id]["encoding"].update(chunk)
            elif event_type == "finish_file_upload":
                file_id = data["file_id"]
                file = histories[chat_id]["uploads"][file_id]
                encoding = data["encoding"]
                chat_id = user_sessions[client_id]
                if file["encoding"].hexdigest() != encoding:
                    await websocket.send_json(
                        {"type": "file_upload_status", "status": "failed", "file_id": file_id, "message": "encoding mismatch"}
                    )
                else:
                    os.rename(
                        Path(os.getenv("TEMP_DIR"), file_id),
                        Path(os.getenv("SHARED_DIR"), file_id)
                    )
                    file["encoding"] = None
                    file["file"] = None
                    async with DB.connection() as conn:
                        async with conn.cursor(row_factory=dict_row) as cursor:
                            await cursor.execute(
                                f"""INSERT INTO files (id, name, size, mime_type)
                                VALUES (%s, %s, %s, %s)""",
                                (file_id, file["file_name"], file["file_size"], file["mime_type"])
                            )
                    await websocket.send_json(
                        {"type": "file_upload_status", "status": "success", "file_type": get_file_type(histories[chat_id]["uploads"][file_id]["mime_type"]), "file_id": file_id}
                    )
            elif event_type == "cancel_file_upload":
                file_id = data["file_id"]
                async with DB.connection() as conn:
                    async with conn.cursor(row_factory=dict_row) as cursor:
                        await cursor.execute(
                            f"""DELETE FROM files WHERE id = %s""",
                            (file_id,)
                        )
                Path(os.getenv("TEMP_DIR"), file_id).unlink(missing_ok=True)
                Path(os.getenv("SHARED_DIR"), file_id).unlink(missing_ok=True)
                del histories[chat_id]["uploads"][file_id]
            elif event_type == "transcription":
                audio = data
                result = stt.transcribe(
                    audio_bytes=audio,
                    keywords=[],
                )
                result["type"] = "transcription"
                await websocket.send_json(result)

    except Exception as e:
        cprint(traceback.print_exc(), "red")
    finally:
        chat_id = user_sessions.get(client_id)

        if client_id in user_sessions:
            user_sessions.pop(client_id, None)

        if client_id in active_connections:
            del active_connections[client_id]
            del model_sessions[client_id]

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
