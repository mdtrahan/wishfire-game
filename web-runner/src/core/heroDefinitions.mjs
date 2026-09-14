// Initial balance tuning. Combat and the hero screen consume these same definitions.
export const PROGRESSION = Object.freeze({ maxLevel:99, expBase:100, expExponent:1.5, maxSP:100, startingSP:100, passiveSPRegenPerTurn:5, activeLevels:[1,1,5,15,20,30,40], passiveLevels:[1,10,20,25,35,45], enemyEXP:25, enemyGold:10 });
export const FLOW_ORB_TUNING = Object.freeze({flowMax:100,limitOrbValue:10,limitOrbDropCount:1,releaseSeconds:.72,flightSeconds:.65,collectFlashSeconds:.18});
export const FLOW_MODES = Object.freeze({Stoic:'Take hostile HP damage.',Warrior:'Deal positive enemy HP damage.',Tactician:'Apply a new eligible status.',Comrade:'Another living ally takes hostile HP damage.'});
export const COMBAT_TUNING = Object.freeze({ flowMax:FLOW_ORB_TUNING.flowMax, criticalHP:.25, blindPenalty:.35, accuracy:1, evasion:0, counterPotency:1 });
const status=(statusEffect,magnitude,duration=2,extra={})=>({effectType:'status',statusEffect,magnitude,duration,...extra});
const damage=(potency=1,hits=1)=>({effectType:'damage',potency,hits});
const skill=(id,displayName,spCost,targetType,tags,effects,description,extra={})=>({skillId:id,displayName,spCost,targetType,tags,effects,description,...extra});
const passive=(passiveId,displayName,stat,magnitude,description,conditions={})=>({passiveId,displayName,trigger:'stat',conditions,effect:stat,magnitude,tags:['passive'],description});
function kit(key,name,role,mode,baseStats,growth,actives,passives,special){
 return {key,name,role,actionSlotsPerTurn:3,flowMode:mode,baseStats,growth,maxLevel:PROGRESSION.maxLevel,maxSP:PROGRESSION.maxSP,startingSP:PROGRESSION.startingSP,passiveSPRegenPerTurn:PROGRESSION.passiveSPRegenPerTurn,
 actives:actives.map((s,i)=>({...s,unlockLevel:PROGRESSION.activeLevels[i]})),passives:passives.map((p,i)=>({...p,unlockLevel:PROGRESSION.passiveLevels[i]})),
 special:{...special,limitBreakId:special.skillId,isFlowSpecial:true,meterRequirement:100,unlockLevel:1,spCost:0},
 basic:skill('basic_attack','Attack',0,'enemy',[role==='Controller'||role.includes('Support')?'magic':'physical'],[damage()],'Attack one enemy.',{unlockLevel:1})};
}
export const HERO_DEFINITIONS=Object.freeze({
 Falie:kit('Falie','Fara','Tank','Stoic',{HP:75,ATK:7,DEF:12,MAG:4,RES:8,SPD:8},{HP:8,ATK:0.8,DEF:1.8,MAG:0.4,RES:1.1,SPD:0.15},[
 skill('guard','Guard',8,'self',['defensive'],[status('damageCut',0.4,2)],'Reduce incoming damage by 40% for 2 turns.'),
 skill('provoke','Provoke',12,'self',['defensive'],[status('provoke',1,3)],'Draw eligible single-target enemy attacks for 3 turns.'),
 skill('shield_bash','Shield Bash',20,'enemy',['physical'],[damage(1.2),status('defDown',0.2,2)],'Strike for 120% damage and lower DEF by 20% for 2 turns.'),
 skill('cover','Cover',25,'ally',['defensive'],[status('cover',1,3)],'Intercept single-target hits for an ally for 3 turns.'),
 skill('counter_stance','Counter Stance',25,'self',['defensive'],[status('counter',1,2)],'Counter after surviving an enemy skill for 2 turns.'),
 skill('defensive_strike','Defensive Strike',30,'enemy',['physical'],[damage(1.5),status('defUp',0.3,2,{recipient:'self'})],'Deal 150% damage and raise own DEF 30% for 2 turns.'),
 skill('fortress','Fortress',45,'allAllies',['defensive'],[status('damageCut',0.5,2)],'Reduce party damage received by 50% for 2 turns.')
 ],[
 passive('stout','Stout Heart','HP',0.1,'Max HP +10%.'),passive('iron','Iron Guard','DEF',0.1,'DEF +10%.'),passive('resolve','Resolve','RES',0.15,'RES +15%.'),passive('last_guard','Last Guard','DEF',0.3,'DEF +30% at critical HP.',{criticalHP:true}),passive('veteran','Veteran','HP',0.15,'Max HP +15%.'),passive('unyielding','Unyielding','DEF',0.2,'DEF +20%.')
 ],skill('fara_unbreakable','Unbreakable',0,'allAllies',['defensive'],[status('damageCut',0.6,3),status('barrier',0.4,3)],'Reduce party damage by 60% and grant a barrier worth 40% of each hero’s max HP for 3 turns.')),
 Huun:kit('Huun','Hondo','DPS / Fighter','Warrior',{HP:60,ATK:16,DEF:5,MAG:3,RES:4,SPD:12},{HP:6,ATK:2.1,DEF:0.7,MAG:0.3,RES:0.6,SPD:0.35},[
 skill('power_attack','Power Attack',20,'enemy',['physical'],[damage(1.6)],'Deal 160% damage to one enemy.'),
 skill('combo','Combo',25,'enemy',['physical'],[damage(0.75,3)],'Strike one enemy 3 times for 75% damage per hit.'),
 skill('armor_break','Armor Break',24,'enemy',['physical'],[damage(),status('defDown',0.25,3)],'Deal damage and lower DEF by 25% for 3 turns.'),
 skill('follow_up','Follow-Up',15,'enemy',['physical'],[damage(0.9)],'Deal 90% damage; may be repeated in a sequence.',{multiCast:true}),
 skill('heavy_blow','Heavy Blow',30,'enemy',['physical'],[damage(2)],'Deal 200% damage.'),
 skill('finisher','Finisher',40,'enemy',['physical'],[damage(2.5)],'Deal 250% damage.'),
 skill('battle_focus','Battle Focus',25,'self',['physical','buff'],[status('atkUp',0.4,3)],'Raise ATK by 40% for 3 turns.')
 ],[
 passive('fighter','Fighter','ATK',0.1,'ATK +10%.'),passive('stamina','Stamina','HP',0.1,'Max HP +10%.'),passive('momentum','Momentum','SPD',0.1,'SPD +10%.'),passive('ferocity','Ferocity','ATK',0.2,'ATK +20% at critical HP.',{criticalHP:true}),passive('discipline','Discipline','ATK',0.15,'ATK +15%.'),passive('champion','Champion','ATK',0.2,'ATK +20%.')
 ],skill('hondo_onslaught','Relentless Onslaught',0,'allEnemies',['physical'],[damage(1.2,4)],'Strike every enemy 4 times for 120% damage per hit.')),
 Runa:kit('Runa','Runa','Controller','Tactician',{HP:60,ATK:3,DEF:4,MAG:16,RES:10,SPD:11},{HP:5,ATK:0.3,DEF:0.7,MAG:2.1,RES:1.4,SPD:0.3},[
 skill('weaken','Weaken',18,'enemy',['magic','debuff'],[status('atkDown',0.25,3)],'Lower enemy ATK by 25% for 3 turns.'),
 skill('slow','Slow',20,'enemy',['magic','debuff'],[status('spdDown',0.25,3)],'Lower enemy SPD by 25% for 3 turns.'),
 skill('blind','Blind',18,'enemy',['magic','debuff'],[status('blind',COMBAT_TUNING.blindPenalty,3)],'Reduce physical accuracy for 3 turns.'),
 skill('silence','Silence',24,'enemy',['magic','debuff'],[status('silence',1,2)],'Prevent magic-tagged actions for 2 turns.'),
 skill('expose','Expose',24,'enemy',['magic','debuff'],[status('defDown',0.3,3)],'Lower DEF by 30% for 3 turns.'),
 skill('dispel','Dispel',25,'enemy',['magic'],[{effectType:'dispel'}],'Remove ordinary buffs from one enemy.'),
 skill('lockdown','Lockdown',40,'allEnemies',['magic','debuff'],[status('spdDown',0.35,3),status('silence',1,2)],'Slow all enemies by 35% for 3 turns and silence them for 2 turns.')
 ],[
 passive('insight','Insight','MAG',0.1,'MAG +10%.'),passive('warded','Warded Mind','RES',0.1,'RES +10%.'),passive('quick_thought','Quick Thought','SPD',0.1,'SPD +10%.'),passive('vitality','Vitality','HP',0.1,'Max HP +10%.'),passive('mastery','Mastery','MAG',0.15,'MAG +15%.'),passive('clarity','Clarity','RES',0.2,'RES +20%.')
 ],skill('runa_eclipse','Eclipse of Will',0,'allEnemies',['magic','debuff'],[status('atkDown',0.4,3),status('defDown',0.4,3),status('blind',COMBAT_TUNING.blindPenalty,3)],'Lower all enemies’ ATK and DEF by 40% and blind them for 3 turns.')),
 Kojonn:kit('Kojonn','Kaja','Support / Guardian','Comrade',{HP:65,ATK:4,DEF:7,MAG:9,RES:12,SPD:10},{HP:7,ATK:0.4,DEF:1.1,MAG:1.4,RES:1.7,SPD:0.25},[
 skill('rally','Rally',18,'ally',['magic','buff'],[status('atkUp',0.25,3)],'Raise an ally’s ATK by 25% for 3 turns.'),
 skill('protect','Protect',18,'ally',['magic','buff'],[status('defUp',0.25,3)],'Raise an ally’s DEF by 25% for 3 turns.'),
 skill('haste','Haste',25,'ally',['magic','buff'],[status('spdUp',0.25,3)],'Raise an ally’s SPD by 25% for 3 turns.'),
 skill('protect_ally','Protect Ally',25,'ally',['magic','defensive'],[status('damageCut',0.3,3)],'Reduce an ally’s incoming damage by 30% for 3 turns.'),
 skill('team_rally','Team Rally',35,'allAllies',['magic','buff'],[status('atkUp',0.25,3)],'Raise party ATK by 25% for 3 turns.'),
 skill('cleanse','Cleanse',20,'ally',['magic'],[{effectType:'cleanse'}],'Remove ordinary debuffs from one ally.'),
 skill('team_barrier','Team Barrier',40,'allAllies',['magic','defensive'],[status('barrier',0.3,3)],'Grant each ally a barrier worth 30% of max HP for 3 turns.')
 ],[
 passive('guardian','Guardian','RES',0.1,'RES +10%.'),passive('heart','Kind Heart','HP',0.1,'Max HP +10%.'),passive('readiness','Readiness','SPD',0.1,'SPD +10%.'),passive('defender','Defender','DEF',0.15,'DEF +15%.'),passive('wisdom','Wisdom','MAG',0.15,'MAG +15%.'),passive('steadfast','Steadfast','RES',0.2,'RES +20%.')
 ],skill('kaja_concord','Guardian Concord',0,'allAllies',['magic','buff'],[status('atkUp',0.4,3),status('defUp',0.4,3),status('barrier',0.35,3)],'Raise party ATK and DEF by 40% and grant 35% max-HP barriers for 3 turns.')),
});
export function heroKey(hero){const name=typeof hero==='string'?hero:hero?.baseHeroName||hero?.name;return ({Fara:'Falie',Hondo:'Huun',Kaja:'Kojonn'})[name]||name;}
export function heroDefinition(hero){return HERO_DEFINITIONS[heroKey(hero)];}
