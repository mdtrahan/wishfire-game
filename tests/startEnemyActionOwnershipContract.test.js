const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'startEnemyActionRules.mjs');

test('simulation core module exposes a Rust-owned StartEnemyAction marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreStartEnemyActionResolution/);
  assert.match(shadowSrc, /window\.__ORKA_START_ENEMY_ACTION_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowStartEnemyActionOwner/);
});

test('StartEnemyAction resolver follows Rust owner when Rust and JS disagree', async () => {
  const { resolveStartEnemyAction } = await import(pathToFileURL(rulesPath));
  const decision = resolveStartEnemyAction({
    source: 'test.startEnemyActionOwner',
    enemyExists: 1,
    enemyUID: 12,
    targetUID: 101,
    skillId: 'Enemy_ATK_Single',
    originX: 300,
    ownerHook: () => ({
      owner: 'rust',
      active: 1,
      uid: 12,
      stateCode: 1,
      targetUID: 202,
      skillCode: 2,
      forwardX: 245,
      timer: 0,
      actionApplied: 0,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.targetUID, 202);
  assert.equal(decision.skillId, 'Enemy_MAG_Single');
  assert.equal(decision.jsDecision.targetUID, 101);
  assert.equal(decision.jsDecision.skillId, 'Enemy_ATK_Single');
});

test('StartEnemyAction routes action packet through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveStartEnemyActionCompat/);
    assert.match(src, /__ORKA_START_ENEMY_ACTION_OWNER__/);
    assert.match(src, /g\.LastStartEnemyActionOwner/);
    assert.match(src, /decision\.targetUID/);
    assert.match(src, /g\.EnemyAction = \{/);
  }
});
