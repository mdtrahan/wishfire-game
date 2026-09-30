import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { attachHeroProgress, createHeroProgressStore, newHeroProgress, settleBattleEXP } from '../web-runner/src/core/heroProgression.mjs';
import { recordEnemyDefeatReward, rulesContext, settleContinuousCombatRewards, settleDefeat } from '../web-runner/modules/heroCommands.mjs';
import { resolveSkill, turnStart } from '../web-runner/src/core/combatRules.mjs';
import { PROGRESSION } from '../web-runner/src/core/heroDefinitions.mjs';
import { createEquipmentStorage } from '../web-runner/systems/equipmentStorage.mjs';

const storageSource = fs.readFileSync(new URL('../web-runner/systems/heroProgressStorage.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/, '')
  .replace(/export function /g, 'function ');
const storageContext = { createHeroProgressStore, attachHeroProgress, settleBattleEXP, window: null };
vm.runInNewContext(`${storageSource}\nthis.storageApi={persistHeroProgressIfDirty,restoreHeroProgressFromStorage,confirmGoldSettlements};`, storageContext);
const { persistHeroProgressIfDirty, restoreHeroProgressFromStorage, confirmGoldSettlements } = storageContext.storageApi;

async function withStorage(run) {
  const values = new Map();
  const prior = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  }};
  storageContext.window = globalThis.window;
  try { return await run(values); } finally { globalThis.window = prior; }
}

test('pending kill rewards settle on reload before fresh session IDs can reuse enemy UIDs', () => withStorage(async values => {
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  const locks = { request: (_key, callback) => callback() };
  await createEquipmentStorage({ globals: { goldTotal: 2 }, storage, locks, seed: () => 3, now: () => 1000, reportError() {} }).sync();
  const globals = {
    HeroProgress: createHeroProgressStore(),
    ProgressionBattle: { id: 'mid-battle', participants: ['Falie'], defeated: { 9: 7 }, defeatedGold: { 9: 4 }, settled: false },
  };
  assert.equal(persistHeroProgressIfDirty({ stateGlobals: globals }), true);
  const reloaded = {
    HeroProgress: createHeroProgressStore(),
    ProgressionBattle: { id: 'new-session', participants: ['Falie'], defeated: {}, settled: false },
    goldTotal: 2,
  };
  const hero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1 };
  restoreHeroProgressFromStorage({ fnContext: { state: { globals: reloaded, entities: [hero] } } });
  assert.deepEqual({ ...reloaded.ProgressionBattle.defeated }, {});
  assert.equal(reloaded.ProgressionBattle.id, 'new-session');
  assert.equal(hero.currentEXP, 7);
  assert.equal(reloaded.goldTotal, 6);
  assert.ok(reloaded.HeroProgress.settledBattles.includes('mid-battle'));
  assert.equal(reloaded.HeroProgress.pendingBattleRewards, null);
  await createEquipmentStorage({ globals: reloaded, storage, locks, seed: () => 3, now: () => 1000, reportError() {} }).sync();
  confirmGoldSettlements({ stateGlobals: reloaded });
  persistHeroProgressIfDirty({ stateGlobals: reloaded });
  recordEnemyDefeatReward(reloaded.ProgressionBattle, { uid: 9, kind: 'enemy', expValue: 11, goldValue: 5 });
  assert.equal(JSON.parse(values.get('orka.hero_progress.v2')).pendingBattleRewards.id, 'new-session');
  const again = {
    HeroProgress: createHeroProgressStore(),
    ProgressionBattle: { id: 'third-session', participants: ['Falie'], defeated: {}, settled: false },
    goldTotal: reloaded.goldTotal,
  };
  const againHero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1 };
  restoreHeroProgressFromStorage({ fnContext: { state: { globals: again, entities: [againHero] } } });
  assert.equal(againHero.currentEXP, 18);
  await createEquipmentStorage({ globals: again, storage, locks, seed: () => 8, now: () => 2000, reportError() {} }).sync();
  assert.equal(again.goldTotal, 11);
  assert.equal(again.ProgressionBattle.id, 'third-session');
  assert.deepEqual({ ...again.ProgressionBattle.defeated }, {});
  assert.ok(values.has('orka.hero_progress.v2'));
}));

