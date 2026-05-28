const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

async function loadRules() {
  return import(pathToFileURL(path.join(__dirname, '..', 'src', 'core', 'enemyTargetingRules.mjs')).href);
}

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('default enemy targeting uniformly selects among living heroes', async () => {
  const { pickEnemyTargetHeroFromRoster } = await loadRules();
  const heroes = [
    { uid: 11, name: 'Falie', hp: 10, stats: { ATK: 5 } },
    { uid: 22, name: 'Huun', hp: 20, stats: { ATK: 12 } },
    { uid: 33, name: 'Runa', hp: 30, stats: { ATK: 8 } },
    { uid: 44, name: 'Kojonn', hp: 40, stats: { ATK: 3 } },
  ];

  const first = pickEnemyTargetHeroFromRoster({ heroes, rng: () => 0.01 });
  const second = pickEnemyTargetHeroFromRoster({ heroes, rng: () => 0.30 });
  const third = pickEnemyTargetHeroFromRoster({ heroes, rng: () => 0.55 });
  const fourth = pickEnemyTargetHeroFromRoster({ heroes, rng: () => 0.90 });

  assert.equal(first.target.uid, 11);
  assert.equal(second.target.uid, 22);
  assert.equal(third.target.uid, 33);
  assert.equal(fourth.target.uid, 44);
  assert.equal(first.trace.mode, 'uniform');
});

test('enemy identity target preference applies only when the enemy defines it', async () => {
  const { pickEnemyTargetHeroFromRoster } = await loadRules();
  const heroes = [
    { uid: 11, name: 'Falie', hp: 40, maxHP: 40, stats: { ATK: 5 } },
    { uid: 22, name: 'Huun', hp: 9, maxHP: 35, stats: { ATK: 12 } },
    { uid: 33, name: 'Runa', hp: 30, maxHP: 30, stats: { ATK: 8 } },
  ];

  const result = pickEnemyTargetHeroFromRoster({
    enemy: { uid: 900, name: 'Assassin', targetPreference: 'low_hp' },
    heroes,
    rng: () => 0.99,
  });

  assert.equal(result.target.uid, 22);
  assert.equal(result.trace.mode, 'identity_preference');
  assert.equal(result.trace.preference, 'low_hp');
});

test('runtime mirrors route enemy target selection through shared identity policy', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    assert.match(src, /pickEnemyTargetHeroFromRoster/);
    assert.match(src, /targetPreference: enemyData\.targetPreference/);
    assert.doesNotMatch(src, /FALIE_ENMITY_BONUS/);
    assert.doesNotMatch(src, /mode: 'falie_enmity_bias'/);
  }
});
