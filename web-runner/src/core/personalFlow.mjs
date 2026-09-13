import {FLOW_MODES,heroDefinition,heroKey} from './heroDefinitions.mjs';
export {FLOW_MODES};
export const flowHeroKey=heroKey;
export function initializePersonalFlow(heroes){for(const hero of heroes){const d=heroDefinition(hero);hero.flow=0;delete hero.sp;delete hero.spMax;hero.flowMode=d?.flowMode||'Warrior';hero.statuses=[];}}
export function getHeroFlowState(hero){const value=Math.min(100,Math.max(0,hero.flow||0));return {value,max:100,ready:value>=100,mode:hero.flowMode||heroDefinition(hero)?.flowMode};}
export function getHeroSkillOptions(hero){return (heroDefinition(hero)?.actives||[]).filter(s=>s.unlockLevel<=(hero.currentLevel||1));}
