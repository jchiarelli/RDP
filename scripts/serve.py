#!/usr/bin/env python3
"""
Servidor HTTP local para o dashboard RDP.
Persiste acoes de pendencias em data/acoes.json.
Persiste mudancas de pessoas em data/pessoas_changes.json.
"""
import os, sys, json, argparse, shutil
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BACKUP_DIR = ROOT / "_backup"
ACOES_FILE = DATA_DIR / "acoes.json"
PESSOAS_CHANGES_FILE = DATA_DIR / "pessoas_changes.json"

DATA_DIR.mkdir(exist_ok=True)
BACKUP_DIR.mkdir(exist_ok=True)

def atomic_write_json(path, obj):
    tmp = path.with_suffix(path.suffix + ".tmp")
    content = json.dumps(obj, ensure_ascii=False, indent=2)
    tmp.write_text(content, encoding="utf-8")
    json.loads(tmp.read_text(encoding="utf-8"))
    os.replace(tmp, path)

def backup_acoes():
    if not ACOES_FILE.exists(): return
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(ACOES_FILE, BACKUP_DIR / f"acoes_{ts}.json")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    
    def log_message(self, fmt, *args):
        sys.stdout.write("[%s] %s\n" % (datetime.now().strftime("%H:%M:%S"), fmt % args))
    
    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
    
    def do_GET(self):
        if self.path.startswith("/api/acoes"):
            try:
                obj = json.loads(ACOES_FILE.read_text(encoding="utf-8")) if ACOES_FILE.exists() else {}
                self._send_json(obj)
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return
        if self.path.startswith("/api/pessoas-changes"):
            try:
                obj = json.loads(PESSOAS_CHANGES_FILE.read_text(encoding="utf-8")) if PESSOAS_CHANGES_FILE.exists() else []
                self._send_json(obj)
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return
        if self.path == "/api/health":
            self._send_json({"ok": True})
            return
        if self.path == "/": self.path = "/dashboard.html"
        return super().do_GET()
    
    def do_POST(self):
        if self.path.startswith("/api/acoes"):
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                if not isinstance(data, dict): return self._send_json({"error": "esperado dict"}, 400)
                backup_acoes()
                atomic_write_json(ACOES_FILE, data)
                self._send_json({"ok": True, "pendencias": len(data)})
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return
        if self.path.startswith("/api/pessoas-changes"):
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length).decode("utf-8") or "[]")
                if not isinstance(data, list): return self._send_json({"error": "esperado array"}, 400)
                if PESSOAS_CHANGES_FILE.exists():
                    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                    shutil.copy2(PESSOAS_CHANGES_FILE, BACKUP_DIR / f"pessoas_changes_{ts}.json")
                atomic_write_json(PESSOAS_CHANGES_FILE, data)
                self._send_json({"ok": True, "changes": len(data)})
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return
        self.send_error(404)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--open", action="store_true")
    args = ap.parse_args()
    
    server = HTTPServer((args.host, args.port), Handler)
    url = f"http://{args.host}:{args.port}/dashboard.html"
    print(f"Dashboard RDP - {url}")
    print(f"Acoes em: {ACOES_FILE}")
    print(f"Backup em: {BACKUP_DIR}")
    if args.open:
        import webbrowser
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Servidor parado.")

if __name__ == "__main__":
    main()
