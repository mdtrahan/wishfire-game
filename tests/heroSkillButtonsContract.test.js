const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hero screen reads canonical kits with level locks and no skill upgrade control', () => {
 const source=fs.readFileSync(path.join(__dirname,'../web-runner/systems/renderHeroScreen.js'),'utf8');
 assert.match(source,/heroDefinition/);assert.match(source,/d.passives/);assert.match(source,/d.actives/);assert.match(source,/d.special/);
 assert.match(source,/ability.unlockLevel/);assert.doesNotMatch(source,/AttemptHeroSkillUpgrade|heroSkillPoints/);
});

test('hero skill downgrade function exists in both runtime and scripts function banks', () => {
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');

  assert.match(runtimeSrc, /export function AttemptHeroSkillDowngrade\(/);
  assert.match(scriptsSrc, /export function AttemptHeroSkillDowngrade\(/);
  assert.match(runtimeSrc, /reason: 'min_rank_reached'/);
  assert.match(runtimeSrc, /GrantHeroSkillPoints\(ctx, heroUID, refund/);
});
