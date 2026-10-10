import os
import uuid
import subprocess
from pathlib import Path

from openai import OpenAI


class OpenAI_STT:
    def __init__(self):
        self.client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv(
                "OPENAI_BASE_URL",
                "https://api.openai.com/v1",
            ),
        )

        self.model = os.getenv(
            "OPENAI_STT_MODEL",
            "gpt-transcribe",
        )

        self.max_duration = float(
            os.getenv("MAX_DURATION_SECONDS", "300")
        )

        self.languages = [
            lang.strip()
            for lang in os.getenv("LANGUAGES", "ar,en").split(",")
            if lang.strip()
        ]

        self.tmp_dir = Path(os.getenv("TEMP_DIR", "/tmp"))

    def transcribe(self, audio_bytes: bytes, keywords=None) -> dict:
        if not audio_bytes:
            return {
                "status": "failed",
                "message": "Audio is empty",
            }

        if len(audio_bytes) > 25 * 1024 * 1024:
            return {
                "status": "failed",
                "message": "File size limit exceeded",
                "size_bytes": len(audio_bytes),
                "limit_bytes": 25 * 1024 * 1024,
            }

        temp_path = None

        try:
            self.tmp_dir.mkdir(parents=True, exist_ok=True)

            temp_path = self.tmp_dir / str(uuid.uuid4())
            temp_path.write_bytes(audio_bytes)

            duration = float(subprocess.run(
                [
                    "ffprobe",
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "csv=p=0",
                    str(temp_path),
                ],
                capture_output=True,
                text=True,
                check=True,
                timeout=15,
            ).stdout.strip())

            if duration > self.max_duration:
                return {
                    "status": "failed",
                    "message": "limit exceeded",
                    "duration_seconds": round(duration, 2),
                    "limit_seconds": self.max_duration,
                }

            extra_body = {"languages": self.languages}

            if keywords:
                extra_body["keywords"] = keywords

            audio_file = open(temp_path, "rb")

            try:
                result = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=(
                        "recording.webm",
                        audio_file,
                        "audio/webm",
                    ),
                    response_format="json",
                    extra_body=extra_body,
                )
            finally:
                audio_file.close()

            return {
                "status": "success",
                "content": result.text,
                "duration_seconds": round(duration, 2),
            }

        except Exception as error:
            return {
                "status": "error",
                "message": str(error),
            }

        finally:
            if temp_path is not None:
                try:
                    temp_path.unlink(missing_ok=True)
                except OSError:
                    pass