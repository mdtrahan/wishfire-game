const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(src, signature) {
  const start = src.indexOf(signature);
  assert.notEqual(start, -1, `expected ${signature}`);
  const bodyStart = src.indexOf('{', start + signature.length);
  assert.notEqual(bodyStart, -1, `expected ${signature} body`);
  let depth = 0;
  for (let idx = bodyStart; idx < src.length; idx += 1) {
    const ch = src[idx];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return src.slice(start, idx + 1);
  }
  assert.fail(`expected ${signature} to close`);
}

test('dev tooling refresh uses the shared combat turn refresh baseline and invalidates stale pause snapshots', () => {
  const src = read('web-runner/app.js');

  assert.match(src, /createCombatTurnRefreshBaseline/);
  assert.match(src, /function clearDevToolingPauseSnapshot\(\)/);
  assert.match(src, /function resetCombatRuntimeForFreshSession\(reason = 'combat-refresh', options = \{\}\)/);
  assert.match(src, /applyTurnGateGlobals\(createCombatTurnRefreshBaseline\(state\.globals, \{/);
  assert.match(src, /clearDevToolingPauseSnapshot\(\);[\s\S]*state\.globals\.DevToolingPaused = ensureDevToolingConfig\(\)\.open \? 1 : 0;/);
  assert.match(src, /CombatSessionId: Number\(state\.globals\.CombatSessionId \|\| 0\),/);
  assert.match(src, /TurnSerial: Number\(state\.globals\.TurnSerial \|\| 0\),/);
  assert.match(src, /const sameCombatSession =[\s\S]*CombatSessionId/s);
  assert.match(src, /const sameTurnSerial =[\s\S]*TurnSerial/s);
  assert.match(src, /if \(sameCombatSession && sameTurnSerial\) \{\s*applyTurnGateGlobals\(devToolingPauseSnapshot\);/s);
  assert.match(src, /if \(closeModal\) closeDevToolingModal\(\{ restorePauseSnapshot: appliedSessionChange !== 'combat_refresh' \}\);/);

  const refreshBlock = extractFunctionSource(src, 'async function refreshCombatSessionFromDevTooling({ forceCombat = false, resetGame = false } = {})');
  assert.match(refreshBlock, /resetCombatRuntimeForFreshSession\('dev-tool-refresh', \{[\s\S]*boardHasEmptySlots: hasEmptySlots\(\),[\s\S]*\}\);/);
  assert.doesNotMatch(refreshBlock, /state\.globals\.(IsPlayerBusy|PendingSkillID|DeferAdvance|ActionInProgress|PendingActor|CanPickGems)\s*=/);
});

test('turn-gate apply wrapper owns extended transient fields in app runtime', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /const TURN_TRANSIENT_NUMERIC_KEYS = Object\.freeze\(\[/);
  assert.match(src, /'ActionInProgress'/);
  assert.match(src, /'ActionActorUID'/);
  assert.match(src, /'PendingActor'/);
  assert.match(src, /'EnemyLineClearPressureActive'/);
  assert.match(src, /const TURN_TRANSIENT_STRING_KEYS = Object\.freeze\(\[/);
  assert.match(src, /'PendingSkillID'/);
  assert.match(src, /for \(const key of TURN_TRANSIENT_NUMERIC_KEYS\) \{/);
  assert.match(src, /for \(const key of TURN_TRANSIENT_STRING_KEYS\) \{/);
});