test('a KO flushes its pending reward ledger before any animation-frame save', () => withStorage(async values => {
  const globals = { HeroProgress: createHeroProgressStore(), ProgressionBattle: { id: 'same-frame-ko', participants: ['Falie'], defeated: {}, settled: false } };
  restoreHeroProgressFromStorage({ fnContext: { state: { globals, entities: [{ ...newHeroProgress('Falie'), kind: 'hero', uid: 1 }] } } });
  assert.equal(recordEnemyDefeatReward(globals.ProgressionBattle, { uid: 9, kind: 'enemy', expValue: 8, goldValue: 3 }), true);
  const immediate = JSON.parse(values.get('orka.hero_progress.v2'));
  assert.equal(immediate.pendingBattleRewards.id, 'same-frame-ko');
  assert.deepEqual(immediate.pendingBattleRewards.defeated, { 9: 8 });

  const hero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1 };
  const reloaded = { HeroProgress: createHeroProgressStore(), ProgressionBattle: { id: 'new-uuid', participants: ['Falie'], defeated: {}, settled: false }, goldTotal: 0 };
  restoreHeroProgressFromStorage({ fnContext: { state: { globals: reloaded, entities: [hero] } } });
  assert.equal(hero.currentEXP, 8);
  assert.equal(reloaded.ProgressionBattle.id, 'new-uuid');
}));

test('reload recovery credits saved participants even when the new live roster differs', () => withStorage(async values => {
  const before = createHeroProgressStore();
  before.pendingBattleRewards = { id: 'roster-change', participants: ['Falie'], defeated: { 9: 5 }, defeatedGold: {} };
  globalThis.window.localStorage.setItem('orka.hero_progress.v2', JSON.stringify(before));
  const hondo = { ...newHeroProgress('Huun'), kind: 'hero', uid: 2 };
  const globals = { HeroProgress: createHeroProgressStore(), ProgressionBattle: { id: 'new-roster', participants: ['Huun'], defeated: {}, settled: false } };
  restoreHeroProgressFromStorage({ fnContext: { state: { globals, entities: [hondo] } } });
  assert.equal(hondo.currentEXP, 0);
  assert.equal(globals.HeroProgress.heroes.Falie.currentEXP, 5);
}));

test('ordinary defeat pays earned EXP and Gold before settlement', () => {
  const hero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1 };
  const battle = { id: 'ordinary-defeat', participants: ['Falie'], defeated: { 9: 7 }, defeatedGold: { 9: 4 }, settled: false };
  const globals = { ProgressionBattle: battle, HeroProgress: createHeroProgressStore(), goldTotal: 2 };
  settleDefeat({ state: { globals, entities: [hero] }, callFunction() {} });
  assert.equal(hero.currentEXP, 7);
  assert.equal(globals.goldTotal, 6);
  assert.equal(battle.settled, true);
  assert.ok(globals.HeroProgress.settledBattles.includes('ordinary-defeat'));
  settleDefeat({ state: { globals, entities: [hero] }, callFunction() {} });
  assert.equal(hero.currentEXP, 7);
  assert.equal(globals.goldTotal, 6);
});

test('continuous wallet receipts stay unique across rollovers and sessions with the same numeric session ID', () => {
  const makeSession = battleId => {
    const hero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1 };
    const globals = { ContinuousCombatStageLoop: 1, CombatSessionId: 7, ProgressionBattle: { id: battleId, participants: ['Falie'], defeated: { 9: 2 }, defeatedGold: { 9: 3 } }, HeroProgress: createHeroProgressStore(), goldTotal: 0 };
    const ctx = { state: { globals, entities: [hero] }, callFunction() {} };
    settleContinuousCombatRewards(ctx);
    globals.ProgressionBattle.defeated = { 10: 2 };
    globals.ProgressionBattle.defeatedGold = { 10: 3 };
    settleContinuousCombatRewards(ctx);
    return Object.keys(globals.PendingGoldSettlements).sort();
  };
  const first = makeSession('session-uuid-a');
  const second = makeSession('session-uuid-b');
  assert.deepEqual(first, ['session-uuid-a', 'session-uuid-a-continuous-1']);
  assert.deepEqual(second, ['session-uuid-b', 'session-uuid-b-continuous-1']);
  assert.equal(new Set([...first, ...second]).size, 4);
});

