import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { advanceBattleStartSimulation, advanceEnemyActionSimulation, advanceHeroActionSimulation, advanceBuffSequenceSimulation, advanceGemMergeFxSimulation, advanceRefillBounceSimulation, advanceYellowCasinoSimulation, createCombatSimulationTicker, hasContinuousOrdinaryHeroKO, processPendingHeroHits, shouldFreezeCombatSimulation } from '../web-runner/systems/combatSimulationTick.mjs';

const rendererSource = fs.readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');
const boardRendererSource = fs.readFileSync(new URL('../web-runner/systems/renderBoard.js', import.meta.url), 'utf8');

test('combat loop advances simulation before the stage scheduler', () => {
  const body = appSource.slice(appSource.indexOf('function tick(){', appSource.indexOf('let frameCount = 0;')));
  const simAt = body.indexOf('combatSimulationTicker.tick(');
  const stageAt = body.indexOf('maybeAdvanceContinuousCombatStage(');
  assert.ok(simAt >= 0 && stageAt > simAt);
});

test('continuous ordinary combat halts queued hits and enemy actions at the first hero KO', () => {
  const heroes = [{ uid: 1, kind: 'hero', hp: 1, maxHP: 20, isAlive: true }];
  const action = (uid, targetUID) => ({ uid, active: true, state: 'LUNGE', timer: 0.09, forwardX: 100, anticipationX: 90, targetUID, skillId: 'Enemy_ATK_Single', cooldownSeconds: 1 });
  const state = { entities: [...heroes, { uid: 10, kind: 'enemy', hp: 5 }, { uid: 11, kind: 'enemy', hp: 5 }], globals: {
    ContinuousCombatStageLoop: 1, ContinuousCombatStage: { bossActive: false }, time: 2,
    RealtimeEnemyActionsByUID: { 10: action(10, 1), 11: action(11, 1) }, RealtimeEnemyActionReadyAt: {},
  }};
  const hits = [];
  const call = (_ctx, name, ...args) => {
    if (name === 'ResolveEnemyActionTarget') return heroes[0];
    if (name === 'ApplyEnemySkill') { hits.push(args[0]); heroes[0].hp = 0; heroes[0].isAlive = false; }
  };
  advanceEnemyActionSimulation({ state, gameState: {}, dt: 0.02, layoutW: 360, animationMath: {
    LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.1, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.1,
    easeLungeForward: value => value,
  }, fnContext: {}, callFunctionWithContext: call, applyTurnGateGlobals() {}, applyTurnGateIntent() {}, createEnemyTurnIdleRecovery() {}, queueCombatAttackImpactVfx() {} });
  assert.deepEqual(hits, [10]);
  assert.equal(hasContinuousOrdinaryHeroKO(state), true);
  assert.equal(state.globals.RealtimeEnemyActionsByUID[11].state, 'LUNGE');

  const queued = { hit: true };
  state.globals.PendingHeroHits = [queued];
  processPendingHeroHits({ state, fnContext: {}, callFunctionWithContext: call, animationMath: {} });
  assert.deepEqual(state.globals.PendingHeroHits, [queued], 'the next tick leaves stale projectiles for recovery to clear');
});

test('an active boss remains outside the ordinary any-KO recovery rule', () => {
  assert.equal(hasContinuousOrdinaryHeroKO({ globals: { ContinuousCombatStageLoop: 1, ContinuousCombatStage: { bossActive: true } }, entities: [{ kind: 'hero', hp: 0 }] }), false);
});

