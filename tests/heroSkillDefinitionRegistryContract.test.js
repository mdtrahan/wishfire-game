const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
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

test('canonical skill registry exposes all hero and party definitions without payloads', () => {
  const src = fs.readFileSync(runtimePath, 'utf8');
  const requiredExports = [
    'GetHeroSkillDefinitions',
    'GetPartySkillDefinitions',
    'GetSkillDefinition',
    'GetHeroSkillDefinitionCardsForHero',
  ];
  for (const name of requiredExports) {
    assert.match(src, new RegExp(`export function ${name}\\(`), `missing ${name}`);
  }

  const heroSkillIds = [
    'falie_ward_bash',
    'falie_cover_block',
    'falie_reprisal_bounce',
    'falie_phalanx',
    'huun_bell',
    'huun_glare',
    'huun_trinity',
    'huun_growth',
    'runa_aura_totem_blast',
    'runa_aura_totem_burn',
    'runa_invert',
    'runa_intensify',
    'kojonn_lock',
    'kojonn_lift',
    'kojonn_step',
    'kojonn_elevate',
  ];
  for (const id of heroSkillIds) {
    assert.match(src, new RegExp(`id: '${id}'`), `missing hero skill ${id}`);
  }

  const partySkillIds = [
    'party_fresh_start',
    'party_second_chance',
    'party_momentum',
    'party_guard_rail',
    'party_blue_spark',
    'party_weaken',
    'party_destiny',
    'party_hot_streak',
    'party_last_push',
    'party_chain_pop',
  ];
  for (const id of partySkillIds) {
    assert.match(src, new RegExp(`id: '${id}'`), `missing party skill ${id}`);
  }

  assert.match(src, /payloadImplemented: false/);
  assert.match(src, /growth: \[6, 6, 7, 8\]/);
  assert.match(src, /procPattern: 'On defend'/);
});

test('hero skill progress config uses canonical ids and no placeholder slots', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');
  for (const src of [runtimeSrc, scriptsSrc]) {
    const configSrc = extractFunctionSource(src, 'getHeroSkillProgressConfigForHero');
    assert.doesNotMatch(configSrc, /skill1|skill2|skill3/i);
    assert.doesNotMatch(configSrc, /Placeholder/i);
    assert.match(configSrc, /getHeroSkillDefinitionsForOwner/);
    assert.match(configSrc, /definitionId/);
  }
});

test('registry bead does not wire canonical definitions into unfinished hero skill cards', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const cardsSrc = extractFunctionSource(appSrc, 'getHeroScreenSkillCards');
  assert.doesNotMatch(cardsSrc, /GetHeroSkillDefinitionCardsForHero/);
});
