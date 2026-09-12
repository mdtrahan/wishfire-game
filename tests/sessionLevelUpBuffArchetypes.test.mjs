import test from 'node:test';
import assert from 'node:assert/strict';
import { applySessionLevelBuffsAtBattleStart, resolveSessionLevelBasicEffects, resolveSessionLevelCounter, rulesContext } from '../web-runner/modules/heroCommands.mjs';

const hero = { uid: 1, kind: 'hero', heroInstanceKey: 'hondo-1', baseHeroName: 'Huun', name: 'Huun', hp: 80, maxHP: 100, stats: { ATK: 20, MAG: 10, SPD: 10 }, sp: 100, spMax: 100, currentLevel: 1, statuses: [] };
const enemy = { uid: 9, kind: 'enemy', hp: 200, maxHP: 200, stats: { ATK: 10, MAG: 10, SPD: 5 }, statuses: [] };
const effectState = effectIds => ({ heroes: { 'hondo-1': { activeStageByEffectId: Object.fromEntries(effectIds.map(id => [id, 1])), triggerCountersByEffectId: {}, completedEffectIds: [] } } });
function context(effectIds, random = () => 0) {
  const actor = structuredClone(hero), target = structuredClone(enemy);
  const globals = { CombatSessionId: 1, SessionLevelBuffState: effectState(effectIds), RuntimeRandom: random, time: 1 };
  const ctx = { state: { globals, entities: [actor, target] }, callFunction(name, ...args) {
    if (name === 'CalculateDamage') return 20;
    if (name === 'ApplyDamageToTarget') { const victim = ctx.state.entities.find(item => item.uid === args[0]); const amount = Number(args[1] || 0); victim.hp = Math.max(0, victim.hp - amount); return amount; }
    return 0;
  } };
  return { ctx, actor, target, rules: rulesContext(ctx) };
}

test('session buffs apply exact owner-only stat, max-HP, bargain, speed, and Crimson Ward state at battle start', () => {
  const { ctx, actor, target, rules } = context(['qa_atk_focus', 'qa_max_vitality', 'qa_speed', 'qa_power_bargain', 'qa_opening_shield']);
  applySessionLevelBuffsAtBattleStart(ctx, rules);
  assert.equal(actor.maxHP, 108, '120% max HP followed by the 10% bargain cost');
  assert.equal(actor.statuses.find(status => status.statusEffect === 'atkUp').magnitude, .25);
  assert.equal(actor.statuses.find(status => status.statusEffect === 'spdUp').magnitude, .10);
  assert.equal(actor.statuses.find(status => status.statusEffect === 'barrier').remaining, 27);
  assert.equal(target.statuses.length, 0, 'a hero buff never mutates another actor');
});

test('Max Vitality uses runtime rounding and turns 108 Max HP into 130', () => {
  const { ctx, actor, rules } = context(['qa_max_vitality']);
  actor.maxHP = actor.hp = 108;
  applySessionLevelBuffsAtBattleStart(ctx, rules);
  assert.equal(actor.maxHP, 130);
});

test('Spectral Orb, status, heal, and chain each produce an owner-scoped material combat result', () => {
  const { ctx, actor, target, rules } = context(['qa_pulse', 'qa_heal_on_basic', 'qa_status_on_basic', 'qa_bounce'], () => 0);
  const secondEnemy = { ...structuredClone(target), uid: 10, hp: 200, x: 40 };
  ctx.state.entities.push(secondEnemy);
  actor.hp = 50;
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  const afterSecond = target.hp;
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  assert.ok(target.hp < afterSecond, 'the third native basic fires the T1 Spectral Orb cadence');
  assert.ok(actor.hp > 50, 'Inner Flow heals its owner through the shared heal resolver');
  assert.ok(target.statuses.some(status => status.statusEffect === 'mark') && target.statuses.some(status => status.statusEffect === 'dot' && status.snapshotPotency === 3), 'Saffron Mark reuses the readable marker and standard DOT payload');
  assert.equal(ctx.state.globals.ArcanePulseVisuals.length, 1);
  assert.equal(ctx.state.globals.ArcanePulseVisuals[0].targetUID, target.uid);
  assert.equal(ctx.state.globals.ArcanePulseVisuals[0].shape, 'crescent_arc_blast');
  assert.equal(ctx.state.globals.ChainStrikeVisuals.at(-1).targetUID, 10);
  assert.equal(ctx.state.globals.ChainStrikeVisuals.at(-1).sourceTargetUID, target.uid);
});

test('Mirage Chain has no same-target fallback when only one enemy survives', () => {
  const { ctx, actor, target, rules } = context(['qa_bounce'], () => 0);
  resolveSessionLevelBasicEffects(ctx, rules, actor, [target.uid]);
  assert.equal(target.hp, 200);
  assert.equal(ctx.state.globals.ChainStrikeVisuals, undefined);
});

test('Glass Reprisal counterattacks and heals only after its owner takes damage', () => {
  const { ctx, actor, target, rules } = context(['qa_counter'], () => 0);
  actor.hp = 40;
  const resolved = resolveSessionLevelCounter(ctx, rules, actor, target);
  assert.equal(resolved, true);
  assert.ok(target.hp < 200);
  assert.ok(actor.hp > 40);
});
