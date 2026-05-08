import sounddevice as sd
import numpy as np
import requests
import os
import io
import wave
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

load_dotenv()

class AudioAgent:
    _fs = 16000
    _channels = 1
    _recording = False
    _chunks = []
    _stream = None

    _api_key = os.getenv("ELEVENLABS_API_KEY")

    # ---------- TTS ----------
    @staticmethod
    def speak(text: str):
        client = ElevenLabs(api_key=AudioAgent._api_key)

        audio = client.text_to_speech.convert(
            text=text,
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128"
        )

        play(audio)

    # ---------- Recording ----------
    @staticmethod
    def _callback(indata, frames, time, status):
        if AudioAgent._recording:
            AudioAgent._chunks.append(indata.copy())

    @staticmethod
    def start_recording():
        if AudioAgent._stream is None:
            AudioAgent._stream = sd.InputStream(
                samplerate=AudioAgent._fs,
                channels=AudioAgent._channels,
                dtype='int16',
                callback=AudioAgent._callback
            )

        AudioAgent._chunks = []
        AudioAgent._recording = True
        AudioAgent._stream.start()
        print("Recording started...")

    @staticmethod
    def stop_recording():
        AudioAgent._recording = False

        if AudioAgent._stream:
            AudioAgent._stream.stop()

        print("Recording stopped")

        if not AudioAgent._chunks:
            return ""

        audio = np.concatenate(AudioAgent._chunks, axis=0)

        # Convert to WAV (memory)
        buffer = io.BytesIO()
        wav_file = wave.open(buffer, 'wb')
        wav_file.setnchannels(AudioAgent._channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(AudioAgent._fs)
        wav_file.writeframes(audio.tobytes())
        wav_file.close()
        buffer.seek(0)

        # STT request
        response = requests.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": AudioAgent._api_key},
            files={"file": ("audio.wav", buffer, "audio/wav")},
            data={"model_id": "scribe_v1"}
        )

        try:
            return response.json().get("text", "")
        except:
            return ""