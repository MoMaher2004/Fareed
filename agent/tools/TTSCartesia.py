from cartesia import Cartesia
import subprocess
import os

class TTSCartesia:

    client = Cartesia(api_key=os.getenv("CARTESIA_API_KEY"))

    def speak(generator):
        player = subprocess.Popen(
            ["ffplay", "-f", "f32le", "-ar", "44100", "-probesize", "32", "-analyzeduration", "0", "-nodisp", "-autoexit", "-loglevel", "quiet", "-"],
            stdin=subprocess.PIPE,
            bufsize=0,
        )

        with TTSCartesia.client.tts.websocket_connect() as connection:
            ctx = connection.context(
                model_id="sonic-3",
                voice={"mode": "id", "id": "f786b574-daa5-4673-aa0c-cbe3e8534c02"},
                output_format={
                    "container": "raw",
                    "encoding": "pcm_f32le",
                    "sample_rate": 44100,
                },
            )

            for part in generator:
                print(part, end='', flush=True)
                ctx.push(part)

            ctx.no_more_inputs()

            for response in ctx.receive():
                if response.type == "chunk" and response.audio:
                    player.stdin.write(response.audio)
                elif response.type == "done":
                    break

        player.stdin.close()
        player.wait()