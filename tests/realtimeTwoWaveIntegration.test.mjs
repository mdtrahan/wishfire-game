import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HERO_DEFINITIONS, heroSkillUnlocked } from '../web-runner/src/core/heroDefinitions.mjs';
import { isHeroBasicTargetInRange, resolveHeroAttackTarget } from '../src/core/heroAttackTargetingRules.mjs';
import { realtimeCooldownSeconds, scheduleRealtimeActions, selectRealtimeReadyActor } from '../web-runner/src/core/realtimeCooldown.mjs';
import { selectRealtimeHeroSkillTarget } from '../web-runner/src/core/realtimeHeroTargeting.mjs';
import { castRealtimeHeroSkill, realtimeBasicInterval, realtimeProvokeTarget, realtimeRetaliation, tickRealtimeHeroSkillZones } from '../web-runner/src/core/realtimeHeroSkills.mjs';
import { pickEnemyTargetHeroFromRoster } from '../web-runner/src/core/enemyTargetingRules.mjs';
import { armContinuousCombatBoss, createContinuousCombatStageState, maybeAdvanceContinuousCombatStage } from '../web-runner/src/core/continuousCombatStage.mjs';
import { advanceEnemyActionSimulation, createCombatSimulationTicker, processPendingHeroHits, shouldFreezeCombatSimulation } from '../web-runner/systems/combatSimulationTick.mjs';
import { recordEnemyDefeatReward, settleContinuousCombatRewards, settleDefeat } from '../web-runner/modules/heroCommands.mjs';
import { createHeroProgressStore, newHeroProgress } from '../web-runner/src/core/heroProgression.mjs';

const bank = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');

function loadBankFunction(signature, nextSignature, args, values) {
  const start = bank.indexOf(signature);
  assert.notEqual(start, -1, `missing production seam ${signature}`);
  const end = bank.indexOf(nextSignature, start);
  assert.ok(end > start, `missing boundary ${nextSignature}`);
  const body = bank.slice(start, end).replace('export function', 'function');
  return new Function(...args, `${body}; return ${signature.slice('export function '.length).split('(')[0]};`)(...values);
}

function makeTickBasics(ctx) {
  return loadBankFunction('export function TickRealtimeHeroBasics(ctx) {', '\nexport function TickRealtimeEnemyActions(', [
    'getGlobals', 'getEnemies', 'resolveHeroAttackTarget', 'isHeroBasicTargetInRange', 'getEntities', 'GetEffectiveStat',
    'realtimeCooldownSeconds', 'selectRealtimeReadyActor', 'scheduleRealtimeActions', 'HeroAttackSingle', 'GetActorByUID',
    'tickRealtimeHeroSkillZones', 'heroDefinition', 'heroSkillUnlocked', 'selectRealtimeHeroSkillTarget', 'castRealtimeHeroSkill',
    'realtimeBasicInterval', 'pushContinuousCombatEnemy', 'reverseContinuousCombatEnemy', 'teleportContinuousCombatEnemy',
  ], [
    c => c.state.globals,
    c => c.state.entities.filter(e => e?.kind === 'enemy' && Number(e.hp) > 0 && e.streamState !== 'approaching'),
    resolveHeroAttackTarget, isHeroBasicTargetInRange, c => c.state.entities,
    (_c, hero, stat) => Number(hero.stats?.[stat] ?? hero[stat] ?? 1),
    realtimeCooldownSeconds, selectRealtimeReadyActor, scheduleRealtimeActions,
    (c, heroUID, targetUID) => (c.state.globals.PendingHeroHits ||= []).push({ at: c.state.globals.time + 0.52, heroUID, targetUID, dmg: 1, finalDmg: 1, heroType: 'melee', combatRulesBasic: 1, realtimeBasic: 1, retargetOnDeath: 1 }),
    (c, uid) => c.state.entities.find(e => Number(e.uid) === Number(uid)) || null,
    tickRealtimeHeroSkillZones, actor => HERO_DEFINITIONS[actor.baseHeroName], heroSkillUnlocked, selectRealtimeHeroSkillTarget,
    castRealtimeHeroSkill, realtimeBasicInterval, () => 0, () => 0, () => 0,
  ]);
}

