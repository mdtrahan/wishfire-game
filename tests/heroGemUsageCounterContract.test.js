const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const MIRRORS = [
  path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'),
  path.join(__dirname, '..', 'Scripts', 'functionBank.js'),
];

for (const filePath of MIRRORS) {
  test(`hero gem usage counter helper present in ${path.relative(process.cwd(), filePath)}`, () => {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /const HERO_GEM_MILESTONE_DEFAULTS = Object\.freeze\(\[1000, 5000, 10000\]\);/);
    assert.match(src, /const HERO_GEM_USAGE_KEYS = Object\.freeze\(\['RED', 'BLUE', 'HEAL', 'YELLOW'\]\);/);
    assert.match(src, /function ensureHeroGemUsageState\(ctx\)/);
    assert.match(src, /byHeroId:\s*\{\}/);
    assert.match(src, /party:\s*createGemUsageRow\(\)/);
    assert.match(src, /function resolveGemUsageColorKey\(gemColor\)/);
    assert.doesNotMatch(src, /if \(gemColor === 0\) return 'GREEN';/);
    assert.match(src, /function ensureHeroGemMilestonesState\(ctx\)/);
    assert.match(src, /function evaluateHeroGemMilestones\(ctx, heroId = '', emitTrace = false\)/);
    assert.match(src, /export function RegisterHeroGemUsage\(ctx, actorUID, gemColor, consumedCount = 0\)/);
    assert.match(src, /const identity = resolveHeroSkillPointIdentity\(ctx, hero\);/);
    assert.match(src, /record\.totals\[colorKey\] = Number\(record\.totals\[colorKey\] \|\| 0\) \+ increment;/);
    assert.match(src, /usage\.party\[colorKey\] = Number\(usage\.party\[colorKey\] \|\| 0\) \+ increment;/);
    assert.match(src, /touchHeroGemProgressDirty\(ctx\);/);
    assert.match(src, /export function GetHeroGemProgressSnapshot\(ctx\)/);
    assert.match(src, /export function LoadHeroGemProgressSnapshot\(ctx, snapshot = null\)/);
    assert.match(src, /export function ConfigureHeroGemMilestoneThresholds\(ctx, thresholds = \[\]\)/);
    assert.match(src, /export function GetHeroGemMilestones\(ctx\)/);
    assert.match(src, /RegisterHeroGemUsage\(ctx, actorUID, gemColor, consumedCount\);/);
  });
}
