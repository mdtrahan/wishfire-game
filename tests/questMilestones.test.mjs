import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatProgressionState, ensureCombatObjective, claimCombatObjectiveReward, combatObjectiveActionTarget } from '../web-runner/src/core/combatProgressionRules.mjs';
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
  assert.deepEqual(rows.filter(r=>r.type==='equip_rarity').map(r=>r.rarity),['uncommon','rare']);
  const early = equipment(1,'common'); early.lamp.highestOrdinal=0;
  assert.equal(milestoneCandidates(state,heroes,{equipment:early}).some(r=>r.type==='equip_level'||r.type==='equip_rarity'),false);
});

test('chapter completion credits saved progress regardless of earlier hero KOs', () => {
  let state = createCombatProgressionState({cursor:5});
  state = observeChapterMilestones(state,heroes,{region:1,bossActive:false});
  state = observeChapterMilestones(state,heroes,{region:1,bossActive:true});
  const ko = heroes.map((h,i)=>({...h,hp:i===0?0:100}));
  state = observeChapterMilestones(state,ko,{region:1,bossActive:true});
  state = createCombatProgressionState(JSON.parse(JSON.stringify(state)));
  state = observeChapterMilestones(state,heroes,{region:2,bossActive:false});
  assert.equal(state.chaptersCleared,1);
  state = observeChapterMilestones(state,heroes,{region:2,bossActive:true});
  state = observeChapterMilestones(state,heroes,{region:3,bossActive:false});
  assert.equal(state.chaptersCleared,2);
  state.objective = {id:'chapter',type:'chapter_clear',chapter:1,target:1,progress:0};
  assert.equal(reconcileQuestMilestones(state,heroes).objective.progress,1);
  const unknown = observeChapterMilestones(createCombatProgressionState(),heroes,{region:8,bossActive:false});
  assert.equal(unknown.chaptersCleared,7);
});

