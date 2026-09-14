#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { levelStats } from '../web-runner/src/core/heroProgression.mjs';
import { computeCombatPower } from '../web-runner/src/core/combatPower.mjs';
import { calculateDamageFromJs } from '../src/core/calculateDamageRules.mjs';
import { resolveHeroSpeedMultiattack } from '../src/core/dynamicInitiativeRules.mjs';
import { resolveHeroAttackTarget } from '../src/core/heroAttackTargetingRules.mjs';
import { resolveEnemyTargetHero } from '../src/core/enemyTargetingRules.mjs';
import { resolveRoleFlowAward } from '../web-runner/src/core/personalFlow.mjs';
import { ROUTINE_ENEMY_TEMPLATE, scaleRoutineEnemy } from '../web-runner/src/core/routineEnemyScaling.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'output', 'balance');
const levels = [1,2,3,4,5,6,7,8,9,91,92,93,94,95,96,97,98,99];
const pairs = [[1,9],[9,1],[91,99],[99,91]];
const seeds = 256;
const productionSeeds = Object.freeze({ 1:256, 5:32, 9:32, 91:32, 99:32 });
const tiers = [
  { id:'routine', ...ROUTINE_ENEMY_TEMPLATE, targetPreference:'frontline', minWin:.97, burst:.07, maxActions:45 },
  { id:'hard', HP:62, ATK:4, DEF:5, MAG:4, RES:5, SPD:8, targetPreference:'highest_atk', minWin:.85, burst:.10, maxActions:65 },
  { id:'elite', HP:85, ATK:5, DEF:7, MAG:5, RES:7, SPD:9, targetPreference:'low_hp', minWin:.70, burst:.12, maxActions:90 },
  { id:'boss', HP:130, ATK:6, DEF:9, MAG:6, RES:9, SPD:10, targetPreference:'highest_atk', minWin:.60, burst:.18, maxActions:120 },
];
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const integer = value => Math.max(1, Math.floor(number(value)));
function rng(seed) { let state = (seed >>> 0) || 1; return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296); }
function heroStats(definition, level) { return Object.fromEntries(Object.entries(definition.baseStats).map(([key, base]) => [key, integer(base + number(definition.growth[key]) * (level - 1))])); }
function enemyStats(template, level) { const scale = 1 + (level - 1) * .06; return Object.fromEntries(['HP','ATK','DEF','MAG','RES','SPD'].map(key => [key, integer(template[key] * scale)])); }
function damage(attacker, defender, magic, random) { return calculateDamageFromJs({ power:magic ? attacker.stats.MAG : attacker.stats.ATK, resist:magic ? defender.stats.RES : defender.stats.DEF, roll01:random(), critRoll01:random(), sourceIsHero:attacker.kind === 'hero' ? 1 : 0 }); }
function createHero(definition, level, uid) { const stats = heroStats(definition, level); return { uid, kind:'hero', name:definition.name, role:definition.role, flowMode:definition.flowMode, stats, hp:stats.HP, maxHP:stats.HP, spd:stats.SPD, flow:0 }; }
function createEnemy(template, level) { const stats = enemyStats(template, level); return { uid:101, kind:'enemy', name:template.id, targetPreference:template.targetPreference, stats, hp:stats.HP, maxHP:stats.HP, spd:stats.SPD }; }

function loadProductionEncounterHelpers() {
  const filename = path.join(root, 'web-runner', 'systems', 'combatSessionInitializer.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/export function /g, 'function ');
  const module = { exports:{} };
  vm.runInNewContext(`${source}\nmodule.exports={buildEncounterByBudget,computeEncounterTotalCP,normalizeBiomeTags,normalizeEnemyRole,normalizeFaction,resolveEnemyEncounterCombatPower};`, {
    module, exports:module.exports, canonicalCombatPower:computeCombatPower,
    Number, String, Array, JSON, Math, Set, Infinity,
  }, { filename });
  return module.exports;
}

function readProductionEnemyRows() {
  const table = JSON.parse(fs.readFileSync(path.join(root, 'web-runner', 'assets', 'enemies.json'), 'utf8'));
  const headers = table.data.map(column => String(column[0][0]));
  return table.data[0].slice(1).map((_, rowIndex) => Object.fromEntries(headers.map((header, columnIndex) => [header, table.data[columnIndex][rowIndex + 1][0]]))).filter(row => String(row.name || '').trim());
}

function productionHero(definition, level, uid) {
  const withHp = levelStats({ baseHeroName:definition.key, currentLevel:level, equipmentStats:{} });
  const { HP, ...stats } = withHp;
  return { uid, kind:'hero', name:definition.name, baseHeroName:definition.key, role:definition.role, stats, hp:HP, maxHP:HP, spd:stats.SPD, currentLevel:level, basicMagic:definition.basic.tags.includes('magic') };
}

function summary(values) {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) return { min:null, median:null, max:null };
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const round = value => Math.round(value * 10000) / 10000;
  return { min:round(sorted[0]), median:round(median), max:round(sorted.at(-1)) };
}

