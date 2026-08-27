import subprocess
import sys
import threading
import queue
import uuid
import time
from langchain_core.tools import tool
from pydantic import BaseModel, Field
import base64

class CreateNewRunner(BaseModel):
    """Use when and if you need to create a python code runner process. The runner stays open to recieve code and execute it untill you end the process. Only the runner is in sandbox but the rest of agent is out."""
    details: str = Field(..., description="A description you want to attach to the runner to remember what the purpose of this runner is and its details\
 (ex. 'Create a machine learning model to detect houses pricing based on input data. the code will read \'/home/user/datasets/houses.csv\' file then do some preprocessing and cleaning then scaling then train KNN model then save it in \'.pkl\' file.').")

class ExecuteCode(BaseModel):
    """Use when and if you need to execute python line or code snipped in a runner then get the result of execution."""
    idx: int = Field(..., description="The index of runner you want to use.")
    code: str = Field(..., description="The code you want to execute (ex. \"print('hello')\nprint('world')\").")

class StopRunner(BaseModel):
    """Use when and if you need to stop and end a runner after you finish running your program using it."""
    idx: int = Field(..., description="The index of runner you want to stop.")

class ModifyRunner(BaseModel):
    """Use when and if you need to modify the details of a runner for some reason."""
    idx: int = Field(..., description="The index of runner you want to modify.")
    details: str = Field(..., description="A description you want to attach to the runner to remember what the purpose of this runner is and its details\
 (ex. 'Create a machine learning model to detect houses pricing based on input data. the code will read \'/home/user/datasets/houses.csv\' file then do some preprocessing and cleaning then scaling then train KNN model then save it in \'.pkl\' file.').")


class PythonRunner:
    runners = []

    def __init__(self):
        pass

    @tool(args_schema=CreateNewRunner)
    async def createNewRunner(details: str) -> str:
        if len(PythonRunner.runners) >= 4:
            return "Error: Maximum number of runners reached. Please stop an existing runner before creating a new one."
        try:
            p = await subprocess.Popen(
                [
                    "docker", "run",
                    "-i",
                    "--rm",

                    # 🔐 Resource limits
                    "--memory", "256m",
                    "--cpus", "0.5",
                    "--pids-limit", "64",

                    # 🔒 Filesystem
                    "--read-only",
                    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",

                    # ✅ Allow ONLY this directory
                    "--mount", "type=bind,source=/home/maher/Desktop/Fareed/agent/tools/sandbox,target=/sandbox",

                    # mask sensitive files
                    "--mount", "type=bind,source=/dev/null,target=/etc/passwd,readonly",
                    "--mount", "type=bind,source=/dev/null,target=/etc/shadow,readonly",

                    # working directory
                    "-w", "/sandbox",

                    # 🔐 Security
                    "--cap-drop", "ALL",
                    "--security-opt", "no-new-privileges",

                    # 🌐 (optional) block internet
                    # "--network", "none",

                    "python-sandbox-libs"
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            q = queue.Queue()

            def reader(stream, tag):
                for line in iter(stream.readline, ""):
                    q.put((tag, line))

            threading.Thread(target=reader, args=(p.stdout, "OUT"), daemon=True).start()
            threading.Thread(target=reader, args=(p.stderr, "ERR"), daemon=True).start()

            PythonRunner.runners.append({
                "details": details,
                "process": p,
                "queue": q
            })
            if PythonRunner.runners[-1]['process'].poll() is None:
                return f"Runner created successfully. Index: {len(PythonRunner.runners)-1}"
            else:
                return f"Error: Unknown error have occured."
        except Exception as e:
            return f"Error: {e}"

    @tool(args_schema=ExecuteCode)
    async def executeCode(idx: int, code: str) -> dict:
        if idx >= len(PythonRunner.runners):
            return "Error: Runner does not exist."
        p = PythonRunner.runners[idx]['process']
        marker = f"__END_{uuid.uuid4().hex}__"

        try:
            q = PythonRunner.runners[idx]["queue"]

            def prepare_code(code, marker):
                indentations = 0
                code = code.split('\n')
                i = 0
                while i < len(code):
                    if code[i] == '':
                        del code[i]
                        continue
                    i += 1
                for i in range(len(code)):
                    count = 0
                    while code[i].startswith("    " * (count+1)):
                        count += 1
                    if indentations > count:
                        code = code[:i] + [("\n" * (indentations - count) + code[i])] + code[i+1:]
                    indentations = count
                code = "import sys\n" + "sys.ps1=''\n" + "sys.ps2=''\n" + "\n".join(code) + f"\nprint({marker!r})\n" + "\n"
                return code

            code = prepare_code(code, marker)

            # p.stdin.write(code)
            await p.stdin.write(base64.b64encode(code.encode()).decode() + "\n__RUN__\n")
            await p.stdin.flush()

            # code_output = []

            # # consume queue until we see marker or process exits and queue drains
            # stdout_eof = stderr_eof = False

            # while True:
            #     try:
            #         tag, line = q.get(timeout=0.2)   # small timeout avoids permanent blocking
            #     except queue.Empty:
            #         # if process has exited and both EOFs seen, stop
            #         if p.poll() is not None and stdout_eof and stderr_eof:
            #             break
            #         continue

            #     if line is None:
            #         # EOF from a stream
            #         if tag == "OUT":
            #             stdout_eof = True
            #         else:
            #             stderr_eof = True
            #         if p.poll() is not None and stdout_eof and stderr_eof:
            #             break
            #         continue

            #     # normal line
            #     code_output.append(line)

            #     if marker in line:
            #         break

            code_output = []
            mode = None

            while True:
                tag, line = q.get()

                if "__OUT__" in line:
                    mode = "out"
                    continue
                elif "__ERR__" in line:
                    mode = "err"
                    continue
                elif "__END__" in line:
                    break

                code_output.append(line)

            # optional: drain remaining queued lines briefly
            time.sleep(0.05)
            while not q.empty():
                tag, line = q.get_nowait()
                if line: code_output.append(line)

            return ''.join(code_output)


        except Exception as e:
            return str(e)

    @tool(args_schema=StopRunner)
    async def stopRunner(idx: int) -> str:
        try:
            if idx >= len(PythonRunner.runners):
                return "Error: Runner does not exist."
            if PythonRunner.runners[idx]['process']:
                await PythonRunner.runners[idx]['process'].terminate()
                del PythonRunner.runners[idx]
                return f"Runner is stopped successfully."
        except Exception as e:
            return f"Error: {e}"

    @tool(args_schema=ModifyRunner)
    def modifyRunner(idx: int, details: str) -> str:
        try:
            if idx >= len(PythonRunner.runners):
                return "Error: Runner does not exist."
            PythonRunner.runners[idx]['details'] = details
            return f"Runner is modified successfully."
        except Exception as e:
            return f"Error: {e}"

    @tool()
    def runnersList() -> list:
        """Used when you need to retrieve a list of runners indices and their details to know wheather to use one of them to run your code or create new one."""
        return [{'index': i, 'details': x['details']} for i, x in enumerate(PythonRunner.runners)]