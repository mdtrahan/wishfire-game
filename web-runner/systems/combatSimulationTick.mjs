import {
  combatVfxProfileForActor as defaultCombatVfxProfileForActor,
  queueCombatAttackImpactVfx as defaultQueueCombatAttackImpactVfx,
} from './combatAttackVfxPresentation.mjs';
import { isActorTargetInRange } from '../../src/core/heroAttackTargetingRules.mjs';

export function processPendingHeroHits({
  state,
  fnContext,
  callFunctionWithContext,
  animationMath,
  queueImpactVfx = defaultQueueCombatAttackImpactVfx,
  isHeroBasicTargetInRange = (entity, source) => isActorTargetInRange(source, entity),
}) {
  const visualControlPatches = {};
// Apply delayed hero hits after lunge/impact timing
    if (state.globals.PendingHeroHits && state.globals.PendingHeroHits.length) {
      const now = state.globals.time || 0;
      const pending = state.globals.PendingHeroHits;
      visualControlPatches.DoubleAttackLungeStarted = state.globals.DoubleAttackLungeStarted || {};
      const doubleAttackBatchAnchors = state.globals.DoubleAttackBatchAnchors || (visualControlPatches.DoubleAttackBatchAnchors = {});
      for (let i = pending.length - 1; i >= 0; i--) {
        const hit = pending[i];
        if (!hit) { pending.splice(i, 1); continue; }
        const followUpBatchId = Number(hit.followUpBatchId || 0);
        if (followUpBatchId > 0 && hit.followUpAwaitTextClear) {
          if (state.globals.TextAnimating || (state.globals.HeroAction && state.globals.HeroAction.active)) continue;
          if (!state.globals.DoubleAttackLungeStarted[followUpBatchId]) {
            const followUpLead = animationMath.LUNGE_ANTICIPATION_SEC + animationMath.LUNGE_FORWARD_SEC + animationMath.LUNGE_IMPACT_HANDOFF_SEC;
            const anchorAt = now + followUpLead;
            for (const queued of pending) {
              if (!queued) continue;
              if (Number(queued.followUpBatchId || 0) !== followUpBatchId) continue;
              queued.at = anchorAt + Number(queued.followUpOffset || 0);
              delete queued.followUpAwaitTextClear;
            }
            doubleAttackBatchAnchors[followUpBatchId] = anchorAt;
            callFunctionWithContext(fnContext, 'StartHeroLunge', hit.heroUID);
            state.globals.DoubleAttackLungeStarted[followUpBatchId] = 1;
          }
        }
        if (!hit || now < (hit.at || 0)) continue;
        if (followUpBatchId > 0 && state.globals.TextAnimating) continue;
        if (followUpBatchId > 0 && state.globals.HeroAction && state.globals.HeroAction.active && !state.globals.DoubleAttackLungeStarted[followUpBatchId]) {
          continue;
        }
        if (hit.effectType === 'native_command') {
          const impactTargets = hit.attackVfxKind ? (Array.isArray(hit.attackVfxTargetUIDs) ? hit.attackVfxTargetUIDs : [hit.targetUID])
            .map(uid => callFunctionWithContext(fnContext, 'GetActorByUID', uid))
            .filter(Boolean) : [];
          const resolved = callFunctionWithContext(fnContext, 'ResolveNativeCommandStep', hit);
          if (resolved) hit.projectileLanded = 1;
          if (resolved) for (const target of impactTargets) queueImpactVfx(state, hit, target, now);
          pending.splice(i, 1);
          continue;
        }
        if (hit.effectType === 'dot_apply') {
          const totalTicks = 3;
          const totalDotDamage = Math.max(1, Math.floor(Number(hit.dotTotalDamage || 0) || 1));
          const initialDotDamage = Math.max(1, Math.floor(totalDotDamage / totalTicks) + ((totalDotDamage % totalTicks) > 0 ? 1 : 0));
          state.globals.NextHitFlashTone = 'purple';
          state.globals.NextDamageTextKind = 'dot';
          const overTimeCrit = !!hit.didCrit || Number(hit.powerAmpMultiplier || 0) > 0;
          callFunctionWithContext(fnContext, 'ApplyDamageToTarget', hit.targetUID, initialDotDamage, {
            isCrit: overTimeCrit,
          });
          const enemyAfterApply = callFunctionWithContext(fnContext, 'GetActorByUID', hit.targetUID);
          const remainingDotDamage = Math.max(0, totalDotDamage - initialDotDamage);
          if (enemyAfterApply && Number(enemyAfterApply.hp || 0) > 0 && remainingDotDamage > 0) {
            callFunctionWithContext(fnContext, 'QueueEnemyDamageOverTime', hit.heroUID, hit.targetUID, remainingDotDamage, {
              totalTicks: totalTicks - 1,
              cadence: 'turn',
              firesEveryTurns: 1,
              startAfterTurns: 1,
              effectName: String(hit.effectName || 'Blight'),
              isCrit: overTimeCrit,
              powerAmpMultiplier: Number(hit.powerAmpMultiplier || 0),
              taintedGroundZoneId: String(hit.taintedGroundZoneId || ''),
              logMessage: String(hit.msg || ''),
            });
          }
          pending.splice(i, 1);
          continue;
        }
        let targetEntity = callFunctionWithContext(fnContext, 'GetActorByUID', hit.targetUID);
        const sourceEntity = callFunctionWithContext(fnContext, 'GetActorByUID', hit.heroUID || hit.sourceUID);
        // A committed realtime projectile retains its launch right after its
        // hero is KO. Range still uses the last authoritative foot position.
        const impactSource = hit.allowSourceKO && Number(sourceEntity?.hp || 0) <= 0
          ? { ...sourceEntity, hp: 1 }
          : sourceEntity;
        if (hit.realtimeBasic && Number(state.globals.ContinuousCombatStageLoop || 0) === 1 && !isHeroBasicTargetInRange(targetEntity, impactSource)) targetEntity = null;
        if ((!targetEntity || Number(targetEntity.hp || 0) <= 0) && hit.retargetOnDeath) {
          const livingEnemies = (state.entities || []).filter((entity) => entity && entity.kind === 'enemy' && Number(entity.hp || 0) > 0 && (Number(state.globals.ContinuousCombatStageLoop || 0) !== 1 || isHeroBasicTargetInRange(entity, impactSource)));
          const replacement = livingEnemies[0] || null;
          if (replacement) {
            const batchId = Number(hit.followUpBatchId || 0);
            if (batchId > 0) {
              for (const queued of pending) {
                if (!queued) continue;
                if (Number(queued.followUpBatchId || 0) !== batchId) continue;
                queued.targetUID = Number(replacement.uid || 0);
              }
            } else {
              hit.targetUID = Number(replacement.uid || 0);
            }
            targetEntity = replacement;
            if (hit.realtimeBasic) {
              hit.at = now + 0.52;
              continue;
            }
          }
        }
        if (!targetEntity || Number(targetEntity.hp || 0) <= 0) {
          for (let j = pending.length - 1; j >= 0; j--) {
            const queued = pending[j];
            if (!queued) continue;
            if (Number(queued.followUpBatchId || 0) > 0 && Number(hit.followUpBatchId || 0) > 0) {
              if (Number(queued.followUpBatchId || 0) !== Number(hit.followUpBatchId || 0)) continue;
            } else {
              if (Number(queued.targetUID || 0) !== Number(hit.targetUID || 0)) continue;
            }
            if (queued.effectType === 'dot_apply') continue;
            pending.splice(j, 1);
          }
          continue;
        }
        const queuedFinalDmg = Number(hit.finalDmg);
        const ampMult = Number(hit.powerAmpMultiplier || 0);
        const finalDmg = Number.isFinite(queuedFinalDmg) && queuedFinalDmg > 0
          ? Math.max(1, Math.floor(queuedFinalDmg))
          : (ampMult > 0 ? Math.max(1, Math.ceil((hit.dmg || 0) * ampMult)) : hit.dmg);
        if (state.globals.DebugPowerAmpLifecycle) {
          const heroName = hit.heroName || 'Hero';
          const heroType = hit.heroType || 'melee';
          const calcPath = hit.calcPath || (heroType === 'magic' ? 'magicCalc' : 'meleeCalc');
          console.log(
            `[POWER_AMP_DMG] hero=${hit.heroUID} name=${heroName} type=${heroType} path=${calcPath} ` +
            `base=${hit.dmg} amp=${ampMult} final=${finalDmg} active=${ampMult > 0 ? 1 : 0} consume=${hit.consumePowerAmp ? 1 : 0} lifecycle=${Number(hit.powerAmpLifecycleId || 0)}`
          );
        }
        const clusterVisualOnly = Number(hit.superGemClusterVisualOnly || 0) === 1;
        const clusterApplyTotal = Math.max(0, Number(hit.superGemClusterApplyTotalOnHit || 0));
        const targetKind = String(targetEntity.kind || 'enemy');
        const targetX = Number(targetEntity.x || 0);
        const targetY = Number(targetEntity.y || 0);
        const damageOptions = {
          sourceUID: Number(hit.sourceUID || hit.heroUID || 0),
          suppressPartySkillHitHooks: Number(hit.suppressPartySkillHitHooks || 0),
          suppressHitFlash: Number(hit.suppressHitFlash || 0),
          suppressDamageText: Number(hit.suppressDamageText || 0),
          damageTextKind: hit.damageTextKind,
        };
        let resolvedBasic = null;
        if (hit.combatRulesBasic) {
          resolvedBasic = callFunctionWithContext(fnContext, 'ResolveRealtimeHeroBasicImpact', { ...hit, finalDmg });
          const resolvedTarget = resolvedBasic?.targetUID
            ? callFunctionWithContext(fnContext, 'GetActorByUID', resolvedBasic.targetUID)
            : null;
          if (resolvedTarget) targetEntity = resolvedTarget;
        } else if (clusterVisualOnly || clusterApplyTotal > 0) {
          callFunctionWithContext(fnContext, 'SpawnDamageText', finalDmg, targetX, targetY, 'damage', targetKind);
        }
        if (!hit.combatRulesBasic && clusterVisualOnly) {
          const prevSpawnDamageText = state.globals.SpawnDamageText;
          state.globals.SpawnDamageText = 0;
          visualControlPatches.SpawnDamageText = 0;
          callFunctionWithContext(fnContext, 'ApplyDamageToTarget', hit.targetUID, 0, damageOptions);
          state.globals.SpawnDamageText = prevSpawnDamageText;
          visualControlPatches.SpawnDamageText = prevSpawnDamageText;
        } else if (!hit.combatRulesBasic && clusterApplyTotal > 0) {
          const prevSpawnDamageText = state.globals.SpawnDamageText;
          state.globals.SpawnDamageText = 0;
          visualControlPatches.SpawnDamageText = 0;
          callFunctionWithContext(fnContext, 'ApplyDamageToTarget', hit.targetUID, clusterApplyTotal, damageOptions);
          state.globals.SpawnDamageText = prevSpawnDamageText;
          visualControlPatches.SpawnDamageText = prevSpawnDamageText;
        } else if (!hit.combatRulesBasic) {
          callFunctionWithContext(fnContext, 'ApplyDamageToTarget', hit.targetUID, finalDmg, damageOptions);
        }
        hit.projectileLanded = 1;
        queueImpactVfx(state, hit, targetEntity, now);
        if (hit.msg) {
          const loggedDamage = hit.combatRulesBasic ? Math.max(0, Number(resolvedBasic?.damage || 0)) : finalDmg;
          if (ampMult > 0) {
            const msg = String(hit.msg).replace(/ for \d+!$/, ` for ${loggedDamage}!`);
            callFunctionWithContext(fnContext, 'LogCombat', msg);
          } else {
            const msg = hit.combatRulesBasic ? String(hit.msg).replace(/ for \d+!$/, ` for ${loggedDamage}!`) : hit.msg;
            callFunctionWithContext(fnContext, 'LogCombat', msg);
          }
        }
        pending.splice(i, 1);
      }
      if (pending.length === 0) {
        delete state.globals.PendingHeroHits;
        delete state.globals.DoubleAttackLungeStarted;
        delete state.globals.DoubleAttackBatchAnchors;
      }
    }
  Object.assign(state.globals, visualControlPatches);
}

