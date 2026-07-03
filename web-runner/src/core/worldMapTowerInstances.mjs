import {
  DEFAULT_WORLD_MAP_GRID,
  getWorldMapCellBounds,
} from './worldMapCoordinates.mjs';

export const WORLD_MAP_TOWER_IMAGE_WIDTH = 46;
export const WORLD_MAP_TOWER_IMAGE_HEIGHT = 54;
export const WORLD_MAP_TOWER_RENDER_OFFSET_Y = -8;
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
