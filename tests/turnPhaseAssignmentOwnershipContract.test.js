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
  const { resolveTurnPhaseAssignment } = await import(pathToFileURL(rulesPath));
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
});

test('ProcessCurrentTurn routes turn phase assignment through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveTurnPhaseAssignment/);
    assert.match(src, /__ORKA_TURN_PHASE_ASSIGNMENT_OWNER__/);
    assert.match(src, /g\.LastTurnPhaseAssignmentOwner/);
    assert.match(src, /resolveCurrentTurnPhase\(ctx, 'functionBank\.ProcessCurrentTurn\.timeInitiative'\)/);
    assert.match(src, /resolveCurrentTurnPhase\(ctx, 'functionBank\.ProcessCurrentTurn'\)/);
  }
});
