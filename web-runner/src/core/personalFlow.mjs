import {FLOW_MODES,heroDefinition,heroKey,PROGRESSION} from './heroDefinitions.mjs';
export {FLOW_MODES};
export const flowHeroKey=heroKey;
export function initializePersonalFlow(heroes){for(const hero of heroes){const d=heroDefinition(hero);hero.flow=0;hero.spMax=d?.maxSP||PROGRESSION.maxSP;hero.sp=d?.startingSP??PROGRESSION.startingSP;hero.flowMode=d?.flowMode||'Warrior';hero.statuses=[];}}
export function getHeroFlowState(hero){const spMax=hero.spMax||PROGRESSION.maxSP;return {value:Math.min(100,Math.max(0,hero.flow||0)),max:100,spMax,sp:Math.min(spMax,Math.max(0,hero.sp||0)),ready:(hero.flow||0)>=100,mode:hero.flowMode||heroDefinition(hero)?.flowMode};}
export function getHeroSkillOptions(hero){return (heroDefinition(hero)?.actives||[]).filter(s=>s.unlockLevel<=(hero.currentLevel||1));}