function productionEnemyTargets(ctx, uid) {
  const enemy = ctx.state.entities.find(actor => actor.kind === 'enemy' && Number(actor.uid) === Number(uid));
  const heroes = ctx.state.entities.filter(actor => actor.kind === 'hero' && actor.hp > 0);
  return realtimeProvokeTarget(ctx, enemy, pickEnemyTargetHeroFromRoster({ enemy, heroes }).target);
}

function makeTickEnemies(ctx, actionEvents) {
  const pick = productionEnemyTargets;
  const createAction = (c, uid, target, options = {}) => {
    const globals = c.state.globals;
    const enemy = c.state.entities.find(actor => Number(actor.uid) === Number(uid));
    const key = String(uid), startedAt = Number(globals.time || 0);
    const action = {
      uid: Number(uid), active: true, state: 'ADVANCE', timer: 0, actionApplied: false,
      targetUID: Number(target?.uid || 0), skillId: 'Enemy_ATK_Single', stationary: enemy?.streamDelivery === 'ranged',
      forwardX: Number(enemy?.originX ?? enemy?.x ?? 0), startedAt,
      cooldownSeconds: Number(options.cooldownSeconds || 0), nextReadyAt: startedAt + Number(options.cooldownSeconds || 0),
    };
    (globals.RealtimeEnemyActionsByUID ||= {})[key] = action;
    (globals.RealtimeEnemyActionReadyAt ||= {})[key] = action.nextReadyAt;
    actionEvents[key] = { actorUID: Number(uid), actionId: action.skillId, dueAt: Number(globals.RealtimeEnemyActionReadyAtBefore?.[key] ?? startedAt),
      castAt: startedAt, impactAt: null, targetUID: action.targetUID, hpBefore: null, hpAfter: null, kind: 'enemy' };
    return action;
  };
  const start = loadBankFunction('export function StartRealtimeEnemyAction(ctx, enemyUID) {', '\nexport function StartEnemyAction(',
    ['getGlobals', 'GetActorByUID', 'pickEnemyTargetHero', 'realtimeCooldownSeconds', 'createEnemyActionState'],
    [c => c.state.globals, (c, uid) => c.state.entities.find(actor => Number(actor.uid) === Number(uid)) || null,
      pick, realtimeCooldownSeconds, createAction]);
  const tick = loadBankFunction('export function TickRealtimeEnemyActions(ctx) {', '\nfunction HeroAttackSplit(',
    ['getGlobals', 'getEntities', 'pickEnemyTargetHero', 'StartRealtimeEnemyAction'],
    [c => c.state.globals, c => c.state.entities, pick, start]);
  const resolveTarget = loadBankFunction('export function ResolveEnemyActionTarget(ctx, enemyUID, preferredTargetUID = 0) {', '\nfunction applyRunaMagicResist(',
    ['getGlobals', 'GetActorByUID', 'pickEnemyTargetHero', 'realtimeProvokeTarget'],
    [c => c.state.globals, (c, uid) => c.state.entities.find(actor => Number(actor.uid) === Number(uid)) || null,
      pick, realtimeProvokeTarget]);
  return (now, dt) => {
    const g = ctx.state.globals;
    g.RealtimeEnemyActionReadyAtBefore = { ...(g.RealtimeEnemyActionReadyAt || {}) };
    tick(ctx);
    advanceEnemyActionSimulation({ state: ctx.state, gameState: { healBlooms: [] }, dt, layoutW: 360,
      animationMath: { LUNGE_ANTICIPATION_SEC: .05, LUNGE_FORWARD_SEC: .1, LUNGE_HOLD_SEC: .05, LUNGE_RETREAT_SEC: .05, LUNGE_FORWARD_DIST_PX: 30, easeLungeForward: t => t },
      fnContext: ctx, callFunctionWithContext: (_ctx, name, ...args) => {
        if (name === 'ResolveEnemyActionTarget') return resolveTarget(ctx, ...args);
        if (name === 'ApplyEnemySkill') {
          const [enemyUID, skillId, targetUID] = args;
          const source = ctx.state.entities.find(actor => Number(actor.uid) === Number(enemyUID));
          const target = ctx.state.entities.find(actor => Number(actor.uid) === Number(targetUID));
          if (!target || target.hp <= 0) return 0;
          const before = target.hp; target.hp = Math.max(0, target.hp - 1);
          const event = actionEvents[String(enemyUID)];
          if (event) Object.assign(event, { actionId: skillId, impactAt: now, targetUID: target.uid, hpBefore: before, hpAfter: target.hp });
          if (source && target.kind === 'hero') {
            const prior = g.CombatImpactRequests.length;
            realtimeRetaliation(ctx, target, source.uid);
            for (const request of g.CombatImpactRequests.slice(prior)) actionEvents[`skill-${request.heroUID}-${request.skillId}-${request.at}`] = {
              actorUID: request.heroUID, actionId: request.skillId, dueAt: request.at, castAt: request.at, impactAt: request.at,
              targetUID: request.targetUID, hpBefore: null, hpAfter: null, kind: 'skill',
            };
          }
          return before - target.hp;
        }
        return 0;
      },
      applyTurnGateGlobals() {}, applyTurnGateIntent() {}, createEnemyTurnIdleRecovery() {},
      combatVfxProfileForActor: enemy => ({ delivery: enemy.streamDelivery === 'ranged' ? 'ranged' : 'melee', impact: 'physical' }),
      queueCombatAttackImpactVfx() {},
    });
  };
}

