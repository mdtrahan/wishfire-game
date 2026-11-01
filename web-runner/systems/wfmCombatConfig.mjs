import { projectShadowStats, SHADOW_DEFINITIONS, createShadowConfig, WFM_ENEMY_DEFINITIONS } from '../../src/core/combatShadowAdapter.mjs';
import { COMBAT_PARTY_CAP, SLICE_FLOOR, SLICE_ORIGIN, SLICE_TRAVEL_SLOTS, sliceHeroPosition, slicePackPosition } from './rustCombatArena.mjs';
import { getContinuousCombatStage } from '../src/core/continuousCombatStage.mjs';
import { realtimeCooldownSeconds } from '../src/core/realtimeCooldown.mjs';
import { permanentHeroSource } from '../src/core/heroPermanentInputs.mjs';
import { heroStarSkillMultipliers } from '../src/core/heroGrowthRules.mjs';
import { heroDefinition } from '../src/core/heroDefinitions.mjs';
import { permanentHeroModifiers } from '../src/core/realtimeSkillState.mjs';
import { projectCombatStat } from '../../src/core/combatModifierRules.mjs';

export function wfmEnemyInput(actor, enemyRows) {
  if (!Object.hasOwn(WFM_ENEMY_DEFINITIONS, actor.name)) throw new Error(`WFM combat: unmapped enemy "${actor.name}"`);
  const reference = enemyRows.find(row => row.name === actor.name);
  if (!reference) throw new Error(`Missing authored combat reference: ${actor.name}`);
  return { identity: String(actor.uid), key: actor.name, speed: actor.streamWalkSpeed, interval: realtimeCooldownSeconds({ ...actor, type: 1, attackDelivery: actor.streamDelivery }), position: slicePackPosition({ x: Number(actor.x), y: Number(actor.y) }, actor.name === 'Troll'), reference,
    resolved: { ...actor.stats, HP: actor.maxHP }, hp: actor.hp, hostMaxHP: actor.maxHP };
}

// Creation and live revisions share one clean, permanent-only projection (R5/R6).
export function wfmHeroPermanentInputs(g, actor) {
  const source = permanentHeroSource(actor) || actor;
  const definition = heroDefinition(source), base = { ...source.stats, HP: source.combatBaseMaxHP || source.maxHP };
  const modifiers = permanentHeroModifiers(g, { ...source, stats: base });
  const resolved = Object.fromEntries(Object.keys(definition.baseStats).map(stat =>
    [stat, projectCombatStat(base[stat], stat, modifiers)]));
  const growth = heroStarSkillMultipliers(g.HeroGrowth, source.heroInstanceKey || definition.key);
  return { stats: projectShadowStats(resolved, definition.baseStats, SHADOW_DEFINITIONS[definition.key]),
    host_max_hp: resolved.HP,
    skill_modifiers: { special_potency: growth.specialMagnitude, meter_rate: 1 / growth.specialCooldown } };
}

export function createWfmCombatConfig({ globals: g, entities, enemyRows, encounterId }) {
  for (const name of getContinuousCombatStage(g.ContinuousCombatStage).enemyNames) {
    if (!Object.hasOwn(WFM_ENEMY_DEFINITIONS, name)) throw new Error(`WFM combat: unmapped stage enemy "${name}"`);
    if (!enemyRows.some(row => row.name === name)) throw new Error(`WFM combat: missing authored enemy "${name}"`);
  }
  const heroes = entities.filter(actor => actor.kind === 'hero');
  if (!heroes.length || heroes.length > COMBAT_PARTY_CAP) throw new Error('WFM combat: party must contain 1..4 heroes');
  const origin = SLICE_ORIGIN;
  const config = { continuous: true, ...createShadowConfig({ encounterId, seed: g.ContinuousCombatStage.seed,
    geometry: { floor: SLICE_FLOOR,
      viewport_world: { x: 720, y: SLICE_FLOOR.max.y - SLICE_FLOOR.min.y },
      formation_origin: origin, screen_bound: false, contain_bodies: true },
    heroes: heroes.map((actor, slot) => {
      const definition = heroDefinition(actor);
      const permanent = wfmHeroPermanentInputs(g, actor);
      return { identity: String(actor.heroInstanceKey), key: definition.key, slot,
        position: sliceHeroPosition(slot), permanent, hp: actor.hp, hostMaxHP: actor.maxHP };
    }),
    enemies: entities.filter(actor => actor.kind === 'enemy' && actor.hp > 0).map(actor => wfmEnemyInput(actor, enemyRows)),
    summon: { resolved: g.EnemyData.find(row => row.name === 'Gobloc'), reference: enemyRows.find(row => row.name === 'Gobloc') },
  }) };
  config.heroes.forEach((hero, slot) => {
    hero.formation_offset = { ...SLICE_TRAVEL_SLOTS[slot] };
  });
  return config;
}
