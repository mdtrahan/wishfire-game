import { updateHpTextRollState } from '../src/core/hpTextRollAnimation.mjs';
import {
  COMBAT_BATTLEFIELD_ZOOM,
  createCombatCameraProjection,
  deriveCombatWorldBounds,
  createCombatFormationProjection,
  createCombatOrientationGeometry,
  deriveCombatReferenceGrid,
  deriveCombatFormationAnchors,
  normalizeCombatOrientation,
  orientCombatWorldOffsetX,
} from '../../src/core/combatOrientation.mjs';
import { heroArtAsset, resolveHeroArtSourceRect } from '../state/heroArtAssets.mjs';
import { drawCombatProgressHud } from './renderCombatBossControl.mjs';
import { drawCombatHealthBar } from './combatHealthBarPresentation.mjs';
import { drawCombatArenaBackground } from './combatArenaBackground.mjs';
import { drawActorPuppetFrame } from './actorPuppetPresentation.mjs';
import { combatEnemiesForPresentation } from './actorPuppetDefeats.mjs';
import { resolveCombatCameraCenterX } from '../src/core/combatCamera.mjs';
import { createEnemyActivationFade, paintWithActivationAlpha } from './enemyActivationFadePresentation.mjs';
import {
  computeCombatDamageFontSize,
  computeViewportFontSize,
  fitCanvasText,
} from './combatPresentationScale.mjs';

const enemyActivationFadeAlpha = createEnemyActivationFade();