function runBattle({ level, tier, path, seed }) {
  const random = rng(seed);
  const heroes = Object.values(HERO_DEFINITIONS).map((definition, index) => createHero(definition, level, index + 1));
  const enemy = createEnemy(tier, level);
  const scheduler = [...heroes, enemy].map(actor => ({ uid:actor.uid, type:actor.kind === 'enemy' ? 1 : 0 }));
  const enemyBurstByHero = {};
  let actions = 0, linkedActions = 0, highestLinkedBurst = 0, index = 0;
  while (enemy.hp > 0 && heroes.some(hero => hero.hp > 0) && actions++ < 180) {
    const slot = scheduler[index++ % scheduler.length];
    const actor = slot.type === 0 ? heroes.find(hero => hero.uid === slot.uid) : enemy;
    if (!actor || actor.hp <= 0) continue;
    if (actor.kind === 'hero') {
      const target = resolveHeroAttackTarget({ hero:actor, enemies:[enemy] });
      if (!target) continue;
      const first = damage(actor, target, path === 'magic', random).damage;
      target.hp = Math.max(0, target.hp - first);
      const linked = resolveHeroSpeedMultiattack({ hero:{ ...actor, effectiveSpeed:actor.stats.SPD }, enemies:[{ ...enemy, effectiveSpeed:enemy.stats.SPD }] });
      if (target.hp > 0 && linked) {
        const second = damage(actor, target, path === 'magic', random).damage;
        target.hp = Math.max(0, target.hp - second);
        linkedActions += 1;
        highestLinkedBurst = Math.max(highestLinkedBurst, first + second);
      }
    } else {
      const target = resolveEnemyTargetHero({ enemy:actor, heroes, rng:random }).target;
      if (!target) continue;
      const hit = damage(actor, target, path === 'magic', random).damage;
      target.hp = Math.max(0, target.hp - hit);
      enemyBurstByHero[target.name] = Math.max(number(enemyBurstByHero[target.name]), hit);
    }
  }
  const casualties = heroes.filter(hero => hero.hp <= 0).length;
  return { won:enemy.hp <= 0 && casualties < heroes.length, actions, casualties, highestLinkedBurst, linkedActions, enemyBurstByHero };
}
function aggregateRuns(level, tier, path) {
  const runs = Array.from({ length:seeds }, (_, offset) => runBattle({ level, tier, path, seed:(level * 100003) + (path === 'magic' ? 50000 : 0) + offset + 1 }));
  const sum = key => runs.reduce((total, row) => total + number(row[key]), 0);
  const enemyBurstByHero = Object.fromEntries(Object.values(HERO_DEFINITIONS).map(definition => [definition.name, Math.max(...runs.map(row => number(row.enemyBurstByHero[definition.name])))]));
  return { level, tier:tier.id, path, runs:seeds, winRate:sum('won') / seeds, averageActions:sum('actions') / seeds, averageCasualties:sum('casualties') / seeds, maxLinkedBurst:Math.max(...runs.map(row => row.highestLinkedBurst)), linkedActions:sum('linkedActions'), enemyBurstByHero };
}

const productionEncounterHelpers = loadProductionEncounterHelpers();
const productionCatalog = readProductionEnemyRows();
function productionEnemyRows(level) {
  return productionCatalog.map(rawRow => {
    const row = scaleRoutineEnemy(rawRow, level);
    return {
      ...row,
      faction:productionEncounterHelpers.normalizeFaction(row.faction),
      enemyRole:productionEncounterHelpers.normalizeEnemyRole(row.enemyRole || row.role),
      localeTags:productionEncounterHelpers.normalizeBiomeTags(row.localeTags || row.locale_tags || row.locale || row.biomes || row.biome || 'all'),
      CombatPower:productionEncounterHelpers.resolveEnemyEncounterCombatPower(row),
    };
  });
}

