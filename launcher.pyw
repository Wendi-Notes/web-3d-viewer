# -*- coding: utf-8 -*-
"""
Web 3D Viewer 起動役（Web_3D_Viewer.exe の置き換え）

- 右クリック / ダブルクリック / web3d:// リンクから呼ばれる
- すでにビューアーが開いていれば、そのウィンドウにファイルを追加する
- 画面は同じフォルダの app\\index.html を配信する（オフラインで動作）

署名付きの pythonw.exe から実行されるので、スマートアプリコントロールに止められない。
Python 標準ライブラリのみ使用。
"""
import json
import mimetypes
import os
import secrets
import shutil
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FIXED_PORT = 38517
TITLE = "Web 3D Viewer"
EXTS = {".stl", ".3mf", ".dxf", ".dwg", ".svg"}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")
SESSION_DIR = os.path.join(os.environ.get("LOCALAPPDATA", BASE_DIR), "Web_3D_Viewer")
SESSION_FILE = os.path.join(SESSION_DIR, "session.txt")
IDLE_SECONDS = 120

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("font/woff", ".woff")
mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("text/css", ".css")


def _notify(text, title):
    """ctypes を使わずにメッセージを出す（メモ帳で表示）。
    ※ 10月の更新以降、スマートアプリコントロールが _ctypes.pyd を止めることがあるため"""
    import tempfile
    p = os.path.join(tempfile.gettempdir(), "web3d_message.txt")
    with open(p, "w", encoding="utf-8-sig") as fh:
        fh.write("【" + title + "】\r\n\r\n" + text.replace("\n", "\r\n"))
    try:
        os.startfile(p)
    except Exception:
        print(text)


def message(text, error=False):
    _notify(text, TITLE)


def is_model(path):
    return os.path.splitext(path)[1].lower() in EXTS


def link_to_path(link):
    """web3d://open?path=C%3A%5C...%5Cmodel.stl -> C:\\...\\model.stl"""
    i = link.lower().find("path=")
    if i < 0:
        return None
    p = link[i + 5:].split("&", 1)[0]
    p = urllib.parse.unquote(p).strip().strip('"').rstrip("/")
    try:
        return os.path.abspath(p)
    except Exception:
        return None


def make_link(path):
    out = []
    for c in path.replace("\\", "/"):
        if c in '% &#?()"<>+':
            out.extend("%{:02X}".format(b) for b in c.encode("utf-8"))
        else:
            out.append(c)
    return "web3d://open?path=" + "".join(out)


def history_dir():
    d = os.path.join(BASE_DIR, "history")
    try:
        os.makedirs(d, exist_ok=True)
        t = os.path.join(d, ".w")
        open(t, "w").close()
        os.remove(t)
        return d
    except Exception:
        d = os.path.join(SESSION_DIR, "history")
        os.makedirs(d, exist_ok=True)
        return d


class State:
    def __init__(self):
        self.lock = threading.Lock()
        self.items = {}
        self.pending = []
        self.snapshots = {}
        self.next_id = 1
        self.token = secrets.token_urlsafe(24)
        self.base_url = ""
        self.last_request = time.time()
        self.last_poll = time.time()

    def enqueue(self, path):
        with self.lock:
            i = self.next_id
            self.next_id += 1
            self.items[i] = path
            self.pending.append(i)
            return i

    def snapshot(self, i):
        with self.lock:
            src = self.items.get(i)
            done = self.snapshots.get(i)
        if not src:
            return None
        if done and os.path.exists(done):
            return done
        d = history_dir()
        if os.path.normcase(os.path.dirname(os.path.abspath(src))).rstrip("\\") == os.path.normcase(d).rstrip("\\"):
            done = src
        else:
            done = os.path.join(d, datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + os.path.basename(src))
            shutil.copyfile(src, done)
        with self.lock:
            self.snapshots[i] = done
        return done


S = State()


def open_browser():
    S.last_poll = time.time()  # ブラウザが開くまでの猶予
    url = S.base_url + "/?token=" + urllib.parse.quote(S.token)
    if os.environ.get("WEB3D_TEST"):
        print("OPEN " + url, flush=True)
        return
    try:
        os.startfile(url)
    except Exception:
        webbrowser.open(url)


