const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemyTurnFlowRules.mjs');

test('simulation core module exposes a Rust-owned EnemyTurn flow marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreEnemyTurnFlowResolution/);
  assert.match(shadowSrc, /window\.__ORKA_ENEMY_TURN_FLOW_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyTurnFlowOwner/);
});

test('EnemyTurn flow resolver follows Rust owner when Rust and JS disagree', async () => {
  const { resolveEnemyTurnFlow } = await import(pathToFileURL(rulesPath));
  const decision = resolveEnemyTurnFlow({
    source: 'test.enemyTurnFlowOwner',
    activeEnemyUID: 12,
    enemyExists: 1,
    enemyHp: 20,
    ownerHook: () => ({
      owner: 'rust',
      activeEnemyUID: 12,
      turnPhase: 2,
      actionCode: 1,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.actionCode, 1);
  assert.equal(decision.shouldAdvance, 1);
  assert.equal(decision.jsDecision.actionCode, 2);
});

test('EnemyTurn routes flow packet through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveEnemyTurnFlowCompat/);
    assert.match(src, /__ORKA_ENEMY_TURN_FLOW_OWNER__/);
    assert.match(src, /g\.LastEnemyTurnFlowOwner/);
    assert.match(src, /ProcessEnemyTurnDamageOverTime\(ctx, activeEnemyUID\);[\s\S]*?const enemy = GetActorByUID\(ctx, activeEnemyUID\);[\s\S]*?const decision = resolveEnemyTurnFlowCompat\(\{/);
    assert.match(src, /if \(Number\(decision\.shouldStartAction \|\| 0\) === 1\) \{\s+StartEnemyAction\(ctx, activeEnemyUID\);/);
  }
});