const makeHero = (uid, key, hp, maxHP) => ({ uid, kind: 'hero', currentLevel:25, heroInstanceKey: `hero-${uid}`, baseHeroName: key, name: key, hp, maxHP, stats: { ...HERO_DEFINITIONS[key].baseStats }, attackType: key === 'Runa' || key === 'Kojonn' ? 'magic' : 'melee', heroDisplaySlot: uid - 1 });
const makeEnemy = (uid, name, x, y, hp = 1_000_000, maxHP = 1_000_000, extra = {}) => ({ uid, kind: 'enemy', name, hp, maxHP, x, y, originX: x, originY: y, streamEngageX: x, streamState: 'engaged', enemyRole: 'fodder', ATK: 1, stats: { ATK: 1, MAG: 2 }, ...extra });

function createTwoWaveFixture() {
  const heroes = [makeHero(1, 'Falie', 54, 100), makeHero(2, 'Huun', 38, 100), makeHero(3, 'Runa', 80, 100), makeHero(4, 'Kojonn', 80, 100)];
  const waveOne = [makeEnemy(20, 'Gobloc', 190, 180, 300_000, 1_000_000), makeEnemy(21, 'Djinn', 205, 195, 1_000_000, 1_000_000, { attackType: 'magic', streamDelivery: 'ranged' })];
  const globals = {
    time: 0, ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', RuntimeRandom: () => 0,
    PendingHeroHits: [], CombatImpactRequests: [], RealtimeSkillEffects: {}, RealtimeSkillZones: [],
    RealtimeHeroBasicReadyAt: {}, RealtimeHeroBasicClocks: {}, RealtimeHeroBasicScheduledActions: {},
    EnemySlots: [20, 21], EnemyDeathVisualHoldByUID: {}, RealtimeEnemyActionReadyAt: {}, RealtimeEnemyActionsByUID: {},
    HeroIconPosByIndex: heroes.map(hero => ({ x: 80, y: 180 + hero.heroDisplaySlot * 35 })),
    HeroPortraitPosByIndex: heroes.map(hero => ({ x: 80, y: 180 + hero.heroDisplaySlot * 35 })),
  };
  const state = { globals, entities: [...heroes, ...waveOne] };
  const ctx = { state, callFunction(name, ...args) {
    if (name === 'CalculateDamage') return Math.max(1, Math.floor(Number(args[3] || 100) / 100));
    if (name === 'ApplyDamageToTarget') {
      const target = state.entities.find(actor => Number(actor.uid) === Number(args[0]));
      if (!target || target.hp <= 0) return 0;
      const before = target.hp; target.hp = Math.max(0, target.hp - Number(args[1] || 0));
      if (target.kind === 'enemy' && before > 0 && target.hp === 0) recordEnemyDefeatReward(globals.ProgressionBattle, target);
      return before - target.hp;
    }
    if (name === 'LogCombat') (globals.CombatLog ||= []).push(String(args[0]));
    return 0;
  } };
  const tickBasics = makeTickBasics(ctx);
  const actionLog = [];
  const enemyEvents = {};
  const tickEnemies = makeTickEnemies(ctx, enemyEvents);
  const skillEventIndex = () => globals.CombatImpactRequests.length;
  return { state, ctx, heroes, waveOne, actionLog, tick(now) {
    globals.time = now;
    const before = skillEventIndex();
    const pendingBefore = new Set(globals.PendingHeroHits || []);
    const clocksBefore = JSON.parse(JSON.stringify(globals.RealtimeHeroBasicClocks));
    const scheduledBefore = JSON.parse(JSON.stringify(globals.RealtimeHeroBasicScheduledActions));
    const hpBeforeTick = new Map(state.entities.map(actor => [Number(actor.uid), Number(actor.hp || 0)]));
    tickBasics(ctx);
    for (const request of globals.CombatImpactRequests.slice(before)) {
      const clock = clocksBefore[String(request.heroUID)] || {};
      const dueAt = scheduledBefore[String(request.heroUID)]?.dueAt
        ?? Number(clock.skillReadyAt?.[request.skillId] ?? now);
      actionLog.push({ actorUID: request.heroUID, actionId: request.skillId, dueAt, castAt: request.at, impactAt: request.at, targetUID: request.targetUID,
        hpBefore: hpBeforeTick.get(Number(request.targetUID)) ?? null,
        hpAfter: state.entities.find(actor => actor.uid === request.targetUID)?.hp ?? null, kind: 'skill' });
    }
    const newHits = (globals.PendingHeroHits || []).filter(hit => !pendingBefore.has(hit));
    for (const hit of newHits) if (hit.realtimeBasic) {
      const clock = clocksBefore[String(hit.heroUID)] || {};
      const dueAt = scheduledBefore[String(hit.heroUID)]?.dueAt ?? Number(clock.basicReadyAt ?? now);
      actionLog.push({ actorUID: hit.heroUID, actionId: 'basic_attack', dueAt, castAt: now, impactAt: hit.at, targetUID: hit.targetUID,
        hpBefore: state.entities.find(actor => actor.uid === hit.targetUID)?.hp ?? null, hpAfter: null, kind: 'basic' });
    }
    for (const event of Object.values(enemyEvents)) if (!actionLog.includes(event)) actionLog.push(event);
    processPendingHeroHits({ state, fnContext: ctx, callFunctionWithContext: (_ctx, name, ...args) => {
      if (name === 'GetActorByUID') return state.entities.find(actor => Number(actor.uid) === Number(args[0])) || null;
      if (name === 'ResolveRealtimeHeroBasicImpact') return resolveBasic(args[0]);
      if (name === 'LogCombat') ctx.callFunction(name, ...args);
      return 0;
    }, animationMath: {}, queueImpactVfx() {}, isHeroBasicTargetInRange });
    function resolveBasic(hit) {
      const target = state.entities.find(actor => Number(actor.uid) === Number(hit.targetUID));
      if (!target || target.hp <= 0) return { resolved: false, damage: 0, targetUID: hit.targetUID };
      const before = target.hp;
      const entry = [...actionLog].reverse().find(event => event.kind === 'basic' && event.actorUID === hit.heroUID && event.targetUID === hit.targetUID && event.impactAt === hit.at);
      if (entry) entry.hpBefore = before;
      target.hp = Math.max(0, target.hp - Number(hit.finalDmg || hit.dmg || 0));
      if (entry) entry.hpAfter = target.hp;
      if (before > 0 && target.hp === 0) recordEnemyDefeatReward(globals.ProgressionBattle, target);
      return { resolved: true, damage: before - target.hp, targetUID: target.uid };
    }
    tickEnemies(now, .05);
    for (const event of Object.values(enemyEvents)) if (!actionLog.includes(event)) actionLog.push(event);
    return actionLog;
  } };
}