export function createCombatSimulationTicker() {
  let lastNowMs = null;
  return {
    reset() { lastNowMs = null; },
    tick({
      state,
      gameState = {},
      nowMs,
      fnContext,
      callFunctionWithContext,
      animationMath,
      layoutW,
      applyTurnGateGlobals,
      applyTurnGateIntent,
      createEnemyTurnIdleRecovery,
      runCombatStep,
      getCellWorldPos,
      randomGemFrame,
      setGemArray,
      countCellCoverage,
      recordTask011RefillWriteEvent,
      createEnemyTurnGateBaseline,
      createRefillCompleteGate,
      runtimeDebugLogging,
      assertBoardIntegrity,
      getGemGateSnapshot,
      getYellowSequenceCompletionIntent,
      traceTask015YellowAnimation,
      traceTask015YellowWrite,
      YELLOW_CASINO_SETTLE_SEC,
      YELLOW_CASINO_SETTLE_BOUNCE_AMP,
      YELLOW_COLOR,
      startGemMergeFx,
      getGoldLabelTargetWorld,
      combatVfxProfileForActor = defaultCombatVfxProfileForActor,
      queueCombatAttackImpactVfx = defaultQueueCombatAttackImpactVfx,
    }) {
      if (shouldFreezeCombatSimulation(state, gameState)) {
        lastNowMs = null;
        return 0;
      }
      const current = Number(nowMs);
      const now = Number.isFinite(current) ? current : 0;
      const base = lastNowMs == null ? 0.001 : Math.min(0.05, Math.max(0.001, (now - lastNowMs) / 1000));
      lastNowMs = now;
      const dt = base * Math.max(0.25, Number(state.globals.DevCombatSpeedMultiplier || 1));
      state.globals.time = Number(state.globals.time || 0) + dt;
      const damageTexts = state.globals.DamageTexts || [];
      for (let i = damageTexts.length - 1; i >= 0; i--) {
        const text = damageTexts[i];
        if (Number(text.notBefore || 0) > state.globals.time) continue;
        text.age = Number(text.age || 0) + dt;
        text.phase = Number(text.phase || 0);
        const durations = [Math.max(0.001, Number(text.riseInSec || 0.18)), Number(text.holdSec || 0.7), Math.max(0.001, Number(text.fadeSec || 0.45))];
        while (text.phase <= 2 && text.age >= durations[text.phase]) {
          text.age -= durations[text.phase];
          text.phase += 1;
        }
        if (text.phase > 2) damageTexts.splice(i, 1);
      }
      state.globals.TextAnimating = damageTexts.length > 0 || state.globals.time < Number(state.globals.TextAnimEndAt || 0) ? 1 : 0;
      advanceBattleStartSimulation({ state, runCombatStep });
      processPendingHeroHits({ state, fnContext, callFunctionWithContext, animationMath });
      advanceEnemyActionSimulation({
        state,
        gameState,
        dt,
        layoutW,
        animationMath,
        fnContext,
        callFunctionWithContext,
        applyTurnGateGlobals,
        applyTurnGateIntent,
        createEnemyTurnIdleRecovery,
        combatVfxProfileForActor,
        queueCombatAttackImpactVfx,
      });
      advanceHeroActionSimulation({ state, gameState, dt, layoutW, animationMath, applyTurnGateGlobals });
      advanceYellowCasinoSimulation({ state, gameState, runtimeDebugLogging, traceTask015YellowAnimation, traceTask015YellowWrite, getCellWorldPos, countCellCoverage, recordTask011RefillWriteEvent, setGemArray, YELLOW_CASINO_SETTLE_SEC, YELLOW_CASINO_SETTLE_BOUNCE_AMP, YELLOW_COLOR, startGemMergeFx, getGoldLabelTargetWorld, applyTurnGateIntent, getYellowSequenceCompletionIntent, assertBoardIntegrity });
      advanceRefillBounceSimulation({
        state, gameState, getCellWorldPos, randomGemFrame, setGemArray, countCellCoverage,
        recordTask011RefillWriteEvent, createEnemyTurnGateBaseline, createRefillCompleteGate,
        applyTurnGateIntent, runtimeDebugLogging, assertBoardIntegrity, getGemGateSnapshot, runCombatStep,
      });
      advanceBuffSequenceSimulation({ state, gameState, runCombatStep });
      advanceGemMergeFxSimulation({ state, gameState, applyTurnGateIntent, getYellowSequenceCompletionIntent });
      return dt;
    },
  };
}

