const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('web-runner app restores ORKA-7kt DOM dev tooling modal', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const DEV_TOOL_HOTKEY_LABEL = 'Ctrl\+Shift\+P';/);
  assert.match(src, /let devToolingDom = null;/);
  assert.match(src, /function createDefaultDevToolingConfig\(\)/);
  assert.match(src, /function ensureDevToolingConfig\(\)/);
  assert.match(src, /window\.addEventListener\('keydown', handleGlobalKeydown, true\);/);
  assert.match(src, /devToolingDom\.launcher\.addEventListener\('click', \(\) => toggleDevToolingModal\(true\)\);/);
  assert.match(src, /devToolingDom\.apply\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ refreshGame: true, forceCombat: true \}\)\);/);
  assert.match(src, /devToolingDom\.refresh\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ refreshGame: true, resetGame: true, forceCombat: false \}\)\);/);
  assert.match(src, /devToolingDom\.autoplay\.addEventListener\('click', async \(\) => \{/);
  assert.match(src, /config: ensureDevToolingConfig\(\)/);
  assert.match(src, /applyDevToolingConfig\(input = \{\}\)\s*\{/);
});
