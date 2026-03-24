const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('web-runner app restores ORKA-1ys idle farm routing shell', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');

  assert.match(src, /idleFarmLayout:\s*\{/);
  assert.match(src, /canTransitionTo\('idleFarmLayout'\)/);
  assert.match(src, /requestLayoutChange\('idleFarmLayout', 'nav-astral-flow'\)/);
  assert.match(src, /id:\s*'idleFarmLayout'/);
  assert.match(src, /if \(layoutId === 'idleFarmLayout'\)/);
  assert.match(src, /if \(activeLayoutId === 'idleFarmLayout'\)/);
  assert.match(src, /state: gameState\.idleFarmLayout \|\| null/);
});
