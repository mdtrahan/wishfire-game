// Full-party, trace-locked sustain projection. No gameplay source is imported or edited.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = path.join(ROOT, 'output/orka-7l9-knowledge-lab/sample/observed.ndjson.gz');
const round = value => Math.round(value * 1000) / 1000;

export function projectPartySession(records, regenHpPerSecond, minimumFraction = 0.95, recovery = {}) {
  const start = records.find(row => row.kind === 'SESSION_START');
  const end = records.find(row => row.kind === 'SESSION_END');
  const refund = recovery.damageRefundFraction ?? 0;
  const delay = recovery.damageRefundDelaySeconds ?? 2;
  const pressure = recovery.incomingPressureMultiplier ?? 1;
  const regenFraction = recovery.regenFractionMaxHpPerSecond ?? 0;
  const healGearGrowth = recovery.healGearMaxHpGrowth === true;
  const bossMode = recovery.encounter === 'boss';
  const sourceBossTimeout = bossMode ? records.find(row => row.kind === 'BOSS_TIMEOUT') : null;
  if (!start || !end || !Number.isFinite(regenHpPerSecond) || regenHpPerSecond < 0)
    throw new Error('session endpoints and nonnegative regeneration are required');
  if (!Number.isFinite(refund) || refund < 0 || refund > 1 || !Number.isFinite(delay) || delay < 0 ||
      !Number.isFinite(pressure) || pressure <= 0 || !Number.isFinite(regenFraction) || regenFraction < 0)
    throw new Error('refund must be 0..1, delay and regen nonnegative, pressure positive');
  const heroes = new Map(start.heroes.map(hero => [hero.name, { hp: hero.hp, maxHp: hero.maxHp, level: hero.level }]));
  let minFraction = Math.min(...[...heroes.values()].map(hero => hero.hp / hero.maxHp));
  let previousTime = start.t;
  let excludedBossTime = 0;
  let bossStartTime = null;
  let firstModelKo = null;
  let sourceKoBoundary = null;
  let bossTimeout = null;
  let clears = 0;
  const invalid = [];
  const pending = [];
  const refundCredits = new Map([...heroes.keys()].map(name => [name, 0]));
  const updateFloor = hero => { minFraction = Math.min(minFraction, hero.hp / hero.maxHp); };
  const setMaxHp = (hero, value, level = hero.level) => {
    const increase = Math.max(0, value - hero.maxHp);
    const levelGrowth = Number(level) > Number(hero.level);
    hero.maxHp = value;
    hero.hp = Math.min(value, hero.hp + (levelGrowth || healGearGrowth ? increase : 0));
    hero.level = level;
    updateFloor(hero);
  };
  const advance = time => {
    const restoreFlat = until => {
      const elapsed = Math.max(0, until - previousTime);
      for (const hero of heroes.values()) if (hero.hp > 0)
        hero.hp = Math.min(hero.maxHp, hero.hp + (regenHpPerSecond + hero.maxHp * regenFraction) * elapsed);
      previousTime = until;
    };
    while (pending.length && pending[0].time <= time) {
      const due = pending.shift();
      restoreFlat(due.time);
      const hero = heroes.get(due.name);
      const credit = refundCredits.get(due.name) + due.amount;
      const payout = Math.floor(credit + 1e-9);
      refundCredits.set(due.name, credit - payout);
      if (hero.hp > 0) hero.hp = Math.min(hero.maxHp, hero.hp + payout);
    }
    restoreFlat(time);
  };
  const ordered = records.filter(row => row !== start && row !== end)
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.t - b.row.t || a.index - b.index);
  for (const { row } of ordered) {
    if (!Number.isFinite(row.t) || row.t < start.t) { invalid.push('event time invalid'); break; }
    const effectiveTime = bossMode ? row.t : row.t - excludedBossTime -
      (bossStartTime === null ? 0 : row.t - bossStartTime);
    advance(effectiveTime);
    if (!bossMode && row.kind === 'BOSS_START') {
      if (bossStartTime !== null) { invalid.push('nested boss interval'); break; }
      bossStartTime = row.t;
      continue;
    }
    if (!bossMode && ['BOSS_CLEAR', 'BOSS_TIMEOUT', 'BOSS_KO_RECOVERY'].includes(row.kind)) {
      if (bossStartTime === null) { invalid.push('boss end without start'); break; }
      excludedBossTime += row.t - bossStartTime;
      bossStartTime = null;
      continue;
    }
    if (!bossMode && bossStartTime !== null) {
      if (['KO', 'RECOVERY_TRANSITION', 'GAP'].includes(row.kind)) {
        invalid.push(`source ${row.kind.toLowerCase()} changes the later attack schedule`);
        break;
      }
      continue;
    }
    if (bossMode && row.kind === 'RECOVERY_TRANSITION' && sourceBossTimeout &&
        Math.abs(row.t - sourceBossTimeout.t) < 0.001) { bossTimeout = sourceBossTimeout; break; }
    if (row.kind === 'KO' && heroes.has(row.target?.name)) {
      const hero = heroes.get(row.target.name);
      sourceKoBoundary = { hero: row.target.name, t: row.t,
        modeledHpBeforePct: round(hero.hp / hero.maxHp * 100) };
    }
    if (row.kind === 'GAP' || row.kind === 'RECOVERY_TRANSITION' || row.kind === 'KO') {
      invalid.push(`source ${row.kind.toLowerCase()} changes the later attack schedule`);
      break;
    }
    if (bossMode && row.kind === 'BOSS_TIMEOUT') { bossTimeout = row; break; }
    if (row.kind === 'HERO_STATE' && heroes.has(row.hero?.name)) {
      const hero = heroes.get(row.hero.name);
      setMaxHp(hero, row.hero.maxHp, row.hero.level);
    }
    if (row.kind === 'HIT' && heroes.has(row.target?.name)) {
      if (!bossMode && (row.source?.combatTier === 'boss' || row.bossActiveAtPoll === true)) {
        invalid.push('boss hit without a bounded boss interval');
        break;
      }
      const hero = heroes.get(row.target.name);
      if (!Number.isInteger(row.applied) || row.applied < 0) { invalid.push('noninteger observed hit'); break; }
      if (Number.isFinite(row.maxHp) && row.maxHp !== hero.maxHp) {
        setMaxHp(hero, row.maxHp);
      }
      const damage = Math.ceil(row.applied * pressure);
      if (row.hpAfter === 0 && row.hpBefore > 0 && row.applied === row.hpBefore && hero.hp > damage) {
        sourceKoBoundary = { hero: row.target.name, t: row.t,
          modeledHpBeforePct: round(hero.hp / hero.maxHp * 100), appliedLowerBoundHp: damage };
        invalid.push('source lethal hit is HP-truncated; raw damage and later schedule unknown');
        break;
      }
      hero.hp = Math.max(0, hero.hp - damage);
      updateFloor(hero);
      if (hero.hp <= 0) { firstModelKo = { hero: row.target.name, wave: row.wave, t: row.t }; break; }
      if (refund > 0 && damage > 0)
        pending.push({ time: effectiveTime + delay, name: row.target.name, amount: damage * refund });
      if (delay === 0) advance(effectiveTime);
    }
    if (row.kind === 'HEAL' && row.healSource !== 'ordinary_wave_clear') {
      invalid.push('source skill healing cannot be replayed');
      break;
    }
    if (row.kind === 'WAVE_CLEAR') {
      clears += Number(row.delta || 0);
      for (const hero of heroes.values()) if (hero.hp > 0)
        hero.hp = Math.min(hero.maxHp, hero.hp + Math.ceil(hero.maxHp * 0.15));
    }
  }
  if (!bossMode && bossStartTime !== null && clears < 20) invalid.push('boss interval incomplete');
  const complete = invalid.length === 0 && !firstModelKo &&
    (bossMode ? bossTimeout?.outcome === 'timeout' : clears >= 20 &&
      end.completedOrdinaryWaves >= 20 && end.defeatRecoveries === 0) &&
    end.missingCombatEvents === 0 && end.ambiguousWaveTransitions === 0 && end.deadlockCount === 0;
  const status = firstModelKo || (complete && minFraction < minimumFraction) ? 'FAIL' : complete ? 'PASS' : 'UNKNOWN';
  return { seed: start.seed, status, minHpPct: round(minFraction * 100), waves: clears,
    bossHpAtTimeout: bossTimeout?.boss?.timeoutHp ?? null,
    firstModelKo, sourceKoBoundary, reason: firstModelKo ? 'modeled Hero KO' : invalid[0] ||
      (complete ? minFraction < minimumFraction ? 'HP floor missed' : bossMode ? 'party survived observed boss timeout' :
        'all Heroes survived 20 waves above floor' : bossMode ? 'clean boss timeout unavailable' : '20 clean waves unavailable') };
}

