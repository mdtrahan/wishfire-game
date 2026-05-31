const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const sourceRulesPath = path.join(__dirname, '..', 'src', 'core', 'gameStateEnvelopeRules.mjs');
const runtimeRulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'gameStateEnvelopeRules.mjs');
const sourceCjsPath = path.join(__dirname, '..', 'src', 'core', 'gameStateEnvelopeRules.cjs');

function sampleRuntimeSnapshot() {
  return {
    coordSystem: 'origin:top-left, x:right, y:down',
    time: 12.5,
    turn: { uid: 2, type: 0, name: 'Huun' },
    round: { active: true, groupIndex: 0, memberIndex: 1 },
    turnOrder: [
      { uid: 1, type: 0, name: 'Falie', spd: 9 },
      { uid: 2, type: 0, name: 'Huun', spd: 20 },
      { uid: 7, type: 1, name: 'Orc', spd: 8 },
    ],
    party: { hp: 77, maxHp: 147 },
    resources: {
      energy: 123,
      maxEnergy: 150,
      gold: 4,
      tokenWallet: { HORN: 2 },
      astralFlowWallet: 5,
      heroGemMilestones: { trace: [{ shouldNotBeInEnvelope: true }] },
    },
    flags: {
      canPickGems: 1,
      isPlayerBusy: 0,
      turnPhase: 0,
      deferAdvance: 0,
      pendingSkillId: null,
      layoutId: 'combat',
      overlayVisible: true,
    },
    heroes: [
      { uid: 1, name: 'Falie', x: 10, y: 20, hp: 42, maxHp: 42, atk: 12, def: 14, combatPower: 42.2 },
      { uid: 2, name: 'Huun', x: 20, y: 30, hp: 35, maxHp: 35, atk: 18, spd: 20, combatPower: 35.5 },
    ],
    enemies: [
      { uid: 7, name: 'Orc', x: 200, y: 60, hp: 60, maxHp: 60, slot: 0, combatPower: 38 },
    ],
    gems: [
      { uid: 101, r: 0, c: 0, color: 2, x: 62.5, y: 397.5, selected: true },
      { uid: 102, r: 0, c: 1, color: 3, x: 109.5, y: 397.5, selected: false },
    ],
    damageTexts: [{ amount: 12, x: 200, y: 120 }],
    devTools: { config: { open: true } },
    mapLayout: { render: { canvasOnly: true } },
    storage: { key: 'save-slot' },
    unsafeFn: () => 'drop',
  };
}

function assertJsonSafe(value, label) {
  assert.deepEqual(JSON.parse(JSON.stringify(value)), value, label);
}

test('GameState envelope rule module mirrors runtime and source copies exactly', () => {
  assert.equal(
    fs.readFileSync(runtimeRulesPath, 'utf8'),
    fs.readFileSync(sourceRulesPath, 'utf8'),
  );
});

test('GameState envelope strips browser presentation while preserving deterministic runtime state', async () => {
  const rules = await import(pathToFileURL(runtimeRulesPath));
  const cjsRules = require(sourceCjsPath);
  const snapshot = sampleRuntimeSnapshot();
  const envelope = rules.normalizeGameStateEnvelope(snapshot);
  const cjsEnvelope = cjsRules.normalizeGameStateEnvelope(snapshot);

  assert.deepEqual(cjsEnvelope, envelope);
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.turnState.turnQueue.length, 3);
  assert.equal(envelope.turnState.currentActorIndex, 1);
  assert.equal(envelope.resources.energy, 123);
  assert.equal(envelope.resources.partyHp, 77);
  assert.deepEqual(envelope.resources.tokenWallet, { HORN: 2 });
  assert.equal(envelope.actors.heroes.length, 2);
  assert.equal(envelope.actors.enemies.length, 1);
  assert.equal(envelope.board.gems.length, 2);
  assert.equal(envelope.board.selectedCount, 1);
  assert.equal(envelope.actors.heroes[0].x, undefined);
  assert.equal(envelope.board.gems[0].x, undefined);
  assert.equal(envelope.damageTexts, undefined);
  assert.equal(envelope.devTools, undefined);
  assert.equal(envelope.mapLayout, undefined);
  assert.equal(envelope.storage, undefined);
  assert.equal(envelope.flags.layoutId, undefined);
  assert.equal(envelope.flags.overlayVisible, undefined);
  assertJsonSafe(envelope, 'normalized envelope is JSON-safe');
});

test('GameState envelope packet exposes JSON-safe SimulationCore request/response and save-load roundtrip guard', async () => {
  const rules = await import(pathToFileURL(runtimeRulesPath));
  const snapshot = sampleRuntimeSnapshot();
  const packet = rules.createGameStateEnvelopeSimulationPacket({
    source: 'test.runtimeSnapshot',
    state: snapshot,
    action: { source: 'test', unsafeFn: () => 'drop' },
    rngState: { seed: 123, draws: 4, owner: 'rust' },
    ownerHook: ({ envelope }) => ({
      owner: 'rust',
      nextGameState: {
        ...envelope,
        resources: {
          ...envelope.resources,
          energy: envelope.resources.energy - 1,
        },
      },
    }),
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.simulationCoreRequest.action.type, 'gamestate.normalize');
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'gameStateEnvelope');
  assert.equal(packet.simulationCoreResponse.result, 'game_state_envelope');
  assert.equal(packet.simulationCoreResponse.nextGameState.resources.energy, 122);
  assert.equal(packet.shape.heroCount, 2);
  assert.equal(packet.shape.enemyCount, 1);
  assert.equal(packet.shape.gemCount, 2);
  assert.equal(packet.shape.turnQueueLength, 3);
  assert.equal(packet.shape.currentActorIndex, 1);
  assert.equal(packet.simulationCoreRequest.action.unsafeFn, undefined);
  assertJsonSafe(packet.simulationCoreRequest, 'GameState request JSON-safe');
  assertJsonSafe(packet.simulationCoreResponse, 'GameState response JSON-safe');

  const saveLoadRoundtrip = rules.normalizeGameStateEnvelope(
    JSON.parse(JSON.stringify(packet.simulationCoreResponse.nextGameState)),
  );
  assert.deepEqual(saveLoadRoundtrip, packet.simulationCoreResponse.nextGameState);
});

test('SimulationCore packet builders normalize GameState through the envelope boundary', () => {
  const { createSimulationCoreRequest, createSimulationCoreResponse } = require('../src/core');
  const snapshot = sampleRuntimeSnapshot();
  const request = createSimulationCoreRequest({
    gameState: snapshot,
    action: { type: 'gateway.snapshot' },
    rngState: { seed: 9, draws: 1, owner: 'rust' },
    context: { canvas: { width: 400 }, safeFlag: 1 },
  });
  const response = createSimulationCoreResponse({
    nextGameState: snapshot,
    result: 'continue',
  });

  assert.equal(request.gameState.schemaVersion, 1);
  assert.equal(request.gameState.actors.heroes.length, 2);
  assert.equal(request.gameState.actors.heroes[0].x, undefined);
  assert.equal(request.gameState.damageTexts, undefined);
  assert.equal(request.context.canvas, undefined);
  assert.equal(response.nextGameState.schemaVersion, 1);
  assert.equal(response.nextGameState.board.gems.length, 2);
});
