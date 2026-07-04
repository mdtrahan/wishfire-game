import { state } from './modules/state.js';
import { createContext, callFunctionWithContext } from './modules/functionRegistry.js';
import { CombatRuntimeGateway } from './src/core/combatRuntimeGateway.js';
import {
  createCombatTurnRefreshBaseline,
  createEnemyRosterRefillHold,
  createEnemyTurnGateBaseline,
  createEnemyTurnIdleRecovery,
  createEnemyTurnRetryHold,
  createDeferredAdvanceResolved,
  createDeferredRefillHold,
  createDeferredStaleActionRecovery,
  createDeferredStaleBusyRecovery,
  createDeferredTextHold,
  derivePresentationTurnBarrier,
  isCanPickGemsReady,
  createRefillCompleteGate,
  createRefillStartGate,
  createYellowSafetyNet,
  createYellowSequenceCompletion,
  createYellowSequenceGate,
  createYellowSequenceSkip,
} from './src/core/turnGateController.mjs';
import {
  YELLOW_COLOR,
  YELLOW_REFILL_TARGETS,
  pickYellowReassignTarget,
} from './src/core/yellowRefillRules.mjs';
import {
  resolveCurrentHeroUID,
  shouldRenderHeroTurnSelector,
} from './src/core/heroSelectorRules.mjs';
import {
  assignHeroToPartySlot,
  normalizePartyFormationSlots,
} from './src/core/partyFormationRules.mjs';
import {
  applyIdleFarmRewardsToGlobals,
  claimIdleFarmRewardsFromState,
  ensureIdleFarmSessionState,
  resetIdleFarmEmissionCadence,
  restartIdleFarmSessionState,
  startIdleFarmEmissionState,
  updateIdleFarmEmissionState,
  updateIdleFarmSessionState,
} from './src/core/idleFarmRuntime.mjs';
import {
  pickIdleAutoplaySuperGem,
  pickIdleAutoplayTriplet,
  resolveIdleAutoplayPartyHpRatio,
} from './src/core/idleAutoplayPriority.mjs';
import {
  getSuperGemAtCanvasPoint,
  getSuperGemAtCell,
  resetSuperGemBoardState,
  resolveSuperGemDecomposition,
  settleSuperGemShapes,
  spendSuperGem,
  syncSuperGemShapes,
} from './src/core/superGemBoardState.mjs';
import { resolvePendingSuperGemHandoff } from './src/core/pendingSuperGemHandoff.mjs';
import { formatDamageValue } from '../src/core/damageTextFormatting.mjs';
import { deriveDamageFloatFrameOffset } from '../src/core/damageFloatVector.mjs';
import { createDamageNumber, ensureDamageTextFontReady, isDamageTextFontReady } from './src/core/damageNumberAnimation.mjs';
import { createHealBloom } from './src/core/healBloomAnimation.mjs';
import { createCombatOutcomeSimulationPacket } from './src/core/combatOutcomeRules.mjs';
import {
  createPartyRegenLifecycleSimulationPacket,
  createPartyRegenTickSimulationPacket,
} from './src/core/statusEffectRules.mjs';
import * as heroGemProgressStorage from './systems/heroGemProgressStorage.js';
import * as runtimeDebugLogging from './systems/runtimeDebugLogging.js';
import * as animationMath from './systems/animationMath.js';
import * as inputHandling from './systems/inputHandling.js';
import * as renderSystem from './systems/renderSystem.js';
import * as renderHUD from './systems/renderHUD.js';
import * as renderHeroScreen from './systems/renderHeroScreen.js';
import * as renderBoard from './systems/renderBoard.js';
import * as gemVisuals from './systems/gemVisuals.js';
import * as renderCombatRuntime from './systems/renderCombatRuntime.js';
import * as renderOverlays from './systems/renderOverlays.js';
import * as renderSkillDraught from './systems/renderSkillDraughtOverlay.js';
import * as renderRuntime from './systems/renderRuntime.js';
import * as partyStatOsd from './systems/partyStatOsd.js';
import * as astralFlowKoOrbPresentation from './systems/astralFlowKoOrbPresentation.js';
import * as superGemRuntime from './systems/superGemRuntime.js';
import {
  createSimulationCoreSeededRng,
  initializeSimulationCoreShadow,
  shadowCombatPower,
  shadowSeededRng,
} from './systems/simulationCoreShadow.js';
import {
  createAppViewportRuntime,
} from './systems/appShellViewport.js';
import { initializeStoryCardPresentationLayout } from './systems/storyCardPresentation.js';
import { registerRuntimeLayouts } from './systems/runtimeLayoutRegistry.js';
import { createSurfaceRenderRouter } from './systems/surfaceRenderRouter.js';
import { createPointerRoutingShell } from './systems/pointerRoutingShell.js';
import { createIdleFarmAppRuntime } from './systems/idleFarmAppRuntime.js';
import { loadRuntimeVisualAssets } from './systems/runtimeVisualAssetLoader.js';
import { registerDevBrowserTestHooks } from './systems/devBrowserTestHooks.js';
import {
  createCombatSessionInitializer,
  generateEncounterSeed,
} from './systems/combatSessionInitializer.js';
import {
  createDevToolingRuntime,
  DEV_TOOL_GEM_OPTIONS,
  DEV_TOOL_GEM_RANDOM,
  GEM_SPAWN_COLORS,
} from './systems/devToolingRuntime.js';
import * as helpers from './utils/helpers.js';
import * as mapLayoutState from './state/mapLayoutState.js';
import * as uiState from './state/uiState.js';
import { createInitialGameState } from './state/gameState.js';
import { CANONICAL_HERO_ROSTER, HERO_CLASS_LABELS, HERO_STAT_KEYS, heroLayoutSpec } from './state/heroScreenConfig.js';
import { createHarnessEventBus, createHarnessLayoutState, HarnessInputDomainManager } from './state/harnessLayoutState.js';
import { createRuntimeEnvironment, createRuntimeFingerprint, exposeRuntimeDebugFlags } from './state/runtimeEnvironment.js';
import * as task015TraceState from './state/task015TraceState.js';

const out = document.getElementById('output');
const gemCounterOut = document.getElementById('gem-counter-output');
const walletOut = document.getElementById('wallet-output');
const astralWalletOut = document.getElementById('astral-wallet-output');
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
let damageNumberLayer = null;
const DAMAGE_TEXT_FONT = '"Bungee", "Trebuchet MS", "Verdana", sans-serif';
void ensureDamageTextFontReady();
const simulationCoreShadowReady = initializeSimulationCoreShadow();
if (simulationCoreShadowReady && typeof simulationCoreShadowReady.then === 'function') {
  void simulationCoreShadowReady.then(() => runSeededRngShadowStartupChecks());
}
const {
  HARNESS_MODE,
  DEBUG_LAYOUT,
  DEBUG_GEMS_QUERY,
  GEM_DEBUG_LEVEL,
  BOOTSTRAP_SEED,
  STARTUP_DEBUG,
} = createRuntimeEnvironment();
let bootstrapDeterministicRefillPending = false;
const COMBAT_RUNTIME_RNG_SALT = 0x9e3779b9;
const GEM_INTERACTIVITY_DIAGNOSTIC_QUERY = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('gemdiag') === 'true';
  } catch {
    return false;
  }
})();
exposeRuntimeDebugFlags({ DEBUG_LAYOUT, STARTUP_DEBUG, DEBUG_GEMS_QUERY });
const TURN_TRANSIENT_NUMERIC_KEYS = Object.freeze([
  'CanPickGems',
  'IsPlayerBusy',
  'DeferAdvance',
  'AdvanceAfterAction',
  'ActionLockUntil',
  'ActionOwnerUID',
  'ActionInProgress',
  'ActionActorUID',
  'PendingActor',
  'EnemyLineClearPressureActive',
]);
const TURN_TRANSIENT_STRING_KEYS = Object.freeze([
  'PendingSkillID',
]);
const TURN_TRANSIENT_OBJECT_KEYS = Object.freeze([
  'PendingSuperGemAction',
]);

function applyTurnGateGlobals(next) {
  if (!next) return;
  for (const key of TURN_TRANSIENT_NUMERIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    state.globals[key] = Number(next[key] || 0);
  }
  for (const key of TURN_TRANSIENT_STRING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    state.globals[key] = String(next[key] || '');
  }
  for (const key of TURN_TRANSIENT_OBJECT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    state.globals[key] = next[key] || null;
  }
}

function applyTurnGateIntent(createIntent, options = undefined) {
  if (typeof createIntent !== 'function') return;
  applyTurnGateGlobals(createIntent(state.globals, options));
}

function getActionHandoffSnapshot() {
  const currentUID = Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
  const currentType = Number(callFunctionWithContext(fnContext, 'GetCurrentType') ?? -1);
  return {
    currentUID,
    currentType,
    turnPhase: Number(state.globals.TurnPhase || 0),
    canPickGems: state.globals.CanPickGems,
    isPlayerBusy: Number(state.globals.IsPlayerBusy || 0),
    pendingSkillID: String(state.globals.PendingSkillID || ''),
    pendingActor: Number(state.globals.PendingActor || 0),
    pendingSuperGem: !!state.globals.PendingSuperGemAction,
    selectedEnemyUID: Number(state.globals.SelectedEnemyUID || 0),
    actionInProgress: Number(state.globals.ActionInProgress || 0),
    actionActorUID: Number(state.globals.ActionActorUID || 0),
    actionOwnerUID: Number(state.globals.ActionOwnerUID || 0),
    deferAdvance: Number(state.globals.DeferAdvance || 0),
    advanceAfterAction: Number(state.globals.AdvanceAfterAction || 0),
    actionLockUntil: Number(state.globals.ActionLockUntil || 0),
    time: Number(state.globals.time || 0),
    heroActionActive: !!(state.globals.HeroAction && state.globals.HeroAction.active),
    enemyActionActive: !!(state.globals.EnemyAction && state.globals.EnemyAction.active),
    pendingHeroHits: Array.isArray(state.globals.PendingHeroHits) ? state.globals.PendingHeroHits.length : 0,
    livingEnemies: state.entities.filter((entity) => entity && entity.kind === 'enemy' && (entity.hp ?? 0) > 0).length,
  };
}

function logActionHandoffDebug(tag, payload = {}) {
  runtimeDebugLogging.gemDebugLog(tag, {
    ...payload,
    snapshot: getActionHandoffSnapshot(),
  }, state);
}

function resolvePendingTargetHandoff({ actorUID, source }) {
  return resolvePendingSuperGemHandoff({
    globals: state.globals,
    actorUID,
    source,
    executePendingSuperGemAction: () => superGemRuntime.executePendingSuperGemAction({
      state,
      callFunctionWithContext,
      fnContext,
    }),
    executeSkill: (skillID, resolvedActorUID) => callFunctionWithContext(
      fnContext,
      'ExecuteSkill',
      skillID,
      resolvedActorUID,
    ),
    hideAttackUI: () => callFunctionWithContext(fnContext, 'HideAttackUI'),
  });
}

function getEnemyRosterStabilitySnapshot() {
  try {
    return callFunctionWithContext(fnContext, 'GetEnemyRosterStability') || { stable: true, pending: false };
  } catch (_) {
    return { stable: true, pending: false };
  }
}

function hasPendingEnemyDeathResolution() {
  const pending = state.globals.PendingDeaths;
  if (!pending || typeof pending !== 'object') return false;
  for (const uidStr of Object.keys(pending)) {
    const uid = Number(uidStr);
    if (!(uid > 0)) continue;
    const actor = state.entities.find((entity) => Number(entity?.uid || 0) === uid);
    if (actor && actor.kind === 'enemy') return true;
  }
  return false;
}

function getYellowSequenceCompletionIntent(current = state.globals, options = undefined) {
  const globals = current || state.globals || {};
  const refill = gameState.refillBounce;
  const handoffPending = !!globals.DeferAdvance && !!globals.AdvanceAfterAction;
  const canRestorePickability =
    !handoffPending &&
    !(refill && refill.active) &&
    state.entities.length > 0 &&
    Number(globals.TurnPhase || 0) === 0 &&
    Number(globals.ActionLockUntil || 0) <= Number(globals.time || 0);
  return createYellowSequenceCompletion(globals, {
    ...(options || {}),
    handoffPending,
    canRestorePickability,
  });
}

function getPresentationTurnBarrier({ hasEmpty = false, enemyLineClearPressureActive = false } = {}) {
  return derivePresentationTurnBarrier({
    globals: state.globals,
    refillBounce: gameState.refillBounce,
    yellowCasino: gameState.yellowCasino,
    gemMergeFx: gameState.gemMergeFx,
    boardHasEmptySlots: hasEmpty,
    enemyLineClearPressureActive,
  });
}

function canResolveDeferredAdvance({ hasEmpty = false, enemyLineClearPressureActive = false } = {}) {
  const presentationBarrier = getPresentationTurnBarrier({ hasEmpty, enemyLineClearPressureActive });
  const refillActive = presentationBarrier.lanes.refillBounce;
  const rosterStability = getEnemyRosterStabilitySnapshot();
  const pendingEnemyDeathResolution = hasPendingEnemyDeathResolution();
  const refillPending = presentationBarrier.refillPending && presentationBarrier.canStartRefill;
  const textHold = presentationBarrier.lanes.textAnimating;
  const pendingSelect = state.globals.TurnPhase === 1 && !!state.globals.PendingSkillID;
  const mergeInFlight = presentationBarrier.lanes.gemMerge;
  const actionActorUID = Number(state.globals.ActionActorUID || 0);
  const heroActionActive = presentationBarrier.lanes.heroAction;
  const enemyActionActive = presentationBarrier.lanes.enemyAction;
  const actionLockActive = Number(state.globals.ActionLockUntil || 0) > Number(state.globals.time || 0);
  const staleActionInProgress = !!state.globals.ActionInProgress &&
    !heroActionActive &&
    !enemyActionActive &&
    !actionLockActive;
  const staleBusy = !!state.globals.IsPlayerBusy && !state.globals.ActionInProgress && !pendingSelect;
  const blockedPhase = !!state.globals.IsPlayerBusy ||
    (!!state.globals.ActionInProgress && !staleActionInProgress) ||
    !!pendingSelect ||
    !presentationBarrier.canAdvanceTurn;
  const ownerUID = Number(state.globals.ActionOwnerUID || 0);
  const currentUID = Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
  const ownerOk = !ownerUID || ownerUID === currentUID;
  return {
    refillActive,
    refillPending,
    textHold,
    pendingSelect,
    mergeInFlight,
    heroActionActive,
    enemyActionActive,
    staleActionInProgress,
    staleBusy,
    blockedPhase,
    presentationBarrier,
    ownerUID,
    currentUID,
    ownerOk,
    enemyRosterStability: rosterStability,
    pendingEnemyDeathResolution,
    ok: (rosterStability.stable || pendingEnemyDeathResolution) && !refillPending && !textHold && !blockedPhase && ownerOk,
  };
}

function canClaimPendingSkillDraught({ hasEmpty = false, enemyLineClearPressureActive = false } = {}) {
  if (!Number(state.globals.SkillDraughtPendingOpen || 0)) return false;
  if (Number(state.globals.SkillDraughtOpen || 0)) return false;
  const currentTurnType = Number(callFunctionWithContext(fnContext, 'GetCurrentType') ?? -1);
  if (currentTurnType !== 0) return false;
  if (!state.globals.DeferAdvance || !state.globals.AdvanceAfterAction) return false;
  if (Number(state.globals.ActionLockUntil || 0) > Number(state.globals.time || 0)) return false;
  if (state.globals.IsPlayerBusy || state.globals.ActionInProgress || state.globals.PendingSkillID) return false;
  const pendingBarrier = getPresentationTurnBarrier({ hasEmpty, enemyLineClearPressureActive });
  return pendingBarrier.canClaimSkillDraught;
}

function claimPendingSkillDraughtAtHeroCheckpoint({ hasEmpty = false, enemyLineClearPressureActive = false } = {}) {
  if (!canClaimPendingSkillDraught({ hasEmpty, enemyLineClearPressureActive })) return false;
  const result = callFunctionWithContext(fnContext, 'ClaimPendingSkillDraught');
  return !!(result && result.ok);
}

function isHitFlashActive(uid) {
  const flashes = state.globals.HitFlashByUID;
  if (!uid || !flashes || typeof flashes !== 'object') return false;
  const entry = flashes[uid];
  if (entry && typeof entry === 'object') {
    return Number(entry.until || 0) > Number(state.globals.time || 0);
  }
  return Number(entry || 0) > Number(state.globals.time || 0);
}

function getHitFlashTone(uid) {
  const flashes = state.globals.HitFlashByUID;
  if (!uid || !flashes || typeof flashes !== 'object') return 'black';
  const entry = flashes[uid];
  if (entry && typeof entry === 'object') return String(entry.tone || 'black');
  return 'black';
}

function isActiveTaintedGroundZone(zone) {
  if (!zone) return false;
  if (String(zone.effectName || '') !== 'TaintedGround') return false;
  if (String(zone.visual || '') !== 'blight_disc') return false;
  const now = Number(state.globals.time || 0);
  if (now < Number(zone.visualStartsAt || zone.activeAt || 0)) return false;
  const fadeStartedAt = zone.fadeStartedAt == null ? null : Number(zone.fadeStartedAt || 0);
  if (fadeStartedAt == null) return true;
  return (now - fadeStartedAt) < 0.75;
}

function enemyOccupiesTaintedGroundZone(enemy, zone) {
  if (!enemy || !zone) return false;
  const enemySlotIndex = Number(enemy.slotIndex);
  if (Number.isFinite(enemySlotIndex) && enemySlotIndex === Number(zone.slotIndex || 0)) return true;
  const enemyX = Number(enemy.x);
  const enemyY = Number(enemy.y);
  const anchorX = Number(zone.anchorWorldX);
  const anchorY = Number(zone.anchorWorldY);
  if (!Number.isFinite(enemyX) || !Number.isFinite(enemyY) || !Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
    return false;
  }
  const spacing = Number(state.globals.Spacing || ((state.globals.EnemySize || 40) + (state.globals.enemyGAP || 8)) || 48);
  const dx = Math.abs(enemyX - anchorX);
  const dy = Math.abs(enemyY - anchorY);
  return dx <= Math.max(16, spacing * 0.75) && dy <= Math.max(16, spacing * 0.75);
}

function hasPersistentEnemyBlightOverlay(uid) {
  if (!uid) return false;
  const dots = Array.isArray(state.globals.EnemyDamageOverTime) ? state.globals.EnemyDamageOverTime : [];
  for (const dot of dots) {
    if (!dot) continue;
    if (Number(dot.targetUID || 0) !== Number(uid || 0)) continue;
    if (Number(dot.remainingFires || 0) <= 0) continue;
    if (dot.totalDamageRemaining != null && Number(dot.totalDamageRemaining || 0) <= 0) continue;
    if (!String(dot.effectName || 'Blight').startsWith('Blight')) continue;
    return true;
  }
  if (hasPersistentEnemyTaintedGroundOverlay(uid)) return true;
  return false;
}

function hasPersistentEnemyTaintedGroundOverlay(uid) {
  if (!uid) return false;
  const enemy = state.entities.find((entity) => Number(entity && entity.uid || 0) === Number(uid || 0));
  if (!enemy) return false;
  const zones = Array.isArray(state.globals.TaintedGroundZones) ? state.globals.TaintedGroundZones : [];
  for (const zone of zones) {
    if (!isActiveTaintedGroundZone(zone)) continue;
    if (!enemyOccupiesTaintedGroundZone(enemy, zone)) continue;
    return true;
  }
  return false;
}

function getPersistentTaintedGroundOverlays() {
  const zones = Array.isArray(state.globals.TaintedGroundZones) ? state.globals.TaintedGroundZones : [];
  const now = Number(state.globals.time || 0);
  const overlays = [];
  for (const zone of zones) {
    if (!isActiveTaintedGroundZone(zone)) continue;
    const fadeStartedAt = zone.fadeStartedAt == null ? null : Number(zone.fadeStartedAt || 0);
    const fadeAlpha = fadeStartedAt == null
      ? 1
      : Math.max(0, Math.min(1, 1 - ((now - fadeStartedAt) / 0.75)));
    if (fadeAlpha <= 0) continue;
    overlays.push({
      id: String(zone.id || ''),
      slotIndex: Number(zone.slotIndex || 0),
      anchorWorldX: Number(zone.anchorWorldX),
      anchorWorldY: Number(zone.anchorWorldY),
      seed: Number(zone.sourceUID || 0) + Number(zone.slotIndex || 0) * 17,
      alpha: fadeAlpha,
    });
  }
  return overlays;
}

function hasPersistentHeroRegenOverlay() {
  const regens = Array.isArray(state.globals.PartyRegens) ? state.globals.PartyRegens : [];
  for (const regen of regens) {
    if (!regen) continue;
    if (Number(regen.remainingFires || 0) <= 0) continue;
    if (regen.totalHealRemaining != null && Number(regen.totalHealRemaining || 0) <= 0) continue;
    return true;
  }
  return false;
}

function ensureDamageNumberLayer() {
  if (damageNumberLayer || typeof document === 'undefined' || !canvas) return damageNumberLayer;
  const layer = document.createElement('div');
  layer.id = 'orka-damage-number-layer';
  layer.style.position = 'fixed';
  layer.style.pointerEvents = 'none';
  layer.style.left = '0px';
  layer.style.top = '0px';
  layer.style.width = '0px';
  layer.style.height = '0px';
  layer.style.zIndex = '50';
  document.body.appendChild(layer);
  damageNumberLayer = layer;
  return damageNumberLayer;
}

function syncDamageNumberLayerBounds() {
  if (!damageNumberLayer || !canvas || typeof canvas.getBoundingClientRect !== 'function') return;
  const rect = canvas.getBoundingClientRect();
  damageNumberLayer.style.left = `${rect.left}px`;
  damageNumberLayer.style.top = `${rect.top}px`;
  damageNumberLayer.style.width = `${rect.width}px`;
  damageNumberLayer.style.height = `${rect.height}px`;
}

function spawnPendingDamageNumbers(projectToCanvas = null) {
  const texts = state.globals.DamageTexts || [];
  if (!texts.length || typeof projectToCanvas !== 'function') return;
  ensureDamageNumberLayer();
  syncDamageNumberLayerBounds();
  gameState.healBlooms = Array.isArray(gameState.healBlooms) ? gameState.healBlooms : [];
  const layeredTexts = texts
    .map((d, index) => ({ d, index }))
    .sort((a, b) => (Number(a.d?.zIndex || 0) || a.index) - (Number(b.d?.zIndex || 0) || b.index));
  for (const entry of layeredTexts) {
    const d = entry.d;
    if (!d || d.domSpawned) continue;
    d.domSpawned = true;
    const xOffset = d.targetKind === 'hero' ? -10 : (d.targetKind === 'ward' ? 0 : (d.canvasAnchored ? 0 : 10));
    const pos = d.canvasAnchored
      ? { x: Number(d.x || 0) + xOffset, y: Number(d.baseY != null ? d.baseY : (d.y || 0)) }
      : projectToCanvas((d.x || 0) + xOffset, d.baseY != null ? d.baseY : (d.y || 0));
    const isCrit = !!d.isCrit;
    const isEnergyText = d.targetKind === 'energy' || d.kind === 'energy';
    const domKind = isEnergyText
      ? 'energy'
      : (d.kind === 'heal' ? 'heal' : (d.kind === 'ward' ? 'ward' : (d.kind === 'arcane_pulse' ? 'arcane_pulse' : 'damage')));
    const text = isEnergyText
      ? `+${formatDamageValue({ value: d.amount, type: 'heal', isCrit })}`
      : (d.targetKind === 'bar'
        ? formatDamageValue({ value: d.amount, type: 'heal', isCrit })
        : formatDamageValue({ value: d.amount, type: domKind === 'heal' || domKind === 'energy' ? 'heal' : 'damage', isCrit }));
    const animation = createDamageNumber({
      text,
      amount: d.amount,
      partyMaxHP: d.partyMaxHP,
      x: pos.x,
      y: pos.y,
      kind: domKind,
      targetKind: d.targetKind || null,
      isCrit,
      floatAngleDeg: d.floatAngleDeg,
      zIndex: Number(d.zIndex || entry.index || 0),
      container: damageNumberLayer,
      angleDeg: Number(d.floatAngleDeg || 0),
      floatVector: {
        x: Number(d.floatVectorX || 0),
        y: Number(d.floatVectorY || 0),
      },
    });
    if (animation) {
      d.domAnimation = animation;
    } else {
      d.domSpawned = false;
      d.domAnimation = null;
    }
    if (d.kind === 'heal' && d.targetKind === 'hero' && !d.healBloomSpawned) {
      d.healBloomSpawned = true;
      d.healBloomAnimation = createHealBloom({
        x: d.x,
        y: d.baseY != null ? d.baseY : d.y,
      });
      gameState.healBlooms.push(d.healBloomAnimation);
    } else if (d.kind === 'heal' && d.targetKind === 'enemy' && !d.healBloomSpawned) {
      d.healBloomSpawned = true;
      d.healBloomAnimation = createHealBloom({
        x: d.x,
        y: d.baseY != null ? d.baseY : d.y,
      });
      gameState.healBlooms.push(d.healBloomAnimation);
    } else if (d.kind === 'heal' && d.targetKind === 'bar' && !d.healBloomSpawned) {
      d.healBloomSpawned = true;
      const heroPositions = Array.isArray(state.globals.HeroIconPosByIndex) ? state.globals.HeroIconPosByIndex : [];
      for (const pos of heroPositions) {
        if (!pos) continue;
        const bloom = createHealBloom({
          x: Number(pos.x || 0),
          y: Number(pos.y || 0),
        });
        if (bloom) gameState.healBlooms.push(bloom);
      }
    }
  }
}
const RUNTIME_FINGERPRINT = createRuntimeFingerprint();
console.info(`[RUNTIME_FINGERPRINT] ${RUNTIME_FINGERPRINT.label}`);
if (!RUNTIME_FINGERPRINT.orka69rReady) {
  console.warn('[RUNTIME_CONTRACT] ORKA-69r not present in this build (69R:MISSING).');
}

const layoutHarnessEnabled = (() => {
  return HARNESS_MODE;
})();
let detachRuntimeInputListeners = null;

