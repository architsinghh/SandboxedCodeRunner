import asyncio
import time
import docker
from docker.errors import ContainerError, ImageNotFound, APIError

LANGUAGE_CONFIG = {
    "python": {
        "image": "python:3.12-slim",
        "filename": "main.py",
        "cmd": ["python", "main.py"],
    },
    "javascript": {
        "image": "node:20-slim",
        "filename": "main.js",
        "cmd": ["node", "main.js"],
    },
    "cpp": {
        "image": "gcc:13",
        "filename": "main.cpp",
        "cmd": ["sh", "-c", "g++ -o main main.cpp && ./main"],
    },
    "java": {
        "image": "eclipse-temurin:21-jdk",
        "filename": "Main.java",
        "cmd": ["sh", "-c", "javac Main.java && java Main"],
    },
}

MEMORY_LIMIT = "128m"
TIMEOUT_SECONDS = 10


def _run_container(code: str, language: str, stdin_input: str | None = None) -> dict:
    config = LANGUAGE_CONFIG[language]
    client = docker.from_env()

    # Ensure the image is available
    try:
        client.images.get(config["image"])
    except ImageNotFound:
        client.images.pull(config["image"])

    start_time = time.time()
    stdout = ""
    stderr = ""
    exit_code = 0
    container = None

    try:
        # Build the command, adding stdin redirection if needed
        cmd = config["cmd"]
        if stdin_input is not None:
            # If command is already a shell command, extract the inner command
            if cmd[0] == "sh" and cmd[1] == "-c":
                inner_cmd = cmd[2]
            else:
                inner_cmd = " ".join(cmd)
            cmd = ["sh", "-c", f"{inner_cmd} < /sandbox/stdin.txt"]

        container = client.containers.create(
            image=config["image"],
            command=cmd,
            mem_limit=MEMORY_LIMIT,
            network_disabled=True,
            working_dir="/sandbox",
            stdin_open=False,
            tty=False,
        )

        # Copy code (and optional stdin) into the container
        import tarfile
        import io

        tar_stream = io.BytesIO()
        with tarfile.open(fileobj=tar_stream, mode="w") as tar:
            code_bytes = code.encode("utf-8")
            info = tarfile.TarInfo(name=config["filename"])
            info.size = len(code_bytes)
            tar.addfile(info, io.BytesIO(code_bytes))

            if stdin_input is not None:
                stdin_bytes = stdin_input.encode("utf-8")
                stdin_info = tarfile.TarInfo(name="stdin.txt")
                stdin_info.size = len(stdin_bytes)
                tar.addfile(stdin_info, io.BytesIO(stdin_bytes))

        tar_stream.seek(0)
        container.put_archive("/sandbox", tar_stream)

        container.start()
        result = container.wait(timeout=TIMEOUT_SECONDS)
        exit_code = result.get("StatusCode", 1)
        stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
        stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")

    except Exception as e:
        error_msg = str(e)
        if "timed out" in error_msg.lower() or "read timeout" in error_msg.lower():
            stderr = f"Execution timed out after {TIMEOUT_SECONDS} seconds"
            exit_code = 124
        else:
            stderr = f"Execution error: {error_msg}"
            exit_code = 1
    finally:
        if container:
            try:
                container.remove(force=True)
            except Exception:
                pass

    execution_time = round(time.time() - start_time, 3)

    return {
        "stdout": stdout,
        "stderr": stderr,
        "execution_time": execution_time,
        "exit_code": exit_code,
    }


async def execute_code(code: str, language: str, stdin_input: str | None = None) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_container, code, language, stdin_input)
