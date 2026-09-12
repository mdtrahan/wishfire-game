import test from 'node:test';
import assert from 'node:assert/strict';
import { beginSessionLevelUpSettlement, chooseSessionLevelUpBuff, getSessionLevelUpBuffPresentation, LOW_HP_WARNING_RATIO, QA_LEVEL_UP_BUFF_CARDS, settlementRowVisual, updateSessionLevelUpSettlement } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';
import { applyLevelUpBuffCard, getEligibleLevelUpBuffCards } from '../src/core/sessionLevelBuffOffers.mjs';
import { createSessionLevelUpQueue } from '../web-runner/src/core/sessionLevelUpQueue.mjs';

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
  assert.equal(getSessionLevelUpBuffPresentation(globals, heroes).dancing, true, 'the actual owner dance begins after EXP finishes');
  globals.time = 1.10;
  assert.equal(getSessionLevelUpBuffPresentation(globals, heroes).open, true, 'cards reveal after the dance completes');
});

test('the queued hero alone receives one same-tier three-card QA offer and selection advances the queue', () => {
  const globals = { time: 1, RuntimeRandom: () => 0, SessionLevelUpTierWeights: { 1: 1, 2: 0, 3: 0, 4: 0 }, SessionLevelUpQueue: { status: 'active', paused: false, currentIndex: 0, entries: [{ heroId: 'fara-1', heroUID: 1, earnedLevel: 2 }, { heroId: 'hondo-2', heroUID: 2, earnedLevel: 2 }] } };
  beginSessionLevelUpSettlement(globals, [], heroes, 0);
  getSessionLevelUpBuffPresentation(globals, heroes);
  globals.time = 2;
  const offer = getSessionLevelUpBuffPresentation(globals, heroes);
  assert.equal(offer.open, true);
  const firstOfferToken = offer.offerToken;
  assert.equal(offer.heroUID, 1);
  assert.equal(offer.cards.length, 3);
  assert.ok(offer.cards.every(card => card.id === card.cardId));
  assert.deepEqual(new Set(offer.cards.map(card => card.tier)), new Set([1]));
  assert.ok(offer.cards.every(card => QA_LEVEL_UP_BUFF_CARDS.some(known => known.cardId === card.cardId)));
  const applied = chooseSessionLevelUpBuff(globals, heroes, offer.cards[0].cardId, 1);
  assert.equal(applied.status, 'applied');
  assert.equal(globals.SessionLevelUpQueue.currentIndex, 1);
  assert.ok(globals.SessionLevelBuffState.heroes['fara-1']);
  assert.equal(globals.SessionLevelBuffState.heroes['hondo-2'], undefined);
  globals.SessionLevelUpQueue = { status: 'active', paused: false, currentIndex: 0, entries: [{ heroId: 'fara-1', heroUID: 1, earnedLevel: 3 }] };
  beginSessionLevelUpSettlement(globals, [], heroes, 0);
  globals.time = 2;
  const laterOffer = getSessionLevelUpBuffPresentation(globals, heroes);
  assert.notEqual(laterOffer.offerToken, firstOfferToken, 'a later settlement gets a fresh fan identity at queue index zero');
});

test('a completed settlement starts a fresh active queue for a staged T2 victory offer', () => {
  const globals = {
    time: 2,
    RuntimeRandom: () => 0,
    SessionLevelUpTierWeights: { 1: 0, 2: 1, 3: 0, 4: 0 },
    SessionLevelBuffState: applyLevelUpBuffCard({ state: {}, heroId: 'fara-1', cardId: 'qa_orb_cadence_1', cards: QA_LEVEL_UP_BUFF_CARDS }).state,
    SessionLevelUpQueue: { status: 'complete', paused: false, currentIndex: 1, entries: [] },
  };
  const results = [{ hero: 'Falie', exp: 80, expBefore: 47, expAfter: 27, expToNextBefore: 100, fromLevel: 2, toLevel: 3 }];
  globals.SessionLevelUpQueue = createSessionLevelUpQueue({ heroes: [heroes[0]], progressionResults: results });
  beginSessionLevelUpSettlement(globals, results, heroes, 0);
  globals.time = 3;
  getSessionLevelUpBuffPresentation(globals, heroes);
  globals.time = 4;
  const t2 = getSessionLevelUpBuffPresentation(globals, heroes);
  assert.equal(globals.SessionLevelUpQueue.status, 'active');
  assert.equal(t2.open, true);
  assert.ok(t2.cards.some(card => card.cardId === 'qa_orb_cadence_2'));
  assert.ok(t2.heroUID > 0, 'the fresh victory settlement retains a concrete owner');
});

