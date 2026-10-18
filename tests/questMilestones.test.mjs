import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatProgressionState, ensureCombatObjective, claimCombatObjectiveReward } from '../web-runner/src/core/combatProgressionRules.mjs';
import { milestoneCandidates, reconcileQuestMilestones, observeChapterMilestones, questFamily, milestonePresentation } from '../web-runner/src/core/questMilestones.mjs';
import { createCombatProgression } from '../web-runner/systems/combatProgression.mjs';
const heroes = ['Hondo','Fara','Runa','Kaja'].map(name => ({kind:'hero', heroInstanceKey:name, baseHeroName:name, currentLevel:5, maxLevel:100, hp:100}));
function equipment(level = 10, rarity = 'epic') {
  const items = [], loadouts = {};
  for (const hero of heroes) {
    loadouts[hero.heroInstanceKey] = {};
    for (const type of ['hat','body','boots']) {
      const instanceId = `${hero.heroInstanceKey}:${type}`;
      items.push({ instanceId, type, level, rarity });
      loadouts[hero.heroInstanceKey][type] = instanceId;
    }
  }
  return {items,loadouts,lamp:{highestOrdinal:14}};
}
const context = {equipment:equipment(),chapter:3};
function objective(type, details = {}) {return createCombatProgressionState({cursor:5,objective:{id:'objective',type,target:4,progress:0,seed:1,...details}});}

test('gear milestones read all saved slots, count stronger gear and reject a single missing or weak slot', () => {
  for (const [type,details] of [['equip_slot',{slot:'hat'}],['equip_all',{}],['equip_level',{threshold:5}],['equip_rarity',{rarity:'rare'}]]) {
    const state = objective(type,details);
    assert.equal(reconcileQuestMilestones(state,heroes,context).objective.progress,4);
    const missing = equipment(); missing.loadouts.Kaja.hat = 'missing';
    assert.equal(reconcileQuestMilestones(state,heroes,{equipment:missing}).objective.progress,3);
    const weak = equipment(4,'common');
    if (type === 'equip_level' || type === 'equip_rarity') assert.equal(reconcileQuestMilestones(state,heroes,{equipment:weak}).objective.progress,0);
  }
});

test('level milestones use multiples of five and rarity goals require an available item rarity', () => {
  const state = createCombatProgressionState({cursor:5});
  const rows = milestoneCandidates(state,heroes,context);
  assert.deepEqual(rows.filter(r=>r.type==='equip_level').map(r=>r.threshold),[5,10,15]);
  assert.deepEqual(rows.filter(r=>r.type==='equip_rarity').map(r=>r.rarity),['uncommon','rare','epic']);
  const early = equipment(1,'common'); early.lamp.highestOrdinal=0;
  assert.equal(milestoneCandidates(state,heroes,{equipment:early}).some(r=>r.type==='equip_level'||r.type==='equip_rarity'),false);
});

test('chapter completion credits saved progress; survival requires witnessed clear with zero KOs, including revived KOs', () => {
  let state = createCombatProgressionState({cursor:5});
  state = observeChapterMilestones(state,heroes,{region:1,bossActive:false});
  state = observeChapterMilestones(state,heroes,{region:1,bossActive:true});
  const ko = heroes.map((h,i)=>({...h,hp:i===0?0:100}));
  state = observeChapterMilestones(state,ko,{region:1,bossActive:true});
  state = createCombatProgressionState(JSON.parse(JSON.stringify(state)));
  state = observeChapterMilestones(state,heroes,{region:2,bossActive:false});
  assert.equal(state.chaptersCleared,1); assert.deepEqual(state.survivalChapters,[]);
  state = observeChapterMilestones(state,heroes,{region:2,bossActive:true});
  state = observeChapterMilestones(state,heroes,{region:3,bossActive:false});
  assert.deepEqual(state.survivalChapters,[2]);
  state.objective = {id:'chapter',type:'chapter_clear',chapter:1,target:1,progress:0};
  assert.equal(reconcileQuestMilestones(state,heroes).objective.progress,1);
  const unknown = observeChapterMilestones(createCombatProgressionState(),heroes,{region:8,bossActive:false});
  assert.equal(unknown.chaptersCleared,7); assert.deepEqual(unknown.survivalChapters,[]);
});

