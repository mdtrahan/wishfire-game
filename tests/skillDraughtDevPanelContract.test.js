const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const statePath = path.join(__dirname, '..', 'web-runner', 'modules', 'state.js');
const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const renderOverlayPath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderSkillDraughtOverlay.js');

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const exportedMarker = `export function ${name}(`;
  let start = src.indexOf(exportedMarker);
  if (start === -1) start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('skill draw state is session-only and resettable', () => {
  const stateSrc = fs.readFileSync(statePath, 'utf8');
  assert.match(stateSrc, /SkillDraughtOpen: 0,/);
  assert.match(stateSrc, /SkillDraughtCandidates: \[\],/);
  assert.match(stateSrc, /SessionSkillsByHeroUID: \{\},/);
  assert.doesNotMatch(stateSrc, /PermanentSkillsByHeroUID/);
});

test('runtime exposes draw open/select/clear helpers for one skill test path', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');
  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /export function OpenSkillDraughtForHero\(ctx, heroUID, forcedSkillId = ''\)/);
    assert.match(src, /export function SelectSkillDraughtCard\(ctx, candidateIndex = 0\)/);
    assert.match(src, /export function ClearSessionSkillDraught\(ctx\)/);
    assert.match(src, /export function ForceAstralFlowSkillDraught\(ctx, heroUID, forcedSkillId = ''\)/);
    assert.match(src, /SessionSkillsByHeroUID/);
    assert.match(src, /g\.AstralFlowAmpPoints = 0;/);
    assert.match(src, /g\.AstralFlowAmpReady = 0;/);
  }
});

test('blue meter full opens draw once instead of resetting on hero turn', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const resolveSrc = extractFunctionSource(runtimeSrc, 'ResolveGemAction');
  assert.match(resolveSrc, /resolveGemActionCompat/);
  assert.match(resolveSrc, /__ORKA_GEM_ACTION_OWNER__/);
  assert.match(resolveSrc, /OpenSkillDraughtForHero\(ctx, actorUID\);/);
  assert.match(resolveSrc, /if \(Number\(decision\.blueOpenDraught \|\| 0\) === 1\) \{/);
  const shouldResetSrc = extractFunctionSource(runtimeSrc, 'shouldResetAstralFlowAmpOnHeroTurn');
  assert.match(shouldResetSrc, /if \(Number\(g\.SkillDraughtOpen \|\| 0\)\) return false;/);
});

test('dev panel wires mandatory draw controls', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  assert.match(appSrc, /data-devtool-skill-hero/);
  assert.match(appSrc, /data-devtool-skill-id/);
  assert.match(appSrc, /data-devtool-force-skill-draught/);
  assert.match(appSrc, /data-devtool-clear-session-skills/);
  assert.match(appSrc, /ForceAstralFlowSkillDraught/);
  assert.match(appSrc, /ClearSessionSkillDraught/);
  assert.match(appSrc, /getSkillDraughtDevSummary/);
});

test('dev panel 2 output appends skill draw debug counters', () => {
  const hudSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderHUD.js'), 'utf8');
  assert.match(hudSrc, /function formatSkillDrawDebugText\(stateGlobals\)/);
  assert.match(hudSrc, /SkillDrawCalls\.party_crimson_ward/);
  assert.match(hudSrc, /SkillDrawCalls\.party_magic_fruit/);
  assert.match(hudSrc, /SkillDrawCalls\.party_destiny/);
  assert.match(hudSrc, /SkillDrawUnexpectedCalls/);
  assert.match(hudSrc, /out\.textContent = lines\.concat\(formatSkillDrawDebugText\(g\)\)\.join\('\\n'\);/);

  const appSrc = fs.readFileSync(appPath, 'utf8');
  assert.match(appSrc, /renderHUD\.withSkillDrawDebugText\(gameState\.baseSummary \+ '\\n\\nLoading images\.\.\.', state\.globals\)/);
  assert.match(appSrc, /renderHUD\.withSkillDrawDebugText\(`🎮 Puzzle RPG\\n\\n✓ Game loaded\\n\$\{rendered\.length\} total objects loaded`, state\.globals\)/);
});

test('fresh combat session clears selected session skills without touching progression', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const initSrc = extractFunctionSource(appSrc, 'initEntities');
  assert.match(initSrc, /state\.globals\.CombatSessionId = Number\(state\.globals\.CombatSessionId \|\| 0\) \+ 1;/);
  assert.match(initSrc, /callFunctionWithContext\(fnContext, 'ClearSessionSkillDraught'\);/);
  assert.doesNotMatch(initSrc, /HeroSkillProgressByHeroId = \{\}/);
  assert.doesNotMatch(initSrc, /HeroSkillPointsByHeroId = \{\}/);
});

test('draw render uses dimmed combat background and exactly three horizontal cards', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const renderSrc = fs.readFileSync(renderOverlayPath, 'utf8');
  assert.match(appSrc, /renderSkillDraughtOverlay/);
  assert.match(appSrc, /renderSkillDraught\.renderSkillDraughtOverlay/);
  assert.match(appSrc, /const logicalW = canvas\.width \/ Math\.max\(1, dpr \|\| 1\);/);
  assert.match(appSrc, /const scaleX = rect\.width > 0 \? logicalW \/ rect\.width : 1;/);
  assert.match(appSrc, /const mx = \(ev\.clientX - rect\.left\) \* scaleX;/);
  assert.match(renderSrc, /rgba\(0, 0, 0, 0\.58\)/);
  assert.match(renderSrc, /Choose a Skill/);
  assert.match(renderSrc, /SkillDraughtHitZones/);
  assert.match(renderSrc, /candidates\.slice\(0, 3\)/);
  assert.doesNotMatch(appSrc, /Explosive Swords|Warrior's Might|Attack Magnifier/);
  assert.doesNotMatch(renderSrc, /Explosive Swords|Warrior's Might|Attack Magnifier/);
});