export function shouldFreezeCombatSimulation(state, gameState = {}) {
  const globals = state?.globals || {};
  return !!(
    globals.DevToolingPaused ||
    globals.QaScenarioPaused ||
    globals.QaFixtureHoldTurn ||
    gameState?.storyEntry?.combatPaused ||
    gameState?.storyEntry?.phase === 'defeat'
  );
}

export function advanceYellowCasinoSimulation({
  state, gameState, runtimeDebugLogging, traceTask015YellowAnimation, traceTask015YellowWrite,
  getCellWorldPos, countCellCoverage, recordTask011RefillWriteEvent, setGemArray,
  YELLOW_CASINO_SETTLE_SEC, YELLOW_CASINO_SETTLE_BOUNCE_AMP, YELLOW_COLOR,
  startGemMergeFx, getGoldLabelTargetWorld, applyTurnGateIntent, getYellowSequenceCompletionIntent,
  assertBoardIntegrity,
}) {
    const casino = gameState.yellowCasino;
    if (state.globals.GamePhase !== 'RUNTIME' && casino && casino.active) {
      casino.active = false;
      casino.phase = 'idle';
      casino.current = null;
      casino.ghost = null;
    }
    if (casino && casino.active) {
      const nowTime = state.globals.time || 0;
      if (casino.phase === 'telegraph' && nowTime >= casino.telegraphUntil) {
        casino.phase = 'spin';
        traceTask015YellowAnimation('yellow-sequence-spin-enter', {
          queueLength: Number((casino.queue || []).length),
        });
      }
      if (casino.phase === 'spin') {
        const getGemByUid = (uid) => (gameState.gems || []).find(gm => gm && gm.uid === uid);
        const startNext = () => {
          casino.current = null;
          while (casino.index < casino.queue.length) {
            const item = casino.queue[casino.index];
            const gem = item.type === 'yellow' ? getGemByUid(item.uid) : null;
            if (item.type === 'yellow' && !gem) {
              runtimeDebugLogging.gemDebugLog('[FILL_SKIP]', {
                stage: 'yellow-sequence',
                step: casino.index,
                cellR: item.cellR,
                cellC: item.cellC,
                reason: 'missing-yellow-gem',
                tag: item.reason || item.type,
              }, state);
              if (runtimeDebugLogging.isGemDebugEnabled(state)) {
                runtimeDebugLogging.gemDebugLog('[COVERAGE]', countCellCoverage(), state);
              }
              casino.index += 1;
              continue;
            }
            item.startAt = nowTime;
            item.settleStarted = false;
            item.settleUntil = 0;
            casino.current = item;
            traceTask015YellowAnimation('yellow-sequence-item-start', {
              step: Number(casino.index),
              type: String(item.type || ''),
              cellR: Number(item.cellR || 0),
              cellC: Number(item.cellC || 0),
            });
            break;
          }
          if (!casino.current) {
            casino.active = false;
            casino.phase = 'idle';
            casino.ghost = null;
            state.globals.IsPlayerBusy = 0;
          }
        };
        if (!casino.current) {
          startNext();
        }
        if (casino.current) {
          const item = casino.current;
          const elapsed = Math.max(0, nowTime - item.startAt);
          if (item.type === 'yellow') {
            const gem = getGemByUid(item.uid);
            if (!gem) {
              casino.index += 1;
              startNext();
            } else {
              gem.color = item.target;
              gem.elementIndex = item.target;
              if (elapsed >= item.duration && !item.settleStarted) {
                gem.color = item.target;
                gem.elementIndex = item.target;
                gem.bounceStart = nowTime;
                gem.bounceDur = YELLOW_CASINO_SETTLE_SEC;
                gem.bounceAmp = YELLOW_CASINO_SETTLE_BOUNCE_AMP;
                item.settleStarted = true;
                item.settleUntil = nowTime + YELLOW_CASINO_SETTLE_SEC;
                traceTask015YellowAnimation('yellow-sequence-item-settle', {
                  step: Number(casino.index),
                  type: 'yellow',
                  uid: Number(gem.uid || 0),
                  settleSec: Number(YELLOW_CASINO_SETTLE_SEC || 0),
                });
              }
              if (item.settleStarted && nowTime >= item.settleUntil) {
                if (runtimeDebugLogging.isGemDebugEnabled(state)) {
                  runtimeDebugLogging.gemDebugLog('[COVERAGE]', countCellCoverage(), state);
                }
                runtimeDebugLogging.gemDebugLog('[FILL]', {
                  stage: 'yellow-sequence',
                  step: casino.index,
                  cellR: item.cellR,
                  cellC: item.cellC,
                  reason: item.reason || 'yellow-reassign',
                  assignedColor: item.target,
                  assignedUid: gem.uid,
                }, state);
                traceTask015YellowWrite('yellow-sequence', item, casino.index);
                casino.index += 1;
                casino.current = null;
              }
            }
          } else if (item.type === 'empty') {
            if (item.settleStarted) {
              if (nowTime >= item.settleUntil) {
                casino.ghost = null;
                casino.index += 1;
                casino.current = null;
              }
            } else {
              const pos = getCellWorldPos(item.cellC, item.cellR);
              casino.ghost = { x: pos.x, y: pos.y, w: pos.w, h: pos.h, frame: item.target };
              if (elapsed >= item.duration) {
              const step = casino.index;
              const cellR = item.cellR;
              const cellC = item.cellC;
              const previousUid = gameState.grid[cellC] ? Number(gameState.grid[cellC][cellR] || 0) : 0;
              const occupiedGem = (gameState.gems || []).find(g => g && g.cellR === cellR && g.cellC === cellC);
              const slotFilled = !gameState.grid[cellC] || gameState.grid[cellC][cellR] !== 0;
              if (slotFilled || occupiedGem) {
                recordTask011RefillWriteEvent({
                  source: 'yellow-sequence',
                  step,
                  cellR,
                  cellC,
                  reason: slotFilled ? 'not-empty' : 'occupied-slot',
                  writeType: 'skip',
                  previousUid,
                  newUid: previousUid,
                });
                runtimeDebugLogging.gemDebugLog('[FILL_SKIP]', {
                  stage: 'yellow-sequence',
                  step,
                  cellR,
                  cellC,
                  reason: slotFilled ? (!gameState.grid[cellC] ? 'missing-column' : 'not-empty', state) : 'occupied-slot',
                  tag: item.reason || 'empty',
                }, state);
                if (occupiedGem && gameState.grid[cellC]) {
                  gameState.grid[cellC][cellR] = occupiedGem.uid;
                }
                if (runtimeDebugLogging.isGemDebugEnabled(state)) {
                  runtimeDebugLogging.gemDebugLog('[COVERAGE]', countCellCoverage(), state);
                }
                casino.ghost = null;
                casino.index += 1;
                casino.current = null;
              } else {
                const newGem = {
                  uid: gameState.nextGemUID++,
                  cellC: item.cellC,
                  cellR: item.cellR,
                  color: item.target,
                  elementIndex: item.target,
                  x: pos.x,
                  y: pos.y,
                  worldX: pos.x,
                  worldY: pos.y,
                  width: pos.w,
                  height: pos.h,
                  selected: false,
                  Selected: 0,
                  flashUntil: 0
                };
                newGem.bounceStart = nowTime;
                newGem.bounceDur = YELLOW_CASINO_SETTLE_SEC;
                newGem.bounceAmp = YELLOW_CASINO_SETTLE_BOUNCE_AMP;
                if (runtimeDebugLogging.isGemDebugEnabled(state)) {
                  runtimeDebugLogging.gemDebugLog('[REFILL_BEFORE]', {
                    step,
                    cellR,
                    cellC,
                    gemCount: gameState.gems.length
                  }, state);
                }
                gameState.gems.push(newGem);
                if (runtimeDebugLogging.isGemDebugEnabled(state)) {
                  runtimeDebugLogging.gemDebugLog('[REFILL_AFTER]', {
                    step,
                    cellR,
                    cellC,
                    gemCount: gameState.gems.length
                  }, state);
                }
                if (gameState.grid[item.cellC]) gameState.grid[item.cellC][item.cellR] = newGem.uid;
                recordTask011RefillWriteEvent({
                  source: 'yellow-sequence',
                  step,
                  cellR,
                  cellC,
                  reason: item.reason || 'empty',
                  writeType: 'set',
                  previousUid,
                  newUid: newGem.uid,
                });
                setGemArray(gameState.gems);
                if (runtimeDebugLogging.isGemDebugEnabled(state)) {
                  runtimeDebugLogging.gemDebugLog('[COVERAGE]', countCellCoverage(), state);
                }
                runtimeDebugLogging.gemDebugLog('[FILL]', {
                  stage: 'yellow-sequence',
                  step: casino.index,
                  cellR: item.cellR,
                  cellC: item.cellC,
                  reason: item.reason || 'empty',
                  assignedColor: item.target,
                  assignedUid: newGem.uid,
                }, state);
                traceTask015YellowWrite('yellow-sequence', item, casino.index);
                casino.ghost = null;
                item.settleStarted = true;
                item.settleUntil = nowTime + YELLOW_CASINO_SETTLE_SEC;
                traceTask015YellowAnimation('yellow-sequence-item-settle', {
                  step: Number(casino.index),
                  type: 'empty',
                  uid: Number(newGem.uid || 0),
                  settleSec: Number(YELLOW_CASINO_SETTLE_SEC || 0),
                });
              }
            }
            }
          }
          if (!casino.current && casino.index >= casino.queue.length) {
            const mergeSources = (casino.goldMergeSources || [])
              .map((item) => {
                if (Number.isFinite(Number(item?.cellC)) && Number.isFinite(Number(item?.cellR))) {
                  const pos = getCellWorldPos(Number(item.cellC), Number(item.cellR));
                  return { x: pos.x, y: pos.y, color: Number(item.color ?? YELLOW_COLOR) };
                }
                return {
                  x: Number(item?.x || 0),
                  y: Number(item?.y || 0),
                  color: Number(item?.color ?? YELLOW_COLOR),
                };
              })
              .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
            const shouldPlayGoldMerge = mergeSources.length > 0;
            if (shouldPlayGoldMerge) {
              startGemMergeFx({
                target: casino.goldMergeTarget || getGoldLabelTargetWorld(),
                scaleOut: false,
                startScale: 1.5,
                sourceItems: mergeSources,
              });
              if (gameState.gemMergeFx && gameState.gemMergeFx.active) {
                gameState.gemMergeFx.goldAward = Math.max(0, Number(casino.pendingGoldAward || 0));
                casino.pendingGoldAward = 0;
                gameState.gemMergeFx.releaseGate = {};
                state.globals.CanPickGems = 0;
                state.globals.IsPlayerBusy = 1;
              }
            }
            casino.active = false;
            casino.phase = 'idle';
            casino.ghost = null;
            const refill = gameState.refillBounce;
            const handoffPending =
              !!state.globals.DeferAdvance &&
              !!state.globals.AdvanceAfterAction;
            state.globals.BoardFillActive = 0;
            const canRestorePickability =
              !handoffPending &&
              !(refill && refill.active) &&
              state.entities.length > 0 &&
              state.globals.TurnPhase === 0 &&
              (state.globals.ActionLockUntil || 0) <= (state.globals.time || 0);
            if (!shouldPlayGoldMerge) {
              const pendingGoldAward = Math.max(0, Number(casino.pendingGoldAward || 0));
              if (pendingGoldAward > 0) {
                state.globals.goldTotal = Number(state.globals.goldTotal || 0) + pendingGoldAward;
                casino.pendingGoldAward = 0;
              }
              applyTurnGateIntent(getYellowSequenceCompletionIntent);
            }
            if (canRestorePickability) {
              if (runtimeDebugLogging.isGemDebugEnabled(state)) {
                runtimeDebugLogging.gemDebugLog('[RESTORE_PICKABILITY]', {
                  globals: {
                    BoardFillActive: state.globals.BoardFillActive,
                    CanPickGems: state.globals.CanPickGems,
                    IsPlayerBusy: state.globals.IsPlayerBusy,
                    DeferAdvance: state.globals.DeferAdvance,
                    ActionLockUntil: state.globals.ActionLockUntil,
                    PendingSkillID: state.globals.PendingSkillID || '',
                    TurnPhase: state.globals.TurnPhase,
                    time: state.globals.time,
                  },
                }, state);
              }
            }
            if (runtimeDebugLogging.isGemDebugEnabled(state)) {
              runtimeDebugLogging.gemDebugLog('[REFILL_COMPLETE]', {
                stage: 'yellow-sequence-finished',
                globals: {
                  BoardFillActive: state.globals.BoardFillActive,
                  CanPickGems: state.globals.CanPickGems,
                  IsPlayerBusy: state.globals.IsPlayerBusy,
                  DeferAdvance: state.globals.DeferAdvance,
                  ActionLockUntil: state.globals.ActionLockUntil,
                  PendingSkillID: state.globals.PendingSkillID || '',
                  TurnPhase: state.globals.TurnPhase,
                },
              }, state);
              const integrity = assertBoardIntegrity('yellow-sequence-finished');
              if (!integrity.ok) {
                throw new Error('[BOARD_INTEGRITY_FAIL] yellow-sequence-finished');
              }
            }
            traceTask015YellowAnimation('yellow-sequence-finished', {
              queueLength: Number((casino.queue || []).length),
            });
          }
        }
      }
    }

}

