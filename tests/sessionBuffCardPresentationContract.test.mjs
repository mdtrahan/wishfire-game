import test from 'node:test';
import assert from 'node:assert/strict';
import { beginFreshSessionBuffQueue, getSessionLevelUpBuffPresentation, reconcileSessionFlowThresholds } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';
import { SESSION_LEVEL_UP_BUFF_CARDS } from '../src/core/sessionLevelBuffCatalog.mjs';

const party = () => [
  { uid: 1, kind: 'hero', heroInstanceKey: 'fara#1', baseHeroName: 'Fara', name: 'Fara', heroDisplaySlot: 0, currentLevel: 1, hp: 40, maxHP: 40 },
  { uid: 2, kind: 'hero', heroInstanceKey: 'hondo#1', baseHeroName: 'Hondo', name: 'Hondo', heroDisplaySlot: 1, currentLevel: 1, hp: 35, maxHP: 35 },
  { uid: 3, kind: 'hero', heroInstanceKey: 'runa#1', baseHeroName: 'Runa', name: 'Runa', heroDisplaySlot: 2, currentLevel: 1, hp: 30, maxHP: 30 },
  { uid: 4, kind: 'hero', heroInstanceKey: 'kaja#1', baseHeroName: 'Kaja', name: 'Kaja', heroDisplaySlot: 3, currentLevel: 1, hp: 45, maxHP: 45 },
];

test('opening universal session cards are neutral view models without hero ownership', () => {
  const heroes = party();
  const globals = { RuntimeRandom: () => 0, SessionLevelUpTierWeights: { 1: 1, 2: 0, 3: 0, 4: 0 } };
  beginFreshSessionBuffQueue(globals, heroes);
  const offer = getSessionLevelUpBuffPresentation(globals, heroes);
  assert.equal(offer.cards.length, 3);
  for (const card of offer.cards) {
    assert.deepEqual(card.presentation, { kind: 'neutral' });
    assert.equal('heroUID' in card.presentation, false);
    assert.equal('heroName' in card.presentation, false);
  }
});

test('mixed Fara AF offer has one matching signature presentation and two neutral party cards', () => {
  const heroes = party();
  const globals = {
    RuntimeRandom: () => 0,
    SessionLevelBuffState: { heroes: {} },
    SessionLevelUpQueue: { version: 1, status: 'complete', paused: false, currentIndex: 0, entries: [] },
    PendingFlowThresholds: [{ heroUID: 1, triggerOrder: 1, token: 'flow-fara' }],
  };
  reconcileSessionFlowThresholds(globals, heroes);
  const offer = getSessionLevelUpBuffPresentation(globals, heroes);
  assert.equal(offer.cards[0].name, 'Crimson Ward');
  assert.deepEqual(offer.cards[0].presentation, { kind: 'hero_signature', heroUID: 1, heroName: 'Fara' });
  for (const card of offer.cards.slice(1)) {
    assert.deepEqual(card.presentation, { kind: 'neutral' });
    assert.equal('heroUID' in card.presentation, false);
    assert.equal('heroName' in card.presentation, false);
  }
});

test('Chain Strike display names coexist with the separate Chain Strike II AF special', () => {
  assert.equal(SESSION_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'mirage_chain_1')?.name, 'Chain Strike');
  assert.equal(SESSION_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'mirage_chain_2')?.name, 'Chain Strike II');
  const heroes = party();
  const globals = { RuntimeRandom: () => 0, SessionLevelBuffState: { heroes: {} }, SessionLevelUpQueue: { version: 1, status: 'complete', paused: false, currentIndex: 0, entries: [] }, PendingFlowThresholds: [{ heroUID: 2, triggerOrder: 1, token: 'flow-hondo' }] };
  reconcileSessionFlowThresholds(globals, heroes);
  assert.ok(getSessionLevelUpBuffPresentation(globals, heroes).cards.some(card => card.name === 'Chain Strike II'));
});
