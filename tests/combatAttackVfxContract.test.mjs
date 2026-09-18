import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPROVED_IMPACT_DRAW_SCALE, IMPACT_PAINTED_WIDTH_LIMIT, combatVfxProfileForActor, queueCombatAttackImpactVfx, renderCombatAttackVfx } from '../web-runner/systems/combatAttackVfxPresentation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeBank = fs.readFileSync(path.join(root, 'web-runner/modules/functionBank.js'), 'utf8');
const scriptsBank = fs.readFileSync(path.join(root, 'Scripts/functionBank.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'web-runner/systems/runtimeVisualAssetLoader.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'web-runner/systems/renderRuntime.js'), 'utf8');
const qaHooks = fs.readFileSync(path.join(root, 'web-runner/systems/devBrowserTestHooks.js'), 'utf8');
const heroCommands = fs.readFileSync(path.join(root, 'web-runner/modules/heroCommands.mjs'), 'utf8');
const runtimeState = fs.readFileSync(path.join(root, 'web-runner/modules/state.js'), 'utf8');
const sessionReset = fs.readFileSync(path.join(root, 'web-runner/systems/combatSessionReset.mjs'), 'utf8');

test('attack packets declare mirrored illustrated presentation and magic heroes stay at rest', () => {
  for (const source of [runtimeBank, scriptsBank]) {
    assert.match(source, /if \(key === 'Runa'\) return 'runa_bolt'/);
    assert.match(source, /if \(key === 'Kojonn' \|\| key === 'Kaja'\) return 'kaja_orb'/);
    assert.match(source, /attackVfxKind: 'split'/);
    assert.match(source, /attackVfxPrimary: index === 0 \? 1 : 0/);
    assert.match(source, /attackVfxKind: combatAttackVfxKind\(actor\),[\s\S]{0,120}effectType: 'chain_bounce'/);
    assert.match(source, /g\.PendingHeroHits\.push\(\{[\s\S]{0,420}actionName: 'Chain Strike II'/);
    assert.match(source, /function HeroAttackAOE[\s\S]{0,2500}attackVfxKind: combatAttackVfxKind\(actor\)/);
    assert.match(source, /const profile = actor\?\.attackType === 'magic' \? 'ranged' : requestedProfile/);
  }
  assert.match(renderer, /queueCombatAttackImpactVfx\(state, hit, targetEntity, now\)/);
  assert.match(fs.readFileSync(path.join(root, 'web-runner/systems/combatAttackVfxPresentation.mjs'), 'utf8'), /CombatImpactRequests[\s\S]*queueCombatAttackImpactVfx\(state, request, target, now\)/);
  assert.match(renderer, /renderCombatAttackVfx\(ctx, \{ state, images, worldToCanvas, layoutScale \}\)/);
  assert.match(qaHooks, /\['QA chosen basic',[\s\S]*'HeroAttackSingle', hero\.uid, target\.uid/);
  assert.match(heroCommands, /nativeBasicAttackVfx/);
  assert.match(heroCommands, /attackVfxTargetUIDs/);
  assert.match(renderer, /ResolveNativeCommandStep[\s\S]*queueCombatAttackImpactVfx/);
  assert.doesNotMatch(renderer, /    renderArcanePulseVisuals\(\);/);
});

test('basic attack VFX follows actor stats with named magic identities', () => {
  assert.deepEqual(combatVfxProfileForActor({ name: 'Gobloc', stats: { ATK: 10, MAG: 5 } }), { delivery: 'melee', impact: 'melee' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Unknown Mage', stats: { ATK: 4, MAG: 12 } }), { delivery: 'magic_orb', impact: 'purple' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Djinn', stats: { ATK: 6, MAG: 28 } }), { delivery: 'djinn_rain', impact: 'purple' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Marid', stats: { ATK: 8, MAG: 22 } }), { delivery: 'marid_crescent', impact: 'blue' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Chimerilass', stats: { ATK: 8, MAG: 26 } }), { delivery: 'chimerilass_eruption', impact: 'rose' });
  assert.deepEqual(combatVfxProfileForActor({ name: 'Chimerilass', stats: { ATK: 30, MAG: 2 } }), { delivery: 'melee', impact: 'melee' });
});

test('hit impacts route weak hits to the glance ring and stronger ranged hits to hero colors', () => {
  const draws = [];
  const filters = ['none'];
  const ctx = {
    save() { filters.push(this.filter); },
    restore() { this.filter = filters.pop(); },
    drawImage(image, x, y, width) { draws.push({ image: image.id, x, width, filter: this.filter }); },
    filter: 'none',
    set globalAlpha(value) {},
  };
  const target = { uid: 10, kind: 'enemy', x: 250, y: 150, maxHP: 100 };
  const state = { globals: { time: 1, PendingHeroHits: [] }, entities: [
    { uid: 1, kind: 'hero', name: 'Runa' },
    { uid: 2, kind: 'hero', name: 'Kojonn' },
    { uid: 3, kind: 'hero', name: 'Falie' },
    target,
  ] };
  queueCombatAttackImpactVfx(state, { heroUID: 1, attackVfxKind: 'runa_bolt', finalDmg: 5 }, target, 1);
  queueCombatAttackImpactVfx(state, { heroUID: 1, attackVfxKind: 'runa_bolt', finalDmg: 6 }, target, 1);
  queueCombatAttackImpactVfx(state, { heroUID: 2, attackVfxKind: 'kaja_orb', finalDmg: 6 }, target, 1);
  queueCombatAttackImpactVfx(state, { heroUID: 3, attackVfxKind: 'impact', finalDmg: 6 }, target, 1);
  queueCombatAttackImpactVfx(state, { heroUID: 1, attackVfxKind: 'runa_bolt', finalDmg: 5, didCrit: true }, target, 1);
  assert.deepEqual(state.globals.CombatImpactVisuals.map(impact => [impact.weak, impact.kind]), [
    [true, 'g03_blue'], [false, 'g03_blue'], [false, 'g03_purple'], [false, 'melee'], [false, 'g03_blue'],
  ]);
  assert.ok(state.globals.CombatImpactVisuals.every(impact => impact.targetUID === target.uid));
  assert.deepEqual(state.globals.CombatImpactVisuals.map(impact => impact.y), [150, 143.2, 143.2, 143.2, 143.2]);
  renderCombatAttackVfx(ctx, { state, images: {
    CombatHitFlare: { id: 'white-or-melee-impact' },
    CombatWeakGlanceRing: { id: 'weak-glance-ring' },
    CombatImpactG03Blue: { id: 'g03-blue', width: 307, height: 321 },
    CombatImpactG03Purple: { id: 'g03-purple', width: 307, height: 321 },
  }, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });
  assert.deepEqual(draws.map(draw => draw.image), ['weak-glance-ring', 'g03-blue', 'g03-purple', 'white-or-melee-impact', 'g03-blue']);
  assert.equal(draws[0].filter, 'none');
  assert.equal(draws[1].width / draws[3].width, 0.68);
  assert.equal(draws[2].width / draws[3].width, 0.68);
  assert.ok(Math.abs(draws[0].x + draws[0].width / 2 - 248.4) < 1e-9);
  assert.ok(Math.abs(draws[1].x + draws[1].width * 0.91 - 248.4) < 1e-9);
  assert.ok(Math.abs(draws[2].x + draws[2].width * 0.91 - 248.4) < 1e-9);
  assert.deepEqual(draws.slice(1).map(draw => draw.filter), ['none', 'none', 'none', 'none']);
});

test('approved splash sheet assignments route by hero and action identity', () => {
  const draws = [];
  const ctx = {
    save() {}, restore() {},
    drawImage(image) { draws.push(image.id); },
    set globalAlpha(value) {},
  };
  const target = { uid: 10, kind: 'enemy', x: 250, y: 150, maxHP: 100 };
  const state = {
    globals: { time: 1, PendingHeroHits: [] },
    entities: [{ uid: 1, kind: 'hero', name: 'Fara', x: 50, y: 150 }, target],
  };
  queueCombatAttackImpactVfx(state, { heroUID: 1, attackVfxKind: 'split', actionName: 'Split', finalDmg: 20 }, target, 1);
  queueCombatAttackImpactVfx(state, { heroUID: 1, attackVfxKind: 'impact', actionName: 'Chain Strike II', finalDmg: 20 }, target, 1);
  assert.deepEqual(state.globals.CombatImpactVisuals.map(impact => impact.kind), ['g03_original', 'g04_original']);
  assert.deepEqual(state.globals.CombatImpactVisuals.map(impact => impact.impactScale), [0.82, 0.82]);
  renderCombatAttackVfx(ctx, {
    state,
    images: {
      CombatImpactG03Original: { id: 'g03-original', width: 307, height: 321 },
      CombatImpactG04Original: { id: 'g04-original', width: 306, height: 321 },
    },
    worldToCanvas: (x, y) => ({ x, y }),
    layoutScale: 1,
  });
  assert.deepEqual(draws, ['g03-original', 'g04-original']);
});

test('approved impact rasters stay within the shared painted-width limit', () => {
  const paintedWidthRatio = { g03_blue: 293 / 307, g03_purple: 297 / 307, g03_original: 275 / 307, g04_original: 290 / 306 };
  for (const [kind, scale] of Object.entries(APPROVED_IMPACT_DRAW_SCALE)) {
    assert.ok(62 * 1.12 * scale * paintedWidthRatio[kind] <= IMPACT_PAINTED_WIDTH_LIMIT, `${kind} exceeds the impact footprint`);
  }
  assert.ok(52 * (290 / 306) <= IMPACT_PAINTED_WIDTH_LIMIT, 'Spectral Orb G01 exceeds the impact footprint');
});

test('multi-target impacts use each enemy slot when runtime coordinates are implicit', () => {
  const enemies = [0, 1, 2].map(slotIndex => ({ uid: 10 + slotIndex, kind: 'enemy', slotIndex, maxHP: 100 }));
  const state = {
    globals: { time: 1, EnemyAreaY0: 100, EnemySize: 40, enemyGAP: 8 },
    entities: [{ uid: 1, kind: 'hero', name: 'Falie', x: 20, y: 100 }, ...enemies],
  };
  for (const enemy of enemies) queueCombatAttackImpactVfx(state, { heroUID: 1, attackVfxKind: 'impact', finalDmg: 10 }, enemy, 1);
  assert.deepEqual(state.globals.CombatImpactVisuals.map(impact => impact.y), [93.2, 141.2, 189.2]);
});

test('impact presentation extends the active actor handoff and records its owner', () => {
  const target = { uid: 10, kind: 'enemy', x: 250, y: 150, maxHP: 100 };
  const state = {
    globals: {
      time: 4,
      ActionInProgress: 1,
      ActionActorUID: 1,
      ActionLockUntil: 4.1,
      PendingHeroHits: [],
    },
    entities: [{ uid: 1, kind: 'hero', name: 'Runa', x: 60, y: 180 }, target],
  };

  queueCombatAttackImpactVfx(state, { heroUID: 1, attackVfxKind: 'runa_bolt', finalDmg: 20 }, target, 4);

  assert.equal(state.globals.CombatImpactVisuals[0].ownerUID, 1);
  assert.equal(state.globals.ActionLockUntil, 4.32);
  assert.equal(state.globals.DeferAdvance, 1);
  assert.equal(state.globals.AdvanceAfterAction, 1);
  assert.equal(state.globals.ActionOwnerUID, 1);
});

test('hero-target impacts mirror horizontally and use the opposite torso-side anchor', () => {
  const scales = [];
  const translations = [];
  const draws = [];
  const ctx = {
    save() {}, restore() {},
    translate(x, y) { translations.push([x, y]); },
    scale(x, y) { scales.push([x, y]); },
    drawImage(image, x, y, width, height) { draws.push({ image: image.id, x, y, width, height }); },
    set globalAlpha(value) {},
  };
  const hero = { uid: 1, kind: 'hero', name: 'Fara', x: 50, y: 150, maxHP: 100 };
  const enemy = { uid: 10, kind: 'enemy', name: 'Gobloc', x: 250, y: 150 };
  const state = { globals: {
    time: 1,
    PendingHeroHits: [],
    HeroRestFeetPosByUID: { 1: { x: 50, y: 175 } },
    HeroRenderHeightByUID: { 1: 50 },
  }, entities: [hero, enemy] };

  queueCombatAttackImpactVfx(state, { actorUID: 10, attackVfxKind: 'impact', finalDmg: 20 }, hero, 1);

  assert.equal(state.globals.CombatImpactVisuals[0].mirrorX, true);
  assert.equal(state.globals.CombatImpactVisuals[0].targetKind, 'hero');
  assert.equal(state.globals.CombatImpactVisuals[0].x, 51.6);
  renderCombatAttackVfx(ctx, {
    state,
    images: { CombatHitFlare: { id: 'melee', width: 192, height: 192 } },
    worldToCanvas: (x, y) => ({ x, y }),
    layoutScale: 1,
  });
  assert.deepEqual(translations, [[51.6, 143.2]]);
  assert.deepEqual(scales, [[-1, 1]]);
  assert.equal(draws[0].image, 'melee');
});

test('weak hero-target impacts remain on the rendered sprite midpoint', () => {
  const hero = { uid: 1, kind: 'hero', name: 'Fara', x: 50, y: 150, maxHP: 100 };
  const enemy = { uid: 10, kind: 'enemy', name: 'Gobloc', x: 250, y: 150 };
  const state = { globals: {
    time: 1,
    PendingHeroHits: [],
    HeroRestFeetPosByUID: { 1: { x: 50, y: 175 } },
    HeroRenderHeightByUID: { 1: 50 },
  }, entities: [hero, enemy] };

  queueCombatAttackImpactVfx(state, { actorUID: 10, attackVfxKind: 'impact', finalDmg: 3 }, hero, 1);

  assert.equal(state.globals.CombatImpactVisuals[0].weak, true);
  assert.equal(state.globals.CombatImpactVisuals[0].x, 51.6);
  assert.equal(state.globals.CombatImpactVisuals[0].y, 150);
});

test('transparent raster VFX assets are loaded', () => {
  assert.doesNotMatch(loader, /splash-candidates\/(?:guide|guide-v2)\//, 'runtime must never load cropped guide tiles');
  for (const [key, name] of [
    ['CombatHitFlare', 'vfx_hit_flare.png'],
    ['CombatWeakGlanceRing', 'vfx_weak_glance_ring.png'],
    ['CombatImpactBlue', 'vfx_impact_blue.png'],
    ['CombatImpactPurple', 'vfx_impact_purple.png'],
    ['CombatImpactRose', 'vfx_impact_rose.png'],
    ['CombatImpactG01Blue', 'vfx_impact_g01_blue.png'],
    ['CombatImpactG03Blue', 'vfx_impact_g03_blue.png'],
    ['CombatImpactG03Purple', 'vfx_impact_g03_purple.png'],
    ['CombatImpactG03Original', 'vfx_impact_g03_original.png'],
    ['CombatImpactG04Original', 'vfx_impact_g04_original.png'],
    ['CombatSplitSlash', 'vfx_split_slash.png'],
    ['CombatRunaBolt', 'vfx_runa_bolt.png'],
    ['CombatKajaOrb', 'vfx_kaja_orb.png'],
    ['CombatDjinnRain', 'vfx_djinn_rain.png'],
    ['CombatMaridCrescent', 'vfx_marid_crescent.png'],
    ['CombatChimerilassEruption', 'vfx_chimerilass_eruption.png'],
    ['CombatScatheCrackle', 'vfx_scathe_crackle.png'],
    ['CombatSweepCrescent', 'vfx_sweep_crescent.png'],
    ['CombatWipeWash', 'vfx_wipe_wash.png'],
    ['CombatMagicAoeBrushfire', 'vfx_magic_aoe_brushfire.png'],
    ['CombatDrainBuffOrb', 'vfx_drain_buff_orb.png'],
    ['CombatGrowSpectralHands', 'vfx_grow_spectral_hands.png'],
    ['CombatVenomSigil', 'vfx_venom_sigil.png'],
    ['CombatGlassReprisal', 'vfx_glass_reprisal.png'],
    ['SkillArcanePulse', 'vfx_arcane_pulse_crescent.png'],
    ['CombatArcanePulseImpact', 'vfx_arcane_pulse_impact.png'],
    ['CombatHealSwirl', 'vfx_heal_swirl_10.png'],
    ['CombatHealBurst', 'vfx_heal_burst_4.png'],
  ]) {
    assert.match(loader, new RegExp(`${key}.*${name}`));
    const png = fs.readFileSync(path.join(root, 'web-runner/assets/images', name));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png[25], 6, `${name} must retain RGBA transparency`);
    if (name === 'vfx_heal_swirl_10.png') assert.equal(png.readUInt32BE(16), png.readUInt32BE(20) * 10);
    if (name === 'vfx_heal_burst_4.png') assert.equal(png.readUInt32BE(16), png.readUInt32BE(20) * 4);
  }
  assert.doesNotMatch(loader, /CombatHeal(?:Bloom|Sigil|Fountain|Motes)|CombatGroupHealRain|vfx_(?:heal_(?!swirl_10|burst_4)|group_heal_)/);
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
    CombatImpactG03Blue: { id: 'g03-blue', width: 307, height: 321 },
    CombatImpactG03Purple: { id: 'g03-purple', width: 307, height: 321 },
    CombatDjinnRain: { id: 'djinn', width: 128, height: 192 },
    CombatScatheCrackle: { id: 'scathe', width: 128, height: 192 },
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
      EnemyAction: { active: true, uid: 12, targetUID: 1, skillId: 'Enemy_Scathe', state: 'LUNGE', visualProgress: 0.6, timer: 0.1 },
    },
    entities: [
      { uid: 1, kind: 'hero', name: 'Runa' }, { uid: 2, kind: 'hero', name: 'Kaja' },
      { uid: 10, kind: 'enemy', x: 250, y: 150 }, { uid: 11, kind: 'enemy', x: 250, y: 210 },
      { uid: 12, kind: 'enemy', name: 'Djinn', x: 250, y: 250, stats: { ATK: 6, MAG: 28 } },
    ],
  };
  queueCombatAttackImpactVfx(state, state.globals.PendingHeroHits[0], state.entities[2], 1);
  renderCombatAttackVfx(ctx, { state, images, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });
  assert.deepEqual(new Set(draws.map(image => image.id)), new Set(['runa', 'kaja', 'split', 'g03-blue', 'scathe']));
});

