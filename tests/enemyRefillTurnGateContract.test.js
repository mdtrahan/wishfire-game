const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(src, name) {
  const patterns = [`export function ${name}(`, `function ${name}(`];
  const start = patterns
    .map((pattern) => src.indexOf(pattern))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];
  assert.notEqual(start, undefined, `missing ${name}`);
  const parenStart = src.indexOf('(', start);
  assert.notEqual(parenStart, -1, `missing params for ${name}`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = parenStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(') parenDepth += 1;
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  assert.notEqual(paramsEnd, -1, `unterminated params for ${name}`);
  const braceStart = src.indexOf('{', paramsEnd);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function lineIndex(fnSource, marker) {
  const idx = fnSource.indexOf(marker);
  assert.notEqual(idx, -1, `missing marker ${marker}`);
  return idx;
}

async function importModule(relPath) {
  return import(pathToFileURL(path.join(__dirname, '..', relPath)).href);
}

function loadSuperGemRuntime() {
  const src = read('web-runner/systems/superGemRuntime.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map, Set };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

test('enemy roster stability rejects pending, dead, mismatched, duplicate, and wrong-slot occupants', async () => {
  for (const relPath of ['src/core/enemyRosterStability.mjs', 'web-runner/src/core/enemyRosterStability.mjs']) {
    const mod = await importModule(relPath);
    const base = {
      enemySlots: [102, 203, 0],
      enemyIds: [101, 202, 0],
      pendingRespawnSlots: [0, 0, 0],
      pendingRespawnTimerActive: 0,
      entities: [
        { uid: 101, kind: 'enemy', hp: 10, isAlive: true, slotIndex: 0 },
        { uid: 202, kind: 'enemy', hp: 10, isAlive: true, slotIndex: 1 },
      ],
    };

    assert.equal(mod.getEnemyRosterStability(base).stable, true, relPath);
    assert.deepEqual(mod.getEnemyRosterStability(base).requiredSlots, [0, 1], relPath);

    assert.equal(mod.getEnemyRosterStability({
      ...base,
      pendingRespawnSlots: [0, 1, 0],
      pendingRespawnTimerActive: 1,
    }).stable, false, `${relPath} pending slot`);

    assert.deepEqual(mod.getEnemyRosterStability({
      ...base,
      enemySlots: [102, 0, 0],
      enemyIds: [101, 0, 0],
      pendingRespawnSlots: [0, 1, 0],
    }).missingSlots, [1], `${relPath} missing pending slot`);

    assert.deepEqual(mod.getEnemyRosterStability({
      ...base,
      entities: [
        { uid: 101, kind: 'enemy', hp: 10, isAlive: true, slotIndex: 0 },
        { uid: 202, kind: 'enemy', hp: 0, isAlive: false, slotIndex: 1 },
      ],
    }).deadSlots, [1], `${relPath} dead occupant`);

    const heldDeath = mod.getEnemyRosterStability({
      ...base,
      entities: [
        { uid: 101, kind: 'enemy', hp: 10, isAlive: true, slotIndex: 0 },
        { uid: 202, kind: 'enemy', hp: 0, isAlive: true, pendingOfficialDeath: 1, deathVisualHold: 1, deathState: 'pending_attack', slotIndex: 1 },
      ],
    });
    assert.equal(heldDeath.stable, true, `${relPath} pending official death remains roster-stable`);
    assert.deepEqual(heldDeath.deadSlots, [], `${relPath} pending official death is not refillable`);

    assert.deepEqual(mod.getEnemyRosterStability({
      ...base,
      enemyIds: [101, 999, 0],
    }).mismatchedSlots, [1], `${relPath} slot/id mismatch`);

    assert.deepEqual(mod.getEnemyRosterStability({
      ...base,
      enemySlots: [102, 102, 0],
      enemyIds: [101, 101, 0],
      entities: [
        { uid: 101, kind: 'enemy', hp: 10, isAlive: true, slotIndex: 0 },
      ],
    }).duplicateUIDs, [101], `${relPath} duplicate uid`);

    assert.deepEqual(mod.getEnemyRosterStability({
      ...base,
      entities: [
        { uid: 101, kind: 'enemy', hp: 10, isAlive: true, slotIndex: 0 },
        { uid: 202, kind: 'enemy', hp: 10, isAlive: true, slotIndex: 0 },
      ],
    }).mismatchedSlots, [1], `${relPath} entity slot mismatch`);
  }
});

test('enemy roster stability allows optional empty non-pending encounter slots', async () => {
  for (const relPath of ['src/core/enemyRosterStability.mjs', 'web-runner/src/core/enemyRosterStability.mjs']) {
    const mod = await importModule(relPath);
    const result = mod.getEnemyRosterStability({
      enemySlots: [102, 0, 0],
      enemyIds: [101, 0, 0],
      pendingRespawnSlots: [0, 0, 0],
      pendingRespawnTimerActive: 0,
      entities: [
        { uid: 101, kind: 'enemy', hp: 10, isAlive: true, slotIndex: 0 },
      ],
    });
    assert.equal(result.stable, true, relPath);
    assert.deepEqual(result.requiredSlots, [0], relPath);
  }
});

test('enemy roster refill hold blocks pickability without inventing deferred advance', async () => {
  for (const relPath of ['src/core/turnGateController.mjs', 'web-runner/src/core/turnGateController.mjs']) {
    const mod = await importModule(relPath);
    const plainHold = mod.createEnemyRosterRefillHold({
      CanPickGems: 1,
      IsPlayerBusy: 1,
      DeferAdvance: 0,
      AdvanceAfterAction: 0,
      ActionLockUntil: 1,
      ActionOwnerUID: 0,
      PendingSkillID: '',
      PendingActor: 0,
    }, { now: 2, currentTurnUID: 77 });

    assert.equal(plainHold.CanPickGems, 0, relPath);
    assert.equal(plainHold.DeferAdvance, 0, relPath);
    assert.equal(plainHold.AdvanceAfterAction, 0, relPath);
    assert.equal(plainHold.PendingSkillID, '', relPath);
    assert.equal(plainHold.PendingActor, 0, relPath);

    const selectionHold = mod.createEnemyRosterRefillHold({
      CanPickGems: 1,
      IsPlayerBusy: 0,
      DeferAdvance: 0,
      AdvanceAfterAction: 0,
      ActionLockUntil: 1,
      ActionOwnerUID: 0,
      ActionInProgress: 0,
      ActionActorUID: 0,
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 44,
    }, { now: 2, currentTurnUID: 77, preservePendingSkill: true });

    assert.equal(selectionHold.CanPickGems, 0, relPath);
    assert.equal(selectionHold.DeferAdvance, 0, relPath);
    assert.equal(selectionHold.PendingSkillID, 'HERO_SINGLE', relPath);
    assert.equal(selectionHold.PendingActor, 44, relPath);

    const stalePendingHold = mod.createEnemyRosterRefillHold({
      CanPickGems: 1,
      IsPlayerBusy: 1,
      DeferAdvance: 0,
      AdvanceAfterAction: 0,
      ActionLockUntil: 1,
      ActionOwnerUID: 0,
      PendingSkillID: 'HERO_AOE',
      PendingActor: 44,
    }, { now: 2, currentTurnUID: 77 });

    assert.equal(stalePendingHold.PendingSkillID, '', relPath);
    assert.equal(stalePendingHold.PendingActor, 0, relPath);

    const ownedHold = mod.createEnemyRosterRefillHold({
      CanPickGems: 1,
      IsPlayerBusy: 1,
      DeferAdvance: 1,
      AdvanceAfterAction: 1,
      ActionLockUntil: 1,
      ActionOwnerUID: 88,
      ActionInProgress: 1,
      ActionActorUID: 88,
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 44,
    }, { now: 2, currentTurnUID: 77, preservePendingSkill: true });

    assert.equal(ownedHold.CanPickGems, 0, relPath);
    assert.equal(ownedHold.DeferAdvance, 1, relPath);
    assert.equal(ownedHold.AdvanceAfterAction, 1, relPath);
    assert.equal(ownedHold.ActionOwnerUID, 88, relPath);
    assert.equal(ownedHold.PendingSkillID, '', relPath);
    assert.equal(ownedHold.PendingActor, 0, relPath);
    assert.equal(ownedHold.ActionInProgress, 0, relPath);
  }
});

test('function banks wire roster stability and gate scheduler mutation before advancing', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    assert.match(src, /getEnemyRosterStability/);
    assert.match(src, /createEnemyRosterRefillHold/);
    assert.match(src, /export function GetEnemyRosterStability/);
    assert.match(src, /function hasActiveAstralFlowKoOrbPayout\(g\)/);
    assert.match(src, /koPayoutActive: true/);
    assert.match(src, /function resolvePendingEnemyDeaths/);

    const advanceTurn = extractFunctionSource(src, 'AdvanceTurn');
    assert.ok(
      lineIndex(advanceTurn, 'resolvePendingEnemyDeaths') < lineIndex(advanceTurn, 'holdForEnemyRosterRefill'),
      `${relPath} AdvanceTurn must commit pending enemy deaths before refill hold`,
    );
    assert.ok(
      lineIndex(advanceTurn, 'holdForEnemyRosterRefill') < lineIndex(advanceTurn, 'ProcessCurrentTurn(ctx)'),
      `${relPath} AdvanceTurn must gate before ProcessCurrentTurn`,
    );

    const processCurrentTurn = extractFunctionSource(src, 'ProcessCurrentTurn');
    assert.ok(
      lineIndex(processCurrentTurn, 'holdForEnemyRosterRefill') < lineIndex(processCurrentTurn, 'g.RoundGroupIndex = Number(pointerAdvance.nextGroupIndex || 0)'),
      `${relPath} ProcessCurrentTurn must gate before group advance`,
    );

    const processTurn = extractFunctionSource(src, 'ProcessTurn');
    const guardedRecursions = processTurn.match(/AdvanceTurn\(ctx\);\s*if \(holdForEnemyRosterRefill\(ctx\)\) return;\s*ProcessTurn\(ctx\);/g) || [];
    assert.equal(guardedRecursions.length, 3, `${relPath} ProcessTurn recursion must stop when AdvanceTurn holds for refill`);

    const spawnEnemy = extractFunctionSource(src, 'SpawnEnemy');
    assert.match(spawnEnemy, /clearEnemyRespawnPendingForFilledSlot/);

    const finalizeRespawn = extractFunctionSource(src, 'finalizeEnemyRespawnWindow');
    assert.ok(
      lineIndex(finalizeRespawn, 'hasActiveAstralFlowKoOrbPayout(g)') <
        lineIndex(finalizeRespawn, 'const desiredSlots'),
      `${relPath} enemy respawn callback must not refill while KO orb payout is active`,
    );
    assert.doesNotMatch(finalizeRespawn, /g\.PendingEnemyRespawnSlots = Array\.from\(\{ length: desiredSlots \}, \(\) => 0\)/);
    assert.match(finalizeRespawn, /rescheduleEnemyRespawnWindowRetry/);
  }
});

test('app pending attack and hero pickability honor enemy roster refill gate', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /createEnemyRosterRefillHold/);
  assert.match(src, /GetEnemyRosterStability/);
  assert.match(src, /function hasPendingEnemyDeathResolution/);
  assert.match(src, /pendingEnemyDeathResolution/);

  const pendingAttackStart = src.indexOf('// Pending hero attack: click an enemy to execute');
  assert.notEqual(pendingAttackStart, -1, 'missing pending attack click block');
  const pendingAttackIdx = src.indexOf("source: 'manual-button'", pendingAttackStart);
  assert.notEqual(pendingAttackIdx, -1, 'missing pending attack shared handoff call');
  const beforePendingAttack = src.slice(pendingAttackStart, pendingAttackIdx);
  assert.match(beforePendingAttack, /const enemyRosterStability = getEnemyRosterStabilitySnapshot\(\);/);
  assert.match(beforePendingAttack, /if \(!enemyRosterStability\.stable\)/);
  assert.doesNotMatch(beforePendingAttack, /state\.globals\.PendingSkillID = '';/);

  const deferredHoldStart = src.indexOf('!deferredAdvanceState.enemyRosterStability.stable');
  assert.notEqual(deferredHoldStart, -1, 'missing deferred roster refill hold');
  const deferredHoldBlock = src.slice(deferredHoldStart, deferredHoldStart + 500);
  assert.match(deferredHoldBlock, /!deferredAdvanceState\.pendingEnemyDeathResolution/);
  assert.doesNotMatch(deferredHoldBlock, /preservePendingSkill/, 'deferred action holds must not preserve stale target selection');

  const canResolveDeferredAdvance = extractFunctionSource(src, 'canResolveDeferredAdvance');
  assert.match(canResolveDeferredAdvance, /pendingEnemyDeathResolution/);
  assert.match(canResolveDeferredAdvance, /\(rosterStability\.stable \|\| pendingEnemyDeathResolution\)/);

  const heroRestoreStart = src.indexOf('const noRefillActive = !(gameState.refillBounce && gameState.refillBounce.active);');
  assert.notEqual(heroRestoreStart, -1, 'missing hero pickability restore block');
  const heroRestoreIdx = src.indexOf('state.globals.CanPickGems = true;', heroRestoreStart);
  assert.notEqual(heroRestoreIdx, -1, 'missing hero pickability restore');
  const beforeHeroRestore = src.slice(Math.max(0, heroRestoreIdx - 900), heroRestoreIdx);
  assert.match(beforeHeroRestore, /enemyRosterStability\.stable/);
});

