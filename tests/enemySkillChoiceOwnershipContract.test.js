const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemySkillChoiceRules.mjs');

test('simulation core module exposes a Rust-owned enemy skill choice marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreEnemySkillChoiceResolution/);
  assert.match(shadowSrc, /window\.__ORKA_ENEMY_SKILL_CHOICE_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemySkillChoiceOwner/);
});

test('enemy skill resolver follows Rust owner when Rust and JS disagree', async () => {
  const { ENEMY_SKILL_CODES, ENEMY_SKILL_BRANCH_CODES, resolveEnemySkillChoice } = await import(pathToFileURL(rulesPath));
  const decision = resolveEnemySkillChoice({
    enemyName: 'Djinn',
    hp: 20,
    maxHP: 20,
    boardReady: 1,
    roll: 0.1,
    ownerHook: () => ({
      owner: 'rust',
      selectedCode: ENEMY_SKILL_CODES.Enemy_MAG_Single,
      branchCode: ENEMY_SKILL_BRANCH_CODES.regular,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.selected, 'Enemy_MAG_Single');
  assert.equal(decision.branch, 'regular');
  assert.equal(decision.jsDecision.selected, 'Enemy_Scathe');
});

test('PickEnemySkill routes final enemy choice through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveEnemySkillChoice/);
    assert.match(src, /__ORKA_ENEMY_SKILL_CHOICE_OWNER__/);
    assert.match(src, /g\.LastEnemySkillChoiceOwner/);
    assert.match(src, /traceEnemySkillDecision\(ctx, enemyUID, decision\);/);
  }
});
