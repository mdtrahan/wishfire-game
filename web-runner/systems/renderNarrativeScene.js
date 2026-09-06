import { ensureNarrativeState, getCurrentNarrativeLine } from '../src/core/narrativeRuntime.mjs';
import { WISHFIRE_WARP_CROSSING_CONTENT } from '../src/core/wishfireWarpCrossingContent.mjs';
import { playNarrativeAudioCue } from './narrativeAudio.mjs';
import {
  beginNarrativeShotTransition,
  consumeNarrativeSceneAudioCue,
  ensureNarrativeScenePresentation,
  getNarrativeScenePage,
  getNarrativeSceneVisibleText,
  getNarrativeShotTransition,
  isNarrativeSceneLineFullyVisible,
  setNarrativeSceneHitZones,
  syncNarrativeSceneLine,
} from './narrativeSceneController.mjs';
import { computeNarrativeSceneViewport, transformNarrativeHitZones } from './narrativeSceneViewport.mjs';

const imageCache = new Map();
const PORTRAIT_STAGE_SCALE = 0.38;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedRectPath(ctx, x, y, w, h, radius = 8) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function resolveImage(assetRef) {
  if (!assetRef || typeof Image === 'undefined') return null;
  if (!imageCache.has(assetRef)) {
    const image = new Image();
    const record = { image, loaded: false, failed: false };
    image.onload = () => { record.loaded = true; };
    image.onerror = () => { record.failed = true; };
    image.src = new URL(`../${assetRef}`, import.meta.url).href;
    imageCache.set(assetRef, record);
  }
  const record = imageCache.get(assetRef);
  return record.loaded && !record.failed ? record.image : null;
}