test('recovery reveal advances the combat clock while holding movement, clips and queued hits for 350 ms', () => {
  const hero = { uid: 1, kind: 'hero', hp: 20, maxHP: 20, x: 120, footX: 120, y: 270, footY: 270, locomotion: 'idle', recoveryFadeStartedAt: 4 };
  const enemyAction = { uid: 9, active: true, state: 'LUNGE', timer: 0.1 };
  const staleHit = { targetUID: 1, at: 0, sourceUID: 9 };
  const state = { entities: [hero], globals: { time: 4, ContinuousCombatStageLoop: 1, ContinuousCombatStage: { bossActive: false }, PendingHeroHits: [staleHit], RealtimeEnemyActionsByUID: { 9: enemyAction } } };
  const calls = [];
  const ticker = createCombatSimulationTicker();
  ticker.tick({ state, gameState: {}, nowMs: 100, fnContext: {}, callFunctionWithContext: (...args) => calls.push(args) });
  ticker.tick({ state, gameState: {}, nowMs: 150, fnContext: {}, callFunctionWithContext: (...args) => calls.push(args) });
  ticker.tick({ state, gameState: {}, nowMs: 200, fnContext: {}, callFunctionWithContext: (...args) => calls.push(args) });
  assert.ok(state.globals.time > 4, 'active combat time continues through the reveal');
  assert.deepEqual([hero.x, hero.footX, hero.y, hero.footY, hero.locomotion], [120, 120, 270, 270, 'idle']);
  assert.equal(enemyAction.state, 'LUNGE');
  assert.deepEqual(state.globals.PendingHeroHits, [staleHit]);
  assert.deepEqual(calls, []);
});

function effectiveRendererBody(source = rendererSource) {
  const start = source.indexOf('const body = ') + 'const body = '.length;
  const end = source.indexOf(';\n    const effectiveBody = assembleCombatRenderBody(body);', start);
  const rawBody = vm.runInNewContext(source.slice(start, end));
  const helperStart = source.indexOf('export function assembleCombatRenderBody(body) {');
  const helperEnd = source.indexOf('\n}\n\nlet renderImpl', helperStart) + 2;
  const helper = source.slice(helperStart, helperEnd).replace('export function', 'function');
  const assemble = new Function(`${helper}; return assembleCombatRenderBody;`)();
  return assemble(rawBody);
}

function fixture(hit) {
  const target = { uid: 2, kind: 'enemy', hp: 100, maxHP: 100, x: 20, y: 30 };
  const state = { globals: { time: 5, PendingHeroHits: [hit] }, entities: [target] };
  const events = [];
  const fnContext = {};
  const callFunctionWithContext = (_ctx, name, ...args) => {
    events.push([name, ...args]);
    if (name === 'GetActorByUID') return state.entities.find((entity) => entity.uid === args[0]) || null;
    if (name === 'ApplyDamageToTarget') {
      target.hp = Math.max(0, target.hp - Number(args[1] || 0));
      return true;
    }
    if (name === 'QueueEnemyDamageOverTime' || name === 'ResolveNativeCommandStep') return true;
    return true;
  };
  const context = {
    state,
    fnContext,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_IMPACT_HANDOFF_SEC: 0.1 },
    visualControlPatches: {},
    callFunctionWithContext,
    queueCombatAttackImpactVfx: (...args) => events.push(['impactVfx', ...args]),
    events,
  };
  return { state, target, events, context };
}

function runPendingHits(context) {
  processPendingHeroHits({ ...context, queueImpactVfx: (...args) => context.events.push(['impactVfx', ...args]) });
}

test('basic impact applies queued damage and emits impact presentation at its due simulation time', () => {
  const hit = { at: 5, heroUID: 1, targetUID: 2, dmg: 17, finalDmg: 17, effectType: 'damage', attackVfxKind: 'melee_crescent' };
  const { state, target, events, context } = fixture(hit);
  runPendingHits(context);
  assert.equal(target.hp, 83);
  assert.ok(events.some(([name]) => name === 'ApplyDamageToTarget'));
  assert.ok(events.some(([name]) => name === 'impactVfx'));
  assert.equal(state.globals.PendingHeroHits, undefined);
});

