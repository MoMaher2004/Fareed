import sounddevice as sd
import numpy as np
import io
import wave

class Recorder:
    def __init__(self, fs=44100):
        self.fs = fs
        self.recording = []
        self.is_recording = False

    def _callback(self, indata, frames, time, status):
        if self.is_recording:
            self.recording.append(indata.copy())

    def start(self):
        self.recording = []
        self.is_recording = True
        self.stream = sd.InputStream(
            callback=self._callback,
            samplerate=self.fs,
            channels=1,
            dtype='float32'
        )
        self.stream.start()

    def stop(self):
        self.is_recording = False
        self.stream.stop()
        self.stream.close()

        # merge chunks → numpy array
        audio_np = np.concatenate(self.recording, axis=0)

        # convert to WAV in memory (BytesIO)
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self.fs)
            wf.writeframes((audio_np * 32767).astype(np.int16).tobytes())

        buffer.seek(0)
        return buffer   # 🔥 this is what you send to API