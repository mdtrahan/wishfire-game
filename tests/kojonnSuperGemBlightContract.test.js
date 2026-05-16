const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadSuperGemRuntime() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'superGemRuntime.js'), 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { executePendingSuperGemAction, syncTaintedGroundZones };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

test('Kojonn green super-gem creates tainted ground instead of clustered blight waves', () => {
  const { executePendingSuperGemAction } = loadSuperGemRuntime();
  const actor = { uid: 4, name: 'Kojonn', kind: 'hero', attackType: 'magic', MAG: 22 };
  const enemies = [
    { uid: 101, name: 'Djinn', kind: 'enemy', hp: 30, slotIndex: 0, x: 240, y: 88 },
    { uid: 102, name: 'Marid', kind: 'enemy', hp: 30, slotIndex: 1, x: 242, y: 144 },
  ];
  const state = {
    globals: {
      time: 10,
      TurnSerial: 7,
      TurnOrderArray: [
        { uid: 4, type: 0 },
        { uid: 5, type: 0 },
        { uid: 6, type: 0 },
        { uid: 101, type: 1 },
        { uid: 102, type: 1 },
        { uid: 103, type: 1 },
        { uid: 104, type: 1 },
      ],
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 0, hitCount: 4, actorUID: actor.uid },
      PowerAmpByUID: {},
    },
    entities: [actor, ...enemies],
  };
  const calls = [];
  const callFunctionWithContext = (_ctx, name, ...args) => {
    calls.push(name);
    if (name === 'GetActorByUID') return [actor, ...enemies].find((entity) => entity.uid === args[0]) || null;
    if (name === 'GetPowerAmpMultiplierForActor') return 0;
    if (name === 'ConsumePowerAmpForActor') return 0;
    if (name === 'GetEffectiveStat') return args[1] === 'MAG' ? 22 : 0;
    if (name === 'StartHeroLunge') return true;
    if (name === 'CalculateDamage') throw new Error('Kojonn super-gem should not use generic AOE damage');
    return 0;
  };

  const activated = executePendingSuperGemAction({
    state,
    callFunctionWithContext,
    fnContext: {},
  });

  assert.equal(activated, true);
  assert.equal(state.globals.PendingSuperGemAction, null);
  assert.equal(state.globals.PendingHeroHits.length, 2);
  assert.ok(state.globals.PendingHeroHits.every((hit) => hit.effectType === 'dot_apply'));
  assert.ok(state.globals.PendingHeroHits.every((hit) => hit.effectName === 'Blight'));
  assert.ok(state.globals.PendingHeroHits.every((hit) => hit.taintedGroundZoneId));
  assert.ok(state.globals.PendingHeroHits.every((hit) => hit.dotTotalDamage === 8));
  assert.equal(state.globals.TaintedGroundZones.length, 2);
  assert.equal(
    JSON.stringify(state.globals.TaintedGroundZones.map((zone) => ({
      slotIndex: zone.slotIndex,
      sourceUID: zone.sourceUID,
      anchorWorldX: zone.anchorWorldX,
      anchorWorldY: zone.anchorWorldY,
      remainingTurns: zone.remainingTurns,
      durationHeroTeamTurns: zone.durationHeroTeamTurns,
      heroTeamTurnSpan: zone.heroTeamTurnSpan,
      createdHeroTeamTurnSerial: zone.createdHeroTeamTurnSerial,
      expiresAtHeroTeamTurnSerial: zone.expiresAtHeroTeamTurnSerial,
      effectName: zone.effectName,
      visual: zone.visual,
      visualStartsAt: zone.visualStartsAt,
    }))),
    JSON.stringify([
      { slotIndex: 0, sourceUID: 4, anchorWorldX: 240, anchorWorldY: 88, remainingTurns: 3, durationHeroTeamTurns: 3, heroTeamTurnSpan: 3, createdHeroTeamTurnSerial: 0, expiresAtHeroTeamTurnSerial: 3, effectName: 'TaintedGround', visual: 'blight_disc', visualStartsAt: 11.07 },
      { slotIndex: 1, sourceUID: 4, anchorWorldX: 242, anchorWorldY: 144, remainingTurns: 3, durationHeroTeamTurns: 3, heroTeamTurnSpan: 3, createdHeroTeamTurnSerial: 0, expiresAtHeroTeamTurnSerial: 3, effectName: 'TaintedGround', visual: 'blight_disc', visualStartsAt: 11.07 },
    ]),
  );
  assert.equal(
    state.globals.PendingHeroHits
      .some((hit) => String(hit.effectName || '').startsWith('Blight Wave')),
    false,
  );
  assert.equal(calls.includes('CalculateDamage'), false);
});

