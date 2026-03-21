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
  claimIdleFarmRewardsFromState,
  applyIdleFarmRewardsToGlobals,
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

test('idle farm collect converts stored energy rewards into player energy and remembers the collect payload', () => {
  const { claimIdleFarmRewardsFromState, applyIdleFarmRewardsToGlobals } = loadIdleFarmHelpers();
  const layoutState = {
    rewardLedger: {
      unclaimedEnergy: 7,
      claimedEnergyTotal: 0,
      unclaimedTokens: { SAND: 2, BONE_CHIP: 0, SLIME: 0, HORN: 0, SHELL: 0 },
      claimedTokensTotal: { SAND: 0, BONE_CHIP: 0, SLIME: 0, HORN: 0, SHELL: 0 },
    },
  };
  const globals = {
    Player_Energy: 5,
    TokenWallet: {},
  };

  const claimed = claimIdleFarmRewardsFromState(layoutState);
  const applied = applyIdleFarmRewardsToGlobals(globals, claimed);

  assert.equal(claimed.energy, 7);
  assert.equal(applied.energy, 7);
  assert.equal(globals.Player_Energy, 12);
  assert.equal(layoutState.rewardLedger.unclaimedEnergy, 0);
  assert.equal(layoutState.rewardLedger.claimedEnergyTotal, 7);
  assert.equal(globals.IdleFarmLastCollect.energy, 7);
  assert.equal(globals.TokenWallet.SAND, 2);
});

test('idle farm reward ledger migrates legacy gold fields into energy on collect', () => {
  const { claimIdleFarmRewardsFromState } = loadIdleFarmHelpers();
  const layoutState = {
    rewardLedger: {
      unclaimedGold: 3,
      claimedGoldTotal: 4,
      unclaimedTokens: { SAND: 0, BONE_CHIP: 0, SLIME: 0, HORN: 0, SHELL: 0 },
      claimedTokensTotal: { SAND: 0, BONE_CHIP: 0, SLIME: 0, HORN: 0, SHELL: 0 },
    },
  };

  const claimed = claimIdleFarmRewardsFromState(layoutState);

  assert.equal(claimed.energy, 3);
  assert.equal(layoutState.rewardLedger.unclaimedEnergy, 0);
  assert.equal(layoutState.rewardLedger.claimedEnergyTotal, 7);
  assert.ok(!('unclaimedGold' in layoutState.rewardLedger));
  assert.ok(!('claimedGoldTotal' in layoutState.rewardLedger));
});
