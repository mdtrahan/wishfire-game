// bd-ORKA-6i3: StoneAge-style leader-anchored movement and camera.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceContinuousCombatArena, selectHeroMovementTarget } from '../web-runner/src/core/arenaCombat.mjs';
import { advanceCombatCamera, resolveCombatCameraCenterX } from '../web-runner/src/core/combatCamera.mjs';
import {
  COMBAT_MOVEMENT_TUNING_FIELDS,
  COMBAT_MOVEMENT_TUNING_STORAGE_KEY,
  LEGACY_COMBAT_MOVEMENT_TUNING,
  defaultCombatMovementTuning,
  resolveCombatLeader,
  sanitizeCombatMovementTuning,
} from '../web-runner/src/core/combatMovementTuning.mjs';
import { loadCombatMovementTuning } from '../web-runner/systems/devMovementTuningPanel.mjs';

const hero = (uid, name, footX, footY, extra = {}) => ({ uid, name, kind: 'hero', hp: 100, attackType: uid <= 2 ? 'physical' : 'magic', footX, footY, ...extra });
const enemy = (uid, footX, footY, extra = {}) => ({ uid, kind: 'enemy', hp: 100, footX, footY, streamState: 'in_range', streamSectorIndex: 0, streamDelivery: 'melee', ...extra });
const gap = (a, b) => Math.hypot(a.footX - b.footX, a.footY - b.footY);

test('tuning sanitizes every slider into its range and keeps a named leader', () => {
  const wild = Object.fromEntries(COMBAT_MOVEMENT_TUNING_FIELDS.map(field => [field.key, field.max * 10 + 5]));
  const clamped = sanitizeCombatMovementTuning({ ...wild, leaderName: 'nobody' });
  for (const field of COMBAT_MOVEMENT_TUNING_FIELDS) assert.ok(clamped[field.key] <= field.max && clamped[field.key] >= field.min, field.key);
  assert.equal(clamped.leaderName, 'Fara');
  assert.equal(sanitizeCombatMovementTuning({ leaderName: 'runa' }).leaderName, 'Runa');
  assert.deepEqual(sanitizeCombatMovementTuning(null), defaultCombatMovementTuning());
  assert.equal(sanitizeCombatMovementTuning(LEGACY_COMBAT_MOVEMENT_TUNING).leaderTargetBias, 1);
});

test('the chosen leader leads while living and the first living hero takes over otherwise', () => {
  const party = [hero(1, 'Hondo', 0, 0), hero(2, 'Falie', 0, 0), hero(3, 'Runa', 0, 0)];
  assert.equal(resolveCombatLeader(party, 'Fara').uid, 2, 'canonical alias resolves');
  party[1].hp = 0;
  assert.equal(resolveCombatLeader(party, 'Fara').uid, 1, 'KO leader falls back to party order');
  assert.equal(resolveCombatLeader([], 'Fara'), null);
});

test('leader-target bias spans own-nearest to the legacy shared target', () => {
  const near = enemy(10, 100, 0), shared = enemy(11, 200, 0);
  const actor = hero(1, 'Hondo', 0, 0);
  assert.equal(selectHeroMovementTarget({ ...actor }, [near, shared], shared, 0).uid, 10);
  assert.equal(selectHeroMovementTarget({ ...actor }, [near, shared], shared, 1).uid, 11);
  assert.equal(selectHeroMovementTarget({ ...actor }, [near, shared], shared, 0.6).uid, 11, 'strong bias halves the shared distance');
  assert.equal(selectHeroMovementTarget({ ...actor, arenaTargetUID: 11 }, [enemy(10, 190, 0), shared], shared, 0).uid, 11, 'hysteresis keeps a near-equal current target');
});

