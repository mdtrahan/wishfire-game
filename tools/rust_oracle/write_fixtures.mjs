#!/usr/bin/env node
// JS oracle for the Rust translation: runs the real rule modules on representative inputs and
// writes fixtures that rust/wf_meta tests assert against. Deterministic; no browser globals.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewSeededRng } from '../../web-runner/src/core/seededRngRules.mjs';
import { computeCombatPower } from '../../web-runner/src/core/combatPower.mjs';
import { scaleRoutineEnemy } from '../../web-runner/src/core/routineEnemyScaling.mjs';
import { authorSubwaves, bindAuthoredSubwaves } from '../../web-runner/src/core/continuousCombatSubwaves.mjs';
import { WFM_ENEMY_DEFINITIONS, SHADOW_DEFINITIONS, projectShadowStats } from '../../src/core/combatShadowAdapter.mjs';
import { SLICE_FLOOR, SLICE_ORIGIN, SLICE_TRAVEL_SLOTS, sliceHeroPosition, slicePackPosition } from '../../web-runner/systems/rustCombatArena.mjs';
import { createCombatBridge } from '../../web-runner/src/core/combatBridge.mjs';
import { createWfmCombatConfig, wfmHeroPermanentInputs } from '../../web-runner/systems/wfmCombatConfig.mjs';
import { createRustCombatRuntime } from '../../web-runner/systems/rustCombatRuntime.mjs';
import { createQuestCombatSession } from '../../web-runner/systems/questCombatSession.mjs';
import { createCombatHostClock } from '../../web-runner/systems/combatHostClock.mjs';
import { settleContinuousCombatRewards } from '../../web-runner/modules/heroCommands.mjs';
import { newHeroProgress, refreshHeroStats, createHeroProgressStore, expToNextLevel, levelStats, attachHeroProgress, awardHeroEXP, setHeroProgressLevel } from '../../web-runner/src/core/heroProgression.mjs';
import { fillGearMaxHpGrowth } from '../../web-runner/src/core/heroMaxHpPolicy.mjs';
import { heroSpecialCooldown } from '../../web-runner/src/core/heroSpecialCooldown.mjs';
import { pathToFileURL } from 'node:url';
// heroProgressStorage.js is CommonJS-typed under Node: load its ESM source through a data URL with absolute imports.
const heroProgressStorage = await (async () => {
  const file = new URL('../../web-runner/systems/heroProgressStorage.js', import.meta.url);
  const source = fs.readFileSync(file, 'utf8').replace(/from '([^']+)'/g, (_, p) => `from '${new URL(p, pathToFileURL(fileURLToPath(file))).href}'`);
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
})();
const { persistHeroProgressIfDirty, restoreHeroProgressFromStorage, HERO_PROGRESS_SAVE_KEY } = heroProgressStorage;
import { HERO_DEFINITIONS } from '../../web-runner/src/core/heroDefinitions.mjs';
import { heroStarSkillMultipliers } from '../../web-runner/src/core/heroGrowthRules.mjs';
import { permanentHeroModifiers } from '../../web-runner/src/core/heroPermanentModifiers.mjs';
import { configureContinuousCombatProduction, buildContinuousCombatSpawnPlan, activateContinuousCombatSpawnedEnemy, createContinuousCombatStageState, getContinuousCombatStage, getContinuousCombatPartyCP, advanceContinuousCombatStage, resetContinuousCombatAfterDefeat, continuousCombatWaveClearEventId, buildChapterOneSubwaveStages, deriveContinuousCombatWavePackProgress } from '../../web-runner/src/core/continuousCombatStage.mjs';
import { deriveCombatWorldBounds, deriveCombatWorldVerticalBounds, deriveCombatOrdinaryPatrolBounds, deriveCombatWorldStartFormation, deriveCombatArenaBounds } from '../../src/core/combatOrientation.mjs';
import { deriveContinuousCombatSpawnMoat, placeContinuousCombatHeroesInRecoveryHuddle } from '../../web-runner/src/core/arenaCombat.mjs';
// combatSessionInitializer.js is CommonJS-typed under Node; these four helpers are copied verbatim.
function normalizeBiomeTags(input) {
  if (Array.isArray(input)) { const tags = input.map(v => String(v || '').trim().toLowerCase()).filter(Boolean); return tags.length ? tags : ['all']; }
  const raw = String(input ?? '').trim();
  if (!raw) return ['all'];
  if (raw.startsWith('[') && raw.endsWith(']')) { try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return normalizeBiomeTags(parsed); } catch (_) {} }
  const tags = raw.split('|').flatMap(part => String(part).split(',')).map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
  return tags.length ? tags : ['all'];
}
function normalizeEnemyRole(input) { const role = String(input || '').trim().toLowerCase(); return role === 'commander' || role === 'bodyguard' || role === 'fodder' ? role : 'fodder'; }
function normalizeFaction(input) { const faction = String(input || '').trim().toLowerCase(); return faction === 'wishless' || faction === 'dreamless' || faction === 'hopeless' ? faction : 'wishless'; }
function resolveEnemyEncounterCombatPower(row) { return computeCombatPower({ ...row, maxHP: row?.HP ?? row?.maxHP, stats: row?.stats || row }); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'tests/fixtures/rust-oracle');
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => { const json = JSON.stringify(value); fs.writeFileSync(path.join(out, name), (json.length > 60000 ? json : JSON.stringify(value, null, 1)) + '\n'); };