test('two-wave fixture records real hero scheduler actions, active skills, basics and impact timing', () => {
  const fixture = createTwoWaveFixture();
  const { state, actionLog } = fixture;
  for (let frame = 0; frame <= 1100; frame += 1) {
    const now = frame * 0.05;
    if (frame === 500) {
      const lateWave = [makeEnemy(22, 'High Gobloc', 220, 180), makeEnemy(23, 'Djinn', 225, 205, 1_000_000, 1_000_000, { attackType: 'magic', streamDelivery: 'ranged' }), makeEnemy(24, 'Skeleton', 230, 190)];
      state.entities.push(...lateWave);
      state.globals.EnemySlots.push(22, 23, 24);
      assert.ok(fixture.waveOne.some(enemy => enemy.hp > 0), 'a wave-one actor survives when wave two arrives');
    }
    if (frame === 600) for (const enemy of fixture.waveOne) enemy.hp = 0;
    fixture.tick(now);
  }
  const observed = new Set(actionLog.filter(event => event.kind === 'skill').map(event => `${state.entities.find(actor => actor.uid === event.actorUID)?.baseHeroName}:${event.actionId}`));
  const expected = Object.entries(HERO_DEFINITIONS).flatMap(([key, definition]) => definition.actives.map(skill => `${key}:${skill.skillId}`));
  assert.deepEqual([...observed].sort(), expected.sort(), 'all twenty approved active skills should cast when the fixture keeps their trigger useful');
  assert.ok(actionLog.filter(event => event.actorUID === 1 && event.actionId === 'retaliation_burst').length >= 2,
    'Fara retaliation recurs on eligible hostile impacts after its cooldown');
  const firstBasicDue = fixture.heroes.map(hero => actionLog.find(event => event.actorUID === hero.uid && event.kind === 'basic')?.dueAt);
  assert.equal(new Set(firstBasicDue).size, fixture.heroes.length, 'each hero keeps an independently phased opening basic clock');
  const meleeEnemyLogs = actionLog.filter(event => event.kind === 'enemy' && event.actorUID === 20);
  const rangedEnemyLogs = actionLog.filter(event => event.kind === 'enemy' && event.actorUID === 21);
  assert.ok(meleeEnemyLogs.length >= 2 && rangedEnemyLogs.length >= 2, 'each enemy has its own repeating action clock');
  for (const event of [...meleeEnemyLogs, ...rangedEnemyLogs]) {
    assert.equal(event.actionId, 'Enemy_ATK_Single');
    assert.ok(event.dueAt <= event.castAt && event.castAt < event.impactAt);
    assert.ok(event.targetUID > 0 && event.hpBefore > event.hpAfter);
  }
  assert.ok(meleeEnemyLogs.some(melee => rangedEnemyLogs.some(ranged => melee.castAt === ranged.castAt)), 'separate enemies may cast concurrently');
  for (const hero of fixture.heroes) {
    const basics = actionLog.filter(event => event.actorUID === hero.uid && event.kind === 'basic');
    assert.ok(basics.length >= 2, `${hero.baseHeroName} basic is not starved by its ready skills`);
    assert.ok(new Set(basics.slice(0, 4).map(event => event.dueAt)).size > 1, `${hero.baseHeroName} advances its own readiness clock`);
  }
  for (const key of Object.keys(HERO_DEFINITIONS)) for (const skill of HERO_DEFINITIONS[key].actives) {
    if (skill.skillId === 'retaliation_burst') continue;
    const repeatCasts = actionLog.filter(event => event.kind === 'skill' && event.actionId === skill.skillId && fixture.heroes.find(hero => hero.uid === event.actorUID)?.baseHeroName === key);
    assert.ok(repeatCasts.length >= 2, `${key} ${skill.skillId} must recur after cooldown while its trigger stays useful`);
  }
  assert.ok(actionLog.some(event => event.actorUID === 4 && event.actionId === 'basic_attack'), 'Kaja continues to use its basic attack');
  assert.ok(actionLog.some(event => event.actorUID === 1 && event.actionId === 'challenge_bolt' && event.castAt > 0), 'useful effects recur after their cooldown');
  assert.ok(actionLog.some(event => event.actorUID === 2 && event.actionId === 'basic_attack' && event.dueAt <= event.castAt && event.impactAt > event.castAt && event.targetUID > 0 && event.hpBefore > event.hpAfter), 'basic packets retain actor, target, due/cast/impact time and HP evidence');
  assert.ok(actionLog.some(event => event.castAt >= 25 && event.targetUID === 22), 'the later wave joins live combat while the earlier wave survives');
});

