import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_LEVEL_UP_BUFF_CARDS,
  SESSION_LEVEL_UP_BUFF_POOL_SUMMARY,
} from '../src/core/sessionLevelBuffCatalog.mjs';
import {
  applyLevelUpBuffCard,
  buildLevelUpBuffOffer,
  createSessionLevelBuffState,
  getEligibleLevelUpBuffCards,
} from '../src/core/sessionLevelBuffOffers.mjs';

const tiers = [1, 2, 3, 4];
const cardById = id => SESSION_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === id);
const cardsForEffect = effectId => SESSION_LEVEL_UP_BUFF_CARDS.filter(card => card.effectId === effectId).sort((a, b) => a.stage - b.stage);
const freshState = () => createSessionLevelBuffState();

test('Wishfire session pool is exactly 48 universal cards with twelve cards in every tier', () => {
  assert.equal(SESSION_LEVEL_UP_BUFF_CARDS.length, 48);
  assert.deepEqual(SESSION_LEVEL_UP_BUFF_POOL_SUMMARY, { total: 48, byTier: { 1: 12, 2: 12, 3: 12, 4: 12 } });
  assert.deepEqual(new Set(SESSION_LEVEL_UP_BUFF_CARDS.map(card => card.cardId)).size, 48);
  for (const tier of tiers) {
    const cards = SESSION_LEVEL_UP_BUFF_CARDS.filter(card => card.tier === tier);
    assert.equal(cards.length, 12);
    assert.equal(new Set(cards.map(card => card.rarity)).size, 1);
    assert.ok(cards.filter(card => card.kind === 'behavior').length >= 3);
    assert.ok(cards.filter(card => card.kind === 'stat' || card.kind === 'bargain').length >= 3);
  }
});

test('every card is shared session content with readable numeric copy and no retired tactical identity', () => {
  const retiredTerms = /qa_|capybara|magic fruit|tempo|weaken|mark|\bsp\b|energy|cooldown/i;
  for (const card of SESSION_LEVEL_UP_BUFF_CARDS) {
    assert.equal(card.id, card.cardId);
    assert.equal(card.lane, 'shared_card');
    assert.equal(card.lifetime, 'session');
    assert.equal(card.acquisitionSource, 'level_up');
    assert.deepEqual(card.ownership, { kind: 'shared', ownerId: 'session' });
    assert.equal(card.effect, card.description);
    assert.ok(/\d/.test(card.effect), `${card.cardId} exposes a numeric player-facing effect`);
    assert.equal(card.effect, card.ranks[0].effects && card.description);
    assert.equal(card.maxRank, 1);
    assert.equal(card.ranks.length, 1);
    assert.deepEqual(card.formula, card.ranks[0].effects);
    assert.equal(card.limits.stackCap, 1);
    assert.equal(card.limits.uptimeCap, 1);
    assert.equal(card.limits.procDepthCap, 0);
    assert.equal(card.limits.entityCap, 0);
    assert.equal(card.effects.spawnsEntities, false);
    assert.equal(card.trigger.allowGenerated, false);
    assert.equal(card.trigger.excludeSelfGenerated, true);
    assert.doesNotMatch(`${card.cardId} ${card.name} ${card.effect} ${JSON.stringify(card.formula)}`, retiredTerms);

    const formula = card.formula;
    switch (formula.surface) {
      case 'stat_percent':
        assert.match(card.effect, /[+-]\d+%/);
        break;
      case 'bargain_percent':
        assert.match(card.effect, /[+-]\d+%.*[+-]\d+%/);
        break;
      case 'shield_percent_max_hp':
        assert.match(card.effect, /Start battle with a \d+% Max HP shield/);
        break;
      case 'cadence_magic_damage':
        assert.match(card.effect, new RegExp(`Every ${formula.everyCompletedBasics === 1 ? 'completed basic' : `${formula.everyCompletedBasics} completed basics`}: ${formula.amount} magic damage`));
        break;
      case 'heal_percent_max_hp':
        assert.match(card.effect, new RegExp(`${Math.round(formula.chance * 100)}%: heal ${Math.round(formula.percent * 100)}% Max HP`));
        break;
      case 'status_on_basic':
        assert.match(card.effect, new RegExp(`${Math.round(formula.chance * 100)}%: Venom for ${formula.damagePerTurn} damage, ${formula.durationTurns} turns`));
        break;
      case 'bounce_percent_damage':
        assert.match(card.effect, new RegExp(`${Math.round(formula.chance * 100)}%: bounce for ${Math.round(formula.damagePercent * 100)}% damage`));
        break;
      case 'counter_percent_atk':
        assert.match(card.effect, new RegExp(`${Math.round(formula.chance * 100)}%: counter for ${Math.round(formula.damagePercent * 100)}% ATK, heal ${Math.round(formula.healPercentMaxHp * 100)}% Max HP`));
        break;
      default:
        assert.fail(`unknown formula surface ${formula.surface}`);
    }
  }
});

