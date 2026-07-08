import * as mapLayoutState from '../state/mapLayoutState.js';
import {
  DEFAULT_WORLD_MAP_GRID,
  getWorldMapCoordinateAtPoint,
  resolveWorldMapSafeZoomCenter,
} from '../src/core/worldMapCoordinates.mjs';

const WORLD_MAP_SAFE_ZOOM_VISIBLE_CELLS = 9;
const MAP_TAP_MOVE_THRESHOLD = 6;

function getActiveLayoutId(layoutState) {
  return layoutState && typeof layoutState.getActiveLayoutId === 'function'
    ? layoutState.getActiveLayoutId()
    : null;
}

export function handleMapDragStart(ev, { layoutState, gameState, canvas, drawFrame, mx, my }) {
  const activeLayoutId = getActiveLayoutId(layoutState);
  if (activeLayoutId !== 'mapLayout') return false;
  mapLayoutState.setMapDragState({
    active: true,
    pointerId: ev.pointerId,
    lastX: mx,
    lastY: my,
    moved: 0,
  });
  try { canvas.setPointerCapture(ev.pointerId); } catch {}
  drawFrame();
  return true;
}

function getMapCoordinateFromCanvasPoint(mx, my, lastRender) {
  if (!lastRender) return null;
  const xScale = Number(lastRender.drawW || 0) / DEFAULT_WORLD_MAP_GRID.width;
  const yScale = Number(lastRender.drawH || 0) / DEFAULT_WORLD_MAP_GRID.height;
  if (xScale <= 0 || yScale <= 0) return null;
  const worldX = (Number(mx || 0) - Number(lastRender.drawX || 0)) / xScale;
  const worldY = (Number(my || 0) - Number(lastRender.drawY || 0)) / yScale;
  return getWorldMapCoordinateAtPoint(worldX, worldY, DEFAULT_WORLD_MAP_GRID);
}

export function handleMapZoomTap(ev, {
  layoutState,
  mx,
  my,
  drawFrame,
  allowZoomIn = true,
} = {}) {
  const activeLayoutId = getActiveLayoutId(layoutState);
  if (activeLayoutId !== 'mapLayout') return false;
  const mapState = mapLayoutState.getMapLayoutState();
  if (mapState.zoom?.active) {
    mapLayoutState.resetMapZoomState();
    mapLayoutState.setMapPanX(0);
    mapLayoutState.setMapPanY(0);
    mapLayoutState.setMapDragState({ active: false, pointerId: null, moved: 0 });
    if (typeof drawFrame === 'function') drawFrame();
    return true;
  }
  if (!allowZoomIn) return false;
  const coordinate = getMapCoordinateFromCanvasPoint(mx, my, mapState.lastRender);
  if (!coordinate) return false;
  const zoomScale = DEFAULT_WORLD_MAP_GRID.rows / WORLD_MAP_SAFE_ZOOM_VISIBLE_CELLS;
  const zoom = resolveWorldMapSafeZoomCenter(coordinate, {
    viewWidth: mapState.lastRender.viewWidth,
    viewHeight: mapState.lastRender.viewHeight,
    drawW: Number(mapState.lastRender.drawW || 0) * zoomScale,
    drawH: Number(mapState.lastRender.drawH || 0) * zoomScale,
    grid: DEFAULT_WORLD_MAP_GRID,
  });
  if (!zoom) return false;
  mapLayoutState.setMapZoomState({
    active: true,
    requestedCoordinate: zoom.requestedCoordinate,
    centerCoordinate: zoom.centerCoordinate,
  });
  mapLayoutState.setMapPanX(0);
  mapLayoutState.setMapPanY(0);
  if (typeof ev?.preventDefault === 'function') ev.preventDefault();
  if (typeof drawFrame === 'function') drawFrame();
  return true;
}

export function attachMapDragStartHandler({ layoutState, gameState, canvas, drawFrame }) {
  const deps = { layoutState, gameState, canvas, drawFrame };
  return (ev, coords) => handleMapDragStart(ev, { ...deps, ...coords });
}