export function advanceRefillBounceSimulation({
  state, gameState, getCellWorldPos, randomGemFrame = () => Math.floor(Math.random() * 6),
  setGemArray = (gems) => { state.globals.Gems = gems; gameState.gems = gems; },
  countCellCoverage = () => (gameState.gems || []).length,
  recordTask011RefillWriteEvent = () => {},
  createEnemyTurnGateBaseline,
  createRefillCompleteGate,
  applyTurnGateIntent = () => {},
  runtimeDebugLogging = { gemDebugLog() {}, isGemDebugEnabled: () => false },
  assertBoardIntegrity = () => ({ ok: true }),
  getGemGateSnapshot = () => ({}),
  runCombatStep,
}) {
  const refill = gameState.refillBounce;
  if (!refill || !refill.active) return false;
  const nowTime = state.globals.time || 0;
  const bounceDur = 0.16 * (refill.speedScale || 1);
  const startNext = () => {
    refill.current = null;
    while (refill.index < refill.queue.length) {
      const slot = refill.queue[refill.index];
      if (!gameState.grid[slot.cellC] || gameState.grid[slot.cellC][slot.cellR] !== 0) {
        runtimeDebugLogging.gemDebugLog('[FILL_SKIP]', { stage: 'refill-bounce', step: refill.index, cellR: slot.cellR, cellC: slot.cellC, reason: !gameState.grid[slot.cellC] ? 'missing-column' : 'not-needed', tag: slot.reason || 'empty' }, state);
        if (runtimeDebugLogging.isGemDebugEnabled(state)) runtimeDebugLogging.gemDebugLog('[COVERAGE]', countCellCoverage(), state);
        refill.index += 1;
        continue;
      }
      const step = refill.index;
      const cellR = slot.cellR;
      const cellC = slot.cellC;
      const previousUid = gameState.grid[cellC] ? Number(gameState.grid[cellC][cellR] || 0) : 0;
      const occupiedGem = (gameState.gems || []).find((gem) => gem && gem.cellC === cellC && gem.cellR === cellR);
      if (occupiedGem) {
        recordTask011RefillWriteEvent({ source: 'refill-bounce', step, cellR, cellC, reason: 'occupied-slot', writeType: 'skip', previousUid, newUid: previousUid });
        runtimeDebugLogging.gemDebugLog('[FILL_SKIP]', { stage: 'refill-bounce', step, cellR, cellC, reason: 'occupied-slot', tag: slot.reason || 'empty' }, state);
        if (gameState.grid[cellC]) gameState.grid[cellC][cellR] = occupiedGem.uid;
        if (runtimeDebugLogging.isGemDebugEnabled(state)) runtimeDebugLogging.gemDebugLog('[COVERAGE]', countCellCoverage(), state);
        refill.index += 1;
        continue;
      }
      const pos = getCellWorldPos(slot.cellC, slot.cellR);
      const color = randomGemFrame();
      const newGem = {
        uid: gameState.nextGemUID++, cellC: slot.cellC, cellR: slot.cellR, color, elementIndex: color,
        x: pos.x, y: pos.y, worldX: pos.x, worldY: pos.y, width: pos.w, height: pos.h,
        selected: false, Selected: 0, flashUntil: 0, bounceStart: nowTime, bounceDur,
      };
      if (runtimeDebugLogging.isGemDebugEnabled(state)) runtimeDebugLogging.gemDebugLog('[REFILL_BEFORE]', { step, cellR, cellC, gemCount: gameState.gems.length }, state);
      gameState.gems.push(newGem);
      if (runtimeDebugLogging.isGemDebugEnabled(state)) runtimeDebugLogging.gemDebugLog('[REFILL_AFTER]', { step, cellR, cellC, gemCount: gameState.gems.length }, state);
      gameState.grid[cellC][cellR] = newGem.uid;
      recordTask011RefillWriteEvent({ source: 'refill-bounce', step, cellR, cellC, reason: slot.reason || 'empty', writeType: 'set', previousUid, newUid: newGem.uid });
      setGemArray(gameState.gems);
      if (runtimeDebugLogging.isGemDebugEnabled(state)) runtimeDebugLogging.gemDebugLog('[COVERAGE]', countCellCoverage(), state);
      runtimeDebugLogging.gemDebugLog('[FILL]', { stage: 'refill-bounce', step: refill.index, cellR: slot.cellR, cellC: slot.cellC, reason: slot.reason || 'empty', assignedColor: color, assignedUid: newGem.uid }, state);
      refill.current = { doneAt: Math.max(Number(refill.current?.doneAt || 0), nowTime + bounceDur) };
      refill.index += 1;
      continue;
    }
    if (!refill.current) {
      refill.active = false;
      const refillCompleteGate = state.globals.TurnPhase === 2 ? createEnemyTurnGateBaseline : createRefillCompleteGate;
      applyTurnGateIntent(refillCompleteGate);
      state.globals.BoardFillActive = 0;
      if (runtimeDebugLogging.isGemDebugEnabled(state)) {
        runtimeDebugLogging.gemDebugLog('[REFILL_COMPLETE]', { stage: 'refill-bounce-finished', globals: {
          BoardFillActive: state.globals.BoardFillActive, CanPickGems: state.globals.CanPickGems, IsPlayerBusy: state.globals.IsPlayerBusy,
          DeferAdvance: state.globals.DeferAdvance, ActionLockUntil: state.globals.ActionLockUntil,
          PendingSkillID: state.globals.PendingSkillID || '', TurnPhase: state.globals.TurnPhase,
        } }, state);
        const integrity = assertBoardIntegrity('refill-bounce-finished');
        if (!integrity.ok) throw new Error('[BOARD_INTEGRITY_FAIL] refill-bounce-finished');
        const queueDone = !Array.isArray(refill.queue) || refill.index >= refill.queue.length;
        const noSpinActive = !(gameState.yellowCasino && gameState.yellowCasino.active);
        if (queueDone && noSpinActive && state.globals.BoardFillActive !== 0) {
          console.error('[REFILL_STUCK]', { reason: 'BoardFillActive-not-reset', refillIndex: refill.index, refillQueueLength: Array.isArray(refill.queue) ? refill.queue.length : 0, yellowSpinActive: !!(gameState.yellowCasino && gameState.yellowCasino.active), globals: getGemGateSnapshot() });
        }
        const shouldValidate = state.globals.BoardFillActive === 0 && queueDone && noSpinActive && state.globals.TurnPhase === 0 && state.globals.IsPlayerBusy === 0 && !state.globals.DeferAdvance && !state.globals.AdvanceAfterAction;
        if (shouldValidate && state.globals.CanPickGems !== true) runtimeDebugLogging.gemDebugLog('[GATE_STUCK_AFTER_REFILL]', { reason: 'CanPickGems-false-after-refill', corrected: false, refillIndex: refill.index, refillQueueLength: Array.isArray(refill.queue) ? refill.queue.length : 0, yellowSpinActive: !!(gameState.yellowCasino && gameState.yellowCasino.active), globals: getGemGateSnapshot() }, state);
      }
      if (Number(state.globals.ContinuousCombatStageLoop || 0) !== 1 && state.globals.TurnPhase === 2 && !state.globals.ActionInProgress && state.globals.GamePhase === 'RUNTIME' && typeof runCombatStep === 'function') runCombatStep('ProcessTurn');
    }
  };
  if (!refill.current) startNext();
  else if (nowTime >= (refill.current.doneAt || 0)) {
    if (refill.index < (refill.queue || []).length) refill.index += 1;
    refill.current = null;
    startNext();
  }
  return true;
}

