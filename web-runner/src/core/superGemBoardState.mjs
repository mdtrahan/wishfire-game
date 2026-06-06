import {
  buildColorGrid,
  buildSuperGemCellMap,
  decomposeSuperGem,
  detectSuperGemClusters,
} from './superGemRules.mjs';
import { getSuperGemRenderRect } from './superGemRender.mjs';
import {
  derivePresentationTurnBarrier,
  isCanPickGemsReady,
} from './turnGateController.mjs';

function rebuildSuperGemCellMap(gameState) {
  gameState.superGemCellMap = buildSuperGemCellMap(gameState.superGems || []);
}

function getSuperGemSignature(superGems = []) {
  return (superGems || [])
    .map((sg) => {
      const cells = (sg.cells || [])
        .map((cell) => `${cell.r},${cell.c}`)
        .sort()
        .join('|');
      return `${sg.type || 'uniform'}:${Number(sg.baseColor ?? -1)}:${cells}`;
    })
    .sort()
    .join('||');
}

function buildSuperGemSourceItems(superGem, gems = []) {
  const cells = Array.isArray(superGem?.cells) ? superGem.cells : [];
  return cells
    .map((cell) => gems.find((gem) => gem && gem.cellR === cell.r && gem.cellC === cell.c))
    .filter(Boolean)
    .map((gem) => ({
      x: Number(gem.x || 0),
      y: Number(gem.y || 0),
      color: Number(gem.color ?? gem.elementIndex ?? superGem.baseColor ?? 0),
    }));
}

function getGemColor(gem) {
  return Number(gem?.color ?? gem?.elementIndex);
}

function getCellKey(cellR, cellC) {
  return `${Number(cellR)},${Number(cellC)}`;
}

function getSuperGemCenterWorld(superGem, gems = []) {
  const sourceItems = buildSuperGemSourceItems(superGem, gems);
  if (!sourceItems.length) return null;
  const total = sourceItems.reduce((acc, item) => ({
    x: acc.x + Number(item.x || 0),
    y: acc.y + Number(item.y || 0),
  }), { x: 0, y: 0 });
  return {
    x: total.x / sourceItems.length,
    y: total.y / sourceItems.length,
  };
}

function buildSuperGemColorClear({ superGem, gems = [] }) {
  const color = Number(superGem?.baseColor);
  if (!Number.isFinite(color)) return { clearKeys: new Set(), flyItems: [], center: null };
  const superGemCellKeys = new Set(
    (Array.isArray(superGem?.cells) ? superGem.cells : [])
      .map((cell) => getCellKey(cell.r, cell.c)),
  );
  const clearKeys = new Set();
  const flyItems = [];
  for (const gem of gems || []) {
    if (!gem) continue;
    const key = getCellKey(gem.cellR, gem.cellC);
    if (getGemColor(gem) !== color) continue;
    clearKeys.add(key);
    if (!superGemCellKeys.has(key)) {
      flyItems.push({
        x: Number(gem.x || 0),
        y: Number(gem.y || 0),
        color,
      });
    }
  }
  return {
    clearKeys,
    flyItems,
    center: getSuperGemCenterWorld(superGem, gems),
  };
}

function hasSuperGemBoardEmptySlots(gameState = {}) {
  return Array.isArray(gameState.grid) && gameState.grid.some((col) => (
    Array.isArray(col) && col.some((uid) => Number(uid || 0) <= 0)
  ));
}

function canStartSuperGemSpend(globals = {}, gameState = {}) {
  const boardHasEmptySlots = hasSuperGemBoardEmptySlots(gameState);
  if (boardHasEmptySlots) return false;
  const barrier = derivePresentationTurnBarrier({
    globals,
    refillBounce: gameState.refillBounce,
    yellowCasino: gameState.yellowCasino,
    gemMergeFx: gameState.gemMergeFx,
    boardHasEmptySlots,
    enemyLineClearPressureActive: false,
  });
  return (
    globals.GamePhase === 'RUNTIME' &&
    Number(globals.TurnPhase || 0) === 0 &&
    isCanPickGemsReady(globals.CanPickGems) &&
    !globals.PendingSkillID &&
    !globals.PendingSuperGemAction &&
    !globals.DeferAdvance &&
    !globals.ActionInProgress &&
    !globals.IsPlayerBusy &&
    barrier.canClaimCombatAction
  );
}

