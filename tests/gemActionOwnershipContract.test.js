const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'gemActionRules.mjs');

test('simulation core module exposes a Rust-owned gem action marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreGemActionResolution/);
  assert.match(shadowSrc, /window\.__ORKA_GEM_ACTION_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowGemActionOwner/);
});

test('gem action resolver follows Rust owner when Rust and JS disagree', async () => {
  const { resolveGemAction } = await import(pathToFileURL(rulesPath));
  const decision = resolveGemAction({
    source: 'test.gemActionOwner',
    gemColor: 0,
    consumedCount: 4,
    astralFlowWallet: 7,
    astralFlowAmpPoints: 5,
    astralFlowAmpMax: 18,
    astralFlowAmpReady: 0,
    time: 10,
    ownerHook: () => ({
      owner: 'rust',
      routeCode: 2,
      pendingSkillCode: 0,
      setIsAoe: 1,
      isAoe: 0,
      showAttackUi: 0,
      callCode: 0,
      consumesTurn: 1,
      consumedCount: 4,
      blueWalletAfter: 11,
      blueAmpPointsAfter: 9,
      blueAmpReadyAfter: 0,
      blueOpenDraught: 0,
      actionLockUntil: 10.32,
      purpleEnergyAmount: 12,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.routeCode, 2);
  assert.equal(decision.pendingSkillId, '');
  assert.equal(decision.jsDecision.routeCode, -1);
});

test('stale green owner packets normalize to unknown and drop attack UI state', async () => {
  const { resolveGemAction } = await import(pathToFileURL(rulesPath));
  const decision = resolveGemAction({
    source: 'test.retiredGreenOwner',
    gemColor: 0,
    consumedCount: 4,
    ownerHook: () => ({
      owner: 'rust',
      routeCode: 0,
      pendingSkillCode: 1,
      setIsAoe: 1,
      isAoe: 1,
      showAttackUi: 1,
      callCode: 0,
      consumesTurn: 0,
      consumedCount: 4,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.routeCode, -1);
  assert.equal(decision.pendingSkillCode, 0);
  assert.equal(decision.pendingSkillId, '');
  assert.equal(decision.setIsAoe, 0);
  assert.equal(decision.isAoe, 0);
  assert.equal(decision.showAttackUi, 0);
});

test('ResolveGemAction routes branch packet through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveGemAction/);
    assert.match(src, /__ORKA_GEM_ACTION_OWNER__/);
    assert.match(src, /g\.LastGemActionOwner/);
    assert.match(src, /decision\.routeCode/);
    assert.match(src, /GrantPurpleMatchEnergy\(ctx, actorUID, consumedCount, decision\.purpleEnergyAmount\);/);
  }
});
