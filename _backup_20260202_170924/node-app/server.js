const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'ok', service: 'node-app'}));
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<!doctype html><html><head><meta charset="utf-8"><title>Hello</title></head><body><h1>Hello, World!</h1><p>Visit <a href="/health">/health</a> for JSON.</p></body></html>');
    return;
  }

  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Node scaffold listening on http://127.0.0.1:${PORT}`);
});
