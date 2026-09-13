const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const repoRoot = path.join(__dirname, '..');
const mirrors = [
  path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'),
  path.join(repoRoot, 'Scripts', 'functionBank.js'),
];

async function loadFunctionBank(modulePath) {
  const { resolveHeroAttackTarget } = await import(pathToFileURL(path.join(repoRoot, 'src', 'core', 'heroAttackTargetingRules.mjs')));
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = { ExecuteSkill };`;
  const context = {
    ...require('../web-runner/src/core/combatRules.mjs'),
    ...require('../web-runner/modules/heroCommands.mjs'),
    console,
    Math,
    Number,
    String,
    Array,
    Object,
    resolveHeroAttackTarget,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function createContext({ pending = false, selectedOwnerUID = null, hero = {}, enemies = null } = {}) {
  const actor = { uid: 101, kind: 'hero', name: 'Falie', attackType: 'melee', hp: 50, ...hero };
  const staleEnemy = { uid: 201, kind: 'enemy', name: 'Stale', hp: 90, maxHP: 90, stats: { ATK: 1, DEF: 1, SPD: 1, MAG: 1 } };
  const randomEnemy = { uid: 202, kind: 'enemy', name: 'Random', hp: 90, maxHP: 90, stats: { ATK: 1, DEF: 1, SPD: 1, MAG: 1 } };
  const ownerUID = selectedOwnerUID == null
    ? (pending ? actor.uid : 0)
    : Number(selectedOwnerUID || 0);
  return {
    state: {
      globals: {
        ActionLockUntil: 0,
        CombatLog: [],
        PendingActor: pending ? actor.uid : 0,
        PendingSkillID: pending ? 'HERO_SINGLE' : '',
        PowerAmpByUID: {},
        RuntimeRandom: () => 0.75,
        SelectedEnemyUID: staleEnemy.uid,
        SelectedEnemyUIDOwner: ownerUID,
        time: 1,
      },
      entities: [actor, ...(enemies || [staleEnemy, randomEnemy])],
    },
  };
}

for (const modulePath of mirrors) {
  test(`automatic HERO_SINGLE uses the tank rule in ${path.relative(repoRoot, modulePath)}`, async () => {
    const { ExecuteSkill } = await loadFunctionBank(modulePath);
    const ctx = createContext({ pending: false });

    ExecuteSkill(ctx, 'HERO_SINGLE', 101);

    assert.equal(ctx.state.globals.PendingHeroHits.length, 1);
    assert.equal(ctx.state.globals.PendingHeroHits[0].targetUID, 201);
  });

  test(`pending HERO_SINGLE preserves selected enemy in ${path.relative(repoRoot, modulePath)}`, async () => {
    const { ExecuteSkill } = await loadFunctionBank(modulePath);
    const ctx = createContext({ pending: true });

    ExecuteSkill(ctx, 'HERO_SINGLE', 101);

    assert.equal(ctx.state.globals.PendingHeroHits.length, 1);
    assert.equal(ctx.state.globals.PendingHeroHits[0].targetUID, 201);
  });

  test(`pending HERO_SINGLE refuses a selected enemy owned by a different actor in ${path.relative(repoRoot, modulePath)}`, async () => {
    const { ExecuteSkill } = await loadFunctionBank(modulePath);
    const ctx = createContext({ pending: true, selectedOwnerUID: 999 });

    const result = ExecuteSkill(ctx, 'HERO_SINGLE', 101);

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'invalid_manual_target');
    assert.equal((ctx.state.globals.PendingHeroHits || []).length, 0);
  });

  for (const scenario of [
    { role: 'Tank', hero: { role: 'Tank' }, expected: 203, enemies: [
      { uid: 201, kind: 'enemy', hp: 90, maxHP: 100, stats: { DEF: 4 } },
      { uid: 202, kind: 'enemy', hp: 95, maxHP: 100, stats: { DEF: 1 } },
      { uid: 203, kind: 'enemy', hp: 95, maxHP: 100, stats: { DEF: 8 } },
    ] },
    { role: 'Fighter', hero: { role: 'DPS / Fighter' }, expected: 202, enemies: [
      { uid: 201, kind: 'enemy', hp: 20, maxHP: 100, stats: { ATK: 4 } },
      { uid: 202, kind: 'enemy', hp: 20, maxHP: 100, stats: { ATK: 8 } },
      { uid: 203, kind: 'enemy', hp: 30, maxHP: 100, stats: { ATK: 99 } },
    ] },
    { role: 'Controller', hero: { role: 'Controller' }, expected: 203, enemies: [
      { uid: 201, kind: 'enemy', hp: 90, maxHP: 100, stats: { SPD: 8, MAG: 4 } },
      { uid: 202, kind: 'enemy', hp: 90, maxHP: 100, stats: { SPD: 10, MAG: 2 } },
      { uid: 203, kind: 'enemy', hp: 90, maxHP: 100, stats: { SPD: 10, MAG: 9 } },
    ] },
    { role: 'Support', hero: { role: 'Support / Guardian' }, expected: 202, enemies: [
      { uid: 201, kind: 'enemy', hp: 30, maxHP: 100, stats: { MAG: 4 } },
      { uid: 202, kind: 'enemy', hp: 30, maxHP: 100, stats: { MAG: 8 } },
      { uid: 203, kind: 'enemy', hp: 40, maxHP: 100, stats: { MAG: 99 } },
    ] },
  ]) {
    test(`${scenario.role} HERO_SINGLE targeting is deterministic in ${path.relative(repoRoot, modulePath)}`, async () => {
      const { ExecuteSkill } = await loadFunctionBank(modulePath);
      const ctx = createContext({ hero: scenario.hero, enemies: scenario.enemies });
      ExecuteSkill(ctx, 'HERO_SINGLE', 101);
      assert.equal(ctx.state.globals.PendingHeroHits[0].targetUID, scenario.expected);
    });
  }

  test(`unknown roles retain random fallback and dead enemies are excluded in ${path.relative(repoRoot, modulePath)}`, async () => {
    const { ExecuteSkill } = await loadFunctionBank(modulePath);
    const ctx = createContext({ hero: { role: 'Mystery' }, enemies: [
      { uid: 201, kind: 'enemy', hp: 0, maxHP: 100, stats: { ATK: 99 } },
      { uid: 202, kind: 'enemy', hp: 20, maxHP: 100, stats: { ATK: 1 } },
      { uid: 203, kind: 'enemy', hp: 20, maxHP: 100, stats: { ATK: 1 } },
    ] });
    ExecuteSkill(ctx, 'HERO_SINGLE', 101);
    assert.equal(ctx.state.globals.PendingHeroHits[0].targetUID, 203);
  });
}
