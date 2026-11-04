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
import { LAMP_CONFIG, LAMP_CAPACITY_TIERS, seededUnit, progressionOrdinal, generateLampItem, salvageValue, createLampEconomy, validateLampEconomy, migrateLampEconomy, migrateFourStatLamp, migrateDraftLamp, migrateLegacyEquipment, awardLampKillPoints, advanceLampCombatProgress, lampUpgradeProgress, upgradeLamp, restorePaidLampUpgrade, markLampGuide, lampReviewCandidates, lampGearCP, compareLampItem, lampStoredCount, lampCapacity } from '../../web-runner/src/core/lampGear.mjs';
import { validateConveyorState, conveyorReviewCandidates, classifyConveyorCache, emitConveyorItem, collectConveyorItem, equipConveyorItem, queueConveyorDisposal, planConveyorAutoEquip, conveyorDisposalPreview, dismantleConveyorItems } from '../../web-runner/src/core/lampConveyor.mjs';
import { equipmentStats, RARITIES } from '../../web-runner/src/core/equipment.mjs';
import { formatCompactCount } from '../../web-runner/src/core/formatCompactCount.mjs';
import { lampHeroRoster } from '../../web-runner/src/core/lampHeroRoster.mjs';
import { createEquipmentStorage, EQUIPMENT_SAVE_KEY } from '../../web-runner/systems/equipmentStorage.mjs';
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

