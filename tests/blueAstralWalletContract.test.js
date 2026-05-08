const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('blue resolve increments Astral Flow wallet in runtime function bank', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /function ensureAstralFlowWallet\(ctx\)/);
  assert.match(src, /const consumedBlue = Math\.max\(0, Number\(consumedCount\) \|\| 0\);/);
  assert.match(src, /g\.AstralFlowWallet = wallet \+ consumedBlue;/);
});

test('blue match forwards consumed gem count into runtime resolution', () => {
  const appSrc = read('web-runner/app.js');
  assert.match(appSrc, /const consumedBlue = Array\.isArray\(gameState\.selectedGems\) \? gameState\.selectedGems\.length : 0;/);
  assert.match(appSrc, /callFunctionWithContext\(fnContext, 'ResolveGemAction', 2, actorUID, consumedBlue\);/);
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