test('displayed canonical card ids select their own record and QA T2 grants replace the prior stage', () => {
  assert.equal(QA_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'qa_atk_focus_2').formula.percent, .18);
  assert.deepEqual(QA_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'qa_pulse_1').formula, { surface: 'cadence_magic_damage', everyCompletedBasics: 2, amount: 6 });
  assert.deepEqual(QA_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'qa_orb_cadence_1').formula, { surface: 'cadence_magic_damage', everyCompletedBasics: 3, amount: 4 });
  assert.deepEqual(QA_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'qa_orb_cadence_2').formula, { surface: 'cadence_magic_damage', everyCompletedBasics: 2, amount: 6 });
  const state = { heroes: {} };
  const first = applyLevelUpBuffCard({ state, heroId: 'fara-1', cardId: 'qa_atk_focus_1', cards: QA_LEVEL_UP_BUFF_CARDS });
  assert.equal(first.status, 'applied');
  const eligible = getEligibleLevelUpBuffCards({ state: first.state, heroId: 'fara-1', cards: QA_LEVEL_UP_BUFF_CARDS, tier: 2 });
  assert.deepEqual(eligible.filter(card => card.effectId === 'qa_atk_focus').map(card => card.id), ['qa_atk_focus_2']);
  const upgraded = applyLevelUpBuffCard({ state: first.state, heroId: 'fara-1', cardId: eligible[0].id, cards: QA_LEVEL_UP_BUFF_CARDS });
  assert.equal(upgraded.replacedStage, 1);
  assert.equal(upgraded.state.heroes['fara-1'].activeStageByEffectId.qa_atk_focus, 2);
  const orbFirst = applyLevelUpBuffCard({ state: upgraded.state, heroId: 'fara-1', cardId: 'qa_orb_cadence_1', cards: QA_LEVEL_UP_BUFF_CARDS });
  assert.equal(applyLevelUpBuffCard({ state: orbFirst.state, heroId: 'fara-1', cardId: 'qa_orb_cadence_2', cards: QA_LEVEL_UP_BUFF_CARDS }).status, 'applied');
});

test('QA tier forcing drives the same gated offer builder after a real base grant', () => {
  const initial = applyLevelUpBuffCard({ state: { heroes: {} }, heroId: 'fara-1', cardId: 'qa_atk_focus_1', cards: QA_LEVEL_UP_BUFF_CARDS });
  const globals = {
    time: 2, RuntimeRandom: () => 0, SessionLevelBuffState: initial.state,
    SessionLevelUpTierWeights: { 1: 0, 2: 1, 3: 0, 4: 0 },
    SessionLevelUpQueue: { status: 'active', paused: false, currentIndex: 0, entries: [{ heroId: 'fara-1', heroUID: 1, earnedLevel: 3 }] },
  };
  beginSessionLevelUpSettlement(globals, [], heroes, 0);
  getSessionLevelUpBuffPresentation(globals, heroes);
  globals.time = 3;
  const offer = getSessionLevelUpBuffPresentation(globals, heroes);
  assert.equal(offer.offer.tier, 2);
  assert.ok(offer.cards.some(card => card.cardId === 'qa_atk_focus_2'), 'the staged upgrade reaches the real deterministic offer');
});


test('the QA-only offer pool still uses the production generator and exposes the requested same-tier fixture', () => {
  const requested = QA_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'qa_power_bargain_1');
  const globals = {
    time: 2, RuntimeRandom: () => 0,
    SessionLevelUpTierWeights: { 1: 1, 2: 0, 3: 0, 4: 0 },
    SessionLevelUpPreferredCardId: requested.cardId,
    SessionLevelUpQaOfferCards: [requested, ...QA_LEVEL_UP_BUFF_CARDS.filter(card => card.tier === 1 && card.kind === 'stat').slice(0, 2)],
    SessionLevelUpQueue: { status: 'active', paused: false, currentIndex: 0, entries: [{ heroId: 'fara-1', heroUID: 1, earnedLevel: 2 }] },
  };
  beginSessionLevelUpSettlement(globals, [], heroes, 0);
  getSessionLevelUpBuffPresentation(globals, heroes);
  globals.time = 3;
  const presentation = getSessionLevelUpBuffPresentation(globals, heroes);
  assert.equal(presentation.offer.status, 'offered');
  assert.equal(presentation.cards.length, 3);
  assert.ok(presentation.cards.some(card => card.cardId === requested.cardId));
  assert.ok(presentation.cards.every(card => card.tier === 1));
});
