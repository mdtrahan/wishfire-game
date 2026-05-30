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
  const { buildTurnOrderGroupFromJs, resolveTurnOrderGroupProjection } = await import(pathToFileURL(rulesPath));
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
});

test('turn order group shadow adapter preserves JS boolean-only alive semantics', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /isAlive: actor\?\.isAlive === false \? 0 : 1/);
  assert.match(shadowSrc, /ableToAct: actor\?\.ableToAct === false \? 0 : 1/);
});

test('BuildRoundGroups routes team-phase projection through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveTurnOrderGroupProjection/);
    assert.match(src, /__ORKA_TURN_ORDER_GROUP_OWNER__/);
    assert.match(src, /g\.LastTurnOrderGroupOwner/);
  }
});