function runProductionBattle(level, seed) {
  const heroes = Object.values(HERO_DEFINITIONS).map((definition, index) => productionHero(definition, level, index + 1));
  const partyCP = productionEncounterHelpers.computeEncounterTotalCP(heroes.map(hero => ({ combatPower:computeCombatPower(hero) })));
  const targetCP = partyCP * .30;
  const encounter = productionEncounterHelpers.buildEncounterByBudget({ pool:productionEnemyRows(level), targetCP, partyCP, locale:'clouds', maxSlots:3, policy:'mixed', seed });
  const enemies = encounter.selected.map((row, index) => ({ uid:101 + index, kind:'enemy', name:row.name, stats:{ HP:row.HP, ATK:row.ATK, DEF:row.DEF, MAG:row.MAG, RES:row.RES, SPD:row.SPD }, hp:row.HP, maxHP:row.HP, spd:row.SPD }));
  const scheduler = [...heroes, ...enemies];
  const random = rng(((seed * 2654435761) ^ (level * 100003)) >>> 0);
  let actions = 0, heroActions = 0, firstEnemyKoAction = null, firstEnemyKoPartyCycle = null, linkedActions = 0, index = 0;
  const recordEnemyHit = (actor, target) => {
    const before = target.hp;
    target.hp = Math.max(0, target.hp - damage(actor, target, actor.basicMagic, random).damage);
    if (firstEnemyKoAction == null && before > 0 && target.hp === 0) {
      firstEnemyKoAction = actions;
      firstEnemyKoPartyCycle = Math.ceil(heroActions / heroes.length);
    }
  };
  while (enemies.some(enemy => enemy.hp > 0) && heroes.some(hero => hero.hp > 0) && actions < 360) {
    const actor = scheduler[index++ % scheduler.length];
    if (!actor || actor.hp <= 0) continue;
    actions += 1;
    if (actor.kind === 'hero') {
      heroActions += 1;
      const target = resolveHeroAttackTarget({ hero:actor, enemies });
      if (!target) continue;
      recordEnemyHit(actor, target);
      const linked = target.hp > 0 && resolveHeroSpeedMultiattack({ hero:{ ...actor, effectiveSpeed:actor.stats.SPD }, enemies:enemies.map(enemy => ({ ...enemy, effectiveSpeed:enemy.stats.SPD })) });
      if (linked && actions < 360) { actions += 1; heroActions += 1; linkedActions += 1; recordEnemyHit(actor, target); }
    } else {
      const target = resolveEnemyTargetHero({ enemy:actor, heroes, rng:random }).target;
      if (!target) continue;
      target.hp = Math.max(0, target.hp - damage(actor, target, false, random).damage);
    }
  }
  const casualties = heroes.filter(hero => hero.hp <= 0).length;
  return {
    won:enemies.every(enemy => enemy.hp <= 0) && casualties < heroes.length,
    casualties, actions, firstEnemyKoAction, firstEnemyKoPartyCycle, linkedActions,
    partyCP, targetCP, packCP:encounter.finalCP,
    partyCpRatio:encounter.finalCP / partyCP,
    targetFillRatio:encounter.finalCP / targetCP,
    slots:encounter.selected.length,
  };
}

function aggregateProductionLevel(level, runCount) {
  const rows = productionEnemyRows(level);
  const heroes = Object.values(HERO_DEFINITIONS).map((definition, index) => productionHero(definition, level, index + 1));
  const ordinaryHits = rows.flatMap(enemy => heroes.map(hero => damage({ kind:'enemy', stats:enemy }, hero, false, () => .5).damage));
  const runs = Array.from({ length:runCount }, (_, offset) => runProductionBattle(level, offset + 1));
  return {
    level, seeds:runCount, catalogRows:rows.length,
    packSlots:summary(runs.map(run => run.slots)),
    partyCpRatio:summary(runs.map(run => run.partyCpRatio)),
    targetFillRatio:summary(runs.map(run => run.targetFillRatio)),
    hostileOrdinaryHit:summary(ordinaryHits),
    firstEnemyKoAction:summary(runs.map(run => run.firstEnemyKoAction)),
    firstEnemyKoPartyCycle:summary(runs.map(run => run.firstEnemyKoPartyCycle)),
    totalActions:summary(runs.map(run => run.actions)),
    winRate:runs.filter(run => run.won).length / runCount,
    heroCasualtyRate:runs.filter(run => run.casualties > 0).length / runCount,
    typicalHeroCasualties:summary(runs.map(run => run.casualties)).median,
    linkedActions:runs.reduce((total, run) => total + run.linkedActions, 0),
  };
}

