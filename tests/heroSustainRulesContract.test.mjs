import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSIVE_HERO_REGEN_FRACTION,
  advancePassiveHeroRegen,
  fillGearMaxHpGrowth,
} from '../web-runner/src/core/heroSustainRules.mjs';

test('gear max HP growth adds the capacity increase without healing a KO hero', () => {
  assert.equal(fillGearMaxHpGrowth(30, 100, 125), 55);
  assert.equal(fillGearMaxHpGrowth(30, 125, 100), 30);
  assert.equal(fillGearMaxHpGrowth(0, 100, 125), 0);
  assert.equal(fillGearMaxHpGrowth(140, 100, 125), 125);
});

test('passive regen accrues fractional credits per hero and heals whole HP only', () => {
  assert.equal(PASSIVE_HERO_REGEN_FRACTION, 0.004);
  const heroes = [{ uid: 1, hp: 50, maxHP: 100 }, { uid: 2, hp: 20, maxHP: 50 }];
  let state = advancePassiveHeroRegen({ now: 0, heroes });
  assert.deepEqual(state.heals, []);
  state = advancePassiveHeroRegen({ now: 3, lastAt: state.lastAt, credits: state.credits, heroes });
  assert.deepEqual(state.heals, [{ uid: 1, amount: 1 }]);
  assert.ok(Math.abs(state.credits['1'] - 0.2) < 1e-9);
  assert.ok(Math.abs(state.credits['2'] - 0.6) < 1e-9);
});

test('passive regen resets credits at full HP, leaves KOs down, and handles clock rollback', () => {
  const heroes = [{ uid: 1, hp: 10, maxHP: 100 }, { uid: 2, hp: 100, maxHP: 100 }, { uid: 3, hp: 0, maxHP: 100 }];
  const state = advancePassiveHeroRegen({ now: 10, lastAt: 0, credits: { 1: 0.5, 2: 0.8, 3: 0.9 }, heroes });
  assert.deepEqual(state.heals, [{ uid: 1, amount: 4 }]);
  assert.deepEqual(state.credits, { 1: 0.5, 2: 0, 3: 0 });
  const rollback = advancePassiveHeroRegen({ now: 4, lastAt: 10, credits: { 1: 0.9 }, heroes });
  assert.deepEqual(rollback.heals, []);
  assert.equal(rollback.credits['1'], 0);
});

test('passive regen rejects invalid time and negative rates', () => {
  assert.throws(() => advancePassiveHeroRegen({ now: Number.NaN }), /finite time/);
  assert.throws(() => advancePassiveHeroRegen({ now: 0, fraction: -0.1 }), /nonnegative regeneration/);
});
