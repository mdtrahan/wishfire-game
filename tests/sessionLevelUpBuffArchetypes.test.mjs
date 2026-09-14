import test from 'node:test';
import assert from 'node:assert/strict';
import { applySessionLevelBuffsAtBattleStart, resolveIncomingNativeHit, resolveNativeCommandStep, resolveSessionLevelBasicEffects, resolveSessionLevelCounter, rulesContext } from '../web-runner/modules/heroCommands.mjs';
import { heroDefinition } from '../web-runner/src/core/heroDefinitions.mjs';
import { turnEnd, turnStart } from '../web-runner/src/core/combatRules.mjs';
import { SESSION_LEVEL_UP_BUFF_CARDS, UNIVERSAL_SESSION_POWER_BUFF_CARDS, isUniversalSessionPowerBuffCard } from '../src/core/sessionLevelBuffCatalog.mjs';
import { applyLevelUpBuffCard, createSessionLevelBuffState } from '../src/core/sessionLevelBuffOffers.mjs';
import { chooseSessionLevelUpBuff, getSessionLevelUpBuffPresentation } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';

const hero = { uid: 1, kind: 'hero', heroInstanceKey: 'hondo-1', baseHeroName: 'Huun', name: 'Huun', hp: 80, maxHP: 100, stats: { ATK: 20, MAG: 10, SPD: 10 }, sp: 100, spMax: 100, currentLevel: 1, statuses: [] };
const enemy = { uid: 9, kind: 'enemy', hp: 200, maxHP: 200, stats: { ATK: 10, MAG: 10, SPD: 5 }, statuses: [] };
const effectState = effectIds => ({ heroes: { 'hondo-1': { activeStageByEffectId: Object.fromEntries(effectIds.map(id => [id, 1])), triggerCountersByEffectId: {}, completedEffectIds: [] } } });
function context(effectIds, random = () => 0) {
  const actor = structuredClone(hero), target = structuredClone(enemy);
  const globals = { CombatSessionId: 1, SessionLevelBuffState: effectState(effectIds), RuntimeRandom: random, time: 1, TurnSerial: 7, DamageTexts: [] };
  const ctx = { state: { globals, entities: [actor, target] }, callFunction(name, ...args) {
    if (name === 'CalculateDamage') return 20;
    if (name === 'ApplyDamageToTarget') { const victim = ctx.state.entities.find(item => item.uid === args[0]); const amount = Number(args[1] || 0); victim.hp = Math.max(0, victim.hp - amount); globals.DamageTexts.push({ amount, kind: 'damage', targetUID: Number(args[0]) }); return amount; }
    if (name === 'SpawnDamageText') { globals.DamageTexts.push({ amount: Number(args[0] || 0), kind: args[3] }); return 1; }
    return 0;
  } };
  return { ctx, actor, target, rules: rulesContext(ctx) };
}

test('session buffs apply exact owner-only stat, max-HP, bargain, speed, and Crimson Ward state at battle start', () => {
  const { ctx, actor, target, rules } = context(['dune_edge', 'well_of_life', 'desert_step', 'sun_debt', 'brass_ward']);
  applySessionLevelBuffsAtBattleStart(ctx, rules);
  assert.equal(actor.maxHP, 108, '120% max HP followed by the 10% bargain cost');
  assert.ok(Math.abs(actor.statuses.find(status => status.statusEffect === 'atkUp').magnitude - .265) < 1e-9);
  assert.ok(Math.abs(actor.statuses.find(status => status.statusEffect === 'spdUp').magnitude - .10) < 1e-9);
  assert.equal(actor.statuses.find(status => status.statusEffect === 'barrier').remaining, 27);
  assert.ok(ctx.state.globals.PartyWardBarrierVisualsByUID?.[actor.uid], 'battle-start Crimson Ward uses the production barrier presentation callback');
  assert.equal(target.statuses.length, 0, 'a hero buff never mutates another actor');
});

test('Max Vitality uses runtime rounding and turns 108 Max HP into 130', () => {
  const { ctx, actor, rules } = context(['well_of_life']);
  actor.maxHP = actor.hp = 108;
  applySessionLevelBuffsAtBattleStart(ctx, rules);
  assert.equal(actor.maxHP, 130);
});

