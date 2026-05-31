const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'turnPhaseAssignmentRules.mjs');

test('simulation core module exposes a Rust-owned turn phase marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreTurnPhaseAssignmentResolution/);
  assert.match(shadowSrc, /window\.__ORKA_TURN_PHASE_ASSIGNMENT_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowTurnPhaseAssignmentOwner/);
});

test('turn phase resolver follows Rust owner when Rust and JS disagree', async () => {
  const {
    createTurnPhaseAssignmentSimulationPacket,
    resolveTurnPhaseAssignment,
    turnPhaseAssignmentResultFromPhase,
  } = await import(pathToFileURL(rulesPath));
  const decision = resolveTurnPhaseAssignment({
    source: 'test.turnPhaseOwner',
    turnType: 0,
    ownerHook: () => ({
      owner: 'rust',
      turnPhase: 2,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.turnPhase, 2);
  assert.equal(decision.jsDecision.turnPhase, 0);
  assert.equal(turnPhaseAssignmentResultFromPhase(2), 'enemy_turn');

  const requests = [];
  const responses = [];
  const packet = createTurnPhaseAssignmentSimulationPacket({
    source: 'test.packetizedTurnPhase',
    turnType: 0,
    ownerHook: () => ({
      owner: 'rust',
      turnPhase: 2,
    }),
    requestFactory(action, context) {
      requests.push({ action, context });
      return {
        contractVersion: 1,
        baselineId: 'test',
        gameState: {
          turnState: {
            turnTypeCode: 0,
            turnPhase: 0,
          },
        },
        action,
        rngState: { seed: 3, draws: 0, owner: 'rust', reason: 'test', lastValue: 0 },
        context,
      };
    },
    responseApplier(response) {
      responses.push(response);
      return response;
    },
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.turnTypeCode, 0);
  assert.equal(packet.turnPhase, 2);
  assert.equal(packet.simulationCoreRequest.action.type, 'turn.phaseAssignment');
  assert.equal(packet.simulationCoreRequest.action.turnTypeCode, 0);
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'turnPhaseAssignment');
  assert.equal(packet.simulationCoreResponse.result, 'enemy_turn');
  assert.equal(packet.simulationCoreResponse.diagnostics.owner, 'rust');
  assert.equal(packet.simulationCoreResponse.diagnostics.jsTurnPhase, 0);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnState.turnTypeCode, 0);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnState.turnPhase, 2);
  assert.equal(requests.length, 1);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('ProcessCurrentTurn routes turn phase assignment through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /createTurnPhaseAssignmentSimulationPacket/);
    assert.match(src, /__ORKA_TURN_PHASE_ASSIGNMENT_OWNER__/);
    assert.match(src, /g\.LastTurnPhaseAssignmentOwner/);
    assert.match(src, /g\.LastTurnPhaseAssignmentPacket/);
    assert.match(src, /resolveCurrentTurnPhase\(ctx, 'functionBank\.ProcessCurrentTurn\.timeInitiative'\)/);
    assert.match(src, /resolveCurrentTurnPhase\(ctx, 'functionBank\.ProcessCurrentTurn'\)/);
  }
});
