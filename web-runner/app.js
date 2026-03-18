import { state } from './modules/state.js';
import { createContext, callFunctionWithContext } from './modules/functionRegistry.js';
import { CombatRuntimeGateway } from './src/core/combatRuntimeGateway.js';
import {
  createEnemyTurnGateBaseline,
  createDeferredAdvanceResolved,
  createDeferredRefillHold,
  createDeferredStaleBusyRecovery,
  createDeferredTextHold,
  createRefillCompleteGate,
  createRefillStartGate,
  createYellowSequenceCompletion,
  createYellowSequenceGate,
  createYellowSequenceSkip,
} from './src/core/turnGateController.mjs';
import {
  YELLOW_COLOR,
  YELLOW_REFILL_TARGETS,
  pickYellowReassignTarget,
  pickYellowRefillTarget,
} from './src/core/yellowRefillRules.mjs';
import {
  resolveCurrentHeroUID,
  shouldRenderHeroTurnSelector,
} from './src/core/heroSelectorRules.mjs';
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

const out = document.getElementById('output');
const gemCounterOut = document.getElementById('gem-counter-output');
const walletOut = document.getElementById('wallet-output');
const astralWalletOut = document.getElementById('astral-wallet-output');
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const HARNESS_MODE = typeof window !== 'undefined' && window.location.search.includes('harness=true');
const DEBUG_LAYOUT = (() => {
  let enabled = false;
  try {
    if (typeof process !== 'undefined' && process && process.env && process.env.DEBUG_LAYOUT === 'true') {
      enabled = true;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window && window.DEBUG_LAYOUT === true) {
      enabled = true;
    }
  } catch {}
  return enabled;
})();
const DEBUG_GEMS_QUERY = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.has('devtest') ||
      params.get('devtest') === 'true' ||
      params.has('debug_gems') ||
      params.get('debug_gems') === 'true'
    );
  } catch {
    return false;
  }
})();
const GEM_DEBUG_LEVEL = (function () {
  const p = new URLSearchParams(window.location.search);
  return p.get('gemlog') || 'minimal';
})();
const STARTUP_DEBUG = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('startup_debug') || params.get('startup_debug') === 'true';
  } catch {
    return false;
  }
})();
const HERO_GEM_PROGRESS_STORAGE_KEY = 'orka.hero_gem_progress.v1';
const DEV_TOOL_HOTKEY_LABEL = 'Ctrl+Shift+P';
const DEV_TOOL_GEM_RANDOM = -1;
const DEV_TOOL_GEM_OPTIONS = Object.freeze([
  { value: DEV_TOOL_GEM_RANDOM, label: 'Random' },
  { value: 0, label: 'GREEN' },
  { value: 1, label: 'RED' },
  { value: 2, label: 'BLUE' },
  { value: 3, label: 'YELLOW' },
  { value: 4, label: 'HEAL' },
  { value: 5, label: 'PURPLE' },
]);
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

function applyTurnGateGlobals(next) {
  if (!next) return;
  state.globals.CanPickGems = next.CanPickGems;
  state.globals.IsPlayerBusy = next.IsPlayerBusy;
  state.globals.DeferAdvance = next.DeferAdvance;
  state.globals.AdvanceAfterAction = next.AdvanceAfterAction;
  state.globals.ActionLockUntil = next.ActionLockUntil;
  state.globals.ActionOwnerUID = next.ActionOwnerUID;
}

function applyTurnGateIntent(createIntent, options = undefined) {
  if (typeof createIntent !== 'function') return;
  applyTurnGateGlobals(createIntent(state.globals, options));
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
const RUNTIME_FINGERPRINT = (() => {
  const source = (typeof window !== 'undefined' && window.__ORKA_RUNTIME_FINGERPRINT__)
    ? window.__ORKA_RUNTIME_FINGERPRINT__
    : {};
  const params = (typeof window !== 'undefined')
    ? new URLSearchParams(window.location.search)
    : null;
  const qaTaskOverride = params
    ? (params.get('qa_task') || params.get('task') || '').trim()
    : '';
  const worktree = source.worktree || 'unknown-worktree';
  const branch = source.branch || 'unknown-branch';
  const issueId = qaTaskOverride || source.issueId || 'ORKA-UNKNOWN';
  const orka69rReady = Boolean(source.contracts && source.contracts.ORKA69R_READY);
  return {
    worktree,
    branch,
    issueId,
    orka69rReady,
    label: `WT:${worktree} BR:${branch} TASK:${issueId} 69R:${orka69rReady ? 'READY' : 'MISSING'}`,
  };
})();
console.info(`[RUNTIME_FINGERPRINT] ${RUNTIME_FINGERPRINT.label}`);
if (!RUNTIME_FINGERPRINT.orka69rReady) {
  console.warn('[RUNTIME_CONTRACT] ORKA-69r not present in this build (69R:MISSING).');
}

function debugLayoutLog(message) {
  if (!DEBUG_LAYOUT) return;
  console.log(message);
}
function startupDebugLog(...args) {
  if (!STARTUP_DEBUG) return;
  console.log(...args);
}
function isGemDebugEnabled() {
  if (DEBUG_GEMS_QUERY) return true;
  if (state && state.globals && state.globals.DevTestMode === true) return true;
  if (state && state.globals && state.globals.DebugGemsMode === true) return true;
  try {
    const hook = typeof window !== 'undefined' ? window.__codexGame : null;
    if (hook && hook.globals && hook.globals.DevTestMode === true) return true;
    if (hook && hook.globals && hook.globals.DebugGemsMode === true) return true;
  } catch {}
  return false;
}
function gemDebugLog(tag, payload) {
  if (!isGemDebugEnabled()) return;

  const allowedTags = new Set([
    '[TURN_RESTORE_PICK]',
    '[GEM_REJECT]',
    '[REFILL_STUCK]',
    '[GATE_STUCK_CANPICK]'
  ]);
  if (!allowedTags.has(tag)) return;

  console.log(tag, payload);
}
const layoutHarnessEnabled = (() => {
  return HARNESS_MODE;
})();

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHarnessEventBus() {
  const listeners = new Map();
  const events = [];
  return {
    events,
    on(eventName, handler) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
      return () => listeners.get(eventName)?.delete(handler);
    },
    emit(eventName, payload = {}) {
      events.push({ name: eventName, payload });
      const subs = listeners.get(eventName);
      if (!subs || subs.size === 0) return;
      for (const fn of [...subs]) fn(payload);
    },
  };
}

class HarnessInputDomainManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.activeDomain = null;
    this.locked = false;
  }

  setActiveDomain(domain) {
    this.activeDomain = domain || null;
  }

  getActiveDomain() {
    return this.activeDomain;
  }

  lock() {
    this.locked = true;
    debugLayoutLog('[Input] Locked');
  }

  unlock() {
    this.locked = false;
    debugLayoutLog('[Input] Unlocked');
  }

  emit(domain, eventName, payload = {}) {
    const allowed = !this.locked && !!domain && domain === this.activeDomain;
    debugLayoutLog(`[Input] Emit → domain:${domain} event:${eventName} allowed:${allowed} active:${this.activeDomain}`);
    if (!allowed) return false;
    this.eventBus.emit(eventName, { ...payload, domain });
    return true;
  }
}

function createHarnessLayoutState({ eventBus, inputDomains, combatRuntimeGateway }) {
  const layouts = new Map();
  const snapshotsByLayout = new Map();
  let activeLayoutId = null;
  let isTransitioning = false;

  return {
    registerLayout(descriptor) {
      layouts.set(descriptor.id, descriptor);
    },
    getActiveLayoutId() {
      return activeLayoutId;
    },
    getSnapshot(layoutId) {
      return snapshotsByLayout.get(layoutId);
    },
    async activateInitialLayout(layoutId, payload = {}) {
      const targetLayout = layouts.get(layoutId);
      if (!targetLayout) throw new Error(`Missing layout: ${layoutId}`);
      activeLayoutId = layoutId;
      inputDomains.setActiveDomain(layoutId);
      debugLayoutLog(`[Layout] Initial activation → ${layoutId}`);
      const context = {
        eventBus,
        payload,
        reason: 'harness-initial',
        from: null,
        to: layoutId,
        resumeSnapshot: snapshotsByLayout.get(layoutId) || null,
      };
      if (typeof targetLayout.onEnter === 'function') await targetLayout.onEnter(context);
      if (typeof targetLayout.onActive === 'function') await targetLayout.onActive(context);
    },
    async requestLayoutChange(targetLayoutId, reason = 'harness-request', payload = {}) {
      debugLayoutLog(`[Layout] Request → from:${activeLayoutId} to:${targetLayoutId} reason:${reason}`);
      if (isTransitioning) return false;
      if (activeLayoutId === targetLayoutId) return false;
      const sourceLayout = activeLayoutId ? layouts.get(activeLayoutId) : null;
      const targetLayout = layouts.get(targetLayoutId);
      if (!targetLayout) return false;
      if (sourceLayout && Array.isArray(sourceLayout.allowedTransitions)) {
        if (!sourceLayout.allowedTransitions.includes(targetLayoutId)) {
          debugLayoutLog(`[Layout] Invalid transition → from:${activeLayoutId} to:${targetLayoutId}`);
          return false;
        }
      }

      isTransitioning = true;
      inputDomains.lock();
      eventBus.emit('layout:changeRequested', { from: activeLayoutId, to: targetLayoutId, reason });
      try {
        if (sourceLayout && typeof sourceLayout.onExit === 'function') {
          const exitContext = { eventBus, payload, reason, from: activeLayoutId, to: targetLayoutId };
          const snapshot = await sourceLayout.onExit(exitContext);
          if (snapshot !== undefined) snapshotsByLayout.set(activeLayoutId, snapshot);
        }
        const from = activeLayoutId;
        activeLayoutId = targetLayoutId;
        inputDomains.setActiveDomain(targetLayoutId);
        const enterContext = {
          eventBus,
          payload,
          reason,
          from,
          to: targetLayoutId,
          resumeSnapshot: snapshotsByLayout.get(targetLayoutId) || null,
        };
        if (typeof targetLayout.onEnter === 'function') await targetLayout.onEnter(enterContext);
        if (typeof targetLayout.onActive === 'function') await targetLayout.onActive(enterContext);
        eventBus.emit('layout:changed', { from, to: targetLayoutId, reason });
        debugLayoutLog(`[Layout] Active → ${targetLayoutId}`);
        return true;
      } finally {
        isTransitioning = false;
        inputDomains.unlock();
      }
    },
  };
}

function getHeroUIDByIndex(idx) {
  const hero = state.entities.find(e => e.kind === 'hero' && (e.heroDisplaySlot === idx || e.heroIndex === idx));
  return hero ? hero.uid : 0;
}

// simple inline game state (could import from gameLogic.js if module support added)
const gameState = {
  selectedHero: 0,
  selectedEnemy: 0,
  playerTurn: true,
  partyHP: [42, 35, 30, 40],
  partyMaxHP: [42, 35, 30, 40],
  enemyHP: [50, 60, 55],
  enemyMaxHP: [50, 60, 55],
  // Overlay state - NavMenu opens overlay window
  overlayVisible: false,
  // Gem board state
  gems: [], // array of gem objects {cellC, cellR, color, x, y}
  selectedGems: [], // indices of selected gems
  boardCreated: false,
  gridBounds: null, // bounds of grid_placeholder area for centering
  grid: [], // 2D grid of gem uid or 0
  nextGemUID: 1,
  selectionLocked: false,
  enemyTurnKicked: false,
  buffRollTimer: 0,
  buffIconPresentation: null,
  gemMergeFx: null,
  yellowCasino: {
    active: false,
    phase: 'idle',
    queue: [],
    index: 0,
    current: null,
    telegraphUntil: 0,
  },
  mapLayout: {
    panX: 0,
    panY: 0,
    panBounds: { minX: 0, maxX: 0 },
    drag: {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      moved: 0,
    },
    closeHit: null,
    tomesLocaleButton: { x: 0, y: 0, w: 146, h: 36 },
    tomesLocaleHit: null,
    artifactsLocaleButton: { x: 0, y: 0, w: 146, h: 36 },
    artifactsLocaleHit: null,
    mountsLocaleButton: { x: 0, y: 0, w: 146, h: 36 },
    mountsLocaleHit: null,
    relicsLocaleButton: { x: 0, y: 0, w: 146, h: 36 },
    relicsLocaleHit: null,
    homesteadLocaleButton: { x: 0, y: 0, w: 146, h: 36 },
    homesteadLocaleHit: null,
    warMeter: 0.64,
    encounterNode: { id: 'clouds-alpha', locale: 'clouds', faction: 'wishless' },
    lastRender: null,
  },
  refillBounce: {
    active: false,
    queue: [],
    index: 0,
    current: null,
  },
  storyCardLine: {
    text: '',
    animUntil: 0,
  },
  storyCardLayout: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    initialized: false,
    trigger: '',
  },
  heroScreen: {
    hitZones: null,
  },
  tomesLayout: {
    entryPoint: 'map-locale',
    selectedIndex: 0,
    hitZones: null,
    gallery: [
      {
        id: 'tome-cinder-codex',
        name: 'Cinder Codex',
        discovered: true,
        rarity: 'Rare',
        buffSlot: { stat: 'ATK', mode: 'flat', value: 1, cadenceTurns: 4 },
        enemyDebuffSlot: null,
      },
      {
        id: 'tome-gale-archive',
        name: 'Gale Archive',
        discovered: true,
        rarity: 'Epic',
        buffSlot: { stat: 'SPD', mode: 'flat', value: 1, cadenceTurns: 5 },
        enemyDebuffSlot: { stat: 'CRIT', mode: 'pct', value: 0.08, cadenceTurns: 0 },
      },
      {
        id: 'tome-ward-index',
        name: 'Ward Index',
        discovered: false,
        rarity: 'Legendary',
        buffSlot: { stat: 'DEF', mode: 'flat', value: 1, cadenceTurns: 6 },
        enemyDebuffSlot: null,
      },
      {
        id: 'tome-hollow-scripture',
        name: 'Hollow Scripture',
        discovered: false,
        rarity: 'Epic',
        buffSlot: { stat: 'RES', mode: 'flat', value: 1, cadenceTurns: 5 },
        enemyDebuffSlot: { stat: 'ATK', mode: 'pct', value: 0.06, cadenceTurns: 0 },
      },
    ],
  },
  artifactsLayout: {
    entryPoint: 'map-locale',
    selectedIndex: 0,
    hitZones: null,
    gallery: [
      {
        id: 'artifact-fang-mark',
        name: 'Fang Mark',
        discovered: true,
        rarity: 'Rare',
        passiveHook: { key: 'regen_tick', mode: 'flat', value: 2, cadenceTurns: 5 },
        visibleCombatFx: false,
      },
      {
        id: 'artifact-iron-crest',
        name: 'Iron Crest',
        discovered: true,
        rarity: 'Epic',
        passiveHook: { key: 'defense_boost', mode: 'flat', value: 1, cadenceTurns: 15 },
        visibleCombatFx: false,
      },
      {
        id: 'artifact-night-coin',
        name: 'Night Coin',
        discovered: false,
        rarity: 'Legendary',
        passiveHook: { key: 'enemy_slow', mode: 'pct', value: 0.06, cadenceTurns: 15 },
        visibleCombatFx: false,
      },
      {
        id: 'artifact-ward-prism',
        name: 'Ward Prism',
        discovered: false,
        rarity: 'Epic',
        passiveHook: { key: 'resist_guard', mode: 'flat', value: 1, cadenceTurns: 8 },
        visibleCombatFx: false,
      },
    ],
  },
  mountsLayout: {
    entryPoint: 'map-locale',
    selectedIndex: 0,
    hitZones: null,
    gallery: [
      {
        id: 'mount-ash-runner',
        name: 'Ash Runner',
        discovered: true,
        rarity: 'Rare',
        siblingFamily: 'progression-gallery',
        vaultCompatibilityTier: 1,
        passiveHook: { key: 'turn_speed', mode: 'flat', value: 1, cadenceTurns: 4 },
      },
      {
        id: 'mount-ridge-boar',
        name: 'Ridge Boar',
        discovered: true,
        rarity: 'Epic',
        siblingFamily: 'progression-gallery',
        vaultCompatibilityTier: 2,
        passiveHook: { key: 'impact_guard', mode: 'flat', value: 1, cadenceTurns: 7 },
      },
      {
        id: 'mount-aether-drake',
        name: 'Aether Drake',
        discovered: false,
        rarity: 'Legendary',
        siblingFamily: 'progression-gallery',
        vaultCompatibilityTier: 3,
        passiveHook: { key: 'opening_strike', mode: 'pct', value: 0.05, cadenceTurns: 0 },
      },
      {
        id: 'mount-fog-stag',
        name: 'Fog Stag',
        discovered: false,
        rarity: 'Epic',
        siblingFamily: 'progression-gallery',
        vaultCompatibilityTier: 2,
        passiveHook: { key: 'resist_guard', mode: 'flat', value: 1, cadenceTurns: 8 },
      },
    ],
  },
  relicsLayout: {
    entryPoint: 'map-locale',
    selectedIndex: 0,
    hitZones: null,
    gallery: [
      {
        id: 'relic-astral-seal',
        name: 'Astral Seal',
        discovered: true,
        rarity: 'Rare',
        siblingFamily: 'progression-gallery',
        setTag: 'seal-archive',
        passiveHook: { key: 'wallet_bonus', mode: 'pct', value: 0.04, cadenceTurns: 0 },
      },
      {
        id: 'relic-vault-shard',
        name: 'Vault Shard',
        discovered: true,
        rarity: 'Epic',
        siblingFamily: 'progression-gallery',
        setTag: 'ward-breaker',
        passiveHook: { key: 'ward_break_boost', mode: 'flat', value: 1, cadenceTurns: 0 },
      },
      {
        id: 'relic-orbit-emblem',
        name: 'Orbit Emblem',
        discovered: false,
        rarity: 'Legendary',
        siblingFamily: 'progression-gallery',
        setTag: 'orbit-regalia',
        passiveHook: { key: 'drop_weight', mode: 'pct', value: 0.05, cadenceTurns: 0 },
      },
      {
        id: 'relic-echo-trophy',
        name: 'Echo Trophy',
        discovered: false,
        rarity: 'Epic',
        siblingFamily: 'progression-gallery',
        setTag: 'echo-line',
        passiveHook: { key: 'chest_meter', mode: 'pct', value: 0.03, cadenceTurns: 0 },
      },
    ],
  },
  petsLayout: {
    entryPoint: 'map-locale',
    selectedIndex: 0,
    hitZones: null,
    gallery: [
      {
        id: 'pet-ember-sprite',
        name: 'Ember Sprite',
        discovered: true,
        rarity: 'Rare',
        siblingFamily: 'progression-gallery',
        milestoneSlots: 5,
        deploymentSlots: 2,
        passiveHook: { key: 'opening_haste', mode: 'flat', value: 1, cadenceTurns: 3 },
      },
      {
        id: 'pet-mossback',
        name: 'Mossback',
        discovered: true,
        rarity: 'Epic',
        siblingFamily: 'progression-gallery',
        milestoneSlots: 5,
        deploymentSlots: 2,
        passiveHook: { key: 'guard_bloom', mode: 'flat', value: 1, cadenceTurns: 5 },
      },
      {
        id: 'pet-velvet-fox',
        name: 'Velvet Fox',
        discovered: false,
        rarity: 'Legendary',
        siblingFamily: 'progression-gallery',
        milestoneSlots: 5,
        deploymentSlots: 2,
        passiveHook: { key: 'crit_trail', mode: 'pct', value: 0.05, cadenceTurns: 0 },
      },
      {
        id: 'pet-lantern-jelly',
        name: 'Lantern Jelly',
        discovered: false,
        rarity: 'Epic',
        siblingFamily: 'progression-gallery',
        milestoneSlots: 5,
        deploymentSlots: 2,
        passiveHook: { key: 'mana_drift', mode: 'flat', value: 1, cadenceTurns: 4 },
      },
    ],
  },
  idleFarmLayout: {
    entryPoint: 'astral-flow-nav',
    hitZones: null,
    config: {
      heroNames: ['Falie', 'Kojonn'],
      loopForever: true,
      enemySlots: 2,
      maxVisibleEnemies: 2,
      secondEnemyChance: 0.45,
      hitsToKill: 3,
      attackIntervalSec: 3,
      enemySpawnDelaySec: 1.5,
      rewardCadenceSec: 18,
      goldPerCadence: 1,
      scrapPerCadence: 1,
    },
    metaBonuses: {
      goldGainPct: 0,
      resourceGainPct: 0,
    },
    rewardLedger: {
      unclaimedEnergy: 0,
      claimedEnergyTotal: 0,
      unclaimedTokens: {
        SAND: 0,
        BONE_CHIP: 0,
        SLIME: 0,
        HORN: 0,
        SHELL: 0,
      },
      claimedTokensTotal: {
        SAND: 0,
        BONE_CHIP: 0,
        SLIME: 0,
        HORN: 0,
        SHELL: 0,
      },
    },
    emissionState: null,
    session: null,
  },
  evolutionLayout: {
    entryPoint: 'map-locale',
    selectedLevel: 0,
    hitZones: null,
    ladder: [
      { level: 1, stat: 'HP', bonusText: '+25 HP', softCurrency: 'Astral Dust', cost: 40, status: 'preview-open' },
      { level: 2, stat: 'ATK', bonusText: '+3 ATK', softCurrency: 'Astral Dust', cost: 55, status: 'preview-open' },
      { level: 3, stat: 'DEF', bonusText: '+3 DEF', softCurrency: 'Astral Dust', cost: 70, status: 'preview-open' },
      { level: 4, stat: 'MAG', bonusText: '+4 MAG', softCurrency: 'Astral Dust', cost: 90, status: 'preview-open' },
      { level: 5, stat: 'RES', bonusText: '+4 RES', softCurrency: 'Astral Dust', cost: 110, status: 'preview-open' },
      { level: 6, stat: 'SPD', bonusText: '+2 SPD', softCurrency: 'Astral Dust', cost: 135, status: 'preview-open' },
      { level: 7, stat: 'Core', bonusText: 'Trait lattice unlock seam', softCurrency: 'Astral Dust', cost: 165, status: 'future-capstone' },
    ],
    researchGates: [
      { id: 'evo-gate-falie-aegis', hero: 'Falie', node: 'Aegis Theory', unlockLevel: 3, state: 'future-research' },
      { id: 'evo-gate-huun-ambush', hero: 'Huun', node: 'Ambush Weave', unlockLevel: 4, state: 'future-research' },
      { id: 'evo-gate-runa-ward', hero: 'Runa', node: 'Ward Bloom', unlockLevel: 5, state: 'future-research' },
      { id: 'evo-gate-kojonn-blight', hero: 'Kojonn', node: 'Blight Script', unlockLevel: 6, state: 'future-research' },
    ],
  },
  homesteadLayout: {
    entryPoint: 'map-locale',
    selectedSlot: 0,
    hitZones: null,
    scene: {
      theme: 'garden-shell',
      slots: [
        { id: 'home-slot-1', kind: 'emitter-pad', unlocked: true, buildState: 'empty' },
        { id: 'home-slot-2', kind: 'workshop-node', unlocked: true, buildState: 'empty' },
        { id: 'home-slot-3', kind: 'storage-node', unlocked: false, buildState: 'locked' },
        { id: 'home-slot-4', kind: 'garden-node', unlocked: false, buildState: 'locked' },
      ],
      placeholderEmissions: [
        { key: 'soft_currency', cadenceSeconds: 300, value: 10 },
        { key: 'material_scrap', cadenceSeconds: 600, value: 1 },
      ],
    },
  },
  chestsLayout: {
    entryPoint: 'menu-nav',
    activeTab: 'Common',
    progress: {
      current: 36,
      target: 100,
      milestoneReward: 'Tier Chest',
    },
    hitZones: null,
    tabs: [
      { id: 'Common', label: 'Common', tier: 1, chestCount: 3 },
      { id: 'Rare', label: 'Rare', tier: 2, chestCount: 2 },
      { id: 'Epic', label: 'Epic', tier: 3, chestCount: 1 },
      { id: 'Legendary', label: 'Legendary', tier: 4, chestCount: 0 },
    ],
    retentionButtons: [
      { id: 'homestead', title: 'Enter Homestead', subtitle: 'Map Locale', targetLayout: 'homesteadLayout', fill: '#f4efcf', stroke: '#a08f41', text: '#5a4d17' },
      { id: 'relics', title: 'Enter Relics', subtitle: 'Map Locale', targetLayout: 'relicsLayout', fill: '#f1e0f7', stroke: '#8e61a4', text: '#4a275d' },
      { id: 'pets', title: 'Enter Pets', subtitle: 'Map Locale', targetLayout: 'petsLayout', fill: '#e7f2d5', stroke: '#7e9e54', text: '#324819' },
      { id: 'evolution', title: 'Enter Evolution', subtitle: 'Soft Currency', targetLayout: 'evolutionLayout', fill: '#e3ecfb', stroke: '#5a79b8', text: '#20385f' },
      { id: 'mounts', title: 'Enter Mounts', subtitle: 'Map Locale', targetLayout: 'mountsLayout', fill: '#d9f2da', stroke: '#4a8b4f', text: '#1f4a24' },
      { id: 'artifacts', title: 'Enter Artifacts', subtitle: 'Map Locale', targetLayout: 'artifactsLayout', fill: '#d7e7f8', stroke: '#3c6f9f', text: '#17324a' },
      { id: 'tomes', title: 'Enter Tomes', subtitle: 'Map Locale', targetLayout: 'tomesLayout', fill: '#f3ddaa', stroke: '#8d6d2a', text: '#2f2412' },
    ],
    rewardsByTab: {
      Common: ['Pet Fragment x5', 'Relic Scrap x8', 'Coins x250'],
      Rare: ['Pet Fragment x10', 'Relic Token x2', 'Coins x600'],
      Epic: ['Pet Core x1', 'Relic Token x4', 'Coins x1200'],
      Legendary: ['Pet Core x2', 'Ancient Relic x1', 'Coins x3000'],
    },
  },
  task015Trace: {
    storycardPlacement: [],
    yellowQueue: [],
    yellowRefillQueue: [],
    yellowWrites: [],
    yellowAnimation: [],
  },
  lastTurnPhase: null,
  baseSummary: '',
  startupLoad: {
    active: true,
    phase: 'boot',
    label: 'Booting runtime...',
    progress: 0,
  },
};

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
    lastAppliedAt: 0,
  };
}

function getIdleFarmRuntimeDeps(nowSec = 0) {
  return {
    nowSec,
    heroSlots: ensureDevToolingConfig().heroSlots,
    fallbackRoster: CANONICAL_HERO_ROSTER.map((hero) => String(hero?.name || '')).filter(Boolean),
    enemyCatalog: Array.isArray(state.globals.DevToolEnemyCatalog) ? state.globals.DevToolEnemyCatalog : [],
  };
}

function ensureIdleFarmSession(nowSec = 0) {
  const layout = gameState.idleFarmLayout || {};
  return ensureIdleFarmSessionState(layout, getIdleFarmRuntimeDeps(nowSec));
}

function startIdleFarmEmissions(nowSec = 0) {
  const layout = gameState.idleFarmLayout;
  if (!layout) return null;
  return startIdleFarmEmissionState(layout, getIdleFarmRuntimeDeps(nowSec));
}

function updateIdleFarmEmissions(nowSec = 0) {
  const layout = gameState.idleFarmLayout;
  if (!layout) return null;
  return updateIdleFarmEmissionState(layout, getIdleFarmRuntimeDeps(nowSec));
}

function updateIdleFarmSession(nowSec = 0) {
  const layout = gameState.idleFarmLayout;
  if (!layout) return null;
  return updateIdleFarmSessionState(layout, getIdleFarmRuntimeDeps(nowSec));
}

function restartIdleFarmSession(nowSec = 0) {
  const layout = gameState.idleFarmLayout;
  if (!layout) return null;
  return restartIdleFarmSessionState(layout, getIdleFarmRuntimeDeps(nowSec));
}

function claimIdleFarmRewards() {
  const layout = gameState.idleFarmLayout;
  if (!layout) return { energy: 0, tokens: {} };
  updateIdleFarmEmissions(performance.now() / 1000);
  const claimed = claimIdleFarmRewardsFromState(layout);
  const applied = applyIdleFarmRewardsToGlobals(state.globals, claimed);
  if ((applied.energy > 0) || Object.values(applied.tokens || {}).some((amount) => Number(amount || 0) > 0)) {
    resetIdleFarmEmissionCadence(layout, getIdleFarmRuntimeDeps(performance.now() / 1000));
  }
  return applied;
}

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
  next.lastAppliedAt = Number(next.lastAppliedAt || 0);
  return next;
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
  let changed = 0;
  for (const gem of gameState.gems) {
    if (!gem) continue;
    gem.color = color;
    gem.elementIndex = color;
    changed += 1;
  }
  return changed;
}

function updateDevToolingStatus(message = '') {
  if (!devToolingDom || !devToolingDom.status) return;
  const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
    ? layoutState.getActiveLayoutId()
    : 'unknown';
  const autoplayActive = !!state.globals.DevAutoplayActive;
  if (devToolingDom.autoplay) {
    devToolingDom.autoplay.textContent = autoplayActive ? 'Stop Idle Mode' : 'Run Idle Mode';
  }
  const suffix = message ? `\n${message}` : '';
  devToolingDom.status.textContent =
    `Hotkey: ${DEV_TOOL_HOTKEY_LABEL}\nActive Layout: ${activeLayoutId}\nIdle Mode: ${autoplayActive ? 'ACTIVE' : 'idle'}\nApply: writes only the selected condition; no combat reset, turn advance, or loadout refresh${suffix}`;
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
  };
}