test('Spectral Orb, status, and chain each produce an owner-scoped material combat result', () => {
  const { ctx, actor, target, rules } = context(['spectral_orb', 'venom_sigil', 'mirage_chain'], () => 0);
  const secondEnemy = { ...structuredClone(target), uid: 10, hp: 200, x: 40 };
  ctx.state.entities.push(secondEnemy);
  actor.hp = 50;
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  const afterSecond = target.hp;
  assert.equal(target.hp, 200, 'the T1 Spectral Orb waits for three completed basics');
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  assert.ok(target.hp < 200, 'the third native basic fires the T1 Spectral Orb cadence');
  assert.equal(target.hp, afterSecond - 4, 'the observable orb result uses its exact magic payload');
  assert.ok(target.statuses.some(status => status.statusEffect === 'dot' && status.snapshotPotency === 3), 'Venom uses the standard DOT payload without a tactical marker dependency');
  assert.equal(ctx.state.globals.ArcanePulseVisuals.length, 1);
  assert.equal(ctx.state.globals.ArcanePulseVisuals[0].targetUID, target.uid);
  assert.equal(ctx.state.globals.ArcanePulseVisuals[0].shape, 'crescent_arc_blast');
  assert.equal(ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.spectral_orb, 3, 'Orb records each completed owner basic');
  assert.equal(ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.venom_sigil, 3, 'Venom records each completed owner basic');
  assert.equal(ctx.state.globals.ChainStrikeVisuals.at(-1).targetUID, 10);
  assert.equal(ctx.state.globals.ChainStrikeVisuals.at(-1).sourceTargetUID, target.uid);
  const beforeVenomTick = target.hp;
  turnStart(rules, target, 1);
  assert.equal(target.hp, beforeVenomTick - 3, 'Venom maps to the standardized DOT state and deals its exact payload');
});

test('Inner Flow remains a legacy helper only and cannot be offered or applied by the production opening path', () => {
  const innerFlow = SESSION_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'inner_flow_1');
  assert.ok(innerFlow);
  assert.equal(isUniversalSessionPowerBuffCard(innerFlow), false);
  assert.equal(UNIVERSAL_SESSION_POWER_BUFF_CARDS.includes(innerFlow), false);
  const globals = {
    RuntimeRandom: () => 0,
    SessionLevelUpQueue: { status: 'active', paused: false, currentIndex: 0, entries: [{ heroId: 'hondo-1', heroUID: 1, earnedLevel: 1, source: 'opening' }] },
    SessionLevelBuffState: createSessionLevelBuffState(),
  };
  const presentation = getSessionLevelUpBuffPresentation(globals, [structuredClone(hero)]);
  assert.ok(presentation.cards.every(isUniversalSessionPowerBuffCard));
  assert.equal(chooseSessionLevelUpBuff(globals, [structuredClone(hero)], innerFlow.cardId).status, 'rejected');
  assert.equal(applyLevelUpBuffCard({ state: createSessionLevelBuffState(), heroId: 'hondo-1', cardId: innerFlow.cardId, cards: UNIVERSAL_SESSION_POWER_BUFF_CARDS }).status, 'rejected');
});

test('a completed selected-owner native basic applies Venom once and ignores other actors and added hits', () => {
  const { ctx, actor, target, rules } = context(['venom_sigil'], () => 0);
  const basic = heroDefinition(actor).basic;
  const resolveAction = source => {
    const sequence = { actorUID: source.uid, actions: [{ skill: basic, targetIds: [target.uid], spCost: 0 }], index: 0, sessionId: 1 };
    ctx.state.globals.NativeCommandSequence = sequence;
    return resolveNativeCommandStep(ctx, { sequence });
  };
  assert.equal(resolveAction(actor), true);
  assert.equal(ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.venom_sigil, 1);
  assert.equal(target.statuses.filter(status => status.statusEffect === 'dot' && status.snapshotPotency === 3).length, 1);

  const otherHero = { ...structuredClone(actor), uid: 2, heroInstanceKey: 'other-hero', hp: 80 };
  const enemyActor = { ...structuredClone(target), uid: 3, kind: 'enemy', hp: 100 };
  ctx.state.entities.push(otherHero, enemyActor);
  assert.equal(resolveAction(otherHero), true);
  assert.equal(resolveAction(enemyActor), true);
  const addedHit = { actorUID: actor.uid, actions: [{ skill: { ...basic, skillId: 'session_spectral_orb' }, targetIds: [target.uid], spCost: 0 }], index: 0, sessionId: 1 };
  ctx.state.globals.NativeCommandSequence = addedHit;
  assert.equal(resolveNativeCommandStep(ctx, { sequence: addedHit }), true);
  assert.equal(ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.venom_sigil, 1);
  assert.equal(target.statuses.filter(status => status.statusEffect === 'dot' && status.snapshotPotency === 3).length, 1);
  const beforeDotTick = target.hp;
  turnStart(rules, target, 2);
  assert.equal(target.hp, beforeDotTick - 3, 'the standardized Venom DOT remains owned by the target enemy turn');
  assert.equal(ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.venom_sigil, 1);
});

