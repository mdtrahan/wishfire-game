const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
}

function advanceAuthoredLine(controller, gameState, content, nowSec) {
  const startingStepIndex = gameState.narrative.stepIndex;
  for (let pageTurn = 0; pageTurn < 20; pageTurn += 1) {
    controller.advanceNarrativeScenePresentation(gameState, content, {
      forceCompleteTextFirst: false,
      nowSec: nowSec + pageTurn * 0.001,
    });
    if (gameState.narrative.stepIndex !== startingStepIndex) return;
  }
  throw new Error(`Narrative line ${startingStepIndex} did not advance`);
}

test('Wishfire warp-crossing scene owns four transparent cast assets and localized content', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const validation = runtime.validateNarrativeContent(content);
  const scene = content.scenes.find((candidate) => candidate.id === 'wishfire-warp-crossing-arrival');

  assert.deepEqual(validation.errors, []);
  assert.deepEqual(content.characters.map((character) => character.id), ['hondo', 'fara', 'kaja', 'runa']);
  assert.ok(scene);
  assert.equal(scene.presentation.shotSchemaVersion, 2);
  assert.equal(scene.steps.length, 36);
  assert.equal(scene.steps.every((step) => step.textKey && !Object.hasOwn(step, 'text')), true);

  const nativeBounds = {
    hondo: [679, 590],
    fara: [480, 597],
    kaja: [572, 532],
    runa: [511, 523],
  };
  for (const character of content.characters) {
    const assetPath = path.join(repoRoot, 'web-runner', character.portrait.assetRef);
    const png = fs.readFileSync(assetPath);
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.equal(png[25], 6, `${character.id} portrait must use RGBA PNG color type`);
    assert.deepEqual(
      [png.readUInt32BE(16), png.readUInt32BE(20)],
      nativeBounds[character.id],
      `${character.id} must preserve its sheet-relative extraction bounds`,
    );
    assert.equal(character.portrait.stageScale, undefined, `${character.id} must use the shared portrait scale`);
  }
});