async function applyDevToolingConfig(patch = {}, { closeModal = true } = {}) {
  const next = sanitizeDevToolingConfig({
    ...ensureDevToolingConfig(),
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
  persistDevToolingConfig(next);
  gameState.selectedHero = Math.min(gameState.selectedHero || 0, Math.max(0, next.heroSlots.filter(Boolean).length - 1));
  gameState.selectedEnemy = Math.min(gameState.selectedEnemy || 0, Math.max(0, next.enemySlots.filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT).length - 1));
  const recolored = applyBoardGemColor(next.boardGemColor);
  syncDevToolingDomFromConfig();
  if (closeModal) closeDevToolingModal({ restorePauseSnapshot: true });
  updateDevToolingStatus(
    `Applied\n` +
    `Board recolor count: ${recolored}\n` +
    `Hero slots (staged): ${next.heroSlots.map((value) => value || 'Empty').join(', ')}\n` +
    `Enemy slots (staged): ${next.enemySlots.map((value) => value === DEV_TOOL_RANDOM_ENEMY_SLOT ? 'Random' : (value || 'Empty')).join(', ')}\n` +
    `Reward (staged): ${next.rewardDrops || 'None'} x${next.rewardCount}\n` +
    `Combat state unchanged`
  );
  return {
    ...next,
    rewardDrops: [...(state.globals.DevRewardDrops || [])],
    boardRecolored: recolored,
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
    'padding:24px',
    'box-sizing:border-box',
  ].join(';');
  const panel = document.createElement('div');
  panel.style.cssText = [
    'width:min(520px, 92vw)',
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
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
      <div>
        <div style="font-size:18px;font-weight:800;">Dev Tooling Modal</div>
        <div style="font-size:11px;color:#475569;">Global runtime controls. Hotkey: ${DEV_TOOL_HOTKEY_LABEL}</div>
      </div>
      <button type="button" data-devtool-close style="border:1px solid #334155;background:#ffffff;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;">Close</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;">
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
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button type="button" data-devtool-apply style="border:1px solid #14532d;background:#1f8f4a;color:#fff;padding:8px 12px;border-radius:8px;font-weight:800;cursor:pointer;">Apply</button>
      <button type="button" data-devtool-refresh style="border:1px solid #475569;background:#fff;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Save Staged</button>
      <button type="button" data-devtool-autoplay style="border:1px solid #1d4ed8;background:#eff6ff;color:#1e3a8a;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Run Idle Mode</button>
    </div>
    <pre data-devtool-status style="margin:14px 0 0;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff9ee;white-space:pre-wrap;"></pre>
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
    autoplay: panel.querySelector('[data-devtool-autoplay]'),
    heroSlots: Array.from(panel.querySelectorAll('[data-devtool-hero-slot]')),
    enemySlots: Array.from(panel.querySelectorAll('[data-devtool-enemy-slot]')),
    boardGemColor: panel.querySelector('[data-devtool-board-color]'),
    goldAmount: panel.querySelector('[data-devtool-gold-amount]'),
    combatSpeed: panel.querySelector('[data-devtool-combat-speed]'),
    rewardDrops: panel.querySelector('[data-devtool-reward-drops]'),
    rewardCount: panel.querySelector('[data-devtool-reward-count]'),
    status: panel.querySelector('[data-devtool-status]'),
  };
  devToolingDom.launcher.addEventListener('click', () => toggleDevToolingModal(true));
  devToolingDom.close.addEventListener('click', () => toggleDevToolingModal(false));
  devToolingDom.refresh.addEventListener('click', () => applyDevToolingConfig(readDevToolingDomConfigPatch(), { closeModal: false }));
  devToolingDom.apply.addEventListener('click', () => applyDevToolingConfig(readDevToolingDomConfigPatch(), { closeModal: true }));
  devToolingDom.autoplay.addEventListener('click', async () => {
    if (state.globals.DevAutoplayActive) {
      state.globals.DevAutoplayStopRequested = 1;
      updateDevToolingStatus('Idle mode stop requested');
      return;
    }
    closeDevToolingModal({ restorePauseSnapshot: false });
    if (typeof devToolingAutoplayHandler === 'function') {
      await devToolingAutoplayHandler();
    }
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
  };
  state.globals.CanPickGems = 0;
  state.globals.IsPlayerBusy = 1;
  state.globals.DevToolingPaused = 1;
}

function resumeGameplayFromDevTooling() {
  if (!devToolingPauseSnapshot) {
    state.globals.DevToolingPaused = 0;
    return;
  }
  state.globals.CanPickGems = devToolingPauseSnapshot.CanPickGems;
  state.globals.IsPlayerBusy = devToolingPauseSnapshot.IsPlayerBusy;
  state.globals.DeferAdvance = devToolingPauseSnapshot.DeferAdvance;
  state.globals.PendingSkillID = devToolingPauseSnapshot.PendingSkillID;
  state.globals.DevToolingPaused = 0;
  devToolingPauseSnapshot = null;
}

function closeDevToolingModal({ restorePauseSnapshot = true } = {}) {
  const cfg = ensureDevToolingConfig();
  const root = ensureDevToolingModal()?.root;
  cfg.open = false;
  state.globals.DevToolingConfig = cfg;
  if (root) root.style.display = 'none';
  if (restorePauseSnapshot) {
    resumeGameplayFromDevTooling();
  } else {
    devToolingPauseSnapshot = null;
    state.globals.DevToolingPaused = 0;
  }
  return cfg;
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
  if (!gameState.task015Trace) {
    gameState.task015Trace = {
      storycardPlacement: [],
      yellowQueue: [],
      yellowRefillQueue: [],
      yellowWrites: [],
      yellowAnimation: [],
    };
  }
  return gameState.task015Trace;
}

function updateStartupLoadState(patch = {}) {
  const prev = gameState.startupLoad && typeof gameState.startupLoad === 'object'
    ? gameState.startupLoad
    : { active: true, phase: 'boot', label: 'Booting runtime...', progress: 0 };
  const nextProgress = Math.max(0, Math.min(1, Number(
    Object.prototype.hasOwnProperty.call(patch, 'progress')
      ? patch.progress
      : prev.progress
  ) || 0));
  gameState.startupLoad = {
    ...prev,
    ...patch,
    progress: nextProgress,
  };
  return gameState.startupLoad;
}

function traceTask015YellowQueue(queue) {
  const store = getTask015TraceStore();
  store.yellowQueue = (queue || []).map((item, idx) => ({
    idx: Number(idx),
    type: String(item.type || ''),
    cellR: Number(item.cellR || 0),
    cellC: Number(item.cellC || 0),
    reason: String(item.reason || ''),
    uid: Number(item.uid || 0),
    target: Number(item.target || 0),
  }));
}

function traceTask015YellowWrite(source, item, step) {
  const store = getTask015TraceStore();
  store.yellowWrites.push({
    source: String(source || ''),
    step: Number(step || 0),
    cellR: Number(item.cellR || 0),
    cellC: Number(item.cellC || 0),
    type: String(item.type || ''),
    target: Number(item.target || 0),
    assignedColor: Number(item.target || 0),
    time: Number(state.globals.time || 0),
  });
  if (store.yellowWrites.length > 120) store.yellowWrites.shift();
}

function traceTask015YellowAnimation(stage, payload = {}) {
  const store = getTask015TraceStore();
  store.yellowAnimation.push({
    stage: String(stage || ''),
    time: Number(state.globals.time || 0),
    ...payload,
  });
  if (store.yellowAnimation.length > 200) store.yellowAnimation.shift();
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
});

const CANONICAL_HERO_ROSTER = [
  { name: 'Falie', hp: 42, maxHP: 42, ATK: 18, DEF: 20, MAG: 10, RES: 18, SPD: 9, attackType: 'melee' },
  { name: 'Huun', hp: 35, maxHP: 35, ATK: 22, DEF: 10, MAG: 8, RES: 12, SPD: 20, attackType: 'melee' },
  { name: 'Runa', hp: 30, maxHP: 30, ATK: 8, DEF: 8, MAG: 28, RES: 20, SPD: 11, attackType: 'magic' },
  { name: 'Kojonn', hp: 40, maxHP: 40, ATK: 12, DEF: 14, MAG: 22, RES: 18, SPD: 14, attackType: 'magic' },
];
// Deterministic gate metric used for progression/access comparisons.
function computeCombatPower(atk, def, hp, mag = 0, res = 0, attackType = '') {
  const a = Number(atk || 0);
  const d = Number(def || 0);
  const h = Number(hp || 0);
  const m = Number(mag || 0);
  const r = Number(res || 0);
  const type = String(attackType || '').toLowerCase();
  const offense = type === 'magic'
    ? m
    : (type === 'melee' ? a : Math.max(a, m));
  const mitigation = (d * 0.65) + (r * 0.35);
  const survivability = mitigation + (h / 10);
  return Math.ceil(offense + survivability);
}
const HERO_STAT_KEYS = ['ATK', 'DEF', 'MAG', 'RES', 'SPD', 'HP'];
const FIGMA_HERO_NEXT_URL = 'https://www.figma.com/api/mcp/asset/dfb1bc1b-4189-4f52-9c88-1cf1e4f8029a';
const FIGMA_HERO_BACK_URL = 'https://www.figma.com/api/mcp/asset/6ce3ba17-8c7d-4a3e-bc8e-194b9b4947d9';
const FIGMA_HERO_CLOSE_OVAL_URL = 'https://www.figma.com/api/mcp/asset/978c0a6d-a797-4ae7-b41c-4306877ad7bd';
const FIGMA_PLUS_URL = 'https://www.figma.com/api/mcp/asset/f978e439-2103-43fd-be9d-fcb7f5aa9d7f';
const FIGMA_MINUS_URL = 'https://www.figma.com/api/mcp/asset/b5733d59-96b6-4f04-a5de-e4134dea9565';
const HERO_PACK_PLUS_PATH = 'images/plus.png';
const HERO_PACK_MINUS_PATH = 'images/minus.png';
const HERO_PACK_CLOSE_OVAL_PATH = 'images/ui_closewin-animation 1-000.png';
const heroLayoutSpec = {
  artboard: { w: 360, h: 640 },
  portrait: { x: 109, y: 32, w: 142, h: 92 },
  arrows: {
    left: { x: 22, y: 78, w: 24, h: 38, glyphX: 34, glyphY: 97 },
    right: { x: 322, y: 78, w: 24, h: 38, glyphX: 334, glyphY: 97 },
  },
  namePill: { x: 85, y: 134, w: 190, h: 24 },
  stats: {
    labelsTop: 168,
    valuesTop: 190,
    labelH: 14,
    valueH: 44,
    cells: [
      { x: 16, w: 50 },
      { x: 72, w: 50 },
      { x: 128, w: 50 },
      { x: 184, w: 50 },
      { x: 240, w: 50 },
      { x: 296, w: 50 },
    ],
  },
  skillPoints: {
    row: { x: 160, y: 251, w: 190, h: 24 },
    chip: { x: 286, y: 252, w: 58, h: 20 },
  },
  cards: [
    {
      card: { x: 12, y: 287, w: 336, h: 79.53 },
      titleStrip: { x: 60, y: 295, w: 182, h: 13 },
      iconTile: { x: 18.96, y: 308.87, w: 37.775, h: 37.775 },
      bodyText: { x: 65.68, titleY: 306.5, line1Y: 324.5, line2Y: 336.5, line3Y: 348.5 },
      controls: {
        minus: { x: 249.59, y: 316.73, w: 22.773, h: 23.954 },
        value: { x: 277, y: 316, w: 35.787, h: 20.876 },
        plus: { x: 317.18, y: 312.85, w: 22.039, h: 23.676 },
      },
    },
    {
      card: { x: 12, y: 380.44, w: 336, h: 79.53 },
      titleStrip: { x: 60, y: 389, w: 182, h: 13 },
      iconTile: { x: 18.96, y: 402.31, w: 37.775, h: 37.775 },
      bodyText: { x: 65.68, titleY: 400.5, line1Y: 418.5, line2Y: 430.5, line3Y: 442.5 },
      controls: {
        minus: { x: 249.59, y: 410.17, w: 22.773, h: 23.954 },
        value: { x: 277, y: 409, w: 35.787, h: 20.876 },
        plus: { x: 317.18, y: 406.29, w: 22.039, h: 23.676 },
      },
    },
    {
      card: { x: 12, y: 473.89, w: 336, h: 79.53 },
      titleStrip: { x: 60, y: 482, w: 182, h: 13 },
      iconTile: { x: 18.96, y: 495.76, w: 37.775, h: 37.775 },
      bodyText: { x: 65.68, titleY: 493.5, line1Y: 511.5, line2Y: 523.5, line3Y: 535.5 },
      controls: {
        minus: { x: 249.59, y: 503.61, w: 22.773, h: 23.954 },
        value: { x: 277, y: 503, w: 35.787, h: 20.876 },
        plus: { x: 317.18, y: 499.73, w: 22.039, h: 23.676 },
      },
    },
  ],
  close: { cx: 180, cy: 608, r: 15 },
};

function getHeroScreenRoster() {
  const runtimeHeroes = (state.entities || [])
    .filter(e => e && e.kind === 'hero')
    .sort((a, b) => Number(a.heroDisplaySlot ?? a.heroIndex ?? 0) - Number(b.heroDisplaySlot ?? b.heroIndex ?? 0));
  if (runtimeHeroes.length) return runtimeHeroes;
  return CANONICAL_HERO_ROSTER.map((hero, idx) => ({
    uid: idx + 1,
    kind: 'hero',
    name: hero.name,
    heroIndex: idx,
    hp: Number(hero.hp || 0),
    maxHP: Number(hero.maxHP || hero.hp || 0),
    combatPower: computeCombatPower(hero.ATK, hero.DEF, hero.maxHP || hero.hp, hero.MAG, hero.RES, hero.attackType),
    stats: {
      ATK: Number(hero.ATK || 0),
      DEF: Number(hero.DEF || 0),
      MAG: Number(hero.MAG || 0),
      RES: Number(hero.RES || 0),
      SPD: Number(hero.SPD || 0),
    },
  }));
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
        `Green match: blight over time on all enemies.`,
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
  const fallbackSkillStates = [
    { slot: 0, key: 'skill1', title: getHeroStarterSkillTitle(hero && hero.name), rank: 0, maxRank: 3, nextCost: 0, status: 'locked' },
    { slot: 1, key: 'skill2', title: 'Skill 2', rank: 0, maxRank: 3, nextCost: 0, status: 'locked' },
    { slot: 2, key: 'skill3', title: 'Skill 3', rank: 0, maxRank: 3, nextCost: 0, status: 'locked' },
  ];
  const heroUID = Number(hero && hero.uid) || getHeroUIDByIndex(Number.isFinite(heroIndex) ? heroIndex : 0);
  const stateMap = heroUID
    ? (callFunctionWithContext(fnContext, 'GetAllHeroSkillStates', heroUID) || {})
    : {};
  const liveStates = Object.values(stateMap)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      slot: Math.max(0, Math.floor(Number(entry.slot) || 0)),
      key: String(entry.key || ''),
      title: String(entry.title || ''),
      rank: Math.max(0, Math.floor(Number(entry.rank) || 0)),
      maxRank: Math.max(1, Math.floor(Number(entry.maxRank) || 1)),
      nextCost: Math.max(0, Math.floor(Number(entry.nextCost) || 0)),
      status: String(entry.status || 'locked'),
    }))
    .sort((a, b) => a.slot - b.slot);
  const picked = (liveStates.length ? liveStates : fallbackSkillStates).slice(0, 3);
  while (picked.length < 3) picked.push(fallbackSkillStates[picked.length]);
  return picked.map((skill, idx) => ({
    ...skill,
    title: String(skill.title || fallbackSkillStates[idx].title || `Skill ${idx + 1}`),
    rankLabel: `Lv${Math.max(0, Math.floor(Number(skill.rank) || 0))}`,
    lines: buildHeroSkillDescriptionLines(hero, skill),
  }));
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

function getHeroStyleCloseRect(viewWidth, viewHeight) {
  const artW = Number(heroLayoutSpec?.artboard?.w || 360);
  const artH = Number(heroLayoutSpec?.artboard?.h || 640);
  const fitScale = Math.min(viewWidth / artW, viewHeight / artH);
  const artOffsetX = (viewWidth - (artW * fitScale)) * 0.5;
  const artOffsetY = (viewHeight - (artH * fitScale)) * 0.5;
  const r = Number(heroLayoutSpec?.close?.r || 15) * fitScale;
  const cx = artOffsetX + (Number(heroLayoutSpec?.close?.cx || 180) * fitScale);
  const cy = artOffsetY + (Number(heroLayoutSpec?.close?.cy || 608) * fitScale);
  return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, r };
}

