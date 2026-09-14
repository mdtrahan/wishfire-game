const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const initializerPath = path.join(__dirname, '..', 'web-runner', 'systems', 'combatSessionInitializer.js');

async function loadEncounterHelpers() {
  const { computeCombatPower: canonicalCombatPower } = await import(pathToFileURL(
    path.join(__dirname, '..', 'web-runner', 'src', 'core', 'combatPower.mjs'),
  ).href);
  const src = fs.readFileSync(initializerPath, 'utf8');
  const transformed = src
    .replace(/import[\s\S]*?;\n/g, '')
    .replace(/export function /g, 'function ');
  const script = `${transformed}
module.exports = {
  buildEncounterByBudget,
  computeEncounterTotalCP,
  normalizeBiomeTags,
  normalizeEnemyRole,
  normalizeFaction,
  resolveEnemyEncounterCombatPower,
};`;
  const context = {
    module: { exports: {} },
    exports: {},
    Number,
    String,
    Array,
    JSON,
    Math,
    Set,
    Infinity,
    canonicalCombatPower,
  };
  vm.runInNewContext(script, context, { filename: 'encounterCpHelpers.js' });
  return context.module.exports;
}

function loadEnemyRows(helpers) {
  const filePath = path.join(__dirname, '..', 'web-runner', 'assets', 'enemies.json');
  const enemyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(enemyData.size[0], enemyData.data.length);
  const headers = enemyData.data.map((column) => String(column[0][0]));
  const rows = [];
  for (let rowIndex = 1; rowIndex < enemyData.data[0].length; rowIndex += 1) {
    const row = {};
    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      row[headers[columnIndex]] = enemyData.data[columnIndex][rowIndex][0];
    }
    if (!String(row.name || '').trim()) continue;
    rows.push({
      ...row,
      faction: helpers.normalizeFaction(row.faction),
      enemyRole: helpers.normalizeEnemyRole(row.enemyRole || row.role),
      localeTags: helpers.normalizeBiomeTags(row.localeTags || row.locale_tags || row.locale || row.biomes || row.biome || 'all'),
      CombatPower: helpers.resolveEnemyEncounterCombatPower(row),
    });
  }
  return rows;
}

test('canonical EncounterCP derives fresh-start encounter appearances without authored overrides', async () => {
  const helpers = await loadEncounterHelpers();
  const rows = loadEnemyRows(helpers);
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
  const expectedCp = {
    Gobloc: 56.4,
    'High Gobloc': 77.4,
    Lizardo: 62.3,
    Orc: 49.8,
    'High Orc': 72.8,
    Chimerilass: 76,
    Troll: 78.3,
    Skeleton: 49.7,
    Djinn: 83.7,
    Marid: 67.5,
  };
  for (const [name, cp] of Object.entries(expectedCp)) {
    assert.equal(byName[name].CombatPower, cp, `${name} EncounterCP`);
  }
  assert.deepEqual(
    {
      Skeleton: [byName.Skeleton.HP, byName.Skeleton.ATK, byName.Skeleton.DEF],
      Gobloc: [byName.Gobloc.HP, byName.Gobloc.ATK, byName.Gobloc.DEF],
      Troll: [byName.Troll.HP, byName.Troll.ATK, byName.Troll.DEF],
      Marid: [byName.Marid.HP, byName.Marid.ATK, byName.Marid.DEF],
    },
    {
      Skeleton: [35, 8, 5],
      Gobloc: [40, 10, 8],
      Troll: [105, 20, 22],
      Marid: [60, 8, 10],
    },
  );

  const counts = Object.fromEntries(rows.map((row) => [row.name, 0]));
  const iterations = 10000;
  for (let i = 1; i <= iterations; i += 1) {
    const encounter = helpers.buildEncounterByBudget({
      pool: rows,
      targetCP: 120,
      locale: 'clouds',
      maxSlots: 3,
      policy: 'mixed',
      seed: (i * 2654435761) >>> 0,
      faction: '',
      historyCounts: {},
    });
    for (const pick of encounter.selected) counts[pick.name] += 1;
  }
  const totalSlots = iterations * 3;
  const pct = (name) => counts[name] / totalSlots;
  assert.ok(pct('Skeleton') > 0, 'catalog candidates remain selectable');
  assert.ok(Object.values(counts).reduce((sum, value) => sum + value, 0) <= totalSlots);
  const { scaleRoutineEnemy } = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'routineEnemyScaling.mjs')).href);
  const { computeCombatPower:canonicalCombatPower } = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'combatPower.mjs')).href);
  const { HERO_DEFINITIONS } = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'heroDefinitions.mjs')).href);
  const { levelStats } = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'heroProgression.mjs')).href);
  const productionRows = rows.map((rawRow) => {
    const row = scaleRoutineEnemy(rawRow, 1);
    return { ...row, CombatPower:helpers.resolveEnemyEncounterCombatPower(row) };
  });
  const heroCP = Object.values(HERO_DEFINITIONS).map((definition) => {
    const { HP, ...stats } = levelStats({ baseHeroName:definition.key, currentLevel:1, equipmentStats:{} });
    return { combatPower:canonicalCombatPower({ stats, maxHP:HP, currentLevel:1 }) };
  });
  const partyCP = helpers.computeEncounterTotalCP(heroCP);
  const targetCP = partyCP * .30;
  const bounded = helpers.buildEncounterByBudget({pool:productionRows,targetCP,partyCP,locale:'clouds',maxSlots:3,policy:'mixed',seed:77});
  assert.ok(bounded.finalCP / partyCP >= .25 && bounded.finalCP / partyCP <= .35, `routine party ratio ${bounded.finalCP / partyCP}`);
  assert.ok(bounded.finalCP / targetCP >= .85 && bounded.finalCP / targetCP <= 1.15, `routine target fill ${bounded.finalCP / targetCP}`);
  assert.equal(bounded.reasonCodes.includes('outside_routine_cp_band'), false);
});