export function resetSuperGemBoardState(gameState) {
  gameState.superGems = [];
  gameState.superGemCellMap = new Map();
  gameState.superGemSignature = '';
}

export function getSuperGemAtCell(gameState, cellR, cellC) {
  const id = gameState?.superGemCellMap?.get(`${cellR},${cellC}`);
  if (!id) return null;
  return (gameState.superGems || []).find((sg) => sg.id === id) || null;
}

export function getSuperGemAtCanvasPoint({
  gameState,
  mx,
  my,
  boardGeometry,
  layoutScale,
  worldToCanvas,
}) {
  const superGems = Array.isArray(gameState?.superGems) ? gameState.superGems : [];
  if (!superGems.length) return null;
  for (let i = superGems.length - 1; i >= 0; i -= 1) {
    const superGem = superGems[i];
    const rect = getSuperGemRenderRect({
      superGem,
      gems: gameState?.gems || [],
      boardGeometry,
      layoutScale,
      worldToCanvas,
    });
    if (!rect) continue;
    if (
      mx >= rect.x &&
      mx <= rect.x + rect.w &&
      my >= rect.y &&
      my <= rect.y + rect.h
    ) {
      return superGem;
    }
  }
  return null;
}

export function settleSuperGemShapes({ gameState, state, boardGeometry, reason = 'unknown' }) {
  if (!Array.isArray(gameState.gems) || !gameState.gems.length) {
    gameState.superGems = [];
    gameState.superGemSignature = '';
    rebuildSuperGemCellMap(gameState);
    state.globals.SuperGemCount = 0;
    return;
  }
  const colorGrid = buildColorGrid(gameState.gems, boardGeometry.rows, boardGeometry.cols);
  const detected = detectSuperGemClusters(colorGrid, boardGeometry.rows, boardGeometry.cols);
  const nextSignature = getSuperGemSignature(detected);
  if (nextSignature === gameState.superGemSignature) {
    state.globals.SuperGemCount = (gameState.superGems || []).length;
    state.globals.LastSuperGemSettleReason = String(reason || 'unknown');
    return;
  }
  gameState.superGems = detected.map((sg) => ({ ...sg, id: `sg-${gameState.nextSuperGemId++}` }));
  gameState.superGemSignature = nextSignature;
  rebuildSuperGemCellMap(gameState);
  state.globals.SuperGemCount = (gameState.superGems || []).length;
  state.globals.LastSuperGemSettleReason = String(reason || 'unknown');
}

export function syncSuperGemShapes({ gameState, state, boardGeometry, reason = 'frame-sync' }) {
  if (!gameState.boardCreated || !Array.isArray(gameState.gems) || !gameState.gems.length) return;
  settleSuperGemShapes({ gameState, state, boardGeometry, reason });
}

export function resolveSuperGemDecomposition({ gameState, state, reason = 'unknown' }) {
  if (!Array.isArray(gameState.superGems) || gameState.superGems.length === 0) return;
  let mutated = false;
  const next = [];
  for (const sg of gameState.superGems) {
    const surviving = [];
    for (const cell of sg.cells) {
      const uid = gameState.grid[cell.c] ? Number(gameState.grid[cell.c][cell.r] || 0) : 0;
      if (uid > 0) surviving.push(cell);
    }
    if (surviving.length === sg.cells.length) {
      next.push(sg);
      continue;
    }
    mutated = true;
    if (surviving.length === 0) continue;
    const decomposed = decomposeSuperGem(sg, surviving);
    for (const item of decomposed) {
      const gem = (gameState.gems || []).find((g) => g && g.cellR === item.r && g.cellC === item.c);
      if (!gem) continue;
      gem.color = item.color;
      gem.elementIndex = item.color;
    }
  }
  if (!mutated) return;
  gameState.superGems = next;
  gameState.superGemSignature = getSuperGemSignature(next);
  rebuildSuperGemCellMap(gameState);
  state.globals.LastSuperGemDecomposeReason = String(reason || 'unknown');
}