test('portrait rendering applies one shared source-pixel scale across every cast slot', () => {
  const renderer = readRepoFile('web-runner', 'systems', 'renderNarrativeScene.js');
  assert.match(renderer, /const PORTRAIT_STAGE_SCALE = 0\.38;/);
  assert.match(renderer, /image\.width \* PORTRAIT_STAGE_SCALE/);
  assert.match(renderer, /image\.height \* PORTRAIT_STAGE_SCALE/);
  assert.doesNotMatch(renderer, /portrait\.stageScale/);
  assert.doesNotMatch(renderer, /ctx\.clip\(\)/);
  assert.match(renderer, /left: \{ x: -28, y: stageRect\.y \+ 10, w: 220/);
});

test('four-participant scene uses two disjoint pairs, typed object focus, and dark ellipses', async () => {
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const scene = content.scenes[0];
  const shots = new Map(scene.presentation.cameraShots.map((shot) => [shot.id, shot]));
  const hondoFara = shots.get('hondo-fara-pair');
  const kajaRuna = shots.get('kaja-runa-pair');
  const darkSteps = scene.steps.filter((step) => shots.get(step.cameraShotId)?.kind === 'dark');

  assert.deepEqual(hondoFara.cast, [
    { characterId: 'hondo', slot: 'left' },
    { characterId: 'fara', slot: 'right' },
  ]);
  assert.deepEqual(kajaRuna.cast, [
    { characterId: 'kaja', slot: 'left' },
    { characterId: 'runa', slot: 'right' },
  ]);
  assert.equal(new Set([...hondoFara.cast, ...kajaRuna.cast].map((entry) => entry.characterId)).size, 4);
  assert.equal(Math.max(...scene.presentation.cameraShots.map((shot) => shot.cast?.length || 0)), 2);
  assert.equal(darkSteps.length, 4);
  assert.equal(darkSteps.every((step) => !step.speakerId), true);
  assert.equal(darkSteps.every((step) => content.locales.en[step.textKey] === '...'), true);
  assert.equal(shots.get('four-orbs-focus').kind, 'item');
  assert.equal(shots.get('paper-map-focus').kind, 'item');
  assert.equal(shots.get('red-orbs-tutorial').kind, 'item');
  assert.equal(shots.get('creature-roar').kind, 'background-only');
});

test('scene directions map to reusable cues without adding combat mechanics', async () => {
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const scene = content.scenes[0];
  const localized = (step) => content.locales.en[step.textKey];

  const failedSpellStep = scene.steps.find((step) => step.audioCueId === 'failed-spells');
  const roarStep = scene.steps.find((step) => step.audioCueId === 'creature-roar');
  const combatTutorialStep = scene.steps.find((step) => localized(step) === 'COMBAT TUTORIAL: RED ORBS');
  const mapFocusSteps = scene.steps.filter((step) => step.cameraShotId === 'paper-map-focus');

  assert.equal(localized(failedSpellStep), 'Spells aren\u2019t doing anything.');
  assert.equal(localized(roarStep), 'RAWR!!');
  assert.equal(combatTutorialStep.cameraShotId, 'red-orbs-tutorial');
  assert.equal(combatTutorialStep.speakerId, undefined);
  assert.deepEqual(mapFocusSteps.map(localized), [
    'Let me take a look.',
    'Looks like we\u2019re in the Goldrin Wilds, but a lot of the map is empty. Guess you\u2019re pretty new to exploring, huh?',
  ]);

  const runtimeSource = readRepoFile('web-runner', 'src', 'core', 'narrativeRuntime.mjs');
  const rendererSource = readRepoFile('web-runner', 'systems', 'renderNarrativeScene.js');
  assert.doesNotMatch(runtimeSource, /Goldrin Wilds|Hondo|Fara|Kaja|Runa/);
  assert.doesNotMatch(rendererSource, /Goldrin Wilds|warp tunnels crossing/);
  assert.doesNotMatch(readRepoFile('web-runner', 'app.js'), /wishfire-warp-crossing-arrival/);
});

test('ellipsis restoration reveals the complete next frame through one black cover', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const controller = await import(path.join(repoRoot, 'web-runner', 'systems', 'narrativeSceneController.mjs'));
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const gameState = {
    narrative: runtime.createNarrativeState(),
    narrativeScene: controller.createNarrativeScenePresentation(10),
  };
  runtime.startNarrativeScene(gameState.narrative, content, 'wishfire-warp-crossing-arrival');

  for (let index = 0; index < 4; index += 1) {
    advanceAuthoredLine(controller, gameState, content, 10 + index);
  }
  assert.equal(runtime.getCurrentNarrativeLine(gameState.narrative, content).shot.kind, 'dark');

  controller.advanceNarrativeScenePresentation(gameState, content, {
    forceCompleteTextFirst: false,
    nowSec: 20,
  });
  const restored = runtime.getCurrentNarrativeLine(gameState.narrative, content);
  assert.equal(restored.speaker.id, 'hondo');
  assert.equal(gameState.narrativeScene.shotTransitionLineId, restored.id);
  assert.equal(gameState.narrativeScene.shotTransitionMode, 'black-cover');
  controller.syncNarrativeSceneLine(gameState, restored.id, 20);
  const covered = controller.getNarrativeShotTransition(gameState.narrativeScene, restored.id, 20);
  const revealing = controller.getNarrativeShotTransition(gameState.narrativeScene, restored.id, 20.225);
  const revealed = controller.getNarrativeShotTransition(gameState.narrativeScene, restored.id, 20.451);
  assert.deepEqual(covered, {
    active: true,
    mode: 'black-cover',
    phase: 'cover',
    backgroundAlpha: 1,
    subjectAlpha: 1,
    dialogueAlpha: 1,
    dialogueReady: false,
    coverAlpha: 1,
  });
  assert.equal(revealing.phase, 'cover');
  assert.ok(Math.abs(revealing.coverAlpha - 0.5) < 0.001);
  assert.equal(revealing.backgroundAlpha, 1);
  assert.equal(revealing.subjectAlpha, 1);
  assert.equal(revealing.dialogueAlpha, 1);
  assert.equal(revealed.phase, 'dialogue');
  assert.equal(revealed.coverAlpha, 0);
  assert.equal(revealed.dialogueReady, true);
  assert.equal(controller.getNarrativeSceneVisibleText(restored.text, gameState.narrativeScene, 20.449), '');
});

