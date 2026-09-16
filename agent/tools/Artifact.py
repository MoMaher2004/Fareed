import os
import secrets
import string

from dotenv import load_dotenv


load_dotenv()


class Artifact:

    @staticmethod
    def getArtifact(artifactId: str):
        prefix = os.getenv("ARTIFACTS_DIR")

        if not prefix:
            return {
                "status": "error",
                "content": "ARTIFACTS_DIR is not configured"
            }

        filePath = os.path.join(prefix, artifactId)

        if not os.path.isfile(filePath):
            return {
                "status": "error",
                "content": "Artifact not found"
            }

        try:
            with open(filePath, "r", encoding="utf-8") as file:
                content = file.read()

            return {
                "status": "success",
                "artifactId": artifactId,
                "content": content
            }

        except Exception as e:
            return {
                "status": "error",
                "content": str(e)
            }

    @staticmethod
    def createArtifact(content: str):
        prefix = os.getenv("ARTIFACTS_DIR")

        if not prefix:
            return {
                "status": "error",
                "content": "ARTIFACTS_DIR is not configured"
            }

        try:
            os.makedirs(prefix, exist_ok=True)
        except Exception as e:
            return {
                "status": "error",
                "content": str(e)
            }

        characters = string.ascii_letters + string.digits

        while True:
            artifactId = "".join(
                secrets.choice(characters)
                for _ in range(9)
            )

            filePath = os.path.join(prefix, artifactId)

            try:
                fileDescriptor = os.open(
                    filePath,
                    os.O_WRONLY
                    | os.O_CREAT
                    | os.O_EXCL
                )

                with os.fdopen(
                    fileDescriptor,
                    "w",
                    encoding="utf-8"
                ) as file:
                    file.write(content)

                return {
                    "status": "success",
                    "artifactId": artifactId,
                    "content": "Artifact created successfully"
                }

            except FileExistsError:
                continue

            except Exception as e:
                return {
                    "status": "error",
                    "content": str(e)
                }