export function advanceBuffSequenceSimulation({ state, gameState, runCombatStep }) {
  const nowTime = Number(state.globals.time || 0);
  const icon = gameState.buffIconPresentation || (gameState.buffIconPresentation = {
    key: '', active: false, phase: 'idle', holdStartAt: 0, travelStartAt: 0,
    holdSec: 0.5, travelSec: 0.34, frameType: -1, slotType: '',
    from: { x: 0, y: 0, w: 0, h: 0 }, to: { x: 0, y: 0, w: 0, h: 0 }, landedAt: null, pending: null,
  });
  const slots = gameState.buffIconSlotsByFrame || {};
  const center = gameState.buffIconPresentationCenter || { x: 180, y: 280 };
  const begin = (target, key, frameType) => {
    icon.key = key;
    icon.active = !!target;
    icon.phase = 'hold';
    icon.holdStartAt = nowTime;
    icon.travelStartAt = 0;
    icon.frameType = frameType;
    icon.slotType = target ? target.slotType : '';
    icon.from = { x: center.x, y: center.y, w: target ? target.w * 4.2 : 0, h: target ? target.h * 4.2 : 0 };
    icon.to = target ? { x: target.x, y: target.y, w: target.w, h: target.h } : { x: center.x, y: center.y, w: 0, h: 0 };
    icon.landedAt = null;
    icon.pending = null;
  };
  const popType = state.globals.BuffIconPopType;
  const popAt = state.globals.BuffIconPopAt;
  if (popType != null && popAt != null) {
    const key = `${popType}:${popAt}`;
    if (icon.key !== key) {
      const target = slots[popType];
      if (gameState.gemMergeFx && gameState.gemMergeFx.active) {
        icon.key = key;
        icon.active = false;
        icon.phase = 'waiting';
        icon.pending = { target, key };
        icon.frameType = popType;
        icon.landedAt = null;
      } else begin(target, key, popType);
    }
  }
  if (icon.pending && (!gameState.gemMergeFx || !gameState.gemMergeFx.active)) {
    const { target, key } = icon.pending;
    begin(target, key, icon.frameType);
  }
  if (icon.active && icon.slotType) {
    const target = slots[icon.frameType];
    if (target) {
      icon.slotType = target.slotType;
      icon.to = { x: target.x, y: target.y, w: target.w, h: target.h };
    }
  }
  if (icon && icon.active && icon.slotType) {
    if (icon.phase === 'hold' && nowTime >= Number(icon.holdStartAt || 0) + Number(icon.holdSec || 0)) {
      icon.phase = 'travel';
      icon.travelStartAt = nowTime;
    } else if (icon.phase === 'travel') {
      const t = Number(icon.travelSec || 0) > 0 ? (nowTime - Number(icon.travelStartAt || 0)) / Number(icon.travelSec) : 1;
      if (t >= 1) { icon.phase = 'done'; icon.active = false; icon.landedAt = nowTime; }
    }
  }
  if (!state.globals.BlueBuffSequenceActive) return false;
  const sequencePopType = state.globals.BuffIconPopType;
  const sequencePopAt = state.globals.BuffIconPopAt;
  const key = sequencePopType != null && sequencePopAt != null ? `${sequencePopType}:${sequencePopAt}` : `active:${nowTime}`;
  let timeline = gameState.blueBuffSequenceTimeline;
  if (!timeline || timeline.key !== key) {
    timeline = gameState.blueBuffSequenceTimeline = { key, startedAt: null, completed: false };
  }
  if (timeline.completed) return false;
  if (gameState.gemMergeFx && gameState.gemMergeFx.active) timeline.startedAt = null;
  else if (timeline.startedAt == null) timeline.startedAt = nowTime;
  if (timeline.startedAt == null || nowTime - timeline.startedAt < 1.2) return false;
  state.globals.BlueBuffSequenceActive = 0;
  timeline.completed = true;
  if (Number(state.globals.ContinuousCombatStageLoop || 0) !== 1 && state.globals.GamePhase === 'RUNTIME' && state.globals.TurnPhase === 2 && !state.globals.ActionInProgress && !state.globals.IsPlayerBusy && typeof runCombatStep === 'function') runCombatStep('ProcessTurn');
  return true;
}

