#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
let port = 8080;
for(let i=0;i<args.length;i++) if(args[i]==='--port' && args[i+1]) port = +args[i+1];
const root = process.cwd();
const mime = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  let url = decodeURIComponent(req.url.split('?')[0]);
  if(url === '/') url = '/web-runner/index.html';
  const fp = path.normalize(path.join(root, url));
  if(!fp.startsWith(root)) { res.statusCode = 403; res.end('Forbidden'); return; }
  fs.stat(fp, (err,st)=>{
    if(err){ res.statusCode=404; res.end('Not found'); return; }
    if(st.isDirectory()){ res.statusCode=301; res.setHeader('Location','/web-runner/index.html'); res.end(); return; }
    const ext = path.extname(fp);
    const ct = mime[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', ct + (ct.startsWith('text/')?'; charset=utf-8':''));
    fs.createReadStream(fp).pipe(res);
  });
});
server.listen(port, ()=>console.log('Serving', root, 'on http://localhost:'+port));