test('named enemy skills override basic magic without painting attack VFX over heals', () => {
  const draws = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {},
    drawImage(image) { draws.push(image.id); },
    set globalAlpha(value) {},
  };
  const images = {
    CombatScatheCrackle: { id: 'scathe', width: 128, height: 192 },
    CombatSweepCrescent: { id: 'sweep', width: 192, height: 128 },
    CombatWipeWash: { id: 'wipe', width: 160, height: 192 },
    CombatMagicAoeBrushfire: { id: 'aoe-fire', width: 256, height: 128 },
    CombatDrainBuffOrb: { id: 'drain', width: 160, height: 160 },
  };
  const state = {
    globals: { time: 1, EnemySize: 40, PendingHeroHits: [], HeroRestBasePosByUID: { 1: { x: 60, y: 180 } } },
    entities: [
      { uid: 1, kind: 'hero', name: 'Fara', hp: 40 },
      { uid: 12, kind: 'enemy', name: 'Djinn', x: 250, y: 130, hp: 20, stats: { ATK: 6, MAG: 28 } },
      { uid: 13, kind: 'enemy', name: 'Marid', x: 250, y: 190, hp: 20, stats: { ATK: 8, MAG: 22 } },
      { uid: 14, kind: 'enemy', name: 'Chimerilass', x: 250, y: 250, hp: 20, stats: { ATK: 8, MAG: 26 } },
    ],
  };
  for (const [uid, skillId] of [[12, 'Enemy_Scathe'], [13, 'Enemy_Sweep'], [14, 'Enemy_Wipe'], [14, 'Enemy_MAG_AOE'], [14, 'Enemy_Drain_Buff'], [14, 'Enemy_Heal_Allies']]) {
    state.globals.EnemyAction = { active: true, uid, targetUID: 1, skillId, state: 'LUNGE', visualProgress: 0.6, timer: 0.1 };
    renderCombatAttackVfx(ctx, { state, images, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });
  }
  assert.deepEqual(draws, ['scathe', 'sweep', 'wipe', 'aoe-fire', 'drain']);
});

