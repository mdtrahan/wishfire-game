const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');

function extractFunction(src, name) {
  const match = src.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `missing ${name}`);
  return match[0];
}

function loadEncounterHelpersWithRustSentinel() {
  const src = fs.readFileSync(appPath, 'utf8');
  const snippet = [
    'function createSimulationCoreSeededRng(seed) { return globalThis.__rustOwnedRngFactory(seed); }',
    extractFunction(src, 'normalizeBiomeTags'),
    extractFunction(src, 'normalizeEnemyRole'),
    extractFunction(src, 'normalizeFaction'),
    extractFunction(src, 'createSeededRng'),
    extractFunction(src, 'computeEncounterTotalCP'),
    extractFunction(src, 'deriveEncounterPoolNames'),
    extractFunction(src, 'buildEncounterByBudget'),
  ].join('\n\n');
  const script = `${snippet}
module.exports = {
  buildEncounterByBudget,
};`;
  const context = {
    module: { exports: {} },
    exports: {},
    Number,
    String,
    Array,
    JSON,
    Math,
    globalThis: {
      __rustOwnedRngFactory: () => {
        let draws = 0;
        return () => {
          draws += 1;
          return draws === 1 ? 0.99 : 0;
        };
      },
    },
  };
  vm.runInNewContext(script, context, { filename: 'seededRngOwnershipHelpers.js' });
  return context.module.exports;
}

test('app seeded RNG wrapper delegates runtime decisions to SimulationCore adapter', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const createSeededRngSrc = extractFunction(appSrc, 'createSeededRng');

  assert.match(createSeededRngSrc, /createSimulationCoreSeededRng/);
  assert.doesNotMatch(createSeededRngSrc, /1664525/);
  assert.doesNotMatch(createSeededRngSrc, /1013904223/);
  assert.doesNotMatch(createSeededRngSrc, /4294967296/);
});

test('encounter seeded RNG decisions follow Rust-owned adapter when Rust and JS disagree', () => {
  const helpers = loadEncounterHelpersWithRustSentinel();
  const pool = [
    { name: 'js-pick', CombatPower: 10, enemyRole: 'fodder', localeTags: ['all'], faction: 'wishless' },
    { name: 'middle-pick', CombatPower: 10, enemyRole: 'fodder', localeTags: ['all'], faction: 'wishless' },
    { name: 'rust-pick', CombatPower: 10, enemyRole: 'fodder', localeTags: ['all'], faction: 'wishless' },
  ];

  const encounter = helpers.buildEncounterByBudget({
    pool,
    targetCP: 10,
    locale: 'all',
    maxSlots: 1,
    policy: 'mixed',
    seed: 1,
    faction: '',
    historyCounts: null,
  });

  assert.equal(encounter.selected.length, 1);
  assert.equal(encounter.selected[0].name, 'rust-pick');
});