function getHeroUIDByIndex(idx) {
  const hero = state.entities.find(e => e.kind === 'hero' && (e.heroDisplaySlot === idx || e.heroIndex === idx));
  return hero ? hero.uid : 0;
}

const gameState = createInitialGameState();

let devToolingRuntime = null;

function requireDevToolingRuntime() {
  if (!devToolingRuntime) throw new Error('Dev tooling runtime not initialized');
  return devToolingRuntime;
}

function createDefaultDevToolingConfig() {
  return requireDevToolingRuntime().createDefaultDevToolingConfig();
}

function sanitizeDevToolingConfig(input = {}) {
  return requireDevToolingRuntime().sanitizeDevToolingConfig(input);
}

function ensureDevToolingConfig() {
  return requireDevToolingRuntime().ensureDevToolingConfig();
}

function getConfiguredHeroCount() {
  return requireDevToolingRuntime().getConfiguredHeroCount();
}

function getConfiguredEnemyCount() {
  return requireDevToolingRuntime().getConfiguredEnemyCount();
}

function getDevToolHeroOptions() {
  return requireDevToolingRuntime().getDevToolHeroOptions();
}

function getDevToolEnemyOptions() {
  return requireDevToolingRuntime().getDevToolEnemyOptions();
}

function getConfiguredHeroSlots() {
  return requireDevToolingRuntime().getConfiguredHeroSlots();
}

function getConfiguredEnemySlots() {
  return requireDevToolingRuntime().getConfiguredEnemySlots();
}

function readEscortPartyConfig() {
  return requireDevToolingRuntime().readEscortPartyConfig();
}

function buildConfiguredCombatPartyMembers(configuredHeroSlots, escortConfig = null) {
  return requireDevToolingRuntime().buildConfiguredCombatPartyMembers(configuredHeroSlots, escortConfig);
}

function updateDevToolingStatus(message = '') {
  return requireDevToolingRuntime().updateDevToolingStatus(message);
}

function applyDevToolingConfig(patch = {}, options = {}) {
  return requireDevToolingRuntime().applyDevToolingConfig(patch, options);
}

function ensureDevToolingModal() {
  return requireDevToolingRuntime().ensureDevToolingModal();
}

function closeDevToolingModal(options = {}) {
  return requireDevToolingRuntime().closeDevToolingModal(options);
}

function resetCombatRuntimeForFreshSession(reason = 'combat-refresh', options = {}) {
  return requireDevToolingRuntime().resetCombatRuntimeForFreshSession(reason, options);
}

function hardRestartRuntimeFromDevTooling() {
  return requireDevToolingRuntime().hardRestartRuntimeFromDevTooling();
}

function toggleDevToolingModal(nextOpen = null) {
  return requireDevToolingRuntime().toggleDevToolingModal(nextOpen);
}

function isDevToolingHotkey(ev) {
  return requireDevToolingRuntime().isDevToolingHotkey(ev);
}

function isEditableDomTarget(target) {
  return requireDevToolingRuntime().isEditableDomTarget(target);
}

const {
  ensureIdleFarmSession,
  startIdleFarmEmissions,
  updateIdleFarmEmissions,
  updateIdleFarmSession,
  restartIdleFarmSession,
  claimIdleFarmRewards,
} = createIdleFarmAppRuntime({
  gameState,
  state,
  getDevToolingConfig: ensureDevToolingConfig,
  getFallbackRoster: () => CANONICAL_HERO_ROSTER.map((hero) => String(hero?.name || '')).filter(Boolean),
  getNowSec: () => performance.now() / 1000,
});

function getTask015TraceStore() {
  return task015TraceState.getTask015TraceStore(gameState);
}

function updateStartupLoadState(patch = {}) {
  return task015TraceState.updateStartupLoadState(gameState, patch);
}

function traceTask015YellowQueue(queue) {
  task015TraceState.traceTask015YellowQueue(gameState, queue);
}

function traceTask015YellowWrite(source, item, step) {
  task015TraceState.traceTask015YellowWrite({ gameState, state, source, item, step });
}

function traceTask015YellowAnimation(stage, payload = {}) {
  task015TraceState.traceTask015YellowAnimation({ gameState, state, stage, payload });
}
let COMBAT_LAYOUT_READY = false;
let COMBAT_BOOTSTRAP_COMPLETE = false;

const eventBus = createHarnessEventBus();
let layoutState = null;
const animationLayer = null;
const combatRuntimeGateway = new CombatRuntimeGateway({
  combatState: gameState,
  eventBus,
  layoutState: null,
  callFunctionWithContext,
  getAuthoritativeTurnState() {
    const g = (state && state.globals) ? state.globals : {};
    return {
      turnQueue: Array.isArray(g.TurnOrderArray) ? g.TurnOrderArray : [],
      currentActorIndex: Number(g.CurrentTurnIndex || 0),
      capturedAtTick: Number(g.time || 0),
    };
  },
  applyAuthoritativeTurnState(turnState) {
    const g = (state && state.globals) ? state.globals : {};
    g.TurnOrderArray = Array.isArray(turnState.turnQueue) ? helpers.cloneJson(turnState.turnQueue) : [];
    g.CurrentTurnIndex = Number(turnState.currentActorIndex || 0);
    const active = g.TurnOrderArray[g.CurrentTurnIndex];
    if (active && typeof active === 'object') {
      if (active.uid != null) g.CurrentTurn = Number(active.uid || 0);
      if (active.type != null) g.CurrentTurnType = Number(active.type || 0);
    }
  },
  getDeterministicRngState() {
    const g = (state && state.globals) ? state.globals : {};
    return {
      RuntimeRandomSeed: Number(g.RuntimeRandomSeed || 0),
      RuntimeRandomDraws: Number(g.RuntimeRandomDraws || 0),
      RuntimeRandomOwner: String(g.RuntimeRandomOwner || ''),
      RuntimeRandomReason: String(g.RuntimeRandomReason || ''),
      RuntimeRandomLastValue: Number(g.RuntimeRandomLastValue || 0),
    };
  },
});

function computeCombatPower(atk, def, hp) {
  const a = Number(atk || 0);
  const d = Number(def || 0);
  const h = Number(hp || 0);
  const result = Math.round((a + d + (h / 10)) * 100) / 100;
  return shadowCombatPower({
    source: 'app.computeCombatPower',
    atk: a,
    def: d,
    hp: h,
    jsValue: result,
  });
}
function getHeroScreenRoster() {
  const runtimeHeroes = (state.entities || [])
    .filter(e => e && e.kind === 'hero')
    .sort((a, b) => Number(a.heroDisplaySlot ?? a.heroIndex ?? 0) - Number(b.heroDisplaySlot ?? b.heroIndex ?? 0));
  return CANONICAL_HERO_ROSTER.map((hero, idx) => {
    const live = runtimeHeroes.find((entry) =>
      Number(entry?.heroIndex ?? -1) === idx ||
      String(entry?.baseHeroName || entry?.name || '') === String(hero.name || ''),
    );
    return {
      uid: Number(live?.uid || (idx + 1)),
      kind: 'hero',
      name: String(hero.name || live?.baseHeroName || live?.name || `Hero ${idx + 1}`),
      baseHeroName: String(hero.name || live?.baseHeroName || live?.name || `Hero ${idx + 1}`),
      heroIndex: idx,
      heroDisplaySlot: Number(live?.heroDisplaySlot ?? idx),
      hp: Number(live?.hp || hero.hp || 0),
      maxHP: Number(live?.maxHP || hero.maxHP || hero.hp || 0),
      combatPower: Number(
        live?.combatPower
        || computeCombatPower(hero.ATK, hero.DEF, hero.maxHP || hero.hp)
      ),
      attackType: live?.attackType || hero.attackType,
      stats: {
        ATK: Number(live?.stats?.ATK ?? hero.ATK ?? 0),
        DEF: Number(live?.stats?.DEF ?? hero.DEF ?? 0),
        MAG: Number(live?.stats?.MAG ?? hero.MAG ?? 0),
        RES: Number(live?.stats?.RES ?? hero.RES ?? 0),
        SPD: Number(live?.stats?.SPD ?? hero.SPD ?? 0),
      },
    };
  });
}

async function assignSelectedHeroToPartySlot(slotIndex = 0) {
  const roster = getHeroScreenRoster();
  const hero = roster[normalizeHeroSelectionIndex()] || null;
  if (!hero) return null;
  const currentSlots = normalizePartyFormationSlots(getConfiguredHeroSlots());
  const nextSlots = assignHeroToPartySlot(currentSlots, hero.name, slotIndex);
  uiState.setUIStateField('heroScreenSelectedPartySlot', Math.max(0, Math.min(3, Math.floor(Number(slotIndex || 0)))));
  return applyDevToolingConfig({ heroSlots: nextSlots }, { closeModal: false });
}

function getHeroStatValue(hero, key) {
  if (!hero) return 0;
  const stats = hero.stats || {};
  if (key === 'HP') {
    return {
      hp: Number(hero.hp || 0),
      maxHP: Number(hero.maxHP || hero.hp || 0),
    };
  }
  const nestedValue = Number(stats[key]);
  if (Number.isFinite(nestedValue)) return nestedValue;
  const topLevelValue = Number(hero[key]);
  if (Number.isFinite(topLevelValue)) return topLevelValue;
  return 0;
}

function getHeroStarterSkillTitle(heroName) {
  const key = String(heroName || '');
  const byHero = {
    Falie: 'Pummel',
    Huun: 'Swipe',
    Runa: 'Burst',
    Kojonn: 'Faze',
  };
  return byHero[key] || 'Skill 1 Placeholder';
}

function getCombatPartyRenderRoster() {
  return (state.entities || [])
    .filter((entity) => entity && (entity.kind === 'hero' || entity.kind === 'escort'))
    .sort((a, b) => Number(a.heroDisplaySlot ?? a.escortDisplaySlot ?? 0) - Number(b.heroDisplaySlot ?? b.escortDisplaySlot ?? 0))
    .map((actor) => ({
      name: actor.name,
      portraitName: String(actor.baseHeroName || actor.portraitName || actor.name || ''),
      idx: Number(actor.heroIndex || 0),
      displaySlot: Number(actor.heroDisplaySlot ?? actor.escortDisplaySlot ?? 0),
      uid: Number(actor.uid || 0),
      kind: String(actor.kind || ''),
    }));
}

function getHeroRoleLabel(hero) {
  const heroName = String(hero && hero.name || '');
  if (heroName === 'Kojonn') return 'Saboteur';
  const type = String(hero && (hero.attackType || hero.stats?.attackType) || '').toLowerCase();
  if (type === 'magic') return 'Arcanist';
  return 'Vanguard';
}

function buildHeroSkillDescriptionLines(hero, skillState) {
  const heroName = String(hero && hero.name || 'Hero');
  const role = getHeroRoleLabel(hero);
  const key = String(skillState && skillState.key || '');
  const rank = Math.max(0, Math.floor(Number(skillState && skillState.rank) || 0));
  const maxRank = Math.max(1, Math.floor(Number(skillState && skillState.maxRank) || 1));
  const nextCost = Math.max(0, Math.floor(Number(skillState && skillState.nextCost) || 0));
  const status = String(skillState && skillState.status || 'locked');
  if (key === 'skill1') {
    if (heroName === 'Kojonn') {
      return [
        `Faze: blight over time on all enemies.`,
        `Rank ${rank}/${maxRank}  Next Cost ${nextCost} SP`,
        `Status ${status}`,
      ];
    }
    return [
      `${heroName}'s signature ${role.toLowerCase()} move.`,
      `Rank ${rank}/${maxRank}  Next Cost ${nextCost} SP`,
      `Status ${status}`,
    ];
  }
  if (key === 'skill2') {
    if (heroName === 'Kojonn') {
      return [
        `Red match: rapid cluster burst on one target.`,
        `Rank ${rank}/${maxRank}  Next Cost ${nextCost} SP`,
        `Status ${status}`,
      ];
    }
    return [
      `Secondary lane ability for ${heroName}.`,
      `Rank ${rank}/${maxRank}  Next Cost ${nextCost} SP`,
      `Status ${status}`,
    ];
  }
  return [
    `Advanced technique for ${heroName}.`,
    `Rank ${rank}/${maxRank}  Next Cost ${nextCost} SP`,
    `Status ${status}`,
  ];
}

function getHeroScreenSkillCards(hero) {
  const heroIndex = Number(hero && hero.heroIndex);
  const sourceEntries = [
    {
      title: getHeroStarterSkillTitle(hero && hero.name),
      description: buildHeroSkillDescriptionLines(hero, { key: 'skill1', rank: 0, maxRank: 15, nextCost: 0, status: 'locked' }).join(' '),
      badge: 'CS',
      iconShape: 'circle',
      spriteCrop: null,
      actionable: true,
    },
    {
      title: 'Skill 2',
      description: buildHeroSkillDescriptionLines(hero, { key: 'skill2', rank: 0, maxRank: 15, nextCost: 0, status: 'locked' }).join(' '),
      badge: 'CS',
      iconShape: 'circle',
      spriteCrop: null,
      actionable: true,
    },
    {
      title: 'Skill 3',
      description: buildHeroSkillDescriptionLines(hero, { key: 'skill3', rank: 0, maxRank: 15, nextCost: 0, status: 'locked' }).join(' '),
      badge: 'JS',
      iconShape: 'diamond',
      spriteCrop: null,
      actionable: true,
    },
  ];
  const fallbackSkillStates = sourceEntries.map((entry, idx) => ({
    slot: idx,
    key: `skill${idx + 1}`,
    title: String(entry.title || `Skill ${idx + 1}`),
    beadId: String(entry.beadId || ''),
    beadDescription: String(entry.description || ''),
    badge: String(entry.badge || (idx === 2 ? 'JS' : 'CS')),
    iconShape: String(entry.iconShape || (idx === 2 ? 'diamond' : 'circle')),
    spriteCrop: entry.spriteCrop || null,
    actionable: entry.actionable !== false,
    rank: 0,
    maxRank: 15,
    nextCost: 0,
    status: entry.actionable === false ? 'pending' : 'locked',
    costs: Array.from({ length: 15 }, (_, costIdx) => (costIdx + 1) * 5),
  }));
  while (fallbackSkillStates.length < 3) {
    const idx = fallbackSkillStates.length;
    fallbackSkillStates.push({
      slot: idx,
      key: `skill${idx + 1}`,
      title: `Skill ${idx + 1}`,
      beadId: '',
      beadDescription: '',
      badge: idx === 2 ? 'JS' : 'CS',
      iconShape: idx === 2 ? 'diamond' : 'circle',
      spriteCrop: null,
      actionable: true,
      rank: 0,
      maxRank: 15,
      nextCost: 0,
      status: 'locked',
      costs: Array.from({ length: 15 }, (_, costIdx) => (costIdx + 1) * 5),
    });
  }
  const heroUID = Number(hero && hero.uid) || getHeroUIDByIndex(Number.isFinite(heroIndex) ? heroIndex : 0);
  const stateMap = heroUID
    ? (callFunctionWithContext(fnContext, 'GetAllHeroSkillStates', heroUID) || {})
    : {};
  const liveStates = Object.values(stateMap)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, idx) => {
      const directSlot = Math.floor(Number(entry.slot));
      const fromKeyMatch = String(entry.key || '').match(/^skill(\d+)$/i);
      const fromKeySlot = fromKeyMatch ? (Math.floor(Number(fromKeyMatch[1])) - 1) : NaN;
      const slot = Number.isFinite(directSlot) && directSlot >= 0
        ? directSlot
        : (Number.isFinite(fromKeySlot) && fromKeySlot >= 0 ? fromKeySlot : idx);
      return {
        slot,
        key: String(entry.key || ''),
        title: String(entry.title || ''),
        rank: Math.max(0, Math.floor(Number(entry.rank) || 0)),
        maxRank: Math.max(0, Math.floor(Number(entry.maxRank) || 0)),
        nextCost: Math.max(0, Math.floor(Number(entry.nextCost) || 0)),
        status: String(entry.status || 'locked'),
        costs: Array.isArray(entry.costs) ? entry.costs : null,
      };
    })
    .sort((a, b) => a.slot - b.slot);
  const liveBySlot = new Map();
  for (const skill of liveStates) {
    if (!skill || !Number.isFinite(skill.slot)) continue;
    liveBySlot.set(skill.slot, skill);
  }
  return fallbackSkillStates.slice(0, 3).map((fallback, idx) => {
    const live = liveBySlot.get(idx) || null;
    const source = sourceEntries[idx] || fallbackSkillStates[idx] || {};
    const beadDescription = String(source.description || fallback.beadDescription || '');
    const sourcePending = source.actionable === false;
    const livePending = live && (String(live.status || '') === 'pending' || Number(live.maxRank || 0) <= 0);
    const actionable = !sourcePending && !livePending;
    const rank = Math.max(0, Math.floor(Number((live && live.rank) ?? fallback.rank) || 0));
    const maxRank = Math.max(0, Math.floor(Number((live && live.maxRank) ?? fallback.maxRank) || 0));
    const nextCost = Math.max(0, Math.floor(Number((live && live.nextCost) ?? fallback.nextCost) || 0));
    const skillState = {
      key: String((live && live.key) || fallback.key || `skill${idx + 1}`),
      rank,
      maxRank,
      nextCost,
      status: actionable ? String((live && live.status) || fallback.status || 'locked') : 'pending',
    };
    return {
      ...fallback,
      ...(live || {}),
      ...skillState,
      slot: idx,
      title: String((live && live.title) || source.title || fallback.title || `Skill ${idx + 1}`),
      beadId: String(source.beadId || fallback.beadId || ''),
      beadDescription,
      badge: String(source.badge || fallback.badge || ''),
      shape: String(source.iconShape || fallback.iconShape || (idx === 2 ? 'diamond' : 'circle')),
      spriteCrop: source.spriteCrop || fallback.spriteCrop || null,
      actionable,
      costs: (live && Array.isArray(live.costs) ? live.costs : fallback.costs),
      description: beadDescription || buildHeroSkillDescriptionLines(hero, skillState).join(' '),
      rankLabel: `Lv${rank}`,
      lines: buildHeroSkillDescriptionLines(hero, skillState),
    };
  });
}

function normalizeHeroSelectionIndex() {
  const roster = getHeroScreenRoster();
  const maxIndex = Math.max(0, roster.length - 1);
  const selected = Number(gameState.selectedHero || 0);
  if (!Number.isFinite(selected)) {
    gameState.selectedHero = 0;
  } else {
    gameState.selectedHero = Math.max(0, Math.min(maxIndex, Math.floor(selected)));
  }
  return gameState.selectedHero;
}

function renderSkillDraughtOverlay(ctx, canvas, pixelRatio = 1) {
  renderSkillDraught.renderSkillDraughtOverlay({
    ctx,
    canvas,
    dpr: pixelRatio,
    state,
    draught: callFunctionWithContext(fnContext, 'GetSkillDraughtState') || {},
  });
}

function getHeroClassLabel(heroName) {
  const key = String(heroName || '').trim().toLowerCase();
  return HERO_CLASS_LABELS[key] || 'Adventurer';
}

function renderHeroScreenLayoutV2({ ctx, canvas, dpr, gameState, fnContext, closeWinOvalImage, heroPortraitImages, heroSkillSpriteSheetImage, heroSkillIconImages = [] }) {
  const heroRenderResult = renderHeroScreen.renderHeroScreen({
    ctx,
    canvas,
    dpr,
    gameState,
    uiState: uiState.getUIState(),
    fnContext,
    closeWinOvalImage,
    heroPortraitImages,
    heroSkillSpriteSheetImage,
    heroSkillIconImages,
    heroLayoutSpec,
    getHeroClassLabel,
    getHeroScreenRoster,
    normalizeHeroSelectionIndex,
    getHeroUIDByIndex,
    callFunctionWithContext,
    getHeroScreenSkillCards,
  });
  uiState.setUIFields({
    heroScreenMode: heroRenderResult.mode,
    heroScreenSelectedSkillIndex: heroRenderResult.selectedSkillIndex,
    heroScreenHitZones: heroRenderResult.hitZones,
  });
}

function requestMapLocaleLayout(layoutId) {
  if (layoutId === 'tomesLayout') return layoutState.requestLayoutChange('tomesLayout', 'map-tomes-locale');
  if (layoutId === 'artifactsLayout') return layoutState.requestLayoutChange('artifactsLayout', 'map-artifacts-locale');
  if (layoutId === 'mountsLayout') return layoutState.requestLayoutChange('mountsLayout', 'map-mounts-locale');
  if (layoutId === 'collectiblesLayout') return layoutState.requestLayoutChange('collectiblesLayout', 'map-collectibles-locale');
  if (layoutId === 'homesteadLayout') return layoutState.requestLayoutChange('homesteadLayout', 'map-homestead-locale');
  return Promise.resolve(false);
}

function ensureTask011Audit() {
  if (!gameState.task011Audit) {
    gameState.task011Audit = {
      cycleCounter: 0,
      currentActionCycleId: 0,
      currentActionActorUID: 0,
      lastTurnType: null,
      actionCycles: [],
      refillWrites: [],
      enemyBoundaries: [],
    };
  }
  return gameState.task011Audit;
}

function beginTask011ActionCycle(color, actorUID) {
  const audit = ensureTask011Audit();
  audit.cycleCounter += 1;
  audit.currentActionCycleId = audit.cycleCounter;
  audit.currentActionActorUID = Number(actorUID || 0);
  audit.actionCycles.push({
    cycleId: audit.currentActionCycleId,
    color: Number(color),
    actorUID: audit.currentActionActorUID,
    startTime: Number(state.globals.time || 0),
    startTurnPhase: Number(state.globals.TurnPhase || 0),
  });
  return audit.currentActionCycleId;
}

function recordTask011RefillWriteEvent({
  source,
  step,
  cellR,
  cellC,
  reason,
  writeType,
  previousUid,
  newUid,
}) {
  const audit = ensureTask011Audit();
  audit.refillWrites.push({
    cycleId: Number(audit.currentActionCycleId || 0),
    source: String(source || ''),
    step: Number(step || 0),
    cellR: Number(cellR),
    cellC: Number(cellC),
    slotId: `${Number(cellR)},${Number(cellC)}`,
    reason: String(reason || ''),
    writeType: String(writeType || 'set'),
    previousUid: Number(previousUid || 0),
    newUid: Number(newUid || 0),
    time: Number(state.globals.time || 0),
    turnType: Number(callFunctionWithContext(fnContext, 'GetCurrentType') || 0),
    turnPhase: Number(state.globals.TurnPhase || 0),
    boardFillActive: Number(state.globals.BoardFillActive || 0),
  });
}

function trackTask011EnemyBoundary(turnType) {
  const audit = ensureTask011Audit();
  const currentTurnType = Number(turnType || 0);
  if (audit.lastTurnType === 0 && currentTurnType === 1) {
    audit.enemyBoundaries.push({
      cycleId: Number(audit.currentActionCycleId || 0),
      time: Number(state.globals.time || 0),
      turnPhase: Number(state.globals.TurnPhase || 0),
      boardFillActive: Number(state.globals.BoardFillActive || 0),
      refillActive: !!(gameState.refillBounce && gameState.refillBounce.active),
    });
  }
  audit.lastTurnType = currentTurnType;
}

function setGemArray(arr) {
  state.globals.Gems = arr;
  gameState.gems = arr;
}

const fnContext = createContext({
  getGems: () => (state.globals.Gems || gameState.gems),
  setGems: (gems) => {
    setGemArray(gems);
    rebuildGridFromGems();
  },
  getSelectedGemIndices: () => gameState.selectedGems,
  setSelectedGemIndices: (arr) => {
    gameState.selectedGems = arr;
    if (!arr || arr.length === 0) gameState.selectionLocked = false;
  },
});

const partyStatOsdRuntime = partyStatOsd.createPartyStatOsdRuntime({
  state,
  getEffectiveStat: (hero, stat) => callFunctionWithContext(fnContext, 'GetEffectiveStat', hero, stat),
  getPowerMultiplier: (hero) => callFunctionWithContext(fnContext, 'GetPowerAmpMultiplierForActor', Number(hero?.uid || 0)),
});

devToolingRuntime = createDevToolingRuntime({
  state,
  gameState,
  CANONICAL_HERO_ROSTER,
  callFunctionWithContext,
  fnContext,
  getLayoutState: () => layoutState,
  resetSuperGemBoardState,
  superGemRuntime,
  setGemArray,
  rebuildGridFromGems,
  restartIdleFarmSession,
  hasEmptySlots,
  getPresentationTurnBarrier,
  getEnemyRosterStabilitySnapshot,
  applyTurnGateGlobals,
  createCombatTurnRefreshBaseline,
});

function syncPartyTotals() {
  state.globals.PartyHPByIndex = [...gameState.partyHP];
  state.globals.PartyMaxHPByIndex = [...gameState.partyMaxHP];
  state.globals.PartyHP = gameState.partyHP.reduce((a, b) => a + b, 0);
  state.globals.PartyMaxHP = gameState.partyMaxHP.reduce((a, b) => a + b, 0);
}

function restorePartyToFullHP() {
  if (Array.isArray(gameState.partyMaxHP) && gameState.partyMaxHP.length) {
    gameState.partyHP = gameState.partyMaxHP.map((value) => Math.max(0, Number(value || 0)));
    syncPartyTotals();
    return;
  }
  if (state.globals.PartyMaxHPByIndex && state.globals.PartyMaxHPByIndex.length) {
    state.globals.PartyHPByIndex = [...state.globals.PartyMaxHPByIndex];
    state.globals.PartyHP = Number(state.globals.PartyMaxHP || 0);
    syncFromGlobals();
  }
}

function syncFromGlobals() {
  if (state.globals.PartyHPByIndex && state.globals.PartyHPByIndex.length) {
    gameState.partyHP = [...state.globals.PartyHPByIndex];
  }
  if (state.globals.PartyMaxHPByIndex && state.globals.PartyMaxHPByIndex.length) {
    gameState.partyMaxHP = [...state.globals.PartyMaxHPByIndex];
  }
  if (state.globals.EnemyHPByIndex && state.globals.EnemyHPByIndex.length) {
    gameState.enemyHP = [...state.globals.EnemyHPByIndex];
  }
  if (state.globals.EnemyMaxHPByIndex && state.globals.EnemyMaxHPByIndex.length) {
    gameState.enemyMaxHP = [...state.globals.EnemyMaxHPByIndex];
  }
  if (state.globals.Gems && Array.isArray(state.globals.Gems)) {
    gameState.gems = state.globals.Gems;
  }
}

