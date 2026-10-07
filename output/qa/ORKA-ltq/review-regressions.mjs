import assert from 'node:assert/strict';
import { createActorClipLoader } from '/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-ltq-clip-retention/web-runner/systems/actorClipPlayback.mjs';
import { createActorPuppetPresentation } from '/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-ltq-clip-retention/web-runner/systems/actorPuppetPresentation.mjs';
const flush = () => new Promise(resolve => setImmediate(resolve));
const entry = { frames:['a.png','b.png'], frameHoldMs:[10,10], loop:true, canvas:{width:2,height:2}, footOrigin:{x:1,y:2} };
const manifest = {actors:{fara:{clips:Object.fromEntries(['idle','walk','hurt'].map(s=>[s,{right:entry}]))}}};
const makeLoader = loadImage => createActorClipLoader({loadManifest:()=>manifest,loadImage,frameUrl:x=>x,maxDecodedBytes:64});
const events=[];
// Independent instances and reversed completion order with real bounded loader.
let gates=[];
const load=makeLoader(name=>new Promise(resolve=>gates.push(()=>resolve({name,width:2,height:2}))));
const p=createActorPuppetPresentation({loadClip:load});
const a={uid:1,name:'Fara',hp:1,facing:'right'}, b={...a,uid:2};
p.frameFor(a,1); p.frameFor(b,1); await flush(); assert.equal(gates.length,2); gates.splice(0).forEach(f=>f()); await flush();
assert.equal(p.frameFor(a,1).state,'idle'); assert.equal(p.frameFor(b,1).state,'idle');
p.frameFor({...a,locomotion:'walk'},2); p.frameFor(b,2); await flush();
assert.equal(load.retention().retainedBytes,64); assert.equal(load.retention().reservedBytes,32);
p.frameFor({...a,actionState:'hurt',actionStateUntil:4},2); await flush();
assert.equal(p.frameFor(b,2).state,'idle'); // Shared archetype stays independent.
gates.splice(0).forEach(f=>f()); await flush();
assert.equal(p.frameFor({...a,actionState:'hurt',actionStateUntil:4},2).state,'idle'); // Superseded walking result cannot install.
events.push({check:'same archetype, protected display, capacity denial, stale completion',status:'PASS',retention:load.retention()});
// All pilots retire while an unsupported actor remains. No supported call reaches pruning.
p.frameFor({uid:3,name:'Hondo',hp:1},3); p.frameFor({uid:3,name:'Hondo',hp:1},4);
assert.equal(p.retention().displayedActors,0);
events.push({check:'last pilot retirement',status:'PASS',displayedActorsAfterTwoAbsentFrames:p.retention().displayedActors});
p.frameFor({uid:3,name:'Hondo',hp:1},0);
assert.equal(p.retention().displayedActors,0);
events.push({check:'clock reset with unsupported roster',status:'PASS',displayedActorsAfterReset:p.retention().displayedActors});
// One frame rejects, another hangs: retain reservation until every operation settles.
let release; let fail=true;
const failure=makeLoader(name=> name==='a.png'&&fail ? Promise.reject(Error('failure')) : name==='b.png'&&fail ? new Promise(r=>release=r) : {width:2,height:2});
const failed=failure('fara','idle','right'); await flush(); assert.equal(failure.retention().reservedBytes,32);
release({width:2,height:2}); assert.equal(await failed,null); assert.equal(failure.retention().entries,0); assert.equal(failure.retention().retainedBytes,0);
fail=false; assert.ok(await failure('fara','idle','right')); events.push({check:'partial failure drains and subsequent retry recovers',status:'PASS'});
const oversized=makeLoader(()=>({naturalWidth:2000,naturalHeight:2000})); assert.equal(await oversized('fara','idle','right'),null); assert.equal(oversized.retention().retainedBytes,0); events.push({check:'actual dimensions mismatch rejects/releases',status:'PASS'});
const zero=makeLoader(()=>({naturalWidth:0,naturalHeight:0,width:0,height:0})); assert.equal(await zero('fara','idle','right'),null); events.push({check:'zero actual dimensions rejected',status:'PASS',scope:'injected image provider; native successful PNG onload yields nonzero intrinsic dimensions'});
console.log(JSON.stringify(events,null,2));