test('Arcane Pulse stages illustrated charge, travel, and matching contact', () => {
  const draws = [];
  const scales = [];
  const translations = [];
  const ctx = {
    save() {}, restore() {}, translate(x, y) { translations.push([x, y]); }, rotate() {}, scale(x, y) { scales.push([x, y]); },
    drawImage(image, x, y, width) { draws.push({ id: image.id, x, width }); },
    set globalAlpha(value) {},
  };
  const images = {
    SkillArcanePulse: { id: 'pulse' },
    CombatArcanePulseImpact: { id: 'pulse-impact' },
  };
  const state = {
    globals: {
      time: 1.2,
      PendingHeroHits: [],
      ArcanePulseVisuals: [{ startAt: 1, impactAt: 1.4, sourceX: 50, sourceY: 150, targetX: 250, targetY: 150 }],
    },
    entities: [],
  };
  renderCombatAttackVfx(ctx, { state, images, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });
  assert.ok(draws.filter(draw => draw.id === 'pulse').length >= 2, 'travel includes the illustrated front and its residue');
  assert.ok(scales.every(([x, y]) => x === -1 && y === 1), 'the crescent artwork faces its rightward travel direction');
  const travelScaleCount = scales.length;
  state.globals.time = 1.5;
  renderCombatAttackVfx(ctx, { state, images, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });
  assert.ok(draws.some(draw => draw.id === 'pulse-impact'));
  assert.ok(scales.length > travelScaleCount, 'the contact flare flips to splash back from the target');
  assert.deepEqual(scales.at(-1), [-1, 1]);
  const contact = draws.find(draw => draw.id === 'pulse-impact');
  assert.ok(Math.abs(contact.x + contact.width * ((406 + 1378) / (2 * 1536))) < 1e-9, 'painted impact center sits on the target anchor');
  assert.deepEqual(translations.at(-1), [248.4, 150], 'contact stays just inside the torso side facing the attacker');
  const impactsBeforeLingerCheck = draws.filter(draw => draw.id === 'pulse-impact').length;
  state.globals.time = 1.85;
  renderCombatAttackVfx(ctx, { state, images, worldToCanvas: (x, y) => ({ x, y }), layoutScale: 1 });
  assert.ok(draws.filter(draw => draw.id === 'pulse-impact').length > impactsBeforeLingerCheck, 'contact remains readable for nearly half a second');
  for (const source of [runtimeBank, scriptsBank]) {
    assert.match(source, /const PARTY_ARCANE_PULSE_TRAVEL_SEC = 0\.34;/);
    assert.match(source, /impactAt = startAt \+ PARTY_ARCANE_PULSE_TRAVEL_SEC/);
  }
});