test('paused combat ticker leaves state untouched and resumes without wall-time catch-up', () => {
  const ticker = createCombatSimulationTicker();
  const pendingHit = { at: 0, targetUID: 2 };
  const heroAction = { uid: 1, active: true, state: 'ADVANCE', timer: 0.4 };
  const enemyAction = { uid: 2, active: true, state: 'ADVANCE', timer: 0.6 };
  const state = { globals: { time: 12, DevToolingPaused: 1, ContinuousCombatStageLoop: 1, BattleStartActive: 0, PendingHeroHits: [pendingHit], HeroAction: heroAction, RealtimeEnemyActionsByUID: { 2: enemyAction } }, entities: [] };
  const gameState = { storyEntry: { phase: 'combat' } };
  assert.equal(shouldFreezeCombatSimulation(state, gameState), true);
  assert.equal(ticker.tick({ state, gameState, nowMs: 100, runCombatStep: () => assert.fail('paused turn dispatch') }), 0);
  assert.equal(state.globals.time, 12);
  assert.equal(state.globals.PendingHeroHits[0], pendingHit);
  assert.equal(heroAction.timer, 0.4);
  assert.equal(enemyAction.timer, 0.6);

  delete state.globals.PendingHeroHits;
  delete state.globals.HeroAction;
  delete state.globals.RealtimeEnemyActionsByUID;
  state.globals.DevToolingPaused = 0;
  const firstResumedDt = ticker.tick({ state, gameState, nowMs: 60_000 });
  assert.equal(firstResumedDt, 0.001);
  assert.equal(state.globals.time, 12.001);
});

test('boss entry wipe freezes combat scheduling without mutating the user orientation preference', () => {
  const originalNow = Date.now;
  try {
    Date.now = () => 1000;
    const state = { globals: { CombatOrientation: 'right-wise', ContinuousCombatStage: {
      bossActive: true, bossTransitionStartedAtMs: 900, bossTransitionEndsAtMs: 1200,
    } }, entities: [] };
    assert.equal(shouldFreezeCombatSimulation(state), true);
    const body = effectiveRendererBody();
    assert.match(body, /bossPresentationActive[\s\S]*activeCombatOrientation = \(bossPresentationActive \|\| Number\(state\.globals\.ContinuousCombatStageLoop\) === 1\) \? 'left-wise'/);
    assert.match(body, /cameraCenterX = bossPresentationActive[\s\S]*bossCameraCenterX/);
    assert.match(body, /combatRank === 'boss' \? 4/);
    assert.match(body, /bossTransitionEndsAtMs[\s\S]*curtainWidth/);
    Date.now = () => 1201;
    assert.equal(shouldFreezeCombatSimulation(state), false);
    assert.equal(state.globals.CombatOrientation, 'right-wise');
  } finally {
    Date.now = originalNow;
  }
});

test('damage text expires on the simulation clock and stays frozen while paused', () => {
  const ticker = createCombatSimulationTicker();
  const text = { phase: 2, age: 0.4495, fadeSec: 0.45 };
  const state = { globals: { time: 1, DamageTexts: [text], DevToolingPaused: 1 }, entities: [] };
  ticker.tick({ state, nowMs: 0 });
  assert.equal(state.globals.DamageTexts.length, 1);
  state.globals.DevToolingPaused = 0;
  ticker.tick({ state, nowMs: 60_000 });
  assert.equal(state.globals.DamageTexts.length, 0);
  assert.equal(state.globals.TextAnimating, 0);
});

test('DoT impact applies its opening tick and queues the remaining turn ticks', () => {
  const hit = { at: 5, heroUID: 1, targetUID: 2, dotTotalDamage: 8, effectType: 'dot_apply', effectName: 'Blight' };
  const { state, target, events, context } = fixture(hit);
  runPendingHits(context);
  assert.equal(target.hp, 97);
  const dot = events.find(([name]) => name === 'QueueEnemyDamageOverTime');
  assert.ok(dot);
  assert.equal(dot[3], 5);
  assert.equal(state.globals.NextHitFlashTone, 'purple');
  assert.equal(state.globals.NextDamageTextKind, 'dot');
});

test('area native command resolves once and presents every declared impact target', () => {
  const hit = { at: 5, heroUID: 1, targetUID: 2, effectType: 'native_command', attackVfxKind: 'burst', attackVfxTargetUIDs: [2, 3] };
  const { state, events, context } = fixture(hit);
  state.entities.push({ uid: 3, kind: 'enemy', hp: 50, maxHP: 50, x: 40, y: 30 });
  runPendingHits(context);
  assert.equal(events.filter(([name]) => name === 'ResolveNativeCommandStep').length, 1);
  assert.equal(events.filter(([name]) => name === 'impactVfx').length, 2);
  assert.equal(state.globals.PendingHeroHits, undefined);
});

