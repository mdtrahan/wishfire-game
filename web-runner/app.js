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
import * as renderMap from './systems/renderMap.js';
import * as renderBoard from './systems/renderBoard.js';
import * as devToolingControls from './systems/devToolingControls.js';
import * as gemVisuals from './systems/gemVisuals.js';
import * as renderCombatRuntime from './systems/renderCombatRuntime.js';
import * as renderTomes from './systems/renderTomes.js';
import * as renderArtifacts from './systems/renderArtifacts.js';
import * as renderMounts from './systems/renderMounts.js';
import * as renderCollectibles from './systems/renderCollectibles.js';
import * as renderRelics from './systems/renderRelics.js';
import * as renderPets from './systems/renderPets.js';
import * as renderIdleFarm from './systems/renderIdleFarm.js';
import * as renderEvolution from './systems/renderEvolution.js';
import * as renderHomestead from './systems/renderHomestead.js';
import * as renderChests from './systems/renderChests.js';
import * as renderHarnessFallback from './systems/renderHarnessFallback.js';
import * as renderOverlays from './systems/renderOverlays.js';
import * as renderSkillDraught from './systems/renderSkillDraughtOverlay.js';
import * as renderRuntime from './systems/renderRuntime.js';
import * as superGemRuntime from './systems/superGemRuntime.js';
import {
  createSimulationCoreSeededRng,
  initializeSimulationCoreShadow,
  shadowCombatPower,
  shadowSeededRng,
} from './systems/simulationCoreShadow.js';
import {
  addAppViewportResizeListener,
  resizeCanvasToContainedViewport,
} from './systems/appShellViewport.js';
import { createIdleFarmAppRuntime } from './systems/idleFarmAppRuntime.js';
import * as helpers from './utils/helpers.js';
import * as mapLayoutState from './state/mapLayoutState.js';
import * as uiState from './state/uiState.js';
import { createInitialGameState } from './state/gameState.js';
import { CANONICAL_HERO_ROSTER, FIGMA_HERO_BACK_URL, FIGMA_HERO_CLOSE_OVAL_URL, FIGMA_HERO_NEXT_URL, FIGMA_MINUS_URL, FIGMA_PLUS_URL, HERO_CLASS_LABELS, HERO_PACK_CLOSE_OVAL_PATH, HERO_PACK_MINUS_PATH, HERO_PACK_PLUS_PATH, HERO_STAT_KEYS, heroLayoutSpec } from './state/heroScreenConfig.js';
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
const DEV_TOOL_HOTKEY_LABEL = 'Ctrl+Shift+P';
const DEV_TOOL_GEM_RANDOM = -1;
const DEV_TOOL_GEM_OPTIONS = Object.freeze([
  { value: DEV_TOOL_GEM_RANDOM, label: 'Random' },
  { value: 1, label: 'RED' },
  { value: 2, label: 'BLUE' },
  { value: 3, label: 'YELLOW' },
  { value: 4, label: 'HEAL' },
  { value: 5, label: 'PURPLE' },
]);
const GEM_SPAWN_COLORS = Object.freeze([1, 2, 3, 4, 5]);
const DEV_TOOL_REWARD_OPTIONS = Object.freeze([
  { value: '', label: 'None' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'ENERGY', label: 'Energy' },
  { value: 'HEAL', label: 'Heal' },
  { value: 'SAND', label: 'Sand' },
  { value: 'BONE_CHIP', label: 'Bone Chip' },
  { value: 'SLIME', label: 'Slime' },
  { value: 'HORN', label: 'Horn' },
  { value: 'SHELL', label: 'Shell' },
]);
const DEV_TOOLING_STORAGE_KEY = 'orka.dev_tooling_config.v1';
const DEV_TOOL_EMPTY_SLOT = '';
const DEV_TOOL_RANDOM_ENEMY_SLOT = '__RANDOM__';
let devToolingDom = null;
let devToolingRefreshHandler = null;
let devToolingAutoplayHandler = null;
let devToolingPauseSnapshot = null;
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

function isActiveDrainFieldZone(zone) {
  if (!zone) return false;
  if (String(zone.effectName || '') !== 'Drain') return false;
  if (String(zone.visual || '') !== 'drain_lines') return false;
  const now = Number(state.globals.time || 0);
  if (now < Number(zone.visualStartsAt || zone.activeAt || 0)) return false;
  const fadeStartedAt = zone.fadeStartedAt == null ? null : Number(zone.fadeStartedAt || 0);
  if (fadeStartedAt == null) return true;
  return (now - fadeStartedAt) < 0.55;
}

