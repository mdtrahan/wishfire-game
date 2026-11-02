import test from 'node:test';
import assert from 'node:assert/strict';
import { heroBuffSignalInput } from '../web-runner/systems/heroCooldownStrip.mjs';
import { projectBuffSignals } from '../src/core/buffSignalRules.mjs';
test('ward UI reads Rust shield facts without granting or absorbing health', () => {
 const actors=[{kind:'hero',name:'Falie',heroInstanceKey:'Falie',uid:1,hp:10}];
 const g={RustCombatPresentation:{state:{snapshot:{actors:[{team:'hero',host_id:'Falie',ward:12,meter:.5}]}}}};
 const before=structuredClone({actors,g});
 assert.deepEqual(projectBuffSignals(heroBuffSignalInput(actors,g)).heroes,{1:['defense']});
 assert.deepEqual({actors,g},before);
 g.RustCombatPresentation.state.snapshot.actors[0].ward=0;
 assert.deepEqual(projectBuffSignals(heroBuffSignalInput(actors,g)).party,[]);
});