// --- enemy rows exactly as initEntities maps them (routine level 1 in the continuous loop) ---
const table = JSON.parse(fs.readFileSync(path.join(root, 'web-runner/assets/enemies.json')));
function parseC2ArrayTable(c2) {
  const cols = c2.data, rows = cols[0].length, headers = cols.map(col => (col[0] ? String(col[0][0]) : ''));
  const items = [];
  for (let y = 1; y < rows; y++) { const item = {}; for (let x = 0; x < cols.length; x++) item[headers[x]] = cols[x][y] ? cols[x][y][0] : ''; if (item.name) items.push(item); }
  return items;
}
const rawRows = parseC2ArrayTable(table);
const enemyData = rawRows.map(rawRow => { const row = scaleRoutineEnemy(rawRow, 1); return { ...row,
  faction: normalizeFaction(row?.faction), enemyRole: normalizeEnemyRole(row?.enemyRole || row?.role),
  locale: String(row?.locale || row?.biome || row?.biomes || 'all').trim().toLowerCase() || 'all',
  biome: String(row?.biome || row?.biomes || 'all').trim().toLowerCase() || 'all',
  biomeTags: normalizeBiomeTags(row?.biomes || row?.biome || 'all'),
  localeTags: normalizeBiomeTags(row?.localeTags || row?.locale_tags || row?.locale || row?.biomes || row?.biome || 'all'),
  CombatPower: resolveEnemyEncounterCombatPower(row) }; });
write('enemy_rows.json', { raw: rawRows, mapped: enemyData });

// --- seeded rng ---
const rng = [];
for (const seed of [1, 7, 42, 7969171, 4294967295, 0, 2654435761]) for (const draws of [0, 1, 2, 3, 10, 100, 1000, 4095, 65536, 1892, 4096]) rng.push({ seed, draws, value: previewSeededRng(seed, draws) });
write('seeded_rng.json', rng);

// --- heroes ---
function party({ level = 1, hp = 1, equipment = null } = {}) {
  return ['Falie', 'Huun', 'Runa', 'Kojonn'].map((name, i) => {
    const actor = { ...newHeroProgress(name, `${name.toLowerCase()}#1`), uid: i + 1, kind: 'hero', x: 1020 + i * 36, y: 350, isAlive: true, heroDisplaySlot: i, heroIndex: i };
    actor.currentLevel = level; if (equipment) actor.equipmentStats = { ...equipment[i] }; refreshHeroStats(actor); actor.hp = actor.maxHP * hp;
    return actor;
  });
}
const heroCases = [];
for (const level of [1, 2, 5, 7, 20, 50, 100]) for (const h of party({ level })) heroCases.push({ key: h.baseHeroName, level, levelStats: levelStats(h), maxHP: h.maxHP, stats: h.stats, expToNext: expToNextLevel(level), cp: computeCombatPower(h) });
const geared = party({ level: 7, equipment: [{ ATK: 5, HP: 12 }, { DEF: 3, MAG: 1 }, { MAG: 9, RES: 2, HP: 4 }, { RES: 6, SPD: 1 }] });
for (const h of geared) heroCases.push({ key: h.baseHeroName, level: 7, equipmentStats: h.equipmentStats, levelStats: levelStats(h), maxHP: h.maxHP, stats: h.stats, cp: computeCombatPower(h) });
write('hero_levels.json', { definitions: Object.fromEntries(Object.entries(HERO_DEFINITIONS).map(([k, d]) => [k, { name: d.name, baseStats: d.baseStats, growth: d.growth, baseAttackInterval: d.baseAttackInterval }])), cases: heroCases });

// --- combat power on rows and ad-hoc actors ---
const cpCases = [];
for (const row of enemyData) cpCases.push({ input: { ...row }, cp: computeCombatPower(row) });
for (const row of rawRows) cpCases.push({ input: { ...row, maxHP: row.HP, stats: row }, cp: resolveEnemyEncounterCombatPower(row) });
for (const [atk, def, hp] of [[18, 20, 42], [22, 10, 35], [1, 1, 1], [0, 0, 0], [100, 50, 999]]) cpCases.push({ input: { ATK: atk, DEF: def, HP: hp }, legacy: [atk, def, hp], cp: computeCombatPower(atk, def, hp) });
write('combat_power.json', cpCases);

