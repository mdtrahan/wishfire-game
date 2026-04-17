#!/usr/bin/env node
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { loadBoardData, formatStandupSummary } = require('./beads_board_data');

const args = process.argv.slice(2);
const host = '127.0.0.1';
const portArgIndex = args.indexOf('--port');
const port = portArgIndex >= 0 && args[portArgIndex + 1] ? Number(args[portArgIndex + 1]) : 8022;
const openBrowser = !args.includes('--no-open');
const root = process.cwd();
const url = `http://${host}:${port}/beads-board/`;
const boardApiUrl = `http://${host}:${port}/__beads/board.json`;
const serveLogPath = path.join(root, '.beads', 'standup-serve.log');

function isListening() {
  return new Promise((resolve) => {
    const req = http.get(boardApiUrl, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (!(res.statusCode >= 200 && res.statusCode < 300)) {
          resolve(false);
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          resolve(Boolean(parsed && parsed.summary && Array.isArray(parsed.columns)));
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(700, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await isListening()) return;
  let logFd = null;
  try {
    fs.mkdirSync(path.dirname(serveLogPath), { recursive: true });
    logFd = fs.openSync(serveLogPath, 'a');
  } catch {}
  const child = spawn(process.execPath, ['tools/serve_web.js', '--host', host, '--port', String(port)], {
    cwd: root,
    detached: true,
    stdio: ['ignore', logFd ?? 'ignore', logFd ?? 'ignore'],
  });
  if (logFd != null) {
    try { fs.closeSync(logFd); } catch {}
  }
  child.unref();
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (await isListening()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  let logHint = '';
  try {
    if (fs.existsSync(serveLogPath)) {
      const tail = String(fs.readFileSync(serveLogPath, 'utf8')).trim().split(/\r?\n/).slice(-8).join('\n');
      if (tail) logHint = `\nRecent serve log tail:\n${tail}`;
    }
  } catch {}
  throw new Error(`standup server did not start on ${url}${logHint}`);
}

function tryOpen(target) {
  if (!openBrowser) return;
  try {
    execFileSync('open', [target], { stdio: 'ignore' });
  } catch {}
}

(async () => {
  const board = await loadBoardData();
  console.log(formatStandupSummary(board));
  await ensureServer();
  tryOpen(url);
  console.log(`Board: ${url}`);
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