function enemyOccupiesDrainFieldZone(enemy, zone) {
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

function hasPersistentEnemyDrainOverlay(uid) {
  if (!uid) return false;
  const enemy = state.entities.find((entity) => Number(entity && entity.uid || 0) === Number(uid || 0));
  if (!enemy) return false;
  const zones = Array.isArray(state.globals.DrainFieldZones) ? state.globals.DrainFieldZones : [];
  for (const zone of zones) {
    if (!isActiveDrainFieldZone(zone)) continue;
    if (!enemyOccupiesDrainFieldZone(enemy, zone)) continue;
    return true;
  }
  return false;
}

function getPersistentDrainFieldOverlays() {
  const zones = Array.isArray(state.globals.DrainFieldZones) ? state.globals.DrainFieldZones : [];
  const now = Number(state.globals.time || 0);
  const overlays = [];
  for (const zone of zones) {
    if (!isActiveDrainFieldZone(zone)) continue;
    const fadeStartedAt = zone.fadeStartedAt == null ? null : Number(zone.fadeStartedAt || 0);
    const fadeAlpha = fadeStartedAt == null
      ? 1
      : Math.max(0, Math.min(1, 1 - ((now - fadeStartedAt) / 0.55)));
    if (fadeAlpha <= 0) continue;
    overlays.push({
      id: String(zone.id || ''),
      slotIndex: Number(zone.slotIndex || 0),
      anchorWorldX: Number(zone.anchorWorldX),
      anchorWorldY: Number(zone.anchorWorldY),
      seed: Number(zone.sourceUID || 0) + Number(zone.slotIndex || 0) * 23,
      alpha: fadeAlpha,
      slowPct: Number(zone.drainSlowPct || 10),
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
  for (const d of texts) {
    if (!d || d.domSpawned) continue;
    d.domSpawned = true;
    const xOffset = d.targetKind === 'hero' ? -10 : (d.targetKind === 'ward' ? 0 : (d.canvasAnchored ? 0 : 10));
    const pos = d.canvasAnchored
      ? { x: Number(d.x || 0) + xOffset, y: Number(d.baseY != null ? d.baseY : (d.y || 0)) }
      : projectToCanvas((d.x || 0) + xOffset, d.baseY != null ? d.baseY : (d.y || 0));
    const isCrit = !!d.isCrit;
    const isEnergyText = d.targetKind === 'energy' || d.kind === 'energy';
    const text = isEnergyText
      ? `+${formatDamageValue({ value: d.amount, type: 'heal', isCrit })}`
      : (d.targetKind === 'bar'
        ? formatDamageValue({ value: d.amount, type: 'heal', isCrit })
        : formatDamageValue({ value: d.amount, type: d.kind === 'heal' ? 'heal' : (d.kind === 'ward' ? 'ward' : 'damage'), isCrit }));
    const animation = createDamageNumber({
      text,
      amount: d.amount,
      partyMaxHP: d.partyMaxHP,
      x: pos.x,
      y: pos.y,
      kind: isEnergyText ? 'energy' : (d.kind === 'heal' ? 'heal' : (d.kind === 'ward' ? 'ward' : 'damage')),
      targetKind: d.targetKind || null,
      isCrit,
      floatAngleDeg: d.floatAngleDeg,
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

function createDefaultDevToolingConfig() {
  return {
    open: false,
    hotkey: DEV_TOOL_HOTKEY_LABEL,
    heroSlots: CANONICAL_HERO_ROSTER.map((hero) => String(hero.name || '')),
    enemySlots: Array.from({ length: 3 }, () => DEV_TOOL_RANDOM_ENEMY_SLOT),
    boardGemColor: DEV_TOOL_GEM_RANDOM,
    goldAmount: 0,
    combatSpeed: 1,
    rewardDrops: '',
    rewardCount: 1,
    doubleAttackHeroName: '',
    doubleAttackChance: 1,
    lastAppliedAt: 0,
  };
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

function sanitizeDevToolingConfig(input = {}) {
  const base = createDefaultDevToolingConfig();
  const next = { ...base, ...(input && typeof input === 'object' ? input : {}) };
  next.open = !!next.open;
  next.hotkey = DEV_TOOL_HOTKEY_LABEL;
  const allowedHeroNames = new Set(base.heroSlots);
  const rawHeroSlots = Array.isArray(next.heroSlots) ? next.heroSlots : base.heroSlots;
  next.heroSlots = Array.from({ length: 4 }, (_, idx) => {
    const value = String(rawHeroSlots[idx] || '').trim();
    return value && allowedHeroNames.has(value) ? value : DEV_TOOL_EMPTY_SLOT;
  });
  if (!next.heroSlots.some(Boolean)) next.heroSlots[0] = base.heroSlots[0];
  const rawEnemySlots = Array.isArray(next.enemySlots) ? next.enemySlots : base.enemySlots;
  next.enemySlots = Array.from({ length: 3 }, (_, idx) => {
    const value = String(rawEnemySlots[idx] || '').trim();
    return value || DEV_TOOL_EMPTY_SLOT;
  });
  const colorValue = Number(next.boardGemColor);
  next.boardGemColor = DEV_TOOL_GEM_OPTIONS.some((row) => row.value === colorValue) ? colorValue : base.boardGemColor;
  next.goldAmount = Math.max(0, Math.floor(Number(next.goldAmount || 0)));
  next.combatSpeed = Math.max(0.25, Math.min(4, Number(next.combatSpeed || 1)));
  const rewardDrop = String(next.rewardDrops || '').trim().toUpperCase();
  next.rewardDrops = DEV_TOOL_REWARD_OPTIONS.some((row) => row.value === rewardDrop) ? rewardDrop : '';
  next.rewardCount = Math.max(0, Math.min(99, Math.floor(Number(next.rewardCount || base.rewardCount))));
  const doubleAttackHeroName = String(next.doubleAttackHeroName || '').trim();
  next.doubleAttackHeroName = !doubleAttackHeroName || allowedHeroNames.has(doubleAttackHeroName) ? doubleAttackHeroName : '';
  next.doubleAttackChance = 1;
  next.lastAppliedAt = Number(next.lastAppliedAt || 0);
  return next;
}

function syncConfiguredDoubleAttackHarness(cfg = ensureDevToolingConfig()) {
  const heroNames = getDevToolHeroOptions();
  for (const heroName of heroNames) {
    const actor = state.entities.find((entity) => entity && entity.kind === 'hero' && String(entity.name || '') === heroName);
    if (!actor) continue;
    callFunctionWithContext(fnContext, 'RemoveActorExtraTurnSkill', actor.uid);
  }
  const holderName = String(cfg.doubleAttackHeroName || '').trim();
  state.globals.DevDoubleAttackChance = Number(cfg.doubleAttackChance || 1);
  if (!holderName) {
    state.globals.DevDoubleAttackHolderName = '';
    state.globals.DevDoubleAttackHolderUID = 0;
    return null;
  }
  const actor = state.entities.find((entity) => entity && entity.kind === 'hero' && String(entity.name || '') === holderName);
  if (!actor) {
    state.globals.DevDoubleAttackHolderName = '';
    state.globals.DevDoubleAttackHolderUID = 0;
    return null;
  }
  callFunctionWithContext(fnContext, 'ConfigureActorExtraTurnSkill', actor.uid, {
    chance: Number(cfg.doubleAttackChance || 1),
    traitId: 'double_attack',
    skillId: 'DOUBLE_ATTACK',
  });
  state.globals.DevDoubleAttackHolderName = holderName;
  state.globals.DevDoubleAttackHolderUID = Number(actor.uid || 0);
  return Number(actor.uid || 0);
}

function readPersistedDevToolingConfig() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(DEV_TOOLING_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeDevToolingConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistDevToolingConfig(cfg) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(DEV_TOOLING_STORAGE_KEY, JSON.stringify(sanitizeDevToolingConfig(cfg)));
  } catch {}
}

function clearPersistedDevToolingConfig() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(DEV_TOOLING_STORAGE_KEY);
  } catch {}
}

function hardRestartRuntimeFromDevTooling() {
  if (typeof window === 'undefined' || !window.location) return false;
  clearPersistedDevToolingConfig();
  try {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = '';
    cleanUrl.hash = '';
    if (window.location.href !== cleanUrl.href && typeof window.location.replace === 'function') {
      window.location.replace(cleanUrl.href);
      return true;
    }
  } catch {}
  if (typeof window.location.reload === 'function') {
    window.location.reload();
    return true;
  }
  return false;
}

function ensureDevToolingConfig() {
  const persisted = readPersistedDevToolingConfig();
  const live = (state.globals.DevToolingConfig && typeof state.globals.DevToolingConfig === 'object')
    ? state.globals.DevToolingConfig
    : {};
  const next = sanitizeDevToolingConfig({
    ...(persisted || {}),
    ...live,
    open: !!live.open,
  });
  state.globals.DevToolingConfig = next;
  return next;
}

function getConfiguredHeroCount() {
  return sanitizeDevToolingConfig(state.globals.DevToolingConfig || {}).heroSlots.filter(Boolean).length;
}

function getConfiguredEnemyCount() {
  return sanitizeDevToolingConfig(state.globals.DevToolingConfig || {}).enemySlots
    .filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT)
    .length;
}

function getDevToolHeroOptions() {
  return CANONICAL_HERO_ROSTER.map((hero) => String(hero.name || '')).filter(Boolean);
}

function getDevToolEnemyOptions() {
  const pool = Array.isArray(state.globals.DevToolEnemyCatalog) ? state.globals.DevToolEnemyCatalog : [];
  return [...new Set(pool.map((name) => String(name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function getConfiguredHeroSlots() {
  return sanitizeDevToolingConfig(state.globals.DevToolingConfig || {}).heroSlots.slice(0, 4);
}

function getConfiguredEnemySlots() {
  return sanitizeDevToolingConfig(state.globals.DevToolingConfig || {}).enemySlots.slice(0, 3);
}

function syncIdleFarmDevLoadoutConfig(cfg = ensureDevToolingConfig()) {
  const layout = gameState.idleFarmLayout || (gameState.idleFarmLayout = {});
  const currentConfig = (layout.config && typeof layout.config === 'object') ? layout.config : {};
  const heroNames = Array.isArray(cfg.heroSlots) ? cfg.heroSlots.map((value) => String(value || '').trim()).filter(Boolean) : [];
  const rawEnemySlots = Array.isArray(cfg.enemySlots) ? cfg.enemySlots.map((value) => String(value || '').trim()) : [];
  const activeEnemySlots = rawEnemySlots.filter((value) => value !== DEV_TOOL_EMPTY_SLOT);
  layout.config = {
    ...currentConfig,
    heroNames,
    enemySlots: Math.max(1, activeEnemySlots.length || Number(currentConfig.enemySlots || 1)),
    enemyNames: rawEnemySlots.map((value) => (value === DEV_TOOL_RANDOM_ENEMY_SLOT ? '' : value)),
  };
  return layout.config;
}

function readEscortPartyConfig() {
  const raw = state.globals && state.globals.EscortPartyConfig;
  if (!raw || typeof raw !== 'object' || !raw.enabled) return null;
  const heroName = String(raw.activeHeroName || raw.heroName || '').trim();
  const escortName = String(raw.escortName || raw.name || 'Escort').trim() || 'Escort';
  const portraitName = String(raw.escortPortraitName || raw.portraitName || heroName || 'Falie').trim() || 'Falie';
  const heroDisplaySlot = Math.max(0, Math.min(3, Math.floor(Number(raw.heroDisplaySlot ?? 0) || 0)));
  let escortDisplaySlot = Math.max(0, Math.min(3, Math.floor(Number(raw.escortDisplaySlot ?? (heroDisplaySlot + 1)) || 0)));
  if (escortDisplaySlot === heroDisplaySlot) escortDisplaySlot = Math.min(3, heroDisplaySlot + 1);
  const hp = Math.max(1, Math.floor(Number(raw.hp || raw.maxHP || 30) || 30));
  const maxHP = Math.max(hp, Math.floor(Number(raw.maxHP || hp) || hp));
  return {
    activeHeroName: heroName,
    heroDisplaySlot,
    escortName,
    escortDisplaySlot,
    portraitName,
    hp,
    maxHP,
  };
}

function buildConfiguredCombatPartyMembers(configuredHeroSlots, escortConfig = null) {
  const requestedSlots = Array.from({ length: 4 }, (_, idx) => String(configuredHeroSlots?.[idx] || '').trim());
  const resolvedSlots = escortConfig
    ? Array.from({ length: 4 }, () => DEV_TOOL_EMPTY_SLOT)
    : requestedSlots.slice();
  if (escortConfig) {
    const heroName = String(escortConfig.activeHeroName || '').trim();
    if (heroName) resolvedSlots[escortConfig.heroDisplaySlot] = heroName;
  }
  const heroCloneCounts = {};
  const heroMembers = resolvedSlots.map((heroName, displaySlot) => {
    const name = String(heroName || '').trim();
    if (!name) return null;
    const canonicalIndex = CANONICAL_HERO_ROSTER.findIndex((hero) => String(hero?.name || '') === name);
    if (canonicalIndex === -1) return null;
    heroCloneCounts[name] = Number(heroCloneCounts[name] || 0) + 1;
    const cloneOrdinal = heroCloneCounts[name];
    const cloneLabel = String.fromCharCode(64 + Math.min(26, cloneOrdinal));
    const duplicateCount = resolvedSlots.filter((slotName) => String(slotName || '').trim() === name).length;
    return {
      ...CANONICAL_HERO_ROSTER[canonicalIndex],
      canonicalIndex,
      baseHeroName: name,
      cloneOrdinal,
      cloneLabel,
      instanceName: duplicateCount > 1 ? `${name} ${cloneLabel}` : name,
      heroInstanceKey: `${name.toLowerCase()}#${cloneOrdinal}`,
      displaySlot,
    };
  });
  const escortMember = escortConfig ? {
    uid: 0,
    kind: 'escort',
    name: escortConfig.escortName,
    baseHeroName: escortConfig.portraitName,
    portraitName: escortConfig.portraitName,
    hp: escortConfig.hp,
    maxHP: escortConfig.maxHP,
    heroDisplaySlot: escortConfig.escortDisplaySlot,
    escortDisplaySlot: escortConfig.escortDisplaySlot,
    nonActingEscort: true,
    isAlive: true,
    stats: { ATK: 0, DEF: 0, MAG: 0, RES: 0, SPD: 0 },
    attackType: 'none',
  } : null;
  return {
    heroMembers,
    escortMember,
    renderSlots: heroMembers
      .map((member) => member ? { ...member, kind: 'hero', heroDisplaySlot: member.displaySlot } : null)
      .concat(escortMember ? [escortMember] : [])
      .filter(Boolean)
      .sort((a, b) => Number(a.heroDisplaySlot || 0) - Number(b.heroDisplaySlot || 0)),
  };
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

function applyBoardGemColor(colorValue) {
  const color = Number(colorValue);
  if (!Number.isFinite(color) || color === DEV_TOOL_GEM_RANDOM) return 0;
  if (!Array.isArray(gameState.gems)) return 0;
  resetSuperGemBoardState(gameState);
  superGemRuntime.clearPendingSuperGemAction(state);
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  gameState.gemMergeFx = null;
  state.globals.BoardFillActive = 0;
  state.globals.TapIndex = 0;
  let changed = 0;
  for (const gem of gameState.gems) {
    if (!gem) continue;
    gem.color = color;
    gem.elementIndex = color;
    gem.selected = false;
    gem.Selected = 0;
    gem.flashUntil = 0;
    changed += 1;
  }
  setGemArray(gameState.gems);
  rebuildGridFromGems();
  return changed;
}

function updateDevToolingStatus(message = '') {
  if (!devToolingDom) return;
  const autoplayActive = !!state.globals.DevAutoplayActive;
  if (devToolingDom.autoplay) {
    devToolingDom.autoplay.textContent = devToolingControls.getAutoplayButtonLabel(autoplayActive);
  }
  if (!devToolingDom.status) return;
  const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
    ? layoutState.getActiveLayoutId()
    : 'unknown';
  const skillDraught = getSkillDraughtDevSummary();
  const suffix = message ? `\n${message}` : '';
  devToolingDom.status.textContent =
    `Hotkey: ${DEV_TOOL_HOTKEY_LABEL}\nActive Layout: ${activeLayoutId}\nIdle Mode: ${autoplayActive ? 'ACTIVE' : 'idle'}\nSkill Draw: ${skillDraught}\nApply: writes only the selected condition; no combat reset, turn advance, or loadout refresh${suffix}`;
}

function getSkillDraughtDevSummary() {
  const draught = callFunctionWithContext(fnContext, 'GetSkillDraughtState') || {};
  const sessionSkills = draught.sessionSkillsByHeroUID || {};
  const learnedCount = Object.values(sessionSkills).reduce((total, row) => total + (Array.isArray(row) ? row.length : 0), 0);
  const open = Number(draught.open || 0) ? 'open' : 'closed';
  return `${open}, hero ${Number(draught.heroUID || 0)}, candidates ${(draught.candidates || []).length}, session ${learnedCount}`;
}

function populateDevToolSlotSelect(selectEl, { choices = [], includeRandom = false, selected = '' } = {}) {
  if (!selectEl) return;
  const value = String(selected || '');
  selectEl.innerHTML = '';
  if (includeRandom) {
    const randomOpt = document.createElement('option');
    randomOpt.value = DEV_TOOL_RANDOM_ENEMY_SLOT;
    randomOpt.textContent = 'Current pool/random';
    selectEl.appendChild(randomOpt);
  }
  const emptyOpt = document.createElement('option');
  emptyOpt.value = DEV_TOOL_EMPTY_SLOT;
  emptyOpt.textContent = 'Empty slot';
  selectEl.appendChild(emptyOpt);
  for (const name of choices) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  }
  const fallback = includeRandom ? DEV_TOOL_RANDOM_ENEMY_SLOT : DEV_TOOL_EMPTY_SLOT;
  selectEl.value = Array.from(selectEl.options).some((opt) => opt.value === value) ? value : fallback;
}

function syncDevToolingDomFromConfig() {
  if (!devToolingDom) return;
  const cfg = ensureDevToolingConfig();
  const heroChoices = getDevToolHeroOptions();
  const enemyChoices = getDevToolEnemyOptions();
  devToolingDom.heroSlots.forEach((selectEl, idx) => {
    populateDevToolSlotSelect(selectEl, { choices: heroChoices, includeRandom: false, selected: cfg.heroSlots[idx] || '' });
  });
  devToolingDom.enemySlots.forEach((selectEl, idx) => {
    populateDevToolSlotSelect(selectEl, { choices: enemyChoices, includeRandom: true, selected: cfg.enemySlots[idx] || DEV_TOOL_RANDOM_ENEMY_SLOT });
  });
  devToolingDom.boardGemColor.value = String(cfg.boardGemColor);
  devToolingDom.goldAmount.value = String(cfg.goldAmount);
  devToolingDom.combatSpeed.value = String(cfg.combatSpeed);
  devToolingDom.rewardDrops.value = String(cfg.rewardDrops || '');
  devToolingDom.rewardCount.value = String(cfg.rewardCount);
  populateDevToolSlotSelect(devToolingDom.doubleAttackHero, { choices: getDevToolHeroOptions(), includeRandom: false, selected: cfg.doubleAttackHeroName || DEV_TOOL_EMPTY_SLOT });
  if (devToolingDom.skillHero && !devToolingDom.skillHero.value) {
    devToolingDom.skillHero.value = String(callFunctionWithContext(fnContext, 'GetCurrentTurn') || '');
  }
  updateDevToolingStatus();
}

function readDevToolingDomConfigPatch() {
  if (!devToolingDom) return {};
  return {
    heroSlots: devToolingDom.heroSlots.map((selectEl) => String(selectEl?.value || '')),
    enemySlots: devToolingDom.enemySlots.map((selectEl) => String(selectEl?.value || DEV_TOOL_RANDOM_ENEMY_SLOT)),
    boardGemColor: Number(devToolingDom.boardGemColor.value || 0),
    goldAmount: Number(devToolingDom.goldAmount.value || 0),
    combatSpeed: Number(devToolingDom.combatSpeed.value || 1),
    rewardDrops: String(devToolingDom.rewardDrops.value || ''),
    rewardCount: Number(devToolingDom.rewardCount.value || 1),
    doubleAttackHeroName: String(devToolingDom.doubleAttackHero?.value || ''),
  };
}

async function applyDevToolingConfig(patch = {}, { closeModal = true } = {}) {
  const prev = ensureDevToolingConfig();
  const next = sanitizeDevToolingConfig({
    ...prev,
    ...(patch && typeof patch === 'object' ? patch : {}),
    lastAppliedAt: Number(state.globals.time || 0),
  });
  state.globals.DevToolingConfig = next;
  state.globals.DevHeroSlots = [...next.heroSlots];
  state.globals.DevHeroCount = next.heroSlots.filter(Boolean).length;
  state.globals.DevEnemySlots = [...next.enemySlots];
  state.globals.EncounterMaxSlots = next.enemySlots.filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT).length;
  state.globals.DevForcedEnemyType = '';
  state.globals.DevForcedBoardColor = next.boardGemColor;
  state.globals.goldTotal = next.goldAmount;
  state.globals.DevCombatSpeedMultiplier = next.combatSpeed;
  state.globals.DevRewardDropId = next.rewardDrops;
  state.globals.DevRewardDrops = next.rewardDrops
    ? Array.from({ length: next.rewardCount }, () => next.rewardDrops)
    : [];
  state.globals.DevRewardCount = next.rewardCount;
  state.globals.DevDoubleAttackHolderName = '';
  state.globals.DevDoubleAttackHolderUID = 0;
  state.globals.DevDoubleAttackChance = Number(next.doubleAttackChance || 1);
  persistDevToolingConfig(next);
  syncIdleFarmDevLoadoutConfig(next);
  gameState.selectedHero = Math.min(gameState.selectedHero || 0, Math.max(0, next.heroSlots.filter(Boolean).length - 1));
  gameState.selectedEnemy = Math.min(gameState.selectedEnemy || 0, Math.max(0, next.enemySlots.filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT).length - 1));
  const recolored = applyBoardGemColor(next.boardGemColor);
  const doubleAttackUID = syncConfiguredDoubleAttackHarness(next);
  const heroSlotsChanged = JSON.stringify(prev.heroSlots || []) !== JSON.stringify(next.heroSlots || []);
  const enemySlotsChanged = JSON.stringify(prev.enemySlots || []) !== JSON.stringify(next.enemySlots || []);
  const loadoutChanged = heroSlotsChanged || enemySlotsChanged;
  const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
    ? layoutState.getActiveLayoutId()
    : '';
  let appliedSessionChange = 'none';
  if (loadoutChanged) {
    if (activeLayoutId === 'combat' && typeof devToolingRefreshHandler === 'function') {
      await devToolingRefreshHandler({ forceCombat: false, resetGame: false });
      appliedSessionChange = 'combat_refresh';
    } else if (activeLayoutId === 'idleFarmLayout') {
      restartIdleFarmSession(performance.now() / 1000);
      appliedSessionChange = 'idle_restart';
    }
  }
  syncDevToolingDomFromConfig();
  if (closeModal) closeDevToolingModal({ restorePauseSnapshot: appliedSessionChange !== 'combat_refresh' });
  updateDevToolingStatus(
    `Applied\n` +
    `Board recolor count: ${recolored}\n` +
    `Hero slots (staged): ${next.heroSlots.map((value) => value || 'Empty').join(', ')}\n` +
    `Enemy slots (staged): ${next.enemySlots.map((value) => value === DEV_TOOL_RANDOM_ENEMY_SLOT ? 'Random' : (value || 'Empty')).join(', ')}\n` +
    `Double Attack: ${next.doubleAttackHeroName || 'Off'}${doubleAttackUID ? ` (uid ${doubleAttackUID})` : ''}\n` +
    `Reward (staged): ${next.rewardDrops || 'None'} x${next.rewardCount}\n` +
    `${loadoutChanged ? `Loadout applied: ${appliedSessionChange}` : 'Combat state unchanged'}`
  );
  return {
    ...next,
    rewardDrops: [...(state.globals.DevRewardDrops || [])],
    boardRecolored: recolored,
    doubleAttackUID,
    loadoutChanged,
    appliedSessionChange,
    refreshed: false,
  };
}

function ensureDevToolingModal() {
  if (devToolingDom || typeof document === 'undefined') return devToolingDom;
  const root = document.createElement('div');
  root.id = 'orka-dev-tooling-modal';
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'background:rgba(0,0,0,0.58)',
    'z-index:9999',
    'padding:16px',
    'box-sizing:border-box',
  ].join(';');
  const panel = document.createElement('div');
  panel.style.cssText = [
    'width:min(520px, calc(100vw - 32px))',
    'max-height:88vh',
    'overflow:auto',
    'padding:18px',
    'border-radius:14px',
    'border:2px solid #1f2937',
    'background:#f7f2e8',
    'box-shadow:0 18px 48px rgba(0,0,0,0.4)',
    'font:12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'color:#111827',
  ].join(';');
  panel.innerHTML = `
    <style>
      #orka-dev-tooling-modal * { box-sizing:border-box; }
      #orka-dev-tooling-modal button {
        appearance:none;
        -webkit-appearance:none;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:36px;
        line-height:1;
        white-space:nowrap;
        text-align:center;
        user-select:none;
        pointer-events:auto;
        text-decoration:none;
      }
      #orka-dev-tooling-modal input,
      #orka-dev-tooling-modal select { width:100%; box-sizing:border-box; }
      @media (max-width: 560px) {
        #orka-dev-tooling-modal [data-devtool-control-grid] { grid-template-columns:1fr !important; }
      }
    </style>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
      <div>
        <div style="font-size:18px;font-weight:800;">Dev Tooling Modal</div>
      </div>
      <button type="button" data-devtool-close style="border:1px solid #334155;background:#ffffff;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;">Close</button>
    </div>
    <div data-devtool-control-grid style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;">
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="font-weight:700;">Hero Slots</div>
        <label style="display:flex;flex-direction:column;gap:4px;">Hero Slot 1
          <select data-devtool-hero-slot="0"></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Hero Slot 2
          <select data-devtool-hero-slot="1"></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Hero Slot 3
          <select data-devtool-hero-slot="2"></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Hero Slot 4
          <select data-devtool-hero-slot="3"></select>
        </label>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="font-weight:700;">Enemy Slots</div>
        <label style="display:flex;flex-direction:column;gap:4px;">Enemy Slot 1
          <select data-devtool-enemy-slot="0"></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Enemy Slot 2
          <select data-devtool-enemy-slot="1"></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Enemy Slot 3
          <select data-devtool-enemy-slot="2"></select>
        </label>
      </div>
      <label style="display:flex;flex-direction:column;gap:4px;">Board Gem Color
        <select data-devtool-board-color>
          ${DEV_TOOL_GEM_OPTIONS.map((row) => `<option value="${row.value}">${row.label}</option>`).join('')}
        </select>
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">Gold Amount
        <input data-devtool-gold-amount type="number" min="0" step="1">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">Combat Speed
        <input data-devtool-combat-speed type="number" min="0.25" max="4" step="0.25">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">Reward Drop
        <select data-devtool-reward-drops>
          ${DEV_TOOL_REWARD_OPTIONS.map((row) => `<option value="${row.value}">${row.label}</option>`).join('')}
        </select>
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">Reward Count
        <input data-devtool-reward-count type="number" min="0" max="99" step="1">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">Double Attack
        <select data-devtool-double-attack-hero></select>
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">Skill Draw Hero UID
        <input data-devtool-skill-hero type="number" min="0" step="1">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">Skill Draw Skill ID
        <input data-devtool-skill-id type="text" placeholder="optional">
      </label>
    </div>
    <div data-devtool-button-row style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px;">
      <button type="button" data-devtool-apply style="border:1px solid #14532d;background:#1f8f4a;color:#fff;padding:8px 12px;border-radius:8px;font-weight:800;cursor:pointer;">Apply</button>
      <button type="button" data-devtool-refresh style="border:1px solid #475569;background:#fff;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Save Staged</button>
      <button type="button" data-devtool-autoplay style="border:1px solid #1d4ed8;background:#eff6ff;color:#1e3a8a;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">AutoPlay</button>
      <button type="button" data-devtool-restart style="border:1px solid #92400e;background:#fff7ed;color:#9a3412;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Restart</button>
      <button type="button" data-devtool-force-skill-draught style="border:1px solid #4c1d95;background:#f5f3ff;color:#4c1d95;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Force Draw</button>
      <button type="button" data-devtool-trigger-destiny style="border:1px solid #365314;background:#f7fee7;color:#365314;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Trigger Destiny</button>
      <button type="button" data-devtool-clear-session-skills style="border:1px solid #7f1d1d;background:#fef2f2;color:#7f1d1d;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Clear Skills</button>
    </div>
  `;
  root.appendChild(panel);
  document.body.appendChild(root);
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.textContent = 'DEV';
  launcher.setAttribute('aria-label', 'Open developer tooling modal');
  launcher.style.cssText = [
    'position:fixed',
    'top:10px',
    'right:10px',
    'z-index:10000',
    'border:1px solid #1f2937',
    'background:#f8fafc',
    'color:#111827',
    'padding:6px 10px',
    'border-radius:999px',
    'font:700 11px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'cursor:pointer',
    'box-shadow:0 4px 12px rgba(0,0,0,0.18)',
  ].join(';');
  document.body.appendChild(launcher);
  devToolingDom = {
    root,
    panel,
    launcher,
    close: panel.querySelector('[data-devtool-close]'),
    apply: panel.querySelector('[data-devtool-apply]'),
    refresh: panel.querySelector('[data-devtool-refresh]'),
    restart: panel.querySelector('[data-devtool-restart]'),
    autoplay: panel.querySelector('[data-devtool-autoplay]'),
    heroSlots: Array.from(panel.querySelectorAll('[data-devtool-hero-slot]')),
    enemySlots: Array.from(panel.querySelectorAll('[data-devtool-enemy-slot]')),
    boardGemColor: panel.querySelector('[data-devtool-board-color]'),
    goldAmount: panel.querySelector('[data-devtool-gold-amount]'),
    combatSpeed: panel.querySelector('[data-devtool-combat-speed]'),
    rewardDrops: panel.querySelector('[data-devtool-reward-drops]'),
    rewardCount: panel.querySelector('[data-devtool-reward-count]'),
    doubleAttackHero: panel.querySelector('[data-devtool-double-attack-hero]'),
    skillHero: panel.querySelector('[data-devtool-skill-hero]'),
    skillId: panel.querySelector('[data-devtool-skill-id]'),
    forceSkillDraught: panel.querySelector('[data-devtool-force-skill-draught]'),
    triggerDestiny: panel.querySelector('[data-devtool-trigger-destiny]'),
    clearSessionSkills: panel.querySelector('[data-devtool-clear-session-skills]'),
    status: null,
  };
  devToolingDom.launcher.addEventListener('click', () => toggleDevToolingModal(true));
  devToolingDom.close.addEventListener('click', () => toggleDevToolingModal(false));
  devToolingDom.refresh.addEventListener('click', () => applyDevToolingConfig(readDevToolingDomConfigPatch(), { closeModal: false }));
  devToolingDom.apply.addEventListener('click', () => applyDevToolingConfig(readDevToolingDomConfigPatch(), { closeModal: true }));
  devToolingDom.restart.addEventListener('click', async () => devToolingControls.handleRestartClick({
    closeDevToolingModal,
    devToolingRefreshHandler,
    updateDevToolingStatus,
  }));
  devToolingDom.autoplay.addEventListener('click', async () => {
    if (state.globals.DevAutoplayActive) {
      state.globals.DevAutoplayStopRequested = 1;
      updateDevToolingStatus('AutoPlay stop requested');
      return;
    }
    closeDevToolingModal({ restorePauseSnapshot: true });
    if (typeof devToolingAutoplayHandler === 'function') {
      await devToolingAutoplayHandler();
    }
  });
  devToolingDom.forceSkillDraught.addEventListener('click', () => {
    const heroUID = Number(devToolingDom.skillHero?.value || callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
    const skillId = String(devToolingDom.skillId?.value || '').trim();
    callFunctionWithContext(fnContext, 'ForceAstralFlowSkillDraught', heroUID, skillId);
    closeDevToolingModal({ restorePauseSnapshot: true });
  });
  devToolingDom.triggerDestiny.addEventListener('click', () => {
    const requestedUID = Number(devToolingDom.skillHero?.value || 0);
    const requestedActor = state.entities.find(actor => Number(actor?.uid || 0) === requestedUID) || null;
    const currentUID = Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
    const currentActor = state.entities.find(actor => Number(actor?.uid || 0) === currentUID) || null;
    const fallbackHero = state.entities.find(actor => actor?.kind === 'hero' && Number(actor?.hp || 0) > 0) || null;
    const sourceUID = requestedActor?.kind === 'hero'
      ? requestedUID
      : (currentActor?.kind === 'hero' ? currentUID : Number(fallbackHero?.uid || 0));
    const result = callFunctionWithContext(fnContext, 'TriggerPartyDestinyDev', sourceUID);
    if (!result?.success) {
      callFunctionWithContext(fnContext, 'LogCombat', `Destiny dev trigger failed: ${result?.reason || 'no-op'}.`);
    }
    closeDevToolingModal({ restorePauseSnapshot: true });
  });
  devToolingDom.clearSessionSkills.addEventListener('click', () => {
    callFunctionWithContext(fnContext, 'ClearSessionSkillDraught');
    updateDevToolingStatus('Session skill draw cleared');
  });
  root.addEventListener('click', (ev) => {
    if (ev.target === root) toggleDevToolingModal(false);
  });
  syncDevToolingDomFromConfig();
  return devToolingDom;
}

function pauseGameplayForDevTooling() {
  if (devToolingPauseSnapshot) return;
  devToolingPauseSnapshot = {
    CanPickGems: Number(state.globals.CanPickGems || 0),
    IsPlayerBusy: Number(state.globals.IsPlayerBusy || 0),
    DeferAdvance: Number(state.globals.DeferAdvance || 0),
    PendingSkillID: String(state.globals.PendingSkillID || ''),
    CombatSessionId: Number(state.globals.CombatSessionId || 0),
    TurnSerial: Number(state.globals.TurnSerial || 0),
  };
  applyTurnGateGlobals({
    CanPickGems: 0,
    IsPlayerBusy: 1,
  });
  state.globals.DevToolingPaused = 1;
}

function isDev2DiagnosticsOpen() {
  const panel = document.getElementById('dev2-diagnostics');
  return !!panel && !panel.hidden;
}

function clearDevToolingPauseSnapshot() {
  devToolingPauseSnapshot = null;
}

function restorePlayableHeroInputAfterDevToolingResume() {
  const heroInputBarrier = getPresentationTurnBarrier({
    hasEmpty: hasEmptySlots(),
    enemyLineClearPressureActive: !!state.globals.EnemyLineClearPressureActive,
  });
  const combatIdleHeroInputReady = (
    state.globals.GamePhase === 'RUNTIME' &&
    callFunctionWithContext(fnContext, 'GetCurrentType') === 0 &&
    state.globals.TurnPhase === 0 &&
    !(gameState.refillBounce && gameState.refillBounce.active) &&
    !(gameState.yellowCasino && gameState.yellowCasino.active) &&
    !hasEmptySlots() &&
    heroInputBarrier.canRestoreHeroInput &&
    getEnemyRosterStabilitySnapshot().stable
  );
  if (!combatIdleHeroInputReady) return false;
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  for (const gem of (gameState.gems || [])) {
    if (!gem) continue;
    gem.selected = false;
    gem.Selected = 0;
  }
  state.globals.TapIndex = 0;
  state.globals.CanPickGems = true;
  state.globals.IsPlayerBusy = 0;
  state.globals.DeferAdvance = 0;
  state.globals.BoardFillActive = 0;
  return true;
}

function resumeGameplayFromDevTooling() {
  if (!devToolingPauseSnapshot) {
    state.globals.DevToolingPaused = 0;
    return;
  }
  const sameCombatSession =
    Number(devToolingPauseSnapshot.CombatSessionId || 0) === Number(state.globals.CombatSessionId || 0);
  const sameTurnSerial =
    Number(devToolingPauseSnapshot.TurnSerial || 0) === Number(state.globals.TurnSerial || 0);
  if (sameCombatSession && sameTurnSerial) {
    applyTurnGateGlobals(devToolingPauseSnapshot);
    restorePlayableHeroInputAfterDevToolingResume();
  }
  state.globals.DevToolingPaused = 0;
  clearDevToolingPauseSnapshot();
}

function closeDevToolingModal({ restorePauseSnapshot = true } = {}) {
  const cfg = ensureDevToolingConfig();
  const root = ensureDevToolingModal()?.root;
  cfg.open = false;
  state.globals.DevToolingConfig = cfg;
  if (root) root.style.display = 'none';
  if (restorePauseSnapshot) {
    if (isDev2DiagnosticsOpen()) {
      state.globals.DevToolingPaused = 1;
    } else {
      resumeGameplayFromDevTooling();
    }
  } else {
    devToolingPauseSnapshot = null;
    state.globals.DevToolingPaused = 0;
  }
  return cfg;
}

function resetCombatRuntimeForFreshSession(reason = 'combat-refresh', options = {}) {
  const refill = gameState.refillBounce || (gameState.refillBounce = {});
  refill.active = false;
  refill.queue = [];
  refill.index = 0;
  refill.current = null;
  refill.speedScale = 1;

  const yellowCasino = gameState.yellowCasino || (gameState.yellowCasino = {});
  yellowCasino.active = false;
  yellowCasino.phase = 'idle';
  yellowCasino.queue = [];
  yellowCasino.index = 0;
  yellowCasino.current = null;
  yellowCasino.telegraphUntil = 0;
  yellowCasino.ghost = null;
  yellowCasino.pendingGoldAward = 0;

  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  gameState.gemMergeFx = null;
  gameState.lastTurnPhase = null;
  gameState.enemyTurnKicked = false;
  gameState.buffRollTimer = 0;
  gameState._lastBuffRollActive = 0;
  state.globals.BoardFillActive = Number(options.boardFillActive || 0);
  state.globals.HeroLungeOffsetByUID = {};
  state.globals.DamageTexts = [];
  state.globals.TextAnimEndAt = 0;
  state.globals.TextAnimating = 0;
  state.globals.BlueBuffSequenceActive = 0;
  state.globals.BuffRollActive = 0;
  state.globals.BuffRollFrame = 0;
  state.globals.BuffRollSlot = -1;
  state.globals.BuffRollEndsAt = 0;
  state.globals.BuffRollApplyStat = 0;
  state.globals.BuffRollSkillID = '';
  state.globals.BuffRollActor = 0;
  state.globals.BuffRollType = 0;
  delete state.globals.HeroAction;
  delete state.globals.EnemyAction;
  delete state.globals.PendingHeroHits;
  delete state.globals.DoubleAttackLungeStarted;
  delete state.globals.DoubleAttackBatchAnchors;
  delete state.globals.NextHeroActionProfile;

  applyTurnGateGlobals(createCombatTurnRefreshBaseline(state.globals, {
    currentTurnType: Number(options.currentTurnType || 0),
    boardFillActive: Number(state.globals.BoardFillActive || 0),
    boardHasEmptySlots: !!options.boardHasEmptySlots,
  }));

  clearDevToolingPauseSnapshot();
  state.globals.DevToolingPaused = (ensureDevToolingConfig().open || isDev2DiagnosticsOpen()) ? 1 : 0;
  console.log(
    `[TURN] reset combat runtime baseline reason=${reason} ` +
    `turnType=${Number(options.currentTurnType || 0)} ` +
    `boardFill=${Number(state.globals.BoardFillActive || 0)} ` +
    `hasEmpty=${options.boardHasEmptySlots ? 1 : 0}`,
  );
}

function toggleDevToolingModal(nextOpen = null) {
  const cfg = ensureDevToolingConfig();
  const root = ensureDevToolingModal()?.root;
  if (!root) return cfg;
  const open = nextOpen == null ? !cfg.open : !!nextOpen;
  cfg.open = open;
  state.globals.DevToolingConfig = cfg;
  root.style.display = open ? 'flex' : 'none';
  if (open) {
    pauseGameplayForDevTooling();
    syncDevToolingDomFromConfig();
    devToolingDom.heroSlots[0]?.focus();
  } else {
    closeDevToolingModal({ restorePauseSnapshot: true });
  }
  return cfg;
}

window.addEventListener('orka:dev2-diagnostics-open-change', (ev) => {
  const open = !!ev?.detail?.open;
  if (open) {
    pauseGameplayForDevTooling();
    return;
  }
  if (!ensureDevToolingConfig().open) {
    resumeGameplayFromDevTooling();
  }
});
if (isDev2DiagnosticsOpen()) {
  pauseGameplayForDevTooling();
}

function isDevToolingHotkey(ev) {
  if (!ev) return false;
  const key = String(ev.key || '').toLowerCase();
  const code = String(ev.code || '');
  return !!((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (code === 'KeyP' || key === 'p'));
}

function isEditableDomTarget(target) {
  const tag = String(target?.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

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
function resolveEnemyEncounterCombatPower(row) {
  const explicit = Number(row?.EncounterCP ?? row?.encounterCP ?? row?.CombatPower ?? row?.combatPower);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit * 100) / 100;
  return computeCombatPower(row?.ATK, row?.DEF, row?.HP);
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

function isPointInRect(mx, my, rect) {
  if (!rect) return false;
  return mx >= rect.x && mx <= (rect.x + rect.w) && my >= rect.y && my <= (rect.y + rect.h);
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

function normalizeBiomeTags(input) {
  if (Array.isArray(input)) {
    const tags = input.map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    return tags.length ? tags : ['all'];
  }
  const raw = String(input ?? '').trim();
  if (!raw) return ['all'];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeBiomeTags(parsed);
    } catch (_) {
      // no-op: fall through to delimited parsing
    }
  }
  const tags = raw
    .split('|')
    .flatMap(part => String(part).split(','))
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  return tags.length ? tags : ['all'];
}

function normalizeEnemyRole(input) {
  const role = String(input || '').trim().toLowerCase();
  if (role === 'commander' || role === 'bodyguard' || role === 'fodder') return role;
  return 'fodder';
}

function normalizeFaction(input) {
  const faction = String(input || '').trim().toLowerCase();
  if (faction === 'wishless' || faction === 'dreamless' || faction === 'hopeless') return faction;
  return 'wishless';
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

function generateEncounterSeed() {
  const now = Date.now() >>> 0;
  const perfNow = Math.floor(((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) * 1000) >>> 0;
  const rand = Math.floor(Math.random() * 0x7fffffff) >>> 0;
  const mixed = (now ^ perfNow ^ rand) >>> 0;
  return mixed || 1;
}

function computeEncounterTotalCP(picks) {
  return (picks || []).reduce((sum, row) => sum + Number(row?.CombatPower || row?.combatPower || 0), 0);
}

function buildEncounterSpawnPlan(picks, { policy = 'mixed' } = {}) {
  const rows = Array.isArray(picks) ? picks.filter(Boolean) : [];
  if (!rows.length) return [];
  const isSoloCommander = String(policy || '').trim().toLowerCase() === 'solo_commander';
  if (isSoloCommander) {
    const commanderRows = rows.filter((row) => normalizeEnemyRole(row?.enemyRole || row?.role) === 'commander');
    const soloPool = commanderRows.length ? commanderRows : rows;
    const pick = soloPool[Math.floor(Math.random() * soloPool.length)];
    return [{ row: pick, slotIndex: 1 }];
  }

  const pool = [...rows];
  const selected = [];
  while (selected.length < Math.min(3, rows.length) && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }
  if (!selected.length) return [];
  const getCP = (row) => Number(row?.CombatPower || row?.combatPower || 0);
  let strongestIdx = 0;
  for (let i = 1; i < selected.length; i += 1) {
    if (getCP(selected[i]) > getCP(selected[strongestIdx])) strongestIdx = i;
  }
  const strongest = selected[strongestIdx];
  const sideRows = selected.filter((_, idx) => idx !== strongestIdx);
  if (sideRows.length > 1 && Math.random() < 0.5) sideRows.reverse();

  const plan = [{ row: strongest, slotIndex: 1 }];
  if (sideRows[0]) plan.push({ row: sideRows[0], slotIndex: 0 });
  if (sideRows[1]) plan.push({ row: sideRows[1], slotIndex: 2 });
  return plan;
}

function buildForcedEnemySpawnPlan(row, count) {
  if (!row) return [];
  const total = Math.max(0, Math.min(3, Math.floor(Number(count || 0))));
  if (!total) return [];
  const slotOrder = [1, 0, 2];
  const plan = [];
  for (let i = 0; i < total; i += 1) {
    plan.push({ row, slotIndex: slotOrder[i] });
  }
  return plan;
}

function deriveEncounterPoolNames({ pool, locale = 'all', faction = '' } = {}) {
  const candidates = Array.isArray(pool) ? pool : [];
  const normalizedLocale = String(locale || 'all').trim().toLowerCase() || 'all';
  const rawFactionFilter = String(faction || '').trim().toLowerCase();
  const normalizedFaction = rawFactionFilter ? normalizeFaction(rawFactionFilter) : '';
  return candidates
    .filter((row) => {
      const tags = normalizeBiomeTags(row?.localeTags || row?.locale || row?.biome || 'all');
      const localeOk = normalizedLocale === 'all' || tags.includes('all') || tags.includes(normalizedLocale);
      if (!localeOk) return false;
      if (!normalizedFaction) return true;
      return normalizeFaction(row?.faction) === normalizedFaction;
    })
    .map((row) => String(row?.name || '').trim())
    .filter(Boolean);
}

function buildEncounterByBudget({ pool, targetCP, locale = 'all', maxSlots = 3, policy = 'mixed', seed = 1, faction = '', historyCounts = null } = {}) {
  const candidates = Array.isArray(pool) ? pool : [];
  const normalizedLocale = String(locale || 'all').trim().toLowerCase() || 'all';
  const rawFactionFilter = String(faction || '').trim().toLowerCase();
  const normalizedFaction = rawFactionFilter ? normalizeFaction(rawFactionFilter) : '';
  const rng = createSeededRng(seed);
  const reasonCodes = [];
  const eligibleNames = new Set(deriveEncounterPoolNames({ pool: candidates, locale: normalizedLocale, faction: normalizedFaction }));
  const eligible = candidates.filter((row) => eligibleNames.has(String(row?.name || '').trim()));
  if (!eligible.length) {
    return { selected: [], finalCP: 0, targetCP: Number(targetCP || 0), deltaCP: Number(targetCP || 0), slotsUsed: 0, underfilled: true, reasonCodes: ['no_locale_candidates'] };
  }

  const slots = Math.max(1, Number(maxSlots || 3));
  const target = Math.max(0, Number(targetCP || 0));
  const selected = [];
  const usedNames = new Set();
  const byRole = {
    commander: eligible.filter(e => normalizeEnemyRole(e?.enemyRole || e?.role) === 'commander'),
    bodyguard: eligible.filter(e => normalizeEnemyRole(e?.enemyRole || e?.role) === 'bodyguard'),
    fodder: eligible.filter(e => normalizeEnemyRole(e?.enemyRole || e?.role) === 'fodder'),
  };

  const pickBest = (source, remainingTarget, capName = '') => {
    const arr = (source || []).filter(row => row && !usedNames.has(String(row.name || '')));
    if (!arr.length) return null;
    const getSeen = (row) => Number(historyCounts && historyCounts[String(row?.name || '')] || 0);
    const hasHistory = !!(historyCounts && typeof historyCounts === 'object');
    let working = arr;
    if (hasHistory) {
      let minSeen = Infinity;
      for (const row of arr) minSeen = Math.min(minSeen, getSeen(row));
      const lowestSeenPool = arr.filter(row => getSeen(row) === minSeen);
      if (lowestSeenPool.length) working = lowestSeenPool;
    }
    const ranked = working
      .map((row) => {
        const cp = Number(row?.CombatPower || row?.combatPower || 0);
        const diff = Math.abs(remainingTarget - cp);
        return { row, diff };
      })
      .sort((a, b) => a.diff - b.diff);
    const topK = ranked.slice(0, Math.max(1, Math.min(6, ranked.length)));
    const rollPool = topK.length ? topK : ranked;
    const pickIndex = Math.floor(rng() * rollPool.length);
    const best = rollPool[Math.max(0, Math.min(rollPool.length - 1, pickIndex))].row;
    if (capName) reasonCodes.push(`picked_${capName}`);
    return best;
  };

  const pushPick = (row) => {
    if (!row || selected.length >= slots) return;
    selected.push(row);
    usedNames.add(String(row.name || ''));
  };

  const normalizedPolicy = String(policy || 'mixed').trim().toLowerCase();
  if (normalizedPolicy === 'solo_commander') {
    const commander = pickBest(byRole.commander, target, 'commander');
    if (commander) {
      pushPick(commander);
    } else {
      reasonCodes.push('no_commander_for_solo_policy');
      pushPick(pickBest(eligible, target, 'fallback_any'));
    }
  } else if (normalizedPolicy === 'fodder_only') {
    while (selected.length < slots) {
      const remaining = target - computeEncounterTotalCP(selected);
      const fodder = pickBest(byRole.fodder, remaining, 'fodder');
      if (!fodder) break;
      pushPick(fodder);
    }
  } else {
    // Mixed policy: allow any role and balance by CP fit + underused roster entries.
    while (selected.length < slots) {
      const remaining = target - computeEncounterTotalCP(selected);
      let pick = pickBest(eligible, remaining, 'mixed_any');
      if (!pick) pick = pickBest(byRole.fodder, remaining, 'fodder');
      if (!pick) pick = pickBest(byRole.bodyguard, remaining, 'bodyguard');
      if (!pick) pick = pickBest(byRole.commander, remaining, 'commander');
      if (!pick) pick = pickBest(eligible, remaining, 'fallback_any');
      if (!pick) break;
      pushPick(pick);
    }
  }

  const finalCP = computeEncounterTotalCP(selected);
  const underfilled = selected.length < slots || finalCP < target;
  if (selected.length < slots) reasonCodes.push('underfilled_slots');
  if (finalCP < target) reasonCodes.push('underfilled_cp');
  return {
    selected,
    finalCP,
    targetCP: target,
    deltaCP: target - finalCP,
    slotsUsed: selected.length,
    underfilled,
    reasonCodes,
  };
}

function initEntities(enemyRows, layoutInstances) {
  assertCombatLayoutDev('initEntities');
  state.entities = [];
  state.globals.EnemyData = (enemyRows || []).map((row) => ({
    ...row,
    faction: normalizeFaction(row?.faction),
    enemyRole: normalizeEnemyRole(row?.enemyRole || row?.role),
    locale: String(row?.locale || row?.biome || row?.biomes || 'all').trim().toLowerCase() || 'all',
    biome: String(row?.biome || row?.biomes || 'all').trim().toLowerCase() || 'all',
    biomeTags: normalizeBiomeTags(row?.biomes || row?.biome || 'all'),
    localeTags: normalizeBiomeTags(row?.localeTags || row?.locale_tags || row?.locale || row?.biomes || row?.biome || 'all'),
    CombatPower: resolveEnemyEncounterCombatPower(row),
  }));
  const mappedEnemyData = state.globals.EnemyData;
  state.globals.DevToolEnemyCatalog = [...new Set(state.globals.EnemyData.map((row) => String(row?.name || row?.EnemyName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  state.globals.CombatSessionId = Number(state.globals.CombatSessionId || 0) + 1;
  callFunctionWithContext(fnContext, 'ClearSessionSkillDraught');
  resetBootstrapRngSession();

  const partyHP = [];
  const partyMaxHP = [];
  const configuredHeroSlots = getConfiguredHeroSlots();
  const escortConfig = readEscortPartyConfig();
  const partyMembers = buildConfiguredCombatPartyMembers(configuredHeroSlots, escortConfig);
  const heroSlotRoster = partyMembers.heroMembers;
  for (let i = 0; i < CANONICAL_HERO_ROSTER.length; i++) {
    const v = heroSlotRoster[i];
    if (!v) {
      partyHP[i] = 0;
      partyMaxHP[i] = 0;
      continue;
    }
    let maxHP = Number(v.maxHP);
    if (!Number.isFinite(maxHP) || maxHP <= 0) maxHP = 1;
    let hp = Number(v.hp);
    if (!Number.isFinite(hp) || hp < 0) hp = maxHP;
    if (hp > maxHP) hp = maxHP;
    partyHP[i] = hp;
    partyMaxHP[i] = maxHP;
    state.entities.push({
      uid: i + 1,
      kind: 'hero',
      name: v.instanceName,
      baseHeroName: v.baseHeroName,
      heroInstanceKey: v.heroInstanceKey,
      heroCloneOrdinal: v.cloneOrdinal,
      heroCloneLabel: v.cloneLabel,
      hp,
      maxHP: partyMaxHP[i],
      combatPower: computeCombatPower(v.ATK, v.DEF, partyMaxHP[i]),
      stats: {
        ATK: Number(v.ATK),
        DEF: Number(v.DEF),
        MAG: Number(v.MAG),
        RES: Number(v.RES),
        SPD: Number(v.SPD),
      },
      heroIndex: Number(v.canonicalIndex || 0),
      heroDisplaySlot: i,
      attackType: v.attackType,
      isAlive: true,
    });
    runtimeDebugLogging.startupDebugLog(`[HP_FIX] hero=${v.name} maxHP=${maxHP}`);
  }
  if (partyMembers.escortMember) {
    const escortUID = state.entities.reduce((max, entity) => Math.max(max, Number(entity?.uid || 0)), 0) + 1;
    const escortEntity = {
      ...partyMembers.escortMember,
      uid: escortUID,
    };
    state.entities.push(escortEntity);
    state.globals.EscortNPCState = {
      uid: escortUID,
      name: escortEntity.name,
      portraitName: escortEntity.baseHeroName,
      hp: escortEntity.hp,
      maxHP: escortEntity.maxHP,
      displaySlot: escortEntity.heroDisplaySlot,
      enabled: 1,
    };
  } else {
    delete state.globals.EscortNPCState;
  }

  gameState.partyHP = partyHP;
  gameState.partyMaxHP = partyMaxHP;
  callFunctionWithContext(fnContext, 'InitPartyHPFromHeroes');
  // Test lane seed: deterministic party skill-point stock for upgrade-consumption QA.
  callFunctionWithContext(fnContext, 'SetHeroSkillPointsForParty', 300, 'ORKA-spt-seed');
  state.globals.BattleStartMode = 'heroes';
  state.globals.BattleStartResolved = 1;
  state.globals.TeamPhaseType = 0;
  state.globals.BattleStartShown = 1;
  state.globals.BattleStartClearedForSession = 0;
  const msg = 'Heroes take the initiative!';
  state.globals.BattleStartText = msg;
  state.globals.BattleStartSessionText = msg;
  state.globals.BattleStartSessionId = Number(state.globals.CombatSessionId || 0);
  state.globals.BattleStartActive = 1;
  state.globals.BattleStartProcessStarted = 0;
  state.globals.BattleStartEndsAt = 2.0;
  state.globals.BattleStartFadeEndsAt = 2.4;
  state.globals.IsPlayerBusy = 1;
  state.globals.CanPickGems = 0;
  // Ensure enemy UIDs don't collide with hero UIDs
  state.globals.NextUID = state.entities.reduce((max, e) => Math.max(max, e.uid || 0), 0) + 1;

  if (enemyRows && enemyRows.length) {
    state.globals.InitialSpawn = 1;
    const rawSeed = Number(state.globals.EncounterSeed || 0);
    const explicitSeed = Number(state.globals.EncounterSeedExplicit || 0) === 1;
    const encounterSeed = (explicitSeed && Number.isFinite(rawSeed) && rawSeed > 0)
      ? rawSeed
      : generateEncounterSeed();
    state.globals.EncounterSeed = encounterSeed;
    state.globals.EncounterSeedExplicit = 0;
    installCombatRuntimeRandom(deriveCombatRuntimeRngSeed(encounterSeed), 'initEntities');
    const encounterRequest = {
      pool: mappedEnemyData,
      targetCP: Number(state.globals.EncounterTargetCP || 120),
      locale: String(state.globals.EncounterLocale || state.globals.CurrentLocale || 'clouds'),
      maxSlots: Number(state.globals.EncounterMaxSlots || 3),
      policy: String(state.globals.EncounterPolicy || 'mixed'),
      seed: encounterSeed,
      faction: String(state.globals.EncounterFaction || ''),
      historyCounts: (state.globals.EncounterSeenCounts && typeof state.globals.EncounterSeenCounts === 'object')
        ? state.globals.EncounterSeenCounts
        : {},
    };
    runtimeDebugLogging.startupDebugLog(`[ENCOUNTER] seed=${encounterSeed} targetCP=${encounterRequest.targetCP} locale=${encounterRequest.locale} policy=${encounterRequest.policy}`);
    const configuredEnemySlots = getConfiguredEnemySlots();
    const hasManualEnemyLayout = configuredEnemySlots.some((value) => String(value || '').trim() !== DEV_TOOL_RANDOM_ENEMY_SLOT);
    let encounter = null;
    let spawnPlan = [];
    if (hasManualEnemyLayout) {
      const randomSlotIndexes = [];
      for (let slotIndex = 0; slotIndex < configuredEnemySlots.length; slotIndex += 1) {
        const slotValue = String(configuredEnemySlots[slotIndex] || '').trim();
        if (!slotValue) continue;
        if (slotValue === DEV_TOOL_RANDOM_ENEMY_SLOT) {
          randomSlotIndexes.push(slotIndex);
          continue;
        }
        const row = mappedEnemyData.find((entry) => String(entry?.name || entry?.EnemyName || '').trim() === slotValue);
        if (row) spawnPlan.push({ row, slotIndex });
      }
      if (randomSlotIndexes.length) {
        const randomEncounter = buildEncounterByBudget({
          ...encounterRequest,
          maxSlots: randomSlotIndexes.length,
        });
        const randomRows = randomEncounter.selected || [];
        for (let i = 0; i < Math.min(randomSlotIndexes.length, randomRows.length); i += 1) {
          spawnPlan.push({ row: randomRows[i], slotIndex: randomSlotIndexes[i] });
        }
      }
      spawnPlan.sort((a, b) => Number(a.slotIndex || 0) - Number(b.slotIndex || 0));
      encounter = {
        selected: spawnPlan.map((entry) => entry.row),
        finalCP: spawnPlan.reduce((sum, entry) => sum + Number(entry?.row?.CombatPower || entry?.row?.combatPower || 0), 0),
        targetCP: Number(encounterRequest.targetCP || 0),
        deltaCP: 0,
        slotsUsed: spawnPlan.length,
        underfilled: spawnPlan.length < configuredEnemySlots.filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT).length,
        reasonCodes: ['manual_enemy_slots'],
      };
    } else {
      encounter = buildEncounterByBudget(encounterRequest);
      const picks = encounter.selected || [];
      spawnPlan = buildEncounterSpawnPlan(picks, { policy: encounterRequest.policy });
    }
    const picks = encounter.selected || [];
    state.globals.EncounterSummary = encounter;
    state.globals.EncounterPoolNames = hasManualEnemyLayout
      ? picks.map((pick) => String(pick?.name || '')).filter(Boolean)
      : deriveEncounterPoolNames({
          pool: mappedEnemyData,
          locale: encounterRequest.locale,
          faction: encounterRequest.faction,
        });
    const seen = (state.globals.EncounterSeenCounts && typeof state.globals.EncounterSeenCounts === 'object')
      ? state.globals.EncounterSeenCounts
      : {};
    for (const pick of picks) {
      const key = String(pick?.name || '').trim();
      if (!key) continue;
      seen[key] = Number(seen[key] || 0) + 1;
    }
    state.globals.EncounterSeenCounts = seen;
    for (let i = 0; i < spawnPlan.length; i++) {
      const pick = spawnPlan[i].row;
      const slotIndex = Number(spawnPlan[i].slotIndex || 0);
      callFunctionWithContext(fnContext, 'SpawnEnemy', {
        name: pick.name,
        HP: Number(pick.HP || 0),
        ATK: Number(pick.ATK || 0),
        DEF: Number(pick.DEF || 0),
        MAG: Number(pick.MAG || 0),
        RES: Number(pick.RES || 0),
        SPD: Number(pick.SPD || 0),
        attackType: String(pick.attackType || ''),
        faction: String(pick.faction || 'wishless'),
        enemyRole: String(pick.enemyRole || 'fodder'),
        localeTags: Array.isArray(pick.localeTags) ? pick.localeTags : ['all'],
        CombatPower: Number(pick.CombatPower || pick.combatPower || resolveEnemyEncounterCombatPower(pick)),
      }, slotIndex);
    }
    state.globals.InitialSpawn = 0;
  }
  // Ensure party starts at full health
  if (state.globals.PartyMaxHP > 0) {
    state.globals.PartyHP = state.globals.PartyMaxHP;
    syncFromGlobals();
  }
  callFunctionWithContext(fnContext, 'UpdateEnemyHPUI');
  if (state.globals.EnemyHPByIndex) {
    gameState.enemyHP = [...state.globals.EnemyHPByIndex];
    gameState.enemyMaxHP = [...state.globals.EnemyMaxHPByIndex];
  }
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
    if (pendingGoldAward > 0 && mergeSources.length > 0) {
      startGemMergeFx({
        target: casino.goldMergeTarget || getGoldLabelTargetWorld(),
        scaleOut: false,
        startScale: 1.5,
        sourceItems: mergeSources,
      });
      if (gameState.gemMergeFx && gameState.gemMergeFx.active) {
        gameState.gemMergeFx.goldAward = pendingGoldAward;
        gameState.gemMergeFx.releaseGate = {};
        casino.pendingGoldAward = 0;
        state.globals.CanPickGems = 0;
        state.globals.IsPlayerBusy = 1;
      } else {
        state.globals.goldTotal = Number(state.globals.goldTotal || 0) + pendingGoldAward;
        casino.pendingGoldAward = 0;
        applyTurnGateIntent(createYellowSequenceSkip);
      }
    } else if (pendingGoldAward > 0) {
      state.globals.goldTotal = Number(state.globals.goldTotal || 0) + pendingGoldAward;
      casino.pendingGoldAward = 0;
      applyTurnGateIntent(createYellowSequenceSkip);
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
      ? gameState.selectedGems.filter((gm) => gm && !isBoardGemLocked(gm) && Number(gm.color ?? gm.elementIndex) === YELLOW_COLOR)
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

async function loadImage(url){
  return new Promise((res)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = ()=>res(null);
    img.src = resolveRuntimeImageUrl(url);
  });
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
  devToolingRefreshHandler = refreshCombatSessionFromDevTooling;
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

    images = {};
    enemySpriteImages = {};
    heroPortraitImages = {};
    wardBarrierImage = null;
    heroSkillIconsBySlot = [];
    heroSelectorImage = null;
    gemFrameImages = [];
    superGemFrameImages = [];
    superGemRainbowImage = null;
    buffIconFrameImages = {};
    debuffIconImages = {};
    mapBackgroundImage = null;
    heroCapsuleImages = {};
    plusIconImage = null;
    minusIconImage = null;
    heroBackArrowImage = null;
    heroNextArrowImage = null;
    closeWinOvalImage = null;
    let loadedCount = 0;
    const failedImages = [];
    const getSpriteImagePath = (t, data) => {
      const pluginId = data && data['plugin-id'];
      if (pluginId && pluginId !== 'Sprite') return null;
      let animName = null;
      try {
        animName = data.animations && data.animations.items && data.animations.items[0] && data.animations.items[0].name;
      } catch {}
      const imgPath = makeImagePath(t, animName);
      if (!imgPath) return null;
      return { imgPath, animName };
    };
    const loadSpriteTypeImage = async (t, data) => {
      const meta = getSpriteImagePath(t, data);
      if (!meta) return { type: t, skipped: true };
      try {
        const img = await loadImage(meta.imgPath);
        if (img) {
          images[t] = img;
          loadedCount++;
          if (['UI_NavCloseButton', 'UI_NavCloseX', 'UI_CloseWin'].includes(t)) {
            runtimeDebugLogging.startupDebugLog(`[LOAD] SUCCESS: ${t} loaded from ${meta.imgPath}`);
          }
          return { type: t, ok: true };
        }
        failedImages.push({ type: t, path: meta.imgPath, anim: meta.animName });
        if (['UI_NavCloseButton', 'UI_NavCloseX', 'UI_CloseWin'].includes(t)) {
          console.log(`[LOAD] FAILED: ${t} from ${meta.imgPath}`);
        }
        return { type: t, ok: false };
      } catch (e) {
        console.warn(`[LOAD] Failed to load image for type ${t}:`, e.message);
        failedImages.push({ type: t, path: meta.imgPath, anim: meta.animName });
        return { type: t, ok: false, reason: e.message };
      }
    };
    const loadBaseSprites = async (typeNames, progressStart = null, progressEnd = null) => {
      const names = Array.isArray(typeNames) ? typeNames : [];
      if (names.length === 0) return;
      let completed = 0;
      await Promise.all(names.map(async (t) => {
        await loadSpriteTypeImage(t, types[t]);
        completed += 1;
        if (progressStart != null && progressEnd != null) {
          const tNorm = completed / names.length;
          const pct = progressStart + ((progressEnd - progressStart) * tNorm);
          updateStartupLoadState({ progress: pct });
        }
      }));
    };

    const loadCoreVisuals = async () => {
      const tasks = [];
      const heroPortraitLoads = ['Falie', 'Huun', 'Runa', 'Kojonn'].map(async (heroName) => {
        heroPortraitImages[heroName] = await loadImage(assetUrl(`images/cap_${heroName}.png`));
      });
      const wardBarrierLoad = (async () => {
        wardBarrierImage = await loadImage(assetUrl('images/falie_ward_84x62.png'));
      })();
      const heroSkillIconLoads = [
        'images/bufficon1-animation 1-000.png',
        'images/bufficon2-animation 1-000.png',
        'images/bufficon3-animation 1-000.png',
      ].map(async (imgPath, idx) => {
        heroSkillIconsBySlot[idx] = await loadImage(assetUrl(imgPath));
      });
      const gemVisualLoads = (async () => {
        const loadedGemVisuals = await gemVisuals.loadGemVisuals({ assetUrl, loadImage });
        gemFrameImages = loadedGemVisuals.gemFrameImages;
        superGemFrameImages = loadedGemVisuals.superGemFrameImages;
        superGemRainbowImage = loadedGemVisuals.superGemRainbowImage;
      })();
      const heroCapsuleLoads = CANONICAL_HERO_ROSTER.map(async (hero) => {
        const key = String(hero.name || '');
        if (!key) return;
        heroCapsuleImages[key] = await loadImage(assetUrl(`images/cap_${key}.png`));
      });
      const plusPromise = loadImage(assetUrl(HERO_PACK_PLUS_PATH)).then(img => img || loadImage(FIGMA_PLUS_URL));
      const minusPromise = loadImage(assetUrl(HERO_PACK_MINUS_PATH)).then(img => img || loadImage(FIGMA_MINUS_URL));
      const closePromise = loadImage(assetUrl(HERO_PACK_CLOSE_OVAL_PATH)).then(img => img || loadImage(FIGMA_HERO_CLOSE_OVAL_URL));

      tasks.push(
        ...heroPortraitLoads,
        wardBarrierLoad,
        ...heroSkillIconLoads,
        ...heroCapsuleLoads,
        gemVisualLoads,
        (async () => { heroSelectorImage = await loadImage(assetUrl('images/h_selector-animation 1-000.png')); })(),
        (async () => { mapBackgroundImage = await loadImage(assetUrl('images/map-layout.png')); })(),
        (async () => { plusIconImage = await plusPromise; })(),
        (async () => { minusIconImage = await minusPromise; })(),
        (async () => { heroBackArrowImage = await loadImage(FIGMA_HERO_BACK_URL); })(),
        (async () => { heroNextArrowImage = await loadImage(FIGMA_HERO_NEXT_URL); })(),
        (async () => { closeWinOvalImage = await closePromise; })(),
      );

      let completed = 0;
      const total = Math.max(1, tasks.length);
      await Promise.all(tasks.map(async (task) => {
        await task;
        completed += 1;
        const tNorm = completed / total;
        updateStartupLoadState({ progress: 0.55 + (0.35 * tNorm) });
      }));
    };

    const loadDeferredVisuals = async () => {
      const enemyType = types['Enemy_Sprite'];
      if (enemyType && enemyType.animations && Array.isArray(enemyType.animations.items)) {
        for (const anim of enemyType.animations.items) {
          const animName = anim.name;
          const imgPath = makeImagePath('Enemy_Sprite', animName);
          if (!imgPath) continue;
          const img = await loadImage(imgPath);
          if (img) enemySpriteImages[String(animName).toLowerCase()] = img;
        }
        runtimeDebugLogging.startupDebugLog('[LOAD] Enemy_Sprite animations loaded:', Object.keys(enemySpriteImages).length);
      }
      for (let i = 1; i <= 4; i++) {
        const key = `buffIcon${i}`;
        buffIconFrameImages[key] = [];
        for (let f = 0; f < 5; f++) {
          const imgPath = assetUrl(`images/bufficon${i}-animation 1-${String(f).padStart(3, '0')}.png`);
          const img = await loadImage(imgPath);
          if (img) buffIconFrameImages[key][f] = img;
        }
      }
      debuffIconImages.ATK = await loadImage(assetUrl('images/ATK_down.png'));
      debuffIconImages.DEF = await loadImage(assetUrl('images/DEF_down.png'));
      debuffIconImages.MAG = await loadImage(assetUrl('images/MAG_down.png'));
      debuffIconImages.RES = await loadImage(assetUrl('images/RES_down.png'));
      debuffIconImages.SPD = await loadImage(assetUrl('images/SPD_down.png'));
    };

    try {
      const allTypeNames = Object.keys(types);
      await loadBaseSprites(allTypeNames, 0.3, 0.74);
      updateStartupLoadState({ phase: 'bootstrap', label: 'Loading hero and board visuals...', progress: 0.74 });
      await loadCoreVisuals();
      updateStartupLoadState({ phase: 'bootstrap', label: 'Loading extended visuals...', progress: 0.9 });
      await loadDeferredVisuals();
      updateStartupLoadState({ phase: 'bootstrap', label: 'Finalizing runtime...', progress: 0.96 });
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
  const registerCoreLayouts = (layoutState, { combatGateway: gateway }) => {
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

    layoutState.registerLayout({
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
        gateway.resume(freshCombatStart ? null : (resumeSnapshot || null));
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
        const snapshot = gateway.suspend();
        const transitionLabel = to === 'idleFarmLayout' ? '1->2' : '1->x';
        validateCombatSnapshot(snapshot, 'onExit', transitionLabel);
        return snapshot;
      },
    });
    layoutState.registerLayout({
      id: 'mapLayout',
      allowedTransitions: ['combat', 'tomesLayout', 'artifactsLayout', 'mountsLayout', 'collectiblesLayout', 'relicsLayout', 'petsLayout', 'homesteadLayout'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        mapLayoutState.setMapPanY(0);
        mapLayoutState.setMapLayoutField('tomesLocaleHit', null);
        mapLayoutState.setMapLayoutField('artifactsLocaleHit', null);
        mapLayoutState.setMapLayoutField('mountsLocaleHit', null);
        mapLayoutState.setMapLayoutField('collectiblesLocaleHit', null);
        mapLayoutState.setMapLayoutField('relicsLocaleHit', null);
        mapLayoutState.setMapLayoutField('homesteadLocaleHit', null);
        mapLayoutState.setMapLayoutField('closeHit', null);
        mapLayoutState.setMapDragState({
          active: false,
          pointerId: null,
          lastX: 0,
          lastY: 0,
          moved: 0,
        });
        console.log('[LAYOUT_PHASE1]', { stage: 'onEnter', transition: '1->map', trigger: 'map-click' });
      },
      onActive() {},
      onExit() { return null; },
    });
    layoutState.registerLayout({
      id: 'tomesLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.tomesLayout.hitZones = null;
        gameState.tomesLayout.selectedIndex = Math.max(
          0,
          Math.min(
            Math.max(0, (gameState.tomesLayout.gallery || []).length - 1),
            Number(gameState.tomesLayout.selectedIndex || 0),
          ),
        );
      },
      onActive() {},
      onExit() {
        gameState.tomesLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'artifactsLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.artifactsLayout.hitZones = null;
        gameState.artifactsLayout.selectedIndex = Math.max(
          0,
          Math.min(
            Math.max(0, (gameState.artifactsLayout.gallery || []).length - 1),
            Number(gameState.artifactsLayout.selectedIndex || 0),
          ),
        );
      },
      onActive() {},
      onExit() {
        gameState.artifactsLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'mountsLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.mountsLayout.hitZones = null;
        gameState.mountsLayout.selectedIndex = Math.max(
          0,
          Math.min(
            Math.max(0, (gameState.mountsLayout.gallery || []).length - 1),
            Number(gameState.mountsLayout.selectedIndex || 0),
          ),
        );
      },
      onActive() {},
      onExit() {
        gameState.mountsLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'collectiblesLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.collectiblesLayout.hitZones = null;
        gameState.collectiblesLayout.selectedIndex = Math.max(
          0,
          Math.min(
            Math.max(0, (gameState.collectiblesLayout.gallery || []).length - 1),
            Number(gameState.collectiblesLayout.selectedIndex || 0),
          ),
        );
      },
      onActive() {},
      onExit() {
        gameState.collectiblesLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'relicsLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.relicsLayout.hitZones = null;
        gameState.relicsLayout.selectedIndex = Math.max(
          0,
          Math.min(
            Math.max(0, (gameState.relicsLayout.gallery || []).length - 1),
            Number(gameState.relicsLayout.selectedIndex || 0),
          ),
        );
      },
      onActive() {},
      onExit() {
        gameState.relicsLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'petsLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.petsLayout.hitZones = null;
        gameState.petsLayout.selectedIndex = Math.max(
          0,
          Math.min(
            Math.max(0, (gameState.petsLayout.gallery || []).length - 1),
            Number(gameState.petsLayout.selectedIndex || 0),
          ),
        );
      },
      onActive() {},
      onExit() {
        gameState.petsLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'evolutionLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.evolutionLayout.hitZones = null;
        gameState.evolutionLayout.selectedLevel = Math.max(
          0,
          Math.min(
            Math.max(0, (gameState.evolutionLayout.ladder || []).length - 1),
            Number(gameState.evolutionLayout.selectedLevel || 0),
          ),
        );
      },
      onActive() {},
      onExit() {
        gameState.evolutionLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'homesteadLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.homesteadLayout.hitZones = null;
        gameState.homesteadLayout.selectedSlot = Math.max(
          0,
          Math.min(
            Math.max(0, ((gameState.homesteadLayout.scene && gameState.homesteadLayout.scene.slots) || []).length - 1),
            Number(gameState.homesteadLayout.selectedSlot || 0),
          ),
        );
      },
      onActive() {},
      onExit() {
        gameState.homesteadLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'chestsLayout',
      allowedTransitions: ['combat', 'tomesLayout', 'artifactsLayout', 'mountsLayout', 'collectiblesLayout', 'relicsLayout', 'petsLayout', 'evolutionLayout', 'homesteadLayout'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        gameState.chestsLayout.hitZones = null;
        const tabs = Array.isArray(gameState.chestsLayout.tabs) ? gameState.chestsLayout.tabs : [];
        const allowed = new Set(tabs.map((t) => String(t.id || '')));
        if (!allowed.has(String(gameState.chestsLayout.activeTab || ''))) {
          gameState.chestsLayout.activeTab = tabs.length ? String(tabs[0].id || 'Common') : 'Common';
        }
      },
      onActive() {},
      onExit() {
        gameState.chestsLayout.hitZones = null;
        return null;
      },
    });
    layoutState.registerLayout({
      id: 'heroLayout',
      allowedTransitions: ['combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        uiState.setUIStateField('heroScreenHitZones', null);
        normalizeHeroSelectionIndex();
      },
      onActive() {},
      onExit() {
        uiState.setUIStateField('heroScreenHitZones', null);
        return null;
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
    layoutState.registerLayout({
      id: 'storyMock',
      allowedTransitions: ['town'],
      onEnter() {
        gameState.combatFailExitRequested = false;
      },
      onActive() {},
      onExit() { return null; },
    });
    layoutState.registerLayout({
      id: 'town',
      allowedTransitions: ['combat'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        restorePartyToFullHP();
      },
      onActive() {},
      onExit() { return null; },
    });
    layoutState.registerLayout({
      id: 'idleFarmLayout',
      allowedTransitions: ['combat', 'storyMock'],
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        startIdleFarmEmissions(performance.now() / 1000);
        restartIdleFarmSession(performance.now() / 1000);
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

  function resizeCanvas() {
    const metrics = resizeCanvasToContainedViewport({ canvas, layoutW, layoutH });
    dpr = metrics.dpr;
    layoutScale = metrics.layoutScale;
    layoutOffsetX = metrics.layoutOffsetX;
    layoutOffsetY = metrics.layoutOffsetY;
    if (typeof window !== 'undefined') {
      window.__orkaAppViewport = metrics;
    }
  }
  resizeCanvas();
  const handleWindowResize = () => {
    resizeCanvas();
    initializeStoryCardLayout('window-resize');
    if (typeof drawFrame === 'function') drawFrame();
  };
  runtimeListenerTeardowns.push(addAppViewportResizeListener(handleWindowResize));

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
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (activeLayoutId !== 'combat') return false;

    const viewLeft = layoutOffsetX;
    const viewTop = layoutOffsetY;
    const viewWidth = layoutW * layoutScale;
    const contentBandWidth = viewWidth * 0.95;
    const slotX = viewLeft + (viewWidth - contentBandWidth) * 0.5;

    const hpBarInstance = (instances || []).find(ins => ins && ins.type === 'PartyHP_Bar' && ins.world);
    const hpBarBottom = hpBarInstance
      ? (() => {
          const p = worldToCanvas(hpBarInstance.world.x || 0, hpBarInstance.world.y || 0);
          const h = Number(hpBarInstance.world.height || 0) * layoutScale;
          const oy = Number(hpBarInstance.world.originY != null ? hpBarInstance.world.originY : 0);
          return p.y - (h * oy) + h;
        })()
      : 0;
    const hpBarHeight = hpBarInstance ? Number(hpBarInstance.world.height || 0) * layoutScale : 0;
    const ampBarBottom = hpBarBottom
      ? hpBarBottom + hpBarHeight + Math.max(4, Math.round(hpBarHeight * 0.55))
      : 0;
    const buffTypes = new Set(['buffIcon1', 'buffIcon2', 'buffIcon3', 'buffIcon4']);
    const buffInstances = (instances || []).filter(ins => ins && buffTypes.has(ins.type) && ins.world);
    const layoutAnchorBottom = buffInstances.length
      ? Math.max(...buffInstances.map(ins => {
          const p = worldToCanvas(ins.world.x || 0, ins.world.y || 0);
          const h = Number(ins.world.height || 0) * layoutScale;
          const oy = Number(ins.world.originY != null ? ins.world.originY : 0.5);
          return p.y - (h * oy) + h;
        }))
      : (ampBarBottom || hpBarBottom || (viewTop + Math.max(240, Math.round(250 * layoutScale))));

    const grid = gameState.gridBounds || {
      minX: boardGeometry.gx,
      minY: boardGeometry.gy,
      maxX: boardGeometry.gx + (boardGeometry.cols * boardGeometry.cellSize + (boardGeometry.cols - 1) * boardGeometry.gap),
      maxY: boardGeometry.gy + (boardGeometry.rows * boardGeometry.cellSize + (boardGeometry.rows - 1) * boardGeometry.gap),
    };
    const gridTop = layoutOffsetY + Number(grid.minY || 0) * layoutScale;
    const topMargin = Math.max(8, Math.round(10 * layoutScale));
    const bottomMargin = Math.max(8, Math.round(10 * layoutScale));
    const slotY = layoutAnchorBottom + topMargin;
    const rawH = gridTop - bottomMargin - slotY;
    const slotH = Math.max(Math.round(34 * layoutScale), Math.min(Math.round(58 * layoutScale), rawH));
    const adjustedY = rawH >= Math.round(24 * layoutScale)
      ? slotY
      : (gridTop - bottomMargin - Math.max(Math.round(34 * layoutScale), Math.round(38 * layoutScale)));

    const bounds = {
      x: slotX,
      y: adjustedY,
      w: contentBandWidth,
      h: Math.max(Math.round(34 * layoutScale), slotH),
    };
    gameState.storyCardLayout = {
      ...bounds,
      initialized: true,
      trigger: String(trigger || 'layout-active'),
    };
    traceTask015StoryPlacement(trigger, bounds);
    return true;
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

  function drawHarnessLayoutTakeover(layoutId) {
    const viewWidth = canvas.width / dpr;
    const viewHeight = canvas.height / dpr;
    const applyLayoutResult = (layoutRef, result) => {
      if (layoutRef && result && result.hitZones) layoutRef.hitZones = result.hitZones;
      uiState.setUIFields((result && result.uiPatches) || {});
      if (result && result.drawHudAfter) drawHUD();
    };

    switch (layoutId) {
      case 'mapLayout': {
        mapLayoutState.setMapPanY(0);
        const mapRenderResult = renderMap.renderMap(
          ctx,
          gameState,
          uiState.getUIState(),
          mapLayoutState.getMapLayoutState(),
          {
            viewWidth,
            viewHeight,
            mapBackgroundImage,
            heroLayoutSpec,
            closeWinOvalImage,
          },
        );
        mapLayoutState.setMapLayoutBounds(mapRenderResult.panBounds);
        mapLayoutState.setMapPanX(mapRenderResult.clampedPanX);
        mapLayoutState.setMapLayoutField('lastRender', mapRenderResult.lastRender);
        mapLayoutState.setMapLayoutField('closeHit', mapRenderResult.closeHit);
        mapLayoutState.setMapLayoutField('tomesLocaleHit', mapRenderResult.localeHits.tomesLocaleHit);
        mapLayoutState.setMapLayoutField('artifactsLocaleHit', mapRenderResult.localeHits.artifactsLocaleHit);
        mapLayoutState.setMapLayoutField('mountsLocaleHit', mapRenderResult.localeHits.mountsLocaleHit);
        mapLayoutState.setMapLayoutField('relicsLocaleHit', mapRenderResult.localeHits.relicsLocaleHit);
        mapLayoutState.setMapLayoutField('collectiblesLocaleHit', mapRenderResult.localeHits.collectiblesLocaleHit);
        mapLayoutState.setMapLayoutField('homesteadLocaleHit', mapRenderResult.localeHits.homesteadLocaleHit);
        return;
      }
      case 'tomesLayout':
        applyLayoutResult(gameState.tomesLayout, renderTomes.renderTomes(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'artifactsLayout':
        applyLayoutResult(gameState.artifactsLayout, renderArtifacts.renderArtifacts(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'mountsLayout':
        applyLayoutResult(gameState.mountsLayout, renderMounts.renderMounts(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'collectiblesLayout':
        applyLayoutResult(gameState.collectiblesLayout, renderCollectibles.renderCollectibles(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'relicsLayout':
        applyLayoutResult(gameState.relicsLayout, renderRelics.renderRelics(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'petsLayout':
        applyLayoutResult(gameState.petsLayout, renderPets.renderPets(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'idleFarmLayout': {
        const nowSec = performance.now() / 1000;
        applyLayoutResult(
          gameState.idleFarmLayout,
          renderIdleFarm.renderIdleFarm(
            ctx,
            gameState,
            {
              nowSec,
              animationMath,
              updateIdleFarmEmissions,
              startIdleFarmEmissions,
              updateIdleFarmSession,
              ensureIdleFarmSession,
              heroCapsuleImages,
              enemySpriteImages,
            },
            { viewWidth, viewHeight },
          ),
        );
        return;
      }
      case 'evolutionLayout':
        applyLayoutResult(gameState.evolutionLayout, renderEvolution.renderEvolution(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'homesteadLayout':
        applyLayoutResult(gameState.homesteadLayout, renderHomestead.renderHomestead(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'chestsLayout':
        applyLayoutResult(gameState.chestsLayout, renderChests.renderChests(ctx, gameState, { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage }));
        return;
      case 'heroLayout': {
        renderHeroScreenLayoutV2({
          ctx,
          canvas,
          dpr,
          gameState,
          fnContext,
          closeWinOvalImage,
          heroPortraitImages,
          heroSkillSpriteSheetImage: null,
          heroSkillIconImages: [
            heroSkillIconsBySlot[0] || null,
            heroSkillIconsBySlot[1] || null,
            heroSkillIconsBySlot[2] || null,
          ],
        });
        return;
      }
      default:
        renderHarnessFallback.renderHarnessFallback(ctx, layoutId, gameState, {
          viewWidth,
          viewHeight,
          startupFingerprintLabel: RUNTIME_FINGERPRINT.label,
          freshCombatBootstrapped,
        });
        return;
    }
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
    callFunctionWithContext(fnContext, 'SyncDrainFieldZones');
    superGemRuntime.syncTaintedGroundZones({
      state,
      callFunctionWithContext,
      fnContext,
    });
    const runtimeScope = {
      dtOverride,
      state,
      gameState,
      uiState,
      mapLayoutState,
      animationMath,
      renderMap,
      renderTomes,
      renderArtifacts,
      renderMounts,
      renderCollectibles,
      renderRelics,
      renderPets,
      renderIdleFarm,
      renderEvolution,
      renderHomestead,
      renderChests,
      renderHeroScreenLayoutV2,
      renderHarnessFallback,
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
      getPersistentDrainFieldOverlays,
      hasPersistentEnemyTaintedGroundOverlay,
      hasPersistentEnemyBlightOverlay,
      hasPersistentEnemyDrainOverlay,
      hasPersistentHeroRegenOverlay,
      isHitFlashActive,
      getHitFlashTone,
      deriveDamageFloatFrameOffset,
      createPartyRegenTickSimulationPacket,
    };
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
    renderSkillDraughtOverlay(ctx, canvas, dpr);
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
    const livingEnemies = state.entities.filter((entity) => entity && entity.kind === 'enemy' && (entity.hp ?? 0) > 0);
    if (!livingEnemies.length) return false;
    logActionHandoffDebug('[DEV_AUTOPLAY_RESOLVE]', {
      stage: 'before',
      actorUID,
      livingEnemies: livingEnemies.length,
    });
    if (String(state.globals.PendingSkillID || '') === 'HERO_SINGLE') {
      state.globals.SelectedEnemyUID = Number(livingEnemies[0].uid || 0);
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
  devToolingAutoplayHandler = runDevAutoplayUntilDepleted;


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

  // pointer handler for nav menu and overlay (more responsive than click)
  const handlePointerDown = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const logicalW = canvas.width / Math.max(1, dpr || 1);
    const logicalH = canvas.height / Math.max(1, dpr || 1);
    const scaleX = rect.width > 0 ? logicalW / rect.width : 1;
    const scaleY = rect.height > 0 ? logicalH / rect.height : 1;
    const mx = (ev.clientX - rect.left) * scaleX;
    const my = (ev.clientY - rect.top) * scaleY;

    if (Number(state.globals.SkillDraughtOpen || 0)) {
      const zones = Array.isArray(state.globals.SkillDraughtHitZones) ? state.globals.SkillDraughtHitZones : [];
      const hit = zones.find((zone) => isPointInRect(mx, my, zone));
      if (hit) {
        callFunctionWithContext(fnContext, 'SelectSkillDraughtCard', Number(hit.index || 0));
        drawFrame();
      }
      return;
    }

    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (activeLayoutId === 'storyMock') {
      inputDomains.emit('storyMock', 'layout:storyMock:click', { x: mx, y: my });
      drawFrame();
      return;
    }
    if (activeLayoutId === 'town') {
      inputDomains.emit('town', 'layout:town:click', { x: mx, y: my });
      drawFrame();
      return;
    }
    if (activeLayoutId === 'idleFarmLayout') {
      const zones = (gameState.idleFarmLayout && gameState.idleFarmLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.restartBtn)) {
        restartIdleFarmSession(performance.now() / 1000);
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.collectBtn)) {
        claimIdleFarmRewards();
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'idle-farm-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] idleFarm->combat failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.baseBack)) {
        layoutState.requestLayoutChange('storyMock', 'idle-farm-back-base').catch((err) => {
          console.error('[LAYOUT_PHASE1] idleFarm->storyMock failed', err);
        });
        drawFrame();
        return;
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'mapLayout') {
      const close = mapLayoutState.getMapLayoutState().closeHit;
      if (isPointInRect(mx, my, close)) {
        const req = deriveEncounterRequestFromMapState();
        state.globals.EncounterTargetCP = Number(req.targetCP || 120);
        state.globals.EncounterLocale = String(req.locale || 'clouds');
        state.globals.EncounterMaxSlots = Number(req.maxSlots || 3);
        state.globals.EncounterPolicy = String(req.policy || 'mixed');
        state.globals.EncounterFaction = String(req.faction || '');
        state.globals.EncounterSeed = Number(req.seed || 1);
        state.globals.EncounterSeedExplicit = 1;
        // Map close is benign: return to existing combat snapshot without resetting combat state.
        layoutState.requestLayoutChange('combat', 'map-close-button').catch((err) => {
          console.error('[LAYOUT_PHASE1] map return failed', err);
        });
        drawFrame();
        return;
      }
      if (handleMapDragStart(ev, { mx, my })) return;
    }
    if (activeLayoutId === 'tomesLayout') {
      const zones = (gameState.tomesLayout && gameState.tomesLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'tomes-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] tomes->vault failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'tomes-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] tomes->combat failed', err);
        });
        drawFrame();
        return;
      }
      const cards = Array.isArray(zones.cards) ? zones.cards : [];
      for (let i = 0; i < cards.length; i += 1) {
        if (isPointInRect(mx, my, cards[i])) {
          gameState.tomesLayout.selectedIndex = i;
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'artifactsLayout') {
      const zones = (gameState.artifactsLayout && gameState.artifactsLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'artifacts-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] artifacts->vault failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'artifacts-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] artifacts->combat failed', err);
        });
        drawFrame();
        return;
      }
      const cards = Array.isArray(zones.cards) ? zones.cards : [];
      for (let i = 0; i < cards.length; i += 1) {
        if (isPointInRect(mx, my, cards[i])) {
          gameState.artifactsLayout.selectedIndex = i;
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'mountsLayout') {
      const zones = (gameState.mountsLayout && gameState.mountsLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'mounts-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] mounts->vault failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'mounts-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] mounts->combat failed', err);
        });
        drawFrame();
        return;
      }
      const cards = Array.isArray(zones.cards) ? zones.cards : [];
      for (let i = 0; i < cards.length; i += 1) {
        if (isPointInRect(mx, my, cards[i])) {
          gameState.mountsLayout.selectedIndex = i;
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'collectiblesLayout') {
      const zones = (gameState.collectiblesLayout && gameState.collectiblesLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'collectibles-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] collectibles->vault failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'collectibles-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] collectibles->combat failed', err);
        });
        drawFrame();
        return;
      }
      const cards = Array.isArray(zones.cards) ? zones.cards : [];
      for (let i = 0; i < cards.length; i += 1) {
        if (isPointInRect(mx, my, cards[i])) {
          gameState.collectiblesLayout.selectedIndex = i;
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'relicsLayout') {
      const zones = (gameState.relicsLayout && gameState.relicsLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'relics-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] relics->vault failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'relics-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] relics->combat failed', err);
        });
        drawFrame();
        return;
      }
      const cards = Array.isArray(zones.cards) ? zones.cards : [];
      for (let i = 0; i < cards.length; i += 1) {
        if (isPointInRect(mx, my, cards[i])) {
          gameState.relicsLayout.selectedIndex = i;
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'petsLayout') {
      const zones = (gameState.petsLayout && gameState.petsLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'pets-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] pets->vault failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'pets-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] pets->combat failed', err);
        });
        drawFrame();
        return;
      }
      const cards = Array.isArray(zones.cards) ? zones.cards : [];
      for (let i = 0; i < cards.length; i += 1) {
        if (isPointInRect(mx, my, cards[i])) {
          gameState.petsLayout.selectedIndex = i;
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'evolutionLayout') {
      const zones = (gameState.evolutionLayout && gameState.evolutionLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'evolution-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] evolution->vault failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'evolution-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] evolution->combat failed', err);
        });
        drawFrame();
        return;
      }
      const cards = Array.isArray(zones.cards) ? zones.cards : [];
      for (let i = 0; i < cards.length; i += 1) {
        if (isPointInRect(mx, my, cards[i])) {
          gameState.evolutionLayout.selectedLevel = i;
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'homesteadLayout') {
      const zones = (gameState.homesteadLayout && gameState.homesteadLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'homestead-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] homestead->vault failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'homestead-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] homestead->combat failed', err);
        });
        drawFrame();
        return;
      }
      const slots = Array.isArray(zones.slots) ? zones.slots : [];
      for (let i = 0; i < slots.length; i += 1) {
        if (isPointInRect(mx, my, slots[i])) {
          gameState.homesteadLayout.selectedSlot = i;
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'chestsLayout') {
      const zones = (gameState.chestsLayout && gameState.chestsLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close)) {
        layoutState.requestLayoutChange('combat', 'chests-close-button').catch((err) => {
          console.error('[LAYOUT_PHASE1] chests close->combat failed', err);
        });
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        layoutState.requestLayoutChange('combat', 'chests-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] chests->combat failed', err);
        });
        drawFrame();
        return;
      }
      const retentionButtons = Array.isArray(zones.retentionButtons) ? zones.retentionButtons : [];
      for (let i = 0; i < retentionButtons.length; i += 1) {
        const btn = retentionButtons[i];
        if (isPointInRect(mx, my, btn) && btn.targetLayout) {
          layoutState.requestLayoutChange(String(btn.targetLayout), `chests-${String(btn.id || 'retention')}`).catch((err) => {
            console.error('[LAYOUT_PHASE1] chests->retention failed', err);
          });
          drawFrame();
          return;
        }
      }
      const tabs = Array.isArray(zones.tabs) ? zones.tabs : [];
      for (let i = 0; i < tabs.length; i += 1) {
        const tab = tabs[i];
        if (isPointInRect(mx, my, tab)) {
          gameState.chestsLayout.activeTab = String(tab.id || gameState.chestsLayout.activeTab || 'Common');
          drawFrame();
          return;
        }
      }
      drawFrame();
      return;
    }
    if (activeLayoutId === 'heroLayout') {
      const zones = uiState.getUIState().heroScreenHitZones || {};
      const roster = getHeroScreenRoster();
      const selectedHero = roster[normalizeHeroSelectionIndex()] || null;
      const skillNodes = Array.isArray(zones.skillNodes) ? zones.skillNodes : [];
      const selectedSkillIndex = Math.max(0, Math.floor(Number(zones.selectedSkillIndex || uiState.getUIState().heroScreenSelectedSkillIndex || 0)));
      const modalZones = zones.modal || null;
      let consumedSkillClick = false;
      if (uiState.getUIState().heroScreenSkillModalOpen && modalZones) {
        if (isPointInRect(mx, my, modalZones.close) || !isPointInRect(mx, my, modalZones.card)) {
          uiState.setUIStateField('heroScreenSkillModalOpen', false);
          drawFrame();
          return;
        }
        if (isPointInRect(mx, my, modalZones.upgradeButton)) {
          const activeNode = skillNodes.find((node) => Number(node?.idx || -1) === Number(uiState.getUIState().heroScreenSkillModalSkillIndex || 0)) || skillNodes[0] || null;
          if (activeNode && activeNode.actionable !== false && selectedHero) {
            callFunctionWithContext(fnContext, 'AttemptHeroSkillUpgrade', selectedHero.uid, activeNode.skillKey, 'hero_skill_modal_upgrade_button');
          }
          drawFrame();
          return;
        }
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.close)) {
        uiState.setUIStateField('heroScreenSkillModalOpen', false);
        const closeHeroLayout = () => layoutState.requestLayoutChange('combat', 'hero-close-button').catch((err) => {
          console.error('[LAYOUT_PHASE1] hero return failed', err);
        });
        closeHeroLayout().then((changed) => {
          if (!changed) {
            setTimeout(() => {
              closeHeroLayout();
            }, 24);
          }
        });
      } else if (isPointInRect(mx, my, zones.prevHero)) {
        if (roster.length) {
          gameState.selectedHero = (normalizeHeroSelectionIndex() + roster.length - 1) % roster.length;
          uiState.setUIStateField('heroScreenSelectedSkillIndex', 0);
          uiState.setUIStateField('heroScreenSkillModalOpen', false);
        }
      } else if (isPointInRect(mx, my, zones.nextHero)) {
        if (roster.length) {
          gameState.selectedHero = (normalizeHeroSelectionIndex() + 1) % roster.length;
          uiState.setUIStateField('heroScreenSelectedSkillIndex', 0);
          uiState.setUIStateField('heroScreenSkillModalOpen', false);
        }
      } else {
        for (const node of skillNodes) {
          if (!node) continue;
          if (isPointInRect(mx, my, node.rect)) {
            uiState.setUIStateField('heroScreenSelectedSkillIndex', Math.max(0, Math.floor(Number(node.idx || 0))));
            uiState.setUIStateField('heroScreenSkillModalSkillIndex', Math.max(0, Math.floor(Number(node.idx || 0))));
            uiState.setUIStateField('heroScreenSkillModalOpen', true);
            consumedSkillClick = true;
            break;
          }
        }
        if (!consumedSkillClick && selectedHero && isPointInRect(mx, my, zones.upgradeButton)) {
          const activeNode = skillNodes.find((node) => Number(node?.idx || -1) === selectedSkillIndex) || skillNodes[0] || null;
          if (activeNode && activeNode.actionable !== false) {
            callFunctionWithContext(fnContext, 'AttemptHeroSkillUpgrade', selectedHero.uid, activeNode.skillKey, 'hero_screen_upgrade_button');
            consumedSkillClick = true;
          }
        }
      }
      drawFrame();
      return;
    }

    if (layoutHarnessEnabled && harnessLayoutState && harnessInputDomains) {
      const activeLayout = harnessLayoutState.getActiveLayoutId();
      if (activeLayout === 'storyMock') {
        harnessInputDomains.emit(activeLayout, 'layout:storyMock:click', { x: mx, y: my });
        drawFrame();
        return;
      }
      if (activeLayout === 'town') {
        harnessInputDomains.emit(activeLayout, 'layout:town:click', { x: mx, y: my });
        drawFrame();
        return;
      }
      if (activeLayout === 'astralOverlay') {
        harnessInputDomains.emit(activeLayout, 'layout:astralOverlay:click', { x: mx, y: my });
        drawFrame();
        return;
      }
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

  // Dev-only test hooks for deterministic agent-browser CLI control
  if (typeof window !== 'undefined') {
    window.render_game_to_text = () => {
      const currentUID = callFunctionWithContext(fnContext, 'GetCurrentTurn');
      const currentActor = callFunctionWithContext(fnContext, 'GetActorByUID', currentUID);
      const turnOrderRaw = Array.isArray(state.globals.TurnOrderArray)
        ? state.globals.TurnOrderArray
        : [];
      const turnOrder = turnOrderRaw.map(entry => {
        const actor = callFunctionWithContext(fnContext, 'GetActorByUID', entry.uid);
        return {
          uid: entry.uid,
          type: entry.type,
          name: actor ? actor.name : null,
          spd: entry.spd ?? null,
        };
      });
      const payload = {
        coordSystem: 'origin:top-left, x:right, y:down',
        time: state.globals.time || 0,
        turn: {
          uid: currentUID,
          type: callFunctionWithContext(fnContext, 'GetCurrentType'),
          name: currentActor ? currentActor.name : null,
        },
        round: {
          active: !!state.globals.RoundActive,
          groupIndex: state.globals.RoundGroupIndex ?? 0,
          memberIndex: state.globals.RoundMemberIndex ?? 0,
        },
        turnOrder,
        party: {
          hp: state.globals.PartyHP || 0,
          maxHp: state.globals.PartyMaxHP || 0,
        },
        resources: {
          energy: state.globals.Player_Energy || 0,
          maxEnergy: state.globals.Player_maxEnergy || 0,
          gold: state.globals.goldTotal || 0,
          tokenWallet: state.globals.TokenWallet || {},
          astralFlowWallet: state.globals.AstralFlowWallet || 0,
          heroGemUsage: state.globals.HeroGemUsage || null,
          heroGemMilestones: state.globals.HeroGemMilestones || null,
          heroGemProgressPersistedAt: state.globals.HeroGemProgressPersistedAt || 0,
          idleFarmLastCollect: state.globals.IdleFarmLastCollect || null,
          powerAmpTelemetry: Array.isArray(state.globals.PowerAmpTelemetryTrace)
            ? state.globals.PowerAmpTelemetryTrace.slice(-40)
            : [],
        },
        devTools: {
          config: ensureDevToolingConfig(),
          autoplay: getDevAutoplayState(),
          heroSlotOptions: getDevToolHeroOptions(),
          enemySlotOptions: getDevToolEnemyOptions(),
          enemyTypeOptions: getDevToolEnemyOptions(),
        },
        idleFarm: {
          active: layoutState && typeof layoutState.getActiveLayoutId === 'function'
            ? layoutState.getActiveLayoutId() === 'idleFarmLayout'
            : false,
          state: gameState.idleFarmLayout || null,
        },
        mapLayout: {
          panX: Number(mapLayoutState.getMapLayoutState().panX || 0),
          panY: Number(mapLayoutState.getMapLayoutState().panY || 0),
          warMeter: Number(mapLayoutState.getMapLayoutState().warMeter || 0),
          encounterNode: mapLayoutState.getMapLayoutState().encounterNode || null,
          render: mapLayoutState.getMapLayoutState().lastRender || null,
          encounterRequestPreview: deriveEncounterRequestFromMapState(),
        },
        heroScreen: {
          mode: String(uiState.getUIState().heroScreenMode || 'details'),
          selectedHero: Number(gameState.selectedHero || 0),
          selectedSkillIndex: Number(uiState.getUIState().heroScreenSelectedSkillIndex || 0),
          activeHeroName: (() => {
            const roster = getHeroScreenRoster();
            const idx = normalizeHeroSelectionIndex();
            const hero = roster[idx];
            return hero ? String(hero.name || '') : '';
          })(),
          activePartySlots: normalizePartyFormationSlots(getConfiguredHeroSlots()),
        },
        flags: {
          canPickGems: state.globals.CanPickGems,
          isPlayerBusy: state.globals.IsPlayerBusy,
          turnPhase: state.globals.TurnPhase ?? 0,
          deferAdvance: state.globals.DeferAdvance ?? 0,
          actionLockUntil: state.globals.ActionLockUntil ?? 0,
          pendingSkillId: state.globals.PendingSkillID || null,
          overlayVisible: uiState.getUIState().overlayVisible,
          layoutId: layoutState && typeof layoutState.getActiveLayoutId === 'function'
            ? layoutState.getActiveLayoutId()
            : (layoutHarnessEnabled && harnessLayoutState ? harnessLayoutState.getActiveLayoutId() : 'combat'),
          combatAcceptEvents: layoutHarnessEnabled && harnessCombatGateway
            ? harnessCombatGateway.canAcceptEvents()
            : true,
          layout0Ready: !gameState.startupLoad?.active && gameState.startupLoad?.phase !== 'error',
          layout0Failed: gameState.startupLoad?.phase === 'error',
        },
        heroes: state.entities
          .filter(e => e.kind === 'hero')
          .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, combatPower: Number(e.combatPower || 0) })),
        enemies: state.entities
          .filter(e => e.kind === 'enemy')
          .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, slot: e.slotIndex, combatPower: Number(e.combatPower || 0) })),
        damageTexts: (state.globals.DamageTexts || []).map(d => {
          const riseSec = Math.max(0.001, Number(d.riseInSec || 0.18));
          const phase = Number(d.phase || 0);
          const phaseAge = Number(d.age || 0);
          let progress = 1;
          if (phase === 0) {
            const riseT = Math.max(0, Math.min(1, phaseAge / riseSec));
            progress = riseT * (2 - riseT);
          }
          const offset = deriveDamageFloatFrameOffset(d, progress);
          const baseX = Number(d.baseX != null ? d.baseX : (d.x || 0));
          const baseY = Number(d.baseY != null ? d.baseY : (d.y || 0));
          return {
            amount: d.amount,
            kind: d.kind,
            targetKind: d.targetKind || null,
            baseX,
            baseY,
            x: Number(d.x || 0),
            y: Number(d.y || 0),
            displayX: baseX + offset.x,
            displayY: baseY + offset.y,
            floatAngleDeg: Number(d.floatAngleDeg || 0),
            floatVectorX: Number(d.floatVectorX || 0),
            floatVectorY: Number(d.floatVectorY || 0),
            phase,
            age: phaseAge,
            domSpawned: !!d.domSpawned,
          };
        }),
        gems: (gameState.gems || []).map(g => ({
          uid: g.uid,
          r: g.cellR,
          c: g.cellC,
          color: g.color ?? g.elementIndex,
          x: g.x,
          y: g.y,
          selected: !!(g.selected || g.Selected),
          locked: isBoardGemLocked(g),
          lockCountdown: Number(g.lockCountdown ?? g.LockCountdown ?? 0),
          lockGroupId: String(g.lockGroupId || g.LockGroupId || ''),
        })),
      };
      return JSON.stringify(payload);
    };
    window.advanceTime = (ms) => {
      const step = 1 / 60;
      const steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (let i = 0; i < steps; i++) drawFrame(step);
    };
    window.__codexGame = {
      get state() { return state; },
      get globals() { return state.globals; },
      get gems() { return gameState.gems; },
      get turn() {
        const uid = callFunctionWithContext(fnContext, 'GetCurrentTurn');
        return {
          uid,
          type: callFunctionWithContext(fnContext, 'GetCurrentType'),
          actor: callFunctionWithContext(fnContext, 'GetActorByUID', uid),
        };
      },
      stepFrames(n = 1) {
        for (let i = 0; i < n; i++) drawFrame();
      },
      selectGemByRC(row, col) {
        const idx = gameState.gems.findIndex(g => g.cellR === row && g.cellC === col);
        if (idx === -1) return false;
        const gem = gameState.gems[idx];
        if (isBoardGemLocked(gem)) return false;
        if (gameState.selectedGems.includes(idx)) return true;
        gameState.selectedGems.push(idx);
        gem.selected = true;
        gem.Selected = 1;
        return true;
      },
      clearSelection() {
        gameState.selectedGems = [];
        gameState.selectionLocked = false;
        for (const gm of gameState.gems) {
          gm.selected = false;
          gm.Selected = 0;
        }
        state.globals.TapIndex = 0;
      },
      forceMatch(color) {
        handleGemMatch(color);
      },
      setEncounterRequest(input = {}) {
        const req = input && typeof input === 'object' ? input : {};
        if (req.targetCP != null) state.globals.EncounterTargetCP = Number(req.targetCP || 0);
        if (req.locale != null) state.globals.EncounterLocale = String(req.locale || 'all').trim().toLowerCase() || 'all';
        if (req.maxSlots != null) state.globals.EncounterMaxSlots = Math.max(1, Number(req.maxSlots || 0));
        if (req.policy != null) state.globals.EncounterPolicy = String(req.policy || 'mixed').trim().toLowerCase() || 'mixed';
        if (req.faction != null) state.globals.EncounterFaction = String(req.faction || '').trim().toLowerCase();
        if (req.seed != null) {
          state.globals.EncounterSeed = Number(req.seed || 0);
          state.globals.EncounterSeedExplicit = 1;
        } else {
          state.globals.EncounterSeedExplicit = 0;
        }
        return {
          targetCP: Number(state.globals.EncounterTargetCP || 0),
          locale: String(state.globals.EncounterLocale || 'all'),
          maxSlots: Number(state.globals.EncounterMaxSlots || 3),
          policy: String(state.globals.EncounterPolicy || 'mixed'),
          faction: String(state.globals.EncounterFaction || ''),
          seed: Number(state.globals.EncounterSeed || 0),
        };
      },
      setMapEncounterNode(input = {}) {
        const node = input && typeof input === 'object' ? input : {};
        const prev = mapLayoutState.getMapLayoutState().encounterNode || {};
        const next = {
          id: String(node.id || prev.id || 'clouds-alpha'),
          locale: String(node.locale || prev.locale || 'clouds').trim().toLowerCase() || 'clouds',
          faction: String(node.faction || prev.faction || 'wishless').trim().toLowerCase() || 'wishless',
        };
        mapLayoutState.setMapLayoutField('encounterNode', next);
        if (node.warMeter != null) {
          mapLayoutState.setMapLayoutField('warMeter', Math.max(0, Math.min(1, Number(node.warMeter || 0))));
        }
        return {
          encounterNode: mapLayoutState.getMapLayoutState().encounterNode,
          warMeter: Number(mapLayoutState.getMapLayoutState().warMeter || 0),
        };
      },
      toggleDevToolingModal(nextOpen = null) {
        return toggleDevToolingModal(nextOpen);
      },
      getDevToolingState() {
        return {
          config: ensureDevToolingConfig(),
          autoplay: getDevAutoplayState(),
          heroSlotOptions: getDevToolHeroOptions(),
          enemySlotOptions: getDevToolEnemyOptions(),
          enemyTypeOptions: getDevToolEnemyOptions(),
        };
      },
      applyDevToolingConfig(input = {}) {
        return applyDevToolingConfig(input);
      },
      runDevAutoplayUntilDepleted() {
        return runDevAutoplayUntilDepleted();
      },
      stopDevAutoplay() {
        state.globals.DevAutoplayStopRequested = 1;
        return getDevAutoplayState();
      },
      callFunction(fnName, ...args) {
        return callFunctionWithContext(fnContext, fnName, ...args);
      },
      getStoryCardDebugLine() {
        const rawLatest = getLatestCombatActionLine();
        const filteredLatest = getLatestStoryCardActionLine();
        const live = getStoryCardLiveLineState();
        const split = splitStoryCardActorSegment(live.text);
        const intentFallback = getStoryCardIntentFallbackLine();
        const g = state.globals || {};
        return {
          rawLatest,
          filteredLatest,
          intentFallback,
          rendered: live.text,
          split,
          battleStart: {
            active: !!g.BattleStartActive,
            clearedForSession: !!g.BattleStartClearedForSession,
            sessionId: Number(g.BattleStartSessionId || 0),
            sessionText: String(g.BattleStartSessionText || ''),
          },
          colors: {
            actor: '#E35822',
            rest: '#314877',
          },
          filteredToken: isStoryCardTokenLine(rawLatest),
        };
      },
      getTask011Audit() {
        return JSON.parse(JSON.stringify(ensureTask011Audit()));
      },
      resetTask011Audit() {
        gameState.task011Audit = null;
        return true;
      },
      getTask015Trace() {
        return JSON.parse(JSON.stringify(getTask015TraceStore()));
      },
      resetTask015Trace() {
        gameState.task015Trace = {
          storycardPlacement: [],
          yellowQueue: [],
          yellowRefillQueue: [],
          yellowWrites: [],
          yellowAnimation: [],
        };
        return true;
      },
    };
    window.__auditBoard = () => assertBoardIntegrity('manual');
  }
}

(async function boot() {
  try {
    await main();
  } catch (err) {
    console.error('[ERROR] Initialization failed:', err);
    out.textContent = `🎮 Puzzle RPG\n\n⚠️ Initialization Error\n${err.message}`;
  }
})();