test('simulation ticker holds future impacts until their due time and services concurrent hits together', () => {
  const first = { at: 0.04, heroUID: 1, targetUID: 2, dmg: 7, effectType: 'damage' };
  const second = { at: 0.04, heroUID: 3, targetUID: 2, dmg: 11, effectType: 'damage' };
  const { state, target, events, context } = fixture(first);
  state.globals.time = 0;
  state.globals.PendingHeroHits.push(second);
  const ticker = createCombatSimulationTicker();
  ticker.tick({ ...context, nowMs: 0 });
  assert.equal(target.hp, 100);
  ticker.tick({ ...context, nowMs: 50 });
  assert.equal(target.hp, 82);
  assert.equal(events.filter(([name]) => name === 'ApplyDamageToTarget').length, 2);
});

test('reset after pause or background resumes without applying hidden elapsed time', () => {
  const hit = { at: 0.04, heroUID: 1, targetUID: 2, dmg: 9, effectType: 'damage' };
  const { state, target, events, context } = fixture(hit);
  state.globals.time = 0;
  const ticker = createCombatSimulationTicker();
  ticker.tick({ ...context, nowMs: 0 });
  ticker.reset();
  ticker.tick({ ...context, nowMs: 60_000 });
  assert.equal(target.hp, 100);
  assert.equal(state.globals.time, 0.002);
  ticker.tick({ ...context, nowMs: 60_050 });
  assert.equal(target.hp, 91);
  assert.equal(events.filter(([name]) => name === 'ApplyDamageToTarget').length, 1);
});

test('production retargeting ignores living enemies outside basic attack range', () => {
  const first = { uid: 2, kind: 'enemy', hp: 0, x: 200, streamState: 'in_range' };
  const outOfRange = { uid: 3, kind: 'enemy', hp: 60, x: 500, streamState: 'in_range' };
  const inRange = { uid: 4, kind: 'enemy', hp: 60, x: 100, streamState: 'in_range' };
  const hit = { at: 5, heroUID: 1, targetUID: 2, dmg: 10, effectType: 'damage', retargetOnDeath: true, realtimeBasic: true };
  const { state, events, context } = fixture(hit);
  state.globals.ContinuousCombatStageLoop = 1;
  state.entities = [first, outOfRange, inRange];
  const rangeCheck = (entity) => entity === inRange;
  processPendingHeroHits({ ...context, isHeroBasicTargetInRange: rangeCheck, queueImpactVfx: (...args) => events.push(['impactVfx', ...args]) });
  assert.equal(hit.targetUID, 4);
  assert.equal(hit.at, 5.52);
  assert.equal(inRange.hp, 60);
});

test('renderer no longer owns pending hero hit damage or combat clock advancement', () => {
  const body = effectiveRendererBody();
  assert.doesNotMatch(body, /ApplyDamageToTarget|ApplyEnemySkill|EnemyAction/);
  assert.doesNotMatch(body, /state\.globals\.time \+= dt/);
  assert.doesNotMatch(body, /state\.globals\.HeroAction/);
  assert.doesNotMatch(body, /BattleStartActive[\s\S]{0,500}ProcessTurn/);
  assert.match(fs.readFileSync(new URL('../web-runner/systems/combatSimulationTick.mjs', import.meta.url), 'utf8'), /ApplyEnemySkill/);
});

test('simulation tick owns hero action motion and releases its turn gate after completion', () => {
  const hero = { uid: 1, kind: 'hero', heroIndex: 0, heroDisplaySlot: 0 };
  const action = { uid: 1, active: true, state: 'ADVANCE', timer: 0 };
  const state = { entities: [hero], globals: { time: 1, HeroAction: action, HeroPortraitPosByIndex: [{ x: 30 }], ActionActorUID: 1 } };
  const released = [];
  advanceHeroActionSimulation({
    state,
    gameState: { healBlooms: [] },
    dt: 0.1,
    layoutW: 360,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.2, HERO_LUNGE_FORWARD_DIST_PX: 20, easeLungeForward: (t) => t },
    applyTurnGateGlobals: (patch) => released.push(patch),
  });
  assert.equal(action.state, 'LUNGE');
  assert.equal(action.timer, 0);
  assert.ok(state.globals.HeroLungeOffsetByUID);
  action.state = 'RETREAT';
  action.timer = 0.2;
  advanceHeroActionSimulation({
    state,
    gameState: { healBlooms: [] },
    dt: 0.01,
    layoutW: 360,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.2, HERO_LUNGE_FORWARD_DIST_PX: 20, easeLungeForward: (t) => t },
    applyTurnGateGlobals: (patch) => released.push(patch),
  });
  assert.equal(action.active, false);
  assert.equal(state.globals.HeroLungeOffsetByUID[1], 0);
  assert.equal(released.length, 1);
  assert.deepEqual(released[0], { IsPlayerBusy: 0, ActionInProgress: 0, ActionActorUID: 0 });
});

