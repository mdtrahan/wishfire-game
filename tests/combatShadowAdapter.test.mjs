import test from 'node:test';
import assert from 'node:assert/strict';
import { SHADOW_DEFINITIONS, projectShadowStats, shadowHero, shadowEnemy, createShadowConfig } from '../src/core/combatShadowAdapter.mjs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { newHeroProgress, refreshHeroStats } from '../web-runner/src/core/heroProgression.mjs';
import { permanentHeroModifiers } from '../web-runner/src/core/realtimeSkillState.mjs';
import { projectCombatStat } from '../src/core/combatModifierRules.mjs';
import { createContinuousCombatStageState, getContinuousCombatStage } from '../web-runner/src/core/continuousCombatStage.mjs';

test('all Chapter 1 combatants have explicit definitions; Troll retains its R7 boss mapping', () => {
  const state = createContinuousCombatStageState(7);
  assert.ok(getContinuousCombatStage(state).enemyNames.every(name => SHADOW_DEFINITIONS[name]));
  const stage = getContinuousCombatStage({ ...state, bossActive: true });
  assert.equal(stage.id, '1-1-boss'); assert.deepEqual(stage.enemyNames, ['Troll']);
  assert.ok(stage.enemyNames.every(name => SHADOW_DEFINITIONS[name]));
});

test('R5 projects independent ATK, DEF, MAG and RES channels', () => {
  const reference = { HP: 100, ATK: 10, DEF: 10, MAG: 10, RES: 10, SPD: 10 };
  const resolved = { HP: 200, ATK: 20, DEF: 30, MAG: 40, RES: 50, SPD: 20 };
  const physical = projectShadowStats(resolved, reference, SHADOW_DEFINITIONS.Falie);
  const magic = projectShadowStats(resolved, reference, SHADOW_DEFINITIONS.Runa);
  assert.equal(physical.atk, 26.4 * 2); assert.equal(physical.def, 28 * 3);
  assert.equal(magic.atk, 36 * 2); assert.equal(magic.def, 10 * 3);
  assert.equal(magic.mag, 36 * 4); assert.equal(magic.res, 10 * 5);
  assert.equal(physical.mag, 26.4 * 4); assert.equal(physical.res, 28 * 5);
  assert.equal(physical.interval, .9); assert.equal(magic.interval, .7);
  assert.equal(physical.speed, SHADOW_DEFINITIONS.Falie.stats.speed);
  assert.equal(magic.reach, 270);
});

test('unprogressed four heroes retain slice bases; Fara level two and SPD nine match TDD-B vectors', () => {
  for (const [key, definition] of Object.entries(HERO_DEFINITIONS)) {
    assert.deepEqual(projectShadowStats(definition.baseStats, definition.baseStats, SHADOW_DEFINITIONS[key]), SHADOW_DEFINITIONS[key].stats);
  }
  const reference = HERO_DEFINITIONS.Falie.baseStats;
  const resolved = { ...reference, HP: 83, SPD: 9 };
  const result = projectShadowStats(resolved, reference, SHADOW_DEFINITIONS.Falie);
  assert.equal(result.hp, 464); assert.equal(result.interval, 1.6);
});

test('resolved level, equipment, training and stars enter once through WFM owners', () => {
  const actor = newHeroProgress('Falie');
  actor.kind = 'hero'; actor.currentLevel = 2; actor.equipmentStats = { HP: 17, ATK: 7 };
  refreshHeroStats(actor);
  const globals = { PartyTrainingLevels: { ATK: 5 }, HeroGrowth: { stars: { Falie: 8 } } };
  const modifiers = permanentHeroModifiers(globals, actor);
  const resolved = Object.fromEntries(Object.entries({ ...actor.stats, HP: actor.combatBaseMaxHP })
    .map(([key, value]) => [key, projectCombatStat(value, key, modifiers)]));
  const original = structuredClone({ actor, globals, resolved });
  const result = projectShadowStats(resolved, HERO_DEFINITIONS.Falie.baseStats, SHADOW_DEFINITIONS.Falie);
  assert.equal(result.hp, Math.floor(420 * 116 / 75));
  assert.equal(result.atk, 26.4 * resolved.ATK / HERO_DEFINITIONS.Falie.baseStats.ATK);
  assert.deepEqual({ actor, globals, resolved }, original);
});