test('seeded scheduling avoids adjacent families and claimed milestones across reloads', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = createCombatProgressionState({cursor:2,seed,wallet:{incense:10000,ticketsByHero:{Hondo:10000}},training:{ATK:5}});
    let last = '';
    for (let n=0;n<35;n++) {
      state = ensureCombatObjective(state,heroes,context);
      const family = questFamily(state.objective.type);
      assert.notEqual(family,last,`${seed}:${n}:${state.objective.type}`);
      const claimed = state.objective.key;
      if (claimed) assert.ok(!state.claimedMilestones.includes(claimed));
      state.objective.progress = state.objective.target;
      // Supply the saved facts needed by milestone claims.
      state.chaptersCleared = 100; state.survivalChapters = [1,2,3,4];
      const row = state.objective;
      const party = heroes.map(h=>({...h,currentLevel:Math.max(h.currentLevel,row.threshold||1)}));
      const ctx = {...context,equipment:equipment(100,'legendary')};
      if (row.stat) state.training[row.stat]=row.threshold;
      const claim = claimCombatObjectiveReward(state,row.id,party,0,ctx);
      assert.equal(claim.ok,true,JSON.stringify(row));
      state = createCombatProgressionState(JSON.parse(JSON.stringify(claim.state)));
      last = family;
    }
  }
});

test('controller observes saved equipment and refuses stale or duplicate claims after reload', () => {
  const values = new Map(); const storage = {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  storage.setItem('orka.combat_progression.v1',JSON.stringify(objective('equip_level',{threshold:5,key:'equip_level::5'})));
  const globals = {ContinuousCombatStage:{region:1,bossActive:false}};
  const data = equipment();
  const make = () => createCombatProgression({globals,storage,getHeroes:()=>heroes,equipmentProgress:{data},reportError:()=>{}});
  const service = make(); assert.equal(service.state().objective.progress,4);
  delete data.loadouts.Kaja.hat;
  assert.equal(service.claimObjective('objective').ok,false);
  data.loadouts.Kaja.hat='Kaja:hat';
  assert.equal(service.claimObjective('objective').ok,true);
  assert.equal(make().claimObjective('objective').ok,false);
});

test('new milestone text uses authored terms', () => {
  assert.equal(milestonePresentation({type:'chapter_clear',chapter:7}).challenge,'Clear Chapter 7');
  assert.match(milestonePresentation({type:'equip_rarity',rarity:'rare'}).challenge,/Blue/);
});

test('combat #1 inherits canonical saved gear, while duplicate #2 requires its own loadout', () => {
  const data = equipment();
  const deployed = heroes.map(h=>({...h,heroInstanceKey:`${h.baseHeroName.toLowerCase()}#1`}));
  const state = objective('equip_slot',{slot:'hat'});
  assert.equal(reconcileQuestMilestones(state,deployed,{equipment:data}).objective.progress,4);
  deployed[0].heroInstanceKey='hondo#2';
  assert.equal(reconcileQuestMilestones(state,deployed,{equipment:data}).objective.progress,3);
});

test('a failed survival milestone is replaced instead of locking an unreplayable chapter', () => {
  const state = objective('chapter_survive',{chapter:1,target:1});
  state.chapterObservation={chapter:1,bossActive:false,failed:true};
  const next = ensureCombatObjective(state,heroes,context);
  assert.notEqual(next.objective.id,'objective');
  assert.ok(next.objective.type!=='chapter_survive'||next.objective.chapter!==1);
});

test('invalid saved milestone dimensions cannot become ready claims', () => {
  for (const [type,details] of [['equip_rarity',{rarity:'invalid'}],['equip_slot',{slot:'orb'}],['equip_level',{threshold:6}],['chapter_clear',{chapter:0}],['hero_level',{threshold:0}]]) assert.equal(objective(type,details).objective,null);
});
