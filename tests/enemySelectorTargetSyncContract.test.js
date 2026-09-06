const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('pending enemy selector renders an actor-owned selection', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');

  assert.match(src, /const selectedOwnerUID = Number\(state\.globals\.SelectedEnemyUIDOwner \|\| 0\);/);
  assert.match(src, /const pendingActorUID = Number\(state\.globals\.PendingActor \|\| 0\);/);
  assert.match(src, /const ownerMatchedSelectedUid = selectedOwnerUID === pendingActorUID \? selectedUid : 0;/);
  assert.match(src, /const resolvedSelectedUid = ownerMatchedSelectedUid;/);
  assert.match(src, /resolvedSelectedUid \? aliveEnemies\.filter\(e => Number\(e\.uid \|\| 0\) === resolvedSelectedUid\) : \[\]/);
});

test('normal pending attack defaults to a living enemy, allows confirmation and preserves player choice', async () => {
  const vm = require('node:vm');
  const {capturePendingEnemyTargetIntent, validatePendingEnemyTargetIntent} = await import('../src/core/pendingSuperGemHandoff.mjs');
  const src = fs.readFileSync(path.join(__dirname,'..','web-runner','app.js'),'utf8');
  const body = src.slice(src.indexOf('  function ensurePendingSingleTarget()'),src.indexOf('  function getIdleAutoplayPriorityContext()'));
  const state = {globals:{PendingSkillID:'HERO_SINGLE',PendingActor:101},entities:[
    {uid:201,kind:'enemy',hp:0},{uid:202,kind:'enemy',hp:30},{uid:203,kind:'enemy',hp:40},
  ]};
  const ensure = vm.runInNewContext(body+';ensurePendingSingleTarget',{state,capturePendingEnemyTargetIntent});
  assert.equal(ensure(),202);
  assert.equal(state.globals.SelectedEnemyUIDOwner,101);
  const validate = () => validatePendingEnemyTargetIntent({globals:state.globals,actorUID:101,getActorByUID:uid=>state.entities.find(e=>e.uid===uid)});
  assert.equal(validate().ok,true);
  capturePendingEnemyTargetIntent({globals:state.globals,actorUID:101,target:state.entities[2]});
  assert.equal(ensure(),203);
  state.entities[2].hp=0;
  assert.equal(ensure(),202);
  assert.equal(validate().ok,true);
  state.globals.PendingSkillID='HERO_AOE';
  assert.equal(ensure(),0);
});
