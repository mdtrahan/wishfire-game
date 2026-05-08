export function renderBoard(ctx, gameState, uiState, animationMath, dims) {
  const {
    boardGeometry,
    worldToCanvas,
    layoutScale,
    gemFrameImages,
    superGemFrameImages,
    superGemRainbowImage,
    now,
  } = dims;

  if (gameState.boardCreated && gameState.gems) {
    for (let i = 0; i < gameState.gems.length; i += 1) {
      const gem = gameState.gems[i];
      if (gameState.superGemCellMap && gameState.superGemCellMap.size) {
        const key = `${gem.cellR},${gem.cellC}`;
        if (gameState.superGemCellMap.has(key)) continue;
      }
      const pos = worldToCanvas(gem.x, gem.y);

      let scale = 1;
      if (gem.bounceStart != null && gem.bounceDur != null) {
        const t = (now - gem.bounceStart) / Math.max(0.001, gem.bounceDur);
        if (t >= 0 && t < 1) {
          const amp = Number(gem.bounceAmp ?? 0.12);
          scale = 1 + (amp * Math.sin(Math.PI * t));
        }
      }

      const frameIndex = (gem.color ?? 0) % 6;
      const gemImg = gemFrameImages[frameIndex];
      const gemW = gem.width * layoutScale * scale;
      const gemH = gem.height * layoutScale * scale;
      const gemX = pos.x - gemW * 0.5;
      const gemY = pos.y - gemH * 0.5;

      if (gemImg) {
        ctx.drawImage(gemImg, gemX, gemY, gemW, gemH);
      } else {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, gemW * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      if (gem.selected || (gem.flashUntil && gem.flashUntil > now)) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = gem.flashUntil && gem.flashUntil > now ? 3 : 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, gemW * 0.48, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  if (Array.isArray(gameState.superGems) && gameState.superGems.length) {
    for (const sg of gameState.superGems) {
      if (!sg || !Array.isArray(sg.cells) || !sg.cells.length) continue;
      const topLeft = boardGeometry.getCellWorldBounds(sg.cells[0].c, sg.cells[0].r);
      const bottomRight = boardGeometry.getCellWorldBounds(
        sg.cells[sg.cells.length - 1].c,
        sg.cells[sg.cells.length - 1].r,
      );
      if (!topLeft || !bottomRight) continue;
      const x = topLeft.x;
      const y = topLeft.y;
      const w = ((bottomRight.x - topLeft.x) + topLeft.w) * layoutScale;
      const h = ((bottomRight.y - topLeft.y) + topLeft.h) * layoutScale;
      const p = worldToCanvas(x, y);
      const colorKey = Number.isFinite(Number(sg.baseColor)) ? Number(sg.baseColor) : 3;
      const superGemImg = sg.type === 'rainbow'
        ? (superGemRainbowImage || superGemFrameImages[colorKey] || null)
        : (superGemFrameImages[colorKey] || null);
      if (superGemImg) {
        ctx.drawImage(superGemImg, p.x, p.y, w, h);
      }
      ctx.save();
      ctx.lineWidth = Math.max(2, 4 * layoutScale);
      ctx.strokeStyle = '#68a7ff';
      if (sg.type === 'rainbow') {
        ctx.strokeStyle = '#f2d06b';
      }
      ctx.strokeRect(p.x, p.y, w, h);
      ctx.restore();
    }
  }

  if (gameState.yellowCasino && gameState.yellowCasino.ghost) {
    const ghost = gameState.yellowCasino.ghost;
    const pos = worldToCanvas(ghost.x, ghost.y);
    const frameIndex = (ghost.frame ?? 0) % 6;
    const gemImg = gemFrameImages[frameIndex];
    const w = ghost.w * layoutScale;
    const h = ghost.h * layoutScale;
    const gemX = pos.x - w * 0.5;
    const gemY = pos.y - h * 0.5;
    if (gemImg) {
      ctx.drawImage(gemImg, gemX, gemY, w, h);
    } else {
      ctx.fillStyle = '#ffa500';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, w * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