const body = `with (scope) {

    const runtimeArtifacts = { overlayData: null, visualFlags: null, presentationPatches: null };
    const presentationPatches = {};
    const bossPresentationActive = state.globals.ContinuousCombatStage?.bossActive === true;
    const activeCombatOrientation = (bossPresentationActive || Number(state.globals.ContinuousCombatStageLoop) === 1) ? 'left-wise' : normalizeCombatOrientation(state.globals.CombatOrientation);
    const combatFormationAnchors = deriveCombatFormationAnchors({ globals: state.globals, entities: state.entities, heroCount: getCombatPartyRenderRoster().length });
    const combatWorldVfxScale = layoutScale * COMBAT_BATTLEFIELD_ZOOM;
    const combatWorldBounds = deriveCombatWorldBounds(layoutW, COMBAT_BATTLEFIELD_ZOOM);
    const livingHeroesForCamera = state.entities.filter(actor => actor?.kind === 'hero' && Number(actor.hp || 0) > 0);
    const squadCenterX = livingHeroesForCamera.length ? livingHeroesForCamera.reduce((sum, hero) => sum + Number(hero.footX ?? hero.x ?? layoutW / 2), 0) / livingHeroesForCamera.length : layoutW / 2;
    const cameraCenterX = bossPresentationActive ? Number(state.globals.ContinuousCombatStage?.bossCameraCenterX ?? squadCenterX) : resolveCombatCameraCenterX(state.globals, squadCenterX);
    const combatCameraProjection = createCombatCameraProjection({ viewportWidth: layoutW, worldWidth: combatWorldBounds.worldWidth, zoom: COMBAT_BATTLEFIELD_ZOOM, centerX: cameraCenterX, orientation: activeCombatOrientation });
    const projectCombatActorWorldToCanvas = (x, y, actorKind = '') => { const point = state.globals.RustCombatPresentation ? state.globals.RustCombatPresentation.project(x, y) : combatCameraProjection.project(x, y, actorKind); return worldToCanvas(point.x, point.y); };
    const projectCombatDamageWorldToCanvas = (x, y, targetKind) => (targetKind === 'bar' || targetKind === 'energy') ? worldToCanvas(x, y) : projectCombatActorWorldToCanvas(x, y, targetKind === 'hero' ? 'hero' : 'enemy');
    const combatOrientationGeometryActors = [];
    const visualControlPatches = {};
    const runtimeRandomGemFrame = (typeof randomGemFrame === 'function') ? randomGemFrame : (() => Math.floor(Math.random() * 6));
    const activeRuntimeLayout = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;
    if (activeRuntimeLayout && activeRuntimeLayout !== 'combat') {
      drawHarnessLayoutTakeover(activeRuntimeLayout);
      return;
    }
    if (layoutHarnessEnabled && harnessLayoutState) {
      const activeLayout = harnessLayoutState.getActiveLayoutId();
      if (activeLayout && activeLayout !== 'combat') {
        drawHarnessLayoutTakeover(activeLayout);
        return;
      }
    }
    if (!COMBAT_BOOTSTRAP_COMPLETE && !layoutHarnessEnabled) {
      drawStartupLoadingFrame();
      return;
    }
    if (state.globals.DevToolingPaused && !(state.globals.QaScenarioPaused && state.globals.QaFixtureHoldTurn)) {
      lastFrameTime = performance.now();
      return;
    }

    const now = performance.now();
    const dtBase = dtOverride != null
      ? dtOverride
      : Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    const dt = dtOverride != null
      ? dtBase
      : dtBase * Math.max(0.25, Number(state.globals.DevCombatSpeedMultiplier || 1));
    lastFrameTime = now;
    // Dynamically filter overlay elements based on current state
    const overlayElements = new Set(['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX']);
    const debugElements = new Set(['newdebugger', 'newdebugger2', 'InputBlocker', 'EnemyKeyList', 'KillCounter', 'turnTracker', 'txtPhaseInfo']);
    const buffIcons = new Set(['buffIcon1', 'buffIcon2', 'buffIcon3', 'buffIcon4']);


    // Center the close button + X on the layout viewport
    const closeBtn = rendered.find(r => r.inst.type === 'UI_NavCloseButton');
    const closeX = rendered.find(r => r.inst.type === 'UI_NavCloseX');
    if (closeBtn) {
      closeBtn.world.x = layoutW / 2;
    }
    if (closeX) {
      closeX.world.x = layoutW / 2;
      if (closeBtn) closeX.world.y = closeBtn.world.y;
    }

    const filteredRendered = rendered.filter(r => {
      // Remove the legacy buff-slot placeholder row from combat.
      if (r.inst && r.inst.type === 'Sprite5' && r.layerName === 'BoardBG') {
        return false;
      }
      // Hide overlay elements when overlay is not visible
      if(!uiState.getUIState().overlayVisible && overlayElements.has(r.inst.type)){
        return false;
      }
      if(buffIcons.has(r.inst.type)) {
        return false;
      }
      if (r.inst.type === 'AddMore') {
        return false;
      }
      // Hide debug and nav text elements (we'll render clean nav labels instead)
      if(debugElements.has(r.inst.type)){
        return false;
      }
      // Compute scaled bounds for this frame
      const pos = worldToCanvas(r.world.x || 0, r.world.y || 0);
      const drawW = (r.world.width || 64) * layoutScale;
      const drawH = (r.world.height || 64) * layoutScale;
      r.w = drawW;
      r.h = drawH;
      if (r.inst.type === 'UI_NavCloseButton' || r.inst.type === 'UI_NavCloseX') {
        const center = worldToCanvas(layoutW / 2, r.world.y || 0);
        r.dx = center.x - drawW * 0.5;
        r.dy = center.y - drawH * 0.5;
      } else if (r.inst.type === 'AddMore') {
        r.dx = pos.x - drawW * r.ox;
        r.dy = pos.y - drawH * r.oy - (10 * layoutScale);
      } else {
        r.dx = pos.x - drawW * r.ox;
        r.dy = pos.y - drawH * r.oy;
      }
      return true;
    });

    // Debug: Log filter results
    if (uiState.getUIState().overlayVisible !== lastOverlayState) {
      runtimeDebugLogging.startupDebugLog(\`[FILTER] overlayVisible=\${uiState.getUIState().overlayVisible}, filteredRendered=\${filteredRendered.length} items\`);
      lastOverlayState = uiState.getUIState().overlayVisible;
    }

    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0,0,canvas.width,canvas.height);

    // Map layer names to color coding
    const layerColors = {
      'Background': '#d4a574',    // tan/brown for ground
      'BoardBG': '#f4f9a6',       // light yellow for board
      'Hero_Pics': '#87ceeb',     // sky blue for heroes
      'Game': '#ffcccc',          // light red for game objects
      'UI': '#90ee90',            // light green for UI
      'Window Popup': '#dda0dd',  // plum for popups
      'Resource BKG': '#f0e68c',  // khaki for resources
      'GemBG': '#ffa500'          // orange for gems
    };

    // Separate modal and non-modal objects for proper z-ordering
    const isModalObject = (type) => ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(type);
    const navTextTypes = new Set(['Nav_HeroText', 'Nav_MapText', 'Nav_MissionText', 'Nav_AstralFlowText', 'Nav_HomeText']);
    const movedRadiatorsToSidebar = false;
    const showLeftCombatRadiators = false;
    const showCombatAreaTurnOrder = false;
    const legacyCombatAreaTextTypes = new Set(['EnemyKeyList', 'KillCounter', 'txtPhaseInfo']);
    const combatAreaTurnOrderTextTypes = new Set([
      'track_next',
      'track_nextplus1',
      'track_nextplus2',
      'track_nextplus3',
      'track_nextplus4',
      'track_nextplus5',
    ]);
    const movedRadiatorTextTypes = new Set([
      'Chain_Tracker',
      'ActorIntent',
      'CombatAction',
      'CombatAction1',
      'CombatAction2',
      'CombatAction3',
      ...combatAreaTurnOrderTextTypes,
    ]);
    const navTopTypes = new Set([...navTextTypes]);
    const extraTrackTypes = new Set(['track_nextplus1', 'track_nextplus2', 'track_nextplus3', 'track_nextplus4', 'track_nextplus5']);
    const presentTrackOffsets = new Set(
      rendered
        .filter(r => extraTrackTypes.has(r.inst.type))
        .map(r => ({
          track_nextplus1: 1,
          track_nextplus2: 2,
          track_nextplus3: 3,
          track_nextplus4: 4,
          track_nextplus5: 5
        }[r.inst.type]))
        .filter(v => typeof v === 'number')
    );
    const allExtraPresent = [1,2,3,4,5].every(n => presentTrackOffsets.has(n));
    const NAV_BACKER_UID = 10; // navBacker (keep JSON unchanged)
    const scaleFont = (size) => computeViewportFontSize(size, layoutScale);
    const navFontBoost = computeViewportFontSize(2, layoutScale, 1);

    const modalRendered = filteredRendered.filter(r => isModalObject(r.inst.type));
    const modalPlane = modalRendered.find(r => r.inst.type === 'UI_CloseWin');
    const closeBtnRender = modalRendered.find(r => r.inst.type === 'UI_NavCloseButton');
    const closeXRender = modalRendered.find(r => r.inst.type === 'UI_NavCloseX');
    const navBacker = filteredRendered.find(r => r.uid === NAV_BACKER_UID) || null;
    const navTopRendered = uiState.getUIState().overlayVisible ? filteredRendered.filter(r => navTopTypes.has(r.inst.type)) : [];

    const nonModalRendered = filteredRendered.filter(r =>
      !isModalObject(r.inst.type) &&
      !(uiState.getUIState().overlayVisible && (navTopTypes.has(r.inst.type) || (navBacker && r.uid === navBacker.uid)))
    );
    const closeBtnCenter = closeBtnRender ? { x: closeBtnRender.dx + closeBtnRender.w / 2, y: closeBtnRender.dy + closeBtnRender.h / 2 } : null;
    const boardW = boardGeometry.cols * boardGeometry.cellSize + (boardGeometry.cols - 1) * boardGeometry.gap;
    const boardH = boardGeometry.rows * boardGeometry.cellSize + (boardGeometry.rows - 1) * boardGeometry.gap;
    const grid = gameState.gridBounds || {
      minX: boardGeometry.gx,
      minY: boardGeometry.gy,
      maxX: boardGeometry.gx + boardW,
      maxY: boardGeometry.gy + boardH
    };
    const radiatorScale = Math.max(0.85, Math.min(layoutScale, 1.05));
    const radiatorSidePad = Math.max(6, 8 * radiatorScale);
    const radiatorGap = Math.max(8, 10 * radiatorScale);
    const radiatorPanelW = Math.max(112, Math.round(120 * radiatorScale));
    const radiatorTrackPanelW = Math.max(122, Math.round(132 * radiatorScale));
    const radiatorPanelY = layoutOffsetY + Math.max(6, 8 * radiatorScale);
    const panelH = Math.max(72, Math.round(78 * radiatorScale));
    const trackPanelH = Math.max(90, Math.round(96 * radiatorScale));
    const leftPanelX = layoutOffsetX + radiatorSidePad;
    const rightPanelX = layoutOffsetX + (layoutW * layoutScale) - radiatorSidePad - radiatorTrackPanelW;
    const chainPanelH = Math.max(26, Math.round(28 * radiatorScale));
    const chainAnchor = {
      x: leftPanelX + radiatorPanelW / 2,
      y: radiatorPanelY + chainPanelH - Math.max(7, Math.round(8 * radiatorScale))
    };
    const combatAnchor = {
      x: leftPanelX + Math.max(4, Math.round(5 * radiatorScale)),
      y: radiatorPanelY + chainPanelH + Math.max(12, Math.round(13 * radiatorScale))
    };
    const storySlot = gameState.storyCardLayout;
    const trackAnchor = {
      x: rightPanelX + Math.max(4, Math.round(5 * radiatorScale)),
      y: radiatorPanelY + Math.max(16, Math.round(17 * radiatorScale))
    };
    const radiatorPanels = {
      chain: { x: leftPanelX, y: radiatorPanelY, w: radiatorPanelW, h: chainPanelH },
      combat: { x: leftPanelX, y: radiatorPanelY + chainPanelH + Math.max(4, Math.round(5 * radiatorScale)), w: radiatorPanelW, h: panelH },
      track: { x: rightPanelX, y: radiatorPanelY, w: radiatorTrackPanelW, h: trackPanelH }
    };
    const drawRadiatorPanel = (panel) => {
      ctx.save();
      ctx.fillStyle = 'rgba(240,240,240,0.92)';
      ctx.strokeStyle = 'rgba(60,60,60,0.85)';
      ctx.lineWidth = 1;
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
      ctx.restore();
    };
    if (!movedRadiatorsToSidebar && showLeftCombatRadiators) {
      drawRadiatorPanel(radiatorPanels.chain);
      drawRadiatorPanel(radiatorPanels.combat);
    }

    const drawBasicItem = (r) => {
      if (!r) return;
      ctx.save();
      const img = r.img;
      if(img){
        ctx.drawImage(img, r.dx, r.dy, r.w, r.h);
      } else if(r.isButton){
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        ctx.fillStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
        ctx.fillStyle = '#111';
        ctx.font = \`bold \${scaleFont(14)}px sans-serif\`;
        ctx.textAlign = 'center';
        const label = r.textContent || r.inst.type || 'Button';
        ctx.fillText(label, r.dx + r.w / 2, r.dy + r.h / 2 + 5);
      } else if(r.isText){
        const baseSize = r.inst.properties && r.inst.properties.size ? r.inst.properties.size : 12;
        const fontSize = computeViewportFontSize(baseSize + (navTextTypes.has(r.inst.type) ? 2 : 0), layoutScale);
        const fontColor = r.inst.properties && r.inst.properties.color ?
          \`rgb(\${Math.round(r.inst.properties.color[0]*255)}, \${Math.round(r.inst.properties.color[1]*255)}, \${Math.round(r.inst.properties.color[2]*255)})\` : '#111';
        ctx.fillStyle = fontColor;
        ctx.font = \`\${fontSize}px sans-serif\`;
        ctx.textAlign = 'center';
        const text = r.textContent || r.inst.type;
        ctx.fillText(text, r.dx + r.w/2, r.dy + r.h/2 + 5);
      } else {
        const layerColor = layerColors[r.layerName] || '#ddd';
        ctx.fillStyle = layerColor;
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        ctx.strokeStyle = layerColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
      }
      ctx.restore();
    };

    // No roulette rendering; buff icons use pop-in emphasis only
    const popDuration = 0.22;
    const popScale = (t) => {
      const x = Math.max(0, Math.min(1, t));
      if (x < 0.5) return 1 + (1.485 - 1) * (x / 0.5);
      if (x < 0.8) return 1.485 + (0.90 - 1.485) * ((x - 0.5) / 0.3);
      return 0.90 + (1 - 0.90) * ((x - 0.8) / 0.2);
    };
    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const iconPresentation = gameState.buffIconPresentation || { active: false, phase: 'idle', frameType: -1, slotType: '', from: { x: 0, y: 0, w: 0, h: 0 }, to: { x: 0, y: 0, w: 0, h: 0 }, travelSec: 0, travelStartAt: 0 };
    const buffSlotByFrame = {};
    for (const r of nonModalRendered) {
      if (!buffIcons.has(r.inst.type)) continue;
      const frameIdx = buffIconFrames[r.inst.type] || 0;
      if (buffSlotByFrame[frameIdx]) continue;
      buffSlotByFrame[frameIdx] = {
        slotType: r.inst.type,
        x: r.dx + r.w / 2,
        y: r.dy + r.h / 2,
        w: r.w,
        h: r.h,
      };
    }
    gameState.buffIconSlotsByFrame = buffSlotByFrame;
    gameState.buffIconPresentationCenter = { x: layoutOffsetX + (layoutW * layoutScale) / 2, y: layoutOffsetY + (layoutH * layoutScale) / 2 - 40 };
    const popTypeNow = state.globals.BuffIconPopType;
    const popAtNow = state.globals.BuffIconPopAt;
    const rouletteTargetFrame = iconPresentation && iconPresentation.frameType >= 0
      ? iconPresentation.frameType
      : popTypeNow;
    const rouletteInFlight = !!(gameState.gemMergeFx && gameState.gemMergeFx.active) ||
      (iconPresentation && (iconPresentation.phase === 'waiting' || iconPresentation.phase === 'hold' || iconPresentation.phase === 'travel' || iconPresentation.active));


    let energyLayout = null;
    if (navBacker) {
      const hudLeft = navBacker.dx;
      const hudTop = navBacker.dy;
      const hudWidth = navBacker.w;
      const hudHeight = navBacker.h;
      energyLayout = {
        centerX: hudLeft + (hudWidth * 0.5),
        barY: hudTop + (hudHeight * 0.52),
        textY: hudTop + (hudHeight * 0.83),
      };
    }
    // Draw non-modal objects first
    let combatReferenceGridDrawn = false;
    const drawCombatReferenceGrid = () => {
      if (drawCombatArenaBackground(ctx, { region: state.globals.ContinuousCombatStage?.region ?? 1, worldWidth: combatWorldBounds.worldWidth, project: projectCombatActorWorldToCanvas, worldToCanvas, layoutH })) return;
      const grid = deriveCombatReferenceGrid(combatWorldBounds.worldWidth, layoutH);
      const topLeft = worldToCanvas(0, 0);
      const bottomRight = worldToCanvas(layoutW, layoutH);
      const crisp = value => Math.round(value) + 0.5;
      const drawLine = (line, vertical) => {
        const point = vertical ? projectCombatActorWorldToCanvas(line.value, 0) : projectCombatActorWorldToCanvas(0, line.value);
        ctx.beginPath();
        ctx.strokeStyle = line.major ? 'rgba(91, 111, 133, 0.48)' : 'rgba(148, 163, 184, 0.24)';
        ctx.lineWidth = line.major ? 1.2 : 0.7;
        if (vertical) {
          ctx.moveTo(crisp(point.x), topLeft.y);
          ctx.lineTo(crisp(point.x), bottomRight.y);
        } else {
          ctx.moveTo(topLeft.x, crisp(point.y));
          ctx.lineTo(bottomRight.x, crisp(point.y));
        }
        ctx.stroke();
      };
      ctx.save();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      grid.vertical.forEach(line => drawLine(line, true));
      grid.horizontal.forEach(line => drawLine(line, false));
      const center = projectCombatActorWorldToCanvas(grid.centerX, 0);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.62)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(crisp(center.x), topLeft.y);
      ctx.lineTo(crisp(center.x), bottomRight.y);
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.font = \`\${Math.max(7, Math.round(8 * layoutScale))}px ui-monospace, monospace\`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      grid.vertical.filter(line => line.major && line.value < combatWorldBounds.worldWidth).forEach(line => {
        const point = projectCombatActorWorldToCanvas(line.value, 0);
        if (point.x < topLeft.x || point.x > bottomRight.x) return;
        ctx.fillText(String(line.value), point.x + 2, topLeft.y + 2);
      });
      grid.horizontal.filter(line => line.major && line.value > 0 && line.value < layoutH).forEach(line => {
        const point = projectCombatActorWorldToCanvas(0, line.value);
        ctx.fillText(String(line.value), topLeft.x + 2, point.y + 2);
      });
      ctx.fillText(\`x\${grid.centerX}\`, center.x + 2, topLeft.y + Math.max(12, 12 * layoutScale));
      ctx.restore();
    };
    for(const r of nonModalRendered){
      if (r.inst.type === 'PartyHP_Bar' || r.inst.type === 'grid_placeholder' || r.uid === 10 || r.inst.type.startsWith('Nav_')) continue;
      if (r.inst.type === 'EnemyArea') {
        if (!combatReferenceGridDrawn) {
          drawCombatReferenceGrid();
          combatReferenceGridDrawn = true;
        }
        continue;
      }
      const img = r.img;
      const isCloseControl = ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(r.inst.type);
      if(img){
        const frameIdx = buffIcons.has(r.inst.type) ? (buffIconFrames[r.inst.type] || 0) : null;
        if (frameIdx != null && buffIconFrameImages[r.inst.type] && buffIconFrameImages[r.inst.type][frameIdx]) {
          if (
            rouletteInFlight &&
            rouletteTargetFrame != null &&
            rouletteTargetFrame === frameIdx &&
            !state.globals.BuffIconPopStacking
          ) {
            continue;
          }
          let scale = 1;
          if (buffIcons.has(r.inst.type)) {
            const popType = state.globals.BuffIconPopType;
            let popAt = state.globals.BuffIconPopAt;
            if (
              iconPresentation.landedAt != null &&
              iconPresentation.slotType === r.inst.type &&
              iconPresentation.frameType === frameIdx
            ) {
              popAt = iconPresentation.landedAt;
            }
            if (state.globals.BuffIconPopStacking) {
              popAt = (iconPresentation.landedAt != null &&
                iconPresentation.slotType === r.inst.type &&
                iconPresentation.frameType === frameIdx)
                ? iconPresentation.landedAt
                : null;
            }
            if (popType != null && popAt != null && popType === frameIdx) {
              const t = (state.globals.time - popAt) / popDuration;
              if (t >= 0 && t <= 1) scale = popScale(t);
            }
          }
          if (scale !== 1) {
            const cx = r.dx + r.w / 2;
            const cy = r.dy + r.h / 2;
            const w = r.w * scale;
            const h = r.h * scale;
            ctx.drawImage(buffIconFrameImages[r.inst.type][frameIdx], cx - w/2, cy - h/2, w, h);
          } else {
            ctx.drawImage(buffIconFrameImages[r.inst.type][frameIdx], r.dx, r.dy, r.w, r.h);
          }
        } else if (isCloseControl) {
          const cx = r.dx + (r.w / 2);
          const cy = r.dy + (r.h / 2);
          const radius = Math.min(r.w, r.h) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, r.dx, r.dy, r.w, r.h);
          ctx.restore();
        } else {
          ctx.drawImage(img, r.dx, r.dy, r.w, r.h);
        }
      } else if(r.isButton){
        if (isCloseControl) {
          const cx = r.dx + (r.w / 2);
          const cy = r.dy + (r.h / 2);
          const radius = Math.min(r.w, r.h) / 2;
          ctx.fillStyle = '#d9d9d9';
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#666';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Render buttons with a distinct button style
          ctx.fillStyle = '#e8e8e8';  // button gray
          ctx.fillRect(r.dx, r.dy, r.w, r.h);
          ctx.fillStyle = '#666';     // darker border
          ctx.lineWidth = 2;
          ctx.strokeRect(r.dx, r.dy, r.w, r.h);
        }
      } else if(r.isText) {
        // Text objects render without placeholder background
      } else {
        // Use layer-specific color for placeholder boxes
        const layerColor = layerColors[r.layerName] || '#ddd';
        ctx.fillStyle = layerColor;
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        // Draw border with layer color
        ctx.strokeStyle = layerColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
      }

      // Draw text label
      ctx.fillStyle = '#111';
      if(r.isButton){
        ctx.font = \`bold \${scaleFont(14)}px sans-serif\`;
      } else {
        ctx.font = \`\${scaleFont(12)}px sans-serif\`;
      }
      ctx.textAlign = 'center';

      if(r.inst.type === 'UI_NavCloseX') {
        // Render the X centered on the close button circle
        const size = closeBtnRender ? Math.min(closeBtnRender.w, closeBtnRender.h) * 0.6 : Math.min(r.w, r.h) * 0.6;
        ctx.fillStyle = '#111';
        ctx.font = \`bold \${Math.max(12, Math.round(size))}px sans-serif\`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = closeBtnCenter ? closeBtnCenter.x : (r.dx + r.w/2);
        const cy = closeBtnCenter ? closeBtnCenter.y : (r.dy + r.h/2);
        ctx.fillText('X', cx, cy);
        ctx.textBaseline = 'alphabetic';
      } else if(r.isText){
        if (legacyCombatAreaTextTypes.has(r.inst.type)) {
          continue;
        }
        if (!showCombatAreaTurnOrder && combatAreaTurnOrderTextTypes.has(r.inst.type)) {
          continue;
        }
        if (movedRadiatorsToSidebar && movedRadiatorTextTypes.has(r.inst.type) && r.inst.type !== 'CombatAction') {
          continue;
        }
        const baseSize = r.inst.properties && r.inst.properties.size ? r.inst.properties.size : 12;
        const fontSize = computeViewportFontSize(baseSize + (navTextTypes.has(r.inst.type) ? 2 : 0), layoutScale);
        ctx.font = \`\${fontSize}px sans-serif\`;
        // Draw actual text content (extracted or generated label)
        let text = r.textContent || '[Text]';
        if (r.inst.type === 'Chain_Tracker') {
          if (!showLeftCombatRadiators) {
            continue;
          }
          const chainNum = Math.max(0, Number(state.globals.ChainNumber || 0));
          const suppress = !!state.globals.SuppressChainUI;
          const hideAt = Number(state.globals.ChainUIHideAt || 0);
          const now = Number(state.globals.time || 0);
          const isVisible = chainNum >= 2 && !suppress && (hideAt === 0 || now <= hideAt);
          if (!isVisible) {
            continue;
          }
          text = \`Chain x\${chainNum}\`;
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = Math.max(2, Math.round(4 * layoutScale));
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.max(1, Math.round(2 * layoutScale));
          ctx.textAlign = 'center';
          ctx.fillText(text, chainAnchor.x, chainAnchor.y);
          ctx.restore();
          continue;
        }
        if (r.inst.type === 'BuffText') {
          text = state.globals.BuffText || '';
        } else if (r.inst.type === 'ActorIntent') {
          if (!showLeftCombatRadiators) {
            continue;
          }
          text = state.globals.ActorIntent || text;
          ctx.textAlign = 'left';
          const lineH = Math.max(12, (r.h || 14 * layoutScale));
          ctx.fillText(text, combatAnchor.x, combatAnchor.y + lineH * 4);
          continue;
        } else if (['CombatAction', 'CombatAction1', 'CombatAction2', 'CombatAction3'].includes(r.inst.type)) {
          if (r.inst.type !== 'CombatAction') {
            continue;
          }
          if (!storySlot || !storySlot.initialized) {
            continue;
          }
          const liveLine = getStoryCardLiveLineState();
          text = liveLine.text;
          const storyFontSize = computeViewportFontSize(10.71, layoutScale);
          ctx.save();
          ctx.fillStyle = 'rgba(245,245,245,0.96)';
          ctx.strokeStyle = 'rgba(80,80,80,0.7)';
          ctx.lineWidth = 1;
          ctx.fillRect(storySlot.x, storySlot.y, storySlot.w, storySlot.h);
          ctx.strokeRect(storySlot.x, storySlot.y, storySlot.w, storySlot.h);
          ctx.restore();
          ctx.textAlign = 'left';
          ctx.font = \`bold \${storyFontSize}px sans-serif\`;
          const storyPadding = Math.max(4, Math.round(12 * layoutScale));
          const storyTextX = storySlot.x + storyPadding;
          const storyTextY = storySlot.y + (storySlot.h * 0.58);
          const storyMaximumWidth = Math.max(1, storySlot.w - (storyPadding * 2));
          fitCanvasText(ctx, text, { baseSize: 10.71, layoutScale, maximumWidth: storyMaximumWidth, weight: 'bold' });
          const split = splitStoryCardActorSegment(text);
          ctx.save();
          ctx.globalAlpha = liveLine.animAlpha;
          if (split.actor) {
            ctx.fillStyle = '#E35822';
            ctx.fillText(split.actor, storyTextX, storyTextY);
            const actorWidth = ctx.measureText(split.actor).width;
            ctx.fillStyle = '#314877';
            ctx.fillText(split.rest, storyTextX + actorWidth, storyTextY);
          } else {
            ctx.fillStyle = '#314877';
            ctx.fillText(text, storyTextX, storyTextY);
          }
          ctx.restore();
          continue;
        } else if (r.inst.type === 'PartyHP_text') {
          continue;
        } else if (r.inst.type === 'Text_Energy') {
          continue;
        } else if (r.inst.type === 'Text_Gold') {
          const gold = state.globals.goldTotal ?? 0;
          text = \`Gold: \${gold}\`;
          if (r.world) {
            const w = Number(r.world.width || 0);
            const h = Number(r.world.height || 0);
            const ox = r.world.originX != null ? Number(r.world.originX) : 0.5;
            const oy = r.world.originY != null ? Number(r.world.originY) : 0.5;
            gameState.goldLabelTargetWorld = {
              x: Number(r.world.x || 0) + (0.5 - ox) * w,
              y: Number(r.world.y || 0) + (0.5 - oy) * h,
            };
          }
        } else if (r.inst.type === 'Nav_MissionText') {
          text = 'Vault';
        } else if (['track_next', 'track_nextplus1', 'track_nextplus2', 'track_nextplus3', 'track_nextplus4', 'track_nextplus5'].includes(r.inst.type)) {
          const order = state.globals.TurnOrderArray || [];
          const count = order.length;
          const baseIndex = state.globals.CurrentTurnIndex || 0;
          const offset = {
            track_next: 0,
            track_nextplus1: 1,
            track_nextplus2: 2,
            track_nextplus3: 3,
            track_nextplus4: 4,
            track_nextplus5: 5
          }[r.inst.type] || 0;
          if (count > 0) {
            const idx = (baseIndex + offset) % count;
            const row = order[idx];
            if (row) {
              const actor = state.entities.find(e => e.uid === row.uid);
              if (actor) {
                const label = actor.name || '?';
                const baseSpd = Number(actor.stats?.SPD ?? actor.SPD ?? 0);
                const debuff = actor.kind === 'enemy'
                  ? (state.globals.EnemyDebuffs?.[actor.uid]?.SPD || 0)
                  : 0;
                const curSpd = baseSpd - debuff;
                const extraTag = row.extra ? ' (x2)' : '';
                const delta = actor.kind === 'enemy' && debuff > 0
                  ? \`(-\${Math.round(debuff)})\`
                  : '';
                text = \`\${label} \${Math.round(curSpd)}/\${Math.round(baseSpd)}\${delta ? \` \${delta}\` : ''}\${extraTag}\`;
              } else {
                text = '';
              }
            } else {
              text = '';
            }
          } else {
            text = '';
          }
          ctx.textAlign = 'left';
          const lineH = Math.max(10, (r.h || 14 * layoutScale) * 0.65);
          ctx.fillText(text, trackAnchor.x + 4, trackAnchor.y + lineH * offset);
          if (r.inst.type === 'track_next' && !allExtraPresent) {
            const lineH = Math.max(10, (r.h || 14 * layoutScale) * 0.65);
            for (let i = 1; i <= 5; i++) {
              if (presentTrackOffsets.has(i)) continue;
              if (!count) break;
              const idx = (baseIndex + i) % count;
              const row = order[idx];
              if (!row) continue;
              const actor = state.entities.find(e => e.uid === row.uid);
              if (!actor) continue;
              const label = actor.name || '?';
              const baseSpd = Number(actor.stats?.SPD ?? actor.SPD ?? 0);
              const debuff = actor.kind === 'enemy'
                ? (state.globals.EnemyDebuffs?.[actor.uid]?.SPD || 0)
                : 0;
              const curSpd = baseSpd - debuff;
              const extraTag = row.extra ? ' (x2)' : '';
              const delta = actor.kind === 'enemy' && debuff > 0
                ? \`(-\${Math.round(debuff)})\`
                : '';
              const line = \`\${label} \${Math.round(curSpd)}/\${Math.round(baseSpd)}\${delta ? \` \${delta}\` : ''}\${extraTag}\`;
              const y = trackAnchor.y + lineH * i;
              ctx.fillText(line, trackAnchor.x + 4, y);
            }
          }
          continue;
        }
        if (text === 'What happen?') {
          text = '';
        }
        if (['h1name','h2Hname','h3name','h4name'].includes(r.inst.type)) {
          continue;
        }
        const textX = r.dx + r.w / 2;
        const textY = r.dy + r.h / 2 + Math.max(2, Math.round(5 * layoutScale));
        const textMaximumWidth = Math.max(1, r.w);
        fitCanvasText(ctx, text, { baseSize: baseSize + (navTextTypes.has(r.inst.type) ? 2 : 0), layoutScale, maximumWidth: textMaximumWidth });
        ctx.fillText(text, textX, textY);
      } else if(r.isButton){
        // Draw button text (centered, bold)
        const text = r.textContent || r.inst.type;
        ctx.fillText(text, r.dx + r.w/2, r.dy + r.h/2 + 5);
      } else {
        let label = r.inst.type;
        if (['h1name','h2Hname','h3name','h4name'].includes(r.inst.type)) {
          continue;
        }
        if (!r.isSprite && !['PartyHP_Bar'].includes(r.inst.type)) {
          ctx.fillText(label, r.dx + r.w/2, r.dy + r.h + 12);
        }
      }
    }

    // Nav labels are rendered via their text objects; no duplicate draw pass

    if (gameState.gemMergeFx && gameState.gemMergeFx.active) {
      const merge = gameState.gemMergeFx;
      const nowTime = state.globals.time || 0;
      const tRaw = merge.duration > 0 ? (nowTime - merge.startAt) / merge.duration : 1;
      const t = Math.max(0, Math.min(1, tRaw));
      const e = t * t;
      const fallbackCenterX = layoutOffsetX + (layoutW * layoutScale) / 2;
      const fallbackCenterY = layoutOffsetY + (layoutH * layoutScale) / 2 - 40;
      let centerX = fallbackCenterX;
      let centerY = fallbackCenterY;
      if (merge.target && Number.isFinite(merge.target.x) && Number.isFinite(merge.target.y)) {
        const targetPos = worldToCanvas(merge.target.x, merge.target.y);
        centerX = targetPos.x;
        centerY = targetPos.y;
      }
      const baseSize = boardGeometry.cellSize * layoutScale * 0.5;
      const fade = t > 0.8 ? Math.max(0, 1 - ((t - 0.8) / 0.2)) : 1;
      const scaleOut = merge.scaleOut !== false;
      const startScale = Number.isFinite(Number(merge.startScale)) ? Math.max(0.05, Number(merge.startScale)) : 1;
      const introT = Math.max(0, Math.min(1, t / 0.35));
      const introScale = startScale + (1 - startScale) * introT;
      const scale = scaleOut
        ? (t > 0.8 ? Math.max(0.05, 1 - ((t - 0.8) / 0.2)) : 1)
        : 1;
      const finalScale = scale * introScale;
      for (const item of merge.items || []) {
        const pos = worldToCanvas(item.x, item.y);
        const x = pos.x + (centerX - pos.x) * e;
        const y = pos.y + (centerY - pos.y) * e;
        const frameIndex = (item.color ?? 0) % 8;
        const gemImg = gemFrameImages[frameIndex];
        if (!gemImg) continue;
        const w = baseSize * finalScale;
        const h = baseSize * finalScale;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.drawImage(gemImg, x - w * 0.5, y - h * 0.5, w, h);
        ctx.restore();
      }

    }

    if (
      iconPresentation &&
      iconPresentation.active &&
      iconPresentation.frameType >= 0 &&
      iconPresentation.slotType &&
      buffIconFrameImages[iconPresentation.slotType] &&
      buffIconFrameImages[iconPresentation.slotType][iconPresentation.frameType]
    ) {
      const img = buffIconFrameImages[iconPresentation.slotType][iconPresentation.frameType];
      let cx = iconPresentation.from.x;
      let cy = iconPresentation.from.y;
      let w = iconPresentation.from.w;
      let h = iconPresentation.from.h;
      if (iconPresentation.phase === 'travel') {
        const rawT = iconPresentation.travelSec > 0
          ? ((state.globals.time || 0) - iconPresentation.travelStartAt) / iconPresentation.travelSec
          : 1;
        const t = Math.max(0, Math.min(1, rawT));
        const e = easeInOutQuad(t);
        cx = iconPresentation.from.x + (iconPresentation.to.x - iconPresentation.from.x) * e;
        cy = iconPresentation.from.y + (iconPresentation.to.y - iconPresentation.from.y) * e;
        w = iconPresentation.from.w + (iconPresentation.to.w - iconPresentation.from.w) * e;
        h = iconPresentation.from.h + (iconPresentation.to.h - iconPresentation.from.h) * e;
      }
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }

    state.globals.RustCombatPresentation?.ground(ctx, layoutScale, layoutOffsetX, layoutOffsetY);
    const actorPaintQueue = [];
    const sliceChest = state.globals.RustCombatPresentation?.state.snapshot?.chest;
    if (sliceChest) actorPaintQueue.push({ uid: -1, footY: layoutOffsetY + state.globals.RustCombatPresentation.camera.y(sliceChest.pos.y) * layoutScale, paint: () => state.globals.RustCombatPresentation.chest(ctx, layoutScale, layoutOffsetX, layoutOffsetY) });
    const actorFrontOverlayQueue = [];
    const heroAuraQueue = [];
    const addActorPaint = (uid, paint) => { const actor = actorPaintQueue.find(entry => Number(entry.uid || 0) === Number(uid || 0)); if (!actor) return; const drawActor = actor.paint; actor.paint = () => { drawActor(); paint(); }; };

    // Render enemies (use Enemy_Sprite animations)
    const deathHoldByUID = state.globals.EnemyDeathVisualHoldByUID || {};
    const enemiesToDraw = combatEnemiesForPresentation(state.entities, state.globals);
    if (enemiesToDraw.length) {
      const g = state.globals;
      const barQueue = [];
      for (const enemy of enemiesToDraw) {
        const slotIndex = enemy.slotIndex ?? 0;
        const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
        const x = enemy.x != null ? enemy.x : (g.X0 || 200);
        const y = enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing;
        const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
        const origW = enemyOrig ? enemyOrig.width : 1;
        const origH = enemyOrig ? enemyOrig.height : 1;
        const enemyH = state.globals.RustCombatPresentation?.height(enemy, (g.EnemySize || 40) * layoutScale * COMBAT_BATTLEFIELD_ZOOM * (enemy.combatRank === 'boss' ? 4 : 1), layoutScale) ?? (g.EnemySize || 40) * layoutScale * COMBAT_BATTLEFIELD_ZOOM * (enemy.combatRank === 'boss' ? 4 : 1);
        const enemyW = enemyH * (origW / origH);
        const pos = projectCombatActorWorldToCanvas(x, y, 'enemy');
        const sprite = enemySpriteImages[String(enemy.name || '').toLowerCase()];
        const standingX = enemy.originX != null ? Number(enemy.originX) : Number(x);
        const standingY = enemy.originY != null ? Number(enemy.originY) : Number(y);
        const standingPos = projectCombatActorWorldToCanvas(standingX, standingY, 'enemy');
        combatOrientationGeometryActors.push({ uid: enemy.uid, name: enemy.name, kind: enemy.kind, slot: slotIndex, canonicalX: standingX, y: standingY, canvasX: standingPos.x, canvasY: standingPos.y });
        const drawX = pos.x - enemyW / 2;
        const drawY = pos.y - (enemy.combatRank === 'boss' ? enemyH : enemyH / 2);
        const puppet = actorPuppetPresentation?.frameFor(enemy, Number(g.time || 0), activeCombatOrientation);
        const enemyFootY = Number(pos.y);
        const enemyFadeAlpha = getEnemyActivationFadeAlpha(enemy, Number(g.time || 0));
        const paintEnemyActor = () => {
          ctx.save();
          ctx.globalAlpha *= enemyFadeAlpha;

          const drawEnemySprite = () => puppet ? drawActorPuppetFrame(ctx, puppet, { footX: pos.x, footY: pos.y, height: enemyH, actorUID: enemy.uid, rustActorId: enemy.rustActorId, effects: g.RealtimeSkillEffects, now: Number(g.time || 0) }) : null;
          g.RustCombatPresentation?.actor(ctx, enemy, pos.x, pos.y, enemyH, false, layoutScale, layoutOffsetX, layoutOffsetY);
          drawEnemySprite();
          g.RustCombatPresentation?.actor(ctx, enemy, pos.x, pos.y, enemyH, true, layoutScale, layoutOffsetX, layoutOffsetY);
          ctx.restore();
        };
        actorPaintQueue.push({ footY: enemyFootY, uid: Number(enemy.uid || 0), paint: paintEnemyActor });

        // Queue enemy HP bars to draw above all enemies
        barQueue.push({ enemy, pos, enemyH, origH, enemyW, enemyFootY, enemyFadeAlpha });
      }
      for (const entry of barQueue) {
        const { enemy, pos, enemyH, origH, enemyW, enemyFootY, enemyFadeAlpha } = entry;
        const barKey = enemy.uid;
        let barState = enemyBars.get(barKey);
        const baseW = Math.max(20, Math.min(48, enemyH * 0.78));
        const baseH = Math.max(3, Math.min(6, 4 * layoutScale));
        if (!barState) {
          barState = {
            baseW,
            fillW: baseW,
            yellowW: baseW,
          };
          enemyBars.set(barKey, barState);
        }
        const hpRatio = enemy.maxHP ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHP)) : 0;
        const targetW = barState.baseW * hpRatio;
        barState.fillW = Math.max(targetW, barState.fillW - 180 * dt);
        barState.yellowW = Math.max(targetW, barState.yellowW - 90 * dt);

        const drawBarW = Math.max(1, Math.round(barState.baseW));
        const drawBarH = Math.max(1, Math.round(baseH));
        const barX = Math.round(pos.x - (drawBarW / 2));
        const barY = Math.round(enemyFootY + (4 * layoutScale));
        const drawYellowW = Math.max(0, Math.round(barState.yellowW));
        const drawFillW = Math.max(0, Math.round(barState.fillW));

        if (!(state.globals.ContinuousCombatStage?.bossActive && enemy.uid === state.globals.ContinuousCombatStage.bossUID)) addActorPaint(enemy.uid, () => { ctx.save(); ctx.globalAlpha *= enemyFadeAlpha; drawCombatHealthBar(ctx, { x: barX, y: barY, width: drawBarW, height: drawBarH, fillWidth: drawFillW, trailWidth: drawYellowW, team: 'enemy' }); ctx.restore(); });
      }
    }

    // Render hero portraits (left side, saw pattern)
    {
      const g = state.globals;
      const rect = g.EnemyAreaRect;
      const heroOrder = getCombatPartyRenderRoster();
      if (rect) {
        const heroHWorld = Number(combatFormationAnchors.heroH || g.EnemySize || 40);
        const heroWByName = (img, h, sourceRect) => (img && img.height ? (h * ((sourceRect?.sourceWidth || img.width) / (sourceRect?.sourceHeight || img.height))) : h);
        const posByIndex = [];
        const restBaseByUID = {};
        const restFeetByUID = {};
        const renderHeightByUID = {};
        const renderWidthByUID = {};
        const offsets = state.globals.HeroLungeOffsetByUID || {};
        for (let i = 0; i < heroOrder.length; i++) {
          const entry = heroOrder[i];
          const img = { width: 128, height: 128 };
          const sourceRect = null;
          const hero = state.entities.find(e => (e.kind === 'hero' || e.kind === 'escort') && e.uid === entry.uid);
          const hWorld = heroHWorld;
          const wWorld = heroWByName(img, hWorld, sourceRect);
          const yWorld = Number(combatFormationAnchors.heroYs[i] ?? ((combatFormationAnchors.arenaBounds.visibleTopY + combatFormationAnchors.arenaBounds.visibleBottomY) / 2));
          const baseX = i % 2 === 0
            ? combatFormationAnchors.arenaBounds.heroRightEdgeX - (wWorld * 1.55) / 2
            : combatFormationAnchors.arenaBounds.heroBackCenterX;
          const actorFootX = Number(hero?.footX);
          const actorFootY = Number(hero?.footY);
          const actorYWorld = Number.isFinite(actorFootY) ? actorFootY - hWorld * 1.55 / 2 : yWorld;
          const worldX = Number.isFinite(actorFootX) ? actorFootX : baseX;
          const xWorld = worldX + (hero ? (offsets[hero.uid] || 0) : 0);
          posByIndex[entry.displaySlot] = { x: worldX, y: actorYWorld };
          if (hero && Number(hero.uid || 0) > 0) {
            restBaseByUID[hero.uid] = { x: worldX, y: actorYWorld };
            restFeetByUID[hero.uid] = { x: worldX, y: actorYWorld + hWorld * 1.55 / 2 };
          }
          const pos = projectCombatActorWorldToCanvas(xWorld, actorYWorld, 'hero');
          const standingPos = projectCombatActorWorldToCanvas(worldX, actorYWorld, 'hero');
          if (hero) combatOrientationGeometryActors.push({ uid: hero.uid, name: hero.name, kind: hero.kind, slot: entry.displaySlot, canonicalX: worldX, y: actorYWorld, canvasX: standingPos.x, canvasY: standingPos.y });
          const w = wWorld * layoutScale;
          const h = hWorld * layoutScale;
          const heroScale = 1;
	          const scaledW = w * heroScale * 1.55 * COMBAT_BATTLEFIELD_ZOOM;
	          const scaledH = state.globals.RustCombatPresentation?.height(hero, h * heroScale * 1.55 * COMBAT_BATTLEFIELD_ZOOM, layoutScale) ?? h * heroScale * 1.55 * COMBAT_BATTLEFIELD_ZOOM;
          if (hero && Number(hero.uid || 0) > 0) {
            renderHeightByUID[hero.uid] = scaledH / layoutScale;
            renderWidthByUID[hero.uid] = scaledW / layoutScale;
          }
	          const footY = state.globals.RustCombatPresentation && hero ? projectCombatActorWorldToCanvas(hero.footX, hero.footY).y : pos.y + h * 1.55 * COMBAT_BATTLEFIELD_ZOOM / 2;
	          const drawX = pos.x - scaledW / 2;
	          const drawY = footY - scaledH;
          const heroSpriteFadeAlpha = getEnemyActivationFadeAlpha(hero, Number(g.time || 0));
          const paintHeroActor = () => paintWithActivationAlpha(ctx, heroSpriteFadeAlpha, () => {           const puppet = actorPuppetPresentation?.frameFor(hero, Number(g.time || 0), activeCombatOrientation);
	          const drawHeroSprite = () => puppet ? drawActorPuppetFrame(ctx, puppet, { footX: pos.x, footY, height: scaledH, actorUID: hero.uid, rustActorId: hero.rustActorId, effects: g.RealtimeSkillEffects, now: Number(g.time || 0) }) : null;
	          state.globals.RustCombatPresentation?.actor(ctx, hero, pos.x, footY, scaledH, false, layoutScale, layoutOffsetX, layoutOffsetY);
          drawHeroSprite();
          state.globals.RustCombatPresentation?.actor(ctx, hero, pos.x, footY, scaledH, true, layoutScale, layoutOffsetX, layoutOffsetY);
	          if (hero && hasPersistentHeroRegenOverlay()) {
	          }
	          if (hero && isHitFlashActive(hero.uid)) {
	          }
          });
          actorPaintQueue.push({ footY: Number(footY), uid: Number(hero?.uid || 0), paint: paintHeroActor });

          const heroOverlayFadeAlpha = getEnemyActivationFadeAlpha(hero, Number(g.time || 0));
          const paintHeroFrontOverlay = () => paintWithActivationAlpha(ctx, heroOverlayFadeAlpha, () => {           if (hero) { // hero front overlay
          }




          });
          actorFrontOverlayQueue.push(paintHeroFrontOverlay);

        }
        presentationPatches.HeroPortraitPosByIndex = posByIndex;
        presentationPatches.HeroIconPosByIndex = posByIndex;
        presentationPatches.HeroRestBasePosByUID = restBaseByUID;
        presentationPatches.HeroRestFeetPosByUID = restFeetByUID;
        presentationPatches.HeroRenderHeightByUID = renderHeightByUID;
        presentationPatches.HeroRenderWidthByUID = renderWidthByUID;
      }
    }



    // Hero health lives with the battlefield actor, matching enemy health bars.
    for (const hero of state.entities.filter(actor => actor?.kind === 'hero')) {
      if (state.globals.RustCombatPresentation) continue;
      const uid = Number(hero.uid || 0);
      const anchor = state.globals.HeroRestBasePosByUID?.[uid];
      if (!anchor) continue;
      const offsetX = Number(state.globals.HeroLungeOffsetByUID?.[uid] || 0);
      const pos = projectCombatActorWorldToCanvas(Number(anchor.x || 0) + offsetX, Number(anchor.y || 0), 'hero');
      const footAnchor = state.globals.HeroRestFeetPosByUID?.[uid] || anchor;
      const footPos = projectCombatActorWorldToCanvas(Number(footAnchor.x || 0) + offsetX, Number(footAnchor.y || 0), 'hero');
      const actorWidth = Math.max(20, Number(state.globals.HeroRenderWidthByUID?.[uid] || 32)) * layoutScale;
      const barKey = \`hero-\${uid}\`;
      const baseW = Math.max(20, Math.min(48, actorWidth * 0.78));
      const baseH = Math.max(3, Math.min(6, 4 * layoutScale));
      let barState = enemyBars.get(barKey);
      if (!barState) {
        barState = { baseW, fillW: baseW, yellowW: baseW };
        enemyBars.set(barKey, barState);
      }
      barState.baseW = baseW;
      const hpRatio = Number(hero.maxHP || 0) > 0 ? Math.max(0, Math.min(1, Number(hero.hp || 0) / Number(hero.maxHP))) : 0;
      const targetW = baseW * hpRatio;
      barState.fillW = Math.max(targetW, barState.fillW - 180 * dt);
      barState.yellowW = Math.max(targetW, barState.yellowW - 90 * dt);
      const barX = Math.round(pos.x - baseW / 2);
      const barY = Math.round(footPos.y + 4 * layoutScale);
      const heroBarFadeAlpha = getEnemyActivationFadeAlpha(hero, Number(state.globals.time || 0));
      addActorPaint(uid, () => paintWithActivationAlpha(ctx, heroBarFadeAlpha, () => drawCombatHealthBar(ctx, { x: barX, y: barY, width: baseW, height: baseH, fillWidth: barState.fillW, trailWidth: barState.yellowW, team: 'hero' })));
    }

    actorPaintQueue.sort((a, b) => Number(a.footY || 0) - Number(b.footY || 0) || Number(a.uid || 0) - Number(b.uid || 0));
    for (const paint of heroAuraQueue) paint();
    for (const entry of actorPaintQueue) entry.paint();
    for (const paint of actorFrontOverlayQueue) paint();
    state.globals.RustCombatPresentation?.front(ctx, layoutScale, layoutOffsetX, layoutOffsetY);

    // Render hero damage/heal text above hero sprites

        const combatRenderResult = renderCombatRuntime.renderCombatRuntime(ctx, {
      canvas,
      uiState: uiState.getUIState(),
      modalPlane,
      closeBtnRender,
      closeXRender,
      navBacker,
      navTopRendered,
      modalRendered,
      drawBasicItem,
    });
    runtimeArtifacts.overlayData = combatRenderResult.overlayData;
    runtimeArtifacts.visualFlags = combatRenderResult.visualFlags;

    drawCombatProgressHud(ctx, { state, images, worldToCanvas });

    // draw HUD overlay (game state)
    drawHUD();
    const bossWipe = state.globals.ContinuousCombatStage;
    if (bossWipe?.bossActive === true && Number(bossWipe.bossTransitionEndsAtMs || 0) > Date.now()) {
      const start = Number(bossWipe.bossTransitionStartedAtMs || 0);
      const end = Number(bossWipe.bossTransitionEndsAtMs || start);
      const progress = Math.max(0, Math.min(1, (Date.now() - start) / Math.max(1, end - start)));
      const curtainWidth = layoutW * layoutScale * (1 - progress) / 2;
      ctx.save();
      ctx.fillStyle = '#05060a';
      ctx.fillRect(layoutOffsetX, layoutOffsetY, curtainWidth, layoutH * layoutScale);
      ctx.fillRect(layoutOffsetX + layoutW * layoutScale - curtainWidth, layoutOffsetY, curtainWidth, layoutH * layoutScale);
      ctx.restore();
    }

    presentationPatches.CombatOrientationGeometry = createCombatOrientationGeometry({ orientation: activeCombatOrientation, layoutW, actors: combatOrientationGeometryActors, ...combatFormationAnchors });
    runtimeArtifacts.presentationPatches = Object.keys(presentationPatches).length ? presentationPatches : null;
    runtimeArtifacts.visualControlPatches = Object.keys(visualControlPatches).length ? visualControlPatches : null;
    return runtimeArtifacts;

}`;