test('seeded scheduling avoids adjacent families and claimed milestones across reloads', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = createCombatProgressionState({cursor:2,seed,wallet:{incense:10000,ticketsByHero:{Hondo:10000}},training:{ATK:5}});
    let last = '';
    for (let n=0;n<35;n++) {
      state = ensureCombatObjective(state,heroes,context);
      assert.notEqual(state.objective.type,'chapter_survive');
      const family = questFamily(state.objective.type);
      assert.notEqual(family,last,`${seed}:${n}:${state.objective.type}`);
      const claimed = state.objective.key;
      if (claimed) assert.ok(!state.claimedMilestones.includes(claimed));
      state.objective.progress = state.objective.target;
      // Supply the saved facts needed by milestone claims.
      state.chaptersCleared = 100;
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

test('pending and completed retired zero-KO saves get a persistent replacement without changing rewards', () => {
  for (const progress of [0,1]) {
    const snapshot = {
      cursor:5,seed:123,chaptersCleared:1,
      objective:{id:'retired-survival',type:'chapter_survive',chapter:1,key:'chapter_survive::1',target:1,progress},
      survivalChapters:[1],chapterObservation:{chapter:1,bossActive:true,failed:false},
      wallet:{incense:77,ticketsByHero:{Hondo:250}},
      claimedMilestones:['chapter_clear::1'],rewardReceipts:[{id:'earned-reward',resource:'incense',amount:5}],
    };
    const values = new Map([['orka.combat_progression.v1',JSON.stringify(snapshot)]]);
    const storage = {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
    const make = () => createCombatProgression({globals:{ContinuousCombatStage:{region:2}},storage,getHeroes:()=>heroes,equipmentProgress:{data:equipment()},reportError:()=>{}});
    const controller = make(), next = controller.state();
    assert.notEqual(next.objective.type,'chapter_survive');
    assert.notEqual(next.objective.id,'retired-survival');
    assert.equal(next.cursor,snapshot.cursor);
    assert.deepEqual(next.wallet,snapshot.wallet);
    assert.deepEqual(next.rewardReceipts,snapshot.rewardReceipts);
    assert.deepEqual(next.claimedMilestones,snapshot.claimedMilestones);
    assert.equal('survivalChapters' in next,false);
    assert.equal('chapterObservation' in next,false);
    assert.equal(controller.claimObjective('retired-survival').ok,false);
    assert.equal(make().state().objective.id,next.objective.id);
    assert.notEqual(JSON.parse(storage.getItem('orka.combat_progression.v1')).objective.type,'chapter_survive');
  }
});

test('invalid saved milestone dimensions cannot become ready claims', () => {
  for (const [type,details] of [['equip_rarity',{rarity:'invalid'}],['equip_slot',{slot:'orb'}],['equip_level',{threshold:6}],['chapter_clear',{chapter:0}],['hero_level',{threshold:0}]]) assert.equal(objective(type,details).objective,null);
});

test('repeatable action targets use inclusive chapter bands and cap at 30–40', () => {
  const bands = [[1,3],[5,10],[10,20],[20,30],[30,40],[30,40]];
  for (const type of ['enemy_defeat','gear_collect','wave_clear']) {
    for (const [index,[low,high]] of bands.entries()) {
      const chapter = index === 5 ? 1000 : index + 1;
      const targets = new Set(Array.from({length:120},(_,roll)=>combatObjectiveActionTarget(type,chapter,roll)));
      assert.deepEqual([...targets].sort((a,b)=>a-b),Array.from({length:high-low+1},(_,n)=>low+n));
    }
  }
  assert.equal(combatObjectiveActionTarget('hero_upgrade',100,39),1);
  assert.equal(combatObjectiveActionTarget('training_upgrade',100,39),1);
});

test('new quests step with cleared chapters while active targets and 40-count reloads stay frozen', () => {
  for (const [chapter,low,high] of [[1,1,3],[2,5,10],[3,10,20],[4,20,30],[5,30,40],[100,30,40]]) {
    const observed = new Set();
    for (let seed=1;seed<=160;seed++) {
      const base=createCombatProgressionState({cursor:6,seed,chaptersCleared:chapter-1});
      const next=ensureCombatObjective(base,[]);
      if (!['enemy_defeat','gear_collect'].includes(next.objective.type)) continue;
      observed.add(next.objective.type);
      assert.ok(next.objective.target>=low && next.objective.target<=high,JSON.stringify(next.objective));
    }
    assert.deepEqual([...observed].sort(),['enemy_defeat','gear_collect']);
  }
  const active=createCombatProgressionState({cursor:6,chaptersCleared:1,objective:{id:'active',type:'enemy_defeat',target:7,progress:4,seed:1}});
  active.chaptersCleared=4;
  assert.deepEqual(ensureCombatObjective(active,[],{chapter:5}).objective,active.objective);
  for (const type of ['enemy_defeat','gear_collect','wave_clear']) {
    const saved=objective(type,{target:40,progress:39});
    const reloaded=createCombatProgressionState(JSON.parse(JSON.stringify(saved)));
    assert.equal(reloaded.objective.target,40);assert.equal(reloaded.objective.progress,39);
  }
  for (const cursor of [0,1]) {
    const late=ensureCombatObjective(createCombatProgressionState({cursor,chaptersCleared:4,seed:2}),[]);
    assert.ok(late.objective.target>=30&&late.objective.target<=40);
  }
});

test('type selection and target roll allow every action type to reach both band endpoints', () => {
  for (const [chapter,low,high] of [[1,1,3],[2,5,10],[3,10,20],[4,20,30],[5,30,40]]) {
    const values={enemy_defeat:new Set(),gear_collect:new Set()};
    for(let seed=1;seed<=1000;seed++) {
      const next=ensureCombatObjective(createCombatProgressionState({cursor:6,seed,chaptersCleared:chapter-1}),[]);
      values[next.objective.type]?.add(next.objective.target);
    }
    for(const type of Object.keys(values)) {assert.ok(values[type].has(low),`${type}:${chapter}:low`);assert.ok(values[type].has(high),`${type}:${chapter}:high`);}
  }
});


test('equipment coverage never schedules Epic or Legendary and retains Green and Blue', () => {
  for (const rarity of ['common','uncommon','rare','epic','legendary']) {
    for (let tier = 0; tier < 100; tier++) {
      const state = createCombatProgressionState({cursor:5});
      const data = equipment(10, rarity); data.lamp.capacityTier = tier;
      const rows = milestoneCandidates(state, heroes, {equipment:data}).filter(row=>row.type === 'equip_rarity');
      const expected = rarity === 'common' ? [] : rarity === 'uncommon' ? ['uncommon'] : ['uncommon','rare'];
      assert.deepEqual(rows.map(row=>row.rarity), expected);
      state.claimedMilestones = ['equip_rarity:epic:', 'equip_rarity:legendary:'];
      assert.deepEqual(milestoneCandidates(state, heroes, {equipment:data}).filter(row=>row.type === 'equip_rarity').map(row=>row.rarity), expected);
    }
  }
});

test('unfinished removed Epic and Legendary saves load and reschedule without spending or granting rewards', () => {
  for (const rarity of ['epic', 'legendary']) {
    const data = equipment(10, rarity);
    delete data.loadouts.Kaja.hat;
    const saved = objective('equip_rarity', {rarity, key:`equip_rarity:${rarity}:`, progress:3});
    saved.wallet.incense = 77;
    saved.claimedMilestones = ['equip_rarity:uncommon:', 'equip_rarity:rare:'];
    saved.rewardReceipts = [{id:'earned', resource:'incense', amount:5}];
    const values = new Map([['orka.combat_progression.v1', JSON.stringify(saved)]]);
    const storage = {getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v)};
    const make = () => createCombatProgression({globals:{}, storage, getHeroes:()=>heroes, equipmentProgress:{data}, reportError:()=>{}});
    const service = make(), next = service.state();
    assert.notEqual(next.objective.id, saved.objective.id);
    assert.deepEqual(next.wallet, saved.wallet);
    assert.deepEqual(next.rewardReceipts, saved.rewardReceipts);
    assert.deepEqual(next.claimedMilestones, saved.claimedMilestones);
    assert.equal(next.cursor, saved.cursor);
    assert.equal(make().state().objective.id, next.objective.id);
    assert.equal(service.claimObjective(saved.objective.id).ok, false);
    assert.ok(!['epic','legendary'].includes(next.objective.rarity));
  }
});

test('completed and claimed legacy rarity quests retain exactly one reward across reloads', () => {
  for (const rarity of ['epic', 'legendary']) {
    const data = equipment(1, 'common');
    const saved = objective('equip_rarity', {rarity, key:`equip_rarity:${rarity}:`, progress:4});
    saved.wallet.incense = 77;
    const values = new Map([['orka.combat_progression.v1', JSON.stringify(saved)]]);
    const storage = {getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v)};
    const make = () => createCombatProgression({globals:{}, storage, getHeroes:()=>heroes, equipmentProgress:{data}, reportError:()=>{}});
    const service = make();
    assert.equal(service.state().objective.id, 'objective');
    assert.equal(service.claimObjective('objective').ok, true);
    const reloaded = make();
    assert.equal(reloaded.claimObjective('objective').ok, false);
    assert.equal(reloaded.state().wallet.incense, 82);
    assert.equal(reloaded.state().rewardReceipts.filter(row=>row.id === 'cot-reward:objective').length, 1);
    data.lamp.capacityTier = 99;
    assert.equal(milestoneCandidates(reloaded.state(), heroes, {equipment:data}).some(row=>row.key === saved.objective.key), false);
  }
});


test('removed incomplete rarity saves cannot become claims through currently qualifying gear or missing context', () => {
  for (const rarity of ['epic','legendary']) {
    for (const context of [{}, {equipment:equipment(10,'legendary')}]) {
      const saved = objective('equip_rarity', {rarity, key:`equip_rarity:${rarity}:`, progress:0});
      const next = ensureCombatObjective(saved, heroes, context);
      assert.notEqual(next.objective.id, 'objective');
      assert.equal(claimCombatObjectiveReward(saved, 'objective', heroes, 0, context).ok, false);
      assert.equal(next.rewardReceipts.length, 0);
    }
  }
});


test('stale completed removed objectives with a claimed key or receipt cannot grant a second reward', () => {
  for (const rarity of ['epic','legendary']) {
    for (const proof of ['key','receipt']) {
      const saved = objective('equip_rarity', {rarity, key:`equip_rarity:${rarity}:`, progress:4});
      saved.wallet.incense = 82;
      if (proof === 'key') saved.claimedMilestones.push(saved.objective.key);
      else saved.rewardReceipts.push({id:'cot-reward:objective', resource:'incense', amount:5});
      const next = ensureCombatObjective(JSON.parse(JSON.stringify(saved)), heroes);
      assert.notEqual(next.objective.id, 'objective');
      assert.equal(claimCombatObjectiveReward(saved, 'objective', heroes).ok, false);
      assert.deepEqual(next.wallet, saved.wallet);
      assert.deepEqual(next.rewardReceipts, saved.rewardReceipts);
      assert.deepEqual(next.claimedMilestones, saved.claimedMilestones);
    }
  }
});