test('behavior stages require and replace the same hero base, while pure stat stages remain direct fallbacks', () => {
  const behaviorEffects = [...new Set(SESSION_LEVEL_UP_BUFF_CARDS.filter(card => card.kind === 'behavior').map(card => card.effectId))];
  for (const effectId of behaviorEffects) {
    const stages = cardsForEffect(effectId);
    assert.deepEqual(stages.map(card => card.stage), [1, 2, 3, 4]);
    const base = stages[0];
    assert.equal(getEligibleLevelUpBuffCards({ state: freshState(), heroId: 'fara-1', cards: SESSION_LEVEL_UP_BUFF_CARDS, tier: base.tier }).some(card => card.cardId === base.cardId), true);
    for (const card of stages.slice(1)) {
      assert.equal(card.requiresStage, card.stage - 1);
      assert.equal(card.replacesStage, card.stage - 1);
      assert.equal(getEligibleLevelUpBuffCards({ state: freshState(), heroId: 'fara-1', cards: SESSION_LEVEL_UP_BUFF_CARDS, tier: card.tier }).some(candidate => candidate.cardId === card.cardId), false);
    }
    let state = applyLevelUpBuffCard({ state: freshState(), heroId: 'fara-1', cardId: base.cardId, cards: SESSION_LEVEL_UP_BUFF_CARDS }).state;
    for (const card of stages.slice(1)) {
      const eligible = getEligibleLevelUpBuffCards({ state, heroId: 'fara-1', cards: SESSION_LEVEL_UP_BUFF_CARDS, tier: card.tier });
      assert.ok(eligible.some(candidate => candidate.cardId === card.cardId), `${card.cardId} follows its owned base`);
      const applied = applyLevelUpBuffCard({ state, heroId: 'fara-1', cardId: card.cardId, cards: SESSION_LEVEL_UP_BUFF_CARDS });
      assert.equal(applied.status, 'applied');
      assert.equal(applied.replacedStage, card.stage - 1);
      state = applied.state;
    }
  }

  for (const card of SESSION_LEVEL_UP_BUFF_CARDS.filter(candidate => candidate.kind === 'stat')) {
    if (card.stage === 1) assert.equal(card.requiresStage, null);
    if (card.stage > 1) {
      assert.equal(card.requiresStage, card.stage - 1);
      assert.equal(card.replacesStage, card.stage - 1);
      const direct = applyLevelUpBuffCard({ state: freshState(), heroId: 'hondo-1', cardId: card.cardId, cards: SESSION_LEVEL_UP_BUFF_CARDS });
      assert.equal(direct.status, 'applied', `${card.cardId} is a direct pure-stat fallback`);
      assert.equal(direct.replacedStage, null);
    }
  }
});

test('each selected tier can offer three eligible same-tier cards for a fresh or progressed hero', () => {
  for (const tier of tiers) {
    const freshEligible = getEligibleLevelUpBuffCards({ state: freshState(), heroId: 'fara-1', cards: SESSION_LEVEL_UP_BUFF_CARDS, tier });
    assert.ok(freshEligible.length >= 3, `fresh Tier ${tier} keeps three choices`);
    assert.ok(freshEligible.every(card => card.tier === tier));
    assert.ok(freshEligible.filter(card => card.kind === 'stat' || card.kind === 'bargain').length >= 3);
    const offer = buildLevelUpBuffOffer({
      state: freshState(), heroId: 'fara-1', cards: SESSION_LEVEL_UP_BUFF_CARDS,
      progress: {}, rng: () => 0, tierWeights: { 1: tier === 1 ? 1 : 0, 2: tier === 2 ? 1 : 0, 3: tier === 3 ? 1 : 0, 4: tier === 4 ? 1 : 0 },
    });
    assert.equal(offer.status, 'offered');
    assert.equal(offer.tier, tier);
    assert.equal(offer.cards.length, 3);
    assert.ok(offer.cards.every(card => card.tier === tier));

    const ownedFallback = freshEligible.find(card => card.kind === 'stat' || card.kind === 'bargain');
    const progressed = applyLevelUpBuffCard({ state: freshState(), heroId: 'fara-1', cardId: ownedFallback.cardId, cards: SESSION_LEVEL_UP_BUFF_CARDS }).state;
    const progressedOffer = buildLevelUpBuffOffer({
      state: progressed, heroId: 'fara-1', cards: SESSION_LEVEL_UP_BUFF_CARDS,
      progress: {}, rng: () => 0, tierWeights: { 1: tier === 1 ? 1 : 0, 2: tier === 2 ? 1 : 0, 3: tier === 3 ? 1 : 0, 4: tier === 4 ? 1 : 0 },
    });
    assert.equal(progressedOffer.status, 'offered');
    assert.equal(progressedOffer.cards.length, 3);
    assert.ok(progressedOffer.cards.every(card => card.tier === tier));
  }
});

test('ownership is per hero and procs are bounded to native combat events', () => {
  const first = cardById('dune_edge_1');
  const owned = applyLevelUpBuffCard({ state: freshState(), heroId: 'fara-1', cardId: first.cardId, cards: SESSION_LEVEL_UP_BUFF_CARDS });
  assert.equal(owned.status, 'applied');
  assert.equal(getEligibleLevelUpBuffCards({ state: owned.state, heroId: 'fara-1', cards: SESSION_LEVEL_UP_BUFF_CARDS, tier: 1 }).some(card => card.cardId === first.cardId), false);
  assert.equal(getEligibleLevelUpBuffCards({ state: owned.state, heroId: 'hondo-1', cards: SESSION_LEVEL_UP_BUFF_CARDS, tier: 1 }).some(card => card.cardId === first.cardId), true);

  for (const card of SESSION_LEVEL_UP_BUFF_CARDS.filter(candidate => candidate.kind === 'behavior')) {
    assert.ok(card.tests.includes('proc_recursion'));
    assert.deepEqual(card.trigger.sourceTags, ['hero_native']);
    assert.equal(card.effects.spawnsEntities, false);
    assert.equal(card.limits.procDepthCap, 0);
    if (card.formula.surface === 'counter_percent_atk') assert.equal(card.formula.maxPerDamagePackage, 1);
  }
  const venom = cardById('venom_sigil_1');
  assert.equal(venom.formula.statusId, 'venom');
  assert.equal(venom.trigger.event, 'basic_attack_completed');
  assert.ok(venom.compatibleAttackTags.includes('basic_attack'));
});