test('Kojonn tainted ground refreshes zones and blights enemies entering tainted slots once', () => {
  const { executePendingSuperGemAction, syncTaintedGroundZones } = loadSuperGemRuntime();
  const actor = { uid: 4, name: 'Kojonn', kind: 'hero', attackType: 'magic', MAG: 22 };
  const firstEnemy = { uid: 101, name: 'Djinn', kind: 'enemy', hp: 30, slotIndex: 0 };
  const state = {
    globals: {
      time: 10,
      TurnSerial: 5,
      TurnOrderArray: [
        { uid: 4, type: 0 },
        { uid: 5, type: 0 },
        { uid: 6, type: 0 },
        { uid: 101, type: 1 },
        { uid: 102, type: 1 },
        { uid: 103, type: 1 },
        { uid: 104, type: 1 },
      ],
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 0, hitCount: 3, actorUID: actor.uid },
      PowerAmpByUID: {},
    },
    entities: [actor, firstEnemy],
  };
  const queueCalls = [];
  const callFunctionWithContext = (_ctx, name, ...args) => {
    if (name === 'GetActorByUID') return [actor, ...state.entities].find((entity) => entity.uid === args[0]) || null;
    if (name === 'GetPowerAmpMultiplierForActor') return 0;
    if (name === 'ConsumePowerAmpForActor') return 0;
    if (name === 'GetEffectiveStat') return args[1] === 'MAG' ? 22 : 0;
    if (name === 'StartHeroLunge') return true;
    if (name === 'QueueEnemyDamageOverTime') {
      queueCalls.push(args);
      return 1;
    }
    if (name === 'CalculateDamage') throw new Error('Kojonn tainted ground should not use generic AOE damage');
    return 0;
  };

  assert.equal(executePendingSuperGemAction({ state, callFunctionWithContext, fnContext: {} }), true);
  assert.equal(executePendingSuperGemAction({
    state: {
      ...state,
      globals: {
        ...state.globals,
        PendingSuperGemAction: { kind: 'super_gem_attack', color: 0, hitCount: 3, actorUID: actor.uid },
      },
    },
    callFunctionWithContext,
    fnContext: {},
  }), true);
  assert.equal(state.globals.TaintedGroundZones.length, 1);
  assert.equal(state.globals.TaintedGroundZones[0].remainingTurns, 3);
  assert.equal(state.globals.TaintedGroundZones[0].durationHeroTeamTurns, 3);
  assert.equal(state.globals.TaintedGroundZones[0].heroTeamTurnSpan, 3);

  const enteringEnemy = { uid: 202, name: 'Ifrit', kind: 'enemy', hp: 30, slotIndex: 0 };
  state.entities = [actor, enteringEnemy];
  state.globals.time = 10.5;
  syncTaintedGroundZones({ state, callFunctionWithContext, fnContext: {} });
  assert.equal(queueCalls.length, 0);

  state.globals.time = 11.2;
  const expiresBeforeEntryBlight = state.globals.TaintedGroundZones[0].expiresAtHeroTeamTurnSerial;
  syncTaintedGroundZones({ state, callFunctionWithContext, fnContext: {} });
  syncTaintedGroundZones({ state, callFunctionWithContext, fnContext: {} });

  assert.equal(queueCalls.length, 1);
  assert.equal(queueCalls[0][0], actor.uid);
  assert.equal(queueCalls[0][1], enteringEnemy.uid);
  assert.equal(queueCalls[0][3].effectName, 'Blight');
  assert.equal(queueCalls[0][3].cadence, 'turn');
  assert.equal(queueCalls[0][3].taintedGroundZoneId, state.globals.TaintedGroundZones[0].id);
  assert.equal(state.globals.TaintedGroundZones[0].expiresAtHeroTeamTurnSerial, expiresBeforeEntryBlight);
});

