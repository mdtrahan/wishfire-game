import test from 'node:test';
import assert from 'node:assert/strict';
import { reverseContinuousCombatEnemy, armContinuousCombatBoss, resetContinuousCombatAfterDefeat } from '../web-runner/src/core/continuousCombatStage.mjs';
import { HERO_DEFINITIONS, ELEVATE_SETS, PROVISIONAL_SPECIAL_COOLDOWNS } from '../web-runner/src/core/heroDefinitions.mjs';
import { castRealtimeHeroSkill, cleanupRealtimeSkillActors, realtimeBasicInterval, realtimeCombatStat, realtimeIncomingDamage, tickRealtimeHeroSkillZones } from '../web-runner/src/core/realtimeHeroSkills.mjs';
import { applyHeroPassiveOnHit, heroPassive, heroPassiveBasicMultiplier, heroPassiveSignals } from '../web-runner/src/core/realtimeHeroPassives.mjs';
import { absorbHeroWard } from '../web-runner/src/core/heroWard.mjs';
import { resetRealtimeSkillAttempt } from '../web-runner/src/core/realtimeSkillState.mjs';
import { actorAttackReach } from '../src/core/arenaCombatRules.mjs';
import { BUFF_SIGNAL_FRAMES } from '../src/core/buffSignalRules.mjs';
import { previewSeededRng } from '../src/core/seededRngRules.mjs';
import { calculateDamageFromJs } from '../src/core/calculateDamageRules.mjs';

// Accepted kits (owner, 2026-10-23). Values below are the owner's numbers, not tuning.
const ACCEPTED = {
  Falie: ['crimson_ward', 'smoke_form', 'phoenix_soul', 'chastise'],
  Huun: ['shadow', 'royalty', 'chase', 'weaken'],
  Runa: ['bubble_pop', 'boast', 'vengeance', 'stare'],
  Kojonn: ['elevate', 'ethereal_aura', 'cornered', 'timeless'],
};

function combat() {
  const heroes = Object.keys(HERO_DEFINITIONS).map((key, index) => ({ uid: index + 1, kind: 'hero', baseHeroName: key, name: key, currentLevel: 1, hp: 60, maxHP: 100,
    x: 155, y: 200, footX: 155, footY: 200, stats: { ATK: 100, DEF: 20, MAG: 100, RES: 10, SPD: 10 } }));
  const enemies = [0, 1, 2].map(i => ({ uid: 10 + i, kind: 'enemy', hp: 1000, maxHP: 1000, x: 190 + i * 10, y: 200, footX: 190 + i * 10, footY: 200,
    streamEngageX: 200, streamState: 'engaged', combatRank: 'ordinary', stats: { ATK: 100, DEF: 30, RES: 0, MAG: 100, SPD: 5 } }));
  const g = { time: 10, ContinuousCombatStageLoop: 1, RuntimeRandomSeed: 12, RuntimeRandomDraws: 0 };
  g.RuntimeRandom = () => previewSeededRng(g.RuntimeRandomSeed, g.RuntimeRandomDraws++);
  const state = { globals: g, entities: [...heroes, ...enemies] }, calls = [];
  const ctx = { state, callFunction(name, ...args) {
    calls.push(name);
    const source = state.entities.find(a => a.uid === args[0]), target = state.entities.find(a => a.uid === args[1]);
    if (name === 'GetEffectiveStat') return realtimeCombatStat(g, args[0], args[1]);
    if (name === 'CalculateDamage') return calculateDamageFromJs({ power: realtimeCombatStat(g, source, args[2] === 'magic' ? 'MAG' : 'ATK'), resist: 0, attackMultiplierPct: args[3], critRoll01: 1 }).damage;
    if (name === 'ApplyRealtimeRawDamage') { const before = target.hp; target.hp = Math.max(0, target.hp - args[2]); return before - target.hp; }
    if (name === 'ApplyDamageToTarget') { const victim = source, before = victim.hp; victim.hp = Math.max(0, victim.hp - args[1]); return before - victim.hp; }
    return 0;
  } };
  const cast = (key, displacement = { reverse: reverseContinuousCombatEnemy }) => {
    const hero = heroes.find(a => a.baseHeroName === key);
    return castRealtimeHeroSkill(ctx, hero.uid, HERO_DEFINITIONS[key].special, {}, displacement);
  };
  return { ctx, g, heroes, enemies, cast, calls };
}

