#!/usr/bin/env bash
# Serve the staged Rust app on 127.0.0.1:8807 (owner review URL). Static only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8807}"
cd "$ROOT/rust/wf_app/web"
exec python3 -c "
import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.webp': 'image/webp'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', $PORT), H) as s:
    print('Serving Rust app on http://127.0.0.1:$PORT/', flush=True); s.serve_forever()
"
