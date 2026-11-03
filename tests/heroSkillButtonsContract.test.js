const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hero screen reads every accepted kit skill from shared data', () => {
 const source=fs.readFileSync(path.join(__dirname,'../web-runner/systems/renderHeroScreen.js'),'utf8');
 assert.match(source,/heroDefinition/);assert.match(source,/definition.skills/);assert.match(source,/ability.slot/);assert.match(source,/selectedAbility.displayName/);assert.match(source,/heroSkillCopy/);assert.match(source,/formatHeroSpecialCooldown\(hero,\s*growth\)/);
 assert.doesNotMatch(source,/d.passives|d.special/);
});
