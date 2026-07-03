import * as renderMap from './renderMap.js';
import * as renderTomes from './renderTomes.js';
import * as renderArtifacts from './renderArtifacts.js';
import * as renderMounts from './renderMounts.js';
import * as renderCollectibles from './renderCollectibles.js';
import * as renderRelics from './renderRelics.js';
import * as renderPets from './renderPets.js';
import * as renderIdleFarm from './renderIdleFarm.js';
import * as renderEvolution from './renderEvolution.js';
import * as renderHomestead from './renderHomestead.js';
import * as renderChests from './renderChests.js';
import * as renderHarnessFallback from './renderHarnessFallback.js';

export function createSurfaceRenderRouter({
  ctx,
  canvas,
  gameState,
  uiState,
  mapLayoutState,
  animationMath,
  heroLayoutSpec,
  getCloseWinOvalImage,
  getMapBackgroundImage,
  getMapCaveImage,
  getMapTowerImages,
  renderHeroScreenLayoutV2,
  getDpr,
  getFreshCombatBootstrapped,
  getStartupFingerprintLabel,
  getHeroScreenDeps,
  getIdleFarmDeps,
  drawHUD,
} = {}) {
  const getViewSize = () => {
    const dpr = Math.max(1, Number(typeof getDpr === 'function' ? getDpr() : 1) || 1);
    return {
      dpr,
      viewWidth: canvas.width / dpr,
      viewHeight: canvas.height / dpr,
    };
  };

  const applyLayoutResult = (layoutRef, result) => {
    if (layoutRef && result && result.hitZones) layoutRef.hitZones = result.hitZones;
    uiState.setUIFields((result && result.uiPatches) || {});
    if (result && result.drawHudAfter && typeof drawHUD === 'function') drawHUD();
  };

  function draw(layoutId) {
    const { dpr, viewWidth, viewHeight } = getViewSize();
    const closeWinOvalImage = typeof getCloseWinOvalImage === 'function' ? getCloseWinOvalImage() : null;
    const mapBackgroundImage = typeof getMapBackgroundImage === 'function' ? getMapBackgroundImage() : null;
    const mapCaveImage = typeof getMapCaveImage === 'function' ? getMapCaveImage() : null;
    const mapTowerImages = typeof getMapTowerImages === 'function' ? getMapTowerImages() : null;
    const sharedDims = { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage };

    switch (layoutId) {
      case 'mapLayout': {
        mapLayoutState.setMapPanY(0);
        const mapRenderResult = renderMap.renderMap(
          ctx,
          gameState,
          uiState.getUIState(),
          mapLayoutState.getMapLayoutState(),
          {
            viewWidth,
            viewHeight,
            mapBackgroundImage,
            mapCaveImage,
            mapTowerImages,
            heroLayoutSpec,
            closeWinOvalImage,
          },
        );
        mapLayoutState.setMapLayoutBounds(mapRenderResult.panBounds);
        mapLayoutState.setMapPanX(mapRenderResult.clampedPanX);
        mapLayoutState.setMapLayoutField('lastRender', mapRenderResult.lastRender);
        mapLayoutState.setMapLayoutField('closeHit', mapRenderResult.closeHit);
        mapLayoutState.setMapLayoutField('tomesLocaleHit', mapRenderResult.localeHits.tomesLocaleHit);
        mapLayoutState.setMapLayoutField('artifactsLocaleHit', mapRenderResult.localeHits.artifactsLocaleHit);
        mapLayoutState.setMapLayoutField('mountsLocaleHit', mapRenderResult.localeHits.mountsLocaleHit);
        mapLayoutState.setMapLayoutField('relicsLocaleHit', mapRenderResult.localeHits.relicsLocaleHit);
        mapLayoutState.setMapLayoutField('collectiblesLocaleHit', mapRenderResult.localeHits.collectiblesLocaleHit);
        mapLayoutState.setMapLayoutField('homesteadLocaleHit', mapRenderResult.localeHits.homesteadLocaleHit);
        return;
      }
      case 'tomesLayout':
        applyLayoutResult(gameState.tomesLayout, renderTomes.renderTomes(ctx, gameState, sharedDims));
        return;
      case 'artifactsLayout':
        applyLayoutResult(gameState.artifactsLayout, renderArtifacts.renderArtifacts(ctx, gameState, sharedDims));
        return;
      case 'mountsLayout':
        applyLayoutResult(gameState.mountsLayout, renderMounts.renderMounts(ctx, gameState, sharedDims));
        return;
      case 'collectiblesLayout':
        applyLayoutResult(gameState.collectiblesLayout, renderCollectibles.renderCollectibles(ctx, gameState, sharedDims));
        return;
      case 'relicsLayout':
        applyLayoutResult(gameState.relicsLayout, renderRelics.renderRelics(ctx, gameState, sharedDims));
        return;
      case 'petsLayout':
        applyLayoutResult(gameState.petsLayout, renderPets.renderPets(ctx, gameState, sharedDims));
        return;
      case 'idleFarmLayout': {
        const idleDeps = typeof getIdleFarmDeps === 'function' ? getIdleFarmDeps() : {};
        applyLayoutResult(
          gameState.idleFarmLayout,
          renderIdleFarm.renderIdleFarm(
            ctx,
            gameState,
            idleDeps,
            { viewWidth, viewHeight },
          ),
        );
        return;
      }
      case 'evolutionLayout':
        applyLayoutResult(gameState.evolutionLayout, renderEvolution.renderEvolution(ctx, gameState, sharedDims));
        return;
      case 'homesteadLayout':
        applyLayoutResult(gameState.homesteadLayout, renderHomestead.renderHomestead(ctx, gameState, sharedDims));
        return;
      case 'chestsLayout':
        applyLayoutResult(gameState.chestsLayout, renderChests.renderChests(ctx, gameState, sharedDims));
        return;
      case 'heroLayout': {
        const heroDeps = typeof getHeroScreenDeps === 'function' ? getHeroScreenDeps() : {};
        renderHeroScreenLayoutV2({
          ctx,
          canvas,
          dpr,
          gameState,
          ...heroDeps,
        });
        return;
      }
      default:
        renderHarnessFallback.renderHarnessFallback(ctx, layoutId, gameState, {
          viewWidth,
          viewHeight,
          startupFingerprintLabel: typeof getStartupFingerprintLabel === 'function' ? getStartupFingerprintLabel() : '',
          freshCombatBootstrapped: typeof getFreshCombatBootstrapped === 'function' ? getFreshCombatBootstrapped() : false,
        });
    }
  }

  return { draw };
}
