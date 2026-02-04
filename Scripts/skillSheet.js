import { state } from './state.js';

function getGlobals(ctx) {
  return (ctx && ctx.state ? ctx.state.globals : state.globals);
}

export function Party_DEF_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_DEF = Math.min(g.PartyBuffCap_DEF || 0, (g.PartyBuff_DEF || 0) + amt);
  if ((g.BuffTurns_DEF || 0) <= 0) g.BuffTurns_DEF = turns || 0;
  g.BuffText = `BUFF DEF=${g.PartyBuff_DEF}/${g.PartyBuffCap_DEF}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_SPD_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_SPD = Math.min(g.PartyBuffCap_SPD || 0, (g.PartyBuff_SPD || 0) + amt);
  if ((g.BuffTurns_SPD || 0) <= 0) g.BuffTurns_SPD = turns || 0;
  g.BuffText = `BUFF SPD=${g.PartyBuff_SPD}/${g.PartyBuffCap_SPD}`;
  console.log(`[BUFF] SPD_UP -> ${g.PartyBuff_SPD}/${g.PartyBuffCap_SPD} (+${amt})`);
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_ATK_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_ATK = Math.min(g.PartyBuffCap_ATK || 0, (g.PartyBuff_ATK || 0) + amt);
  if ((g.BuffTurns_ATK || 0) <= 0) g.BuffTurns_ATK = turns || 0;
  g.BuffText = `BUFF ATK=${g.PartyBuff_ATK}/${g.PartyBuffCap_ATK}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_MAG_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_MAG = Math.min(g.PartyBuffCap_MAG || 0, (g.PartyBuff_MAG || 0) + amt);
  if ((g.BuffTurns_MAG || 0) <= 0) g.BuffTurns_MAG = turns || 0;
  g.BuffText = `BUFF MAG=${g.PartyBuff_MAG}/${g.PartyBuffCap_MAG}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_RES_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_RES = Math.min(g.PartyBuffCap_RES || 0, (g.PartyBuff_RES || 0) + amt);
  if ((g.BuffTurns_RES || 0) <= 0) g.BuffTurns_RES = turns || 0;
  g.BuffText = `BUFF RES=${g.PartyBuff_RES}/${g.PartyBuffCap_RES}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function ApplyPartyHeal(ctx, healAmount) {
  const g = getGlobals(ctx);
  const before = g.PartyHP || 0;
  const desiredHP = Math.min(g.PartyMaxHP || 0, (g.PartyHP || 0) + (healAmount || 0));
  g.PartyHP = desiredHP;
  console.log(`[REGEN] ApplyPartyHeal amount=${healAmount} before=${before} after=${g.PartyHP} max=${g.PartyMaxHP}`);
  ctx.callFunction('SyncPartyHPToHeroes');
  ctx.callFunction('UpdateHeroHPUI');
  // Preserve shared party HP after hero HP normalization
  g.PartyHP = desiredHP;
  ctx.callFunction('UpdatePartyHPText');
  ctx.callFunction('UpdatePartyHPBar');
  const delta = Math.max(0, (g.PartyHP || 0) - before);
  if (delta > 0 && !g.SuppressHeroHealText) {
    const positions = g.HeroIconPosByIndex || [];
    for (const pos of positions) {
      if (pos) ctx.callFunction('SpawnDamageText', delta, pos.x, pos.y, 'heal', 'hero');
    }
  }
}

export function DoHeal(ctx, actorUID) {
  let heal = ctx.callFunction('CalculateHeal', actorUID);
  const g = getGlobals(ctx);
  if (g.ApplyChainToNextHeal === 1) {
    heal = Math.ceil(heal * (g.ChainMultiplier || 1));
    g.ApplyChainToNextHeal = 0;
  }
  const actor = ctx.callFunction('GetActorByUID', actorUID);
  const actorName = actor && actor.name ? actor.name : '?';
  if (actor && actor.name === 'Kojonn') {
    const totalTicks = 8;
    const perTick = Math.max(1, Math.floor(heal / totalTicks));
    const nowTick = getGlobals(ctx).RegenTickCounter || 0;
    console.log(`[REGEN] start actor=${actorName} totalHeal=${Math.round(heal)} ticks=${totalTicks} perTick=${perTick}`);
    if (!g.PartyRegens) g.PartyRegens = [];
    g.PartyRegens.push({
      remainingFires: totalTicks,
      healPerFire: perTick,
      firesEveryTicks: 1,
      nextFireTick: nowTick + 1,
      sourceUID: actorUID
    });
    ctx.callFunction('LogCombat', `${actorName} applies Regen over time!`);
  } else {
    const beforeHP = g.PartyHP || 0;
    ctx.callFunction('ApplyPartyHeal', heal);
    const afterHP = g.PartyHP || 0;
    ctx.callFunction('LogCombat', `${actorName} healed party for ${Math.max(0, afterHP - beforeHP)}`);
  }
  g.ActionLockUntil = (g.time || 0) + (g.DamageTextDurationSec || 1.35);
  g.DeferAdvance = 1;
  g.AdvanceAfterAction = 1;
  g.ActionOwnerUID = actorUID;
}