test('character shot and reverse-shot changes cut directly without a transition', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const controller = await import(path.join(repoRoot, 'web-runner', 'systems', 'narrativeSceneController.mjs'));
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const gameState = {
    narrative: runtime.createNarrativeState(),
    narrativeScene: controller.createNarrativeScenePresentation(10),
  };
  runtime.startNarrativeScene(gameState.narrative, content, 'wishfire-warp-crossing-arrival');

  advanceAuthoredLine(controller, gameState, content, 11);
  assert.equal(gameState.narrativeScene.shotTransitionLineId, null, 'speaker changes within one shot stay continuous');

  advanceAuthoredLine(controller, gameState, content, 12);
  const incoming = runtime.getCurrentNarrativeLine(gameState.narrative, content);
  assert.equal(incoming.speaker.id, 'kaja');
  controller.syncNarrativeSceneLine(gameState, incoming.id, 12);
  assert.equal(gameState.narrativeScene.shotTransitionLineId, null);
  assert.equal(gameState.narrativeScene.shotTransitionMode, null);
  assert.equal(controller.getNarrativeShotTransition(gameState.narrativeScene, incoming.id, 12).phase, 'dialogue');
});

test('object-focus entries retain the ordered fade sequence', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const controller = await import(path.join(repoRoot, 'web-runner', 'systems', 'narrativeSceneController.mjs'));
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const gameState = {
    narrative: runtime.createNarrativeState(),
    narrativeScene: controller.createNarrativeScenePresentation(40),
  };
  runtime.startNarrativeScene(gameState.narrative, content, 'wishfire-warp-crossing-arrival');
  for (let index = 0; index < 7; index += 1) {
    advanceAuthoredLine(controller, gameState, content, 41 + index);
  }
  const objectFocus = runtime.getCurrentNarrativeLine(gameState.narrative, content);
  controller.syncNarrativeSceneLine(gameState, objectFocus.id, 48);
  assert.equal(objectFocus.shot.kind, 'item');
  assert.equal(gameState.narrativeScene.shotTransitionLineId, objectFocus.id);
  assert.equal(gameState.narrativeScene.shotTransitionMode, 'ordered');
  assert.equal(controller.getNarrativeShotTransition(gameState.narrativeScene, objectFocus.id, 47.249).phase, 'black');
  assert.equal(controller.getNarrativeShotTransition(gameState.narrativeScene, objectFocus.id, 47.475).phase, 'background');
  assert.equal(controller.getNarrativeShotTransition(gameState.narrativeScene, objectFocus.id, 47.79).phase, 'actors');
  assert.equal(controller.getNarrativeShotTransition(gameState.narrativeScene, objectFocus.id, 47.881).phase, 'dialogue');
});

test('the first scene line uses a black cover while ordinary shots remain ordered', async () => {
  const controller = await import(path.join(repoRoot, 'web-runner', 'systems', 'narrativeSceneController.mjs'));
  const presentation = controller.createNarrativeScenePresentation(30);
  controller.beginNarrativeShotTransition(presentation, 'first-line', 30, 'black-cover');
  assert.equal(controller.getNarrativeShotTransition(presentation, 'first-line', 30).phase, 'cover');
  assert.ok(Math.abs(
    controller.getNarrativeShotTransition(presentation, 'first-line', 30.225).coverAlpha - 0.5,
  ) < 0.001);
  assert.equal(controller.getNarrativeShotTransition(presentation, 'first-line', 30.451).phase, 'dialogue');
});

test('all speakers use locale-aware two-sentence pagination without rewriting content', async () => {
  const controller = await import(path.join(repoRoot, 'web-runner', 'systems', 'narrativeSceneController.mjs'));
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const scene = content.scenes[0];
  const paginatedSpeakers = new Set();
  for (const step of scene.steps) {
    const pages = controller.getNarrativeScenePages(content.locales.en[step.textKey], 'en');
    if (pages.length > 1 && step.speakerId) paginatedSpeakers.add(step.speakerId);
  }
  assert.deepEqual([...paginatedSpeakers].sort(), ['fara', 'hondo', 'kaja', 'runa']);
  assert.deepEqual(controller.getNarrativeScenePages(content.locales.en['scene.warpCrossing.006'], 'en'), [
    'So, you two were warping south and wound up here just like us? That’s odd.',
    'We were warping north. Never heard of warp tunnels crossing together like that.',
  ]);
});

