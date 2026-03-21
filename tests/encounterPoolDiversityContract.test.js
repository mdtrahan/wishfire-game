const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadEncounterHelpers() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const snippet = [
    src.match(/function normalizeBiomeTags\(input\) \{[\s\S]*?\n\}/)?.[0],
    src.match(/function normalizeFaction\(input\) \{[\s\S]*?\n\}/)?.[0],
    src.match(/function deriveEncounterPoolNames\(\{ pool, locale = 'all', faction = '' \} = \{\}\) \{[\s\S]*?\n\}/)?.[0],
  ].join('\n\n');
  const script = `${snippet}
module.exports = { normalizeBiomeTags, normalizeFaction, deriveEncounterPoolNames };`;
  const context = {
    module: { exports: {} },
    exports: {},
    String,
    Array,
    JSON,
  };
  vm.runInNewContext(script, context, { filename: 'encounterPoolHelpers.js' });
  return context.module.exports;
}

test('encounter pool names preserve the full eligible locale roster instead of only initial picks', () => {
  const { deriveEncounterPoolNames } = loadEncounterHelpers();
  const pool = [
    { name: 'Djinn', localeTags: ['clouds'], faction: 'wishless' },
    { name: 'Marid', localeTags: ['clouds'], faction: 'wishless' },
    { name: 'Gargoyle', localeTags: ['clouds'], faction: 'wishless' },
    { name: 'Slime', localeTags: ['swamp'], faction: 'wishless' },
  ];

  const names = deriveEncounterPoolNames({ pool, locale: 'clouds', faction: 'wishless' });

  assert.deepEqual(names, ['Djinn', 'Marid', 'Gargoyle']);
});

test('encounter pool names respect faction filtering when present', () => {
  const { deriveEncounterPoolNames } = loadEncounterHelpers();
  const pool = [
    { name: 'Djinn', localeTags: ['clouds'], faction: 'wishless' },
    { name: 'Harpy', localeTags: ['clouds'], faction: 'dreamless' },
    { name: 'Marid', localeTags: ['clouds'], faction: 'wishless' },
  ];

  const names = deriveEncounterPoolNames({ pool, locale: 'clouds', faction: 'wishless' });

  assert.deepEqual(names, ['Djinn', 'Marid']);
});