function assertCombatLayoutDev(functionName) {
  if (!state || !state.globals || !state.globals.DevTestMode) return;
  const activeLayoutId = (layoutState && typeof layoutState.getActiveLayoutId === 'function')
    ? layoutState.getActiveLayoutId()
    : null;
  if (activeLayoutId !== 'combat') {
    throw new Error(`[LayoutAssert] ${functionName} called outside combat layout (active=${activeLayoutId})`);
  }
}

// Board geometry (matches legacy Initializer.js defaults)
const boardGeometry = {
  cols: 6,
  rows: 4,
  cellSize: 45,
  gap: 2,
  gx: 32,      // top-left x
  gy: 365,     // top-left y
};

function logFetchJsonFailure(url, category, details = {}) {
  console.warn('[fetchJson] load failure', {
    category,
    url: String(url || ''),
    ...details,
  });
}

function getAssetPathFallbackUrl(url) {
  try {
    const current = new URL(String(url || ''), window.location.href);
    if (current.pathname.startsWith('/assets/')) {
      return new URL(`/web-runner${current.pathname}`, current.origin).toString();
    }
  } catch {}
  return null;
}

const jsonFetchSessionNonce = String(Date.now());
let jsonFetchSeq = 0;
function withJsonCacheBust(url) {
  try {
    const u = new URL(String(url || ''), window.location.href);
    u.searchParams.set('__cb', `${jsonFetchSessionNonce}-${jsonFetchSeq++}`);
    return u.toString();
  } catch {
    return String(url || '');
  }
}

async function fetchJson(url){
  const requestUrl = String(url || '');
  const parseResponseJson = async (res, urlForLog, categoryPrefix) => {
    try {
      return await res.json();
    } catch (e) {
      logFetchJsonFailure(urlForLog, `${categoryPrefix}_json_parse_error`, {
        message: String(e?.message || e || 'unknown'),
      });
      return null;
    }
  };
  const fetchWithServerHints = async (u) => {
    const res = await fetch(u, { cache: 'no-store' });
    const server = res.headers?.get?.('server') || '';
    const via = res.headers?.get?.('via') || '';
    const poweredBy = res.headers?.get?.('x-powered-by') || '';
    return { res, hints: { server, via, poweredBy } };
  };
  try {
    const primaryUrl = withJsonCacheBust(requestUrl);
    const { res: r, hints } = await fetchWithServerHints(primaryUrl);
    if (!r.ok) {
      if (r.status >= 500) {
        const retryUrl = new URL(primaryUrl, window.location.href);
        retryUrl.searchParams.set('cb', String(Date.now()));
        try {
          const { res: retryRes, hints: retryHints } = await fetchWithServerHints(retryUrl.toString());
          if (retryRes.ok) {
            return await parseResponseJson(retryRes, retryUrl.toString(), 'retry');
          }
          logFetchJsonFailure(retryUrl.toString(), 'http_error_retry', {
            status: retryRes.status,
            statusText: retryRes.statusText || '',
            primaryUrl: requestUrl,
            ...retryHints,
          });
        } catch (retryErr) {
          logFetchJsonFailure(retryUrl.toString(), 'network_error_retry', {
            message: String(retryErr?.message || retryErr || 'unknown'),
            primaryUrl: requestUrl,
          });
        }
      }
      const fallbackUrl = getAssetPathFallbackUrl(requestUrl);
      if (fallbackUrl && fallbackUrl !== requestUrl) {
        try {
          const { res: fallback, hints: fallbackHints } = await fetchWithServerHints(fallbackUrl);
          if (fallback.ok) {
            return await parseResponseJson(fallback, fallbackUrl, 'fallback');
          }
          logFetchJsonFailure(fallbackUrl, 'http_error_fallback', {
            status: fallback.status,
            statusText: fallback.statusText || '',
            primaryUrl: requestUrl,
            ...fallbackHints,
          });
        } catch (fallbackErr) {
          logFetchJsonFailure(fallbackUrl, 'network_error_fallback', {
            message: String(fallbackErr?.message || fallbackErr || 'unknown'),
            primaryUrl: requestUrl,
          });
        }
      }
      logFetchJsonFailure(requestUrl, 'http_error', {
        status: r.status,
        statusText: r.statusText || '',
        ...hints,
      });
      return null;
    }
    return await parseResponseJson(r, requestUrl, 'primary');
  } catch (e) {
    const fallbackUrl = getAssetPathFallbackUrl(requestUrl);
    if (fallbackUrl && fallbackUrl !== requestUrl) {
      try {
        const { res: fallback, hints: fallbackHints } = await fetchWithServerHints(fallbackUrl);
        if (fallback.ok) {
          return await parseResponseJson(fallback, fallbackUrl, 'fallback');
        }
        logFetchJsonFailure(fallbackUrl, 'http_error_fallback', {
          status: fallback.status,
          statusText: fallback.statusText || '',
          primaryUrl: requestUrl,
          ...fallbackHints,
        });
      } catch (fallbackErr) {
        logFetchJsonFailure(fallbackUrl, 'network_error_fallback', {
          message: String(fallbackErr?.message || fallbackErr || 'unknown'),
          primaryUrl: requestUrl,
        });
      }
    }
    logFetchJsonFailure(requestUrl, 'network_error', { message: String(e?.message || e || 'unknown') });
    return null;
  }
}

const assetBaseUrl = new URL('./assets/', import.meta.url);
function assetUrl(path){
  return new URL(String(path || ''), assetBaseUrl).toString();
}

const runtimeImageBaseUrl = assetUrl('images/');

function resolveRuntimeImageUrl(inputUrl){
  if (!inputUrl) return inputUrl;
  try {
    const raw = String(inputUrl);
    if (raw.startsWith('images/')) {
      return new URL(raw.slice('images/'.length), runtimeImageBaseUrl).toString();
    }
    return new URL(raw, window.location.href).toString();
  } catch {
    return String(inputUrl);
  }
}

function summaryText(layout, types, enemies){
  const parts = [];
  parts.push(layout ? `layout: ${layout.name||'unnamed'}` : 'layout: missing');
  parts.push(types ? `objectTypes: ${Object.keys(types).length}` : 'objectTypes: missing');
  parts.push(enemies ? `enemies: ${Array.isArray(enemies)?enemies.length: Object.keys(enemies||{}).length}` : 'enemies: missing');
  return parts.join('\n');
}

function parseC2ArrayTable(c2) {
  if (!c2 || !c2.c2array || !Array.isArray(c2.data)) return [];
  const cols = c2.data;
  if (cols.length === 0) return [];
  const rows = cols[0].length;
  if (!rows) return [];
  const headers = cols.map(col => (col[0] ? String(col[0][0]) : ''));
  const items = [];
  for (let y = 1; y < rows; y++) {
    const item = {};
    for (let x = 0; x < cols.length; x++) {
      const key = headers[x];
      const cell = cols[x][y] ? cols[x][y][0] : '';
      item[key] = cell;
    }
    if (item.name) items.push(item);
  }
  return items;
}

function createSeededRng(seed = 1) {
  return createSimulationCoreSeededRng(seed, { source: 'app.createSeededRng' });
}

function normalizeRuntimeRngSeed(seed = 1) {
  const raw = Number(seed);
  const normalized = Number.isFinite(raw) ? (Math.floor(raw) >>> 0) : 1;
  return normalized || 1;
}

function deriveCombatRuntimeRngSeed(encounterSeed = 1) {
  const base = normalizeRuntimeRngSeed(encounterSeed);
  return ((base ^ COMBAT_RUNTIME_RNG_SALT) >>> 0) || 1;
}

function createCombatRuntimeRandom(seed = 1, options = {}) {
  const normalizedSeed = normalizeRuntimeRngSeed(seed);
  const source = String(options.source || 'app.combatRuntimeRng');
  const next = createSimulationCoreSeededRng(normalizedSeed, { source });
  let draws = 0;
  return function runtimeRandom() {
    draws += 1;
    const rawValue = Number(next());
    const value = Number.isFinite(rawValue) && rawValue >= 0 && rawValue < 1 ? rawValue : 0;
    state.globals.RuntimeRandomDraws = draws;
    state.globals.RuntimeRandomLastValue = value;
    state.globals.RuntimeRandomOwner = 'rust';
    return value;
  };
}

function installCombatRuntimeRandom(seed = 1, reason = 'combat-session') {
  const normalizedSeed = normalizeRuntimeRngSeed(seed);
  state.globals.RuntimeRandomSeed = normalizedSeed;
  state.globals.RuntimeRandomDraws = 0;
  state.globals.RuntimeRandomOwner = 'rust';
  state.globals.RuntimeRandomReason = String(reason || 'combat-session');
  state.globals.RuntimeRandomLastValue = 0;
  state.globals.RuntimeRandom = createCombatRuntimeRandom(normalizedSeed, {
    source: 'app.combatRuntimeRng',
  });
  return state.globals.RuntimeRandom;
}

function runSeededRngShadowStartupChecks() {
  const cases = [
    [1, 1, 6],
    [1, 2, 6],
    [123456789, 1, 10],
    [123456789, 3, 10],
    [0, 1, 6],
    [4294967295, 1, 10],
    [987654321, 5, 3],
  ];
  for (const [seed, draws, size] of cases) {
    const rng = createSeededRng(seed);
    let value = 0;
    for (let i = 0; i < draws; i += 1) value = rng();
    shadowSeededRng({
      source: 'app.createSeededRng',
      seed,
      draws,
      size,
      jsState: Math.round(value * 4294967296),
      jsValue: value,
      jsIndex: Math.floor(value * size),
    });
  }
}

function getGemSpawnRandom() {
  const rng = gameState.bootstrapRng;
  if (rng && rng.enabled && typeof rng.next === 'function') {
    return rng.next();
  }
  return Math.random();
}

function resetBootstrapRngSession() {
  if (BOOTSTRAP_SEED == null) {
    gameState.bootstrapRng = {
      enabled: false,
      next: null,
      gemInitRemaining: 0,
    };
    bootstrapDeterministicRefillPending = false;
    return;
  }
  gameState.bootstrapRng = {
    enabled: true,
    next: createSeededRng(BOOTSTRAP_SEED),
    gemInitRemaining: 0,
  };
  bootstrapDeterministicRefillPending = true;
}

const initCombatSessionEntities = createCombatSessionInitializer({
  state,
  gameState,
  fnContext,
  callFunctionWithContext,
  assertCombatLayoutDev,
  computeCombatPower,
  createSeededRng,
  resetBootstrapRngSession,
  generateEncounterSeed,
  deriveCombatRuntimeRngSeed,
  installCombatRuntimeRandom,
  getConfiguredHeroSlots,
  readEscortPartyConfig,
  buildConfiguredCombatPartyMembers,
  getConfiguredEnemySlots,
  syncFromGlobals,
});

function initEntities(enemyRows, layoutInstances) {
  return initCombatSessionEntities(enemyRows, layoutInstances);
}

// Create gem board with active colors (1-5: red, blue, yellow, heal, purple energy).
function createGemBoard(gridBounds = null, { immediateFill = false } = {}) {
  assertCombatLayoutDev('createGemBoard');
  bootstrapDeterministicRefillPending = BOOTSTRAP_SEED != null;
  gameState.gems = [];
  gameState.grid = [];
  resetSuperGemBoardState(gameState);
  const g = boardGeometry;
  
  // Calculate board dimensions
  const boardWidth = g.cols * g.cellSize + (g.cols - 1) * g.gap;
  const boardHeight = g.rows * g.cellSize + (g.rows - 1) * g.gap;
  
  // If grid bounds provided, center the gem board within them
  let startX = g.gx;
  let startY = g.gy;
  
  if (gridBounds) {
    const gridWidth = gridBounds.maxX - gridBounds.minX;
    const gridHeight = gridBounds.maxY - gridBounds.minY;
    startX = gridBounds.minX + (gridWidth - boardWidth) / 2;
    startY = gridBounds.minY + (gridHeight - boardHeight) / 2;
    runtimeDebugLogging.startupDebugLog(`[BOARD] Centered within grid bounds: (${startX.toFixed(1)}, ${startY.toFixed(1)})`);
  }
  
  for (let c = 0; c < g.cols; c++) {
    gameState.grid[c] = [];
    for (let r = 0; r < g.rows; r++) {
      gameState.grid[c][r] = 0;
    }
  }

  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  if (gameState.bootstrapRng && gameState.bootstrapRng.enabled) {
    gameState.bootstrapRng.gemInitRemaining = g.cols * g.rows;
  }
  gameState.boardCreated = true;
  setGemArray(gameState.gems);
  state.globals.TapIndex = 0;
  runtimeDebugLogging.startupDebugLog(`[BOARD] Created gem board: ${g.cols}x${g.rows} = ${gameState.gems.length} gems`);
  if (immediateFill) {
    refillGemBoard(gridBounds);
    settleSuperGemShapes({ gameState, state, boardGeometry, reason: 'immediate-fill' });
    state.globals.BoardFillActive = 0;
    return;
  }
  startRefillBounce(0.31);
}

function rebuildGridFromGems() {
  const g = boardGeometry;
  gameState.grid = [];
  for (let c = 0; c < g.cols; c++) {
    gameState.grid[c] = [];
    for (let r = 0; r < g.rows; r++) {
      gameState.grid[c][r] = 0;
    }
  }
  for (const gem of gameState.gems) {
    if (gem && gem.cellC != null && gem.cellR != null) {
      gameState.grid[gem.cellC][gem.cellR] = gem.uid;
    }
  }
}

function randomGemFrame() {
  const forcedColor = Number(state.globals.DevForcedBoardColor);
  if (Number.isFinite(forcedColor) && forcedColor !== DEV_TOOL_GEM_RANDOM && DEV_TOOL_GEM_OPTIONS.some((row) => row.value === forcedColor)) {
    return forcedColor;
  }
  const MAX_PURPLE_ON_BOARD = 3;
  const PURPLE_WEIGHT = 0.25;
  const countPurple = () => (gameState.gems || []).reduce((n, g) => {
    const c = g && g.color != null ? g.color : (g ? g.elementIndex : null);
    return n + (c === 5 ? 1 : 0);
  }, 0);
  const pickByWeightedColors = (entries) => {
    let total = 0;
    for (const entry of entries) total += entry.weight;
    let r = getGemSpawnRandom() * total;
    for (const entry of entries) {
      r -= entry.weight;
      if (r <= 0) return entry.color;
    }
    return entries[0] ? entries[0].color : 1;
  };
  const spawnWeights = GEM_SPAWN_COLORS.map((color) => ({
    color,
    weight: color === 5 ? PURPLE_WEIGHT : 1,
  }));
  let frame = pickByWeightedColors(spawnWeights);
  if (frame === 5 && countPurple() >= MAX_PURPLE_ON_BOARD) {
    frame = pickByWeightedColors(
      GEM_SPAWN_COLORS
        .filter((color) => color !== 5)
        .map((color) => ({ color, weight: 1 })),
    );
  }
  return frame;
}


function refillGemBoard(gridBounds = null) {
  const g = boardGeometry;
  resolveSuperGemDecomposition({ gameState, state, reason: 'refill-gem-board' });
  rebuildGridFromGems();
  let hasEmpty = false;
  for (let c = 0; c < g.cols; c++) {
    for (let r = 0; r < g.rows; r++) {
      if (gameState.grid[c][r] === 0) { hasEmpty = true; break; }
    }
    if (hasEmpty) break;
  }
  if (!hasEmpty) {
    runtimeDebugLogging.startupDebugLog('[BOARD] Refill skipped (board full)');
    return false;
  }
  const boardWidth = g.cols * g.cellSize + (g.cols - 1) * g.gap;
  const boardHeight = g.rows * g.cellSize + (g.rows - 1) * g.gap;
  let startX = g.gx;
  let startY = g.gy;
  if (gridBounds) {
    const gridWidth = gridBounds.maxX - gridBounds.minX;
    const gridHeight = gridBounds.maxY - gridBounds.minY;
    startX = gridBounds.minX + (gridWidth - boardWidth) / 2;
    startY = gridBounds.minY + (gridHeight - boardHeight) / 2;
  }
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (gameState.grid[c][r] !== 0) continue;
      const x = Math.floor(startX + c * (g.cellSize + g.gap) + g.cellSize / 2) + 0.5;
      const y = Math.floor(startY + r * (g.cellSize + g.gap) + g.cellSize / 2) + 0.5;
      const color = randomGemFrame();
      gameState.gems.push({
        uid: gameState.nextGemUID++,
        cellC: c,
        cellR: r,
        color,
        elementIndex: color,
        x,
        y,
        worldX: x,
        worldY: y,
        width: g.cellSize,
        height: g.cellSize,
        selected: false,
        Selected: 0,
        flashUntil: 0
      });
      if (gameState.bootstrapRng && gameState.bootstrapRng.enabled && gameState.bootstrapRng.gemInitRemaining > 0) {
        gameState.bootstrapRng.gemInitRemaining -= 1;
      }
      gameState.grid[c][r] = gameState.gems[gameState.gems.length - 1].uid;
    }
  }
  gameState.boardCreated = true;
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  setGemArray(gameState.gems);
  settleSuperGemShapes({ gameState, state, boardGeometry, reason: 'refill-gem-board' });
  state.globals.TapIndex = 0;
  runtimeDebugLogging.startupDebugLog('[BOARD] Refilled missing gems');
  return true;
}

const YELLOW_CASINO_TELEGRAPH_SEC = 0;
const yellowMatchAnimationDuration = 0;
const YELLOW_CASINO_SPIN_SEC = yellowMatchAnimationDuration;
const YELLOW_CASINO_SETTLE_SEC = 0.16;
const YELLOW_CASINO_SETTLE_BOUNCE_AMP = 0.2;
const YELLOW_CASINO_TARGETS = YELLOW_REFILL_TARGETS;
const YELLOW_CASINO_WALK = [YELLOW_COLOR, ...YELLOW_CASINO_TARGETS];

function getCellWorldPos(cellC, cellR) {
  const g = boardGeometry;
  const boardWidth = g.cols * g.cellSize + (g.cols - 1) * g.gap;
  const boardHeight = g.rows * g.cellSize + (g.rows - 1) * g.gap;
  let startX = g.gx;
  let startY = g.gy;
  if (gameState.gridBounds) {
    const gridWidth = gameState.gridBounds.maxX - gameState.gridBounds.minX;
    const gridHeight = gameState.gridBounds.maxY - gameState.gridBounds.minY;
    startX = gameState.gridBounds.minX + (gridWidth - boardWidth) / 2;
    startY = gameState.gridBounds.minY + (gridHeight - boardHeight) / 2;
  }
  const x = Math.floor(startX + cellC * (g.cellSize + g.gap) + g.cellSize / 2) + 0.5;
  const y = Math.floor(startY + cellR * (g.cellSize + g.gap) + g.cellSize / 2) + 0.5;
  return { x, y, w: g.cellSize, h: g.cellSize };
}

function isBoardGemLocked(gem) {
  if (!gem) return false;
  const countdown = Number(gem.lockCountdown ?? gem.LockCountdown ?? 0);
  return countdown > 0 || gem.locked === true || Number(gem.Locked || 0) === 1;
}

function pickYellowCasinoTarget() {
  const idx = runtimeRandomIndex(YELLOW_CASINO_TARGETS.length);
  return YELLOW_CASINO_TARGETS[idx];
}

function startYellowCasinoSequence(actorUID, initialMatchedYellowCount = 0, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  if (state.globals.GamePhase !== 'RUNTIME') {
    return;
  }
  const now = state.globals.time || 0;
  const casino = gameState.yellowCasino || (gameState.yellowCasino = {});
  casino.mode = 'yellow';
  const queue = [];

  const hasWork = queue.length > 0;
  const totalYellowConsumed = Math.max(0, Number(initialMatchedYellowCount || 0));
  casino.pendingGoldAward = totalYellowConsumed;
  traceTask015YellowQueue(queue);
  traceTask015YellowAnimation('yellow-sequence-start', {
    queueLength: Number(queue.length),
    hasWork: Boolean(hasWork),
  });
  casino.active = hasWork;
  casino.phase = hasWork ? (YELLOW_CASINO_TELEGRAPH_SEC > 0 ? 'telegraph' : 'spin') : 'idle';
  casino.queue = queue;
  casino.index = 0;
  casino.current = null;
  casino.telegraphUntil = now + YELLOW_CASINO_TELEGRAPH_SEC;
  casino.ghost = null;
  casino.goldMergeTarget = opts.goldTarget && Number.isFinite(opts.goldTarget.x) && Number.isFinite(opts.goldTarget.y)
    ? { x: Number(opts.goldTarget.x), y: Number(opts.goldTarget.y) }
    : getGoldLabelTargetWorld();
  casino.goldMergeSources = Array.isArray(opts.mergeSources)
    ? opts.mergeSources
        .filter(Boolean)
        .map((item) => ({
          x: Number(item.x || 0),
          y: Number(item.y || 0),
          color: Number(item.color ?? item.elementIndex ?? YELLOW_COLOR),
        }))
    : [];

  runtimeDebugLogging.gemDebugLog('[FILL_GATE]', {
    stage: 'yellow-sequence-start',
    queueLength: queue.length,
    emptyCount: 0,
    globals: {
      CanPickGems: state.globals.CanPickGems,
      IsPlayerBusy: state.globals.IsPlayerBusy,
      PendingSkillID: state.globals.PendingSkillID || '',
      BoardFillActive: state.globals.BoardFillActive,
      TurnPhase: state.globals.TurnPhase,
      DeferAdvance: state.globals.DeferAdvance,
      ActionLockUntil: state.globals.ActionLockUntil,
      MatchedColorValue: state.globals.MatchedColorValue,
      TapIndex: state.globals.TapIndex,
    },
  }, state);
  runtimeDebugLogging.gemDebugLog('[FILL_CANDIDATES]', queue.map((item, idx) => ({
    idx,
    reason: item.reason,
    type: item.type,
    cellR: item.cellR,
    cellC: item.cellC,
    target: item.target,
    uid: item.uid || 0,
  })), state);

  if (hasWork) {
    const totalDuration = YELLOW_CASINO_TELEGRAPH_SEC + (queue.length * YELLOW_CASINO_SPIN_SEC);
    applyTurnGateIntent(createYellowSequenceGate, {
      now,
      totalDuration,
      actorUID,
    });
    state.globals.BoardFillActive = 1;
  } else {
    traceTask015YellowAnimation('yellow-sequence-skip', { reason: 'no-yellow-slots' });
    const pendingGoldAward = Math.max(0, Number(casino.pendingGoldAward || 0));
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
    if (pendingGoldAward > 0) {
      callFunctionWithContext(fnContext, 'Add_Gold', pendingGoldAward);
      casino.pendingGoldAward = 0;
    }
    if (mergeSources.length > 0) {
      startGemMergeFx({
        target: casino.goldMergeTarget || getGoldLabelTargetWorld(),
        scaleOut: false,
        startScale: 1.5,
        sourceItems: mergeSources,
      });
      if (gameState.gemMergeFx && gameState.gemMergeFx.active) {
        gameState.gemMergeFx.releaseGate = {};
        state.globals.CanPickGems = 0;
        state.globals.IsPlayerBusy = 1;
      } else {
        applyTurnGateIntent(createYellowSequenceSkip);
      }
    } else {
      applyTurnGateIntent(createYellowSequenceSkip);
    }
    if (!(gameState.refillBounce && gameState.refillBounce.active)) {
      state.globals.BoardFillActive = 0;
    }
  }
}

function startRefillBounce(speedScale = 1) {
  resolveSuperGemDecomposition({ gameState, state, reason: 'pre-refill' });
  const refill = gameState.refillBounce || (gameState.refillBounce = {});
  refill.speedScale = speedScale;
  const emptySlots = [];
  if (gameState.grid && gameState.grid.length) {
    for (let r = 0; r < boardGeometry.rows; r++) {
      for (let c = 0; c < boardGeometry.cols; c++) {
        if (gameState.grid[c] && gameState.grid[c][r] === 0) {
          emptySlots.push({ cellC: c, cellR: r, reason: 'empty', index: (r * boardGeometry.cols) + c });
        }
      }
    }
  }
  const hasWork = emptySlots.length > 0;
  const store = getTask015TraceStore();
  store.yellowRefillQueue = emptySlots.map((slot, idx) => ({
    idx: Number(idx),
    cellR: Number(slot.cellR || 0),
    cellC: Number(slot.cellC || 0),
    reason: String(slot.reason || ''),
  }));
  runtimeDebugLogging.gemDebugLog('[FILL_GATE]', {
    stage: 'refill-bounce-start',
    hasWork,
    emptyCount: emptySlots.length,
    globals: {
      CanPickGems: state.globals.CanPickGems,
      IsPlayerBusy: state.globals.IsPlayerBusy,
      PendingSkillID: state.globals.PendingSkillID || '',
      BoardFillActive: state.globals.BoardFillActive,
      TurnPhase: state.globals.TurnPhase,
      DeferAdvance: state.globals.DeferAdvance,
      ActionLockUntil: state.globals.ActionLockUntil,
      MatchedColorValue: state.globals.MatchedColorValue,
      TapIndex: state.globals.TapIndex,
    },
  }, state);
  runtimeDebugLogging.gemDebugLog('[FILL_CANDIDATES]', emptySlots.map((slot, idx) => ({
    idx,
    reason: slot.reason,
    cellR: slot.cellR,
    cellC: slot.cellC,
  })), state);
  refill.active = hasWork;
  refill.queue = emptySlots;
  refill.index = 0;
  refill.current = null;
  if (hasWork) {
    state.globals.BoardFillActive = 1;
    applyTurnGateIntent(createRefillStartGate);
  } else {
    runtimeDebugLogging.gemDebugLog('[FILL_SKIP]', { stage: 'refill-bounce-start', reason: 'not-needed' }, state);
  }
}

function hasEmptySlots() {
  if (!gameState.grid || !gameState.grid.length) return false;
  for (let c = 0; c < boardGeometry.cols; c++) {
    for (let r = 0; r < boardGeometry.rows; r++) {
      if (gameState.grid[c] && gameState.grid[c][r] === 0) return true;
    }
  }
  return false;
}

