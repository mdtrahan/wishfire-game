export const WORLD_MAP_CAVE_ASSET_SIZE = 46;
export const WORLD_MAP_CAVE_RENDER_SCALE = 0.75;
export const WORLD_MAP_CAVE_IMAGE_SIZE = WORLD_MAP_CAVE_ASSET_SIZE * WORLD_MAP_CAVE_RENDER_SCALE;

export const WORLD_MAP_CAVE_INSTANCES = Object.freeze([
  Object.freeze({ id: 'northwest-highland-cave', coordinate: 'F04', visible: true }),
  Object.freeze({ id: 'western-ridge-cave', coordinate: 'D09', visible: true }),
  Object.freeze({ id: 'southwest-woodland-cave', coordinate: 'E13', visible: true }),
  Object.freeze({ id: 'northern-eastland-cave', coordinate: 'I10', visible: true }),
  Object.freeze({ id: 'central-eastland-cave', coordinate: 'L13', visible: true }),
  Object.freeze({ id: 'far-east-ridge-cave', coordinate: 'N16', visible: true }),
]);
