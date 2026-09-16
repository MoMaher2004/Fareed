import subprocess
import sys
import threading
import queue
import uuid
import time
import base64
import traceback
import asyncio


class PythonRunner:
    runners = []

    # How long a single executeCode() call will wait before giving up on a
    # runner that never printed its completion marker. Bump this for
    # workloads you expect to be slow (e.g. browser automation).
    DEFAULT_TIMEOUT = 120  # seconds
    POLL_INTERVAL = 1.0    # how often we re-check "has the process died / timed out?"

    def __init__(self):
        pass

    def createNewRunner(details: str) -> str:
        if len(PythonRunner.runners) >= 4:
            return "Error: Maximum number of runners reached. Please stop an existing runner before creating a new one."
        try:
            p = subprocess.Popen(
                [
                    "docker", "run",
                    "-i",
                    "--rm",

                    # 🔐 Resource limits
                    "--memory", "1024m",
                    "--cpus", "1",
                    "--pids-limit", "128",

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
                # Stream closed (process exited / pipe broken). Push a
                # sentinel so a waiting executeCode() call can notice the
                # process is gone instead of blocking forever.
                q.put((tag, None))

            threading.Thread(target=reader, args=(p.stdout, "OUT"), daemon=True).start()
            threading.Thread(target=reader, args=(p.stderr, "ERR"), daemon=True).start()

            PythonRunner.runners.append({
                "details": details,
                "process": p,
                "queue": q
            })
            if PythonRunner.runners[-1]['process'].poll() is None:
                return f"Runner created successfully. ID: {len(PythonRunner.runners)-1}"
            else:
                return f"Error: Unknown error have occured."
        except Exception as e:
            return f"Error: {e}"

    async def executeCode(runnerId: int, code: str, timeout: float = None) -> str:
        if runnerId < 0 or runnerId >= len(PythonRunner.runners):
            return "Error: Runner does not exist."

        timeout = timeout or PythonRunner.DEFAULT_TIMEOUT
        runner = PythonRunner.runners[runnerId]
        p = runner['process']
        marker = f"__END_{uuid.uuid4().hex}__"

        try:
            q = runner["queue"]

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

            p.stdin.write(base64.b64encode(code.encode()).decode() + "\n__RUN__\n")
            p.stdin.flush()

            code_output = []
            stdout_eof = stderr_eof = False
            deadline = time.monotonic() + timeout

            while True:
                try:
                    # Bounded wait: this is the actual fix. The original
                    # unbounded q.get() would hang forever if the child
                    # process never printed the completion marker (crash,
                    # hang, or just still running).
                    tag, line = await asyncio.to_thread(q.get, True, PythonRunner.POLL_INTERVAL)
                except queue.Empty:
                    # Nothing new within the poll interval — check whether
                    # we should give up, then loop back and keep waiting.
                    if p.poll() is not None and stdout_eof and stderr_eof:
                        code_output.append(
                            f"\n[Runner process exited (code {p.returncode}) before finishing this execution]"
                        )
                        break
                    if time.monotonic() > deadline:
                        code_output.append(f"\n[Execution timed out after {timeout}s — runner may be stuck]")
                        # We have no way to interrupt code already running
                        # inside the container, so retire this runner
                        # instead of leaving it (and future calls) stuck.
                        try:
                            p.kill()
                        except Exception:
                            pass
                        if runnerId < len(PythonRunner.runners):
                            del PythonRunner.runners[runnerId]
                        break
                    continue

                if line is None:
                    # EOF sentinel from one of the reader threads.
                    if tag == "OUT":
                        stdout_eof = True
                    else:
                        stderr_eof = True
                    continue

                if "__OUT__" in line:
                    continue
                elif "__ERR__" in line:
                    continue
                elif marker in line:
                    break

                code_output.append(line)

            # Drain anything left over so it can't leak into the next call.
            while not q.empty():
                tag, line = q.get_nowait()
                if line:
                    code_output.append(line)

            return ''.join(code_output)

        except Exception as e:
            traceback.print_exc()
            return str(e)

    async def stopRunner(runnerId: int) -> str:
        try:
            if runnerId < 0 or runnerId >= len(PythonRunner.runners):
                return "Error: Runner does not exist."
            if PythonRunner.runners[runnerId]['process']:
                PythonRunner.runners[runnerId]['process'].terminate()
                del PythonRunner.runners[runnerId]
                return f"Runner is stopped successfully."
        except Exception as e:
            return f"Error: {e}"

    def modifyRunner(runnerId: int, details: str) -> str:
        try:
            if runnerId < 0 or runnerId >= len(PythonRunner.runners):
                return "Error: Runner does not exist."
            PythonRunner.runners[runnerId]['details'] = details
            return f"Runner is modified successfully."
        except Exception as e:
            return f"Error: {e}"

    def runnersList() -> list:
        """Used when you need to retrieve a list of runners indices and their details to know wheather to use one of them to run your code or create new one."""
        return [{'runnerId': i, 'details': x['details']} for i, x in enumerate(PythonRunner.runners)]