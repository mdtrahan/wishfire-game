import {COMBAT_RECEIPT_WINDOW,createCombatRewardOutboxState} from '../src/core/combatRewardOutbox.mjs';
import {enemyBagKillPoints} from '../src/core/lampGear.mjs';
const known=new Set(['spawned','damage','died','downed','revived','all_down','ended','despawned','presentation','permanent_inputs_applied']);
const decimal=value=>typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)&&BigInt(value)<=18446744073709551615n;
// Transport identity lives here; economic identity retains WFM battle/spawn IDs.
export function createCombatRewardOutbox({globals:g,persistProgress,equipmentProgress,progression}){
 let settling=null;
 function save(){
  g.HeroProgressDirty=true;
  if(persistProgress()!==true)throw new Error(g.HeroProgressStorageError||'Combat reward outbox save failed.');
 }
 function beginEncounter(encounterId){
  const next=createCombatRewardOutboxState(g.HeroProgress.combatRewardOutbox);
  if(typeof encounterId!=='string'||!encounterId||encounterId.length>256)throw new Error('Invalid combat encounter identity.');
  if(Object.hasOwn(next.streams,encounterId)&&next.streams[encounterId].sequence!=='0')throw new Error('Rust encounter identity was already used.');
  next.activeEncounter=encounterId;
  next.streams=Object.fromEntries(Object.entries(next.streams).filter(([,stream])=>stream.pending.length));
  const previous=g.HeroProgress.combatRewardOutbox;
  g.HeroProgress.combatRewardOutbox=next;
  try{save();}catch(error){g.HeroProgress.combatRewardOutbox=previous;throw error;}
 }
 function consumeBatch(snapshot,events,resolveEnemy){
  if(snapshot.state==='event_overflow'||snapshot.event_overflow)throw new Error('Rust event overflow.');
  if(!g.HeroProgress||typeof snapshot.encounter_id!=='string'||!snapshot.encounter_id||snapshot.encounter_id.length>256||!decimal(snapshot.step)||!decimal(snapshot.last_event_sequence)||!Array.isArray(events))throw new Error('Invalid Rust event batch.');
  const next=createCombatRewardOutboxState(g.HeroProgress.combatRewardOutbox);
  const id=snapshot.encounter_id;
  if(next.activeEncounter&&next.activeEncounter!==id)throw new Error('Unknown Rust encounter.');
  next.activeEncounter=id;
  if(!Object.hasOwn(next.streams,id)&&Object.keys(next.streams).length>=64)throw new Error('Combat reward outbox encounter capacity exceeded.');
  const stream=Object.hasOwn(next.streams,id)?next.streams[id]:{sequence:'0',step:'0',recent:{},pending:[]};
  let changed=false,delivery=null;
  for(const event of events){
   if(event.encounter_id!==id||event.schema?.major!==1||event.schema?.minor>1||!decimal(event.sequence)||event.sequence==='0'||!decimal(event.step)||BigInt(event.step)>BigInt(snapshot.step)||!known.has(event.body?.kind))throw new Error('Unknown or invalid Rust gameplay event.');
   const seq=BigInt(event.sequence),body=JSON.stringify(event);
   if(delivery!==null&&seq!==delivery+1n)throw new Error('Rust event batch sequence gap.');
   delivery=seq;
   if(seq<=BigInt(stream.sequence)){
    if(!Object.hasOwn(stream.recent,event.sequence))throw new Error('Unknown stale Rust event sequence. Request the retained cursor.');
    if(stream.recent[event.sequence]!==body)throw new Error('Rust event sequence collision.');
    continue;
   }
   if(seq!==BigInt(stream.sequence)+1n||BigInt(event.step)<BigInt(stream.step))throw new Error('Rust event sequence gap.');
   if(event.body.kind==='died'){
    const data=event.body.data;
    if(!data||!['hero','enemy'].includes(data.team)||data.reason!=='combat')throw new Error('Unknown Rust death provenance.');
    if(data.team==='enemy'){
     const enemy=resolveEnemy(data);
     if(enemy?.kind!=='enemy'||!Number.isSafeInteger(enemy.uid)||enemy.uid<1||data.host_id!=null&&String(enemy.uid)!==data.host_id)throw new Error('Unknown Rust enemy reward identity.');
     const battleId=g.ProgressionBattle?.id,amount=enemyBagKillPoints(enemy);
     if(typeof battleId!=='string'||!battleId)throw new Error('Missing WFM reward battle.');
     stream.pending.push({sequence:event.sequence,battleId,id:`enemy:${battleId}:${enemy.uid}`,amount,enemy:{kind:'enemy',uid:enemy.uid,enemyRole:amount?'boss':'ordinary'}});
    }
   }
   stream.sequence=event.sequence;stream.step=event.step;stream.recent[event.sequence]=body;changed=true;
  }
  if(BigInt(snapshot.last_event_sequence)!==BigInt(stream.sequence))throw new Error('Rust event sequence gap.');
  if(!changed)return stream.sequence;
  stream.recent=Object.fromEntries(Object.entries(stream.recent).slice(-COMBAT_RECEIPT_WINDOW));
  Object.defineProperty(next.streams,id,{value:stream,enumerable:true,configurable:true,writable:true});
  createCombatRewardOutboxState(next);
  // Queue Bag awards in the SAME source save as the delivery cursor and outbox.
  const previous=g.HeroProgress.combatRewardOutbox,priorBag={...g.HeroProgress.pendingBagKillRewards};
  g.HeroProgress.combatRewardOutbox=next;
  for(const row of stream.pending)if(row.amount)(g.HeroProgress.pendingBagKillRewards||={})[row.id]=row.amount;
  try{save();}catch(error){g.HeroProgress.combatRewardOutbox=previous;g.HeroProgress.pendingBagKillRewards=priorBag;throw error;}
  return stream.sequence;
 }
 function settlePendingReceipts(){
  if(settling)return settling;
  settling=(async()=>{
   const outbox=createCombatRewardOutboxState(g.HeroProgress?.combatRewardOutbox);
   const pending=Object.values(outbox.streams).flatMap(stream=>stream.pending);
   if(!pending.length){await equipmentProgress?.sync();return progression?.sync?await progression.sync():true;}
   if(!equipmentProgress)throw new Error('Combat reward settlement requires equipment storage.');
   // Re-establish source durability before any retry touches the destination.
   for(const row of pending)if(row.amount)(g.HeroProgress.pendingBagKillRewards||={})[row.id]=row.amount;
   save();
   await equipmentProgress.sync();
   // Replay quest observations through their existing stable receipt domain.
   if(progression?.record)for(const row of pending)progression.record({id:row.id,type:'enemy_defeat'});
   // COT owns Essence receipts independently; combat events cannot mint Essence.
   if(progression?.sync&&await progression.sync()===false)return false;
   const current=g.HeroProgress.combatRewardOutbox;
   const next=createCombatRewardOutboxState(current);
   for(const[id,stream]of Object.entries(next.streams)){
    const settled=new Set((outbox.streams[id]?.pending||[]).map(row=>row.sequence));
    stream.pending=stream.pending.filter(row=>!settled.has(row.sequence));
   }
   g.HeroProgress.combatRewardOutbox=next;
   try{save();}catch(error){g.HeroProgress.combatRewardOutbox=current;throw error;}
   return true;
  })().finally(()=>{settling=null;});
  return settling;
 }
 return{beginEncounter,consumeBatch,settlePendingReceipts};
}
