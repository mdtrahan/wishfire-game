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
  const { resolveRoundPointerAdvance } = await import(pathToFileURL(rulesPath));
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
});

test('ProcessCurrentTurn routes round pointer advance through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveRoundPointerAdvance/);
    assert.match(src, /__ORKA_ROUND_POINTER_ADVANCE_OWNER__/);
    assert.match(src, /g\.LastRoundPointerAdvanceOwner/);
    assert.match(src, /g\.RoundGroupIndex = Number\(pointerAdvance\.nextGroupIndex \|\| 0\);/);
    assert.match(src, /g\.TeamPhaseType = Number\(pointerAdvance\.nextTeamPhaseType \|\| 0\);/);
  }
});