test('stage and recovery seams keep wave overlap, boss availability, paused clocks and defeat rewards deterministic', () => {
  const stage = createContinuousCombatStageState(17);
  const a = makeEnemy(30, 'Gobloc', 190, 180), b = makeEnemy(31, 'Skeleton', 195, 190);
  const globals = { time: 3, ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', ContinuousCombatStage: { ...stage, nextEmissionAt: 3 },
    EnemyData: ['Gobloc', 'Skeleton', 'High Gobloc', 'Lizardo', 'High Orc', 'Chimerilass', 'Djinn', 'Orc', 'Troll'].map((name, index) => ({ name, ATK: 1 + index, DEF: 1, HP: 100 + index })) };
  const spawned = [];
  const entities = [a, b];
  const spawn = (name, slot) => { const enemy = makeEnemy(slot + 200, name, 220, 180); spawned.push(enemy); entities.push(enemy); return enemy; };
  maybeAdvanceContinuousCombatStage({ globals, entities, call(name, ...args) { if (name === 'SpawnEnemy') return spawn(args[0].name, args[1]); return true; } });
  assert.equal(globals.ContinuousCombatStage.wave, 2);
  assert.ok(entities.includes(a) && entities.includes(b) && spawned.length > 0, 'wave two overlaps surviving wave-one enemies');
  const pendingImpact = { at: 12.5, targetUID: 880 };
  const pausedTarget = { uid: 880, kind: 'enemy', hp: 100, x: 200, y: 180 };
  const pausedState = { globals: { time: 12, DevToolingPaused: 1, PendingHeroHits: [pendingImpact] }, entities: [...entities, pausedTarget] };
  const ticker = createCombatSimulationTicker(), pausedGame = { storyEntry: { phase: 'combat' } };
  assert.equal(shouldFreezeCombatSimulation(pausedState, pausedGame), true);
  assert.equal(ticker.tick({ state: pausedState, gameState: pausedGame, nowMs: 100 }), 0);
  assert.equal(pausedState.globals.time, 12);
  assert.equal(pausedState.globals.PendingHeroHits[0], pendingImpact, 'pending impacts survive pause without being applied');
  assert.equal(shouldFreezeCombatSimulation({ globals: { time: 12 }, entities }, { storyEntry: { phase: 'defeat' } }), true);
  pausedState.globals.DevToolingPaused = 0;
  assert.equal(ticker.tick({ state: pausedState, gameState: pausedGame, nowMs: 60_000, fnContext: {}, callFunctionWithContext: (_ctx, name, uid) => name === 'GetActorByUID' ? pausedTarget : null }), 0.001);
  assert.equal(pausedState.globals.time, 12.001, 'resume advances by a bounded simulation step, without wall-time catch-up');
  assert.equal(pausedTarget.hp, 100, 'resume does not apply an impact before its simulation due time');

  const gate = createContinuousCombatStageState(17);
  gate.wave = 4; gate.nextEmissionAt = 0;
  const gateGlobals = { time: 4, ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', ContinuousCombatStage: gate,
    EnemySlots: [], EnemyData: globals.EnemyData, EnemyDeathVisualHoldByUID: {} };
  const gateEntities = [];
  const gateCall = (name, ...args) => name === 'SpawnEnemy' ? makeEnemy(500 + args[1], args[0].name, 240, 180) : true;
  maybeAdvanceContinuousCombatStage({ globals: gateGlobals, entities: gateEntities, call: gateCall });
  assert.equal(gateGlobals.ContinuousCombatStage.bossAvailable, true);
  const bossSpawned = [];
  assert.equal(armContinuousCombatBoss(gateGlobals,gateEntities,(name,...args)=>{
    if(name==='SpawnEnemy'){const enemy=makeEnemy(600+args[1],args[0].name,240,180,1_000_000,1_000_000,{enemyRole:args[0].enemyRole});bossSpawned.push(enemy);gateEntities.push(enemy);return enemy;}
    return true;
  }),true);
  assert.equal(gateGlobals.ContinuousCombatStage.bossActive, true);
  assert.ok(bossSpawned.some(enemy => enemy.enemyRole === 'boss'), 'boss click immediately replaces farming with the boss');

  const hero = Object.assign(newHeroProgress('Falie', 'hero-1'), { uid: 1, kind: 'hero', heroDisplaySlot: 0 });
  const heroes = [hero];
  const battle = { id: 'continuous-fixture', participants: ['hero-1'], defeated: {}, defeatedGold: {}, settled: false, outcome: 'active' };
  const rewardGlobals = { ContinuousCombatStageLoop: 1, ProgressionBattle: battle, HeroProgress: createHeroProgressStore(), goldTotal: 0, PendingGoldSettlements: {} };
  const rewardCtx = { state: { globals: rewardGlobals, entities: heroes } };
  const killed = makeEnemy(90, 'Gobloc', 200, 180, 0, 100, { expValue: 25, goldValue: 10 });
  assert.equal(recordEnemyDefeatReward(battle, killed), true);
  assert.equal(recordEnemyDefeatReward(battle, killed), false);
  settleDefeat(rewardCtx);
  assert.equal(battle.outcome, 'defeat');
  assert.equal(battle.settled, false, 'defeat keeps pending kills open for recovery settlement');
  settleContinuousCombatRewards(rewardCtx);
  const paidEXP = rewardGlobals.HeroProgress.heroes['hero-1'].currentEXP;
  assert.equal(hero.currentLevel,1);assert.equal(paidEXP,0);
  assert.equal(battle.settled, true);
  assert.equal(rewardGlobals.goldTotal, 0);
  const retryBattle = rewardGlobals.ProgressionBattle;
  rewardGlobals.ProgressionBattle = battle;
  assert.deepEqual(settleContinuousCombatRewards(rewardCtx), [], 'replaying the already-settled defeat receipt pays nothing');
  rewardGlobals.ProgressionBattle = retryBattle;
  assert.equal(rewardGlobals.HeroProgress.heroes['hero-1'].currentEXP, paidEXP);
  assert.equal(rewardGlobals.goldTotal, 0, 'duplicate defeat settlement does not award a pending kill twice');
  assert.notEqual(rewardGlobals.ProgressionBattle.id, battle.id, 'retry begins with a new continuous reward receipt');
  assert.equal(recordEnemyDefeatReward(retryBattle, killed), true, 'repeated enemy UID in a retry belongs to the new battle receipt');
  settleContinuousCombatRewards(rewardCtx);
  assert.equal(rewardGlobals.goldTotal, 0, 'a distinct retry kill grants no progression resources');
  assert.equal(rewardGlobals.HeroProgress.heroes['hero-1'].currentEXP, paidEXP);
});