function drawWarpfallBackground(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#14243a');
  sky.addColorStop(0.52, '#334153');
  sky.addColorStop(1, '#17211c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#657488';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.42);
  ctx.lineTo(width * 0.18, height * 0.25);
  ctx.lineTo(width * 0.35, height * 0.43);
  ctx.lineTo(width * 0.55, height * 0.22);
  ctx.lineTo(width * 0.75, height * 0.44);
  ctx.lineTo(width, height * 0.29);
  ctx.lineTo(width, height * 0.68);
  ctx.lineTo(0, height * 0.68);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#24392f';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.56);
  ctx.quadraticCurveTo(width * 0.24, height * 0.47, width * 0.46, height * 0.61);
  ctx.quadraticCurveTo(width * 0.72, height * 0.72, width, height * 0.52);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  const shards = [[0.12, 0.17, '#71d6d0'], [0.84, 0.2, '#e6b74d'], [0.68, 0.34, '#b48adb'], [0.28, 0.31, '#df6d61']];
  for (const [x, y, color] of shards) {
    ctx.save();
    ctx.translate(width * x, height * y);
    ctx.rotate((x - 0.5) * 0.8);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-5, 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#111817';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.78);
  ctx.quadraticCurveTo(width * 0.46, height * 0.7, width, height * 0.8);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
}

function drawBackground(ctx, background, width, height) {
  if (background?.visualId === 'warpfall-wilds') drawWarpfallBackground(ctx, width, height);
  else {
    ctx.fillStyle = '#1d2530';
    ctx.fillRect(0, 0, width, height);
  }
}

function drawPortraitFallback(ctx, rect) {
  ctx.fillStyle = '#3f5360';
  ctx.beginPath();
  ctx.arc(rect.x + rect.w / 2, rect.y + rect.h * 0.3, rect.w * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(rect.x + rect.w * 0.28, rect.y + rect.h * 0.44, rect.w * 0.44, rect.h * 0.5);
}

function drawCharacterPortrait(ctx, rect, character, isActive) {
  const portrait = character?.portrait || {};
  const image = resolveImage(portrait.assetRef);
  ctx.save();
  ctx.filter = isActive ? 'none' : 'saturate(0.55) brightness(0.42)';
  if (!image) drawPortraitFallback(ctx, rect);
  else {
    const drawWidth = image.width * PORTRAIT_STAGE_SCALE;
    const drawHeight = image.height * PORTRAIT_STAGE_SCALE;
    const x = rect.x + (rect.w - drawWidth) / 2;
    const y = rect.y + rect.h - drawHeight;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  }
  ctx.restore();
}

function drawOrb(ctx, x, y, radius, color) {
  const glow = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.3, 1, x, y, radius * 1.6);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(0.18, color);
  glow.addColorStop(0.7, color);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath();
  ctx.arc(x - radius * 0.3, y - radius * 0.32, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawOrbsItem(ctx, rect, redOnly = false) {
  const colors = redOnly ? ['#dc4b4b', '#ef6660', '#b9293e', '#ff7b62'] : ['#dc4b4b', '#58b7d8', '#e0b23f', '#62ba73'];
  [[0.22, 0.56], [0.42, 0.37], [0.62, 0.58], [0.79, 0.36]].forEach(([x, y], index) => {
    drawOrb(ctx, rect.x + rect.w * x, rect.y + rect.h * y, 24, colors[index]);
  });
}

function drawPaperMap(ctx, rect) {
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(-0.035);
  const x = -rect.w * 0.42;
  const y = -rect.h * 0.38;
  const w = rect.w * 0.84;
  const h = rect.h * 0.76;
  roundedRectPath(ctx, x, y, w, h, 5);
  ctx.fillStyle = '#e4d4a7';
  ctx.fill();
  ctx.strokeStyle = '#765f3c';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(111,82,45,0.38)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.34, y);
  ctx.lineTo(x + w * 0.31, y + h);
  ctx.moveTo(x + w * 0.68, y);
  ctx.lineTo(x + w * 0.72, y + h);
  ctx.stroke();
  ctx.strokeStyle = '#4e775f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + h * 0.72);
  ctx.bezierCurveTo(x + w * 0.25, y + h * 0.25, x + w * 0.55, y + h * 0.86, x + w - 18, y + h * 0.28);
  ctx.stroke();
  ctx.fillStyle = '#b54d43';
  ctx.beginPath();
  ctx.arc(x + w * 0.69, y + h * 0.51, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawItem(ctx, item, rect) {
  if (item?.visualRef === 'procedural:paper-map') drawPaperMap(ctx, rect);
  else drawOrbsItem(ctx, rect, item?.visualRef === 'procedural:red-orbs');
}

function drawButton(ctx, rect, label, active = false) {
  ctx.save();
  roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.fillStyle = active ? '#e6b74d' : 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.strokeStyle = active ? '#fff0b5' : 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = active ? '#17171b' : '#f4efe4';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);
  ctx.restore();
}

function drawContinueGlyph(ctx, x, y, visible) {
  if (!visible) return;
  ctx.fillStyle = 'rgba(244,239,228,0.76)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 10, y);
  ctx.lineTo(x + 5, y + 7);
  ctx.closePath();
  ctx.fill();
}

function drawCompletion(ctx, gameState, width, height, nowSec) {
  const presentation = ensureNarrativeScenePresentation(gameState, nowSec);
  const fade = presentation.completionStartedAtSec ? clamp((nowSec - presentation.completionStartedAtSec) / 0.45, 0, 1) : 1;
  const button = { x: 78, y: height * 0.58, w: width - 156, h: 44 };
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#f4efe4';
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  wrapText(ctx, gameState?.narrativeCompletion?.message || 'End of Scene', width * 0.78)
    .forEach((text, index) => ctx.fillText(text, width / 2, height * 0.43 + index * 25));
  drawButton(ctx, button, 'Restart Scene');
  ctx.restore();
  return { restart: button };
}

function drawDialoguePanel(ctx, line, visibleText, fullyVisible, presentation, panelRect, fadeProgress) {
  const autoButton = { x: panelRect.x + panelRect.w - 132, y: panelRect.y + 13, w: 60, h: 30 };
  const skipButton = { x: panelRect.x + panelRect.w - 66, y: panelRect.y + 13, w: 54, h: 30 };
  ctx.save();
  ctx.globalAlpha = fadeProgress;
  roundedRectPath(ctx, panelRect.x, panelRect.y, panelRect.w, panelRect.h, 8);
  ctx.fillStyle = 'rgba(15,18,24,0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,239,228,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (line.speaker) {
    ctx.fillStyle = '#f4efe4';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(line.speaker.displayName || line.speaker.id, panelRect.x + 16, panelRect.y + 34);
  }
  drawButton(ctx, autoButton, 'Auto', presentation.auto);
  drawButton(ctx, skipButton, 'Skip');
  const maxTextWidth = panelRect.w - 32;
  let fontSize = 16;
  let lines = [];
  while (fontSize >= 13) {
    ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
    lines = wrapText(ctx, visibleText, maxTextWidth);
    if (lines.length <= 6) break;
    fontSize -= 1;
  }
  const lineHeight = fontSize + 6;
  ctx.fillStyle = '#f4efe4';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  lines.forEach((text, index) => ctx.fillText(text, panelRect.x + 16, panelRect.y + 67 + index * lineHeight));
  drawContinueGlyph(ctx, panelRect.x + panelRect.w - 31, panelRect.y + panelRect.h - 25, fullyVisible);
  ctx.restore();
  return { panel: panelRect, auto: autoButton, skip: skipButton };
}

export function renderNarrativeScene(ctx, gameState, dims = {}, content = WISHFIRE_WARP_CROSSING_CONTENT) {
  const viewWidth = Number(dims.viewWidth || 0);
  const viewHeight = Number(dims.viewHeight || 0);
  if (!ctx || viewWidth <= 0 || viewHeight <= 0) return false;
  const viewport = computeNarrativeSceneViewport(viewWidth, viewHeight);
  const width = viewport.logicalWidth;
  const height = viewport.logicalHeight;
  const nowSec = typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
  const narrativeState = ensureNarrativeState(gameState);
  const presentation = ensureNarrativeScenePresentation(gameState, nowSec);
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.save();
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.scale, viewport.scale);
  if (presentation.completed || !gameState?.narrative?.activeSceneId) {
    const logicalHitZones = drawCompletion(ctx, gameState, width, height, nowSec);
    ctx.restore();
    setNarrativeSceneHitZones(gameState, transformNarrativeHitZones(logicalHitZones, viewport));
    return { sceneId: content?.scenes?.[0]?.id || null, lineId: null, completed: true };
  }
  const line = getCurrentNarrativeLine(narrativeState, content);
  if (!line) {
    ctx.restore();
    return false;
  }
  const syncedPresentation = syncNarrativeSceneLine(gameState, line.id, nowSec);
  if (!syncedPresentation.stageInitialized) {
    if (line.shot?.kind !== 'dark') {
      beginNarrativeShotTransition(syncedPresentation, line.id, nowSec, 'black-cover');
    }
    else syncedPresentation.stageInitialized = true;
  }
  const transition = line.shot?.kind === 'dark'
    ? {
      active: false,
      mode: null,
      phase: 'dark',
      backgroundAlpha: 0,
      subjectAlpha: 0,
      dialogueAlpha: 1,
      dialogueReady: true,
      coverAlpha: 0,
    }
    : getNarrativeShotTransition(syncedPresentation, line.id, nowSec);
  const page = getNarrativeScenePage(line.text, syncedPresentation, narrativeState.locale || content?.defaultLocale || 'en');
  const visibleText = getNarrativeSceneVisibleText(page.text, syncedPresentation, nowSec);
  const fullyVisible = isNarrativeSceneLineFullyVisible(page.text, syncedPresentation, nowSec);
  const audioCue = transition.dialogueReady ? consumeNarrativeSceneAudioCue(gameState, line) : null;
  if (audioCue) playNarrativeAudioCue(audioCue);
  const panelH = 204;
  const panelY = height - panelH - 12;
  const panelRect = { x: 16, y: panelY, w: width - 32, h: panelH };
  const stageRect = { x: 0, y: 34, w: width, h: panelY - 12 };
  if (line.shot?.kind !== 'dark') {
    ctx.save();
    ctx.globalAlpha = transition.backgroundAlpha;
    drawBackground(ctx, line.background, width, height);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = transition.subjectAlpha;
    if (line.shot?.kind === 'characters') {
      const characterById = new Map(content.characters.map((character) => [character.id, character]));
      const stageRects = {
        left: { x: -28, y: stageRect.y + 10, w: 220, h: stageRect.h },
        right: { x: width - 192, y: stageRect.y, w: 220, h: stageRect.h },
        center: { x: 70, y: stageRect.y, w: 220, h: stageRect.h },
      };
      line.shot.cast.map((entry) => ({
        character: characterById.get(entry.characterId),
        rect: stageRects[entry.slot],
        isSpeaker: entry.characterId === line.speaker?.id,
      })).filter((entry) => entry.character && entry.rect)
        .sort((a, b) => Number(a.isSpeaker) - Number(b.isSpeaker))
        .forEach((entry) => drawCharacterPortrait(ctx, entry.rect, entry.character, entry.isSpeaker));
    } else if (line.shot?.kind === 'item') {
      drawItem(ctx, line.item, { x: 48, y: 135, w: width - 96, h: 180 });
    }
    ctx.restore();
  }
  const panelHitZones = transition.dialogueAlpha > 0
    ? drawDialoguePanel(ctx, line, visibleText, fullyVisible, syncedPresentation, panelRect, transition.dialogueAlpha)
    : {};
  if (transition.coverAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = transition.coverAlpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  const logicalHitZones = transition.dialogueReady ? panelHitZones : {};
  ctx.restore();
  setNarrativeSceneHitZones(gameState, transformNarrativeHitZones(logicalHitZones, viewport));
  const renderState = {
    sceneId: line.sceneId,
    lineId: line.id,
    pageIndex: page.pageIndex,
    pageCount: page.pageCount,
    speakerId: line.speaker?.id || null,
    shotId: line.cameraShotId,
    shotKind: line.shot?.kind || null,
    itemId: line.item?.id || null,
    transitionMode: transition.mode,
    transitionPhase: transition.phase,
    backgroundAlpha: transition.backgroundAlpha,
    subjectAlpha: transition.subjectAlpha,
    dialogueAlpha: transition.dialogueAlpha,
    coverAlpha: transition.coverAlpha,
    actorsVisible: line.shot?.kind === 'characters'
      && transition.subjectAlpha > 0
      && transition.coverAlpha < 1,
    completed: false,
  };
  gameState.narrativeScene.lastRender = renderState;
  return renderState;
}

// Approved placeholder composition uses the same reference frame as dialogue.
export function renderStoryChapterMap(ctx, gameState, { viewWidth, viewHeight }) {
  const viewport = computeNarrativeSceneViewport(viewWidth, viewHeight);
  const image = resolveImage('assets/narrative/chapter-1-map.png');
  ctx.save();
  ctx.fillStyle = '#243d3c';
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.scale, viewport.scale);
  if (image) {
    ctx.drawImage(image, 0, 0, 360, 640);
    if (gameState.storyEntry.phase === 'map') {
    const fill = ctx.createLinearGradient(0, 405, 0, 449);
    fill.addColorStop(0, '#747cff');
    fill.addColorStop(0.5, '#4546bc');
    fill.addColorStop(1, '#242164');
    roundedRectPath(ctx, 111.4, 405, 146.2, 44, 5);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#514021';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#e2c775';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#242146';
    ctx.strokeText('START', 184.5, 428);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('START', 184.5, 428);
    }
  }
  else {
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading Chapter 1 map…', 180, 320);
  }
  ctx.restore();
  gameState.storyEntry.townHitZone = image
    ? transformNarrativeHitZones({ town: { x: 123, y: 270, w: 123, h: 114 } }, viewport).town
    : null;
  gameState.storyEntry.startHitZone = image
    ? transformNarrativeHitZones({ start: { x: 111.4, y: 405, w: 146.2, h: 44 } }, viewport).start
    : null;
}
