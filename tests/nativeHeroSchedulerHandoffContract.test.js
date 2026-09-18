const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(source, name) {
  const patterns = [`export function ${name}(`, `function ${name}(`];
  const start = patterns
    .map(pattern => source.indexOf(pattern))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0];
  assert.notEqual(start, undefined, `missing ${name}`);
  const paramsStart = source.indexOf('(', start);
  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    if (source[index] === '(') paramsDepth += 1;
    if (source[index] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }
  assert.notEqual(paramsEnd, -1, `unterminated params for ${name}`);
  const braceStart = source.indexOf('{', paramsEnd);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1).replace(/^export function /, 'function ');
    }
  }
  assert.fail(`unterminated ${name}`);
}

async function loadAdvanceHarness({ livingEnemy = true, currentUID = 2, actionInProgress = 0, playerBusy = 0 } = {}) {
  const source = read('web-runner/modules/functionBank.js');
  const { resolveHeroSpeedMultiattack } = await import(pathToFileURL(
    path.join(__dirname, '..', 'src', 'core', 'dynamicInitiativeRules.mjs'),
  ).href);
  const helper = extractFunctionSource(source, 'resolveCompletedHeroActionSchedulerActor');
  const advance = extractFunctionSource(source, 'AdvanceTurn');
  const context = {
    getGlobals: ctx => ctx.state.globals,
    getEnemies: ctx => ctx.state.entities.filter(actor => actor && actor.kind === 'enemy'),
    GetCurrentTurn: ctx => Number(ctx.state.globals.schedulerUID || 0),
    GetCurrentType: ctx => {
      const actor = ctx.state.entities.find(candidate => Number(candidate.uid) === Number(ctx.state.globals.schedulerUID || 0));
      return actor?.kind === 'enemy' ? 1 : 0;
    },
    GetActorByUID: (ctx, uid) => ctx.state.entities.find(actor => Number(actor.uid) === Number(uid)) || null,
    GetEffectiveStat: (_ctx, actor, stat) => Number(actor?.stats?.[stat] || 0),
    resolveHeroSpeedMultiattack,
    nativeTurnEnded: (ctx, actor) => { ctx.state.globals.nativeEndedUID = Number(actor?.uid || 0); },
    recordHeroTeamTurnProgress: () => {},
    tickEnemyGemLockCountdowns: () => {},
    ensurePowerAmpByUID: () => ({}),
    ClosePowerAmpForActor: () => {},
    isTimeInitiative: () => false,
    snapshotTurnOrderSlots: ctx => (ctx.state.globals.TurnOrderArray || []).map((slot, idx) => ({
      idx,
      uid: Number(slot.uid || 0),
      type: Number(slot.type || 0),
      spd: Number(slot.spd || 0),
      extra: !!slot.extra,
    })),
    resolvePendingEnemyDeaths: () => {},
    holdForEnemyRosterRefill: () => false,
    recordDynamicInitiativeShadowAfterAction: (ctx, uid) => {
      ctx.state.globals.shadowCompletedUID = Number(uid || 0);
      return { selectedActor: { uid: 2, type: 0 }, actionSerial: 1 };
    },
    recordDynamicInitiativeDefaultAfterAction: (ctx, uid) => {
      ctx.state.globals.defaultCompletedUID = Number(uid || 0);
      return { selectedActor: { uid: 2, type: 0 }, actionSerial: 1 };
    },
    isDynamicInitiativeAuthorityFlagEnabled: () => false,
    clearDynamicInitiativeAuthorityCurrent: () => {},
    shouldApplyDynamicInitiativeAuthorityForDefaultSelection: () => false,
    tryApplyDynamicInitiativeAuthoritySelection: () => false,
    applyDynamicInitiativeDefaultSelection: (ctx, prediction) => {
      ctx.state.globals.schedulerUID = Number(prediction.selectedActor.uid || 0);
      return true;
    },
    getDynamicInitiativeAuthorityCurrent: () => null,
    getDynamicInitiativeDefaultCurrent: g => ({ uid: Number(g.schedulerUID || 0), type: 0 }),
    shouldAutoCorrectImproperRepeat: () => false,
    selectNextInitiativeActor: () => {},
    recordDynamicInitiativeShadowSelectionComparison: () => {},
    ensureTurnSchedulerAudit: g => {
      if (!g.TurnSchedulerAudit) g.TurnSchedulerAudit = { seq: 0, events: [], lastQueueMutation: null };
      return g.TurnSchedulerAudit;
    },
    recordTurnSchedulerEvent: (ctx, kind, details) => {
      ctx.state.globals.TurnSchedulerAudit.events.push({ kind, details });
    },
  };
  vm.createContext(context);
  vm.runInContext(`${helper}\n${advance}\nthis.api = { resolveCompletedHeroActionSchedulerActor, AdvanceTurn };`, context);
  const entities = [
    { uid: 3, kind: 'hero', name: 'Runa', hp: 40, stats: { SPD: 9 } },
    { uid: 2, kind: 'hero', name: 'Hondo', hp: 40, stats: { SPD: 10 } },
    ...(livingEnemy ? [{ uid: 9, kind: 'enemy', name: 'Last Enemy', hp: 20, stats: { SPD: 5 } }] : []),
  ];
  const globals = {
    schedulerUID: Number(currentUID || 0),
    CurrentTurnIndex: 0,
    TurnOrderArray: [{ uid: 2, type: 0, spd: 10 }, { uid: 3, type: 0, spd: 9 }, { uid: 9, type: 1, spd: 5 }],
    ActionOwnerUID: 3,
    DeferAdvance: 1,
    AdvanceAfterAction: 1,
    ActionInProgress: Number(actionInProgress || 0),
    IsPlayerBusy: Number(playerBusy || 0),
    TurnSerial: 4,
    PendingDeaths: {},
  };
  const ctx = { state: { globals, entities } };
  return { ...context.api, ctx, globals };
}

