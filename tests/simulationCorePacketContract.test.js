const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const webPacketPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'simulationCorePacket.js');
const webGatewayPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'combatRuntimeGateway.js');

test('SimulationCore packet builders expose the contract request/response shape', () => {
  const {
    SIMULATION_CORE_BASELINE_ID,
    SIMULATION_CORE_CONTRACT_VERSION,
    createSimulationCoreRequest,
    createSimulationCoreResponse,
  } = require('../src/core');
  const sourceGameState = {
    turnState: {
      turnQueue: [{ uid: 101, type: 0 }],
      currentActorIndex: 0,
      capturedAtTick: 17,
    },
    nested: { hp: 44 },
  };
  const request = createSimulationCoreRequest({
    gameState: sourceGameState,
    action: { type: 'gateway.snapshot', source: 'test', unsafeFn: () => 'drop' },
    rngState: {
      RuntimeRandomSeed: 123,
      RuntimeRandomDraws: 7,
      RuntimeRandomOwner: 'rust',
      RuntimeRandomReason: 'test',
      RuntimeRandomLastValue: 0.25,
    },
    context: {
      layoutId: 'combat',
      checkpointId: 'CHK_SNAPSHOT_EMIT',
      canvas: { width: 400 },
      audio: { enabled: true },
      storage: { key: 'save' },
      presentation: { flash: true },
      safeFlag: 1,
    },
  });

  assert.equal(SIMULATION_CORE_CONTRACT_VERSION, 1);
  assert.equal(SIMULATION_CORE_BASELINE_ID, 'main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87');
  assert.equal(request.contractVersion, 1);
  assert.equal(request.baselineId, SIMULATION_CORE_BASELINE_ID);
  assert.deepEqual(request.gameState.turnState.turnQueue, [{ uid: 101, type: 0, name: '', spd: 0 }]);
  assert.deepEqual(request.rngState, {
    seed: 123,
    draws: 7,
    owner: 'rust',
    reason: 'test',
    lastValue: 0.25,
  });
  assert.equal(request.action.type, 'gateway.snapshot');
  assert.equal(request.action.unsafeFn, undefined);
  assert.equal(request.context.layoutId, 'combat');
  assert.equal(request.context.safeFlag, 1);
  assert.equal(request.context.canvas, undefined);
  assert.equal(request.context.audio, undefined);
  assert.equal(request.context.storage, undefined);
  assert.equal(request.context.presentation, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(request)), request);

  sourceGameState.turnState.turnQueue[0].uid = 999;
  sourceGameState.nested.hp = 1;
  assert.deepEqual(request.gameState.turnState.turnQueue, [{ uid: 101, type: 0, name: '', spd: 0 }]);
  assert.equal(request.gameState.nested, undefined);

  const response = createSimulationCoreResponse({
    nextGameState: { turnState: { turnQueue: [{ uid: 202, type: 1 }], currentActorIndex: 0, capturedAtTick: 18 } },
    events: [{ type: 'combat.log', text: 'resolved', fn: () => 'drop' }],
    rngState: { seed: 123, draws: 8, owner: 'rust', reason: 'after', lastValue: 0.75 },
    result: 'continue',
    diagnostics: { owner: 'rust', ignoredFn: () => 'drop' },
  });

  assert.equal(response.contractVersion, 1);
  assert.equal(response.result, 'continue');
  assert.deepEqual(response.events, [{ type: 'combat.log', text: 'resolved' }]);
  assert.equal(response.diagnostics.ignoredFn, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(response)), response);
});