test('Kojonn tainted ground reapplication refreshes all puddle slots to one shared expiry', () => {
  const { executePendingSuperGemAction } = loadSuperGemRuntime();
  const actor = { uid: 4, name: 'Kojonn', kind: 'hero', attackType: 'magic', MAG: 22 };
  const enemies = [
    { uid: 101, name: 'Djinn', kind: 'enemy', hp: 30, slotIndex: 0, x: 240, y: 88 },
    { uid: 102, name: 'Marid', kind: 'enemy', hp: 30, slotIndex: 1, x: 242, y: 144 },
  ];
  const state = {
    globals: {
      time: 10,
      HeroTeamTurnSerial: 0,
      TurnOrderArray: [
        { uid: 4, type: 0 },
        { uid: 5, type: 0 },
        { uid: 6, type: 0 },
        { uid: 101, type: 1 },
        { uid: 102, type: 1 },
      ],
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 0, hitCount: 3, actorUID: actor.uid },
      PowerAmpByUID: {},
    },
    entities: [actor, ...enemies],
  };
  const callFunctionWithContext = (_ctx, name, ...args) => {
    if (name === 'GetActorByUID') return state.entities.find((entity) => entity.uid === args[0]) || null;
    if (name === 'GetPowerAmpMultiplierForActor') return 0;
    if (name === 'ConsumePowerAmpForActor') return 0;
    if (name === 'GetEffectiveStat') return args[1] === 'MAG' ? 22 : 0;
    if (name === 'StartHeroLunge') return true;
    return 0;
  };

  assert.equal(executePendingSuperGemAction({ state, callFunctionWithContext, fnContext: {} }), true);
  assert.equal(JSON.stringify(state.globals.TaintedGroundZones.map((zone) => zone.expiresAtHeroTeamTurnSerial)), JSON.stringify([3, 3]));

  state.globals.time = 40;
  state.globals.HeroTeamTurnSerial = 2;
  state.globals.PendingSuperGemAction = { kind: 'super_gem_attack', color: 0, hitCount: 3, actorUID: actor.uid };

  assert.equal(executePendingSuperGemAction({ state, callFunctionWithContext, fnContext: {} }), true);

  assert.equal(state.globals.TaintedGroundZones.length, 2);
  assert.equal(JSON.stringify(state.globals.TaintedGroundZones.map((zone) => zone.expiresAtHeroTeamTurnSerial)), JSON.stringify([5, 5]));
  assert.equal(JSON.stringify(state.globals.TaintedGroundZones.map((zone) => zone.remainingTurns)), JSON.stringify([3, 3]));
  assert.equal(JSON.stringify(state.globals.TaintedGroundZones.map((zone) => zone.visualStartsAt)), JSON.stringify([41.07, 41.07]));
});

