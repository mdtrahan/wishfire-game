const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadIdleFarmHelpers() {
  const filePath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'idleFarmRuntime.mjs');
  const src = fs.readFileSync(filePath, 'utf8')
    .replace(/^import .*?;\n/gm, '')
    .replace(/\bexport\s+/g, '');
  const script = `${src}
module.exports = {
  createIdleFarmSessionState,
  updateIdleFarmSessionState,
};`;
  const context = {
    module: { exports: {} },
    exports: {},
    Math,
    Number,
    String,
    Array,
    Object,
    Map,
    EMPTY: 'EMPTY',
    MONSTER_KEYS: [],
    MONSTER_LOOT_TABLE: {},
    TOKEN: { SAND: 'SAND', BONE_CHIP: 'BONE_CHIP', SLIME: 'SLIME', HORN: 'HORN', SHELL: 'SHELL' },
    console,
  };
  vm.runInNewContext(script, context, { filename: 'idleFarmRuntime.mjs' });
  return context.module.exports;
}

test('idle farm update reuses stored forced enemy names during respawn without crashing', () => {
  const { createIdleFarmSessionState, updateIdleFarmSessionState } = loadIdleFarmHelpers();

  const layoutState = {
    config: {
      enemyNames: ['Djinn', 'Marid'],
      enemySlots: 2,
      secondEnemyChance: 1,
      hitsToKill: 1,
      enemySpawnDelaySec: 0.5,
      maxVisibleEnemies: 2,
    },
  };

  layoutState.session = createIdleFarmSessionState({
    config: layoutState.config,
    heroSlots: ['Falie', 'Huun'],
    fallbackRoster: [],
    enemyCatalog: [{ name: 'Skeleton' }],
    nowSec: 0,
  });

  layoutState.session.laneSpawnAtSec = [0, 0];
  updateIdleFarmSessionState(layoutState, {
    nowSec: 10,
    enemyCatalog: [{ name: 'Skeleton' }],
  });

  assert.equal(layoutState.session.enemies[0]?.name, 'Djinn');
  assert.equal(layoutState.session.enemies[1]?.name, 'Marid');
  assert.deepEqual(layoutState.session.forcedEnemyNames, ['Djinn', 'Marid']);
});
