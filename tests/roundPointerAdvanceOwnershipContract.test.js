const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'roundPointerAdvanceRules.mjs');

test('simulation core module exposes a Rust-owned round pointer marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreRoundPointerAdvanceResolution/);
  assert.match(shadowSrc, /window\.__ORKA_ROUND_POINTER_ADVANCE_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowRoundPointerAdvanceOwner/);
});

test('round pointer resolver follows Rust owner when Rust and JS disagree', async () => {
  const {
    createRoundPointerAdvanceSimulationPacket,
    resolveRoundPointerAdvance,
    roundPointerAdvanceResultFromCode,
  } = await import(pathToFileURL(rulesPath));
  const decision = resolveRoundPointerAdvance({
    source: 'test.roundPointerOwner',
    roundMemberIndex: 0,
    groupMemberCount: 4,
    roundGroupIndex: 0,
    groupCount: 1,
    teamPhaseType: 0,
    ownerHook: () => ({
      owner: 'rust',
      code: 2,
      nextMemberIndex: 99,
      groupComplete: 1,
      nextGroupIndex: 1,
      roundComplete: 1,
      nextTeamPhaseType: 1,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.code, 2);
  assert.equal(decision.nextMemberIndex, 99);
  assert.equal(decision.jsDecision.code, 0);
  assert.equal(roundPointerAdvanceResultFromCode(2), 'complete_round');

  const requests = [];
  const responses = [];
  const packet = createRoundPointerAdvanceSimulationPacket({
    source: 'test.packetizedRoundPointer',
    roundMemberIndex: 0,
    groupMemberCount: 4,
    roundGroupIndex: 0,
    groupCount: 1,
    teamPhaseType: 0,
    ownerHook: () => ({
      owner: 'rust',
      code: 2,
      nextMemberIndex: 99,
      groupComplete: 1,
      nextGroupIndex: 1,
      roundComplete: 1,
      nextTeamPhaseType: 1,
    }),
    requestFactory(action, context) {
      requests.push({ action, context });
      return {
        contractVersion: 1,
        baselineId: 'test',
        gameState: {
          turnState: {
            roundMemberIndex: 0,
            roundGroupIndex: 0,
            teamPhaseType: 0,
          },
        },
        action,
        rngState: { seed: 2, draws: 0, owner: 'rust', reason: 'test', lastValue: 0 },
        context,
      };
    },
    responseApplier(response) {
      responses.push(response);
      return response;
    },
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.code, 2);
  assert.equal(packet.simulationCoreRequest.action.type, 'turn.roundPointerAdvance');
  assert.equal(packet.simulationCoreRequest.action.roundMemberIndex, 0);
  assert.equal(packet.simulationCoreRequest.action.groupMemberCount, 4);
  assert.equal(packet.simulationCoreRequest.action.roundGroupIndex, 0);
  assert.equal(packet.simulationCoreRequest.action.groupCount, 1);
  assert.equal(packet.simulationCoreRequest.action.teamPhaseType, 0);
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'roundPointerAdvance');
  assert.equal(packet.simulationCoreResponse.result, 'complete_round');
  assert.equal(packet.simulationCoreResponse.diagnostics.owner, 'rust');
  assert.equal(packet.simulationCoreResponse.diagnostics.jsCode, 0);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnState.roundMemberIndex, 99);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnState.roundGroupIndex, 1);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnState.teamPhaseType, 1);
  assert.equal(requests.length, 1);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('ProcessCurrentTurn routes round pointer advance through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /createRoundPointerAdvanceSimulationPacket/);
    assert.match(src, /__ORKA_ROUND_POINTER_ADVANCE_OWNER__/);
    assert.match(src, /g\.LastRoundPointerAdvanceOwner/);
    assert.match(src, /g\.LastRoundPointerAdvancePacket/);
    assert.match(src, /g\.RoundGroupIndex = Number\(pointerAdvance\.nextGroupIndex \|\| 0\);/);
    assert.match(src, /g\.TeamPhaseType = Number\(pointerAdvance\.nextTeamPhaseType \|\| 0\);/);
  }
});
