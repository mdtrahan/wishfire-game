const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const modulePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');

function loadModule() {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = { ExecuteAstralFlowSpecial, ProcessAstralFlowDestinyRegen, ApplyDamageToTarget, resolvePendingEnemyDeaths, CommitPendingEnemyDeaths };`;
  const { computeCombatPower: canonicalCombatPower } = require('../web-runner/src/core/combatPower.mjs');
  const { getEnemyRosterStability } = require('../web-runner/src/core/enemyRosterStability.mjs');
  const context = { ...require('../web-runner/modules/heroCommands.mjs'), ...require('../web-runner/src/core/flowOrbs.mjs'), ...require('../web-runner/src/core/turnGateController.mjs'), canonicalCombatPower, getEnemyRosterStability, EMPTY: 'EMPTY', setTimeout: () => 0, clearTimeout() {}, console: { log() {}, warn() {}, error() {} }, Math, module: { exports: {} }, exports: {}, state: { globals: {}, entities: [] }, effectiveStat: () => 10 };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext() {
  const heroes = [
    { uid: 1, kind: 'hero', name: 'Fara', heroDisplaySlot: 0, hp: 10, maxHP: 100, x: 1, y: 1 },
    { uid: 2, kind: 'hero', name: 'Hondo', heroDisplaySlot: 1, hp: 20, maxHP: 80, x: 2, y: 2 },
    { uid: 3, kind: 'hero', name: 'Runa', heroDisplaySlot: 2, hp: 0, maxHP: 70, x: 3, y: 3 },
    { uid: 4, kind: 'hero', name: 'Kaja', heroDisplaySlot: 3, hp: 30, maxHP: 50, x: 4, y: 4 },
  ];
  const globals = { time: 1, CombatSessionId: 1, RuntimeRandom: () => 0, LootDropRateBps: 0, TurnSerial: 10, CombatLog: [], CombatActionLines: ['', '', '', ''], DamageTexts: [], FlowOrbs: [] };
  const enemies = [
    { uid: 11, kind: 'enemy', name: 'Ghoul A', hp: 80, maxHP: 80, x: 8, y: 2 },
    { uid: 12, kind: 'enemy', name: 'Ghoul B', hp: 80, maxHP: 80, x: 9, y: 3 },
  ];
  const state = { globals, entities: [...heroes, ...enemies] };
  return { state, callFunction(name, ...args) { if (name === 'SpawnDamageText') globals.DamageTexts.push({ amount: args[0], x: args[1], y: args[2], kind: args[3], targetKind: args[4] }); } };
}

function resolveQueuedChainHits(mod, ctx) {
  const hits = [...(ctx.state.globals.PendingHeroHits || [])].sort((a, b) => a.at - b.at);
  for (const hit of hits) {
    ctx.state.globals.time = hit.at;
    mod.ApplyDamageToTarget(ctx, hit.targetUID, hit.finalDmg, { sourceUID: hit.sourceUID, damageTextNotBefore: hit.damageTextNotBefore });
  }
  ctx.state.globals.PendingHeroHits = [];
  return hits;
}

test('Magic Fruit divides a 30-percent caster-Max-HP pool among living heroes in roster order', () => {
  const mod = loadModule();
  const ctx = makeContext();
  const result = mod.ExecuteAstralFlowSpecial(ctx, 'magic_fruit', 1);
  assert.equal(result.ok, true);
  assert.equal(result.pool, 30);
  assert.deepEqual(JSON.parse(JSON.stringify(result.heals.map(row => [row.heroUID, row.requested]))), [[1, 10], [2, 10], [4, 10]]);
  assert.deepEqual(ctx.state.entities.filter(actor => actor.kind === 'hero').map(hero => hero.hp), [20, 30, 0, 40]);
  assert.deepEqual(ctx.state.globals.DamageTexts.map(text => [text.targetUID, text.amount, text.kind]), [[1, 10, 'heal'], [2, 10, 'heal'], [4, 10, 'heal']]);
  assert.equal(ctx.state.globals.ActionLockUntil, 3.83, 'Magic Fruit owns the action through its bloom, then its heal number');
  assert.equal(ctx.state.globals.ActionOwnerUID, 1);
});

test('Destiny gives each living hero three personal-turn 8-percent Max-HP ticks and survives Kaja defeat', () => {
  const mod = loadModule();
  const ctx = makeContext();
  const activation = mod.ExecuteAstralFlowSpecial(ctx, 'destiny', 4);
  assert.equal(activation.ok, true);
  assert.deepEqual(Object.keys(ctx.state.globals.AstralFlowDestinyRegensByUID).sort(), ['1', '2', '4']);
  ctx.state.entities[3].hp = 0;
  for (let turn = 11; turn <= 13; turn += 1) {
    ctx.state.globals.TurnSerial = turn;
    assert.equal(mod.ProcessAstralFlowDestinyRegen(ctx, 1), true);
  }
  assert.equal(ctx.state.entities[0].hp, 34);
  assert.equal(ctx.state.globals.AstralFlowDestinyRegensByUID['1'], undefined);
  assert.equal(ctx.state.globals.AstralFlowDestinyRegensByUID['2'].remainingTicks, 3);
});

test('special runtime maps the four signature ids and keeps the retired Destiny hit proc out of this path', () => {
  for (const sourcePath of [modulePath, path.join(__dirname, '..', 'Scripts', 'functionBank.js')]) {
    const src = fs.readFileSync(sourcePath, 'utf8');
    assert.match(src, /export function ExecuteAstralFlowSpecial/);
    assert.match(src, /id === 'crimson_ward'/);
    assert.match(src, /id === 'split'/);
    assert.match(src, /id === 'arcane_pulse'/);
    assert.match(src, /id === 'destiny'/);
    assert.match(src, /remainingTicks: 3, healPct: 0\.08/);
    assert.doesNotMatch(src, /ExecuteAstralFlowSpecial[\s\S]{0,5000}TryPartyDestiny/);
    assert.match(src, /resolveArcanePulseHeroBaseSource/);
  }
  const renderSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(renderSrc, /restBaseByUID\[hero\.uid\] = \{ x: baseX, y: yWorld \+ hWorld \/ 2 \}/);
  assert.match(renderSrc, /presentationPatches\.HeroRestBasePosByUID = restBaseByUID/);
});

test('each non-healing AF special queues its existing AoE or targeted effect with one-use ownership', () => {
  const mod = loadModule();
  for (const [specialId, actorUID] of [['crimson_ward', 1], ['split', 2], ['arcane_pulse', 3], ['chain_strike_ii', 2], ['faze', 1]]) {
    const ctx = makeContext();
    ctx.state.globals.HeroRestBasePosByUID = { 3: { x: 44, y: 156 } };
    ctx.state.entities.find(actor => actor.uid === 3).hp = 30;
    const result = mod.ExecuteAstralFlowSpecial(ctx, specialId, actorUID);
    assert.equal(result.ok, true, specialId);
    assert.equal(ctx.state.globals.LastAstralFlowSpecial.id, specialId);
    assert.equal(ctx.state.globals.LastAstralFlowSpecial.actorUID, actorUID);
    if (specialId === 'crimson_ward') assert.ok(Number(ctx.state.globals.PartyTempHPShield || 0) > 0);
    if (specialId === 'split') assert.equal(ctx.state.globals.PendingHeroHits.filter(hit => hit.actionName === 'Split').length, 2);
    if (specialId === 'arcane_pulse') {
      assert.equal(ctx.state.globals.PendingHeroHits.filter(hit => hit.effectType === 'arcane_pulse').length, 1);
      assert.equal(ctx.state.globals.ArcanePulseVisuals[0].sourceX, 44);
      assert.equal(ctx.state.globals.ArcanePulseVisuals[0].sourceY, 156);
      assert.equal(ctx.state.globals.ArcanePulseVisuals[0].startAt, 1.38);
    }
    if (specialId === 'chain_strike_ii') {
      const telemetry=ctx.state.globals.LastAstralFlowChainStrikeII;
      const hits = ctx.state.globals.PendingHeroHits.filter(hit => hit.actionName === 'Chain Strike II');
      assert.equal(telemetry.primary, null);
      assert.equal(hits.length, 2);
      assert.equal(ctx.state.globals.ChainStrikeVisuals.length, 2);
      assert.equal(ctx.state.globals.ChainStrikeVisuals[0].sourceTargetUID, actorUID);
      assert.deepEqual(ctx.state.globals.ChainStrikeVisuals.map(visual => visual.targetUID), hits.map(hit => hit.targetUID));
      assert.ok(ctx.state.globals.ChainStrikeVisuals[1].startAt > ctx.state.globals.ChainStrikeVisuals[0].impactAt);
      assert.equal(ctx.state.globals.ActionOwnerUID, actorUID);
      assert.equal(ctx.state.globals.HeroAction.uid, actorUID);
    }
    if (specialId === 'faze') assert.equal(ctx.state.globals.TaintedGroundZones.length, 2);
  }
});

test('Chain Strike II schedules the actor-owned 396-percent payload in target order and retargets a dead selection', () => {
  const mod=loadModule();const ctx=makeContext();ctx.state.entities.filter(actor=>actor.kind==='enemy').forEach(actor=>{actor.hp=5000;actor.maxHP=5000;});ctx.state.globals.SelectedEnemyUID=11;
  const result=mod.ExecuteAstralFlowSpecial(ctx,'chain_strike_ii',2);assert.equal(result.ok,true);
  assert.equal(ctx.state.entities.find(actor=>actor.uid===11).hp,5000,'damage waits for the scheduled impact');
  const scheduled=resolveQueuedChainHits(mod,ctx);assert.equal(scheduled[0].targetUID,11);assert.equal(scheduled[0].chainStrikeDamagePct,396);
  assert.equal(ctx.state.globals.DamageTexts[0].notBefore, scheduled[0].damageTextNotBefore);
  assert.ok(ctx.state.globals.DamageTexts[0].notBefore < scheduled[1].at, 'each target number starts before the next target impact');
  const primary=ctx.state.globals.LastAstralFlowChainStrikeII.primary;assert.equal(primary.targetUID,11);assert.equal(primary.coefficient,396);assert.ok(primary.damage>0);assert.equal(primary.preHP,5000);assert.equal(primary.postHP,5000-primary.damage);
  const rerunCtx=makeContext();rerunCtx.state.entities.find(actor=>actor.uid===11).hp=0;rerunCtx.state.globals.SelectedEnemyUID=11;const rerun=mod.ExecuteAstralFlowSpecial(rerunCtx,'chain_strike_ii',2);assert.equal(rerun.ok,true);assert.equal(rerun.targetUID,12);assert.equal(rerunCtx.state.globals.PendingHeroHits[0].targetUID,12);
});

test('Chain Strike II defers each new KO until owner AF reset, emits one canonical gem per kill, and dedupes cleanup', async () => {
  const { beginFreshSessionBuffQueue, chooseSessionLevelUpBuff, claimSessionBuffQueueResume, getSessionLevelUpBuffPresentation, reconcileSessionFlowThresholds } = await import('../web-runner/modules/sessionLevelUpBuffPresentation.mjs');
  const { recordFlowThreshold } = await import('../web-runner/src/core/personalFlow.mjs');
  const { advanceFlowOrbs } = await import('../web-runner/src/core/flowOrbs.mjs');
  const { FLOW_ORB_TUNING } = await import('../web-runner/src/core/heroDefinitions.mjs');
  const mod = loadModule();
  const ctx = makeContext();
  const kaja = ctx.state.entities.find(actor => actor.uid === 4);
  const heroes = ctx.state.entities.filter(actor => actor.kind === 'hero');
  for (const hero of heroes) hero.flowEligible = hero.uid === 4;
  const thirdEnemy = { uid: 13, kind: 'enemy', name: 'Ghoul C', hp: 1, maxHP: 1, x: 10, y: 4 };
  ctx.state.entities.push(thirdEnemy);
  for (const enemy of ctx.state.entities.filter(actor => actor.kind === 'enemy')) { enemy.hp = 1; enemy.maxHP = 1; }
  ctx.state.globals.SelectedEnemyUID = 11;
  beginFreshSessionBuffQueue(ctx.state.globals, heroes);
  let offer = getSessionLevelUpBuffPresentation(ctx.state.globals, heroes);
  assert.equal(chooseSessionLevelUpBuff(ctx.state.globals, heroes, offer.cards[0].cardId).status, 'applied');
  claimSessionBuffQueueResume(ctx.state.globals);
  ctx.state.globals.QaPreferredAstralFlowSpecialId = 'chain_strike_ii';
  kaja.flow = 100;
  recordFlowThreshold(ctx.state.globals, kaja, 99, 100);
  reconcileSessionFlowThresholds(ctx.state.globals, heroes);
  offer = getSessionLevelUpBuffPresentation(ctx.state.globals, heroes);
  const chain = offer.cards.find(card => card.specialId === 'chain_strike_ii');
  const selected = chooseSessionLevelUpBuff(ctx.state.globals, heroes, chain.cardId, 1, () => {
    const execution = mod.ExecuteAstralFlowSpecial(ctx, 'chain_strike_ii', 4);
    assert.equal(ctx.state.globals.FlowOrbs.length, 0);
    assert.equal(ctx.state.globals.PendingHeroHits.filter(hit => hit.actionName === 'Chain Strike II').length, 3);
    return execution;
  });
  assert.equal(selected.status, 'applied');
  assert.equal(kaja.flow, 0);
  assert.equal(selected.execution.presentationReleaseAt > 1, true);
  resolveQueuedChainHits(mod, ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.state.globals.LastAstralFlowChainStrikeII.hits.map(hit => [hit.preHP, hit.postHP]))), [[1, 0], [1, 0], [1, 0]]);
  assert.equal(ctx.state.globals.FlowOrbs.length, 3);
  assert.deepEqual(ctx.state.globals.FlowOrbs.map(orb => orb.reason), ['enemy-death', 'enemy-death', 'enemy-death']);
  assert.equal(ctx.state.globals.FlowOrbAudit.queuedEnemyDeathCount, 3);
  assert.equal(ctx.state.entities.filter(actor => actor.kind === 'enemy').length, 3, 'defeated targets remain visible through the whole chain package');
  mod.resolvePendingEnemyDeaths(ctx);
  assert.equal(ctx.state.globals.FlowOrbs.length, 3);
  advanceFlowOrbs(ctx.state.globals, ctx.state.entities, 1 + FLOW_ORB_TUNING.releaseSeconds);
  assert.equal(kaja.flow, 0);
  assert.equal(ctx.state.globals.FlowOrbs.every(orb => orb.releasedAt == null), true, 'gems wait while Chain Strike visuals remain');
  ctx.state.globals.ChainStrikeVisuals = [];
  ctx.state.globals.CombatImpactRequests = [];
  ctx.state.globals.CombatImpactVisuals = [];
  ctx.state.globals.DamageTexts = [];
  ctx.state.globals.TextAnimating = 0;
  ctx.state.globals.TextAnimEndAt = 0;
  ctx.state.globals.HeroAction = null;
  ctx.state.globals.EnemyAction = null;
  const releasedAt = 2;
  advanceFlowOrbs(ctx.state.globals, ctx.state.entities, releasedAt);
  advanceFlowOrbs(ctx.state.globals, ctx.state.entities, releasedAt + FLOW_ORB_TUNING.releaseSeconds + FLOW_ORB_TUNING.flightSeconds + 0.001);
  assert.equal(kaja.flow, 30);
  assert.equal(ctx.state.globals.FlowOrbAudit.arrivedEnemyDeathCount, 3);
  advanceFlowOrbs(ctx.state.globals, ctx.state.entities, releasedAt + FLOW_ORB_TUNING.releaseSeconds + FLOW_ORB_TUNING.flightSeconds + FLOW_ORB_TUNING.collectFlashSeconds + 0.001);
  assert.equal(mod.CommitPendingEnemyDeaths(ctx).committedCount, 3);
  assert.equal(ctx.state.entities.filter(actor => actor.kind === 'enemy').length, 0);
  assert.equal(ctx.state.globals.DeferAdvance, 1, 'late death removal rejoins the deferred scheduler handoff');
  assert.equal(ctx.state.globals.AdvanceAfterAction, 1);
});

test('AF Chain Strike II replaces a defeated wave in the same frame after FLOW delivery', () => {
  const mod = loadModule();
  const ctx = makeContext();
  const thirdEnemy = { uid: 13, kind: 'enemy', name: 'Ghoul C', hp: 1, maxHP: 1, slotIndex: 2, x: 10, y: 4 };
  ctx.state.entities.push(thirdEnemy);
  for (const [slotIndex, enemy] of ctx.state.entities.filter(actor => actor.kind === 'enemy').entries()) {
    enemy.hp = 1;
    enemy.maxHP = 1;
    enemy.slotIndex = slotIndex;
  }
  Object.assign(ctx.state.globals, {
    NextUID: 20,
    EnemySlots: [12, 13, 14],
    EnemyIDs: [11, 12, 13],
    EnemyData: [
      { name: 'Fresh A', HP: 30, ATK: 4, DEF: 3, MAG: 2, RES: 2, SPD: 3 },
      { name: 'Fresh B', HP: 32, ATK: 5, DEF: 4, MAG: 2, RES: 3, SPD: 2 },
      { name: 'Fresh C', HP: 28, ATK: 3, DEF: 2, MAG: 4, RES: 2, SPD: 4 },
    ],
    Slots: 3,
    X0: 200,
    EnemyAreaY0: 120,
    Spacing: 48,
    InitialSpawn: 0,
    GroupResolving: 1,
    RoundActive: 1,
  });
  ctx.state.globals.SelectedEnemyUID = 11;
  assert.equal(mod.ExecuteAstralFlowSpecial(ctx, 'chain_strike_ii', 4).ok, true);
  resolveQueuedChainHits(mod, ctx);
  assert.deepEqual(Object.keys(ctx.state.globals.EnemyDeathVisualHoldByUID).map(Number), [11, 12, 13]);
  ctx.state.globals.ChainStrikeVisuals = [];
  ctx.state.globals.CombatImpactRequests = [];
  ctx.state.globals.CombatImpactVisuals = [];
  ctx.state.globals.DamageTexts = [];
  ctx.state.globals.TextAnimating = 0;
  ctx.state.globals.TextAnimEndAt = 0;
  ctx.state.globals.HeroAction = null;
  ctx.state.globals.EnemyAction = null;
  ctx.state.globals.FlowOrbs = [];
  const committed = mod.CommitPendingEnemyDeaths(ctx);
  assert.equal(committed.committedCount, 3);
  const replacements = ctx.state.entities.filter(actor => actor.kind === 'enemy');
  assert.equal(replacements.length, 3);
  assert.equal(replacements.some(enemy => [11, 12, 13].includes(enemy.uid)), false);
  assert.equal(ctx.state.globals.EnemySlots.every(Boolean), true);
  assert.equal(JSON.stringify(ctx.state.globals.PendingEnemyRespawnSlots), JSON.stringify([0, 0, 0]));
  assert.equal(ctx.state.globals.PendingEnemyRespawnTimerActive, 0);
});

test('Chain Strike II emits no death gem for nonlethal or already-dead targets', () => {
  const mod = loadModule();
  const ctx = makeContext();
  ctx.state.entities.find(actor => actor.uid === 11).hp = 5000;
  ctx.state.entities.find(actor => actor.uid === 12).hp = 0;
  ctx.state.globals.SelectedEnemyUID = 11;
  const result = mod.ExecuteAstralFlowSpecial(ctx, 'chain_strike_ii', 4);
  assert.equal(result.ok, true);
  assert.equal(ctx.state.globals.FlowOrbs.length, 0);
  resolveQueuedChainHits(mod, ctx);
  assert.equal(ctx.state.globals.FlowOrbs.length, 0);
});

test('the shared lethal transition emits one enemy-death gem once', () => {
  const mod = loadModule();
  const ctx = makeContext();
  ctx.state.entities.find(actor => actor.uid === 11).hp = 1;
  ctx.state.entities.find(actor => actor.uid === 12).hp = 0;
  assert.equal(mod.ApplyDamageToTarget(ctx, 11, 20, { sourceUID: 4 }), 1);
  assert.equal(ctx.state.globals.FlowOrbs.length, 1);
  assert.equal(ctx.state.globals.FlowOrbAudit.queuedEnemyDeathCount, 1);
  assert.equal(mod.ApplyDamageToTarget(ctx, 11, 20, { sourceUID: 4 }), 0);
  mod.resolvePendingEnemyDeaths(ctx);
  assert.equal(ctx.state.globals.FlowOrbs.length, 1);
});