test('action handoff gates prevent queued damage from detached action starts', async () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const actor = { uid: 2, name: 'Huun', kind: 'hero', attackType: 'melee' };
  const enemy = { uid: 101, name: 'Troll', kind: 'enemy', hp: 50 };
  const state = {
    globals: {
      time: 12,
      goldTotal: 7,
      RuntimeRandom: () => 0.49,
    },
    entities: [actor, enemy],
  };
  const calls = [];
  const activated = activateSuperGemEffect({
    superGem: { baseColor: 3 },
    actorUID: actor.uid,
    selectedEnemyUID: enemy.uid,
    state,
    callFunctionWithContext: (_ctx, name, ...args) => {
      calls.push({ name, args });
      if (name === 'GetActorByUID') return state.entities.find((entity) => Number(entity.uid) === Number(args[0])) || null;
      if (name === 'StartHeroLunge') return 0;
      if (name === 'LogCombat') return undefined;
      return 0;
    },
    fnContext: {},
    sourceItems: [],
    consumedColorGemCount: 4,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, false);
  assert.equal(state.globals.PendingHeroHits, undefined);
  assert.equal(state.globals.DeferAdvance || 0, 0);
  assert.ok(calls.some((call) => call.name === 'StartHeroLunge'));
});

test('supergem spend refuses to start over an existing action or target selection', async () => {
  const mod = await importModule('web-runner/src/core/superGemBoardState.mjs');
  const baseGameState = () => ({
    selectedHero: 0,
    selectedGems: [{ uid: 1 }],
    selectionLocked: true,
    superGems: [
      { id: 'sg-yellow', type: 'uniform', baseColor: 3, size: 2, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }] },
    ],
    superGemCellMap: new Map([['0,0', 'sg-yellow'], ['0,1', 'sg-yellow']]),
    gems: [
      { uid: 1, cellR: 0, cellC: 0, color: 3, x: 10, y: 10 },
      { uid: 2, cellR: 0, cellC: 1, color: 3, x: 20, y: 10 },
    ],
    grid: [[1], [2]],
  });
  const callFunctionWithContext = (_ctx, name) => {
    if (name === 'GetCurrentTurn') return 2;
    if (name === 'GetActorByUID') return { uid: 2, kind: 'hero', name: 'Huun' };
    return 0;
  };
  for (const globals of [
    { PendingSkillID: 'HERO_SINGLE', PendingActor: 2 },
    { ActionInProgress: 1, ActionActorUID: 2 },
    { DeferAdvance: 1, AdvanceAfterAction: 1, ActionOwnerUID: 2 },
  ]) {
    const state = {
      globals: {
        GamePhase: 'RUNTIME',
        Player_Energy: 10,
        CanPickGems: true,
        TurnPhase: 0,
        ...globals,
      },
    };
    const gameState = baseGameState();
    let activated = 0;
    const spent = mod.spendSuperGem({
      superGem: gameState.superGems[0],
      gameState,
      state,
      reason: 'contract',
      callFunctionWithContext,
      fnContext: {},
      getHeroUIDByIndex: () => 2,
      beginTask011ActionCycle: () => {},
      startGemMergeFx: () => {},
      getGoldLabelTargetWorld: () => null,
      setGemArray: () => {},
      startRefillBounce: () => {},
      activateSuperGemEffect: () => {
        activated += 1;
        return true;
      },
      superGemCost: 4,
    });

    assert.equal(spent, false, JSON.stringify(globals));
    assert.equal(activated, 0, JSON.stringify(globals));
  }
});

