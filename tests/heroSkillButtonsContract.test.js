const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hero layout exports skill control hit zones and pointer handler invokes upgrade/downgrade actions', () => {
  const renderPath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderHeroScreen.js');
  const pointerPath = path.join(__dirname, '..', 'web-runner', 'systems', 'pointerRoutingShell.js');
  const renderSrc = fs.readFileSync(renderPath, 'utf8');
  const pointerSrc = fs.readFileSync(pointerPath, 'utf8');

  assert.match(renderSrc, /const upgradeButton = mapRect\(heroLayoutSpec\.heroUpgrade\);/);
  assert.match(renderSrc, /skillNodes: skillNodeHitZones,/);
  assert.match(renderSrc, /upgradeButton,/);
  assert.match(pointerSrc, /isPointInRect\(mx, my, zones\.upgradeButton\)/);
  assert.match(pointerSrc, /callFunctionWithContext\(fnContext, 'AttemptHeroSkillUpgrade', selectedHero\.uid, activeNode\.skillKey, 'hero_screen_upgrade_button'\)/);
  assert.match(pointerSrc, /callFunctionWithContext\(fnContext, 'AttemptHeroSkillUpgrade', selectedHero\.uid, activeNode\.skillKey, 'hero_skill_modal_upgrade_button'\)/);
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