class Handler(BaseHTTPRequestHandler):
    server_version = "Web3DViewer"
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def send(self, code, ctype="text/plain; charset=utf-8", body=b"", cache=False):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "max-age=31536000, immutable" if cache else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_json(self, obj):
        self.send(200, "application/json; charset=utf-8", json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def parsed(self):
        u = urllib.parse.urlsplit(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        return u.path, q

    def authed(self, q):
        return secrets.compare_digest(q.get("token", ""), S.token)

    # ---------- 静的ファイル（画面） ----------
    def serve_static(self, path):
        rel = urllib.parse.unquote(path).lstrip("/") or "index.html"
        full = os.path.abspath(os.path.join(APP_DIR, rel))
        if not full.startswith(os.path.abspath(APP_DIR) + os.sep) or not os.path.isfile(full):
            return self.send(404)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            body = f.read()
        self.send(200, ctype, body, cache="/assets/" in path or "/fonts/" in path)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path, q = self.parsed()
        if not path.startswith("/api/"):
            S.last_request = time.time()
            return self.serve_static(path)
        if not self.authed(q):
            return self.send(403)
        S.last_request = time.time()
        if path == "/api/next":
            S.last_poll = time.time()
            with S.lock:
                out = []
                while S.pending:
                    i = S.pending.pop(0)
                    out.append({"id": i, "name": os.path.basename(S.items[i]), "path": S.items[i]})
            return self.send_json(out)
        if path == "/api/model":
            try:
                i = int(q.get("id", ""))
            except ValueError:
                return self.send(400)
            with S.lock:
                f = S.items.get(i)
            if not f or not os.path.isfile(f):
                return self.send(404)
            with open(f, "rb") as fh:
                return self.send(200, "application/octet-stream", fh.read())
        if path == "/api/add":
            f = q.get("path", "")
            if not f or not os.path.isfile(f) or not is_model(f):
                return self.send(400)
            S.enqueue(f)
            reopen = time.time() - S.last_poll > 8
            self.send(200, body=(b"opened" if reopen else b"queued"))
            if reopen:
                open_browser()
            return
        if path == "/api/snapshot":
            try:
                snap = S.snapshot(int(q.get("id", "")))
            except Exception:
                snap = None
            if not snap:
                return self.send(404)
            return self.send_json({"link": make_link(snap), "path": snap, "name": os.path.basename(snap)})
        if path == "/api/ping":
            return self.send(200, body=b"ok")
        return self.send(404)

    def do_POST(self):
        path, q = self.parsed()
        if not self.authed(q):
            return self.send(403)
        S.last_request = time.time()
        if path == "/api/import":
            # ブラウザで開いたファイルを history に控えて、リンクを返す
            name = os.path.basename(q.get("name", "model"))
            if not is_model(name):
                return self.send(400)
            n = int(self.headers.get("Content-Length", "0") or 0)
            data = self.rfile.read(n) if n > 0 else b""
            dest = os.path.join(history_dir(), datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + name)
            with open(dest, "wb") as fh:
                fh.write(data)
            i = S.enqueue(dest)
            with S.lock:
                S.pending.remove(i)  # 既に画面にあるので再追加しない
                S.snapshots[i] = dest
            return self.send_json({"id": i, "link": make_link(dest), "path": dest, "name": os.path.basename(dest)})
        return self.send(404)


def try_hand_off(files):
    """すでに開いているビューアーにファイルを渡す。渡せたら True"""
    try:
        with open(SESSION_FILE, encoding="utf-8") as fh:
            lines = fh.read().split()
        if len(lines) < 2:
            return False
        base = "http://127.0.0.1:{}/api/".format(lines[0].strip())
        tok = urllib.parse.quote(lines[1].strip())
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        # 生きているか確認（空のときはタブを前に出すだけにする）
        with opener.open(base + "ping?token=" + tok, timeout=2) as r:
            if r.status != 200:
                return False
        if not files:  # ファイル指定なし → 既存のビューアーをもう一枚開くだけ
            url = "http://127.0.0.1:{}/?token={}".format(lines[0].strip(), tok)
            try:
                os.startfile(url)
            except Exception:
                webbrowser.open(url)
            return True
        for f in files:
            with opener.open(base + "add?token=" + tok + "&path=" + urllib.parse.quote(f), timeout=3) as r:
                if r.status != 200:
                    return False
        return True
    except Exception:
        return False


def cleanup_session():
    try:
        with open(SESSION_FILE, encoding="utf-8") as fh:
            if S.token in fh.read():
                os.remove(SESSION_FILE)
    except Exception:
        pass


def main(argv):
    files, from_link = [], False
    for a in argv:
        if not a or not a.strip():
            continue
        if a.lower().startswith("web3d:"):
            from_link = True
            p = link_to_path(a)
            if not p:
                return message("リンクの形式が正しくありません。\n" + a)
            if not os.path.isfile(p):
                return message("ファイルが見つかりません（移動・削除された可能性があります）。\n" + p)
            files.append(p)
        else:
            files.append(os.path.abspath(a))
    files = [f for f in files if os.path.isfile(f) and is_model(f)]
    if (argv and not files) or (from_link and not files):
        return message("対応しているファイル（STL / 3MF / DXF / DWG / SVG）を選んでください。")

    if not os.path.isfile(os.path.join(APP_DIR, "index.html")):
        return message("画面のファイルが見つかりません:\n" + os.path.join(APP_DIR, "index.html"), True)

    if try_hand_off(files):
        return

    try:
        server = ThreadingHTTPServer(("127.0.0.1", FIXED_PORT), Handler)
        port = FIXED_PORT
    except OSError:
        # 固定ポートが他のアプリに使われている場合は空きポートで単独起動
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = server.server_address[1]
    server.daemon_threads = True
    S.base_url = "http://127.0.0.1:%d" % port
    if port == FIXED_PORT:
        os.makedirs(SESSION_DIR, exist_ok=True)
        with open(SESSION_FILE, "w", encoding="utf-8") as fh:
            fh.write("%d\n%s" % (port, S.token))
    for f in files:
        S.enqueue(f)
    S.last_request = time.time()

    def watchdog():
        while True:
            time.sleep(5)
            if time.time() - S.last_request > IDLE_SECONDS:
                server.shutdown()
                return

    threading.Thread(target=watchdog, daemon=True).start()
    open_browser()
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()
        cleanup_session()


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception as e:
        message("ビューアーを起動できませんでした。\n%s" % e, True)