test('every hero carries exactly Special, Passive and two Resonances from the accepted list', () => {
  for (const [key, ids] of Object.entries(ACCEPTED)) {
    const definition = HERO_DEFINITIONS[key];
    assert.deepEqual(definition.skills.map(skill => skill.skillId), ids);
    assert.deepEqual(definition.skills.map(skill => skill.slot), ['special', 'passive', 'resonance', 'resonance']);
    assert.deepEqual(definition.actives, [definition.special], 'only the Special owns a clock');
    assert.ok(definition.special.cooldownSeconds > 0 && definition.special.unlockLevel === 1);
    assert.equal(definition.basic.cooldownSeconds, 0, 'Basic has an explicit zero skill cooldown; attack cadence remains separate');
    assert.equal(definition.passive.cooldownSeconds, undefined);
    assert.ok(definition.resonances.every(skill => skill.scaffold && skill.cooldownSeconds === undefined && !skill.passive), 'resonances are display-only scaffolding');
    assert.ok(definition.skills.every(skill => BUFF_SIGNAL_FRAMES[skill.icon] && skill.description && skill.conditionLabel));
  }
  assert.equal(HERO_DEFINITIONS.Falie.special.cooldownSeconds, 50);
  assert.deepEqual(PROVISIONAL_SPECIAL_COOLDOWNS, ['shadow', 'bubble_pop', 'elevate']);
  assert.ok(Object.values(HERO_DEFINITIONS).every(d => d.special.provisionalCooldown === PROVISIONAL_SPECIAL_COOLDOWNS.includes(d.special.skillId)));
});

const wards = g => Object.fromEntries(Object.entries(g.HeroWardHPByUID || {}).map(([uid, hp]) => [Number(uid), hp]));

test('Crimson Ward gives each hero its own ward, capped at 50% of that hero\'s original max HP', () => {
  const { g, heroes, cast } = combat();
  heroes[3].footX = 900; // far from Fara: still covered
  heroes[1].maxHP = 200; // per-hero sizing
  assert.equal(cast('Falie'), true);
  assert.deepEqual(wards(g), { 1: 18, 2: 36, 3: 18, 4: 18 });
  for (let i = 0; i < 3; i += 1) cast('Falie');
  assert.deepEqual(wards(g), { 1: 50, 2: 100, 3: 50, 4: 50 }, 'each hero caps at half its own max HP');
  assert.equal(cast('Falie'), false, 'capped wards cannot recast');
  assert.equal(absorbHeroWard(g, heroes[2], 30), 30);
  assert.deepEqual(wards(g), { 1: 50, 2: 100, 3: 20, 4: 50 }, 'a hit drains only the struck hero');
  assert.equal(absorbHeroWard(g, heroes[2], 45), 20, 'overflow passes to HP');
  assert.equal(g.HeroWardHPByUID[3], undefined);
  assert.equal(cast('Falie'), true, 'one drained hero lets Fara recast');
  assert.deepEqual(wards(g), { 1: 50, 2: 100, 3: 18, 4: 50 });
  heroes[0].hp = 0; cleanupRealtimeSkillActors({ state: { globals: g, entities: heroes } });
  assert.deepEqual(wards(g), { 2: 100, 3: 18, 4: 50 }, 'a fallen hero loses its own ward; others keep theirs');
});

test('Crimson Ward survives a boss clear and clears on boss entry or party defeat', () => {
  const { g, heroes, cast } = combat();
  cast('Falie');
  resetRealtimeSkillAttempt(g, heroes, { keepWard: true });
  assert.deepEqual(wards(g), { 1: 18, 2: 18, 3: 18, 4: 18 });
  g.ContinuousCombatStage = { bossAvailable: true, bossActive: false, region: 1, stage: 1 };
  armContinuousCombatBoss(g, heroes, () => {});
  assert.deepEqual(wards(g), {});
  cast('Falie'); g.ContinuousCombatStage = { region: 1, stage: 1, wave: 1, clearedPackMask: 0 };
  resetContinuousCombatAfterDefeat(g);
  assert.deepEqual(wards(g), {});
  cast('Falie'); resetRealtimeSkillAttempt(g, heroes);
  assert.deepEqual(wards(g), {});
});

test('Shadow hits the first foe in range for 240% damage', () => {
  const { enemies, cast } = combat();
  enemies[0].footX = 400; // out of reach
  assert.equal(cast('Huun'), true);
  assert.equal(enemies[0].hp, 1000);
  assert.equal(enemies[1].hp, 1000 - 240);
});

test('Bubble Pop hits every foe in range for 180% magic damage and pushes them back for 2 seconds', () => {
  const { enemies, cast } = combat();
  enemies[2].footX = 400; enemies[1].combatRank = 'boss';
  assert.equal(cast('Runa'), true);
  assert.deepEqual(enemies.map(e => e.hp), [820, 820, 1000]);
  assert.equal(enemies[0].streamState, 'retreating');
  assert.equal(enemies[0].streamRetreatRemaining, 2);
  assert.equal(enemies[1].streamState, 'engaged', 'bosses are not pushed');
});

test('Elevate rolls one party set, rerolls by replacement and ends when Kaja falls', () => {
  const { ctx, g, heroes, cast } = combat();
  const expected = Object.keys(ELEVATE_SETS)[Math.floor(previewSeededRng(12, 0) * 3)];
  heroes[0].footX = 900; // party-wide regardless of distance
  assert.equal(cast('Kojonn'), true);
  for (const hero of heroes) assert.equal(g.RealtimeSkillEffects[hero.uid].elevate.data.set, expected);
  assert.equal(g.RuntimeRandomDraws, 1);
  assert.equal(cast('Kojonn'), true);
  assert.equal(Object.values(g.RealtimeSkillEffects).filter(entries => entries.elevate).length, 4, 'a reroll replaces, never stacks');
  heroes[3].hp = 0; cleanupRealtimeSkillActors(ctx);
  assert.ok(Object.values(g.RealtimeSkillEffects).every(entries => !entries.elevate));
});

