const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemyTargetingRules.mjs');

test('simulation core module exposes a Rust-owned enemy target marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreEnemyTargetResolution/);
  assert.match(shadowSrc, /window\.__ORKA_ENEMY_TARGET_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyTargetOwner/);
});

test('enemy target resolver follows Rust owner when Rust and JS disagree', async () => {
  const { ENEMY_TARGET_MODE_CODES, resolveEnemyTargetHero } = await import(pathToFileURL(rulesPath));
  const heroes = [
    { uid: 11, name: 'Falie', hp: 10, maxHP: 40, stats: { ATK: 5 }, slotIndex: 0 },
    { uid: 22, name: 'Huun', hp: 20, maxHP: 35, stats: { ATK: 12 }, slotIndex: 1 },
  ];
  const decision = resolveEnemyTargetHero({
    enemy: { uid: 900, name: 'Djinn' },
    heroes,
    rng: () => 0.01,
    ownerHook: () => ({
      owner: 'rust',
      targetUID: 22,
      modeCode: ENEMY_TARGET_MODE_CODES.uniform,
      rollIndex: 1,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.target.uid, 22);
  assert.equal(decision.jsDecision.target.uid, 11);
  assert.equal(decision.trace.owner, 'rust');
});

test('pickEnemyTargetHero routes final enemy target through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveEnemyTargetHero/);
    assert.match(src, /__ORKA_ENEMY_TARGET_OWNER__/);
    assert.match(src, /g\.LastEnemyTargetBias = result\.trace;/);
  }
});
