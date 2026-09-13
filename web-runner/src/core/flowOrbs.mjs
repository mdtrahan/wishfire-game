import {FLOW_ORB_TUNING as T} from './heroDefinitions.mjs';
const roll = ctx => (ctx.flowRandom || ctx.random)();
const eligible = (actor, origin) => actor.kind === 'hero' && actor.hp > 0 && actor.flowEligible !== false && actor.uid !== origin.flowOwnerUID && !origin.excludedFlowUIDs?.includes(actor.uid);
// One record per orb: assignment happens now; the only charge writer runs at collection.
export function spawnFlowOrbs(ctx, source, count, origin = {}, value = T.limitOrbValue, reason = 'enemy-death') {
 if (!Number.isFinite(count) || !Number.isFinite(value) || count <= 0 || value <= 0) return 0;
 const recipients = ctx.actors.filter(actor => eligible(actor, origin));
 if (!recipients.length) return 0;
 const queue = ctx.state.FlowOrbs ||= [];
 for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
  const recipient = recipients[Math.min(recipients.length - 1, Math.floor(roll(ctx) * recipients.length))];
  const id = ctx.state.FlowOrbSerial = (ctx.state.FlowOrbSerial || 0) + 1;
  queue.push({id, recipientUID:recipient.uid, sourceUID:source.uid, sourceKind:source.kind, x:Number(source.x ?? source.originX ?? 200), y:Number(source.y ?? source.originY ?? 140), groundOffset:Math.max(1,Number(ctx.state.EnemySize||40))/2,sourceSlot:source.heroDisplaySlot ?? source.heroIndex, value:Math.max(0, Number(value) || 0), reason, born:Number(ctx.state.time || 0), sessionId:ctx.state.CombatSessionId});
 }
 return Math.max(0, Math.floor(count));
}

export function dropEnemyFlowOrbs(ctx, enemy, origin = {}) {
 // AF comes from role actions. Enemy death remains a combat settlement event,
 // not a random meter lottery.
 return 0;
}

export function spawnDirectedFlowOrb(ctx, source, recipient, value = T.limitOrbValue, reason = 'role-award') {
 if (!source || !recipient || recipient.kind !== 'hero' || Number(recipient.hp || 0) <= 0) return 0;
 const amount=Math.max(0,Number(value)||0);if(amount<=0)return 0;
 const queue=ctx.state.FlowOrbs ||= [];
 const id=ctx.state.FlowOrbSerial=(ctx.state.FlowOrbSerial||0)+1;
 queue.push({id,recipientUID:recipient.uid,sourceUID:source.uid,sourceKind:source.kind,x:Number(source.x??source.originX??200),y:Number(source.y??source.originY??140),groundOffset:Math.max(1,Number(ctx.state.EnemySize||40))/2,sourceSlot:source.heroDisplaySlot??source.heroIndex,value:amount,reason,born:Number(ctx.state.time||0),sessionId:ctx.state.CombatSessionId});
 return 1;
}

export function advanceFlowOrbs(state, actors, now = Number(state.time || 0)) {
 const lifetime = T.releaseSeconds + T.flightSeconds;
 state.FlowOrbs = (state.FlowOrbs || []).filter(orb => {
  if (orb.sessionId !== state.CombatSessionId) return false;
  const hero = actors.find(a => a.uid === orb.recipientUID);
  if (!hero || hero.hp <= 0 || hero.flowEligible === false) return false;
  if (!orb.collected && now - orb.born >= lifetime) {
   hero.flow = Math.min(T.flowMax, Math.max(0, hero.flow || 0) + orb.value);
   orb.collected = true;
  }
  return now - orb.born < lifetime + T.collectFlashSeconds;
 });
}
