import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLampEconomy,LAMP_CONFIG} from '../web-runner/src/core/lampGear.mjs';
import {attachHeroProgress,createHeroProgressStore,settleBattleEXP} from '../web-runner/src/core/heroProgression.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
import {createCombatSimulationTicker} from '../web-runner/systems/combatSimulationTick.mjs';
import {recordEnemyDefeatReward} from '../web-runner/modules/heroCommands.mjs';

const HERO_KEY='orka.hero_progress.v2';
const source=readFileSync(new URL('../web-runner/systems/heroProgressStorage.js',import.meta.url),'utf8');
function fixture(initial={}){
 const values=new Map(Object.entries(initial));let failEquipment=false,menuOpen=false,chain=Promise.resolve(),now=0;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(failEquipment&&key===EQUIPMENT_SAVE_KEY)throw Error('equipment save failed');values.set(key,value);}};
 const progress=new Function('window','attachHeroProgress','createHeroProgressStore','settleBattleEXP',source.replace(/^import .*\n/gm,'').replace(/export /g,'')+';return {restoreHeroProgressFromStorage,persistHeroProgressIfDirty};')({localStorage:storage},attachHeroProgress,createHeroProgressStore,settleBattleEXP);
 const globals={time:0,goldTotal:0,HeroProgress:createHeroProgressStore(),ProgressionBattle:{id:'clock-battle',participants:[],defeated:{},defeatedGold:{}}};
 const state={globals,entities:[]},gameState={storyEntry:{phase:'combat'}};
 progress.restoreHeroProgressFromStorage({fnContext:{state}});
 const store=createEquipmentStorage({globals,storage,locks:{request:(_key,fn)=>{const next=chain.then(fn);chain=next.catch(()=>{});return next;}},seed:()=>42,reportError:()=>{}});
 const ticker=createCombatSimulationTicker({isBagProgressBlocked:()=>menuOpen});
 const frame=()=>ticker.tick({state,gameState,nowMs:now});
 return{values,globals,gameState,store,ticker,frame,setFail:value=>failEquipment=value,setMenu:value=>menuOpen=value,
  advance(seconds){for(let n=0;n<Math.round(seconds*20);n++){now+=50;frame();}},
  background(seconds){ticker.reset();now+=seconds*1000;},
  snapshot(){return Object.fromEntries(values);}};
}

test('61 active combat seconds yield four durable Bag ticks; ordinary kills add zero and bosses add five',async()=>{
 assert.deepEqual([LAMP_CONFIG.tickSeconds,LAMP_CONFIG.tickPoints,LAMP_CONFIG.bossKillPoints],[15,1,5]);
 const f=fixture();await f.store.sync();f.frame();f.advance(61);
 const pending=JSON.parse(f.values.get(HERO_KEY)).pendingBagKillRewards;
 assert.deepEqual(pending,{'tick:clock-battle:1':1,'tick:clock-battle:2':1,'tick:clock-battle:3':1,'tick:clock-battle:4':1});
 await f.store.sync();assert.equal(f.store.data.lamp.killPoints,4);assert.equal(f.store.data.lamp.essence,0);
 assert.deepEqual(f.store.data.settledBagKillRewards['tick:clock-battle'],[[1,4]]);
 for(const actor of [{uid:1,enemyRole:'fodder'},{uid:2,isSolo:true},{uid:3,enemyRole:'pack'}])recordEnemyDefeatReward(f.globals.ProgressionBattle,{kind:'enemy',...actor});
 await f.store.sync();assert.equal(f.store.data.lamp.killPoints,4);
 const boss={kind:'enemy',uid:4,enemyRole:'boss'};recordEnemyDefeatReward(f.globals.ProgressionBattle,boss);recordEnemyDefeatReward(f.globals.ProgressionBattle,boss);
 await f.store.sync();assert.equal(f.store.data.lamp.killPoints,9);assert.equal(f.store.data.lamp.essence,0);
});

