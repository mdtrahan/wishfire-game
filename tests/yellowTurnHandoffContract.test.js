const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function readYellowRuntimeSources() {
  return [
    read('web-runner/app.js'),
    read('web-runner/systems/renderRuntime.js').replace(/\\n/g, '\n'),
  ].join('\n');
}

test('yellow completion handoff preserves a single deferred advance until the real release point', async () => {
  const runtimeTurnGate = await import(path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'turnGateController.mjs'));
  const sharedTurnGate = await import(path.join('file://', __dirname, '..', 'src', 'core', 'turnGateController.mjs'));

  for (const mod of [runtimeTurnGate, sharedTurnGate]) {
    const pending = mod.createYellowSequenceCompletion({
      CanPickGems: 0,
      IsPlayerBusy: 1,
      DeferAdvance: 1,
      AdvanceAfterAction: 1,
      ActionOwnerUID: 42,
    }, {
      handoffPending: true,
      canRestorePickability: false,
    });
    assert.equal(pending.IsPlayerBusy, 0);
    assert.equal(pending.CanPickGems, 0);
    assert.equal(pending.DeferAdvance, 1);
    assert.equal(pending.AdvanceAfterAction, 1);
    assert.equal(pending.ActionOwnerUID, 42);

    const restored = mod.createYellowSequenceCompletion({
      CanPickGems: 0,
      IsPlayerBusy: 1,
      DeferAdvance: 1,
      AdvanceAfterAction: 1,
      ActionOwnerUID: 42,
      TurnPhase: 0,
      ActionLockUntil: 10,
      time: 10,
    }, {
      handoffPending: false,
      canRestorePickability: true,
    });
    assert.equal(restored.IsPlayerBusy, 0);
    assert.equal(restored.CanPickGems, 1);
    assert.equal(restored.DeferAdvance, 0);
    assert.equal(restored.AdvanceAfterAction, 1);
    assert.equal(restored.ActionOwnerUID, 42);
  }
});

test('yellow completion source keeps a single release path for gold-merge and non-merge resolution', () => {
  const src = readYellowRuntimeSources();
  assert.match(src, /if \(!shouldPlayGoldMerge\) \{[\s\S]*applyTurnGateIntent\(getYellowSequenceCompletionIntent\);[\s\S]*\}/);
  assert.match(src, /if \(merge\.releaseGate\) \{\s*applyTurnGateIntent\(getYellowSequenceCompletionIntent, merge\.releaseGate\);\s*merge\.releaseGate = null;\s*\}/);
  const immediateCompletionCalls = src.match(/applyTurnGateIntent\(getYellowSequenceCompletionIntent\);/g) || [];
  assert.equal(immediateCompletionCalls.length, 1, 'expected one immediate yellow completion handoff path');
  const gatedCompletionCalls = src.match(/applyTurnGateIntent\(getYellowSequenceCompletionIntent, merge\.releaseGate\);/g) || [];
  assert.equal(gatedCompletionCalls.length, 1, 'expected one gold-merge release handoff path');
});

test('deferred advance loop owns the single AdvanceTurn call after yellow completion', () => {
  const src = readYellowRuntimeSources();
  assert.match(src, /if \(\s*state\.globals\.GamePhase === 'RUNTIME'[\s\S]*state\.globals\.DeferAdvance[\s\S]*callFunctionWithContext\(fnContext, 'AdvanceTurn'\);/);
  const gameplayAdvance = src.match(/console\.log\(`\[TURN\] DeferAdvance -> AdvanceTurn[\s\S]*?callFunctionWithContext\(fnContext, 'AdvanceTurn'\);/);
  assert.ok(gameplayAdvance, 'expected deferred gameplay handoff to remain the production AdvanceTurn path');
  const devAutoplayBlock = src.match(/async function autoPlayTurnsDev[\s\S]*?\n  \}/);
  assert.ok(devAutoplayBlock, 'expected dev autoplay helper to remain defined');
  assert.doesNotMatch(devAutoplayBlock[0], /callFunctionWithContext\(fnContext, 'AdvanceTurn'\);/);
  const yellowFinishBlock = src.match(/if \(!casino\.current && casino\.index >= casino\.queue\.length\) \{[\s\S]*?traceTask015YellowAnimation\('yellow-sequence-finished', \{[\s\S]*?\n\s*}\n\s*}/);
  assert.ok(yellowFinishBlock, 'expected to isolate the yellow completion block');
  assert.doesNotMatch(yellowFinishBlock[0], /AdvanceTurn/);
});
