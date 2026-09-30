import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { elementalImpactSlugForSkill, renderCombatAttackVfx } from '../web-runner/systems/combatAttackVfxPresentation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(root, 'web-runner/assets/elemental-impact');
const loaderSource = fs.readFileSync(path.join(root, 'web-runner/systems/runtimeVisualAssetLoader.js'), 'utf8');

function loaderFactoryFromRuntimeSource() {
  const match = loaderSource.match(/export function createElementalImpactFrameLoader\([\s\S]*?\n}\n(?=\nexport async function loadRuntimeImage)/);
  assert.ok(match, 'runtime asset loader exposes a focused lazy flipbook loader');
  return Function(`${match[0].replace('export function', 'function')}; return createElementalImpactFrameLoader;`)();
}

test('runtime package includes all approved transparent impact frame entries', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'));
  const names = manifest.effects.flatMap(effect => effect.frames);
  assert.equal(manifest.effects.length, 16);
  assert.equal(names.length, 111);
  assert.equal(new Set(names).size, 111);
  assert.equal(manifest.canvas.width, 627);
  assert.equal(manifest.canvas.height, 627);
  assert.equal(manifest.playback.fps, 30);
  assert.equal(manifest.playback.loop, false);
  assert.equal(manifest.playback.totalDurationMs, 601);
  assert.ok(names.every(name => fs.existsSync(path.join(assetRoot, manifest.frameDirectory, name))));
});

test('elemental frames load only when requested and are cached per effect', async () => {
  const createLoader = loaderFactoryFromRuntimeSource();
  const manifest = {
    frameDirectory: 'frames',
    playback: { previewFrameHoldMs: [100, 67] },
    effects: [
      { slug: 'fire', frames: ['fire-a.png', 'fire-b.png'] },
      { slug: 'wind', frames: ['wind-a.png', 'wind-b.png'], frameHoldMs: [67, 133] },
    ],
  };
  let manifestLoads = 0;
  const imageLoads = [];
  const loadFrames = createLoader({
    async loadManifest() { manifestLoads += 1; return manifest; },
    async loadImage(url) { imageLoads.push(url); return { src: url }; },
    frameUrl: (directory, name) => `${directory}/${name}`,
  });

  assert.equal(manifestLoads, 0);
  assert.deepEqual(imageLoads, []);
  const [fireA, fireB] = await Promise.all([loadFrames('fire'), loadFrames('fire')]);
  assert.equal(manifestLoads, 1);
  assert.equal(imageLoads.length, 2);
  assert.equal(fireA, fireB);
  assert.equal(fireA.totalDurationMs, 167);
  assert.equal((await loadFrames('wind')).totalDurationMs, 200);
  assert.equal(imageLoads.length, 4);
  assert.equal(await loadFrames('../source'), null);
});

test('approved hero skill IDs resolve to their source-thread element slugs', () => {
  const mapping = {
    challenge_bolt: 'mark', shield_relay: 'light', brace: 'metal', retaliation_burst: 'earth', shield_slam: 'wind',
    ambush: 'dark', cheap_shot: 'metal', razor_sweep: 'wind', piercing_throw: 'metal', finish_the_job: 'blood',
    frost_reversal: 'ice', hex_beacon: 'dark', burn_sigil: 'fire', null_field: 'void', return_gate: 'arcane',
    wishgrant: 'light', quickload: 'lightning', split_feed: 'wind', patchwork: 'bloom', fortunes_blessing: 'mark',
  };
  for (const [skillId, slug] of Object.entries(mapping)) assert.equal(elementalImpactSlugForSkill(skillId), slug);
  assert.equal(elementalImpactSlugForSkill('frost_reversal', 'wind'), 'wind');
  assert.equal(elementalImpactSlugForSkill('unmapped'), '');
});

test('impact requests play one centered one-shot flipbook using manifest frame holds', () => {
  const frames = Array.from({ length: 7 }, (_, index) => ({ id: `ice-${index + 1}`, width: 627, height: 627 }));
  const draws = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, scale() {},
    drawImage(image, x, y, width, height) { draws.push({ id: image.id, x, y, width, height }); },
  };
  const state = {
    globals: {
      time: 0,
      CombatImpactRequests: [{ at: 0, heroUID: 1, targetUID: 2, point: { x: 91, y: 103 }, skillId: 'frost_reversal', damage: 20 }],
    },
    entities: [
      { uid: 1, kind: 'hero', name: 'Fara', x: 40, y: 103 },
      { uid: 2, kind: 'enemy', name: 'Gobloc', x: 100, y: 103, maxHP: 100 },
    ],
  };
  const images = { ElementalImpactFrames: { ice: { frames, frameHoldMs: [100, 67, 100, 67, 100, 67, 100], totalDurationMs: 601 } } };
  const draw = () => renderCombatAttackVfx(ctx, { state, images, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });

  draw();
  assert.deepEqual(state.globals.CombatImpactRequests, []);
  assert.equal(state.globals.CombatImpactVisuals[0].elementalSlug, 'ice');
  assert.equal(state.globals.CombatImpactVisuals[0].targetUID, 2);
  assert.deepEqual([draws[0].id, draws[0].x, draws[0].y, draws[0].width, draws[0].height], ['ice-1', 65, 77, 52, 52]);
  state.globals.time = 0.12;
  draw();
  assert.equal(draws.at(-1).id, 'ice-2');
  assert.equal(draws.at(-1).width, 52);
  state.globals.time = 0.601;
  draw();
  assert.equal(state.globals.CombatImpactVisuals.length, 0);
});
