const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const statePath = path.join(__dirname, '..', 'web-runner', 'modules', 'state.js');
const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const indexPath = path.join(__dirname, '..', 'web-runner', 'index.html');
const renderOverlayPath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderSkillDraughtOverlay.js');
const devToolingRuntimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js');
const pointerRoutingPath = path.join(__dirname, '..', 'web-runner', 'systems', 'pointerRoutingShell.js');

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

function loadRenderHudModule() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderHUD.js'), 'utf8');
  const transformed = `${src.replace(/export function /g, 'function ')}
module.exports = {
  formatGrowDebugText,
};`;
  const sandbox = {
    module: { exports: {} },
    exports: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(transformed, sandbox);
  return sandbox.module.exports;
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
  assert.match(resolveSrc, /QueueSkillDraughtForHero\(ctx, actorUID\);/);
  assert.doesNotMatch(resolveSrc, /OpenSkillDraughtForHero\(ctx, actorUID\);/);
  assert.match(resolveSrc, /if \(Number\(decision\.blueOpenDraught \|\| 0\) === 1\) \{/);
  const shouldResetSrc = extractFunctionSource(runtimeSrc, 'shouldResetAstralFlowAmpOnHeroTurn');
  assert.match(shouldResetSrc, /if \(Number\(g\.SkillDraughtOpen \|\| 0\)\) return false;/);
});

test('app claims pending skill draw only at the hero end-of-turn checkpoint', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  assert.match(appSrc, /function canClaimPendingSkillDraught\(/);
  assert.match(appSrc, /currentTurnType === 0/);
  assert.match(appSrc, /pendingBarrier\.canClaimSkillDraught/);
  assert.doesNotMatch(appSrc, /pendingHeroUID > 0 && pendingHeroUID !== currentUID/);
  assert.match(appSrc, /callFunctionWithContext\(fnContext, 'ClaimPendingSkillDraught'\);/);
  const claimIndex = appSrc.indexOf('const pendingSkillDraughtClaimed = claimPendingSkillDraughtAtHeroCheckpoint');
  const refillReadyIndex = appSrc.indexOf('const refillReady =');
  assert.ok(claimIndex > -1, 'pending skill draw should claim inside the tick loop');
  assert.ok(refillReadyIndex > -1, 'refill gate should still exist');
  assert.ok(claimIndex < refillReadyIndex, 'pending skill draw must claim before refill can start');
  assert.match(appSrc, /!pendingSkillDraughtClaimed &&[\s\S]*refillStartBarrier\.canStartRefill/);
});

test('dev panel wires mandatory draw controls', () => {
  const devToolingSrc = fs.readFileSync(devToolingRuntimePath, 'utf8');
  assert.match(devToolingSrc, /data-devtool-skill-hero/);
  assert.match(devToolingSrc, /data-devtool-skill-id/);
  assert.match(devToolingSrc, /data-devtool-force-skill-draught/);
  assert.match(devToolingSrc, /data-devtool-clear-session-skills/);
  assert.match(devToolingSrc, /ForceAstralFlowSkillDraught/);
  assert.match(devToolingSrc, /ClearSessionSkillDraught/);
  assert.match(devToolingSrc, /getSkillDraughtDevSummary/);
});