function speedFixture() {
  const hero = { uid:1, kind:'hero', name:'Huun', baseHeroName:'Huun', hp:40, effectiveSpeed:20, flow:0, flowMode:'Warrior' };
  const enemy = { uid:101, kind:'enemy', hp:40, effectiveSpeed:10 };
  const events = [], actionQueue = ['ordinary'];
  let latchUID = 0;
  while (actionQueue.length) {
    const phase = actionQueue.shift();
    const linked = resolveHeroSpeedMultiattack({ hero, enemies:[enemy], alreadyLinked:latchUID === hero.uid });
    const award = resolveRoleFlowAward({ heroes:[hero], hero, event:{ enemyHpDamage:2 }, apply:false });
    events.push({ phase, linked, latchBefore:latchUID, af:number(award?.value) });
    if (linked) { latchUID = hero.uid; actionQueue.unshift('linked'); }
    else if (phase === 'linked') latchUID = 0;
  }
  const nextOrdinaryTurnRelinks = resolveHeroSpeedMultiattack({ hero, enemies:[enemy], alreadyLinked:latchUID === hero.uid });
  return {
    threshold: { atTwoTimes:events[0].linked, belowTwoTimes:!resolveHeroSpeedMultiattack({ hero:{ ...hero, effectiveSpeed:19 }, enemies:[enemy] }) },
    sequence:events.map(event => event.phase),
    linkedSecondActionCount:events.filter(event => event.phase === 'linked').length,
    nonRecursive:events[1]?.linked === false,
    latchReset:latchUID === 0,
    nextOrdinaryTurnRelinks,
    afAwardCount:events.filter(event => event.af === 10).length,
    afTotal:events.reduce((sum, event) => sum + event.af, 0),
  };
}

