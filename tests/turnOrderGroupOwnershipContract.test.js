const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'turnOrderGroupRules.mjs');

test('simulation core module exposes a Rust-owned turn order group marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreTurnOrderGroupProjection/);
  assert.match(shadowSrc, /window\.__ORKA_TURN_ORDER_GROUP_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowTurnOrderGroupOwner/);
});

test('turn order group resolver follows Rust owner when Rust and JS disagree', async () => {
  const {
    buildTurnOrderGroupFromJs,
    createTurnOrderGroupSimulationPacket,
    resolveTurnOrderGroupProjection,
  } = await import(pathToFileURL(rulesPath));
  const roster = [
    { uid: 1, type: 0, spd: 11, hp: 40 },
    { uid: 2, type: 0, spd: 20, hp: 35 },
    { uid: 101, type: 1, spd: 18, hp: 20 },
  ];
  const jsProjection = buildTurnOrderGroupFromJs(roster, 0);

  assert.deepEqual(jsProjection.members.map(member => member.uid), [2, 1]);
  const projection = resolveTurnOrderGroupProjection({
    source: 'test.turnOrderGroupOwner',
    roster,
    requestedPhaseType: 0,
    ownerHook: () => ({
      owner: 'rust',
      phaseType: 1,
      members: [{ uid: 101, type: 1, spd: 18 }],
    }),
  });

  assert.equal(projection.owner, 'rust');
  assert.equal(projection.phaseType, 1);
  assert.deepEqual(projection.members.map(member => member.uid), [101]);
  assert.deepEqual(projection.jsMembers.map(member => member.uid), [2, 1]);

  const requests = [];
  const responses = [];
  const packet = createTurnOrderGroupSimulationPacket({
    source: 'test.packetizedTurnOrderGroup',
    roster,
    requestedPhaseType: 0,
    ownerHook: () => ({
      owner: 'rust',
      phaseType: 1,
      members: [{ uid: 101, type: 1, spd: 18 }],
    }),
    requestFactory(action, context) {
      requests.push({ action, context });
      return {
        contractVersion: 1,
        baselineId: 'test',
        gameState: {
          turnState: {
            phaseType: 0,
            members: [],
          },
        },
        action,
        rngState: { seed: 6, draws: 0, owner: 'rust', reason: 'test', lastValue: 0 },
        context,
      };
    },
    responseApplier(response) {
      responses.push(response);
      return response;
    },
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.phaseType, 1);
  assert.deepEqual(packet.members.map(member => member.uid), [101]);
  assert.equal(packet.simulationCoreRequest.action.type, 'turn.orderGroup');
  assert.equal(packet.simulationCoreRequest.action.requestedPhaseType, 0);
  assert.equal(packet.simulationCoreRequest.action.roster.length, 3);
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'turnOrderGroup');
  assert.equal(packet.simulationCoreResponse.result, 'enemy_group');
  assert.equal(packet.simulationCoreResponse.diagnostics.owner, 'rust');
  assert.deepEqual(packet.simulationCoreResponse.diagnostics.jsMembers.map(member => member.uid), [2, 1]);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnState.phaseType, 1);
  assert.deepEqual(packet.simulationCoreResponse.nextGameState.turnState.members.map(member => member.uid), [101]);
  assert.equal(requests.length, 1);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('turn order group shadow adapter preserves JS boolean-only alive semantics', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /isAlive: actor\?\.isAlive === false \? 0 : 1/);
  assert.match(shadowSrc, /ableToAct: actor\?\.ableToAct === false \? 0 : 1/);
});

test('BuildRoundGroups routes team-phase projection through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /createTurnOrderGroupSimulationPacket/);
    assert.match(src, /__ORKA_TURN_ORDER_GROUP_OWNER__/);
    assert.match(src, /g\.LastTurnOrderGroupOwner/);
    assert.match(src, /g\.LastTurnOrderGroupPacket/);
  }
});
