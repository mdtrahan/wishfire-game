import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginFreshSessionBuffQueue,
  claimSessionBuffQueueResume,
  chooseSessionLevelUpBuff,
  getSessionLevelUpBuffPresentation,
  reconcileSessionFlowThresholds,
  restoreSessionBuffChoiceState,
  serializeSessionBuffChoiceState,
} from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';
import { resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';
import { pauseSessionLevelUpQueue, resumeSessionLevelUpQueue } from '../src/core/sessionLevelUpQueue.mjs';
import { buildAstralFlowSpecialOffer } from '../src/core/astralFlowSpecialOffers.mjs';
import { SESSION_LEVEL_UP_BUFF_CARDS, UNIVERSAL_SESSION_POWER_BUFF_CARDS, UNIVERSAL_SESSION_POWER_BUFF_IDS, isUniversalSessionPowerBuffCard } from '../src/core/sessionLevelBuffCatalog.mjs';

const heroes = () => [
  { uid: 1, kind: 'hero', heroInstanceKey: 'fara-1', heroDisplaySlot: 0, currentLevel: 1, hp: 40, maxHP: 40, flow: 70 },
  { uid: 2, kind: 'hero', heroInstanceKey: 'hondo-2', heroDisplaySlot: 1, currentLevel: 1, hp: 35, maxHP: 35, flow: 70 },
  { uid: 3, kind: 'hero', heroInstanceKey: 'runa-3', heroDisplaySlot: 2, currentLevel: 1, hp: 30, maxHP: 30, flow: 70 },
  { uid: 4, kind: 'hero', heroInstanceKey: 'kaja-4', heroDisplaySlot: 3, currentLevel: 1, hp: 45, maxHP: 45, flow: 70 },
];

const tierOne = { 1: 1, 2: 0, 3: 0, 4: 0 };

test('fresh sessions hold one cached neutral opening offer and apply it to every living starting hero', () => {
  const party = heroes();
  const globals = { RuntimeRandom: () => 0, SessionLevelUpTierWeights: tierOne, SessionLevelUpPreferredCardId: 'dawn_chorus_1' };
  beginFreshSessionBuffQueue(globals, party);
  assert.deepEqual(globals.SessionLevelUpQueue.entries, [{
    heroId: '__party_session__', heroUID: 0, earnedLevel: 0, earnedLevelIndex: 0,
    source: 'opening_party', participantHeroIds: ['fara-1', 'hondo-2', 'runa-3', 'kaja-4'],
  }]);
  const first = getSessionLevelUpBuffPresentation(globals, party);
  const rerender = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(first.open, true);
  assert.equal(first.heroUID, 0);
  assert.equal(first.cards.length, 3);
  assert.strictEqual(first.offer, rerender.offer);
  assert.ok(first.cards.every(isUniversalSessionPowerBuffCard));
  assert.equal(first.cards.some(card => card.effectId === 'dawn_chorus'), false);
  const selected = chooseSessionLevelUpBuff(globals, party, first.cards[0].cardId);
  assert.equal(selected.status, 'applied');
  assert.equal(selected.partyWide, true);
  assert.deepEqual(selected.affectedHeroIds, ['fara-1', 'hondo-2', 'runa-3', 'kaja-4']);
  assert.equal(globals.SessionLevelUpQueue.status, 'complete');
  assert.equal(globals.SessionLevelUpQueueResumeRequested, 1);
  assert.equal(claimSessionBuffQueueResume(globals), true);
  assert.equal(claimSessionBuffQueueResume(globals), false);
  assert.deepEqual(Object.keys(globals.SessionLevelBuffState.heroes).sort(), ['fara-1', 'hondo-2', 'kaja-4', 'runa-3']);
  for (const hero of party) assert.equal(globals.SessionLevelBuffState.heroes[hero.heroInstanceKey].activeStageByEffectId[first.cards[0].effectId], first.cards[0].stage);
});

test('opening Chain Strike selection closes its offer and releases combat exactly once', () => {
  const party = heroes();
  const globals = { RuntimeRandom: () => 0, SessionLevelUpTierWeights: tierOne, SessionLevelUpPreferredCardId: 'mirage_chain_1' };
  beginFreshSessionBuffQueue(globals, party);
  const offer = getSessionLevelUpBuffPresentation(globals, party);
  const chainStrike = offer.cards.find(card => card.cardId === 'mirage_chain_1');
  assert.ok(chainStrike);
  assert.equal(chooseSessionLevelUpBuff(globals, party, chainStrike.cardId, 0, null, offer.offerToken).status, 'applied');
  assert.equal(getSessionLevelUpBuffPresentation(globals, party).open, false);
  assert.equal(claimSessionBuffQueueResume(globals), true);
  assert.equal(claimSessionBuffQueueResume(globals), false);
});

test('one explicit universal power-buff allowlist admits persistent offense and rejects relief or direct action cards', () => {
  assert.ok(UNIVERSAL_SESSION_POWER_BUFF_IDS.includes('spectral_orb_1'));
  assert.ok(UNIVERSAL_SESSION_POWER_BUFF_IDS.includes('mirage_chain_1'));
  assert.ok(UNIVERSAL_SESSION_POWER_BUFF_IDS.includes('glass_reprisal_1'));
  assert.equal(UNIVERSAL_SESSION_POWER_BUFF_IDS.includes('inner_flow_1'), false);
  assert.equal(UNIVERSAL_SESSION_POWER_BUFF_IDS.some(id => id.startsWith('brass_ward_')), false);
  assert.equal(SESSION_LEVEL_UP_BUFF_CARDS.some(card => card.effectId === 'brass_ward' || /Brass Ward/.test(card.name)), false);
  assert.equal(isUniversalSessionPowerBuffCard({ cardId: 'af_magic_fruit' }), false);
  assert.equal(isUniversalSessionPowerBuffCard({ cardId: 'af_split' }), false);
  assert.equal(isUniversalSessionPowerBuffCard({ cardId: 'retired_turn_attack' }), false);
  assert.equal(UNIVERSAL_SESSION_POWER_BUFF_CARDS.length, 44);
  assert.equal(UNIVERSAL_SESSION_POWER_BUFF_CARDS.length, UNIVERSAL_SESSION_POWER_BUFF_IDS.length);
  assert.equal(SESSION_LEVEL_UP_BUFF_CARDS.filter(card => card.effectId === 'inner_flow').every(isUniversalSessionPowerBuffCard), false);
});

test('100 AF threshold choice queues once, waits for selection, resets only its owner, and acknowledges the token', () => {
  const party = heroes();
  const globals = {
    RuntimeRandom: () => 0,
    SessionLevelUpTierWeights: tierOne,
    SessionLevelBuffState: { heroes: {} },
    SessionLevelUpQueue: { version: 1, status: 'complete', paused: false, currentIndex: 0, entries: [] },
    PendingFlowThresholds: [{ heroUID: 2, triggerOrder: 4, token: 'flow-7-4' }],
  };
  party[1].flow = 100;
  reconcileSessionFlowThresholds(globals, party);
  reconcileSessionFlowThresholds(globals, party);
  assert.equal(globals.SessionLevelUpQueue.entries.length, 1);
  assert.equal(globals.SessionLevelUpQueue.entries[0].thresholdToken, 'flow-7-4');
  assert.equal(party[1].flow, 100);
  const offer = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(offer.heroUID, 2);
  assert.equal(offer.cards.length, 3);
  assert.equal(offer.cards[0].name, 'Split');
  assert.deepEqual(new Set(offer.cards.slice(1).map(card => card.specialId)).size, 2);
  assert.ok(offer.cards.every(card => card.lifetime === 'one_use_active'));
  assert.equal(chooseSessionLevelUpBuff(globals, party, offer.cards[0].cardId, 0, (card, hero) => ({ ok: true, card, heroUID: hero.uid })).status, 'applied');
  assert.equal(party[1].flow, 0);
  assert.equal(party[0].flow, 70);
  assert.deepEqual(globals.PendingFlowThresholds, []);
  assert.equal(claimSessionBuffQueueResume(globals), true);
  assert.equal(claimSessionBuffQueueResume(globals), false);
});

test('AF special offers cache their signature and party-special RNG across rerenders', () => {
  const party = heroes();
  const globals = {
    RuntimeRandom: (() => { const values = [0.95, 0.1, 0.7]; let index = 0; return () => values[index++] ?? 0; })(),
    SessionLevelBuffState: { heroes: {} },
    SessionLevelUpQueue: { version: 1, status: 'complete', paused: false, currentIndex: 0, entries: [] },
    PendingFlowThresholds: [{ heroUID: 4, triggerOrder: 1, token: 'kaja-100' }],
  };
  reconcileSessionFlowThresholds(globals, party);
  const first = getSessionLevelUpBuffPresentation(globals, party);
  const second = getSessionLevelUpBuffPresentation(globals, party);
  assert.strictEqual(first.offer, second.offer);
  assert.equal(first.cards[0].name, 'Destiny');
  assert.equal(new Set(first.cards.map(card => card.cardId)).size, 3);
  assert.equal(new Set(first.cards.slice(1).map(card => card.specialId)).size, 2);
  assert.ok(first.cards.every(card => card.source === 'astral_flow_special'));
});

test('AF special signatures map each canonical hero and never duplicate party cards', () => {
  assert.deepEqual(
    heroes().map(hero => buildAstralFlowSpecialOffer({ hero, rng: () => 0 }).cards[0].specialId),
    ['crimson_ward', 'split', 'arcane_pulse', 'destiny'],
  );
  for (const hero of heroes()) {
    const offer = buildAstralFlowSpecialOffer({ hero, rng: () => 0.5 });
    assert.equal(offer.cards.length, 3);
    assert.equal(new Set(offer.cards.slice(1).map(card => card.specialId)).size, 2);
  }
});

test('simultaneous threshold choices sort by roster before trigger order and persist without changing CTB or RNG', () => {
  const party = heroes();
  const globals = {
    RuntimeRandom: () => 0,
    SessionLevelUpTierWeights: tierOne,
    SessionLevelBuffState: { heroes: {} },
    SessionLevelUpQueue: { version: 1, status: 'complete', paused: false, currentIndex: 0, entries: [] },
    PendingFlowThresholds: [
      { heroUID: 3, triggerOrder: 1, token: 'runa' },
      { heroUID: 1, triggerOrder: 9, token: 'fara' },
      { heroUID: 2, triggerOrder: 2, token: 'hondo' },
    ],
    CombatSessionId: 8, CurrentTurnIndex: 5, TurnSerial: 22, TurnPhase: 1,
    RuntimeRandomSeed: 99, RuntimeRandomDraws: 12, RuntimeRandomOwner: 'combat', RuntimeRandomReason: 'attack',
  };
  reconcileSessionFlowThresholds(globals, party);
  assert.deepEqual(globals.SessionLevelUpQueue.entries.map(entry => entry.heroId), ['fara-1', 'hondo-2', 'runa-3']);
  globals.SessionLevelUpQueue = pauseSessionLevelUpQueue(globals.SessionLevelUpQueue);
  const snapshot = serializeSessionBuffChoiceState(globals);
  const restored = {};
  restoreSessionBuffChoiceState(restored, snapshot);
  assert.deepEqual(restored, snapshot);
  restored.SessionLevelUpQueue = resumeSessionLevelUpQueue(restored.SessionLevelUpQueue);
  assert.equal(getSessionLevelUpBuffPresentation(restored, party).open, true);
});

test('fresh condition reset clears session-owned queue and threshold remnants without touching permanent hero data', () => {
  const globals = { PendingFlowThresholds: [{ token: 'old' }], SessionLevelBuffState: { heroes: { old: {} } }, SessionLevelUpQueue: { status: 'active' }, RuntimeRandomSeed: 9 };
  const gameState = {};
  resetCombatSessionConditions(globals, gameState);
  assert.deepEqual(globals.PendingFlowThresholds, []);
  assert.deepEqual(globals.SessionLevelBuffState, { heroes: {} });
  assert.equal(globals.SessionLevelUpQueue.status, 'complete');
});


test('QA preferred party special remains inside the live signature plus two-distinct-special offer', () => {
  const offer = buildAstralFlowSpecialOffer({ hero: heroes()[2], rng: () => 0, preferredSpecialId: 'magic_fruit' });
  assert.equal(offer.cards[0].specialId, 'arcane_pulse');
  assert.ok(offer.cards.slice(1).some(card => card.specialId === 'magic_fruit'));
  assert.equal(new Set(offer.cards.slice(1).map(card => card.specialId)).size, 2);
});

test('QA preferred special does not alter production offer randomness when omitted', () => {
  const hero = heroes()[0];
  const normal = buildAstralFlowSpecialOffer({ hero, rng: () => 0.8 });
  const explicitEmpty = buildAstralFlowSpecialOffer({ hero, rng: () => 0.8, preferredSpecialId: '' });
  assert.deepEqual(normal.cards.map(card => card.specialId), explicitEmpty.cards.map(card => card.specialId));
});

test('resume handoff records one consumed scheduler release', () => {
  const globals = { SessionLevelUpQueueResumeRequested: 1, SessionLevelUpQueue: { status: 'complete' } };
  assert.equal(claimSessionBuffQueueResume(globals), true);
  assert.equal(globals.SessionLevelUpQueueResumeConsumed, 1);
  assert.equal(claimSessionBuffQueueResume(globals), false);
  assert.equal(globals.SessionLevelUpQueueResumeConsumed, 1);
});


test('shipped AF bridge turns a capped Fara token after the opening queue into a cached fan offer and resumes once', () => {
  const party = heroes();
  party[0].flow = 100;
  const globals = {
    CombatSessionId: 3,
    RuntimeRandom: () => 0,
    SessionLevelBuffState: { heroes: {} },
    SessionLevelUpQueue: { version: 1, status: 'complete', paused: false, currentIndex: 1, entries: [{ heroId: '__party_session__', heroUID: 0, source: 'opening_party', participantHeroIds: party.map(hero => hero.heroInstanceKey) }] },
    SessionLevelUpOffersByQueueIndex: {},
  };
  const token = { heroUID: 1, triggerOrder: 1, token: 'flow-3-1' };
  globals.PendingFlowThresholds = [token];
  reconcileSessionFlowThresholds(globals, party);
  const fan = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(globals.SessionLevelUpQueue.status, 'active');
  assert.equal(fan.open, true);
  assert.deepEqual(fan.cards.map(card => card.specialId), ['crimson_ward', 'magic_fruit', 'chain_strike_ii']);
  const selected = chooseSessionLevelUpBuff(globals, party, fan.cards[0].cardId, 0, () => ({ ok: true, effect: 'ward' }));
  assert.equal(selected.status, 'applied');
  assert.equal(party[0].flow, 0);
  assert.deepEqual(globals.PendingFlowThresholds, []);
  assert.equal(claimSessionBuffQueueResume(globals), true);
  assert.equal(claimSessionBuffQueueResume(globals), false);
});

test('live AF choice leaves its owned deferred handoff as the only scheduler resume', () => {
  const party = heroes();
  party[3].flow = 100;
  const globals = {
    RuntimeRandom: () => 0,
    SessionLevelBuffState: { heroes: {} },
    SessionLevelUpQueue: { version: 1, status: 'complete', paused: false, currentIndex: 0, entries: [] },
    PendingFlowThresholds: [{ heroUID: 4, triggerOrder: 1, token: 'flow-live-kaja' }],
    DeferAdvance: 1,
    AdvanceAfterAction: 1,
    ActionOwnerUID: 7,
  };
  reconcileSessionFlowThresholds(globals, party);
  const fan = getSessionLevelUpBuffPresentation(globals, party);
  const destiny = fan.cards.find(card => card.specialId === 'destiny');
  assert.ok(destiny);
  assert.equal(chooseSessionLevelUpBuff(globals, party, destiny.cardId, 0, () => ({ ok: true })).status, 'applied');
  assert.equal(globals.DeferAdvance, 1);
  assert.equal(globals.ActionOwnerUID, 7);
  assert.equal(claimSessionBuffQueueResume(globals), false);
});


test('post-opening AF threshold resolves its recreated live hero by UID and never produces an empty special offer', () => {
  const party = heroes();
  const globals = {
    RuntimeRandom: () => 0,
    SessionLevelBuffState: { heroes: {} },
    SessionLevelUpQueue: {
      version: 1, status: 'complete', paused: false, currentIndex: 1,
      entries: [{ heroId: '__party_session__', heroUID: 0, source: 'opening_party', participantHeroIds: party.map(hero => hero.heroInstanceKey) }],
    },
    PendingFlowThresholds: [{ heroUID: 1, triggerOrder: 1, token: 'post-opening-fara' }],
  };
  reconcileSessionFlowThresholds(globals, party);
  const fan = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(fan.open, true);
  assert.deepEqual(fan.cards.map(card => card.specialId), ['crimson_ward', 'magic_fruit', 'chain_strike_ii']);
  assert.equal(fan.cards[0].presentation.heroUID, 1);
});