// --- geometry constants the stage code derives ---
write('geometry.json', { world: deriveCombatWorldBounds(), vertical: deriveCombatWorldVerticalBounds(), patrol: deriveCombatOrdinaryPatrolBounds(), formation4: deriveCombatWorldStartFormation(4), formation0: deriveCombatWorldStartFormation(0), arena: deriveCombatArenaBounds(), moat: deriveContinuousCombatSpawnMoat(),
  slice: { floor: SLICE_FLOOR, origin: SLICE_ORIGIN, travelSlots: SLICE_TRAVEL_SLOTS, heroPositions: [0, 1, 2, 3].map(sliceHeroPosition) },
  packPositions: [[0, 0], [100, 300], [1080, 420], [2160, 600], [540, 290], [1500, 500]].map(([x, y]) => ({ x, y, ordinary: slicePackPosition({ x, y }, false), boss: slicePackPosition({ x, y }, true) })) });

// --- spawn plans + activation + subwaves ---
function spawnPlanCase(seed, { region = 1, wave = 1, transitions = wave - 1, clearedPackMask = 0, boss = false, partyCP = 0, enemySize = 40 }) {
  const state = { ...createContinuousCombatStageState(seed, { region }), wave, transitions, clearedPackMask, ...(boss ? { bossActive: true, bossAvailable: true, bossArmed: true, bossWorldX: 1340 } : {}) };
  const plan = buildContinuousCombatSpawnPlan(enemyData, state, { partyCP, enemySize });
  const g = { ContinuousCombatStage: { ...state, spawnedPackMask: plan.reduce((m, p) => m | 1 << p.sectorIndex, 0) }, EnemySize: enemySize, time: 0, NextUID: 90, EnemySlots: [], EnemyIDs: [] };
  const spawned = plan.map(entry => {
    const row = { ...entry.row, enemyRole: boss ? 'boss' : String(entry.row.enemyRole || entry.row.role || 'fodder') };
    g.NextUID = (g.NextUID || 1) + 1;
    const actor = { uid: g.NextUID, kind: 'enemy', name: row.name, hp: Number(row.HP ?? 0), maxHP: Number(row.HP ?? row.maxHP ?? 0), stats: { ATK: Number(row.ATK ?? 0), DEF: Number(row.DEF ?? 0), MAG: Number(row.MAG ?? 0), RES: Number(row.RES ?? 0), SPD: Number(row.SPD ?? 0) }, enemyRole: String(row.enemyRole || 'fodder'), combatTier: String(row.combatTier || 'routine'), slotIndex: entry.slotIndex, x: 0, y: 0 };
    activateContinuousCombatSpawnedEnemy(g, actor, { ...entry, bossX: boss ? 1340 : undefined });
    return actor;
  });
  const stage = getContinuousCombatStage(state);
  return { seed, state, stage: { id: stage.id, kind: stage.kind, enemyNames: stage.enemyNames, wave: stage.wave }, partyCP, enemySize,
    plan: plan.map(e => ({ name: e.row.name, row: { HP: e.row.HP, ATK: e.row.ATK, DEF: e.row.DEF, MAG: e.row.MAG, RES: e.row.RES, SPD: e.row.SPD, maxHP: e.row.maxHP, CombatPower: e.row.CombatPower, streamCpScale: e.row.streamCpScale, combatTier: e.row.combatTier }, lane: e.lane, rank: e.rank, packIndex: e.packIndex, entryOrder: e.entryOrder, sectorIndex: e.sectorIndex, slotIndex: e.slotIndex, sectorSize: e.sectorSize, isSolo: !!e.isSolo, soloFootX: e.soloFootX ?? null, soloFootY: e.soloFootY ?? null })),
    spawned: spawned.map(a => ({ uid: a.uid, name: a.name, x: a.x, y: a.y, streamWalkSpeed: a.streamWalkSpeed, streamSectorIndex: a.streamSectorIndex, streamEngagementGroupId: a.streamEngagementGroupId, streamDelivery: a.streamDelivery, streamSolo: a.streamSolo, streamSoloPhase: a.streamSoloPhase ?? null, streamEngageX: a.streamEngageX, combatRank: a.combatRank, slicePosition: slicePackPosition({ x: a.x, y: a.y }, a.name === 'Troll') })),
    subwaves: boss ? null : authorSubwaves(plan.map(e => e.row.name)) };
}
const plans = [];
for (const seed of [7, 1, 42, 7969171]) {
  for (let wave = 1; wave <= 10; wave++) plans.push(spawnPlanCase(seed, { wave, partyCP: wave === 1 ? 0 : 120 + wave * 30 }));
  plans.push(spawnPlanCase(seed, { wave: 3, clearedPackMask: 0b010101, partyCP: 200 }));
  plans.push(spawnPlanCase(seed, { wave: 10, boss: true, transitions: 10 }));
  plans.push(spawnPlanCase(seed, { region: 2, wave: 4, partyCP: 900 }));
  plans.push(spawnPlanCase(seed, { region: 5, wave: 2, partyCP: 500 }));
}
write('spawn_plans.json', plans);
write('subwaves.json', { chapterOne: [7, 1].map(seed => ({ seed, partyCP: 120, stages: buildChapterOneSubwaveStages(enemyData, { seed, partyCP: 120 }) })),
  author: [['Gobloc'], ['Gobloc', 'Skeleton', 'Gobloc'], Array(7).fill('Orc'), ['Gobloc', 'Gobloc', 'Skeleton', 'Skeleton', 'Lizardo', 'Lizardo', 'Orc', 'Gobloc', 'Skeleton', 'Gobloc', 'Orc', 'Lizardo'], Array(13).fill('Gobloc').map((n, i) => i % 3 ? n : 'Skeleton')].map(keys => ({ keys, subwaves: authorSubwaves(keys) })) });

