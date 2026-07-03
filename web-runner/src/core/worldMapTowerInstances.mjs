import {
  DEFAULT_WORLD_MAP_GRID,
  getWorldMapCellBounds,
} from './worldMapCoordinates.mjs';

export const WORLD_MAP_TOWER_IMAGE_WIDTH = 46;
export const WORLD_MAP_TOWER_IMAGE_HEIGHT = 54;
export const WORLD_MAP_TOWER_RENDER_OFFSET_Y = -8;
export const WORLD_MAP_TOWER_GEM_ANCHOR = Object.freeze({
  xRatio: 0.5,
  yRatio: 0.15,
});
export const WORLD_MAP_TOWER_GEM_GLOW = Object.freeze({
  periodSec: 3.6,
  sizeScale: 0.5,
  pulseStrength: 0.5,
  alphaMin: 0.28,
  alphaMax: 0.44,
  coreRadiusMinScale: 0.22,
  coreRadiusMaxScale: 0.30,
  burstRadiusMinScale: 0.46,
  burstRadiusMaxScale: 0.58,
  rayAlphaMin: 0.20,
  rayAlphaMax: 0.34,
  rayLengthMinScale: 0.74,
  rayLengthMaxScale: 0.88,
  innerAlphaMin: 0.30,
  innerAlphaMax: 0.46,
  innerRadiusMinScale: 0.10,
  innerRadiusMaxScale: 0.14,
  rays: Object.freeze([
    Object.freeze({ angleDeg: 0, negativeLengthScale: 0.58, positiveLengthScale: 0.48, widthMin: 0.7, widthMax: 1.1, alphaScale: 0.9 }),
    Object.freeze({ angleDeg: -47, negativeLengthScale: 0.42, positiveLengthScale: 0.60, widthMin: 0.8, widthMax: 1.2, alphaScale: 0.72 }),
    Object.freeze({ angleDeg: 88, negativeLengthScale: 0.32, positiveLengthScale: 0.24, widthMin: 0.5, widthMax: 0.8, alphaScale: 0.42 }),
  ]),
});
export const WORLD_MAP_TOWER_GEM_GLOW_COLORS = Object.freeze({
  red: Object.freeze({ core: '255, 246, 238', mid: '255, 92, 84', edge: '255, 46, 64' }),
  gold: Object.freeze({ core: '255, 253, 218', mid: '255, 212, 76', edge: '255, 164, 42' }),
  purple: Object.freeze({ core: '250, 242, 255', mid: '188, 102, 255', edge: '126, 62, 255' }),
  green: Object.freeze({ core: '239, 255, 235', mid: '104, 232, 118', edge: '48, 184, 82' }),
  blue: Object.freeze({ core: '238, 252, 255', mid: '106, 220, 255', edge: '54, 154, 255' }),
});
export const WORLD_MAP_TOWER_VARIANTS = Object.freeze(['red', 'gold', 'purple', 'green', 'blue']);
export const WORLD_MAP_TOWER_IMAGE_ASSETS = Object.freeze({
  red: 'images/map_tower_spire_red_46x54.png',
  gold: 'images/map_tower_spire_gold_46x54.png',
  purple: 'images/map_tower_spire_purple_46x54.png',
  green: 'images/map_tower_spire_green_46x54.png',
  blue: 'images/map_tower_spire_46x54.png',
});

export const WORLD_MAP_TOWER_INSTANCES = Object.freeze([
  Object.freeze({ id: 'northland-spire-tower', coordinate: 'H04', variant: 'red' }),
  Object.freeze({
    id: 'southern-channel-intercept-tower',
    anchorCoordinates: Object.freeze(['H15', 'J15']),
    placement: 'intercept',
    variant: 'gold',
  }),
  Object.freeze({ id: 'southern-peninsula-spire-tower', coordinate: 'L19', variant: 'purple' }),
  Object.freeze({
    id: 'east-bay-intercept-tower',
    anchorCoordinates: Object.freeze(['M08', 'N08', 'M09', 'N09']),
    placement: 'intercept',
    variant: 'blue',
  }),
  Object.freeze({ id: 'western-marsh-spire-tower', coordinate: 'B18', variant: 'green' }),
]);

function getTowerAnchorCoordinates(tower) {
  if (Array.isArray(tower?.anchorCoordinates)) {
    return tower.anchorCoordinates;
  }
  return tower?.coordinate ? [tower.coordinate] : [];
}

function resolveTwoCellIntercept(anchors) {
  if (anchors.length !== 2) return null;
  const [first, second] = anchors;
  if (first.rowIndex === second.rowIndex && first.columnIndex !== second.columnIndex) {
    const left = first.columnIndex < second.columnIndex ? first : second;
    return {
      centerX: left.x + left.width,
      centerY: left.centerY,
    };
  }
  if (first.columnIndex === second.columnIndex && first.rowIndex !== second.rowIndex) {
    const top = first.rowIndex < second.rowIndex ? first : second;
    return {
      centerX: top.centerX,
      centerY: top.y + top.height,
    };
  }
  return null;
}

export function resolveWorldMapTowerPoint(tower, grid = DEFAULT_WORLD_MAP_GRID) {
  const anchors = getTowerAnchorCoordinates(tower)
    .map((coordinate) => getWorldMapCellBounds(coordinate, grid));
  if (anchors.length === 0 || anchors.some((anchor) => !anchor)) return null;

  const edgeIntercept = tower?.placement === 'intercept' ? resolveTwoCellIntercept(anchors) : null;
  const centerX = edgeIntercept?.centerX
    ?? anchors.reduce((sum, anchor) => sum + anchor.centerX, 0) / anchors.length;
  const centerY = edgeIntercept?.centerY
    ?? anchors.reduce((sum, anchor) => sum + anchor.centerY, 0) / anchors.length;
  const anchorCoordinates = anchors.map((anchor) => anchor.coordinate);

  return {
    id: tower.id,
    coordinate: tower.coordinate || anchorCoordinates.join('/'),
    anchorCoordinates,
    placement: tower.placement || (anchorCoordinates.length > 1 ? 'intercept' : 'center'),
    variant: tower.variant || null,
    centerX,
    centerY,
  };
}
