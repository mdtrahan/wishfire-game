const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('hero gem progress persistence seam exists in app runtime', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /const HERO_GEM_PROGRESS_STORAGE_KEY = 'orka\.hero_gem_progress\.v1';/);
  assert.match(src, /function readPersistedHeroGemProgress\(\)/);
  assert.match(src, /window\.localStorage\.getItem\(HERO_GEM_PROGRESS_STORAGE_KEY\)/);
  assert.match(src, /function writePersistedHeroGemProgress\(snapshot\)/);
  assert.match(src, /window\.localStorage\.setItem\(HERO_GEM_PROGRESS_STORAGE_KEY, JSON\.stringify\(snapshot\)\)/);
  assert.match(src, /function restoreHeroGemProgressFromStorage\(\)/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'LoadHeroGemProgressSnapshot', snapshot\);/);
  assert.match(src, /function persistHeroGemProgressIfDirty\(\)/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'GetHeroGemProgressSnapshot'\);/);
});

for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
  test(`hero gem progress snapshot and milestone hooks persist in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /const HERO_GEM_MILESTONE_DEFAULTS = Object\.freeze\(\[1000, 5000, 10000\]\);/);
    assert.match(src, /export function GetHeroGemProgressSnapshot\(ctx\)/);
    assert.match(src, /usage:\s*\{\s*byHeroId,\s*party: cloneGemUsageRow\(usage\.party\),\s*\}/s);
    assert.match(src, /milestones:\s*\{\s*thresholds: sanitizeHeroGemMilestoneThresholds\(milestones\.thresholds\),\s*\}/s);
    assert.match(src, /export function LoadHeroGemProgressSnapshot\(ctx, snapshot = null\)/);
    assert.match(src, /usage\.byHeroId = \{\};/);
    assert.match(src, /usage\.party = cloneGemUsageRow\(incomingUsage\.party\);/);
    assert.match(src, /store\.thresholds = sanitizeHeroGemMilestoneThresholds\(incomingMilestones\.thresholds\);/);
    assert.match(src, /store\.party = createHeroGemMilestoneRecord\(store\.thresholds, usage\.party\);/);
    assert.match(src, /g\.HeroGemProgressDirty = 0;/);
    assert.match(src, /export function ConfigureHeroGemMilestoneThresholds\(ctx, thresholds = \[\]\)/);
    assert.match(src, /touchHeroGemProgressDirty\(ctx\);/);
    assert.match(src, /export function GetHeroGemMilestones\(ctx\)/);
  });
}
