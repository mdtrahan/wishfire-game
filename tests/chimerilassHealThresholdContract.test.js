const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const MIRRORS = [
  path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'),
  path.join(__dirname, '..', 'Scripts', 'functionBank.js'),
];

for (const filePath of MIRRORS) {
  test(`Chimerilass heal threshold guard present in ${path.relative(process.cwd(), filePath)}`, () => {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /const belowHalfHP = hp <= Math\.floor\(maxHP \* 0\.5\);/);
    assert.match(src, /if \(!belowHalfHP\) \{\s*return 0;\s*\}/);
    assert.match(src, /const roll = random01\(ctx\);/);
    assert.match(src, /let pick = random01\(ctx\) \* total;/);
    assert.match(src, /random01\(ctx\) < 0\.16/);
    assert.match(src, /random01\(ctx\) < 0\.10/);
    assert.match(src, /openingSkill: 'Enemy_MAG_Single'/);
    assert.match(src, /fallbackSkill: 'Enemy_MAG_Single'/);
    assert.match(src, /weighted\.push\(\{ skillId: 'Enemy_Heal_Allies', weight: 20 \}\)/);
    assert.match(src, /weighted\.push\(\{ skillId: 'Enemy_Heal_Ally', weight: 15 \}\)/);
    assert.match(src, /weighted\.push\(\{ skillId: 'Enemy_Heal_Self', weight: 65 \}\)/);
    assert.match(src, /selected\.skillId === 'Enemy_Heal_Ally'/);
    assert.match(src, /ExecuteEnemySkill\(ctx, enemyUID, selected\.skillId, allyTarget \? allyTarget\.uid : 0\);/);
  });
}
