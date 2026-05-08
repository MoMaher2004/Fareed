from elevenlabs import ElevenLabs
import subprocess
import os


class TTSElevenLabs:

    client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

    def speak(generator):
        player = subprocess.Popen(
            ["ffplay", "-f", "mp3", "-probesize", "32", "-analyzeduration", "0", "-nodisp", "-autoexit", "-loglevel", "quiet", "-"],
            stdin=subprocess.PIPE,
            bufsize=0,
        )

        audio_stream = TTSElevenLabs.client.text_to_speech.stream(
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
            text=generator,
        )

        for chunk in audio_stream:
            if isinstance(chunk, bytes):
                player.stdin.write(chunk)

        player.stdin.close()
        player.wait()