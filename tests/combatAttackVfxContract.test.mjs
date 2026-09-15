import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queueCombatAttackImpactVfx, renderCombatAttackVfx } from '../web-runner/systems/combatAttackVfxPresentation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeBank = fs.readFileSync(path.join(root, 'web-runner/modules/functionBank.js'), 'utf8');
const scriptsBank = fs.readFileSync(path.join(root, 'Scripts/functionBank.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'web-runner/systems/runtimeVisualAssetLoader.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'web-runner/systems/renderRuntime.js'), 'utf8');
const qaHooks = fs.readFileSync(path.join(root, 'web-runner/systems/devBrowserTestHooks.js'), 'utf8');
const heroCommands = fs.readFileSync(path.join(root, 'web-runner/modules/heroCommands.mjs'), 'utf8');

test('attack packets declare mirrored illustrated presentation and magic heroes stay at rest', () => {
  for (const source of [runtimeBank, scriptsBank]) {
    assert.match(source, /if \(key === 'Runa'\) return 'runa_bolt'/);
    assert.match(source, /if \(key === 'Kojonn' \|\| key === 'Kaja'\) return 'kaja_orb'/);
    assert.match(source, /attackVfxKind: 'split'/);
    assert.match(source, /attackVfxPrimary: index === 0 \? 1 : 0/);
    assert.match(source, /const profile = actor\?\.attackType === 'magic' \? 'ranged' : requestedProfile/);
  }
  assert.match(renderer, /queueCombatAttackImpactVfx\(state, hit, targetEntity, now\)/);
  assert.match(renderer, /renderCombatAttackVfx\(ctx, \{ state, images, worldToCanvas, layoutScale \}\)/);
  assert.match(qaHooks, /\['QA chosen basic',[\s\S]*'HeroAttackSingle', hero\.uid, target\.uid/);
  assert.match(heroCommands, /nativeBasicAttackVfx/);
  assert.match(heroCommands, /attackVfxTargetUIDs/);
  assert.match(renderer, /ResolveNativeCommandStep[\s\S]*queueCombatAttackImpactVfx/);
});

test('four transparent raster VFX assets are loaded', () => {
  for (const [key, name] of [
    ['CombatHitFlare', 'vfx_hit_flare.png'],
    ['CombatSplitSlash', 'vfx_split_slash.png'],
    ['CombatRunaBolt', 'vfx_runa_bolt.png'],
    ['CombatKajaOrb', 'vfx_kaja_orb.png'],
  ]) {
    assert.match(loader, new RegExp(`${key}.*${name}`));
    const png = fs.readFileSync(path.join(root, 'web-runner/assets/images', name));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png[25], 6, `${name} must retain RGBA transparency`);
  }
});

test('ranged projectiles, Split, and hit flare render through the shared presentation helper', () => {
  const draws = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {},
    drawImage(image) { draws.push(image); },
    set globalAlpha(value) {},
  };
  const images = {
    CombatRunaBolt: { id: 'runa' }, CombatKajaOrb: { id: 'kaja' },
    CombatSplitSlash: { id: 'split' }, CombatHitFlare: { id: 'impact' },
  };
  const state = {
    globals: {
      time: 1,
      EnemySize: 40,
      HeroRestBasePosByUID: { 1: { x: 60, y: 180 }, 2: { x: 60, y: 220 } },
      PendingHeroHits: [
        { at: 1.2, heroUID: 1, targetUID: 10, attackVfxKind: 'runa_bolt' },
        { at: 1.2, heroUID: 2, targetUID: 11, attackVfxKind: 'kaja_orb' },
        { at: 1.2, heroUID: 1, targetUID: 10, attackVfxKind: 'split', attackVfxPrimary: 1 },
        { at: 1.2, heroUID: 1, targetUID: 11, attackVfxKind: 'split', attackVfxPrimary: 0 },
      ],
    },
    entities: [
      { uid: 1, kind: 'hero' }, { uid: 2, kind: 'hero' },
      { uid: 10, kind: 'enemy', x: 250, y: 150 }, { uid: 11, kind: 'enemy', x: 250, y: 210 },
    ],
  };
  queueCombatAttackImpactVfx(state, state.globals.PendingHeroHits[0], state.entities[2], 1);
  renderCombatAttackVfx(ctx, { state, images, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });
  assert.deepEqual(new Set(draws.map(image => image.id)), new Set(['runa', 'kaja', 'split', 'impact']));
});
