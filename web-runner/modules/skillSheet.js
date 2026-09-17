import { state } from './state.js';
import { emitResolvedHealEvent } from './heroCommands.mjs';

function getGlobals(ctx) {
  return (ctx && ctx.state ? ctx.state.globals : state.globals);
}

function emitActiveHeroHeal(ctx, actor, beforeHP, presentation = 'minor') {
  if (typeof emitResolvedHealEvent === 'function') return emitResolvedHealEvent(ctx, actor, actor, beforeHP, { presentation });
  const delta = Math.max(0, Number(actor?.hp || 0) - Math.max(0, Number(beforeHP || 0)));
  if (delta > 0) ctx.callFunction('SpawnDamageText', delta, actor.x, actor.y, 'heal', 'hero');
  return delta;
}

export function Party_DEF_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_DEF = Math.min(g.PartyBuffCap_DEF || 0, (g.PartyBuff_DEF || 0) + amt);
  g.BuffTurns_DEF = 0;
  g.BuffText = `BUFF DEF=${g.PartyBuff_DEF}/${g.PartyBuffCap_DEF}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_SPD_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_SPD = Math.min(g.PartyBuffCap_SPD || 0, (g.PartyBuff_SPD || 0) + amt);
  g.BuffTurns_SPD = 0;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_ATK_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_ATK = Math.min(g.PartyBuffCap_ATK || 0, (g.PartyBuff_ATK || 0) + amt);
  g.BuffTurns_ATK = 0;
  g.BuffText = `BUFF ATK=${g.PartyBuff_ATK}/${g.PartyBuffCap_ATK}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_MAG_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_MAG = Math.min(g.PartyBuffCap_MAG || 0, (g.PartyBuff_MAG || 0) + amt);
  g.BuffTurns_MAG = 0;
  g.BuffText = `BUFF MAG=${g.PartyBuff_MAG}/${g.PartyBuffCap_MAG}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_RES_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_RES = Math.min(g.PartyBuffCap_RES || 0, (g.PartyBuff_RES || 0) + amt);
  g.BuffTurns_RES = 0;
  g.BuffText = `BUFF RES=${g.PartyBuff_RES}/${g.PartyBuffCap_RES}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function ApplyActiveHeroHeal(ctx, healAmount, presentation = 'minor') {
  const g = getGlobals(ctx);
  const actor = ctx.callFunction('GetActorByUID', ctx.callFunction('GetCurrentTurn'));
  if (!actor || actor.kind !== 'hero' || !(actor.hp > 0)) return 0;
  const amount = Number(healAmount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const before = actor.hp;
  const maxHP = Math.max(before, Number(actor.maxHP || 0));
  actor.hp = Math.min(maxHP, before + Math.floor(amount));
  const delta = Math.max(0, actor.hp - before);
  ctx.callFunction('UpdateHeroHPUI');
  ctx.callFunction('UpdatePartyHPText');
  ctx.callFunction('UpdatePartyHPBar');
  if (delta > 0 && !g.SuppressHeroHealText) emitActiveHeroHeal(ctx, actor, before, presentation);
  return delta;
}

export function DoHeal(ctx, actorUID, potencyMultiplier = 1) {
  const g = getGlobals(ctx);
  const actor = ctx.callFunction('GetActorByUID', actorUID);
  if (Number(ctx.callFunction('GetCurrentTurn')) !== Number(actorUID) || !actor || actor.kind !== 'hero' || !(actor.hp > 0)) return false;
  const actorMaxHP = Math.max(0, Number(actor.maxHP || 0));
  let heal = Math.max(1, Math.ceil(actorMaxHP * 7 / 100));
  const potency = Math.max(1, Number(potencyMultiplier || 1));
  const actorName = actor && actor.name ? actor.name : '?';
  if (potency > 1) {
    const criticalHealMinPct = 32;
    const criticalHealMaxPct = 42;
    const hasRuntimeRandom = typeof g.RuntimeRandom === 'function';
    const rng = hasRuntimeRandom ? g.RuntimeRandom : Math.random;
    const rawRoll = Number(rng());
    const roll = Number.isFinite(rawRoll) && rawRoll >= 0 && rawRoll < 1
      ? rawRoll
      : (hasRuntimeRandom ? 0 : Math.random());
    const criticalHealPercent = criticalHealMinPct + Math.floor(roll * (criticalHealMaxPct - criticalHealMinPct + 1));
    heal = Math.max(1, Math.ceil(actorMaxHP * criticalHealPercent / 100));
    if (g.ApplyChainToNextHeal === 1) g.ApplyChainToNextHeal = 0;
  } else if (g.ApplyChainToNextHeal === 1) {
    heal = Math.ceil(heal * (g.ChainMultiplier || 1));
    g.ApplyChainToNextHeal = 0;
  }
  const totalHeal = ctx.callFunction('ApplyActiveHeroHeal', heal, 'major');
  ctx.callFunction('LogCombat', potency > 1 ? `${actorName} used Magic Fruit!` : `${actorName} heals for ${totalHeal}`);
  g.ActionLockUntil = (g.time || 0) + (g.DamageTextDurationSec || 1.35);
  g.DeferAdvance = 1;
  g.AdvanceAfterAction = 1;
  g.ActionOwnerUID = actorUID;
  return true;
}
