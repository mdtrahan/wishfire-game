const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('web-runner app keeps dev tooling modal decoupled from combat reset flow', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const DEV_TOOL_HOTKEY_LABEL = 'Ctrl\+Shift\+P';/);
  assert.match(src, /let devToolingDom = null;/);
  assert.match(src, /function createDefaultDevToolingConfig\(\)/);
  assert.match(src, /function ensureDevToolingConfig\(\)/);
  assert.match(src, /window\.addEventListener\('keydown', handleGlobalKeydown, true\);/);
  assert.match(src, /devToolingDom\.launcher\.addEventListener\('click', \(\) => toggleDevToolingModal\(true\)\);/);
  assert.doesNotMatch(src, /data-devtool-status/);
  assert.doesNotMatch(src, /Global runtime controls\. Hotkey:/);
  assert.match(src, /Save Staged/);
  assert.match(src, /data-devtool-restart/);
  assert.match(src, /Double Attack/);
  assert.match(src, /Skill Draught Hero UID/);
  assert.match(src, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(src, /data-devtool-control-grid/);
  assert.match(src, /flex-wrap:wrap/);
  assert.match(src, /data-devtool-double-attack-hero/);
  assert.match(src, /devToolingDom\.apply\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ closeModal: true \}\)\);/);
  assert.match(src, /devToolingDom\.refresh\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ closeModal: false \}\)\);/);
  assert.match(src, /devToolingDom\.restart\.addEventListener\('click', async \(\) => devToolingControls\.handleRestartClick\(\{/);
  assert.match(src, /devToolingDom\.autoplay\.addEventListener\('click', async \(\) => \{/);
  assert.match(src, /closeDevToolingModal\(\{ restorePauseSnapshot: true \}\);/);
  assert.match(src, /function syncConfiguredDoubleAttackHarness\(cfg = ensureDevToolingConfig\(\)\)/);
  assert.match(src, /function syncIdleFarmDevLoadoutConfig\(cfg = ensureDevToolingConfig\(\)\)/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'ConfigureActorExtraTurnSkill', actor\.uid, \{/);
  assert.match(src, /syncIdleFarmDevLoadoutConfig\(next\);/);
  assert.match(src, /if \(activeLayoutId === 'combat' && typeof devToolingRefreshHandler === 'function'\) \{/);
  assert.match(src, /await devToolingRefreshHandler\(\{ forceCombat: false, resetGame: false \}\);/);
  assert.match(src, /else if \(activeLayoutId === 'idleFarmLayout'\) \{/);
  assert.match(src, /restartIdleFarmSession\(performance\.now\(\) \/ 1000\);/);
  assert.match(src, /Combat state unchanged/);
  assert.match(src, /config: ensureDevToolingConfig\(\)/);
  assert.match(src, /async function applyDevToolingConfig\(patch = \{\}, \{ closeModal = true \} = \{\}\)/);
  assert.match(src, /const resetCfg = createDefaultDevToolingConfig\(\);/);
  assert.match(src, /state\.globals\.DevToolingConfig = resetCfg;/);
  assert.match(src, /persistDevToolingConfig\(\{ \.\.\.resetCfg, open: false \}\);/);
  assert.doesNotMatch(src, /applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ refreshGame:/);
  assert.doesNotMatch(src, /applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ resetGame:/);
  assert.match(src, /Double Attack: \$\{next\.doubleAttackHeroName \|\| 'Off'\}/);
});

test('dev tooling restart helper owns restart button labels and reset delegation', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingControls.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /export function getAutoplayButtonLabel\(autoplayActive\)/);
  assert.match(src, /return autoplayActive \? 'Stop AutoPlay' : 'AutoPlay';/);
  assert.match(src, /export async function handleRestartClick\(\{/);
  assert.match(src, /closeDevToolingModal\(\{ restorePauseSnapshot: true \}\);/);
  assert.match(src, /const restarted = await devToolingRefreshHandler\(\{ resetGame: true \}\);/);
  assert.match(src, /updateDevToolingStatus\('Game restart unavailable'\);/);
});

test('startup preload can prepare combat assets while story mock is active', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const preloadSrc = extractFunctionSource(src, 'loadC3ProjectAssets');
  const prepareSrc = extractFunctionSource(src, 'prepareCombatSetupFromInstances');

  assert.doesNotMatch(preloadSrc, /assertCombatLayoutDev\('loadC3ProjectAssets'\)/);
  assert.doesNotMatch(prepareSrc, /assertCombatLayoutDev\('prepareCombatSetupFromInstances'\)/);
  assert.match(src, /assertCombatLayoutDev\('initEntities'\)/);
  assert.match(src, /assertCombatLayoutDev\('createGemBoard'\)/);
  assert.match(src, /assertCombatLayoutDev\('StartRound'\)/);
});

test('runtime render scope includes board integrity helper used by extracted runtime', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');
  const appSrc = fs.readFileSync(filePath, 'utf8');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const drawFrameSrc = extractFunctionSource(appSrc, 'drawFrame');

  assert.match(runtimeSrc, /assertBoardIntegrity\(/);
  assert.match(drawFrameSrc, /const runtimeScope = \{/);
  assert.match(drawFrameSrc, /assertBoardIntegrity,/);
});

test('runtime render scope includes gem gate snapshot helper used by extracted runtime', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');
  const appSrc = fs.readFileSync(filePath, 'utf8');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const drawFrameSrc = extractFunctionSource(appSrc, 'drawFrame');

  assert.match(runtimeSrc, /getGemGateSnapshot\(/);
  assert.match(drawFrameSrc, /getGemGateSnapshot,/);
});
