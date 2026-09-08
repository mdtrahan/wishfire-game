const test = require('node:test');
const assert = require('node:assert/strict');

test('one through six actual heroes retain their command positions, including KO and empty capacity', async () => {
  const { getHeroCommandSlots } = await import('../web-runner/modules/heroCommands.mjs');
  for (let count = 1; count <= 6; count++) {
    const heroes = Array.from({ length: count }, (_, slot) => ({ kind: 'hero', uid: slot + 1, heroDisplaySlot: slot, hp: slot ? 1 : 0 }));
    assert.deepEqual(getHeroCommandSlots([...heroes].reverse()), [...heroes, ...Array(6 - count).fill(null)]);
  }
  const hero = { kind: 'hero', uid: 3, heroDisplaySlot: 3, hp: 0 };
  assert.deepEqual(getHeroCommandSlots([hero, { kind: 'escort' }]), [null, null, null, hero, null, null]);
});

test('native attack commits once for the scheduled living actor and never spends on a rejected command', async () => {
  const { executeHeroCommand, canUseHeroCommand } = await import('../web-runner/modules/heroCommands.mjs');
  const hero = { uid: 1, name:'Huun', sp:100, spMax:100, kind: 'hero', hp: 10 }, enemy = { uid: 9, kind: 'enemy', hp: 10 };
  const g = { GamePhase: 'RUNTIME', time: 5, TurnPhase: 0, SkillDraughtOpen: 1, SkillDraughtPendingOpen: 1 };
  let calls = 0;
  const ctx = { state: { globals: g, entities: [hero, enemy] }, callFunction(name, skill, actorUID) {
    if (name === 'GetCurrentTurn') return 1;
    if (name === 'GetEnemyRosterStability') return { stable: !g.EnemyRosterRefillPending };
    assert.equal(name, 'StartHeroLunge'); assert.equal(skill, 1);
    calls++; g.HeroAction = {active:true}; g.ActionActorUID=1; g.ActionInProgress=1; return 1;
  } };
  const command = { actorUID: 1, targetUID: 9 };
  for (const invalid of [{ actorUID: 2 }, { targetUID: 8 }, { queue:[{skillId:'UNKNOWN',targetIds:[9]}] }]) {
    assert.equal(executeHeroCommand(ctx, { ...command, ...invalid }), false);
    assert.equal(calls, 0); assert.equal(g.PendingSkillID, undefined);
  }
  for (const [key, value] of Object.entries({ BattleStartActive: 1, IsPlayerBusy: 1, DeferAdvance: 1, ActionLockUntil: 6, PendingHeroHits: [{}], EnemyRosterRefillPending: 1 })) {
    g[key] = value; assert.equal(canUseHeroCommand(ctx, 1), false, key); delete g[key];
  }
  hero.hp = 0; assert.equal(executeHeroCommand(ctx, command), false); hero.hp = 10;
  enemy.hp = 0; assert.equal(executeHeroCommand(ctx, command), false); enemy.hp = 10;
  assert.equal(executeHeroCommand(ctx, command), true);
  assert.equal(executeHeroCommand(ctx, command), false);
  assert.equal(calls, 1); assert.equal(hero.sp, 100);
});

test('a refused animation handoff restores combat intent', async () => {
  const { executeHeroCommand } = await import('../web-runner/modules/heroCommands.mjs');
  const g = { GamePhase: 'RUNTIME', TurnPhase: 0, SelectedEnemyUID: 0 };
  const ctx = { state: { globals: g, entities: [{ kind: 'hero', uid: 1, hp: 1 }, { kind: 'enemy', uid: 2, hp: 1 }] }, callFunction(name) { if (name === 'GetCurrentTurn') return 1; if (name === 'GetEnemyRosterStability') return { stable: true }; } };
  assert.equal(executeHeroCommand(ctx, { actorUID: 1, targetUID: 2 }), false);
  assert.equal(g.SelectedEnemyUID, 0); assert.equal(g.PendingSkillID, undefined); assert.equal(g.PendingActor, undefined);
});


test('native queued render events dispatch once while unrelated damage stays queued', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require('node:path').join(__dirname, '../web-runner/systems/renderRuntime.js'), 'utf8');
  const start = source.indexOf('    const body = [');
  const end = source.indexOf('    renderImpl = new Function', start);
  const body = vm.runInNewContext('(function(){' + source.slice(start, end) + ';return body;})()');
  assert.doesNotThrow(() => new Function('scope', 'dtOverride', 'with(scope){' + body + '\n}'));
  assert.doesNotMatch(body, /renderAstralFlowMeter/);
  const branchStart = body.indexOf("        if (hit.effectType === 'native_command') {");
  const branchEnd = body.indexOf("        if (hit.effectType === 'dot_apply') {", branchStart);
  assert.ok(branchStart >= 0 && branchEnd > branchStart);
  const pending = [{ effectType: 'native_command', heroUID: 1 }, { effectType: 'damage', heroUID: 2 }];
  const calls = [];
  const run = new Function('pending', 'callFunctionWithContext', 'fnContext',
    'for(let i=pending.length-1;i>=0;i--){const hit=pending[i];' + body.slice(branchStart, branchEnd) + '}');
  run(pending, (...args) => calls.push(args), {});
  run(pending, (...args) => calls.push(args), {});
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'ResolveNativeCommandStep');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].effectType, 'damage');
});

test('retired blue supergems cannot acquire party cards or consume an action', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require('node:path').join(__dirname, '../web-runner/systems/superGemRuntime.js'), 'utf8')
    .replaceAll('export function', 'function').replace(/export \{[^}]+\};/g, '');
  const activate = vm.runInNewContext(source + ';activateSuperGemEffect');
  const state = { globals: {} };
  assert.equal(activate({state, superGem:{baseColor:2}, actorUID:1,
    callFunctionWithContext() { throw Error('retired draw invoked'); }}), false);
  assert.deepEqual(state, {globals:{}});
});
