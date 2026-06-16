const BUFF_ICON_TYPES = Object.freeze(['buffIcon1', 'buffIcon2', 'buffIcon3', 'buffIcon4']);

export function computeStoryCardLayout({
  gameState,
  instances,
  boardGeometry,
  layoutW,
  layoutScale,
  layoutOffsetX,
  layoutOffsetY,
  worldToCanvas,
} = {}) {
  const viewLeft = Number(layoutOffsetX || 0);
  const viewTop = Number(layoutOffsetY || 0);
  const scale = Math.max(0.0001, Number(layoutScale) || 1);
  const viewWidth = Number(layoutW || 360) * scale;
  const contentBandWidth = viewWidth * 0.95;
  const slotX = viewLeft + (viewWidth - contentBandWidth) * 0.5;
  const toCanvas = typeof worldToCanvas === 'function'
    ? worldToCanvas
    : ((wx, wy) => ({ x: viewLeft + Number(wx || 0) * scale, y: viewTop + Number(wy || 0) * scale }));

  const hpBarInstance = (instances || []).find(ins => ins && ins.type === 'PartyHP_Bar' && ins.world);
  const hpBarBottom = hpBarInstance
    ? (() => {
        const p = toCanvas(hpBarInstance.world.x || 0, hpBarInstance.world.y || 0);
        const h = Number(hpBarInstance.world.height || 0) * scale;
        const oy = Number(hpBarInstance.world.originY != null ? hpBarInstance.world.originY : 0);
        return p.y - (h * oy) + h;
      })()
    : 0;
  const hpBarHeight = hpBarInstance ? Number(hpBarInstance.world.height || 0) * scale : 0;
  const ampBarBottom = hpBarBottom
    ? hpBarBottom + hpBarHeight + Math.max(4, Math.round(hpBarHeight * 0.55))
    : 0;
  const buffTypes = new Set(BUFF_ICON_TYPES);
  const buffInstances = (instances || []).filter(ins => ins && buffTypes.has(ins.type) && ins.world);
  const layoutAnchorBottom = buffInstances.length
    ? Math.max(...buffInstances.map(ins => {
        const p = toCanvas(ins.world.x || 0, ins.world.y || 0);
        const h = Number(ins.world.height || 0) * scale;
        const oy = Number(ins.world.originY != null ? ins.world.originY : 0.5);
        return p.y - (h * oy) + h;
      }))
    : (ampBarBottom || hpBarBottom || (viewTop + Math.max(240, Math.round(250 * scale))));

  const grid = gameState?.gridBounds || {
    minX: boardGeometry.gx,
    minY: boardGeometry.gy,
    maxX: boardGeometry.gx + (boardGeometry.cols * boardGeometry.cellSize + (boardGeometry.cols - 1) * boardGeometry.gap),
    maxY: boardGeometry.gy + (boardGeometry.rows * boardGeometry.cellSize + (boardGeometry.rows - 1) * boardGeometry.gap),
  };
  const gridTop = viewTop + Number(grid.minY || 0) * scale;
  const topMargin = Math.max(8, Math.round(10 * scale));
  const bottomMargin = Math.max(8, Math.round(10 * scale));
  const slotY = layoutAnchorBottom + topMargin;
  const rawH = gridTop - bottomMargin - slotY;
  const slotH = Math.max(Math.round(34 * scale), Math.min(Math.round(58 * scale), rawH));
  const adjustedY = rawH >= Math.round(24 * scale)
    ? slotY
    : (gridTop - bottomMargin - Math.max(Math.round(34 * scale), Math.round(38 * scale)));

  return {
    x: slotX,
    y: adjustedY,
    w: contentBandWidth,
    h: Math.max(Math.round(34 * scale), slotH),
  };
}

export function initializeStoryCardPresentationLayout({
  trigger = 'layout-active',
  activeLayoutId,
  gameState,
  instances,
  boardGeometry,
  layoutMetrics,
  worldToCanvas,
  tracePlacement,
} = {}) {
  if (activeLayoutId !== 'combat') return false;
  const bounds = computeStoryCardLayout({
    gameState,
    instances,
    boardGeometry,
    worldToCanvas,
    ...(layoutMetrics || {}),
  });
  gameState.storyCardLayout = {
    ...bounds,
    initialized: true,
    trigger: String(trigger || 'layout-active'),
  };
  if (typeof tracePlacement === 'function') tracePlacement(trigger, bounds);
  return true;
}
