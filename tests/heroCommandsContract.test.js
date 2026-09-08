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
  const hero = { uid: 1, kind: 'hero', hp: 10 }, enemy = { uid: 9, kind: 'enemy', hp: 10 };
  const g = { GamePhase: 'RUNTIME', time: 5, TurnPhase: 0, AstralFlowAmpPoints: 4 };
  let calls = 0;
  const ctx = { state: { globals: g, entities: [hero, enemy] }, callFunction(name, skill, actorUID) {
    if (name === 'GetCurrentTurn') return 1;
    if (name === 'GetEnemyRosterStability') return { stable: !g.EnemyRosterRefillPending };
    assert.equal(name, 'ExecuteSkill'); assert.equal(skill, 'HERO_SINGLE'); assert.equal(actorUID, 1);
    assert.equal(g.SelectedEnemyUID, 9); assert.equal(g.SelectedEnemyUIDOwner, 1);
    calls++; g.HeroAction = { active: true }; g.ActionActorUID = 1; g.ActionInProgress = 1;
  } };
  const command = { actorUID: 1, targetUID: 9 };
  for (const invalid of [{ actorUID: 2 }, { targetUID: 8 }, { skillId: 'UNKNOWN' }]) {
    assert.equal(executeHeroCommand(ctx, { ...command, ...invalid }), false);
    assert.equal(calls, 0); assert.equal(g.PendingSkillID, undefined);
  }
  for (const [key, value] of Object.entries({ BattleStartActive: 1, IsPlayerBusy: 1, SkillDraughtOpen: 1, DeferAdvance: 1, ActionLockUntil: 6, PendingHeroHits: [{}], EnemyRosterRefillPending: 1 })) {
    g[key] = value; assert.equal(canUseHeroCommand(ctx, 1), false, key); delete g[key];
  }
  hero.hp = 0; assert.equal(executeHeroCommand(ctx, command), false); hero.hp = 10;
  enemy.hp = 0; assert.equal(executeHeroCommand(ctx, command), false); enemy.hp = 10;
  assert.equal(executeHeroCommand(ctx, command), true);
  assert.equal(executeHeroCommand(ctx, command), false);
  assert.equal(calls, 1); assert.equal(g.AstralFlowAmpPoints, 4); assert.equal(g.PendingSkillID, '');
});

test('a refused animation handoff restores combat intent', async () => {
  const { executeHeroCommand } = await import('../web-runner/modules/heroCommands.mjs');
  const g = { GamePhase: 'RUNTIME', TurnPhase: 0, SelectedEnemyUID: 0 };
  const ctx = { state: { globals: g, entities: [{ kind: 'hero', uid: 1, hp: 1 }, { kind: 'enemy', uid: 2, hp: 1 }] }, callFunction(name) { if (name === 'GetCurrentTurn') return 1; if (name === 'GetEnemyRosterStability') return { stable: true }; } };
  assert.equal(executeHeroCommand(ctx, { actorUID: 1, targetUID: 2 }), false);
  assert.equal(g.SelectedEnemyUID, 0); assert.equal(g.PendingSkillID, undefined); assert.equal(g.PendingActor, undefined);
});

test('Astral Flow has rounded member-count notches ordered by SPEED, retaining KO meaning', async () => {
  const { renderAstralFlowMeter } = await import('../web-runner/systems/renderAstralFlowMeter.mjs');
  for (let count = 1; count <= 6; count++) {
    const images = {}, draws = [];
    const entities = Array.from({length:count}, (_,slot) => {
      images[slot] = {naturalWidth:40,naturalHeight:40,id:slot};
      return {kind:'hero',heroDisplaySlot:slot,name:String(slot),stats:{SPD:slot},hp:slot};
    });
    const ctx = {save(){},restore(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},clip(){},stroke(){},drawImage(...args){draws.push(args);} };
    const bar = renderAstralFlowMeter(ctx, {state:{entities,globals:{AstralFlowAmpMax:18,AstralFlowAmpPoints:9}},
      worldToCanvas:(x,y)=>({x,y}), layoutScale:1, heroPortraitImages:images});
    assert.equal(draws.length,count); assert.equal(bar.h,8);
    draws.forEach((draw,index) => {
      assert.equal(draw[0].id,count-index-1);
      assert.ok(Math.abs(draw[5]+5-(bar.x+bar.w*(index+1 === count ? 100 : Math.floor(100/count)*(index+1))/100))<1e-9);
    });
  }
});

test('six-hero AF tiers permit four participants at 64 percent and reserve 100 for the full group', async () => {
  const { getAstralFlowTierPercent } = await import('../web-runner/modules/heroCommands.mjs');
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => getAstralFlowTierPercent(6, i + 1)), [16, 32, 48, 64, 80, 100]);
  assert.equal(64 - getAstralFlowTierPercent(6, 4), 0);
  assert.equal(64 - getAstralFlowTierPercent(4, 2), 14);
  for (let count = 1; count <= 6; count++) assert.equal(getAstralFlowTierPercent(count, count), 100);
  for (const [count, tier] of [[0, 1], [7, 1], [4, 5], [4, 0], [4, 1.5]]) assert.equal(getAstralFlowTierPercent(count, tier), null);
});
