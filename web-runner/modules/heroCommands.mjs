import { derivePresentationTurnBarrier } from '../src/core/turnGateController.mjs';
import { capturePendingEnemyTargetIntent } from '../src/core/pendingSuperGemHandoff.mjs';

export function getHeroCommandSlots(entities) {
  const slots = Array(6).fill(null);
  for (const hero of entities) {
    if (hero?.kind !== 'hero') continue;
    const slot = Number(hero.heroDisplaySlot ?? hero.displaySlot ?? hero.heroIndex);
    if (Number.isInteger(slot) && slot >= 0 && slot < slots.length) slots[slot] = hero;
  }
  return slots;
}

export function canUseHeroCommand(ctx, actorUID) {
  const g = ctx.state.globals;
  const hero = ctx.state.entities.find(actor => actor.uid === actorUID && actor.kind === 'hero');
  return !!hero && Number(hero.hp) > 0 && g.GamePhase === 'RUNTIME'
    && !g.BattleStartActive && !g.IsPlayerBusy && Number(g.TurnPhase) === 0
    && !g.PendingSkillID && !g.PendingSuperGemAction
    && Number(ctx.callFunction('GetCurrentTurn')) === actorUID
    && ctx.callFunction('GetEnemyRosterStability')?.stable === true
    && derivePresentationTurnBarrier({ globals: g }).canClaimCombatAction;
}

// The editor owns drafts. Only this commit boundary writes combat intent.
export function executeHeroCommand(ctx, { actorUID, skillId = 'HERO_SINGLE', targetUID } = {}) {
  if (skillId !== 'HERO_SINGLE' || !canUseHeroCommand(ctx, actorUID)) return false;
  const target = ctx.state.entities.find(actor => actor.uid === targetUID && actor.kind === 'enemy' && Number(actor.hp) > 0);
  if (!target) return false;
  const g = ctx.state.globals;
  const keys = ['PendingSkillID', 'PendingActor', 'SelectedEnemyUID', 'SelectedEnemyUIDOwner', 'PendingManualTargetIntent', 'ManualTargetTraceSequence'];
  const before = keys.map(key => g[key]);
  g.PendingSkillID = skillId;
  g.PendingActor = actorUID;
  capturePendingEnemyTargetIntent({ globals: g, actorUID, target, now: Number(g.time || 0) });
  ctx.callFunction('ExecuteSkill', skillId, actorUID);
  if (!g.HeroAction?.active || Number(g.ActionActorUID) !== actorUID) {
    keys.forEach((key, index) => { g[key] = before[index]; });
    return false;
  }
  g.PendingSkillID = '';
  g.PendingActor = 0;
  return true;
}