test('Spectral Orb spins the drain orb counter-clockwise in flight, then uses the approved G01 blue impact', () => {
  const draws = [];
  const scales = [];
  const rotations = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate(value) { rotations.push(value); }, scale(x, y) { scales.push([x, y]); },
    drawImage(image, x, y, width) { draws.push({ id: image.id, width }); },
    set globalAlpha(value) {},
  };
  const state = {
    globals: {
      time: 1.2,
      PendingHeroHits: [],
      ArcanePulseVisuals: [{ skillId: 'session_spectral_orb', startAt: 1, impactAt: 1.4, sourceX: 50, sourceY: 150, targetX: 250, targetY: 150 }],
    },
    entities: [],
  };
  renderCombatAttackVfx(ctx, {
    state,
    images: {
      CombatDrainBuffOrb: { id: 'drain-orb', width: 160, height: 160 },
      CombatImpactG01Blue: { id: 'g01-blue', width: 306, height: 321 },
    },
    worldToCanvas: (x, y) => ({ x, y }),
    layoutScale: 1,
  });
  assert.deepEqual(draws.map(draw => draw.id), ['drain-orb']);
  assert.ok(rotations[0] < 0, 'orb rotates counter-clockwise during travel');
  draws.length = 0;
  rotations.length = 0;
  state.globals.time = 1.5;
  renderCombatAttackVfx(ctx, {
    state,
    images: {
      CombatDrainBuffOrb: { id: 'drain-orb', width: 160, height: 160 },
      CombatImpactG01Blue: { id: 'g01-blue', width: 306, height: 321 },
    },
    worldToCanvas: (x, y) => ({ x, y }),
    layoutScale: 1,
  });
  assert.deepEqual(draws.map(draw => draw.id), ['g01-blue']);
  assert.ok(draws[0].width <= 52);
  assert.deepEqual(scales, []);
  assert.match(heroCommands, /skillId:'session_spectral_orb'[\s\S]{0,220}shape:'crescent_arc_blast'/);
  assert.match(qaHooks, /combatImpacts:[\s\S]{0,320}targetUID:/);
});

