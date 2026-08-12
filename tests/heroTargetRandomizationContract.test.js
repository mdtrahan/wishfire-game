const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const mirrors = [
  path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'),
  path.join(repoRoot, 'Scripts', 'functionBank.js'),
];

function loadFunctionBank(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = { ExecuteSkill };`;
  const context = {
    console,
    Math,
    Number,
    String,
    Array,
    Object,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function createContext({ pending = false, selectedOwnerUID = null } = {}) {
  const hero = { uid: 101, kind: 'hero', name: 'Falie', attackType: 'melee', hp: 50 };
  const staleEnemy = { uid: 201, kind: 'enemy', name: 'Stale', hp: 90, maxHP: 90 };
  const randomEnemy = { uid: 202, kind: 'enemy', name: 'Random', hp: 90, maxHP: 90 };
  const ownerUID = selectedOwnerUID == null
    ? (pending ? hero.uid : 0)
    : Number(selectedOwnerUID || 0);
  return {
    state: {
      globals: {
        ActionLockUntil: 0,
        CombatLog: [],
        PendingActor: pending ? hero.uid : 0,
        PendingSkillID: pending ? 'HERO_SINGLE' : '',
        PowerAmpByUID: {},
        RuntimeRandom: () => 0.75,
        SelectedEnemyUID: staleEnemy.uid,
        SelectedEnemyUIDOwner: ownerUID,
        time: 1,
      },
      entities: [hero, staleEnemy, randomEnemy],
    },
  };
}

for (const modulePath of mirrors) {
  test(`automatic HERO_SINGLE ignores stale selected enemy in ${path.relative(repoRoot, modulePath)}`, () => {
    const { ExecuteSkill } = loadFunctionBank(modulePath);
    const ctx = createContext({ pending: false });

    ExecuteSkill(ctx, 'HERO_SINGLE', 101);

    assert.equal(ctx.state.globals.PendingHeroHits.length, 1);
    assert.equal(ctx.state.globals.PendingHeroHits[0].targetUID, 202);
  });

  test(`pending HERO_SINGLE preserves selected enemy in ${path.relative(repoRoot, modulePath)}`, () => {
    const { ExecuteSkill } = loadFunctionBank(modulePath);
    const ctx = createContext({ pending: true });

    ExecuteSkill(ctx, 'HERO_SINGLE', 101);

    assert.equal(ctx.state.globals.PendingHeroHits.length, 1);
    assert.equal(ctx.state.globals.PendingHeroHits[0].targetUID, 201);
  });

  test(`pending HERO_SINGLE refuses a selected enemy owned by a different actor in ${path.relative(repoRoot, modulePath)}`, () => {
    const { ExecuteSkill } = loadFunctionBank(modulePath);
    const ctx = createContext({ pending: true, selectedOwnerUID: 999 });

    const result = ExecuteSkill(ctx, 'HERO_SINGLE', 101);

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'invalid_manual_target');
    assert.equal((ctx.state.globals.PendingHeroHits || []).length, 0);
  });
}