test('function banks block scheduler reentry while any action is active', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    const processTurn = extractFunctionSource(src, 'ProcessTurn');
    assert.match(processTurn, /recoverStaleActionInProgress\(g, uid\);\s*if \(g\.ActionInProgress\) \{/);
    assert.match(processTurn, /logActionGateBlock\(g, '\[ACTION_GATE_BLOCK\]', \{[\s\S]*reason: 'action-in-progress'/);
    assert.match(processTurn, /if \(g\.IsPlayerBusy && g\.TurnPhase === 1\) \{[\s\S]*reason: 'busy-action-phase'/);

    const recover = extractFunctionSource(src, 'recoverStaleActionInProgress');
    assert.doesNotMatch(recover, /ownerUID !== Number\(currentUID \|\| 0\)/);
    assert.match(recover, /Number\(g\.ActionLockUntil \|\| 0\) > Number\(g\.time \|\| 0\)/);

    const startHeroLunge = extractFunctionSource(src, 'StartHeroLunge');
    assert.match(startHeroLunge, /const currentTurnUID = Number\(GetCurrentTurn\(ctx\) \|\| 0\);/);
    assert.match(startHeroLunge, /reason: 'actor-not-current-turn'/);
    assert.match(startHeroLunge, /return 0;/);
    assert.match(startHeroLunge, /return 1;/);

    const executeSkill = extractFunctionSource(src, 'ExecuteSkill');
    assert.match(executeSkill, /const lungeStarted = StartHeroLunge\(ctx, actorUID\);/);
    assert.match(executeSkill, /if \(lungeStarted === 0 \|\| lungeStarted === false\) \{/);
    assert.match(executeSkill, /logActionGateBlock\(g, '\[ACTION_HANDOFF_REFUSED\]'/);
  }
});

test('runtime action handoff diagnostics cover dev pending-selection failure points', () => {
  const appSrc = read('web-runner/app.js');
  const debugSrc = read('web-runner/systems/runtimeDebugLogging.js');
  const superGemSrc = read('web-runner/systems/superGemRuntime.js');

  assert.match(debugSrc, /\[DEV_AUTOPLAY_RESOLVE\]/);
  assert.match(debugSrc, /\[PENDING_ATTACK_RESOLVE\]/);
  assert.match(debugSrc, /\[TURNPHASE1_STUCK\]/);
  assert.match(debugSrc, /\[ACTION_HANDOFF_REFUSED\]/);
  assert.match(appSrc, /logActionHandoffDebug\('\[DEV_AUTOPLAY_RESOLVE\]'[\s\S]*stage: 'after-action-attempt-before-clear'/);
  assert.match(appSrc, /logActionHandoffDebug\('\[PENDING_ATTACK_RESOLVE\]'[\s\S]*stage: 'after-action-attempt-before-clear'/);
  assert.match(appSrc, /runtimeDebugLogging\.gemDebugLog\('\[TURNPHASE1_STUCK\]'/);
  assert.match(superGemSrc, /logActionHandoff\(state, '\[ACTION_HANDOFF_CLAIM\]'/);
  assert.match(superGemSrc, /logActionHandoff\(state, '\[PENDING_SUPERGEM_REJECT\]'/);
});

test('app deferred advance can clear stale same-owner action locks', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /createDeferredStaleActionRecovery/);
  const canResolveDeferredAdvance = extractFunctionSource(src, 'canResolveDeferredAdvance');
  assert.match(canResolveDeferredAdvance, /staleActionInProgress/);
  assert.match(canResolveDeferredAdvance, /heroActionActive/);
  assert.match(canResolveDeferredAdvance, /enemyActionActive/);
  assert.match(canResolveDeferredAdvance, /!!state\.globals\.ActionInProgress && !staleActionInProgress/);

  const tickStart = src.indexOf('let deferredAdvanceState = canResolveDeferredAdvance');
  assert.notEqual(tickStart, -1, 'missing deferred advance state check');
  const recoveryIdx = src.indexOf('createDeferredStaleActionRecovery', tickStart);
  assert.notEqual(recoveryIdx, -1, 'missing stale action recovery in deferred advance loop');
  const advanceIdx = src.indexOf("callFunctionWithContext(fnContext, 'AdvanceTurn')", tickStart);
  assert.ok(recoveryIdx < advanceIdx, 'stale action recovery must run before AdvanceTurn');
});

test('app preserves owned deferred advance when AdvanceTurn is held for enemy refill', () => {
  const src = read('web-runner/app.js');
  const tickStart = src.indexOf('let deferredAdvanceState = canResolveDeferredAdvance');
  assert.notEqual(tickStart, -1, 'missing deferred advance state check');
  const okBranch = src.slice(tickStart, src.indexOf("} else if (!deferredAdvanceState.ownerOk)", tickStart));
  assert.match(okBranch, /const beforeAdvanceUID = deferredAdvanceState\.currentUID;/);
  assert.match(okBranch, /callFunctionWithContext\(fnContext, 'AdvanceTurn'\);/);
  assert.match(okBranch, /const postAdvanceRosterStability = getEnemyRosterStabilitySnapshot\(\);/);
  assert.match(okBranch, /const rosterHoldKeptDeferredAdvance = \(/);
  const advanceIdx = okBranch.indexOf("callFunctionWithContext(fnContext, 'AdvanceTurn')");
  const clearIdx = okBranch.indexOf('applyTurnGateIntent(createDeferredAdvanceResolved)');
  assert.ok(advanceIdx < clearIdx, 'deferred advance must clear only after AdvanceTurn succeeds');
  assert.match(okBranch, /if \(!rosterHoldKeptDeferredAdvance\) \{[\s\S]*combatRuntimeGateway\.runCombatStep\(fnContext, 'ProcessTurn'\);/);
  assert.match(okBranch, /\[TURN_DEFER_PRESERVED\]/);
});