const splitScene = tuning => {
  const heroes = [hero(1, 'Fara', 900, 300), hero(2, 'Hondo', 900, 420), hero(3, 'Runa', 860, 300), hero(4, 'Kaja', 860, 420)];
  const enemies = [enemy(10, 1000, 295), enemy(11, 1000, 430)];
  const globals = { time: 1, DevMovementTuning: tuning, ContinuousCombatStage: {} };
  for (let tick = 0; tick < 20; tick += 1) {
    globals.time = 1 + tick / 10;
    advanceContinuousCombatArena({ globals, entities: [...heroes, ...enemies], seconds: 0.1 });
  }
  return heroes;
};

test('heroes split across nearby enemies by default and dog-pile under the legacy toggle', () => {
  assert.ok(new Set(splitScene({ leaderTargetBias: 0.35 }).map(h => h.arenaTargetUID)).size >= 2, 'independent targets');
  assert.equal(new Set(splitScene(LEGACY_COMBAT_MOVEMENT_TUNING).map(h => h.arenaTargetUID)).size, 1, 'legacy shared target');
});

test('heroes may stack on one target while hero-enemy spacing stays whole', () => {
  const heroes = [1, 2, 3, 4].map(uid => hero(uid, ['Fara', 'Hondo', 'Runa', 'Kaja'][uid - 1], 906, 340));
  const target = enemy(10, 975, 340);
  const globals = { time: 1, DevMovementTuning: { heroOverlap: 0 }, ContinuousCombatStage: {} };
  advanceContinuousCombatArena({ globals, entities: [...heroes, target], seconds: 0.1 });
  assert.ok(heroes.some((a, i) => heroes.some((b, j) => j > i && gap(a, b) < 20)), 'two heroes share nearly one footprint');
  assert.ok(heroes.every(h => gap(h, target) >= 35.9), 'no hero overlaps the enemy footprint');
});

test('boss encounters keep full hero spacing along the front edge', () => {
  const heroes = [hero(1, 'Fara', 400, 230), hero(2, 'Hondo', 400, 250), hero(3, 'Runa', 400, 270), hero(4, 'Kaja', 400, 290)];
  const boss = { uid: 90, name: 'Troll', kind: 'enemy', combatRank: 'boss', hp: 5000, streamState: 'roaming', streamSectorIndex: 0, streamDelivery: 'melee', streamWalkSpeed: 40, footX: 660, footY: 260 };
  const globals = { time: 0, DevMovementTuning: { heroOverlap: 0 }, ContinuousCombatStage: { bossActive: true, bossWorldX: 660 } };
  for (let tick = 0; tick < 200; tick += 1) { globals.time = tick / 10; advanceContinuousCombatArena({ globals, entities: [...heroes, boss], seconds: 0.1 }); }
  for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) assert.ok(gap(heroes[i], heroes[j]) >= 35.9, `${heroes[i].name}/${heroes[j].name}`);
});

test('a hero beyond the combat leash walks back toward the leader', () => {
  const heroes = [hero(1, 'Fara', 900, 340), hero(2, 'Hondo', 1200, 340)];
  const foe = enemy(10, 960, 340);
  const globals = { time: 1, DevMovementTuning: { combatLeash: 100 }, ContinuousCombatStage: {} };
  const before = gap(heroes[1], heroes[0]);
  for (let tick = 0; tick < 5; tick += 1) advanceContinuousCombatArena({ globals, entities: [...heroes, foe], seconds: 0.1 });
  assert.ok(gap(heroes[1], heroes[0]) < before, 'leashed hero closes on the leader');
});

const cameraScene = (overrides = {}) => {
  const heroes = [hero(1, 'Fara', 1000, 340), hero(2, 'Hondo', 1200, 340), hero(3, 'Runa', 1200, 300), hero(4, 'Kaja', 1200, 380)];
  const globals = { time: 0, ContinuousCombatStageLoop: 1, DevMovementTuning: { cameraSmoothing: 0, cameraDeadZone: 0, ...overrides } };
  return { heroes, globals };
};

test('camera centres the leader, not the party centroid', () => {
  const { heroes, globals } = cameraScene();
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(resolveCombatCameraCenterX(globals, 1150), 1000);
  globals.DevMovementTuning.leaderName = 'Hondo';
  globals.DevMovementTuning.leaderOverride = true;
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(resolveCombatCameraCenterX(globals, 1150), 1200, 'leader choice moves the camera');
  globals.DevMovementTuning.leaderAnchor = 0;
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(resolveCombatCameraCenterX(globals, 0), 1150, 'centroid toggle restores the legacy anchor');
});

