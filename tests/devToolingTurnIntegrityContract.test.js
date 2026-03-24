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

test('blue heal and purple support matches enter action phase instead of staying in idle hero phase', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /if \(gemColor === 2\) \{\s*g\.TurnPhase = 1;/s);
    assert.match(src, /if \(gemColor === 4\) \{\s*g\.TurnPhase = 1;/s);
    assert.match(src, /if \(gemColor === 5\) \{\s*g\.TurnPhase = 1;/s);
  }
});

test('manual and idle gem selection share a strict idle-window guard with one-action-per-turn protection', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /function hasConsumedGemActionThisTurn\(\)/);
  assert.match(src, /function isHeroGemInputWindowOpen\(\)/);
  assert.match(src, /g\.LastGemActionActorUID = Number\(actorUID \|\| 0\);/);
  assert.match(src, /g\.LastGemActionTurnSerial = Number\(g\.TurnSerial \|\| 0\);/);
  assert.match(src, /return isHeroGemInputWindowOpen\(\);/);
  assert.match(src, /if \(!isHeroTurn \|\| !isHeroGemInputWindowOpen\(\)\) \{/);
  assert.match(src, /reject-gate-turn-already-consumed/);
  assert.doesNotMatch(src, /DevForcedSupportEnemyTurnRequired/);
});

test('deferred advance stays blocked while board refill is still transient', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /const boardFillActive = !!state\.globals\.BoardFillActive;/);
  assert.match(src, /const refillPending =[\s\S]*boardFillActive[\s\S]*hasEmpty/s);
  assert.match(src, /return \{[\s\S]*boardFillActive,[\s\S]*refillPending,[\s\S]*ok: !refillPending && !textHold && !blockedPhase && ownerOk,/s);
  assert.match(src, /if \(hasWork\) \{[\s\S]*state\.globals\.BoardFillActive = 1;[\s\S]*\} else \{\s*state\.globals\.BoardFillActive = 0;/s);
});
