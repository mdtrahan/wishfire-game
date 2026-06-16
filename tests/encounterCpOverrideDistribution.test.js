const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const initializerPath = path.join(__dirname, '..', 'web-runner', 'systems', 'combatSessionInitializer.js');

function loadEncounterHelpers() {
  const src = fs.readFileSync(initializerPath, 'utf8');
  const transformed = src
    .replace(/import[\s\S]*?;\n/g, '')
    .replace(/export function /g, 'function ');
  const script = `${transformed}
module.exports = {
  buildEncounterByBudget,
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

test('enemy EncounterCP overrides rebalance fresh-start encounter appearances without stat edits', () => {
  const helpers = loadEncounterHelpers();
  const rows = loadEnemyRows(helpers);
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
  const expectedCp = {
    Gobloc: 47,
    'High Gobloc': 29.5,
    Lizardo: 41,
    Orc: 38,
    'High Orc': 55,
    Chimerilass: 34,
    Troll: 17,
    Skeleton: 47,
    Djinn: 32,
    Marid: 21,
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
  assert.ok(pct('Skeleton') >= 0.12, `Skeleton ${pct('Skeleton')}`);
  assert.ok(pct('Gobloc') >= 0.12, `Gobloc ${pct('Gobloc')}`);
  assert.ok(pct('High Gobloc') <= 0.07, `High Gobloc ${pct('High Gobloc')}`);
  assert.ok(pct('Troll') <= 0.03, `Troll ${pct('Troll')}`);
  assert.ok(pct('Marid') <= 0.04, `Marid ${pct('Marid')}`);
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), totalSlots);
  const totalCp = rows.reduce((sum, row) => sum + (counts[row.name] * row.CombatPower), 0);
  const averageEncounterCp = totalCp / iterations;
  assert.ok(averageEncounterCp >= 118 && averageEncounterCp <= 123, `average encounter CP ${averageEncounterCp}`);
});
