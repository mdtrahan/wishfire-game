const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
}

test('narrative content is data-driven, localized, and separate from runtime rules', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const placeholder = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativePlaceholderContent.mjs'));
  const content = placeholder.PLACEHOLDER_NARRATIVE_CONTENT;
  const validation = runtime.validateNarrativeContent(content);
  const scene = content.scenes.find((candidate) => candidate.id === 'temp-demo-portal-return');

  assert.deepEqual(validation.errors, []);
  assert.equal(content.version, 1);
  assert.equal(content.contentPackId, 'temporary-narrative-framework-demo');
  assert.equal(content.characters.length, 3);
  assert.deepEqual(content.characters.map((character) => character.id), [
    'temp-demo-ranger',
    'temp-demo-scout',
    'temp-demo-innkeeper',
  ]);
  assert.equal(content.backgrounds.length, 1);
  assert.equal(content.backgrounds[0].id, 'temp-demo-village-inn-night');
  assert.ok(content.characters.every((character) => character.portrait?.kind === 'temporary-illustration'));
  assert.ok(content.backgrounds.every((background) => background.kind === 'temporary-illustration'));
  assert.ok(scene, 'temporary demo scene exists');
  assert.equal(scene.steps.length, 10);
  assert.deepEqual(scene.presentation.cameraShots, [
    {
      id: 'solo-arrival',
      cast: [{ characterId: 'temp-demo-ranger', slot: 'solo-center' }],
    },
    {
      id: 'waiting-pair',
      cast: [
        { characterId: 'temp-demo-scout', slot: 'duo-left' },
        { characterId: 'temp-demo-innkeeper', slot: 'duo-right' },
      ],
    },
  ]);
  assert.deepEqual(new Set(scene.steps.map((step) => step.speakerId)), new Set([
    'temp-demo-ranger',
    'temp-demo-scout',
    'temp-demo-innkeeper',
  ]));
  assert.equal(scene.steps.every((step) => step.textKey && !Object.hasOwn(step, 'text')), true);
  assert.equal(scene.steps.every((step) => step.cameraShotId), true);
  assert.equal(
    scene.steps.every((step) => (
      step.speakerId === 'temp-demo-ranger'
        ? step.cameraShotId === 'solo-arrival'
        : step.cameraShotId === 'waiting-pair'
    )),
    true,
  );
  assert.equal(typeof content.locales.en[scene.steps[0].textKey], 'string');
  assert.equal(content.locales.en['demo.complete.message'], 'End of Narrative Framework Demonstration');

  const firstLine = runtime.resolveNarrativeLine(content, scene.steps[0], 'en');
  assert.equal(firstLine.text, content.locales.en[scene.steps[0].textKey]);
  assert.equal(firstLine.speaker.id, 'temp-demo-ranger');
  assert.equal(firstLine.cameraShotId, 'solo-arrival');
  assert.equal(firstLine.portrait.kind, 'temporary-illustration');

  const runtimeSource = readRepoFile('web-runner', 'src', 'core', 'narrativeRuntime.mjs');
  assert.doesNotMatch(runtimeSource, /hunters have not returned/i);
  assert.doesNotMatch(runtimeSource, /temp-demo-portal-return/);
});

test('narrative runtime starts from a map trigger and advances to a completion event', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const { PLACEHOLDER_NARRATIVE_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativePlaceholderContent.mjs')
  );
  const trigger = runtime.resolveNarrativeMapTrigger(content, {
    triggerId: 'map.temp-demo-portal-return',
    layoutId: 'mapLayout',
  });
  const state = runtime.createNarrativeState();

  assert.equal(trigger.sceneId, 'temp-demo-portal-return');

  const started = runtime.startNarrativeScene(state, content, trigger.sceneId, {
    source: 'map',
    triggerId: trigger.id,
  });
  assert.equal(state.activeSceneId, 'temp-demo-portal-return');
  assert.equal(started.currentLine.speaker.id, 'temp-demo-ranger');
  assert.equal(started.currentLine.cameraShotId, 'solo-arrival');
  assert.equal(started.done, false);

  let advanced = null;
  for (let i = 0; i < 9; i += 1) {
    advanced = runtime.advanceNarrativeScene(state, content);
  }
  assert.equal(advanced.currentLine.speaker.id, 'temp-demo-innkeeper');
  assert.equal(advanced.done, false);

  const completed = runtime.advanceNarrativeScene(state, content);
  assert.equal(completed.done, true);
  assert.deepEqual(completed.event, {
    type: 'demo-complete',
    messageKey: 'demo.complete.message',
  });
});

test('production story entry is wired through its game adapter', () => {
  const app = readRepoFile('web-runner', 'app.js');
  const registry = readRepoFile('web-runner', 'systems', 'runtimeLayoutRegistry.js');
  const fallback = readRepoFile('web-runner', 'systems', 'renderHarnessFallback.js');
  assert.match(app, /createStoryEntryFlow/);
  assert.match(app, /storyEntry\.handlePointer/);
  assert.match(app, /storyEntry\.update/);
  assert.match(registry, /storyEntry\?\.allowedTransitions/);
  assert.match(fallback, /renderNarrativeScene/);
  assert.doesNotMatch(app, /startNarrativeScene/);
});

