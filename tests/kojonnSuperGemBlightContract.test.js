const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadSuperGemRuntime() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'superGemRuntime.js'), 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect, executePendingSuperGemAction, syncTaintedGroundZones };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

test('retired green super-gem stale state fails closed without arming pending AOE', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const state = {
    globals: {
      time: 10,
      RuntimeRandom: () => 0,
    },
  };
  const calls = [];
  const callFunctionWithContext = (_ctx, name, ...args) => {
    calls.push({ name, args });
    return 0;
  };

  const activated = activateSuperGemEffect({
    superGem: { baseColor: 0 },
    actorUID: 4,
    selectedEnemyUID: 0,
    state,
    callFunctionWithContext,
    fnContext: {},
    sourceItems: [{ id: 'green-sg' }],
    startGemMergeFx: () => { throw new Error('pending green super-gem action should not merge in runtime resolver'); },
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, false);
  assert.equal(state.globals.PendingSkillID || '', '');
  assert.equal(state.globals.PendingActor || 0, 0);
  assert.equal(state.globals.PendingSuperGemAction || null, null);
  assert.equal(state.globals.HideHeroSelector || 0, 0);
  assert.equal(state.globals.CanPickGems || 0, 0);
  assert.deepEqual(calls, []);
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