test('paused menus and background wall time preserve partial active seconds without catch-up',async()=>{
 const f=fixture();await f.store.sync();f.frame();f.advance(14.9);const time=f.globals.time;
 f.gameState.storyEntry.combatPaused=true;f.advance(60);assert.equal(f.globals.time,time);
 f.gameState.storyEntry.combatPaused=false;f.setMenu(true);f.advance(60);assert.ok(f.globals.time>time,'a menu can remain open while combat runs');
 f.setMenu(false);f.background(120);f.frame();
 await f.store.sync();assert.equal(f.store.data.lamp.killPoints,0);
 f.advance(.1);await f.store.sync();assert.equal(f.store.data.lamp.killPoints,1);
 const app=readFileSync(new URL('../web-runner/app.js',import.meta.url),'utf8');
 const loop=app.slice(app.indexOf('function tick(){',app.indexOf('let frameCount = 0;'))),tick=loop.indexOf('combatSimulationTicker.tick(');
 for(const guard of ['if (document.hidden)','if (gameState.storyEntry.combatPaused)',"if (layoutState.getActiveLayoutId() !== 'combat') {"]){const at=loop.indexOf(guard);assert.ok(at>=0&&at<tick,guard);assert.match(loop.slice(at,loop.indexOf('}',at)),/combatSimulationTicker.reset\(\)/);}
});

test('pending ticks survive a failed equipment write and reload; acknowledged ticks never replay and indices resume',async()=>{
 const f=fixture();await f.store.sync();f.frame();f.advance(61);const raw=f.values.get(HERO_KEY);
 f.setFail(true);await assert.rejects(f.store.sync(),/equipment save failed/);assert.equal(f.values.get(HERO_KEY),raw);
 const beforeCommit=fixture(f.snapshot());await beforeCommit.store.sync();assert.equal(beforeCommit.store.data.lamp.killPoints,4);
 // Replay the older HeroProgress outbox after equipment committed but before acknowledgement.
 const replay=fixture({...beforeCommit.snapshot(),[HERO_KEY]:raw});await replay.store.sync();assert.equal(replay.store.data.lamp.killPoints,4);
 replay.frame();replay.advance(14.9);await replay.store.sync();assert.equal(replay.store.data.lamp.killPoints,4,'partial seconds may reset on reload');
 replay.advance(.1);assert.deepEqual(replay.globals.HeroProgress.pendingBagKillRewards,{'tick:clock-battle:5':1});
 await replay.store.sync();await replay.store.sync();assert.equal(replay.store.data.lamp.killPoints,5);assert.deepEqual(replay.store.data.settledBagKillRewards['tick:clock-battle'],[[1,5]]);
});

test('ticks stop at MAX and when a battle is absent or settled',async()=>{
 const max=createLampEconomy(42);max.lamp.capacityTier=99;max.lamp.killPoints=17;
 const f=fixture({[EQUIPMENT_SAVE_KEY]:JSON.stringify(max)});await f.store.sync();f.frame();f.advance(61);await f.store.sync();
 assert.equal(f.store.data.lamp.killPoints,17);assert.deepEqual(f.globals.HeroProgress.pendingBagKillRewards||{},{});
 const idle=fixture();await idle.store.sync();idle.globals.ProgressionBattle.settled=true;idle.frame();idle.advance(61);assert.deepEqual(idle.globals.HeroProgress.pendingBagKillRewards||{},{});
 delete idle.globals.ProgressionBattle;idle.advance(61);await idle.store.sync();assert.equal(idle.store.data.lamp.killPoints,0);
});

test('continuous battle changes keep partial active seconds and start a new tick receipt domain',async()=>{
 const f=fixture();await f.store.sync();f.frame();f.advance(10);
 f.globals.ProgressionBattle.id='next-battle';f.advance(5);await f.store.sync();
 assert.equal(f.store.data.lamp.killPoints,1);assert.deepEqual(f.store.data.settledBagKillRewards,{'tick:next-battle':[[1,1]]});
});
