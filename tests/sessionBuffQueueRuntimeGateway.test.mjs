import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beginFreshSessionBuffQueue, chooseSessionLevelUpBuff, claimSessionBuffQueueResume, getSessionLevelUpBuffPresentation, restoreSessionBuffChoiceState, serializeSessionBuffChoiceState } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';

const party = () => [
  { uid: 1, kind: 'hero', heroInstanceKey: 'fara-1', heroDisplaySlot: 0, hp: 40, maxHP: 40, flow: 0 },
  { uid: 2, kind: 'hero', heroInstanceKey: 'hondo-2', heroDisplaySlot: 1, hp: 35, maxHP: 35, flow: 100 },
  { uid: 3, kind: 'hero', heroInstanceKey: 'runa-3', heroDisplaySlot: 2, hp: 30, maxHP: 30, flow: 0 },
  { uid: 4, kind: 'hero', heroInstanceKey: 'kaja-4', heroDisplaySlot: 3, hp: 45, maxHP: 45, flow: 0 },
];

function loadProductionGateway() {
  const file = path.join(process.cwd(), 'web-runner/src/core/combatRuntimeGateway.js');
  const source = `${fs.readFileSync(file, 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/export \{ CombatRuntimeGateway \};\nexport default CombatRuntimeGateway;?/, 'module.exports = { CombatRuntimeGateway };')}`;
  const context = {
    module: { exports: {} }, exports: {}, console, JSON,
    createSimulationCoreRequest: () => ({}), createSimulationCoreResponse: () => ({}), normalizeSimulationRngState: value => value,
  };
  vm.createContext(context);
  new vm.Script(source, { filename: file }).runInContext(context);
  return context.module.exports.CombatRuntimeGateway;
}

test('gateway snapshot restores cached queue offers, threshold tokens, hero AF, and RNG without an extra draw', () => {
  const CombatRuntimeGateway = loadProductionGateway();
  const globals = { RuntimeRandom: () => 0.75, RuntimeRandomSeed: 12, RuntimeRandomDraws: 9, RuntimeRandomOwner: 'combat', RuntimeRandomReason: 'action' };
  const heroes = party();
  beginFreshSessionBuffQueue(globals, heroes);
  globals.PendingFlowThresholds = [{ heroUID: 2, triggerOrder: 1, token: 'flow-1-1' }];
  const opening = getSessionLevelUpBuffPresentation(globals, heroes);
  const combatState = { acceptEvents: true, inputEnabled: true };
  const gateway = new CombatRuntimeGateway({
    combatState,
    getAuthoritativeTurnState: () => ({ turnQueue: [{ uid: 1, type: 0 }, { uid: 2, type: 0 }], currentActorIndex: 1, capturedAtTick: 42 }),
    getDeterministicRngState: () => ({ RuntimeRandomSeed: globals.RuntimeRandomSeed, RuntimeRandomDraws: globals.RuntimeRandomDraws, RuntimeRandomOwner: globals.RuntimeRandomOwner, RuntimeRandomReason: globals.RuntimeRandomReason }),
    setDeterministicRngState: next => Object.assign(globals, next),
    getSessionState: () => ({ choiceState: serializeSessionBuffChoiceState(globals), heroFlow: heroes.map(hero => ({ uid: hero.uid, flow: hero.flow })) }),
    applySessionState: snapshot => {
      restoreSessionBuffChoiceState(globals, snapshot.choiceState);
      for (const row of snapshot.heroFlow) heroes.find(hero => hero.uid === row.uid).flow = row.flow;
    },
  });
  const snapshot = JSON.parse(JSON.stringify(gateway.suspend()));
  globals.SessionLevelUpOffersByQueueIndex = {};
  globals.RuntimeRandomDraws = 99;
  heroes[1].flow = 0;
  gateway.resume(snapshot);
  assert.deepEqual(getSessionLevelUpBuffPresentation(globals, heroes).cards, opening.cards);
  assert.equal(heroes[1].flow, 100);
  assert.equal(globals.RuntimeRandomDraws, 9);
  assert.equal(snapshot.sessionState.choiceState.SessionLevelUpQueue.entries.length, 5);
  assert.deepEqual(globals.PendingFlowThresholds, [{ heroUID: 2, triggerOrder: 1, token: 'flow-1-1' }]);
});

test('navigation snapshot preserves the final-choice resume request until the app consumes it exactly once', () => {
  const CombatRuntimeGateway = loadProductionGateway();
  const globals = { RuntimeRandom: () => 0, SessionLevelUpTierWeights: { 1: 1, 2: 0, 3: 0, 4: 0 } };
  const heroes = party();
  beginFreshSessionBuffQueue(globals, heroes);
  for (let index = 0; index < 4; index += 1) {
    const offer = getSessionLevelUpBuffPresentation(globals, heroes);
    assert.equal(chooseSessionLevelUpBuff(globals, heroes, offer.cards[0].cardId).status, 'applied');
  }
  assert.equal(globals.SessionLevelUpQueue.status, 'complete');
  assert.equal(globals.SessionLevelUpQueueResumeRequested, 1);
  const gateway = new CombatRuntimeGateway({
    combatState: { acceptEvents: true, inputEnabled: true },
    getAuthoritativeTurnState: () => ({ turnQueue: [{ uid: 1, type: 0 }], currentActorIndex: 0, capturedAtTick: 7 }),
    getSessionState: () => ({ choiceState: serializeSessionBuffChoiceState(globals), heroFlow: heroes.map(hero => ({ uid: hero.uid, flow: hero.flow })) }),
    applySessionState: snapshot => restoreSessionBuffChoiceState(globals, snapshot.choiceState),
  });
  const snapshot = JSON.parse(JSON.stringify(gateway.suspend()));
  globals.SessionLevelUpQueueResumeRequested = 0;
  gateway.resume(snapshot);
  let processTurnCalls = 0;
  if (claimSessionBuffQueueResume(globals)) processTurnCalls += 1;
  if (claimSessionBuffQueueResume(globals)) processTurnCalls += 1;
  assert.equal(processTurnCalls, 1);
  assert.equal(globals.SessionLevelUpQueueResumeRequested, 0);
});