test('Runa completion advances from the owner before Hondo claims the next living turn', async () => {
  const harness = await loadAdvanceHarness({ livingEnemy: true, currentUID: 2 });
  harness.AdvanceTurn(harness.ctx);

  assert.equal(harness.globals.nativeEndedUID, 3, 'the completed action ends Runa, not the already-active Hondo');
  assert.equal(harness.globals.shadowCompletedUID, 3, 'shadow cadence receives the completed owner');
  assert.equal(harness.globals.defaultCompletedUID, 3, 'default scheduler selects after the completed owner');
  assert.equal(harness.globals.schedulerUID, 2, 'Hondo remains the deterministic next actor');
});

test('owner reconciliation stays inert for terminal or enemy-current states', async () => {
  const noEnemy = await loadAdvanceHarness({ livingEnemy: false, currentUID: 2 });
  const terminal = noEnemy.resolveCompletedHeroActionSchedulerActor(noEnemy.ctx);
  assert.deepEqual({ uid: terminal.uid, type: terminal.type, reconciled: terminal.reconciled }, { uid: 2, type: 0, reconciled: false });

  const enemyCurrent = await loadAdvanceHarness({ livingEnemy: true, currentUID: 9 });
  const enemy = enemyCurrent.resolveCompletedHeroActionSchedulerActor(enemyCurrent.ctx);
  assert.deepEqual({ uid: enemy.uid, type: enemy.type, reconciled: enemy.reconciled }, { uid: 9, type: 1, reconciled: false });

  const activeAction = await loadAdvanceHarness({ livingEnemy: true, currentUID: 2, actionInProgress: 1 });
  const active = activeAction.resolveCompletedHeroActionSchedulerActor(activeAction.ctx);
  assert.deepEqual({ uid: active.uid, type: active.type, reconciled: active.reconciled }, { uid: 2, type: 0, reconciled: false });
});

test('ProcessTurn reconciles the owner mismatch before starting the next living hero', () => {
  const source = read('web-runner/modules/functionBank.js');
  const start = source.indexOf('export function ProcessTurn(ctx) {');
  const end = source.indexOf('\nfunction isBoardFullyPopulatedForEnemyMutation', start);
  assert.notEqual(start, -1, 'missing ProcessTurn');
  assert.notEqual(end, -1, 'missing ProcessTurn boundary');
  const processTurn = source.slice(start, end);
  const guardIndex = processTurn.indexOf('const completedActor = resolveCompletedHeroActionSchedulerActor(ctx);');
  const advanceIndex = processTurn.indexOf('AdvanceTurn(ctx);', guardIndex);
  const holdIndex = processTurn.indexOf('if (holdForEnemyRosterRefill(ctx)) return;', advanceIndex);
  const clearIndex = processTurn.indexOf('applyTurnGateIntent(g, createDeferredAdvanceResolved);', holdIndex);
  const missingActorIndex = processTurn.indexOf("if (!actor) { qaTrace('missing-actor-advanced'); AdvanceTurn(ctx); return; }");
  const nativeStartIndex = processTurn.indexOf('nativeTurnStarted(ctx, actor);');
  assert.ok(guardIndex >= 0, 'ProcessTurn must inspect completed action ownership');
  assert.ok(advanceIndex > guardIndex && advanceIndex < holdIndex, 'owner mismatch must advance from the completed owner');
  assert.ok(holdIndex > advanceIndex && holdIndex < clearIndex, 'roster refill hold must remain before handoff release');
  assert.ok(clearIndex > holdIndex && clearIndex < nativeStartIndex, 'handoff release must precede the next native turn');
  assert.ok(missingActorIndex > clearIndex && missingActorIndex < nativeStartIndex, 'a missing scheduled actor must advance before native turn setup');
  assert.match(processTurn, /type = GetCurrentType\(ctx\);[\s\S]*uid = GetCurrentTurn\(ctx\);[\s\S]*actor = GetActorByUID\(ctx, uid\);/);
});
