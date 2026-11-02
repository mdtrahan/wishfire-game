import test from 'node:test';
import assert from 'node:assert/strict';
import { maybeAdvanceContinuousCombatStage, createContinuousCombatStageState } from '../web-runner/src/core/continuousCombatStage.mjs';
import { consumeCombatKillEvent } from '../web-runner/modules/heroCommands.mjs';

function encounter() {
  const stage = { ...createContinuousCombatStageState(1), bossActive: true, bossAvailable: true, bossArmed: true, bossUID: 9 };
  const globals = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: stage, GamePhase: 'RUNTIME', time: 2,
    EnemyData: [{ name: 'Gobloc', HP: 20, ATK: 2, DEF: 2, MAG: 1, RES: 1, SPD: 8 }], EnemySlots: [10], EnemyIDs: [9] };
  const entities = [{ uid: 1, kind: 'hero', hp: 100, maxHP: 100 }, { uid: 9, kind: 'enemy', name: 'Troll', hp: 10, maxHP: 10, streamState: 'engaged', x: 900, y: 290 }];
  return { globals, entities };
}

test('host observes Rust boss death before settling retained rewards', () => {
  const { globals, entities } = encounter(), calls = [];
  entities.find(actor => actor.kind === 'enemy').hp = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} },
    call(name) { calls.push(name); }, onBossClear() { calls.push('boss-observation'); } });
  assert.deepEqual(calls.slice(0, 2), ['boss-observation', 'SettleContinuousCombatRewards']);
  assert.ok(calls.every(name => !/TickRealtime|ProcessTurn|ApplyDamage/.test(name)));
});

test('host lifecycle observes live actors without dispatching combat or writing actor state', () => {
  const { globals, entities } = encounter(), before = structuredClone(entities), calls = [];
  maybeAdvanceContinuousCombatStage({ globals, entities, call(name) { calls.push(name); } });
  assert.deepEqual(entities, before);
  assert.deepEqual(calls, []);
  assert.equal(globals.ContinuousCombatStage.bossTimerStartedAt, 2);
});

test('event-only kill consumer retains exact WFM once-per-enemy receipts without combat effects', () => {
  const rewards = [], battle = { id: 'battle', persistPendingRewards: reward => rewards.push(reward) };
  const enemy = Object.freeze({ uid: 9, kind: 'enemy', hp: 0, enemyRole: 'boss', isBoss: true });
  assert.equal(consumeCombatKillEvent(battle, { enemy }), true);
  assert.equal(consumeCombatKillEvent(battle, { enemy }), false);
  assert.deepEqual(rewards, [{ id: 'enemy:battle:9', amount: 5 }]);
  assert.deepEqual(battle.defeated, { 9: 0 });
  assert.deepEqual(battle.defeatedGold, { 9: 0 });
  assert.equal(consumeCombatKillEvent(battle, { enemy: { kind: 'hero', uid: 2 } }), false);
});
