#!/usr/bin/env python3
"""Local dev server for Direct Flow Marketing.

Serves the site like a normal static server, plus two extra routes:
POST /save writes the submitted JSON to content.json so edits made
in the browser's Edit Content mode persist across reloads.
POST /lead appends a submitted book-a-call funnel lead to leads.json —
a local-only stand-in for a real CRM while the site is in development.

Run:  python3 server.py [port]   (default port 8743)
"""

import json
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.server import SimpleHTTPRequestHandler

SITE_DIR = os.path.dirname(os.path.abspath(__file__))
CONTENT_PATH = os.path.join(SITE_DIR, "content.json")
LEADS_PATH = os.path.join(SITE_DIR, "leads.json")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_DIR, **kwargs)

    def log_message(self, fmt, *args):
        print(fmt % args)

    def end_headers(self):
        # Prevent the browser from ever serving a stale cached copy of the
        # site while iterating on it locally.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def do_POST(self):
        if self.path == "/save":
            self._handle_save()
        elif self.path == "/lead":
            self._handle_lead()
        else:
            self.send_error(404, "Not found")

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 5_000_000:
            self._send_json(400, {"ok": False, "error": "Invalid content length"})
            return None
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError("body must be a JSON object")
            return data
        except (json.JSONDecodeError, ValueError) as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
            return None

    def _write_json_atomic(self, path, data, prefix):
        fd, tmp_path = tempfile.mkstemp(dir=SITE_DIR, prefix=prefix, suffix=".json.tmp")
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        os.replace(tmp_path, path)

    def _handle_save(self):
        data = self._read_json_body()
        if data is None:
            return
        try:
            self._write_json_atomic(CONTENT_PATH, data, ".content-")
        except OSError as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
            return
        self._send_json(200, {"ok": True})

    def _handle_lead(self):
        data = self._read_json_body()
        if data is None:
            return

        try:
            if os.path.exists(LEADS_PATH):
                with open(LEADS_PATH, "r") as f:
                    leads = json.load(f)
                    if not isinstance(leads, list):
                        leads = []
            else:
                leads = []
            leads.append(data)
            self._write_json_atomic(LEADS_PATH, leads, ".leads-")
        except (OSError, json.JSONDecodeError) as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
            return

        self._send_json(200, {"ok": True})

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8743
    server = ThreadingHTTPServer(("", port), Handler)
    print(f"Direct Flow Marketing — serving {SITE_DIR} on http://localhost:{port}")
    print("Edit Content mode will save to content.json while this is running.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        server.shutdown()


if __name__ == "__main__":
    main()
