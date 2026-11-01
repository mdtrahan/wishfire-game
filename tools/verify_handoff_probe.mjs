import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { quantiles, summarizeMetrics } from './verify_handoff_logic.mjs';
const require = createRequire(import.meta.url);
const { detectChromeExecutable, classifyPlaywrightFailure, waitForJsonEndpoint } = require('./playwright_support.js');

// Runs before application scripts. Observers wrap public presentation seams; no combat mutation.
export function installObservers() {
  const q = window.handoffProbe = { frames: [], steps: [], longTasks: [], samples: [], events: [], buffs: [], clips: [], errors: [], draws: 0, expired: [], observedEffects: 0 };
  let recording = false, previous, paint, serial = 0;
  const ids = new WeakMap(), contexts = new WeakMap(), effectOrigins = new WeakMap(), missingSince = new Map();
  try { new PerformanceObserver(list => { if (recording) q.longTasks.push(...list.getEntries().map(e => e.duration)); }).observe({ type: 'longtask', buffered: false }); }
  catch (e) { q.errors.push(`longtask observer: ${e.message}`); }
  const descriptor = Object.getOwnPropertyDescriptor(WebAssembly.Instance.prototype, 'exports'), facades = new WeakMap();
  Object.defineProperty(WebAssembly.Instance.prototype, 'exports', { ...descriptor, get() {
    const exports = descriptor.get.call(this);
    if (!exports.wf_combat_call) return exports;
    if (!facades.has(this)) facades.set(this, { ...exports, wf_combat_call(ptr, len) {
      const step = recording && JSON.parse(new TextDecoder().decode(new Uint8Array(exports.memory.buffer, ptr, len))).operation.kind === 'step';
      const start = performance.now();
      try { return exports.wf_combat_call(ptr, len); } finally { if (step) q.steps.push(performance.now() - start); }
    } });
    return facades.get(this);
  } });
  const proto = CanvasRenderingContext2D.prototype;
  const box = (ctx, x, y, w, h) => {
    const m = ctx.getTransform(), points = [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([a,b]) => ({x:m.a*a+m.c*b+m.e,y:m.b*a+m.d*b+m.f}));
    return { left: Math.min(...points.map(p=>p.x)), right: Math.max(...points.map(p=>p.x)), top: Math.min(...points.map(p=>p.y)), bottom: Math.max(...points.map(p=>p.y)) };
  };
  const outside = (a,b) => a.left < b.left-.5 || a.right > b.right+.5 || a.top < b.top-.5 || a.bottom > b.bottom+.5;
  for (const method of ['save','restore','beginPath','rect','roundRect','clip']) {
    const original = proto[method];
    proto[method] = function(...args) {
      let s = contexts.get(this); if (!s) contexts.set(this, s={ clips:[], stack:[], path:[] });
      if (method==='save') s.stack.push([...s.clips]);
      if (method==='restore') s.clips=s.stack.pop()||[];
      if (method==='beginPath') s.path=[];
      if (method==='rect'||method==='roundRect') s.path.push(box(this,...args));
      if (method==='clip') s.clips.push(args[0] instanceof Path2D ? null : s.path.length===1?s.path[0]:null);
      return original.apply(this,args);
    };
  }
  function clipped(ctx, rect, layer) {
    const active = [{left:0,top:0,right:ctx.canvas.width,bottom:ctx.canvas.height},...(contexts.get(ctx)?.clips || [])];
    if (active.some(clip => !clip || outside(rect,clip))) q.clips.push({time:paint?.state.snapshot?.time,layer,rect,active});
  }
  for(const glProto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]) {
    const states=new WeakMap();
    for(const name of ['enable','disable','scissor','drawArrays','drawElements']) {
      const original=glProto[name];
      glProto[name]=function(...args) {
        let s=states.get(this);if(!s)states.set(this,s={enabled:false,rect:null});
        if((name==='enable'||name==='disable')&&args[0]===this.SCISSOR_TEST)s.enabled=name==='enable';
        if(name==='scissor')s.rect=args;
        if(recording&&name.startsWith('draw')&&s.enabled&&(!s.rect||s.rect[0]>0||s.rect[1]>0||s.rect[2]<this.drawingBufferWidth||s.rect[3]<this.drawingBufferHeight))q.clips.push({layer:'WebGL scissor',rect:s.rect});
        return original.apply(this,args);
      };
    }
  }
  function attach(p) {
    paint=p;
    const ingest=p.state.ingest;
    p.state.ingest=function(snapshot,events) {
      const result=ingest.call(this,snapshot,events);
      if(recording&&snapshot) {
        const normalized=events.map(e=>e.body.kind==='presentation'?e.body.data.event:e.body);
        q.events.push(...normalized.map(e=>({encounter:snapshot.encounter_id,time:snapshot.time,...e})));
        for(const e of normalized) if(['healed','ward_gained','groove_activated'].includes(e.kind)) {
          const target=e.data.target??e.data.hero, actor=snapshot.actors.find(a=>a.actor_id===target);
          q.buffs.push({kind:e.kind,target,side:actor?.team??null,allowed:[e.data.source?.kind?.startsWith('enemy_')?'enemy':'hero'],time:snapshot.time});
        }
      }
      return result;
    };
    const sprite=p.sprite;
    p.sprite=function(ctx,puppet,options) {
      const rect=sprite.call(this,ctx,puppet,options);
      if(recording&&rect) {q.draws++;clipped(ctx,box(ctx,rect.drawX,rect.drawY,rect.width,rect.height),'actor');}
      return rect;
    };
    for(const key of ['ground','front','chest','actor']) {
      const draw=p[key]; if(!draw)continue;
      p[key]=function(ctx,...args) {
        if(recording) {const r=ctx.canvas.getBoundingClientRect(),scale=r.width/360;clipped(ctx,box(ctx,0,42*scale,360*scale,388*scale),key);}
        return draw.call(this,ctx,...args);
      };
    }
  }
  function frame(now) {
    const p=window.__codexGame?.globals.RustCombatPresentation;
    if(p&&p!==paint)attach(p);
    if(recording) {
      if(previous!==undefined)q.frames.push(now-previous);previous=now;
      const s=p?.state.snapshot, raw=p?.motion.raw;
      if(s&&raw) {
        const effects=[];
        function observe(object,type,born,deadline,source) {
          if(!ids.has(object)){ids.set(object,++serial);q.observedEffects++;}
          const e={id:ids.get(object),type,born,deadline,source};effects.push(e);
          if(Number.isFinite(deadline)&&s.time>deadline+1/30+.001)q.expired.push({time:s.time,...e});
        }
        function sourceDeadline(type,id,live,grace) {
          const key=`${s.encounter_id}:${type}:${id}`;
          if(live){missingSince.delete(key);return null;}
          if(!missingSince.has(key))missingSince.set(key,s.time);
          return missingSince.get(key)+grace;
        }
        const tails={corpse:1.48,shadow:.75,split:.505,hit:.30,healing:3.2,green_aura:.45,resolved:.08,bubble_pop:.94,ground_pound:.748,arcane_pulse:2.6,cancelled:.12,boss_push:.18,phoenix_burst:.5,revive:.75,revive_cancel:.28,faze_splash:.3,popup:.75};
        for(const e of [...p.state.effects,...p.state.popups]) {
          const type=e.type||'popup',actor=e.data?.id??e.data?.target??e.target;
          if(!effectOrigins.has(e))effectOrigins.set(e,{time:s.time,born:e.born,combatTime:raw.combat_time,step:raw.step,actor,hazard:e.data?.hazard?.id??null,events:q.events.filter(v=>v.time===s.time)});
          const origin=effectOrigins.get(e),budget=type==='cast'?(e.data.actor?.state_duration??.5)+2.6:tails[type];
          if(!Number.isFinite(budget))q.expired.push({type,reason:'Unrecognized lifetime contract'});
          observe(e,type,e.born,Math.min(e.born+e.life,Math.max(origin.time,origin.born)+(budget??0)),origin);
        }
        for(const [id,e]of p.state.hazards){const live=raw.hazards.some(h=>h.id===id);observe(e,'hazard',null,sourceDeadline('hazard',id,live,.3),{id,live});}
        for(const [id,e]of p.state.projectiles) {observe(e,'projectile',null,null,{id,live:raw.projectiles.some(h=>h.id===id)});if(!raw.projectiles.some(h=>h.id===id))q.expired.push({type:'projectile',id,time:s.time});}
        for(const [id,e]of p.state.markers){const live=raw.hazards.some(h=>h.id===id&&h.phase!=='resolved');observe(e,'marker',e.born,sourceDeadline('marker',id,live,.15),{id,live});}
        for(const [id,e]of p.state.encased||[]){const a=raw.actors.find(a=>a.actor_id===id),live=a?.team==='enemy'&&a.hp>0&&a.encased>0;observe(e,'encased',e.born,sourceDeadline('encased',id,live,.32),{id,live});}
        const canvas=document.querySelector('#view'),rect=canvas.getBoundingClientRect(),floor=raw.geometry.floor;
        q.samples.push({time:s.time,rustTime:raw.time,combatTime:raw.combat_time,step:raw.step,encounter:raw.encounter_id,floor,
          actors:raw.actors.map(a=>({id:a.actor_id,side:a.team,hp:a.hp,world:{...a.pos},bounds:p.motion.records.get(a.actor_id)?.rect?{...p.motion.records.get(a.actor_id).rect}:null,ward:a.ward,elevate:a.elevate,groove:a.groove_active})),effects,
          hazards:raw.hazards.map(h=>({id:h.id,kind:h.kind,phase:h.phase})),projectiles:raw.projectiles.map(h=>h.id),canvas:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,backingWidth:canvas.width,backingHeight:canvas.height}});
      }
    }
    requestAnimationFrame(frame);
  }
  q.start=()=>{recording=true;previous=undefined;};q.stop=()=>{recording=false;};requestAnimationFrame(frame);
}