export function spendSuperGem({
  superGem,
  gameState,
  state,
  reason = 'tap',
  callFunctionWithContext,
  fnContext,
  getHeroUIDByIndex,
  beginTask011ActionCycle,
  startGemMergeFx,
  getGoldLabelTargetWorld,
  setGemArray,
  startRefillBounce,
  activateSuperGemEffect,
  superGemCost,
}) {
  if (!superGem) return false;
  const cells = Array.isArray(superGem.cells) ? superGem.cells : [];
  if (!cells.length) return false;
  if (!canStartSuperGemSpend(state.globals || {}, gameState)) return false;
  const currentTurnUID = Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
  const currentTurnActor = currentTurnUID > 0 ? callFunctionWithContext(fnContext, 'GetActorByUID', currentTurnUID) : null;
  const actorUID = currentTurnActor && currentTurnActor.kind === 'hero'
    ? currentTurnUID
    : (getHeroUIDByIndex(gameState.selectedHero) || gameState.selectedHero || currentTurnUID);
  if (!(actorUID > 0)) return false;
  const sourceItems = buildSuperGemSourceItems(superGem, gameState.gems || []);
  const colorClear = buildSuperGemColorClear({ superGem, gems: gameState.gems || [] });
  beginTask011ActionCycle(Number(superGem.baseColor), actorUID);
  const activated = activateSuperGemEffect({
    superGem,
    actorUID,
    selectedEnemyUID: Number(state.globals.SelectedEnemyUID || 0),
    state,
    callFunctionWithContext,
    fnContext,
    sourceItems,
    consumedColorGemCount: colorClear.clearKeys.size,
    startGemMergeFx,
    getGoldLabelTargetWorld,
  });
  if (!activated) return false;
  const resolvedSuperGemCost = Number(superGem?.baseColor) === 5 ? 1 : Number(superGemCost || 0);
  const beforeEnergy = Number(state.globals.Player_Energy || 0);
  const afterEnergy = Math.max(0, beforeEnergy - resolvedSuperGemCost);
  state.globals.Player_Energy = afterEnergy;
  if (
    colorClear.flyItems.length &&
    colorClear.center &&
    typeof startGemMergeFx === 'function'
  ) {
    startGemMergeFx({
      target: colorClear.center,
      scaleOut: false,
      sourceItems: colorClear.flyItems,
    });
  }
  gameState.gems = (gameState.gems || [])
    .filter((gem) => gem && !colorClear.clearKeys.has(getCellKey(gem.cellR, gem.cellC)));
  for (const key of colorClear.clearKeys) {
    const [rRaw, cRaw] = key.split(',');
    const r = Number(rRaw);
    const c = Number(cRaw);
    if (gameState.grid[c]) gameState.grid[c][r] = 0;
  }
  gameState.superGems = (gameState.superGems || []).filter((sg) => sg.id !== superGem.id);
  gameState.superGemSignature = getSuperGemSignature(gameState.superGems || []);
  rebuildSuperGemCellMap(gameState);
  const presentationBarrier = derivePresentationTurnBarrier({
    globals: state.globals || {},
    refillBounce: gameState.refillBounce,
    yellowCasino: gameState.yellowCasino,
    gemMergeFx: gameState.gemMergeFx || (colorClear.flyItems.length ? { active: true } : null),
    boardHasEmptySlots: colorClear.clearKeys.size > 0,
  });
  const refillDeferred = !!(
    state.globals.PendingSkillID ||
    state.globals.PendingSuperGemAction ||
    state.globals.DeferAdvance ||
    Number(state.globals.ActionLockUntil || 0) > Number(state.globals.time || 0) ||
    !presentationBarrier.canStartRefill
  );
  state.globals.LastSuperGemSpend = {
    id: String(superGem.id),
    type: String(superGem.type || ''),
    size: Number(superGem.size || 0),
    area: resolvedSuperGemCost,
    reason: String(reason || 'tap'),
    energyBefore: beforeEnergy,
    energyAfter: afterEnergy,
    clearedGemCount: colorClear.clearKeys.size,
    refillDeferred,
  };
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  state.globals.TapIndex = 0;
  setGemArray(gameState.gems);
  if (!refillDeferred) {
    startRefillBounce(0.31);
  }
  return true;
}
