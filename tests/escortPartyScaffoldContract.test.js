const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('web-runner app restores ORKA-3as escort party scaffold', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');

  assert.match(src, /function readEscortPartyConfig\(\)/);
  assert.match(src, /const escortConfig = readEscortPartyConfig\(\);/);
  assert.match(src, /EscortPartyConfig/);
  assert.match(src, /EscortNPCState/);
  assert.match(src, /kind:\s*'escort'/);
  assert.match(src, /kind === 'escort'/);
});
