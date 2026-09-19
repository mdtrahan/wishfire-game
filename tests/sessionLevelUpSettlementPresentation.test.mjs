import test from 'node:test';
import assert from 'node:assert/strict';
import { beginSessionLevelUpSettlement, LOW_HP_WARNING_RATIO, settlementRowVisual, updateSessionLevelUpSettlement } from '../web-runner/modules/sessionLevelUpSettlementPresentation.mjs';

const heroes = [
  { uid: 1, heroInstanceKey: 'fara-1', heroDisplaySlot: 0, name: 'Falie', sp: 8, spMax: 10 },
];

test('settlement rows are temporary per-hero continuous fills and preserve the configurable low-HP default', () => {
  const globals = {};
  const settlement = beginSessionLevelUpSettlement(globals, [{ hero: 'Falie', exp: 120, expBefore: 80, expAfter: 20, expToNextBefore: 100, fromLevel: 1, toLevel: 2 }], heroes, 0);
  const visual = settlementRowVisual(settlement.rows[0], .8, settlement);
  assert.equal(settlement.rows[0].heroId, 'fara-1');
  assert.equal(visual.crossedLevels, 2);
  assert.ok(visual.progress >= 0 && visual.progress <= 1);
  assert.equal(LOW_HP_WARNING_RATIO, .25);
  settlement.phase = 'fadeOut'; settlement.fadeOutStartedAt = 1;
  assert.equal(updateSessionLevelUpSettlement(globals, 1.3), null);
});

test('a crossed threshold fills one bar, resets that bar, and carries its exact remainder', () => {
  const globals = {};
  const settlement = beginSessionLevelUpSettlement(globals, [{ hero: 'Falie', exp: 80, expBefore: 47, expAfter: 27, expToNextBefore: 100, fromLevel: 1, toLevel: 2 }], heroes, 0);
  const row = settlement.rows[0];
  assert.ok(settlementRowVisual(row, .30, settlement).progress > .47);
  assert.equal(settlementRowVisual(row, .40, settlement).progress, 0);
  assert.equal(settlementRowVisual(row, .70, settlement).progress, .27);
});
