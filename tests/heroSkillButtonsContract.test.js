const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hero layout exports skill control hit zones and pointer handler invokes upgrade/downgrade actions', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /const visibleSkillCount = Math\.max\(/);
  assert.match(src, /const visibleSkillCards = skillCards\.slice\(0, visibleSkillCount\);/);
  assert.match(src, /skillNodes: skillNodeHitZones,/);
  assert.match(src, /gameState\.heroScreen\.hitZones = \{/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'AttemptHeroSkillUpgrade', selectedHero\.uid, activeNode\.skillKey, 'hero_screen_upgrade_button'\)/);
  assert.doesNotMatch(src, /AttemptHeroSkillDowngrade/);
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

test('pending mapped skills are blocked in both backend progress stores', () => {
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');

  assert.match(runtimeSrc, /isPendingRunaSlot = key === 'runa' && i === 7/);
  assert.match(runtimeSrc, /reason: 'pending_mapping'/);
  assert.match(runtimeSrc, /if \(Boolean\(def\.pending\)\)/);

  assert.match(scriptsSrc, /isPendingRunaSlot = key === 'runa' && i === 7/);
  assert.match(scriptsSrc, /reason: 'pending_mapping'/);
  assert.match(scriptsSrc, /if \(Boolean\(def\.pending\)\)/);
});

test('hero skill ramp is 15 levels with fixed ORKA-cpy8 unit-scale cost ladder in both banks', () => {
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');
  const rampRegex = /const HERO_SKILL_COST_RAMP = Object\.freeze\(\[1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8\]\);/;

  assert.match(runtimeSrc, rampRegex);
  assert.match(runtimeSrc, /maxRank: isPendingRunaSlot \? 0 : HERO_SKILL_COST_RAMP\.length,/);
  assert.match(runtimeSrc, /costs: isPendingRunaSlot \? \[\] : HERO_SKILL_COST_RAMP\.slice\(\),/);

  assert.match(scriptsSrc, rampRegex);
  assert.match(scriptsSrc, /maxRank: isPendingRunaSlot \? 0 : HERO_SKILL_COST_RAMP\.length,/);
  assert.match(scriptsSrc, /costs: isPendingRunaSlot \? \[\] : HERO_SKILL_COST_RAMP\.slice\(\),/);
});

test('hero skill controls bind to card skill key instead of raw index fallback', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /const liveBySlot = new Map\(\);/);
  assert.match(src, /liveBySlot\.set\(skill\.slot, skill\)/);
  assert.match(src, /skillKey: String\(cardData\.key \|\| `skill\$\{idx \+ 1\}`\),/);
});

test('hero layout hides plus/minus icons and disables both controls at max rank while keeping control hit zones', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /const isAtMaxRank = actionable/);
  assert.match(src, /const controlsActive = actionable && !isAtMaxRank;/);
  assert.match(src, /actionable: controlsActive,/);
  assert.match(src, /hideIconsAtMax: isAtMaxRank,/);
  assert.match(src, /if \(!isAtMaxRank && minusIconImage\)/);
  assert.match(src, /if \(!isAtMaxRank && plusIconImage\)/);
});

