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
    assert.match(src, /if \(!belowHalfHP\) \{\s*const roll = Math\.random\(\);/);
    assert.match(src, /decision\.selected === 'Enemy_Heal_Self'/);
    assert.match(src, /decision\.selected === 'Enemy_Heal_Ally'/);
    assert.match(src, /decision\.selected === 'Enemy_Heal_Allies'/);
    assert.match(src, /selected: 'Enemy_MAG_Single'/);
    assert.match(src, /branch: 'cmh_over_50_no_heal'/);
    assert.match(src, /branch: 'cmh_under_50_forced_heal'/);
  });
}