test('Venom keeps its production chance check while advancing exactly one owner counter', () => {
  const qualifying = context(['venom_sigil'], () => .1999);
  resolveSessionLevelBasicEffects(qualifying.ctx, qualifying.rules, qualifying.actor, [qualifying.target.uid]);
  assert.equal(qualifying.ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.venom_sigil, 1);
  assert.equal(qualifying.target.statuses.filter(status => status.statusEffect === 'dot' && status.snapshotPotency === 3).length, 1, 'a qualifying production roll applies one standardized Venom payload to the damaged enemy');

  const nonqualifying = context(['venom_sigil'], () => .20);
  resolveSessionLevelBasicEffects(nonqualifying.ctx, nonqualifying.rules, nonqualifying.actor, [nonqualifying.target.uid]);
  assert.equal(nonqualifying.ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.venom_sigil, 1, 'the completed owner basic still counts before its proc roll');
  assert.equal(nonqualifying.target.statuses.filter(status => status.statusEffect === 'dot').length, 0, 'a nonqualifying roll leaves the target without Venom');
});

test('Venom ticks exactly 3 damage on the target turn and its marker state expires with the DOT', () => {
  const { ctx, actor, target, rules } = context(['venom_sigil'], () => 0);
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  assert.equal(target.statuses.some(status => status.statusEffect === 'dot' && status.snapshotPotency === 3), true, 'the target owns the standardized Venom state before its turn');
  const beforeTick = target.hp;
  turnStart(rules, target, 1);
  assert.equal(target.hp, beforeTick - 3, 'the target turn applies the DOT separately from the owner basic');
  turnEnd(target);
  assert.equal(target.statuses.some(status => status.statusEffect === 'dot'), true, 'the DOT remains visible until its configured duration expires');
  turnStart(rules, target, 2);
  turnEnd(target);
  assert.equal(target.statuses.some(status => status.statusEffect === 'dot'), false, 'the status marker source clears when Venom expires');
});

test('Orb cadence reaches its third distinct owner basic before emitting its visual', () => {
  const { ctx, actor, target, rules } = context(['spectral_orb']);
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  assert.equal(ctx.state.globals.ArcanePulseVisuals, undefined, 'Orb does not trigger before its third owner basic');
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  assert.equal(ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.spectral_orb, 3);
  assert.equal(ctx.state.globals.ArcanePulseVisuals.length, 1);
  assert.equal(ctx.state.globals.ArcanePulseVisuals[0].amount, 4);
});

