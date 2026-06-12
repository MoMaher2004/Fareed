
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
from Agent import Agent, tools_map, tools_schema, models
from tools.Message import Message
from tools.Chat import Chat
import asyncio

# Initialize agent and app
agent = Agent(models["deepseek-chat"], tools_map, tools_schema)
app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
user_sessions = {}  # Maps client_id -> room_name
active_connections = {}  # Maps client_id -> WebSocket

def room_name(chat_id):
    return f"chat_{chat_id}"

async def broadcast_to_room(room, event_type, data):
    """Broadcast a message to all clients in a room"""
    message = {"type": event_type, **data}
    for client_id, ws in list(active_connections.items()):
        if user_sessions.get(client_id) == room:
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {e}")

# WebSocket endpoint
@app.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    active_connections[client_id] = websocket
    
    print(f"\033[32mClient connected: {client_id}\033[0m")
    
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            
            if event_type == "join_chat":
                # Handle join_chat event
                chat_id = data.get("chat_id")
                room = room_name(chat_id)
                
                if client_id in user_sessions:
                    del user_sessions[client_id]
                
                user_sessions[client_id] = room
                print(f"\033[32mClient joined room: {room}\033[0m")
            
            elif event_type == "client_message":
                # Handle client_message event
                if client_id not in user_sessions:
                    await websocket.send_json({
                        "type": "server_error",
                        "error": "You must join a chat before sending messages."
                    })
                    await asyncio.sleep(0)
                    continue
                
                message = data.get("message")
                chat_id = data.get("chat_id")
                is_system_message = data.get("is_system_message", False)
                room = user_sessions[client_id]
                
                # Save user message
                formated_message = Message.create_message(
                    chat_id=chat_id,
                    role="system" if is_system_message else "user",
                    content=message
                )
                Message.save_message(formated_message)
                
                print(f"\033[34mReceived message for chat {chat_id}: {formated_message}\033[0m")
                
                # Stream response chunks to room
                response_message = ""
                # for chunk in agent.stream(message):
                for chunk in """<*&TEXT&*>Here's a combined test output for you:

<h1>Fareed Assistant - Tag Testing Report</h1>
<ul>
<li><strong>Text tag:</strong> This is a plain text block for testing purposes.</li>
<li><strong>Code tag:</strong> Below is a sample Python script.</li>
<li><strong>Command tag:</strong> Then a command to run it.</li>
<li><strong>Image & PDF & Audio & YouTube:</strong> Also included.</li>
<li><strong>Hot Answers:</strong> Quick choices at the end.</li>
</ul>

<*&CODE:filename=test_script.py:lang=python&*>def greet(name):
    print(f"Hello, !")
    
def add(a, b):
    return a + b

if __name__ == "__main__":
    greet("Fareed")
    result = add(10, 20)
    print(f"Result:")
    # This is a test file for tag compatibility
    # Checking all possible tag types

<*&COMMAND&*>python3 test_script.py --verbose --output report.html

<*&TEXT&*>Here's a sample image placeholder:
<*&IMAGE&*>

<*&TEXT&*>And a PDF document preview:
<*&PDF&*>

<*&TEXT&*>Listen to this audio sample:
<*&AUDIO&*>http://commondatastorage.googleapis.com/codeskulptor-assets/Evillaugh.ogg

<*&TEXT&*>Watch this video tutorial:
<*&YOUTUBE&*>https://www.youtube.com/watch?v=DQkCIxnkOyk

<*&HTML&*><table border="1" cellpadding="5">
<tr><th>Tag</th><th>Status</th><th>Notes</th></tr>
<tr><td>TEXT</td><td>✅</td><td>Plain text content</td></tr>
<tr><td>CODE</td><td>✅</td><td>Code with filename & lang</td></tr>
<tr><td>COMMAND</td><td>✅</td><td>Shell command</td></tr>
<tr><td>IMAGE</td><td>✅</td><td>Image placeholder</td></tr>
<tr><td>PDF</td><td>✅</td><td>PDF preview</td></tr>
<tr><td>AUDIO</td><td>✅</td><td>Audio player</td></tr>
<tr><td>YOUTUBE</td><td>✅</td><td>YouTube embed</td></tr>
<tr><td>HTML</td><td>✅</td><td>HTML formatting tags</td></tr>
<tr><td>HOTANSWER</td><td>✅</td><td>Quick answer buttons</td></tr>
</table>

<*&TEXT&*>This concludes the full tag compatibility test. All available content type tags have been tested and rendered successfully. The system supports text, code blocks with syntax highlighting, terminal commands, images, PDF documents, audio playback, YouTube video embeds, HTML formatting, and hot answer buttons for quick interactions. Total test coverage is complete with all 9 tag types verified.

<*&HOTANSWER&*>Re-run Test
<*&HOTANSWER&*>View Details
<*&HOTANSWER&*>Export Results
<*&END&*>""":
                    response_message += chunk
                    await broadcast_to_room(room, "server_message", {
                        "chat_id": chat_id,
                        "message": chunk
                    })
                    await asyncio.sleep(0)
                
                # Save assistant message
                formated_message = Message.create_message(
                    chat_id=chat_id,
                    role="assistant",
                    content=response_message
                )
                Message.save_message(formated_message)
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    
    finally:
        if client_id in user_sessions:
            del user_sessions[client_id]
        if client_id in active_connections:
            del active_connections[client_id]
        print(f"\033[31mClient disconnected: {client_id}\033[0m")

# REST endpoints
@app.get("/chats")
async def get_chats():
    chats = Chat.get_chats()
    return JSONResponse(chats)

@app.get("/chats/{chat_id}")
async def get_chat(chat_id: int):
    messages = Message.get_messages(chat_id)
    return JSONResponse(messages)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")