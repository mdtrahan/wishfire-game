const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
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

  const refreshBlock = src.match(/async function refreshCombatSessionFromDevTooling[\s\S]*?return true;\n  }/);
  assert.ok(refreshBlock, 'expected dev tooling refresh function');
  assert.match(refreshBlock[0], /resetCombatRuntimeForFreshSession\('dev-tool-refresh', \{[\s\S]*boardHasEmptySlots: hasEmptySlots\(\),[\s\S]*\}\);/);
  assert.doesNotMatch(refreshBlock[0], /state\.globals\.(IsPlayerBusy|PendingSkillID|DeferAdvance|ActionInProgress|PendingActor|CanPickGems)\s*=/);
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
