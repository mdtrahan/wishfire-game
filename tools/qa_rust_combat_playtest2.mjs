// Native-pixel proof for the full-height opt-in Rust arena. No production state changes.
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url),{detectChromeExecutable}=require('./playwright_support.js');
const port=Number(process.env.QA_PORT||8797),directory='output/ORKA-wtrf/visual';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:detectChromeExecutable(),headless:true});
try {
 const page=await browser.newPage({viewport:{width:360,height:640},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://localhost:${port}/web-runner/index.html?rustCombat=1`);
 await page.waitForFunction(()=>window.__codexGame&&JSON.parse(render_game_to_text()).flags.layout0Ready);
 await page.getByRole('button',{name:'Open developer tooling modal',exact:true}).click();
 await page.locator('[data-devtool-level="100"]').click();
 await page.locator('[data-devtool-level="100"]').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('[data-devtool-level="100"]').disabled);
 await page.locator('[data-devtool-boss-chapter]').fill('1');await page.locator('[data-devtool-launch-boss]').click();
 await page.waitForFunction(()=>__codexGame.globals.RustCombatPresentation?.state.snapshot?.actors.length);
 const initial=await page.evaluate(async()=>{
  const game=__codexGame,g=game.globals;game.toggleDevToolingModal(false);g.QaScenarioPaused=true;g.QaFixtureHoldTurn=true;g.DevToolingPaused=true;
  const {createCombatBridge}=await import('./src/core/combatBridge.mjs');
  const {createWfmCombatConfig,wfmEnemyInput}=await import('./systems/wfmCombatConfig.mjs');
  const {shadowEnemy}=await import('../src/core/combatShadowAdapter.mjs');
  const {instance}=await WebAssembly.instantiate(await fetch('./assets/simulation_core.wasm').then(r=>r.arrayBuffer()),{});
  const bridge=createCombatBridge(instance),config=createWfmCombatConfig({globals:g,entities:game.state.entities,enemyRows:g.EnemyData,encounterId:'native-proof'});
  config.enemies=[];config.continuous=true;
  const q=window.__arenaProof={bridge,config,game,initial:bridge.create(config),paint:g.RustCombatPresentation};
  q.apply=result=>{
   const s=result.snapshot;game.state.entities.splice(0,game.state.entities.length,...game.state.entities.filter(a=>a.kind==='hero'));
   for(const a of s.actors.filter(a=>a.team==='hero')){
    const h=game.state.entities.find(h=>String(h.heroInstanceKey)===a.host_id);if(!h)continue;
    Object.assign(h,{x:a.pos.x,y:a.pos.y,footX:a.pos.x,footY:a.pos.y,originX:a.pos.x,originY:a.pos.y,rustActorId:a.actor_id,hp:a.hp,maxHP:a.max_hp,isAlive:a.hp>0});
    for(const key of ['HeroRestBasePosByUID','HeroRestFeetPosByUID'])(g[key]||={})[h.uid]={...a.pos};
   }
   q.paint.present(s,result.events||[]);
  };
  q.enemy=(id,position)=>{const row=g.EnemyData.find(r=>r.name==='Gobloc');return shadowEnemy(wfmEnemyInput({uid:id,name:row.name,stats:{...row,HP:100000,ATK:1,DEF:0},hp:100000,maxHP:100000,x:position.x,y:position.y,footX:position.x,footY:position.y},g.EnemyData));};
  return {viewport:[innerWidth,innerHeight,devicePixelRatio],floor:q.initial.snapshot.geometry.floor};
 });
 const measurements=[initial];
 for(const extreme of ['top','bottom']){
  measurements.push(await page.evaluate(extreme=>{const q=__arenaProof,r=structuredClone(q.initial),f=r.snapshot.geometry.floor;
   for(const [i,a]of r.snapshot.actors.entries())a.pos={x:340+i*76,y:extreme==='top'?f.min.y+210:f.max.y-30};
   q.paint.camera.reset();q.apply(r);q.game.stepFrames(1);return{extreme,positions:r.snapshot.actors.map(a=>({x:q.paint.camera.x(a.pos.x),y:q.paint.camera.y(a.pos.y)}))};},extreme));
  await page.screenshot({path:`${directory}/${extreme}-dpr2.png`});
 }
 const chest=await page.evaluate(()=>{const q=__arenaProof;let r=q.bridge.waveChest(q.initial.world,q.config.encounter_id);for(let i=0;i<1800&&r.snapshot.chest.state!=='open';i++)r=q.bridge.step(q.initial.world,{encounter_id:q.config.encounter_id,expected_previous_step:r.snapshot.step});q.apply(r);q.game.stepFrames(1);return r.snapshot.chest;});
 if(chest.state!=='open'||chest.rewards.length)throw new Error('Chest did not open empty');
 measurements.push({chest});await page.screenshot({path:`${directory}/chest-open-dpr2.png`});
 const bubble=await page.evaluate(()=>{
  const q=__arenaProof;q.bridge.destroy(q.initial.world);
  const config=structuredClone(q.config);config.encounter_id='bubble-proof';
  config.geometry.formation_origin={x:456,y:580};
  for(const [i,h]of config.heroes.entries())h.formation_offset={x:-60+i*40,y:0};
  config.enemies=Array.from({length:5},(_,i)=>q.enemy(100+i,{x:360+i*45,y:660}));
  let r=q.bridge.create(config),found=false;q.bubbleWorld=r.world;
  q.paint.present(null);
  for(let i=0;i<9000;i++){
   q.apply(r);
   const fx=q.paint.state.effects.find(e=>e.type==='bubble_pop');
   if(fx&&r.snapshot.time-fx.born>=.14&&r.snapshot.time-fx.born<.25){found=true;break;}
   r=q.bridge.step(r.world||q.bubbleWorld,{encounter_id:config.encounter_id,expected_previous_step:r.snapshot.step});
  }
  q.game.stepFrames(1);return {found,time:r.snapshot.time,effects:q.paint.state.effects.map(e=>e.type)};
 });
 if(!bubble.found)throw new Error('No Rust Bubble Pop release');
 measurements.push({bubble});await page.screenshot({path:`${directory}/bubble-pop-dpr2.png`});
 const geometry=await page.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return{viewport:[innerWidth,innerHeight,devicePixelRatio],canvas:[r.width,r.height,c.width,c.height],overflow:document.documentElement.scrollWidth>innerWidth};});
 if(geometry.overflow||geometry.canvas[2]!==geometry.canvas[0]*2)throw new Error('Canvas density/containment drift');
 if(errors.length)throw new Error(errors.join('\n'));
 await writeFile(`${directory}/measurements.json`,JSON.stringify({measurements,geometry,errors},null,2));
 console.log(JSON.stringify({captures:4,geometry,bubble: bubble.found,chest:chest.state}));
} finally {await browser.close();}
