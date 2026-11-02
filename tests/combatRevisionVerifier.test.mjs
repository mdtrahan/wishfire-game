// Adapted from /tmp/verify-kx5y/probes.mjs; before-fix evidence is retained beside this test.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL,fileURLToPath} from 'node:url';import test from 'node:test';
test('independent verifier: atomic wasm revisions, paid channels and developer level have zero live writes', async()=>{
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');const load=p=>import(pathToFileURL(root+'/'+p));
const {createCombatBridge}=await load('web-runner/src/core/combatBridge.mjs');const {createCombatAuthorityDriver}=await load('web-runner/src/core/combatAuthorityDriver.mjs');
const module=new WebAssembly.Module(fs.readFileSync(root+'/web-runner/assets/simulation_core.wasm'));const bridge=()=>createCombatBridge(new WebAssembly.Instance(module));
const stats={hp:420,atk:26.4,def:28,speed:100,reach:100,interval:1.8,evade:0,special:30};
const config=()=>({continuous:true,encounter_id:'independent',seed:'7129',geometry:{floor:{min:{x:96,y:40},max:{x:864,y:1592}},viewport_world:{x:720,y:1280},formation_origin:{x:480,y:800},screen_bound:false},heroes:[{instance_id:'Falie',definition_id:'slice.hero.fara',slot:0,formation_offset:{x:0,y:0},stats:{...stats},hp:170,host_max_hp:75}],enemies:[]});
const command=(actor=1,hp=700,revision='1',expected='0',step='1',seq='1')=>({encounter_id:'independent',step,sequence:seq,body:{kind:'replace_permanent_inputs',data:{actor,revision,expected_revision:expected,stats:{...stats,hp},host_max_hp:hp/5.6,skill_modifiers:{special_potency:1,meter_rate:1}}}});
const result={};
{
 const b=bridge(),c=b.create(config()),before=b.inspect(c.world);result.describe=b.describe();
 for(const kind of ['unknown_actor','stale','duplicate_actor','invalid_second','wrong_step','wrong_sequence']){
  const commands=[command()];if(kind==='unknown_actor')commands[0].body.data.actor=999;if(kind==='stale')commands[0].body.data.expected_revision='1';if(kind==='duplicate_actor')commands.push(command(1,800,'2','0','1','2'));if(kind==='invalid_second')commands.push(command(999,800,'2','0','1','2'));if(kind==='wrong_step')commands[0].step='2';if(kind==='wrong_sequence')commands[0].sequence='2';
  assert.throws(()=>b.step(c.world,{encounter_id:'independent',expected_previous_step:'0',commands}));assert.deepEqual(b.inspect(c.world),before);
 }
 let a=b.step(c.world,{encounter_id:'independent',expected_previous_step:'0',commands:[command()]}).snapshot.actors[0];assert.equal(a.hp,450);assert.equal(a.max_hp,700);const after=b.inspect(c.world);
 assert.throws(()=>b.step(c.world,{encounter_id:'independent',expected_previous_step:'1',commands:[command(1,700,'1','0','2','2')]}));assert.deepEqual(b.inspect(c.world),after);
 a=b.step(c.world,{encounter_id:'independent',expected_previous_step:'1',commands:[command(1,100,'2','1','2','2')]}).snapshot.actors[0];assert.equal(a.hp,100);
 result.atomic='six rejected batches preserve complete inspect result; stale repeat rejected without mutation';result.r1={woundedGrowth:450,shrink:100};b.destroy(c.world);
}
{
 const b=bridge(),cfg=config();cfg.heroes[0].hp=0;cfg.heroes.push({...structuredClone(cfg.heroes[0]),instance_id:'Huun',definition_id:'slice.hero.hondo',slot:1,hp:420,formation_offset:{x:100,y:0}});const c=b.create(cfg);const r=b.step(c.world,{encounter_id:'independent',expected_previous_step:'0',commands:[command()]});assert.equal(r.snapshot.actors[0].hp,0);assert.equal(r.snapshot.actors[0].downed,true);result.downed='remains 0';b.destroy(c.world);
}
{
 const b=bridge(),errors=[],cfg=config(),d=createCombatAuthorityDriver({bridge:b,consume(){},onError:e=>errors.push(String(e))});d.start(cfg);d.advance(0);d.advance(100,true);d.replacePermanentInputs('Falie',command(1,560).body.data);d.replacePermanentInputs('Falie',command().body.data);assert.equal(d.read().pendingRevisions,1);d.advance(200);d.advance(234);assert.equal(d.read().snapshot.actors[0].hp,450);assert.equal(d.read().revisions.Falie.acknowledged,'2');assert.equal(d.read().pendingRevisions,0);result.coalescing=d.read().revisions;assert.deepEqual(errors,[]);d.stop();
}
const {newHeroProgress,createHeroProgressStore,awardHeroEXP,expToNextLevel,saveHeroProgress}=await load('web-runner/src/core/heroProgression.mjs');const {createContinuousCombatStageState}=await load('web-runner/src/core/continuousCombatStage.mjs');const {createRustCombatRuntime}=await load('web-runner/systems/rustCombatRuntime.mjs');const {createEquipmentStorage,EQUIPMENT_SAVE_KEY}=await load('web-runner/systems/equipmentStorage.mjs');const {createLampEconomy,generateLampItem}=await load('web-runner/src/core/lampGear.mjs');const {createCombatProgression}=await load('web-runner/systems/combatProgression.mjs');const {wfmHeroPermanentInputs,createWfmCombatConfig}=await load('web-runner/systems/wfmCombatConfig.mjs');
{
 const hero={...newHeroProgress('Falie'),kind:'hero',uid:1,x:800,y:350,isAlive:true};const rows=[{name:'Gobloc',HP:140,ATK:10,DEF:1,MAG:1,RES:1,SPD:8},{name:'Troll',HP:1500,ATK:165,DEF:1,MAG:1,RES:1,SPD:8}];const enemy={kind:'enemy',uid:90,name:'Troll',enemyRole:'boss',slotIndex:0,x:960,y:350,hp:1500,maxHP:1500,stats:{...rows[1],ATK:0}};
 const g={ContinuousCombatStageLoop:1,ContinuousCombatStage:{...createContinuousCombatStageState(72),bossActive:true,bossAvailable:true,bossArmed:true,bossUID:90},CombatSessionId:'independent-host',GamePhase:'RUNTIME',time:0,HeroProgress:createHeroProgressStore(),EnemyData:rows,EnemySlots:[91],EnemyIDs:[90],NextUID:91};const state={globals:g,entities:[hero,enemy]};const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};let durable;const persist=()=>{durable=JSON.stringify(g.HeroProgress);return true};
 const economy=createLampEconomy(772,100000);const item=generateLampItem(772,1,1);item.stats.HP=50;economy.items.push(item);economy.lamp.pending.push(item.instanceId);values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(economy));
 const equipment=createEquipmentStorage({globals:g,getActors:()=>state.entities,storage,locks:{request:async(k,fn)=>fn()},now:()=>10000,seed:()=>772,persistProgress:persist});await equipment.sync();
 const errors=[];const runtime=createRustCombatRuntime({ persistCheckpoint: () => true,state,persistProgress:persist,bridge:bridge(),session:{surrenderBossAttempt:r=>errors.push(r),recoverContinuousDefeat:r=>errors.push(r)},call(){},getEnemyRows:()=>rows,present(){},advanceHostTime(){},warn:(...args)=>errors.push(args.map(String))});const options={globals:g,entities:state.entities,presentationBarrier:{lanes:{}},call(){},nowMs:0};runtime.tick(options);assert.equal(runtime.read().active,true,JSON.stringify(errors));assert.equal(hero.maxHP,420);
 const writes=[];let watch=true;for(const field of ['hp','maxHP','stats','statuses']){let value=hero[field];Object.defineProperty(hero,field,{enumerable:true,configurable:true,get:()=>value,set:v=>{if(watch)writes.push(field);value=v}});}
 const before={hp:hero.hp,maxHP:hero.maxHP,stats:structuredClone(hero.stats)};await equipment.equip('Falie',item.instanceId);assert.deepEqual(writes,[]);assert.equal(hero.maxHP,420);assert.equal(g.HeroProgress.heroes.Falie.maxHP,125);assert.equal(runtime.read().pendingRevisions,1);
 const reloaded=createHeroProgressStore(JSON.parse(durable));const freshHero={...reloaded.heroes.Falie,kind:'hero',uid:1};const cfg=createWfmCombatConfig({globals:{...g,HeroProgress:reloaded},entities:[freshHero],enemyRows:rows,encounterId:'independent-reload'});const b=bridge(),fresh=b.create(cfg);assert.equal(fresh.snapshot.actors[0].max_hp,700);result.reloadBeforeAck={durableMax:reloaded.heroes.Falie.maxHP,rustMax:fresh.snapshot.actors[0].max_hp,rustHP:fresh.snapshot.actors[0].hp};b.destroy(fresh.world);
 watch=false;runtime.tick({...options,nowMs:34});assert.equal(hero.maxHP,700);assert.equal(runtime.read().pendingRevisions,0);result.gearNextStep={before,after:{hp:hero.hp,maxHP:hero.maxHP},liveWrites:writes.slice()};
 watch=true;awardHeroEXP(hero,expToNextLevel(1));assert.deepEqual(writes,[]);watch=false;runtime.tick({...options,nowMs:68});assert.equal(g.HeroProgress.heroes.Falie.currentLevel,2);
 values.set('orka.combat_progression.v1',JSON.stringify({wallet:{incense:1000000,ticketsByHero:{Falie:10000}}}));const progression=createCombatProgression({globals:g,storage,getHeroes:()=>state.entities,equipmentProgress:equipment,persistHeroProgress:persist});watch=true;assert.equal(progression.spendLevelUp('Falie').ok,true);assert.deepEqual(writes,[]);
 result.training={};for(const stat of ['ATK','DEF','MATK','RES']){const prior=wfmHeroPermanentInputs(g,hero);const trained=progression.train(stat);assert.equal(trained.ok,true);const after=wfmHeroPermanentInputs(g,hero);assert.ok(after.stats[stat==='MATK'?'mag':stat.toLowerCase()]>prior.stats[stat==='MATK'?'mag':stat.toLowerCase()]);result.training[stat]={changed:JSON.stringify(prior)!==JSON.stringify(after),before:prior.stats,after:after.stats};assert.deepEqual(writes,[]);watch=false;runtime.tick({...options,nowMs:102+Object.keys(result.training).length*34});const accepted=runtime.read().snapshot.actors[0];assert.deepEqual(accepted.stats,Object.fromEntries(['atk','def','mag','res'].map(key=>[key,Math.fround(after.stats[key])])));watch=true;}
 result.liveWrites=writes.slice();result.progressionPending=runtime.read().pendingRevisions;watch=false;runtime.tick({...options,nowMs:102});assert.equal(runtime.read().pendingRevisions,0);assert.deepEqual(errors,[]);
 const devSource=fs.readFileSync(root+'/web-runner/systems/devToolingControls.js','utf8').replace(/import \{ HERO_PROGRESS_SAVE_KEY \} from '.\/heroProgressStorage.js';/,"const HERO_PROGRESS_SAVE_KEY='orka.hero_progress.v2';").replace(/from '([^']+)'/g,(_,p)=>"from '"+new URL(p,pathToFileURL(root+'/web-runner/systems/devToolingControls.js')).href+"'");const {applyDeveloperLevel}=await import('data:text/javascript;base64,'+Buffer.from(devSource).toString('base64'));g.RealtimeSkillBattleState={baselinesByUID:{1:{maxHP:1}}};const legacyBaseline=g.RealtimeSkillBattleState;watch=true;writes.length=0;const beforeDev=hero.hp,beforeStatuses=structuredClone(hero.statuses);await applyDeveloperLevel({state,gameState:{},call(){},storage,locks:{request:async(k,fn)=>fn()},level:10});result.developerLevel={liveWrites:writes.slice(),hpBefore:beforeDev,hpAfter:hero.hp,rustHP:runtime.read().snapshot.actors[0].hp,pending:runtime.read().pendingRevisions};assert.deepEqual(hero.statuses,beforeStatuses);assert.equal(g.RealtimeSkillBattleState,legacyBaseline);assert.equal(result.developerLevel.pending,1);watch=false;runtime.tick({...options,nowMs:306});assert.equal(runtime.read().snapshot.actors[0].max_hp,wfmHeroPermanentInputs(g,hero).stats.hp);assert.equal(runtime.read().pendingRevisions,0);
 // An unchanged render-time equipment sync must never enter the revision path.
 const clone = globalThis.structuredClone; let clones = 0;
 globalThis.structuredClone = value => { clones++; return clone(value); };
 try { for (let frame=0; frame<30; frame++) await equipment.sync(); }
 finally { globalThis.structuredClone = clone; }
 assert.equal(clones,0); assert.equal(runtime.read().pendingRevisions,0);
 const {restoreHeroesToFullHP}=await load('web-runner/systems/questCombatSession.mjs');
 const {resetRealtimeSkillAttempt,ensureSkillBattle}=await load('web-runner/src/core/heroPermanentModifiers.mjs');
 assert.throws(()=>restoreHeroesToFullHP({state,call(){}}),/not supported in Rust encounters/);
 assert.throws(()=>resetRealtimeSkillAttempt(g,state.entities),/not supported in Rust encounters/);
 assert.throws(()=>ensureSkillBattle({state}),/not supported in Rust encounters/);
 const {routeHeroPermanentInputs,permanentHeroSource}=await load('web-runner/src/core/heroPermanentInputs.mjs');
 const devRuntimeSource=fs.readFileSync(root+'/web-runner/systems/devToolingRuntime.js','utf8');
 const speedBody=devRuntimeSource.slice(devRuntimeSource.indexOf('  function setFixtureSpeed'),devRuntimeSource.indexOf('  function readPersistedDevToolingConfig'));
 const speedFn=new Function('state','getDevToolHeroOptions','callFunctionWithContext','fnContext','routeHeroPermanentInputs','permanentHeroSource',speedBody+';return syncConfiguredDoubleAttackHarness;')(state,()=>[hero.name],()=>{},{},routeHeroPermanentInputs,permanentHeroSource);
 const speed=hero.stats.SPD,interval=wfmHeroPermanentInputs(g,hero).stats.interval;
 let speedWrites=0,rawSpeed=speed;Object.defineProperty(hero.stats,'SPD',{enumerable:true,configurable:true,get:()=>rawSpeed,set:value=>{speedWrites++;rawSpeed=value;}});
 speedFn({doubleAttackHeroName:hero.name,doubleAttackChance:1});
 assert.equal(speedWrites,0); assert.equal(hero.stats.SPD,speed); assert.equal(runtime.read().pendingRevisions,1);
 assert.ok(wfmHeroPermanentInputs(g,hero).stats.interval<interval);
 runtime.tick({...options,nowMs:340});assert.equal(runtime.read().pendingRevisions,0);
 speedFn({doubleAttackHeroName:'',doubleAttackChance:1});assert.equal(speedWrites,0);assert.equal(runtime.read().pendingRevisions,1);
 assert.equal(wfmHeroPermanentInputs(g,hero).stats.interval,interval);
 runtime.tick({...options,nowMs:374});assert.equal(runtime.read().pendingRevisions,0);assert.deepEqual(errors,[]);
 runtime.stop();restoreHeroesToFullHP({state,call(){}});resetRealtimeSkillAttempt(g,state.entities);runtime.dispose();
}
const baseline=JSON.parse(fs.readFileSync(new URL('./combatRevisionVerifier.before.json',import.meta.url)));assert.equal(baseline.training.MATK.changed,false);assert.equal(baseline.training.RES.changed,false);assert.ok(baseline.developerLevel.liveWrites.includes('hp'));assert.equal(result.training.MATK.changed,true);assert.equal(result.training.RES.changed,true);assert.deepEqual(result.developerLevel.liveWrites,[]);assert.equal(result.developerLevel.hpBefore,result.developerLevel.hpAfter);});