test('dev panel 2 output appends skill draw debug counters', () => {
  const hudSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderHUD.js'), 'utf8');
  assert.match(hudSrc, /function formatSkillDrawDebugText\(stateGlobals\)/);
  assert.match(hudSrc, /SkillDrawCalls\.party_crimson_ward/);
  assert.match(hudSrc, /SkillDrawCalls\.party_magic_fruit/);
  assert.match(hudSrc, /SkillDrawCalls\.party_destiny/);
  assert.match(hudSrc, /SkillDrawCalls\.party_faze/);
  assert.match(hudSrc, /SkillDrawCalls\.party_grow/);
  assert.match(hudSrc, /SkillDrawCalls\.party_drain/);
  assert.match(hudSrc, /SkillDrawUnexpectedCalls/);
  assert.match(hudSrc, /const growDebugLines = formatGrowDebugText\(\{/);
  assert.match(hudSrc, /\.\.\.growDebugLines,/);
  assert.match(hudSrc, /formatSkillDrawDebugText\(g\)\)\.join\('\\n'\);/);

  const appSrc = fs.readFileSync(appPath, 'utf8');
  assert.match(appSrc, /renderHUD\.withSkillDrawDebugText\(gameState\.baseSummary \+ '\\n\\nLoading images\.\.\.', state\.globals\)/);
  assert.match(appSrc, /renderHUD\.withSkillDrawDebugText\(`🎮 Puzzle RPG\\n\\n✓ Game loaded\\n\$\{rendered\.length\} total objects loaded`, state\.globals\)/);
});

test('dev panel 2 output exposes Grow base and effective hero values', async () => {
  const hudPath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderHUD.js');
  const hud = loadRenderHudModule();
  assert.equal(typeof hud.formatGrowDebugText, 'function');

  const heroes = [
    {
      kind: 'hero',
      uid: 100,
      name: 'Falie',
      attackType: 'melee',
      heroDisplaySlot: 0,
      hp: 92,
      maxHP: 92,
      stats: { ATK: 100, MAG: 20 },
    },
    {
      kind: 'hero',
      uid: 101,
      name: 'Runa',
      attackType: 'magic',
      heroDisplaySlot: 1,
      hp: 110,
      maxHP: 110,
      stats: { ATK: 15, MAG: 125 },
    },
    { kind: 'enemy', uid: 201, name: 'Ignored' },
  ];
  const text = hud.formatGrowDebugText({
    stateEntities: heroes,
    callFunctionWithContext: (_ctx, name, actorUID) => {
      if (name === 'GetGrowSkillState') {
        return {
          tier: 1,
          heroes: {
            100: {
              currentTier: 1,
              powerAmpPct: 8,
              powerAmpMultiplier: 1.08,
              maxHpPenaltyPct: 8,
              baseMaxHP: 100,
              maxHP: 92,
            },
            101: {
              currentTier: 1,
              powerAmpPct: 8,
              powerAmpMultiplier: 1.08,
              maxHpPenaltyPct: 8,
              baseMaxHP: 120,
              maxHP: 110,
            },
          },
        };
      }
      if (name === 'GetPowerAmpMultiplierForActor') return actorUID === 100 || actorUID === 101 ? 1.08 : 0;
      return 0;
    },
    fnContext: {},
  });

  assert.match(text, /Grow Debug/);
  assert.match(text, /Party Tier: T1/);
  assert.match(text, /Falie/);
  assert.match(text, /Grow \[T1\]/);
  assert.match(text, /Power: ATK \[100 \/ 108\] \(\+8%\)/);
  assert.match(text, /HP \[100 \/ 92\] \(-8%\)/);
  assert.match(text, /Runa/);
  assert.match(text, /Power: MAG \[125 \/ 135\] \(\+8%\)/);
  assert.match(text, /HP \[120 \/ 110\] \(-8%\)/);

  const hudSrc = fs.readFileSync(hudPath, 'utf8');
  assert.match(hudSrc, /formatGrowDebugText\(\{/);
  assert.match(hudSrc, /GetGrowSkillState/);
  assert.match(hudSrc, /GetPowerAmpMultiplierForActor/);
  assert.match(hudSrc, /const growDebugLines = formatGrowDebugText\(\{/);
  assert.match(hudSrc, /\.\.\.growDebugLines,/);
});

test('dev panel 2 mirrors dev panel pause while open', () => {
  const indexSrc = fs.readFileSync(indexPath, 'utf8');
  assert.match(indexSrc, /new CustomEvent\('orka:dev2-diagnostics-open-change'/);
  assert.match(indexSrc, /detail: \{ open \}/);

  const devToolingSrc = fs.readFileSync(devToolingRuntimePath, 'utf8');
  assert.match(devToolingSrc, /function isDev2DiagnosticsOpen\(\)/);
  assert.match(devToolingSrc, /window\.addEventListener\('orka:dev2-diagnostics-open-change'/);
  assert.match(devToolingSrc, /if \(open\) \{\s*pauseGameplayForDevTooling\(\);/s);
  assert.match(devToolingSrc, /if \(isDev2DiagnosticsOpen\(\)\) \{\s*state\.globals\.DevToolingPaused = 1;/s);
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
  const pointerSrc = fs.readFileSync(pointerRoutingPath, 'utf8');
  const renderSrc = fs.readFileSync(renderOverlayPath, 'utf8');
  assert.match(appSrc, /renderSkillDraughtOverlay/);
  assert.match(appSrc, /renderSkillDraught\.renderSkillDraughtOverlay/);
  assert.match(pointerSrc, /const logicalW = canvas\.width \/ Math\.max\(1, dpr \|\| 1\);/);
  assert.match(pointerSrc, /const scaleX = rect\.width > 0 \? logicalW \/ rect\.width : 1;/);
  assert.match(pointerSrc, /const hit = zones\.find\(\(zone\) => isPointInRect\(mx, my, zone\)\);/);
  assert.match(renderSrc, /rgba\(0, 0, 0, 0\.58\)/);
  assert.match(renderSrc, /Choose a Skill/);
  assert.match(renderSrc, /SkillDraughtHitZones/);
  assert.match(renderSrc, /candidates\.slice\(0, 3\)/);
  assert.doesNotMatch(appSrc, /Explosive Swords|Warrior's Might|Attack Magnifier/);
  assert.doesNotMatch(renderSrc, /Explosive Swords|Warrior's Might|Attack Magnifier/);
});