// ---- lamp / bag economy (ORKA-63bf.8) ----
const attempt = fn => { try { return { ok: fn() }; } catch (error) { return { error: error.message }; } };
const attemptAsync = async fn => { try { return { ok: await fn() }; } catch (error) { return { error: error.message }; } };
async function lampFixture() {
  const tiers = LAMP_CAPACITY_TIERS.map(t => ({ capacity: t.capacity, cost: t.cost, rarityWeights: t.rarityWeights }));
  const units = [];
  for (const seed of [0, 7, 2467343298, 4294967295]) for (const sequence of [0, 1, 69, 1000]) for (const salt of [0, 1, 2, 6]) units.push({ seed, sequence, salt, value: seededUnit(seed, sequence, salt) });
  const ordinals = [[1, 1], [1, 2], [2, 1], [3, 10], [3, 11], [100, 1], [0, 0], [120, 5]].map(([region, stage]) => ({ region, stage, value: progressionOrdinal({ region, stage }) }));
  const items = [];
  for (const seed of [7, 2467343298]) for (const tier of [0, 50, 99]) for (const ordinal of [0, 37, 990]) for (let sequence = 0; sequence < 12; sequence++) items.push({ seed, tier, ordinal, sequence, item: generateLampItem(seed, sequence, ordinal, LAMP_CAPACITY_TIERS[tier].rarityWeights) });
  for (let sequence = 0; sequence < 8; sequence++) items.push({ seed: 42, tier: null, ordinal: 3, sequence, item: generateLampItem(42, sequence, 3) });
  const compact = [0, 5, 999, 1000, 1525, 9999, 111, 8400, 1e6, 2.5e9, 1e9, -3, 0.5].map(value => ({ value, text: formatCompactCount(value) }));
  const salvage = Object.keys(RARITIES).map(rarity => ({ rarity, value: salvageValue({ rarity }) }));
  const captured = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/lamp-auto-earned-69.json'), 'utf8'));
  const heroes = lampHeroRoster(captured.heroes);
  const economy69 = validateLampEconomy(structuredClone(captured.economy));
  const review = lampReviewCandidates(economy69, heroes).map(c => ({ id: c.item.instanceId, queue: c.queue, gains: c.gains, bestGain: c.bestGain, bestHeroId: c.bestHeroId }));
  const gearCP = economy69.items.map(i => ({ id: i.instanceId, cp: lampGearCP(i) }));
  const heroCP = heroes.map(h => ({ id: h.heroInstanceKey, level: h.currentLevel, cp: computeCombatPower(refreshHeroStats({ ...h, equipmentStats: equipmentStats(economy69.items, economy69.loadouts[h.heroInstanceKey] || {}) })) }));
  const compare = economy69.items.slice(0, 6).flatMap(i => heroes.map(h => { const c = compareLampItem(economy69, i, h.heroInstanceKey); return { id: i.instanceId, hero: h.heroInstanceKey, upgrade: c.upgrade, deltas: c.deltas, current: c.current?.instanceId ?? null }; }));
  const conveyorPlan = (() => { const { working, changes } = planConveyorAutoEquip(structuredClone(economy69), heroes); return { working, changes: changes.map(c => ({ heroId: c.heroId, item: c.item.instanceId })) }; })();
  const kp = createLampEconomy(5, 0); const kills = [];
  for (const [id, amount] of [['enemy:battle:s1:12', 5], ['enemy:battle:s1:12', 5], ['tick:battle:s1:1', 1], ['tick:battle:s1:3', 1], ['tick:battle:s1:2', 1], ['enemy:b2:7', 5], ['bad', 5], ['enemy:b:0', 1], ['tick:b:2', 3], ['tick:b:02', 1], ['enemy:b2:9', 5]]) kills.push({ id, amount, out: attempt(() => awardLampKillPoints(kp, id, amount)), receipts: structuredClone(kp.settledBagKillRewards), killPoints: kp.lamp.killPoints });
  let clock = null; const ticks = [];
  for (const seconds of [4, 12, 30.5, 0, -1, 14.9999999999, 0.0000000002, 2]) { const r = advanceLampCombatProgress(clock, { battleId: 'battle:s1', seconds, data: kp, pending: { 'tick:battle:s1:9': 1 } }); clock = r.clock; ticks.push({ seconds, clock: r.clock, rewards: r.rewards }); }
  const maxed = createLampEconomy(5, 0); maxed.lamp.capacityTier = LAMP_CONFIG.lampLevels - 1;
  ticks.push({ seconds: 20, maxed: true, ...advanceLampCombatProgress(null, { battleId: 'battle:s1', seconds: 20, data: maxed, pending: {} }) });
  const up = createLampEconomy(9, 0); up.lamp.essence = 60; up.lamp.killPoints = 50;
  const upgrade = { before: lampUpgradeProgress(up), first: attempt(() => upgradeLamp(up, 0)), after: lampUpgradeProgress(up), state: structuredClone(up), stale: attempt(() => upgradeLamp(up, 0)), short: attempt(() => upgradeLamp(up, 1)) };
  const paid = createLampEconomy(3, 0); paid.lamp.upgradeStage = 2; paid.lamp.upgradeEndsAt = 0;
  const restore = { applied: restorePaidLampUpgrade(paid), state: structuredClone(paid), again: restorePaidLampUpgrade(paid) };
  const guide = structuredClone(economy69); const guideEmpty = createLampEconomy(1, 0);
  const guides = { storage: attempt(() => markLampGuide(guide, 'storage')), comparison: attempt(() => markLampGuide(guide, 'comparison')), preview: attempt(() => markLampGuide(guide, 'preview')), unknown: attempt(() => markLampGuide(guide, 'x')), empty: attempt(() => markLampGuide(guideEmpty, 'storage')), state: guide.lamp.guide };
  const created = createLampEconomy(42, 17);
  const withItem = structuredClone(created); withItem.items.push(generateLampItem(42, 0, 0)); withItem.lamp.pending.push('lamp:42:0'); withItem.lamp.sequence = 1;
  const twoItems = structuredClone(withItem); twoItems.items.push(generateLampItem(42, 1, 0)); twoItems.lamp.pending.push('lamp:42:1'); twoItems.lamp.sequence = 2;
  const validation = [
    ['fixture69', captured.economy], ['created', created], ['withItem', withItem],
    ['badGold', { ...created, gold: -1 }], ['badVersion', { ...created, version: 4 }], ['negativePartyEXP', { ...created, partyEXP: -1 }],
    ['dupItem', { ...withItem, items: [...withItem.items, withItem.items[0]] }],
    ['unassigned', { ...withItem, lamp: { ...withItem.lamp, pending: [] } }],
    ['wrongSlot', { ...withItem, lamp: { ...withItem.lamp, pending: [] }, loadouts: { Falie: { body: 'lamp:42:0' } } }],
    ['equipped', { ...withItem, lamp: { ...withItem.lamp, pending: [] }, loadouts: { Falie: { [withItem.items[0].type]: 'lamp:42:0' } } }],
    ['doubleAssigned', { ...withItem, loadouts: { Falie: { [withItem.items[0].type]: 'lamp:42:0' } } }],
    ['pendingUnknown', { ...created, lamp: { ...created.lamp, pending: ['nope'] } }],
    ['overCapacity', { ...created, lamp: { ...created.lamp, capacityTier: 0, pending: Array.from({ length: 21 }, (_, i) => 'x' + i) } }],
    ['badReceipts', { ...created, settledBagKillRewards: { 'enemy:a': [[3, 2]] } }], ['overlapReceipts', { ...created, settledBagKillRewards: { 'tick:a': [[1, 2], [3, 4]] } }], ['goodReceipts', { ...created, settledBagKillRewards: { 'tick:a': [[1, 2], [4, 5]], 'enemy:b': [[7, 7]] } }],
    ['badGuide', { ...created, lamp: { ...created.lamp, guide: 9 } }], ['badStage', { ...created, lamp: { ...created.lamp, upgradeStage: 5 } }],
    ['badStat', { ...withItem, items: [{ ...withItem.items[0], stats: { ...withItem.items[0].stats, SPD: 1 } }] }], ['missingStat', { ...withItem, items: [{ ...withItem.items[0], stats: { ATK: 1, DEF: 1, MAG: 1, RES: 1 } }] }],
    ['badRecent', { ...created, lamp: { ...created.lamp, recent: [{ instanceId: 'a', name: 'b', rarity: 'common', art: 9, level: 1 }] } }],
    ['extraKeys', { ...created, foo: 1, lamp: { ...created.lamp, bar: 2 }, migration: { legacyVersion: 1 } }],
    ['killPointsOdd', { ...created, lamp: { ...created.lamp, killPoints: -3 } }], ['killPointsMissing', { ...created, lamp: Object.fromEntries(Object.entries(created.lamp).filter(([k]) => k !== 'killPoints')) } ],
    ['protoLoadout', { ...created, loadouts: { __proto__x: {} , constructor: {} } }],
  ].map(([name, input]) => ({ name, input, ...attempt(() => validateLampEconomy(structuredClone(input))) }));
  const v4 = structuredClone(twoItems); v4.version = 4; delete v4.partyEXP; delete v4.lamp.capacityTier; delete v4.lamp.essence; v4.loadouts = { Falie: { [twoItems.items[0].type]: 'lamp:42:0' } }; v4.lamp.pending = ['lamp:42:1'];
  const v3 = structuredClone(v4); v3.version = 3; for (const i of v3.items) delete i.stats.HP;
  const v2 = structuredClone(v3); v2.version = 2; v2.items.forEach((i, n) => { if (n % 2) { i.stats.SPD = 2; delete i.stats.MAG; } else { delete i.sequence; } });
  const v1 = { version: 1, gold: 40, settledGoldRewards: ['g1', 7], market: { seed: 3, epoch: 1, lastSeen: 2 }, items: [{ instanceId: 'a', equipmentId: 'warden-helm' }, { instanceId: 'b', equipmentId: 'chain-mail' }, { instanceId: 'c', equipmentId: 'dawnbringer' }, { instanceId: 'd', equipmentId: 'trail-boots' }], loadouts: { Falie: { head: 'a', armor: 'b', weapon: 'c' }, Runa: { boots: 'd' } } };
  const migrations = [['v4', v4, migrateLampEconomy], ['v3', v3, migrateFourStatLamp], ['v2', v2, migrateDraftLamp], ['v1', v1, old => migrateLegacyEquipment(old, 77)],
    ['v1bad', { ...v1, items: [{ instanceId: 'a', equipmentId: 'nope' }] }, old => migrateLegacyEquipment(old, 77)], ['v1missing', { ...v1, loadouts: { Falie: { head: 'zz' } } }, old => migrateLegacyEquipment(old, 77)], ['v1slot', { ...v1, loadouts: { Falie: { head: 'b' } } }, old => migrateLegacyEquipment(old, 77)]]
    .map(([name, input, fn]) => ({ name, input, ...attempt(() => fn(structuredClone(input))) }));
  // conveyor script
  const roster = lampHeroRoster(createHeroProgressStore());
  const conv = validateConveyorState(createLampEconomy(11, 0)); const script = []; let t = 1000;
  const step = (name, fn) => { const result = attempt(fn); script.push({ name, t, result, state: structuredClone(conv) }); };
  step('emit', () => emitConveyorItem(conv, { region: 1, stage: 1 }, t));
  t = 1500; step('emitCooldown', () => emitConveyorItem(conv, { region: 1, stage: 1 }, t));
  t = 2000; step('collect', () => collectConveyorItem(conv, 'lamp:11:0', t));
  step('collectAgain', () => collectConveyorItem(conv, 'lamp:11:0', t));
  step('collectUnknown', () => collectConveyorItem(conv, 'lamp:11:9', t));
  step('classify', () => classifyConveyorCache(conv, roster).map(c => ({ id: c.item.instanceId, queue: c.queue, bestGain: c.bestGain, bestHeroId: c.bestHeroId })));
  for (let n = 1; n <= 21; n++) { t += 5000; step('emit' + n, () => emitConveyorItem(conv, { region: 2, stage: 3 }, t)); step('auto' + n, () => collectConveyorItem(conv, `lamp:11:${n}`, t, { automatic: true })); }
  step('expired', () => collectConveyorItem(conv, 'lamp:11:1', t + 40000));
  step('classify2', () => classifyConveyorCache(conv, roster).map(c => ({ id: c.item.instanceId, queue: c.queue, bestGain: c.bestGain, bestHeroId: c.bestHeroId })));
  t += 5000; step('emitFull', () => emitConveyorItem(conv, { region: 2, stage: 3 }, t));
  step('holdManual', () => collectConveyorItem(conv, 'lamp:11:22', t));
  t += 5000; step('emitFull2', () => emitConveyorItem(conv, { region: 2, stage: 3 }, t)); step('holdSecond', () => collectConveyorItem(conv, 'lamp:11:23', t));
  step('review', () => conveyorReviewCandidates(conv, roster).map(c => ({ id: c.item.instanceId, queue: c.queue, bestGain: c.bestGain, bestHeroId: c.bestHeroId })));
  step('equipHeld', () => { const c = conveyorReviewCandidates(conv, roster).find(c => c.queue === 'held'); if (!c.bestHeroId) throw new Error('held item not an upgrade: ' + c.bestGain); return equipConveyorItem(conv, c.bestHeroId, c.item.instanceId, roster.find(h => h.heroInstanceKey === c.bestHeroId)); });
  step('equipBad', () => equipConveyorItem(conv, 'Falie', 'lamp:11:2', roster.find(h => h.heroInstanceKey === 'Runa')));
  step('autoPlan', () => { const { working, changes } = planConveyorAutoEquip(conv, roster); Object.assign(conv, working); return changes.map(c => ({ heroId: c.heroId, item: c.item.instanceId })); });
  step('classify3', () => classifyConveyorCache(conv, roster).map(c => ({ id: c.item.instanceId, queue: c.queue, bestGain: c.bestGain })));
  step('queueDisposal', () => queueConveyorDisposal(conv, conv.lamp.discarded[0], roster));
  step('queueUseful', () => queueConveyorDisposal(conv, conv.lamp.pending[0] ?? 'lamp:11:0', roster));
  step('preview', () => conveyorDisposalPreview(conv, roster));
  step('previewUseful', () => conveyorDisposalPreview(conv, roster, [conv.lamp.pending[0] ?? 'lamp:11:0']));
  step('dismantle', () => dismantleConveyorItems(conv, conveyorDisposalPreview(conv, roster), roster));
  step('dismantleEmpty', () => dismantleConveyorItems(conv, conveyorDisposalPreview(conv, roster), roster));
  step('validateConveyor', () => validateConveyorState(structuredClone(conv)) && true);
  const conveyorInvalid = [['badEmission', { ...conv, lamp: { ...conv.lamp, emissions: [{ item: conv.items[0] ?? generateLampItem(11, 0, 0), issuedAt: 1, collected: 'x' }] } }], ['tooMany', { ...conv, lamp: { ...conv.lamp, emissions: Array.from({ length: 17 }, (_, i) => ({ item: generateLampItem(11, i, 0), issuedAt: 1, collected: false })) } }], ['holdOwned', { ...conv, lamp: { ...conv.lamp, reviewHold: { item: conv.items[0] ?? generateLampItem(11, 0, 0), disposal: false } } }], ['badRequested', { ...conv, lamp: { ...conv.lamp, disposalRequested: ['nope'] } }], ['nullHold', { ...conv, lamp: { ...conv.lamp, reviewHold: null } }]]
    .map(([name, input]) => ({ name, input, ...attempt(() => validateConveyorState(structuredClone(input))) }));
  // storage transaction script (equipmentStorage.mjs)
  const values = new Map(); let now = 1000;
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const locks = { request: (key, fn) => fn() };
  const globals = { goldTotal: 0, HeroProgress: createHeroProgressStore(), PendingGoldSettlements: { 'battle:s1': 12 }, ContinuousCombatStage: { region: 1, stage: 1 } };
  globals.HeroProgress.pendingBagKillRewards = { 'enemy:battle:s1:12': 5, 'tick:battle:s1:1': 1 };
  const store = createEquipmentStorage({ globals, storage, locks, seed: () => 42, now: () => now, reportError: () => {}, persistProgress: () => true });
  const steps = [];
  const snap = (name, result) => steps.push({ name, now, result: result === undefined ? null : result, save: JSON.parse(values.get(EQUIPMENT_SAVE_KEY) ?? 'null'), gold: globals.goldTotal, settledGold: globals.SettledGoldRewardReceipts ?? null, pendingGold: structuredClone(globals.PendingGoldSettlements), pendingKills: structuredClone(globals.HeroProgress.pendingBagKillRewards ?? null), dirty: !!globals.HeroProgressDirty,
    heroes: Object.fromEntries(Object.entries(globals.HeroProgress.heroes).map(([k, h]) => [k, { level: h.currentLevel, hp: h.hp, maxHP: h.maxHP, stats: h.stats, equipmentStats: h.equipmentStats ?? null, lampEXPClaimed: h.lampEXPClaimed, combatPower: h.combatPower ?? null }])) });
  snap('sync', await attemptAsync(() => store.sync()));
  for (let i = 0; i < 6; i++) { now += 5000; snap('tick' + i, await attemptAsync(() => store.tickConveyor({ region: 1, stage: 1 }))); }
  now += 1000; snap('tickEarly', await attemptAsync(() => store.tickConveyor({ region: 1, stage: 1 })));
  now += 4000; snap('tickDeferred', await attemptAsync(() => store.tickConveyor({ region: 1, stage: 2 }, () => true, { deferCollection: true })));
  const last = store.data.lamp.emissions.at(-1).item.instanceId; now += 1000; snap('collect', await attemptAsync(() => store.collect(last)));
  snap('collectAvailable', await attemptAsync(() => store.collectAvailable([last, 'lamp:42:0'])));
  snap('autoEquip', await attemptAsync(() => store.autoEquip()));
  snap('equipBad', await attemptAsync(() => store.equip('Falie', store.data.lamp.discarded[0] ?? 'lamp:42:0')));
  snap('queueDisposal', await attemptAsync(() => store.queueDisposal(store.data.lamp.discarded[0])));
  const preview = store.disposalPreview(); snap('dismantle', await attemptAsync(() => store.dismantle(preview)));
  globals.HeroProgress.pendingBagKillRewards = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['enemy:battle:s1:' + (40 + i), 5])); globals.goldTotal += 3; snap('sync2', await attemptAsync(() => store.sync()));
  snap('upgrade', await attemptAsync(() => store.upgrade()));
  snap('upgradeStale', await attemptAsync(() => store.upgrade(0)));
  snap('essence', await attemptAsync(() => store.awardCombatEssence('cot:1', 7))); snap('essenceDup', await attemptAsync(() => store.awardCombatEssence('cot:1', 7)));
  snap('guide', await attemptAsync(() => store.markGuide('preview')));
  snap('finishReview', await attemptAsync(() => store.finishReview()));
  return { tiers, units, ordinals, items, compact, salvage, fixture69: { economy: captured.economy, heroes: captured.heroes, normalized: economy69, review, gearCP, heroCP, compare, conveyorPlan }, kills, ticks, upgrade, restore, guides, validation, migrations, conveyor: { roster: roster.map(h => h.heroInstanceKey), script, invalid: conveyorInvalid }, storage: steps };
}
write('lamp.json', await lampFixture());
