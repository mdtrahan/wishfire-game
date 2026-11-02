// Fail closed: dropping a malformed receipt could silently lose an earned reward.
const decimal=value=>typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)&&BigInt(value)<=18446744073709551615n;
export const COMBAT_RECEIPT_WINDOW=128;
export function createCombatRewardOutboxState(saved){
 if(saved===undefined)return{version:1,streams:{}};
 const invalid=()=>{throw new Error('Invalid combat reward outbox. Original save must be preserved.');};
 if(!saved||saved.version!==1||!saved.streams||Array.isArray(saved.streams)||typeof saved.streams!=='object'||Object.keys(saved.streams).length>64)invalid();
 if(saved.activeEncounter!==undefined&&(typeof saved.activeEncounter!=='string'||!saved.activeEncounter||saved.activeEncounter.length>256))invalid();
 for(const[id,stream]of Object.entries(saved.streams)){
  if(!id||id.length>256||!stream||!decimal(stream.sequence)||!decimal(stream.step)||!stream.recent||typeof stream.recent!=='object'||Array.isArray(stream.recent)||!Array.isArray(stream.pending)||stream.pending.length>512||Object.keys(stream.recent).length>COMBAT_RECEIPT_WINDOW)invalid();
  for(const[sequence,body]of Object.entries(stream.recent))if(!decimal(sequence)||BigInt(sequence)>BigInt(stream.sequence)||typeof body!=='string')invalid();
  const seen=new Set();
  for(const row of stream.pending){
   if(!row||!decimal(row.sequence)||BigInt(row.sequence)>BigInt(stream.sequence)||seen.has(row.sequence)||typeof row.battleId!=='string'||!row.battleId||!Number.isSafeInteger(row.enemy?.uid)||row.enemy.uid<1||row.enemy.kind!=='enemy'||!['boss','ordinary'].includes(row.enemy.enemyRole)||row.id!==`enemy:${row.battleId}:${row.enemy.uid}`||row.id.length>180||row.amount!==(row.enemy.enemyRole==='boss'?5:0))invalid();
   seen.add(row.sequence);
  }
 }
 return structuredClone(saved);
}