let renderImpl;

export function renderRuntime(deps) {
  deps.drawCombatArenaBackground = drawCombatArenaBackground;
  deps.COMBAT_BATTLEFIELD_ZOOM = COMBAT_BATTLEFIELD_ZOOM;
  deps.createCombatCameraProjection = createCombatCameraProjection;
  deps.resolveCombatCameraCenterX = resolveCombatCameraCenterX;
  deps.deriveCombatWorldBounds = deriveCombatWorldBounds;
  deps.updateHpTextRollState = updateHpTextRollState;
  deps.createCombatFormationProjection = createCombatFormationProjection;
  deps.createCombatOrientationGeometry = createCombatOrientationGeometry;
  deps.deriveCombatReferenceGrid = deriveCombatReferenceGrid;
  deps.deriveCombatFormationAnchors = deriveCombatFormationAnchors;
  deps.normalizeCombatOrientation = normalizeCombatOrientation;
  deps.orientCombatWorldOffsetX = orientCombatWorldOffsetX;
  deps.heroArtAsset = heroArtAsset;
  deps.resolveHeroArtSourceRect = resolveHeroArtSourceRect;
  deps.drawCombatProgressHud = drawCombatProgressHud;
  deps.drawCombatHealthBar = drawCombatHealthBar;
  deps.drawActorPuppetFrame = deps.state.globals.RustCombatPresentation?.sprite ?? drawActorPuppetFrame;
  deps.combatEnemiesForPresentation = combatEnemiesForPresentation;
  deps.getEnemyActivationFadeAlpha = enemyActivationFadeAlpha;
  deps.paintWithActivationAlpha = paintWithActivationAlpha;
  deps.computeCombatDamageFontSize = computeCombatDamageFontSize;
  deps.computeViewportFontSize = computeViewportFontSize;
  deps.fitCanvasText = fitCanvasText;
  if (!renderImpl) renderImpl = new Function('scope', 'dtOverride', body);
  deps.actorPuppetPresentation?.beginFrame();
  try {
    return renderImpl(deps, deps.dtOverride);
  } finally {
    deps.actorPuppetPresentation?.endFrame();
  }
}