test('Kojonn tainted ground uses hero-team passes instead of total combatant count', () => {
  const { executePendingSuperGemAction, syncTaintedGroundZones } = loadSuperGemRuntime();
  const actor = { uid: 4, name: 'Kojonn', kind: 'hero', attackType: 'magic', MAG: 22 };
  const guest = { uid: 5, name: 'Guest', kind: 'hero', hp: 40 };
  const enemy = { uid: 101, name: 'Mini-Boss', kind: 'enemy', hp: 120, slotIndex: 0 };
  const state = {
    globals: {
      time: 10,
      TurnSerial: 0,
      HeroTeamTurnSerial: 2,
      TurnOrderArray: [
        { uid: 4, type: 0 },
        { uid: 5, type: 0 },
        { uid: 101, type: 1 },
      ],
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 0, hitCount: 3, actorUID: actor.uid },
      PowerAmpByUID: {},
    },
    entities: [actor, guest, enemy],
  };
  const callFunctionWithContext = (_ctx, name, ...args) => {
    if (name === 'GetActorByUID') return state.entities.find((entity) => entity.uid === args[0]) || null;
    if (name === 'GetPowerAmpMultiplierForActor') return 0;
    if (name === 'ConsumePowerAmpForActor') return 0;
    if (name === 'GetEffectiveStat') return args[1] === 'MAG' ? 22 : 0;
    if (name === 'StartHeroLunge') return true;
    if (name === 'QueueEnemyDamageOverTime') return 1;
    return 0;
  };

  assert.equal(executePendingSuperGemAction({ state, callFunctionWithContext, fnContext: {} }), true);
  const [zone] = state.globals.TaintedGroundZones;
  assert.equal(zone.heroTeamTurnSpan, 2);
  assert.equal(zone.createdHeroTeamTurnSerial, 2);
  assert.equal(zone.expiresAtHeroTeamTurnSerial, 5);

  state.globals.HeroTeamTurnSerial = 4;
  state.globals.time = 30;
  syncTaintedGroundZones({ state, callFunctionWithContext, fnContext: {} });
  assert.equal(state.globals.TaintedGroundZones[0].remainingTurns, 1);
  assert.equal(state.globals.TaintedGroundZones[0].fadeStartedAt == null, true);

  state.globals.HeroTeamTurnSerial = 5;
  syncTaintedGroundZones({ state, callFunctionWithContext, fnContext: {} });
  assert.equal(state.globals.TaintedGroundZones[0].remainingTurns, 0);
  assert.equal(state.globals.TaintedGroundZones[0].fadeStartedAt, 30);
});

test('Kojonn tainted ground absorbs direct Blight for enemies standing in field slots', () => {
  const { syncTaintedGroundZones } = loadSuperGemRuntime();
  const state = {
    globals: {
      time: 22,
      TurnSerial: 29,
      TaintedGroundZones: [{
        id: 'tg-owned',
        sourceUID: 4,
        slotIndex: 0,
        remainingTurns: 0,
        createdTurnSerial: 7,
        lastSeenTurnSerial: 28,
        durationHeroTeamTurns: 3,
        heroTeamTurnSpan: 7,
        createdHeroTeamTurnSerial: 1,
        expiresAtHeroTeamTurnSerial: 4,
        lastSeenHeroTeamTurnSerial: 4,
        activeAt: 8.07,
        visualStartsAt: 8.07,
        fadeStartedAt: 20,
        dotTotalDamage: 16,
        appliedUIDs: { 101: true },
        effectName: 'TaintedGround',
        visual: 'blight_disc',
      }],
      EnemyDamageOverTime: [
        { targetUID: 101, sourceUID: 4, effectName: 'Blight', remainingFires: 2, totalDamageRemaining: 8, taintedGroundZoneId: 'tg-owned' },
        { targetUID: 101, sourceUID: 4, effectName: 'Blight', remainingFires: 2, totalDamageRemaining: 8 },
        { targetUID: 102, sourceUID: 4, effectName: 'Blight', remainingFires: 2, totalDamageRemaining: 8, taintedGroundZoneId: 'tg-other' },
        { targetUID: 101, sourceUID: 4, effectName: 'Burn', remainingFires: 2, totalDamageRemaining: 8 },
      ],
    },
    entities: [
      { uid: 4, name: 'Kojonn', kind: 'hero' },
      { uid: 101, name: 'Djinn', kind: 'enemy', hp: 30, slotIndex: 0 },
      { uid: 102, name: 'Marid', kind: 'enemy', hp: 30, slotIndex: 1 },
    ],
  };
  const callFunctionWithContext = () => 0;

  syncTaintedGroundZones({ state, callFunctionWithContext, fnContext: {} });

  assert.equal(state.globals.TaintedGroundZones, undefined);
  assert.equal(state.globals.EnemyDamageOverTime.length, 2);
  assert.equal(state.globals.EnemyDamageOverTime.some((dot) => dot.taintedGroundZoneId === 'tg-owned'), false);
  assert.equal(state.globals.EnemyDamageOverTime.some((dot) => dot.targetUID === 101 && dot.effectName === 'Blight' && !dot.taintedGroundZoneId), false);
  assert.equal(state.globals.EnemyDamageOverTime.some((dot) => dot.targetUID === 101 && dot.effectName === 'Burn'), true);
  assert.equal(state.globals.EnemyDamageOverTime.some((dot) => dot.taintedGroundZoneId === 'tg-other'), true);
});

