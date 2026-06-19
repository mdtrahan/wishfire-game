const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const activePartyDrawIds = [
  'party_crimson_ward',
  'party_magic_fruit',
  'party_destiny',
  'party_faze',
  'party_grow',
  'party_chain_strike_i',
];

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

test('active party draw definitions expose mirrored class metadata through public APIs', () => {
  for (const filePath of [runtimePath, scriptsPath]) {
    const original = fs.readFileSync(filePath, 'utf8');
    const transformed = `${original
      .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
      .replace(/\bexport\s+/g, '')}

module.exports = {
  GetPartySkillDefinitions,
  GetSkillDefinition,
};`;
    const context = {
      console,
      Math,
      module: { exports: {} },
      exports: {},
      state: { globals: {}, entities: [] },
    };
    require('node:vm').runInNewContext(transformed, context, { filename: filePath });
    const mod = context.module.exports;
    const allowedClasses = new Set(['one_off', 'tiered', 'repeatable']);
    const expectedClasses = {
      party_crimson_ward: 'repeatable',
      party_magic_fruit: 'repeatable',
      party_destiny: 'one_off',
      party_faze: 'repeatable',
      party_grow: 'tiered',
      party_chain_strike_i: 'one_off',
    };
    const partyDefs = mod.GetPartySkillDefinitions();

    for (const id of activePartyDrawIds) {
      const def = partyDefs.find(row => row.id === id);
      assert.ok(def, `${id} should be in party registry`);
      assert.equal(def.drawClass, expectedClasses[id]);
      assert.ok(allowedClasses.has(def.drawClass), `${id} has invalid drawClass`);
      assert.equal(typeof def.selection.sessionBucket, 'string');
      assert.equal(typeof def.selection.duplicatePolicy, 'string');
      assert.equal(typeof def.trigger.event, 'string');
      assert.equal(typeof def.effect.kind, 'string');
      assert.equal(typeof def.qa.proof, 'string');

      const single = mod.GetSkillDefinition(null, id);
      assert.deepEqual(single.selection, def.selection);
      assert.deepEqual(single.trigger, def.trigger);
      assert.deepEqual(single.effect, def.effect);
      assert.deepEqual(single.qa, def.qa);
      assert.equal(single.drawClass, def.drawClass);

      def.selection.duplicatePolicy = 'mutated_in_test';
      assert.notEqual(mod.GetSkillDefinition(null, id).selection.duplicatePolicy, 'mutated_in_test');
    }
  }
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
