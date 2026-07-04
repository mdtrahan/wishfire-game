import {
  DEFAULT_WORLD_MAP_GRID,
  getWorldMapCellBounds,
} from './worldMapCoordinates.mjs';
import {
  isWorldMapIconVisible,
} from './worldMapIconVisibility.mjs';

export const WORLD_MAP_TOWN_IMAGE_SIZE = 46;
export const WORLD_MAP_TOWN_UPPER_OFFSET_Y = -12;
export const WORLD_MAP_TOWN_RIGHT_EDGE_OFFSET_X = -(WORLD_MAP_TOWN_IMAGE_SIZE / 2);
export const WORLD_MAP_TOWN_VARIANTS = Object.freeze(['town', 'castle', 'moor', 'cape']);
export const WORLD_MAP_TOWN_IMAGE_ASSETS = Object.freeze({
  town: 'images/map_town_town_46.png',
  castle: 'images/map_town_castle_46.png',
  moor: 'images/map_town_moor_46.png',
  cape: 'images/map_town_cape_46.png',
});

export const WORLD_MAP_TOWN_INSTANCES = Object.freeze([
  Object.freeze({ id: 'eastern-fields-town', coordinate: 'M14', variant: 'town', visible: true }),
  Object.freeze({ id: 'western-grove-town', coordinate: 'G11', variant: 'town', visible: true }),
  Object.freeze({ id: 'southwest-meadow-town', coordinate: 'F19', variant: 'town', visible: true }),
  Object.freeze({ id: 'southland-crossroads-town', coordinate: 'I17', variant: 'town', visible: true }),
  Object.freeze({ id: 'western-coast-town', coordinate: 'C14', variant: 'town', visible: true }),
  Object.freeze({ id: 'western-lowland-moor', coordinate: 'B13', variant: 'moor', visible: true }),
  Object.freeze({ id: 'western-mountain-moor', coordinate: 'D16', variant: 'moor', visible: true }),
  Object.freeze({ id: 'eastern-coast-moor', coordinate: 'O11', variant: 'moor', visible: true }),
  Object.freeze({ id: 'southern-crossing-castle', coordinate: 'J18', variant: 'castle', visible: true }),
  Object.freeze({ id: 'central-eastland-castle', coordinate: 'L10', variant: 'castle', visible: true }),
  Object.freeze({ id: 'far-southeast-castle', coordinate: 'O19', variant: 'castle', visible: true }),
  Object.freeze({
    id: 'central-isthmus-cape',
    coordinate: 'I14',
    variant: 'cape',
    offsetY: -20,
    visible: true,
  }),
  Object.freeze({
    id: 'western-right-edge-cape',
    anchorCoordinates: Object.freeze(['B10', 'C10']),
    placement: 'intercept',
    variant: 'cape',
    offsetX: WORLD_MAP_TOWN_RIGHT_EDGE_OFFSET_X,
    visible: true,
  }),
  Object.freeze({
    id: 'northwest-channel-cape',
    anchorCoordinates: Object.freeze(['G07', 'H07']),
    placement: 'intercept',
    variant: 'cape',
    visible: true,
  }),
  Object.freeze({
    id: 'southern-upper-cape',
    coordinate: 'K21',
    variant: 'cape',
    offsetY: WORLD_MAP_TOWN_UPPER_OFFSET_Y,
    visible: true,
  }),
]);

function getTownAnchorCoordinates(town) {
  if (Array.isArray(town?.anchorCoordinates)) {
    return town.anchorCoordinates;
  }
  return town?.coordinate ? [town.coordinate] : [];
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

export function resolveWorldMapTownPoint(town, grid = DEFAULT_WORLD_MAP_GRID) {
  const anchors = getTownAnchorCoordinates(town)
    .map((coordinate) => getWorldMapCellBounds(coordinate, grid));
  if (anchors.length === 0 || anchors.some((anchor) => !anchor)) return null;

  const edgeIntercept = town?.placement === 'intercept' ? resolveTwoCellIntercept(anchors) : null;
  const centerX = edgeIntercept?.centerX
    ?? anchors.reduce((sum, anchor) => sum + anchor.centerX, 0) / anchors.length;
  const centerY = edgeIntercept?.centerY
    ?? anchors.reduce((sum, anchor) => sum + anchor.centerY, 0) / anchors.length;
  const anchorCoordinates = anchors.map((anchor) => anchor.coordinate);

  return {
    id: town.id,
    coordinate: town.coordinate || anchorCoordinates.join('/'),
    anchorCoordinates,
    placement: town.placement || (anchorCoordinates.length > 1 ? 'intercept' : 'center'),
    variant: town.variant || null,
    visible: isWorldMapIconVisible(town),
    centerX,
    centerY,
    offsetX: Number(town.offsetX || 0),
    offsetY: Number(town.offsetY || 0),
  };
}
