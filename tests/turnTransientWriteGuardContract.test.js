const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
  test(`mirrored turn-gate wrapper applies the full transient write set in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /const TURN_TRANSIENT_NUMERIC_KEYS = Object\.freeze\(\[/);
    assert.match(src, /'ActionInProgress'/);
    assert.match(src, /'ActionActorUID'/);
    assert.match(src, /'PendingActor'/);
    assert.match(src, /'EnemyLineClearPressureActive'/);
    assert.match(src, /const TURN_TRANSIENT_STRING_KEYS = Object\.freeze\(\[/);
    assert.match(src, /'PendingSkillID'/);
    assert.match(src, /function applyTurnGateState\(g, next\) \{[\s\S]*for \(const key of TURN_TRANSIENT_NUMERIC_KEYS\) \{[\s\S]*for \(const key of TURN_TRANSIENT_STRING_KEYS\) \{/s);
  });
}

test('deferred advance gate is centralized in app runtime', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /function canResolveDeferredAdvance\(\{ hasEmpty = false, enemyLineClearPressureActive = false \} = \{\}\)/);
  assert.match(src, /function getPresentationTurnBarrier\(\{ hasEmpty = false, enemyLineClearPressureActive = false \} = \{\}\)/);
  assert.match(src, /derivePresentationTurnBarrier\(\{/);
  assert.match(src, /const refillPending = presentationBarrier\.refillPending && presentationBarrier\.canStartRefill;/);
  assert.match(src, /const textHold = presentationBarrier\.lanes\.textAnimating;/);
  assert.match(src, /const pendingSelect = state\.globals\.TurnPhase === 1 && !!state\.globals\.PendingSkillID;/);
  assert.match(src, /const mergeInFlight = presentationBarrier\.lanes\.gemMerge;/);
  assert.match(src, /const ownerOk = !ownerUID \|\| ownerUID === currentUID;/);
  assert.match(src, /let deferredAdvanceState = canResolveDeferredAdvance\(\{/);
  assert.match(src, /!deferredAdvanceState\.ownerOk &&\s*!deferredAdvanceState\.blockedPhase &&\s*deferredAdvanceState\.presentationBarrier\.canAdvanceTurn/s);
  assert.doesNotMatch(src, /callFunctionWithContext\(fnContext, 'EnemyTurn'/);
  assert.match(src, /combatRuntimeGateway\.runCombatStep\(fnContext, 'ProcessTurn'\)/);
});
