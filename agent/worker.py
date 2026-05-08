import sys
import io
import traceback
import base64

# persistent global context (VERY IMPORTANT)
globals_dict = {}

def execute(code):
    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()

    try:
        # redirect stdout/stderr
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = stdout_buffer
        sys.stderr = stderr_buffer

        # execute code in persistent context
        exec(code, globals_dict)

    except Exception:
        traceback.print_exc(file=stderr_buffer)

    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr

    return stdout_buffer.getvalue(), stderr_buffer.getvalue()


buffer = []

while True:
    line = sys.stdin.readline()

    if not line:
        break

    if line.strip() == "__RUN__":
        encoded = ''.join(buffer)
        code = base64.b64decode(encoded).decode()
        buffer = []

        out, err = execute(code)

        sys.stdout.write("__OUT__\n")
        sys.stdout.write(out)
        sys.stdout.write("__ERR__\n")
        sys.stdout.write(err)
        sys.stdout.write("__END__\n")
        sys.stdout.flush()
    else:
        buffer.append(line)