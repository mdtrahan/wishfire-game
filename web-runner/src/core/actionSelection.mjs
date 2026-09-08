import {heroDefinition} from './heroDefinitions.mjs';

export function actionCapacity(hero) {
  const value = Number(hero.actionSlotsPerTurn ?? heroDefinition(hero)?.actionSlotsPerTurn ?? 3);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 3;
}

export function selectionBudget(hero, queue = []) {
  const definition = heroDefinition(hero);
  const skills = definition ? [definition.basic, ...definition.actives, definition.special] : [];
  const reservedSP = queue.reduce((total, action) => total + (skills.find(skill => skill.skillId === action.skillId)?.spCost || 0), 0);
  return {
    capacity: actionCapacity(hero),
    queuedActions: queue.length,
    remainingActionSlots: Math.max(0, actionCapacity(hero) - queue.length),
    reservedSP,
    availableSP: Math.max(0, (hero.sp || 0) - reservedSP),
  };
}

export function battlefieldTargets(actors, hero, skill, globals) {
  const allied = ['self', 'ally', 'deadAlly', 'allAllies'].includes(skill.targetType);
  const candidates = actors.filter(actor => (allied ? actor.kind === hero.kind : actor.kind === (hero.kind === 'hero' ? 'enemy' : 'hero'))
    && (skill.targetType === 'deadAlly' ? actor.hp === 0 : actor.hp > 0));
  if (skill.targetType === 'self') return hero.hp > 0 ? [hero.uid] : [];
  if (['allAllies', 'allEnemies'].includes(skill.targetType)) return candidates.map(actor => actor.uid);
  const selected = allied ? globals.SelectedAllyUID : globals.SelectedEnemyUID;
  return [candidates.find(actor => actor.uid === selected)?.uid ?? candidates[0]?.uid].filter(uid => uid != null);
}