// --- stage transitions ---
const transitions = [];
{
  let state = createContinuousCombatStageState(7);
  for (let i = 0; i < 12; i++) { const next = advanceContinuousCombatStage(state); transitions.push({ before: state, after: next.state, stageId: next.stage.id, clearedBoss: next.clearedBoss ?? null, eventId: continuousCombatWaveClearEventId(state) }); state = next.state; if (state.bossAvailable && !state.bossActive) state = { ...state, bossActive: true, bossArmed: true }; }
  for (const s of [createContinuousCombatStageState(7), { ...createContinuousCombatStageState(7), wave: 10, clearedPackMask: 63 }, { ...createContinuousCombatStageState(7), bossAvailable: true, bossActive: true, transitions: 10 }, { ...createContinuousCombatStageState(7, { region: 5 }), wave: 5, clearedPackMask: 21 }]) {
    const g = { ContinuousCombatStage: { ...s }, time: 12.5, HeroProgress: {} };
    resetContinuousCombatAfterDefeat(g);
    transitions.push({ defeat: s, after: g.ContinuousCombatStage });
  }
}
write('stage_transitions.json', transitions);

// --- WFM config ---
function wfmConfigCase({ seed, level, hp, training, stars, equipment, boss = false, mask = 0 }) {
  const heroes = party({ level, hp, equipment });
  const store = createHeroProgressStore();
  for (const h of heroes) attachHeroProgress(h, store);
  for (const h of heroes) { h.currentLevel = level; if (equipment) h.equipmentStats = { ...equipment[heroes.indexOf(h)] }; refreshHeroStats(h); h.hp = h.maxHP * hp; }
  const g = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: { ...createContinuousCombatStateState(seed, mask, boss) }, time: 0, EnemyData: enemyData, EnemySlots: [], EnemyIDs: [], NextUID: 90, HeroProgress: store,
    PartyTrainingLevels: training || null, HeroGrowth: stars ? { stars } : null };
  const plan = buildContinuousCombatSpawnPlan(enemyData, g.ContinuousCombatStage, { partyCP: getContinuousCombatPartyCP(heroes) });
  const entities = [...heroes];
  for (const entry of plan) {
    const row = { ...entry.row, enemyRole: boss ? 'boss' : 'fodder' };
    g.NextUID = (g.NextUID || 1) + 1;
    const a = { uid: g.NextUID, kind: 'enemy', name: row.name, stats: { ATK: Number(row.ATK ?? 0), DEF: Number(row.DEF ?? 0), MAG: Number(row.MAG ?? 0), RES: Number(row.RES ?? 0), SPD: Number(row.SPD ?? 0) }, enemyRole: row.enemyRole, combatTier: row.combatTier, slotIndex: entry.slotIndex, hp: row.HP, maxHP: row.HP, x: 0, y: 0 };
    activateContinuousCombatSpawnedEnemy(g, a, entry); entities.push(a);
  }
  const config = createWfmCombatConfig({ globals: g, entities, enemyRows: rawRows, encounterId: `oracle:${seed}` });
  return { seed, level, hp, training, stars, equipment, boss, mask, partyCP: getContinuousCombatPartyCP(heroes), heroes: heroes.map(h => ({ key: h.heroInstanceKey, hp: h.hp, maxHP: h.maxHP, stats: h.stats, combatBaseMaxHP: h.combatBaseMaxHP, permanent: wfmHeroPermanentInputs(g, h) })), config };
}
function createContinuousCombatStateState(seed, mask, boss) { return { ...createContinuousCombatStageState(seed), clearedPackMask: mask, ...(boss ? { bossActive: true, bossAvailable: true, bossArmed: true, wave: 1, transitions: 10 } : {}), nextEmissionAt: 3 }; }
const configs = [
  wfmConfigCase({ seed: 7, level: 1, hp: 1 }),
  wfmConfigCase({ seed: 7, level: 1, hp: 0.5, mask: 0b010101 }),
  wfmConfigCase({ seed: 42, level: 7, hp: 0.8, training: { ATK: 3, DEF: 1, MATK: 2, RES: 0 }, stars: { Falie: 2, Huun: 4, Runa: 1, Kojonn: 8 }, equipment: [{ ATK: 5, HP: 12 }, { DEF: 3, MAG: 1 }, { MAG: 9, RES: 2, HP: 4 }, { RES: 6, SPD: 1 }] }),
  wfmConfigCase({ seed: 7, level: 20, hp: 1, boss: true }),
  wfmConfigCase({ seed: 1, level: 100, hp: 1 }),
];
write('wfm_config.json', { definitions: { enemies: WFM_ENEMY_DEFINITIONS, shadows: SHADOW_DEFINITIONS }, growth: [0, 1, 2, 4, 8].map(stars => ({ stars, multipliers: heroStarSkillMultipliers({ stars: { Falie: stars } }, 'Falie') })),
  modifiers: [{ training: { ATK: 3, DEF: 1, MATK: 2, RES: 0 }, stars: { Falie: 4 } }, { training: null, stars: null }].map(({ training, stars }) => ({ training, stars, modifiers: permanentHeroModifiers({ PartyTrainingLevels: training, HeroGrowth: stars ? { stars } : null }, party({ level: 3 })[0]) })),
  projection: rawRows.map(row => ({ name: row.name, stats: projectShadowStats({ ...scaleRoutineEnemy(row, 1), HP: scaleRoutineEnemy(row, 1).HP }, row, WFM_ENEMY_DEFINITIONS[row.name]) })), cases: configs });

