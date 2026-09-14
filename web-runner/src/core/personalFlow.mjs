import {FLOW_MODES,heroDefinition,heroKey} from './heroDefinitions.mjs';
export {FLOW_MODES};
export const flowHeroKey=heroKey;
export function initializePersonalFlow(heroes){for(const hero of heroes){const d=heroDefinition(hero);hero.flow=0;delete hero.sp;delete hero.spMax;hero.flowMode=d?.flowMode||'Warrior';hero.statuses=[];}}
export function getHeroFlowState(hero){const value=Math.min(100,Math.max(0,hero.flow||0));return {value,max:100,ready:value>=100,mode:hero.flowMode||heroDefinition(hero)?.flowMode};}
export function getHeroSkillOptions(hero){return (heroDefinition(hero)?.actives||[]).filter(s=>s.unlockLevel<=(hero.currentLevel||1));}

export const ROLE_FLOW_VALUE=10;

export function recordFlowThreshold(state,hero,before,after){
 if(!state||!hero||Number(before||0)>=100||Number(after||0)<100)return null;
 const triggerOrder=state.FlowThresholdSerial=(Number(state.FlowThresholdSerial||0)+1);
 const signal={heroUID:Number(hero.uid||0),triggerOrder,token:`flow-${Number(state.CombatSessionId||0)}-${triggerOrder}`};
 (state.PendingFlowThresholds ||= []).push(signal);
 state.FlowThresholdAudit={heroUID:signal.heroUID,triggerOrder:signal.triggerOrder,token:signal.token,count:Number(state.FlowThresholdAudit?.count||0)+1};
 return signal;
}

// One resolved action can award one role charge.  Callers pass aggregate action
// facts so AoE and multi-hit never duplicate a role award.
export function resolveRoleFlowAward({heroes=[],hero=null,event={},apply=true}={}){
 const recipient=hero&&Number(hero.hp||0)>0?hero:null;
 if(!recipient||Number(recipient.flow||0)>=100||event.miss||event.periodic||event.prevented||event.resisted||event.unchanged)return null;
 const mode=recipient.flowMode||heroDefinition(recipient)?.flowMode;
 const hostileDamage=Number(event.hostileHpDamage||0)>0;
 const enemyDamage=Number(event.enemyHpDamage||0)>0;
 const newStatus=event.newEligibleStatus===true;
 const allyDamaged=Array.isArray(heroes)&&heroes.some(other=>other&&other!==recipient&&Number(other.uid)!==Number(recipient.uid)&&Number(event.hostileTargetUID||0)===Number(other.uid)&&event.hostileTargetWasLiving!==false&&hostileDamage);
 const eligible=(mode==='Stoic'&&hostileDamage&&Number(event.hostileTargetUID||0)===Number(recipient.uid))
  ||(mode==='Warrior'&&enemyDamage)
  ||(mode==='Tactician'&&newStatus)
  ||(mode==='Comrade'&&allyDamaged);
 if(!eligible)return null;
 const before=Math.max(0,Number(recipient.flow||0));
 const value=Math.min(ROLE_FLOW_VALUE,100-before);
 if(apply)recipient.flow=before+value;
 return {recipientUID:Number(recipient.uid||0),mode,before,value,flow:apply?recipient.flow:before+value,source:String(event.source||'role')};
}
