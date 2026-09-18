import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HERO_TURN_CARD_CONFIG,
  HERO_TURN_CARDS,
  createHeroTurnCardState,
  drawHeroTurnCards,
  getHeroTurnCards,
  resetHeroTurnCardState,
} from '../web-runner/src/core/heroTurnCards.mjs';

const HEROES = ['Fara', 'Hondo', 'Runa', 'Kaja'];
const nextRng = (...values) => {
  let index = 0;
  return () => values[index++] ?? 0;
};

test('exports eight exact canonical personal cards per hero and no Fortune cards', () => {
  assert.deepEqual(Object.keys(HERO_TURN_CARDS), HEROES);
  assert.deepEqual(HEROES.map(hero => getHeroTurnCards(hero).length), [8, 8, 8, 8]);
  const cards = HEROES.flatMap(getHeroTurnCards);
  assert.equal(cards.length, 32);
  assert.equal(new Set(cards.map(card => card.id)).size, 32);
  assert.ok(cards.every(card => card.hero && card.name && card.effect && card.rarity));
  assert.ok(cards.every(card => !/fortune/i.test(`${card.id} ${card.name} ${card.effect}`)));
  assert.deepEqual(cards.filter(card => card.hero === 'Fara').map(card => card.name), [
    'Brass Strike', 'Sentinel Step', 'Oath-Ring Ward', 'Gate of Brass',
    'Commanding Challenge', 'Sandlock', 'Warding Lamp', 'Sovereign’s Intercession',
  ]);
  assert.equal(getHeroTurnCards('Hondo')[1].effect, 'Attack one enemy for light damage and apply Mark.');
  assert.equal(getHeroTurnCards('Hondo')[7].effect, 'Attack one enemy for light damage, increased to moderate against enemies with Mark.');
  assert.equal(getHeroTurnCards('Runa')[5].effect, 'Slightly delay one enemy’s next turn and apply Weaken.');
  assert.equal(getHeroTurnCards('Kaja')[6].effect, 'Give another ally a small shield.');
  assert.ok([getHeroTurnCards('Hondo')[1], getHeroTurnCards('Hondo')[7], getHeroTurnCards('Runa')[5], getHeroTurnCards('Kaja')[6]]
    .every(card => !/energy|cost|resource/i.test(card.effect)));
  assert.equal(getHeroTurnCards('Runa')[6].effect, 'Attack every enemy with starlight for moderate damage.');
  assert.equal(getHeroTurnCards('Kaja')[7].effect, 'Heal every living ally for a large amount and cleanse one harmful effect from each.');
});

test('draws three distinct cards from the active hero pool only', () => {
  const result = drawHeroTurnCards('Fara', createHeroTurnCardState(), nextRng(0, 0, 0, 0, 0, 0));
  assert.equal(result.cards.length, 3);
  assert.equal(new Set(result.cards.map(card => card.name)).size, 3);
  assert.ok(result.cards.every(card => card.hero === 'Fara'));
  assert.deepEqual(result.state.heroes.Fara, { noRareTurns: 1, noEpicTurns: 1 });
  assert.deepEqual(createHeroTurnCardState(), result.state.heroes.Hondo ? { heroes: { Fara: { noRareTurns: 0, noEpicTurns: 0 }, Hondo: { noRareTurns: 0, noEpicTurns: 0 }, Runa: { noRareTurns: 0, noEpicTurns: 0 }, Kaja: { noRareTurns: 0, noEpicTurns: 0 } } } : null);
});

test('rarity weights are configurable and fallback chooses an available tier', () => {
  assert.deepEqual(HERO_TURN_CARD_CONFIG.rarityWeights, { Common: 60, Rare: 27, Epic: 10, Legendary: 3 });
  const sparse = getHeroTurnCards('Fara').filter(card => card.rarity === 'Common').slice(0, 2);
  const result = drawHeroTurnCards('Fara', createHeroTurnCardState(), () => 0.999, { eligibleCards: [...sparse, sparse[0], { ...sparse[0], rarity: 'Unknown' }] });
  assert.equal(result.cards.length, 3);
  assert.equal(result.cards.filter(card => card.isBasicFallback).length, 1);
  assert.equal(result.cards.filter(card => !card.isBasicFallback).length, 2);
  assert.ok(result.cards.every(card => card.hero === 'Fara'));
});

test('rare and epic guarantees trigger after hidden miss thresholds and reset on satisfaction', () => {
  let state = createHeroTurnCardState();
  const commonOnly = getHeroTurnCards('Fara').filter(card => card.rarity === 'Common');
  for (let turn = 0; turn < 3; turn += 1) {
    const miss = drawHeroTurnCards('Fara', state, () => 0, { eligibleCards: commonOnly });
    state = miss.state;
  }
  assert.equal(state.heroes.Fara.noRareTurns, 3);
  const rare = drawHeroTurnCards('Fara', state, nextRng(0, 0, 0, 0), { eligibleCards: getHeroTurnCards('Fara') });
  assert.ok(rare.cards.some(card => ['Rare', 'Epic', 'Legendary'].includes(card.rarity)));
  assert.equal(rare.state.heroes.Fara.noRareTurns, 0);

  state = createHeroTurnCardState();
  for (let turn = 0; turn < 6; turn += 1) {
    const miss = drawHeroTurnCards('Fara', state, () => 0, { eligibleCards: commonOnly });
    state = miss.state;
  }
  const epic = drawHeroTurnCards('Fara', state, nextRng(0, 0, 0, 0), { eligibleCards: getHeroTurnCards('Fara') });
  assert.ok(epic.cards.some(card => ['Epic', 'Legendary'].includes(card.rarity)));
  assert.equal(epic.state.heroes.Fara.noEpicTurns, 0);
});

test('state is JSON-safe, aliases resolve, and reset clears one hero without touching others', () => {
  const drawn = drawHeroTurnCards({ baseHeroName: 'Falie' }, createHeroTurnCardState(), () => 0);
  assert.equal(drawn.hero, 'Fara');
  assert.doesNotThrow(() => JSON.stringify(drawn.state));
  const other = { ...drawn.state, heroes: { ...drawn.state.heroes, Hondo: { noRareTurns: 2, noEpicTurns: 4 } } };
  const reset = resetHeroTurnCardState(other, 'Fara');
  assert.deepEqual(reset.heroes.Fara, { noRareTurns: 0, noEpicTurns: 0 });
  assert.deepEqual(reset.heroes.Hondo, { noRareTurns: 2, noEpicTurns: 4 });
});
