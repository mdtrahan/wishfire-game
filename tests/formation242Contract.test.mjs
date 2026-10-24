import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_FORMATION_WIDTH, HERO_FORMATION_PITCH, HERO_FORMATION_SLOTS, HERO_FORMATION_SLOT_DIAMETER, HERO_FORMATION_LEASH_RADIUS, constrainHeroSlotDrift } from '../src/core/heroFormationGeometry.mjs';
import { actorFootPoint, heroSpecialReach, isHeroSpecialTargetInRange } from '../src/core/arenaCombatRules.mjs';
import { isHeroBasicTargetInRange, resolveHeroAttackTarget } from '../src/core/heroAttackTargetingRules.mjs';
import { advanceContinuousCombatArena, placeContinuousCombatHeroesInRecoveryHuddle, deriveContinuousCombatRecoveryHuddle } from '../web-runner/src/core/arenaCombat.mjs';
import { selectRealtimeHeroSkillTarget } from '../web-runner/src/core/realtimeHeroTargeting.mjs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { createHeroFormationStore } from '../web-runner/systems/heroFormationStore.mjs';
import { FORMATION_SAVE_KEY, FORMATION_LEGACY_SAVE_KEY, sanitizeHeroFormation, activeFormationPreset, formationPlacement, placeFormationHero, selectFormationPreset, copyFormationPresetTo, autoFormActive } from '../web-runner/src/core/heroFormationRules.mjs';
const roster=Object.values(HERO_DEFINITIONS).map(def=>({id:def.key,name:def.name,role:def.role}));
const hero=(uid,x=1080,y=370)=>({uid,kind:'hero',hp:100,maxHP:100,footX:x,footY:y,stats:{ATK:10,DEF:10,MAG:10,RES:10}});
const foe=(uid,x,y,extra={})=>({uid,kind:'enemy',hp:100,maxHP:100,footX:x,footY:y,streamState:'in_range',...extra});
const storage=(values={})=>({values:{...values},getItem(key){return this.values[key]??null;},setItem(key,value){this.values[key]=value;}});

