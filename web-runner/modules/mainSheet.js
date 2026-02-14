import { state } from './state.js';

function getGlobals(ctx) {
  return (ctx && ctx.state ? ctx.state.globals : state.globals);
}

export function ComputeEnemyLayout(ctx) {
  const g = getGlobals(ctx);
  const rect = g.EnemyAreaRect;
  if (!rect) return;

  g.Slots = 3;
  g.MARGIN = 8;
  g.enemyGAP = 8;
  g.EnemyRowGap = g.enemyGAP;

  g.EnemyAreaLeft = rect.minX;
  g.EnemyAreaRight = rect.maxX;
  g.EnemyAreaTop = rect.minY;
  g.EnemyAreaBottom = rect.maxY;
  g.EnemyAreaCX = (rect.minX + rect.maxX) * 0.5;
  g.EnemyAreaCY = (rect.minY + rect.maxY) * 0.5;

  const vw = g.EnemyAreaRight - g.EnemyAreaLeft;
  const vh = g.EnemyAreaBottom - g.EnemyAreaTop;

  const sizeW = (vw - 2 * g.MARGIN - (g.Slots - 1) * g.enemyGAP) / g.Slots;
  const sizeH = (vh - 2 * g.MARGIN - 2 * g.EnemyRowGap) / 3;

  g.EnemySize = Math.floor(Math.min(sizeW, sizeH));
  g.Spacing = g.EnemySize + g.enemyGAP;
  g.X0 = g.EnemyAreaCX;
  g.EnemyAreaY0 = g.EnemyAreaTop + g.MARGIN + g.EnemySize / 2;
  g.OffscreenX = g.EnemyAreaRight + g.EnemySize;
}

