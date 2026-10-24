import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { HERO_FORMATION_SLOTS } from '../src/core/heroFormationGeometry.mjs';
const {detectChromeExecutable}=createRequire(import.meta.url)('../tools/playwright_support.js');
const directory='output/ORKA-bti/combat-browser';

test('production combat retains saved 2-4-2 slots while moving at reference and compact sizes',{timeout:180000},async()=>{
 await mkdir(directory,{recursive:true});
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'}),url=`http://localhost:${port}/web-runner/index.html`;
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()}),report=[];
 try{
  for(let attempt=0;attempt<50;attempt++){try{if((await fetch(url)).ok)break;}catch{}if(attempt===49)throw Error('Formation QA server did not start');await delay(100);}
  for(const [width,height,dpr] of [[360,640,1],[216,384,2]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,recordVideo:{dir:directory,size:{width,height}}}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   // Disclosed formation save and encounter seed 7. Heroes, clocks and damage use normal Start.
   const cells={Falie:0,Huun:3,Runa:5,Kojonn:7};
   await page.addInitScript(cells=>{
    localStorage.setItem('wishfire.heroFormation.v4',JSON.stringify({version:4,active:0,presets:Array.from({length:3},()=>({leader:'Falie',cells}))}));
    window.formationPaint={};window.formationObserved=[];
    const observe=()=>{
     const game=window.__codexGame,center=game?.globals.ContinuousCombatFormation;
     const combat=game&&typeof window.render_game_to_text==='function'&&JSON.parse(window.render_game_to_text()).quest.phase==='combat';
     const heroes=game?.state.entities.filter(a=>a.kind==='hero')||[];
     if(combat&&center&&heroes.length===4&&heroes.every(a=>Number.isFinite(a.formationSlotX))&&window.formationObserved.length<900){
      window.formationObserved.push({time:game.globals.time,center:{...center},heroes:heroes.map(a=>({name:a.name,hp:a.hp,x:a.footX,y:a.footY,sx:a.formationSlotX,sy:a.formationSlotY,cell:game.globals.HeroFormationPlacement[String(a.baseHeroName||a.name).toLowerCase()]?.cell}))});
     }
     requestAnimationFrame(observe);
    };requestAnimationFrame(observe);
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
     const match=/\/puppets\/(fara|hondo|runa|kaja)\/frames\/(idle|walk|attack|cast|hurt|spawn|ko)-/.exec(image?.src||'');
     const name=match?.[1],state=match?.[2];
     if(name&&this.canvas.id==='view'&&args.length===4)(window.formationPaint[name] ||= {})[state]={image,width:args[2],height:args[3]};
     return draw.call(this,image,...args);
    };
   },cells);
   try{
    await page.goto(url);await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
    await page.evaluate(()=>window.__codexGame.setEncounterRequest({seed:7}));
    const canvas=page.locator('#view');await canvas.waitFor();await page.waitForTimeout(2000);const rect=await canvas.boundingBox();await page.mouse.click(rect.x+rect.width/2,rect.y+426*rect.width/360);
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).quest.phase==='combat');
    await page.waitForFunction(()=>window.__codexGame.state.entities.filter(a=>a.kind==='hero').every(a=>Number.isFinite(a.formationSlotX)));
    const read=()=>page.evaluate(()=>{
     const state=window.__codexGame.state,canvas=document.querySelector('#view'),rect=canvas.getBoundingClientRect();
     return{time:state.globals.time,center:state.globals.ContinuousCombatFormation,heroes:state.entities.filter(a=>a.kind==='hero').map(a=>({name:a.name,hp:a.hp,x:a.footX,y:a.footY,sx:a.formationSlotX,sy:a.formationSlotY,cell:state.globals.HeroFormationPlacement[String(a.baseHeroName||a.name).toLowerCase()]?.cell,facing:a.facing})),viewport:[innerWidth,innerHeight,devicePixelRatio],canvas:rect.toJSON(),backing:[canvas.width,canvas.height]};
    });
    const samples=[],result={fixture:'v4 placement and encounter seed 7; normal Start combat, unchanged hero/enemy stats',width,height,dpr,samples};report.push(result);
    result.encounterSeed=await page.evaluate(()=>window.__codexGame.globals.ContinuousCombatStage.seed);assert.equal(result.encounterSeed,7);
    for(let frame=0;frame<20;frame++){
     await delay(200);const sample=await read();samples.push(sample);
     for(const h of sample.heroes){const slot=HERO_FORMATION_SLOTS[h.cell];assert.ok(slot,`${h.name} has a saved slot`);assert.ok(Math.abs(h.sx-sample.center.x-slot.x)<1e-8);assert.ok(Math.abs(h.sy-sample.center.y-slot.y)<1e-8);assert.ok(Math.hypot(h.x-h.sx,h.y-h.sy)<=1.6+1e-8);}
     if([0,10,19].includes(frame))await page.screenshot({path:`${directory}/${width}-combat-${frame}.png`});
    }
    assert.ok(samples.at(-1).time>samples[0].time,'combat clock advances');
    const openingSamples=await page.evaluate(()=>window.formationObserved);result.openingSamples=openingSamples;
    const observed=[...openingSamples,...samples],origin=observed[0].center;
    assert.ok(observed.some(s=>Math.hypot(s.center.x-origin.x,s.center.y-origin.y)>2),'party moves while retaining its slots from the first combat frame');
    for(const sample of openingSamples)for(const h of sample.heroes){const slot=HERO_FORMATION_SLOTS[h.cell];assert.ok(slot);assert.ok(Math.abs(h.sx-sample.center.x-slot.x)<1e-8);assert.ok(Math.abs(h.sy-sample.center.y-slot.y)<1e-8);assert.ok(Math.hypot(h.x-h.sx,h.y-h.sy)<=1.6+1e-8);}
    const widths=await page.evaluate(()=>Object.fromEntries(Object.entries(window.formationPaint).map(([name,states])=>[name,Object.fromEntries(Object.entries(states).map(([state,paint])=>{
     const image=paint.image,c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let left=c.width,right=-1;
     for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);}
     const layoutScale=document.querySelector('#view').getBoundingClientRect().width/360;
     return[state,{frame:image.src.split('/assets/')[1],paintedScreenWidth:(right-left+1)/c.width*paint.width/layoutScale,paintedWorldWidth:(right-left+1)/c.width*paint.width/layoutScale/.5}];
    }))])));
    assert.equal(Object.keys(widths).length,4,'all current hero puppets visibly painted');assert.deepEqual(errors,[]);
    Object.assign(result,{paintedWidths:widths,pass:true});
   }finally{const video=page.video();await context.close();if(video)await rename(await video.path(),`${directory}/${width}-combat.webm`);}
  }
 }catch(error){report.push({pass:false,error:String(error.stack||error)});throw error;}
 finally{await browser.close();server.kill();await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));}
});
