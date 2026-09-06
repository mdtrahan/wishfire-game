function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function findById(list, id) {
  return arrayOf(list).find((entry) => String(entry?.id || '') === String(id || '')) || null;
}

function localeTable(content, locale) {
  const locales = content?.locales || {};
  return locales[locale] || locales[content?.defaultLocale] || locales.en || {};
}

function resolveText(content, key, locale) {
  if (!key) return '';
  return String(localeTable(content, locale)[key] || key);
}

function ensureStringId(value, label, errors) {
  if (!value || typeof value !== 'string') {
    errors.push(`${label} must be a non-empty string`);
  }
}

const STATIC_SHOT_KINDS = new Set(['characters', 'item', 'background-only', 'dark']);
const CHARACTER_SHOT_SLOTS = new Set(['left', 'right', 'center']);

function validateTypedCameraShot({ shot, scene, characterIds, itemIds, errors }) {
  const label = `scene "${scene?.id}" camera shot "${shot?.id}"`;
  if (!STATIC_SHOT_KINDS.has(shot?.kind)) {
    errors.push(`${label} uses unsupported kind "${shot?.kind}"`);
    return;
  }

  const cast = arrayOf(shot?.cast);
  if (shot.kind === 'characters') {
    ensureStringId(shot?.compositionId, `${label} compositionId`, errors);
    if (!cast.length || cast.length > 2) errors.push(`${label} must include one or two cast members`);
    const slots = new Set();
    for (const actor of cast) {
      if (!characterIds.has(actor?.characterId)) {
        errors.push(`${label} references missing character "${actor?.characterId}"`);
      }
      if (!CHARACTER_SHOT_SLOTS.has(actor?.slot)) {
        errors.push(`${label} uses invalid cast slot "${actor?.slot}"`);
      } else if (slots.has(actor.slot)) {
        errors.push(`${label} reuses cast slot "${actor.slot}"`);
      }
      slots.add(actor?.slot);
    }
    return;
  }

  if (cast.length) errors.push(`${label} kind "${shot.kind}" must not include cast`);
  if (shot.kind === 'item') {
    if (!itemIds.has(shot?.item?.itemId)) {
      errors.push(`${label} references missing item "${shot?.item?.itemId}"`);
    }
  } else if (shot?.item) {
    errors.push(`${label} kind "${shot.kind}" must not include item`);
  }
}