// --- headless trace of the real JS runtime: the combat gate for the Rust host ---
const wasm = new WebAssembly.Module(fs.readFileSync(path.join(root, 'web-runner/assets/simulation_core.wasm')));
// [op, repeat] pairs without acks (every op is acked): the op sequence is tens of thousands of entries per long case.
function runLength(ops) { const out = []; for (const op of ops) { if (out.length && out[out.length - 1][0] === op) out[out.length - 1][1] += 1; else out.push([op, 1]); } return out; }
function trace({ seed = 7, ticks = 2400, level = 1, hp = 1, sampleEvery = 30 } = {}) {
  const real = createCombatBridge(new WebAssembly.Instance(wasm));
  const calls = [];
  const bridge = { ...real };
  for (const op of ['create', 'step', 'spawn', 'waveChest', 'ordinaryClear', 'end', 'ack', 'destroy']) bridge[op] = (...args) => { const result = real[op](...args); calls.push({ op, hash: result?.snapshot?.gameplay_hash ?? null, step: result?.snapshot?.step ?? null, live: result?.snapshot?.live_enemies ?? null, state: result?.snapshot?.state ?? null }); return result; };
  const heroes = party({ level, hp });
  const g = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: { ...createContinuousCombatStageState(seed), nextEmissionAt: 3 }, time: 0, CombatSessionId: 'oracle', GamePhase: 'RUNTIME', EnemyData: enemyData, EnemySlots: [], EnemyIDs: [], NextUID: 90, HeroProgress: createHeroProgressStore(),
    ProgressionBattle: { id: 'oracle-battle', participants: heroes.map(h => h.heroInstanceKey), defeated: {}, defeatedGold: {}, persistPendingRewards() {} } };
  const state = { globals: g, entities: [...heroes] };
  const spawnLog = [], transitions = [];
  function call(name, ...args) {
    if (name === 'SpawnEnemy') {
      const [row, slotIndex] = args;
      g.NextUID = (g.NextUID || 1) + 1;
      const actor = { uid: g.NextUID, kind: 'enemy', name: row.name, stats: { ATK: Number(row.ATK ?? 0), DEF: Number(row.DEF ?? 0), MAG: Number(row.MAG ?? 0), RES: Number(row.RES ?? 0), SPD: Number(row.SPD ?? 0) }, enemyRole: row.enemyRole, combatTier: row.combatTier, slotIndex, hp: row.HP, maxHP: row.HP, x: 0, y: 0 };
      state.entities.push(actor); g.EnemySlots[slotIndex] = actor.uid + 1; g.EnemyIDs[slotIndex] = actor.uid;
      spawnLog.push({ time: g.time, uid: actor.uid, name: actor.name, slotIndex });
      return actor;
    }
    if (name === 'SettleContinuousCombatRewards') return settleContinuousCombatRewards({ state });
  }
  const plan = buildContinuousCombatSpawnPlan(enemyData, g.ContinuousCombatStage, { partyCP: getContinuousCombatPartyCP(heroes) });
  g.ContinuousCombatStage.spawnedPackMask = plan.reduce((m, p) => m | 1 << p.sectorIndex, 0);
  for (const entry of plan) activateContinuousCombatSpawnedEnemy(g, call('SpawnEnemy', { ...entry.row, enemyRole: 'fodder' }, entry.slotIndex), entry);
  // finalizeContinuousCombatProduction: the opening wave counts as spawned so pack progress records.
  g.ContinuousCombatStage.spawnSerial = plan.length;
  const session = createQuestCombatSession({ state, gameState: {}, call, sync() {} });
  const clock = createCombatHostClock({ isBagProgressBlocked: () => false });
  const runtime = createRustCombatRuntime({ persistCheckpoint: () => true, state, bridge, session, call, persistProgress: () => true, getEnemyRows: () => rawRows, advanceHostTime: clock.advanceHostTime, warn(...a) { throw new Error(a.join(' ')); } });
  let frame = 0;
  const samples = [];
  // The boss entry wipe gates on Date.now(); pin it to the frame clock so the headless run is deterministic (Rust uses now_ms for both).
  const realNow = Date.now;
  let nowMs = 0;
  Date.now = () => nowMs;
  try {
  for (let n = 0; n < ticks; n++) {
    const before = g.ContinuousCombatStage;
    nowMs = frame++ * 1000 / 30;
    const moved = runtime.tick({ globals: g, entities: state.entities, call, nowMs, onBossTimeout: () => session.surrenderBossAttempt('boss_timeout') });
    if (moved) transitions.push({ tick: n, from: { wave: before.wave, transitions: before.transitions, bossActive: before.bossActive }, to: { wave: g.ContinuousCombatStage.wave, transitions: g.ContinuousCombatStage.transitions, bossActive: g.ContinuousCombatStage.bossActive }, time: g.time, heroes: heroes.map(h => [h.hp, h.maxHP]) });
    if (g.RustCombatError) throw new Error(g.RustCombatError);
    const read = runtime.read();
    if (n % sampleEvery === 0 || moved) samples.push({ tick: n, time: g.time, step: read.snapshot?.step ?? null, hash: read.snapshot?.gameplay_hash ?? null, live: read.snapshot?.live_enemies ?? null, state: read.snapshot?.state ?? null, wave: g.ContinuousCombatStage.wave, clearedPackMask: g.ContinuousCombatStage.clearedPackMask, heroes: heroes.map(h => [h.hp, h.maxHP]) });
  }
  } finally { Date.now = realNow; }
  const checkpoint = g.ContinuousCombatStage.combatCheckpoint;
  runtime.dispose();
  // The real save envelope at this point (heroProgressStorage.persistHeroProgressIfDirty).
  const storage = fakeStorage();
  g.HeroProgressDirty = true;
  persistHeroProgressIfDirty({ stateGlobals: g });
  if (ticks === 2400 || level === 7 && ticks === 17500) traceSaves[`trace-seed${seed}-lvl${level}-${ticks}`] = JSON.parse(storage.map.get(HERO_PROGRESS_SAVE_KEY));
  return { seed, level, hp, ticks, gold: g.goldTotal ?? 0, bossTimeout: g.ContinuousCombatStage.lastBossTimeout ?? null, checkpoint: checkpoint && { subwaves: checkpoint.subwaves, generation: checkpoint.generation }, spawnLog, transitions, calls: runLength(calls.map(c => c.op).filter(op => op !== 'ack')), samples };
}
const traceSaves = {};
function fakeStorage() {
  const map = new Map();
  globalThis.window = { localStorage: { map, getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), get length() { return map.size; }, key: i => [...map.keys()][i] ?? null } };
  return globalThis.window.localStorage;
}
// The long cases run through all ten Chapter 1 waves into the boss: level 1 times out and recovers, level 7 clears it.
write('stage_trace.json', [trace({ seed: 7, ticks: 2400 }), trace({ seed: 42, ticks: 900, level: 7, hp: 0.5 }), trace({ seed: 7, ticks: 17500 }), trace({ seed: 42, ticks: 17500, level: 7 })]);
console.log('wrote', fs.readdirSync(out).join(' '));