test('Grow raises illustrated spectral hands from each affected hero', () => {
  const draws = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {},
    drawImage(image) { draws.push(image.id); },
    set globalAlpha(value) {},
  };
  const state = {
    globals: {
      time: 1.25,
      EnemySize: 40,
      PendingHeroHits: [],
      HeroRestBasePosByUID: { 1: { x: 60, y: 180 } },
      PowerAmpVisualByUID: { 1: { source: 'party_grow', startAt: 1 } },
    },
    entities: [{ uid: 1, kind: 'hero', name: 'Fara', hp: 40 }],
  };
  renderCombatAttackVfx(ctx, {
    state,
    images: { CombatGrowSpectralHands: { id: 'grow', width: 160, height: 192 } },
    worldToCanvas: (x, y) => ({ x, y }),
    layoutScale: 1,
  });
  assert.deepEqual(draws, ['grow']);
});

test('session Venom and Glass Reprisal emit their illustrated sequences', () => {
  assert.match(heroCommands, /kind:'venom_sigil'/);
  assert.match(heroCommands, /kind:'glass_reprisal'/);
  assert.match(runtimeState, /SessionBuffCombatVisuals: \[\]/);
  assert.match(sessionReset, /SessionBuffCombatVisuals: \[\]/);
  const draws = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {},
    drawImage(image, ...args) { draws.push({ id: image.id, args }); },
    set globalAlpha(value) {},
  };
  const state = {
    globals: {
      time: 1.3,
      EnemySize: 40,
      PendingHeroHits: [],
      HeroRestBasePosByUID: { 1: { x: 60, y: 180 } },
      SessionBuffCombatVisuals: [
        { kind: 'venom_sigil', sourceUID: 1, targetUID: 10, startAt: 1 },
        { kind: 'glass_reprisal', sourceUID: 1, targetUID: 10, startAt: 1 },
      ],
    },
    entities: [
      { uid: 1, kind: 'hero', name: 'Fara', hp: 40 },
      { uid: 10, kind: 'enemy', name: 'Gobloc', x: 250, y: 160, hp: 20 },
    ],
  };
  renderCombatAttackVfx(ctx, {
    state,
    images: {
      CombatVenomSigil: { id: 'venom', width: 160, height: 128 },
      CombatGlassReprisal: { id: 'reprisal', width: 192, height: 96 },
      CombatImpactBlue: { id: 'blue-impact', width: 96, height: 64 },
    },
    worldToCanvas: (x, y) => ({ x, y }),
    layoutScale: 1,
  });
  assert.deepEqual(new Set(draws.map(draw => draw.id)), new Set(['venom', 'reprisal', 'blue-impact']));
  const venom = draws.find(draw => draw.id === 'venom');
  assert.ok(Math.abs(venom.args[5] + venom.args[7] - 180) < 1e-9, 'Venom reveals upward from the enemy feet');
});

test('enemy damage wiring queues a typed hero impact after the shipping skill call', () => {
  assert.match(renderer, /const heroHpBefore = new Map/);
  assert.match(renderer, /ApplyEnemySkill[\s\S]*heroHpBefore\.get\(hero\.uid\)[\s\S]*queueCombatAttackImpactVfx/);
  assert.match(renderer, /enemyAction\.skillId === 'Enemy_MAG_AOE' \? 'rose'/);
  assert.match(renderer, /enemyUsesRangedMagic \? enemy\.originX/);
});
