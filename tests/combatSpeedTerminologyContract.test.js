const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

test('combat Speed terminology separates current behavior from legacy names', () => {
  const doc = read('governance/planning/combat-speed-terminology.md');

  assert.match(doc, /effective Speed \| Runtime Speed after current buffs\/debuffs, read through `GetEffectiveStat\(ctx, actor, 'SPD'\)`\./);
  assert.match(doc, /`SpeedDoubleRatio` \| Legacy state field\. Current double-attack and extra-turn logic must not read it\./);
  assert.match(doc, /`TryGrantSpeedExtraTurn` \| Compatibility alias for `TryGrantConfiguredExtraTurn`/);
  assert.match(doc, /fixture `SPD` values \| Test data unless the fixture explicitly references canonical tuning data\./);
});

test('legacy SpeedDoubleRatio state field is labeled and absent from active extra-turn logic', () => {
  for (const relPath of ['web-runner/modules/state.js', 'Scripts/state.js']) {
    const src = read(relPath);
    assert.match(src, /Legacy compatibility field; current double-attack and extra-turn logic must not read it\.\s*SpeedDoubleRatio: 2\.0/);
  }

  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    assert.doesNotMatch(read(relPath), /SpeedDoubleRatio/);
  }
});

test('retired Drain Speed rationale is marked historical', () => {
  const doc = read('governance/product/retired-skills/drain.md');

  assert.match(doc, /Historical note:/);
  assert.match(doc, /Current normal combat uses effective Speed interleaving\./);
  assert.doesNotMatch(doc, /In the team-turn combat model,\s*slowing enemy SPD/);
});
