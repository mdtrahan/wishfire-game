const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('hero gem progress persistence seam exists in app runtime', () => {
  const appSrc = read('web-runner/app.js');
  const storageSrc = read('web-runner/systems/heroGemProgressStorage.js');
  assert.match(appSrc, /import \* as heroGemProgressStorage from '\.\/systems\/heroGemProgressStorage\.js';/);
  assert.match(appSrc, /heroGemProgressStorage\.restoreHeroGemProgressFromStorage/);
  assert.match(appSrc, /heroGemProgressStorage\.persistHeroGemProgressIfDirty/);
  assert.match(storageSrc, /const HERO_GEM_PROGRESS_STORAGE_KEY = 'orka\.hero_gem_progress\.v1';/);
  assert.match(storageSrc, /function readPersistedHeroGemProgress\(\)/);
  assert.match(storageSrc, /window\.localStorage\.getItem\(HERO_GEM_PROGRESS_STORAGE_KEY\)/);
  assert.match(storageSrc, /export function writePersistedHeroGemProgress\(snapshot\)/);
  assert.match(storageSrc, /window\.localStorage\.setItem\(HERO_GEM_PROGRESS_STORAGE_KEY, JSON\.stringify\(snapshot\)\)/);
  assert.match(storageSrc, /export function restoreHeroGemProgressFromStorage/);
  assert.match(storageSrc, /callFunctionWithContext\(fnContext, 'LoadHeroGemProgressSnapshot', snapshot\);/);
  assert.match(storageSrc, /export function persistHeroGemProgressIfDirty/);
  assert.match(storageSrc, /callFunctionWithContext\(fnContext, 'GetHeroGemProgressSnapshot'\);/);
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
