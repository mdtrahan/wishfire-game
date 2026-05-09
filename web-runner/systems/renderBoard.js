import { getSuperGemRenderImage, getSuperGemRenderRect } from '../src/core/superGemRender.mjs';

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
  const gemFrames = Array.isArray(gemFrameImages) ? gemFrameImages : [];

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
      const gemImg = gemFrames[frameIndex];
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
      const rect = getSuperGemRenderRect({
        superGem: sg,
        gems: gameState.gems || [],
        boardGeometry,
        layoutScale,
        worldToCanvas,
      });
      if (!rect) continue;
      const superGemImg = getSuperGemRenderImage({
        superGem: sg,
        gemFrameImages,
        superGemFrameImages,
        superGemRainbowImage,
      });
      if (superGemImg) {
        ctx.drawImage(superGemImg, rect.x, rect.y, rect.w, rect.h);
      }
    }
  }

  if (gameState.yellowCasino && gameState.yellowCasino.ghost) {
    const ghost = gameState.yellowCasino.ghost;
    const pos = worldToCanvas(ghost.x, ghost.y);
    const frameIndex = (ghost.frame ?? 0) % 6;
    const gemImg = gemFrames[frameIndex];
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
