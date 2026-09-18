import {FLOW_ORB_TUNING as T} from './heroDefinitions.mjs';
import {recordFlowThreshold} from './personalFlow.mjs';
import {hasActiveAttackPresentation} from './turnGateController.mjs';
const roll = ctx => (ctx.flowRandom || ctx.random)();
const eligible = (actor, origin) => actor.kind === 'hero' && actor.hp > 0 && actor.flowEligible !== false && actor.uid !== origin.flowOwnerUID && !origin.excludedFlowUIDs?.includes(actor.uid);
// One record per orb: assignment happens now; the only charge writer runs at collection.
function spawnFlowOrbs(ctx, source, count, origin = {}, value = T.limitOrbValue, reason = 'enemy-death') {
 if (source?.kind!=='enemy'||!Number.isFinite(count) || !Number.isFinite(value) || count <= 0 || value <= 0) return 0;
 const recipients = ctx.actors.filter(actor => eligible(actor, origin));
 if (!recipients.length) return 0;
 const queue = ctx.state.FlowOrbs ||= [];
 for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
  const recipient = recipients[Math.min(recipients.length - 1, Math.floor(roll(ctx) * recipients.length))];
  const id = ctx.state.FlowOrbSerial = (ctx.state.FlowOrbSerial || 0) + 1;
  const born = Number(ctx.state.time || 0);
  queue.push({id, recipientUID:recipient.uid, sourceUID:source.uid, sourceKind:source.kind, x:Number(source.x ?? source.originX ?? 200), y:Number(source.y ?? source.originY ?? 140), groundOffset:Math.max(1,Number(ctx.state.EnemySize||40))/2,sourceSlot:source.heroDisplaySlot ?? source.heroIndex, value:Math.max(0, Number(value) || 0), reason, born, releasedAt:hasActiveAttackPresentation(ctx.state)?null:born, sessionId:ctx.state.CombatSessionId});
 }
 return Math.max(0, Math.floor(count));
}

export function dropEnemyFlowOrbs(ctx, enemy, origin = {}) {
 if(!enemy||enemy.kind!=='enemy'||enemy.flowDeathOrbSpawned)return 0;
 const spawned=spawnFlowOrbs(ctx,enemy,1,origin,T.limitOrbValue,'enemy-death');
 if(spawned)enemy.flowDeathOrbSpawned=true;
 return spawned;
}

export function advanceFlowOrbs(state, actors, now = Number(state.time || 0)) {
 const lifetime = T.releaseSeconds + T.flightSeconds;
 state.FlowOrbs = (state.FlowOrbs || []).filter(orb => {
  if (orb.sessionId !== state.CombatSessionId) return false;
  const hero = actors.find(a => a.uid === orb.recipientUID);
  if (!hero || hero.hp <= 0 || hero.flowEligible === false) return false;
  if (orb.releasedAt == null) {
   if (hasActiveAttackPresentation(state)) return true;
   orb.releasedAt = now;
  }
  const age = now - orb.releasedAt;
  if (!orb.collected && age >= lifetime) {
   const before=Math.min(T.flowMax,Math.max(0,Number(hero.flow||0)));
   hero.flow = Math.min(T.flowMax, before + orb.value);
   orb.collected = true;
   const threshold=recordFlowThreshold(state,hero,before,hero.flow);
   state.FlowOrbAudit={...(state.FlowOrbAudit||{}),arrivedRecipientUID:Number(hero.uid||0),arrivedValue:Number(orb.value||0),arrivedReason:String(orb.reason||''),arrivedCount:Number(state.FlowOrbAudit?.arrivedCount||0)+1,arrivedEnemyDeathCount:Number(state.FlowOrbAudit?.arrivedEnemyDeathCount||0)+(orb.reason==='enemy-death'?1:0),pendingThresholdToken:threshold?.token||state.FlowOrbAudit?.pendingThresholdToken||''};
  }
  return age < lifetime + T.collectFlashSeconds;
 });
}