test('checkpoint HP preserves living fraction and zero HP with no extra growth heal', () => {
  const reference = HERO_DEFINITIONS.Falie.baseStats;
  const input = { identity: 'Falie#1', key: 'Falie', slot: 0, position: { x: 500, y: 400 },
    resolved: { ...reference, HP: 150 }, reference, hp: 75, hostMaxHP: 150 };
  const hero = shadowHero(input, { x: 480, y: 400 });
  assert.equal(hero.hp, 420); assert.equal(hero.stats.hp, 840);
  assert.deepEqual(hero.formation_offset, { x: 20, y: 0 });
  assert.equal(shadowHero({ ...input, hp: 0 }, { x: 0, y: 0 }).hp, 0);
});

test('stage enemy stats are final host ratios and never re-scaled; zero slice DEF stays zero', () => {
  const reference = { HP: 100, ATK: 10, DEF: 0, MAG: 5, RES: 0, SPD: 10 };
  const input = { identity: 'host-42', key: 'Gobloc', position: { x: 600, y: 400 }, reference,
    resolved: { ...reference, HP: 50, ATK: 5, SPD: 5 }, hp: 25, hostMaxHP: 50 };
  const result = shadowEnemy(input);
  assert.equal(result.stats.hp, 70); assert.equal(result.hp, 35);
  assert.equal(result.stats.atk, 5); assert.equal(result.stats.def, 0); assert.equal(result.stats.interval, 5.2);
});

test('invalid stat inputs and unsupported WFM-only enemies fail closed; cadence respects ABI bounds', () => {
  const reference = HERO_DEFINITIONS.Falie.baseStats;
  assert.throws(() => projectShadowStats(reference, reference, undefined), /Unsupported/);
  for (const value of [NaN, Infinity, -1]) assert.throws(() => projectShadowStats({ ...reference, ATK: value }, reference, SHADOW_DEFINITIONS.Falie));
  assert.throws(() => projectShadowStats(reference, { ...reference, SPD: 0 }, SHADOW_DEFINITIONS.Falie));
  assert.throws(() => projectShadowStats({ ...reference, SPD: 0 }, reference, SHADOW_DEFINITIONS.Falie));
  assert.equal(projectShadowStats({ ...reference, SPD: 1e9 }, reference, SHADOW_DEFINITIONS.Falie).interval, 1 / 30);
});

test('create config copies geometry and preserves decimal-string seed and identities', () => {
  const geometry = { floor: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } }, formation_origin: { x: 500, y: 500 } };
  const result = createShadowConfig({ encounterId: 'one-stage', seed: '18446744073709551615', geometry, heroes: [], enemies: [] });
  assert.equal(result.seed, '18446744073709551615'); result.geometry.floor.min.x = -100;
  assert.equal(geometry.floor.min.x, 0);
});


test('ported Djinn preserves authored MAG/RES bases and projects both independently', () => {
  const reference = { HP: 55, ATK: 6, DEF: 6, MAG: 28, RES: 14, SPD: 11 };
  const input = { identity: 'djinn', key: 'Djinn', position: { x: 600, y: 400 }, reference,
    resolved: { ...reference, MAG: 56, RES: 42 }, hp: 55, hostMaxHP: 55 };
  const { stats } = shadowEnemy(input);
  assert.equal(stats.atk, 6); assert.equal(stats.def, 6);
  assert.equal(stats.mag, 56); assert.equal(stats.res, 42);
});

// Rust selects channels per action, including mixed-action WFM enemies.
test('host definitions carry no damage channel table', () => {
  for (const definition of Object.values(SHADOW_DEFINITIONS)) assert.equal(Object.hasOwn(definition, 'channel'), false);
});