function drawHeroStyleCloseControl(ctx, closeRect, closeOvalImage = null, ink = '#111') {
  if (!closeRect) return;
  const cx = closeRect.x + (closeRect.w / 2);
  const cy = closeRect.y + (closeRect.h / 2);
  const radius = closeRect.r || (closeRect.w / 2);
  // Always establish a circular base so square source sprites cannot regress this control.
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#d9d9d9';
  ctx.fill();
  if (closeOvalImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(closeOvalImage, closeRect.x, closeRect.y, closeRect.w, closeRect.h);
    ctx.restore();
  }
  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.max(12, Math.round(closeRect.h * 0.55))}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('X', cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
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
  setGems: (gems) => { setGemArray(gems); },
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

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function readPersistedHeroGemProgress() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(HERO_GEM_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writePersistedHeroGemProgress(snapshot) {
  if (!canUseLocalStorage() || !snapshot || typeof snapshot !== 'object') return false;
  try {
    window.localStorage.setItem(HERO_GEM_PROGRESS_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

function restoreHeroGemProgressFromStorage() {
  const snapshot = readPersistedHeroGemProgress();
  if (!snapshot) return false;
  callFunctionWithContext(fnContext, 'LoadHeroGemProgressSnapshot', snapshot);
  syncFromGlobals();
  return true;
}

function persistHeroGemProgressIfDirty() {
  if (!state.globals.HeroGemProgressDirty) return false;
  const snapshot = callFunctionWithContext(fnContext, 'GetHeroGemProgressSnapshot');
  const wrote = writePersistedHeroGemProgress(snapshot);
  if (wrote) {
    state.globals.HeroGemProgressDirty = 0;
    state.globals.HeroGemProgressPersistedAt = Date.now();
  }
  return wrote;
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
  let state = Number(seed || 1) >>> 0;
  if (!state) state = 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
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

function buildEncounterByBudget({ pool, targetCP, locale = 'all', maxSlots = 3, policy = 'mixed', seed = 1, faction = '', historyCounts = null } = {}) {
  const candidates = Array.isArray(pool) ? pool : [];
  const normalizedLocale = String(locale || 'all').trim().toLowerCase() || 'all';
  const rawFactionFilter = String(faction || '').trim().toLowerCase();
  const normalizedFaction = rawFactionFilter ? normalizeFaction(rawFactionFilter) : '';
  const rng = createSeededRng(seed);
  const reasonCodes = [];
  const eligible = candidates.filter((row) => {
    const tags = normalizeBiomeTags(row?.localeTags || row?.locale || row?.biome || 'all');
    const localeOk = normalizedLocale === 'all' || tags.includes('all') || tags.includes(normalizedLocale);
    if (!localeOk) return false;
    if (!normalizedFaction) return true;
    return normalizeFaction(row?.faction) === normalizedFaction;
  });
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
  const mappedEnemyData = (enemyRows || []).map((row) => ({
    ...row,
    faction: normalizeFaction(row?.faction),
    enemyRole: normalizeEnemyRole(row?.enemyRole || row?.role),
    locale: String(row?.locale || row?.biome || row?.biomes || 'all').trim().toLowerCase() || 'all',
    biome: String(row?.biome || row?.biomes || 'all').trim().toLowerCase() || 'all',
    biomeTags: normalizeBiomeTags(row?.biomes || row?.biome || 'all'),
    localeTags: normalizeBiomeTags(row?.localeTags || row?.locale_tags || row?.locale || row?.biomes || row?.biome || 'all'),
    CombatPower: computeCombatPower(row?.ATK, row?.DEF, row?.HP, row?.MAG, row?.RES, row?.attackType),
  }));
  state.globals.DevToolEnemyCatalog = [...new Set(mappedEnemyData.map((row) => String(row?.name || row?.EnemyName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  state.globals.EnemyData = mappedEnemyData;
  state.globals.CombatSessionId = Number(state.globals.CombatSessionId || 0) + 1;

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
      combatPower: computeCombatPower(v.ATK, v.DEF, partyMaxHP[i], v.MAG, v.RES, v.attackType),
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
    startupDebugLog(`[HP_FIX] hero=${v.name} maxHP=${maxHP}`);
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
  state.globals.BattleStartMode = Math.random() < 0.5 ? 'ambush' : 'initiative';
  state.globals.BattleStartShown = 1;
  state.globals.BattleStartClearedForSession = 0;
  const msg = state.globals.BattleStartMode === 'ambush'
    ? 'Ambushed by enemy team!'
    : 'Heroes surprised the enemies!';
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
    startupDebugLog(`[ENCOUNTER] seed=${encounterSeed} targetCP=${encounterRequest.targetCP} locale=${encounterRequest.locale} policy=${encounterRequest.policy}`);
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
    state.globals.EncounterPoolNames = picks.map(p => String(p?.name || '')).filter(Boolean);
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
        CombatPower: computeCombatPower(pick.ATK, pick.DEF, pick.HP, pick.MAG, pick.RES, pick.attackType),
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

// Create gem board with random colors (0-5: Hero1, Hero2, Heal, Buff, AOE, Energy)
function createGemBoard(gridBounds = null, { immediateFill = false } = {}) {
  assertCombatLayoutDev('createGemBoard');
  gameState.gems = [];
  gameState.grid = [];
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
    startupDebugLog(`[BOARD] Centered within grid bounds: (${startX.toFixed(1)}, ${startY.toFixed(1)})`);
  }
  
  for (let c = 0; c < g.cols; c++) {
    gameState.grid[c] = [];
    for (let r = 0; r < g.rows; r++) {
      gameState.grid[c][r] = 0;
    }
  }

  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  gameState.boardCreated = true;
  setGemArray(gameState.gems);
  state.globals.TapIndex = 0;
  startupDebugLog(`[BOARD] Created gem board: ${g.cols}x${g.rows} = ${gameState.gems.length} gems`);
  if (immediateFill) {
    refillGemBoard(gridBounds);
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
  const x = Math.floor(Math.random() * 1000);
  if (x === 998) return 6;
  const countPurple = () => (gameState.gems || []).reduce((n, g) => {
    const c = g && g.color != null ? g.color : (g ? g.elementIndex : null);
    return n + (c === 5 ? 1 : 0);
  }, 0);
  const pickByWeights = (weights) => {
    let total = 0;
    for (const w of weights) total += w;
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return 0;
  };
  // Colors 0-4 standard, 5 purple jackpot.
  const weights = [1, 1, 1, 1, 1, PURPLE_WEIGHT];
  let frame = pickByWeights(weights);
  if (frame === 5 && countPurple() >= MAX_PURPLE_ON_BOARD) {
    frame = pickByWeights([1, 1, 1, 1, 1]);
  }
  return frame;
}


function refillGemBoard(gridBounds = null) {
  const g = boardGeometry;
  rebuildGridFromGems();
  let hasEmpty = false;
  for (let c = 0; c < g.cols; c++) {
    for (let r = 0; r < g.rows; r++) {
      if (gameState.grid[c][r] === 0) { hasEmpty = true; break; }
    }
    if (hasEmpty) break;
  }
  if (!hasEmpty) {
    startupDebugLog('[BOARD] Refill skipped (board full)');
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
      gameState.grid[c][r] = gameState.gems[gameState.gems.length - 1].uid;
    }
  }
  gameState.boardCreated = true;
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  setGemArray(gameState.gems);
  state.globals.TapIndex = 0;
  startupDebugLog('[BOARD] Refilled missing gems');
  return true;
}

function handleSpecialGem6(gem) {
  const g = state.globals;
  const actorUID = callFunctionWithContext(fnContext, 'GetCurrentTurn') || getHeroUIDByIndex(gameState.selectedHero) || gameState.selectedHero;
  const actor = state.entities.find(e => e.uid === actorUID);
  const actorName = actor ? (actor.name || 'Hero') : 'Hero';
  const energyOptions = [6, 12, 15];
  const amt = energyOptions[Math.floor(Math.random() * energyOptions.length)];
  const next = (g.Player_Energy || 0) + amt;
  g.Player_Energy = next;
  callFunctionWithContext(fnContext, 'LogCombat', `${actorName} gained ${amt} energy!`);
  callFunctionWithContext(fnContext, 'SpawnDamageText', amt, gem.x, gem.y, 'heal');
  // Remove gem and free slot
  gameState.gems = gameState.gems.filter(gm => gm !== gem);
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  for (const gm of gameState.gems) {
    gm.selected = false;
    gm.Selected = 0;
  }
  state.globals.TapIndex = 0;
  rebuildGridFromGems();
  setGemArray(gameState.gems);
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

function pickYellowCasinoTarget() {
  const idx = Math.floor(Math.random() * YELLOW_CASINO_TARGETS.length);
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
  const gemByCell = new Map();
  for (const gm of (gameState.gems || [])) {
    if (!gm || gm.cellR == null || gm.cellC == null) continue;
    gemByCell.set(`${gm.cellR},${gm.cellC}`, gm);
  }
  const queue = [];
  for (let r = 0; r < boardGeometry.rows; r++) {
    for (let c = 0; c < boardGeometry.cols; c++) {
      const key = `${r},${c}`;
      const gem = gemByCell.get(key) || null;
      const color = gem && gem.color != null ? gem.color : (gem ? gem.elementIndex : null);
      const cellFilled = !!(gameState.grid[c] && gameState.grid[c][r]);
      if (gem && color === YELLOW_COLOR) {
        queue.push({
          type: 'yellow',
          reason: 'yellow-reassign',
          uid: gem.uid,
          cellC: c,
          cellR: r,
          target: pickYellowReassignTarget(),
          sequence: null,
          startAt: 0,
          duration: YELLOW_CASINO_SPIN_SEC,
          frameDuration: 0,
        });
      } else if (!cellFilled) {
        const pos = getCellWorldPos(c, r);
        queue.push({
          type: 'empty',
          reason: 'yellow-refill',
          uid: 0,
          cellC: c,
          cellR: r,
          target: pickYellowRefillTarget(),
          sequence: null,
          startAt: 0,
          duration: YELLOW_CASINO_SPIN_SEC,
          frameDuration: 0,
        });
      }
    }
  }

  const hasWork = queue.length > 0;
  const additionalYellowConsumed = queue.filter((item) => item.type === 'yellow').length;
  const totalYellowConsumed = Math.max(0, Number(initialMatchedYellowCount || 0)) + additionalYellowConsumed;
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

  for (const item of queue) {
    if (item.type !== 'yellow') continue;
    const gm = gemByCell.get(`${item.cellR},${item.cellC}`);
    if (gm) gm.flashUntil = now + YELLOW_CASINO_TELEGRAPH_SEC;
  }

  gemDebugLog('[FILL_GATE]', {
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
  });
  gemDebugLog('[FILL_CANDIDATES]', queue.map((item, idx) => ({
    idx,
    reason: item.reason,
    type: item.type,
    cellR: item.cellR,
    cellC: item.cellC,
    target: item.target,
    uid: item.uid || 0,
  })));

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
    state.globals.BoardFillActive = 0;
    applyTurnGateIntent(createYellowSequenceSkip);
  }
}

function startRefillBounce(speedScale = 1) {
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
  gemDebugLog('[FILL_GATE]', {
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
  });
  gemDebugLog('[FILL_CANDIDATES]', emptySlots.map((slot, idx) => ({
    idx,
    reason: slot.reason,
    cellR: slot.cellR,
    cellC: slot.cellC,
  })));
  refill.active = hasWork;
  refill.queue = emptySlots;
  refill.index = 0;
  refill.current = null;
  if (hasWork) {
    state.globals.BoardFillActive = 1;
    applyTurnGateIntent(createRefillStartGate);
  } else {
    gemDebugLog('[FILL_SKIP]', { stage: 'refill-bounce-start', reason: 'not-needed' });
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
  state.globals.CanPickGems = false;
  state.globals.IsPlayerBusy = 1;

  const actorUID = callFunctionWithContext(fnContext, 'GetCurrentTurn') || getHeroUIDByIndex(gameState.selectedHero) || gameState.selectedHero;
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

  const syncGemsFromGlobals = () => {
    if (state.globals.Gems && Array.isArray(state.globals.Gems)) {
      gameState.gems = state.globals.Gems;
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
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    g.ApplyChainToNextDamage = g.ChainNumber >= 2 ? 1 : 0;
  } else if (color === 2) {
    const consumedBlue = Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0;
    startGemMergeFx();
    g.MatchedColorValue = 0;
    g.IsAOEMatch = 0;
    g.SuppressChainUI = 0;
    callFunctionWithContext(fnContext, 'UpdateChain', 2);
    callFunctionWithContext(fnContext, 'ResolveGemAction', 2, actorUID, consumedBlue);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    g.ApplyChainToNextDamage = 0;
  } else if (color === 3) {
    const matchedYellowCount = Math.max(0, Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0);
    const goldTarget = getGoldLabelTargetWorld();
    const actor = state.entities.find(e => e.uid === actorUID);
    const actorName = actor ? (actor.name || 'Hero') : 'Hero';
    const yellowMergeSources = (gameState.gems || [])
      .filter((gm) => Number(gm && (gm.color ?? gm.elementIndex)) === YELLOW_COLOR)
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
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    startYellowCasinoSequence(actorUID, matchedYellowCount, {
      goldTarget,
      mergeSources: yellowMergeSources,
    });
  } else if (color === 4) {
    const matchedCount = Math.max(0, Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0);
    g.MatchedColorValue = 4;
    g.IsAOEMatch = 0;
    callFunctionWithContext(fnContext, 'UpdateChain', 4);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    callFunctionWithContext(fnContext, 'ResolveGemAction', 4, actorUID, matchedCount);
  } else if (color === 5) {
    const matchedCount = Math.max(0, Array.isArray(gameState.selectedGems) ? gameState.selectedGems.length : 0);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'ResolveGemAction', 5, actorUID, matchedCount);
  } else if (color === 6 || color === 7) {
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
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
  if (state.globals.TurnPhase === 2) {
    callFunctionWithContext(fnContext, 'EnemyTurn');
  }
  syncFromGlobals();
}

function tryGetInstances(layout){
  if (!layout || !Array.isArray(layout.layers)) return [];
  const instances = layout.layers
    .filter(layer => layer && Array.isArray(layer.instances))
    .flatMap(layer => layer.instances);
  startupDebugLog('[LAYOUT_AUDIT] flattenedInstanceCount', instances.length);
  return instances;
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
          gameState.overlayVisible = false;
        },
        onActive() {},
        onExit() { return null; },
      });
      layoutState.registerLayout({
        id: 'astralOverlay',
        allowedTransitions: ['combat'],
        onEnter() {
          gameState.overlayVisible = false;
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
  let heroSelectorImage = null;
  let gemFrameImages = [];
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
    startupDebugLog(`[BOARD] Grid bounds calculated: (${minX.toFixed(1)}, ${minY.toFixed(1)}) to (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
    return bounds;
  };
  function prepareCombatSetupFromInstances(layoutInstances, gameStateRef) {
    assertCombatLayoutDev('prepareCombatSetupFromInstances');
    gridBounds = calculateGridBounds(layoutInstances);
    if (gameStateRef && gridBounds) {
      gameStateRef.gridBounds = gridBounds;
    }
  }
  async function refreshCombatSessionFromDevTooling({ forceCombat = false, resetGame = false } = {}) {
    if (resetGame) {
      gameState.overlayVisible = false;
      const cfg = ensureDevToolingConfig();
      persistDevToolingConfig({ ...cfg, open: false });
      if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        window.location.reload();
        return true;
      }
      return false;
    }
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (forceCombat && activeLayoutId && activeLayoutId !== 'combat') {
      gameState.overlayVisible = false;
      await layoutState.requestLayoutChange('combat', 'dev-tool-refresh');
      return true;
    }
    if (!freshCombatBootstrapped || !Array.isArray(enemyRows) || !enemyRows.length) {
      return false;
    }
    gameState.overlayVisible = false;
    initEntities(enemyRows, instances);
    restoreHeroGemProgressFromStorage();
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
    state.globals.IsPlayerBusy = 0;
    state.globals.PendingSkillID = '';
    state.globals.DeferAdvance = 0;
    state.globals.ActionInProgress = 0;
    state.globals.PendingActor = 0;
    if (state.globals.BoardFillActive) {
      state.globals.CanPickGems = 0;
    } else {
      state.globals.CanPickGems = 1;
    }
    combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
    return true;
  }
  devToolingRefreshHandler = refreshCombatSessionFromDevTooling;
  async function loadC3ProjectAssets() {
    assertCombatLayoutDev('loadC3ProjectAssets');
    updateStartupLoadState({ active: true, phase: 'bootstrap', label: 'Loading layout data...', progress: 0.05 });
    runtimeLayouts = await fetchJson(assetUrl('layouts.json')) || {};
    layout = runtimeLayouts.layout || { name: 'runtime-fallback', layers: [] };
    startupDebugLog('[LAYOUT_AUDIT] topLevelKeys', Object.keys(layout || {}));
    startupDebugLog('[INIT] Layout loaded');
    assetsLayout = runtimeLayouts.assetsLayout || null;

    const project = runtimeLayouts.project || { viewportWidth: 360, viewportHeight: 640 };
    viewW = project && project.viewportWidth ? project.viewportWidth : 360;
    viewH = project && project.viewportHeight ? project.viewportHeight : 640;
    startupDebugLog('[INIT] Project viewport:', viewW, 'x', viewH);
    updateStartupLoadState({ phase: 'bootstrap', label: 'Preparing object types...', progress: 0.16 });

    instances = tryGetInstances(layout);
    startupDebugLog('[LAYOUT_AUDIT] instanceCount', Array.isArray(instances) ? instances.length : 0);
    const gemInstanceCount = Array.isArray(instances)
      ? instances.filter(i => i && i.type === 'Gem').length
      : 0;
    startupDebugLog('[LAYOUT_AUDIT] gemInstanceCount', gemInstanceCount);
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
    startupDebugLog('[INIT] Loaded', Object.keys(types).length, 'object types');
    updateStartupLoadState({ phase: 'bootstrap', label: 'Loading encounter data...', progress: 0.24 });

    const enemies = await fetchJson(assetUrl('enemies.json'));
    enemyRows = parseC2ArrayTable(enemies);
    state.globals.DevToolEnemyCatalog = [...new Set((enemyRows || []).map((row) => String(row?.name || row?.EnemyName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    gameState.baseSummary = summaryText(layout, types, enemies);
    out.textContent = gameState.baseSummary + '\n\nLoading images...';
    updateStartupLoadState({ phase: 'bootstrap', label: 'Loading critical visuals...', progress: 0.3 });

    images = {};
    enemySpriteImages = {};
    heroPortraitImages = {};
    heroSelectorImage = null;
    gemFrameImages = [];
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
            startupDebugLog(`[LOAD] SUCCESS: ${t} loaded from ${meta.imgPath}`);
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
      const gemLoads = Array.from({ length: 8 }, (_, i) => i).map(async (i) => {
        const imgPath = assetUrl(`images/gem-animation 1-${String(i).padStart(3, '0')}.png`);
        const img = await loadImage(imgPath);
        if (img) gemFrameImages[i] = img;
      });
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
        ...gemLoads,
        ...heroCapsuleLoads,
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
        startupDebugLog('[LOAD] Enemy_Sprite animations loaded:', Object.keys(enemySpriteImages).length);
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
    startupDebugLog('[INIT] Processing instances...');
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
          }
          state.globals.GamePhase = 'BOOTSTRAP';
          startupDebugLog('[INIT] Starting initialization...');
          await loadC3ProjectAssets();
          prepareCombatSetupFromInstances(instances, gameState);
          freshCombatBootstrapped = true;
          COMBAT_BOOTSTRAP_COMPLETE = true;
        }
        gateway.resume(freshCombatStart ? null : (resumeSnapshot || null));
        if (needsCombatSeed) {
          initEntities(enemyRows, instances);
          restoreHeroGemProgressFromStorage();
          assertCombatLayoutDev('StartRound');
          callFunctionWithContext(fnContext, 'StartRound');
          createGemBoard(gridBounds);
          combatSessionSeeded = true;
          updateStartupLoadState({ active: false, phase: 'runtime', label: 'Ready', progress: 1 });
          if (isGemDebugEnabled()) {
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
      allowedTransitions: ['combat', 'tomesLayout', 'artifactsLayout', 'mountsLayout', 'relicsLayout', 'petsLayout', 'homesteadLayout'],
      onEnter() {
        gameState.overlayVisible = false;
        gameState.mapLayout.panY = 0;
        gameState.mapLayout.tomesLocaleHit = null;
        gameState.mapLayout.artifactsLocaleHit = null;
        gameState.mapLayout.mountsLocaleHit = null;
        gameState.mapLayout.relicsLocaleHit = null;
        gameState.mapLayout.homesteadLocaleHit = null;
        gameState.mapLayout.closeHit = null;
        const drag = gameState.mapLayout.drag;
        drag.active = false;
        drag.pointerId = null;
        drag.lastX = 0;
        drag.lastY = 0;
        drag.moved = 0;
        console.log('[LAYOUT_PHASE1]', { stage: 'onEnter', transition: '1->map', trigger: 'map-click' });
      },
      onActive() {},
      onExit() { return null; },
    });
    layoutState.registerLayout({
      id: 'tomesLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        gameState.overlayVisible = false;
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
        gameState.overlayVisible = false;
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
        gameState.overlayVisible = false;
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
      id: 'relicsLayout',
      allowedTransitions: ['chestsLayout', 'combat'],
      onEnter() {
        gameState.overlayVisible = false;
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
        gameState.overlayVisible = false;
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
        gameState.overlayVisible = false;
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
        gameState.overlayVisible = false;
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
      allowedTransitions: ['combat', 'tomesLayout', 'artifactsLayout', 'mountsLayout', 'relicsLayout', 'petsLayout', 'evolutionLayout', 'homesteadLayout'],
      onEnter() {
        gameState.overlayVisible = false;
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
        gameState.overlayVisible = false;
        gameState.heroScreen.hitZones = null;
        normalizeHeroSelectionIndex();
      },
      onActive() {},
      onExit() {
        gameState.heroScreen.hitZones = null;
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
        gameState.overlayVisible = false;
        restorePartyToFullHP();
      },
      onActive() {},
      onExit() { return null; },
    });
    layoutState.registerLayout({
      id: 'idleFarmLayout',
      allowedTransitions: ['combat', 'storyMock'],
      onEnter() {
        gameState.overlayVisible = false;
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
      console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '1->2', trigger: 'astral-flow-click' });
      await layoutState.requestLayoutChange('idleFarmLayout', 'nav-astral-flow');
      return;
    }
    if (label === 'Hero') {
      if (layoutState.getActiveLayoutId() !== 'combat') {
        return;
      }
      gameState.overlayVisible = false;
      await layoutState.requestLayoutChange('heroLayout', 'nav-hero');
      return;
    }
    if (label === 'Vault' || label === 'Mission') {
      if (layoutState.getActiveLayoutId() !== 'combat') {
        return;
      }
      gameState.overlayVisible = false;
      await layoutState.requestLayoutChange('chestsLayout', 'nav-chests');
      return;
    }
    gameState.overlayVisible = true;
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
    debugLayoutLog('[Harness] Enabled');
  }

  await layoutState.activateInitialLayout('storyMock');
  ensureStartupPreload().catch(() => {});

  const layoutW = viewW;
  const layoutH = viewH;
  let layoutScale = 1;
  let layoutOffsetX = 0;
  let layoutOffsetY = 0;
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function resizeCanvas() {
    const pad = 16;
    const h = Math.max(320, window.innerHeight - pad);
    const w = Math.round(h * (layoutW / layoutH));
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.height = `${h}px`;
    canvas.style.width = `${w}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scaleX = (canvas.width / dpr) / layoutW;
    const scaleY = (canvas.height / dpr) / layoutH;
    layoutScale = Math.min(scaleX, scaleY);
    layoutOffsetX = ((canvas.width / dpr) - layoutW * layoutScale) / 2;
    layoutOffsetY = ((canvas.height / dpr) - layoutH * layoutScale) / 2;
  }
  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

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

    const buffTypes = new Set(['buffIcon1', 'buffIcon2', 'buffIcon3', 'buffIcon4']);
    const buffInstances = (instances || []).filter(ins => ins && buffTypes.has(ins.type) && ins.world);
    const buffBottom = buffInstances.length
      ? Math.max(...buffInstances.map(ins => {
          const p = worldToCanvas(ins.world.x || 0, ins.world.y || 0);
          const h = Number(ins.world.height || 0) * layoutScale;
          const oy = Number(ins.world.originY != null ? ins.world.originY : 0.5);
          return p.y - (h * oy) + h;
        }))
      : (viewTop + Math.max(240, Math.round(250 * layoutScale)));

    const grid = gameState.gridBounds || {
      minX: boardGeometry.gx,
      minY: boardGeometry.gy,
      maxX: boardGeometry.gx + (boardGeometry.cols * boardGeometry.cellSize + (boardGeometry.cols - 1) * boardGeometry.gap),
      maxY: boardGeometry.gy + (boardGeometry.rows * boardGeometry.cellSize + (boardGeometry.rows - 1) * boardGeometry.gap),
    };
    const gridTop = layoutOffsetY + Number(grid.minY || 0) * layoutScale;
    const topMargin = Math.max(8, Math.round(10 * layoutScale));
    const bottomMargin = Math.max(8, Math.round(10 * layoutScale));
    const slotY = buffBottom + topMargin;
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
        gameState.overlayVisible = false;
        debugLayoutLog('[Harness] storyMock active');
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
        gameState.overlayVisible = false;
        restorePartyToFullHP();
        debugLayoutLog('[Harness] town active');
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
        gameState.overlayVisible = false;
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
    debugLayoutLog('[Harness] Layouts registered: storyMock, town, astralOverlay');

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
      startupDebugLog('[DEBUG_RENDER_SUMMARY]', {
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

    out.textContent = `🎮 Puzzle RPG\n\n✓ Game loaded\n${rendered.length} total objects loaded`;
  }
  rebuildRenderedCache();

  // Track last overlay state for logging only on change
  let lastOverlayState = null;

  function drawHarnessLayoutTakeover(layoutId) {
    if (layoutId === 'mapLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const panX = Number(gameState.mapLayout.panX || 0);
      gameState.mapLayout.panY = 0;
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      ctx.fillStyle = '#1f2d3d';
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const drawParallax = (img, scale, alpha) => {
        if (!img) return;
        const w = img.width * scale;
        const h = img.height * scale;
        const halfSpillX = Math.max(0, (w - viewWidth) / 2);
        const minPanX = -halfSpillX;
        const maxPanX = halfSpillX;
        gameState.mapLayout.panBounds = { minX: minPanX, maxX: maxPanX };
        const clampedPanX = Math.max(minPanX, Math.min(maxPanX, panX));
        gameState.mapLayout.panX = clampedPanX;
        const x = ((viewWidth - w) / 2) + clampedPanX;
        const y = 0;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
        gameState.mapLayout.lastRender = {
          fitMode: 'vertical',
          viewWidth,
          viewHeight,
          drawW: w,
          drawH: h,
          drawX: x,
          drawY: y,
          panX: clampedPanX,
          panY: 0,
          panBounds: { minX: minPanX, maxX: maxPanX },
          towerOverlayRendered: false,
        };
      };
      const verticalFitScale = mapBackgroundImage ? (viewHeight / mapBackgroundImage.height) : 1;
      drawParallax(mapBackgroundImage, verticalFitScale, 0.95);

      const meterPad = 14;
      const meterW = Math.max(180, viewWidth - (meterPad * 2));
      const meterH = 16;
      const meterX = meterPad;
      const meterY = 14;
      const pct = Math.max(0, Math.min(1, Number(gameState.mapLayout.warMeter || 0)));
      ctx.fillStyle = '#0f1722';
      ctx.fillRect(meterX, meterY, meterW, meterH);
      ctx.fillStyle = '#cf3d2e';
      ctx.fillRect(meterX + 2, meterY + 2, Math.max(0, (meterW - 4) * pct), meterH - 4);
      ctx.strokeStyle = '#d6dbe3';
      ctx.lineWidth = 1;
      ctx.strokeRect(meterX, meterY, meterW, meterH);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`War Meter ${Math.round(pct * 100)}%`, meterX + 6, meterY + 12);
      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, '#111');
      gameState.mapLayout.closeHit = close;
      gameState.mapLayout.tomesLocaleHit = null;
      gameState.mapLayout.artifactsLocaleHit = null;
      gameState.mapLayout.mountsLocaleHit = null;
      gameState.mapLayout.relicsLocaleHit = null;
      gameState.mapLayout.homesteadLocaleHit = null;
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 14px Arial';
      ctx.fillText('Map Layout (drag to pan)', 14, viewHeight - 18);
      return;
    }
    if (layoutId === 'tomesLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const palette = {
        bg0: '#1f1629',
        bg1: '#372342',
        panel: '#f0e7d1',
        panelEdge: '#c1b28f',
        ink: '#2b1e12',
        muted: '#6a5d49',
        selected: '#ffe7a6',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panelPad = 14;
      const panel = {
        x: panelPad,
        y: 16,
        w: Math.max(260, viewWidth - panelPad * 2),
        h: Math.max(360, viewHeight - 34),
      };
      roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);

      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#ece3cb', '#baa980');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 18px Arial';
      ctx.fillText('Tomes Gallery (Scaffold)', panel.x + 14, panel.y + 58);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 11px Arial';
      ctx.fillText('Discovery source: map locale. Buff and optional enemy debuff metadata only.', panel.x + 14, panel.y + 76);

      const gallery = Array.isArray(gameState.tomesLayout.gallery) ? gameState.tomesLayout.gallery : [];
      const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.tomesLayout.selectedIndex || 0)));
      const cardHitZones = [];
      let cursorY = panel.y + 90;
      const cardGap = 8;
      for (let i = 0; i < gallery.length; i += 1) {
        const tome = gallery[i] || {};
        const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
        const discovered = Boolean(tome.discovered);
        const buff = tome.buffSlot || null;
        const debuff = tome.enemyDebuffSlot || null;
        roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#f7f1e2', '#c9b88f');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 13px Arial';
        ctx.fillText(discovered ? String(tome.name || 'Unknown Tome') : 'Locked Tome', card.x + 10, card.y + 20);
        ctx.fillStyle = palette.muted;
        ctx.font = '600 10px Arial';
        ctx.fillText(`Rarity: ${String(tome.rarity || 'Common')}`, card.x + 10, card.y + 35);
        const buffText = buff
          ? `${String(buff.stat || '')} ${String(buff.mode || '')} ${Number(buff.value || 0)} / ${Number(buff.cadenceTurns || 0)}t`
          : 'No buff slot';
        const debuffText = debuff
          ? `${String(debuff.stat || '')} ${String(debuff.mode || '')} ${Number(debuff.value || 0)}`
          : 'No enemy debuff';
        ctx.fillText(`Buff: ${buffText}`, card.x + 136, card.y + 20);
        ctx.fillText(`Debuff: ${debuffText}`, card.x + 136, card.y + 35);
        cardHitZones.push(card);
        cursorY += card.h + cardGap;
      }

      gameState.tomesLayout.hitZones = {
        close,
        combatBack,
        cards: cardHitZones,
      };
      return;
    }
    if (layoutId === 'artifactsLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const palette = {
        bg0: '#0e1a24',
        bg1: '#1b2f43',
        panel: '#e8edf2',
        panelEdge: '#a7b7c8',
        ink: '#0f2336',
        muted: '#4f6477',
        selected: '#d8e9ff',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panelPad = 14;
      const panel = {
        x: panelPad,
        y: 16,
        w: Math.max(260, viewWidth - panelPad * 2),
        h: Math.max(360, viewHeight - 34),
      };
      roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#d9e4ef', '#94a9bc');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 18px Arial';
      ctx.fillText('Artifacts Gallery (Scaffold)', panel.x + 14, panel.y + 58);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 11px Arial';
      ctx.fillText('Combat-accessory passives, no direct visible combat effects yet.', panel.x + 14, panel.y + 76);

      const gallery = Array.isArray(gameState.artifactsLayout.gallery) ? gameState.artifactsLayout.gallery : [];
      const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.artifactsLayout.selectedIndex || 0)));
      const cardHitZones = [];
      let cursorY = panel.y + 90;
      const cardGap = 8;
      for (let i = 0; i < gallery.length; i += 1) {
        const artifact = gallery[i] || {};
        const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
        const discovered = Boolean(artifact.discovered);
        const passive = artifact.passiveHook || null;
        roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#eef3f8', '#bfd0df');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 13px Arial';
        ctx.fillText(discovered ? String(artifact.name || 'Unknown Artifact') : 'Locked Artifact', card.x + 10, card.y + 20);
        ctx.fillStyle = palette.muted;
        ctx.font = '600 10px Arial';
        ctx.fillText(`Rarity: ${String(artifact.rarity || 'Common')}`, card.x + 10, card.y + 35);
        const passiveText = passive
          ? `${String(passive.key || '')} ${String(passive.mode || '')} ${Number(passive.value || 0)} / ${Number(passive.cadenceTurns || 0)}t`
          : 'No passive hook';
        ctx.fillText(`Passive: ${passiveText}`, card.x + 136, card.y + 20);
        ctx.fillText(`Visible FX: ${artifact.visibleCombatFx ? 'Yes' : 'No'}`, card.x + 136, card.y + 35);
        cardHitZones.push(card);
        cursorY += card.h + cardGap;
      }
      gameState.artifactsLayout.hitZones = {
        close,
        combatBack,
        cards: cardHitZones,
      };
      return;
    }
    if (layoutId === 'mountsLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const palette = {
        bg0: '#132219',
        bg1: '#233728',
        panel: '#edf2e8',
        panelEdge: '#b9c9ad',
        ink: '#1c2f1f',
        muted: '#5b6f5e',
        selected: '#dff1d2',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panelPad = 14;
      const panel = {
        x: panelPad,
        y: 16,
        w: Math.max(260, viewWidth - panelPad * 2),
        h: Math.max(360, viewHeight - 34),
      };
      roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#deebd5', '#9bb28b');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 18px Arial';
      ctx.fillText('Mounts Gallery (Scaffold)', panel.x + 14, panel.y + 58);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 11px Arial';
      ctx.fillText('Sibling progression gallery with vault-compatibility metadata hooks.', panel.x + 14, panel.y + 76);

      const gallery = Array.isArray(gameState.mountsLayout.gallery) ? gameState.mountsLayout.gallery : [];
      const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.mountsLayout.selectedIndex || 0)));
      const cardHitZones = [];
      let cursorY = panel.y + 90;
      const cardGap = 8;
      for (let i = 0; i < gallery.length; i += 1) {
        const mount = gallery[i] || {};
        const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
        const discovered = Boolean(mount.discovered);
        const passive = mount.passiveHook || null;
        roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#f3f8ef', '#c7d8bb');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 13px Arial';
        ctx.fillText(discovered ? String(mount.name || 'Unknown Mount') : 'Locked Mount', card.x + 10, card.y + 20);
        ctx.fillStyle = palette.muted;
        ctx.font = '600 10px Arial';
        ctx.fillText(`Rarity: ${String(mount.rarity || 'Common')}`, card.x + 10, card.y + 35);
        const passiveText = passive
          ? `${String(passive.key || '')} ${String(passive.mode || '')} ${Number(passive.value || 0)} / ${Number(passive.cadenceTurns || 0)}t`
          : 'No passive hook';
        ctx.fillText(`Passive: ${passiveText}`, card.x + 136, card.y + 20);
        ctx.fillText(`Vault Tier: ${Number(mount.vaultCompatibilityTier || 0)}`, card.x + 136, card.y + 35);
        cardHitZones.push(card);
        cursorY += card.h + cardGap;
      }
      gameState.mountsLayout.hitZones = {
        close,
        combatBack,
        cards: cardHitZones,
      };
      return;
    }
    if (layoutId === 'relicsLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const palette = {
        bg0: '#251532',
        bg1: '#3b2251',
        panel: '#f2e9f7',
        panelEdge: '#c3a8d3',
        ink: '#381d49',
        muted: '#705683',
        selected: '#ead7f5',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panelPad = 14;
      const panel = {
        x: panelPad,
        y: 16,
        w: Math.max(260, viewWidth - panelPad * 2),
        h: Math.max(360, viewHeight - 34),
      };
      roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#eadff2', '#b796cb');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 18px Arial';
      ctx.fillText('Relics Gallery (Scaffold)', panel.x + 14, panel.y + 58);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 11px Arial';
      ctx.fillText('Sibling progression gallery with deterministic relic metadata hooks.', panel.x + 14, panel.y + 76);

      const gallery = Array.isArray(gameState.relicsLayout.gallery) ? gameState.relicsLayout.gallery : [];
      const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.relicsLayout.selectedIndex || 0)));
      const cardHitZones = [];
      let cursorY = panel.y + 90;
      const cardGap = 8;
      for (let i = 0; i < gallery.length; i += 1) {
        const relic = gallery[i] || {};
        const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
        const discovered = Boolean(relic.discovered);
        const passive = relic.passiveHook || null;
        roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#f7f0fb', '#ceb9da');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 13px Arial';
        ctx.fillText(discovered ? String(relic.name || 'Unknown Relic') : 'Locked Relic', card.x + 10, card.y + 20);
        ctx.fillStyle = palette.muted;
        ctx.font = '600 10px Arial';
        ctx.fillText(`Rarity: ${String(relic.rarity || 'Common')}`, card.x + 10, card.y + 35);
        const passiveText = passive
          ? `${String(passive.key || '')} ${String(passive.mode || '')} ${Number(passive.value || 0)}`
          : 'No passive hook';
        ctx.fillText(`Passive: ${passiveText}`, card.x + 136, card.y + 20);
        ctx.fillText(`Set: ${String(relic.setTag || 'none')}`, card.x + 136, card.y + 35);
        cardHitZones.push(card);
        cursorY += card.h + cardGap;
      }
      gameState.relicsLayout.hitZones = {
        close,
        combatBack,
        cards: cardHitZones,
      };
      return;
    }
    if (layoutId === 'petsLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const palette = {
        bg0: '#152314',
        bg1: '#314128',
        panel: '#eef4e7',
        panelEdge: '#b8c9a8',
        ink: '#243119',
        muted: '#5f7051',
        selected: '#dcecc9',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panelPad = 14;
      const panel = {
        x: panelPad,
        y: 16,
        w: Math.max(260, viewWidth - panelPad * 2),
        h: Math.max(360, viewHeight - 34),
      };
      roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#ddead0', '#9cb581');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 18px Arial';
      ctx.fillText('Pets Gallery (Scaffold)', panel.x + 14, panel.y + 58);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 11px Arial';
      ctx.fillText('Companion progression shell with stable milestone and deployment metadata.', panel.x + 14, panel.y + 76);

      const gallery = Array.isArray(gameState.petsLayout.gallery) ? gameState.petsLayout.gallery : [];
      const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.petsLayout.selectedIndex || 0)));
      const cardHitZones = [];
      let cursorY = panel.y + 90;
      const cardGap = 8;
      for (let i = 0; i < gallery.length; i += 1) {
        const pet = gallery[i] || {};
        const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
        const discovered = Boolean(pet.discovered);
        const passive = pet.passiveHook || null;
        roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#f4f8ef', '#c8d7bb');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 13px Arial';
        ctx.fillText(discovered ? String(pet.name || 'Unknown Pet') : 'Locked Pet', card.x + 10, card.y + 20);
        ctx.fillStyle = palette.muted;
        ctx.font = '600 10px Arial';
        ctx.fillText(`Rarity: ${String(pet.rarity || 'Common')}`, card.x + 10, card.y + 35);
        const passiveText = passive
          ? `${String(passive.key || '')} ${String(passive.mode || '')} ${Number(passive.value || 0)} / ${Number(passive.cadenceTurns || 0)}t`
          : 'No passive hook';
        ctx.fillText(`Passive: ${passiveText}`, card.x + 136, card.y + 20);
        ctx.fillText(`Milestones: ${Number(pet.milestoneSlots || 0)} · Deploy: ${Number(pet.deploymentSlots || 0)}`, card.x + 136, card.y + 35);
        cardHitZones.push(card);
        cursorY += card.h + cardGap;
      }
      gameState.petsLayout.hitZones = {
        close,
        combatBack,
        cards: cardHitZones,
      };
      return;
    }
    if (layoutId === 'idleFarmLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const layout = gameState.idleFarmLayout || {};
      const nowSec = performance.now() / 1000;
      const emissionState = updateIdleFarmEmissions(nowSec) || startIdleFarmEmissions(nowSec);
      const session = updateIdleFarmSession(nowSec) || ensureIdleFarmSession(nowSec);
      const rewards = layout.rewardLedger || {
        unclaimedEnergy: 0,
        claimedEnergyTotal: 0,
        unclaimedTokens: { SAND: 0, BONE_CHIP: 0, SLIME: 0, HORN: 0, SHELL: 0 },
        claimedTokensTotal: { SAND: 0, BONE_CHIP: 0, SLIME: 0, HORN: 0, SHELL: 0 },
      };
      const palette = {
        bg0: '#120f0d',
        bg1: '#302117',
        panel: '#efe2cb',
        panelEdge: '#b99b6b',
        ink: '#2d1d12',
        muted: '#715642',
        accent: '#d86d2f',
        ally: '#8ecf78',
        enemy: '#da7c6f',
        battle0: '#3c2a1f',
        battle1: '#7d5838',
        ground: '#c39a63',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panel = { x: 14, y: 16, w: Math.max(280, viewWidth - 28), h: Math.max(360, viewHeight - 34) };
      roundRect(panel.x, panel.y, panel.w, panel.h, 16, palette.panel, palette.panelEdge);

      const restartBtn = { x: panel.x + 12, y: panel.y + 12, w: 92, h: 28 };
      const combatBack = { x: panel.x + panel.w - 232, y: panel.y + 12, w: 108, h: 28 };
      const baseBack = { x: panel.x + panel.w - 116, y: panel.y + 12, w: 104, h: 28 };
      roundRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, 8, '#efe5cf', '#b89b68');
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 8, '#e6dcc8', '#a78f65');
      roundRect(baseBack.x, baseBack.y, baseBack.w, baseBack.h, 8, '#e6dcc8', '#a78f65');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Restart Run', restartBtn.x + restartBtn.w / 2, restartBtn.y + 18);
      ctx.fillText('To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);
      ctx.fillText('To Camp', baseBack.x + baseBack.w / 2, baseBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 20px Arial';
      ctx.fillText('Idle War Effort', panel.x + 14, panel.y + 60);

      const battleFrame = { x: panel.x + 12, y: panel.y + 88, w: panel.w - 24, h: Math.min(panel.h - 178, Math.floor((panel.w - 24) * 9 / 16)) };
      roundRect(battleFrame.x, battleFrame.y, battleFrame.w, battleFrame.h, 14, '#1e1510', '#7c5a37');
      const battleGrad = ctx.createLinearGradient(0, battleFrame.y, 0, battleFrame.y + battleFrame.h);
      battleGrad.addColorStop(0, palette.battle0);
      battleGrad.addColorStop(1, palette.battle1);
      ctx.fillStyle = battleGrad;
      ctx.fillRect(battleFrame.x + 2, battleFrame.y + 2, battleFrame.w - 4, battleFrame.h - 4);
      ctx.fillStyle = palette.ground;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(battleFrame.x + 2, battleFrame.y + battleFrame.h * 0.72, battleFrame.w - 4, battleFrame.h * 0.26);
      ctx.globalAlpha = 1;

      const heroes = Array.isArray(session.heroes) ? session.heroes : [];
      const easeInCubic = (t) => t * t * t;
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      const easeInOutCubic = (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const getLaneAction = (laneIndex) => {
        const actions = Array.isArray(session.currentActions) ? session.currentActions : [];
        const action = actions[laneIndex] || null;
        if (!action) return { action: null, t: 0 };
        const age = Math.max(0, nowSec - Number(action.startSec || 0));
        const duration = Math.max(0.001, Number((action.endSec - action.startSec) || 1.05));
        return { action, t: Math.max(0, Math.min(1, age / duration)) };
      };
      const heroBaseW = battleFrame.w * 0.18;
      const heroBaseH = heroBaseW * 0.7;
      const computeLungeOffset = (t, direction, lungeDist) => {
        if (!(t >= 0 && t <= 1)) return 0;
        if (t < 0.18) return -direction * 6 * easeInCubic(t / 0.18);
        if (t < 0.62) return (-direction * 6) + (direction * (lungeDist + 6) * easeOutCubic((t - 0.18) / 0.44));
        return direction * lungeDist * (1 - easeInOutCubic((t - 0.62) / 0.38));
      };
      const computeIntroOffset = (elapsedSec, direction, distance, durationSec = 1.2) => {
        const t = Math.max(0, Math.min(1, Number(elapsedSec || 0) / Math.max(0.001, durationSec)));
        return direction * distance * (1 - easeOutCubic(t));
      };
      const heroEntryTimes = Array.isArray(session.heroEnterAtSec) ? session.heroEnterAtSec : [];
      const heroSlots = [
        { x: battleFrame.x + battleFrame.w * 0.12, y: battleFrame.y + battleFrame.h * 0.4 - heroBaseH + heroBaseH / 3 },
        { x: battleFrame.x + battleFrame.w * 0.18, y: battleFrame.y + battleFrame.h * 0.68 + heroBaseH / 10 },
      ];
      heroes.slice(0, 2).forEach((hero, idx) => {
        const heroEnterAtSec = Number(heroEntryTimes[idx] ?? session.startedAtSec ?? nowSec);
        if (nowSec < heroEnterAtSec) return;
        const lane = getLaneAction(idx);
        const currentAction = lane.action;
        const actionT = lane.t;
        const slot = heroSlots[idx];
        const portrait = heroCapsuleImages[String(hero.baseName || hero.displayName || '')] || null;
        const isStriking = !!currentAction && String(currentAction.actorSide || '') === 'hero' && Number(currentAction.heroIndex || 0) === idx;
        const isHit = !!currentAction
          && String(currentAction.actorSide || '') === 'enemy'
          && Number(currentAction.heroIndex || 0) === idx
          && actionT >= 0.28
          && actionT <= 0.62;
        const heroW = heroBaseW;
        const heroH = heroBaseH;
        const heroIntroOffset = computeIntroOffset(nowSec - heroEnterAtSec, -1, Math.max(48, heroBaseW * 0.75), 1.25);
        const offsetX = isStriking ? computeLungeOffset(actionT, 1, 22) : 0;
        const drawX = slot.x - heroW / 2 + heroIntroOffset + offsetX;
        const drawY = slot.y - heroH / 2;
        if (portrait) {
          ctx.drawImage(portrait, drawX, drawY, heroW, heroH);
          if (isHit) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.filter = 'brightness(0)';
            ctx.drawImage(portrait, drawX, drawY, heroW, heroH);
            ctx.restore();
          }
        } else {
          roundRect(drawX, drawY, heroW, heroH, 12, '#d7ead0', '#95b48a');
          if (isHit) {
            ctx.save();
            ctx.globalAlpha = 0.32;
            roundRect(drawX, drawY, heroW, heroH, 12, '#ffffff', '#ffffff');
            ctx.restore();
          }
        }
      });

      const enemySlotsState = Array.isArray(session.enemies) ? session.enemies.slice(0, 2) : [];
      const enemyAnchors = [
        { x: battleFrame.x + battleFrame.w * 0.76, y: heroSlots[0].y },
        { x: battleFrame.x + battleFrame.w * 0.81, y: heroSlots[1].y },
      ];
      if (enemySlotsState.length) {
        enemySlotsState.forEach((enemy, idx) => {
          if (!enemy || !enemy.alive) return;
          const lane = getLaneAction(idx);
          const currentAction = lane.action;
          const actionT = lane.t;
          const enemySprite = enemy ? enemySpriteImages[String(enemy.name || '').toLowerCase()] : null;
          const anchor = enemyAnchors[idx] || enemyAnchors[enemyAnchors.length - 1];
          const enemyW = battleFrame.w * (idx === 0 ? 0.16 : 0.14);
          const enemyH = enemyW * 1.05;
          const isAttacking = !!currentAction && String(currentAction.actorSide || '') === 'enemy' && String(currentAction.enemyId || '') === String(enemy.enemyId || '');
          const isHit = !!currentAction
            && String(currentAction.actorSide || '') === 'hero'
            && String(currentAction.enemyId || '') === String(enemy.enemyId || '')
            && actionT >= 0.28
            && actionT <= 0.62;
          const shiftX = isAttacking ? computeLungeOffset(actionT, -1, 34) : 0;
          const enemyIntroOffset = computeIntroOffset(nowSec - Number(enemy.spawnedAtSec || nowSec), 1, Math.max(52, enemyW * 0.8), 0.95);
          const drawX = anchor.x - enemyW / 2 + enemyIntroOffset + shiftX;
          const drawY = anchor.y - enemyH / 2;
          if (enemySprite) {
            ctx.drawImage(enemySprite, drawX, drawY, enemyW, enemyH);
            if (isHit) {
              ctx.save();
              ctx.globalAlpha = 0.3;
              ctx.filter = 'brightness(0)';
              ctx.drawImage(enemySprite, drawX, drawY, enemyW, enemyH);
              ctx.restore();
            }
          } else {
            roundRect(drawX, drawY, enemyW, enemyH, 12, '#f0cbc3', '#b97d72');
            if (isHit) {
              ctx.save();
              ctx.globalAlpha = 0.32;
              roundRect(drawX, drawY, enemyW, enemyH, 12, '#ffffff', '#ffffff');
              ctx.restore();
            }
          }
        });
      }

      const rewardStrip = { x: panel.x + 12, y: battleFrame.y + battleFrame.h + 14, w: panel.w - 24, h: panel.h - ((battleFrame.y + battleFrame.h + 14) - panel.y) - 12 };
      roundRect(rewardStrip.x, rewardStrip.y, rewardStrip.w, rewardStrip.h, 12, '#f7efdf', '#d2bea0');
      const chipGap = 10;
      const chipColumns = 3;
      const chipW = Math.max(84, Math.floor((rewardStrip.w - 24 - chipGap * (chipColumns - 1)) / chipColumns));
      const chipH = 34;
      const chipY = rewardStrip.y + 14;
      const chips = [
        { label: 'Energy', value: Number(rewards.unclaimedEnergy || 0), fill: '#f4d38d' },
        { label: 'Sand', value: Number(rewards.unclaimedTokens?.SAND || 0), fill: '#e9d1a8' },
        { label: 'Bone Chips', value: Number(rewards.unclaimedTokens?.BONE_CHIP || 0), fill: '#e4d9cc' },
        { label: 'Slime', value: Number(rewards.unclaimedTokens?.SLIME || 0), fill: '#d4ebc9' },
        { label: 'Horn', value: Number(rewards.unclaimedTokens?.HORN || 0), fill: '#e7cfaa' },
        { label: 'Shell', value: Number(rewards.unclaimedTokens?.SHELL || 0), fill: '#d6e3ea' },
      ];
      chips.forEach((chip, idx) => {
        const col = idx % chipColumns;
        const row = Math.floor(idx / chipColumns);
        const rect = {
          x: rewardStrip.x + 12 + col * (chipW + chipGap),
          y: chipY + row * (chipH + 8),
          w: chipW,
          h: chipH,
        };
        roundRect(rect.x, rect.y, rect.w, rect.h, 10, chip.fill, '#b89b68');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(chip.label || ''), rect.x + rect.w / 2, rect.y + 14);
        ctx.font = '700 14px Arial';
        ctx.fillText(String(chip.value || 0), rect.x + rect.w / 2, rect.y + 28);
      });
      const collectBtn = { x: rewardStrip.x + rewardStrip.w - 118, y: rewardStrip.y + rewardStrip.h - 38, w: 104, h: 24 };
      const hasUnclaimedRewards = Number(rewards.unclaimedEnergy || 0) > 0 || Object.values(rewards.unclaimedTokens || {}).some((value) => Number(value || 0) > 0);
      roundRect(collectBtn.x, collectBtn.y, collectBtn.w, collectBtn.h, 8, hasUnclaimedRewards ? '#f8ddb0' : '#efe5cf', '#b89b68');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Collect', collectBtn.x + collectBtn.w / 2, collectBtn.y + 16);
      ctx.textAlign = 'left';
      ctx.fillStyle = palette.muted;
      ctx.font = '600 10px Arial';
      const emissionElapsedSec = Math.floor(Number(emissionState?.elapsedSec || 0));
      ctx.fillText(`Elapsed ${emissionElapsedSec}s · idle emission every ~18s`, rewardStrip.x + 12, rewardStrip.y + rewardStrip.h - 12);

      gameState.idleFarmLayout.hitZones = {
        restartBtn,
        collectBtn,
        combatBack,
        baseBack,
      };
      drawHUD();
      return;
    }
    if (layoutId === 'evolutionLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const palette = {
        bg0: '#15203a',
        bg1: '#233b64',
        panel: '#eef3fb',
        panelEdge: '#aec0df',
        ink: '#233759',
        muted: '#627999',
        selected: '#d9e6fb',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panelPad = 14;
      const panel = {
        x: panelPad,
        y: 16,
        w: Math.max(260, viewWidth - panelPad * 2),
        h: Math.max(360, viewHeight - 34),
      };
      roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#dde8f9', '#97add0');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 18px Arial';
      ctx.fillText('Evolution Tree (Scaffold)', panel.x + 14, panel.y + 58);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 11px Arial';
      ctx.fillText('Seven-step soft-currency ladder with future hero research gate seams.', panel.x + 14, panel.y + 76);

      const ladder = Array.isArray(gameState.evolutionLayout.ladder) ? gameState.evolutionLayout.ladder : [];
      const selectedLevel = Math.max(0, Math.min(ladder.length - 1, Number(gameState.evolutionLayout.selectedLevel || 0)));
      const cardHitZones = [];
      let cursorY = panel.y + 90;
      const cardGap = 8;
      for (let i = 0; i < ladder.length; i += 1) {
        const step = ladder[i] || {};
        const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 52 };
        roundRect(card.x, card.y, card.w, card.h, 10, i === selectedLevel ? palette.selected : '#f5f8fe', '#c1cfe4');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 12px Arial';
        ctx.fillText(`Lv.${Number(step.level || i + 1)} · ${String(step.stat || 'Stat')}`, card.x + 10, card.y + 18);
        ctx.fillStyle = palette.muted;
        ctx.font = '600 10px Arial';
        ctx.fillText(String(step.bonusText || 'Placeholder bonus'), card.x + 10, card.y + 34);
        ctx.fillText(
          `${String(step.softCurrency || 'Currency')} ${Number(step.cost || 0)} · ${String(step.status || 'preview-open')}`,
          card.x + 182,
          card.y + 34,
        );
        cardHitZones.push(card);
        cursorY += card.h + cardGap;
      }

      const gates = Array.isArray(gameState.evolutionLayout.researchGates) ? gameState.evolutionLayout.researchGates : [];
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.fillText('Future Skill-Research Gates', panel.x + 14, cursorY + 16);
      ctx.fillStyle = palette.muted;
      ctx.font = '600 10px Arial';
      gates.forEach((gate, idx) => {
        ctx.fillText(
          `${String(gate.hero || 'Hero')} · ${String(gate.node || 'Node')} · unlock Lv.${Number(gate.unlockLevel || 0)} · ${String(gate.state || 'future-research')}`,
          panel.x + 14,
          cursorY + 34 + (idx * 14),
        );
      });

      gameState.evolutionLayout.hitZones = {
        close,
        combatBack,
        cards: cardHitZones,
      };
      return;
    }
    if (layoutId === 'homesteadLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const palette = {
        bg0: '#1f2f1c',
        bg1: '#31472d',
        panel: '#eef3e5',
        panelEdge: '#b2c3a4',
        ink: '#25321f',
        muted: '#64745a',
        selected: '#dce9cc',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panelPad = 14;
      const panel = {
        x: panelPad,
        y: 16,
        w: Math.max(260, viewWidth - panelPad * 2),
        h: Math.max(360, viewHeight - 34),
      };
      roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#e1ead6', '#94a985');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 18px Arial';
      ctx.fillText('Homestead Builder (Scaffold)', panel.x + 14, panel.y + 58);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 11px Arial';
      ctx.fillText('Lore-safe scene shell for future building/emitter systems.', panel.x + 14, panel.y + 76);

      const scene = gameState.homesteadLayout.scene || { slots: [], placeholderEmissions: [] };
      const slots = Array.isArray(scene.slots) ? scene.slots : [];
      const selectedSlot = Math.max(0, Math.min(slots.length - 1, Number(gameState.homesteadLayout.selectedSlot || 0)));
      const slotHitZones = [];
      let cursorY = panel.y + 90;
      const cardGap = 8;
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i] || {};
        const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 52 };
        roundRect(card.x, card.y, card.w, card.h, 10, i === selectedSlot ? palette.selected : '#f4f8ef', '#c4d2b8');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 12px Arial';
        ctx.fillText(String(slot.id || `slot-${i + 1}`), card.x + 10, card.y + 18);
        ctx.fillStyle = palette.muted;
        ctx.font = '600 10px Arial';
        ctx.fillText(`Type: ${String(slot.kind || 'unknown')}`, card.x + 10, card.y + 34);
        ctx.fillText(`State: ${String(slot.buildState || 'empty')} (${slot.unlocked ? 'unlocked' : 'locked'})`, card.x + 170, card.y + 34);
        slotHitZones.push(card);
        cursorY += card.h + cardGap;
      }
      const emissions = Array.isArray(scene.placeholderEmissions) ? scene.placeholderEmissions : [];
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.fillText('Placeholder Emissions', panel.x + 14, cursorY + 16);
      ctx.fillStyle = palette.muted;
      ctx.font = '600 10px Arial';
      emissions.forEach((entry, idx) => {
        ctx.fillText(
          `${String(entry.key || 'unknown')}: +${Number(entry.value || 0)} every ${Number(entry.cadenceSeconds || 0)}s`,
          panel.x + 14,
          cursorY + 34 + (idx * 14),
        );
      });
      gameState.homesteadLayout.hitZones = {
        close,
        combatBack,
        slots: slotHitZones,
      };
      return;
    }
    if (layoutId === 'chestsLayout') {
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const palette = {
        bg0: '#2a1f0e',
        bg1: '#4a3820',
        panel: '#f4ecd6',
        panelEdge: '#c7b489',
        ink: '#3c2a12',
        muted: '#7b6641',
        selected: '#f1ddad',
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
      grad.addColorStop(0, palette.bg0);
      grad.addColorStop(1, palette.bg1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const panelPad = 14;
      const panel = {
        x: panelPad,
        y: 16,
        w: Math.max(260, viewWidth - panelPad * 2),
        h: Math.max(360, viewHeight - 34),
      };
      roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
      const close = getHeroStyleCloseRect(viewWidth, viewHeight);
      drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
      const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
      roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#efe3c4', '#b89f6f');
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = palette.ink;
      ctx.font = '700 18px Arial';
      ctx.fillText('Vault', panel.x + 14, panel.y + 58);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 11px Arial';
      ctx.fillText('Tier tabs and dopamine-progress reward shell.', panel.x + 14, panel.y + 76);

      const retentionButtons = Array.isArray(gameState.chestsLayout.retentionButtons)
        ? gameState.chestsLayout.retentionButtons
        : [];
      const retentionHitZones = [];
      const retentionAreaTop = panel.y + 88;
      const retentionBtnH = 36;
      const retentionGap = 8;
      let retentionY = retentionAreaTop;
      for (const entry of retentionButtons) {
        const rect = { x: panel.x + 12, y: retentionY, w: panel.w - 24, h: retentionBtnH };
        roundRect(rect.x, rect.y, rect.w, rect.h, 8, String(entry.fill || '#f3ddaa'), String(entry.stroke || '#8d6d2a'));
        ctx.fillStyle = String(entry.text || '#2f2412');
        ctx.font = '700 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(String(entry.title || ''), rect.x + 10, rect.y + 16);
        ctx.font = '500 10px Arial';
        ctx.fillText(String(entry.subtitle || ''), rect.x + 10, rect.y + 30);
        retentionHitZones.push({
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h,
          targetLayout: String(entry.targetLayout || ''),
          id: String(entry.id || ''),
        });
        retentionY += retentionBtnH + retentionGap;
      }

      const tabs = Array.isArray(gameState.chestsLayout.tabs) ? gameState.chestsLayout.tabs : [];
      const activeTab = String(gameState.chestsLayout.activeTab || '');
      const tabHitZones = [];
      const tabY = retentionY + 4;
      const tabW = Math.max(62, Math.floor((panel.w - 24 - (tabs.length - 1) * 8) / Math.max(1, tabs.length)));
      tabs.forEach((tab, idx) => {
        const rect = { x: panel.x + 12 + idx * (tabW + 8), y: tabY, w: tabW, h: 28 };
        const isActive = String(tab.id || '') === activeTab;
        roundRect(rect.x, rect.y, rect.w, rect.h, 8, isActive ? palette.selected : '#f8f1dd', '#ccb88d');
        ctx.fillStyle = palette.ink;
        ctx.font = '700 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(tab.label || tab.id || ''), rect.x + rect.w / 2, rect.y + 18);
        tabHitZones.push({ ...rect, id: String(tab.id || '') });
      });
      ctx.textAlign = 'left';

      const progress = gameState.chestsLayout.progress || { current: 0, target: 1, milestoneReward: 'Tier Chest' };
      const progressWrap = { x: panel.x + 12, y: tabY + 40, w: panel.w - 24, h: 44 };
      roundRect(progressWrap.x, progressWrap.y, progressWrap.w, progressWrap.h, 10, '#f8f1dd', '#ccb88d');
      const meter = { x: progressWrap.x + 10, y: progressWrap.y + 24, w: progressWrap.w - 20, h: 12 };
      const pct = Math.max(0, Math.min(1, Number(progress.current || 0) / Math.max(1, Number(progress.target || 1))));
      ctx.fillStyle = '#e0d5bb';
      ctx.fillRect(meter.x, meter.y, meter.w, meter.h);
      ctx.fillStyle = '#d2a739';
      ctx.fillRect(meter.x, meter.y, meter.w * pct, meter.h);
      ctx.strokeStyle = '#a98a45';
      ctx.strokeRect(meter.x, meter.y, meter.w, meter.h);
      ctx.fillStyle = palette.ink;
      ctx.font = '600 10px Arial';
      ctx.fillText(
        `Progress ${Number(progress.current || 0)}/${Number(progress.target || 0)} · Milestone: ${String(progress.milestoneReward || '')}`,
        progressWrap.x + 10,
        progressWrap.y + 16,
      );

      const rewards = (gameState.chestsLayout.rewardsByTab || {})[activeTab] || [];
      const rewardHitZones = [];
      let rewardY = progressWrap.y + progressWrap.h + 10;
      rewards.forEach((reward, idx) => {
        const rect = { x: panel.x + 12, y: rewardY, w: panel.w - 24, h: 36 };
        roundRect(rect.x, rect.y, rect.w, rect.h, 8, '#fff8e8', '#d7c7a2');
        ctx.fillStyle = palette.ink;
        ctx.font = '600 11px Arial';
        ctx.fillText(String(reward || `Reward ${idx + 1}`), rect.x + 10, rect.y + 22);
        rewardHitZones.push(rect);
        rewardY += rect.h + 8;
      });

      gameState.chestsLayout.hitZones = {
        close,
        combatBack,
        retentionButtons: retentionHitZones,
        tabs: tabHitZones,
        rewards: rewardHitZones,
      };
      return;
    }
    if (layoutId === 'heroLayout') {
      normalizeHeroSelectionIndex();
      const roster = getHeroScreenRoster();
      const hero = roster[gameState.selectedHero] || roster[0] || {
        name: 'Hero',
        hp: 0,
        maxHP: 0,
        stats: { ATK: 0, DEF: 0, MAG: 0, RES: 0, SPD: 0 },
      };
      const heroName = String(hero.name || 'Hero');
      const heroHPValue = getHeroStatValue(hero, 'HP');
      const heroUID = Number(hero && hero.uid) || getHeroUIDByIndex(Number(hero && hero.heroIndex || 0));
      const heroSkillPoints = Math.max(0, Math.floor(Number(
        callFunctionWithContext(fnContext, 'GetHeroSkillPointBalance', heroUID) || 0
      )));
      const skillCards = getHeroScreenSkillCards(hero);
      const viewWidth = canvas.width / dpr;
      const viewHeight = canvas.height / dpr;
      const artW = heroLayoutSpec.artboard.w;
      const artH = heroLayoutSpec.artboard.h;
      const fitScale = Math.min(viewWidth / artW, viewHeight / artH);
      const artOffsetX = (viewWidth - (artW * fitScale)) * 0.5;
      const artOffsetY = (viewHeight - (artH * fitScale)) * 0.5;
      const sx = (x) => artOffsetX + (x * fitScale);
      const sy = (y) => artOffsetY + (y * fitScale);
      const ss = (v) => v * fitScale;
      const sf = (v, min = 8) => Math.max(min, Math.round(v * fitScale));
      const mapRect = (rect) => ({
        x: sx(rect.x),
        y: sy(rect.y),
        w: ss(rect.w),
        h: ss(rect.h),
      });
      const mapPoint = (x, y) => ({ x: sx(x), y: sy(y) });
      const portraitBox = mapRect(heroLayoutSpec.portrait);
      const leftArrowZone = mapRect(heroLayoutSpec.arrows.left);
      const rightArrowZone = mapRect(heroLayoutSpec.arrows.right);
      const leftArrowGlyph = mapPoint(heroLayoutSpec.arrows.left.glyphX, heroLayoutSpec.arrows.left.glyphY);
      const rightArrowGlyph = mapPoint(heroLayoutSpec.arrows.right.glyphX, heroLayoutSpec.arrows.right.glyphY);
      const namePill = mapRect(heroLayoutSpec.namePill);
      const statLabels = ['HP', 'ATK', 'DEF', 'MAG', 'RES', 'SPD'];
      const statLabelTop = heroLayoutSpec.stats.labelsTop;
      const statValueTop = heroLayoutSpec.stats.valuesTop;
      const statLabelH = heroLayoutSpec.stats.labelH;
      const statValueH = heroLayoutSpec.stats.valueH;
      const skillPointsRow = mapRect(heroLayoutSpec.skillPoints.row);
      const skillPointsChip = mapRect(heroLayoutSpec.skillPoints.chip);
      const closeRadius = ss(heroLayoutSpec.close.r);
      const closeCenter = mapPoint(heroLayoutSpec.close.cx, heroLayoutSpec.close.cy);
      const closeBtn = {
        x: closeCenter.x - closeRadius,
        y: closeCenter.y - closeRadius,
        w: closeRadius * 2,
        h: closeRadius * 2,
      };
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      gameState.heroScreen.hitZones = {
        close: closeBtn,
        prevHero: leftArrowZone,
        nextHero: rightArrowZone,
        skillControls: [],
      };

      ctx.clearRect(0, 0, viewWidth, viewHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, viewWidth, viewHeight);
      const drawArrowTriangle = (zone, direction) => {
        const pad = ss(2.2);
        const ix = zone.x + pad;
        const iy = zone.y + pad;
        const iw = zone.w - (pad * 2);
        const ih = zone.h - (pad * 2);
        const edge = ss(1.1);
        const drawPoly = (tipLeft, fill) => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          if (tipLeft) {
            ctx.moveTo(ix + iw, iy);
            ctx.lineTo(ix, iy + (ih * 0.5));
            ctx.lineTo(ix + iw, iy + ih);
          } else {
            ctx.moveTo(ix, iy);
            ctx.lineTo(ix + iw, iy + (ih * 0.5));
            ctx.lineTo(ix, iy + ih);
          }
          ctx.closePath();
          ctx.fill();
        };
        // Subtle outer edge like Figma anti-aliased border.
        drawPoly(direction === 'left', '#c9c9c9');
        const ox = ix + edge;
        const oy = iy + edge;
        const ow = iw - (edge * 2);
        const oh = ih - (edge * 2);
        ctx.fillStyle = '#c8dd3e';
        ctx.beginPath();
        if (direction === 'left') {
          ctx.moveTo(ox + ow, oy);
          ctx.lineTo(ox, oy + (oh * 0.5));
          ctx.lineTo(ox + ow, oy + oh);
        } else {
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + ow, oy + (oh * 0.5));
          ctx.lineTo(ox, oy + oh);
        }
        ctx.closePath();
        ctx.fill();
      };
      {
        // Left slot arrow points outward (to the left), matching Figma.
        drawArrowTriangle(leftArrowZone, 'left');
      }
      {
        // Right slot arrow points outward (to the right), matching Figma.
        drawArrowTriangle(rightArrowZone, 'right');
      }
      const capImg = heroCapsuleImages[heroName] || null;
      if (capImg) {
        const maxW = portraitBox.w - ss(8);
        const maxH = portraitBox.h - ss(8);
        const scale = Math.min(maxW / capImg.width, maxH / capImg.height);
        const drawW = capImg.width * scale;
        const drawH = capImg.height * scale;
        const drawX = portraitBox.x + (portraitBox.w - drawW) / 2;
        const drawY = portraitBox.y + (portraitBox.h - drawH) / 2;
        ctx.drawImage(capImg, drawX, drawY, drawW, drawH);
      } else {
        ctx.fillStyle = '#666666';
        ctx.font = `600 ${sf(14)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Portrait', portraitBox.x + portraitBox.w / 2, portraitBox.y + portraitBox.h / 2);
      }
      ctx.save();
      ctx.globalAlpha = 0.4;
      roundRect(namePill.x, namePill.y, namePill.w, namePill.h, ss(5), '#d9d9d9', null);
      ctx.restore();
      ctx.fillStyle = '#111111';
      ctx.font = `900 ${sf(20, 12)}px Arial Black`;
      ctx.textAlign = 'center';
      ctx.fillText(heroName, namePill.x + namePill.w / 2, namePill.y + ss(17));

      for (let i = 0; i < statLabels.length; i++) {
        const statKey = statLabels[i];
        const cell = heroLayoutSpec.stats.cells[i] || heroLayoutSpec.stats.cells[0];
        const labelRect = mapRect({ x: cell.x, y: statLabelTop, w: cell.w, h: statLabelH });
        const valueRect = mapRect({ x: cell.x, y: statValueTop, w: cell.w, h: statValueH });
        const statValue = statKey === 'HP'
          ? Math.max(0, Math.floor(Number(heroHPValue && heroHPValue.hp) || 0))
          : Math.max(0, Math.floor(Number(getHeroStatValue(hero, statKey)) || 0));
        roundRect(valueRect.x, valueRect.y, valueRect.w, valueRect.h, ss(5), '#f0f0f0', null);
        ctx.fillStyle = '#5f5f5f';
        ctx.font = `900 ${sf(12, 8)}px Arial Black`;
        ctx.textAlign = 'center';
        ctx.fillText(statKey, labelRect.x + labelRect.w / 2, labelRect.y + ss(11));
        ctx.fillStyle = '#bcb7b2';
        ctx.font = `900 ${sf(16, 10)}px Arial Black`;
        ctx.fillText(String(statValue), valueRect.x + valueRect.w / 2, valueRect.y + ss(27));
      }

      ctx.save();
      ctx.globalAlpha = 0.4;
      roundRect(skillPointsRow.x, skillPointsRow.y, skillPointsRow.w, skillPointsRow.h, ss(5), '#d9d9d9', null);
      ctx.restore();
      ctx.fillStyle = '#737373';
      ctx.font = `900 ${sf(12, 8)}px Arial Black`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const skillPointsTextY = skillPointsRow.y + (skillPointsRow.h / 2);
      ctx.fillText('SKILL POINTS', skillPointsRow.x + ss(59.5), skillPointsTextY);
      ctx.fillStyle = '#f87c17';
      ctx.font = `900 ${sf(12, 8)}px Arial Black`;
      ctx.fillText(String(heroSkillPoints), skillPointsChip.x + skillPointsChip.w / 2, skillPointsTextY);
      ctx.textBaseline = 'alphabetic';

      heroLayoutSpec.cards.forEach((cardSpec, idx) => {
        const cardData = skillCards[idx] || skillCards[0];
        const card = mapRect(cardSpec.card);
        const titleBar = mapRect(cardSpec.titleStrip);
        const iconTile = mapRect(cardSpec.iconTile);
        const bodyText = {
          x: sx(cardSpec.bodyText.x),
          titleY: sy(cardSpec.bodyText.titleY),
          line1Y: sy(cardSpec.bodyText.line1Y),
          line2Y: sy(cardSpec.bodyText.line2Y),
          line3Y: sy(cardSpec.bodyText.line3Y),
        };
        roundRect(card.x, card.y, card.w, card.h, ss(4.8), '#eff4f6', null);
        ctx.save();
        ctx.globalAlpha = 0.4;
        roundRect(titleBar.x, titleBar.y, titleBar.w, titleBar.h, ss(5), '#a7cfdf', null);
        ctx.restore();
        const accent = ['#ecd23d', '#ecd23d', '#d98de5'][idx] || '#9aa7b8';
        roundRect(iconTile.x, iconTile.y, iconTile.w, iconTile.h, ss(4.8), accent, null);
        const minusZone = mapRect(cardSpec.controls.minus);
        const valueZone = mapRect(cardSpec.controls.value);
        const plusZone = mapRect(cardSpec.controls.plus);
        gameState.heroScreen.hitZones.skillControls.push({
          idx,
          skillKey: `skill${idx + 1}`,
          minus: { x: minusZone.x, y: minusZone.y, w: minusZone.w, h: minusZone.h },
          plus: { x: plusZone.x, y: plusZone.y, w: plusZone.w, h: plusZone.h },
        });
        roundRect(valueZone.x, valueZone.y, valueZone.w, valueZone.h, ss(4.8), '#ffffff', null);
        ctx.fillStyle = '#7a3b07';
        ctx.font = `900 ${sf(9, 7)}px Arial Black`;
        ctx.textAlign = 'center';
        ctx.fillText(String(cardData.rankLabel || 'Lv0'), valueZone.x + valueZone.w / 2, valueZone.y + ss(14));
        if (minusIconImage) {
          const minusDrawX = minusZone.x;
          const minusDrawY = minusZone.y;
          const minusDrawW = minusZone.w;
          const minusDrawH = minusZone.h;
          ctx.save();
          ctx.translate(minusDrawX + (minusDrawW / 2), minusDrawY + (minusDrawH / 2));
          ctx.scale(1, -1);
          ctx.drawImage(minusIconImage, -minusDrawW / 2, -minusDrawH / 2, minusDrawW, minusDrawH);
          ctx.restore();
        } else {
          roundRect(minusZone.x, minusZone.y, minusZone.w, minusZone.h, ss(4.8), '#d1d1d1', null);
          ctx.fillStyle = '#666666';
          ctx.font = `700 ${sf(10, 7)}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText('-', minusZone.x + minusZone.w / 2, minusZone.y + ss(9));
        }
        if (plusIconImage) {
          ctx.drawImage(plusIconImage, plusZone.x, plusZone.y, plusZone.w, plusZone.h);
        } else {
          roundRect(plusZone.x, plusZone.y, plusZone.w, plusZone.h, ss(4.8), '#96d02f', null);
          ctx.fillStyle = '#666666';
          ctx.font = `700 ${sf(10, 7)}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText('+', plusZone.x + plusZone.w / 2, plusZone.y + ss(9));
        }
        ctx.fillStyle = '#111111';
        ctx.font = `700 ${sf(11.5, 8)}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(String(cardData.title || `Skill ${idx + 1}`), bodyText.x, bodyText.titleY);
        ctx.font = `700 ${sf(10.56, 7)}px Arial`;
        ctx.fillStyle = '#111111';
        const lines = Array.isArray(cardData.lines) ? cardData.lines : [];
        ctx.fillText(String(lines[0] || ''), bodyText.x, bodyText.line1Y);
        ctx.fillText(String(lines[1] || ''), bodyText.x, bodyText.line2Y);
        ctx.fillText(String(lines[2] || ''), bodyText.x, bodyText.line3Y);
      });
      drawHeroStyleCloseControl(ctx, closeBtn, closeWinOvalImage, '#111111');
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = layoutId === 'storyMock'
      ? '#1557ff'
      : (layoutId === 'town' ? '#6d4b2f' : '#d52525');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px Arial';
    ctx.textAlign = 'center';
    const load = gameState.startupLoad || {};
    const startupLoading = layoutId === 'storyMock' && !freshCombatBootstrapped;
    ctx.fillText(
      layoutId === 'storyMock'
        ? (startupLoading ? 'Story Mock (loading...)' : 'Story Mock (tap to enter town)')
        : layoutId === 'town'
          ? 'Town (tap to enter combat)'
        : 'Astral Overlay (click to return to combat)',
      (canvas.width / dpr) / 2,
      (canvas.height / dpr) / 2
    );
    if (startupLoading) {
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;
      const progress = Math.max(0, Math.min(1, Number(load.progress || 0)));
      const barW = Math.min(280, Math.floor(viewW * 0.78));
      const barH = 18;
      const barX = Math.floor((viewW - barW) / 2);
      const barY = Math.max(24, viewH - 66);
      ctx.fillStyle = '#6a665b';
      ctx.fillRect(barX, barY, barW, barH);
      const fillW = Math.max(0, Math.round((barW - 4) * progress));
      if (fillW > 0) {
        ctx.fillStyle = '#63c3ff';
        ctx.fillRect(barX + 2, barY + 2, fillW, barH - 4);
      }
      ctx.fillStyle = '#f2f2f2';
      ctx.font = '700 11px Arial';
      ctx.fillText(`${Math.round(progress * 100)}%`, viewW / 2, barY + barH / 2 + 3);
      ctx.font = '600 10px Arial';
      ctx.fillStyle = '#d6d6d6';
      ctx.fillText(String(load.label || 'Loading assets...'), viewW / 2, barY - 8);
    }
    if (layoutId === 'storyMock') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '500 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(RUNTIME_FINGERPRINT.label, 8, 14);
    } else if (layoutId === 'town') {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '600 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Party restored. Tap to continue back into combat.', (canvas.width / dpr) / 2, (canvas.height / dpr) / 2 + 24);
    }
    ctx.textAlign = 'left';
  }
  
  // helper function to draw all instances
  function drawStartupLoadingFrame() {
    const drawRoundedRect = (x, y, rw, rh, radius, fill, stroke = null) => {
      const rr = Math.max(0, Math.min(radius, rw / 2, rh / 2));
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, rw, rh, rr);
      } else {
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + rw - rr, y);
        ctx.quadraticCurveTo(x + rw, y, x + rw, y + rr);
        ctx.lineTo(x + rw, y + rh - rr);
        ctx.quadraticCurveTo(x + rw, y + rh, x + rw - rr, y + rh);
        ctx.lineTo(x + rr, y + rh);
        ctx.quadraticCurveTo(x, y + rh, x, y + rh - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
      }
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    };
    const w = canvas.width;
    const h = canvas.height;
    const load = gameState.startupLoad || {};
    const progress = Math.max(0, Math.min(1, Number(load.progress || 0)));
    const label = String(load.label || 'Loading...');
    const phase = String(load.phase || 'boot');

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const logoY = Math.max(42, Math.round(h * 0.18));
    ctx.fillStyle = '#3f3f3f';
    ctx.font = '900 26px Arial Black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Puzzle RPG', w / 2, logoY);

    ctx.fillStyle = '#7a7a7a';
    ctx.font = '700 12px Arial';
    ctx.fillText(label, w / 2, logoY + 28);

    const barW = Math.min(280, Math.floor(w * 0.78));
    const barH = 18;
    const barX = Math.floor((w - barW) / 2);
    const barY = Math.max(24, h - 66);
    drawRoundedRect(barX, barY, barW, barH, 9, '#6a665b', null);
    const fillW = Math.max(0, Math.round((barW - 4) * progress));
    if (fillW > 0) {
      drawRoundedRect(barX + 2, barY + 2, fillW, barH - 4, 7, '#63c3ff', null);
    }

    ctx.fillStyle = '#f2f2f2';
    ctx.font = '700 11px Arial';
    ctx.fillText(`${Math.round(progress * 100)}%`, w / 2, barY + barH / 2 + 0.5);
    ctx.font = '600 10px Arial';
    ctx.fillStyle = '#8f8f8f';
    ctx.fillText(phase, w / 2, barY + 26);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  function drawFrame(dtOverride){
    const activeRuntimeLayout = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (activeRuntimeLayout && activeRuntimeLayout !== 'combat') {
      drawHarnessLayoutTakeover(activeRuntimeLayout);
      return;
    }
    if (layoutHarnessEnabled && harnessLayoutState) {
      const activeLayout = harnessLayoutState.getActiveLayoutId();
      if (activeLayout && activeLayout !== 'combat') {
        drawHarnessLayoutTakeover(activeLayout);
        return;
      }
    }
    if (!COMBAT_BOOTSTRAP_COMPLETE && !layoutHarnessEnabled) {
      drawStartupLoadingFrame();
      return;
    }
    if (state.globals.DevToolingPaused) {
      lastFrameTime = performance.now();
      return;
    }

    const now = performance.now();
    const dtBase = dtOverride != null
      ? dtOverride
      : Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    const dt = dtOverride != null
      ? dtBase
      : dtBase * Math.max(0.25, Number(state.globals.DevCombatSpeedMultiplier || 1));
    lastFrameTime = now;
    if (!state.globals.time) state.globals.time = 0;
    state.globals.time += dt;
    if (state.globals.RegenTickCounter == null) state.globals.RegenTickCounter = 0;
    if (state.globals.RegenTickTimer == null) state.globals.RegenTickTimer = 0;
    // Party and enemy over-time ticks share one cadence owner.
    state.globals.RegenTickTimer += dt;
    while (state.globals.RegenTickTimer >= 3) {
      state.globals.RegenTickTimer -= 3;
      state.globals.RegenTickCounter += 1;
      const tickNow = state.globals.RegenTickCounter;
      const list = state.globals.PartyRegens;
      if (list && list.length) {
        for (let i = list.length - 1; i >= 0; i--) {
          const regen = list[i];
          if (!regen || regen.remainingFires <= 0) {
            list.splice(i, 1);
            continue;
          }
          if (tickNow >= (regen.nextFireTick || 0)) {
            let heal = 1;
            if (regen.totalHealRemaining != null && regen.remainingFires > 0) {
              const remaining = Math.max(1, Math.floor(regen.totalHealRemaining));
              const fires = Math.max(1, Math.floor(regen.remainingFires));
              const base = Math.floor(remaining / fires);
              const extra = (remaining % fires) > 0 ? 1 : 0;
              heal = Math.max(1, base + extra);
              regen.totalHealRemaining = Math.max(0, remaining - heal);
            } else {
              heal = Math.max(1, Math.round(regen.healPerFire || 1));
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
            regen.remainingFires -= 1;
            regen.nextFireTick = (regen.nextFireTick || tickNow) + (regen.firesEveryTicks || 1);
            if (regen.remainingFires <= 0) {
              list.splice(i, 1);
            }
          }
        }
        if (list.length === 0) delete state.globals.PartyRegens;
      }
      const enemyDots = state.globals.EnemyDamageOverTime;
      if (enemyDots && enemyDots.length) {
        for (let i = enemyDots.length - 1; i >= 0; i--) {
          const dot = enemyDots[i];
          if (!dot || dot.remainingFires <= 0) {
            enemyDots.splice(i, 1);
            continue;
          }
          if (dot.totalDamageRemaining != null && Number(dot.totalDamageRemaining || 0) <= 0) {
            enemyDots.splice(i, 1);
            continue;
          }
          const enemy = callFunctionWithContext(fnContext, 'GetActorByUID', dot.targetUID);
          if (!enemy || Number(enemy.hp || 0) <= 0) {
            enemyDots.splice(i, 1);
            continue;
          }
          if (tickNow >= (dot.nextFireTick || 0)) {
            let dmg = 1;
            if (dot.totalDamageRemaining != null && dot.remainingFires > 0) {
              const remaining = Math.max(0, Math.floor(dot.totalDamageRemaining));
              if (remaining <= 0) {
                enemyDots.splice(i, 1);
                continue;
              }
              const fires = Math.max(1, Math.floor(dot.remainingFires));
              const base = Math.floor(remaining / fires);
              const extra = (remaining % fires) > 0 ? 1 : 0;
              dmg = Math.max(1, base + extra);
              dot.totalDamageRemaining = Math.max(0, remaining - dmg);
            } else {
              dmg = Math.max(1, Math.round(dot.damagePerFire || 1));
            }
            state.globals.NextHitFlashTone = 'purple';
            state.globals.NextDamageTextKind = 'dot';
            callFunctionWithContext(fnContext, 'ApplyDamageToTarget', dot.targetUID, dmg);
            dot.remainingFires -= 1;
            dot.nextFireTick = (dot.nextFireTick || tickNow) + (dot.firesEveryTicks || 1);
            if (dot.remainingFires <= 0) {
              enemyDots.splice(i, 1);
            }
          }
        }
        if (enemyDots.length === 0) delete state.globals.EnemyDamageOverTime;
      }
    }
    if (state.globals.BattleStartActive) {
      const t = state.globals.time;
      const fadeEnd = state.globals.BattleStartFadeEndsAt ?? 2.4;
      if (t >= fadeEnd) {
        state.globals.BattleStartActive = 0;
        state.globals.BattleStartClearedForSession = 1;
        if (!state.globals.BattleStartProcessStarted) {
          state.globals.BattleStartProcessStarted = 1;
          state.globals.IsPlayerBusy = 0;
          if (state.globals.GamePhase === 'RUNTIME') {
            combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
          }
        }
      }
    }

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
              gemDebugLog('[FILL_SKIP]', {
                stage: 'yellow-sequence',
                step: casino.index,
                cellR: item.cellR,
                cellC: item.cellC,
                reason: 'missing-yellow-gem',
                tag: item.reason || item.type,
              });
              if (isGemDebugEnabled()) {
                gemDebugLog('[COVERAGE]', countCellCoverage());
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
                if (isGemDebugEnabled()) {
                  gemDebugLog('[COVERAGE]', countCellCoverage());
                }
                gemDebugLog('[FILL]', {
                  stage: 'yellow-sequence',
                  step: casino.index,
                  cellR: item.cellR,
                  cellC: item.cellC,
                  reason: item.reason || 'yellow-reassign',
                  assignedColor: item.target,
                  assignedUid: gem.uid,
                });
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
                gemDebugLog('[FILL_SKIP]', {
                  stage: 'yellow-sequence',
                  step,
                  cellR,
                  cellC,
                  reason: slotFilled ? (!gameState.grid[cellC] ? 'missing-column' : 'not-empty') : 'occupied-slot',
                  tag: item.reason || 'empty',
                });
                if (occupiedGem && gameState.grid[cellC]) {
                  gameState.grid[cellC][cellR] = occupiedGem.uid;
                }
                if (isGemDebugEnabled()) {
                  gemDebugLog('[COVERAGE]', countCellCoverage());
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
                if (isGemDebugEnabled()) {
                  gemDebugLog('[REFILL_BEFORE]', {
                    step,
                    cellR,
                    cellC,
                    gemCount: gameState.gems.length
                  });
                }
                gameState.gems.push(newGem);
                if (isGemDebugEnabled()) {
                  gemDebugLog('[REFILL_AFTER]', {
                    step,
                    cellR,
                    cellC,
                    gemCount: gameState.gems.length
                  });
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
                if (isGemDebugEnabled()) {
                  gemDebugLog('[COVERAGE]', countCellCoverage());
                }
                gemDebugLog('[FILL]', {
                  stage: 'yellow-sequence',
                  step: casino.index,
                  cellR: item.cellR,
                  cellC: item.cellC,
                  reason: item.reason || 'empty',
                  assignedColor: item.target,
                  assignedUid: newGem.uid,
                });
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
              }
              applyTurnGateIntent(getYellowSequenceCompletionIntent);
            }
            if (canRestorePickability) {
              if (isGemDebugEnabled()) {
                gemDebugLog('[RESTORE_PICKABILITY]', {
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
                });
              }
            }
            if (isGemDebugEnabled()) {
              gemDebugLog('[REFILL_COMPLETE]', {
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
              });
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

    const refill = gameState.refillBounce;
    if (refill && refill.active) {
      const nowTime = state.globals.time || 0;
      const bounceDur = 0.16 * (refill.speedScale || 1);
      const startNext = () => {
        refill.current = null;
        while (refill.index < refill.queue.length) {
          const slot = refill.queue[refill.index];
          if (!gameState.grid[slot.cellC] || gameState.grid[slot.cellC][slot.cellR] !== 0) {
            gemDebugLog('[FILL_SKIP]', {
              stage: 'refill-bounce',
              step: refill.index,
              cellR: slot.cellR,
              cellC: slot.cellC,
              reason: !gameState.grid[slot.cellC] ? 'missing-column' : 'not-needed',
              tag: slot.reason || 'empty',
            });
            if (isGemDebugEnabled()) {
              gemDebugLog('[COVERAGE]', countCellCoverage());
            }
            refill.index += 1;
            continue;
          }
          const step = refill.index;
          const cellR = slot.cellR;
          const cellC = slot.cellC;
          const previousUid = gameState.grid[cellC] ? Number(gameState.grid[cellC][cellR] || 0) : 0;
          const occupiedGem = (gameState.gems || []).find(g => g && g.cellR === cellR && g.cellC === cellC);
          if (occupiedGem) {
            recordTask011RefillWriteEvent({
              source: 'refill-bounce',
              step,
              cellR,
              cellC,
              reason: 'occupied-slot',
              writeType: 'skip',
              previousUid,
              newUid: previousUid,
            });
            gemDebugLog('[FILL_SKIP]', {
              stage: 'refill-bounce',
              step,
              cellR,
              cellC,
              reason: 'occupied-slot',
              tag: slot.reason || 'empty',
            });
            if (gameState.grid[cellC]) gameState.grid[cellC][cellR] = occupiedGem.uid;
            if (isGemDebugEnabled()) {
              gemDebugLog('[COVERAGE]', countCellCoverage());
            }
            refill.index += 1;
            continue;
          }
          const pos = getCellWorldPos(slot.cellC, slot.cellR);
          const color = randomGemFrame();
          const newGem = {
            uid: gameState.nextGemUID++,
            cellC: slot.cellC,
            cellR: slot.cellR,
            color,
            elementIndex: color,
            x: pos.x,
            y: pos.y,
            worldX: pos.x,
            worldY: pos.y,
            width: pos.w,
            height: pos.h,
            selected: false,
            Selected: 0,
            flashUntil: 0,
            bounceStart: nowTime,
            bounceDur,
          };
          if (isGemDebugEnabled()) {
            gemDebugLog('[REFILL_BEFORE]', {
              step,
              cellR,
              cellC,
              gemCount: gameState.gems.length
            });
          }
          gameState.gems.push(newGem);
          if (isGemDebugEnabled()) {
            gemDebugLog('[REFILL_AFTER]', {
              step,
              cellR,
              cellC,
              gemCount: gameState.gems.length
            });
          }
          gameState.grid[slot.cellC][slot.cellR] = newGem.uid;
          recordTask011RefillWriteEvent({
            source: 'refill-bounce',
            step,
            cellR,
            cellC,
            reason: slot.reason || 'empty',
            writeType: 'set',
            previousUid,
            newUid: newGem.uid,
          });
          setGemArray(gameState.gems);
          if (isGemDebugEnabled()) {
            gemDebugLog('[COVERAGE]', countCellCoverage());
          }
          gemDebugLog('[FILL]', {
            stage: 'refill-bounce',
            step: refill.index,
            cellR: slot.cellR,
            cellC: slot.cellC,
            reason: slot.reason || 'empty',
            assignedColor: color,
            assignedUid: newGem.uid,
          });
          refill.current = { doneAt: nowTime + bounceDur };
          break;
        }
        if (!refill.current) {
          refill.active = false;
          const refillCompleteGate = state.globals.TurnPhase === 2
            ? createEnemyTurnGateBaseline
            : createRefillCompleteGate;
          applyTurnGateIntent(refillCompleteGate);
          state.globals.BoardFillActive = 0;
          if (isGemDebugEnabled()) {
            gemDebugLog('[REFILL_COMPLETE]', {
              stage: 'refill-bounce-finished',
              globals: {
                BoardFillActive: state.globals.BoardFillActive,
                CanPickGems: state.globals.CanPickGems,
                IsPlayerBusy: state.globals.IsPlayerBusy,
                DeferAdvance: state.globals.DeferAdvance,
                ActionLockUntil: state.globals.ActionLockUntil,
                PendingSkillID: state.globals.PendingSkillID || '',
                TurnPhase: state.globals.TurnPhase,
              },
            });
            const integrity = assertBoardIntegrity('refill-bounce-finished');
            if (!integrity.ok) {
              throw new Error('[BOARD_INTEGRITY_FAIL] refill-bounce-finished');
            }
          }
          if (isGemDebugEnabled()) {
            const queueDone = !Array.isArray(refill.queue) || refill.index >= refill.queue.length;
            const noSpinActive = !(gameState.yellowCasino && gameState.yellowCasino.active);
            if (queueDone && noSpinActive && state.globals.BoardFillActive !== 0) {
              console.error('[REFILL_STUCK]', {
                reason: 'BoardFillActive-not-reset',
                refillIndex: refill.index,
                refillQueueLength: Array.isArray(refill.queue) ? refill.queue.length : 0,
                yellowSpinActive: !!(gameState.yellowCasino && gameState.yellowCasino.active),
                globals: getGemGateSnapshot(),
              });
            }
          }
          if (isGemDebugEnabled()) {
            const noSpinActive = !(gameState.yellowCasino && gameState.yellowCasino.active);
            const queueDone = !Array.isArray(refill.queue) || refill.index >= refill.queue.length;
            const shouldValidate =
              state.globals.BoardFillActive === 0 &&
              queueDone &&
              noSpinActive &&
              state.globals.TurnPhase === 0 &&
              state.globals.IsPlayerBusy === 0;
            if (shouldValidate && state.globals.CanPickGems !== true) {
              console.error('[GATE_STUCK_AFTER_REFILL]', {
                reason: 'CanPickGems-false-after-refill',
                refillIndex: refill.index,
                refillQueueLength: Array.isArray(refill.queue) ? refill.queue.length : 0,
                yellowSpinActive: !!(gameState.yellowCasino && gameState.yellowCasino.active),
                globals: getGemGateSnapshot(),
              });
              state.globals.CanPickGems = true;
              gemDebugLog('[GATE_STUCK_AFTER_REFILL]', { corrected: true, globals: getGemGateSnapshot() });
            }
          }
          if (state.globals.TurnPhase === 2 && !state.globals.ActionInProgress) {
            if (state.globals.GamePhase === 'RUNTIME') {
              combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
            }
          }
        }
      };
      if (!refill.current) {
        startNext();
      } else if (nowTime >= (refill.current.doneAt || 0)) {
        refill.index += 1;
        refill.current = null;
        startNext();
      }
    }

    // Apply delayed hero hits after lunge/impact timing
    if (state.globals.PendingHeroHits && state.globals.PendingHeroHits.length) {
      const now = state.globals.time || 0;
      const pending = state.globals.PendingHeroHits;
      for (let i = pending.length - 1; i >= 0; i--) {
        const hit = pending[i];
        if (!hit || now < (hit.at || 0)) continue;
        if (hit.effectType === 'dot_apply') {
          const totalTicks = 8;
          const totalDotDamage = Math.max(1, Math.floor(Number(hit.dotTotalDamage || 0) || 1));
          const initialDotDamage = Math.max(1, Math.floor(totalDotDamage / totalTicks) + ((totalDotDamage % totalTicks) > 0 ? 1 : 0));
          state.globals.NextHitFlashTone = 'purple';
          state.globals.NextDamageTextKind = 'dot';
          callFunctionWithContext(fnContext, 'ApplyDamageToTarget', hit.targetUID, initialDotDamage);
          const enemyAfterApply = callFunctionWithContext(fnContext, 'GetActorByUID', hit.targetUID);
          const remainingDotDamage = Math.max(0, totalDotDamage - initialDotDamage);
          if (enemyAfterApply && Number(enemyAfterApply.hp || 0) > 0 && remainingDotDamage > 0) {
            callFunctionWithContext(fnContext, 'QueueEnemyDamageOverTime', hit.heroUID, hit.targetUID, remainingDotDamage, { totalTicks: totalTicks - 1, firesEveryTicks: 1, startAfterTicks: 1, effectName: 'Blight' });
          }
          pending.splice(i, 1);
          continue;
        }
        const targetEntity = callFunctionWithContext(fnContext, 'GetActorByUID', hit.targetUID);
        if (!targetEntity || Number(targetEntity.hp || 0) <= 0) {
          for (let j = pending.length - 1; j >= 0; j--) {
            const queued = pending[j];
            if (!queued) continue;
            if (Number(queued.targetUID || 0) !== Number(hit.targetUID || 0)) continue;
            if (queued.effectType === 'dot_apply') continue;
            pending.splice(j, 1);
          }
          continue;
        }
        if (hit.damageTextScatter && typeof hit.damageTextScatter === 'object') {
          state.globals.NextDamageTextScatter = {
            radiusX: Number(hit.damageTextScatter.radiusX || 0),
            radiusY: Number(hit.damageTextScatter.radiusY || 0),
          };
        }
        const ampMult = Number(hit.powerAmpMultiplier || 0);
        const finalDmg = ampMult > 0 ? Math.max(1, Math.ceil((hit.dmg || 0) * ampMult)) : hit.dmg;
        if (state.globals.DebugPowerAmpLifecycle) {
          const heroName = hit.heroName || 'Hero';
          const heroType = hit.heroType || 'melee';
          const calcPath = hit.calcPath || (heroType === 'magic' ? 'magicCalc' : 'meleeCalc');
          console.log(
            `[POWER_AMP_DMG] hero=${hit.heroUID} name=${heroName} type=${heroType} path=${calcPath} ` +
            `base=${hit.dmg} amp=${ampMult} final=${finalDmg} active=${ampMult > 0 ? 1 : 0} consume=${hit.consumePowerAmp ? 1 : 0} lifecycle=${Number(hit.powerAmpLifecycleId || 0)}`
          );
        }
        callFunctionWithContext(fnContext, 'ApplyDamageToTarget', hit.targetUID, finalDmg);
        if (hit.msg) {
          if (ampMult > 0) {
            const msg = String(hit.msg).replace(/ for \d+!$/, ` for ${finalDmg}!`);
            callFunctionWithContext(fnContext, 'LogCombat', msg);
          } else {
            callFunctionWithContext(fnContext, 'LogCombat', hit.msg);
          }
        }
        pending.splice(i, 1);
      }
      if (pending.length === 0) {
        delete state.globals.PendingHeroHits;
      }
    }

    // DamageText animation update
    const dmgTexts = state.globals.DamageTexts || [];
    for (let i = dmgTexts.length - 1; i >= 0; i--) {
      const d = dmgTexts[i];
      d.age = (d.age || 0) + dt;
      if (d.phase === 0) {
        const rise = Math.max(0.001, d.riseInSec || 0.18);
        if (d.age >= rise) {
          d.phase = 1;
          d.age = 0;
        }
      } else if (d.phase === 1) {
        const hold = d.holdSec || 0.7;
        if (d.age >= hold) {
          d.phase = 2;
          d.age = 0;
        }
      } else if (d.phase === 2) {
        const fade = Math.max(0.001, d.fadeSec || 0.45);
        if (d.age >= fade) {
          dmgTexts.splice(i, 1);
        }
      }
    }
    const animEndAt = state.globals.TextAnimEndAt || 0;
    state.globals.TextAnimating = (dmgTexts.length > 0 || (state.globals.time || 0) < animEndAt) ? 1 : 0;
    // Enemy action state machine (advance -> act -> retreat -> done)
    const enemyAction = state.globals.EnemyAction;
    if (enemyAction && enemyAction.active) {
      const enemy = state.entities.find(e => e.kind === 'enemy' && e.uid === enemyAction.uid);
      if (!enemy || (enemy.hp ?? 0) <= 0) {
        enemyAction.active = false;
        state.globals.IsPlayerBusy = 0;
      } else {
        const anticipationDur = 0.14;
        const lungeDur = 0.32;
        const impactHold = 0.16;
        const retreatDur = 0.26;
        if (enemy.originX == null) enemy.originX = enemy.x ?? 0;
        if (enemy.originY == null) enemy.originY = enemy.y ?? 0;
        if (enemyAction.targetX == null) {
          const heroIcons = state.globals.HeroIconPosByIndex || [];
          const targetIdx = (enemyAction.targetUID ? (state.entities.find(e => e.uid === enemyAction.targetUID)?.heroIndex ?? 0) : 0);
          const targetPos = heroIcons[targetIdx];
          enemyAction.targetX = targetPos ? targetPos.x : (enemy.originX - 120);
        }
        if (enemyAction.forwardX == null) {
          const distToTarget = Math.abs((enemyAction.targetX ?? enemy.originX) - enemy.originX);
          const lungeDist = Math.max(40, Math.min(110, distToTarget * 0.45));
          enemyAction.forwardX = enemy.originX - lungeDist;
        }
        if (enemyAction.anticipationX == null) {
          const dir = Math.sign((enemyAction.forwardX ?? enemy.originX) - enemy.originX) || -1;
          enemyAction.anticipationX = enemy.originX - (dir * 6);
        }
        const moveToward = (cur, target, speed, dtSec) => {
          if (cur === target) return cur;
          const delta = target - cur;
          const step = Math.sign(delta) * speed * dtSec;
          if (Math.abs(step) >= Math.abs(delta)) return target;
          return cur + step;
        };
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
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
          enemy.x = from + (to - from) * e;
          if (t >= 1) {
            enemyAction.state = 'LUNGE';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'LUNGE') {
          enemyAction.timer += dt;
          const t = Math.min(1, enemyAction.timer / Math.max(0.001, lungeDur));
          const e = easeOutCubic(t);
          const from = enemyAction.anticipationX ?? enemy.originX;
          const to = enemyAction.forwardX ?? enemy.originX;
          enemy.x = from + (to - from) * e;
          if (!enemyAction.actionApplied && t >= 1) {
            enemyAction.actionApplied = true;
            callFunctionWithContext(fnContext, 'ApplyEnemySkill', enemyAction.uid, enemyAction.skillId, enemyAction.targetUID);
          }
          if (t >= 1) {
            enemyAction.state = 'HIT';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'HIT') {
          enemyAction.timer += dt;
          enemy.x = enemyAction.forwardX ?? enemy.originX;
          if (enemyAction.timer >= impactHold) {
            enemyAction.state = 'RETREAT';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'RETREAT') {
          enemyAction.timer += dt;
          const t = Math.min(1, enemyAction.timer / Math.max(0.001, retreatDur));
          const e = easeInOutCubic(t);
          const from = enemyAction.forwardX ?? enemy.originX;
          const to = enemy.originX;
          enemy.x = from + (to - from) * e;
          if (t >= 1) {
            enemy.x = enemy.originX;
            enemyAction.state = 'DONE';
          }
        }
        if (enemyAction.state === 'DONE') {
          enemyAction.active = false;
          enemy.x = enemy.originX ?? enemy.x;
          enemy.y = enemy.originY ?? enemy.y;
          state.globals.IsPlayerBusy = 0;
          if (state.globals.ActionActorUID === enemyAction.uid) {
            state.globals.ActionInProgress = 0;
            state.globals.ActionActorUID = 0;
          }
          state.globals.ActionLockUntil = (state.globals.time || 0) + 0.35;
          state.globals.DeferAdvance = 1;
        }
      }
    }

    // Hero action lunge (toward center, mirrored enemy motion)
    const heroAction = state.globals.HeroAction;
    if (heroAction && heroAction.active) {
      const hero = state.entities.find(e => e.kind === 'hero' && e.uid === heroAction.uid);
      const positions = state.globals.HeroPortraitPosByIndex || [];
      const offsets = state.globals.HeroLungeOffsetByUID || (state.globals.HeroLungeOffsetByUID = {});
      if (hero && hero.heroIndex != null && positions[hero.heroIndex]) {
        const base = positions[hero.heroIndex];
        const baseX = base.x;
        const targetX = layoutW / 2;
        if (heroAction.baseX == null) heroAction.baseX = baseX;
        if (heroAction.forwardX == null) {
          const dist = Math.abs(targetX - baseX);
          const lungeDist = Math.max(40, Math.min(110, dist * 0.45));
          heroAction.forwardX = baseX + lungeDist;
        }
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const easeInCubic = (t) => t * t * t;
        const easeInOutCubic = (t) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const anticipationDur = 0.14;
        const lungeDur = 0.32;
        const holdDur = 0.16;
        const retreatDur = 0.26;
        if (heroAction.anticipationX == null) {
          const dir = Math.sign((heroAction.forwardX ?? baseX) - baseX) || 1;
          heroAction.anticipationX = baseX - (dir * 6);
        }
        heroAction.timer = (heroAction.timer || 0) + dt;
        let x = baseX;
        if (heroAction.state === 'ADVANCE') {
          const t = Math.min(1, heroAction.timer / Math.max(0.001, anticipationDur));
          const e = easeInCubic(t);
          const from = heroAction.baseX;
          const to = heroAction.anticipationX ?? heroAction.baseX;
          x = from + (to - from) * e;
          if (t >= 1) {
            heroAction.state = 'LUNGE';
            heroAction.timer = 0;
          }
        } else if (heroAction.state === 'LUNGE') {
          const t = Math.min(1, heroAction.timer / Math.max(0.001, lungeDur));
          const e = easeOutCubic(t);
          const from = heroAction.anticipationX ?? heroAction.baseX;
          const to = heroAction.forwardX ?? heroAction.baseX;
          x = from + (to - from) * e;
          if (t >= 1) {
            heroAction.state = 'HOLD';
            heroAction.timer = 0;
          }
        } else if (heroAction.state === 'HOLD') {
          x = heroAction.forwardX;
          if (heroAction.timer >= holdDur) {
            heroAction.state = 'RETREAT';
            heroAction.timer = 0;
          }
        } else if (heroAction.state === 'RETREAT') {
          const t = Math.min(1, heroAction.timer / Math.max(0.001, retreatDur));
          const e = easeInOutCubic(t);
          const from = heroAction.forwardX ?? heroAction.baseX;
          const to = heroAction.baseX;
          x = from + (to - from) * e;
          if (t >= 1) {
            x = heroAction.baseX;
            heroAction.active = false;
          }
        }
        offsets[hero.uid] = x - baseX;
        if (!heroAction.active) {
          offsets[hero.uid] = 0;
          if (state.globals.ActionActorUID === hero.uid) {
            state.globals.ActionInProgress = 0;
            state.globals.ActionActorUID = 0;
          }
          state.globals.IsPlayerBusy = 0;
          console.log(`[HERO] action done uid=${hero.uid} phase=${state.globals.TurnPhase} busy=${state.globals.IsPlayerBusy} defer=${state.globals.DeferAdvance} lockUntil=${state.globals.ActionLockUntil}`);
        }
      } else {
        heroAction.active = false;
        if (state.globals.ActionActorUID === heroAction.uid) {
          state.globals.ActionInProgress = 0;
          state.globals.ActionActorUID = 0;
        }
        state.globals.IsPlayerBusy = 0;
        console.log(`[HERO] action aborted uid=${heroAction.uid} phase=${state.globals.TurnPhase} busy=${state.globals.IsPlayerBusy}`);
      }
    }

    gameState.buffRollTimer = 0;
    gameState._lastBuffRollActive = 0;

    // Buff progress bar expiry
    if (state.globals.BuffProgActive && state.globals.time >= (state.globals.BuffProgEndAt || 0)) {
      state.globals.BuffProgActive = 0;
      state.globals.BuffProgSlot = -1;
    }
    callFunctionWithContext(fnContext, 'TickPowerAmpState');
    // Dynamically filter overlay elements based on current state
    const overlayElements = new Set(['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX']);
    const debugElements = new Set(['newdebugger', 'newdebugger2', 'InputBlocker', 'EnemyKeyList', 'KillCounter', 'turnTracker', 'txtPhaseInfo']);
    const buffIcons = new Set(['buffIcon1', 'buffIcon2', 'buffIcon3', 'buffIcon4']);

    
    // Center the close button + X on the layout viewport
    const closeBtn = rendered.find(r => r.inst.type === 'UI_NavCloseButton');
    const closeX = rendered.find(r => r.inst.type === 'UI_NavCloseX');
    if (closeBtn) {
      closeBtn.world.x = layoutW / 2;
    }
    if (closeX) {
      closeX.world.x = layoutW / 2;
      if (closeBtn) closeX.world.y = closeBtn.world.y;
    }

    const boardBackers = rendered
      .filter(r => r.inst && r.inst.type === 'Sprite5' && r.layerName === 'BoardBG')
      .sort((a, b) => (a.world?.x || 0) - (b.world?.x || 0));
    const allowedBoardBackerUIDs = new Set(boardBackers.slice(0, 4).map(r => r.uid));

    const filteredRendered = rendered.filter(r => {
      // Hard clamp buff backer placeholders to 4 slots.
      if (r.inst && r.inst.type === 'Sprite5' && r.layerName === 'BoardBG' && !allowedBoardBackerUIDs.has(r.uid)) {
        return false;
      }
      // Hide overlay elements when overlay is not visible
      if(!gameState.overlayVisible && overlayElements.has(r.inst.type)){
        return false;
      }
      if(buffIcons.has(r.inst.type)) {
        const slotIndex = { buffIcon1: 0, buffIcon2: 1, buffIcon3: 2, buffIcon4: 3 }[r.inst.type];
        const frames = state.globals.BuffFrames || [];
        const frame = frames[slotIndex];
        if (frame == null || frame < 0) return false;
        buffIconFrames[r.inst.type] = frame;
      }
      if (r.inst.type === 'AddMore') {
        return false;
      }
      // Hide debug and nav text elements (we'll render clean nav labels instead)
      if(debugElements.has(r.inst.type)){
        return false;
      }
      // Compute scaled bounds for this frame
      const pos = worldToCanvas(r.world.x || 0, r.world.y || 0);
      const drawW = (r.world.width || 64) * layoutScale;
      const drawH = (r.world.height || 64) * layoutScale;
      r.w = drawW;
      r.h = drawH;
      if (r.inst.type === 'UI_NavCloseButton' || r.inst.type === 'UI_NavCloseX') {
        const center = worldToCanvas(layoutW / 2, r.world.y || 0);
        r.dx = center.x - drawW * 0.5;
        r.dy = center.y - drawH * 0.5;
      } else if (r.inst.type === 'AddMore') {
        r.dx = pos.x - drawW * r.ox;
        r.dy = pos.y - drawH * r.oy - (10 * layoutScale);
      } else {
        r.dx = pos.x - drawW * r.ox;
        r.dy = pos.y - drawH * r.oy;
      }
      return true;
    });
    
    // Debug: Log filter results
    if (gameState.overlayVisible !== lastOverlayState) {
      startupDebugLog(`[FILTER] overlayVisible=${gameState.overlayVisible}, filteredRendered=${filteredRendered.length} items`);
      lastOverlayState = gameState.overlayVisible;
    }
    
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0,0,canvas.width,canvas.height);
    
    // Map layer names to color coding
    const layerColors = {
      'Background': '#d4a574',    // tan/brown for ground
      'BoardBG': '#f4f9a6',       // light yellow for board
      'Hero_Pics': '#87ceeb',     // sky blue for heroes
      'Game': '#ffcccc',          // light red for game objects
      'UI': '#90ee90',            // light green for UI
      'Window Popup': '#dda0dd',  // plum for popups
      'Resource BKG': '#f0e68c',  // khaki for resources
      'GemBG': '#ffa500'          // orange for gems
    };
    
    // Separate modal and non-modal objects for proper z-ordering
    const isModalObject = (type) => ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(type);
    const navTextTypes = new Set(['Nav_HeroText', 'Nav_MapText', 'Nav_MissionText', 'Nav_AstralFlowText', 'Nav_HomeText']);
    const movedRadiatorsToSidebar = true;
    const movedRadiatorTextTypes = new Set([
      'Chain_Tracker',
      'ActorIntent',
      'CombatAction',
      'CombatAction1',
      'CombatAction2',
      'CombatAction3',
      'track_next',
      'track_nextplus1',
      'track_nextplus2',
      'track_nextplus3',
      'track_nextplus4',
      'track_nextplus5',
    ]);
    const navTopTypes = new Set([...navTextTypes]);
    const extraTrackTypes = new Set(['track_nextplus1', 'track_nextplus2', 'track_nextplus3', 'track_nextplus4', 'track_nextplus5']);
    const presentTrackOffsets = new Set(
      rendered
        .filter(r => extraTrackTypes.has(r.inst.type))
        .map(r => ({
          track_nextplus1: 1,
          track_nextplus2: 2,
          track_nextplus3: 3,
          track_nextplus4: 4,
          track_nextplus5: 5
        }[r.inst.type]))
        .filter(v => typeof v === 'number')
    );
    const allExtraPresent = [1,2,3,4,5].every(n => presentTrackOffsets.has(n));
    const NAV_BACKER_UID = 10; // navBacker (keep JSON unchanged)
    const scaleFont = (size) => Math.max(8, Math.round(size * layoutScale));
    const navFontBoost = Math.max(2, Math.round(2 * layoutScale));

    const modalRendered = filteredRendered.filter(r => isModalObject(r.inst.type));
    const modalPlane = modalRendered.find(r => r.inst.type === 'UI_CloseWin');
    const closeBtnRender = modalRendered.find(r => r.inst.type === 'UI_NavCloseButton');
    const closeXRender = modalRendered.find(r => r.inst.type === 'UI_NavCloseX');
    const navBacker = filteredRendered.find(r => r.uid === NAV_BACKER_UID) || null;
    const navTopRendered = gameState.overlayVisible ? filteredRendered.filter(r => navTopTypes.has(r.inst.type)) : [];

    const nonModalRendered = filteredRendered.filter(r =>
      !isModalObject(r.inst.type) &&
      !(gameState.overlayVisible && (navTopTypes.has(r.inst.type) || (navBacker && r.uid === navBacker.uid)))
    );
    const closeBtnCenter = closeBtnRender ? { x: closeBtnRender.dx + closeBtnRender.w / 2, y: closeBtnRender.dy + closeBtnRender.h / 2 } : null;
    const boardW = boardGeometry.cols * boardGeometry.cellSize + (boardGeometry.cols - 1) * boardGeometry.gap;
    const boardH = boardGeometry.rows * boardGeometry.cellSize + (boardGeometry.rows - 1) * boardGeometry.gap;
    const grid = gameState.gridBounds || {
      minX: boardGeometry.gx,
      minY: boardGeometry.gy,
      maxX: boardGeometry.gx + boardW,
      maxY: boardGeometry.gy + boardH
    };
    const radiatorScale = Math.max(0.85, Math.min(layoutScale, 1.05));
    const radiatorSidePad = Math.max(6, 8 * radiatorScale);
    const radiatorGap = Math.max(8, 10 * radiatorScale);
    const radiatorPanelW = Math.max(112, Math.round(120 * radiatorScale));
    const radiatorTrackPanelW = Math.max(122, Math.round(132 * radiatorScale));
    const radiatorPanelY = layoutOffsetY + Math.max(6, 8 * radiatorScale);
    const panelH = Math.max(72, Math.round(78 * radiatorScale));
    const trackPanelH = Math.max(90, Math.round(96 * radiatorScale));
    const leftPanelX = layoutOffsetX + radiatorSidePad;
    const rightPanelX = layoutOffsetX + (layoutW * layoutScale) - radiatorSidePad - radiatorTrackPanelW;
    const chainPanelH = Math.max(26, Math.round(28 * radiatorScale));
    const chainAnchor = {
      x: leftPanelX + radiatorPanelW / 2,
      y: radiatorPanelY + chainPanelH - Math.max(7, Math.round(8 * radiatorScale))
    };
    const combatAnchor = {
      x: leftPanelX + Math.max(4, Math.round(5 * radiatorScale)),
      y: radiatorPanelY + chainPanelH + Math.max(12, Math.round(13 * radiatorScale))
    };
    const storySlot = gameState.storyCardLayout;
    const trackAnchor = {
      x: rightPanelX + Math.max(4, Math.round(5 * radiatorScale)),
      y: radiatorPanelY + Math.max(16, Math.round(17 * radiatorScale))
    };
    const radiatorPanels = {
      chain: { x: leftPanelX, y: radiatorPanelY, w: radiatorPanelW, h: chainPanelH },
      combat: { x: leftPanelX, y: radiatorPanelY + chainPanelH + Math.max(4, Math.round(5 * radiatorScale)), w: radiatorPanelW, h: panelH },
      track: { x: rightPanelX, y: radiatorPanelY, w: radiatorTrackPanelW, h: trackPanelH }
    };
    const drawRadiatorPanel = (panel) => {
      ctx.save();
      ctx.fillStyle = 'rgba(240,240,240,0.92)';
      ctx.strokeStyle = 'rgba(60,60,60,0.85)';
      ctx.lineWidth = 1;
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
      ctx.restore();
    };
    if (!movedRadiatorsToSidebar) {
      drawRadiatorPanel(radiatorPanels.chain);
      drawRadiatorPanel(radiatorPanels.combat);
      drawRadiatorPanel(radiatorPanels.track);
    }
    
    const drawBasicItem = (r) => {
      if (!r) return;
      ctx.save();
      const img = r.img;
      if(img){
        ctx.drawImage(img, r.dx, r.dy, r.w, r.h);
      } else if(r.isButton){
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        ctx.fillStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
        ctx.fillStyle = '#111';
        ctx.font = `bold ${scaleFont(14)}px sans-serif`;
        ctx.textAlign = 'center';
        const label = r.textContent || r.inst.type || 'Button';
        ctx.fillText(label, r.dx + r.w / 2, r.dy + r.h / 2 + 5);
      } else if(r.isText){
        const baseSize = r.inst.properties && r.inst.properties.size ? r.inst.properties.size : 12;
        const fontSize = scaleFont(baseSize) + (navTextTypes.has(r.inst.type) ? navFontBoost : 0);
        const fontColor = r.inst.properties && r.inst.properties.color ?
          `rgb(${Math.round(r.inst.properties.color[0]*255)}, ${Math.round(r.inst.properties.color[1]*255)}, ${Math.round(r.inst.properties.color[2]*255)})` : '#111';
        ctx.fillStyle = fontColor;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        const text = r.textContent || r.inst.type;
        ctx.fillText(text, r.dx + r.w/2, r.dy + r.h/2 + 5);
      } else {
        const layerColor = layerColors[r.layerName] || '#ddd';
        ctx.fillStyle = layerColor;
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        ctx.strokeStyle = layerColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
      }
      ctx.restore();
    };

    // No roulette rendering; buff icons use pop-in emphasis only
    const popDuration = 0.22;
    const popScale = (t) => {
      const x = Math.max(0, Math.min(1, t));
      if (x < 0.5) return 1 + (1.485 - 1) * (x / 0.5);
      if (x < 0.8) return 1.485 + (0.90 - 1.485) * ((x - 0.5) / 0.3);
      return 0.90 + (1 - 0.90) * ((x - 0.8) / 0.2);
    };
    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    if (!gameState.buffIconPresentation) {
      gameState.buffIconPresentation = {
        key: '',
        active: false,
        phase: 'idle',
        holdStartAt: 0,
        travelStartAt: 0,
        holdSec: 0.5,
        travelSec: 0.34,
        frameType: -1,
        slotType: '',
        from: { x: 0, y: 0, w: 0, h: 0 },
        to: { x: 0, y: 0, w: 0, h: 0 },
        landedAt: null,
        pending: null,
      };
    }
    const iconPresentation = gameState.buffIconPresentation;
    const buffSlotByFrame = {};
    for (const r of nonModalRendered) {
      if (!buffIcons.has(r.inst.type)) continue;
      const frameIdx = buffIconFrames[r.inst.type] || 0;
      if (buffSlotByFrame[frameIdx]) continue;
      buffSlotByFrame[frameIdx] = {
        slotType: r.inst.type,
        x: r.dx + r.w / 2,
        y: r.dy + r.h / 2,
        w: r.w,
        h: r.h,
      };
    }
    const popTypeNow = state.globals.BuffIconPopType;
    const popAtNow = state.globals.BuffIconPopAt;
    const beginIconPresentation = (target, key) => {
      const centerX = layoutOffsetX + (layoutW * layoutScale) / 2;
      const centerY = layoutOffsetY + (layoutH * layoutScale) / 2 - 40;
      iconPresentation.key = key;
      iconPresentation.active = !!target;
      iconPresentation.phase = 'hold';
      iconPresentation.holdStartAt = state.globals.time || 0;
      iconPresentation.travelStartAt = 0;
      iconPresentation.frameType = popTypeNow;
      iconPresentation.slotType = target ? target.slotType : '';
      iconPresentation.from = {
        x: centerX,
        y: centerY,
        w: target ? target.w * 4.2 : 0,
        h: target ? target.h * 4.2 : 0,
      };
      iconPresentation.to = target
        ? { x: target.x, y: target.y, w: target.w, h: target.h }
        : { x: centerX, y: centerY, w: 0, h: 0 };
      iconPresentation.landedAt = null;
      iconPresentation.pending = null;
    };
    if (popTypeNow != null && popAtNow != null) {
      const key = `${popTypeNow}:${popAtNow}`;
      if (iconPresentation.key !== key) {
        const target = buffSlotByFrame[popTypeNow];
        const mergeFx = gameState.gemMergeFx;
        if (mergeFx && mergeFx.active) {
          iconPresentation.key = key;
          iconPresentation.active = false;
          iconPresentation.phase = 'waiting';
          iconPresentation.pending = { target, key };
          iconPresentation.frameType = popTypeNow;
          iconPresentation.landedAt = null;
        } else {
          beginIconPresentation(target, key);
        }
      }
    }
    if (iconPresentation.pending && (!gameState.gemMergeFx || !gameState.gemMergeFx.active)) {
      const { target, key } = iconPresentation.pending;
      beginIconPresentation(target, key);
    }
    if (iconPresentation.active && iconPresentation.slotType) {
      const target = buffSlotByFrame[iconPresentation.frameType];
      if (target) {
        iconPresentation.slotType = target.slotType;
        iconPresentation.to = { x: target.x, y: target.y, w: target.w, h: target.h };
      }
      const nowTime = state.globals.time || 0;
      if (iconPresentation.phase === 'hold' && nowTime >= iconPresentation.holdStartAt + iconPresentation.holdSec) {
        iconPresentation.phase = 'travel';
        iconPresentation.travelStartAt = nowTime;
      } else if (iconPresentation.phase === 'travel') {
        const t = iconPresentation.travelSec > 0
          ? (nowTime - iconPresentation.travelStartAt) / iconPresentation.travelSec
          : 1;
        if (t >= 1) {
          iconPresentation.phase = 'done';
          iconPresentation.active = false;
          iconPresentation.landedAt = nowTime;
        }
      }
    }

    const rouletteTargetFrame = iconPresentation && iconPresentation.frameType >= 0
      ? iconPresentation.frameType
      : popTypeNow;
    const rouletteInFlight = !!(gameState.gemMergeFx && gameState.gemMergeFx.active) ||
      (iconPresentation && (iconPresentation.phase === 'waiting' || iconPresentation.phase === 'hold' || iconPresentation.phase === 'travel' || iconPresentation.active));
    if (state.globals.BlueBuffSequenceActive) {
      const nowTime = state.globals.time || 0;
      const landedAt = iconPresentation ? iconPresentation.landedAt : null;
      const fallbackDone = popAtNow != null && (nowTime - popAtNow) > 1.2;
      if (!rouletteInFlight && ((landedAt != null && nowTime >= landedAt + popDuration) || fallbackDone)) {
        state.globals.BlueBuffSequenceActive = 0;
        if (
          state.globals.GamePhase === 'RUNTIME' &&
          state.globals.TurnPhase === 2 &&
          !state.globals.ActionInProgress &&
          !state.globals.IsPlayerBusy
        ) {
          combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
        }
      }
    }

    let energyLayout = null;
    if (navBacker) {
      const hudLeft = navBacker.dx;
      const hudTop = navBacker.dy;
      const hudWidth = navBacker.w;
      const hudHeight = navBacker.h;
      energyLayout = {
        centerX: hudLeft + (hudWidth * 0.5),
        barY: hudTop + (hudHeight * 0.52),
        textY: hudTop + (hudHeight * 0.83),
      };
    }
    // Draw non-modal objects first
    for(const r of nonModalRendered){
      const img = r.img;
      if(img){
        const frameIdx = buffIcons.has(r.inst.type) ? (buffIconFrames[r.inst.type] || 0) : null;
        if (frameIdx != null && buffIconFrameImages[r.inst.type] && buffIconFrameImages[r.inst.type][frameIdx]) {
          if (
            rouletteInFlight &&
            rouletteTargetFrame != null &&
            rouletteTargetFrame === frameIdx &&
            !state.globals.BuffIconPopStacking
          ) {
            continue;
          }
          let scale = 1;
          if (buffIcons.has(r.inst.type)) {
            const popType = state.globals.BuffIconPopType;
            let popAt = state.globals.BuffIconPopAt;
            if (
              iconPresentation.landedAt != null &&
              iconPresentation.slotType === r.inst.type &&
              iconPresentation.frameType === frameIdx
            ) {
              popAt = iconPresentation.landedAt;
            }
            if (state.globals.BuffIconPopStacking) {
              popAt = (iconPresentation.landedAt != null &&
                iconPresentation.slotType === r.inst.type &&
                iconPresentation.frameType === frameIdx)
                ? iconPresentation.landedAt
                : null;
            }
            if (popType != null && popAt != null && popType === frameIdx) {
              const t = (state.globals.time - popAt) / popDuration;
              if (t >= 0 && t <= 1) scale = popScale(t);
            }
          }
          if (scale !== 1) {
            const cx = r.dx + r.w / 2;
            const cy = r.dy + r.h / 2;
            const w = r.w * scale;
            const h = r.h * scale;
            ctx.drawImage(buffIconFrameImages[r.inst.type][frameIdx], cx - w/2, cy - h/2, w, h);
          } else {
            ctx.drawImage(buffIconFrameImages[r.inst.type][frameIdx], r.dx, r.dy, r.w, r.h);
          }
        } else {
          ctx.drawImage(img, r.dx, r.dy, r.w, r.h);
        }
      } else if(r.isButton){
        // Render buttons with a distinct button style
        ctx.fillStyle = '#e8e8e8';  // button gray
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        ctx.fillStyle = '#666';     // darker border
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
      } else if(r.isText) {
        // Text objects render without placeholder background
      } else {
        // Use layer-specific color for placeholder boxes
        const layerColor = layerColors[r.layerName] || '#ddd';
        ctx.fillStyle = layerColor; 
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        // Draw border with layer color
        ctx.strokeStyle = layerColor; 
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
      }
      
      // Draw text label
      ctx.fillStyle = '#111';
      if(r.isButton){
        ctx.font = `bold ${scaleFont(14)}px sans-serif`;
      } else {
        ctx.font = `${scaleFont(12)}px sans-serif`;
      }
      ctx.textAlign = 'center';
      
      if(r.inst.type === 'UI_NavCloseX') {
        // Render the X centered on the close button circle
        const size = closeBtnRender ? Math.min(closeBtnRender.w, closeBtnRender.h) * 0.6 : Math.min(r.w, r.h) * 0.6;
        ctx.fillStyle = '#111';
        ctx.font = `bold ${Math.max(12, Math.round(size))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = closeBtnCenter ? closeBtnCenter.x : (r.dx + r.w/2);
        const cy = closeBtnCenter ? closeBtnCenter.y : (r.dy + r.h/2);
        ctx.fillText('X', cx, cy);
        ctx.textBaseline = 'alphabetic';
      } else if(r.isText){
        if (movedRadiatorsToSidebar && movedRadiatorTextTypes.has(r.inst.type) && r.inst.type !== 'CombatAction') {
          continue;
        }
        const baseSize = r.inst.properties && r.inst.properties.size ? r.inst.properties.size : 12;
        const fontSize = scaleFont(baseSize) + (navTextTypes.has(r.inst.type) ? navFontBoost : 0);
        ctx.font = `${fontSize}px sans-serif`;
        // Draw actual text content (extracted or generated label)
        let text = r.textContent || '[Text]';
        if (r.inst.type === 'Chain_Tracker') {
          const chainNum = Math.max(0, Number(state.globals.ChainNumber || 0));
          const suppress = !!state.globals.SuppressChainUI;
          const hideAt = Number(state.globals.ChainUIHideAt || 0);
          const now = Number(state.globals.time || 0);
          const isVisible = chainNum >= 2 && !suppress && (hideAt === 0 || now <= hideAt);
          if (!isVisible) {
            continue;
          }
          text = `Chain x${chainNum}`;
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = Math.max(2, Math.round(4 * layoutScale));
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.max(1, Math.round(2 * layoutScale));
          ctx.textAlign = 'center';
          ctx.fillText(text, chainAnchor.x, chainAnchor.y);
          ctx.restore();
          continue;
        }
        if (r.inst.type === 'BuffText') {
          text = state.globals.BuffText || '';
        } else if (r.inst.type === 'ActorIntent') {
          text = state.globals.ActorIntent || text;
          ctx.textAlign = 'left';
          const lineH = Math.max(12, (r.h || 14 * layoutScale));
          ctx.fillText(text, combatAnchor.x, combatAnchor.y + lineH * 4);
          continue;
        } else if (['CombatAction', 'CombatAction1', 'CombatAction2', 'CombatAction3'].includes(r.inst.type)) {
          if (r.inst.type !== 'CombatAction') {
            continue;
          }
          if (!storySlot || !storySlot.initialized) {
            continue;
          }
          const liveLine = getStoryCardLiveLineState();
          text = liveLine.text;
          const storyFontSizeBase = Math.max(Math.round(18 * layoutScale), scaleFont(14));
          const storyFontSize = Math.max(8, Math.round(storyFontSizeBase * 0.595));
          ctx.save();
          ctx.fillStyle = 'rgba(245,245,245,0.96)';
          ctx.strokeStyle = 'rgba(80,80,80,0.7)';
          ctx.lineWidth = 1;
          ctx.fillRect(storySlot.x, storySlot.y, storySlot.w, storySlot.h);
          ctx.strokeRect(storySlot.x, storySlot.y, storySlot.w, storySlot.h);
          ctx.restore();
          ctx.textAlign = 'left';
          ctx.font = `bold ${storyFontSize}px sans-serif`;
          const storyTextX = storySlot.x + Math.max(10, Math.round(12 * layoutScale));
          const storyTextY = storySlot.y + (storySlot.h * 0.58);
          const split = splitStoryCardActorSegment(text);
          ctx.save();
          ctx.globalAlpha = liveLine.animAlpha;
          if (split.actor) {
            ctx.fillStyle = '#E35822';
            ctx.fillText(split.actor, storyTextX, storyTextY);
            const actorWidth = ctx.measureText(split.actor).width;
            ctx.fillStyle = '#314877';
            ctx.fillText(split.rest, storyTextX + actorWidth, storyTextY);
          } else {
            ctx.fillStyle = '#314877';
            ctx.fillText(text, storyTextX, storyTextY);
          }
          ctx.restore();
          continue;
        } else if (r.inst.type === 'PartyHP_text') {
          const cur = state.globals.PartyHP ?? 0;
          const max = state.globals.PartyMaxHP ?? 0;
          text = `${cur} / ${max}`;
          const offsetX = -15 * layoutScale;
          ctx.fillText(text, r.dx + r.w/2 + offsetX, r.dy + r.h/2 + 5);
          continue;
        } else if (r.inst.type === 'Text_Energy') {
          const energy = state.globals.Player_Energy ?? 0;
          const maxEnergy = state.globals.Player_maxEnergy ?? 0;
          text = `${energy}/${maxEnergy}`;
          const centerX = energyLayout ? energyLayout.centerX : (r.dx + r.w / 2);
          const y = energyLayout ? energyLayout.textY : (r.dy + r.h / 2);
          ctx.fillStyle = '#ffd200';
          ctx.textAlign = 'center';
          ctx.fillText(text, centerX, y + 5);
          continue;
        } else if (r.inst.type === 'Text_Gold') {
          const gold = state.globals.goldTotal ?? 0;
          text = `Gold: ${gold}`;
          if (r.world) {
            const w = Number(r.world.width || 0);
            const h = Number(r.world.height || 0);
            const ox = r.world.originX != null ? Number(r.world.originX) : 0.5;
            const oy = r.world.originY != null ? Number(r.world.originY) : 0.5;
            gameState.goldLabelTargetWorld = {
              x: Number(r.world.x || 0) + (0.5 - ox) * w,
              y: Number(r.world.y || 0) + (0.5 - oy) * h,
            };
          }
        } else if (r.inst.type === 'Nav_MissionText') {
          text = 'Vault';
        } else if (['track_next', 'track_nextplus1', 'track_nextplus2', 'track_nextplus3', 'track_nextplus4', 'track_nextplus5'].includes(r.inst.type)) {
          const order = state.globals.TurnOrderArray || [];
          const count = order.length;
          const baseIndex = state.globals.CurrentTurnIndex || 0;
          const offset = {
            track_next: 0,
            track_nextplus1: 1,
            track_nextplus2: 2,
            track_nextplus3: 3,
            track_nextplus4: 4,
            track_nextplus5: 5
          }[r.inst.type] || 0;
          if (count > 0) {
            const idx = (baseIndex + offset) % count;
            const row = order[idx];
            if (row) {
              const actor = state.entities.find(e => e.uid === row.uid);
              if (actor) {
                const label = actor.name || '?';
                const baseSpd = Number(actor.stats?.SPD ?? actor.SPD ?? 0);
                const debuff = actor.kind === 'enemy'
                  ? (state.globals.EnemyDebuffs?.[actor.uid]?.SPD || 0)
                  : 0;
                const curSpd = baseSpd - debuff;
                const extraTag = row.extra ? ' (x2)' : '';
                const delta = actor.kind === 'enemy' && debuff > 0
                  ? `(-${Math.round(debuff)})`
                  : '';
                text = `${label} ${Math.round(curSpd)}/${Math.round(baseSpd)}${delta ? ` ${delta}` : ''}${extraTag}`;
              } else {
                text = '';
              }
            } else {
              text = '';
            }
          } else {
            text = '';
          }
          ctx.textAlign = 'left';
          const lineH = Math.max(10, (r.h || 14 * layoutScale) * 0.65);
          ctx.fillText(text, trackAnchor.x + 4, trackAnchor.y + lineH * offset);
          if (r.inst.type === 'track_next' && !allExtraPresent) {
            const lineH = Math.max(10, (r.h || 14 * layoutScale) * 0.65);
            for (let i = 1; i <= 5; i++) {
              if (presentTrackOffsets.has(i)) continue;
              if (!count) break;
              const idx = (baseIndex + i) % count;
              const row = order[idx];
              if (!row) continue;
              const actor = state.entities.find(e => e.uid === row.uid);
              if (!actor) continue;
              const label = actor.name || '?';
              const baseSpd = Number(actor.stats?.SPD ?? actor.SPD ?? 0);
              const debuff = actor.kind === 'enemy'
                ? (state.globals.EnemyDebuffs?.[actor.uid]?.SPD || 0)
                : 0;
              const curSpd = baseSpd - debuff;
              const extraTag = row.extra ? ' (x2)' : '';
              const delta = actor.kind === 'enemy' && debuff > 0
                ? `(-${Math.round(debuff)})`
                : '';
              const line = `${label} ${Math.round(curSpd)}/${Math.round(baseSpd)}${delta ? ` ${delta}` : ''}${extraTag}`;
              const y = trackAnchor.y + lineH * i;
              ctx.fillText(line, trackAnchor.x + 4, y);
            }
          }
          continue;
        }
        if (text === 'What happen?') {
          text = '';
        }
        if (['h1name','h2Hname','h3name','h4name'].includes(r.inst.type)) {
          continue;
        }
        ctx.fillText(text, r.dx + r.w/2, r.dy + r.h/2 + 5);
      } else if(r.isButton){
        // Draw button text (centered, bold)
        const text = r.textContent || r.inst.type;
        ctx.fillText(text, r.dx + r.w/2, r.dy + r.h/2 + 5);
      } else {
        let label = r.inst.type;
        if (['h1name','h2Hname','h3name','h4name'].includes(r.inst.type)) {
          continue;
        }
        if (!r.isSprite && !['PartyHP_Bar'].includes(r.inst.type)) {
          ctx.fillText(label, r.dx + r.w/2, r.dy + r.h + 12);
        }
      }
    }

    // Nav labels are rendered via their text objects; no duplicate draw pass
    
    // Render gems on the board
    if (gameState.boardCreated && gameState.gems) {
      for (let i = 0; i < gameState.gems.length; i++) {
        const gem = gameState.gems[i];
        const g = boardGeometry;
        const pos = worldToCanvas(gem.x, gem.y);
        let scale = 1;
        if (gem.bounceStart != null && gem.bounceDur != null) {
          const t = (state.globals.time - gem.bounceStart) / Math.max(0.001, gem.bounceDur);
          if (t >= 1) {
            gem.bounceStart = null;
            gem.bounceDur = null;
            gem.bounceAmp = null;
          } else if (t >= 0) {
            const amp = Number(gem.bounceAmp ?? 0.12);
            scale = 1 + (amp * Math.sin(Math.PI * t));
          }
        }
        const gemW = gem.width * layoutScale * scale;
        const gemH = gem.height * layoutScale * scale;
        const gemX = pos.x - gemW * 0.5;
        const gemY = pos.y - gemH * 0.5;
        const frameIndex = (gem.color ?? 0) % 8;
        const gemImg = gemFrameImages[frameIndex];
        if (gemImg) {
          ctx.drawImage(gemImg, gemX, gemY, gemW, gemH);
        } else {
          // fallback circle if assets missing
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, gemW * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw selection highlight if selected
        if (gem.selected || (gem.flashUntil && gem.flashUntil > now)) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = gem.flashUntil && gem.flashUntil > now ? 3 : 2;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, gemW * 0.48, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    if (gameState.yellowCasino && gameState.yellowCasino.ghost) {
      const ghost = gameState.yellowCasino.ghost;
      const pos = worldToCanvas(ghost.x, ghost.y);
      const w = ghost.w * layoutScale;
      const h = ghost.h * layoutScale;
      const gemX = pos.x - w * 0.5;
      const gemY = pos.y - h * 0.5;
      const frameIndex = (ghost.frame ?? 0) % 8;
      const gemImg = gemFrameImages[frameIndex];
      if (gemImg) {
        ctx.drawImage(gemImg, gemX, gemY, w, h);
      } else {
        ctx.fillStyle = '#ffa500';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, w * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (gameState.gemMergeFx && gameState.gemMergeFx.active) {
      const merge = gameState.gemMergeFx;
      const nowTime = state.globals.time || 0;
      const tRaw = merge.duration > 0 ? (nowTime - merge.startAt) / merge.duration : 1;
      const t = Math.max(0, Math.min(1, tRaw));
      const e = t * t;
      const fallbackCenterX = layoutOffsetX + (layoutW * layoutScale) / 2;
      const fallbackCenterY = layoutOffsetY + (layoutH * layoutScale) / 2 - 40;
      let centerX = fallbackCenterX;
      let centerY = fallbackCenterY;
      if (merge.target && Number.isFinite(merge.target.x) && Number.isFinite(merge.target.y)) {
        const targetPos = worldToCanvas(merge.target.x, merge.target.y);
        centerX = targetPos.x;
        centerY = targetPos.y;
      }
      const baseSize = boardGeometry.cellSize * layoutScale * 0.5;
      const fade = t > 0.8 ? Math.max(0, 1 - ((t - 0.8) / 0.2)) : 1;
      const scaleOut = merge.scaleOut !== false;
      const startScale = Number.isFinite(Number(merge.startScale)) ? Math.max(0.05, Number(merge.startScale)) : 1;
      const introT = Math.max(0, Math.min(1, t / 0.35));
      const introScale = startScale + (1 - startScale) * introT;
      const scale = scaleOut
        ? (t > 0.8 ? Math.max(0.05, 1 - ((t - 0.8) / 0.2)) : 1)
        : 1;
      const finalScale = scale * introScale;
      for (const item of merge.items || []) {
        const pos = worldToCanvas(item.x, item.y);
        const x = pos.x + (centerX - pos.x) * e;
        const y = pos.y + (centerY - pos.y) * e;
        const frameIndex = (item.color ?? 0) % 8;
        const gemImg = gemFrameImages[frameIndex];
        if (!gemImg) continue;
        const w = baseSize * finalScale;
        const h = baseSize * finalScale;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.drawImage(gemImg, x - w * 0.5, y - h * 0.5, w, h);
        ctx.restore();
      }
      if (t >= 1) {
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
      }
    }

    // Party HP progress bar (use PartyHP_Bar instance)
    const partyBar = rendered.find(r => r.inst.type === 'PartyHP_Bar');
    if (partyBar) {
      if (partyBar.world) {
        state.globals.PartyHPBarPosWorld = {
          x: partyBar.world.x || 0,
          y: partyBar.world.y || 0,
          w: partyBar.world.width || partyBar.w || 0,
          h: partyBar.world.height || partyBar.h || 0,
          ox: partyBar.world.originX != null ? partyBar.world.originX : 0.5,
          oy: partyBar.world.originY != null ? partyBar.world.originY : 0.5,
        };
      }
      const maxHP = Math.max(1, state.globals.PartyMaxHP || 1);
      const ratio = Math.max(0, Math.min(1, (state.globals.PartyHP || 0) / maxHP));
      const barX = partyBar.dx;
      const barY = partyBar.dy;
      const barW = partyBar.w;
      const barH = partyBar.h;
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#1e7bd6';
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.strokeStyle = '#0f0f0f';
      ctx.strokeRect(barX, barY, barW, barH);
    }

    if (
      iconPresentation &&
      iconPresentation.active &&
      iconPresentation.frameType >= 0 &&
      iconPresentation.slotType &&
      buffIconFrameImages[iconPresentation.slotType] &&
      buffIconFrameImages[iconPresentation.slotType][iconPresentation.frameType]
    ) {
      const img = buffIconFrameImages[iconPresentation.slotType][iconPresentation.frameType];
      let cx = iconPresentation.from.x;
      let cy = iconPresentation.from.y;
      let w = iconPresentation.from.w;
      let h = iconPresentation.from.h;
      if (iconPresentation.phase === 'travel') {
        const rawT = iconPresentation.travelSec > 0
          ? ((state.globals.time || 0) - iconPresentation.travelStartAt) / iconPresentation.travelSec
          : 1;
        const t = Math.max(0, Math.min(1, rawT));
        const e = easeInOutQuad(t);
        cx = iconPresentation.from.x + (iconPresentation.to.x - iconPresentation.from.x) * e;
        cy = iconPresentation.from.y + (iconPresentation.to.y - iconPresentation.from.y) * e;
        w = iconPresentation.from.w + (iconPresentation.to.w - iconPresentation.from.w) * e;
        h = iconPresentation.from.h + (iconPresentation.to.h - iconPresentation.from.h) * e;
      }
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }

    // Enemy debuff icons (max 3 per enemy, tinted red)
    const debuffMap = { DEF: 'DEF', ATK: 'ATK', MAG: 'MAG', SPD: 'SPD', RES: 'RES' };
    const debuffSlotsByUID = state.globals.EnemyDebuffSlots || {};
    for (const enemy of state.entities.filter(e => e.kind === 'enemy' && (e.hp ?? 0) > 0)) {
      const slots = debuffSlotsByUID[enemy.uid] || [];
      if (!slots.length) continue;
      const g = state.globals;
      const slotIndex = enemy.slotIndex ?? 0;
      const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
      const x = enemy.originX != null ? enemy.originX : (enemy.x != null ? enemy.x : (g.X0 || 200));
      const y = enemy.originY != null ? enemy.originY : (enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing);
      const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
      const origW = enemyOrig ? enemyOrig.width : 1;
      const origH = enemyOrig ? enemyOrig.height : 1;
      const enemyH = (g.EnemySize || 40) * layoutScale;
      const enemyW = enemyH * (origW / origH);
      const pos = worldToCanvas(x, y);
      const iconSize = Math.max(10, Math.round(16 * 0.8 * layoutScale));
      const baseX = pos.x + enemyW / 2 + (4 * layoutScale);
      const topY = pos.y - enemyH / 2;
      const bottomY = pos.y + enemyH / 2 - iconSize;
      const count = Math.min(3, slots.length);
      const yPositions = [];
      if (count === 1) {
        yPositions.push(topY);
      } else if (count === 2) {
        yPositions.push(topY, (topY + bottomY) / 2);
      } else if (count === 3) {
        yPositions.push(topY, (topY + bottomY) / 2, bottomY);
      }
      for (let i = 0; i < count; i++) {
        const stat = slots[i];
        const key = debuffMap[stat];
        const img = key ? debuffIconImages[key] : null;
        if (!img) continue;
        const x = baseX;
        const y = yPositions[i] ?? topY;
        let scale = 1;
        const pop = state.globals.EnemyDebuffPop;
        if (pop && pop.uid === enemy.uid && pop.stat === stat && pop.at != null) {
          const t = (state.globals.time - pop.at) / popDuration;
          if (t >= 0 && t <= 1) scale = popScale(t);
        }
        ctx.save();
        if (scale !== 1) {
          const cx = x + iconSize / 2;
          const cy = y + iconSize / 2;
          const w = iconSize * scale;
          const h = iconSize * scale;
          ctx.drawImage(img, cx - w/2, cy - h/2, w, h);
        } else {
          ctx.drawImage(img, x, y, iconSize, iconSize);
        }
        ctx.restore();
      }
    }

    // Energy bar aligned to energy text within HUD container
    if (energyLayout) {
      const centerX = energyLayout.centerX;
      const barW = Math.max(60, 80 * layoutScale);
      const barH = Math.max(4, 6 * layoutScale);
      const barX = centerX - barW / 2;
      const barY = energyLayout.barY;
      const maxE = Math.max(1, state.globals.Player_maxEnergy || 1);
      const curE = Math.max(0, state.globals.Player_Energy || 0);
      const ratio = Math.max(0, Math.min(1, curE / maxE));
      ctx.fillStyle = '#111';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#A659A8';
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.strokeStyle = '#1a1a1a';
      ctx.strokeRect(barX, barY, barW, barH);
    }

    const isHitFlashActive = (uid) => {
      const flashes = state.globals.HitFlashByUID;
      if (!uid || !flashes || typeof flashes !== 'object') return false;
      const entry = flashes[uid];
      if (entry && typeof entry === 'object') return Number(entry.until || 0) > Number(state.globals.time || 0);
      return Number(entry || 0) > Number(state.globals.time || 0);
    };

    const getHitFlashTone = (uid) => {
      const flashes = state.globals.HitFlashByUID;
      if (!uid || !flashes || typeof flashes !== 'object') return 'black';
      const entry = flashes[uid];
      if (entry && typeof entry === 'object') return String(entry.tone || 'black');
      return 'black';
    };

    const renderHitFlashOverlay = (drawSprite, tone = 'black') => {
      ctx.save();
      ctx.globalAlpha = tone === 'purple' ? 0.5 : 0.3;
      ctx.filter = tone === 'purple'
        ? 'brightness(0.6) sepia(1) hue-rotate(240deg) saturate(2.8)'
        : 'brightness(0)';
      drawSprite();
      ctx.restore();
    };

    // Render enemies (use Enemy_Sprite animations)
    const enemiesToDraw = state.entities.filter(e => e.kind === 'enemy' && (e.hp ?? 0) > 0);
    if (enemiesToDraw.length) {
      const g = state.globals;
      const barBackImg = images['Bar_Back'] || null;
      const barFillImg = images['Bar_Fill'] || null;
      const barYellowImg = images['Bar_Yellow'] || null;
      const barQueue = [];
      for (const enemy of enemiesToDraw) {
        const slotIndex = enemy.slotIndex ?? 0;
        const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
        const x = enemy.x != null ? enemy.x : (g.X0 || 200);
        const y = enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing;
        const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
        const origW = enemyOrig ? enemyOrig.width : 1;
        const origH = enemyOrig ? enemyOrig.height : 1;
        const enemyH = (g.EnemySize || 40) * layoutScale;
        const enemyW = enemyH * (origW / origH);
        const pos = worldToCanvas(x, y);
        const sprite = enemySpriteImages[String(enemy.name || '').toLowerCase()];
        const drawX = pos.x - enemyW / 2;
        const drawY = pos.y - enemyH / 2;
        if (sprite) {
          ctx.drawImage(sprite, drawX, drawY, enemyW, enemyH);
          if (isHitFlashActive(enemy.uid)) {
            renderHitFlashOverlay(() => ctx.drawImage(sprite, drawX, drawY, enemyW, enemyH), getHitFlashTone(enemy.uid));
          }
        } else {
          ctx.fillStyle = '#7d2b2b';
          ctx.fillRect(drawX, drawY, enemyW, enemyH);
          if (isHitFlashActive(enemy.uid)) {
            ctx.fillStyle = getHitFlashTone(enemy.uid) === 'purple' ? '#b86cff' : '#000';
            ctx.fillRect(drawX, drawY, enemyW, enemyH);
          }
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(drawX, drawY, enemyW, enemyH);
        }

        // Queue enemy HP bars to draw above all enemies
        barQueue.push({ enemy, pos, enemyH, origH, enemyW });
      }
      for (const entry of barQueue) {
        const { enemy, pos, enemyH, origH, enemyW } = entry;
        const barKey = enemy.uid;
        let barState = enemyBars.get(barKey);
        const baseW = Math.max(20, enemyW * 0.9);
        const baseH = Math.max(3, (barFillImg ? barFillImg.height : 8) * (enemyH / origH));
        if (!barState) {
          barState = {
            baseW,
            fillW: baseW,
            yellowW: baseW,
          };
          enemyBars.set(barKey, barState);
        }
        const hpRatio = enemy.maxHP ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHP)) : 0;
        const targetW = barState.baseW * hpRatio;
        barState.fillW = Math.max(targetW, barState.fillW - 180 * dt);
        barState.yellowW = Math.max(targetW, barState.yellowW - 90 * dt);

        const drawBarW = Math.max(1, Math.round(barState.baseW));
        const drawBarH = Math.max(1, Math.round(baseH));
        const barX = Math.round(pos.x - (drawBarW / 2));
        const barY = Math.round((pos.y - enemyH / 2) - (10 * layoutScale));
        const drawYellowW = Math.max(0, Math.round(barState.yellowW));
        const drawFillW = Math.max(0, Math.round(barState.fillW));

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (barBackImg) {
          ctx.drawImage(barBackImg, barX, barY, drawBarW, drawBarH);
        } else {
          ctx.fillStyle = '#222';
          ctx.fillRect(barX, barY, drawBarW, drawBarH);
        }
        if (drawYellowW > 0 && barYellowImg) {
          ctx.drawImage(barYellowImg, barX, barY, drawYellowW, drawBarH);
        } else {
          ctx.fillStyle = '#caa64b';
          ctx.fillRect(barX, barY, drawYellowW, drawBarH);
        }
        if (drawFillW > 0 && barFillImg) {
          ctx.drawImage(barFillImg, barX, barY, drawFillW, drawBarH);
        } else {
          ctx.fillStyle = '#e04b4b';
          ctx.fillRect(barX, barY, drawFillW, drawBarH);
        }
        ctx.restore();
      }
    }

    const renderDamageTexts = (filterFn) => {
      if (!dmgTexts.length) return;
      ctx.save();
      ctx.textAlign = 'center';
      for (const d of dmgTexts) {
        if (filterFn && !filterFn(d)) continue;
        const amount = Math.max(0, Number(d.amount) || 0);
        const amountT = Math.min(1, amount / 100);
        const amountScale = 0.8 + 0.45 * amountT; // 80% -> 125%
        const rise = Math.max(0.001, d.riseInSec || 0.18);
        const fade = Math.max(0.001, d.fadeSec || 0.45);
        let phaseScale = 1;
        let yOffset = 0;
        let alpha = 1;
        const peakScale = d.peakScale || 1.04;
        const heat = Math.max(0, Math.min(1, d.heat || 0));
        if (d.phase === 0) {
          const t = Math.min(1, (d.age || 0) / rise);
          const e = 1 - Math.pow(1 - t, 2); // easeOutQuad
          yOffset = 6 * (1 - e);
          alpha = Math.min(1, t / 0.6);
          if (t <= 0.7) {
            const u = t / 0.7;
            const eu = 1 - Math.pow(1 - u, 2);
            phaseScale = 0.90 + (peakScale - 0.90) * eu;
          } else {
            const u = (t - 0.7) / 0.3;
            const eu = 1 - Math.pow(1 - Math.min(1, u), 2);
            phaseScale = peakScale + (1.00 - peakScale) * eu;
          }
        } else if (d.phase === 2) {
          const t = Math.min(1, (d.age || 0) / fade);
          alpha = Math.max(0, 1 - t);
          phaseScale = 1;
        }
        const scale = amountScale * phaseScale;
        const baseFont = Math.max(12, Math.round(16 * layoutScale));
        const fontSize = Math.max(8, Math.round(baseFont * scale));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.shadowColor = 'rgb(0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = Math.max(1, Math.round(2 * scale));
        ctx.shadowOffsetY = Math.max(1, Math.round(2 * scale));
        ctx.globalAlpha = alpha;
        const text = d.targetKind === 'bar' ? `+${d.amount}` : String(d.amount);
        ctx.fillStyle = d.kind === 'heal'
          ? '#66CCFF'
          : d.kind === 'dot'
            ? '#AA66FF'
            : d.targetKind === 'hero'
              ? '#FF4040'
              : '#FFFFFF';
        const xOffset = d.targetKind === 'hero' ? -10 : 10;
        const pos = worldToCanvas((d.x || 0) + xOffset, (d.baseY != null ? d.baseY : (d.y || 0)) + yOffset);
        ctx.fillText(text, pos.x, pos.y);
      }
      ctx.restore();
    };

    // Render hero portraits (left side, saw pattern)
    {
      const g = state.globals;
      const rect = g.EnemyAreaRect;
      const heroOrder = getCombatPartyRenderRoster();
      if (rect) {
        const heroYOffset = 0;
        const enemySize = g.EnemySize || 40;
        const gap = 8;
        const availableH = rect.maxY - rect.minY;
        const heroCount = Math.max(1, heroOrder.length);
        const heroHWorld = Math.min(enemySize, (availableH - gap * Math.max(0, heroCount - 1)) / heroCount);
        const heroSpacing = heroHWorld + gap;
        const heroWByName = (img, h) => (img && img.height ? (h * (img.width / img.height)) : h);
        const baseXWorld = Math.max(heroHWorld / 2 + 12, rect.minX - enemySize * 0.9) - 90;
        const offsetWorld = heroHWorld * 0.35;
        const posByIndex = [];
        const offsets = state.globals.HeroLungeOffsetByUID || {};
        const selectorImg = heroSelectorImage || images['Selector'] || null;
        const selectorAsset = assetSizes.Selector;
        const currentHeroUID = resolveCurrentHeroUID({
          directUID: callFunctionWithContext(fnContext, 'GetCurrentTurn'),
          turnOrder: g.TurnOrderArray,
          currentTurnIndex: g.CurrentTurnIndex,
        });
        const currentHero = state.entities.find(e => e.kind === 'hero' && e.uid === currentHeroUID);
        for (let i = 0; i < heroOrder.length; i++) {
          const entry = heroOrder[i];
          const img = heroPortraitImages[entry.portraitName];
          if (!img) continue;
          const hero = state.entities.find(e => (e.kind === 'hero' || e.kind === 'escort') && e.uid === entry.uid);
          const hWorld = heroHWorld;
          const wWorld = heroWByName(img, hWorld);
          const yWorld = rect.minY + (hWorld / 2) + i * heroSpacing + heroYOffset;
          const baseX = baseXWorld + (i % 2 === 0 ? offsetWorld : -offsetWorld);
          const xWorld = baseX + (hero ? (offsets[hero.uid] || 0) : 0);
          posByIndex[entry.displaySlot] = { x: baseX, y: yWorld };
          const pos = worldToCanvas(xWorld, yWorld);
          const w = wWorld * layoutScale;
          const h = hWorld * layoutScale;
          const ampProjection = hero && hero.kind === 'hero'
            ? (callFunctionWithContext(fnContext, 'GetHeroPowerAmpRenderState', hero.uid) || null)
            : null;
          const ampActive = !!ampProjection?.active;
          const fadeActive = !!ampProjection?.fadeActive;
          const lifecycleId = Number(ampProjection?.lifecycleId || 0);
          const heroScale = Number(ampProjection?.heroScale || 1);
          if (hero && g.DebugPowerAmpLifecycle) {
            if (!g.PowerAmpScaleDebugLastByUID || typeof g.PowerAmpScaleDebugLastByUID !== 'object') {
              g.PowerAmpScaleDebugLastByUID = {};
            }
            const scaleState = String(ampProjection?.scaleState || 'normal');
            const ratio = Number(heroScale.toFixed(3));
            const lastScale = g.PowerAmpScaleDebugLastByUID[hero.uid];
            const phase = scaleState === 'active' && (!lastScale || lastScale.lifecycleId !== lifecycleId || lastScale.state !== 'active')
              ? 'scale_start'
              : 'sample';
            if (!lastScale || lastScale.state !== scaleState || lastScale.lifecycleId !== lifecycleId || Math.abs(Number(lastScale.ratio || 0) - ratio) >= 0.02) {
              console.log(
                `[POWER_AMP_SCALE] uid=${hero.uid} name=${String(hero.name || '')} ` +
                `baseline=1 ratio=${ratio} state=${scaleState} lifecycle=${lifecycleId} phase=${phase}`
              );
              g.PowerAmpScaleDebugLastByUID[hero.uid] = { state: scaleState, ratio, lifecycleId };
            }
          }
          const scaledW = w * heroScale;
          const scaledH = h * heroScale;
          const footY = pos.y + h / 2;
          const drawX = pos.x - scaledW / 2;
          const drawY = footY - scaledH;
          ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
          if (hero && isHitFlashActive(hero.uid)) {
            renderHitFlashOverlay(() => ctx.drawImage(img, drawX, drawY, scaledW, scaledH), getHitFlashTone(hero.uid));
          }

          if (ampActive) {
            const mult = Number(ampProjection?.mult || 1);
            const badgeText = `${mult}\u00d7`;
            const badgeX = pos.x;
            const badgeBottomY = footY - Math.max(2, 2 * layoutScale);
            let badgeScale = 1;
            let badgeAlpha = 1;
            const startAt = Number(ampProjection?.visualStartAt || (g.time || 0));
            const inT = Math.max(0, Math.min(1, ((g.time || 0) - startAt) / 0.22));
            badgeScale = popScale(inT) * (1 + 0.03 * Math.sin((g.time || 0) * 6));
            const bw = Math.max(24, 30 * layoutScale) * badgeScale;
            const bh = Math.max(14, 18 * layoutScale) * badgeScale;
            ctx.save();
            ctx.globalAlpha = badgeAlpha;
            ctx.fillStyle = 'rgba(82, 24, 120, 0.92)';
            ctx.strokeStyle = 'rgba(234, 214, 255, 0.88)';
            ctx.lineWidth = Math.max(1, 1.2 * layoutScale);
            ctx.fillRect(badgeX - bw / 2, badgeBottomY - bh, bw, bh);
            ctx.strokeRect(badgeX - bw / 2, badgeBottomY - bh, bw, bh);
            ctx.fillStyle = '#f8f1ff';
            ctx.font = `bold ${Math.max(10, Math.round(12 * layoutScale * badgeScale))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, badgeX, badgeBottomY - bh / 2);
            ctx.restore();
          }

          // Hero turn indicator selector (only on hero turns)
          if (shouldRenderHeroTurnSelector({
            turnPhase: state.globals.TurnPhase,
            hideHeroSelector: state.globals.HideHeroSelector,
            canPickGems: state.globals.CanPickGems,
            currentHeroUID: currentHero ? currentHero.uid : 0,
            heroUID: hero ? hero.uid : 0,
          })) {
            if (selectorImg) {
              const t = g.time || 0;
              const pulse = Math.sin(t * 6);
              const selScale = 1 + 0.035 * pulse;
              const controlScale = Math.max(0.7, Math.min(layoutScale, 1));
              const bob = 2.2 * controlScale * pulse;
              const rawSelW = (selectorAsset ? selectorAsset.width : selectorImg.width) * controlScale * selScale;
              const rawSelH = (selectorAsset ? selectorAsset.height : selectorImg.height) * controlScale * selScale;
              const selW = Math.max(12, Math.min(46, rawSelW));
              const selH = Math.max(8, Math.min(24, rawSelH));
              const selOx = selectorAsset ? selectorAsset.originX : 0.5;
              const selOy = selectorAsset ? selectorAsset.originY : 0.5;
              const targetX = pos.x;
              const targetY = pos.y - scaledH / 2 - (10 * layoutScale) + bob;
              ctx.drawImage(selectorImg, targetX - selW * selOx, targetY - selH * selOy, selW, selH);
            }
          }
        }
        state.globals.HeroPortraitPosByIndex = posByIndex;
        state.globals.HeroIconPosByIndex = posByIndex;
      }
    }

    // Render hero damage/heal text above hero sprites
    renderDamageTexts(d => d.targetKind === 'hero');

    // Render attack selectors when awaiting target selection
    if (state.globals.PendingSkillID) {
      const selectorImg = images['Selector'] || null;
      const selectorAsset = assetSizes.Selector;
      const controlScale = Math.max(0.7, Math.min(layoutScale, 1));
      const clampSelectorSize = (rawW, rawH) => ({
        w: Math.max(12, Math.min(46, rawW)),
        h: Math.max(8, Math.min(24, rawH)),
      });
      const g = state.globals;
      const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
      const center = Math.floor((g.Slots || 0) / 2);
      const pending = state.globals.PendingSkillID;
      const selectedUid = state.globals.SelectedEnemyUID || 0;
      const aliveEnemies = state.entities.filter(e => e.kind === 'enemy' && (e.hp ?? 0) > 0);
      const targets = pending === 'HERO_AOE'
        ? aliveEnemies
        : (selectedUid ? aliveEnemies.filter(e => e.uid === selectedUid) : aliveEnemies.slice(0, 1));

      for (const enemy of targets) {
        const slotIndex = enemy.slotIndex ?? 0;
        const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
        const x = enemy.x != null ? enemy.x : (g.X0 || 200);
        const y = enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing;
        const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
        const origW = enemyOrig ? enemyOrig.width : 1;
        const origH = enemyOrig ? enemyOrig.height : 1;
        const enemyH = (g.EnemySize || 40) * layoutScale;
        const enemyW = enemyH * (origW / origH);
        const pos = worldToCanvas(x, y);
        if (selectorImg) {
          const rawSelW = (selectorAsset ? selectorAsset.width : selectorImg.width) * controlScale;
          const rawSelH = (selectorAsset ? selectorAsset.height : selectorImg.height) * controlScale;
          const { w: selW, h: selH } = clampSelectorSize(rawSelW, rawSelH);
          const selOx = selectorAsset ? selectorAsset.originX : 0.5;
          const selOy = selectorAsset ? selectorAsset.originY : 0.5;
          const targetX = pos.x;
          const targetY = pos.y - enemyH / 2 - (10 * layoutScale);
          ctx.drawImage(selectorImg, targetX - selW * selOx, targetY - selH * selOy, selW, selH);
        } else {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(pos.x - enemyW / 2, pos.y - enemyH / 2, enemyW, enemyH);
          ctx.stroke();
        }
      }
    }

    // Render attack confirmation button when pending skill is set
    if (state.globals.PendingSkillID) {
      const btn = getAttackButtonBounds();
      if (btn.img) {
        ctx.drawImage(btn.img, btn.dx, btn.dy, btn.w, btn.h);
      } else {
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(btn.dx, btn.dy, btn.w, btn.h);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(btn.dx, btn.dy, btn.w, btn.h);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ATTACK', btn.dx + btn.w / 2, btn.dy + btn.h / 2 + 5);
      }
    }
    
    // Draw semi-transparent overlay when modal is visible (behind modal, on top of gameplay)
    if (gameState.overlayVisible) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw modal/nav stack in strict order
    if (gameState.overlayVisible) {
      if (modalPlane) drawBasicItem(modalPlane);
      if (closeBtnRender) drawBasicItem(closeBtnRender);
      if (closeXRender) drawBasicItem(closeXRender);
      if (navBacker) drawBasicItem(navBacker);
      for (const r of navTopRendered) {
        drawBasicItem(r);
      }
    } else {
      for(const r of modalRendered){
        drawBasicItem(r);
      }
    }

    // Render non-hero damage text above gameplay
    renderDamageTexts(d => d.targetKind !== 'hero');

    // draw HUD overlay (game state)
    drawHUD();
  }

  function getLatestCombatActionLine() {
    const g = state.globals || {};
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

  function drawHUD(){
    if (!gameState.baseSummary) return;
    const g = state.globals || {};
    const combatLogLines = [getLatestCombatActionLine()];
    const chainNum = Math.max(0, Number(g.ChainNumber || 0));
    const suppressChain = !!g.SuppressChainUI;
    const chainHideAt = Number(g.ChainUIHideAt || 0);
    const chainVisible = chainNum >= 2 && !suppressChain && (chainHideAt === 0 || Number(g.time || 0) <= chainHideAt);
    const actorIntent = typeof g.ActorIntent === 'string' && g.ActorIntent.trim() ? g.ActorIntent.trim() : 'Combat intent log';
    const order = Array.isArray(g.TurnOrderArray) ? g.TurnOrderArray : [];
    const count = order.length;
    const baseIndex = Number(g.CurrentTurnIndex || 0);
    const turnOrderLines = [];
    for (let offset = 0; offset < Math.min(6, count); offset++) {
      const idx = (baseIndex + offset) % count;
      const row = order[idx];
      if (!row) continue;
      const actor = state.entities.find(e => e.uid === row.uid);
      if (!actor) continue;
      const label = actor.name || '?';
      const baseSpd = Number(actor.stats?.SPD ?? actor.SPD ?? 0);
      const debuff = actor.kind === 'enemy' ? Number(g.EnemyDebuffs?.[actor.uid]?.SPD || 0) : 0;
      const curSpd = baseSpd - debuff;
      const extraTag = row.extra ? ' (x2)' : '';
      const cp = Number(actor.combatPower || actor.CombatPower || 0);
      const cpSuffix = actor.kind === 'enemy' ? ` CP: ${Math.round(cp)}` : '';
      turnOrderLines.push(`${label} SPD: ${Math.round(curSpd)}${cpSuffix}${extraTag}`);
    }
    const lines = [
      gameState.baseSummary,
      '',
      `TurnPhase: ${state.globals.TurnPhase}`,
      `Board: ${gameState.boardCreated ? gameState.gems.length + ' gems' : 'waiting'}`,
      `Overlay: ${gameState.overlayVisible ? 'OPEN' : 'closed'}`,
      '',
      actorIntent,
      ...combatLogLines,
      ...(chainVisible ? [`Chain x${chainNum}`] : []),
      '',
      ...turnOrderLines,
    ];
    out.textContent = lines.join('\n');
    drawGemCounterHUD();
    drawWalletHUD();
    drawAstralWalletHUD();
  }
  function drawGemCounterHUD() {
    if (!gemCounterOut) return;
    const usage = state.globals.HeroGemUsage || {};
    const byHero = usage.byHero && typeof usage.byHero === 'object' ? usage.byHero : {};
    const party = usage.party && typeof usage.party === 'object'
      ? usage.party
      : { RED: 0, GREEN: 0, BLUE: 0, HEAL: 0, YELLOW: 0 };
    const currentHeroUID = resolveCurrentHeroUID({
      directUID: callFunctionWithContext(fnContext, 'GetCurrentTurn'),
      turnOrder: state.globals.TurnOrderArray,
      currentTurnIndex: state.globals.CurrentTurnIndex,
    });
    const currentHero = state.entities.find((entity) => entity && entity.kind === 'hero' && entity.uid === currentHeroUID)
      || state.entities.find((entity) => entity && entity.kind === 'hero' && entity.uid === getHeroUIDByIndex(gameState.selectedHero))
      || state.entities.find((entity) => entity && entity.kind === 'hero')
      || null;
    const heroName = currentHero ? String(currentHero.name || 'Hero') : 'Hero';
    const heroTotals = byHero[heroName] && typeof byHero[heroName] === 'object'
      ? byHero[heroName]
      : { RED: 0, GREEN: 0, BLUE: 0, HEAL: 0, YELLOW: 0 };
    const lines = [
      'Gem Counter Radiator',
      `Hero: ${heroName}`,
      `RED:${Number(heroTotals.RED || 0)}`,
      `GREEN:${Number(heroTotals.GREEN || 0)}`,
      `BLUE:${Number(heroTotals.BLUE || 0)}`,
      `HEAL:${Number(heroTotals.HEAL || 0)}`,
      `YELLOW:${Number(heroTotals.YELLOW || 0)}`,
      '-----',
      'Party Totals',
      `RED:${Number(party.RED || 0)}`,
      `GREEN:${Number(party.GREEN || 0)}`,
      `BLUE:${Number(party.BLUE || 0)}`,
      `HEAL:${Number(party.HEAL || 0)}`,
      `YELLOW:${Number(party.YELLOW || 0)}`,
    ];
    gemCounterOut.textContent = lines.join('\n');
  }
  function drawWalletHUD() {
    if (!walletOut) return;
    const g = state.globals || {};
    const wallet =
      g.TokenWallet ||
      g.tokenWallet ||
      g.WalletTokens ||
      g.walletTokens ||
      null;
    if (!wallet || typeof wallet !== 'object') {
      walletOut.textContent = 'Wallet:\n(empty)';
      return;
    }
    const entries = Object.entries(wallet)
      .filter(([, v]) => v != null)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    if (entries.length === 0) {
      walletOut.textContent = 'Wallet:\n(empty)';
      return;
    }
    const total = entries.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
    const lines = ['Wallet:', `Gold: ${Number(g.goldTotal || 0)}`, `Tokens: ${total}`];
    for (const [key, val] of entries) {
      lines.push(`${key}: ${val}`);
    }
    walletOut.textContent = lines.join('\n');
  }
  function drawAstralWalletHUD() {
    if (!astralWalletOut) return;
    const g = state.globals || {};
    const total = Math.max(0, Number(g.AstralFlowWallet || 0));
    astralWalletOut.textContent = `Astral Flow Wallet:\nTotal: ${total}`;
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
        state.globals.CanPickGems === true &&
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
    console.error('[BOARD_INTEGRITY]', { reasonTag, gemsLength, missingCells, duplicates });
    return result;
  }
  async function auditGemClickability(reasonTag) {
    if (!isGemDebugEnabled()) return;
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
    gemDebugLog('[GEM_AUDIT]', { reasonTag, rows });
    if (inertCells.length > 0) {
      throw new Error(`[DIAG] Inert gem cells detected at ${reasonTag}: ${inertCells.length}`);
    }
  }
  async function autoPlayTurnsDev(turnCount) {
    if (!isGemDebugEnabled()) return;
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
      state.globals.CanPickGems === true &&
      state.globals.IsPlayerBusy === 0 &&
      !state.globals.PendingSkillID &&
      !state.globals.BoardFillActive &&
      !state.globals.ActionInProgress &&
      !state.globals.DeferAdvance &&
      !(gameState.refillBounce && gameState.refillBounce.active) &&
      !(gameState.yellowCasino && gameState.yellowCasino.active)
    );
  }
  function findIdleAutoplayTriplets() {
    const byColor = new Map();
    for (const gem of (gameState.gems || [])) {
      if (!gem) continue;
      const color = Number(gem.color != null ? gem.color : gem.elementIndex);
      if (!Number.isFinite(color) || color < 0 || color > 5) continue;
      if (!byColor.has(color)) byColor.set(color, []);
      byColor.get(color).push({ row: gem.cellR, col: gem.cellC });
    }
    const triplets = [];
    for (const [, cells] of byColor.entries()) {
      if (cells.length < 3) continue;
      triplets.push(cells.slice(0, 3));
    }
    return triplets;
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
      if (energy <= 0) {
        setDevAutoplayState({ active: false, stopRequested: false, lastReason: 'energy_depleted', matchesPlayed, endedAt: Number(state.globals.time || 0) });
        return getDevAutoplayState();
      }
      if (Math.max(0, Number(state.globals.PartyHP || 0)) <= 0) {
        setDevAutoplayState({ active: false, stopRequested: false, lastReason: 'party_defeated', matchesPlayed, endedAt: Number(state.globals.time || 0) });
        return getDevAutoplayState();
      }
      const aliveHeroes = state.entities.filter((entity) => entity && entity.kind === 'hero' && (entity.hp ?? 0) > 0).length;
      if (!aliveHeroes) {
        setDevAutoplayState({ active: false, stopRequested: false, lastReason: 'no_living_heroes', matchesPlayed, endedAt: Number(state.globals.time || 0) });
        return getDevAutoplayState();
      }
      const progressSig = JSON.stringify({
        energy,
        turn: Number(state.globals.DebugTurnCount || 0),
        phase: Number(state.globals.TurnPhase || 0),
        canPick: Number(state.globals.CanPickGems || 0),
        busy: Number(state.globals.IsPlayerBusy || 0),
        boardFill: Number(state.globals.BoardFillActive || 0),
        pending: String(state.globals.PendingSkillID || ''),
        gems: Array.isArray(gameState.gems) ? gameState.gems.length : 0,
        current: Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0),
      });
      if (progressSig !== lastProgressSig) {
        lastProgressSig = progressSig;
        lastProgressAt = performance.now();
      }
      if (isIdleAutoplayHeroWindow()) {
        const triplets = findIdleAutoplayTriplets();
        if (!triplets.length) {
          setDevAutoplayState({ active: false, stopRequested: false, lastReason: 'no_valid_triplet', matchesPlayed, endedAt: Number(state.globals.time || 0) });
          return getDevAutoplayState();
        }
        const pick = triplets[Math.floor(Math.random() * triplets.length)];
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
    if (!isGemDebugEnabled()) return;
    const runtimeWaitStart = performance.now();
    while (state.globals.GamePhase !== 'RUNTIME' && (performance.now() - runtimeWaitStart) < 15000) {
      await devSleep(50);
    }
    if (state.globals.GamePhase !== 'RUNTIME') return;
    const forceDeterministicBoard = () => {
      if (!Array.isArray(gameState.gems)) return;
      for (const gem of gameState.gems) {
        if (!gem) continue;
        let forcedColor = (gem.cellR + gem.cellC) % 2 === 0 ? 0 : 1;
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
    gemDebugLog('[FILL_GATE]', { stage: 'forced-yellow-before', globals: getGemGateSnapshot() });
    setControlledGates();
    gemDebugLog('[FILL_GATE]', { stage: 'forced-yellow-after', globals: getGemGateSnapshot() });
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
    const war = Math.max(0, Math.min(1, Number(gameState.mapLayout?.warMeter || 0)));
    const node = gameState.mapLayout?.encounterNode || {};
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

  // pointer handler for nav menu and overlay (more responsive than click)
  canvas.addEventListener('pointerdown', (ev)=>{
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;

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
      const close = gameState.mapLayout.closeHit;
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
      const drag = gameState.mapLayout.drag;
      drag.active = true;
      drag.pointerId = ev.pointerId;
      drag.lastX = mx;
      drag.lastY = my;
      drag.moved = 0;
      try { canvas.setPointerCapture(ev.pointerId); } catch {}
      drawFrame();
      return;
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
      const zones = (gameState.heroScreen && gameState.heroScreen.hitZones) || {};
      const roster = getHeroScreenRoster();
      const selectedHero = roster[normalizeHeroSelectionIndex()] || null;
      const controls = Array.isArray(zones.skillControls) ? zones.skillControls : [];
      let consumedSkillClick = false;
      if (selectedHero) {
        for (const control of controls) {
          if (isPointInRect(mx, my, control.plus)) {
            callFunctionWithContext(fnContext, 'AttemptHeroSkillUpgrade', selectedHero.uid, control.skillKey, 'hero_screen_plus');
            consumedSkillClick = true;
            break;
          }
          if (isPointInRect(mx, my, control.minus)) {
            callFunctionWithContext(fnContext, 'AttemptHeroSkillDowngrade', selectedHero.uid, control.skillKey, 'hero_screen_minus');
            consumedSkillClick = true;
            break;
          }
        }
      }
      if (consumedSkillClick) {
        drawFrame();
        return;
      }
      if (isPointInRect(mx, my, zones.close)) {
        layoutState.requestLayoutChange('combat', 'hero-close-button').catch((err) => {
          console.error('[LAYOUT_PHASE1] hero return failed', err);
        });
      } else if (isPointInRect(mx, my, zones.prevHero)) {
        if (roster.length) {
          gameState.selectedHero = (normalizeHeroSelectionIndex() + roster.length - 1) % roster.length;
        }
      } else if (isPointInRect(mx, my, zones.nextHero)) {
        if (roster.length) {
          gameState.selectedHero = (normalizeHeroSelectionIndex() + 1) % roster.length;
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
      const navBlockedBySelection = gameState.selectedGems.length > 0 || gameState.selectionLocked || state.globals.CanPickGems === false;
      if (labelName === 'AstralFlow' || labelName === 'Hero' || !navBlockedBySelection) {
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
    if (!gameState.overlayVisible && state.globals.PendingSkillID) {
      const btn = getAttackButtonBounds();
      if (mx >= btn.dx && mx <= btn.dx + btn.w && my >= btn.dy && my <= btn.dy + btn.h) {
        const actorUID = state.globals.PendingActor || getHeroUIDByIndex(gameState.selectedHero);
        callFunctionWithContext(fnContext, 'ExecuteSkill', state.globals.PendingSkillID, actorUID);
        state.globals.PendingSkillID = '';
        state.globals.PendingActor = 0;
        state.globals.SelectedEnemyUID = 0;
        callFunctionWithContext(fnContext, 'HideAttackUI');
        state.globals.CanPickGems = false;
        state.globals.IsPlayerBusy = 1;
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
    if (gameState.boardCreated && gameState.gems && !gameState.overlayVisible) {
      if (state.globals.GamePhase !== 'RUNTIME') {
        return;
      }
      const isHeroTurn = callFunctionWithContext(fnContext, 'IsHeroTurn') === true;
      if (state.globals.CanPickGems === false || !isHeroTurn) {
        gemDebugLog('[GEM_REJECT]', {
          reason: state.globals.CanPickGems === false ? 'reject-gate-can-pick-false' : 'reject-gate-not-hero-turn',
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
        });
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
          gemDebugLog('[GEM_ENTRY]', {
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
          });
          if (gem.color == null && gem.elementIndex != null) {
            gem.color = gem.elementIndex;
          }
          if (gem.color === 6) {
            handleSpecialGem6(gem);
            return;
          }
          if (gameState.selectionLocked && gameState.selectedGems.length < 3) {
            gameState.selectionLocked = false;
          }
          if (gameState.selectionLocked || gameState.selectedGems.length >= 3) {
            gemDebugLog('[GEM_REJECT]', {
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
            });
            return;
          }
          
          // Toggle selection
          if (gem.selected) {
            gem.selected = false;
            gameState.selectedGems = gameState.selectedGems.filter(idx => idx !== i);
            gem.Selected = 0;
          } else {
            if (gameState.selectedGems.length >= 3) {
              gemDebugLog('[GEM_REJECT]', {
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
              });
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
    if (gameState.overlayVisible) {
      const isModalObject = (type) => ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(type);
      const modalObjs = rendered.filter(r => isModalObject(r.inst.type));
      for(const r of modalObjs){
        if(mx >= r.dx && mx <= r.dx + r.w && my >= r.dy && my <= r.dy + r.h){
          // Close button or surrounding button clicked - hide overlay
          if(r.inst.type === 'UI_NavCloseX' || r.inst.type === 'UI_NavCloseButton'){
            gameState.overlayVisible = false;
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
  }, { passive: true });

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

  canvas.addEventListener('pointermove', (ev) => {
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (activeLayoutId !== 'mapLayout') return;
    const drag = gameState.mapLayout.drag;
    if (!drag.active || drag.pointerId !== ev.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const dx = mx - drag.lastX;
    drag.lastX = mx;
    drag.lastY = my;
    drag.moved += Math.abs(dx);
    const bounds = gameState.mapLayout.panBounds || { minX: 0, maxX: 0 };
    const nextPanX = gameState.mapLayout.panX + dx;
    gameState.mapLayout.panX = Math.max(bounds.minX, Math.min(bounds.maxX, nextPanX));
    gameState.mapLayout.panY = 0;
    drawFrame();
  });

  const finishMapDrag = (ev) => {
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (activeLayoutId !== 'mapLayout') return;
    const drag = gameState.mapLayout.drag;
    if (!drag.active || drag.pointerId !== ev.pointerId) return;
    drag.active = false;
    drag.pointerId = null;
    try { canvas.releasePointerCapture(ev.pointerId); } catch {}
  };
  canvas.addEventListener('pointerup', finishMapDrag);
  canvas.addEventListener('pointercancel', finishMapDrag);

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
    const refillReady =
      phaseNow === 0 &&
      !state.globals.IsPlayerBusy &&
      !state.globals.PendingSkillID &&
      !state.globals.ActionInProgress &&
      !state.globals.DeferAdvance &&
      !(refill && refill.active);
    if (hasEmpty && !refillReady) {
      const sig = JSON.stringify({
        phaseNow,
        IsPlayerBusy: state.globals.IsPlayerBusy,
        PendingSkillID: state.globals.PendingSkillID || '',
        ActionInProgress: state.globals.ActionInProgress,
        DeferAdvance: state.globals.DeferAdvance,
        refillActive: !!(refill && refill.active),
      });
      if (gameState._lastRefillBlockSig !== sig) {
        gameState._lastRefillBlockSig = sig;
        gemDebugLog('[FILL_SKIP]', {
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
        });
      }
    }
    if (
      refillReady &&
      hasEmpty
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
      !(refill && refill.active)
    ) {
      startRefillBounce();
    }
    gameState.lastTurnPhase = phaseNow;
    if (isGemDebugEnabled()) {
      const noRefillActive = !(gameState.refillBounce && gameState.refillBounce.active);
      const noSpinActive = !(gameState.yellowCasino && gameState.yellowCasino.active);
      const boardFull = Array.isArray(gameState.gems) && gameState.gems.length === 24;
      const idlePhase = state.globals.TurnPhase === 0;
      if (noRefillActive && noSpinActive && boardFull && idlePhase && state.globals.CanPickGems === false) {
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
    }
    if (
      state.globals.GamePhase === 'RUNTIME' &&
      state.globals.DeferAdvance &&
      (state.globals.time || 0) >= (state.globals.ActionLockUntil || 0)
    ) {
      const refillActive = !!(gameState.refillBounce && gameState.refillBounce.active);
      const refillPending = hasEmpty && !refillActive;
      if (refillPending) {
        // Refill must complete before advancing to the next actor.
        startRefillBounce();
        applyTurnGateIntent(createDeferredRefillHold, {
          now: Number(state.globals.time || 0),
        });
      } else {
      if (state.globals.TextAnimating) {
        applyTurnGateIntent(createDeferredTextHold, {
          now: Number(state.globals.time || 0),
        });
      } else {
        // Only block auto-advance while an action/selection is still active.
        const pendingSelect = state.globals.TurnPhase === 1 && state.globals.PendingSkillID;
        const staleBusy = state.globals.IsPlayerBusy && !state.globals.ActionInProgress && !pendingSelect;
        if (staleBusy) {
          applyTurnGateIntent(createDeferredStaleBusyRecovery);
          console.log(`[TURN] cleared stale IsPlayerBusy before advance phase=${state.globals.TurnPhase} owner=${state.globals.ActionOwnerUID || 0}`);
        }
        const mergeInFlight = !!(gameState.gemMergeFx && gameState.gemMergeFx.active);
        const blockedPhase = state.globals.IsPlayerBusy || state.globals.ActionInProgress || pendingSelect || mergeInFlight;
        const ownerUID = state.globals.ActionOwnerUID || 0;
        const currentUID = callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0;
        const ownerOk = !ownerUID || ownerUID === currentUID;
        if (!blockedPhase && ownerOk) {
          console.log(`[TURN] DeferAdvance -> AdvanceTurn owner=${ownerUID} cur=${currentUID} phase=${state.globals.TurnPhase} busy=${state.globals.IsPlayerBusy} canPick=${state.globals.CanPickGems}`);
          applyTurnGateIntent(createDeferredAdvanceResolved);
          callFunctionWithContext(fnContext, 'AdvanceTurn');
          combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
        } else if (!ownerOk) {
          if (ownerUID) {
            callFunctionWithContext(fnContext, 'ClosePowerAmpForActor', ownerUID, 'owner_mismatch_autoclose');
          }
          applyTurnGateIntent(createDeferredAdvanceResolved);
          combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
        } else if (!state.globals._DeferBlockLogged) {
          state.globals._DeferBlockLogged = 1;
          console.log(`[TURN] DeferAdvance blocked pendingSelect=${!!pendingSelect} mergeInFlight=${mergeInFlight} IsPlayerBusy=${state.globals.IsPlayerBusy} TurnPhase=${state.globals.TurnPhase} owner=${ownerUID} cur=${currentUID} canPick=${state.globals.CanPickGems} actionInProgress=${state.globals.ActionInProgress}`);
        }
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
      const noLivingHeroes = state.entities.filter((entity) => entity && entity.kind === 'hero' && (entity.hp ?? 0) > 0).length <= 0;
      if (energy < 0 || partyHp <= 0 || noLivingHeroes) {
        gameState.combatFailExitRequested = true;
        state.globals.CanPickGems = 0;
        state.globals.IsPlayerBusy = 1;
        layoutState.requestLayoutChange((partyHp <= 0 || noLivingHeroes) ? 'town' : 'storyMock', energy < 0 ? 'combat-energy-depleted' : 'combat-party-defeated').catch((err) => {
          gameState.combatFailExitRequested = false;
          console.error('[LAYOUT_PHASE1] combat fail gate layout transition failed', err);
        });
      }
    }
    const noRefillActive = !(gameState.refillBounce && gameState.refillBounce.active);
    if (
      state.globals.GamePhase === 'RUNTIME' &&
      currentTurnType === 0 &&
      state.globals.TurnPhase === 0 &&
      noRefillActive &&
      (state.globals.CanPickGems !== true || state.globals.BoardFillActive !== 0)
    ) {
      state.globals.CanPickGems = true;
      state.globals.BoardFillActive = 0;
      if (isGemDebugEnabled()) {
        gemDebugLog('[TURN_RESTORE_PICK]', {
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
        });
      }
    }
    // Enemy turns are started by ProcessTurn; avoid double-triggering here.
    gameState.enemyTurnKicked = state.globals.TurnPhase === 2;
    updateIdleFarmEmissions(performance.now() / 1000);
    persistHeroGemProgressIfDirty();
    drawFrame();
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
          panX: Number(gameState.mapLayout.panX || 0),
          panY: Number(gameState.mapLayout.panY || 0),
          warMeter: Number(gameState.mapLayout.warMeter || 0),
          encounterNode: gameState.mapLayout.encounterNode || null,
          render: gameState.mapLayout.lastRender || null,
          encounterRequestPreview: deriveEncounterRequestFromMapState(),
        },
        heroScreen: {
          selectedHero: Number(gameState.selectedHero || 0),
          activeHeroName: (() => {
            const roster = getHeroScreenRoster();
            const idx = normalizeHeroSelectionIndex();
            const hero = roster[idx];
            return hero ? String(hero.name || '') : '';
          })(),
        },
        flags: {
          canPickGems: state.globals.CanPickGems,
          isPlayerBusy: state.globals.IsPlayerBusy,
          turnPhase: state.globals.TurnPhase ?? 0,
          deferAdvance: state.globals.DeferAdvance ?? 0,
          actionLockUntil: state.globals.ActionLockUntil ?? 0,
          pendingSkillId: state.globals.PendingSkillID || null,
          overlayVisible: gameState.overlayVisible,
          layoutId: layoutState && typeof layoutState.getActiveLayoutId === 'function'
            ? layoutState.getActiveLayoutId()
            : (layoutHarnessEnabled && harnessLayoutState ? harnessLayoutState.getActiveLayoutId() : 'combat'),
          combatAcceptEvents: layoutHarnessEnabled && harnessCombatGateway
            ? harnessCombatGateway.canAcceptEvents()
            : true,
        },
        heroes: state.entities
          .filter(e => e.kind === 'hero')
          .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, combatPower: Number(e.combatPower || 0) })),
        enemies: state.entities
          .filter(e => e.kind === 'enemy')
          .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, slot: e.slotIndex, combatPower: Number(e.combatPower || 0) })),
        gems: (gameState.gems || []).map(g => ({
          uid: g.uid,
          r: g.cellR,
          c: g.cellC,
          color: g.color ?? g.elementIndex,
          x: g.x,
          y: g.y,
          selected: !!(g.selected || g.Selected),
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
        const prev = gameState.mapLayout.encounterNode || {};
        const next = {
          id: String(node.id || prev.id || 'clouds-alpha'),
          locale: String(node.locale || prev.locale || 'clouds').trim().toLowerCase() || 'clouds',
          faction: String(node.faction || prev.faction || 'wishless').trim().toLowerCase() || 'wishless',
        };
        gameState.mapLayout.encounterNode = next;
        if (node.warMeter != null) {
          gameState.mapLayout.warMeter = Math.max(0, Math.min(1, Number(node.warMeter || 0)));
        }
        return {
          encounterNode: gameState.mapLayout.encounterNode,
          warMeter: Number(gameState.mapLayout.warMeter || 0),
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
