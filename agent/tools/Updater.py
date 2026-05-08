from datetime import datetime, timezone
import os
from pydantic import BaseModel, Field
from langchain.tools import tool

class GetTree(BaseModel):
    """Use when you want to get files structure of the project \"Fareed\" which is you."""
    path: str = Field(description="A child path of project root. By default, it retrieves the root directory.")
    max_depth: int = Field(description="The level of depth for searching in directories. It's 6 by default")
    current_depth: int = Field(description="Never ever put a value for it even if you were asked.")
    ignore: list[str] = Field(description="A list for ignoring some files and directories like \"__pycache__\".")

class ReadFileArray(BaseModel):
    """Use when you want to bulk read files from project."""
    paths: list[str] = Field(..., description="A list of paths of files to read.")

class CreateFiles(BaseModel):
    """Use when you want to bulk create files to update the project. \
Note that it will not be directly implemented in the project. \
I will check it first. \
Create an html file that contains a report of new updates."""
    files: list[dict] = Field(..., description="A list of files to be created with their paths in the following formate \{\"path\": \"relative/path/to/file\", \"content\": \"content of the new file\"\}")

class Updater:
    root = os.path.abspath("../")
    @tool(args_schema=GetTree)
    def Updater_getTree(path="", max_depth=6, current_depth=1, ignore=["__pycache__"]):
        real = os.path.abspath(os.path.join(Updater.root, path))
        if not os.path.commonpath([Updater.root, real]) == Updater.root:
            return {"error": "Access denied"}
        if ignore is None:
            ignore = []
        if current_depth > max_depth:
            return []

        result = []

        # try:
        for entry in os.listdir(os.path.join(Updater.root, path)):
            full_path = os.path.join(Updater.root, path, entry)
            if entry in ignore:
                continue

            if os.path.isdir(full_path):
                result.append({
                    entry: Updater.Updater_getTree.invoke({"path": os.path.join(path, entry), "max_depth": max_depth, "current_depth": current_depth + 1, "ignore": ignore})
                })
            else:
                result.append(entry)
        return result

        # except PermissionError as e:
        #     return {"error": str(e)}
        # except Exception as e:
        #     return {"error": str(e)}

    @tool(args_schema=ReadFileArray)
    def Updater_readFileArray(paths):
        result = []
        # try:
        for path in paths:
            real = os.path.abspath(os.path.join(Updater.root, path))
            if not os.path.commonpath([Updater.root, real]) == Updater.root:
                return {"error": "Access denied"}
            full_path = os.path.join(Updater.root, path)
            with open(full_path, "r") as f:
                content = f.read()
                result.append({"path": full_path, "file_contents": content})
        return result
        # except PermissionError as e:
        #     return {"error": str(e)}
        # except Exception as e:
        #     return {"error": str(e)}

    @tool(args_schema=CreateFiles)
    def Updater_createFiles(files):
        # try:
        files_map = []
        suf = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        for file in files:
            real = os.path.abspath(os.path.join(Updater.root, file["path"]))
            if not os.path.commonpath([Updater.root, real]) == Updater.root:
                return {"error": "Access denied"}
            full_path = os.path.join(Updater.root, f"""update/update{suf}/""", file["path"])
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(file["content"])
            files_map.append({"old": real, "new": full_path})
        with open(os.path.join(Updater.root, f"""update/update{suf}/map.json"""), "w", encoding="utf-8") as f:
            f.write(str(files_map))
        return {"message": "Files were created successfully"}
        # except PermissionError as e:
        #     return {"error": str(e)}
        # except Exception as e:
        #     return {"error": str(e)}