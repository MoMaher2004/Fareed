from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, disconnect
from tools.STTElevenLabs import STTElevenLabs
import time
import uuid
from Agent import Agent, tools_map, tools_schema, models

# class Profile:
#     def __init__(self):
#         self.stt = "ElevenLabs"
#         self.llm = "deepseek-chat"
#         self.agent = Agent(models["deepseek-chat"], tools_map, tools_schema)

# settings = {
#     'STT model': {
#         "type": 'dropdown menu',
#         "options": [
#             {
#                 "name": 'ElevenLabs',
#                 "value": 'ElevenLabs',
#                 "is_selected": True
#             }
#         ]
#     },
#     'LLM model': {
#         "type": 'dropdown menu',
#         "options": [
#             {
#                 "name": 'deepseek-chat',
#                 "value": 'deepseek-chat',
#                 "is_selected": True
#             },
#             {
#                 "name": 'deepseek-reasoner',
#                 "value": 'deepseek-reasoner',
#                 "is_selected": False
#             },
#             {
#                 "name": 'dolphin 24B',
#                 "value": 'dphn/Dolphin-Mistral-24B-Venice-Edition:featherless-ai',
#                 "is_selected": False
#             },
#         ]
#     },
# }

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

profiles = dict()

@app.route('/login', methods=['GET'])
def get_settings():
    session_id = uuid.uuid4()
    profile = Agent(models["deepseek-chat"], tools_map, tools_schema)
    profiles[session_id] = profile
    return jsonify({'session_id': uuid.uuid4()})

# @app.route('/settings', methods=['GET'])
# def get_settings(data):
#     if not data['session_id']: disconnect()
#     return jsonify(settings)

# @app.route('/settings', methods=['POST'])
# def post_data(data):
#     if not data['session_id']: disconnect()
#     profile = profiles[data['session_id']]
#     profile.stt = data['STT model']
#     profile.agent = Agent(data["LLM model"], tools_map, tools_schema) if profile.agent.model != data["LLM model"] else profile.agent
#     profile.llm = data["LLM model"]
#     return True

# @app.route('/stt', methods=['GET'])
# def get_stt(data):
#     if not data['session_id']: disconnect()
#     file = request.files['audio']
#     text = None
#     if filter(lambda x: x['is_selected'] == True, settings['STT model']['options'])[0]['value'] == "ElevenLabs":
#         text = STTElevenLabs.convert(file)
#     return text

@socketio.on('connect', namespace='/chat')
def handle_connect(auth=None):
    print(auth)
    print(session_id)
    if not auth or not auth.get("session_id"):
        disconnect()


@socketio.on('send_message', namespace='/chat')
def handle_receive(data):
    if not data or not data.get("session_id"):
        disconnect()
        return

    emit(
        'response',
        {'data': data},
        broadcast=True,
        namespace='/chat'
    )

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, threaded=True)