export function validateNarrativeContent(content = {}) {
  const errors = [];
  const warnings = [];
  const characters = arrayOf(content.characters);
  const backgrounds = arrayOf(content.backgrounds);
  const scenes = arrayOf(content.scenes);
  const mapTriggers = arrayOf(content.mapTriggers);
  const audioCues = arrayOf(content.audioCues);
  const characterIds = new Set(characters.map((character) => character.id));
  const backgroundIds = new Set(backgrounds.map((background) => background.id));
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const defaultLocale = content.defaultLocale || 'en';
  const strings = localeTable(content, defaultLocale);
  const audioCueIds = new Set(audioCues.map((cue) => cue.id));

  if (content.version !== 1) errors.push('version must be 1');
  if (!characters.length) errors.push('characters must include at least one character');
  if (!backgrounds.length) errors.push('backgrounds must include at least one background');
  if (!scenes.length) errors.push('scenes must include at least one scene');

  for (const character of characters) {
    ensureStringId(character?.id, 'character.id', errors);
    if (character?.displayNameKey && !strings[character.displayNameKey]) {
      errors.push(`character "${character.id}" displayNameKey is missing from locale "${defaultLocale}"`);
    }
  }

  for (const background of backgrounds) {
    ensureStringId(background?.id, 'background.id', errors);
    if (background?.labelKey && !strings[background.labelKey]) {
      errors.push(`background "${background.id}" labelKey is missing from locale "${defaultLocale}"`);
    }
  }

  for (const scene of scenes) {
    ensureStringId(scene?.id, 'scene.id', errors);
    if (!backgroundIds.has(scene?.backgroundId)) {
      errors.push(`scene "${scene?.id}" references missing background "${scene?.backgroundId}"`);
    }
    const steps = arrayOf(scene?.steps);
    const cameraShots = arrayOf(scene?.presentation?.cameraShots);
    const items = arrayOf(scene?.presentation?.items);
    const itemIds = new Set(items.map((item) => item.id));
    const cameraShotById = new Map();
    if (scene?.presentation?.shotSchemaVersion != null && scene.presentation.shotSchemaVersion !== 2) {
      errors.push(`scene "${scene?.id}" shotSchemaVersion must be 2`);
    }
    for (const item of items) {
      ensureStringId(item?.id, `scene "${scene?.id}" item.id`, errors);
      ensureStringId(item?.visualRef, `scene "${scene?.id}" item "${item?.id}" visualRef`, errors);
      if (!(Number(item?.width) > 0) || !(Number(item?.height) > 0)) {
        errors.push(`scene "${scene?.id}" item "${item?.id}" must use positive width and height`);
      }
    }
    for (const shot of cameraShots) {
      ensureStringId(shot?.id, `scene "${scene?.id}" cameraShot.id`, errors);
      if (cameraShotById.has(shot?.id)) {
        errors.push(`scene "${scene?.id}" has duplicate camera shot "${shot?.id}"`);
      }
      cameraShotById.set(shot?.id, shot);
      if (scene?.presentation?.shotSchemaVersion === 2 || shot?.kind) {
        validateTypedCameraShot({ shot, scene, characterIds, itemIds, errors });
      } else {
        const cast = arrayOf(shot?.cast);
        if (!cast.length) errors.push(`scene "${scene?.id}" camera shot "${shot?.id}" must include cast`);
        for (const actor of cast) {
          if (!characterIds.has(actor?.characterId)) {
            errors.push(`scene "${scene?.id}" camera shot "${shot?.id}" references missing character "${actor?.characterId}"`);
          }
          ensureStringId(actor?.slot, `scene "${scene?.id}" camera shot "${shot?.id}" cast slot`, errors);
        }
      }
    }
    if (!steps.length) errors.push(`scene "${scene?.id}" must include at least one step`);
    for (const step of steps) {
      ensureStringId(step?.id, `scene "${scene?.id}" step.id`, errors);
      if (step?.type !== 'line') warnings.push(`scene "${scene?.id}" step "${step?.id}" uses non-line type "${step?.type}"`);
      if (step?.speakerId && !characterIds.has(step.speakerId)) {
        errors.push(`scene "${scene?.id}" step "${step?.id}" references missing speaker "${step?.speakerId}"`);
      }
      if (!step?.textKey) {
        errors.push(`scene "${scene?.id}" step "${step?.id}" must use textKey`);
      } else if (!strings[step.textKey]) {
        errors.push(`scene "${scene?.id}" step "${step?.id}" textKey is missing from locale "${defaultLocale}"`);
      }
      if (Object.hasOwn(step || {}, 'text')) {
        errors.push(`scene "${scene?.id}" step "${step?.id}" must not inline localized text`);
      }
      if (cameraShots.length && !step?.cameraShotId) {
        errors.push(`scene "${scene?.id}" step "${step?.id}" must use cameraShotId`);
      } else if (step?.cameraShotId) {
        const shot = cameraShotById.get(step.cameraShotId);
        if (!shot) {
          errors.push(`scene "${scene?.id}" step "${step?.id}" references missing camera shot "${step.cameraShotId}"`);
        } else if (shot.kind === 'characters' || !shot.kind) {
          if (!step?.speakerId) {
            errors.push(`scene "${scene?.id}" step "${step?.id}" character shot requires speakerId`);
          } else if (!arrayOf(shot.cast).some((actor) => actor?.characterId === step.speakerId)) {
            errors.push(`scene "${scene?.id}" step "${step?.id}" speaker "${step.speakerId}" is absent from camera shot "${step.cameraShotId}"`);
          }
        } else if ((shot.kind === 'background-only' || shot.kind === 'dark') && step?.speakerId) {
          errors.push(`scene "${scene?.id}" step "${step?.id}" shot kind "${shot.kind}" must omit speakerId`);
        }
      }
      if (step?.audioCueId && !audioCueIds.has(step.audioCueId)) {
        errors.push(`scene "${scene?.id}" step "${step?.id}" references missing audio cue "${step.audioCueId}"`);
      }
    }
  }

  for (const trigger of mapTriggers) {
    ensureStringId(trigger?.id, 'mapTrigger.id', errors);
    if (!sceneIds.has(trigger?.sceneId)) {
      errors.push(`mapTrigger "${trigger?.id}" references missing scene "${trigger?.sceneId}"`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function createNarrativeState(seed = {}) {
  return {
    activeSceneId: seed.activeSceneId || null,
    stepIndex: Math.max(0, Math.floor(Number(seed.stepIndex || 0))),
    locale: seed.locale || null,
    source: seed.source || null,
    triggerId: seed.triggerId || null,
    completedSceneIds: Array.isArray(seed.completedSceneIds) ? [...seed.completedSceneIds] : [],
    lastEvent: seed.lastEvent || null,
  };
}

export function ensureNarrativeState(gameState) {
  if (!gameState) return createNarrativeState();
  if (!gameState.narrative || typeof gameState.narrative !== 'object') {
    gameState.narrative = createNarrativeState();
  } else {
    gameState.narrative = createNarrativeState(gameState.narrative);
  }
  return gameState.narrative;
}

export function getNarrativeScene(content, sceneId) {
  return findById(content?.scenes, sceneId);
}

export function resolveNarrativeLine(content, step, locale = content?.defaultLocale || 'en', scene = null) {
  if (!step) return null;
  const ownerScene = scene || arrayOf(content?.scenes).find((candidate) => (
    arrayOf(candidate?.steps).some((candidateStep) => candidateStep?.id === step?.id)
  ));
  const shot = findById(ownerScene?.presentation?.cameraShots, step.cameraShotId);
  const item = findById(ownerScene?.presentation?.items, shot?.item?.itemId);
  const speaker = step?.speakerId ? findById(content?.characters, step.speakerId) : null;
  const audioCue = findById(content?.audioCues, step?.audioCueId);
  return {
    id: step.id || null,
    type: step.type || 'line',
    textKey: step.textKey || '',
    text: resolveText(content, step.textKey, locale),
    placement: step.placement || 'left',
    cameraShotId: step.cameraShotId || null,
    shot: shot || null,
    item: item || null,
    speaker: speaker ? {
      ...speaker,
      displayName: resolveText(content, speaker.displayNameKey, locale),
    } : null,
    portrait: step.portrait || speaker?.portrait || null,
    backgroundId: step.backgroundId || null,
    audioCueId: step.audioCueId || null,
    audioCue: audioCue || null,
  };
}

export function getCurrentNarrativeLine(state, content, locale = state?.locale || content?.defaultLocale || 'en') {
  const scene = getNarrativeScene(content, state?.activeSceneId);
  if (!scene) return null;
  const steps = arrayOf(scene.steps);
  const step = steps[Math.max(0, Math.min(steps.length - 1, Number(state?.stepIndex || 0)))];
  const line = resolveNarrativeLine(content, step, locale, scene);
  const background = findById(content?.backgrounds, step?.backgroundId || scene.backgroundId);
  return line ? { ...line, sceneId: scene.id, background } : null;
}

export function startNarrativeScene(state, content, sceneId, meta = {}) {
  const targetState = state || createNarrativeState();
  const scene = getNarrativeScene(content, sceneId);
  if (!scene) {
    targetState.lastEvent = { type: 'error', reason: 'scene-not-found', sceneId: String(sceneId || '') };
    return { done: true, currentLine: null, event: targetState.lastEvent };
  }
  targetState.activeSceneId = scene.id;
  targetState.stepIndex = 0;
  targetState.locale = meta.locale || targetState.locale || content?.defaultLocale || 'en';
  targetState.source = meta.source || null;
  targetState.triggerId = meta.triggerId || null;
  targetState.lastEvent = { type: 'scene-started', sceneId: scene.id, source: targetState.source, triggerId: targetState.triggerId };
  return { done: false, currentLine: getCurrentNarrativeLine(targetState, content), event: targetState.lastEvent };
}

export function advanceNarrativeScene(state, content) {
  const targetState = state || createNarrativeState();
  const scene = getNarrativeScene(content, targetState.activeSceneId);
  if (!scene) return { done: true, currentLine: null, event: null };
  const steps = arrayOf(scene.steps);
  if (targetState.stepIndex < steps.length - 1) {
    targetState.stepIndex += 1;
    targetState.lastEvent = { type: 'line-advanced', sceneId: scene.id, stepIndex: targetState.stepIndex };
    return { done: false, currentLine: getCurrentNarrativeLine(targetState, content), event: targetState.lastEvent };
  }
  if (!targetState.completedSceneIds.includes(scene.id)) targetState.completedSceneIds.push(scene.id);
  targetState.activeSceneId = null;
  targetState.stepIndex = 0;
  targetState.lastEvent = scene.onComplete || { type: 'scene-complete', sceneId: scene.id };
  return { done: true, currentLine: null, event: targetState.lastEvent };
}

export function completeActiveNarrativeScene(state, content, extras = {}) {
  const targetState = state || createNarrativeState();
  const scene = getNarrativeScene(content, targetState.activeSceneId);
  if (!scene) return { done: true, currentLine: null, event: null };
  if (!targetState.completedSceneIds.includes(scene.id)) targetState.completedSceneIds.push(scene.id);
  targetState.activeSceneId = null;
  targetState.stepIndex = 0;
  targetState.lastEvent = { ...(scene.onComplete || { type: 'scene-complete', sceneId: scene.id }), ...extras };
  return { done: true, currentLine: null, event: targetState.lastEvent };
}

export function resolveNarrativeMapTrigger(content, { triggerId, layoutId } = {}) {
  const triggers = arrayOf(content?.mapTriggers);
  return triggers.find((trigger) => (
    triggerId && String(trigger.id || '') === String(triggerId)
  )) || triggers.find((trigger) => (
    layoutId && String(trigger.layoutId || '') === String(layoutId)
  )) || null;
}
