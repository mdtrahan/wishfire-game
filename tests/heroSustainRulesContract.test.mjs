import test from 'node:test';
import assert from 'node:assert/strict';
import { fillGearMaxHpGrowth } from '../web-runner/src/core/heroMaxHpPolicy.mjs';

test('gear max HP growth adds the capacity increase without healing a KO hero', () => {
  assert.equal(fillGearMaxHpGrowth(30, 100, 125), 55);
  assert.equal(fillGearMaxHpGrowth(30, 125, 100), 30);
  assert.equal(fillGearMaxHpGrowth(0, 100, 125), 0);
  assert.equal(fillGearMaxHpGrowth(140, 100, 125), 125);
});
