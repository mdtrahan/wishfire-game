const test = require('node:test');
const assert = require('node:assert/strict');
test('resurrection retains enemy progress, buffs and skills while reviving every hero', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const state={entities:[{uid:1,kind:'hero',hp:0,maxHP:42,isAlive:false,buffs:{ward:3},skills:['faze']},{uid:2,kind:'hero',hp:0,maxHP:35,isAlive:false},{uid:3,kind:'enemy',hp:7,maxHP:50}],globals:{Player_Energy:-1,Player_maxEnergy:150,PendingDeaths:{1:true,3:true},Skills:{faze:true},HeroBuffs:{ward:3}}};
 const gameState={combatFailExitRequested:true};const calls=[];
 const session=createQuestCombatSession({state,gameState,call:n=>calls.push(n),sync(){}});
 session.prepare();assert.equal(session.isCleared(),false);
 session.resurrect();
 assert.equal(state.globals.Player_Energy,-1);
 assert.deepEqual(state.entities.map(e=>e.hp),[42,35,7]);
 assert.deepEqual(state.entities[0].buffs,{ward:3});assert.deepEqual(state.entities[0].skills,['faze']);
 assert.deepEqual(state.globals.PendingDeaths,{3:true});
 assert.deepEqual(state.globals.Skills,{faze:true});assert.deepEqual(state.globals.HeroBuffs,{ward:3});
 assert.equal(gameState.combatFailExitRequested,false);
 assert.ok(calls.includes('ProcessTurn'));
 state.entities=state.entities.filter(e=>e.kind!=='enemy');
 state.globals.AstralFlowKoOrbQueue=[{}];assert.equal(session.isCleared(),false);
 state.globals.AstralFlowKoOrbQueue=[];assert.equal(session.isCleared(),true);
});

test('new battle clears combat conditions and Astral Flow while retaining gold and progression', async () => {
 const {resetCombatSessionConditions}=await import('../web-runner/systems/combatSessionReset.mjs');
 const g={goldTotal:321,HeroGemUsage:{RED:9},AstralFlowAmpPoints:12,AstralFlowAmpReady:1,
 PartyBuff_ATK:8,BuffTurns_ATK:3,PartyTempHPShield:40,PowerAmpByUID:{1:{}},
 EnemyDebuffs:{2:{DEF:8}},EnemyDamageOverTime:[{}],PartyRegens:[{}],TaintedGroundZones:[{}]};
 const ui={partyHpTextRoll:{displayHp:1}}; resetCombatSessionConditions(g,ui);
 assert.equal(g.goldTotal,321);assert.deepEqual(g.HeroGemUsage,{RED:9});
 assert.equal(g.AstralFlowAmpPoints,0);assert.equal(g.AstralFlowAmpReady,0);
 for(const key of ['PartyBuff_ATK','BuffTurns_ATK','PartyTempHPShield','PowerAmpByUID']) assert.equal(g[key],undefined);
 assert.deepEqual(g.EnemyDebuffs,{});assert.deepEqual(g.EnemyDamageOverTime,[]);
 assert.deepEqual(g.PartyRegens,[]);assert.deepEqual(g.TaintedGroundZones,[]);
 assert.equal(ui.partyHpTextRoll,undefined);
});

test('gold persists gains and spending across reloads without writing unchanged balances', async () => {
 const {createGoldProgressStorage}=await import('../web-runner/systems/goldProgressStorage.mjs');
 const values=new Map();let writes=0;
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,v);writes++;}};
 const globals={goldTotal:27};const wallet=createGoldProgressStorage({globals,storage});
 wallet.sync();wallet.sync();assert.equal(writes,1);
 globals.goldTotal=19;wallet.sync();
 const reloaded={goldTotal:0};createGoldProgressStorage({globals:reloaded,storage}).sync();
 assert.equal(reloaded.goldTotal,19);assert.equal(writes,2);
});


test('macro energy is charged only on entry and purple recovery shares the balance', async () => {
 const fs = require('node:fs'); const vm = require('node:vm');
 const {createStoryEntryFlow} = await import('../web-runner/systems/storyEntryFlow.mjs');
 const globals = {Player_Energy:80, MatchedColorValue:1};
 const gameState = {}; let layout = 'storyMock';
 const flow = createStoryEntryFlow({gameState,energyGlobals:globals,isReady:()=>true,
 layoutState:{getActiveLayoutId:()=>layout,requestLayoutChange:async id=>{layout=id;return true;}}});
 gameState.storyEntry.phase='ladder'; flow.startCard(0);
 assert.equal(globals.Player_Energy,80);
 for (const file of ['Scripts/functionBank.js','web-runner/modules/functionBank.js']) {
  const src=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
  const extract=name=>src.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
  const ctx=vm.createContext({getGlobals:()=>globals,Math,GetCurrentTurn:()=>1,rollCombatRandom:()=>0,getActorNameByUID:()=> 'Hero',LogCombat:()=>{}});
  vm.runInContext(extract('Sub_Energy'),ctx); ctx.Sub_Energy({},3);
  assert.equal(globals.Player_Energy,80);
  vm.runInContext(extract('GrantPurpleMatchEnergy'),ctx);
  ctx.GrantPurpleMatchEnergy({},1,3,6);
  assert.equal(gameState.storyEntry.progress.energy,86);
  globals.Player_Energy=80;
 }
 globals.Player_Energy += 6;
 assert.equal(gameState.storyEntry.progress.energy,86);
});
