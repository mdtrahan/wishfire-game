import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { combatVfxProfileForActor, queueCombatAttackImpactVfx, renderCombatAttackVfx } from '../web-runner/systems/combatAttackVfxPresentation.mjs';

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

test('basic attack VFX follows actor stats with named magic identities', () => {
  assert.deepEqual(combatVfxProfileForActor({ name: 'Gobloc', stats: { ATK: 10, MAG: 5 } }), { delivery: 'melee', impact: 'melee' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Unknown Mage', stats: { ATK: 4, MAG: 12 } }), { delivery: 'magic_orb', impact: 'purple' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Djinn', stats: { ATK: 6, MAG: 28 } }), { delivery: 'djinn_rain', impact: 'purple' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Marid', stats: { ATK: 8, MAG: 22 } }), { delivery: 'marid_crescent', impact: 'blue' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Chimerilass', stats: { ATK: 8, MAG: 26 } }), { delivery: 'chimerilass_eruption', impact: 'rose' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Chimerilass', stats: { ATK: 30, MAG: 2 } }), { delivery: 'melee', impact: 'melee' });
});

test('transparent raster VFX assets are loaded', () => {
  for (const [key, name] of [
    ['CombatHitFlare', 'vfx_hit_flare.png'],
    ['CombatImpactBlue', 'vfx_impact_blue.png'],
    ['CombatImpactPurple', 'vfx_impact_purple.png'],
    ['CombatImpactRose', 'vfx_impact_rose.png'],
    ['CombatSplitSlash', 'vfx_split_slash.png'],
    ['CombatRunaBolt', 'vfx_runa_bolt.png'],
    ['CombatKajaOrb', 'vfx_kaja_orb.png'],
    ['CombatDjinnRain', 'vfx_djinn_rain.png'],
    ['CombatMaridCrescent', 'vfx_marid_crescent.png'],
    ['CombatChimerilassEruption', 'vfx_chimerilass_eruption.png'],
    ['CombatHealBloom', 'vfx_heal_bloom_illustrated.png'],
    ['CombatGroupHealRain', 'vfx_group_heal_rain.png'],
  ]) {
    assert.match(loader, new RegExp(`${key}.*${name}`));
    const png = fs.readFileSync(path.join(root, 'web-runner/assets/images', name));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png[25], 6, `${name} must retain RGBA transparency`);
  }
});

test('ranged projectiles, enemy magic, Split, and typed impacts render through the shared helper', () => {
  const draws = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {},
    drawImage(image) { draws.push(image); },
    set globalAlpha(value) {},
  };
  const images = {
    CombatRunaBolt: { id: 'runa' }, CombatKajaOrb: { id: 'kaja' },
    CombatSplitSlash: { id: 'split' }, CombatHitFlare: { id: 'impact' },
    CombatImpactBlue: { id: 'blue-impact' }, CombatImpactPurple: { id: 'purple-impact' },
    CombatDjinnRain: { id: 'djinn', width: 128, height: 192 },
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
      EnemyAction: { active: true, uid: 12, targetUID: 1, state: 'LUNGE', visualProgress: 0.6, timer: 0.1 },
    },
    entities: [
      { uid: 1, kind: 'hero', name: 'Runa' }, { uid: 2, kind: 'hero', name: 'Kaja' },
      { uid: 10, kind: 'enemy', x: 250, y: 150 }, { uid: 11, kind: 'enemy', x: 250, y: 210 },
      { uid: 12, kind: 'enemy', name: 'Djinn', x: 250, y: 250, stats: { ATK: 6, MAG: 28 } },
    ],
  };
  queueCombatAttackImpactVfx(state, state.globals.PendingHeroHits[0], state.entities[2], 1);
  renderCombatAttackVfx(ctx, { state, images, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });
  assert.deepEqual(new Set(draws.map(image => image.id)), new Set(['runa', 'kaja', 'split', 'blue-impact', 'djinn']));
});

test('enemy damage wiring queues a typed hero impact after the shipping skill call', () => {
  assert.match(renderer, /const heroHpBefore = new Map/);
  assert.match(renderer, /ApplyEnemySkill[\s\S]*heroHpBefore\.get\(hero\.uid\)[\s\S]*queueCombatAttackImpactVfx/);
  assert.match(renderer, /enemyUsesRangedMagic \? enemy\.originX/);
});
