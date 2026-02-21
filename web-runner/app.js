import { state } from './modules/state.js';
import { createContext, callFunctionWithContext } from './modules/functionRegistry.js';
import { CombatRuntimeGateway } from '../src/core/combatRuntimeGateway.js';

const out = document.getElementById('output');
const walletOut = document.getElementById('wallet-output');
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
  if (typeof window === 'undefined') return false;
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
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('startup_debug') || params.get('startup_debug') === 'true';
  } catch {
    return false;
  }
})();
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
  const hero = state.entities.find(e => e.kind === 'hero' && e.heroIndex === idx);
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
    returnButton: { x: 14, y: 14, w: 112, h: 30 },
    warMeter: 0.64,
    lastRender: null,
  },
  refillBounce: {
    active: false,
    queue: [],
    index: 0,
    current: null,
  },
  storyCardLine: {
    text: 'What happened?',
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
  task015Trace: {
    storycardPlacement: [],
    yellowQueue: [],
    yellowRefillQueue: [],
    yellowWrites: [],
    yellowAnimation: [],
  },
  lastTurnPhase: null,
  baseSummary: '',
};

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

async function fetchJson(url){
  try{ const r = await fetch(url); if(!r.ok) return null; return await r.json(); }
  catch(e){ return null }
}

function assetUrl(path){
  return new URL(`./assets/${path}`, window.location.href).toString();
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

function initEntities(enemyRows, layoutInstances) {
  assertCombatLayoutDev('initEntities');
  state.entities = [];
  state.globals.EnemyData = enemyRows || [];

  const partyHP = [];
  const partyMaxHP = [];
  for (let i = 0; i < 4; i++) {
    const v = CANONICAL_HERO_ROSTER[i];
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
      name: v.name,
      hp,
      maxHP: partyMaxHP[i],
      stats: {
        ATK: Number(v.ATK),
        DEF: Number(v.DEF),
        MAG: Number(v.MAG),
        RES: Number(v.RES),
        SPD: Number(v.SPD),
      },
      heroIndex: i,
      attackType: v.attackType,
      isAlive: true,
    });
    startupDebugLog(`[HP_FIX] hero=${v.name} maxHP=${maxHP}`);
  }

  gameState.partyHP = partyHP;
  gameState.partyMaxHP = partyMaxHP;
  // Ensure enemy UIDs don't collide with hero UIDs
  state.globals.NextUID = state.entities.reduce((max, e) => Math.max(max, e.uid || 0), 0) + 1;

  if (enemyRows && enemyRows.length) {
    state.globals.InitialSpawn = 1;
    const shuffled = enemyRows.slice().sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 3);
    for (let i = 0; i < picks.length; i++) {
      callFunctionWithContext(fnContext, 'SpawnEnemy', {
        name: picks[i].name,
        HP: Number(picks[i].HP || 0),
        ATK: Number(picks[i].ATK || 0),
        DEF: Number(picks[i].DEF || 0),
        MAG: Number(picks[i].MAG || 0),
        RES: Number(picks[i].RES || 0),
        SPD: Number(picks[i].SPD || 0),
      }, i);
    }
    state.globals.InitialSpawn = 0;
  }

  if (state.globals.BattleStartMode == null) {
    state.globals.BattleStartMode = Math.random() < 0.5 ? 'ambush' : 'initiative';
  }

  if (!state.globals.BattleStartShown) {
    state.globals.BattleStartShown = 1;
    const msg = state.globals.BattleStartMode === 'ambush'
      ? 'Ambushed by enemy team!'
      : 'Heroes surprised the enemies!';
    state.globals.BattleStartText = msg;
    state.globals.BattleStartActive = 1;
    state.globals.BattleStartProcessStarted = 0;
    state.globals.BattleStartEndsAt = 2.0;
    state.globals.BattleStartFadeEndsAt = 2.4;
    state.globals.IsPlayerBusy = 1;
    state.globals.CanPickGems = 0;
  }
  callFunctionWithContext(fnContext, 'InitPartyHPFromHeroes');
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
function createGemBoard(gridBounds = null) {
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
  const rollReward = Math.random() < 0.5 ? 'gold' : 'energy';
  if (rollReward === 'gold') {
    const goldOptions = [10, 15, 20];
    const amt = goldOptions[Math.floor(Math.random() * goldOptions.length)];
    g.goldTotal = (g.goldTotal || 0) + amt;
    callFunctionWithContext(fnContext, 'LogCombat', `${actorName} found ${amt} gold!`);
    callFunctionWithContext(fnContext, 'SpawnDamageText', amt, gem.x, gem.y, 'damage');
  } else {
    const energyOptions = [6, 12, 15];
    const amt = energyOptions[Math.floor(Math.random() * energyOptions.length)];
    const next = (g.Player_Energy || 0) + amt;
    g.Player_Energy = next;
    callFunctionWithContext(fnContext, 'LogCombat', `${actorName} gained ${amt} energy!`);
    callFunctionWithContext(fnContext, 'SpawnDamageText', amt, gem.x, gem.y, 'heal');
  }
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

const YELLOW_COLOR = 3;
const YELLOW_CASINO_TELEGRAPH_SEC = 0.15;
const yellowMatchAnimationDuration = 0.4;
const YELLOW_CASINO_SPIN_SEC = yellowMatchAnimationDuration;
const YELLOW_CASINO_TARGETS = [0, 1, 2, 4, 5];
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

function buildYellowCasinoSequence(targetFrame) {
  const idx = YELLOW_CASINO_WALK.indexOf(targetFrame);
  const seq = [];
  seq.push(YELLOW_CASINO_WALK[0]);
  for (let i = 1; i < YELLOW_CASINO_WALK.length; i++) {
    seq.push(YELLOW_CASINO_WALK[i]);
  }
  for (let i = 0; i <= idx; i++) {
    seq.push(YELLOW_CASINO_WALK[i]);
  }
  return seq;
}

function startYellowCasinoSequence(actorUID) {
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
      if (gem && color === YELLOW_COLOR) {
        queue.push({
          type: 'yellow',
          reason: 'yellow-reassign',
          uid: gem.uid,
          cellC: c,
          cellR: r,
          target: pickYellowCasinoTarget(),
          sequence: null,
          startAt: 0,
          duration: YELLOW_CASINO_SPIN_SEC,
          frameDuration: 0,
        });
      }
    }
  }

  const hasWork = queue.length > 0;
  traceTask015YellowQueue(queue);
  traceTask015YellowAnimation('yellow-sequence-start', {
    queueLength: Number(queue.length),
    hasWork: Boolean(hasWork),
  });
  casino.active = hasWork;
  casino.phase = hasWork ? 'telegraph' : 'idle';
  casino.queue = queue;
  casino.index = 0;
  casino.current = null;
  casino.telegraphUntil = now + YELLOW_CASINO_TELEGRAPH_SEC;
  casino.ghost = null;
  casino.emptyTelegraph = [];

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
    state.globals.ActionLockUntil = now + Math.max(0.1, totalDuration);
    state.globals.DeferAdvance = 1;
    state.globals.AdvanceAfterAction = 1;
    state.globals.ActionOwnerUID = actorUID;
  } else {
    traceTask015YellowAnimation('yellow-sequence-skip', { reason: 'no-yellow-gems' });
    startRefillBounce();
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
    state.globals.CanPickGems = false;
    state.globals.IsPlayerBusy = 1;
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

  const startGemMergeFx = () => {
    const now = state.globals.time || 0;
    const items = (gameState.selectedGems || []).map(idx => {
      const gm = gameState.gems && gameState.gems[idx];
      if (!gm) return null;
      return { x: gm.x, y: gm.y, color: gm.color ?? gm.elementIndex };
    }).filter(Boolean);
    if (!items.length) return;
    gameState.gemMergeFx = {
      active: true,
      startAt: now,
      duration: 0.28,
      items,
      doneAt: null,
    };
  };

  if (color === 0 || color === 1) {
    g.TurnPhase = 1;
    callFunctionWithContext(fnContext, 'UpdateChain', color);
    g.IsAOEMatch = 0;
    callFunctionWithContext(fnContext, 'ResolveGemAction', color, actorUID);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    g.ApplyChainToNextDamage = g.ChainNumber >= 2 ? 1 : 0;
  } else if (color === 2) {
    startGemMergeFx();
    g.MatchedColorValue = 0;
    g.IsAOEMatch = 0;
    g.SuppressChainUI = 0;
    callFunctionWithContext(fnContext, 'UpdateChain', 2);
    callFunctionWithContext(fnContext, 'ResolveGemAction', 2, actorUID);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    g.ApplyChainToNextDamage = 0;
  } else if (color === 3) {
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    startYellowCasinoSequence(actorUID);
  } else if (color === 4) {
    g.MatchedColorValue = 4;
    g.IsAOEMatch = 0;
    callFunctionWithContext(fnContext, 'UpdateChain', 4);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    callFunctionWithContext(fnContext, 'ResolveGemAction', 4, actorUID);
  } else if (color === 5) {
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'ResolveGemAction', 5, actorUID);
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
  async function loadC3ProjectAssets() {
    assertCombatLayoutDev('loadC3ProjectAssets');
    runtimeLayouts = await fetchJson(assetUrl('layouts.json')) || {};
    layout = runtimeLayouts.layout || { name: 'runtime-fallback', layers: [] };
    startupDebugLog('[LAYOUT_AUDIT] topLevelKeys', Object.keys(layout || {}));
    startupDebugLog('[INIT] Layout loaded');
    assetsLayout = runtimeLayouts.assetsLayout || null;

    const project = runtimeLayouts.project || { viewportWidth: 360, viewportHeight: 640 };
    viewW = project && project.viewportWidth ? project.viewportWidth : 360;
    viewH = project && project.viewportHeight ? project.viewportHeight : 640;
    startupDebugLog('[INIT] Project viewport:', viewW, 'x', viewH);

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

    const enemies = await fetchJson(assetUrl('enemies.json'));
    enemyRows = parseC2ArrayTable(enemies);
    gameState.baseSummary = summaryText(layout, types, enemies);
    out.textContent = gameState.baseSummary + '\n\nLoading images...';

    images = {};
    enemySpriteImages = {};
    heroPortraitImages = {};
    heroSelectorImage = null;
    gemFrameImages = [];
    buffIconFrameImages = {};
    debuffIconImages = {};
    mapBackgroundImage = null;
    let loadedCount = 0;
    const failedImages = [];
    const loadBaseSprites = async () => {
      for(const [t,data] of Object.entries(types)){
        try {
          const pluginId = data && data['plugin-id'];
          if (pluginId && pluginId !== 'Sprite') continue;
          let animName = null;
          try{ animName = data.animations && data.animations.items && data.animations.items[0] && data.animations.items[0].name; } catch(e){}
          const imgPath = makeImagePath(t, animName);
          if(imgPath){
            const img = await loadImage(imgPath);
            if(img) {
              images[t] = img;
              loadedCount++;
              if(['UI_NavCloseButton', 'UI_NavCloseX', 'UI_CloseWin'].includes(t)) {
                startupDebugLog(`[LOAD] SUCCESS: ${t} loaded from ${imgPath}`);
              }
            } else {
              failedImages.push({type: t, path: imgPath, anim: animName});
              if(['UI_NavCloseButton', 'UI_NavCloseX', 'UI_CloseWin'].includes(t)) {
                console.log(`[LOAD] FAILED: ${t} from ${imgPath}`);
              }
            }
          }
        } catch(e) {
          console.warn(`[LOAD] Failed to load image for type ${t}:`, e.message);
        }
      }
    };

    const loadCoreVisuals = async () => {
      heroPortraitImages.Falie = await loadImage(assetUrl('images/Falie.png'));
      heroPortraitImages.Huun = await loadImage(assetUrl('images/Huun.png'));
      heroPortraitImages.Runa = await loadImage(assetUrl('images/Runa.png'));
      heroPortraitImages.Kojonn = await loadImage(assetUrl('images/Kojonn.png'));
      heroSelectorImage = await loadImage(assetUrl('images/h_selector-animation 1-000.png'));
      for (let i = 0; i < 8; i++) {
        const imgPath = assetUrl(`images/gem-animation 1-${String(i).padStart(3, '0')}.png`);
        const img = await loadImage(imgPath);
        if (img) gemFrameImages[i] = img;
      }
      mapBackgroundImage = await loadImage(assetUrl('images/map-layout.png'));
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
      await loadBaseSprites();
      await loadCoreVisuals();
      console.log(`[LOAD] Core assets loaded: ${loadedCount}/${Object.keys(types).length} base sprites`);
      if(failedImages.length > 0) {
        console.log(`[LOAD] Failed images (first 5):`, failedImages.slice(0, 5).map(f => `${f.type}(${f.path})`).join(', '));
      }
      setTimeout(() => {
        loadDeferredVisuals().catch(e => console.error('[LOAD] Deferred asset preload error:', e));
      }, 0);
    } catch(e) {
      console.error(`[LOAD] Error during image preload:`, e);
    }

    rebuildRenderedCache();
    startupDebugLog('[INIT] Processing instances...');
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
      allowedTransitions: ['base', 'shop', 'intro', 'astralOverlay', 'mapLayout'],
      async onEnter({ resumeSnapshot }) {
        const hasRuntimeData =
          Array.isArray(instances) && instances.length > 0 &&
          types && Object.keys(types).length > 0 &&
          Array.isArray(enemyRows) && enemyRows.length > 0;
        const needsBootstrap = !freshCombatBootstrapped || !hasRuntimeData;

        validateCombatSnapshot(resumeSnapshot || null, 'onEnter', 'x->1');
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
          assertCombatLayoutDev('StartRound');
          callFunctionWithContext(fnContext, 'StartRound');
          freshCombatBootstrapped = true;
          COMBAT_BOOTSTRAP_COMPLETE = true;
        }
        gateway.resume(resumeSnapshot || null);
        if (needsBootstrap) {
          initEntities(enemyRows, instances);
          createGemBoard(gridBounds);
          if (isGemDebugEnabled()) {
            setTimeout(() => {
              runGemInteractivityDiagnostic().catch((err) => {
                console.error('[DIAG] Gem interactivity diagnostic failed:', err);
              });
            }, 1000);
          }
        }
        initializeStoryCardLayout('layout1-active');
        eventBus.emit('layout:combat:entered', { restored: Boolean(resumeSnapshot) });
      },
      onActive() {},
      onExit({ to }) {
        gameState.storyCardLayout.initialized = false;
        const snapshot = gateway.suspend();
        const transitionLabel = to === 'astralOverlay' ? '1->2' : '1->x';
        validateCombatSnapshot(snapshot, 'onExit', transitionLabel);
        return snapshot;
      },
    });
    layoutState.registerLayout({
      id: 'mapLayout',
      allowedTransitions: ['combat'],
      onEnter() {
        gameState.overlayVisible = false;
        gameState.mapLayout.panY = 0;
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
      allowedTransitions: ['combat'],
      onEnter() {},
      onActive() {},
      onExit() { return null; },
    });
    layoutState.registerLayout({
      id: 'astralOverlay',
      allowedTransitions: ['combat'],
      onEnter() {
        gameState.overlayVisible = false;
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
      await layoutState.requestLayoutChange('astralOverlay', 'nav-astral-flow');
      return;
    }
    gameState.overlayVisible = true;
  });
  eventBus.on('layout:storyMock:click', async () => {
    if (layoutState.getActiveLayoutId() !== 'storyMock') return;
    console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '0->1', trigger: 'blue-click' });
    await layoutState.requestLayoutChange('combat', 'story-blue-click');
  });
  eventBus.on('layout:astralOverlay:click', async () => {
    if (layoutState.getActiveLayoutId() !== 'astralOverlay') return;
    console.log('[LAYOUT_PHASE1]', { stage: 'entry', transition: '2->1', trigger: 'red-click' });
    await layoutState.requestLayoutChange('combat', 'overlay-red-click');
  });

  if (layoutHarnessEnabled) {
    debugLayoutLog('[Harness] Enabled');
  }

  await layoutState.activateInitialLayout('storyMock');

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
      allowedTransitions: ['astralOverlay'],
      onEnter({ resumeSnapshot }) {
        const snapshot = resumeSnapshot || null;
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
      allowedTransitions: ['combat'],
      onEnter() {
        gameState.overlayVisible = false;
        debugLayoutLog('[Harness] storyMock active');
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
    harnessLayoutState.registerLayout(astralOverlayLayout);
    debugLayoutLog('[Harness] Layouts registered: storyMock, astralOverlay');

    harnessEventBus.on('layout:storyMock:click', async () => {
      await harnessLayoutState.requestLayoutChange('combat', 'storyMock-click', { source: 'storyMock' });
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
    const hero = state.entities.find(e => e.kind === 'hero' && e.heroIndex === idx);
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

      const btn = gameState.mapLayout.returnButton;
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(btn.x, btn.y + 24, btn.w, btn.h);
      ctx.strokeStyle = '#1b1f23';
      ctx.strokeRect(btn.x, btn.y + 24, btn.w, btn.h);
      ctx.fillStyle = '#111';
      ctx.font = '600 12px Arial';
      ctx.fillText('Return Combat', btn.x + 10, btn.y + 43);
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 14px Arial';
      ctx.fillText('Map Layout (drag to pan)', 14, viewHeight - 18);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = layoutId === 'storyMock' ? '#1557ff' : '#d52525';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      layoutId === 'storyMock' ? 'Story Mock (click to enter combat)' : 'Astral Overlay (click to return to combat)',
      (canvas.width / dpr) / 2,
      (canvas.height / dpr) / 2
    );
    ctx.textAlign = 'left';
  }
  
  // helper function to draw all instances
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
      return;
    }

    const now = performance.now();
    const dt = dtOverride != null
      ? dtOverride
      : Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    lastFrameTime = now;
    if (!state.globals.time) state.globals.time = 0;
    state.globals.time += dt;
    if (state.globals.RegenTickCounter == null) state.globals.RegenTickCounter = 0;
    if (state.globals.RegenTickTimer == null) state.globals.RegenTickTimer = 0;
    // Enemy DoT ticks removed (DoT feature disabled)
    // Party Regen ticks (Kojonn light green effect)
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
            console.log(`[REGEN] tick=${tickNow} healReq=${heal} actual=${actualHeal} hp=${afterHP}/${state.globals.PartyMaxHP || 0} firesLeft=${regen.remainingFires - 1}`);
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
    }
    if (state.globals.BattleStartActive) {
      const t = state.globals.time;
      const fadeEnd = state.globals.BattleStartFadeEndsAt ?? 2.4;
      if (t >= fadeEnd) {
        state.globals.BattleStartActive = 0;
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
            if (!item.sequence) item.sequence = buildYellowCasinoSequence(item.target);
            item.startAt = nowTime;
            item.frameDuration = item.sequence.length > 1
              ? item.duration / (item.sequence.length - 1)
              : item.duration;
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
          const seq = item.sequence || [YELLOW_COLOR];
          const frameIdx = item.frameDuration > 0
            ? Math.min(seq.length - 1, Math.floor(elapsed / item.frameDuration))
            : seq.length - 1;
          const frame = seq[frameIdx];
          if (item.type === 'yellow') {
            const gem = getGemByUid(item.uid);
            if (!gem) {
              casino.index += 1;
              startNext();
            } else {
              gem.color = frame;
              gem.elementIndex = frame;
              if (elapsed >= item.duration) {
                gem.color = item.target;
                gem.elementIndex = item.target;
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
            const pos = getCellWorldPos(item.cellC, item.cellR);
            casino.ghost = { x: pos.x, y: pos.y, w: pos.w, h: pos.h, frame };
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
                casino.index += 1;
                casino.current = null;
              }
            }
          }
          if (!casino.current && casino.index >= casino.queue.length) {
            casino.active = false;
            casino.phase = 'idle';
            casino.ghost = null;
            const refill = gameState.refillBounce;
            const canRestorePickability =
              !(refill && refill.active) &&
              state.entities.length > 0 &&
              state.globals.TurnPhase === 0 &&
              state.globals.IsPlayerBusy === 0 &&
              (state.globals.ActionLockUntil || 0) <= (state.globals.time || 0);
            if (canRestorePickability) {
              state.globals.CanPickGems = true;
              state.globals.BoardFillActive = 0;
              state.globals.DeferAdvance = 0;
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
            state.globals.IsPlayerBusy = 0;
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
          state.globals.IsPlayerBusy = 0;
          state.globals.CanPickGems = true;
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
        const ampMult = Number(hit.powerAmpMultiplier || 0);
        const finalDmg = ampMult > 0 ? Math.max(1, Math.ceil((hit.dmg || 0) * ampMult)) : hit.dmg;
        if (state.globals.DebugPowerAmp && hit.consumePowerAmp && ampMult > 0) {
          const heroName = hit.heroName || 'Hero';
          const heroType = hit.heroType || 'melee';
          const calcPath = hit.calcPath || (heroType === 'magic' ? 'magicCalc' : 'meleeCalc');
          console.log(
            `[POWER_AMP] hero=${hit.heroUID} name=${heroName} type=${heroType} path=${calcPath} ` +
            `base=${hit.dmg} amp=${ampMult} final=${finalDmg}`
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
    if (state.globals.PowerAmpFadeByUID && typeof state.globals.PowerAmpFadeByUID === 'object') {
      const now = state.globals.time || 0;
      for (const [uid, fade] of Object.entries(state.globals.PowerAmpFadeByUID)) {
        if (!fade) continue;
        const duration = fade.duration || 0.16;
        if (now >= (fade.startAt || 0) + duration) {
          delete state.globals.PowerAmpFadeByUID[uid];
        }
      }
    }
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
          ctx.save();
          ctx.globalAlpha = liveLine.animAlpha;
          ctx.fillText(text, storySlot.x + Math.max(10, Math.round(12 * layoutScale)), storySlot.y + (storySlot.h * 0.58));
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
          text = 'What happened?';
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
          } else if (t >= 0) {
            scale = 1 + (0.12 * Math.sin(Math.PI * t));
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
    if (gameState.yellowCasino && gameState.yellowCasino.phase === 'telegraph') {
      const slots = gameState.yellowCasino.emptyTelegraph || [];
      if (slots.length) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, Math.round(3 * layoutScale));
        for (const slot of slots) {
          const pos = worldToCanvas(slot.x, slot.y);
          const w = slot.w * layoutScale;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, w * 0.48, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
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
      const centerX = layoutOffsetX + (layoutW * layoutScale) / 2;
      const centerY = layoutOffsetY + (layoutH * layoutScale) / 2 - 40;
      const baseSize = boardGeometry.cellSize * layoutScale * 0.5;
      const fade = t > 0.8 ? Math.max(0, 1 - ((t - 0.8) / 0.2)) : 1;
      const scale = t > 0.8 ? Math.max(0.05, 1 - ((t - 0.8) / 0.2)) : 1;
      for (const item of merge.items || []) {
        const pos = worldToCanvas(item.x, item.y);
        const x = pos.x + (centerX - pos.x) * e;
        const y = pos.y + (centerY - pos.y) * e;
        const frameIndex = (item.color ?? 0) % 8;
        const gemImg = gemFrameImages[frameIndex];
        if (!gemImg) continue;
        const w = baseSize * scale;
        const h = baseSize * scale;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.drawImage(gemImg, x - w * 0.5, y - h * 0.5, w, h);
        ctx.restore();
      }
      if (t >= 1) {
        merge.active = false;
        merge.doneAt = nowTime;
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

    if (state.globals.BattleStartActive) {
      const showUntil = state.globals.BattleStartEndsAt ?? 2.0;
      const fadeEnd = state.globals.BattleStartFadeEndsAt ?? (showUntil + 0.4);
      const t = state.globals.time || 0;
      const alpha = t <= showUntil ? 1 : Math.max(0, 1 - ((t - showUntil) / Math.max(0.001, fadeEnd - showUntil)));
      const text = state.globals.BattleStartText || '';
      if (text) {
        const centerX = layoutOffsetX + (layoutW * layoutScale) / 2;
        const baseY = partyBar ? (partyBar.dy - (20 * layoutScale)) : (layoutOffsetY + (layoutH * layoutScale) * 0.45);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#111';
        ctx.font = `${Math.round(18 * layoutScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(text, centerX, baseY);
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
        if (sprite) {
          ctx.drawImage(sprite, pos.x - enemyW / 2, pos.y - enemyH / 2, enemyW, enemyH);
        } else {
          ctx.fillStyle = '#7d2b2b';
          ctx.fillRect(pos.x - enemyW / 2, pos.y - enemyH / 2, enemyW, enemyH);
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(pos.x - enemyW / 2, pos.y - enemyH / 2, enemyW, enemyH);
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

        const barX = pos.x - barState.baseW / 2;
        const barY = (pos.y - enemyH / 2) - (10 * layoutScale);
        if (barBackImg) {
          ctx.drawImage(barBackImg, barX, barY, barState.baseW, baseH);
        } else {
          ctx.fillStyle = '#222';
          ctx.fillRect(barX, barY, barState.baseW, baseH);
        }
        if (barYellowImg) {
          ctx.drawImage(barYellowImg, barX, barY, barState.yellowW, baseH);
        } else {
          ctx.fillStyle = '#caa64b';
          ctx.fillRect(barX, barY, barState.yellowW, baseH);
        }
        if (barFillImg) {
          ctx.drawImage(barFillImg, barX, barY, barState.fillW, baseH);
        } else {
          ctx.fillStyle = '#e04b4b';
          ctx.fillRect(barX, barY, barState.fillW, baseH);
        }
      }
    }

    const renderDamageTexts = (filterFn) => {
      if (!dmgTexts.length) return;
      ctx.save();
      ctx.textAlign = 'center';
      const lerp = (a, b, t) => a + (b - a) * t;
      const lerpColor = (c0, c1, t) => {
        const r = Math.round(lerp(c0[0], c1[0], t));
        const g = Math.round(lerp(c0[1], c1[1], t));
        const b = Math.round(lerp(c0[2], c1[2], t));
        return `rgb(${r}, ${g}, ${b})`;
      };
      const heatColor = (h, ramp) => {
        if (h <= 0.33) return lerpColor(ramp[0], ramp[1], h / 0.33);
        if (h <= 0.66) return lerpColor(ramp[1], ramp[2], (h - 0.33) / 0.33);
        return lerpColor(ramp[2], ramp[3], (h - 0.66) / 0.34);
      };
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
        ctx.shadowColor = 'rgba(30,30,30,0.8)';
        ctx.shadowBlur = Math.max(3, 6 * scale);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha = alpha;
        const text = d.targetKind === 'bar' ? `+${d.amount}` : String(d.amount);
        if (d.kind === 'heal') {
          const ramp = [
            [255, 255, 255],
            [184, 242, 166],
            [120, 220, 120],
            [120, 220, 220]
          ];
          ctx.fillStyle = heatColor(heat, ramp);
        } else {
          const ramp = [
            [255, 255, 255],
            [255, 235, 120],
            [255, 170, 80],
            [255, 80, 80]
          ];
          ctx.fillStyle = heatColor(heat, ramp);
        }
        if (d.kind === 'damage' && d.targetKind === 'hero') {
          ctx.fillStyle = 'rgb(255, 80, 80)';
        }
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
        const heroOrder = [
        { name: 'Falie', idx: 0 },
        { name: 'Huun', idx: 1 },
        { name: 'Runa', idx: 2 },
        { name: 'Kojonn', idx: 3 },
      ];
      if (rect) {
        const heroYOffset = 0;
        const enemySize = g.EnemySize || 40;
        const gap = 8;
        const availableH = rect.maxY - rect.minY;
        const heroHWorld = Math.min(enemySize, (availableH - gap * 3) / 4);
        const heroSpacing = heroHWorld + gap;
        const heroWByName = (img, h) => (img && img.height ? (h * (img.width / img.height)) : h);
        const baseXWorld = Math.max(heroHWorld / 2 + 12, rect.minX - enemySize * 0.9) - 90;
        const offsetWorld = heroHWorld * 0.35;
        const posByIndex = [];
        const offsets = state.globals.HeroLungeOffsetByUID || {};
        const selectorImg = heroSelectorImage || images['Selector'] || null;
        const selectorAsset = assetSizes.Selector;
        const currentHeroUID = callFunctionWithContext(fnContext, 'GetCurrentTurn');
        const currentHero = state.entities.find(e => e.kind === 'hero' && e.uid === currentHeroUID);
        for (let i = 0; i < heroOrder.length; i++) {
          const entry = heroOrder[i];
          const img = heroPortraitImages[entry.name];
          if (!img) continue;
          const hero = state.entities.find(e => e.kind === 'hero' && e.heroIndex === entry.idx);
          const hWorld = heroHWorld;
          const wWorld = heroWByName(img, hWorld);
          const yWorld = rect.minY + (hWorld / 2) + i * heroSpacing + heroYOffset;
          const baseX = baseXWorld + (i % 2 === 0 ? offsetWorld : -offsetWorld);
          const xWorld = baseX + (hero ? (offsets[hero.uid] || 0) : 0);
          posByIndex[entry.idx] = { x: baseX, y: yWorld };
          const pos = worldToCanvas(xWorld, yWorld);
          const w = wWorld * layoutScale;
          const h = hWorld * layoutScale;
          const ampStore = g.PowerAmpByUID || {};
          const ampVisuals = g.PowerAmpVisualByUID || {};
          const ampFades = g.PowerAmpFadeByUID || {};
          const visual = hero ? ampVisuals[hero.uid] : null;
          const fade = hero ? ampFades[hero.uid] : null;
          const storeEntry = hero ? ampStore[hero.uid] : null;
          const storeMult = Number(storeEntry?.mult || 0);
          const ampActive = !!visual || (!!hero && storeMult > 0);
          let heroScale = 1;
          if (ampActive) {
            const startAt = visual ? (visual.startAt || 0) : (g.time || 0);
            const tIn = Math.max(0, Math.min(1, ((g.time || 0) - startAt) / 0.18));
            const eIn = 1 - Math.pow(1 - tIn, 2);
            heroScale = 1 + (1.3 - 1) * eIn;
          }
          const scaledW = w * heroScale;
          const scaledH = h * heroScale;
          const footY = pos.y + h / 2;
          ctx.drawImage(img, pos.x - scaledW / 2, footY - scaledH, scaledW, scaledH);

          const fadeActive = !!(
            hero &&
            !ampActive &&
            fade &&
            (g.time || 0) < ((fade.startAt || 0) + (fade.duration || 0.16))
          );
          if (ampActive || fadeActive) {
            const mult = ampActive
              ? (visual?.mult || storeMult || 1)
              : (fade?.mult || 1);
            const badgeText = `${mult}\u00d7`;
            const baseY = footY;
            const badgeX = pos.x;
            const badgeY = baseY - (10 * layoutScale);
            let badgeScale = 1;
            let badgeAlpha = 1;
            if (ampActive) {
              const startAt = visual ? (visual.startAt || 0) : (g.time || 0);
              const inT = Math.max(0, Math.min(1, ((g.time || 0) - startAt) / 0.22));
              badgeScale = popScale(inT) * (1 + 0.03 * Math.sin((g.time || 0) * 6));
            } else {
              const fadeT = Math.max(0, Math.min(1, ((g.time || 0) - (fade.startAt || 0)) / (fade.duration || 0.16)));
              badgeScale = 1 + 0.08 * (1 - fadeT);
              badgeAlpha = 1 - fadeT;
            }
            const bw = Math.max(24, 30 * layoutScale) * badgeScale;
            const bh = Math.max(14, 18 * layoutScale) * badgeScale;
            ctx.save();
            ctx.globalAlpha = badgeAlpha;
            ctx.fillStyle = 'rgba(24,24,24,0.92)';
            ctx.strokeStyle = 'rgba(250,250,250,0.75)';
            ctx.lineWidth = Math.max(1, 1.2 * layoutScale);
            ctx.fillRect(badgeX - bw / 2, badgeY - bh, bw, bh);
            ctx.strokeRect(badgeX - bw / 2, badgeY - bh, bw, bh);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(10, Math.round(12 * layoutScale * badgeScale))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, badgeX, badgeY - bh / 2);
            ctx.restore();
          }

          // Hero turn indicator selector (only on hero turns)
          if (currentHero && hero && currentHero.uid === hero.uid && state.globals.TurnPhase === 0) {
            if (state.globals.HideHeroSelector) continue;
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
    return (typeof latest === 'string' && latest.trim()) ? latest.trim() : 'What happened?';
  }

  function getStoryCardLiveLineState() {
    if (!gameState.storyCardLine) {
      gameState.storyCardLine = { text: 'What happened?', animUntil: 0 };
    }
    const nextText = getLatestCombatActionLine();
    const now = Number(state.globals?.time || 0);
    if (gameState.storyCardLine.text !== nextText) {
      gameState.storyCardLine.text = nextText;
      gameState.storyCardLine.animUntil = now + 0.35;
    }
    const animRemaining = Math.max(0, Number(gameState.storyCardLine.animUntil || 0) - now);
    return {
      text: gameState.storyCardLine.text || 'What happened?',
      animAlpha: animRemaining > 0 ? (0.75 + ((animRemaining / 0.35) * 0.25)) : 1,
    };
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
      const delta = actor.kind === 'enemy' && debuff > 0 ? `(-${Math.round(debuff)})` : '';
      turnOrderLines.push(`${label} ${Math.round(curSpd)}/${Math.round(baseSpd)}${delta ? ` ${delta}` : ''}${extraTag}`);
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
    drawWalletHUD();
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
    const lines = ['Wallet:', `Total: ${total}`];
    for (const [key, val] of entries) {
      lines.push(`${key}: ${val}`);
    }
    walletOut.textContent = lines.join('\n');
  }
  drawFrame(); // initial render

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
    if (activeLayoutId === 'astralOverlay') {
      inputDomains.emit('astralOverlay', 'layout:astralOverlay:click', { x: mx, y: my });
      drawFrame();
      return;
    }
    if (activeLayoutId === 'mapLayout') {
      const btn = gameState.mapLayout.returnButton;
      const buttonTop = btn.y + 24;
      if (mx >= btn.x && mx <= (btn.x + btn.w) && my >= buttonTop && my <= (buttonTop + btn.h)) {
        layoutState.requestLayoutChange('combat', 'map-return-button').catch((err) => {
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

    if (layoutHarnessEnabled && harnessLayoutState && harnessInputDomains) {
      const activeLayout = harnessLayoutState.getActiveLayoutId();
      if (activeLayout === 'storyMock') {
        harnessInputDomains.emit(activeLayout, 'layout:storyMock:click', { x: mx, y: my });
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
      Nav_MissionText: 'Mission',
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
      if (labelName === 'AstralFlow' || !navBlockedBySelection) {
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

  // keyboard input handling
  window.addEventListener('keydown', (ev)=>{
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
    if(ev.key === 'ArrowRight') gameState.selectedHero = Math.min(3, gameState.selectedHero + 1);
    if(ev.key === 'ArrowUp') gameState.selectedEnemy = Math.max(0, gameState.selectedEnemy - 1);
    if(ev.key === 'ArrowDown') gameState.selectedEnemy = Math.min(2, gameState.selectedEnemy + 1);
    if(ev.key === ' ') { gameState.playerTurn = !gameState.playerTurn; ev.preventDefault(); }
  });

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
    if (state.globals.GamePhase === 'BOOTSTRAP') {
      tryActivateRuntimePhase();
    }
    if (
      state.globals.TurnPhase === 0 &&
      !state.globals.IsPlayerBusy &&
      !state.globals.PendingSkillID &&
      !state.globals.ActionInProgress &&
      !state.globals.DeferAdvance
    ) {
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
        state.globals.ActionLockUntil = Math.max(state.globals.ActionLockUntil || 0, (state.globals.time || 0) + 0.05);
      } else {
      if (state.globals.TextAnimating) {
        state.globals.ActionLockUntil = (state.globals.time || 0) + 0.1;
      } else {
        // Only block auto-advance while an action/selection is still active.
        const pendingSelect = state.globals.TurnPhase === 1 && state.globals.PendingSkillID;
        const staleBusy = state.globals.IsPlayerBusy && !state.globals.ActionInProgress && !pendingSelect;
        if (staleBusy) {
          state.globals.IsPlayerBusy = 0;
          console.log(`[TURN] cleared stale IsPlayerBusy before advance phase=${state.globals.TurnPhase} owner=${state.globals.ActionOwnerUID || 0}`);
        }
        const blockedPhase = state.globals.IsPlayerBusy || state.globals.ActionInProgress || pendingSelect;
        const ownerUID = state.globals.ActionOwnerUID || 0;
        const currentUID = callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0;
        const ownerOk = !ownerUID || ownerUID === currentUID;
        if (!blockedPhase && ownerOk) {
          console.log(`[TURN] DeferAdvance -> AdvanceTurn owner=${ownerUID} cur=${currentUID} phase=${state.globals.TurnPhase} busy=${state.globals.IsPlayerBusy} canPick=${state.globals.CanPickGems}`);
          state.globals.DeferAdvance = 0;
          state.globals.AdvanceAfterAction = 0;
          state.globals.ActionOwnerUID = 0;
          callFunctionWithContext(fnContext, 'AdvanceTurn');
          combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
        } else if (!ownerOk) {
          state.globals.DeferAdvance = 0;
          state.globals.AdvanceAfterAction = 0;
          state.globals.ActionOwnerUID = 0;
          combatRuntimeGateway.runCombatStep(fnContext, 'ProcessTurn');
        } else if (!state.globals._DeferBlockLogged) {
          state.globals._DeferBlockLogged = 1;
          console.log(`[TURN] DeferAdvance blocked pendingSelect=${!!pendingSelect} IsPlayerBusy=${state.globals.IsPlayerBusy} TurnPhase=${state.globals.TurnPhase} owner=${ownerUID} cur=${currentUID} canPick=${state.globals.CanPickGems} actionInProgress=${state.globals.ActionInProgress}`);
        }
      }
      }
    } else {
      state.globals._DeferBlockLogged = 0;
    }
    const currentTurnType = callFunctionWithContext(fnContext, 'GetCurrentType');
    trackTask011EnemyBoundary(currentTurnType);
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
        },
        mapLayout: {
          panX: Number(gameState.mapLayout.panX || 0),
          panY: Number(gameState.mapLayout.panY || 0),
          warMeter: Number(gameState.mapLayout.warMeter || 0),
          render: gameState.mapLayout.lastRender || null,
        },
        flags: {
          canPickGems: state.globals.CanPickGems,
          isPlayerBusy: state.globals.IsPlayerBusy,
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
          .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP })),
        enemies: state.entities
          .filter(e => e.kind === 'enemy')
          .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, slot: e.slotIndex })),
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
      callFunction(fnName, ...args) {
        return callFunctionWithContext(fnContext, fnName, ...args);
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