test('Kojonn regular Faze applied under SG Faze is absorbed by the field timing', () => {
  const { syncTaintedGroundZones } = loadSuperGemRuntime();
  const state = {
    globals: {
      time: 15,
      TurnSerial: 12,
      HeroTeamTurnSerial: 2,
      TaintedGroundZones: [{
        id: 'tg-owned',
        sourceUID: 4,
        slotIndex: 0,
        remainingTurns: 2,
        durationHeroTeamTurns: 3,
        heroTeamTurnSpan: 3,
        createdHeroTeamTurnSerial: 0,
        expiresAtHeroTeamTurnSerial: 3,
        lastSeenHeroTeamTurnSerial: 2,
        activeAt: 8.07,
        visualStartsAt: 8.07,
        dotTotalDamage: 16,
        appliedUIDs: { 101: true },
        effectName: 'TaintedGround',
        visual: 'blight_disc',
      }],
      EnemyDamageOverTime: [
        { targetUID: 101, sourceUID: 4, effectName: 'Blight', remainingFires: 1, totalDamageRemaining: 4, taintedGroundZoneId: 'tg-owned' },
        { targetUID: 101, sourceUID: 4, effectName: 'Blight', remainingFires: 3, totalDamageRemaining: 12 },
      ],
    },
    entities: [
      { uid: 4, name: 'Kojonn', kind: 'hero' },
      { uid: 101, name: 'Djinn', kind: 'enemy', hp: 30, slotIndex: 0 },
    ],
  };
  const callFunctionWithContext = () => 0;

  syncTaintedGroundZones({ state, callFunctionWithContext, fnContext: {} });

  assert.equal(state.globals.TaintedGroundZones.length, 1);
  assert.equal(state.globals.TaintedGroundZones[0].fadeStartedAt == null, true);
  assert.equal(state.globals.EnemyDamageOverTime.length, 1);
  assert.equal(state.globals.EnemyDamageOverTime.some((dot) => dot.taintedGroundZoneId === 'tg-owned'), true);
  assert.equal(state.globals.EnemyDamageOverTime.some((dot) => dot.effectName === 'Blight' && !dot.taintedGroundZoneId), false);
});

test('Kojonn regular Faze after SG Faze has dissipated can start direct Blight again', () => {
  const { syncTaintedGroundZones } = loadSuperGemRuntime();
  const state = {
    globals: {
      time: 24,
      HeroTeamTurnSerial: 4,
      EnemyDamageOverTime: [
        { targetUID: 101, sourceUID: 4, effectName: 'Blight', remainingFires: 3, totalDamageRemaining: 12 },
      ],
    },
    entities: [
      { uid: 4, name: 'Kojonn', kind: 'hero' },
      { uid: 101, name: 'Djinn', kind: 'enemy', hp: 30, slotIndex: 0 },
    ],
  };

  syncTaintedGroundZones({ state, callFunctionWithContext: () => 0, fnContext: {} });

  assert.equal(state.globals.TaintedGroundZones, undefined);
  assert.equal(state.globals.EnemyDamageOverTime.length, 1);
  assert.equal(state.globals.EnemyDamageOverTime[0].targetUID, 101);
  assert.equal(state.globals.EnemyDamageOverTime[0].taintedGroundZoneId, undefined);
});