const rows = [];
for (const level of levels) {
  for (const definition of Object.values(HERO_DEFINITIONS)) {
    const stats = heroStats(definition, level);
    rows.push({ id:definition.name, kind:'hero', level, stats, baseCP:computeCombatPower({ stats, currentLevel:level, kit:{ afValue:2, sequenceActions:1 } }), currentCP:computeCombatPower({ stats, currentLevel:level }) });
  }
  for (const tier of tiers) {
    const stats = enemyStats(tier, level);
    rows.push({ id:`${tier.id}-${level}`, kind:'enemy', level, stats, baseCP:computeCombatPower({ stats, currentLevel:level }), currentCP:computeCombatPower({ stats, currentLevel:level }) });
  }
}
const damageMatrix = [];
for (const level of levels) for (const definition of Object.values(HERO_DEFINITIONS)) for (const tier of tiers) for (const path of ['physical','magic']) {
  const hero = { kind:'hero', stats:heroStats(definition, level) }, enemy = { kind:'enemy', stats:enemyStats(tier, level) };
  damageMatrix.push({ surface:'same_level', level, hero:definition.name, enemy:tier.id, path, heroDamage:damage(hero, enemy, path === 'magic', () => .5).damage, enemyDamage:damage(enemy, hero, path === 'magic', () => .5).damage });
}
for (const [heroLevel, enemyLevel] of pairs) for (const definition of Object.values(HERO_DEFINITIONS)) for (const tier of tiers) for (const path of ['physical','magic']) {
  const hero = { kind:'hero', stats:heroStats(definition, heroLevel) }, enemy = { kind:'enemy', stats:enemyStats(tier, enemyLevel) };
  damageMatrix.push({ surface:'cross_level', heroLevel, enemyLevel, hero:definition.name, enemy:tier.id, path, heroDamage:damage(hero, enemy, path === 'magic', () => .5).damage, enemyDamage:damage(enemy, hero, path === 'magic', () => .5).damage });
}
const simulations = [];
for (const level of levels) for (const tier of tiers) for (const path of ['physical','magic']) simulations.push(aggregateRuns(level, tier, path));
const failures = [];
for (const kind of ['hero','enemy']) for (const id of new Set(rows.filter(row => row.kind === kind).map(row => row.id.replace(/-\d+$/, '')))) {
  const series = rows.filter(row => row.kind === kind && row.id.replace(/-\d+$/, '') === id).sort((a,b) => a.level - b.level);
  for (let i = 1; i < series.length; i += 1) if (series[i].baseCP < series[i - 1].baseCP || series[i].currentCP < series[i - 1].currentCP) failures.push(`${kind} CP inversion ${id} ${series[i - 1].level}-${series[i].level}`);
}
for (const row of damageMatrix) {
  if (!Number.isFinite(row.heroDamage) || !Number.isFinite(row.enemyDamage) || row.heroDamage < 1 || row.enemyDamage < 1) failures.push(`minimum or finite damage ${JSON.stringify(row)}`);
  if (row.surface === 'same_level' && row.level === 1 && row.heroDamage > 9) failures.push(`L1 ${row.hero} ${row.path} hit ${row.heroDamage}`);
}
for (const [lowHero, highEnemy, highHero, lowEnemy] of [[1,9,9,1],[91,99,99,91]]) for (const definition of Object.values(HERO_DEFINITIONS)) for (const tier of tiers) for (const path of ['physical','magic']) {
  const weak = damageMatrix.find(row => row.surface === 'cross_level' && row.hero === definition.name && row.enemy === tier.id && row.path === path && row.heroLevel === lowHero && row.enemyLevel === highEnemy);
  const strong = damageMatrix.find(row => row.surface === 'cross_level' && row.hero === definition.name && row.enemy === tier.id && row.path === path && row.heroLevel === highHero && row.enemyLevel === lowEnemy);
  if (!weak || !strong || strong.heroDamage < weak.heroDamage || strong.enemyDamage > weak.enemyDamage) failures.push(`cross-level direction ${definition.name} ${tier.id} ${path} ${lowHero}-${highEnemy}/${highHero}-${lowEnemy}`);
}
for (const row of simulations) {
  const tier = tiers.find(candidate => candidate.id === row.tier);
  if (row.winRate < tier.minWin) failures.push(`${row.tier} L${row.level} ${row.path} win rate ${row.winRate.toFixed(3)}`);
  if (row.averageActions > tier.maxActions) failures.push(`${row.tier} L${row.level} ${row.path} TTK/actions ${row.averageActions.toFixed(1)}`);
  for (const definition of Object.values(HERO_DEFINITIONS)) {
    const maxBurst = Math.ceil(heroStats(definition, row.level).HP * tier.burst);
    if (row.enemyBurstByHero[definition.name] > maxBurst) failures.push(`${row.tier} L${row.level} ${row.path} ${definition.name} burst ${row.enemyBurstByHero[definition.name]}/${maxBurst}`);
  }
}
for (const level of [1,9,91,99]) {
  const stats = heroStats(HERO_DEFINITIONS.Huun, level), soft = { kind:'enemy', stats:{...stats, DEF:1, RES:1} }, hard = { kind:'enemy', stats:{...stats, DEF:stats.DEF + 20, RES:stats.RES + 20} }, attacker = { kind:'hero', stats };
  if (!(damage(attacker, hard, false, () => .5).damage < damage(attacker, soft, false, () => .5).damage)) failures.push(`physical defense irrelevance L${level}`);
  if (!(damage(attacker, hard, true, () => .5).damage < damage(attacker, soft, true, () => .5).damage)) failures.push(`magic resistance irrelevance L${level}`);
}
const speed = speedFixture();
if (!speed.threshold.atTwoTimes || !speed.threshold.belowTwoTimes || speed.linkedSecondActionCount !== 1 || !speed.nonRecursive || !speed.latchReset || !speed.nextOrdinaryTurnRelinks || speed.afAwardCount !== 2 || speed.afTotal !== 20) failures.push('speed linked scheduler sequence');
const safety = [];
for (const level of [1,9,91,99]) for (const tier of tiers) for (const definition of Object.values(HERO_DEFINITIONS)) {
  const hero = { kind:'hero', stats:heroStats(definition, level) }, enemy = { kind:'enemy', stats:enemyStats(tier, level) };
  const enemyCrit = damage(enemy, hero, false, () => 0).damage;
  const heroCrit = damage(hero, enemy, false, () => 0).damage;
  const linkedBurst = heroCrit * 2;
  const cap = Math.ceil(hero.stats.HP * tier.burst);
  safety.push({ level, tier:tier.id, hero:definition.name, enemyCrit, heroCrit, linkedBurst, enemyHP:enemy.stats.HP, heroHP:hero.stats.HP, cap });
  if (enemyCrit > cap) failures.push(`crit burst ${tier.id} L${level} ${definition.name} ${enemyCrit}/${cap}`);
  if (!Number.isFinite(linkedBurst)) failures.push(`linked burst overflow ${tier.id} L${level} ${definition.name}`);
}
const overflow = { cp:computeCombatPower({ stats:{ HP:Number.MAX_SAFE_INTEGER, ATK:Number.MAX_SAFE_INTEGER, MAG:Number.MAX_SAFE_INTEGER, DEF:Number.MAX_SAFE_INTEGER, RES:Number.MAX_SAFE_INTEGER, SPD:Number.MAX_SAFE_INTEGER }, currentLevel:99 }), damage:calculateDamageFromJs({ power:Number.MAX_SAFE_INTEGER, resist:Number.MAX_SAFE_INTEGER, roll01:.5, critRoll01:.5 }).damage };
if (!Number.isFinite(overflow.cp) || !Number.isFinite(overflow.damage) || overflow.cp < 0 || overflow.damage < 1) failures.push('numeric overflow');
const productionMetrics = Object.entries(productionSeeds).map(([level, runCount]) => aggregateProductionLevel(Number(level), runCount));
const productionL1 = productionMetrics.find(metric => metric.level === 1);
if (!Number.isFinite(productionL1?.partyCpRatio.min) || productionL1.partyCpRatio.min < .25 || productionL1.partyCpRatio.max > .35) failures.push('production routine L1 party CP ratio');
if (!Number.isFinite(productionL1?.targetFillRatio.min) || productionL1.targetFillRatio.min < .85 || productionL1.targetFillRatio.max > 1.15) failures.push('production routine L1 target CP fill');
if (!Number.isFinite(productionL1?.hostileOrdinaryHit.max) || productionL1.hostileOrdinaryHit.max > 3) failures.push('production routine L1 hostile ordinary hit');
if (!Number.isFinite(productionL1?.firstEnemyKoPartyCycle.max) || productionL1.firstEnemyKoPartyCycle.max > 2) failures.push('production routine L1 first enemy KO cycle');
if (!productionL1 || productionL1.winRate < .98) failures.push('production routine L1 win rate');
if (!productionL1 || productionL1.typicalHeroCasualties !== 0) failures.push('production routine L1 typical hero casualties');
const report = { version:4, levels, pairs, seeds, rows, damageMatrix, simulations, productionMetrics, speed, safety, overflow, failures, pass:failures.length === 0 };
fs.mkdirSync(output, { recursive:true });
fs.writeFileSync(path.join(output, 'cp-report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(output, 'cp-report.csv'), `id,kind,level,baseCP,currentCP\n${rows.map(row => [row.id,row.kind,row.level,row.baseCP,row.currentCP].join(',')).join('\n')}\n`);
fs.writeFileSync(path.join(output, 'scaling-drift.json'), `${JSON.stringify({ levels,pairs,seeds,damageMatrix,simulations,productionMetrics,speed,safety,overflow,failures }, null, 2)}\n`);
const productionTable = productionMetrics.map(metric => `| ${metric.level} | ${metric.seeds} | ${metric.partyCpRatio.min}/${metric.partyCpRatio.median}/${metric.partyCpRatio.max} | ${metric.targetFillRatio.min}/${metric.targetFillRatio.median}/${metric.targetFillRatio.max} | ${metric.hostileOrdinaryHit.min}/${metric.hostileOrdinaryHit.median}/${metric.hostileOrdinaryHit.max} | ${metric.firstEnemyKoAction.min}/${metric.firstEnemyKoAction.median}/${metric.firstEnemyKoAction.max} | ${metric.firstEnemyKoPartyCycle.min}/${metric.firstEnemyKoPartyCycle.median}/${metric.firstEnemyKoPartyCycle.max} | ${metric.totalActions.min}/${metric.totalActions.median}/${metric.totalActions.max} | ${metric.winRate} | ${metric.heroCasualtyRate} |`).join('\n');
fs.writeFileSync(path.join(output, 'scaling-drift.md'), `# CP scaling drift\n\n${failures.length ? `FAIL\n${failures.map(value => `- ${value}`).join('\n')}` : `PASS\n\n${simulations.length} seeded simulations across ${seeds} seeds each.`}\n\n## Production routine packs\n\nMin/median/max are shown for ranged metrics.\n\n| Level | Seeds | Party CP ratio | Target fill | Hostile hit | First KO action | First KO party cycle | Total actions | Win rate | Hero casualty rate |\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${productionTable}\n\nSpeed-linked threshold: ${speed.threshold.atTwoTimes && speed.threshold.belowTwoTimes && speed.nonRecursive ? 'PASS' : 'FAIL'}.\n`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`PASS ${rows.length} CP rows, ${damageMatrix.length} damage paths, ${simulations.length * seeds} seeded battles`);
