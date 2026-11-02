import { enemyBagKillPoints } from '../src/core/lampGear.mjs';
import { settleBattleEXP } from '../src/core/heroProgression.mjs';
import { updateSessionLevelUpSettlement } from './sessionLevelUpSettlementPresentation.mjs';
export function consumeCombatKillEvent(battle, { enemy: actor } = {}){
 if(!battle||!actor||actor.kind!=='enemy')return false;
 battle.defeated||={};battle.defeatedGold||={};
 const key=String(actor.uid),hasExp=Object.prototype.hasOwnProperty.call(battle.defeated,key),hasGold=Object.prototype.hasOwnProperty.call(battle.defeatedGold,key);
 if(!hasExp)battle.defeated[key]=0;
 if(!hasGold)battle.defeatedGold[key]=0;
 const changed=!hasExp||!hasGold;
 const amount=enemyBagKillPoints(actor);
 if(changed)battle.persistPendingRewards?.(amount?{id:`enemy:${battle.id}:${key}`,amount}:undefined);
 return changed;
}
// Supported JS damage callbacks use the same event-only WFM ledger.

function queueSettlementGold(g,battleId,amount){
 const gold=Math.max(0,Math.floor(Number(amount)||0));
 g.goldTotal=Number(g.goldTotal||0)+gold;
 if(gold>0){(g.PendingGoldSettlements||={})[String(battleId)]=gold;(g.HeroProgress.pendingGoldSettlements||={})[String(battleId)]=gold;}
 return gold;
}

export function settleContinuousCombatRewards(ctx) {
 const g=ctx.state.globals,battle=g.ProgressionBattle;
 if(!battle||battle.settled||g.HeroProgress?.settledBattles?.includes(battle.id))return [];
 const heroes=ctx.state.entities.filter(actor=>actor?.kind==='hero');
 const participants=heroes.filter(hero=>battle.participants.includes(hero.heroInstanceKey||hero.baseHeroName||hero.name));
 const gold=Object.values(battle.defeatedGold||{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);
 const previousGold=Number(g.goldTotal||0),previousReceipts={...(g.PendingGoldSettlements||{})},previousProgressReceipts={...(g.HeroProgress.pendingGoldSettlements||{})};
 queueSettlementGold(g,battle.id,gold);
 let results;
 try{results=settleBattleEXP(g.HeroProgress,battle,participants);}catch(error){g.goldTotal=previousGold;g.PendingGoldSettlements=previousReceipts;g.HeroProgress.pendingGoldSettlements=previousProgressReceipts;throw error;}
 g.ProgressionResults=results;
 g.HeroProgress.pendingBattleRewards=null;
 g.HeroProgressDirty=true;
 battle.goldReward=gold;battle.settled=true;
 const serial=Number(g.ContinuousCombatRewardSerial||0)+1;
 g.ContinuousCombatRewardSerial=serial;
 const persistPendingRewards=battle.persistPendingRewards,rewardLineageId=battle.rewardLineageId||String(battle.id||globalThis.crypto.randomUUID());
 g.ProgressionBattle={
  id:`${rewardLineageId}-continuous-${serial}`,
  participants:heroes.map(hero=>hero.heroInstanceKey),
  defeated:{},defeatedGold:{},settled:false,outcome:'active',
 };
 if(persistPendingRewards)Object.defineProperty(g.ProgressionBattle,'persistPendingRewards',{value:persistPendingRewards,configurable:true});
 Object.defineProperty(g.ProgressionBattle,'rewardLineageId',{value:rewardLineageId,configurable:true});
 return results;
}

export function updateSessionLevelUpSettlementPresentation(ctx){return updateSessionLevelUpSettlement(ctx.state.globals,Number(ctx.state.globals.time||0));}
