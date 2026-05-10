const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const statePath = path.join(__dirname, '..', 'web-runner', 'modules', 'state.js');

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const exportedMarker = `export function ${name}(`;
  let start = src.indexOf(exportedMarker);
  if (start === -1) start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('skill proc helper state is session-scoped and initialized with combat globals', () => {
  const stateSrc = fs.readFileSync(statePath, 'utf8');
  assert.match(stateSrc, /HeroTempSkillStateByUID: \{\},/);
  assert.match(stateSrc, /SessionSkillPassivesByHeroUID: \{\},/);
  assert.match(stateSrc, /SkillProcTrace: \[\],/);
  assert.match(stateSrc, /SkillProcTraceSeq: 0,/);
});

test('runtime exposes mirrored skill proc and event helper seams', () => {
  const requiredExports = [
    'GetHeroSkillGrowthValue',
    'RollHeroSkillProc',
    'GetSkillProcTrace',
    'SetHeroTempSkillState',
    'GetHeroTempSkillState',
    'ExpireHeroTempSkillState',
    'AddSessionPassive',
    'GetSessionPassiveTotal',
    'IsHeroSessionSkillActive',
  ];

  for (const filePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(filePath, 'utf8');
    for (const name of requiredExports) {
      assert.match(src, new RegExp(`export function ${name}\\(`), `missing ${name} in ${filePath}`);
    }
  }
});

test('proc roll rejects missing and locked skills before deterministic chance rolls', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const rollSrc = extractFunctionSource(runtimeSrc, 'RollHeroSkillProc');
  assert.match(rollSrc, /skill_not_found/);
  assert.match(rollSrc, /skill_locked/);
  assert.match(rollSrc, /random01\(ctx\)/);
  assert.match(rollSrc, /rollPct <= chancePct/);
  assert.match(rollSrc, /appendSkillProcTrace/);
});

test('growth value resolves rank-based chance from canonical skill growth', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const growthSrc = extractFunctionSource(runtimeSrc, 'GetHeroSkillGrowthValue');
  assert.match(growthSrc, /GetSkillDefinition\(ctx, skillRef\)/);
  assert.match(growthSrc, /GetHeroSkillState\(ctx, heroUID, skillId\)/);
  assert.match(growthSrc, /IsHeroSessionSkillActive\(ctx, heroUID, skillId\)/);
  assert.match(growthSrc, /definition\.growth/);
  assert.match(growthSrc, /rank - 1/);
});

test('trace, temp state, and passive helpers keep bounded session shapes', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const traceSrc = extractFunctionSource(runtimeSrc, 'appendSkillProcTrace');
  const tempSrc = extractFunctionSource(runtimeSrc, 'SetHeroTempSkillState');
  const expireSrc = extractFunctionSource(runtimeSrc, 'ExpireHeroTempSkillState');
  const passiveSrc = extractFunctionSource(runtimeSrc, 'AddSessionPassive');
  const passiveTotalSrc = extractFunctionSource(runtimeSrc, 'GetSessionPassiveTotal');

  assert.match(traceSrc, /SkillProcTraceSeq/);
  assert.match(traceSrc, /SkillProcTrace\.length > 120/);
  assert.match(tempSrc, /HeroTempSkillStateByUID/);
  assert.match(tempSrc, /expiresAt/);
  assert.match(expireSrc, /delete bucket\[key\]/);
  assert.match(passiveSrc, /SessionSkillPassivesByHeroUID/);
  assert.match(passiveSrc, /amount: Number\(amount \|\| 0\)/);
  assert.match(passiveTotalSrc, /reduce/);
});
