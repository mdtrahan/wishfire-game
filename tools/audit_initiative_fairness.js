#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ENEMIES_JSON = path.join(ROOT, 'web-runner/assets/enemies.json');
const OUT_DIR = path.join(ROOT, 'test-results/ORKA-oyi');
const OUT_JSON = path.join(OUT_DIR, 'initiative-fairness-audit.json');
const OUT_MD = path.join(OUT_DIR, 'initiative-fairness-report.md');

const HERO_ROSTER = [
  { name: 'Falie', SPD: 9 },
  { name: 'Huun', SPD: 20 },
  { name: 'Runa', SPD: 11 },
  { name: 'Kojonn', SPD: 14 },
];

const SPEED_DOUBLE_RATIO = 2.0;
const THRESHOLD = 100;
const TRACE_TURNS = 14;
const SAMPLES_PER_MODE = 1500;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function readEnemyPool() {
  const raw = JSON.parse(fs.readFileSync(ENEMIES_JSON, 'utf8'));
  const rows = raw?.data;
  if (!Array.isArray(rows) || rows.length < 7) {
    throw new Error('Unexpected enemies.json schema');
  }
  const names = rows[0] || [];
  const spds = rows[6] || [];
  const pool = [];
  for (let i = 1; i < names.length; i += 1) {
    const name = String(Array.isArray(names[i]) ? names[i][0] : names[i] || '').trim();
    const spdCell = Array.isArray(spds[i]) ? spds[i][0] : spds[i];
    const spd = Number(spdCell);
    if (!name || !Number.isFinite(spd) || spd <= 0) continue;
    pool.push({ name, SPD: spd });
  }
  return pool;
}