test('camera holds inside the dead zone and eases toward the leader outside it', () => {
  const { heroes, globals } = cameraScene({ cameraDeadZone: 30, cameraSmoothing: 0.25 });
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  heroes[0].footX = 1020;
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(globals.CombatCamera.x, 1000, 'small leader motion inside the dead zone holds framing');
  heroes[0].footX = 1200;
  let previous = globals.CombatCamera.x;
  for (let tick = 0; tick < 30; tick += 1) {
    globals.time += 0.1;
    advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
    assert.ok(globals.CombatCamera.x >= previous, 'monotone ease');
    previous = globals.CombatCamera.x;
  }
  assert.ok(Math.abs(globals.CombatCamera.x - 1170) < 2, 'settles one dead zone behind the leader');
});

test('a non-leader cast pulls the camera toward the caster, returns, and respects the cooldown', () => {
  const { heroes, globals } = cameraScene({ skillFocus: 0.5, skillFocusHold: 1, skillFocusCooldown: 5 });
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  Object.assign(heroes[2], { actionState: 'cast', actionStateStartedAt: 0 });
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(globals.CombatCamera.x, 1100, 'half-way toward Runa');
  globals.time = 1.5;
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(globals.CombatCamera.x, 1000, 'returns to the leader after the hold');
  Object.assign(heroes[3], { actionState: 'cast', actionStateStartedAt: 1.5 });
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(globals.CombatCamera.x, 1000, 'cooldown suppresses the next pull');
  Object.assign(heroes[0], { actionState: 'cast', actionStateStartedAt: 6 });
  globals.time = 6;
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(globals.CombatCamera.x, 1000, 'the leader casting needs no pan');
});

test('large jumps cut instead of sliding, and other combat modes keep the centroid', () => {
  const { heroes, globals } = cameraScene({ cameraSmoothing: 0.5 });
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  heroes[0].footX = 1800;
  advanceCombatCamera({ globals, entities: heroes, seconds: 0.1 });
  assert.equal(globals.CombatCamera.x, 1800);
  globals.ContinuousCombatStageLoop = 0;
  assert.equal(resolveCombatCameraCenterX(globals, 777), 777);
});

test('dev tuning persists under its own dev key and ignores corrupt storage', () => {
  const store = new Map([[COMBAT_MOVEMENT_TUNING_STORAGE_KEY, JSON.stringify({ heroOverlap: 0.8, leaderName: 'Kaja' })]]);
  const storage = { getItem: key => store.get(key) ?? null };
  assert.equal(loadCombatMovementTuning(storage).heroOverlap, 0.8);
  assert.equal(loadCombatMovementTuning(storage).leaderName, 'Kaja');
  assert.equal(loadCombatMovementTuning(storage).leaderOverride, false, 'saves from before the flag never override Formation');
  store.set(COMBAT_MOVEMENT_TUNING_STORAGE_KEY, JSON.stringify({ leaderName: 'Kaja', leaderOverride: true }));
  assert.equal(loadCombatMovementTuning(storage).leaderOverride, true);
  store.set(COMBAT_MOVEMENT_TUNING_STORAGE_KEY, '{oops');
  assert.equal(loadCombatMovementTuning(storage), null);
  assert.equal(loadCombatMovementTuning(null), null);
});

test('stage tick advances the camera and both projections read the shared resolver', () => {
  const stage = readFileSync(new URL('../web-runner/src/core/continuousCombatStage.mjs', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');
  assert.match(stage, /advanceCombatCamera\(\{ globals, entities, seconds: arenaSeconds \}\)/);
  assert.match(renderer, /resolveCombatCameraCenterX\(state\.globals, squadCenterX\)/);
  assert.match(app, /resolveCombatCameraCenterX\(state\.globals, squadCenterX\)/);
});