test('a T1 Orb cadence upgrades in session and resolves its T2 cadence in a later battle', () => {
  const base = applyLevelUpBuffCard({
    state: createSessionLevelBuffState(),
    heroId: 'hondo-1',
    cardId: 'spectral_orb_1',
    cards: SESSION_LEVEL_UP_BUFF_CARDS,
  });
  assert.equal(base.status, 'applied');

  const battleA = context([]);
  battleA.ctx.state.globals.SessionLevelBuffState = base.state;
  const battleAHP = battleA.target.hp;
  for (let count = 0; count < 3; count += 1) resolveSessionLevelBasicEffects(battleA.ctx, battleA.rules, battleA.actor, [battleA.target.uid]);
  assert.equal(battleA.target.hp, battleAHP - 4, 'Tier 1 Orb emits 4 magic damage on the third owner basic');
  assert.equal(base.state.heroes['hondo-1'].triggerCountersByEffectId.spectral_orb, 3);

  const upgraded = applyLevelUpBuffCard({
    state: base.state,
    heroId: 'hondo-1',
    cardId: 'spectral_orb_2',
    cards: SESSION_LEVEL_UP_BUFF_CARDS,
  });
  assert.equal(upgraded.status, 'applied');
  assert.equal(upgraded.replacedStage, 1);
  assert.equal(upgraded.state.heroes['hondo-1'].activeStageByEffectId.spectral_orb, 2);

  const battleB = context([]);
  battleB.ctx.state.globals.CombatSessionId = 2;
  battleB.ctx.state.globals.SessionLevelBuffState = upgraded.state;
  applySessionLevelBuffsAtBattleStart(battleB.ctx, battleB.rules);
  const battleBHP = battleB.target.hp;
  resolveSessionLevelBasicEffects(battleB.ctx, battleB.rules, battleB.actor, [battleB.target.uid]);
  resolveSessionLevelBasicEffects(battleB.ctx, battleB.rules, battleB.actor, [battleB.target.uid]);
  assert.equal(battleB.target.hp, battleBHP - 6, 'Tier 2 Orb emits 6 magic damage on the next completed Tier 2 cadence');
  assert.equal(battleB.ctx.state.globals.ArcanePulseVisuals.length, 1);
  assert.equal(battleB.ctx.state.globals.ArcanePulseVisuals[0].amount, 6);
  assert.equal(battleB.ctx.state.globals.SessionLevelBuffState.heroes['hondo-1'].triggerCountersByEffectId.spectral_orb, 5);
});

test('Chain Strike has no same-target fallback when only one enemy survives', () => {
  const { ctx, actor, target, rules } = context(['mirage_chain'], () => 0);
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  assert.equal(target.hp, 200);
  assert.equal(ctx.state.globals.ChainStrikeVisuals, undefined);
});

test('Chain Strike retains its production potency and resolved secondary damage', () => {
  const { ctx, actor, target, rules } = context(['mirage_chain'], () => 0);
  const secondary = { ...structuredClone(target), uid: 10, hp: 200, x: 40 };
  ctx.state.entities.push(secondary);
  const before = secondary.hp;
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  const visual = ctx.state.globals.ChainStrikeVisuals.at(-1);
  assert.equal(visual.damagePercent, .50);
  assert.equal(visual.resolvedDamage, before - secondary.hp);
  assert.equal(visual.resolvedDamage, 10);
});

test('Glass Reprisal counterattacks and heals only after its owner takes damage', () => {
  const { ctx, actor, target, rules } = context(['glass_reprisal'], () => 0);
  actor.hp = 40;
  const resolved = resolveSessionLevelCounter(ctx, rules, actor, target);
  assert.equal(resolved, true);
  assert.ok(target.hp < 200);
  assert.ok(actor.hp > 40);
});

test('Glass Reprisal retains incoming, resolved counter, and capped-heal evidence without recursion', () => {
  const { ctx, actor, target } = context(['glass_reprisal'], () => 0);
  actor.hp = 50;
  const ownerBeforeIncomingHit = actor.hp;
  const attackerBefore = target.hp;
  assert.equal(resolveIncomingNativeHit(ctx, target, actor, 10), true);
  const incoming = ctx.state.globals.DamageTexts.find(text => text.kind === 'damage' && text.targetUID === actor.uid);
  const counter = ctx.state.globals.DamageTexts.find(text => text.kind === 'damage' && text.targetUID === target.uid);
  const heal = ctx.state.globals.DamageTexts.find(text => text.kind === 'heal' && text.targetUID === actor.uid);
  const ownerAfterIncomingDamage = ownerBeforeIncomingHit - incoming.amount;
  assert.equal(counter.amount, attackerBefore - target.hp, 'the emitted counter damage matches the mitigated attacker HP delta');
  assert.equal(heal.amount, Math.min(actor.maxHP, ownerAfterIncomingDamage + Math.floor(actor.maxHP * .03)) - ownerAfterIncomingDamage);
  assert.equal(actor.hp - ownerAfterIncomingDamage, heal.amount);
  assert.equal(ctx.state.globals.TurnSerial, 7, 'the counter did not consume a normal turn');
  assert.equal(ctx.state.globals.DamageTexts.filter(text => text.kind === 'damage' && text.targetUID === target.uid).length, 1, 'the intended counter is not recursion');
});
