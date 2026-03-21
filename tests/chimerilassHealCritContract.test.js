const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const MIRRORS = [
  path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'),
  path.join(__dirname, '..', 'Scripts', 'functionBank.js'),
];

for (const filePath of MIRRORS) {
  test(`Chimerilass heal crit contract present in ${path.relative(process.cwd(), filePath)}`, () => {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /function traceEnemyHealRoll\(ctx, payload\)/);
    assert.match(src, /if \(!Array\.isArray\(g\.EnemyHealTrace\)\) g\.EnemyHealTrace = \[\];/);
    assert.match(src, /const crit = ApplyScaledCrit\(\{/);
    assert.match(src, /sourceType:\s*'ENEMY'/);
    assert.match(src, /critRoll:/);
    assert.match(src, /didCrit:/);
    assert.match(src, /critMultiplier:/);
    assert.match(src, /critically healed for/);
    assert.match(src, /critically heals her allies!/);
    assert.match(src, /critically heals .* for/);
  });
}