test('eight immutable slots form centered 2-4-2 rows across exactly 105.6 world units',()=>{
 assert.equal(HERO_FORMATION_WIDTH,105.6);assert.ok(Math.abs(HERO_FORMATION_PITCH-35.2)<1e-9);
 assert.deepEqual([0,1,2].map(row=>HERO_FORMATION_SLOTS.filter(slot=>slot.row===row).map(slot=>slot.column)),[[1,2],[0,1,2,3],[1,2]]);
 assert.deepEqual(HERO_FORMATION_SLOTS.map(slot=>[slot.x,slot.y]),[[-17.6,-35.2],[17.6,-35.2],[-52.8,0],[-17.6,0],[17.6,0],[52.8,0],[-17.6,35.2],[17.6,35.2]]);
 assert.equal(HERO_FORMATION_SLOT_DIAMETER,32);assert.equal(HERO_FORMATION_LEASH_RADIUS,1.6);
 assert.ok(HERO_FORMATION_PITCH>=HERO_FORMATION_SLOT_DIAMETER+2*HERO_FORMATION_LEASH_RADIUS-1e-9);
});
test('v3 migration retains presets and distinct occupancy, removes all locks, preserves source bytes',()=>{
 const raw=JSON.stringify({version:3,active:2,unlockedGrids:1,presets:[{leader:'Runa',locked:true,cells:{Falie:3,Huun:7,Runa:2,Kojonn:6}}]});
 const disk=storage({[FORMATION_LEGACY_SAVE_KEY]:raw}),globals={};
 const store=createHeroFormationStore({storage:disk,globals});
 assert.equal(store.state().version,4);assert.equal(store.state().active,2);assert.equal(store.state().presets[0].leader,'Runa');
 assert.equal(store.state().presets[0].locked,undefined);assert.deepEqual(store.state().presets[0].cells,{Falie:5,Huun:4,Runa:1,Kojonn:7});
 assert.equal(disk.getItem(FORMATION_LEGACY_SAVE_KEY),raw);assert.ok(disk.getItem(FORMATION_SAVE_KEY));
 for(let cell=0;cell<8;cell++){assert.equal(store.place('Falie',cell).ok,true);assert.equal(activeFormationPreset(store.state()).cells.Falie,cell);}
 const again=createHeroFormationStore({storage:disk,globals:{}});assert.deepEqual(again.state(),store.state());
 assert.equal(Object.keys(activeFormationPreset(store.state()).cells).length,4);
});
test('missing and corrupt formation data repair; failed writes preserve live and saved state',()=>{
 for(const raw of [undefined,'{','null','[]','{"active":1e400,"presets":[{"cells":{"Falie":0,"Huun":0,"Runa":99}}]}']){
  const disk=storage({[FORMATION_SAVE_KEY]:raw}),store=createHeroFormationStore({storage:disk,globals:{},reportError(){}});
  const cells=activeFormationPreset(store.state()).cells;assert.equal(new Set(Object.values(cells)).size,4);
  const before=store.state();disk.setItem=()=>{throw Error('disk full');};assert.equal(store.place('Falie',7).ok,false);assert.equal(store.state(),before);
 }
});
test('saved placement is an unchanged world-space offset through heading reversal and recovery',()=>{
 let state=sanitizeHeroFormation(null,roster);state=placeFormationHero(state,'Falie',7);
 const placement=Object.fromEntries(Object.entries(formationPlacement(activeFormationPreset(state))).map(([id,slot])=>[id.toLowerCase(),slot]));
 const heroes=roster.map((row,index)=>({...hero(index+1),baseHeroName:row.id}));
 const a=deriveContinuousCombatRecoveryHuddle(heroes,1,placement),b=deriveContinuousCombatRecoveryHuddle(heroes,-1,placement);
 assert.deepEqual(a,b);
 for(const row of a){assert.ok(Math.abs(row.x-1080-placement[row.hero.baseHeroName.toLowerCase()].x)<1e-9);assert.ok(Math.abs(row.y-370-placement[row.hero.baseHeroName.toLowerCase()].y)<1e-9);}
});
test('moving formation retains every slot and bounded drift without ally overlap in four directions',()=>{
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const heroes=Array.from({length:8},(_,i)=>hero(i+1));const globals={time:1};
  placeContinuousCombatHeroesInRecoveryHuddle({globals,heroes,now:-2});delete globals.ContinuousCombatInitialRoam;
  const center={...globals.ContinuousCombatFormation},enemy=foe(20,center.x+dx*600,center.y+dy*600);
  for(let step=0;step<30;step++){
   globals.time+=.1;advanceContinuousCombatArena({globals,entities:[...heroes,enemy],seconds:.1});
   const moved=globals.ContinuousCombatFormation;
   for(const [index,h] of heroes.entries()){
    assert.ok(Math.abs(h.formationSlotX-moved.x-HERO_FORMATION_SLOTS[index].x)<1e-9);
    assert.ok(Math.abs(h.formationSlotY-moved.y-HERO_FORMATION_SLOTS[index].y)<1e-9);
    assert.ok(Math.hypot(h.footX-h.formationSlotX,h.footY-h.formationSlotY)<=1.6+1e-9);
    for(const ally of heroes.slice(index+1))assert.ok(Math.hypot(h.footX-ally.footX,h.footY-ally.footY)>=32-1e-9);
   }
  }
  assert.ok((globals.ContinuousCombatFormation.x-center.x)*dx+(globals.ContinuousCombatFormation.y-center.y)*dy>0);
 }
});
test('drift eases back within the leash and does not snap to a slot when a foe disappears',()=>{
 const h=hero(1),g={time:1};placeContinuousCombatHeroesInRecoveryHuddle({globals:g,heroes:[h],now:-2});delete g.ContinuousCombatInitialRoam;
 const e=foe(2,h.footX+100,h.footY);advanceContinuousCombatArena({globals:g,entities:[h,e],seconds:.1});
 const drift=h.footX-h.formationSlotX;assert.ok(drift>0&&drift<1.6);
 advanceContinuousCombatArena({globals:g,entities:[h],seconds:.01});assert.ok(h.footX-h.formationSlotX>0);assert.ok(h.footX-h.formationSlotX<drift);
 assert.deepEqual(constrainHeroSlotDrift({x:0,y:0},{x:NaN,y:Infinity}),{x:0,y:0});
});
test('heroes face their closest living enemy on either side and fall back to movement',()=>{
 const heroes=[hero(1,1000),hero(2,1100)],left=foe(3,940,370),right=foe(4,1160,370),g={time:1};
 advanceContinuousCombatArena({globals:g,entities:[...heroes,left,right],seconds:0});assert.deepEqual(heroes.map(h=>h.facing),['left','right']);
 left.hp=0;right.hp=0;g.ContinuousCombatInitialRoam={direction:-1,targetX:800};
 advanceContinuousCombatArena({globals:g,entities:heroes,seconds:.1});assert.deepEqual(heroes.map(h=>h.facing),['left','left']);
});
test('basic reach is screen width and target choice is each hero nearest in any direction',()=>{
 const h=hero(1,1000),a=foe(2,900,370),b=foe(3,1200,370);
 assert.equal(resolveHeroAttackTarget({hero:h,enemies:[b,a],focusUID:3,inRange:e=>isHeroBasicTargetInRange(e,h)}),a);
 for(const [distance,expected] of [[720,true],[720.001,false]])assert.equal(isHeroBasicTargetInRange(foe(4,1000-distance,370),h),expected);
 assert.equal(isHeroBasicTargetInRange(foe(4,1000,1091),h),false);
 h.basicAttackScreenWidth=500;assert.equal(isHeroBasicTargetInRange(foe(4,1500.1,370),h),false);
});
test('Special range floors at 211.2 from the slot, independent of drift; larger ranges survive',()=>{
 const h={...hero(1,1001.6),formationSlotX:1000,formationSlotY:370};
 assert.equal(heroSpecialReach(h),211.2);
 assert.equal(isHeroSpecialTargetInRange(h,foe(2,1211.2,370)),true);assert.equal(isHeroSpecialTargetInRange(h,foe(2,1211.201,370)),false);
 assert.equal(heroSpecialReach({...h,attackRangeMultiplier:3}),276);
 const skill=HERO_DEFINITIONS.Huun.actives[0];
 assert.ok(selectRealtimeHeroSkillTarget({skill,hero:{...h,baseHeroName:'Huun',currentLevel:1},enemies:[foe(2,1211,370)],heroes:[h]}));
});
test('boss is always reachable and moves inside existing boss bounds without displacing heroes',()=>{
 const h=hero(1,1080),boss=foe(2,1450,290,{combatRank:'boss'}),g={time:0,ContinuousCombatStage:{bossActive:true,bossWorldX:1450,bossWorldY:290}};
 assert.equal(isHeroBasicTargetInRange(foe(3,9999,290,{combatRank:'boss'}),h),true);assert.equal(isHeroSpecialTargetInRange(h,foe(3,9999,290,{combatRank:'boss'})),true);
 const positions=new Set();for(let i=0;i<60;i++){g.time+=.1;advanceContinuousCombatArena({globals:g,entities:[h,boss],seconds:.1});positions.add(`${boss.footX},${boss.footY}`);assert.ok(boss.footX>=1450&&boss.footX<=1482);assert.ok(boss.footY>=258&&boss.footY<=322);assert.ok(Math.hypot(h.footX-h.formationSlotX,h.footY-h.formationSlotY)<=1.6+1e-9);}
 assert.ok(positions.size>10);
});