test('combat ticker advances HeroAction while rendering has no action-state references', () => {
  const hero = { uid: 1, kind: 'hero', heroIndex: 0, heroDisplaySlot: 0 };
  const action = { uid: 1, active: true, state: 'ADVANCE', timer: 0 };
  const state = { entities: [hero], globals: { time: 0, HeroAction: action, HeroPortraitPosByIndex: [{ x: 30 }] } };
  const ticker = createCombatSimulationTicker();
  const animationMath = { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.2, HERO_LUNGE_FORWARD_DIST_PX: 20, easeLungeForward: (t) => t };
  ticker.tick({
    state,
    gameState: { healBlooms: [] },
    nowMs: 0,
    fnContext: {},
    callFunctionWithContext: () => null,
    animationMath,
    layoutW: 360,
    applyTurnGateGlobals: () => {},
    applyTurnGateIntent: () => {},
    createEnemyTurnIdleRecovery: () => ({}),
  });
  assert.equal(action.timer, 0.001);
  assert.doesNotMatch(effectiveRendererBody(), /state\.globals\.HeroAction/);
});

test('hero action waits for portrait coordinates published by the render layout', () => {
  const hero = { uid: 1, kind: 'hero', heroIndex: 0, heroDisplaySlot: 0 };
  const action = { uid: 1, active: true, state: 'ADVANCE', timer: 0 };
  const state = { entities: [hero], globals: { time: 1, HeroAction: action } };
  let releases = 0;
  const input = {
    state,
    gameState: { healBlooms: [] },
    dt: 0.05,
    layoutW: 360,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.2, HERO_LUNGE_FORWARD_DIST_PX: 20, easeLungeForward: (t) => t },
    applyTurnGateGlobals: () => { releases += 1; },
  };
  assert.equal(advanceHeroActionSimulation(input), false);
  assert.equal(action.active, true);
  assert.equal(action.timer, 0);
  assert.equal(releases, 0);
  state.globals.HeroPortraitPosByIndex = [{ x: 30 }];
  assert.equal(advanceHeroActionSimulation(input), true);
  assert.equal(action.timer, 0.05);
  assert.equal(action.active, true);
});

test('simulation tick clears BattleStart and triggers ProcessTurn exactly once after the fade', () => {
  const state = { globals: { time: 2.4, BattleStartActive: 1, BattleStartFadeEndsAt: 2.4, BattleStartProcessStarted: 0, GamePhase: 'RUNTIME' } };
  const calls = [];
  assert.equal(advanceBattleStartSimulation({ state, runCombatStep: (name) => calls.push(name) }), true);
  assert.equal(advanceBattleStartSimulation({ state, runCombatStep: (name) => calls.push(name) }), false);
  assert.equal(state.globals.BattleStartActive, 0);
  assert.equal(state.globals.BattleStartClearedForSession, 1);
  assert.deepEqual(calls, ['ProcessTurn']);
});