function collectBoardCoverageIssues() {
  const counts = new Map();
  for (const g of (gameState.gems || [])) {
    if (!g) continue;
    const key = `${g.cellR},${g.cellC}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const missingCells = [];
  const duplicates = [];
  for (let r = 0; r < boardGeometry.rows; r++) {
    for (let c = 0; c < boardGeometry.cols; c++) {
      const key = `${r},${c}`;
      const n = counts.get(key) || 0;
      if (n === 0) missingCells.push({ r, c });
      if (n > 1) duplicates.push({ r, c, count: n });
    }
  }
  return { missingCells, duplicates };
}

function tryActivateRuntimePhase() {
  if (state.globals.GamePhase !== 'BOOTSTRAP') return false;
  const refill = gameState.refillBounce;
  const casino = gameState.yellowCasino;
  if (refill && refill.active) return false;
  if (casino && casino.active) return false;
  if (!Array.isArray(gameState.gems) || gameState.gems.length !== (boardGeometry.rows * boardGeometry.cols)) return false;

  const coverage = collectBoardCoverageIssues();
  if (coverage.missingCells.length > 0 || coverage.duplicates.length > 0) return false;

  state.globals.GamePhase = 'RUNTIME';
  state.globals.CanPickGems = true;
  state.globals.BoardFillActive = 0;
  state.globals.IsPlayerBusy = 0;
  console.log('[GAME_PHASE] RUNTIME');
  return true;
}

function getInstanceWorldCenter(typeName) {
  let inst = null;
  const hasAssetsLayout = typeof assetsLayout !== 'undefined' && assetsLayout && Array.isArray(assetsLayout.layers);
  if (hasAssetsLayout) {
    for (const layer of assetsLayout.layers) {
      if (!layer || !Array.isArray(layer.instances)) continue;
      inst = layer.instances.find((item) => item && item.type === typeName && item.world) || null;
      if (inst) break;
    }
  }
  if (!inst || !inst.world) return null;
  const w = Number(inst.world.width || 0);
  const h = Number(inst.world.height || 0);
  const ox = inst.world.originX != null ? Number(inst.world.originX) : 0.5;
  const oy = inst.world.originY != null ? Number(inst.world.originY) : 0.5;
  return {
    x: Number(inst.world.x || 0) + (0.5 - ox) * w,
    y: Number(inst.world.y || 0) + (0.5 - oy) * h,
  };
}

function getGoldLabelTargetWorld() {
  const cached = gameState.goldLabelTargetWorld;
  if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.y)) {
    return { x: Number(cached.x), y: Number(cached.y) };
  }
  return getInstanceWorldCenter('Text_Gold');
}

function startGemMergeFx({ target = null, scaleOut = true, startScale = 1, sourceItems = null } = {}) {
  const now = state.globals.time || 0;
  const fromExplicit = Array.isArray(sourceItems) && sourceItems.length > 0
    ? sourceItems
    : (gameState.selectedGems || []).map(idx => {
        const gm = gameState.gems && gameState.gems[idx];
        if (!gm) return null;
        return { x: gm.x, y: gm.y, color: gm.color ?? gm.elementIndex };
      });
  const items = fromExplicit
    .filter(Boolean)
    .map((item) => ({
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      color: Number(item.color ?? item.elementIndex ?? 0),
    }));
  if (!items.length) return;
  gameState.gemMergeFx = {
    active: true,
    startAt: now,
    duration: 0.28,
    items,
    target,
    scaleOut: !!scaleOut,
    startScale: Number.isFinite(Number(startScale)) ? Math.max(0.05, Number(startScale)) : 1,
    doneAt: null,
  };
}

function handleGemMatch(color) {
  if (state.globals.GamePhase !== 'RUNTIME') {
    return;
  }
  const g = state.globals;
  g.DebugMatchCount = (g.DebugMatchCount || 0) + 1;
  console.log(`[DEBUG] matches=${g.DebugMatchCount} turns=${g.DebugTurnCount || 0}`);
  g.MatchedColorValue = color;
  g.SuppressChainUI = 0;
  state.globals.Gems = gameState.gems;
  if (color == null) {
    const clearLocalSelection = () => {
      fnContext.setSelectedGemIndices([]);
      gameState.selectionLocked = false;
      if (gameState.gems) {
        for (const gm of gameState.gems) {
          gm.selected = false;
          gm.Selected = 0;
        }
      }
      state.globals.TapIndex = 0;
    };
    clearLocalSelection();
    return;
  }
  // lock input while resolving a confirmed match/action
  applyTurnGateGlobals({
    CanPickGems: 0,
    IsPlayerBusy: 1,
    EnemyLineClearPressureActive: 0,
  });

  const currentTurnUID = Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
  const currentTurnActor = currentTurnUID > 0 ? callFunctionWithContext(fnContext, 'GetActorByUID', currentTurnUID) : null;
  const actorUID = currentTurnActor && currentTurnActor.kind === 'hero'
    ? currentTurnUID
    : (getHeroUIDByIndex(gameState.selectedHero) || gameState.selectedHero || currentTurnUID);
  beginTask011ActionCycle(color, actorUID);

  const clearLocalSelection = () => {
    fnContext.setSelectedGemIndices([]);
    gameState.selectionLocked = false;
    if (gameState.gems) {
      for (const gm of gameState.gems) {
        gm.selected = false;
        gm.Selected = 0;
      }
    }
    state.globals.TapIndex = 0;
  };

  const selectedLockedGem = (gameState.selectedGems || []).some((idx) => isBoardGemLocked(gameState.gems && gameState.gems[idx]));
  if (selectedLockedGem) {
    clearLocalSelection();
    return;
  }

  const syncGemsFromGlobals = () => {
    if (state.globals.Gems && Array.isArray(state.globals.Gems)) {
      gameState.gems = state.globals.Gems;
    }
  };
  const rebuildGridAndStartMatchRefill = () => {
    rebuildGridFromGems();
    if (hasEmptySlots() && !(gameState.refillBounce && gameState.refillBounce.active)) {
      startRefillBounce();
    }
  };

  if (color === 0 || color === 1) {
    const matchedCount = Math.max(0, Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0);
    g.TurnPhase = 1;
    callFunctionWithContext(fnContext, 'UpdateChain', color);
    g.IsAOEMatch = 0;
    callFunctionWithContext(fnContext, 'ResolveGemAction', color, actorUID, matchedCount);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridAndStartMatchRefill();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    g.ApplyChainToNextDamage = g.ChainNumber >= 2 ? 1 : 0;
  } else if (color === 2) {
    const consumedBlue = Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0;
    startGemMergeFx();
    g.MatchedColorValue = 0;
    g.IsAOEMatch = 0;
    g.SuppressChainUI = 0;
    g.BlueGemConsumedCount = Math.max(0, Number((gameState.selectedGems || []).length));
    callFunctionWithContext(fnContext, 'UpdateChain', 2);
    callFunctionWithContext(fnContext, 'ResolveGemAction', 2, actorUID, consumedBlue);
    g.BlueGemConsumedCount = 0;
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridAndStartMatchRefill();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    g.ApplyChainToNextDamage = 0;
  } else if (color === 3) {
    const selectedYellowGems = Array.isArray(gameState.selectedGems)
      ? gameState.selectedGems
        .map((selection) => {
          if (selection == null) return null;
          if (typeof selection === 'object') return selection;
          const index = Number(selection);
          return Number.isInteger(index) ? (gameState.gems && gameState.gems[index]) : null;
        })
        .filter((gm) => gm && !isBoardGemLocked(gm) && Number(gm.color ?? gm.elementIndex) === YELLOW_COLOR)
      : [];
    const matchedYellowCount = selectedYellowGems.length;
    const goldTarget = getGoldLabelTargetWorld();
    const actor = state.entities.find(e => e.uid === actorUID);
    const actorName = actor ? (actor.name || 'Hero') : 'Hero';
    const yellowMergeSources = selectedYellowGems
      .map((gm) => ({
        cellC: Number(gm.cellC || 0),
        cellR: Number(gm.cellR || 0),
        x: Number(gm.x || 0),
        y: Number(gm.y || 0),
        color: gm.color ?? gm.elementIndex,
      }));
    callFunctionWithContext(fnContext, 'ResolveGemAction', 3, actorUID, matchedYellowCount);
    callFunctionWithContext(fnContext, 'LogCombat', `${actorName} used Wild Magic!`);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridAndStartMatchRefill();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    startYellowCasinoSequence(actorUID, matchedYellowCount, {
      goldTarget,
      mergeSources: yellowMergeSources,
    });
    if (!(gameState.yellowCasino && gameState.yellowCasino.active)) {
      applyTurnGateIntent(createYellowSafetyNet, {
        now: Number(state.globals.time || 0),
        currentTurnUID: actorUID,
      });
    }
  } else if (color === 4) {
    const matchedCount = Math.max(0, Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0);
    g.MatchedColorValue = 4;
    g.IsAOEMatch = 0;
    callFunctionWithContext(fnContext, 'UpdateChain', 4);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridAndStartMatchRefill();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    callFunctionWithContext(fnContext, 'ResolveGemAction', 4, actorUID, matchedCount);
  } else if (color === 5) {
    const matchedCount = Math.max(0, Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridAndStartMatchRefill();
    callFunctionWithContext(fnContext, 'ResolveGemAction', 5, actorUID, matchedCount);
    callFunctionWithContext(fnContext, 'Sub_Energy', 1);
  }

  console.log(
    `[MATCH] post-resolve color=${color} TurnPhase=${g.TurnPhase} ` +
    `IsPlayerBusy=${g.IsPlayerBusy} DeferAdvance=${g.DeferAdvance} ` +
    `ActionLockUntil=${g.ActionLockUntil} PendingSkillID=${g.PendingSkillID || ''}`
  );

  gameState.boardCreated = gameState.gems.length > 0;
  if (!gameState.boardCreated) {
    combatRuntimeGateway.runCombatBoardInit(createGemBoard, gameState.gridBounds);
  }
  const immediateEnemyTurnBarrier = getPresentationTurnBarrier({
    hasEmpty: hasEmptySlots(),
    enemyLineClearPressureActive: !!state.globals.EnemyLineClearPressureActive,
  });
  if (state.globals.TurnPhase === 2 && immediateEnemyTurnBarrier.canClaimCombatAction) {
    callFunctionWithContext(fnContext, 'EnemyTurn');
  }
  syncFromGlobals();
}

function tryGetInstances(layout){
  if (!layout || !Array.isArray(layout.layers)) return [];
  const instances = layout.layers.flatMap((layer, layerIndex) => {
    if (!layer || !Array.isArray(layer.instances)) return [];
    return layer.instances.map((instance) => ({
      ...instance,
      layerIndex,
      layerName: layer.name || 'Unknown',
    }));
  });
  runtimeDebugLogging.startupDebugLog('[LAYOUT_AUDIT] flattenedInstanceCount', instances.length);
  return instances;
}

function shouldSuppressCombatLayoutInstance(instance) {
  if (!instance || typeof instance.type !== 'string') return false;
  return (instance.layerName === 'BoardBG' && instance.type === 'Sprite5')
    || instance.type === 'BuffText'
    || instance.type === 'buffIcon1'
    || instance.type === 'buffIcon2'
    || instance.type === 'buffIcon3'
    || instance.type === 'buffIcon4';
}

function makeImagePath(typeName, animName){
  if(!typeName) return null;
  const t = typeName.toLowerCase();
  const a = (animName||'animation 1').toLowerCase();
  // common filenames: type-anim-000.png, allow spaces
  return assetUrl(`images/${t}-${a}-000.png`);
}

async function main(){
  const HARNESS_MODE = window.location.search.includes('harness=true');
  if (HARNESS_MODE) {
    console.log('[Harness] Enabled');
    console.log('[Harness] Boot override BEFORE C3 init');

    const inputDomains = new HarnessInputDomainManager(eventBus);

    const createLayoutStateSingleton = ({ eventBus: bus, inputDomains: domains, combatRuntimeGateway: gateway }) =>
      createHarnessLayoutState({ eventBus: bus, inputDomains: domains, combatRuntimeGateway: gateway });

    const registerCoreLayouts = (layoutState, { combatGateway: gateway }) => {
      layoutState.registerLayout({
        id: 'combat',
        allowedTransitions: ['base', 'shop', 'intro', 'astralOverlay'],
        onEnter({ resumeSnapshot }) {
          gateway.resume(resumeSnapshot || null);
          eventBus.emit('layout:combat:entered', { restored: Boolean(resumeSnapshot) });
        },
        onActive() {},
        onExit() {
          return gateway.suspend();
        },
      });
      layoutState.registerLayout({
        id: 'base',
        allowedTransitions: ['combat', 'shop', 'intro'],
        onEnter() {},
        onActive() {},
        onExit() { return null; },
      });
      layoutState.registerLayout({
        id: 'intro',
        allowedTransitions: ['base', 'combat'],
        onEnter() {},
        onActive() {},
        onExit() { return null; },
      });
      layoutState.registerLayout({
        id: 'shop',
        allowedTransitions: ['base', 'combat'],
        onEnter() {},
        onActive() {},
        onExit() { return null; },
      });
    };

    const registerHarnessLayouts = (layoutState) => {
      layoutState.registerLayout({
        id: 'storyMock',
        allowedTransitions: ['combat'],
        onEnter() {
          uiState.setUIStateField('overlayVisible', false);
        },
        onActive() {},
        onExit() { return null; },
      });
      layoutState.registerLayout({
        id: 'astralOverlay',
        allowedTransitions: ['combat'],
        onEnter() {
          uiState.setUIStateField('overlayVisible', false);
          console.log('[Harness] astralOverlay active');
        },
        onActive() {},
        onExit() { return null; },
      });
    };

    layoutState = createLayoutStateSingleton({
      eventBus,
      animationLayer,
      combatRuntimeGateway,
      inputDomains,
    });
    combatRuntimeGateway.setLayoutState(layoutState);

    registerCoreLayouts(layoutState, { combatGateway: combatRuntimeGateway });
    registerHarnessLayouts(layoutState, { combatGateway: combatRuntimeGateway });

    await layoutState.activateInitialLayout('storyMock');
    console.log('[Harness] storyMock activated');

    return;
  }

  const InputDomainManager = HarnessInputDomainManager;
  const inputDomains = new InputDomainManager(eventBus);
  const createLayoutStateSingleton = ({ eventBus: bus, animationLayer, combatRuntimeGateway, inputDomains: domains }) =>
    createHarnessLayoutState({ eventBus: bus, inputDomains: domains, combatRuntimeGateway });
  let instances = [];
  let enemyRows = [];
  let gridBounds = null;
  let freshCombatBootstrapped = false;
  let combatSessionSeeded = false;
  let startupPreloadPromise = null;
  let runtimeLayouts = {};
  let layout = { name: 'runtime-fallback', layers: [] };
  let assetsLayout = null;
  let viewW = 360;
  let viewH = 640;
  let types = {};
  let images = {};
  let enemySpriteImages = {};
  let heroPortraitImages = {};
  let wardBarrierImage = null;
  let heroSkillIconsBySlot = [];
  let heroSelectorImage = null;
  let gemFrameImages = [];
  let superGemFrameImages = [];
  let superGemRainbowImage = null;
  let buffIconFrameImages = {};
  let debuffIconImages = {};
  let mapBackgroundImage = null;
  let mapCaveImage = null;
  let mapPortalImage = null;
  let mapTowerImages = {};
  let mapTownImages = {};
  let heroCapsuleImages = {};
  let plusIconImage = null;
  let minusIconImage = null;
  let heroBackArrowImage = null;
  let heroNextArrowImage = null;
  let closeWinOvalImage = null;
  const calculateGridBounds = (layoutInstances) => {
    const placeholders = (layoutInstances || []).filter(inst => inst && inst.type === 'grid_placeholder' && inst.world);
    if (!placeholders.length) {
      gameState.gridBounds = null;
      return null;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const inst of placeholders) {
      const world = inst.world;
      const w = world.width || 45;
      const h = world.height || 45;
      const ox = (world.originX !== undefined) ? world.originX : 0.5;
      const oy = (world.originY !== undefined) ? world.originY : 0.5;
      const left = (world.x || 0) - w * ox;
      const right = (world.x || 0) + w * (1 - ox);
      const top = (world.y || 0) - h * oy;
      const bottom = (world.y || 0) + h * (1 - oy);
      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, bottom);
    }
    const bounds = { minX, maxX, minY, maxY };
    gameState.gridBounds = bounds;
    runtimeDebugLogging.startupDebugLog(`[BOARD] Grid bounds calculated: (${minX.toFixed(1)}, ${minY.toFixed(1)}) to (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
    return bounds;
  };
  function prepareCombatSetupFromInstances(layoutInstances, gameStateRef) {
    gridBounds = calculateGridBounds(layoutInstances);
    if (gameStateRef && gridBounds) {
      gameStateRef.gridBounds = gridBounds;
    }
  }
  async function refreshCombatSessionFromDevTooling({ forceCombat = false, resetGame = false } = {}) {
    if (resetGame) {
      uiState.setUIStateField('overlayVisible', false);
      const resetCfg = createDefaultDevToolingConfig();
      state.globals.DevToolingConfig = resetCfg;
      return hardRestartRuntimeFromDevTooling();
    }
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (forceCombat && activeLayoutId && activeLayoutId !== 'combat') {
      uiState.setUIStateField('overlayVisible', false);
      await layoutState.requestLayoutChange('combat', 'dev-tool-refresh');
      return true;
    }
    if (!freshCombatBootstrapped || !Array.isArray(enemyRows) || !enemyRows.length) {
      return false;
    }
    uiState.setUIStateField('overlayVisible', false);
    initEntities(enemyRows, instances);
    heroGemProgressStorage.restoreHeroGemProgressFromStorage({ callFunctionWithContext, fnContext, syncFromGlobals });
    assertCombatLayoutDev('StartRound');
    callFunctionWithContext(fnContext, 'StartRound');
    createGemBoard(gridBounds, { immediateFill: true });
    gameState.selectedGems = [];
    gameState.selectionLocked = false;
    initializeStoryCardLayout('dev-tool-refresh');
    combatSessionSeeded = true;
    state.globals.GamePhase = 'RUNTIME';
    state.globals.BattleStartActive = 0;
    state.globals.BattleStartShown = 0;
    state.globals.BattleStartClearedForSession = 1;
    state.globals.BattleStartProcessStarted = 1;
    state.globals.BattleStartText = '';
    state.globals.BattleStartSessionText = '';
    state.globals.BattleStartSessionId = Number(state.globals.CombatSessionId || 0);
    resetCombatRuntimeForFreshSession('dev-tool-refresh', {
      currentTurnType: Number(callFunctionWithContext(fnContext, 'GetCurrentType') || 0),
      boardFillActive: Number(state.globals.BoardFillActive || 0),
      boardHasEmptySlots: hasEmptySlots(),
    });
    combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
    return true;
  }
  requireDevToolingRuntime().setRefreshHandler(refreshCombatSessionFromDevTooling);
  async function loadC3ProjectAssets() {
    updateStartupLoadState({ active: true, phase: 'bootstrap', label: 'Loading layout data...', progress: 0.05 });
    runtimeLayouts = await fetchJson(assetUrl('layouts.json')) || {};
    layout = runtimeLayouts.layout || { name: 'runtime-fallback', layers: [] };
    runtimeDebugLogging.startupDebugLog('[LAYOUT_AUDIT] topLevelKeys', Object.keys(layout || {}));
    runtimeDebugLogging.startupDebugLog('[INIT] Layout loaded');
    assetsLayout = runtimeLayouts.assetsLayout || null;

    const project = runtimeLayouts.project || { viewportWidth: 360, viewportHeight: 640 };
    viewW = project && project.viewportWidth ? project.viewportWidth : 360;
    viewH = project && project.viewportHeight ? project.viewportHeight : 640;
    runtimeDebugLogging.startupDebugLog('[INIT] Project viewport:', viewW, 'x', viewH);
    updateStartupLoadState({ phase: 'bootstrap', label: 'Preparing object types...', progress: 0.16 });

    instances = tryGetInstances(layout).filter((instance) => !shouldSuppressCombatLayoutInstance(instance));
    runtimeDebugLogging.startupDebugLog('[LAYOUT_AUDIT] instanceCount', Array.isArray(instances) ? instances.length : 0);
    const gemInstanceCount = Array.isArray(instances)
      ? instances.filter(i => i && i.type === 'Gem').length
      : 0;
    runtimeDebugLogging.startupDebugLog('[LAYOUT_AUDIT] gemInstanceCount', gemInstanceCount);
    const typesNeeded = Array.from(new Set(instances.map(i=>i.type)));
    ['Enemy_Sprite', 'Bar_Fill', 'Bar_Yellow', 'Bar_Back', 'PartyHP_Bar', 'Gem', 'AttackButton', 'Selector'].forEach(t => {
      if (!typesNeeded.includes(t)) typesNeeded.push(t);
    });
    const objectTypeData = await fetchJson(assetUrl('objectTypes.json')) || { types: {} };
    const allTypes = objectTypeData.types || {};
    types = {};
    for (const t of typesNeeded) {
      const data = allTypes[t];
      if (data) types[t] = data;
    }
    runtimeDebugLogging.startupDebugLog('[INIT] Loaded', Object.keys(types).length, 'object types');
    updateStartupLoadState({ phase: 'bootstrap', label: 'Loading encounter data...', progress: 0.24 });

    const enemies = await fetchJson(assetUrl('enemies.json'));
    enemyRows = parseC2ArrayTable(enemies);
    state.globals.DevToolEnemyCatalog = [...new Set((enemyRows || []).map((row) => String(row?.name || row?.EnemyName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    gameState.baseSummary = summaryText(layout, types, enemies);
    out.textContent = renderHUD.withSkillDrawDebugText(gameState.baseSummary + '\n\nLoading images...', state.globals);
    updateStartupLoadState({ phase: 'bootstrap', label: 'Loading critical visuals...', progress: 0.3 });

    try {
      const visualAssets = await loadRuntimeVisualAssets({
        types,
        assetUrl,
        makeImagePath,
        gemVisuals,
        updateStartupLoadState,
        runtimeDebugLogging,
        resolveRuntimeImageUrl,
      });
      ({
        images,
        enemySpriteImages,
        heroPortraitImages,
        wardBarrierImage,
        heroSkillIconsBySlot,
        heroSelectorImage,
        gemFrameImages,
        superGemFrameImages,
        superGemRainbowImage,
        buffIconFrameImages,
        debuffIconImages,
        mapBackgroundImage,
        mapCaveImage,
        mapPortalImage,
        mapTowerImages,
        mapTownImages,
        heroCapsuleImages,
        plusIconImage,
        minusIconImage,
        heroBackArrowImage,
        heroNextArrowImage,
        closeWinOvalImage,
      } = visualAssets);
      const { loadedCount, failedImages } = visualAssets;
      console.log(`[LOAD] Core assets loaded: ${loadedCount}/${Object.keys(types).length} base sprites`);
      if(failedImages.length > 0) {
        console.log(`[LOAD] Failed images (first 5):`, failedImages.slice(0, 5).map(f => `${f.type}(${f.path})`).join(', '));
      }
    } catch(e) {
      console.error(`[LOAD] Error during image preload:`, e);
    }

    rebuildRenderedCache();
    updateStartupLoadState({ phase: 'bootstrap', label: 'Ready', progress: 0.98 });
    runtimeDebugLogging.startupDebugLog('[INIT] Processing instances...');
  }
  function ensureStartupPreload() {
    if (startupPreloadPromise) return startupPreloadPromise;
    startupPreloadPromise = (async () => {
      try {
        state.globals.GamePhase = 'BOOTSTRAP';
        await loadC3ProjectAssets();
        prepareCombatSetupFromInstances(instances, gameState);
        freshCombatBootstrapped = true;
        COMBAT_BOOTSTRAP_COMPLETE = true;
        updateStartupLoadState({ active: false, phase: 'ready', label: 'Tap to enter combat', progress: 1 });
      } catch (err) {
        console.error('[BOOTSTRAP] Startup preload failed:', err);
        updateStartupLoadState({ active: true, phase: 'error', label: 'Load failed', progress: 1 });
        throw err;
      }
    })();
    return startupPreloadPromise;
  }
  const validateCombatSnapshot = (snapshot, stage, transitionLabel) => {
    const valid = !snapshot || (
      Array.isArray(snapshot.turnQueue) &&
      Number.isFinite(Number(snapshot.currentActorIndex))
    );
    console.log('[LAYOUT_PHASE1]', {
      stage,
      transition: transitionLabel,
      hasSnapshot: Boolean(snapshot),
      snapshotValid: valid,
    });
    return valid;
  };

  const combatLayout = {
    id: 'combat',
    allowedTransitions: ['base', 'shop', 'intro', 'idleFarmLayout', 'mapLayout', 'heroLayout', 'tomesLayout', 'artifactsLayout', 'mountsLayout', 'relicsLayout', 'petsLayout', 'evolutionLayout', 'homesteadLayout', 'chestsLayout', 'storyMock', 'town'],
    async onEnter({ resumeSnapshot, payload, reason }) {
      const hasRuntimeData =
        Array.isArray(instances) && instances.length > 0 &&
        types && Object.keys(types).length > 0 &&
        Array.isArray(enemyRows) && enemyRows.length > 0;
      const needsBootstrap = !freshCombatBootstrapped || !hasRuntimeData;
      const freshCombatStart = reason === 'town-click' || !!payload?.freshStart;
      const needsCombatSeed = freshCombatStart || !combatSessionSeeded;

      validateCombatSnapshot((freshCombatStart ? null : resumeSnapshot) || null, 'onEnter', 'x->1');
      console.log('[Layout] Combat activated via LayoutState');
      COMBAT_LAYOUT_READY = true;
      console.log('[LayoutGuard] Combat layout ready');
      if (needsBootstrap) {
        if (!hasRuntimeData) {
          console.log('[LayoutGuard] Combat bootstrap forcing asset init (missing runtime data)');
          await beginLayout0Preload();
          if (gameState.startupLoad?.phase === 'error') {
            throw new Error('Layout 0 preload not ready; combat transition blocked');
          }
        }
        state.globals.GamePhase = 'BOOTSTRAP';
        runtimeDebugLogging.startupDebugLog('[INIT] Starting initialization...');
        prepareCombatSetupFromInstances(instances, gameState);
        freshCombatBootstrapped = true;
        COMBAT_BOOTSTRAP_COMPLETE = true;
      }
      combatRuntimeGateway.resume(freshCombatStart ? null : (resumeSnapshot || null));
      if (needsCombatSeed) {
        initEntities(enemyRows, instances);
        heroGemProgressStorage.restoreHeroGemProgressFromStorage({ callFunctionWithContext, fnContext, syncFromGlobals });
        assertCombatLayoutDev('StartRound');
        callFunctionWithContext(fnContext, 'StartRound');
        createGemBoard(gridBounds);
        combatSessionSeeded = true;
        updateStartupLoadState({ active: false, phase: 'runtime', label: 'Ready', progress: 1 });
        if (runtimeDebugLogging.isGemDebugEnabled(state) && GEM_INTERACTIVITY_DIAGNOSTIC_QUERY) {
          setTimeout(() => {
            runGemInteractivityDiagnostic().catch((err) => {
              console.error('[DIAG] Gem interactivity diagnostic failed:', err);
            });
          }, 1000);
        }
      }
      gameState.combatFailExitRequested = false;
      initializeStoryCardLayout('layout1-active');
      eventBus.emit('layout:combat:entered', { restored: Boolean(resumeSnapshot) });
    },
    onActive() {},
    onExit({ to }) {
      gameState.storyCardLayout.initialized = false;
      const snapshot = combatRuntimeGateway.suspend();
      const transitionLabel = to === 'idleFarmLayout' ? '1->2' : '1->x';
      validateCombatSnapshot(snapshot, 'onExit', transitionLabel);
      return snapshot;
    },
  };

  layoutState = createLayoutStateSingleton({
    eventBus,
    animationLayer,
    combatRuntimeGateway,
    inputDomains,
  });
  combatRuntimeGateway.setLayoutState(layoutState);
  registerRuntimeLayouts(layoutState, {
    combatLayout,
    uiState,
    mapLayoutState,
    gameState,
    normalizeHeroSelectionIndex,
    restorePartyToFullHP,
    startIdleFarmEmissions,
    restartIdleFarmSession,
    getNowSec: () => performance.now() / 1000,
  });
  const harnessEventBus = eventBus;
  const harnessInputDomains = inputDomains;
  const harnessCombatGateway = combatRuntimeGateway;
  const harnessLayoutState = layoutState;

  state.globals.Player_maxEnergy = 150;
  state.globals.Player_Energy = state.globals.Player_maxEnergy;
  state.globals.EnergyInitialized = 1;
  if (state.globals.EnemyDoTs) delete state.globals.EnemyDoTs;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    state.globals.DevTestMode = params.has('devtest') || params.get('devtest') === 'true';
    state.globals.DebugGemsMode = params.has('debug_gems') || params.get('debug_gems') === 'true';
    state.globals.DebugDamageFloatVectors =
      params.has('damage_float_debug') || params.get('damage_float_debug') === 'true';
    window.__codexGameDevTest = !!state.globals.DevTestMode;
  }
  state.globals.DevToolingConfig = sanitizeDevToolingConfig(state.globals.DevToolingConfig || {});
  state.globals.DevCombatSpeedMultiplier = 1;
  ensureDevToolingModal();
  state.globals.GamePhase = 'BOOTSTRAP';

  eventBus.on('nav:clicked', async ({ label }) => {
    if (label === 'Map') {
      if (layoutState.getActiveLayoutId() !== 'combat') {
        console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '1->map', trigger: 'map-click', blocked: 'active-layout-not-combat' });
        return;
      }
      console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '1->map', trigger: 'map-click' });
      await layoutState.requestLayoutChange('mapLayout', 'nav-map');
      return;
    }
    if (label === 'AstralFlow') {
      if (layoutState.getActiveLayoutId() !== 'combat') {
        console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '1->2', trigger: 'astral-flow-click', blocked: 'active-layout-not-combat' });
        return;
      }
      const transitionCheck = typeof layoutState.canTransitionTo === 'function'
        ? layoutState.canTransitionTo('idleFarmLayout')
        : { allowed: true, reason: 'unknown' };
      if (!transitionCheck.allowed) {
        console.log('[LAYOUT_PHASE1]', {
          stage: 'entry',
          transition: '1->2',
          trigger: 'astral-flow-click',
          blocked: transitionCheck.reason,
          fallback: 'overlay-visible',
        });
        uiState.setUIStateField('overlayVisible', true);
        return;
      }
      console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '1->2', trigger: 'astral-flow-click' });
      await layoutState.requestLayoutChange('idleFarmLayout', 'nav-astral-flow');
      return;
    }
    if (label === 'Hero') {
      if (layoutState.getActiveLayoutId() !== 'combat') {
        return;
      }
      uiState.setUIStateField('overlayVisible', false);
      await layoutState.requestLayoutChange('heroLayout', 'nav-hero');
      return;
    }
    if (label === 'Vault' || label === 'Mission') {
      if (layoutState.getActiveLayoutId() !== 'combat') {
        return;
      }
      uiState.setUIStateField('overlayVisible', false);
      await layoutState.requestLayoutChange('chestsLayout', 'nav-chests');
      return;
    }
    uiState.setUIStateField('overlayVisible', true);
  });
  eventBus.on('layout:storyMock:click', async () => {
    if (layoutState.getActiveLayoutId() !== 'storyMock') return;
    if (!freshCombatBootstrapped) {
      console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '0->town', trigger: 'blue-click', blocked: 'bootstrap_loading' });
      return;
    }
    console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '0->town', trigger: 'blue-click' });
    await layoutState.requestLayoutChange('town', 'story-blue-click');
  });
  eventBus.on('layout:town:click', async () => {
    if (layoutState.getActiveLayoutId() !== 'town') return;
    restorePartyToFullHP();
    console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: 'town->1', trigger: 'town-click' });
    await layoutState.requestLayoutChange('combat', 'town-click', { freshStart: true });
  });
  if (layoutHarnessEnabled) {
    runtimeDebugLogging.debugLayoutLog('[Harness] Enabled');
  }

  await layoutState.activateInitialLayout('storyMock');
  ensureStartupPreload().catch(() => {});

  const layoutW = viewW;
  const layoutH = viewH;
  let layoutScale = 1;
  let layoutOffsetX = 0;
  let layoutOffsetY = 0;
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  if (typeof detachRuntimeInputListeners === 'function') {
    detachRuntimeInputListeners();
    detachRuntimeInputListeners = null;
  }
  const runtimeListenerTeardowns = [];

  const viewportRuntime = createAppViewportRuntime({
    canvas,
    layoutW,
    layoutH,
    onMetrics(metrics) {
      dpr = metrics.dpr;
      layoutScale = metrics.layoutScale;
      layoutOffsetX = metrics.layoutOffsetX;
      layoutOffsetY = metrics.layoutOffsetY;
    },
    onResize() {
      initializeStoryCardLayout('window-resize');
      if (typeof drawFrame === 'function') drawFrame();
    },
  });
  runtimeListenerTeardowns.push(viewportRuntime.teardown);

  // Map Construct world coords to canvas coords (preserve layout aspect/position)
  function worldToCanvas(wx, wy) {
    const cx = layoutOffsetX + wx * layoutScale;
    const cy = layoutOffsetY + wy * layoutScale;
    return { x: cx, y: cy };
  }

  function traceTask015StoryPlacement(trigger, bounds) {
    const store = getTask015TraceStore();
    store.storycardPlacement.push({
      trigger: String(trigger || ''),
      layoutId: layoutState && typeof layoutState.getActiveLayoutId === 'function' ? layoutState.getActiveLayoutId() : null,
      x: Number(bounds.x || 0),
      y: Number(bounds.y || 0),
      w: Number(bounds.w || 0),
      h: Number(bounds.h || 0),
      time: Number(state.globals.time || 0),
    });
    if (store.storycardPlacement.length > 50) store.storycardPlacement.shift();
  }

  function initializeStoryCardLayout(trigger = 'layout-active') {
    return initializeStoryCardPresentationLayout({
      trigger,
      activeLayoutId: layoutState && typeof layoutState.getActiveLayoutId === 'function'
        ? layoutState.getActiveLayoutId()
        : null,
      gameState,
      instances,
      boardGeometry,
      layoutMetrics: { layoutW, layoutScale, layoutOffsetX, layoutOffsetY },
      worldToCanvas,
      tracePlacement: traceTask015StoryPlacement,
    });
  }

  if (layoutHarnessEnabled && harnessLayoutState) {
    const combatLayout = {
      id: 'combat',
      allowedTransitions: ['astralOverlay', 'town'],
      onEnter({ resumeSnapshot, payload, reason }) {
        const snapshot = (reason === 'town-click' || !!payload?.freshStart) ? null : (resumeSnapshot || null);
        harnessCombatGateway.resume(snapshot);
        harnessEventBus.emit('layout:combat:entered', { restored: Boolean(snapshot) });
      },
      onActive() {},
      onExit() {
        return harnessCombatGateway.suspend();
      },
    };
    const storyMockLayout = {
      id: 'storyMock',
      allowedTransitions: ['town'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        runtimeDebugLogging.debugLayoutLog('[Harness] storyMock active');
      },
      onActive() {},
      onExit() {
        return null;
      },
    };
    const townLayout = {
      id: 'town',
      allowedTransitions: ['combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        restorePartyToFullHP();
        runtimeDebugLogging.debugLayoutLog('[Harness] town active');
      },
      onActive() {},
      onExit() {
        return null;
      },
    };
    const astralOverlayLayout = {
      id: 'astralOverlay',
      allowedTransitions: ['combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        console.log('[Harness] astralOverlay active');
      },
      onActive() {},
      onExit() {
        return null;
      },
    };

    harnessLayoutState.registerLayout(combatLayout);
    harnessLayoutState.registerLayout(storyMockLayout);
    harnessLayoutState.registerLayout(townLayout);
    harnessLayoutState.registerLayout(astralOverlayLayout);
    runtimeDebugLogging.debugLayoutLog('[Harness] Layouts registered: storyMock, town, astralOverlay');

    harnessEventBus.on('layout:storyMock:click', async () => {
      await harnessLayoutState.requestLayoutChange('town', 'storyMock-click', { source: 'storyMock' });
    });
    harnessEventBus.on('layout:town:click', async () => {
      restorePartyToFullHP();
      await harnessLayoutState.requestLayoutChange('combat', 'town-click', { source: 'town', freshStart: true });
    });
    harnessEventBus.on('nav:astral-flow', async () => {
      if (harnessLayoutState.getActiveLayoutId() !== 'combat') return;
      if (!harnessCombatGateway.canAcceptEvents()) return;
      console.log('[Harness] Requesting astralOverlay');
      await harnessLayoutState.requestLayoutChange('astralOverlay', 'astral-flow-nav');
    });
    harnessEventBus.on('layout:astralOverlay:click', async () => {
      await harnessLayoutState.requestLayoutChange('combat', 'astralOverlay-click', { source: 'astralOverlay' });
    });

    await harnessLayoutState.activateInitialLayout('storyMock');

    if (typeof window !== 'undefined') {
      window.__layoutHarness = {
        enabled: true,
        eventBus: harnessEventBus,
        inputDomains: harnessInputDomains,
        layoutState: harnessLayoutState,
        combatRuntimeGateway: harnessCombatGateway,
      };
    }
  }

  function getSpriteOrigin(typeName) {
    const t = types[typeName];
    const frame = t && t.animations && t.animations.items && t.animations.items[0] &&
      t.animations.items[0].frames && t.animations.items[0].frames[0];
    if (frame && typeof frame.originX === 'number' && typeof frame.originY === 'number') {
      return { ox: frame.originX, oy: frame.originY };
    }
    return { ox: 0.5, oy: 0.5 };
  }

  function findAssetInstance(typeName) {
    if (!assetsLayout || !assetsLayout.layers) return null;
    for (const layer of assetsLayout.layers) {
      if (!layer.instances) continue;
      for (const inst of layer.instances) {
        if (inst.type === typeName) return inst;
      }
    }
    return null;
  }

  const assetSizes = {
    AttackButton: (() => {
      const inst = findAssetInstance('AttackButton');
      return inst && inst.world ? {
        width: inst.world.width,
        height: inst.world.height,
        originX: inst.world.originX,
        originY: inst.world.originY
      } : null;
    })(),
    Selector: (() => {
      const inst = findAssetInstance('Selector');
      return inst && inst.world ? {
        width: inst.world.width,
        height: inst.world.height,
        originX: inst.world.originX,
        originY: inst.world.originY
      } : null;
    })()
  };

  // Helper to extract text content from instance data or type
  function getTextContent(inst, typeData){
    // First check instance properties for text (C3 Text objects store text in properties.text)
    if(inst.properties && inst.properties.text){
      return String(inst.properties.text);
    }
    // Try instance variables second (if text content stored there)
    if(inst.variables && inst.variables.length > 0){
      for(const v of inst.variables){
        if(v.name && (v.name.includes('text') || v.name.includes('content'))){
          return String(v.value || v.initialValue || '');
        }
      }
    }
    // Fallback: generate label from instance type name
    if(inst.type){
      // Convert "Text_Gold" -> "Gold", "Text_Energy" -> "Energy"
      let label = inst.type;
      if(label.startsWith('Text_')) label = label.substring(5);
      // Insert space before capital letters: "PlayerHP" -> "Player HP"
      label = label.replace(/([A-Z])/g, ' $1').trim();
      return label;
    }
    return 'Text';
  }

  function getHeroUIDByIndex(idx) {
    const hero = state.entities.find(e => e.kind === 'hero' && (e.heroDisplaySlot === idx || e.heroIndex === idx));
    return hero ? hero.uid : 0;
  }

  function getAttackButtonBounds() {
    const img = images['AttackButton'];
    const origin = getSpriteOrigin('AttackButton');
    const asset = assetSizes.AttackButton;
    const worldX = 180;
    const moveUp = (asset ? asset.height : (img ? img.height : 60)) / 2;
    const worldY = 235 - moveUp;
    const pos = worldToCanvas(worldX, worldY);
    const controlScale = Math.max(0.7, Math.min(layoutScale, 1));
    const minW = 52;
    const maxW = 120;
    const minH = 22;
    const maxH = 48;
    const rawW = (asset ? asset.width : (img ? img.width : 120)) * controlScale;
    const rawH = (asset ? asset.height : (img ? img.height : 60)) * controlScale;
    const w = Math.max(minW, Math.min(maxW, rawW));
    const h = Math.max(minH, Math.min(maxH, rawH));
    const ox = asset ? asset.originX : origin.ox;
    const oy = asset ? asset.originY : origin.oy;
    const dx = pos.x - w * ox;
    const dy = pos.y - h * oy;
    return { dx, dy, w, h, img };
  }

  // state for animation/ticking
  const animState = {};
  const enemyBars = new Map();
  let lastFrameTime = performance.now();
  const buffIconFrames = { buffIcon1: 0, buffIcon2: 0, buffIcon3: 0, buffIcon4: 0 };
  let lastRenderDebugSignature = '';
  let rendered = [];
  function rebuildRenderedCache() {
    const nextRendered = [];
    for (let i = 0; i < Math.min(instances.length, 500); i++) {
      const inst = instances[i];
      const world = inst.world || { x: 0, y: 0, width: 32, height: 32, originX: 0.5, originY: 0.5 };
      const img = images[inst.type];
      const typeData = types[inst.type];
      const ox = (world.originX !== undefined) ? world.originX : 0.5;
      const oy = (world.originY !== undefined) ? world.originY : 0.5;
      const isTextObject = typeData && typeData['plugin-id'] === 'Text';
      const isButton = typeData && typeData['plugin-id'] === 'Button';
      const isSprite = typeData && typeData['plugin-id'] === 'Sprite';
      const textContent = isTextObject
        ? getTextContent(inst, typeData)
        : (isButton && inst.properties && inst.properties.text) ? inst.properties.text : null;
      nextRendered.push({
        inst, typeData, world, ox, oy,
        uid: inst.uid,
        dx: 0, dy: 0, w: 0, h: 0,
        isText: isTextObject, isButton, isSprite, img, textContent,
        layerIndex: inst.layerIndex || 0,
        layerName: inst.layerName || 'Unknown'
      });
    }

    const baseRendered = nextRendered.filter(r => !['icon_hero1', 'icon_hero2', 'icon_hero3', 'icon_hero4'].includes(r.inst.type));
    baseRendered.sort((a, b) => a.layerIndex - b.layerIndex);
    rendered = baseRendered;

    const windowPopupItems = baseRendered.filter(r => r.layerName === 'Window Popup');
    const modalObjects = baseRendered.filter(r => ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(r.inst.type));
    const modalSummary = modalObjects
      .map(r => `${r.inst.type}@(${Math.round(r.inst.world.x || 0)},${Math.round(r.inst.world.y || 0)})`)
      .join('|');
    const popupSummary = windowPopupItems.map(r => r.inst.type).join('|');
    const debugSig = `${windowPopupItems.length}:${modalObjects.length}:${baseRendered.length}:${modalSummary}:${popupSummary}`;
    if (debugSig !== lastRenderDebugSignature) {
      lastRenderDebugSignature = debugSig;
      runtimeDebugLogging.startupDebugLog('[DEBUG_RENDER_SUMMARY]', {
        popupCount: windowPopupItems.length,
        modalCount: modalObjects.length,
        renderedCount: baseRendered.length,
        modals: modalSummary,
        popupTypes: popupSummary,
      });
    }

    const enemyAreas = baseRendered.filter(r => r.inst.type === 'EnemyArea');
    if (enemyAreas.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const ea of enemyAreas) {
        const areaWorld = ea.inst.world;
        const w = areaWorld.width || 45;
        const h = areaWorld.height || 45;
        const ox = (areaWorld.originX !== undefined) ? areaWorld.originX : 0.5;
        const oy = (areaWorld.originY !== undefined) ? areaWorld.originY : 0.5;
        const left = (areaWorld.x || 0) - w * ox;
        const right = (areaWorld.x || 0) + w * (1 - ox);
        const top = (areaWorld.y || 0) - h * oy;
        const bottom = (areaWorld.y || 0) + h * (1 - oy);
        minX = Math.min(minX, left);
        maxX = Math.max(maxX, right);
        minY = Math.min(minY, top);
        maxY = Math.max(maxY, bottom);
      }
      state.globals.EnemyAreaRect = { minX, maxX, minY, maxY };
      callFunctionWithContext(fnContext, 'ComputeEnemyLayout');
      callFunctionWithContext(fnContext, 'RefreshEnemyPositions');
    }

    out.textContent = renderHUD.withSkillDrawDebugText(`🎮 Puzzle RPG\n\n✓ Game loaded\n${rendered.length} total objects loaded`, state.globals);
  }
  rebuildRenderedCache();

  // Track last overlay state for logging only on change
  let lastOverlayState = null;

  const surfaceRenderRouter = createSurfaceRenderRouter({
    ctx,
    canvas,
    gameState,
    uiState,
    mapLayoutState,
    animationMath,
    heroLayoutSpec,
    getCloseWinOvalImage: () => closeWinOvalImage,
    getMapBackgroundImage: () => mapBackgroundImage,
    getMapCaveImage: () => mapCaveImage,
    getMapPortalImage: () => mapPortalImage,
    getMapTowerImages: () => mapTowerImages,
    getMapTownImages: () => mapTownImages,
    renderHeroScreenLayoutV2,
    getDpr: () => dpr,
    getFreshCombatBootstrapped: () => freshCombatBootstrapped,
    getStartupFingerprintLabel: () => RUNTIME_FINGERPRINT.label,
    getHeroScreenDeps: () => ({
      fnContext,
      closeWinOvalImage,
      heroPortraitImages,
      heroSkillSpriteSheetImage: null,
      heroSkillIconImages: [
        heroSkillIconsBySlot[0] || null,
        heroSkillIconsBySlot[1] || null,
        heroSkillIconsBySlot[2] || null,
      ],
    }),
    getIdleFarmDeps: () => ({
      nowSec: performance.now() / 1000,
      animationMath,
      updateIdleFarmEmissions,
      startIdleFarmEmissions,
      updateIdleFarmSession,
      ensureIdleFarmSession,
      heroCapsuleImages,
      enemySpriteImages,
    }),
    drawHUD,
  });

  function drawHarnessLayoutTakeover(layoutId) {
    surfaceRenderRouter.draw(layoutId);
  }

  // helper function to draw all instances
  function drawStartupLoadingFrame() {
    const load = gameState.startupLoad || {};
    renderOverlays.drawStartupLoadingFrame({
      ctx,
      canvas,
      phase: load.phase,
      progress: load.progress,
      label: load.label,
    });
  }

  function computePartyRegenLifecycleAction(payload = {}) {
    if (Number(payload.remainingFires || 0) <= 0) return 1;
    if (
      Number(payload.hasTotalHealRemaining || 0) === 1
      && Number(payload.totalHealRemaining || 0) <= 0
    ) {
      return 1;
    }
    if (Number(payload.currentSerial || 0) < Number(payload.nextFireSerial || 0)) return 0;
    if (Number(payload.currentSerial || 0) <= Number(payload.appliedOnSerial || 0)) return 0;
    if (Number(payload.lastProcessedSerial || 0) >= Number(payload.currentSerial || 0)) return 0;
    return 2;
  }

  function maybeResolvePartyRegenLifecycleOwner(payload = {}) {
    const root = typeof globalThis !== 'undefined' ? globalThis : null;
    const hook = root && typeof root.__ORKA_PARTY_REGEN_LIFECYCLE_OWNER__ === 'function'
      ? root.__ORKA_PARTY_REGEN_LIFECYCLE_OWNER__
      : null;
    if (typeof hook !== 'function') return null;
    try {
      const result = createPartyRegenLifecycleSimulationPacket({
        ...payload,
        ownerHook: hook,
      });
      const action = Number(result?.action);
      if (!Number.isFinite(action)) return null;
      state.globals.LastPartyRegenLifecycleOwner = {
        owner: String(result?.owner || 'rust'),
        action,
      };
      state.globals.LastPartyRegenLifecyclePacket = {
        owner: String(result?.owner || 'rust'),
        result: String(result?.simulationCoreResponse?.result || ''),
        actionType: String(result?.simulationCoreRequest?.action?.type || ''),
        source: String(payload.source || 'unknown'),
      };
      return state.globals.LastPartyRegenLifecycleOwner;
    } catch (err) {
      state.globals.LastPartyRegenLifecycleOwnerError = String(err?.message || err || 'unknown');
      return null;
    }
  }

  function maybeResolvePartyRegenTickOwner(payload = {}) {
    const root = typeof globalThis !== 'undefined' ? globalThis : null;
    const hook = root && typeof root.__ORKA_PARTY_REGEN_TICK_OWNER__ === 'function'
      ? root.__ORKA_PARTY_REGEN_TICK_OWNER__
      : null;
    if (typeof hook !== 'function') return null;
    try {
      const result = createPartyRegenTickSimulationPacket({
        ...payload,
        ownerHook: hook,
      });
      const heal = Number(result?.heal);
      const totalHealRemaining = Number(result?.totalHealRemaining);
      const remainingFires = Number(result?.remainingFires);
      const nextFireSerial = Number(result?.nextFireSerial);
      if (
        !Number.isFinite(heal)
        || !Number.isFinite(totalHealRemaining)
        || !Number.isFinite(remainingFires)
        || !Number.isFinite(nextFireSerial)
      ) {
        return null;
      }
      state.globals.LastPartyRegenTickOwner = {
        owner: String(result?.owner || 'rust'),
        heal,
        totalHealRemaining,
        remainingFires,
        nextFireSerial,
      };
      state.globals.LastPartyRegenTickPacket = {
        owner: String(result?.owner || 'rust'),
        result: String(result?.simulationCoreResponse?.result || ''),
        actionType: String(result?.simulationCoreRequest?.action?.type || ''),
        source: String(payload.source || 'unknown'),
      };
      return state.globals.LastPartyRegenTickOwner;
    } catch (err) {
      state.globals.LastPartyRegenTickOwnerError = String(err?.message || err || 'unknown');
      return null;
    }
  }

  function processTurnCadencePartyRegens() {
    const currentTurnSerial = Number(state.globals.TurnSerial || 0);
    if (currentTurnSerial <= Number(gameState._lastPartyRegenTurnSerial || 0)) return;
    const regens = state.globals.PartyRegens;
    if (!Array.isArray(regens) || regens.length === 0) {
      gameState._lastPartyRegenTurnSerial = currentTurnSerial;
      return;
    }
    for (let i = regens.length - 1; i >= 0; i--) {
      const regen = regens[i];
      if (!regen || Number(regen.remainingFires || 0) <= 0) {
        regens.splice(i, 1);
        continue;
      }
      if (String(regen.cadence || 'tick') !== 'turn') continue;
      const hasTotalHealRemaining = regen.totalHealRemaining != null ? 1 : 0;
      const totalHealRemainingBefore = hasTotalHealRemaining
        ? Number(regen.totalHealRemaining || 0)
        : 0;
      const remainingFiresBefore = Number(regen.remainingFires || 0);
      const gateTurn = Number(regen.nextFireTurnSerial || 0);
      const lifecyclePayload = {
        source: 'app.processTurnCadencePartyRegens',
        remainingFires: remainingFiresBefore,
        hasTotalHealRemaining,
        totalHealRemaining: totalHealRemainingBefore,
        currentSerial: currentTurnSerial,
        nextFireSerial: gateTurn,
        appliedOnSerial: Number(regen.appliedOnTurnSerial || 0),
        lastProcessedSerial: Number(regen.lastProcessedTurnSerial || 0),
      };
      const jsLifecycleAction = computePartyRegenLifecycleAction(lifecyclePayload);
      const ownedLifecycle = maybeResolvePartyRegenLifecycleOwner({
        ...lifecyclePayload,
        jsAction: jsLifecycleAction,
      });
      const lifecycleAction = ownedLifecycle && String(ownedLifecycle.owner || '') === 'rust'
        ? Number(ownedLifecycle.action)
        : jsLifecycleAction;
      if (lifecycleAction === 1) {
        regens.splice(i, 1);
        continue;
      }
      if (lifecycleAction !== 2) continue;

      let heal = 1;
      let jsTotalHealRemaining = totalHealRemainingBefore;
      if (hasTotalHealRemaining && remainingFiresBefore > 0) {
        const remaining = Math.max(0, Math.floor(totalHealRemainingBefore));
        const fires = Math.max(1, Math.floor(remainingFiresBefore));
        const base = Math.floor(remaining / fires);
        const remainder = remaining % fires;
        heal = Math.max(1, base + (fires === 1 ? remainder : 0));
        jsTotalHealRemaining = Math.max(0, remaining - heal);
      } else {
        heal = Math.max(1, Math.round(regen.healPerFire || 1));
        jsTotalHealRemaining = 0;
      }
      const jsRemainingFires = Math.max(0, Math.floor(remainingFiresBefore) - 1);
      const jsNextFireSerial = gateTurn + Math.max(1, Math.floor(Number(regen.firesEveryTurns || 1) || 1));
      const ownedTick = maybeResolvePartyRegenTickOwner({
        source: 'app.processTurnCadencePartyRegens',
        totalHealRemaining: totalHealRemainingBefore,
        remainingFires: remainingFiresBefore,
        healPerFire: Number(regen.healPerFire || 0),
        hasTotalHealRemaining,
        nextFireSerial: gateTurn,
        firesEvery: Number(regen.firesEveryTurns || 1),
        distributionMode: 1,
        jsHeal: heal,
        jsTotalHealRemaining,
        jsRemainingFires,
        jsNextFireSerial,
      });
      if (ownedTick && String(ownedTick.owner || '') === 'rust') {
        heal = Math.max(0, Number(ownedTick.heal || 0));
        if (hasTotalHealRemaining) {
          regen.totalHealRemaining = Math.max(0, Math.floor(Number(ownedTick.totalHealRemaining || 0)));
        }
        regen.remainingFires = Math.max(0, Math.floor(Number(ownedTick.remainingFires || 0)));
        regen.nextFireTurnSerial = Number(ownedTick.nextFireSerial || 0);
      } else {
        if (hasTotalHealRemaining) regen.totalHealRemaining = jsTotalHealRemaining;
        regen.remainingFires = jsRemainingFires;
        regen.nextFireTurnSerial = jsNextFireSerial;
      }

      const beforeHP = state.globals.PartyHP || 0;
      const prev = state.globals.SpawnDamageText;
      const prevHero = state.globals.SuppressHeroHealText;
      state.globals.SpawnDamageText = 0;
      state.globals.SuppressHeroHealText = 1;
      callFunctionWithContext(fnContext, 'ApplyPartyHeal', heal);
      state.globals.SpawnDamageText = prev;
      state.globals.SuppressHeroHealText = prevHero;
      const afterHP = state.globals.PartyHP || 0;
      const actualHeal = Math.max(0, afterHP - beforeHP);
      const barPos = state.globals.PartyHPBarPosWorld;
      if (actualHeal > 0 && barPos && barPos.w > 0 && barPos.h > 0) {
        const left = barPos.x - barPos.w * barPos.ox;
        const barW = barPos.w;
        const barH = barPos.h;
        const ratio = Math.max(0, Math.min(1, (state.globals.PartyHP || 0) / Math.max(1, state.globals.PartyMaxHP || 1)));
        const textX = left + barW * ratio;
        const textY = (barPos.y - barH * barPos.oy) + barH * 0.5;
        callFunctionWithContext(fnContext, 'SpawnDamageText', actualHeal, textX, textY, 'heal', 'bar');
      }
      regen.lastProcessedTurnSerial = currentTurnSerial;
      if (regen.remainingFires <= 0) {
        regens.splice(i, 1);
      }
    }
    if (regens.length === 0) delete state.globals.PartyRegens;
    gameState._lastPartyRegenTurnSerial = currentTurnSerial;
  }

  function drawFrame(dtOverride){
    syncSuperGemShapes({ gameState, state, boardGeometry, reason: 'draw-frame' });
    processTurnCadencePartyRegens();
    superGemRuntime.syncTaintedGroundZones({
      state,
      callFunctionWithContext,
      fnContext,
    });
    ensureDevAutoplayPendingSingleTarget();
    const runtimeScope = {
      dtOverride,
      state,
      gameState,
      uiState,
      mapLayoutState,
      animationMath,
      renderOverlays,
      renderBoard,
      renderCombatRuntime,
      combatRuntimeGateway,
      runtimeDebugLogging,
      callFunctionWithContext,
      resolveCurrentHeroUID,
      shouldRenderHeroTurnSelector,
      formatDamageValue,
      isDamageTextFontReady,
      getStoryCardLiveLineState,
      splitStoryCardActorSegment,
      getCombatPartyRenderRoster,
      getAttackButtonBounds,
      getYellowSequenceCompletionIntent,
      createEnemyTurnGateBaseline,
      createEnemyTurnIdleRecovery,
      createRefillCompleteGate,
      applyTurnGateGlobals,
      applyTurnGateIntent,
      YELLOW_COLOR,
      YELLOW_CASINO_SETTLE_SEC,
      YELLOW_CASINO_SETTLE_BOUNCE_AMP,
      startGemMergeFx,
      getGoldLabelTargetWorld,
      getCellWorldPos,
      setGemArray,
      countCellCoverage,
      traceTask015YellowAnimation,
      traceTask015YellowWrite,
      recordTask011RefillWriteEvent,
      inputDomains,
      layoutState,
      layoutHarnessEnabled,
      harnessLayoutState: null,
      dpr,
      canvas,
      ctx,
      layoutW,
      layoutH,
      layoutScale,
      layoutOffsetX,
      layoutOffsetY,
      freshCombatBootstrapped,
      RUNTIME_FINGERPRINT,
      mapBackgroundImage,
      heroLayoutSpec,
      closeWinOvalImage,
      heroPortraitImages,
      wardBarrierImage,
      heroSkillIconsBySlot,
      heroSelectorImage,
      heroCapsuleImages,
      enemySpriteImages,
      gemFrameImages,
      superGemFrameImages,
      superGemRainbowImage,
      buffIconFrameImages: (typeof buffIconFrameImages !== 'undefined' ? buffIconFrameImages : {}),
      debuffIconImages: (typeof debuffIconImages !== 'undefined' ? debuffIconImages : {}),
      buffIconFrames: (typeof buffIconFrames !== 'undefined' ? buffIconFrames : {}),
      buffIcons: (typeof buffIcons !== 'undefined' ? buffIcons : new Set()),
      layerColors: (typeof layerColors !== 'undefined' ? layerColors : {}),
      movedRadiatorsToSidebar: (typeof movedRadiatorsToSidebar !== 'undefined' ? movedRadiatorsToSidebar : false),
      showLeftCombatRadiators: (typeof showLeftCombatRadiators !== 'undefined' ? showLeftCombatRadiators : false),
      showCombatAreaTurnOrder: (typeof showCombatAreaTurnOrder !== 'undefined' ? showCombatAreaTurnOrder : false),
      legacyCombatAreaTextTypes: (typeof legacyCombatAreaTextTypes !== 'undefined' ? legacyCombatAreaTextTypes : new Set()),
      combatAreaTurnOrderTextTypes: (typeof combatAreaTurnOrderTextTypes !== 'undefined' ? combatAreaTurnOrderTextTypes : new Set()),
      movedRadiatorTextTypes: (typeof movedRadiatorTextTypes !== 'undefined' ? movedRadiatorTextTypes : new Set()),
      navTextTypes: (typeof navTextTypes !== 'undefined' ? navTextTypes : new Set()),
      heroSelectorImageLoaded: heroSelectorImage,
      images,
      assetSizes,
      DAMAGE_TEXT_FONT,
      damageNumberLayer,
      enemyBars,
      drawHUD,
      drawHarnessLayoutTakeover,
      drawStartupLoadingFrame,
      worldToCanvas,
      rebuildRenderedCache,
      filteredRendered: (typeof filteredRendered !== 'undefined' ? filteredRendered : []),
      rendered: (typeof rendered !== 'undefined' ? rendered : []),
      baseRendered: (typeof baseRendered !== 'undefined' ? baseRendered : []),
      viewW,
      viewH,
      boardGeometry,
      eventBus,
      fnContext,
      COMBAT_BOOTSTRAP_COMPLETE,
      lastFrameTime,
      lastOverlayState,
      performance,
      syncDamageNumberLayerBounds,
      spawnPendingDamageNumbers,
      randomGemFrame,
      assertBoardIntegrity,
      getGemGateSnapshot,
      getPersistentTaintedGroundOverlays,
      hasPersistentEnemyTaintedGroundOverlay,
      hasPersistentEnemyBlightOverlay,
      hasPersistentHeroRegenOverlay,
      isHitFlashActive,
      getHitFlashTone,
      deriveDamageFloatFrameOffset,
      createPartyRegenTickSimulationPacket,
    };
    astralFlowKoOrbPresentation.prepareAstralFlowKoOrbPresentation({
      state,
      worldToCanvas,
      callFunctionWithContext,
      fnContext,
    });
    const result = renderRuntime.renderRuntime(runtimeScope);
    if (result && result.overlayData) {
      state.globals.LastCombatOverlayData = result.overlayData;
    }
    if (result && result.visualFlags) {
      state.globals.LastCombatVisualFlags = result.visualFlags;
    }
    if (result && result.presentationPatches) {
      Object.assign(state.globals, result.presentationPatches);
    }
    if (result && result.visualControlPatches) {
      Object.assign(state.globals, result.visualControlPatches);
    }
    astralFlowKoOrbPresentation.updateAndRenderAstralFlowKoOrbPresentation({
      ctx,
      state,
      worldToCanvas,
      callFunctionWithContext,
      fnContext,
    });
    renderSkillDraughtOverlay(ctx, canvas, dpr);
    partyStatOsdRuntime.refresh();
    if (typeof runtimeScope.lastFrameTime === 'number') {
      lastFrameTime = runtimeScope.lastFrameTime;
    }
    if (runtimeScope.lastOverlayState !== undefined) {
      lastOverlayState = runtimeScope.lastOverlayState;
    }
    return result;
  }

  function getLatestCombatActionLine() {
    const g = state.globals || {};
    const pinnedLine = typeof g.CombatActionPinnedLine === 'string' ? g.CombatActionPinnedLine.trim() : '';
    const pinnedUntil = Number(g.CombatActionPinnedUntil || 0);
    if (pinnedLine && pinnedUntil > Number(g.time || 0)) return pinnedLine;
    const lines = Array.isArray(g.CombatActionLines) ? g.CombatActionLines : [];
    const latest = lines[3];
    return (typeof latest === 'string' && latest.trim()) ? latest.trim() : '';
  }

  function isStoryCardTokenLine(text) {
    const value = typeof text === 'string' ? text.trim() : '';
    if (!value) return false;
    return /^token drop(?:\s*\(fallback\))?:/i.test(value);
  }

  function getStoryCardIntentFallbackLine() {
    const actorIntent = typeof state.globals?.ActorIntent === 'string' ? state.globals.ActorIntent : '';
    if (!actorIntent) return '';
    if (!actorIntent.includes('YELLOW') || !actorIntent.includes('Casino_Recolor')) return '';
    const m = actorIntent.match(/\]\s*(.+?)\s*->\s*Casino_Recolor/i);
    const actor = m && m[1] ? String(m[1]).trim() : '';
    if (!actor) return '';
    return `${actor} used Wild Magic!`;
  }

  function getLatestStoryCardActionLine() {
    const g = state.globals || {};
    const lines = Array.isArray(g.CombatActionLines) ? g.CombatActionLines : [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = typeof lines[i] === 'string' ? lines[i].trim() : '';
      if (!line) continue;
      if (isStoryCardTokenLine(line)) continue;
      return line;
    }
    return getStoryCardIntentFallbackLine() || '';
  }