test('free presets copy by value, select and auto-fill without locking any slot',()=>{
 const original=sanitizeHeroFormation(null,roster),moved=placeFormationHero(original,'Falie',7);
 const copied=copyFormationPresetTo(moved,[1,2]);assert.equal(activeFormationPreset(original).cells.Falie,0);
 assert.deepEqual(copied.presets[1],copied.presets[0]);assert.notEqual(copied.presets[1].cells,copied.presets[0].cells);
 const selected=selectFormationPreset(copied,2);assert.equal(selected.active,2);assert.equal(selectFormationPreset(selected,Infinity),selected);
 const auto=autoFormActive(selected,roster);assert.deepEqual(activeFormationPreset(auto).cells,{Falie:0,Huun:1,Runa:2,Kojonn:3});
});
test('enemy actors may share the same space while hero slots remain separate',()=>{
 const h=hero(1),a=foe(2,1000,370),b=foe(3,1000,370),g={time:1};
 advanceContinuousCombatArena({globals:g,entities:[h,a,b],seconds:0});
 assert.deepEqual(actorFootPoint(a),actorFootPoint(b));
});

test('deployed hero copies receive distinct spare slots without displacing canonical saved placements',()=>{
 const globals={time:1};createHeroFormationStore({globals,storage:storage()});
 const canonical=roster.map((row,i)=>({...hero(i+1),baseHeroName:row.id,heroInstanceKey:row.id.toLowerCase()+'#1'}));
 const copies=[{...hero(10),baseHeroName:'Huun',heroInstanceKey:'huun#2'},{...hero(11),baseHeroName:'Falie',heroInstanceKey:'falie#2'}];
 const heroes=[...copies,...canonical];placeContinuousCombatHeroesInRecoveryHuddle({globals,heroes,now:-1});
 delete globals.ContinuousCombatInitialRoam;
 for(const [index,h] of canonical.entries()){assert.ok(Math.abs(h.formationSlotX-1080-HERO_FORMATION_SLOTS[index].x)<1e-9);assert.ok(Math.abs(h.formationSlotY-370-HERO_FORMATION_SLOTS[index].y)<1e-9);}
 const initial=heroes.map(h=>[h.footX,h.footY]);advanceContinuousCombatArena({globals,entities:heroes,seconds:0});assert.deepEqual(heroes.map(h=>[h.footX,h.footY]),initial);
 for(const [index,h] of heroes.entries())for(const ally of heroes.slice(index+1))assert.ok(Math.hypot(h.footX-ally.footX,h.footY-ally.footY)>=32-1e-9);
});
