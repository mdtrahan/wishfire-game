import test from 'node:test';
import assert from 'node:assert/strict';
import { beginSessionLevelUpSettlement, chooseSessionLevelUpBuff, getSessionLevelUpBuffPresentation, LOW_HP_WARNING_RATIO, QA_LEVEL_UP_BUFF_CARDS, settlementRowVisual, updateSessionLevelUpSettlement } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';

const heroes = [
  { uid: 1, heroInstanceKey: 'fara-1', heroDisplaySlot: 0, name: 'Falie', sp: 8, spMax: 10 },
  { uid: 2, heroInstanceKey: 'hondo-2', heroDisplaySlot: 1, name: 'Huun', sp: 7, spMax: 10 },
];

test('settlement rows are temporary per-hero continuous fills and preserve the configurable low-HP default', () => {
  const globals = { SessionLevelUpQueue: { status: 'active', paused: false, currentIndex: 0, entries: [{ heroId: 'fara-1', heroUID: 1, earnedLevel: 2 }] } };
  const settlement = beginSessionLevelUpSettlement(globals, [{ hero: 'Falie', exp: 120, expBefore: 80, expAfter: 20, expToNextBefore: 100, fromLevel: 1, toLevel: 2 }], heroes, 0);
  const visual = settlementRowVisual(settlement.rows[0], .8, settlement);
  assert.equal(settlement.rows[0].heroId, 'fara-1');
  assert.equal(visual.crossedLevels, 2);
  assert.ok(visual.progress >= 0 && visual.progress <= 1, 'one bar is either filling or reset for the next level');
  assert.equal(LOW_HP_WARNING_RATIO, .25);
  settlement.phase = 'fadeOut'; settlement.fadeOutStartedAt = 1;
  assert.equal(updateSessionLevelUpSettlement(globals, 1.3), null);
});

test('a crossed threshold fills one bar, resets that bar, carries its exact remainder, then opens the queued choice', () => {
  const globals = { time: 0, RuntimeRandom: () => 0, SessionLevelUpQueue: { status: 'active', paused: false, currentIndex: 0, entries: [{ heroId: 'fara-1', heroUID: 1, earnedLevel: 2 }] } };
  const settlement = beginSessionLevelUpSettlement(globals, [{ hero: 'Falie', exp: 80, expBefore: 47, expAfter: 27, expToNextBefore: 100, fromLevel: 1, toLevel: 2 }], heroes, 0);
  const row = settlement.rows[0];
  const beforeThreshold = settlementRowVisual(row, .30, settlement);
  const reset = settlementRowVisual(row, .40, settlement);
  const complete = settlementRowVisual(row, .70, settlement);
  assert.ok(beforeThreshold.progress > .47 && beforeThreshold.progress <= 1);
  assert.equal(reset.progress, 0, 'the same bar fast-resets between levels');
  assert.equal(complete.progress, .27, 'the exact carried remainder ends at 27 of 100');
  assert.equal(complete.complete, true);
  globals.time = .30;
  assert.equal(getSessionLevelUpBuffPresentation(globals, heroes).awaitingEXP, true);
  globals.time = .70;
  assert.equal(getSessionLevelUpBuffPresentation(globals, heroes).open, true);
});

test('the queued hero alone receives one same-tier three-card QA offer and selection advances the queue', () => {
  const globals = { RuntimeRandom: () => 0, SessionLevelUpQueue: { status: 'active', paused: false, currentIndex: 0, entries: [{ heroId: 'fara-1', heroUID: 1, earnedLevel: 2 }, { heroId: 'hondo-2', heroUID: 2, earnedLevel: 2 }] } };
  beginSessionLevelUpSettlement(globals, [], heroes, 0);
  const offer = getSessionLevelUpBuffPresentation(globals, heroes);
  assert.equal(offer.open, true);
  assert.equal(offer.heroUID, 1);
  assert.equal(offer.cards.length, 3);
  assert.deepEqual(new Set(offer.cards.map(card => card.tier)), new Set([1]));
  assert.ok(offer.cards.every(card => QA_LEVEL_UP_BUFF_CARDS.some(known => known.cardId === card.cardId)));
  const applied = chooseSessionLevelUpBuff(globals, heroes, offer.cards[0].cardId, 1);
  assert.equal(applied.status, 'applied');
  assert.equal(globals.SessionLevelUpQueue.currentIndex, 1);
  assert.ok(globals.SessionLevelBuffState.heroes['fara-1']);
  assert.equal(globals.SessionLevelBuffState.heroes['hondo-2'], undefined);
});