export function advanceGemMergeFxSimulation({ state, gameState, applyTurnGateIntent = () => {}, getYellowSequenceCompletionIntent }) {
  const merge = gameState.gemMergeFx;
  if (!merge || !merge.active) return false;
  const nowTime = Number(state.globals.time || 0);
  const t = merge.duration > 0 ? (nowTime - merge.startAt) / merge.duration : 1;
  if (t < 1) return false;
  const goldAward = Math.max(0, Number(merge.goldAward || 0));
  if (goldAward > 0) {
    state.globals.goldTotal = Number(state.globals.goldTotal || 0) + goldAward;
    merge.goldAward = 0;
  }
  merge.active = false;
  merge.doneAt = nowTime;
  if (merge.releaseGate) {
    applyTurnGateIntent(getYellowSequenceCompletionIntent, merge.releaseGate);
    merge.releaseGate = null;
  }
  return true;
}

export function advanceBattleStartSimulation({ state, runCombatStep }) {
  const g = state.globals;
  if (!g.BattleStartActive || Number(g.time || 0) < Number(g.BattleStartFadeEndsAt ?? 2.4)) return false;
  g.BattleStartActive = 0;
  g.BattleStartClearedForSession = 1;
  if (!g.BattleStartProcessStarted) {
    g.BattleStartProcessStarted = 1;
    g.IsPlayerBusy = 0;
    if (Number(g.ContinuousCombatStageLoop || 0) !== 1 && g.GamePhase === 'RUNTIME' && typeof runCombatStep === 'function') runCombatStep('ProcessTurn');
  }
  return true;
}

