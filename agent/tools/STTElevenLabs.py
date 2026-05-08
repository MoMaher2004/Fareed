from elevenlabs.client import ElevenLabs
from tools.Recorder import Recorder
import os
from dotenv import load_dotenv

load_dotenv()

class STTElevenLabs:
    rec = Recorder()
    client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

    def start():
        STTElevenLabs.rec.start()

    def stop():
        audio_buffer = STTElevenLabs.rec.stop()
        result = STTElevenLabs.client.speech_to_text.convert(
            file=audio_buffer,
            model_id="scribe_v2",
            # language_code="eng",
            # diarize=True,
            # tag_audio_events=True
        )
        return result.text

    def convert(file):
        result = STTElevenLabs.client.speech_to_text.convert(
            file=file,
            model_id="scribe_v2",
            # language_code="eng",
            # diarize=True,
            # tag_audio_events=True
        )
        return result.text
