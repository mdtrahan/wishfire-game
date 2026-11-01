import test from 'node:test';
import assert from 'node:assert/strict';
import { maybeAdvanceContinuousCombatStage, tickContinuousCombatStageJS, createContinuousCombatStageState } from '../web-runner/src/core/continuousCombatStage.mjs';
import { consumeCombatKillEvent, recordEnemyDefeatReward } from '../web-runner/modules/heroCommands.mjs';

function encounter() {
  const stage = { ...createContinuousCombatStageState(1), bossActive: true, bossAvailable: true, bossArmed: true, bossUID: 9 };
  const globals = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: stage, GamePhase: 'RUNTIME', time: 2,
    EnemyData: [{ name: 'Gobloc', HP: 20, ATK: 2, DEF: 2, MAG: 1, RES: 1, SPD: 8 }], EnemySlots: [10], EnemyIDs: [9] };
  const entities = [{ uid: 9, kind: 'enemy', name: 'Troll', hp: 10, maxHP: 10, streamState: 'engaged', x: 900, y: 290 }];
  return { globals, entities };
}

test('default JS path keeps movement, basic, enemy, boss observation and reward settlement order', () => {
  const { globals, entities } = encounter(), calls = [];
  maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} },
    call(name) {
      calls.push(name);
      if (name === 'TickRealtimeHeroBasics') {
        assert.equal(globals.ContinuousCombatStage.bossTimerStartedAt, 2);
        assert.equal(globals.ContinuousCombatStage.lastArenaUpdatedAt, 2);
      }
      if (name === 'TickRealtimeEnemyActions') entities[0].hp = 0;
    }, onBossClear() { calls.push('boss-observation'); } });
  assert.deepEqual(calls.slice(0, 4), ['TickRealtimeHeroBasics', 'TickRealtimeEnemyActions', 'boss-observation', 'SettleContinuousCombatRewards']);
});

test('host lifecycle accepts an independent combat tick without JS actor or scheduler writes', () => {
  const { globals, entities } = encounter(), before = structuredClone(entities), calls = [];
  let ticks = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities, combatTick() { ticks++; }, call(name) { calls.push(name); } });
  assert.equal(ticks, 1);
  assert.deepEqual(entities, before);
  assert.deepEqual(calls, []);
  assert.equal(globals.ContinuousCombatStage.bossTimerStartedAt, 2);
  assert.equal(typeof tickContinuousCombatStageJS, 'function');
});

test('event-only kill consumer retains exact WFM once-per-enemy receipts without combat effects', () => {
  const rewards = [], battle = { id: 'battle', persistPendingRewards: reward => rewards.push(reward) };
  const enemy = Object.freeze({ uid: 9, kind: 'enemy', hp: 0, enemyRole: 'boss', isBoss: true });
  assert.equal(consumeCombatKillEvent(battle, { enemy }), true);
  assert.equal(recordEnemyDefeatReward(battle, enemy), false);
  assert.deepEqual(rewards, [{ id: 'enemy:battle:9', amount: 5 }]);
  assert.deepEqual(battle.defeated, { 9: 0 });
  assert.deepEqual(battle.defeatedGold, { 9: 0 });
  assert.equal(consumeCombatKillEvent(battle, { enemy: { kind: 'hero', uid: 2 } }), false);
});