export function advanceHeroActionSimulation({ state, gameState, dt, layoutW, animationMath, applyTurnGateGlobals }) {
  const heroAction = state.globals.HeroAction;
  if (!heroAction || !heroAction.active) return false;
  const hero = state.entities.find((entity) => entity.kind === 'hero' && entity.uid === heroAction.uid);
  const positions = state.globals.HeroPortraitPosByIndex || [];
  const offsets = state.globals.HeroLungeOffsetByUID || (state.globals.HeroLungeOffsetByUID = {});
  const release = (uid, label) => {
    const releaseState = { IsPlayerBusy: 0 };
    if (state.globals.ActionActorUID === uid) {
      releaseState.ActionInProgress = 0;
      releaseState.ActionActorUID = 0;
    }
    applyTurnGateGlobals(releaseState);
    const suffix = label === 'done' ? ` defer=${state.globals.DeferAdvance} lockUntil=${state.globals.ActionLockUntil}` : '';
    console.log(`[HERO] action ${label} uid=${uid} phase=${state.globals.TurnPhase} busy=${state.globals.IsPlayerBusy}${suffix}`);
  };
  if (!hero) {
    heroAction.active = false;
    release(heroAction.uid, 'aborted');
    return true;
  }
  if (hero.heroIndex == null || !positions[hero.heroDisplaySlot ?? hero.heroIndex]) return false;
  const base = positions[hero.heroDisplaySlot ?? hero.heroIndex];
  const baseX = base.x;
  const actionProfile = String(heroAction.profile || 'single');
  const isAoeProfile = actionProfile === 'aoe';
  const isRangedProfile = actionProfile === 'ranged' || heroAction.stationary === true;
  const heroPresentationComplete = () => {
    const ownerUID = Number(hero.uid || 0);
    const pendingHit = (state.globals.PendingHeroHits || []).some((hit) => Number(hit?.heroUID || hit?.actorUID || 0) === ownerUID);
    const pendingImpact = (state.globals.CombatImpactVisuals || []).some((impact) => Number(impact?.ownerUID || 0) === ownerUID);
    const pendingBloom = (gameState.healBlooms || []).some((bloom) => Number(bloom?.ownerUID || bloom?.targetUID || 0) === ownerUID && !bloom.complete);
    return !pendingHit && !pendingImpact && !pendingBloom && Number(state.globals.ActionLockUntil || 0) <= Number(state.globals.time || 0);
  };
  if (heroAction.baseX == null) heroAction.baseX = baseX;
  if (heroAction.forwardX == null) heroAction.forwardX = isRangedProfile ? baseX : Math.min(layoutW / 2, baseX + animationMath.HERO_LUNGE_FORWARD_DIST_PX);
  const easeInCubic = (t) => t * t * t;
  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const anticipationDur = animationMath.LUNGE_ANTICIPATION_SEC;
  const lungeDur = animationMath.LUNGE_FORWARD_SEC;
  const holdDur = isAoeProfile ? 0.24 : animationMath.LUNGE_HOLD_SEC;
  const retreatDur = isAoeProfile ? 0.42 : animationMath.LUNGE_RETREAT_SEC;
  if (heroAction.anticipationX == null) {
    const dir = Math.sign((heroAction.forwardX ?? baseX) - baseX) || 1;
    heroAction.anticipationX = isRangedProfile ? baseX : baseX - dir * 6;
  }
  const presentationHeld = Number(state.globals.time || 0) < Number(heroAction.presentationStartAfter || 0);
  if (!presentationHeld) heroAction.timer = (heroAction.timer || 0) + dt;
  let x = baseX;
  if (heroAction.state === 'ADVANCE') {
    const t = Math.min(1, heroAction.timer / Math.max(0.001, anticipationDur));
    x = heroAction.baseX + (heroAction.anticipationX - heroAction.baseX) * easeInCubic(t);
    if (t >= 1) { heroAction.state = 'LUNGE'; heroAction.timer = 0; }
  } else if (heroAction.state === 'LUNGE') {
    const t = Math.min(1, heroAction.timer / Math.max(0.001, lungeDur));
    x = heroAction.anticipationX + ((heroAction.forwardX ?? heroAction.baseX) - heroAction.anticipationX) * animationMath.easeLungeForward(t);
    if (t >= 1) { heroAction.state = 'HOLD'; heroAction.timer = 0; }
  } else if (heroAction.state === 'HOLD') {
    x = heroAction.forwardX;
    if (heroAction.timer >= holdDur && heroPresentationComplete()) { heroAction.state = 'RETREAT'; heroAction.timer = 0; }
  } else if (heroAction.state === 'RETREAT') {
    const t = Math.min(1, heroAction.timer / Math.max(0.001, retreatDur));
    const from = heroAction.forwardX ?? heroAction.baseX;
    x = from + (heroAction.baseX - from) * easeInOutCubic(t);
    if (t >= 1) { x = heroAction.baseX; heroAction.active = false; }
  }
  if (heroAction.stationary) x = baseX;
  offsets[hero.uid] = x - baseX;
  if (!heroAction.active) { offsets[hero.uid] = 0; release(hero.uid, 'done'); }
  return true;
}