test('background main-loop branch returns before rendering and resets both clocks', () => {
  const tickStart = appSource.indexOf('function tick(){', appSource.indexOf('let frameCount = 0;'));
  const hiddenStart = appSource.indexOf('if (document.hidden)', tickStart);
  const defeatStart = appSource.indexOf("if (gameState.storyEntry.phase === 'defeat')", tickStart);
  assert.ok(tickStart >= 0 && hiddenStart > tickStart && defeatStart > hiddenStart);
  assert.match(appSource.slice(hiddenStart, defeatStart), /combatSimulationTicker\.reset\(\)/);
  assert.match(appSource.slice(hiddenStart, defeatStart), /lastFrameTime = performance\.now\(\)/);
  assert.match(appSource.slice(hiddenStart, defeatStart), /requestAnimationFrame\(tick\)/);
  const drawFrameStart = appSource.indexOf('function drawFrame(dtOverride)');
  const drawActiveStart = appSource.indexOf('const activeLayoutId = layoutState.getActiveLayoutId();', drawFrameStart);
  assert.match(appSource.slice(drawFrameStart, drawActiveStart), /if \(document\.hidden\)[\s\S]*return null;/);
});

test('refill completes from simulation time and dispatches its turn handoff once', () => {
  const state = { globals: { time: 1, TurnPhase: 2, GamePhase: 'RUNTIME', BoardFillActive: 1, ActionInProgress: 0 }, entities: [] };
  const gameState = { grid: [[0]], gems: [], nextGemUID: 1, refillBounce: { active: true, index: 0, current: null, queue: [{ cellC: 0, cellR: 0 }], speedScale: 1 } };
  const calls = [];
  const deps = { state, gameState, runCombatStep: (step) => calls.push(step), getCellWorldPos: () => ({ x: 1, y: 2, w: 3, h: 4 }), randomGemFrame: () => 0, setGemArray: (gems) => { state.globals.Gems = gems; }, createEnemyTurnGateBaseline: 'enemy', createRefillCompleteGate: 'hero', applyTurnGateIntent: (intent) => calls.push(intent) };
  advanceRefillBounceSimulation(deps);
  assert.equal(gameState.gems.length, 1);
  state.globals.time = 1.16;
  advanceRefillBounceSimulation(deps);
  assert.equal(gameState.refillBounce.active, false);
  assert.equal(state.globals.BoardFillActive, 0);
  assert.equal(calls.filter((call) => call === 'ProcessTurn').length, 1);
});

test('BlueBuff logical completion waits for a merge clock then finishes without draw calls', () => {
  const state = { globals: { time: 10, TurnPhase: 2, GamePhase: 'RUNTIME', BlueBuffSequenceActive: 1, BuffIconPopType: 1, BuffIconPopAt: 9, ActionInProgress: 0, IsPlayerBusy: 0, goldTotal: 0 } };
  const gameState = { gemMergeFx: { active: true, startAt: 10, duration: 0.5, goldAward: 2, releaseGate: 'yellow' } };
  const calls = [];
  let gates = 0;
  advanceBuffSequenceSimulation({ state, gameState, runCombatStep: (step) => calls.push(step) });
  assert.equal(state.globals.BlueBuffSequenceActive, 1);
  state.globals.time = 10.5;
  advanceGemMergeFxSimulation({ state, gameState, applyTurnGateIntent: (_intent, payload) => { assert.equal(payload, 'yellow'); gates += 1; } });
  assert.equal(gameState.gemMergeFx.active, false);
  assert.equal(state.globals.goldTotal, 2);
  assert.equal(gates, 1);
  advanceBuffSequenceSimulation({ state, gameState, runCombatStep: (step) => calls.push(step) });
  state.globals.time = 11.69;
  advanceBuffSequenceSimulation({ state, gameState, runCombatStep: (step) => calls.push(step) });
  assert.equal(state.globals.BlueBuffSequenceActive, 1);
  state.globals.time = 11.71;
  advanceBuffSequenceSimulation({ state, gameState, runCombatStep: (step) => calls.push(step) });
  advanceBuffSequenceSimulation({ state, gameState, runCombatStep: (step) => calls.push(step) });
  assert.equal(state.globals.BlueBuffSequenceActive, 0);
  assert.equal(calls.filter((call) => call === 'ProcessTurn').length, 1);
  assert.equal(gates, 1);
});

