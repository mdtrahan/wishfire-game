const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('combat init uses canonical resources without retired skill-point seeds', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'combatSessionInitializer.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.doesNotMatch(src, /SetHeroSkillPointsForParty/);
  assert.match(src, /attachHeroProgress/);
});