test('hero screen stat glyphs are literal emoji and the diamond node is anchored from its top-left corner', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /const statIcons = \['❤️', '👊', '🛡️', '💫', '🧿'\];/);
  assert.match(src, /frameFill: '#D9D9D9',/);
  assert.match(src, /frameStroke: '#FFFFFF',/);
  assert.match(src, /frameStrokeWidth: 1,/);
  assert.match(src, /frameRadius: 8,/);
  assert.match(src, /const isDiamond = nodeItem\.kind === 'diamond';/);
  assert.match(src, /const side = Math\.min\(rect\.w, rect\.h\);/);
  assert.match(src, /const rect = \{\s*x: sx\(nodeItem\.x\),\s*y: sy\(nodeItem\.y\),\s*w: size,\s*h: size,\s*\};/s);
  assert.match(src, /levelBacker: \{ x: 132, y: 379, w: 18, h: 18, label: 'N' \}/);
  assert.match(src, /levelBacker: \{ x: 190, y: 379, w: 18, h: 18, label: 'N' \}/);
  assert.match(src, /levelBacker: \{ x: 251, y: 379, w: 18, h: 18, label: 'N' \}/);
  assert.match(src, /levelLabel: \{ x: 137, y: 383 \}/);
  assert.match(src, /levelLabel: \{ x: 195, y: 383 \}/);
  assert.match(src, /levelLabel: \{ x: 256, y: 383 \}/);
  assert.match(src, /x: 222\.5,/);
  assert.match(src, /y: 355\.615,/);
  assert.match(src, /\.\.\.nodeItem,\s*shape: isDiamond \? 'diamond' : 'circle',/s);
  assert.match(src, /const nodeBadgeOverlays = \[\];/);
  assert.match(src, /nodeBadgeOverlays\.push\(\{/);
  assert.match(src, /for \(const overlay of nodeBadgeOverlays\) \{/);
  assert.match(src, /const backerRect = mapRect\(backer\);/);
  assert.match(src, /ctx\.arc\(\s*backerRect\.x \+ \(backerRect\.w \/ 2\),\s*backerRect\.y \+ \(backerRect\.h \/ 2\),\s*Math\.min\(backerRect\.w, backerRect\.h\) \/ 2,\s*0,\s*Math\.PI \* 2,\s*\);/s);
  assert.match(src, /const labelX = Number\(backerRect\.x \+ \(backerRect\.w \/ 2\)\);/);
  assert.match(src, /const labelY = Number\(backerRect\.y \+ \(backerRect\.h \/ 2\)\);/);
  assert.doesNotMatch(src, /badge: 'N'/);
});

test('hero skill modal opens from skill taps and reuses the selected skill frame variant without inventing descriptions', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /skillModalOpen: false,/);
  assert.match(src, /skillModalSkillIndex: 0,/);
  assert.match(src, /const modalSpec = heroLayoutSpec\.heroSkillModal;/);
  assert.match(src, /renderHeroSkillModal\(\{/);
  assert.match(src, /gameState\.heroScreen\.skillModalOpen = true;/);
  assert.match(src, /gameState\.heroScreen\.skillModalSkillIndex = Math\.max\(0, Math\.floor\(Number\(node\.idx \|\| 0\)\)\);/);
  assert.match(src, /const modalZones = zones\.modal \|\| null;/);
  assert.match(src, /if \(gameState\.heroScreen\.skillModalOpen && modalZones\) \{/);
  assert.match(src, /if \(isPointInRect\(mx, my, modalZones\.close\) \|\| !isPointInRect\(mx, my, modalZones\.card\)\) \{/);
  assert.match(src, /drawHeroSkillNode\(ctx, iconRect, \{ \.\.\.selectedNode, shape: String\(selectedNode\.kind \|\| selectedNode\.shape \|\| 'circle'\) \}, false, ss, sf, heroSkillSpriteSheetImage\);/);
  assert.match(src, /const skillDescription = String\(selectedCard\.description \|\| selectedNode\.description \|\| ''\)\.trim\(\);/);
  assert.match(src, /const summaryWords = skillDescription\.split\(\/\\s\+\/\)\.filter\(Boolean\);/);
  assert.match(src, /ctx\.textBaseline = 'top';/);
  assert.doesNotMatch(src, /fillText\('UPGRADE LADDER'/);
  assert.match(src, /fillText\('UPGRADES'/);
  assert.match(src, /fillText\('Upgrade'/);
});

test('hero skill card builder carries a description field through to the modal card data', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /const beadDescription = String\(source\.description \|\| \(live && live\.beadDescription\) \|\| fallback\.beadDescription \|\| ''\);/);
  assert.match(src, /description: beadDescription,/);
});
