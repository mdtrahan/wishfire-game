const test = require('node:test');
const assert = require('node:assert/strict');
test('combat changes under black after 250ms fade and 500ms hold, then reveals for 1000ms', async () => {
 const calls=[];
 global.document={createElement:()=>({style:{},setAttribute(){},animate(frames,options){calls.push([frames,options]);return {finished:Promise.resolve()};},remove(){calls.push('remove');}}),body:{append(){}}};
 global.ResizeObserver=class {observe(){} disconnect(){}};
 try {
  const {createCombatEntryTransition}=await import('../web-runner/systems/combatEntryTransition.mjs');
  await createCombatEntryTransition({getBoundingClientRect:()=>({left:0,top:0,width:360,height:640})})(async()=>{calls.push('change');return true;});
  assert.deepEqual(calls.map(x=>typeof x==='string'?x:x[1].duration),[250,500,'change',1000,'remove']);
  assert.equal(calls[1][0][1].opacity,1);
 } finally {delete global.document;delete global.ResizeObserver;}
});
