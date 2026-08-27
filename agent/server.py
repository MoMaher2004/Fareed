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

# Initialize llm_client and app
llm_client = LLMClient(model_name="deepseek-v4-flash")
app = FastAPI()


@app.on_event("startup")
async def startup():
    await DB.init()


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
        "locked": False,
        "title": None,
        "tool_requests": {},
    }
    return chat["id"]

async def start_chat_loop(chat_id: str):
    exit_loop = False
    while exit_loop == False:
        response_message = []
        reasoning_message = []
        async for chunk in llm_client.stream(
            [system_message(), *histories[chat_id]["messages"]]
        ):
            """
            chunk types: tool_calls, message, reasoning, error, end
            """
            if chunk.get("type") == "tool_calls":
                assistant_message = {
                    'role': 'assistant',
                    'content': ''.join(response_message) if len(response_message) > 0 else None,
                    'reasoning': ''.join(reasoning_message) if len(reasoning_message) > 0 else None,
                    'tool_calls': chunk.get("tool_calls"),
                }

                await Message.save_message(chat_id, assistant_message)
                histories[chat_id]["messages"].append(assistant_message)

                for tool_call in chunk.get("tool_calls"):
                    print("\033[34m",tool_call,"\033[0m")
                    result = await Tool.request_tool(
                        modelName=llm_client.model.name,
                        tool_call_id=tool_call["id"],
                        tool=tool_call["name"],
                        arguments=json.loads(tool_call["arguments"]),
                    )
                    print("\033[36m",result,"\033[0m")

                    if result.get('type') == "tool_response":
                        if result.get('status') != 'waiting approval':
                            await Message.save_message(chat_id, assistant_message)
                            histories[chat_id]["messages"].append(
                                {
                                    "role": "tool",
                                    "content": result.get("content") if result.get("status") == 'success' else 'denied' if result.get("status") == 'denied' else f"error: {result.get('content')}",
                                    "tool_call_id": tool_call_id,
                                }
                            )
                        else:
                            histories[chat_id]["tool_requests"][tool_call["id"]] = {
                                    "name": tool_call["name"],
                                    "arguments": json.loads(tool_call["arguments"]),
                                    "type": tool_call["type"],
                                }
                            await broadcast_to_chat(
                                chat_id, "server_request_tool", {"tool": result.get('tool'), "options": result.get('options')}
                            )
                            await asyncio.sleep(0)
                            exit_loop = True
                    
            elif chunk.get("type") == "message":
                response_message += chunk["content"]
                await broadcast_to_chat(
                    chat_id, "server_message", {"content": chunk["content"]}
                )
                await asyncio.sleep(0)
            elif chunk.get("type") == "reasoning":
                reasoning_message += chunk["content"]
                await broadcast_to_chat(
                    chat_id, "server_reasoning", {"content": chunk["content"]}
                )
                await asyncio.sleep(0)
            elif chunk.get("type") == "error":
                await broadcast_to_chat(
                    chat_id, "server_error", {"content": chunk["content"]}
                )
                await asyncio.sleep(0)
            elif chunk.get("type") == "end":
                assistant_message = {
                    'role': 'assistant',
                    'content': ''.join(response_message) if len(response_message) > 0 else None,
                    'reasoning_content': ''.join(reasoning_message) if len(reasoning_message) > 0 else None,
                }

                await Message.save_message(chat_id, assistant_message)
                histories[chat_id]["messages"].append(assistant_message)
                histories[chat_id]['locked'] = False
                exit_loop = True
            else:
                await broadcast_to_chat(
                    chat_id, "server_error", {"content": "chunk type is unknown"}
                )
                await asyncio.sleep(0)
                exit_loop = True


# WebSocket endpoint
@app.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    active_connections[client_id] = websocket

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "join_chat":
                chat_id = data.get("chat_id")
                if chat_id not in histories:
                    print(chat_id)
                    chat = await Chat.get_chat(chat_id)
                    if chat is None:
                        print(chat)
                        await websocket.send_json(
                            {"type": "error", "message": "Chat not found"}
                        )
                    else:
                        histories[chat_id] = {
                            "messages": [
                                (m["role"], m["content"]) for m in chat["messages"]
                            ],
                            "summary": chat["summary"] or None,
                            "locked": len(chat.get("tool_requests", {})) > 0,
                            "title": chat["title"],
                            "tool_requests": chat.get("tool_requests", {}),
                        }
                        user_sessions[client_id] = chat_id
                        await websocket.send_json(
                            {
                                "type": "history",
                                "messages": histories[chat_id]["messages"],
                                "locked": False,
                            }
                        )
                else:
                    user_sessions[client_id] = chat_id
                    await websocket.send_json(
                        {
                            "type": "history",
                            "messages": histories[chat_id]["messages"],
                            "locked": histories[chat_id]["locked"],
                        }
                    )

            elif event_type == "tool_request":
                if client_id not in user_sessions:
                    await websocket.send_json(
                        {"type": "error", "message": "You must join a chat first"}
                    )
                    continue
                tool_call_id = data.get("tool_call_id")
                request = histories[user_sessions[client_id]]["tool_requests"][tool_call_id]
                action = data.get("action")
                result = await Tool.process_tool_request(tool_call_id, action, request)
                await Message.save_message(chat_id, assistant_message)
                histories[chat_id]["messages"].append(
                    {
                        "role": "tool",
                        "content": result.get("content") if result.get("status") == 'success' else 'denied' if result.get("status") == 'denied' else f"error: {result.get('content')}",
                        "tool_call_id": tool_call_id,
                    }
                )
                del histories[user_sessions[client_id]]["tool_requests"][tool_call_id]
                await start_chat_loop(chat_id)
            elif event_type == "client_message":
                chat_id = None
                if client_id not in user_sessions:
                    chat_id = await create_chat()
                    await asyncio.sleep(0)
                    user_sessions[client_id] = chat_id
                    await websocket.send_json({"type": "chat_created", "chat_id": str(chat_id)})
                else:
                    chat_id = user_sessions[client_id]

                if histories[chat_id]["locked"]:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Chat is locked. No further messages can be sent.",
                        }
                    )
                    continue

                histories[chat_id]['locked'] = True
                message = data.get("message")
                is_system_message = data.get("is_system_message", False)

                formated_message = {
                    "role": "system" if is_system_message else "user",
                    "content": message,
                }
                await Message.save_message(chat_id, formated_message)
                histories[chat_id]["messages"].append(formated_message)

                # summarize chat
                await start_chat_loop(chat_id)

    except Exception as e:
        traceback.print_exc()
    finally:
        if client_id in user_sessions:
            del user_sessions[client_id]
        if client_id in active_connections:
            del active_connections[client_id]

# REST endpoints
@app.get("/chats")
async def get_chats():
    chats = await Chat.get_chats()
    return JSONResponse(chats)


@app.get("/chats/{chat_id}")
async def get_chat(chat_id: int):
    messages = await Message.get_messages(chat_id)
    return JSONResponse(messages)


@app.post("/chats")
async def add_chat():
    chat = await Chat.add_chat()
    return JSONResponse(chat)


@app.get("/")
async def ui():
    return FileResponse(BASE_DIR / "web" / "index.html")


app.mount("/", StaticFiles(directory="web"), name="web")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=5000, log_level="info")
