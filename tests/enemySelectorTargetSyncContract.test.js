const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('battlefield selector persists independently of the command actor', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(src, /const resolvedSelectedUid = selectedUid;/);
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

 test('enemy target triangle renders for hero-card pending targets without clearing selection',()=>{
  const vm=require('node:vm');
  const src=fs.readFileSync(path.join(__dirname,'..','web-runner','systems','renderRuntime.js'),'utf8');
  assert.match(src, /heroCardFanPendingEnemy/);
  const guard=src.match(/(if \(Number\(state\.globals\.TurnPhase\).*?heroCardFanPendingEnemy\)\) \{)/)[1];
  const state={globals:{TurnPhase:0,SelectedEnemyUID:203,NativeBattleEnded:false}};
  const visible=()=>!!vm.runInNewContext(`(() => { const heroCardFanPendingEnemy = Number(state.globals.HeroTurnCardFanPendingTarget || 0) === 1 && String(state.globals.HeroTurnCardFanPendingTargetKind || '') === 'enemy'; ${guard} return true; } return false; })()`,{state});
  assert.equal(visible(),true);
  state.globals.TurnPhase=1;assert.equal(visible(),false);assert.equal(state.globals.SelectedEnemyUID,203);
  state.globals.TurnPhase=0;assert.equal(visible(),true);
  state.globals.NativeBattleEnded=true;assert.equal(visible(),false);
  state.globals.NativeBattleEnded=false;state.globals.SelectedEnemyUID=0;state.globals.HeroTurnCardFanPendingTarget=1;state.globals.HeroTurnCardFanPendingTargetKind='enemy';assert.equal(visible(),true);
 });

test('target debug geometry uses the same combat projection as enemy hit testing', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js'), 'utf8');
  const start = src.indexOf('getTargetDebugGeometry() {');
  const end = src.indexOf('    setEncounterRequest(', start);
  assert.ok(start >= 0 && end > start);
  const method = src.slice(start, end).replace(/,\s*$/, '');
  const calls = [];
  const getTargetDebugGeometry = vm.runInNewContext(`({${method}}).getTargetDebugGeometry`, {
    document: { getElementById: () => null },
    getAttackButtonBounds: () => null,
    worldToCanvas: (x, y) => ({x: x + 100, y: y + 100}),
    combatActorWorldToCanvas: (x, y, kind) => {
      calls.push({x, y, kind});
      return {x: x + 200, y: y + 300};
    },
    state: {
      globals: {EnemySize: 40},
      entities: [{uid: 203, kind: 'enemy', hp: 25, x: 17, y: 29, slotIndex: 2}],
    },
  });
  const geometry = getTargetDebugGeometry();
  assert.deepEqual(JSON.parse(JSON.stringify(geometry.enemies)), [{uid: 203, name: '', slotIndex: 2, x: 217, y: 329, enemySize: 40}]);
  assert.deepEqual(calls, [{x: 17, y: 29, kind: 'enemy'}]);
});
