import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { castRealtimeHeroSkill, realtimeBasicDamageMultiplier, realtimeBasicFollowups, realtimeCoverTarget, realtimeIncomingDamage, realtimeMagicBlocked, realtimeProvokeTarget, realtimeStatMultiplier, tickRealtimeHeroSkillZones } from '../web-runner/src/core/realtimeHeroSkills.mjs';
import { renderCombatAttackVfx } from '../web-runner/systems/combatAttackVfxPresentation.mjs';

const hero = (uid, name, hp = 100) => ({ uid, kind: 'hero', currentLevel: 100, baseHeroName: name, name, hp, maxHP: 100 });
const enemy = (uid, x, y, hp = 100) => ({ uid, kind: 'enemy', hp, maxHP: 100, x, y, streamState: 'engaged' });
function combat() {
  const fara = hero(1, 'Falie'), hondo = hero(2, 'Huun', 50), runa = hero(3, 'Runa'), kaja = hero(4, 'Kojonn');
  const first = enemy(10, 200, 200), second = enemy(11, 220, 210);
  const state = { globals: { time: 10, ContinuousCombatStageLoop: 1, RuntimeRandom: () => .6 }, entities: [fara, hondo, runa, kaja, first, second] };
  const ctx = { state, callFunction(name, ...args) {
    if (name === 'CalculateDamage') return args[3] / 10;
    if (name === 'ApplyDamageToTarget') { const target = state.entities.find(entry => entry.uid === args[0]); const before = target.hp; target.hp = Math.max(0, target.hp - args[1]); return before - target.hp; }
    return 0;
  } };
  const cast = (key, id, selection) => castRealtimeHeroSkill(ctx, state.entities.find(entry => entry.baseHeroName === key).uid,
    HERO_DEFINITIONS[key].actives.find(skill => skill.skillId === id), selection);
  return { ctx, cast, fara, hondo, runa, kaja, first, second };
}

test('party support VFX resolves each ally position instead of the canvas origin', () => {
  const { ctx, cast, fara, hondo, runa, kaja } = combat();
  const allies = [fara, hondo, runa, kaja];
  ctx.state.globals.HeroRestBasePosByUID = Object.fromEntries(allies.map((ally, index) => [ally.uid, { x: 40, y: 190 + index * 55 }]));
  assert.equal(cast('Kojonn', 'wishgrant', { targetUIDs: allies.map(ally => ally.uid) }), true);
  assert.deepEqual(ctx.state.globals.CombatImpactRequests.map(request => request.targetUID), allies.map(ally => ally.uid));
  renderCombatAttackVfx({}, { state: ctx.state, images: {}, worldToCanvas: (x, y) => ({ x, y }) });
  assert.deepEqual(ctx.state.globals.CombatImpactVisuals.map(visual => [visual.x, visual.y]), allies.map(ally => [40, ctx.state.globals.HeroRestBasePosByUID[ally.uid].y]));
});

test('realtime skills apply timed damage, protection and party buffs without turn resources', () => {
  const { ctx, cast, fara, hondo, kaja, first, second } = combat();
  assert.equal(cast('Falie', 'challenge_bolt', { targetUID: first.uid }), true);
  assert.equal(first.hp, 92);
  assert.equal(realtimeProvokeTarget(ctx, first, hondo), fara);
  cast('Falie', 'shield_relay', { targetUID: hondo.uid });
  assert.equal(realtimeCoverTarget(ctx, hondo), fara);
  cast('Falie', 'brace', { targetUID: fara.uid });
  assert.equal(realtimeIncomingDamage(ctx, fara, first, 20), 10);
  cast('Kojonn', 'wishgrant', { targetUIDs: [fara.uid, hondo.uid, kaja.uid] });
  assert.equal(realtimeBasicDamageMultiplier(ctx.state.globals, hondo, first), 3.3);
  realtimeBasicFollowups(ctx, hondo, first, 10);
  assert.equal(realtimeBasicDamageMultiplier(ctx.state.globals, hondo, first), 1);
  cast('Kojonn', 'patchwork', { targetUIDs: [hondo.uid] });
  realtimeBasicFollowups(ctx, hondo, first, 10);
  assert.equal(hondo.hp, 53);
  cast('Runa', 'hex_beacon', { targetUID: first.uid, point: { x: 200, y: 200 } });
  assert.equal(realtimeStatMultiplier(ctx.state.globals, second, 'RES'), .75);
  ctx.state.globals.time = 30;
  tickRealtimeHeroSkillZones(ctx);
  assert.equal(realtimeProvokeTarget(ctx, first, hondo), hondo);
  assert.equal(realtimeStatMultiplier(ctx.state.globals, second, 'RES'), 1);
});

test('locked areas and marks stop at the attack line, including later entrants', () => {
  const { ctx, cast, first, second } = combat();
  first.x = 280;
  second.x = 300;
  second.y = 200;
  cast('Runa', 'frost_reversal', { targetUID: first.uid, point: { x: 280, y: 200 } });
  assert.equal(second.hp, 100);

  cast('Runa', 'hex_beacon', { targetUID: first.uid, point: { x: 280, y: 200 } });
  assert.equal(realtimeStatMultiplier(ctx.state.globals, second, 'RES'), 1);

  second.x = 180;
  cast('Runa', 'null_field', { targetUID: first.uid, point: { x: 280, y: 200 } });
  assert.equal(realtimeMagicBlocked(ctx.state.globals, first), true);
  assert.equal(realtimeMagicBlocked(ctx.state.globals, second), false);
  second.x = 280;
  assert.equal(realtimeMagicBlocked(ctx.state.globals, second), false);
});

test('direct skills and burning zones cannot hit an approaching enemy', () => {
  const { ctx, cast, first, second } = combat();
  second.x = 340;
  second.y = 200;
  assert.equal(cast('Falie', 'challenge_bolt', { targetUID: second.uid }), false);
  assert.equal(second.hp, 100);
  cast('Runa', 'burn_sigil', { targetUID: first.uid, point: { x: 300, y: 200 } });
  ctx.state.globals.time = 11;
  tickRealtimeHeroSkillZones(ctx);
  assert.equal(second.hp, 100);
});

test('Burn Sigil resolves every elapsed second through its expiry', () => {
  const { ctx, cast, first } = combat();
  cast('Runa', 'burn_sigil', { targetUID: first.uid, point: { x: first.x, y: first.y } });
  ctx.state.globals.time = 16.1;
  tickRealtimeHeroSkillZones(ctx);
  assert.equal(first.hp, 85);
  assert.equal(ctx.state.globals.RealtimeSkillZones.length, 0);
});

test('Fortune waits for the seeded combat RNG', () => {
  const { ctx, cast, fara } = combat();
  delete ctx.state.globals.RuntimeRandom;
  assert.equal(cast('Kojonn', 'fortunes_blessing', { targetUIDs: [fara.uid] }), false);
  assert.equal(ctx.state.globals.RealtimeSkillEffects?.[String(fara.uid)]?.fortunes_blessing, undefined);
  ctx.state.globals.RuntimeRandom = () => .6;
  assert.equal(cast('Kojonn', 'fortunes_blessing', { targetUIDs: [fara.uid] }), true);
  assert.equal(ctx.state.globals.LastRealtimeHeroSkill.feedback, ' (MAG +25%)');
});
