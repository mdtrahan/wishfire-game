const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hero layout exports skill control hit zones and pointer handler invokes upgrade/downgrade actions', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /skillControls:\s*\[\],/);
  assert.match(src, /gameState\.heroScreen\.hitZones\.skillControls\.push\(/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'AttemptHeroSkillUpgrade', selectedHero\.uid, control\.skillKey, 'hero_screen_plus'\)/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'AttemptHeroSkillDowngrade', selectedHero\.uid, control\.skillKey, 'hero_screen_minus'\)/);
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