test('Elevate sets change the stats they name: SPD shortens basics, range widens reach, HP lifts max HP', () => {
  const { ctx, g, heroes } = combat();
  const grant = set => { for (const hero of heroes) (g.RealtimeSkillEffects ||= {})[hero.uid] = { elevate: { sourceUID: 4, expiresAt: 1e9, modifiers: ELEVATE_SETS[set].modifiers, data: { set } } }; };
  assert.equal(realtimeBasicInterval(g, heroes[0], 1.8), 1.8);
  grant('swift');
  assert.ok(Math.abs(realtimeBasicInterval(g, heroes[0], 1.8) - 1.8 / 1.05) < 1e-9);
  assert.equal(realtimeCombatStat(g, heroes[0], 'ATK'), 105);
  grant('reach'); tickRealtimeHeroSkillZones(ctx);
  assert.ok(Math.abs(actorAttackReach(heroes[0]) - 92 * 1.1) < 1e-9);
  grant('vital'); tickRealtimeHeroSkillZones(ctx);
  assert.equal(heroes[0].maxHP, 120);
});

test('passives switch on and off with their HP condition and leave nothing behind', () => {
  const { ctx, g, heroes, enemies } = combat();
  const [fara, hondo, runa] = heroes;
  fara.hp = 41; assert.equal(realtimeIncomingDamage(ctx, fara, enemies[0], 100), 100);
  fara.hp = 39; assert.equal(realtimeIncomingDamage(ctx, fara, enemies[0], 100), 50, 'Smoke Form halves damage below 40%');
  hondo.hp = 50; assert.equal(heroPassiveBasicMultiplier(hondo), 1);
  hondo.hp = 49; assert.equal(heroPassiveBasicMultiplier(hondo), 2);
  runa.hp = 80; assert.equal(realtimeCombatStat(g, runa, 'MAG'), 100);
  runa.hp = 81; assert.equal(realtimeCombatStat(g, runa, 'MAG'), 105); assert.equal(realtimeCombatStat(g, runa, 'RES'), 10.5);
  runa.hp = 0; assert.equal(heroPassive(runa), null, 'a KO hero has no passive');
  assert.deepEqual(g.RealtimeSkillEffects || {}, {}, 'passives store no effect records');
});

test('Royalty marks the struck foe with DEF -5% for 4s; every hero reads it and a repeat hit refreshes it', () => {
  const { g, heroes, enemies } = combat();
  const [fara, hondo] = heroes, foe = enemies[0];
  hondo.hp = 50; assert.equal(applyHeroPassiveOnHit(g, hondo, foe), false, 'no mark at or above 50% HP');
  hondo.hp = 49; assert.equal(applyHeroPassiveOnHit(g, hondo, foe), true);
  assert.equal(realtimeCombatStat(g, foe, 'DEF'), 28.5);
  assert.equal(applyHeroPassiveOnHit(g, fara, foe), false, 'only Royalty marks');
  g.time = 12; applyHeroPassiveOnHit(g, hondo, foe);
  assert.equal(realtimeCombatStat(g, foe, 'DEF'), 28.5, 'refresh, not stack');
  hondo.hp = 80; g.time = 15.9;
  assert.equal(realtimeCombatStat(g, foe, 'DEF'), 28.5, 'the mark outlives Royalty until its timer ends');
  g.time = 16; assert.equal(realtimeCombatStat(g, foe, 'DEF'), 30);
});

test('Ethereal Aura deals Faze damage each second to foes in Kaja range only while she stands', () => {
  const { ctx, g, heroes, enemies } = combat();
  enemies[2].footX = 400;
  tickRealtimeHeroSkillZones(ctx);
  g.time = 12.5; tickRealtimeHeroSkillZones(ctx);
  assert.deepEqual(enemies.map(e => e.hp), [998, 998, 1000]);
  g.ContinuousCombatStage = { region: 3 }; g.time = 13.5; tickRealtimeHeroSkillZones(ctx);
  assert.deepEqual(enemies.map(e => e.hp), [995, 995, 1000], 'damage scales with the chapter');
  heroes[3].hp = 0; g.time = 20; tickRealtimeHeroSkillZones(ctx);
  assert.deepEqual(enemies.map(e => e.hp), [995, 995, 1000]);
});

test('active passives raise hero buff signals; auras do not', () => {
  const { heroes } = combat();
  heroes.forEach(hero => { hero.hp = 30; });
  assert.deepEqual(heroPassiveSignals(heroes[0])[0].modifiers.map(m => m.channel), ['damageReduction']);
  assert.deepEqual(heroPassiveSignals(heroes[1])[0].modifiers.map(m => m.channel), ['damageAmp']);
  assert.deepEqual(heroPassiveSignals(heroes[2]), []);
  assert.deepEqual(heroPassiveSignals(heroes[3]), []);
  heroes[2].hp = 90;
  assert.deepEqual(heroPassiveSignals(heroes[2])[0].modifiers.map(m => m.channel), ['MAG', 'RES']);
});