export function advanceEnemyActionSimulation({
  state,
  gameState,
  dt,
  layoutW,
  animationMath,
  fnContext,
  callFunctionWithContext,
  applyTurnGateGlobals,
  applyTurnGateIntent,
  createEnemyTurnIdleRecovery,
  combatVfxProfileForActor = defaultCombatVfxProfileForActor,
  queueCombatAttackImpactVfx = defaultQueueCombatAttackImpactVfx,
}) {
  // Continuous combat owns one independent action state per enemy. Story and QA
  // keep the singular EnemyAction turn-gated lane.
  const continuousCombat = Number(state.globals.ContinuousCombatStageLoop || 0) === 1;
  const actionMap = state.globals.RealtimeEnemyActionsByUID || {};
  const actions = continuousCombat
    ? Object.entries(actionMap).sort(([a], [b]) => Number(a) - Number(b)).map(([, action]) => action)
    : [state.globals.EnemyAction];
  const completeEnemyTurn = (enemyAction, releaseDelay = 0.05) => {
    if (continuousCombat) {
      const key = String(Number(enemyAction?.uid || 0));
      delete actionMap[key];
      const readyAt = state.globals.RealtimeEnemyActionReadyAt ||= {};
      readyAt[key] = enemyAction?.noTargetAtImpact
        ? Number(state.globals.time || 0)
        : Math.max(Number(state.globals.time || 0), Number(enemyAction?.nextReadyAt ?? (Number(enemyAction?.startedAt || 0) + Number(enemyAction?.cooldownSeconds || 0))));
    } else {
      applyTurnGateIntent(createEnemyTurnIdleRecovery, {
        now: Number(state.globals.time || 0),
        currentTurnUID: callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0,
        releaseDelay,
      });
    }
  };
  for (const enemyAction of actions) {
    if (enemyAction && enemyAction.active) {
      const enemy = state.entities.find(e => e.kind === 'enemy' && e.uid === enemyAction.uid);
      if (!enemy || (enemy.hp ?? 0) <= 0) {
        enemyAction.active = false;
        if (state.globals.ActionActorUID === enemyAction.uid) {
          applyTurnGateGlobals({
            ActionInProgress: 0,
            ActionActorUID: 0,
          });
        }
        completeEnemyTurn(enemyAction);
      } else {
        const anticipationDur = animationMath.LUNGE_ANTICIPATION_SEC;
        const lungeDur = animationMath.LUNGE_FORWARD_SEC;
        const impactHold = animationMath.LUNGE_HOLD_SEC;
        const retreatDur = animationMath.LUNGE_RETREAT_SEC;
        if (enemy.originX == null) enemy.originX = enemy.x ?? 0;
        if (enemy.originY == null) enemy.originY = enemy.y ?? 0;
        enemy.y = enemy.originY;
        const enemyVfxProfile = combatVfxProfileForActor(enemy);
        const enemyUsesRangedMagic = !!enemyAction.stationary || String(enemyAction.skillId || '').startsWith('Enemy_Heal_') || enemyVfxProfile.delivery !== 'melee';
        const enemyPresentationComplete = () => {
          const ownerUID = Number(enemy.uid || 0);
          const pendingHit = (state.globals.PendingHeroHits || []).some(hit => Number(hit?.heroUID || hit?.actorUID || 0) === ownerUID);
          const pendingImpact = (state.globals.CombatImpactVisuals || []).some(impact => Number(impact?.ownerUID || 0) === ownerUID);
          const pendingBloom = (gameState.healBlooms || []).some(bloom => Number(bloom?.ownerUID || bloom?.targetUID || 0) === ownerUID && !bloom.complete);
          return !pendingHit && !pendingImpact && !pendingBloom && (Number(state.globals.ContinuousCombatStageLoop || 0) === 1 || Number(state.globals.ActionLockUntil || 0) <= Number(state.globals.time || 0));
        };
        enemyAction.attackVfxKind = enemyVfxProfile.delivery;
        enemyAction.impactVfxKind = enemyVfxProfile.impact;
        if (enemyAction.targetX == null) {
          const heroIcons = state.globals.HeroIconPosByIndex || [];
          const targetIdx = (enemyAction.targetUID ? (state.entities.find(e => e.uid === enemyAction.targetUID)?.heroIndex ?? 0) : 0);
          const targetPos = heroIcons[targetIdx];
          enemyAction.targetX = targetPos ? targetPos.x : (enemy.originX - 120);
        }
        if (enemyAction.forwardX == null) {
          const lungeDist = animationMath.LUNGE_FORWARD_DIST_PX;
          enemyAction.forwardX = Math.max(layoutW / 2, enemy.originX - lungeDist);
        }
        if (enemyAction.anticipationX == null) {
          const dir = Math.sign((enemyAction.forwardX ?? enemy.originX) - enemy.originX) || -1;
          enemyAction.anticipationX = enemy.originX - (dir * 6);
        }
        const easeInCubic = (t) => t * t * t;
        const easeInOutCubic = (t) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        if (enemyAction.state === 'ADVANCE') {
          // Anticipation (small reverse)
          enemyAction.timer += dt;
          const t = Math.min(1, enemyAction.timer / Math.max(0.001, anticipationDur));
          const e = easeInCubic(t);
          const from = enemy.originX;
          const to = enemyAction.anticipationX ?? enemy.originX;
          enemy.x = enemyUsesRangedMagic ? enemy.originX : from + (to - from) * e;
          enemyAction.visualProgress = 0;
          if (t >= 1) {
            enemyAction.state = 'LUNGE';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'LUNGE') {
          enemyAction.timer += dt;
          const t = Math.min(1, enemyAction.timer / Math.max(0.001, lungeDur));
          const e = animationMath.easeLungeForward(t);
          const from = enemyAction.anticipationX ?? enemy.originX;
          const to = enemyAction.forwardX ?? enemy.originX;
          enemy.x = enemyUsesRangedMagic ? enemy.originX : from + (to - from) * e;
          enemyAction.visualProgress = t;
          if (!enemyAction.actionApplied && t >= 1) {
            const impactTarget = continuousCombat
              ? callFunctionWithContext(fnContext, 'ResolveEnemyActionTarget', enemyAction.uid, enemyAction.targetUID)
              : state.entities.find(entity => entity?.kind === 'hero' && Number(entity.uid) === Number(enemyAction.targetUID)) || null;
            if (continuousCombat && !impactTarget) {
              enemyAction.noTargetAtImpact = true;
            } else {
              enemyAction.actionApplied = true;
              if (impactTarget) enemyAction.targetUID = Number(impactTarget.uid || 0);
              const heroHpBefore = new Map(state.entities.filter(entity => entity?.kind === 'hero').map(hero => [hero.uid, Number(hero.hp || 0)]));
              callFunctionWithContext(fnContext, 'ApplyEnemySkill', enemyAction.uid, enemyAction.skillId, enemyAction.targetUID);
              for (const hero of state.entities.filter(entity => entity?.kind === 'hero')) {
                if (Number(hero.hp || 0) >= Number(heroHpBefore.get(hero.uid) || 0)) continue;
                queueCombatAttackImpactVfx(state, { actorUID: enemy.uid, suppressImpactVfx: ['Enemy_ATK_Single', 'Enemy_MAG_Single'].includes(enemyAction.skillId) ? 1 : 0, impactVfxKind: enemyAction.skillId === 'Enemy_MAG_AOE' ? 'rose' : enemyVfxProfile.impact, dmg: Number(heroHpBefore.get(hero.uid) || 0) - Number(hero.hp || 0) }, hero, state.globals.time);
              }
            }
          }
          if (t >= 1) {
            enemyAction.state = 'HIT';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'HIT') {
          enemyAction.timer += dt;
          enemy.x = enemyUsesRangedMagic ? enemy.originX : enemyAction.forwardX ?? enemy.originX;
          enemyAction.visualProgress = 1;
          if (enemyAction.timer >= impactHold && enemyPresentationComplete()) {
            enemyAction.state = 'RETREAT';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'RETREAT') {
          enemyAction.timer += dt;
          const t = Math.min(1, enemyAction.timer / Math.max(0.001, retreatDur));
          const e = easeInOutCubic(t);
          const from = enemyAction.forwardX ?? enemy.originX;
          const to = enemy.originX;
          enemy.x = enemyUsesRangedMagic ? enemy.originX : from + (to - from) * e;
          enemyAction.visualProgress = Math.max(0, 1 - t);
          if (t >= 1) {
            enemy.x = enemy.originX;
            enemyAction.state = 'DONE';
          }
        }
        if (enemyAction.state === 'DONE') {
          enemyAction.active = false;
          enemy.x = enemy.originX ?? enemy.x;
          enemy.y = enemy.originY ?? enemy.y;
          completeEnemyTurn(enemyAction, 0.35);
        }
      }
    }
  }
}
