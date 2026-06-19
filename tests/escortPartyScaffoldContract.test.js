const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('web-runner app restores ORKA-3as escort party scaffold', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const combatSessionSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'combatSessionInitializer.js'), 'utf8');
  const devToolingSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js'), 'utf8');

  assert.match(src, /function readEscortPartyConfig\(\)/);
  assert.match(combatSessionSrc, /const escortConfig = readEscortPartyConfig\(\);/);
  assert.match(src, /EscortPartyConfig/);
  assert.match(combatSessionSrc, /EscortNPCState/);
  assert.match(devToolingSrc, /kind:\s*'escort'/);
  assert.match(src, /kind === 'escort'/);
});
