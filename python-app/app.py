#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

PORT = 8000

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'service': 'python-app'}).encode())
            return

        if self.path == '/' or self.path == '/index.html':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<!doctype html><html><body><h1>Python scaffold</h1><p>GET <a href="/health">/health</a></p></body></html>')
            return

        self.send_response(404)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'Not found')

if __name__ == '__main__':
    print(f'Python scaffold listening on http://127.0.0.1:{PORT}')
    HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
