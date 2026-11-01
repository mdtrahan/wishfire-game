import { createShadowConfig } from '../../src/core/combatShadowAdapter.mjs';
import { heroDefinition } from '../src/core/heroDefinitions.mjs';
import { permanentHeroModifiers } from '../src/core/realtimeSkillState.mjs';
import { projectCombatStat } from '../../src/core/combatModifierRules.mjs';
import { deriveCombatWorldBounds, deriveCombatWorldVerticalBounds } from '../../src/core/combatOrientation.mjs';

export function wfmEnemyInput(actor, enemyRows) {
  const reference = enemyRows.find(row => row.name === actor.name);
  if (!reference) throw new Error(`Missing authored combat reference: ${actor.name}`);
  return { identity: String(actor.uid), key: actor.name, position: { x: Number(actor.x), y: Number(actor.y) }, reference,
    resolved: { ...actor.stats, HP: actor.maxHP }, hp: actor.hp, hostMaxHP: actor.maxHP };
}

export function createWfmCombatConfig({ globals: g, entities, enemyRows, encounterId }) {
  const heroes = entities.filter(actor => actor.kind === 'hero');
  const x = deriveCombatWorldBounds(), y = deriveCombatWorldVerticalBounds();
  const origin = { x: heroes.reduce((sum, a) => sum + a.x, 0) / heroes.length,
    y: heroes.reduce((sum, a) => sum + a.y, 0) / heroes.length };
  return createShadowConfig({ encounterId, seed: g.ContinuousCombatStage.seed,
    geometry: { floor: { min: { x: x.minX, y: y.minY }, max: { x: x.maxX, y: y.maxY } },
      viewport_world: { x: x.visibleWorldWidth, y: (y.safeViewportBottom - y.safeViewportTop) / y.zoom },
      formation_origin: origin, screen_bound: false },
    heroes: heroes.map((actor, slot) => {
      const definition = heroDefinition(actor), modifiers = permanentHeroModifiers(g, actor);
      const resolved = Object.fromEntries(Object.keys(definition.baseStats).map(stat => [stat,
        projectCombatStat(stat === 'HP' ? actor.combatBaseMaxHP : actor.stats[stat], stat, modifiers)]));
      return { identity: String(actor.heroInstanceKey), key: definition.key, slot,
        position: { x: Number(actor.x), y: Number(actor.y) }, resolved, reference: definition.baseStats,
        hp: actor.hp, hostMaxHP: actor.maxHP };
    }),
    enemies: entities.filter(actor => actor.kind === 'enemy' && actor.hp > 0).map(actor => wfmEnemyInput(actor, enemyRows)),
    summon: { resolved: g.EnemyData.find(row => row.name === 'Gobloc'), reference: enemyRows.find(row => row.name === 'Gobloc') },
  });
}