test('taps complete and paginate a long line before advancing the narrative step', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const controller = await import(path.join(repoRoot, 'web-runner', 'systems', 'narrativeSceneController.mjs'));
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const gameState = {
    narrative: runtime.createNarrativeState(),
    narrativeScene: controller.createNarrativeScenePresentation(50),
  };
  runtime.startNarrativeScene(gameState.narrative, content, 'wishfire-warp-crossing-arrival');
  for (let index = 0; index < 5; index += 1) {
    advanceAuthoredLine(controller, gameState, content, 51 + index);
  }
  const hondoLine = runtime.getCurrentNarrativeLine(gameState.narrative, content);
  controller.syncNarrativeSceneLine(gameState, hondoLine.id, 60);
  assert.equal(hondoLine.speaker.id, 'hondo');
  assert.equal(controller.getNarrativeScenePage(hondoLine.text, gameState.narrativeScene, 'en').pageCount, 2);

  const completeFirst = controller.advanceNarrativeScenePresentation(gameState, content, { nowSec: 60 });
  assert.equal(completeFirst.pageAdvanced, false);
  assert.equal(gameState.narrative.stepIndex, 5);
  const transitionBeforePageTurn = {
    lineId: gameState.narrativeScene.shotTransitionLineId,
    startedAtSec: gameState.narrativeScene.shotTransitionStartedAtSec,
    mode: gameState.narrativeScene.shotTransitionMode,
  };
  const nextPage = controller.advanceNarrativeScenePresentation(gameState, content, { nowSec: 60 });
  assert.equal(nextPage.pageAdvanced, true);
  assert.equal(gameState.narrativeScene.pageIndex, 1);
  assert.equal(gameState.narrative.stepIndex, 5);
  assert.deepEqual({
    lineId: gameState.narrativeScene.shotTransitionLineId,
    startedAtSec: gameState.narrativeScene.shotTransitionStartedAtSec,
    mode: gameState.narrativeScene.shotTransitionMode,
  }, transitionBeforePageTurn, 'page turns must not restart or alter shot transitions');
  const completeSecond = controller.advanceNarrativeScenePresentation(gameState, content, { nowSec: 60 });
  assert.equal(completeSecond.pageAdvanced, false);
  const nextLine = controller.advanceNarrativeScenePresentation(gameState, content, { nowSec: 60 });
  assert.equal(nextLine.advanced, true);
  assert.equal(gameState.narrative.stepIndex, 6);
  assert.equal(gameState.narrativeScene.pageIndex, 0);
});

test('Auto reads each page separately before advancing the underlying line', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const controller = await import(path.join(repoRoot, 'web-runner', 'systems', 'narrativeSceneController.mjs'));
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'wishfireWarpCrossingContent.mjs')
  );
  const gameState = {
    narrative: runtime.createNarrativeState(),
    narrativeScene: controller.createNarrativeScenePresentation(80),
  };
  runtime.startNarrativeScene(gameState.narrative, content, 'wishfire-warp-crossing-arrival');
  for (let index = 0; index < 5; index += 1) {
    advanceAuthoredLine(controller, gameState, content, 81 + index);
  }
  const hondoLine = runtime.getCurrentNarrativeLine(gameState.narrative, content);
  controller.syncNarrativeSceneLine(gameState, hondoLine.id, 90);
  gameState.narrativeScene.auto = true;
  gameState.narrativeScene.lineStartedAtSec = 80;
  gameState.narrativeScene.pageStartedAtSec = 80;
  gameState.narrativeScene.typewriterCharsPerSecond = 1000000;
  gameState.narrativeScene.readingSpeedWordsPerSecond = 1000000;

  assert.equal(controller.updateNarrativeSceneAuto(gameState, content, 90), true);
  assert.equal(gameState.narrativeScene.pageIndex, 1);
  assert.equal(gameState.narrative.stepIndex, 5);
  assert.equal(controller.updateNarrativeSceneAuto(gameState, content, 92), true);
  assert.equal(gameState.narrative.stepIndex, 6);
  assert.equal(gameState.narrativeScene.pageIndex, 0);
});
