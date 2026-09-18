import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { resolveNativeCommandStep } from '../web-runner/modules/heroCommands.mjs';
import { getHeroTurnCards } from '../web-runner/src/core/heroTurnCards.mjs';
import { resolveSkill, turnStart } from '../web-runner/src/core/combatRules.mjs';
import { HERO_CARD_ARCHETYPE_CASES, HERO_CARD_ARCHETYPE_CORE, HERO_CARD_ARCHETYPE_SECONDARY } from './fixtures/heroCardArchetypes.mjs';

const functionBankSource = fs.readFileSync(path.join(process.cwd(), 'web-runner/modules/functionBank.js'), 'utf8');
const readFunction = name => {
  const start = functionBankSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing runtime function ${name}`);
  const braceStart = functionBankSource.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < functionBankSource.length; index += 1) {
    if (functionBankSource[index] === '{') depth += 1;
    if (functionBankSource[index] === '}' && --depth === 0) return functionBankSource.slice(start, index + 1);
  }
  assert.fail(`unterminated runtime function ${name}`);
};

function canonicalCard(testCase) {
  const card = getHeroTurnCards(testCase.hero).find(entry => entry.id === testCase.cardId);
  assert.ok(card, `${testCase.cardId} must come from the canonical ${testCase.hero} pool`);
  return card;
}

function makeActor({ uid, kind, name, hp, statuses = [] }) {
  return {
    uid, kind, name, baseHeroName: kind === 'hero' ? name : undefined,
    hp, maxHP: kind === 'hero' ? 20 : 40, isAlive: hp > 0, currentLevel: 1,
    stats: { ATK: 10, DEF: 10, MAG: 10, RES: 10, SPD: 10 },
    statuses: structuredClone(statuses), sp: 0, spMax: 100,
  };
}

function createHarness(testCase) {
  const card = canonicalCard(testCase);
  const pre = testCase.preState;
  const actor = makeActor({ uid: 1, kind: 'hero', name: testCase.actorName, hp: pre.actorHP });
  const allies = (pre.allies || []).map(entry => makeActor({ ...entry, kind: 'hero', name: entry.name || 'Ally' }));
  const enemies = (pre.enemies || []).map(entry => makeActor({ ...entry, kind: 'enemy', name: entry.name || 'Enemy' }));
  const entities = [actor, ...allies, ...enemies];
  const globals = {
    CombatSessionId: 91, TurnSerial: 7, TurnPhase: 0, NativeBattleEnded: 0,
    HeroTurnCardFanOpen: 1, HeroTurnCardFanHeroUID: 1, HeroTurnCardFanCards: [card],
    HeroTurnCardFanSelectedCardId: '', HeroTurnCardFanTargetUID: 0,
    HeroTurnCardFanPendingCardIndex: -1, HeroTurnCardFanPendingCardId: '',
    HeroTurnCardFanPendingTarget: 0, HeroTurnCardFanPendingTargetKind: '', HeroTurnCardFanPendingExcludeSelf: 0,
    HeroTurnCardFanBlockedCardId: '', NativeCommandSequence: undefined, PendingHeroHits: [],
  };
  const state = { globals, entities };
  const context = {
    getGlobals: ctx => ctx.state.globals,
    getEntities: ctx => ctx.state.entities,
    GetActorByUID: (ctx, uid) => ctx.state.entities.find(entry => Number(entry.uid) === Number(uid)) || null,
    GetCurrentTurn: () => 1,
    StartHeroLunge: () => 1,
  };
  vm.createContext(context);
  vm.runInContext([
    readFunction('cardSkillFromDefinition'),
    readFunction('heroTurnCardTargets'),
    readFunction('getHeroTurnCardFanState'),
    readFunction('selectHeroTurnCard'),
    readFunction('applyPendingTurnDelays'),
    'this.cardSkillFromDefinition = cardSkillFromDefinition;',
    'this.selectHeroTurnCard = selectHeroTurnCard;',
    'this.applyPendingTurnDelays = applyPendingTurnDelays;',
  ].join('\n'), context);
  const callFunction = (name, ...args) => {
    if (name === 'GetCurrentTurn') return 1;
    if (name === 'StartHeroLunge') return 1;
    if (name === 'GetEnemyRosterStability') return { stable: true };
    if (name === 'CalculateDamage') return 10;
    if (name === 'ApplyDamageToTarget') {
      const target = entities.find(entry => Number(entry.uid) === Number(args[0]));
      if (!target) return 0;
      const before = target.hp;
      target.hp = Math.max(0, target.hp - Number(args[1] || 0));
      target.isAlive = target.hp > 0;
      return before - target.hp;
    }
    return undefined;
  };
  const ctx = { state, callFunction, entities, actors: entities, random: () => 0, calculateDamage: () => 10, applyDamage: (_source, target, amount) => { target.hp = Math.max(0, target.hp - amount); return amount; } };
  return { card, context, ctx, state, entities, actor, queue: pre.queue.map(uid => ({ uid, spd: 10 })) };
}

function statusFor(entities, uid, statusEffect) {
  const actor = entities.find(entry => Number(entry.uid) === Number(uid));
  return actor?.statuses.find(status => status.statusEffect === statusEffect);
}

function assertExpectedState(run, testCase) {
  for (const [uid, hp] of Object.entries(testCase.expected.hp || {})) {
    assert.equal(run.entities.find(entry => Number(entry.uid) === Number(uid))?.hp, hp, `${testCase.id}: HP for ${uid}`);
  }
  for (const [uid, expectedStatuses] of Object.entries(testCase.expected.statuses || {})) {
    const actor = run.entities.find(entry => Number(entry.uid) === Number(uid));
    assert.ok(actor, `${testCase.id}: status actor ${uid}`);
    assert.equal(actor.statuses.length, expectedStatuses.length, `${testCase.id}: status count for ${uid}`);
    for (const expected of expectedStatuses) {
      const actual = actor.statuses.find(status => status.statusEffect === expected.statusEffect);
      assert.ok(actual, `${testCase.id}: missing ${expected.statusEffect} on ${uid}`);
      for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `${testCase.id}: ${key} on ${uid}`);
    }
  }
}

function runCard(testCase) {
  const run = createHarness(testCase);
  const { context, ctx, state, actor } = run;
  const targetUID = testCase.selection.targetUID;
  const cardSkill = context.cardSkillFromDefinition(run.card, actor);
  const cardTapTarget = cardSkill?.targetType === 'enemy' ? targetUID : 0;
  const firstSelection = context.selectHeroTurnCard(ctx, 0, cardTapTarget);
  assert.equal(firstSelection, true, `${testCase.id}: draw/select step`);
  if (testCase.selection.illegalTargetUID != null) {
    const cardsBefore = state.globals.HeroTurnCardFanCards;
    assert.equal(context.selectHeroTurnCard(ctx, 0, testCase.selection.illegalTargetUID), false, `${testCase.id}: illegal target rejected`);
    assert.equal(state.globals.HeroTurnCardFanPendingTarget, 1, `${testCase.id}: illegal target keeps pending selection`);
    assert.strictEqual(state.globals.HeroTurnCardFanCards, cardsBefore, `${testCase.id}: illegal target does not consume card`);
  }
  if (targetUID != null && cardSkill?.targetType !== 'enemy') assert.equal(context.selectHeroTurnCard(ctx, 0, targetUID), true, `${testCase.id}: battlefield target step`);
  const sequence = state.globals.NativeCommandSequence;
  assert.ok(sequence, `${testCase.id}: selected card creates native sequence`);
  assert.equal(state.globals.HeroTurnCardFanOpen, 0, `${testCase.id}: fan closes after selection`);
  assert.equal(resolveNativeCommandStep(ctx, { sequence }), true, `${testCase.id}: native effect resolution`);
  const snapshot = run.entities.map(entry => ({ uid: entry.uid, hp: entry.hp, statuses: structuredClone(entry.statuses) }));
  assert.equal(resolveNativeCommandStep(ctx, { sequence }), false, `${testCase.id}: selected card resolves once`);
  assert.deepEqual(run.entities.map(entry => ({ uid: entry.uid, hp: entry.hp, statuses: entry.statuses })), snapshot, `${testCase.id}: duplicate hit has no effect`);
  assert.equal(state.globals.NativeCommandSequence, undefined, `${testCase.id}: native sequence clears`);
  assert.equal(state.globals.HeroTurnCardFanPendingTarget, 0, `${testCase.id}: pending target clears`);
  assert.deepEqual(Array.from(state.globals.HeroTurnCardFanCards), [], `${testCase.id}: selected card leaves no stale fan cards`);
  assertExpectedState(run, testCase);
  if (testCase.id === 'delay') {
    assert.equal(statusFor(run.entities, 9, 'delayNextTurn')?.statusEffect, 'delayNextTurn', 'delay: status is present before queue application');
    const shifted = context.applyPendingTurnDelays(ctx, run.queue, actor.uid);
    assert.deepEqual(Array.from(shifted.queue, slot => Number(slot.uid)), testCase.expected.queue, 'delay: next CTB actor is preserved after one-slot delay');
    assert.deepEqual(Array.from(shifted.applied, entry => ({ uid: Number(entry.uid), slots: Number(entry.slots) })), [{ uid: 9, slots: 1 }], 'delay: one pending occurrence is applied');
    assert.equal(statusFor(run.entities, 9, 'delayNextTurn'), undefined, 'delay: consumed queue offset clears the pending status');
  } else {
    assert.equal(Number(run.queue[1].uid), Number(testCase.expected.queue[1]), `${testCase.id}: CTB next actor is unchanged by resolution`);
  }
  return run;
}

test('fixture manifest covers canonical personal cards and excludes Fortune cards', () => {
  assert.equal(HERO_CARD_ARCHETYPE_CORE.length, 8);
  assert.equal(HERO_CARD_ARCHETYPE_SECONDARY.length, 6);
  const allCardIds = new Set(['Fara', 'Hondo', 'Runa', 'Kaja'].flatMap(getHeroTurnCards).map(card => card.id));
  for (const testCase of HERO_CARD_ARCHETYPE_CASES) {
    const card = canonicalCard(testCase);
    assert.equal(card.hero, testCase.hero);
    assert.ok(allCardIds.has(card.id));
    assert.doesNotMatch(`${card.id} ${card.name} ${card.effect}`, /fortune/i);
  }
});

for (const testCase of HERO_CARD_ARCHETYPE_CASES) {
  test(`hero card archetype: ${testCase.id}`, () => {
    const run = runCard(testCase);
    if (testCase.id === 'dot') {
      const target = run.entities.find(entry => entry.uid === 9);
      turnStart({ actors: run.entities, state: run.state.globals, random: () => 0, calculateDamage: () => 10, applyDamage: (_source, targetActor, amount) => { targetActor.hp = Math.max(0, targetActor.hp - amount); return amount; } }, target, 8);
      assert.equal(target.hp, testCase.expected.tickHP[9], 'dot: damage ticks at target turn start');
    }
    if (testCase.id === 'hot') {
      const target = run.entities.find(entry => entry.uid === 2);
      turnStart({ actors: run.entities, state: run.state.globals, random: () => 0, calculateDamage: () => 10, applyDamage: (_source, targetActor, amount) => { targetActor.hp = Math.max(0, targetActor.hp - amount); return amount; } }, target, 8);
      assert.equal(target.hp, testCase.expected.tickHP[2], 'hot: healing ticks at ally turn start');
    }
    if (testCase.id === 'taunt') {
      const enemy = run.entities.find(entry => entry.uid === 9);
      const ally = run.entities.find(entry => entry.uid === 2);
      const rules = { actors: run.entities, state: run.state.globals, random: () => 0, calculateDamage: () => 4, applyDamage: (_source, target, amount) => { target.hp = Math.max(0, target.hp - amount); return amount; } };
      resolveSkill(rules, enemy, { skillId: 'enemy_attack', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage', fixedDamage: 4 }] }, [ally.uid]);
      assert.equal(run.actor.hp, 16, 'taunt: challenged enemy redirects to source hero');
      assert.equal(ally.hp, 18, 'taunt: ally remains unharmed by redirected hit');
    }
    if (testCase.id === 'cover-counter') {
      const enemy = run.entities.find(entry => entry.uid === 9);
      const ally = run.entities.find(entry => entry.uid === 2);
      const rules = { actors: run.entities, state: run.state.globals, random: () => 0, calculateDamage: () => 4, applyDamage: (_source, target, amount) => { target.hp = Math.max(0, target.hp - amount); return amount; } };
      resolveSkill(rules, enemy, { skillId: 'enemy_attack', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage', fixedDamage: 4 }] }, [ally.uid]);
      assert.equal(ally.hp, 18, 'cover: protected ally keeps HP');
      assert.equal(run.actor.hp, 16, 'cover: source hero receives redirected hit');
      assert.equal(enemy.hp, 32, 'counter: intercepted attacker receives counter hit');
    }
  });
}