// ---- hero progression (ORKA-63bf.5) ----
function heroProgressFixture() {
  const award = [];
  for (const level of [1, 3, 99, 100]) for (const key of ['Falie', 'Runa']) for (const hpFrac of [1, 0.3, 0]) for (const amount of [0, 50, 100, 250, 5000, 1e6, -5, 12.7, NaN]) {
    const hero = newHeroProgress(key, key.toLowerCase() + '#1');
    hero.currentLevel = level; if (level === 3) hero.equipmentStats = { ATK: 3, HP: 10 };
    refreshHeroStats(hero); hero.hp = Math.floor(hero.maxHP * hpFrac); hero.currentEXP = 40;
    const before = structuredClone(hero); const result = awardHeroEXP(hero, amount);
    award.push({ before, amount: Number.isNaN(amount) ? 'NaN' : amount, result, after: structuredClone(hero) });
  }
  const checkpoint = { version: 1, id: 'cp-s1-7', generation: 3, rewardLineage: 'battle:s1', contentVersion: 'wfm-slice-v1', abiVersion: 65536 };
  const storeInputs = {
    fresh: undefined,
    empty: {},
    wrongVersion: { version: 1, heroes: { Falie: { name: 'Falie', currentLevel: 9 } } },
    sanitized: { version: 2, heroes: {
      'falie#1': { baseHeroName: 'Fara', currentLevel: 2.7, currentEXP: '12', hp: 999, lampEXPClaimed: 30, equipmentStats: { ATK: 3, HP: 10, SPD: -1, MAG: 1.5, LUCK: 4 } },
      'bogus#1': { name: 'Nobody', currentLevel: 3 },
      Runa: { name: 'Runa', currentLevel: 500, currentEXP: 10, hp: -5 },
      'huun#1': { baseHeroName: 'Huun', currentLevel: 0, currentEXP: -3, hp: 'x', lampEXPClaimed: -2, equipmentStats: 'none' },
      'kojonn#1': { baseHeroName: 'Kojonn', currentLevel: 100, currentEXP: 77, hp: 12 } },
      settledBattles: [...Array(120).keys()].map(i => 'b' + i).concat([5, null, 'last']),
      pendingBattleRewards: { id: 'battle:x', participants: ['falie#1', 7, 'runa#1'], defeated: { 12: 0, 13: -1, 14: 'abc', 15: '2' }, defeatedGold: { 12: 3, 16: 2.5 } },
      pendingGoldSettlements: { a: 5, b: -1, c: 'q', d: 0 },
      settledTicketSpends: ['t1', 't2', 't1', 3, 't3'],
      pendingBagKillRewards: { 'enemy:x:1': 5, 'enemy:x:2': 1, 'enemy:x:3': 2, '': 5, 'enemy:x:4': '5' },
      combatRewardOutbox: { version: 1, streams: { 'rust:cp:1': { sequence: '9', step: '30', recent: { 9: 'died' }, pending: [{ sequence: '9', battleId: 'battle:s1', id: 'enemy:battle:s1:12', amount: 5, enemy: { kind: 'enemy', uid: 12, enemyRole: 'boss' } }] } }, activeEncounter: 'rust:cp:1' },
      continuousStage: { topologyVersion: 2, region: 3, stage: 1, wave: 4, bossAvailable: false, bossSummonRequired: 'yes', clearedBosses: 2, clearedPackMask: 9, bossUID: 44 },
      junk: 1 },
    pendingSettled: { version: 2, heroes: {}, settledBattles: ['battle:y'], pendingBattleRewards: { id: 'battle:y', participants: ['falie#1'], defeated: { 3: 0 }, defeatedGold: { 3: 4 } } },
    legacy: { version: 2, heroes: {}, continuousStage: { region: 2, stage: 3, wave: 2, bossAvailable: true, clearedBosses: 1, clearedPackMask: 5, bossUID: 9 } },
    legacyBadWave: { version: 2, heroes: {}, continuousStage: { region: 2, stage: 3, wave: 5, bossAvailable: true, clearedBosses: 1 } },
    legacyWithCheckpoint: { version: 2, heroes: {}, continuousStage: { region: 2, stage: 3, wave: 2, bossAvailable: true, clearedBosses: 1, seed: 7, transitions: 2, combatCheckpoint: checkpoint } },
    withCheckpoint: { version: 2, heroes: {}, continuousStage: { topologyVersion: 2, region: 1, stage: 1, wave: 6, bossAvailable: false, bossSummonRequired: false, clearedBosses: 0, clearedPackMask: 70, seed: 7, transitions: 41, combatCheckpoint: { ...checkpoint, subwaves: { position: '7:1:1:6:41', index: 3, partyCP: 311, entryPackMask: 2 } } } },
    badTopology: { version: 2, heroes: {}, continuousStage: { topologyVersion: 2, region: 1, stage: 1, wave: 99, bossAvailable: false, clearedBosses: 0, seed: 7, transitions: 0, combatCheckpoint: checkpoint } },
    badTopologyVersion: { version: 2, heroes: {}, continuousStage: { topologyVersion: 3, region: 1, stage: 1, wave: 1, bossAvailable: false, clearedBosses: 0 } },
    badCheckpointVersion: { version: 2, heroes: {}, continuousStage: { topologyVersion: 2, region: 1, stage: 1, wave: 1, bossAvailable: false, clearedBosses: 0, seed: 7, transitions: 0, combatCheckpoint: { ...checkpoint, version: 2 } } },
    badContentVersion: { version: 2, heroes: {}, continuousStage: { topologyVersion: 2, region: 1, stage: 1, wave: 1, bossAvailable: false, clearedBosses: 0, seed: 7, transitions: 0, combatCheckpoint: { ...checkpoint, contentVersion: 'old' } } },
    badSeed: { version: 2, heroes: {}, continuousStage: { topologyVersion: 2, region: 1, stage: 1, wave: 1, bossAvailable: false, clearedBosses: 0, seed: 0, transitions: 0, combatCheckpoint: checkpoint } },
    badSubwaves: { version: 2, heroes: {}, continuousStage: { topologyVersion: 2, region: 1, stage: 1, wave: 1, bossAvailable: false, clearedBosses: 0, seed: 7, transitions: 0, combatCheckpoint: { ...checkpoint, subwaves: { position: 'p', index: 42, partyCP: 1, entryPackMask: 0 } } } },
    nullCheckpoint: { version: 2, heroes: {}, continuousStage: { topologyVersion: 2, region: 1, stage: 1, wave: 1, bossAvailable: false, clearedBosses: 0, combatCheckpoint: null } },
    badOutbox: { version: 2, heroes: {}, combatRewardOutbox: { version: 2 } },
    badOutboxRow: { version: 2, heroes: {}, combatRewardOutbox: { version: 1, streams: { a: { sequence: '3', step: '1', recent: {}, pending: [{ sequence: '4', battleId: 'b', id: 'enemy:b:1', amount: 0, enemy: { kind: 'enemy', uid: 1, enemyRole: 'ordinary' } }] } } } },
    noStage: { version: 2, heroes: {}, continuousStage: { region: 'x' } },
    ...traceSaves,
  };
  const stores = Object.entries(storeInputs).map(([name, input]) => {
    try { return { name, input: input ?? null, output: createHeroProgressStore(input) }; }
    catch (error) { return { name, input: input ?? null, error: String(error.message) }; }
  });
  const presets = [[7, 0], [100, 250], [1, 0]].map(([level, partyEXP]) => { const store = createHeroProgressStore(storeInputs.sanitized); setHeroProgressLevel(store, level, partyEXP); return { level, partyEXP, heroes: store.heroes }; });
  const fill = [[10, 50, 60], [0, 50, 60], [55, 60, 50], [12.9, 10.2, 20.7], [-3, 5, 9]].map(([hp, before, after]) => ({ hp, before, after, result: fillGearMaxHpGrowth(hp, before, after) }));
  const cooldowns = [];
  for (const key of Object.keys(HERO_DEFINITIONS)) for (let stars = 0; stars <= 8; stars++) cooldowns.push({ key, stars, seconds: heroSpecialCooldown({ baseHeroName: key, heroInstanceKey: `${key.toLowerCase()}#1` }, { stars: { [key]: stars } }) });
  // restoreHeroProgressFromStorage on a save: receipts settle, pending battle rewards recover, participants re-save.
  const restores = Object.entries(storeInputs).filter(([name]) => ['sanitized', 'pendingSettled', 'withCheckpoint'].includes(name) || name.startsWith('trace-')).map(([name, saved]) => {
    const storage = fakeStorage(); storage.setItem(HERO_PROGRESS_SAVE_KEY, JSON.stringify(saved));
    const heroes = party();
    // app.js order: the store restores at boot, combat entry configures the stage from it and restores again.
    const g = { ContinuousCombatStageLoop: 1, EncounterSeed: 7 };
    const fnContext = { state: { globals: g, entities: heroes } };
    restoreHeroProgressFromStorage({ fnContext });
    configureContinuousCombatProduction(g, { productionPath: true });
    restoreHeroProgressFromStorage({ fnContext });
    const st = g.ContinuousCombatStage;
    return { name, error: g.HeroProgressStorageError ?? null, store: g.HeroProgress, stage: { region: st.region, stage: st.stage, wave: st.wave, bossAvailable: !!st.bossAvailable, bossSummonRequired: !!st.bossSummonRequired, clearedBosses: st.clearedBosses, bossUID: st.bossUID ?? null, clearedPackMask: st.clearedPackMask, seed: st.seed, transitions: st.transitions }, saved: storage.map.has(HERO_PROGRESS_SAVE_KEY) ? JSON.parse(storage.map.get(HERO_PROGRESS_SAVE_KEY)) : null, goldTotal: g.goldTotal ?? 0, pendingGold: g.PendingGoldSettlements ?? {}, wfmReload: !!g.WfmCheckpointReload,
      heroes: heroes.map(h => ({ key: h.heroInstanceKey, level: h.currentLevel, hp: h.hp, maxHP: h.maxHP, exp: h.currentEXP })) };
  });
  return { award, stores, presets, fill, cooldowns, restores };
}
write('hero_progress.json', heroProgressFixture());
