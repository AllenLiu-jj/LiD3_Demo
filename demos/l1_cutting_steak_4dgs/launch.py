"""Portable launcher: pick a free local port, then reuse serve.py unchanged."""
from pathlib import Path
import socket
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import serve  # noqa: E402


def free_port(start=8766, tries=60):
    for port in range(start, start + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    return 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--port")]
    port = free_port()
    sys.argv = ["serve.py", "--port", str(port), *args]
    serve.main()


if __name__ == "__main__":
    main()
