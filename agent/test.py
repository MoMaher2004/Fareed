from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
connected_clients = set()

@socketio.on('connect', namespace='/chat')
def handle_connect():
    sid = request.sid
    connected_clients.add(sid)
    print("Connected:", len(connected_clients))
    print(sid)

@socketio.on('disconnect', namespace='/chat')
def handle_disconnect():
    sid = request.sid
    connected_clients.discard(sid)
    print("disconnected:", len(connected_clients))

socketio.run(app, host='0.0.0.0', port=5000)