test('role skill, counter and DoT KOs reach the shared reward callback', () => {
  const make = (enemyHP = 5, heroStatuses = []) => {
    const hero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1, hp: 100, statuses: heroStatuses };
    const enemy = { uid: 9, kind: 'enemy', hp: enemyHP, maxHP: 5, stats: { ATK: 5, DEF: 1, MAG: 5, RES: 1, SPD: 5 }, statuses: [] };
    let rewardFlushes = 0;
    const globals = { ProgressionBattle: { id: 'role-paths', participants: ['Falie'], defeated: {}, defeatedGold: {}, persistPendingRewards() { rewardFlushes++; } } };
    const ctx = { state: { globals, entities: [hero, enemy] }, callFunction(name, uid, amount) {
      if (name === 'CalculateDamage') return 10;
      if (name === 'ApplyDamageToTarget') { const target = ctx.state.entities.find(actor => actor.uid === uid); const before = target.hp; target.hp = Math.max(0, target.hp - amount); return before - target.hp; }
      throw new Error(`unexpected ${name}`);
    }};
    return { hero, enemy, globals, ctx, rewardFlushes: () => rewardFlushes };
  };
  const skillCase = make();
  resolveSkill(rulesContext(skillCase.ctx), skillCase.hero, { skillId: 'test_role', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage', fixedDamage: 5 }] }, [9]);
  assert.deepEqual({ ...skillCase.globals.ProgressionBattle.defeated }, { 9: 25 });
  assert.deepEqual({ ...skillCase.globals.ProgressionBattle.defeatedGold }, { 9: PROGRESSION.enemyGold });
  assert.equal(skillCase.rewardFlushes(), 1);

  const counterCase = make(5, [{ statusEffect: 'counter', magnitude: 1, duration: 2 }]);
  resolveSkill(rulesContext(counterCase.ctx), counterCase.enemy, { skillId: 'test_enemy', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage', fixedDamage: 1 }] }, [1]);
  assert.deepEqual({ ...counterCase.globals.ProgressionBattle.defeated }, { 9: 25 });
  assert.deepEqual({ ...counterCase.globals.ProgressionBattle.defeatedGold }, { 9: PROGRESSION.enemyGold });
  assert.equal(counterCase.rewardFlushes(), 1);

  const dotCase = make(1);
  dotCase.enemy.statuses = [{ statusEffect: 'dot', snapshotPotency: 1, duration: 2, sourceUID: 1 }];
  turnStart(rulesContext(dotCase.ctx), dotCase.enemy, 1);
  assert.deepEqual({ ...dotCase.globals.ProgressionBattle.defeated }, { 9: 25 });
  assert.deepEqual({ ...dotCase.globals.ProgressionBattle.defeatedGold }, { 9: PROGRESSION.enemyGold });
  assert.equal(dotCase.rewardFlushes(), 1);
});

test('wallet first sync commits recovered Gold and retries a saved receipt without duplicating it', async () => withStorage(async values => {
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  const locks = { request: (_key, callback) => callback() };
  const initial = createEquipmentStorage({ globals: { goldTotal: 0 }, storage, locks, seed: () => 3, now: () => 1000, reportError() {} });
  await initial.sync();
  const globals = { goldTotal: 4, PendingGoldSettlements: { recovered: 4 } };
  const wallet = createEquipmentStorage({ globals, storage, locks, seed: () => 3, now: () => 1000, reportError() {} });
  await wallet.sync();
  assert.equal(wallet.data.gold, 4);
  assert.deepEqual(globals.PendingGoldSettlements, {});
  const retryGlobals = { goldTotal: 0, PendingGoldSettlements: { recovered: 4 } };
  const retry = createEquipmentStorage({ globals: retryGlobals, storage, locks, seed: () => 8, now: () => 2000, reportError() {} });
  await retry.sync();
  assert.equal(retry.data.gold, 4);
  assert.equal(retryGlobals.goldTotal, 4);
  assert.deepEqual(retryGlobals.PendingGoldSettlements, {});
  const freshValues = new Map();
  const freshStorage = { getItem: key => freshValues.get(key) ?? null, setItem: (key, value) => freshValues.set(key, String(value)) };
  const firstSave = createEquipmentStorage({ globals: { goldTotal: 4, PendingGoldSettlements: { fresh: 4 } }, storage: freshStorage, locks, seed: () => 5, now: () => 3000, reportError() {} });
  await firstSave.sync();
  assert.equal(firstSave.data.gold, 4);
  const failedValues = new Map();
  const failedStorage = { getItem: key => failedValues.get(key) ?? null, setItem: (key, value) => failedValues.set(key, String(value)) };
  const blocked = createEquipmentStorage({ globals: { goldTotal: 4, PendingGoldSettlements: { unsaved: 4 }, HeroProgressStorageError: 'quota' }, storage: failedStorage, locks, seed: () => 6, now: () => 4000, reportError() {} });
  await assert.rejects(blocked.sync(), /saved HeroProgress receipt/);
  assert.equal(failedStorage.getItem('wishfire.equipment-economy.v1'), null);
}));

test('a reload between HeroProgress settlement and wallet sync replays its durable Gold outbox once', async () => withStorage(async values => {
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  const locks = { request: (_key, callback) => callback() };
  const seedWallet = createEquipmentStorage({ globals: { goldTotal: 2 }, storage, locks, seed: () => 3, now: () => 1000, reportError() {} });
  await seedWallet.sync();
  const seedProgress = createHeroProgressStore();
  seedProgress.pendingBattleRewards = { id: 'interrupted', participants: ['Falie'], defeated: { 9: 7 }, defeatedGold: { 9: 4 } };
  values.set('orka.hero_progress.v2', JSON.stringify(seedProgress));

  const firstHero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1 };
  const first = { HeroProgress: createHeroProgressStore(), ProgressionBattle: { id: 'first-live', participants: ['Falie'], defeated: {}, settled: false }, goldTotal: 0 };
  restoreHeroProgressFromStorage({ fnContext: { state: { globals: first, entities: [firstHero] } } });
  const persistedAfterSettlement = JSON.parse(values.get('orka.hero_progress.v2'));
  assert.equal(firstHero.currentEXP, 7);
  assert.equal(persistedAfterSettlement.pendingGoldSettlements.interrupted, 4);
  assert.ok(persistedAfterSettlement.settledBattles.includes('interrupted'));

  const secondHero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1 };
  const second = { HeroProgress: createHeroProgressStore(), ProgressionBattle: { id: 'second-live', participants: ['Falie'], defeated: {}, settled: false }, goldTotal: 0 };
  restoreHeroProgressFromStorage({ fnContext: { state: { globals: second, entities: [secondHero] } } });
  const wallet = createEquipmentStorage({ globals: second, storage, locks, seed: () => 8, now: () => 2000, reportError() {} });
  await wallet.sync();
  assert.equal(wallet.data.gold, 6);
  assert.equal(secondHero.currentEXP, 7);
  confirmGoldSettlements({ stateGlobals: second });
  persistHeroProgressIfDirty({ stateGlobals: second });
  assert.deepEqual(JSON.parse(values.get('orka.hero_progress.v2')).pendingGoldSettlements, {});
  const finalHero = { ...newHeroProgress('Falie'), kind: 'hero', uid: 1 };
  const final = { HeroProgress: createHeroProgressStore(), ProgressionBattle: { id: 'after-payment', participants: ['Falie'], defeated: {}, settled: false }, goldTotal: 0 };
  restoreHeroProgressFromStorage({ fnContext: { state: { globals: final, entities: [finalHero] } } });
  await createEquipmentStorage({ globals: final, storage, locks, seed: () => 9, now: () => 3000, reportError() {} }).sync();
  assert.equal(finalHero.currentEXP, 7);
  assert.equal(final.goldTotal, 6);
}));