export function projectPartyScenario(allRecords, scenario, regenHpPerSecond, minimumFraction = 0.95, recovery = {}) {
  const sessions = [...new Set(allRecords.filter(row => row.scenario === scenario).map(row => row.session))];
  const runs = sessions.map(session => projectPartySession(
    allRecords.filter(row => row.scenario === scenario && row.session === session), regenHpPerSecond, minimumFraction, recovery));
  const distinctSeeds = runs.length === 5 && runs.every(run => Number.isSafeInteger(run.seed)) &&
    new Set(runs.map(run => run.seed)).size === 5;
  return { scenario, regenHpPerSecond, minimumFraction, status: distinctSeeds && runs.every(run => run.status === 'PASS') ? 'PASS' :
    runs.some(run => run.status === 'FAIL') ? 'FAIL' : 'UNKNOWN', runs };
}

function main(args) {
  const scenarios = String(args[0] || '').split(',').filter(Boolean);
  const rate = Number(args[1]);
  const floor = args[2] == null ? 0.95 : Number(args[2]);
  const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
  const recovery = { damageRefundFraction: option('--refund') == null ? 0 : Number(option('--refund')),
    damageRefundDelaySeconds: option('--delay') == null ? 2 : Number(option('--delay')),
    regenFractionMaxHpPerSecond: option('--regen-fraction') == null ? 0 : Number(option('--regen-fraction')),
    incomingPressureMultiplier: option('--pressure') == null ? 1 : Number(option('--pressure')),
    healGearMaxHpGrowth: args.includes('--heal-gear-growth'), encounter: args.includes('--boss') ? 'boss' : 'farming' };
  if (!scenarios.length || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(floor) || floor <= 0 || floor > 1)
    throw new Error('usage: party_sustain.mjs <scenario[,scenario]> <regen-HP-per-second> [minimum-HP-fraction] [--refund F] [--delay S] [--regen-fraction F] [--heal-gear-growth] [--boss] [--pressure X] [--save] [--out DIRECTORY]');
  const bytes = fs.readFileSync(SOURCE);
  const sourceSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const modelSha256 = crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex');
  const digest = crypto.createHash('sha256').update(JSON.stringify({ scenarios, rate, floor, recovery,
    sourceSha256, modelSha256 })).digest('hex');
  const evaluate = () => {
    const records = zlib.gunzipSync(bytes).toString('utf8').trim().split('\n').map(JSON.parse);
    const groups = scenarios.map(scenario => projectPartyScenario(records, scenario, rate, floor, recovery));
    return { digest, scope: 'full-party trace-locked MODEL', sourceSha256, modelSha256,
      regenHpPerSecond: rate, ...recovery, minimumFraction: floor,
      status: groups.every(group => group.status === 'PASS') ? 'PASS' :
        groups.some(group => group.status === 'FAIL') ? 'FAIL' : 'UNKNOWN', groups };
  };
  if (!args.includes('--save')) { console.log(JSON.stringify(evaluate())); return; }
  const outDir = option('--out') || path.join(ROOT, 'output/orka-7l9-knowledge-lab/sustain-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'party-tracker.json');
  const lock = `${out}.lock`;
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { fs.mkdirSync(lock); acquired = true; break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  if (!acquired) throw new Error('party tracker locked for >5 seconds');
  try {
    const previous = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
    const tracker = previous?.sourceSha256 === sourceSha256 && previous?.modelSha256 === modelSha256 ? previous :
      { sourceSha256, modelSha256, cases: [] };
    const existing = tracker.cases.find(item => item.digest === digest);
    if (existing) { console.log(JSON.stringify({ action: 'SKIPPED', ...existing })); return; }
    const report = evaluate();
    const entry = { digest, scenarios, regenHpPerSecond: rate, minimumFraction: floor, ...recovery,
      status: report.status, runs: report.groups.map(group => ({ scenario: group.scenario,
        seeds: group.runs.map(run => ({ seed: run.seed, status: run.status, minHpPct: run.minHpPct,
          waves: run.waves, heroKo: run.firstModelKo?.hero ?? null,
          preLethalModelHpPct: run.sourceKoBoundary?.modeledHpBeforePct ?? null,
          bossHpAtTimeout: run.bossHpAtTimeout })) })) };
    tracker.cases.push(entry);
    const temp = `${out}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(tracker) + '\n');
    fs.renameSync(temp, out);
    console.log(JSON.stringify({ action: 'CREATED', ...entry }));
  } finally { fs.rmdirSync(lock); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