function sampleEnemies(pool, count, rand) {
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

function buildRoster(sampleEnemiesList) {
  const heroes = HERO_ROSTER.map((h, i) => ({
    uid: 100 + i,
    type: 0,
    name: h.name,
    spd: h.SPD,
  }));
  const enemies = sampleEnemiesList.map((e, i) => ({
    uid: 200 + i,
    type: 1,
    name: e.name,
    spd: e.SPD,
  }));
  return heroes.concat(enemies);
}

function getMeter(meters, uid) {
  const v = meters[uid];
  return Number.isFinite(v) ? v : 0;
}

function setMeter(meters, uid, value) {
  meters[uid] = Number(value) || 0;
}

function syncMeters(roster, meters) {
  for (const r of roster) {
    if (!Object.prototype.hasOwnProperty.call(meters, r.uid)) {
      meters[r.uid] = 0;
    }
  }
  for (const uid of Object.keys(meters)) {
    const num = Number(uid);
    if (!roster.find((r) => r.uid === num)) delete meters[uid];
  }
}

function getOverride(state, roster) {
  const mode = state.BattleStartMode;
  const startActive = Boolean(mode && !state.BattleStartResolved);
  if (!startActive) return { active: false, pool: roster };

  const teamType = mode === 'ambush' ? 1 : 0;
  if (!state.BattleStartRemaining || typeof state.BattleStartRemaining !== 'object') {
    state.BattleStartRemaining = {};
  }
  const remaining = state.BattleStartRemaining;

  if (Object.keys(remaining).length === 0) {
    for (const r of roster) {
      if (r.type === teamType) remaining[r.uid] = true;
    }
  }

  const rosterUIDs = new Set(roster.map((r) => r.uid));
  for (const uid of Object.keys(remaining)) {
    const num = Number(uid);
    const actor = roster.find((r) => r.uid === num);
    if (!rosterUIDs.has(num) || !actor || actor.type !== teamType) {
      delete remaining[uid];
    }
  }

  if (Object.keys(remaining).length === 0) {
    state.BattleStartResolved = 1;
    state.BattleStartMode = '';
    return { active: false, pool: roster };
  }

  return {
    active: true,
    pool: roster.filter((r) => remaining[r.uid]),
    remaining,
    teamType,
  };
}

function selectNext(state, roster) {
  syncMeters(roster, state.InitiativeMeters);
  const meters = state.InitiativeMeters;
  const override = getOverride(state, roster);
  const pool = override.pool || roster;

  let loops = 0;
  const maxLoops = 500;
  while (loops < maxLoops) {
    let ready = null;
    for (const r of pool) {
      const meter = getMeter(meters, r.uid);
      if (meter < THRESHOLD) continue;
      if (
        !ready ||
        meter > ready.meter ||
        (meter === ready.meter && (r.spd > ready.spd || (r.spd === ready.spd && r.uid < ready.uid)))
      ) {
        ready = { ...r, meter };
      }
    }

    if (ready) {
      setMeter(meters, ready.uid, ready.meter - THRESHOLD);
      if (override.active && override.remaining) {
        delete override.remaining[ready.uid];
        if (Object.keys(override.remaining).length === 0) {
          state.BattleStartResolved = 1;
          state.BattleStartMode = '';
        }
      }
      return {
        uid: ready.uid,
        type: ready.type,
        spd: ready.spd,
        name: ready.name,
        overrideActive: override.active,
        remainingBeforePick: override.remaining ? Object.keys(override.remaining).length + 1 : 0,
      };
    }

    for (const r of pool) {
      setMeter(meters, r.uid, getMeter(meters, r.uid) + (r.spd || 0));
    }
    loops += 1;
  }

  const fallback = roster[0];
  return {
    uid: fallback.uid,
    type: fallback.type,
    spd: fallback.spd,
    name: fallback.name,
    overrideActive: false,
    remainingBeforePick: 0,
  };
}

function runSingleSample(mode, enemyPool, rand) {
  const pickedEnemies = sampleEnemies(enemyPool, 3, rand);
  const roster = buildRoster(pickedEnemies);
  const state = {
    BattleStartMode: mode,
    BattleStartResolved: 0,
    BattleStartRemaining: {},
    InitiativeMeters: {},
  };

  const favoredType = mode === 'ambush' ? 1 : 0;
  const favoredCount = roster.filter((r) => r.type === favoredType).length;
  const fastestOpp = Math.max(...roster.filter((r) => r.type !== favoredType).map((r) => r.spd));

  const turns = [];
  for (let i = 0; i < TRACE_TURNS; i += 1) {
    turns.push(selectNext(state, roster));
  }

  const firstOpponentIdx = turns.findIndex((t) => t.type !== favoredType);
  const firstOpponentTurn = firstOpponentIdx === -1 ? null : firstOpponentIdx + 1;
  const prefixFavored = firstOpponentIdx === -1 ? turns.slice() : turns.slice(0, firstOpponentIdx);
  const prefixUnique = new Set(prefixFavored.map((t) => t.uid));

  let consecutiveSameUid = 0;
  let suspiciousConsecutive = 0;
  for (let i = 1; i < turns.length; i += 1) {
    if (turns[i].uid !== turns[i - 1].uid) continue;
    consecutiveSameUid += 1;
    const legit = turns[i].spd >= fastestOpp * SPEED_DOUBLE_RATIO;
    if (!legit) suspiciousConsecutive += 1;
  }

  return {
    mode,
    favoredType,
    favoredCount,
    enemyTeam: pickedEnemies,
    turns,
    checks: {
      favoredStartsFirst: turns[0] && turns[0].type === favoredType,
      firstOpponentTurn,
      favoredTurnsBeforeOpponent: prefixFavored.length,
      noDuplicateFavoredBeforeOpponent: prefixUnique.size === prefixFavored.length,
      additionalFullTeamRoundBeforeOpponent: prefixFavored.length >= favoredCount * 2,
      consecutiveSameUid,
      suspiciousConsecutive,
    },
  };
}

function summarize(samples) {
  const total = samples.length;
  let favoredStartsFirst = 0;
  let noDuplicateFavoredBeforeOpponent = 0;
  let additionalFullTeamRoundBeforeOpponent = 0;
  let suspiciousConsecutive = 0;
  let totalConsecutive = 0;

  const firstOpponentTurns = [];
  const favoredTurnsBeforeOpponent = [];

  for (const s of samples) {
    if (s.checks.favoredStartsFirst) favoredStartsFirst += 1;
    if (s.checks.noDuplicateFavoredBeforeOpponent) noDuplicateFavoredBeforeOpponent += 1;
    if (s.checks.additionalFullTeamRoundBeforeOpponent) additionalFullTeamRoundBeforeOpponent += 1;
    suspiciousConsecutive += s.checks.suspiciousConsecutive;
    totalConsecutive += s.checks.consecutiveSameUid;
    if (s.checks.firstOpponentTurn != null) firstOpponentTurns.push(s.checks.firstOpponentTurn);
    favoredTurnsBeforeOpponent.push(s.checks.favoredTurnsBeforeOpponent);
  }

  const avgFirstOpp = firstOpponentTurns.reduce((a, b) => a + b, 0) / (firstOpponentTurns.length || 1);
  const avgFavoredBeforeOpp = favoredTurnsBeforeOpponent.reduce((a, b) => a + b, 0) / (favoredTurnsBeforeOpponent.length || 1);
  const maxFavoredBeforeOpp = Math.max(...favoredTurnsBeforeOpponent);

  return {
    sampleCount: total,
    favoredStartsFirstRate: favoredStartsFirst / total,
    noDuplicateFavoredBeforeOpponentRate: noDuplicateFavoredBeforeOpponent / total,
    additionalFullTeamRoundBeforeOpponentRate: additionalFullTeamRoundBeforeOpponent / total,
    averageFirstOpponentTurn: Number(avgFirstOpp.toFixed(3)),
    averageFavoredTurnsBeforeOpponent: Number(avgFavoredBeforeOpp.toFixed(3)),
    maxFavoredTurnsBeforeOpponent: maxFavoredBeforeOpp,
    consecutiveSameUidEvents: totalConsecutive,
    suspiciousConsecutiveSameUidEvents: suspiciousConsecutive,
  };
}

function main() {
  const seed = 20260225;
  const rand = mulberry32(seed);
  const enemyPool = readEnemyPool();

  const ambushSamples = [];
  const initiativeSamples = [];

  for (let i = 0; i < SAMPLES_PER_MODE; i += 1) {
    ambushSamples.push(runSingleSample('ambush', enemyPool, rand));
    initiativeSamples.push(runSingleSample('initiative', enemyPool, rand));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    seed,
    config: {
      samplesPerMode: SAMPLES_PER_MODE,
      traceTurns: TRACE_TURNS,
      initiativeThreshold: THRESHOLD,
      speedDoubleRatio: SPEED_DOUBLE_RATIO,
    },
    byMode: {
      ambush: summarize(ambushSamples),
      initiative: summarize(initiativeSamples),
    },
  };

  const pass =
    summary.byMode.ambush.favoredStartsFirstRate === 1 &&
    summary.byMode.initiative.favoredStartsFirstRate === 1 &&
    summary.byMode.ambush.additionalFullTeamRoundBeforeOpponentRate === 0 &&
    summary.byMode.initiative.additionalFullTeamRoundBeforeOpponentRate === 0;

  const verdict = pass ? 'PASS (benign)' : 'FAIL (defect)';
  const dominant = pass
    ? 'No evidence of forced extra full-team round before opponents act.'
    : 'Forced start bias extends beyond intended opener (extra full-team round detected).';

  const out = {
    verdict,
    dominantFinding: dominant,
    summary,
    sampleTraces: {
      ambush: ambushSamples.slice(0, 5),
      initiative: initiativeSamples.slice(0, 5),
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));

  const md = [
    '# ORKA-oyi Initiative Fairness Audit',
    '',
    `- Verdict: **${verdict}**`,
    `- Seed: \`${seed}\``,
    `- Samples: \`${SAMPLES_PER_MODE} per mode\` (ambush + initiative)`,
    `- Trace depth: \`${TRACE_TURNS} turns/sample\``,
    '',
    '## Summary',
    '',
    `- Ambush favored-start-first: ${(summary.byMode.ambush.favoredStartsFirstRate * 100).toFixed(2)}%`,
    `- Initiative favored-start-first: ${(summary.byMode.initiative.favoredStartsFirstRate * 100).toFixed(2)}%`,
    `- Ambush additional full-team round before opponent: ${(summary.byMode.ambush.additionalFullTeamRoundBeforeOpponentRate * 100).toFixed(2)}%`,
    `- Initiative additional full-team round before opponent: ${(summary.byMode.initiative.additionalFullTeamRoundBeforeOpponentRate * 100).toFixed(2)}%`,
    `- Ambush avg favored turns before opponent: ${summary.byMode.ambush.averageFavoredTurnsBeforeOpponent.toFixed(3)}`,
    `- Initiative avg favored turns before opponent: ${summary.byMode.initiative.averageFavoredTurnsBeforeOpponent.toFixed(3)}`,
    `- Suspicious consecutive same-UID turns (ratio check fail): ${summary.byMode.ambush.suspiciousConsecutiveSameUidEvents + summary.byMode.initiative.suspiciousConsecutiveSameUidEvents}`,
    '',
    '## Interpretation',
    '',
    `- ${dominant}`,
    '- Consecutive same-UID turns can occur from initiative meter carryover; classify as legitimate only when actor SPD meets/exceeds SpeedDoubleRatio gate against fastest opponent.',
    '- If verdict is FAIL, open a follow-up bug for start-mode meter accumulation fairness in initiative override pool.',
    '',
    '## Artifact Links',
    '',
    `- JSON trace bundle: \`${path.relative(ROOT, OUT_JSON)}\``,
  ].join('\n');

  fs.writeFileSync(OUT_MD, md + '\n');

  console.log(JSON.stringify({ OUT_JSON, OUT_MD, verdict }, null, 2));
}

main();
