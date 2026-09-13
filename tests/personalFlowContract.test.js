const test=require('node:test'),assert=require('node:assert/strict');
const flow=require('../web-runner/src/core/personalFlow.mjs');
const commands=require('../web-runner/modules/heroCommands.mjs');
const {newHeroProgress}=require('../web-runner/src/core/heroProgression.mjs');
function battle(){const h={...newHeroProgress('Huun'),uid:1,kind:'hero',currentLevel:50},e={uid:2,kind:'enemy',hp:100,maxHP:100,statuses:[]};flow.initializePersonalFlow([h]);const g={GamePhase:'RUNTIME',TurnPhase:0,TurnSerial:1,CombatSessionId:1,time:0};const ctx={state:{entities:[h,e],globals:g},callFunction(name,...args){if(name==='GetCurrentTurn')return 1;if(name==='GetEnemyRosterStability')return {stable:true};if(name==='StartHeroLunge'){g.HeroAction={active:true};return 1;}if(name==='CalculateDamage')return 10;if(name==='ApplyDamageToTarget'){const t=ctx.state.entities.find(a=>a.uid===args[0]);t.hp=Math.max(0,t.hp-args[1]);}}};return {h,e,g,ctx};}
test('every hero starts each combat at zero AF with no active SP state',()=>{assert.equal(Object.keys(flow.FLOW_MODES).length,10);for(const name of ['Falie','Huun','Runa','Kojonn']){const h={...newHeroProgress(name),kind:'hero'};flow.initializePersonalFlow([h]);assert.equal(h.flow,0);assert.equal(h.sp,undefined);assert.equal(h.spMax,undefined);assert.deepEqual(flow.getHeroFlowState(h),{value:0,max:100,ready:false,mode:h.flowMode});}const h={name:'Kojonn',hp:40};flow.initializePersonalFlow([h]);assert.equal(h.flowMode,'Comrade');});
test('AF clamps at 100 only when the assigned orb arrives',()=>{const {h,e,g,ctx}=battle();h.flow=95;const queue=[{skillId:'power_attack',targetIds:[2]},{skillId:'combo',targetIds:[2]}];assert.equal(commands.executeHeroCommand(ctx,{actorUID:1,queue}),true);commands.resolveNativeCommandStep(ctx,g.PendingHeroHits.shift());assert.equal(e.hp,84);e.hp=0;commands.resolveNativeCommandStep(ctx,g.PendingHeroHits.shift());assert.equal(h.flow,95);assert.equal(g.NativeCommandSequence,undefined);});
test('duplicate skills reject, repeatable actions still respect action capacity',()=>{const {h,ctx}=battle();assert.equal(commands.buildCommandActions(ctx,h,{queue:[{skillId:'power_attack',targetIds:[2]},{skillId:'power_attack',targetIds:[2]}]}),null);assert.equal(commands.buildCommandActions(ctx,h,{queue:[{skillId:'follow_up',targetIds:[2]},{skillId:'follow_up',targetIds:[2]}]}).length,2);});
test('KO cancels remaining sequence without an SP refund path',()=>{const {h,g,ctx}=battle();commands.executeHeroCommand(ctx,{actorUID:1,queue:[{skillId:'power_attack',targetIds:[2]},{skillId:'combo',targetIds:[2]}]});h.hp=0;commands.resolveNativeCommandStep(ctx,g.PendingHeroHits.shift());assert.equal(g.NativeCommandSequence,undefined);assert.equal(h.sp,undefined);});
test('FLOW is preserved when a committed magic special becomes silenced',()=>{const {h,g,ctx}=battle();h.name='Runa';h.baseHeroName='Runa';h.flow=100;commands.executeHeroCommand(ctx,{actorUID:1,flow:true,targetUID:2});h.statuses=[{statusEffect:'silence'}];commands.resolveNativeCommandStep(ctx,g.PendingHeroHits.shift());assert.equal(h.flow,100);assert.equal(g.NativeCommandSequence,undefined);});
const {selectionBudget,battlefieldTargets}=require('../web-runner/src/core/actionSelection.mjs');
test('mixed action capacities constrain excess commands without SP',()=>{
 for(const capacity of [1,2,3]){const {h,ctx}=battle();h.actionSlotsPerTurn=capacity;
 const queue=Array.from({length:capacity},()=>({skillId:'follow_up',targetIds:[2]}));
 assert.equal(commands.buildCommandActions(ctx,h,{queue}).length,capacity);
 assert.equal(commands.buildCommandActions(ctx,h,{queue:[...queue,queue[0]]}),null);
 assert.equal(selectionBudget(h,queue).remainingActionSlots,0);
 }
});
test('early commit discards unused action slots without consuming AF',()=>{
 const {h,ctx}=battle();h.actionSlotsPerTurn=3;
 const queue=[{skillId:'power_attack',targetIds:[2]},{skillId:'combo',targetIds:[2]}];
 queue.pop();assert.equal(selectionBudget(h,queue).remainingActionSlots,2);
 assert.equal(commands.executeHeroCommand(ctx,{actorUID:1,queue}),true);assert.equal(h.flow,0);assert.equal(h.remainingActionSlots,0);
});
test('commands are not gated by retired SP values',()=>{
 const {h,ctx}=battle();h.actionSlotsPerTurn=3;h.sp=0;
 assert.equal(commands.buildCommandActions(ctx,h,{queue:[{skillId:'power_attack',targetIds:[2]},{skillId:'combo',targetIds:[2]}]}).length,2);assert.equal(h.sp,0);
});
test('battlefield selection is captured per action and AoE uses its group',()=>{
 const {h,e,ctx}=battle();ctx.state.entities.push({...e,uid:3});const g={SelectedEnemyUID:3};
 const single=battlefieldTargets(ctx.state.entities,h,{targetType:'enemy'},g);assert.deepEqual(single,[3]);g.SelectedEnemyUID=2;assert.deepEqual(single,[3]);
 assert.deepEqual(battlefieldTargets(ctx.state.entities,h,{targetType:'allEnemies'},g),[2,3]);
});
