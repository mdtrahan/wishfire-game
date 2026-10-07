import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleRealtimeActions } from '../web-runner/src/core/realtimeCooldown.mjs';

test('actors schedule independently while only colliding hero basics receive a one-frame stagger',()=>{
 const actors=[
  {uid:2,kind:'hero',hp:20,basicIntervalSeconds:0.5,basicReadyAt:1,basicCastSeconds:0.05,
   skills:[{id:'quick',readyAt:4,cooldownSeconds:3,castSeconds:0.1}]},
  {uid:1,kind:'hero',hp:20,basicIntervalSeconds:0.4,basicReadyAt:1,basicCastSeconds:0.3,projectileFlightSeconds:2,
   skills:[{id:'first',readyAt:1,cooldownSeconds:4,castSeconds:0.2,projectileFlightSeconds:3},{id:'second',readyAt:1,cooldownSeconds:2,castSeconds:0.1,priority:1}]},
  {uid:9,kind:'enemy',hp:20,basicIntervalSeconds:0.8,basicReadyAt:4},
 ];
 const opening=scheduleRealtimeActions({actors,now:4});
 assert.deepEqual(opening.actions.map(({uid,kind})=>[uid,kind]),[[1,'basic'],[2,'basic'],[9,'basic']]);
 assert.equal(opening.actions[0].startAt,4);
 assert.equal(opening.actions[1].startAt,4+1/60);
 assert.equal(opening.actions[2].startAt,4);
 assert.ok(opening.actions[0].projectileFlightSeconds>opening.actions[0].castUntil-4);

 const duringCast=scheduleRealtimeActions({actors,clocks:opening.clocks,now:4.1});
 assert.deepEqual(duringCast.actions.map(({uid,kind})=>[uid,kind]),[[2,'skill']]);
 assert.equal(duringCast.actions[0].skillId,'quick');
 assert.ok(Math.abs(duringCast.clocks['2'].castUntil-4.2)<1e-12);
 assert.ok(Math.abs(duringCast.clocks['2'].skillReadyAt.quick-7.1)<1e-12);
 assert.ok(duringCast.clocks['1'].castUntil>4.1);
});

test('an overdue basic is serviced between ready skills without dropping its overdue due time',()=>{
 const actor={uid:1,kind:'hero',hp:10,basicIntervalSeconds:2,basicReadyAt:1,
  skills:[{id:'a',readyAt:1,cooldownSeconds:1,castSeconds:0},{id:'b',readyAt:1,cooldownSeconds:1,castSeconds:0}]};
 const basic=scheduleRealtimeActions({actors:[actor],now:10});
 assert.deepEqual(basic.actions.map(action=>action.kind),['basic']);
 assert.equal(basic.clocks['1'].basicReadyAt,3);
 assert.ok(basic.clocks['1'].basicReadyAt<10);

 const skill=scheduleRealtimeActions({actors:[actor],clocks:basic.clocks,now:10.01});
 assert.deepEqual(skill.actions.map(action=>action.skillId),['a']);
 assert.equal(skill.clocks['1'].skillReadyAt.a,11.01);
 assert.equal(skill.clocks['1'].skillReadyAt.b,1);

 const nextBasic=scheduleRealtimeActions({actors:[actor],clocks:skill.clocks,now:10.02});
 assert.deepEqual(nextBasic.actions.map(action=>action.kind),['basic']);
});

test('a long frame starts at most one action per actor and keeps missed basic intervals due',()=>{
 const actors=[1,2].map(uid=>({uid,kind:'hero',hp:10,basicIntervalSeconds:1,basicReadyAt:1,
  skills:[{id:'repeat',readyAt:1,cooldownSeconds:1}]}));
 const first=scheduleRealtimeActions({actors,now:100});
 assert.equal(first.actions.length,2);
 assert.deepEqual(first.actions.map(action=>action.kind),['basic','basic']);
 assert.deepEqual(first.actions.map(action=>action.uid),[1,2]);
 assert.equal(first.clocks['1'].basicReadyAt,2);
 assert.equal(first.clocks['2'].basicReadyAt,2);
 assert.ok(first.clocks['1'].basicReadyAt<100);
});

test('an ineligible ready skill stays ready for a later useful target',()=>{
 const actor={uid:3,kind:'hero',hp:10,basicEligible:false,skills:[{id:'support',readyAt:0,eligible:false,cooldownSeconds:5}]};
 const result=scheduleRealtimeActions({actors:[actor],now:8});
 assert.deepEqual(result.actions,[]);
 assert.equal(result.clocks['3'].skillReadyAt.support,0);
});
