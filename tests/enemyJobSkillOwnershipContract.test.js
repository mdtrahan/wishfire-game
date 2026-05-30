const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemyJobSkillRules.mjs');

test('simulation core module exposes a Rust-owned enemy job skill marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreEnemyJobSkillResolution/);
  assert.match(shadowSrc, /window\.__ORKA_ENEMY_JOB_SKILL_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyJobSkillOwner/);
});

test('enemy job skill resolver follows Rust owner when Rust and JS disagree', async () => {
  const { resolveEnemyJobSkill } = await import(pathToFileURL(rulesPath));
  const decision = resolveEnemyJobSkill({
    source: 'test.enemyJobSkillOwner',
    skillId: 'Enemy_ATK_Single',
    enemyName: 'Gobloc',
    boardReady: 1,
    targetUID: 11,
    fallbackTargetUID: 22,
    ownerHook: () => ({
      owner: 'rust',
      normalizedSkillCode: 2,
      actionCode: 2,
      resolvedTargetUID: 22,
      allyTargetUID: 0,
      returnValue: 1,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.normalizedSkillId, 'Enemy_MAG_Single');
  assert.equal(decision.actionCode, 2);
  assert.equal(decision.resolvedTargetUID, 22);
  assert.equal(decision.jsDecision.actionCode, 1);
});

test('ExecuteEnemyJobSkill routes packet through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveEnemyJobSkillCompat/);
    assert.match(src, /__ORKA_ENEMY_JOB_SKILL_OWNER__/);
    assert.match(src, /g\.LastEnemyJobSkillOwner/);
    assert.match(src, /decision\.actionCode/);
    assert.match(src, /ENEMY_JOB_ACTION_MAGIC_SINGLE/);
    assert.match(src, /Enemy_MAG_Single\(ctx, enemyUID, resolvedTargetUID\);/);
  }
});