export function handleMapPointerMove(ev, { layoutState, gameState, canvas, drawFrame }) {
  const activeLayoutId = getActiveLayoutId(layoutState);
  if (activeLayoutId !== 'mapLayout') return;
  const drag = mapLayoutState.getMapLayoutState().drag;
  if (!drag.active || drag.pointerId !== ev.pointerId) return;
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  const dx = mx - drag.lastX;
  const dy = my - drag.lastY;
  mapLayoutState.setMapDragState({
    lastX: mx,
    lastY: my,
    moved: Number(drag.moved || 0) + Math.abs(dx) + Math.abs(dy),
  });
  const zoomActive = Boolean(mapLayoutState.getMapLayoutState().zoom?.active);
  if (zoomActive) {
    return;
  }
  const mapState = mapLayoutState.getMapLayoutState();
  const bounds = mapState.panBounds || { minX: 0, maxX: 0 };
  const nextPanX = Number(mapState.panX || 0) + dx;
  mapLayoutState.setMapPanX(Math.max(bounds.minX, Math.min(bounds.maxX, nextPanX)));
  mapLayoutState.setMapPanY(0);
  drawFrame();
}

export function finishMapDrag(ev, { layoutState, gameState, canvas, drawFrame }) {
  const activeLayoutId = getActiveLayoutId(layoutState);
  if (activeLayoutId !== 'mapLayout') return;
  const drag = mapLayoutState.getMapLayoutState().drag;
  if (!drag.active || drag.pointerId !== ev.pointerId) return;
  const tapX = drag.lastX;
  const tapY = drag.lastY;
  const moved = Number(drag.moved || 0);
  mapLayoutState.setMapDragState({
    active: false,
    pointerId: null,
  });
  try { canvas.releasePointerCapture(ev.pointerId); } catch {}
  const isPointerUp = ev?.type === 'pointerup';
  if (isPointerUp && moved <= MAP_TAP_MOVE_THRESHOLD) {
    handleMapZoomTap(ev, { layoutState, mx: tapX, my: tapY, drawFrame, allowZoomIn: true });
  }
}

function isEditableDomTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toUpperCase();
  return Boolean(target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
}

export function handleMapCoordinateGridKeydown(ev, { layoutState, drawFrame } = {}) {
  const activeLayoutId = getActiveLayoutId(layoutState);
  if (activeLayoutId !== 'mapLayout') return false;
  if (isEditableDomTarget(ev?.target)) return false;
  if (ev?.metaKey || ev?.ctrlKey || ev?.altKey) return false;
  if (String(ev?.key || '').toLowerCase() !== 'g') return false;
  const current = Boolean(mapLayoutState.getMapLayoutState().showCoordinateGrid);
  mapLayoutState.setMapLayoutField('showCoordinateGrid', !current);
  if (typeof ev.preventDefault === 'function') ev.preventDefault();
  if (typeof drawFrame === 'function') drawFrame();
  return true;
}

export function attachMapDragInputHandlers({
  canvas,
  runtimeListenerTeardowns,
  layoutState,
  gameState,
  drawFrame,
}) {
  const deps = { layoutState, gameState, canvas, drawFrame };
  const handlePointerMove = (ev) => handleMapPointerMove(ev, deps);
  const handlePointerFinish = (ev) => finishMapDrag(ev, deps);
  const handleGridToggle = (ev) => handleMapCoordinateGridKeydown(ev, deps);

  canvas.addEventListener('pointermove', handlePointerMove);
  runtimeListenerTeardowns.push(() => canvas.removeEventListener('pointermove', handlePointerMove));

  canvas.addEventListener('pointerup', handlePointerFinish);
  canvas.addEventListener('pointercancel', handlePointerFinish);
  runtimeListenerTeardowns.push(() => canvas.removeEventListener('pointerup', handlePointerFinish));
  runtimeListenerTeardowns.push(() => canvas.removeEventListener('pointercancel', handlePointerFinish));

  const keyTarget = typeof window !== 'undefined' ? window : canvas;
  if (keyTarget && typeof keyTarget.addEventListener === 'function') {
    keyTarget.addEventListener('keydown', handleGridToggle);
    runtimeListenerTeardowns.push(() => keyTarget.removeEventListener('keydown', handleGridToggle));
  }
}
