const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixturePath = path.join(__dirname, 'fixtures', 'single_hit_resolution_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');

function readFixtureCases() {
  const rows = fs.readFileSync(fixturePath, 'utf8').trim().split(/\r?\n/);
  return rows.slice(1).map((row) => {
    const [
      name,
      power,
      resist,
      roll01,
      critRoll01,
      sourceIsHero,
      heroAoe,
      chainActive,
      chainMultiplier,
      targetHp,
      shield,
      expectedDamage,
      expectedAppliedDamage,
      expectedAfterHp,
    ] = row.split(',');
    return {
      name,
      power: Number(power),
      resist: Number(resist),
      roll01: Number(roll01),
      critRoll01: Number(critRoll01),
      sourceIsHero: Number(sourceIsHero),
      heroAoe: Number(heroAoe),
      chainActive: Number(chainActive),
      chainMultiplier: Number(chainMultiplier),
      targetHp: Number(targetHp),
      shield: Number(shield),
      expectedDamage: Number(expectedDamage),
      expectedAppliedDamage: Number(expectedAppliedDamage),
      expectedAfterHp: Number(expectedAfterHp),
    };
  });
}

function applyScaledCrit({ baseValue, relevantBuffTotal, sourceIsHero, critRoll01 }) {
  const buff = Math.max(0, Number(relevantBuffTotal) || 0);
  let critMultiplierRaw = 1.1;
  if (buff > 0) {
    critMultiplierRaw = Math.min(1 + (buff / 10), 3);
  }
  critMultiplierRaw = Math.min(3, critMultiplierRaw);
  const critMultiplier = sourceIsHero
    ? critMultiplierRaw
    : 1 + ((critMultiplierRaw - 1) * 0.1);
  return Number(critRoll01) <= 0.1 ? baseValue * critMultiplier : baseValue;
}

function computeSingleHitDamage(testCase) {
  const roll = 0.8 + (Number(testCase.roll01) * 0.4);
  const sourceIsHero = Number(testCase.sourceIsHero) === 1;
  const heroAoe = Number(testCase.heroAoe) === 1;
  const rawDamage = sourceIsHero && !heroAoe
    ? Math.ceil((testCase.power - (testCase.resist * 0.35)) * roll)
    : Math.ceil((testCase.power - (testCase.resist / 2)) * roll);
  const baseDamage = Math.max(1, rawDamage);
  let damage = Math.max(1, Math.ceil(applyScaledCrit({
    baseValue: baseDamage,
    relevantBuffTotal: testCase.power,
    sourceIsHero,
    critRoll01: testCase.critRoll01,
  })));
  if (sourceIsHero && Number(testCase.chainActive) === 1) {
    damage = Math.ceil(damage * (Number(testCase.chainMultiplier) || 1));
  }
  return damage;
}

function computeAppliedDamage(testCase, incomingDamage) {
  const beforeHp = Number(testCase.targetHp);
  const incoming = Math.max(0, Number(incomingDamage || 0));
  const shieldAbsorbed = Math.min(Math.max(0, Number(testCase.shield || 0)), incoming);
  const damageToHp = Math.max(0, incoming - shieldAbsorbed);
  const afterHp = Math.max(0, beforeHp - damageToHp);
  return {
    appliedDamage: Math.max(0, beforeHp - afterHp),
    afterHp,
  };
}

test('single-hit resolution fixtures match the current JS combat formula', () => {
  for (const testCase of readFixtureCases()) {
    const damage = computeSingleHitDamage(testCase);
    const applied = computeAppliedDamage(testCase, damage);
    assert.equal(damage, testCase.expectedDamage, `${testCase.name} damage`);
    assert.equal(applied.appliedDamage, testCase.expectedAppliedDamage, `${testCase.name} applied damage`);
    assert.equal(applied.afterHp, testCase.expectedAfterHp, `${testCase.name} after HP`);
  }
});

test('Rust simulation core declares single-hit resolution shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /pub fn single_hit_damage/);
  assert.match(rustSrc, /extern "C" fn single_hit_damage_shadow/);
  assert.match(rustSrc, /extern "C" fn single_hit_applied_damage_shadow/);
  assert.match(rustSrc, /extern "C" fn single_hit_after_hp_shadow/);
});

test('static simulation core wasm matches single-hit resolution fixtures', async () => {
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  assert.equal(typeof exports.single_hit_damage_shadow, 'function');
  assert.equal(typeof exports.single_hit_applied_damage_shadow, 'function');
  assert.equal(typeof exports.single_hit_after_hp_shadow, 'function');

  for (const testCase of readFixtureCases()) {
    const rustDamage = exports.single_hit_damage_shadow(
      testCase.power,
      testCase.resist,
      testCase.roll01,
      testCase.critRoll01,
      testCase.sourceIsHero,
      testCase.heroAoe,
      testCase.chainActive,
      testCase.chainMultiplier,
    );
    const rustApplied = exports.single_hit_applied_damage_shadow(
      testCase.targetHp,
      rustDamage,
      testCase.shield,
    );
    const rustAfterHp = exports.single_hit_after_hp_shadow(
      testCase.targetHp,
      rustDamage,
      testCase.shield,
    );
    assert.equal(rustDamage, testCase.expectedDamage, `${testCase.name} wasm damage`);
    assert.equal(rustApplied, testCase.expectedAppliedDamage, `${testCase.name} wasm applied damage`);
    assert.equal(rustAfterHp, testCase.expectedAfterHp, `${testCase.name} wasm after HP`);
  }
});
