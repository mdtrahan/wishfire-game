export const mapLayoutState = {
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
  showCoordinateGrid: false,
  lastRender: null,
};

export function getMapLayoutState() {
  return mapLayoutState;
}

export function setMapPanX(value) {
  mapLayoutState.panX = value;
}

export function setMapPanY(value) {
  mapLayoutState.panY = value;
}

export function setMapLayoutBounds(bounds) {
  mapLayoutState.panBounds = bounds;
}

export function setMapLayoutField(key, value) {
  mapLayoutState[key] = value;
}

export function setMapDragState(patch) {
  Object.assign(mapLayoutState.drag, patch);
}
