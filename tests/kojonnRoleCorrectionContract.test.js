const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('Kojonn green AOE uses blight-over-time packets instead of generic burst damage in both mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /const isKojonn = String\(actor && actor\.name \|\| ''\) === 'Kojonn';/);
    assert.match(src, /const aoeName = isKojonn \? 'Faze' :/);
    assert.match(src, /const baseKojonnDotDamage = isKojonn/);
    assert.match(src, /dotTotalDamage: Number\(hit\.dotTotalDamage \|\| 0\),/);
    assert.match(src, /effectType: isKojonn \? 'dot_apply' : 'damage',/);
    assert.match(src, /used \$\{aoeName\} to spread blight over time for \$\{totalDamage\}!/);
    assert.match(src, /export function QueueEnemyDamageOverTime\(ctx, actorUID, enemyUID, totalDamage, options = undefined\) \{/);
    assert.match(src, /g\.EnemyDamageOverTime\.push\(\{/);
    assert.match(src, /effectName: String\(options\?\.effectName \|\| 'Blight'\),/);
  }
});