test('narrative scene presentation owns typewriter, controls, completion, and restart affordances', () => {
  const rendererSrc = readRepoFile('web-runner', 'systems', 'renderNarrativeScene.js');
  const controllerSrc = readRepoFile('web-runner', 'systems', 'narrativeSceneController.mjs');
  const pointerRouterSrc = readRepoFile('web-runner', 'systems', 'storyEntryFlow.mjs');

  assert.match(rendererSrc, /Auto/);
  assert.match(rendererSrc, /Skip/);
  assert.match(rendererSrc, /Restart Scene/);
  assert.match(rendererSrc, /End of Scene/);
  assert.match(controllerSrc, /NARRATIVE_TYPEWRITER_CHARS_PER_SECOND/);
  assert.match(controllerSrc, /toggleNarrativeSceneAuto/);
  assert.match(controllerSrc, /skipNarrativeScene/);
  assert.match(controllerSrc, /restartNarrativeScene/);
  assert.match(controllerSrc, /readingSpeedWordsPerSecond/);
  assert.match(pointerRouterSrc, /handleNarrativeScenePointer/);
});

test('speaker focus affects character artwork without rectangular portrait treatments', () => {
  const rendererSrc = readRepoFile('web-runner', 'systems', 'renderNarrativeScene.js');

  assert.doesNotMatch(
    rendererSrc,
    /function drawCharacterPortrait[\s\S]*?ctx\.globalAlpha = 1[\s\S]*?\n}/,
    'portraits must inherit the ordered actor-fade opacity',
  );
  assert.match(rendererSrc, /ctx\.filter = isActive \? 'none' : 'saturate\(0\.55\) brightness\(0\.42\)'/);
  assert.doesNotMatch(rendererSrc, /ctx\.fillRect\(0,\s*0,\s*220,\s*340\)/);
  assert.doesNotMatch(rendererSrc, /rgba\(246,\s*232,\s*183/);
  assert.match(rendererSrc, /sort\(\(a, b\) => Number\(a\.isSpeaker\) - Number\(b\.isSpeaker\)\)/);
  assert.match(rendererSrc, /resolveImage/);
  assert.match(rendererSrc, /line\.shot\.cast/);
});

test('camera shot validation rejects missing shots and speakers outside the selected shot', async () => {
  const runtime = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativeRuntime.mjs'));
  const { PLACEHOLDER_NARRATIVE_CONTENT: content } = await import(
    path.join(repoRoot, 'web-runner', 'src', 'core', 'narrativePlaceholderContent.mjs')
  );
  const clone = structuredClone(content);

  delete clone.scenes[0].steps[0].cameraShotId;
  clone.scenes[0].steps[1].cameraShotId = 'missing-shot';
  clone.scenes[0].steps[3].cameraShotId = 'waiting-pair';

  const validation = runtime.validateNarrativeContent(clone);
  assert.ok(validation.errors.some((error) => error.includes('must use cameraShotId')));
  assert.ok(validation.errors.some((error) => error.includes('references missing camera shot')));
  assert.ok(validation.errors.some((error) => error.includes('speaker') && error.includes('is absent from camera shot')));
});

test('dialogue background omits the road shape that reads as a third figure', () => {
  const rendererSrc = readRepoFile('web-runner', 'systems', 'renderNarrativeScene.js');

  assert.doesNotMatch(rendererSrc, /createLinearGradient\(0, viewHeight \* 0\.56, 0, viewHeight\)/);
  assert.doesNotMatch(rendererSrc, /#6f674c/);
  assert.doesNotMatch(rendererSrc, /#2c2928/);
});

test('dialogue background uses an original multicolor warpfall placeholder', () => {
  const rendererSrc = readRepoFile('web-runner', 'systems', 'renderNarrativeScene.js');

  assert.doesNotMatch(rendererSrc, /ctx\.ellipse\(viewWidth \* 0\.78, viewHeight \* 0\.55/);
  assert.doesNotMatch(rendererSrc, /rgba\(151, 202, 190, 0\.28\)/);
  assert.match(rendererSrc, /drawWarpfallBackground/);
  assert.match(rendererSrc, /#71d6d0/);
  assert.match(rendererSrc, /#e6b74d/);
  assert.match(rendererSrc, /#b48adb/);
  assert.match(rendererSrc, /#df6d61/);
});

test('narrative presentation keeps one reference layout and scales it into compact viewports', async () => {
  const viewportRules = await import(
    path.join(repoRoot, 'web-runner', 'systems', 'narrativeSceneViewport.mjs')
  );
  const compact = viewportRules.computeNarrativeSceneViewport(217, 387);
  const reference = viewportRules.computeNarrativeSceneViewport(360, 640);

  assert.deepEqual(reference, {
    logicalWidth: 360,
    logicalHeight: 640,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  assert.equal(compact.logicalWidth, 360);
  assert.equal(compact.logicalHeight, 640);
  assert.ok(compact.scale > 0.6 && compact.scale < 0.61);
  assert.ok(compact.offsetX >= 0);
  assert.ok(compact.offsetY >= 0);
  assert.ok(compact.logicalWidth * compact.scale <= 217);
  assert.ok(compact.logicalHeight * compact.scale <= 387);
});

test('narrative typewriter clock is presentation-owned for each displayed line', () => {
  const controllerSrc = readRepoFile('web-runner', 'systems', 'narrativeSceneController.mjs');
  const rendererSrc = readRepoFile('web-runner', 'systems', 'renderNarrativeScene.js');

  assert.match(controllerSrc, /presentation\.lineId\s*=\s*null;\s*\n\s*presentation\.lineStartedAtSec\s*=\s*0;/);
  assert.match(controllerSrc, /resetNarrativeScenePresentation\(gameState\)/);
  assert.match(rendererSrc, /syncNarrativeSceneLine\(gameState, line\.id, nowSec\)/);
  assert.match(rendererSrc, /getNarrativeScenePage\(line\.text, syncedPresentation/);
  assert.match(rendererSrc, /getNarrativeSceneVisibleText\(page\.text, syncedPresentation, nowSec\)/);
});