test('continuous BattleStart, refill, and BlueBuff completion cannot dispatch the legacy turn owner', () => {
  const calls = [];
  const state = { globals: { time: 5, ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', TurnPhase: 2, ActionInProgress: 0, IsPlayerBusy: 0, BattleStartActive: 1, BattleStartFadeEndsAt: 0, BoardFillActive: 1, BlueBuffSequenceActive: 1, BuffIconPopType: 1, BuffIconPopAt: 4 }, entities: [] };
  assert.equal(advanceBattleStartSimulation({ state, runCombatStep: step => calls.push(step) }), true);

  const gameState = {
    grid: [[0]], gems: [], nextGemUID: 1,
    refillBounce: { active: true, index: 0, current: null, queue: [] },
  };
  advanceRefillBounceSimulation({
    state, gameState,
    runCombatStep: step => calls.push(step),
    getCellWorldPos: () => ({ x: 0, y: 0, w: 1, h: 1 }), randomGemFrame: () => 0,
    setGemArray() {}, countCellCoverage() {}, recordTask011RefillWriteEvent() {},
    createEnemyTurnGateBaseline: 'enemy', createRefillCompleteGate: 'hero', applyTurnGateIntent() {},
    runtimeDebugLogging: { isGemDebugEnabled: () => false, gemDebugLog() {} },
    assertBoardIntegrity: () => ({ ok: true }), getGemGateSnapshot: () => ({}),
  });
  gameState.buffIconPresentation = { key: '1:4', active: false, phase: 'idle', pending: null, slotType: '' };
  gameState.buffIconSlotsByFrame = {};
  gameState.blueBuffSequenceTimeline = { key: '1:4', startedAt: 3, completed: false };
  state.globals.time = 5;
  advanceBuffSequenceSimulation({ state, gameState, runCombatStep: step => calls.push(step) });
  assert.equal(state.globals.BlueBuffSequenceActive, 0);
  assert.deepEqual(calls, []);
});

test('assembled renderer only reads buff and merge presentation state', () => {
  const body = effectiveRendererBody();
  assert.doesNotThrow(() => new Function('scope', 'dtOverride', `with (scope) {\n${body}\n}`));
  assert.doesNotMatch(body, /BlueBuffSequenceActive|phase = 'waiting'|phase = 'hold'/);
  assert.doesNotMatch(body, /merge\.active = false|merge\.goldAward = 0|refill\.current/);
  assert.doesNotMatch(body, /ProcessTurn/);
});

test('YellowCasino sequence progresses and settles Gold in simulation without draws', () => {
  const gem = { uid: 7, color: 5, elementIndex: 5, x: 10, y: 20 };
  const state = { globals: { time: 1, GamePhase: 'RUNTIME', TurnPhase: 0, BoardFillActive: 1, CanPickGems: 0, IsPlayerBusy: 1, ActionLockUntil: 0 }, entities: [{ uid: 1, kind: 'hero', hp: 10 }] };
  const casino = { active: true, phase: 'spin', queue: [{ type: 'yellow', uid: 7, target: 2, duration: 0.1, cellC: 0, cellR: 0 }], index: 0, current: null, pendingGoldAward: 3, goldMergeSources: [], goldMergeTarget: null };
  const gameState = { yellowCasino: casino, gems: [gem], grid: [[7]], nextGemUID: 8, refillBounce: { active: false } };
  let completionCalls = 0;
  const deps = { state, gameState, runtimeDebugLogging: { gemDebugLog() {}, isGemDebugEnabled() { return false; } }, traceTask015YellowAnimation() {}, traceTask015YellowWrite() {}, getCellWorldPos: () => ({ x: 0, y: 0, w: 20, h: 20 }), countCellCoverage: () => ({}), recordTask011RefillWriteEvent() {}, setGemArray() {}, randomGemFrame: () => 0, YELLOW_CASINO_SETTLE_SEC: 0.16, YELLOW_CASINO_SETTLE_BOUNCE_AMP: 0.2, YELLOW_COLOR: 5, startGemMergeFx() {}, getGoldLabelTargetWorld: () => ({ x: 0, y: 0 }), applyTurnGateIntent: (intent) => { if (intent === 'complete') completionCalls += 1; }, getYellowSequenceCompletionIntent: 'complete', assertBoardIntegrity: () => ({ ok: true }), getGemGateSnapshot: () => ({}) };

  advanceYellowCasinoSimulation(deps);
  assert.equal(gem.color, 2);
  assert.equal(state.globals.goldTotal || 0, 0);
  state.globals.time = 1.1;
  advanceYellowCasinoSimulation(deps);
  assert.equal(casino.current.settleStarted, true);
  state.globals.time = 1.26;
  advanceYellowCasinoSimulation(deps);
  assert.equal(casino.active, false);
  assert.equal(state.globals.BoardFillActive, 0);
  assert.equal(state.globals.goldTotal, 3);
  assert.equal(casino.pendingGoldAward, 0);
  assert.equal(completionCalls, 1);
  advanceYellowCasinoSimulation(deps);
  assert.equal(state.globals.goldTotal, 3);
  assert.equal(completionCalls, 1);

  const body = effectiveRendererBody();
  assert.doesNotMatch(body, /yellowCasino|yellow-sequence|pendingGoldAward/);
  assert.doesNotMatch(body, /BoardFillActive\s*=|goldTotal\s*\+/);
  assert.match(boardRendererSource, /gameState\.yellowCasino && gameState\.yellowCasino\.ghost/);
});

test('YellowCasino stages merge Gold once and releases its gate at the simulation deadline', () => {
  const state = { globals: { time: 3, GamePhase: 'RUNTIME', TurnPhase: 0, BoardFillActive: 1, CanPickGems: 0, IsPlayerBusy: 1, ActionLockUntil: 0, goldTotal: 4 }, entities: [{ uid: 1, kind: 'hero', hp: 10 }] };
  const current = { type: 'yellow', uid: 7, target: 2, duration: 0.1, startAt: 2, settleStarted: true, settleUntil: 3, cellC: 0, cellR: 0 };
  const casino = { active: true, phase: 'spin', queue: [current], index: 0, current, pendingGoldAward: 2, goldMergeSources: [{ x: 1, y: 2, color: 5 }], goldMergeTarget: { x: 8, y: 9 } };
  const gameState = { yellowCasino: casino, gems: [{ uid: 7, color: 5, elementIndex: 5 }], grid: [[7]], nextGemUID: 8, gemMergeFx: null, refillBounce: { active: false } };
  const calls = [];
  const deps = { state, gameState, runtimeDebugLogging: { gemDebugLog() {}, isGemDebugEnabled() { return false; } }, traceTask015YellowAnimation() {}, traceTask015YellowWrite() {}, getCellWorldPos: () => ({ x: 0, y: 0, w: 20, h: 20 }), countCellCoverage: () => ({}), recordTask011RefillWriteEvent() {}, setGemArray() {}, YELLOW_CASINO_SETTLE_SEC: 0.16, YELLOW_CASINO_SETTLE_BOUNCE_AMP: 0.2, YELLOW_COLOR: 5, startGemMergeFx: () => { gameState.gemMergeFx = { active: true, startAt: 3, duration: 0.5, goldAward: 0, releaseGate: null }; }, getGoldLabelTargetWorld: () => ({ x: 0, y: 0 }), applyTurnGateIntent: (intent, payload) => calls.push([intent, payload]), getYellowSequenceCompletionIntent: 'complete', assertBoardIntegrity: () => ({ ok: true }) };

  advanceYellowCasinoSimulation(deps);
  assert.equal(gameState.gemMergeFx.goldAward, 2);
  assert.equal(casino.pendingGoldAward, 0);
  assert.equal(gameState.gemMergeFx.releaseGate && Object.keys(gameState.gemMergeFx.releaseGate).length, 0);
  assert.equal(state.globals.goldTotal, 4);
  assert.equal(calls.length, 0);
  advanceYellowCasinoSimulation(deps);
  assert.equal(gameState.gemMergeFx.goldAward, 2);
  state.globals.time = 3.5;
  advanceGemMergeFxSimulation({ state, gameState, applyTurnGateIntent: (intent, payload) => calls.push([intent, payload]), getYellowSequenceCompletionIntent: 'complete' });
  advanceGemMergeFxSimulation({ state, gameState, applyTurnGateIntent: (intent, payload) => calls.push([intent, payload]), getYellowSequenceCompletionIntent: 'complete' });
  assert.equal(state.globals.goldTotal, 6);
  assert.equal(calls.length, 1);
});
