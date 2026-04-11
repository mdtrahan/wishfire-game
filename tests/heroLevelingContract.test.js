const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function xpToNext(level) {
  if (level >= 99) return 0;
  if (level <= 20) {
    const step = level - 1;
    return Math.max(1, Math.round(50 + (22 * step) + (1.35 * step * step)));
  }
  if (level <= 60) {
    return Math.max(1, Math.round(1000 + ((level - 21) * (6600 / 39))));
  }
  const step = level - 61;
  return Math.max(1, Math.round(8000 + (390 * step) + (42 * step * step)));
}

function xpPerKill(level, difficulty = 'normal') {
  const multiplier = difficulty === 'elite' ? 1.5 : 1;
  return Math.max(1, Math.round((8 + (level * 2)) * multiplier));
}

function buildRows(difficulty = 'normal', killsPerMinute = 10) {
  const rows = [];
  let totalXP = 0;
  for (let level = 1; level <= 99; level += 1) {
    const next = xpToNext(level);
    const perKill = xpPerKill(level, difficulty);
    const killsRequired = next > 0 ? next / perKill : 0;
    const timeToLevelMinutes = killsRequired / killsPerMinute;
    rows.push({ level, xpToNext: next, totalXP, xpPerKill: perKill, killsRequired, timeToLevelMinutes });
    totalXP += next;
  }
  return rows;
}

function sumTimeToLevel(rows, targetLevel) {
  return rows
    .filter((row) => row.level < targetLevel)
    .reduce((sum, row) => sum + row.timeToLevelMinutes, 0);
}

test('hero leveling curve helpers and kill-award seam exist in runtime and mirrored scripts banks', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /const HERO_LEVEL_CAP = 99;/);
    assert.match(src, /const HERO_XP_EARLY_LINEAR_GROWTH = 22;/);
    assert.match(src, /const HERO_XP_EARLY_ACCELERATION = 1\.35;/);
    assert.match(src, /const HERO_XP_MID_BASE_XP = 1000;/);
    assert.match(src, /const HERO_XP_MID_GROWTH_RATE = 6600 \/ 39;/);
    assert.match(src, /const HERO_XP_LATE_BASE_XP = 8000;/);
    assert.match(src, /const HERO_XP_LATE_LINEAR_GROWTH = 390;/);
    assert.match(src, /const HERO_XP_LATE_ACCELERATION = 42;/);
    assert.match(src, /const HERO_KILL_XP_DIFFICULTY_MULTIPLIERS = Object\.freeze\(\{\s*normal: 1,\s*elite: 1\.5,\s*\}\);/s);
    assert.match(src, /export function GetHeroXPToNextLevel\(level\)/);
    assert.match(src, /export function GrantHeroXP\(ctx, heroRef, amount, source = 'unspecified', options = undefined\)/);
    assert.match(src, /export function GetHeroKillXPRewardForLevel\(level, difficulty = 'normal'\)/);
    assert.match(src, /export function SimulateHeroLevelingProgress\(options = \{\}\)/);
    assert.match(src, /const awardKillerUID = Number\(killerUID \|\| GetCurrentTurn\(ctx\) \|\| 0\);/);
    assert.match(src, /const killXP = GetHeroKillXPReward\(ctx, awardKillerUID, 'normal'\);/);
    assert.match(src, /GrantHeroXP\(ctx, awardKillerUID, killXP, 'enemy_kill', \{/);
  }
});

test('hero leveling curve is strictly increasing through level 98', () => {
  let previous = 0;
  for (let level = 1; level <= 98; level += 1) {
    const next = xpToNext(level);
    assert.ok(next > previous, `xp curve is not increasing at level ${level}`);
    previous = next;
  }
});

test('normal difficulty pacing preserves early and mid totals while extending late-game total time', () => {
  const rows = buildRows('normal', 10);
  const level20 = sumTimeToLevel(rows, 20);
  const level60 = sumTimeToLevel(rows, 60);
  const level99 = sumTimeToLevel(rows, 99);
  const lateTotal = level99 - level60;

  assert.equal(Number(level20.toFixed(2)), 23.86);
  assert.equal(Number(level60.toFixed(2)), 202.01);
  assert.ok(level20 >= 20 && level20 <= 30, `level 20 total out of band: ${level20}`);
  assert.ok(level60 >= 180 && level60 <= 300, `level 60 total out of band: ${level60}`);
  assert.ok(lateTotal >= 600 && lateTotal <= 840, `late total out of band: ${lateTotal}`);
  assert.equal(Number(level99.toFixed(2)), 946.10);
});

test('elite difficulty reward rate stays deterministic and faster than normal at every level', () => {
  const normalRows = buildRows('normal', 10);
  const eliteRows = buildRows('elite', 10);

  for (let index = 0; index < normalRows.length; index += 1) {
    assert.ok(eliteRows[index].xpPerKill >= normalRows[index].xpPerKill, `elite xp_per_kill regressed at level ${normalRows[index].level}`);
    assert.ok(eliteRows[index].timeToLevelMinutes <= normalRows[index].timeToLevelMinutes, `elite pacing slower at level ${normalRows[index].level}`);
  }
});
