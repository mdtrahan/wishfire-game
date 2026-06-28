import * as mapLayoutState from '../state/mapLayoutState.js';

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
  mapLayoutState.setMapDragState({
    lastX: mx,
    lastY: my,
    moved: Number(drag.moved || 0) + Math.abs(dx),
  });
  const mapState = mapLayoutState.getMapLayoutState();
  const bounds = mapState.panBounds || { minX: 0, maxX: 0 };
  const nextPanX = Number(mapState.panX || 0) + dx;
  mapLayoutState.setMapPanX(Math.max(bounds.minX, Math.min(bounds.maxX, nextPanX)));
  mapLayoutState.setMapPanY(0);
  drawFrame();
}

export function finishMapDrag(ev, { layoutState, gameState, canvas }) {
  const activeLayoutId = getActiveLayoutId(layoutState);
  if (activeLayoutId !== 'mapLayout') return;
  const drag = mapLayoutState.getMapLayoutState().drag;
  if (!drag.active || drag.pointerId !== ev.pointerId) return;
  mapLayoutState.setMapDragState({
    active: false,
    pointerId: null,
  });
  try { canvas.releasePointerCapture(ev.pointerId); } catch {}
}

function isEditableDomTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toUpperCase();
  return Boolean(target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
}

export function isMapCoordinateGridDevOverlayEnabled(globalScope = globalThis) {
  return Boolean(globalScope && globalScope.__codexGameDevTest);
}

export function handleMapCoordinateGridKeydown(ev, { layoutState, drawFrame } = {}) {
  const activeLayoutId = getActiveLayoutId(layoutState);
  if (activeLayoutId !== 'mapLayout') return false;
  if (!isMapCoordinateGridDevOverlayEnabled()) {
    if (mapLayoutState.getMapLayoutState().showCoordinateGrid) {
      mapLayoutState.setMapLayoutField('showCoordinateGrid', false);
      if (typeof drawFrame === 'function') drawFrame();
    }
    return false;
  }
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