function getBattleStartStoryCardOverlay() {
  const g = state.globals || {};
  if (g.BattleStartClearedForSession) return { active: false, text: '', alpha: 1 };
  if (!g.BattleStartActive) return { active: false, text: '', alpha: 1 };
  const text = typeof g.BattleStartText === 'string' ? g.BattleStartText : '';
  if (!text.trim()) return { active: false, text: '', alpha: 1 };
    const showUntil = Number(g.BattleStartEndsAt ?? 2.0);
    const fadeEnd = Number(g.BattleStartFadeEndsAt ?? (showUntil + 0.4));
    const t = Number(g.time || 0);
    const alpha = t <= showUntil ? 1 : Math.max(0, 1 - ((t - showUntil) / Math.max(0.001, fadeEnd - showUntil)));
    return { active: alpha > 0, text, alpha };
}

function isBattleStartSessionLine(text) {
  const line = typeof text === 'string' ? text.trim() : '';
  if (!line) return false;
  const g = state.globals || {};
  const sessionText = typeof g.BattleStartSessionText === 'string' ? g.BattleStartSessionText.trim() : '';
  if (sessionText && line === sessionText) return true;
  return line === 'Ambushed by enemy team!' || line === 'Heroes surprised the enemies!';
}

function getStoryCardLiveLineState() {
  if (!gameState.storyCardLine) {
    gameState.storyCardLine = { text: '', animUntil: 0 };
  }
  const battleStart = getBattleStartStoryCardOverlay();
  const combatText = getLatestStoryCardActionLine();
  const candidateText = combatText || (battleStart.active ? battleStart.text : '');
  let nextText = candidateText || gameState.storyCardLine.text || '';
  if (!battleStart.active && !combatText && isBattleStartSessionLine(nextText)) {
    nextText = '';
    state.globals.BattleStartClearedForSession = 1;
  }
  const now = Number(state.globals?.time || 0);
  if (gameState.storyCardLine.text !== nextText) {
    gameState.storyCardLine.text = nextText;
      gameState.storyCardLine.animUntil = now + 0.35;
    }
    const animRemaining = Math.max(0, Number(gameState.storyCardLine.animUntil || 0) - now);
    const fadeAlpha = animRemaining > 0 ? (0.75 + ((animRemaining / 0.35) * 0.25)) : 1;
    return {
      text: gameState.storyCardLine.text || '',
      animAlpha: battleStart.active ? Math.min(fadeAlpha, battleStart.alpha) : fadeAlpha,
    };
  }

  function splitStoryCardActorSegment(text) {
    const line = typeof text === 'string' ? text : '';
    if (!line) return { actor: '', rest: '' };
    const names = Array.from(new Set(
      (Array.isArray(state.entities) ? state.entities : [])
        .map(e => String(e?.name || '').trim())
        .filter(Boolean),
    )).sort((a, b) => b.length - a.length);
    for (const name of names) {
      if (line === name) return { actor: name, rest: '' };
      if (line.startsWith(`${name} `)) return { actor: name, rest: line.slice(name.length) };
    }
    const delimiters = [
      ' hit ',
      ' cast on ',
      ' used ',
      ' heals ',
      ' healed ',
      ' found ',
      ' grabbed ',
      ' increased ',
      ' applies ',
      ' gained ',
      ' tried ',
      ' had ',
      ' resisted ',
    ];
    let boundary = -1;
    for (const token of delimiters) {
      const idx = line.indexOf(token);
      if (idx > 0 && (boundary === -1 || idx < boundary)) boundary = idx;
    }
    if (boundary > 0) {
      const actor = line.slice(0, boundary).trimEnd();
      return { actor, rest: line.slice(actor.length) };
    }
    return { actor: '', rest: line };
  }

  function drawHUD() {
    renderHUD.drawHUD({
      out,
      gemCounterOut,
      walletOut,
      astralWalletOut,
      stateGlobals: state.globals,
      stateEntities: state.entities,
      gameState,
      uiState: uiState.getUIState(),
      getLatestCombatActionLine,
      resolveCurrentHeroUID,
      callFunctionWithContext,
      fnContext,
      getHeroUIDByIndex,
    });
  }
  function drawAstralWalletHUD() {
    renderHUD.drawAstralWalletHUD({
      astralWalletOut,
      stateGlobals: state.globals,
    });
  }
  drawFrame(); // initial render
  drawAstralWalletHUD();

  const devSleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  function getGemGateSnapshot() {
    return {
      CanPickGems: state.globals.CanPickGems,
      IsPlayerBusy: state.globals.IsPlayerBusy,
      PendingSkillID: state.globals.PendingSkillID || '',
      BoardFillActive: state.globals.BoardFillActive,
      TurnPhase: state.globals.TurnPhase,
      DeferAdvance: state.globals.DeferAdvance,
      ActionLockUntil: state.globals.ActionLockUntil,
      MatchedColorValue: state.globals.MatchedColorValue,
      TapIndex: state.globals.TapIndex,
      time: state.globals.time,
    };
  }
  function getGemByRC(row, col) {
    return (gameState.gems || []).find(g => g && g.cellR === row && g.cellC === col);
  }
  function getLockedGemCellKeys() {
    return (gameState.gems || [])
      .filter(isBoardGemLocked)
      .map(g => `${Number(g.cellR || 0)},${Number(g.cellC || 0)}`);
  }
  function isSuperGemLockedByBoardGems(superGem) {
    const cells = Array.isArray(superGem && superGem.cells) ? superGem.cells : [];
    return cells.some((cell) => {
      const row = Number(cell?.r ?? cell?.row ?? 0);
      const col = Number(cell?.c ?? cell?.col ?? 0);
      return isBoardGemLocked(getGemByRC(row, col));
    });
  }
  function getSelectionLen() {
    return Array.isArray(gameState.selection) ? gameState.selection.length : 0;
  }
  function countCellCoverage() {
    const coverage = {};
    for (const g of gameState.gems) {
      const key = `${g.cellR},${g.cellC}`;
      coverage[key] = (coverage[key] || 0) + 1;
    }
    return coverage;
  }
  function clearSelectionOnly() {
    gameState.selectedGems = [];
    gameState.selectionLocked = false;
    if (Array.isArray(gameState.gems)) {
      for (const gm of gameState.gems) {
        if (!gm) continue;
        gm.selected = false;
        gm.Selected = 0;
      }
    }
    state.globals.TapIndex = 0;
  }
  function clickGemCell(row, col) {
    const gem = getGemByRC(row, col);
    if (!gem) return false;
    if (isBoardGemLocked(gem)) return false;
    const pos = worldToCanvas(gem.x, gem.y);
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + pos.x;
    const clientY = rect.top + pos.y;
    const ev = typeof PointerEvent === 'function'
      ? new PointerEvent('pointerdown', {
          clientX,
          clientY,
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
          button: 0,
          buttons: 1,
        })
      : new MouseEvent('pointerdown', {
          clientX,
          clientY,
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
        });
    canvas.dispatchEvent(ev);
    return true;
  }
  async function waitForRefillReady() {
    const timeoutMs = 15000;
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const ready = (
        state.globals.BoardFillActive === 0 &&
        isCanPickGemsReady(state.globals.CanPickGems) &&
        Array.isArray(gameState.gems) &&
        gameState.gems.length === 24
      );
      if (ready) return true;
      await devSleep(50);
    }
    return false;
  }
  function assertBoardIntegrity(reasonTag) {
    const exportedGame = (typeof window !== 'undefined' && window.__codexGame) ? window.__codexGame : null;
    const gems = (exportedGame && Array.isArray(exportedGame.gems))
      ? exportedGame.gems
      : (Array.isArray(gameState.gems) ? gameState.gems : []);
    const rows = 4;
    const cols = 6;
    const counts = new Map();
    for (const g of gems) {
      if (!g) continue;
      const key = `${g.cellR},${g.cellC}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const missingCells = [];
    const duplicates = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r},${c}`;
        const n = counts.get(key) || 0;
        if (n === 0) missingCells.push({ r, c });
        if (n > 1) duplicates.push({ r, c, count: n });
      }
    }
    const gemsLength = gems.length;
    const ok = missingCells.length === 0 && duplicates.length === 0;
    const result = { ok, missingCells, duplicates, gemsLength };
    const boardIntegrityLog = ok ? console.log : console.error;
    boardIntegrityLog('[BOARD_INTEGRITY]', { reasonTag, gemsLength, missingCells, duplicates });
    return result;
  }
  async function auditGemClickability(reasonTag) {
    if (!runtimeDebugLogging.isGemDebugEnabled(state)) return;
    const rows = [];
    const inertCells = [];
    for (let row = 0; row < boardGeometry.rows; row++) {
      for (let col = 0; col < boardGeometry.cols; col++) {
        clearSelectionOnly();
        const beforeGem = getGemByRC(row, col);
        const beforeSelectedLen = Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0;
        const beforeSelectionLen = getSelectionLen();
        const beforeGlobals = getGemGateSnapshot();
        const clicked = clickGemCell(row, col);
        await devSleep(20);
        const afterGem = getGemByRC(row, col);
        const afterSelectedLen = Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0;
        const afterSelectionLen = getSelectionLen();
        const afterGlobals = getGemGateSnapshot();
        const selectionIncreased = afterSelectedLen > beforeSelectedLen || afterSelectionLen > beforeSelectionLen;
        const selectedFlipped = !!(afterGem && (afterGem.selected || afterGem.Selected));
        const gateTransition = JSON.stringify(beforeGlobals) !== JSON.stringify(afterGlobals);
        const inert = !clicked || (!selectionIncreased && !selectedFlipped && !gateTransition);
        const rowState = {
          reasonTag,
          row,
          col,
          gem: afterGem ? {
            uid: afterGem.uid,
            color: afterGem.color != null ? afterGem.color : afterGem.elementIndex,
            x: afterGem.x,
            y: afterGem.y,
            selected: !!afterGem.selected,
            Selected: !!afterGem.Selected,
            flashUntil: afterGem.flashUntil || 0,
            cellR: afterGem.cellR,
            cellC: afterGem.cellC,
          } : null,
          selection: {
            selectedGemsBefore: beforeSelectedLen,
            selectedGemsAfter: afterSelectedLen,
            selectionBefore: beforeSelectionLen,
            selectionAfter: afterSelectionLen,
          },
          beforeGlobals,
          afterGlobals,
          gateTransition,
        };
        rows.push(rowState);
        if (inert) {
          const inertDiag = {
            ...rowState,
            turn: {
              uid: callFunctionWithContext(fnContext, 'GetCurrentTurn'),
              type: callFunctionWithContext(fnContext, 'GetCurrentType'),
            },
          };
          console.error('[INERT_CELL]', inertDiag);
          inertCells.push(inertDiag);
        }
      }
    }
    runtimeDebugLogging.gemDebugLog('[GEM_AUDIT]', { reasonTag, rows }, state);
    if (inertCells.length > 0) {
      throw new Error(`[DIAG] Inert gem cells detected at ${reasonTag}: ${inertCells.length}`);
    }
  }
  async function autoPlayTurnsDev(turnCount) {
    if (!runtimeDebugLogging.isGemDebugEnabled(state)) return;
    if (state.globals.GamePhase !== 'RUNTIME') return;
    for (let i = 0; i < turnCount; i++) {
      callFunctionWithContext(fnContext, 'AdvanceTurn');
      combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
      await devSleep(40);
    }
  }
  function getDevAutoplayState() {
    return {
      active: !!state.globals.DevAutoplayActive,
      stopRequested: !!state.globals.DevAutoplayStopRequested,
      lastReason: String(state.globals.DevAutoplayLastReason || ''),
      matchesPlayed: Number(state.globals.DevAutoplayMatchesPlayed || 0),
      startedAt: Number(state.globals.DevAutoplayStartedAt || 0),
      endedAt: Number(state.globals.DevAutoplayEndedAt || 0),
    };
  }
  function setDevAutoplayState(patch = {}) {
    const next = { ...getDevAutoplayState(), ...(patch && typeof patch === 'object' ? patch : {}) };
    state.globals.DevAutoplayActive = next.active ? 1 : 0;
    state.globals.DevAutoplayStopRequested = next.stopRequested ? 1 : 0;
    state.globals.DevAutoplayLastReason = String(next.lastReason || '');
    state.globals.DevAutoplayMatchesPlayed = Math.max(0, Math.floor(Number(next.matchesPlayed || 0)));
    state.globals.DevAutoplayStartedAt = Number(next.startedAt || 0);
    state.globals.DevAutoplayEndedAt = Number(next.endedAt || 0);
    updateDevToolingStatus(
      next.lastReason
        ? `Idle mode: ${next.active ? 'running' : 'stopped'} (${next.lastReason})`
        : `Idle mode: ${next.active ? 'running' : 'idle'}`
    );
    return getDevAutoplayState();
  }
  function isIdleAutoplayHeroWindow() {
    return (
      state.globals.GamePhase === 'RUNTIME' &&
      callFunctionWithContext(fnContext, 'GetCurrentType') === 0 &&
      state.globals.TurnPhase === 0 &&
      isCanPickGemsReady(state.globals.CanPickGems) &&
      state.globals.IsPlayerBusy === 0 &&
      !state.globals.PendingSkillID &&
      !state.globals.BoardFillActive &&
      !state.globals.ActionInProgress &&
      !state.globals.DeferAdvance &&
      !(gameState.refillBounce && gameState.refillBounce.active) &&
      !(gameState.yellowCasino && gameState.yellowCasino.active)
    );
  }
  const IDLE_AUTOPLAY_SKILL_DRAUGHT_HOLD_MS = 1400;
  function getCurrentIdleAutoplayHeroName() {
    const uid = resolveCurrentHeroUID({
      directUID: Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || state.globals.CurrentHeroUID || 0),
      turnOrder: state.globals.TurnOrderArray,
      currentTurnIndex: state.globals.CurrentTurnIndex,
    });
    if (!(uid > 0)) return '';
    const actor = callFunctionWithContext(fnContext, 'GetActorByUID', uid);
    const entity = state.entities.find((entry) => (
      entry &&
      entry.kind === 'hero' &&
      Number(entry.uid || 0) === uid
    ));
    return String(actor?.name || entity?.name || entity?.baseHeroName || '');
  }
  function hasLivingEnemiesForIdleAutoplay() {
    if (typeof state === 'undefined' || !Array.isArray(state.entities)) return false;
    return state.entities.some((entity) => entity && entity.kind === 'enemy' && Number(entity.hp ?? 0) > 0);
  }
  function ensureDevAutoplayPendingSingleTarget() {
    if (!state.globals.DevAutoplayActive) return 0;
    if (String(state.globals.PendingSkillID || '') !== 'HERO_SINGLE') return 0;
    const pendingActorUID = Number(state.globals.PendingActor || callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
    if (!(pendingActorUID > 0)) return 0;
    const livingEnemies = state.entities.filter((entity) => entity && entity.kind === 'enemy' && Number(entity.hp ?? 0) > 0);
    if (!livingEnemies.length) return 0;
    const selectedUID = Number(state.globals.SelectedEnemyUID || 0);
    const selectedOwnerUID = Number(state.globals.SelectedEnemyUIDOwner || 0);
    if (selectedOwnerUID === pendingActorUID && livingEnemies.some((enemy) => Number(enemy.uid || 0) === selectedUID)) {
      return selectedUID;
    }
    const roll = typeof state.globals.RuntimeRandom === 'function' ? Number(state.globals.RuntimeRandom()) : 0;
    const safeRoll = Number.isFinite(roll) && roll >= 0 && roll < 1 ? roll : 0;
    const targetIndex = Math.max(0, Math.min(livingEnemies.length - 1, Math.floor(safeRoll * livingEnemies.length)));
    const targetUID = Number(livingEnemies[targetIndex].uid || 0);
    state.globals.SelectedEnemyUID = targetUID;
    state.globals.SelectedEnemyUIDOwner = pendingActorUID;
    return targetUID;
  }
  function getIdleAutoplayPriorityContext() {
    return {
      heroName: getCurrentIdleAutoplayHeroName(),
      hasLivingEnemies: hasLivingEnemiesForIdleAutoplay(),
      forcedBoardColor: Number(state.globals.DevForcedBoardColor),
      lockedCells: getLockedGemCellKeys(),
      partyHpRatio: resolveIdleAutoplayPartyHpRatio({
        partyHP: state.globals.PartyHP,
        partyMaxHP: state.globals.PartyMaxHP,
        partyHPByIndex: state.globals.PartyHPByIndex || gameState.partyHP,
        partyMaxHPByIndex: state.globals.PartyMaxHPByIndex || gameState.partyMaxHP,
      }),
    };
  }
  async function playIdleAutoplayTriplet(cells) {
    if (!Array.isArray(cells) || cells.length < 3) return false;
    clearSelectionOnly();
    for (const cell of cells.slice(0, 3)) {
      if (!clickGemCell(Number(cell.row || 0), Number(cell.col || 0))) return false;
      await devSleep(24);
    }
    return true;
  }
  function autoResolvePendingSelectionForDevIdle() {
    if (!state.globals.DevAutoplayActive) return false;
    if (!state.globals.PendingSkillID) return false;
    const presentationBarrier = getPresentationTurnBarrier({
      hasEmpty: hasEmptySlots(),
      enemyLineClearPressureActive: !!state.globals.EnemyLineClearPressureActive,
    });
    if (!presentationBarrier.canResolvePendingTargetAction) return false;
    const actorUID = Number(state.globals.PendingActor || callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
    if (actorUID <= 0) return false;
    const livingEnemies = state.entities.filter((entity) => entity && entity.kind === 'enemy' && Number(entity.hp ?? 0) > 0);
    if (!livingEnemies.length) return false;
    logActionHandoffDebug('[DEV_AUTOPLAY_RESOLVE]', {
      stage: 'before',
      actorUID,
      livingEnemies: livingEnemies.length,
    });
    if (String(state.globals.PendingSkillID || '') === 'HERO_SINGLE') {
      const targetUID = ensureDevAutoplayPendingSingleTarget();
      if (!(targetUID > 0)) return false;
    }
    const handoff = resolvePendingTargetHandoff({
      actorUID,
      source: 'dev-autoplay',
    });
    const {
      resolvedPendingSuperGem,
      executeSkillResult,
      recoveredRejectedPendingSuperGem,
    } = handoff;
    logActionHandoffDebug('[DEV_AUTOPLAY_RESOLVE]', {
      stage: 'after-action-attempt-before-clear',
      actorUID,
      resolvedPendingSuperGem,
      executeSkillResult,
      recoveredRejectedPendingSuperGem,
    });
    logActionHandoffDebug('[DEV_AUTOPLAY_RESOLVE]', {
      stage: 'after-clear',
      actorUID,
      resolvedPendingSuperGem,
      executeSkillResult,
      recoveredRejectedPendingSuperGem,
    });
    return true;
  }
  function autoResolveSkillDraughtForDevIdle() {
    if (!state.globals.DevAutoplayActive) return false;
    if (!Number(state.globals.SkillDraughtOpen || 0)) {
      state.globals.DevAutoplaySkillDraughtSeenAt = 0;
      return false;
    }
    const candidates = Array.isArray(state.globals.SkillDraughtCandidates) ? state.globals.SkillDraughtCandidates : [];
    if (!candidates.length) return false;
    const now = performance.now();
    const seenAt = Number(state.globals.DevAutoplaySkillDraughtSeenAt || 0);
    if (!seenAt) {
      state.globals.DevAutoplaySkillDraughtSeenAt = now;
      return true;
    }
    if (now - seenAt < IDLE_AUTOPLAY_SKILL_DRAUGHT_HOLD_MS) return true;
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const result = callFunctionWithContext(fnContext, 'SelectSkillDraughtCard', randomIndex);
    state.globals.DevAutoplaySkillDraughtSeenAt = 0;
    return !!(result && result.ok);
  }
  function resolveCombatOutcomeWithOwner({
    source = 'app.combatOutcome',
    energy = 0,
    partyHp = 0,
    livingHeroes = 0,
  } = {}) {
    const root = typeof globalThis !== 'undefined' ? globalThis : null;
    const packet = createCombatOutcomeSimulationPacket({
      source,
      energy,
      partyHp,
      livingHeroes,
      ownerHook: root && typeof root.__ORKA_COMBAT_OUTCOME_OWNER__ === 'function'
        ? root.__ORKA_COMBAT_OUTCOME_OWNER__
        : null,
      requestFactory(action, context) {
        return combatRuntimeGateway.createSimulationCoreRequest(action, context);
      },
      responseApplier(response) {
        return combatRuntimeGateway.applySimulationCoreResponse(response);
      },
    });
    state.globals.LastCombatOutcomePacket = {
      owner: String(packet.owner || ''),
      code: Number(packet.code || 0),
      reason: String(packet.reason || ''),
      result: String(packet.simulationCoreResponse?.result || ''),
      source: String(source || ''),
    };
    return packet;
  }
  function resolveDevAutoplayCombatOutcome({ energy = 0, partyHp = 0, livingHeroes = 0 } = {}) {
    return resolveCombatOutcomeWithOwner({
      source: 'app.runDevAutoplayUntilDepleted',
      energy,
      partyHp,
      livingHeroes,
    });
  }
  function resolveMainRuntimeCombatOutcome({ energy = 0, partyHp = 0, livingHeroes = 0 } = {}) {
    return resolveCombatOutcomeWithOwner({
      source: 'app.mainRuntimeCombatOutcome',
      energy: Number(energy || 0) < 0 ? 0 : 1,
      partyHp,
      livingHeroes,
    });
  }
  function getDevAutoplayProgressSig() {
    return JSON.stringify({
      energy: Math.max(0, Number(state.globals.Player_Energy || 0)),
      turn: Number(state.globals.DebugTurnCount || 0),
      phase: Number(state.globals.TurnPhase || 0),
      canPick: Number(state.globals.CanPickGems || 0),
      busy: Number(state.globals.IsPlayerBusy || 0),
      boardFill: Number(state.globals.BoardFillActive || 0),
      pending: String(state.globals.PendingSkillID || ''),
      skillDraughtOpen: Number(state.globals.SkillDraughtOpen || 0),
      gems: Array.isArray(gameState.gems) ? gameState.gems.length : 0,
      current: Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0),
    });
  }
  function requestCombatFailureExit(reason = 'party_defeated') {
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (
      activeLayoutId !== 'combat' ||
      state.globals.GamePhase !== 'RUNTIME' ||
      gameState.combatFailExitRequested
    ) {
      return false;
    }
    const normalizedReason = String(reason || '');
    const layoutReason = normalizedReason === 'energy_depleted' || normalizedReason === 'combat-energy-depleted'
      ? 'combat-energy-depleted'
      : 'combat-party-defeated';
    gameState.combatFailExitRequested = true;
    state.globals.CanPickGems = 0;
    state.globals.IsPlayerBusy = 1;
    state.globals.ActionInProgress = 0;
    state.globals.DeferAdvance = 0;
    gameState.substate = 'Neutral';
    gameState.isTurnResolving = false;
    gameState.isSpikeProcessing = false;
    gameState.areEffectsAnimating = false;
    layoutState.requestLayoutChange('storyMock', layoutReason).catch((err) => {
      gameState.combatFailExitRequested = false;
      console.error('[LAYOUT_PHASE1] combat fail gate layout transition failed', err);
    });
    return true;
  }
  async function runDevAutoplayUntilDepleted() {
    const startedAt = Number(state.globals.time || 0);
    let matchesPlayed = 0;
    let lastProgressSig = '';
    let lastProgressAt = performance.now();
    setDevAutoplayState({
      active: true,
      stopRequested: false,
      lastReason: '',
      matchesPlayed: 0,
      startedAt,
      endedAt: 0,
    });
    while (true) {
      if (state.globals.DevAutoplayStopRequested) {
        setDevAutoplayState({ active: false, stopRequested: false, lastReason: 'manual_stop', matchesPlayed, endedAt: Number(state.globals.time || 0) });
        return getDevAutoplayState();
      }
      const energy = Math.max(0, Number(state.globals.Player_Energy || 0));
      const partyHp = Math.max(0, Number(state.globals.PartyHP || 0));
      const aliveHeroes = state.entities.filter((entity) => entity && entity.kind === 'hero' && (entity.hp ?? 0) > 0).length;
      const outcome = resolveDevAutoplayCombatOutcome({ energy, partyHp, livingHeroes: aliveHeroes });
      if (outcome.reason) {
        setDevAutoplayState({ active: false, stopRequested: false, lastReason: outcome.reason, matchesPlayed, endedAt: Number(state.globals.time || 0) });
        requestCombatFailureExit(outcome.reason);
        return getDevAutoplayState();
      }
      const progressSig = getDevAutoplayProgressSig();
      if (progressSig !== lastProgressSig) {
        lastProgressSig = progressSig;
        lastProgressAt = performance.now();
      }
      if (autoResolvePendingSelectionForDevIdle()) {
        await devSleep(90);
        continue;
      }
      if (autoResolveSkillDraughtForDevIdle()) {
        await devSleep(90);
        continue;
      }
      if (isIdleAutoplayHeroWindow()) {
        const superGemPick = pickIdleAutoplaySuperGem(gameState.superGems, getIdleAutoplayPriorityContext());
        if (superGemPick) {
          const beforeSuperGemProgressSig = getDevAutoplayProgressSig();
          const played = clickGemCell(Number(superGemPick.row || 0), Number(superGemPick.col || 0));
          await devSleep(90);
          if (played && getDevAutoplayProgressSig() !== beforeSuperGemProgressSig) {
            matchesPlayed += 1;
            setDevAutoplayState({ active: true, stopRequested: false, lastReason: 'running', matchesPlayed, startedAt, endedAt: 0 });
            continue;
          }
        }
        const pick = pickIdleAutoplayTriplet(gameState.gems, getIdleAutoplayPriorityContext());
        if (!pick) {
          setDevAutoplayState({ active: false, stopRequested: false, lastReason: 'no_valid_triplet', matchesPlayed, endedAt: Number(state.globals.time || 0) });
          return getDevAutoplayState();
        }
        const played = await playIdleAutoplayTriplet(pick);
        if (played) {
          matchesPlayed += 1;
          setDevAutoplayState({ active: true, stopRequested: false, lastReason: 'running', matchesPlayed, startedAt, endedAt: 0 });
        }
        await devSleep(90);
        continue;
      }
      if ((performance.now() - lastProgressAt) > 15000) {
        setDevAutoplayState({ active: false, stopRequested: false, lastReason: 'stalled', matchesPlayed, endedAt: Number(state.globals.time || 0) });
        return getDevAutoplayState();
      }
      await devSleep(60);
    }
  }
  async function runGemInteractivityDiagnostic() {
    if (!runtimeDebugLogging.isGemDebugEnabled(state)) return;
    const runtimeWaitStart = performance.now();
    while (state.globals.GamePhase !== 'RUNTIME' && (performance.now() - runtimeWaitStart) < 15000) {
      await devSleep(50);
    }
    if (state.globals.GamePhase !== 'RUNTIME') return;
    const forceDeterministicBoard = () => {
      if (!Array.isArray(gameState.gems)) return;
      for (const gem of gameState.gems) {
        if (!gem) continue;
        let forcedColor = (gem.cellR + gem.cellC) % 2 === 0 ? 1 : 2;
        if (gem.cellR === 0 && gem.cellC >= 0 && gem.cellC <= 2) forcedColor = 3;
        gem.color = forcedColor;
        gem.elementIndex = forcedColor;
        gem.flashUntil = 0;
      }
      setGemArray(gameState.gems);
    };
    const setControlledGates = () => {
      state.globals.CanPickGems = true;
      state.globals.IsPlayerBusy = 0;
      state.globals.PendingSkillID = '';
      state.globals.BoardFillActive = 0;
      state.globals.TurnPhase = 0;
      state.globals.DeferAdvance = 0;
      state.globals.ActionLockUntil = 0;
      state.globals.MatchedColorValue = -1;
    };

    const readyInitial = await waitForRefillReady();
    if (!readyInitial) throw new Error('[DIAG] Initial board did not become playable');
    await auditGemClickability('post-initial-board');

    forceDeterministicBoard();
    clearSelectionOnly();
    runtimeDebugLogging.gemDebugLog('[FILL_GATE]', { stage: 'forced-yellow-before', globals: getGemGateSnapshot() }, state);
    setControlledGates();
    runtimeDebugLogging.gemDebugLog('[FILL_GATE]', { stage: 'forced-yellow-after', globals: getGemGateSnapshot() }, state);
    clickGemCell(0, 0);
    await devSleep(20);
    clickGemCell(0, 1);
    await devSleep(20);
    clickGemCell(0, 2);
    const readyAfterYellow = await waitForRefillReady();
    if (!readyAfterYellow) throw new Error('[DIAG] Refill wait timed out after forced yellow');
    await auditGemClickability('post-yellow-refill');

    await autoPlayTurnsDev(10);
    const readyAfterTurns = await waitForRefillReady();
    if (!readyAfterTurns) throw new Error('[DIAG] Board not playable after auto turns');
    await auditGemClickability('post-10-auto-turns');
  }
  requireDevToolingRuntime().setAutoplayHandler(runDevAutoplayUntilDepleted);


  function getEnemyHit(mx, my) {
    const enemies = state.entities.filter(e => e.kind === 'enemy' && (e.hp ?? 0) > 0);
    if (!enemies.length) return null;
    const g = state.globals;
    for (const enemy of enemies) {
      const slotIndex = enemy.slotIndex ?? 0;
      const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
      const center = Math.floor((g.Slots || 0) / 2);
      const x = enemy.x != null ? enemy.x : (g.X0 || 200) + (slotIndex - center) * spacing;
      const y = enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing;
      const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
      const origW = enemyOrig ? enemyOrig.width : 1;
      const origH = enemyOrig ? enemyOrig.height : 1;
      const enemyH = (g.EnemySize || 40) * layoutScale;
      const enemyW = enemyH * (origW / origH);
      const pos = worldToCanvas(x, y);
      if (mx >= pos.x - enemyW / 2 && mx <= pos.x + enemyW / 2 &&
          my >= pos.y - enemyH / 2 && my <= pos.y + enemyH / 2) {
        return enemy;
      }
    }
    return null;
  }

  function deriveEncounterRequestFromMapState() {
    const war = Math.max(0, Math.min(1, Number(mapLayoutState.getMapLayoutState().warMeter || 0)));
    const node = mapLayoutState.getMapLayoutState().encounterNode || {};
    const targetCP = Math.round(90 + (war * 60));
    const policy = war >= 0.85
      ? 'solo_commander'
      : (war >= 0.55 ? 'mixed' : 'fodder_only');
    const locale = String(
      node.locale ||
      state.globals.EncounterLocale ||
      state.globals.CurrentLocale ||
      'clouds',
    )
      .trim()
      .toLowerCase() || 'clouds';
    return {
      targetCP,
      locale,
      maxSlots: 3,
      policy,
      faction: String(node.faction || state.globals.EncounterFaction || '').trim().toLowerCase(),
      // Generate a fresh encounter seed per map->combat entry to avoid fixed repeated trios.
      seed: generateEncounterSeed(),
    };
  }
  const handleMapDragStart = inputHandling.attachMapDragStartHandler({
    layoutState,
    gameState,
    canvas,
    drawFrame,
  });

  const pointerRoutingShell = createPointerRoutingShell({
    canvas,
    getDpr: () => dpr,
    state,
    gameState,
    uiState,
    layoutState,
    mapLayoutState,
    inputDomains,
    layoutHarnessEnabled,
    harnessLayoutState,
    harnessInputDomains,
    callFunctionWithContext,
    fnContext,
    drawFrame,
    handleMapDragStart,
    deriveEncounterRequestFromMapState,
    restartIdleFarmSession,
    claimIdleFarmRewards,
    getHeroScreenRoster,
    normalizeHeroSelectionIndex,
  });

  // pointer handler for nav menu and overlay (more responsive than click)
  const handlePointerDown = (ev) => {
    const routedPointer = pointerRoutingShell.routePointerDown(ev);
    const { mx, my, rect } = routedPointer;
    if (routedPointer.handled) {
      return;
    }

    if (state.globals.GamePhase !== 'RUNTIME') {
      return;
    }

    // REFILL click: use actual AddMore object bounds at click time
    const refillObj = rendered.find(r => r.inst.type === 'AddMore');
    if (refillObj) {
      const pos = worldToCanvas(refillObj.world.x || 0, refillObj.world.y || 0);
      const w = (refillObj.world.width || 60) * layoutScale;
      const h = (refillObj.world.height || 24) * layoutScale;
      const dx = pos.x - w * refillObj.ox;
      const dy = pos.y - h * refillObj.oy - (10 * layoutScale);
      const pad = 6 * layoutScale;
      if (mx >= dx - pad && mx <= dx + w + pad && my >= dy - pad && my <= dy + h + pad) {
        return;
      }
    }

    // Check nav label clicks using actual Nav_* text objects.
    // AstralFlow is processed first so intended 1->2 transition remains reachable.
    const navTypes = new Set(['Nav_HeroText', 'Nav_MapText', 'Nav_MissionText', 'Nav_AstralFlowText', 'Nav_HomeText']);
    const navLabelItems = rendered.filter(r => navTypes.has(r.inst.type));
    const labelMap = {
      Nav_HeroText: 'Hero',
      Nav_MapText: 'Map',
      Nav_MissionText: 'Vault',
      Nav_AstralFlowText: 'AstralFlow',
      Nav_HomeText: 'Home',
    };
    const navAlwaysAllowedLabels = new Set(['AstralFlow', 'Hero', 'Map', 'Vault']);
    const navHit = navLabelItems.find((r) => {
      const pos = worldToCanvas(r.world.x || 0, r.world.y || 0);
      const w = Math.max(40, (r.world.width || 60) * layoutScale);
      const h = Math.max(16, (r.world.height || 20) * layoutScale);
      const dx = pos.x - w * r.ox;
      const dy = pos.y - h * r.oy;
      return mx >= dx && mx <= dx + w && my >= dy && my <= dy + h;
    });
    if (navHit) {
      const labelName = labelMap[navHit.inst.type] || '';
      const navBlockedBySelection = gameState.selectedGems.length > 0 || gameState.selectionLocked || !isCanPickGemsReady(state.globals.CanPickGems);
      if (navAlwaysAllowedLabels.has(labelName) || !navBlockedBySelection) {
        inputDomains.emit(
          layoutState.getActiveLayoutId(),
          'nav:clicked',
          { label: labelName }
        );
        drawFrame();
        return;
      }
    }
    const viewW = rect.width;
    const viewH = rect.height;
    const fallbackNavBand = {
      x: Math.max(0, layoutOffsetX),
      y: Math.max(0, viewH - Math.max(76, 72 * layoutScale)),
      w: Math.min(viewW, layoutW * layoutScale),
      h: Math.max(64, 68 * layoutScale),
    };
    if (
      mx >= fallbackNavBand.x &&
      mx <= fallbackNavBand.x + fallbackNavBand.w &&
      my >= fallbackNavBand.y &&
      my <= fallbackNavBand.y + fallbackNavBand.h
    ) {
      const navSlots = [
        { label: 'Hero', center: 0.1 },
        { label: 'Map', center: 0.28 },
        { label: 'Vault', center: 0.68 },
        { label: 'AstralFlow', center: 0.86 },
      ];
      const navSlot = navSlots.reduce((best, slot) => {
        const cx = fallbackNavBand.x + (fallbackNavBand.w * slot.center);
        const distance = Math.abs(mx - cx);
        return !best || distance < best.distance ? { ...slot, distance } : best;
      }, null);
      const labelName = navSlot ? navSlot.label : '';
      const navBlockedBySelection = gameState.selectedGems.length > 0 || gameState.selectionLocked || !isCanPickGemsReady(state.globals.CanPickGems);
      if (labelName && (navAlwaysAllowedLabels.has(labelName) || !navBlockedBySelection)) {
        inputDomains.emit(
          layoutState.getActiveLayoutId(),
          'nav:clicked',
          { label: labelName }
        );
        drawFrame();
        return;
      }
    }

    // Pending hero attack: click an enemy to execute
    if (!uiState.getUIState().overlayVisible && state.globals.PendingSkillID) {
      const btn = getAttackButtonBounds();
      if (mx >= btn.dx && mx <= btn.dx + btn.w && my >= btn.dy && my <= btn.dy + btn.h) {
        const enemyRosterStability = getEnemyRosterStabilitySnapshot();
        if (!enemyRosterStability.stable) {
          applyTurnGateIntent(createEnemyRosterRefillHold, {
            now: Number(state.globals.time || 0),
            currentTurnUID: Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0),
            preservePendingSkill: true,
          });
          drawFrame();
          return;
        }
        const presentationBarrier = getPresentationTurnBarrier({
          hasEmpty: hasEmptySlots(),
          enemyLineClearPressureActive: !!state.globals.EnemyLineClearPressureActive,
        });
        if (!presentationBarrier.canResolvePendingTargetAction) {
          drawFrame();
          return;
        }
        const actorUID = state.globals.PendingActor || getHeroUIDByIndex(gameState.selectedHero);
        logActionHandoffDebug('[PENDING_ATTACK_RESOLVE]', {
          stage: 'before',
          source: 'manual-button',
          actorUID,
        });
        const handoff = resolvePendingTargetHandoff({
          actorUID,
          source: 'manual-button',
        });
        const {
          resolvedPendingSuperGem,
          executeSkillResult,
          recoveredRejectedPendingSuperGem,
        } = handoff;
        logActionHandoffDebug('[PENDING_ATTACK_RESOLVE]', {
          stage: 'after-action-attempt-before-clear',
          source: 'manual-button',
          actorUID,
          resolvedPendingSuperGem,
          executeSkillResult,
          recoveredRejectedPendingSuperGem,
        });
        logActionHandoffDebug('[PENDING_ATTACK_RESOLVE]', {
          stage: 'after-clear',
          source: 'manual-button',
          actorUID,
          resolvedPendingSuperGem,
          executeSkillResult,
          recoveredRejectedPendingSuperGem,
        });
        drawFrame();
        return;
      }
      const hit = getEnemyHit(mx, my);
      if (hit) {
        state.globals.SelectedEnemyUID = hit.uid;
        state.globals.SelectedEnemyUIDOwner = Number(state.globals.PendingActor || 0);
        drawFrame();
        return;
      }
    }
    
    // Check for gem clicks (only if board is created and overlay is not visible)
    if (gameState.boardCreated && gameState.gems && !uiState.getUIState().overlayVisible) {
      if (state.globals.GamePhase !== 'RUNTIME') {
        return;
      }
      const isHeroTurn = callFunctionWithContext(fnContext, 'IsHeroTurn') === true;
      if (!isCanPickGemsReady(state.globals.CanPickGems) || !isHeroTurn) {
        runtimeDebugLogging.gemDebugLog('[GEM_REJECT]', {
          reason: !isCanPickGemsReady(state.globals.CanPickGems) ? 'reject-gate-can-pick-false' : 'reject-gate-not-hero-turn',
          globals: {
            CanPickGems: state.globals.CanPickGems,
            IsPlayerBusy: state.globals.IsPlayerBusy,
            PendingSkillID: state.globals.PendingSkillID || '',
            BoardFillActive: state.globals.BoardFillActive,
            TurnPhase: state.globals.TurnPhase,
            DeferAdvance: state.globals.DeferAdvance,
            ActionLockUntil: state.globals.ActionLockUntil,
            MatchedColorValue: state.globals.MatchedColorValue,
            TapIndex: state.globals.TapIndex,
          },
        }, state);
        return;
      }
      const tappedSuperGem = getSuperGemAtCanvasPoint({
        gameState,
        mx,
        my,
        boardGeometry,
        layoutScale,
        worldToCanvas,
      });
      if (tappedSuperGem) {
        if (isSuperGemLockedByBoardGems(tappedSuperGem)) {
          runtimeDebugLogging.gemDebugLog('[GEM_REJECT]', {
            reason: 'reject-locked-super-gem-footprint',
            cells: Array.isArray(tappedSuperGem.cells) ? tappedSuperGem.cells : [],
          }, state);
          return;
        }
        spendSuperGem({
          superGem: tappedSuperGem,
          gameState,
          state,
          reason: 'tap-surface',
          callFunctionWithContext,
          fnContext,
          getHeroUIDByIndex,
          beginTask011ActionCycle,
          startGemMergeFx,
          getGoldLabelTargetWorld,
          setGemArray,
          startRefillBounce,
          activateSuperGemEffect: superGemRuntime.activateSuperGemEffect,
          superGemCost: superGemRuntime.SUPER_GEM_COST,
        });
        drawFrame();
        return;
      }
      for (let i = 0; i < gameState.gems.length; i++) {
        const gem = gameState.gems[i];
        const pos = worldToCanvas(gem.x, gem.y);
        const gemRadius = (gem.width * layoutScale) * 0.48;
        
        // Check if click is within gem circle
        const dx = mx - pos.x;
        const dy = my - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < gemRadius) {
          runtimeDebugLogging.gemDebugLog('[GEM_ENTRY]', {
            cellR: gem.cellR,
            cellC: gem.cellC,
            uid: gem.uid,
            selectedGemsLength: Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0,
            selectionLength: Array.isArray(gameState.selection) ? gameState.selection.length : 0,
            globals: {
              CanPickGems: state.globals.CanPickGems,
              IsPlayerBusy: state.globals.IsPlayerBusy,
              PendingSkillID: state.globals.PendingSkillID || '',
              BoardFillActive: state.globals.BoardFillActive,
              TurnPhase: state.globals.TurnPhase,
              DeferAdvance: state.globals.DeferAdvance,
              ActionLockUntil: state.globals.ActionLockUntil,
              MatchedColorValue: state.globals.MatchedColorValue,
              TapIndex: state.globals.TapIndex,
            },
          }, state);
          if (gem.color == null && gem.elementIndex != null) {
            gem.color = gem.elementIndex;
          }
          if (isBoardGemLocked(gem)) {
            runtimeDebugLogging.gemDebugLog('[GEM_REJECT]', {
              reason: 'reject-locked-gem',
              row: gem.cellR,
              col: gem.cellC,
              countdown: Number(gem.lockCountdown ?? gem.LockCountdown ?? 0),
              groupId: String(gem.lockGroupId || gem.LockGroupId || ''),
            }, state);
            return;
          }
          const tappedSuperGem = getSuperGemAtCell(gameState, gem.cellR, gem.cellC);
          if (tappedSuperGem) {
            if (isSuperGemLockedByBoardGems(tappedSuperGem)) {
              runtimeDebugLogging.gemDebugLog('[GEM_REJECT]', {
                reason: 'reject-locked-super-gem-footprint',
                cells: Array.isArray(tappedSuperGem.cells) ? tappedSuperGem.cells : [],
              }, state);
              return;
            }
            spendSuperGem({
              superGem: tappedSuperGem,
              gameState,
              state,
              reason: 'tap-footprint',
              callFunctionWithContext,
              fnContext,
              getHeroUIDByIndex,
              beginTask011ActionCycle,
              startGemMergeFx,
              getGoldLabelTargetWorld,
              setGemArray,
              startRefillBounce,
              activateSuperGemEffect: superGemRuntime.activateSuperGemEffect,
              superGemCost: superGemRuntime.SUPER_GEM_COST,
            });
            drawFrame();
            return;
          }
          if (gameState.selectionLocked && gameState.selectedGems.length < 3) {
            gameState.selectionLocked = false;
          }
          if (gameState.selectionLocked || gameState.selectedGems.length >= 3) {
            runtimeDebugLogging.gemDebugLog('[GEM_REJECT]', {
              reason: gameState.selectionLocked ? 'reject-selection-locked' : 'reject-selection-cap-reached',
              row: gem.cellR,
              col: gem.cellC,
              selectedGemsLength: gameState.selectedGems.length,
              globals: {
                CanPickGems: state.globals.CanPickGems,
                IsPlayerBusy: state.globals.IsPlayerBusy,
                PendingSkillID: state.globals.PendingSkillID || '',
                BoardFillActive: state.globals.BoardFillActive,
                TurnPhase: state.globals.TurnPhase,
                DeferAdvance: state.globals.DeferAdvance,
                ActionLockUntil: state.globals.ActionLockUntil,
                MatchedColorValue: state.globals.MatchedColorValue,
                TapIndex: state.globals.TapIndex,
              },
            }, state);
            return;
          }
          
          // Toggle selection
          if (gem.selected) {
            gem.selected = false;
            gameState.selectedGems = gameState.selectedGems.filter(idx => idx !== i);
            gem.Selected = 0;
          } else {
            if (gameState.selectedGems.length >= 3) {
              runtimeDebugLogging.gemDebugLog('[GEM_REJECT]', {
                reason: 'reject-selection-cap-guard',
                row: gem.cellR,
                col: gem.cellC,
                selectedGemsLength: gameState.selectedGems.length,
                globals: {
                  CanPickGems: state.globals.CanPickGems,
                  IsPlayerBusy: state.globals.IsPlayerBusy,
                  PendingSkillID: state.globals.PendingSkillID || '',
                  BoardFillActive: state.globals.BoardFillActive,
                  TurnPhase: state.globals.TurnPhase,
                  DeferAdvance: state.globals.DeferAdvance,
                  ActionLockUntil: state.globals.ActionLockUntil,
                  MatchedColorValue: state.globals.MatchedColorValue,
                  TapIndex: state.globals.TapIndex,
                },
              }, state);
              return;
            }
            gem.selected = true;
            gameState.selectedGems.push(i);
            gem.Selected = 1;
            
            // Check if we have 3 selected gems of same color
            if (gameState.selectedGems.length === 3) {
              gameState.selectionLocked = true;
              const selectedColors = gameState.selectedGems.map(idx => {
                const gm = gameState.gems[idx];
                return (gm && gm.color != null) ? gm.color : (gm ? gm.elementIndex : null);
              });
              console.log(`[MATCH] Selected colors: ${selectedColors.join(',')}`);
              if (selectedColors.some(c => c == null)) {
                console.log('[MATCH] Invalid color detected, clearing selection');
              }
              if (selectedColors[0] === selectedColors[1] && selectedColors[1] === selectedColors[2] && !selectedColors.some(c => c == null)) {
                console.log(`[MATCH] 3 gems matched! Color: ${selectedColors[0]}`);
                handleGemMatch(selectedColors[0]);
              } else {
                console.log(`[MATCH] No match - colors: ${selectedColors.join(',')}`);
                const now = performance.now();
                for (const idx of gameState.selectedGems) {
                  const gm = gameState.gems[idx];
                  if (gm) gm.flashUntil = now + 250;
                }
                setTimeout(() => {
                  callFunctionWithContext(fnContext, 'ClearMatchState');
                  if (state.globals.Gems && Array.isArray(state.globals.Gems)) {
                    gameState.gems = state.globals.Gems;
                  }
                  gameState.selectedGems = [];
                  gameState.selectionLocked = false;
                  if (gameState.gems) {
                    for (const gm of gameState.gems) {
                      gm.selected = false;
                      gm.Selected = 0;
                    }
                  }
                  state.globals.TapIndex = 0;
                  drawFrame();
                }, 250);
              }
            }
          }

          state.globals.TapIndex = Math.min(3, gameState.selectedGems.length);
          setGemArray(gameState.gems);
          
          drawFrame();
          return;
        }
      }
    }
    
    // Check for rendered element clicks (close button, etc)
    // First check modal objects if overlay is visible
    if (uiState.getUIState().overlayVisible) {
      const isModalObject = (type) => ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(type);
      const modalObjs = rendered.filter(r => isModalObject(r.inst.type));
      for(const r of modalObjs){
        if(mx >= r.dx && mx <= r.dx + r.w && my >= r.dy && my <= r.dy + r.h){
          // Close button or surrounding button clicked - hide overlay
          if(r.inst.type === 'UI_NavCloseX' || r.inst.type === 'UI_NavCloseButton'){
            uiState.setUIStateField('overlayVisible', false);
            drawFrame();
            return;
          }
        }
      }
    }
    
    for(const r of rendered){
      if(mx >= r.dx && mx <= r.dx + r.w && my >= r.dy && my <= r.dy + r.h){
        // Other interactive elements
        return;
      }
    }
  };
  canvas.addEventListener('pointerdown', handlePointerDown, { passive: true });
  runtimeListenerTeardowns.push(() => canvas.removeEventListener('pointerdown', handlePointerDown, { passive: true }));

  function handleGlobalKeydown(ev) {
    if (isDevToolingHotkey(ev)) {
      toggleDevToolingModal();
      ev.stopPropagation();
      ev.preventDefault();
      return;
    }
    if (partyStatOsd.isPartyStatOsdHotkey(ev)) {
      partyStatOsdRuntime.toggle();
      ev.stopPropagation();
      ev.preventDefault();
      return;
    }
    if (ensureDevToolingConfig().open) {
      if (ev.key === 'Escape') {
        toggleDevToolingModal(false);
        ev.stopPropagation();
        ev.preventDefault();
        return;
      }
      if (!isEditableDomTarget(ev.target)) {
        ev.stopPropagation();
        ev.preventDefault();
        return;
      }
    }
    if (state.globals.DevTestMode) {
      if (ev.code === 'KeyA') {
        if (state.globals.CanPickGems && state.globals.TurnPhase === 0 && !state.globals.IsPlayerBusy) {
          handleGemMatch(3);
        }
        ev.preventDefault();
        return;
      }
    }
    if(ev.key === 'ArrowLeft') gameState.selectedHero = Math.max(0, gameState.selectedHero - 1);
    if(ev.key === 'ArrowRight') gameState.selectedHero = Math.min(Math.max(0, getConfiguredHeroCount() - 1), gameState.selectedHero + 1);
    if(ev.key === 'ArrowUp') gameState.selectedEnemy = Math.max(0, gameState.selectedEnemy - 1);
    if(ev.key === 'ArrowDown') gameState.selectedEnemy = Math.min(Math.max(0, getConfiguredEnemyCount() - 1), gameState.selectedEnemy + 1);
    if(ev.key === ' ') { gameState.playerTurn = !gameState.playerTurn; ev.preventDefault(); }
  }
  // keyboard input handling
  window.addEventListener('keydown', handleGlobalKeydown, true);
  document.addEventListener('keydown', handleGlobalKeydown, true);

  inputHandling.attachMapDragInputHandlers({
    canvas,
    runtimeListenerTeardowns,
    layoutState,
    gameState,
    drawFrame,
  });
  detachRuntimeInputListeners = () => {
    for (const teardown of runtimeListenerTeardowns.splice(0)) {
      try {
        teardown();
      } catch {}
    }
  };

  // per-frame tick loop with animation cycling
  let frameCount = 0;
  function tick(){
    frameCount++;
    if (ensureDevToolingConfig().open) {
      requestAnimationFrame(tick);
      return;
    }
    if (state.globals.GamePhase === 'BOOTSTRAP') {
      tryActivateRuntimePhase();
    }
    const activeTurnType = callFunctionWithContext(fnContext, 'GetCurrentType');
    const heroInputActive =
      state.globals.TurnPhase === 0 &&
      activeTurnType === 0 &&
      !!state.globals.CanPickGems &&
      !state.globals.PendingSkillID;
    if (heroInputActive) {
      state.globals.HideHeroSelector = 0;
    }
    const refill = gameState.refillBounce;
    const phaseNow = state.globals.TurnPhase;
    const hasEmpty = hasEmptySlots();
    const enemyLineClearPressureActive = !!state.globals.EnemyLineClearPressureActive;
    const refillStartBarrier = getPresentationTurnBarrier({
      hasEmpty,
      enemyLineClearPressureActive,
    });
    const pendingSkillDraughtClaimed = claimPendingSkillDraughtAtHeroCheckpoint({
      hasEmpty,
      enemyLineClearPressureActive,
    });
    if (pendingSkillDraughtClaimed) {
      runtimeDebugLogging.gemDebugLog('[SKILL_DRAUGHT_CLAIM]', {
        reason: 'hero-end-checkpoint-before-refill',
        heroUID: Number(state.globals.SkillDraughtHeroUID || 0),
      }, state);
    }
    const refillReady =
      phaseNow === 0 &&
      !state.globals.IsPlayerBusy &&
      !state.globals.PendingSkillID &&
      !state.globals.ActionInProgress &&
      !pendingSkillDraughtClaimed &&
      refillStartBarrier.canStartRefill &&
      !(refill && refill.active);
    if (hasEmpty && !refillReady) {
      const sig = JSON.stringify({
        phaseNow,
        IsPlayerBusy: state.globals.IsPlayerBusy,
        PendingSkillID: state.globals.PendingSkillID || '',
        ActionInProgress: state.globals.ActionInProgress,
        DeferAdvance: state.globals.DeferAdvance,
        refillActive: !!(refill && refill.active),
        blockingLane: refillStartBarrier.firstBlockingLane,
      });
      if (gameState._lastRefillBlockSig !== sig) {
        gameState._lastRefillBlockSig = sig;
        runtimeDebugLogging.gemDebugLog('[FILL_SKIP]', {
          stage: 'tick-refill-gate',
          reason: 'gate',
          hasEmpty,
          globals: {
            TurnPhase: state.globals.TurnPhase,
            CanPickGems: state.globals.CanPickGems,
            IsPlayerBusy: state.globals.IsPlayerBusy,
            PendingSkillID: state.globals.PendingSkillID || '',
            BoardFillActive: state.globals.BoardFillActive,
            DeferAdvance: state.globals.DeferAdvance,
            ActionLockUntil: state.globals.ActionLockUntil,
            MatchedColorValue: state.globals.MatchedColorValue,
            TapIndex: state.globals.TapIndex,
          },
        }, state);
      }
    }
    if (
      refillReady &&
      hasEmpty &&
      !enemyLineClearPressureActive
    ) {
      startRefillBounce();
    }
    if (
      phaseNow === 0 &&
      gameState.lastTurnPhase !== 0 &&
      !state.globals.IsPlayerBusy &&
      !state.globals.PendingSkillID &&
      !state.globals.ActionInProgress &&
      !state.globals.DeferAdvance &&
      refillStartBarrier.canStartRefill &&
      !(refill && refill.active) &&
      !enemyLineClearPressureActive
    ) {
      startRefillBounce();
    }
    gameState.lastTurnPhase = phaseNow;
    const boardFullNow = Array.isArray(gameState.gems) && gameState.gems.length === (boardGeometry.rows * boardGeometry.cols);
    if (bootstrapDeterministicRefillPending && boardFullNow && !(gameState.refillBounce && gameState.refillBounce.active)) {
      bootstrapDeterministicRefillPending = false;
    }
    if (runtimeDebugLogging.isGemDebugEnabled(state)) {
      const noRefillActive = !(gameState.refillBounce && gameState.refillBounce.active);
      const noSpinActive = !(gameState.yellowCasino && gameState.yellowCasino.active);
      const boardFull = Array.isArray(gameState.gems) && gameState.gems.length === 24;
      const idlePhase = state.globals.TurnPhase === 0;
      if (
        noRefillActive &&
        noSpinActive &&
        boardFull &&
        idlePhase &&
        !state.globals.DeferAdvance &&
        (state.globals.ActionLockUntil || 0) <= (state.globals.time || 0) &&
        !isCanPickGemsReady(state.globals.CanPickGems)
      ) {
        const sig = JSON.stringify({
          boardFull,
          TurnPhase: state.globals.TurnPhase,
          CanPickGems: state.globals.CanPickGems,
          IsPlayerBusy: state.globals.IsPlayerBusy,
          DeferAdvance: state.globals.DeferAdvance,
          ActionLockUntil: state.globals.ActionLockUntil,
          BoardFillActive: state.globals.BoardFillActive,
        });
        if (gameState._gateStuckCanPickSig !== sig) {
          gameState._gateStuckCanPickSig = sig;
          console.error('[GATE_STUCK_CANPICK]', {
            globals: getGemGateSnapshot(),
            gemsLength: gameState.gems.length,
            refillActive: false,
            spinActive: false,
          });
        }
      }
      const parkedActionPhase = (
        state.globals.GamePhase === 'RUNTIME' &&
        state.globals.TurnPhase === 1 &&
        boardFull &&
        noRefillActive &&
        noSpinActive
      );
      if (parkedActionPhase) {
        const snapshot = getActionHandoffSnapshot();
        const { time: _time, actionLockUntil: _actionLockUntil, ...dedupeSnapshot } = snapshot;
        const sig = JSON.stringify(dedupeSnapshot);
        if (gameState._turnPhase1StuckSig !== sig) {
          gameState._turnPhase1StuckSig = sig;
          runtimeDebugLogging.gemDebugLog('[TURNPHASE1_STUCK]', {
            reason: 'turnphase-one-parked-with-board-full',
            snapshot,
            enemyRosterStability: getEnemyRosterStabilitySnapshot(),
          }, state);
        }
      }
    }
    const enemyRosterStability = getEnemyRosterStabilitySnapshot();
    if (
      state.globals.GamePhase === 'RUNTIME' &&
      state.globals.DeferAdvance &&
      (state.globals.time || 0) >= (state.globals.ActionLockUntil || 0)
    ) {
      let deferredAdvanceState = canResolveDeferredAdvance({
        hasEmpty,
        enemyLineClearPressureActive,
      });
      if (
        !deferredAdvanceState.enemyRosterStability.stable &&
        !deferredAdvanceState.pendingEnemyDeathResolution
      ) {
        applyTurnGateIntent(createEnemyRosterRefillHold, {
          now: Number(state.globals.time || 0),
          currentTurnUID: deferredAdvanceState.currentUID,
        });
      } else if (deferredAdvanceState.refillPending) {
        // Refill must complete before advancing to the next actor.
        startRefillBounce();
        applyTurnGateIntent(createDeferredRefillHold, {
          now: Number(state.globals.time || 0),
        });
      } else if (deferredAdvanceState.textHold) {
        applyTurnGateIntent(createDeferredTextHold, {
          now: Number(state.globals.time || 0),
        });
      } else {
        if (deferredAdvanceState.staleActionInProgress) {
          applyTurnGateIntent(createDeferredStaleActionRecovery);
          console.log(`[TURN] cleared stale ActionInProgress before advance phase=${state.globals.TurnPhase} owner=${state.globals.ActionOwnerUID || 0} actionActor=${state.globals.ActionActorUID || 0}`);
          deferredAdvanceState = canResolveDeferredAdvance({
            hasEmpty,
            enemyLineClearPressureActive,
          });
        }
        if (deferredAdvanceState.staleBusy) {
          applyTurnGateIntent(createDeferredStaleBusyRecovery);
          console.log(`[TURN] cleared stale IsPlayerBusy before advance phase=${state.globals.TurnPhase} owner=${state.globals.ActionOwnerUID || 0}`);
          deferredAdvanceState = canResolveDeferredAdvance({
            hasEmpty,
            enemyLineClearPressureActive,
          });
        }
        if (deferredAdvanceState.ok) {
          console.log(`[TURN] DeferAdvance -> AdvanceTurn owner=${deferredAdvanceState.ownerUID} cur=${deferredAdvanceState.currentUID} phase=${state.globals.TurnPhase} busy=${state.globals.IsPlayerBusy} canPick=${state.globals.CanPickGems}`);
          const beforeAdvanceUID = deferredAdvanceState.currentUID;
          const beforeAdvancePhase = Number(state.globals.TurnPhase || 0);
          callFunctionWithContext(fnContext, 'AdvanceTurn');
          const afterAdvanceUID = Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
          const afterAdvancePhase = Number(state.globals.TurnPhase || 0);
          const postAdvanceRosterStability = getEnemyRosterStabilitySnapshot();
          const rosterHoldKeptDeferredAdvance = (
            !postAdvanceRosterStability.stable &&
            !!state.globals.DeferAdvance &&
            afterAdvanceUID === beforeAdvanceUID &&
            afterAdvancePhase === beforeAdvancePhase
          );
          if (!rosterHoldKeptDeferredAdvance) {
            applyTurnGateIntent(createDeferredAdvanceResolved);
            combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
          } else if (runtimeDebugLogging.isGemDebugEnabled(state)) {
            runtimeDebugLogging.gemDebugLog('[TURN_DEFER_PRESERVED]', {
              reason: 'advance-held-for-enemy-roster-refill',
              beforeAdvanceUID,
              afterAdvanceUID,
              beforeAdvancePhase,
              afterAdvancePhase,
              roster: postAdvanceRosterStability,
              snapshot: getActionHandoffSnapshot(),
            }, state);
          }
        } else if (
          !deferredAdvanceState.ownerOk &&
          !deferredAdvanceState.blockedPhase &&
          deferredAdvanceState.presentationBarrier.canAdvanceTurn
        ) {
          if (deferredAdvanceState.ownerUID) {
            callFunctionWithContext(fnContext, 'ClosePowerAmpForActor', deferredAdvanceState.ownerUID, 'owner_mismatch_autoclose');
          }
          applyTurnGateIntent(createDeferredAdvanceResolved);
          combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
        } else if (!state.globals._DeferBlockLogged) {
          state.globals._DeferBlockLogged = 1;
          console.log(`[TURN] DeferAdvance blocked pendingSelect=${!!deferredAdvanceState.pendingSelect} mergeInFlight=${deferredAdvanceState.mergeInFlight} IsPlayerBusy=${state.globals.IsPlayerBusy} TurnPhase=${state.globals.TurnPhase} owner=${deferredAdvanceState.ownerUID} cur=${deferredAdvanceState.currentUID} canPick=${state.globals.CanPickGems} actionInProgress=${state.globals.ActionInProgress}`);
        }
      }
    } else {
      state.globals._DeferBlockLogged = 0;
    }
    const currentTurnType = callFunctionWithContext(fnContext, 'GetCurrentType');
    trackTask011EnemyBoundary(currentTurnType);
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (
      activeLayoutId === 'combat' &&
      state.globals.GamePhase === 'RUNTIME' &&
      !gameState.combatFailExitRequested
    ) {
      const energy = Number(state.globals.Player_Energy || 0);
      const partyHp = Number(state.globals.PartyHP || 0);
      const livingHeroes = state.entities.filter((entity) => entity && entity.kind === 'hero' && (entity.hp ?? 0) > 0).length;
      const outcome = resolveMainRuntimeCombatOutcome({ energy, partyHp, livingHeroes });
      if (Number(outcome.code || 0) !== 0) {
        requestCombatFailureExit(outcome.reason);
      }
    }
    const currentTurnUID = callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0;
    if (
      state.globals.GamePhase === 'RUNTIME' &&
      currentTurnType === 1 &&
      state.globals.TurnPhase === 2 &&
      !state.globals.ActionInProgress &&
      !state.globals.IsPlayerBusy &&
      !state.globals.PendingSkillID &&
      (isCanPickGemsReady(state.globals.CanPickGems) || !state.globals.DeferAdvance)
    ) {
      const currentEnemy = currentTurnUID
        ? callFunctionWithContext(fnContext, 'GetActorByUID', currentTurnUID)
        : null;
      const refillActive = !!(gameState.refillBounce && gameState.refillBounce.active);
      const actionClaimBarrier = getPresentationTurnBarrier({
        hasEmpty,
        enemyLineClearPressureActive,
      });
      const liveCurrentEnemy = currentEnemy && currentEnemy.kind === 'enemy' && Number(currentEnemy.hp || 0) > 0;
      if (liveCurrentEnemy && !hasEmpty && !refillActive && actionClaimBarrier.canClaimCombatAction) {
        if (!enemyRosterStability.stable) {
          applyTurnGateIntent(createEnemyRosterRefillHold, {
            now: Number(state.globals.time || 0),
            currentTurnUID,
          });
        } else {
          applyTurnGateIntent(createEnemyTurnGateBaseline);
          state.globals.BoardFillActive = 0;
          callFunctionWithContext(fnContext, 'EnemyTurn', currentTurnUID);
        }
      } else if (liveCurrentEnemy) {
        if (!enemyRosterStability.stable) {
          applyTurnGateIntent(createEnemyRosterRefillHold, {
            now: Number(state.globals.time || 0),
            currentTurnUID,
          });
        } else {
          applyTurnGateIntent(createEnemyTurnRetryHold, {
            currentTurnUID,
          });
        }
        console.log(`[TURN] enemy retry hold uid=${currentTurnUID} hasEmpty=${hasEmpty} refillActive=${refillActive} idx=${state.globals.CurrentTurnIndex || 0}`);
      } else if (actionClaimBarrier.canClaimCombatAction) {
        applyTurnGateIntent(createEnemyTurnIdleRecovery, {
          now: Number(state.globals.time || 0),
          currentTurnUID,
        });
        combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
      } else if (runtimeDebugLogging.isGemDebugEnabled(state)) {
        runtimeDebugLogging.gemDebugLog('[TURN_ENEMY_IDLE_RECOVERY_HELD]', {
          reason: 'presentation-barrier',
          currentTurnUID,
          blockingLane: actionClaimBarrier.firstBlockingLane,
          hasEmpty,
          refillActive,
        }, state);
      }
    }
    const noRefillActive = !(gameState.refillBounce && gameState.refillBounce.active);
    const heroInputBarrier = getPresentationTurnBarrier({
      hasEmpty: hasEmptySlots(),
      enemyLineClearPressureActive: !!state.globals.EnemyLineClearPressureActive,
    });
    if (
      state.globals.GamePhase === 'RUNTIME' &&
      currentTurnType === 0 &&
      state.globals.TurnPhase === 0 &&
      noRefillActive &&
      heroInputBarrier.canRestoreHeroInput &&
      enemyRosterStability.stable &&
      (!isCanPickGemsReady(state.globals.CanPickGems) || state.globals.BoardFillActive !== 0)
    ) {
      state.globals.CanPickGems = true;
      state.globals.BoardFillActive = 0;
      if (runtimeDebugLogging.isGemDebugEnabled(state)) {
        runtimeDebugLogging.gemDebugLog('[TURN_RESTORE_PICK]', {
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
    // Enemy turns are started by ProcessTurn; avoid double-triggering here.
    gameState.enemyTurnKicked = state.globals.TurnPhase === 2;
    updateIdleFarmEmissions(performance.now() / 1000);
    heroGemProgressStorage.persistHeroGemProgressIfDirty({ stateGlobals: state.globals, callFunctionWithContext, fnContext });
    drawFrame();
    drawAstralWalletHUD();
    requestAnimationFrame(tick);
  }
  tick();

  registerDevBrowserTestHooks({
    state,
    gameState,
    callFunctionWithContext,
    fnContext,
    ensureDevToolingConfig,
    getDevAutoplayState,
    getDevToolHeroOptions,
    getDevToolEnemyOptions,
    layoutState,
    mapLayoutState,
    uiState,
    deriveEncounterRequestFromMapState,
    getHeroScreenRoster,
    normalizeHeroSelectionIndex,
    normalizePartyFormationSlots,
    getConfiguredHeroSlots,
    layoutHarnessEnabled,
    harnessLayoutState,
    harnessCombatGateway,
    deriveDamageFloatFrameOffset,
    isBoardGemLocked,
    drawFrame,
    handleGemMatch,
    toggleDevToolingModal,
    applyDevToolingConfig,
    runDevAutoplayUntilDepleted,
    getLatestCombatActionLine,
    getLatestStoryCardActionLine,
    getStoryCardLiveLineState,
    splitStoryCardActorSegment,
    getStoryCardIntentFallbackLine,
    isStoryCardTokenLine,
    ensureTask011Audit,
    getTask015TraceStore,
    assertBoardIntegrity,
  });
}

(async function boot() {
  try {
    await main();
  } catch (err) {
    console.error('[ERROR] Initialization failed:', err);
    out.textContent = `🎮 Puzzle RPG\n\n⚠️ Initialization Error\n${err.message}`;
  }
})();
