
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path
import json

HOST = "0.0.0.0"
PORT = 8000
OLLAMA_URL = "http://127.0.0.1:11434"
MODEL = "qwen2.5:3b"
ROOT = Path(__file__).resolve().parent


class PupikHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/status":
            try:
                req = Request(f"{OLLAMA_URL}/api/tags")
                with urlopen(req, timeout=5) as response:
                    data = json.loads(response.read().decode("utf-8"))

                models = [
                    item.get("name", "")
                    for item in data.get("models", [])
                ]

                self.send_json(200, {
                    "ok": True,
                    "model": MODEL,
                    "modelInstalled": any(
                        name == MODEL or name.startswith(MODEL + ":")
                        for name in models
                    ),
                    "models": models
                })
            except Exception as error:
                self.send_json(503, {
                    "ok": False,
                    "error": "Ollama не запущена. Открой приложение Ollama на Mac."
                })
            return

        if self.path == "/":
            self.path = "/index.html"

        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_json(404, {"error": "Маршрут не найден"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))

            if length <= 0 or length > 200_000:
                self.send_json(400, {"error": "Некорректный размер запроса"})
                return

            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            messages = payload.get("messages", [])

            if not isinstance(messages, list) or not messages:
                self.send_json(400, {"error": "Нет сообщений"})
                return

            # Не разрешаем клиенту выбирать произвольную модель.
            # Сервер всегда использует заданную локальную модель.
            clean_messages = []
            for message in messages[-30:]:
                role = message.get("role")
                content = message.get("content", "")

                if role not in ("user", "assistant", "system"):
                    continue
                if not isinstance(content, str):
                    continue

                clean_messages.append({
                    "role": role,
                    "content": content[:20000]
                })

            if not clean_messages:
                self.send_json(400, {"error": "Нет корректных сообщений"})
                return

            request_data = json.dumps({
                "model": MODEL,
                "messages": clean_messages,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_ctx": 4096
                }
            }).encode("utf-8")

            req = Request(
                f"{OLLAMA_URL}/api/chat",
                data=request_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urlopen(req, timeout=600) as response:
                result = json.loads(response.read().decode("utf-8"))

            answer = result.get("message", {}).get("content", "")
            self.send_json(200, {"answer": answer})

        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            self.send_json(502, {
                "error": "Ошибка Ollama: " + details[:500]
            })
        except URLError:
            self.send_json(503, {
                "error": "Не удалось подключиться к Ollama. Проверь, что она запущена."
            })
        except TimeoutError:
            self.send_json(504, {"error": "Модель слишком долго отвечает"})
        except Exception as error:
            self.send_json(500, {
                "error": "Ошибка сервера: " + str(error)[:300]
            })

    def log_message(self, format, *args):
        print("[Pupik]", format % args)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), PupikHandler)
    print()
    print("Pupik AI запущен!")
    print("На этом Mac: http://localhost:8000")
    print("На iPhone: http://IP-АДРЕС-MAC:8000")
    print("Остановка: Ctrl+C")
    print()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nPupik AI остановлен.")
    finally:
        server.server_close()
