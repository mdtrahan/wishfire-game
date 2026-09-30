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

test('production app delegates combat to the realtime stage scheduler', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /createCombatSimulationTicker\(\)/);
  assert.match(src, /combatSimulationTicker\.tick\(\{/);
  assert.match(src, /maybeAdvanceContinuousCombatStage\(\{/);
  assert.doesNotMatch(src, /callFunctionWithContext\(fnContext, '(?:AdvanceTurn|ProcessTurn|EnemyTurn)'/);
  assert.doesNotMatch(src, /runCombatStep\(fnContext, '(?:AdvanceTurn|ProcessTurn|EnemyTurn)'/);
});
