import {
  advanceNarrativeScene,
  completeActiveNarrativeScene,
  ensureNarrativeState,
  getCurrentNarrativeLine,
  startNarrativeScene,
} from '../src/core/narrativeRuntime.mjs';

export const NARRATIVE_READING_SPEED_WORDS_PER_SECOND = 3;
export const NARRATIVE_TYPEWRITER_CHARS_PER_SECOND = 16;
export const NARRATIVE_SHOT_BLACK_SECONDS = 0.25;
export const NARRATIVE_BACKGROUND_FADE_SECONDS = 0.45;
export const NARRATIVE_ACTOR_FADE_SECONDS = 0.18;
export const NARRATIVE_BLACK_COVER_FADE_SECONDS = 0.45;
export const NARRATIVE_SENTENCES_PER_PAGE = 2;

function nowSeconds() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now() / 1000;
  }
  return Date.now() / 1000;
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function isPointInRect(point, rect) {
  if (!point || !rect) return false;
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

export function createNarrativeScenePresentation(nowSec = nowSeconds()) {
  return {
    auto: false,
    completed: false,
    completionStartedAtSec: 0,
    lineId: null,
    lineStartedAtSec: nowSec,
    pageIndex: 0,
    pageStartedAtSec: nowSec,
    forcedCompleteLineId: null,
    forcedCompletePageIndex: null,
    stageInitialized: false,
    shotTransitionLineId: null,
    shotTransitionStartedAtSec: 0,
    shotTransitionMode: null,
    shotBlackDurationSec: NARRATIVE_SHOT_BLACK_SECONDS,
    backgroundFadeDurationSec: NARRATIVE_BACKGROUND_FADE_SECONDS,
    actorFadeDurationSec: NARRATIVE_ACTOR_FADE_SECONDS,
    blackCoverFadeDurationSec: NARRATIVE_BLACK_COVER_FADE_SECONDS,
    readingSpeedWordsPerSecond: NARRATIVE_READING_SPEED_WORDS_PER_SECOND,
    typewriterCharsPerSecond: NARRATIVE_TYPEWRITER_CHARS_PER_SECOND,
    playedAudioLineIds: [],
    hitZones: {},
  };
}

export function ensureNarrativeScenePresentation(gameState, nowSec = nowSeconds()) {
  if (!gameState) return createNarrativeScenePresentation(nowSec);
  if (!gameState.narrativeScene || typeof gameState.narrativeScene !== 'object') {
    gameState.narrativeScene = createNarrativeScenePresentation(nowSec);
  }
  const presentation = gameState.narrativeScene;
  presentation.auto = Boolean(presentation.auto);
  presentation.completed = Boolean(presentation.completed);
  presentation.completionStartedAtSec = Number(presentation.completionStartedAtSec || 0);
  presentation.lineId = presentation.lineId || null;
  presentation.lineStartedAtSec = Number(presentation.lineStartedAtSec || nowSec);
  presentation.pageIndex = Math.max(0, Math.floor(Number(presentation.pageIndex || 0)));
  presentation.pageStartedAtSec = Number(presentation.pageStartedAtSec || presentation.lineStartedAtSec || nowSec);
  presentation.forcedCompleteLineId = presentation.forcedCompleteLineId || null;
  presentation.forcedCompletePageIndex = Number.isInteger(presentation.forcedCompletePageIndex)
    ? presentation.forcedCompletePageIndex
    : null;
  presentation.stageInitialized = Boolean(presentation.stageInitialized);
  presentation.shotTransitionLineId = presentation.shotTransitionLineId || null;
  presentation.shotTransitionStartedAtSec = Number(presentation.shotTransitionStartedAtSec || 0);
  presentation.shotTransitionMode = presentation.shotTransitionMode || null;
  presentation.shotBlackDurationSec = Math.max(0, Number(
    presentation.shotBlackDurationSec ?? NARRATIVE_SHOT_BLACK_SECONDS,
  ));
  presentation.backgroundFadeDurationSec = Math.max(0.01, Number(
    presentation.backgroundFadeDurationSec || NARRATIVE_BACKGROUND_FADE_SECONDS,
  ));
  presentation.actorFadeDurationSec = Math.max(0.01, Number(
    presentation.actorFadeDurationSec || NARRATIVE_ACTOR_FADE_SECONDS,
  ));
  presentation.blackCoverFadeDurationSec = Math.max(0.01, Number(
    presentation.blackCoverFadeDurationSec || NARRATIVE_BLACK_COVER_FADE_SECONDS,
  ));
  presentation.readingSpeedWordsPerSecond = Math.max(1, Number(
    presentation.readingSpeedWordsPerSecond || NARRATIVE_READING_SPEED_WORDS_PER_SECOND,
  ));
  presentation.typewriterCharsPerSecond = Math.max(1, Number(
    presentation.typewriterCharsPerSecond || NARRATIVE_TYPEWRITER_CHARS_PER_SECOND,
  ));
  presentation.playedAudioLineIds = Array.isArray(presentation.playedAudioLineIds)
    ? presentation.playedAudioLineIds
    : [];
  presentation.hitZones = presentation.hitZones && typeof presentation.hitZones === 'object'
    ? presentation.hitZones
    : {};
  return presentation;
}

export function resetNarrativeScenePresentation(gameState, nowSec = nowSeconds()) {
  if (!gameState) return createNarrativeScenePresentation(nowSec);
  gameState.narrativeScene = createNarrativeScenePresentation(nowSec);
  return gameState.narrativeScene;
}

export function syncNarrativeSceneLine(gameState, lineId, nowSec = nowSeconds()) {
  const presentation = ensureNarrativeScenePresentation(gameState, nowSec);
  if (presentation.lineId !== lineId) {
    presentation.lineId = lineId || null;
    presentation.lineStartedAtSec = nowSec;
    presentation.pageIndex = 0;
    presentation.pageStartedAtSec = nowSec;
    presentation.forcedCompleteLineId = null;
    presentation.forcedCompletePageIndex = null;
  }
  return presentation;
}

function fallbackSentenceSegments(text) {
  return String(text || '').match(/[^.!?]+(?:[.!?]+|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
}

export function getNarrativeScenePages(lineText, locale = 'en') {
  const text = String(lineText || '').trim();
  if (!text) return [''];
  let sentences = [];
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const segmenter = new Intl.Segmenter(locale || 'en', { granularity: 'sentence' });
      sentences = Array.from(segmenter.segment(text), ({ segment }) => segment.trim()).filter(Boolean);
    } catch {
      sentences = [];
    }
  }
  if (!sentences.length) sentences = fallbackSentenceSegments(text);
  if (!sentences.length) sentences = [text];
  const pages = [];
  for (let index = 0; index < sentences.length; index += NARRATIVE_SENTENCES_PER_PAGE) {
    pages.push(sentences.slice(index, index + NARRATIVE_SENTENCES_PER_PAGE).join(' '));
  }
  return pages;
}

export function getNarrativeScenePage(lineText, presentation, locale = 'en') {
  const pages = getNarrativeScenePages(lineText, locale);
  const pageIndex = Math.max(0, Math.min(pages.length - 1, Number(presentation?.pageIndex || 0)));
  return { pageIndex, pageCount: pages.length, text: pages[pageIndex], pages };
}

export function beginNarrativeShotTransition(presentation, lineId, nowSec = nowSeconds(), mode = 'ordered') {
  if (!presentation || !lineId) return presentation;
  presentation.stageInitialized = true;
  presentation.shotTransitionLineId = lineId;
  presentation.shotTransitionStartedAtSec = nowSec;
  presentation.shotTransitionMode = mode === 'black-cover' ? 'black-cover' : 'ordered';
  return presentation;
}

export function getNarrativeShotTransition(presentation, lineId, nowSec = nowSeconds()) {
  if (!lineId || presentation?.shotTransitionLineId !== lineId) {
    return {
      active: false,
      mode: null,
      phase: 'dialogue',
      backgroundAlpha: 1,
      subjectAlpha: 1,
      dialogueAlpha: 1,
      dialogueReady: true,
      coverAlpha: 0,
    };
  }
  const elapsed = Math.max(0, nowSec - Number(presentation?.shotTransitionStartedAtSec || nowSec));
  if (presentation?.shotTransitionMode === 'black-cover') {
    const duration = Math.max(0.01, Number(
      presentation?.blackCoverFadeDurationSec || NARRATIVE_BLACK_COVER_FADE_SECONDS,
    ));
    const coverAlpha = 1 - Math.max(0, Math.min(1, elapsed / duration));
    const dialogueReady = coverAlpha <= 0;
    return {
      active: !dialogueReady,
      mode: 'black-cover',
      phase: dialogueReady ? 'dialogue' : 'cover',
      backgroundAlpha: 1,
      subjectAlpha: 1,
      dialogueAlpha: 1,
      dialogueReady,
      coverAlpha,
    };
  }
  const blackDuration = Math.max(0, Number(
    presentation?.shotBlackDurationSec ?? NARRATIVE_SHOT_BLACK_SECONDS,
  ));
  const backgroundDuration = Math.max(0.01, Number(
    presentation?.backgroundFadeDurationSec || NARRATIVE_BACKGROUND_FADE_SECONDS,
  ));
  const actorDuration = Math.max(0.01, Number(
    presentation?.actorFadeDurationSec || NARRATIVE_ACTOR_FADE_SECONDS,
  ));
  const backgroundElapsed = elapsed - blackDuration;
  const actorElapsed = backgroundElapsed - backgroundDuration;
  const backgroundAlpha = Math.max(0, Math.min(1, backgroundElapsed / backgroundDuration));
  const subjectAlpha = Math.max(0, Math.min(1, actorElapsed / actorDuration));
  const dialogueAlpha = actorElapsed >= actorDuration ? 1 : 0;
  const phase = backgroundElapsed < 0
    ? 'black'
    : actorElapsed < 0
      ? 'background'
      : dialogueAlpha < 1
        ? 'actors'
        : 'dialogue';
  return {
    active: dialogueAlpha < 1,
    mode: 'ordered',
    phase,
    backgroundAlpha,
    subjectAlpha,
    dialogueAlpha,
    dialogueReady: dialogueAlpha >= 1,
    coverAlpha: 0,
  };
}

function textStartSeconds(presentation, nowSec) {
  if (Number(presentation?.pageIndex || 0) > 0) {
    return Number(presentation?.pageStartedAtSec || nowSec);
  }
  if (presentation?.shotTransitionLineId !== presentation?.lineId) {
    return Number(presentation?.lineStartedAtSec || nowSec);
  }
  const transitionStart = Number(presentation?.shotTransitionStartedAtSec || nowSec);
  if (presentation?.shotTransitionMode === 'black-cover') {
    return transitionStart + Math.max(0.01, Number(
      presentation?.blackCoverFadeDurationSec || NARRATIVE_BLACK_COVER_FADE_SECONDS,
    ));
  }
  return transitionStart
    + Math.max(0, Number(presentation?.shotBlackDurationSec ?? NARRATIVE_SHOT_BLACK_SECONDS))
    + Math.max(0.01, Number(presentation?.backgroundFadeDurationSec || NARRATIVE_BACKGROUND_FADE_SECONDS))
    + Math.max(0.01, Number(presentation?.actorFadeDurationSec || NARRATIVE_ACTOR_FADE_SECONDS));
}

export function getNarrativeSceneVisibleText(lineText, presentation, nowSec = nowSeconds()) {
  const text = String(lineText || '');
  if (!text) return '';
  if (presentation?.forcedCompleteLineId === presentation?.lineId
    && presentation?.forcedCompletePageIndex === presentation?.pageIndex) return text;
  const elapsed = Math.max(0, nowSec - textStartSeconds(presentation, nowSec));
  const charsPerSecond = Math.max(1, Number(
    presentation?.typewriterCharsPerSecond || NARRATIVE_TYPEWRITER_CHARS_PER_SECOND,
  ));
  return text.slice(0, Math.min(text.length, Math.floor(elapsed * charsPerSecond)));
}

export function isNarrativeSceneLineFullyVisible(lineText, presentation, nowSec = nowSeconds()) {
  return getNarrativeSceneVisibleText(lineText, presentation, nowSec).length >= String(lineText || '').length;
}

export function getNarrativeSceneReadSeconds(lineText, presentation) {
  return Math.max(1.45, (wordCount(lineText) / presentation.readingSpeedWordsPerSecond) + 0.55);
}

export function consumeNarrativeSceneAudioCue(gameState, line) {
  const presentation = ensureNarrativeScenePresentation(gameState);
  if (!line?.audioCue || !line?.id || presentation.playedAudioLineIds.includes(line.id)) return null;
  presentation.playedAudioLineIds.push(line.id);
  return line.audioCue;
}

export function completeNarrativeScenePresentation(gameState, content, event = {}) {
  const nowSec = nowSeconds();
  const presentation = ensureNarrativeScenePresentation(gameState, nowSec);
  const locale = gameState?.narrative?.locale || content?.defaultLocale || 'en';
  const messageKey = event.messageKey || 'scene.complete.message';
  const message = String(content?.locales?.[locale]?.[messageKey] || 'End of Scene');
  presentation.completed = true;
  presentation.completionStartedAtSec = nowSec;
  presentation.auto = false;
  presentation.forcedCompleteLineId = null;
  presentation.forcedCompletePageIndex = null;
  gameState.narrativeCompletion = { ...event, messageKey, message };
  return gameState.narrativeCompletion;
}

export function advanceNarrativeScenePresentation(gameState, content, {
  forceCompleteTextFirst = true,
  nowSec = nowSeconds(),
} = {}) {
  const narrativeState = ensureNarrativeState(gameState);
  const line = getCurrentNarrativeLine(narrativeState, content);
  const presentation = syncNarrativeSceneLine(gameState, line?.id || null, nowSec);
  const locale = narrativeState.locale || content?.defaultLocale || 'en';
  const page = line ? getNarrativeScenePage(line.text, presentation, locale) : null;

  if (line && forceCompleteTextFirst && !isNarrativeSceneLineFullyVisible(page.text, presentation, nowSec)) {
    presentation.forcedCompleteLineId = line.id;
    presentation.forcedCompletePageIndex = page.pageIndex;
    return { handled: true, completed: false, advanced: false, pageAdvanced: false };
  }

  if (line && page.pageIndex < page.pageCount - 1) {
    presentation.pageIndex = page.pageIndex + 1;
    presentation.pageStartedAtSec = nowSec;
    presentation.forcedCompleteLineId = null;
    presentation.forcedCompletePageIndex = null;
    return { handled: true, completed: false, advanced: false, pageAdvanced: true };
  }

  const previousShotId = line?.cameraShotId || null;
  const previousShotKind = line?.shot?.kind || null;
  const result = advanceNarrativeScene(narrativeState, content);
  if (result.done) {
    completeNarrativeScenePresentation(gameState, content, result.event || {});
    return { handled: true, completed: true, advanced: true, event: result.event };
  }
  if (result.currentLine?.id) {
    presentation.lineId = null;
    presentation.lineStartedAtSec = 0;
    presentation.pageIndex = 0;
    presentation.pageStartedAtSec = 0;
    presentation.forcedCompleteLineId = null;
    presentation.forcedCompletePageIndex = null;
    const shotChanged = result.currentLine.cameraShotId !== previousShotId;
    const restoresDarkScene = previousShotKind === 'dark' && result.currentLine.shot?.kind !== 'dark';
    const involvesObjectFocus = result.currentLine.shot?.kind === 'item' || previousShotKind === 'item';
    if (shotChanged && restoresDarkScene) {
      beginNarrativeShotTransition(presentation, result.currentLine.id, nowSec, 'black-cover');
    } else if (shotChanged && result.currentLine.shot?.kind !== 'dark' && involvesObjectFocus) {
      const mode = 'ordered';
      beginNarrativeShotTransition(presentation, result.currentLine.id, nowSec, mode);
    } else {
      presentation.stageInitialized = true;
      presentation.shotTransitionLineId = null;
      presentation.shotTransitionStartedAtSec = 0;
      presentation.shotTransitionMode = null;
    }
  }
  return { handled: true, completed: false, advanced: true, event: result.event };
}

export function updateNarrativeSceneAuto(gameState, content, nowSec = nowSeconds()) {
  const presentation = ensureNarrativeScenePresentation(gameState, nowSec);
  if (!presentation.auto || presentation.completed) return false;
  const line = getCurrentNarrativeLine(ensureNarrativeState(gameState), content);
  if (!line) return false;
  syncNarrativeSceneLine(gameState, line.id, nowSec);
  const locale = gameState?.narrative?.locale || content?.defaultLocale || 'en';
  const page = getNarrativeScenePage(line.text, presentation, locale);
  if (!isNarrativeSceneLineFullyVisible(page.text, presentation, nowSec)) return false;
  const elapsed = Math.max(0, nowSec - textStartSeconds(presentation, nowSec));
  if (elapsed < getNarrativeSceneReadSeconds(page.text, presentation)) return false;
  advanceNarrativeScenePresentation(gameState, content, { forceCompleteTextFirst: false, nowSec });
  return true;
}

export function toggleNarrativeSceneAuto(gameState) {
  const presentation = ensureNarrativeScenePresentation(gameState);
  presentation.auto = !presentation.auto;
  return presentation.auto;
}

export function skipNarrativeScene(gameState, content) {
  const result = completeActiveNarrativeScene(ensureNarrativeState(gameState), content, { skipped: true });
  completeNarrativeScenePresentation(gameState, content, result.event || {});
  return true;
}

export function restartNarrativeScene(gameState, content, sceneId = null) {
  const targetSceneId = sceneId || content?.scenes?.[0]?.id || null;
  startNarrativeScene(ensureNarrativeState(gameState), content, targetSceneId, { source: 'scene-restart' });
  gameState.narrativeCompletion = null;
  resetNarrativeScenePresentation(gameState);
  return true;
}

export function setNarrativeSceneHitZones(gameState, hitZones) {
  const presentation = ensureNarrativeScenePresentation(gameState);
  presentation.hitZones = hitZones && typeof hitZones === 'object' ? hitZones : {};
  return presentation.hitZones;
}

export function handleNarrativeScenePointer(gameState, content, point) {
  const presentation = ensureNarrativeScenePresentation(gameState);
  const zones = presentation.hitZones || {};
  if (presentation.completed) {
    if (isPointInRect(point, zones.restart)) {
      restartNarrativeScene(gameState, content);
      return { handled: true, action: 'restart' };
    }
    return { handled: true, action: 'completed-idle' };
  }
  if (getNarrativeShotTransition(presentation, presentation.lineId).active) {
    return { handled: true, action: 'shot-transition' };
  }
  if (isPointInRect(point, zones.auto)) {
    const auto = toggleNarrativeSceneAuto(gameState);
    return { handled: true, action: auto ? 'auto-on' : 'auto-off' };
  }
  if (isPointInRect(point, zones.skip)) {
    skipNarrativeScene(gameState, content);
    return { handled: true, action: 'skip' };
  }
  advanceNarrativeScenePresentation(gameState, content, { forceCompleteTextFirst: true });
  return { handled: true, action: 'advance' };
}
