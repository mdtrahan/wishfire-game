const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('web-runner app keeps dev tooling modal decoupled from combat reset flow', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const DEV_TOOL_HOTKEY_LABEL = 'Ctrl\+Shift\+P';/);
  assert.match(src, /let devToolingDom = null;/);
  assert.match(src, /function createDefaultDevToolingConfig\(\)/);
  assert.match(src, /function ensureDevToolingConfig\(\)/);
  assert.match(src, /window\.addEventListener\('keydown', handleGlobalKeydown, true\);/);
  assert.match(src, /devToolingDom\.launcher\.addEventListener\('click', \(\) => toggleDevToolingModal\(true\)\);/);
  assert.match(src, /Apply: writes only the selected condition; no combat reset, turn advance, or loadout refresh/);
  assert.match(src, /Save Staged/);
  assert.match(src, /devToolingDom\.apply\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ closeModal: true \}\)\);/);
  assert.match(src, /devToolingDom\.refresh\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ closeModal: false \}\)\);/);
  assert.match(src, /devToolingDom\.autoplay\.addEventListener\('click', async \(\) => \{/);
  assert.match(src, /config: ensureDevToolingConfig\(\)/);
  assert.match(src, /async function applyDevToolingConfig\(patch = \{\}, \{ closeModal = true \} = \{\}\)/);
  assert.doesNotMatch(src, /applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ refreshGame:/);
  assert.doesNotMatch(src, /applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ resetGame:/);
  assert.match(src, /Combat state unchanged/);
});
