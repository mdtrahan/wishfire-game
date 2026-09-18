const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('canonical hero progress is persisted by the browser storage owner', () => {
 const app=read('web-runner/app.js'),storage=read('web-runner/systems/heroProgressStorage.js');
 assert.match(app,/heroProgressStorage.restoreHeroProgressFromStorage/);
 assert.match(app,/heroProgressStorage.persistHeroProgressIfDirty/);
 assert.match(storage,/orka.hero_progress.v2/);
 assert.match(storage,/createHeroProgressStore/);
 assert.doesNotMatch(storage,/LoadHeroGemProgressSnapshot/);
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
