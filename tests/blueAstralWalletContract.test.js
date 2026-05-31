const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function loadSuperGemRuntime() {
  const src = read('web-runner/systems/superGemRuntime.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

test('blue resolve increments Astral Flow wallet in runtime function bank', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /function ensureAstralFlowWallet\(ctx\)/);
  assert.match(src, /resolveGemActionCompat/);
  assert.match(src, /__ORKA_GEM_ACTION_OWNER__/);
  assert.match(src, /const consumedBlue = Math\.max\(0, Number\(decision\.consumedCount \|\| 0\)\);/);
  assert.match(src, /g\.AstralFlowWallet = Number\(decision\.blueWalletAfter \|\| 0\);/);
});

test('blue match forwards consumed gem count into runtime resolution', () => {
  const appSrc = read('web-runner/app.js');
  assert.match(appSrc, /const consumedBlue = Array\.isArray\(gameState\.selectedGems\) \? gameState\.selectedGems\.length : 0;/);
  assert.match(appSrc, /callFunctionWithContext\(fnContext, 'ResolveGemAction', 2, actorUID, consumedBlue\);/);
});

test('blue supergem opens one skill draw without resolving Astral Flow', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const state = {
    globals: {
      time: 12,
      RuntimeRandom: () => 0.5,
      AstralFlowWallet: 7,
      AstralFlowAmpPoints: 11,
      AstralFlowAmpReady: 0,
    },
  };
  const sourceItems = [{ x: 1, y: 2, color: 2 }];
  const calls = [];
  let mergeFx = null;
  const activated = activateSuperGemEffect({
    superGem: { baseColor: 2 },
    actorUID: 42,
    selectedEnemyUID: 0,
    state,
    callFunctionWithContext: (_ctx, name, ...args) => {
      calls.push({ name, args });
      if (name === 'ResolveGemAction') {
        state.globals.AstralFlowWallet += Number(args[2] || 0);
        state.globals.AstralFlowAmpPoints += Number(args[2] || 0);
      }
      if (name === 'OpenSkillDraughtForHero') {
        state.globals.SkillDraughtOpen = 1;
        state.globals.SkillDraughtHeroUID = args[0];
        return { ok: true };
      }
      return undefined;
    },
    fnContext: {},
    sourceItems,
    consumedColorGemCount: 99,
    startGemMergeFx: (args) => { mergeFx = args; },
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, true);
  assert.equal(mergeFx.sourceItems, sourceItems);
  assert.equal(Object.keys(mergeFx).length, 1);
  assert.deepEqual(calls.filter(call => call.name === 'OpenSkillDraughtForHero').map(call => call.args), [[42]]);
  assert.equal(calls.some(call => call.name === 'ResolveGemAction'), false);
  assert.equal(state.globals.AstralFlowWallet, 7);
  assert.equal(state.globals.AstralFlowAmpPoints, 11);
  assert.equal(state.globals.AstralFlowAmpReady, 0);
  assert.equal(state.globals.SkillDraughtOpen, 1);
  assert.equal(state.globals.SkillDraughtHeroUID, 42);
  assert.equal(state.globals.CanPickGems, 0);
  assert.equal(state.globals.IsPlayerBusy, 0);
  assert.equal(state.globals.ActionOwnerUID, 42);
  assert.equal(state.globals.ActionLockUntil, 12.32);
  assert.equal(state.globals.DeferAdvance, 1);
  assert.equal(state.globals.AdvanceAfterAction, 1);
});

test('gem match actor ownership falls back to selected hero when current turn is not a hero', () => {
  const appSrc = read('web-runner/app.js');
  assert.match(appSrc, /const currentTurnUID = Number\(callFunctionWithContext\(fnContext, 'GetCurrentTurn'\) \|\| 0\);/);
  assert.match(appSrc, /const currentTurnActor = currentTurnUID > 0 \? callFunctionWithContext\(fnContext, 'GetActorByUID', currentTurnUID\) : null;/);
  assert.match(appSrc, /const actorUID = currentTurnActor && currentTurnActor\.kind === 'hero'\s*\? currentTurnUID\s*:\s*\(getHeroUIDByIndex\(gameState\.selectedHero\) \|\| gameState\.selectedHero \|\| currentTurnUID\);/);
});

test('blue roll path is gated from direct stat-skill apply by default', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /g\.BuffRollApplyStat = 0;/);
  assert.match(src, /if \(g\.BuffRollApplyStat === 1 && g\.BuffRollSkillID\) \{/);
});

test('astral wallet is surfaced in runtime state and off-screen output panel', () => {
  const stateSrc = read('web-runner/modules/state.js');
  const appSrc = read('web-runner/app.js');
  const hudSrc = read('web-runner/systems/renderHUD.js');
  assert.match(stateSrc, /AstralFlowWallet: 0,/);
  assert.match(appSrc, /const astralWalletOut = document\.getElementById\('astral-wallet-output'\);/);
  assert.match(hudSrc, /export function drawAstralWalletHUD\(\{ astralWalletOut, stateGlobals \}\) \{/);
  assert.match(hudSrc, /astralWalletOut\.textContent = `Astral Flow Wallet:\\nTotal: \$\{total\}`;/);
});