export async function combatProbe(root, out, seconds, seed) {
  const { chromium, devices } = await import('playwright');
  const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const server=spawn(process.execPath,['tools/serve_web.js','--port',String(port)],{cwd:root,stdio:'ignore'});
  let browser,browserServer;const errors=[];
  try {
    const url=`http://localhost:${port}/web-runner/index.html`;
    await waitForJsonEndpoint(`http://localhost:${port}/package.json`,10000);
    browserServer=await chromium.launchServer({headless:true,executablePath:detectChromeExecutable()||undefined});
    browser=await chromium.connect(browserServer.wsEndpoint());
    const {defaultBrowserType,...profile}=devices['iPhone 13'],context=await browser.newContext(profile);
    const page=await context.newPage();
    page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(()=>localStorage.clear()); // Each engine attempt starts with the same fresh save.
    await page.addInitScript(installObservers);
    const enterBoss=async()=>{
      await page.evaluate(seed=>__codexGame.setEncounterRequest({seed}),seed);
      await page.getByRole('button',{name:'Open developer tooling modal',exact:true}).click();
      await page.locator('[data-devtool-boss-chapter]').fill('1');await page.locator('[data-devtool-launch-boss]').click();
      await page.waitForFunction(()=>JSON.parse(render_game_to_text()).quest.phase==='combat');
    };
    let legacyFlag=false,loadMs;
    for(const suffix of ['', '?rustCombat=1']) {
      console.log(`probe: load ${suffix?'legacy opt-in':'default engine'}`);
      errors.length=0;await page.goto(url+suffix);
      await page.waitForFunction(()=>window.__codexGame&&JSON.parse(window.render_game_to_text()).flags.layout0Ready);
      await page.evaluate(seed=>__codexGame.setEncounterRequest({seed}),seed);
      await page.waitForTimeout(2000);
      // Canonical Chapter 1 boss entry reused from qa_rust_combat_playtest2.mjs.
      await enterBoss();
      console.log('probe: combat entered; checking Rust authority');
      await page.waitForFunction(()=>__codexGame.globals.RustCombatPresentation?.state.snapshot?.actors.length,{},{timeout:10000}).catch(()=>{});
      const engine=await page.evaluate(()=>!!__codexGame.globals.RustCombatPresentation?.state.snapshot);
      if(engine){loadMs=await page.evaluate(()=>performance.getEntriesByType('navigation')[0].loadEventEnd);break;}
      if(suffix){const state=await page.evaluate(()=>{const g=__codexGame.globals;return {authority:g.RustCombatAuthority,error:g.RustCombatError,receipt:g.RustCombatReceipt,loop:g.ContinuousCombatStageLoop,stage:g.ContinuousCombatStage,quest:JSON.parse(render_game_to_text()).quest};});throw Error(`Runtime probe found no active Rust authority/snapshot: ${JSON.stringify(state)}`);}legacyFlag=true;
    }
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    const heap=async()=> (await cdp.send('Runtime.getHeapUsage')).usedSize;
    const heapStart=await heap(),identity=await page.evaluate(()=>({seed:__codexGame.globals.ContinuousCombatStage.seed,chapter:__codexGame.globals.ContinuousCombatStage.region,viewport:[innerWidth,innerHeight,devicePixelRatio]}));
    console.log(`probe: recording ${seconds}s`);await page.evaluate(()=>handoffProbe.start());
    const deadline=performance.now()+seconds*1000;let reentries=0;
    while(performance.now()<deadline){
      await delay(Math.min(1000,Math.max(0,deadline-performance.now())));
      const active=await page.evaluate(()=>JSON.parse(render_game_to_text()).quest.phase==='combat'&&!!__codexGame.globals.RustCombatPresentation?.state.snapshot);
      if(!active&&deadline-performance.now()>2000){console.log('probe: re-entering seeded Chapter 1 boss');await enterBoss();reentries++;}
    }
    await page.evaluate(()=>handoffProbe.stop());
    const heapEnd=await heap(),q=await page.evaluate(()=>handoffProbe);
    await writeFile(join(out,'trace.json'),JSON.stringify({...q,identity,errors}));
    const actors=q.samples.flatMap(s=>s.actors.map(a=>({...a,floor:s.floor})));
    const escaped=actors.filter(a=>a.hp>0&&(a.world.x<a.floor.min.x-.5||a.world.x>a.floor.max.x+.5||a.world.y<a.floor.min.y-.5||a.world.y>a.floor.max.y+.5));
    const activeSeconds=q.samples.reduce((sum,s,i)=>sum+(i&&s.encounter===q.samples[i-1].encounter?Math.max(0,s.rustTime-q.samples[i-1].rustTime):0),0);
    const frame=quantiles(q.frames),step=quantiles(q.steps),complete=q.samples.length>1&&q.samples.length>=q.frames.length*.9&&activeSeconds>=seconds*.8&&q.draws>0&&step&&identity.seed===seed&&identity.chapter===1;
    const violations={noLingeringEffects:q.expired.length,actorsInsideArena:escaped.length,buffsAllowedSides:q.buffs.filter(b=>!b.allowed.includes(b.side)).length,noClipping:q.clips.length,noConsoleErrors:errors.length};
    const claims=Object.fromEntries(Object.entries(violations).map(([id,value])=>[id,{status:complete&&value===0?'PASS':'FAIL',measured:value,evidence: {samples:q.samples.length,draws:q.draws,effects:q.observedEffects,buffs:q.buffs.length}}]));
    if(!q.observedEffects)claims.noLingeringEffects.status='FAIL';
    if(!q.buffs.length)claims.buffsAllowedSides.status='FAIL';
    return {trace:join(out,'trace.json'),reentries,engine:'Rust (live snapshots + measured WASM calls)',legacyFlag,identity,claims,coverage:{complete:!!complete,activeSeconds,samples:q.samples.length,effects:q.observedEffects,buffs:q.buffs.length},metrics:{frameP50:frame?.p50??null,frameP95:frame?.p95??null,frameMax:frame?.max??null,stepP50:step?.p50??null,stepP95:step?.p95??null,stepMax:step?.max??null,heapStart,heapEnd,heapGrowthBytes:heapEnd-heapStart,longTasks:q.longTasks.length,longTaskMs:q.longTasks.reduce((a,b)=>a+b,0),wasmBytes:(await stat(join(root,'web-runner/assets/simulation_core.wasm'))).size,pageLoadMs:loadMs},errors:[...errors,...q.errors]};
  } catch(error) {return {error:String(error.stack),classification:classifyPlaywrightFailure(error),errors,claims:{},metrics:{}};}
  finally {
    console.log('probe: releasing owned browser/server');
    if(browserServer){let timer;try{await Promise.race([browser?.close(),new Promise(resolve=>{timer=setTimeout(()=>{browserServer.process().kill('SIGKILL');resolve();},10000);})]);}finally{clearTimeout(timer);await browserServer.kill();}}
    if(server.exitCode===null&&server.signalCode===null){const stopped=once(server,'exit');server.kill('SIGTERM');await stopped;}
  }
}

export async function combatProbes(root, out, seconds, seed) {
  const runs = [];
  for (let i = 1; i <= 3; i++) {
    const dir = join(out, `run-${i}`);
    await mkdir(dir, { recursive: true });
    console.log(`probe: run ${i}/3`);
    runs.push(await combatProbe(root, dir, seconds, seed));
  }
  return {
    ...summarizeMetrics(runs), runs,
    coverage: { complete: runs.every(r => r.coverage?.complete) },
    claims: Object.fromEntries(Object.keys(runs[0].claims).map(id => [id, {
      status: runs.every(r => r.claims[id]?.status === 'PASS') ? 'PASS' : 'FAIL',
      measured: runs.reduce((sum, r) => sum + (r.claims[id]?.measured ?? Infinity), 0),
    }])),
    errors: runs.flatMap(r => [...r.errors, ...(r.error ? [r.error] : [])]),
  };
}
