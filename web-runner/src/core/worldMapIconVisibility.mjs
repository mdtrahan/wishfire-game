export const WORLD_MAP_ICON_VISIBILITY = Object.freeze({
  VISIBLE: true,
  HIDDEN: false,
});

export function isWorldMapIconVisible(icon) {
  return icon?.visible === WORLD_MAP_ICON_VISIBILITY.VISIBLE;
}

export function getWorldMapVisibleIconInstances(instances) {
  if (!Array.isArray(instances)) return [];
  return instances.filter((instance) => isWorldMapIconVisible(instance));
}
