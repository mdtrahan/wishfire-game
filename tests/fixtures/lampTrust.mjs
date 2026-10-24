import {createHeroProgressStore,refreshHeroStats} from '../../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,generateLampItem} from '../../web-runner/src/core/lampGear.mjs';
import {equipmentStats} from '../../web-runner/src/core/equipment.mjs';
import {computeCombatPower} from '../../web-runner/src/core/combatPower.mjs';
export const owners=['Falie','Huun','Runa','Kojonn'];
// Independent of lamp eligibility, ranking, classification and Auto planning.
export function cp(save,hero,replace){
 const slots={...save.loadouts[hero.heroInstanceKey]};if(replace)slots[replace.type]=replace.instanceId;
 const items=replace&&!save.items.some(i=>i.instanceId===replace.instanceId)?[...save.items,replace]:save.items;
 return computeCombatPower(refreshHeroStats({...hero,equipmentStats:equipmentStats(items,slots)}));
}
export const gain=(save,hero,item)=>Math.round((cp(save,hero,item)-cp(save,hero))*10)/10;
export function trustFixture(scenario='mixed'){
 const save=createLampEconomy(42),heroes=createHeroProgressStore();let sequence=0;
 const make=(type,n)=>{const item={...generateLampItem(42,sequence++,0),type,stats:{ATK:n,DEF:n,MAG:n,RES:n,HP:n*10}};save.items.push(item);return item;};
 for(const id of owners){
  save.loadouts[id]={};
  for(const type of ['hat','body','boots'])save.loadouts[id][type]=make(type,scenario==='mixed'&&(id==='Falie'&&type==='hat'||id==='Huun'&&type==='boots')?1:100).instanceId;
 }
 let selected=make('hat',10),other;
 if(scenario==='mixed')other=make('boots',10);
 if(scenario==='hondo'){
  const stats=[{ATK:1,DEF:10,MAG:6,RES:10,HP:87},{ATK:1,DEF:10,MAG:19,RES:10,HP:90},{ATK:1,DEF:10,MAG:3,RES:10,HP:118},{ATK:1,DEF:10,MAG:5,RES:10,HP:92}];
  for(const [n,id]of owners.entries()){
   for(const slot of ['body','boots']){const item=save.items.find(i=>i.instanceId===save.loadouts[id][slot]);item.stats={ATK:0,DEF:0,MAG:0,RES:0,HP:0};}
   save.items.find(i=>i.instanceId===save.loadouts[id].hat).stats=stats[n];
  }
  selected.stats={ATK:15,DEF:10,MAG:15,RES:10,HP:80};
 }
 if(scenario==='equal')selected.stats={...save.items.find(i=>i.instanceId===save.loadouts.Falie.hat).stats};
 if(scenario==='lowercp'||scenario==='fulltie'){
  for(const id of ['Falie','Huun']){
   const hero=heroes.heroes[id],hat=save.items.find(i=>i.instanceId===save.loadouts[id].hat),body=save.items.find(i=>i.instanceId===save.loadouts[id].body),boots=save.items.find(i=>i.instanceId===save.loadouts[id].boots);
   hat.stats={ATK:1,DEF:1,MAG:1,RES:1,HP:1};boots.stats={...hat.stats};
   body.stats={ATK:id==='Falie'?2000:1,MAG:1,DEF:98-hero.stats.DEF,RES:98-hero.stats.RES,HP:id==='Falie'?1:1000};
   if(scenario==='fulltie'){body.stats.ATK=id==='Falie'?100:7;body.stats.HP=id==='Falie'?100:181;}
  }
  selected.stats={ATK:1,DEF:1,MAG:1,RES:1,HP:41};
  heroes.heroes=Object.fromEntries(Object.entries(heroes.heroes).reverse());
 }
 if(scenario==='itemtie'){
  save.items.find(i=>i.instanceId===save.loadouts.Falie.hat).stats={ATK:1,DEF:1,MAG:1,RES:1,HP:10};
  other=make('hat',10);selected.rarity='common';other.rarity='legendary';
 }
 if(scenario==='rerank'){
  const specs=[['hat',{ATK:7,DEF:118,MAG:73,RES:8,HP:179}],['body',{ATK:74,DEF:13,MAG:100,RES:15,HP:158}],['boots',{ATK:81,DEF:120,MAG:3,RES:82,HP:1197}]];
  for(const [slot,stats]of specs)save.items.find(i=>i.instanceId===save.loadouts.Falie[slot]).stats=stats;
  for(const id of ['Huun','Runa','Kojonn'])for(const slot of ['hat','body','boots'])save.items.find(i=>i.instanceId===save.loadouts[id][slot]).stats={ATK:10000,DEF:10000,MAG:10000,RES:10000,HP:10000};
  selected.type='body';selected.stats={ATK:35,DEF:114,MAG:53,RES:44,HP:999};
  other=make('hat',1);other.stats={ATK:43,DEF:74,MAG:101,RES:68,HP:367};
  const revealed=make('body',1);revealed.stats={ATK:70,DEF:113,MAG:72,RES:91,HP:794};save.lamp.pending.push(revealed.instanceId);
 }
 if(scenario==='kaja'){
  save.items.find(i=>i.instanceId===save.loadouts.Kojonn.hat).stats={ATK:1,DEF:1,MAG:1,RES:1,HP:10};
  save.items.find(i=>i.instanceId===save.loadouts.Kojonn.body).stats.DEF=119;selected.stats={ATK:1,DEF:1,MAG:1,RES:1,HP:15};
  const copy=structuredClone(heroes.heroes.Falie);copy.heroInstanceKey='falie#1';heroes.heroes={'falie#1':copy,...heroes.heroes};
  save.loadouts['falie#1']=Object.fromEntries(['hat','body','boots'].map(slot=>[slot,make(slot,100).instanceId]));
 }
 if(scenario==='held'){
  for(let n=0;n<20;n++){const inferior=make('body',1);save.lamp.discarded.push(inferior.instanceId);}
  save.items.find(i=>i.instanceId===save.loadouts.Huun.hat).stats={ATK:1,DEF:1,MAG:1,RES:1,HP:10};
  save.items=save.items.filter(i=>i!==selected);save.lamp.reviewHold={item:selected,disposal:false};
 }
 save.lamp.pending=scenario==='held'?[]:[...save.lamp.pending,selected.instanceId,...(other?[other.instanceId]:[])];save.lamp.sequence=sequence;
 return{save,heroes,selected,other};
}
