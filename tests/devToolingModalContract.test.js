const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const paramsStart = src.indexOf('(', start);
  assert.notEqual(paramsStart, -1, `missing params for ${name}`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = paramsStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(') parenDepth += 1;
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  assert.notEqual(paramsEnd, -1, `unterminated params for ${name}`);
  const braceStart = src.indexOf('{', paramsEnd);
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

test('dev tooling runtime owns modal/config while app keeps restart wiring', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js');
  const devHooksPath = path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js');
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const devHooksSrc = fs.readFileSync(devHooksPath, 'utf8');
  const src = `${runtimeSrc}\n${appSrc}\n${devHooksSrc}`;

  assert.match(appSrc, /createDevToolingRuntime\(\{/);
  assert.match(appSrc, /function ensureDevToolingConfig\(\) \{\n  return requireDevToolingRuntime\(\)\.ensureDevToolingConfig\(\);\n\}/);
  assert.doesNotMatch(appSrc, /Dev Tooling Modal/);
  assert.doesNotMatch(appSrc, /devToolingDom\.launcher\.addEventListener/);
  assert.match(runtimeSrc, /export function createDevToolingRuntime\(deps = \{\}\)/);
  assert.match(runtimeSrc, /const DEV_TOOL_HOTKEY_LABEL = 'Ctrl\+Shift\+P';/);
  assert.match(runtimeSrc, /let devToolingDom = null;/);
  assert.match(runtimeSrc, /function createDefaultDevToolingConfig\(\)/);
  assert.match(runtimeSrc, /function ensureDevToolingConfig\(\)/);
  assert.match(appSrc, /window\.addEventListener\('keydown', handleGlobalKeydown, true\);/);
  assert.match(appSrc, /registerDevBrowserTestHooks\(\{/);
  assert.match(devHooksSrc, /export function registerDevBrowserTestHooks\(\{/);
  assert.match(src, /devToolingDom\.launcher\.addEventListener\('click', \(\) => toggleDevToolingModal\(true\)\);/);
  assert.doesNotMatch(src, /data-devtool-status/);
  assert.doesNotMatch(src, /Global runtime controls\. Hotkey:/);
  assert.match(src, /Apply &amp; Refresh/);
  assert.match(src, /data-devtool-restart/);
  assert.match(src, /Speed Link Fixture/);
  assert.doesNotMatch(runtimeSrc, /Skill Draw Hero UID|Force Draw|Clear Skills|data-devtool-skill-id|Skill ID Legend/);
  assert.match(src, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(src, /data-devtool-control-grid/);
  assert.match(src, /#orka-dev-tooling-modal button \{/);
  assert.match(src, /appearance:none/);
  assert.match(src, /display:inline-flex/);
  assert.match(src, /white-space:nowrap/);
  assert.match(src, /user-select:none/);
  assert.match(src, /data-devtool-button-row/);
  assert.match(src, /align-items:center/);
  assert.match(src, /flex-wrap:wrap/);
  const modalSrc = extractFunctionSource(runtimeSrc, 'ensureDevToolingModal');
  const closeButtonIndex = modalSrc.indexOf('data-devtool-close');
  const actionRowIndex = modalSrc.indexOf('data-devtool-button-row');
  const settingsGridIndex = modalSrc.indexOf('<div data-devtool-control-grid');
  assert.ok(
    closeButtonIndex < actionRowIndex && actionRowIndex < settingsGridIndex,
    'the action-button group must sit below Close and above every settings control',
  );
  assert.doesNotMatch(runtimeSrc, /turn-order-qa|refreshCombatTurnQaReadout|renderCombatTurnQaReadoutHtml/);
  assert.doesNotMatch(runtimeSrc, /data-devtool-autoplay|setAutoplayHandler|DevAutoplay/);
  assert.match(src, /data-devtool-double-attack-hero/);
  assert.match(src, /devToolingDom\.apply\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ closeModal: true \}\)\);/);
  assert.match(src, /devToolingDom\.refresh\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ closeModal: false \}\)\);/);
  assert.match(src, /devToolingDom\.restart\.addEventListener\('click', async \(\) => devToolingControls\.handleRestartClick\(\{/);
  assert.doesNotMatch(src, /devToolingDom\.autoplay|data-devtool-autoplay|setAutoplayHandler/);
  assert.match(src, /function syncConfiguredDoubleAttackHarness\(cfg = ensureDevToolingConfig\(\)\)/);
  assert.match(src, /DevSpeedLinkFixture/);
  assert.match(src, /fastestEnemySpeed \* 2/);
  assert.match(src, /speedFixtureChanged/);
  assert.match(src, /if \(activeLayoutId === 'combat' && typeof devToolingRefreshHandler === 'function'\) \{/);
  assert.match(src, /await devToolingRefreshHandler\(\{ forceCombat: false, resetGame: false \}\);/);
  assert.match(src, /Combat state unchanged/);
  assert.match(src, /config: ensureDevToolingConfig\(\)/);
  assert.match(src, /async function applyDevToolingConfig\(patch = \{\}, \{ closeModal = true \} = \{\}\)/);
  assert.match(src, /const resetCfg = createDefaultDevToolingConfig\(\);/);
  assert.match(src, /state\.globals\.DevToolingConfig = resetCfg;/);
  assert.match(src, /function clearPersistedDevToolingConfig\(\)/);
  assert.match(src, /window\.sessionStorage\.removeItem\(DEV_TOOLING_STORAGE_KEY\);/);
  assert.match(src, /function hardRestartRuntimeFromDevTooling\(\)/);
  assert.match(appSrc, /function hardRestartRuntimeFromDevTooling\(\) \{\n  return requireDevToolingRuntime\(\)\.hardRestartRuntimeFromDevTooling\(\);\n\}/);
  assert.match(runtimeSrc, /hardRestartRuntimeFromDevTooling,\n    toggleDevToolingModal,/);
  assert.match(src, /cleanUrl\.search = '';/);
  assert.match(src, /cleanUrl\.hash = '';/);
  assert.match(src, /window\.location\.replace\(cleanUrl\.href\);/);
  assert.match(src, /window\.location\.reload\(\)/);
  assert.doesNotMatch(src, /requestLayoutChange\('storyMock', 'dev-tool-restart'\)/);
  assert.doesNotMatch(src, /forceCombat = true;/);
  assert.doesNotMatch(src, /persistDevToolingConfig\(\{ \.\.\.resetCfg, open: false \}\);/);
  assert.doesNotMatch(src, /applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ refreshGame:/);
  assert.doesNotMatch(src, /applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ resetGame:/);
  assert.match(src, /Speed Link Fixture: \$\{next\.doubleAttackHeroName \|\| 'Off'\}/);

  const resetBlock = extractFunctionSource(appSrc, 'refreshCombatSessionFromDevTooling');
  assert.match(resetBlock, /if \(resetGame\) \{[\s\S]*return hardRestartRuntimeFromDevTooling\(\);[\s\S]*\}/);
  assert.ok(
    resetBlock.indexOf('return hardRestartRuntimeFromDevTooling();') < resetBlock.indexOf('const activeLayoutId'),
    'resetGame must hard-restart before layout-specific refresh logic',
  );
  assert.ok(
    resetBlock.indexOf('return hardRestartRuntimeFromDevTooling();') < resetBlock.indexOf('requestLayoutChange'),
    'resetGame must hard-restart before layout change logic',
  );
});

test('dev tooling restart helper owns restart button labels and reset delegation', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingControls.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /export function getAutoplayButtonLabel\(autoplayActive\)/);
  assert.match(src, /return autoplayActive \? 'Stop AutoPlay' : 'AutoPlay';/);
  assert.match(src, /export async function handleRestartClick\(\{/);
  assert.match(src, /closeDevToolingModal\(\{ restorePauseSnapshot: true \}\);/);
  assert.match(src, /const restarted = await devToolingRefreshHandler\(\{ resetGame: true \}\);/);
  assert.match(src, /updateDevToolingStatus\('Game restart unavailable'\);/);
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js'), 'utf8');
  assert.match(runtimeSrc, /window\.location\.reload\(\)/);
});

test('editable dev tooling fields bypass gameplay keyboard shortcuts', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const keydownSrc = extractFunctionSource(src, 'handleGlobalKeydown');

  assert.match(
    keydownSrc,
    /if \(ensureDevToolingConfig\(\)\.open\) \{[\s\S]*if \(!isEditableDomTarget\(ev\.target\)\) \{[\s\S]*return;[\s\S]*\}\s*return;\s*\}/,
  );
  assert.doesNotMatch(keydownSrc, /handleGemMatch/);
  assert.doesNotMatch(keydownSrc, /hero-commands/);
});

test('dev hooks omit retired turn-order, initiative, and autoplay QA controls', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js'), 'utf8');
  assert.doesNotMatch(src, /DynamicInitiativeAuthority|setupDynamicInitiative|DYNAMIC_INITIATIVE_AUTHORITY/);
  assert.doesNotMatch(src, /runDevAutoplayUntilDepleted|stopDevAutoplay|getDevAutoplayState/);
});

test('dev tooling pause preserves realtime state and resumes without turn-input repair', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const pauseSrc = extractFunctionSource(src, 'pauseGameplayForDevTooling');
  const resumeSrc = extractFunctionSource(src, 'resumeGameplayFromDevTooling');
  assert.match(pauseSrc, /devToolingPauseSnapshot = \{\};/);
  assert.match(pauseSrc, /state\.globals\.DevToolingPaused = 1;/);
  assert.doesNotMatch(pauseSrc, /CanPickGems|IsPlayerBusy|DeferAdvance|TurnSerial|applyTurnGateGlobals/);
  assert.match(resumeSrc, /state\.globals\.DevToolingPaused = 0;\s*clearDevToolingPauseSnapshot\(\);/);
  assert.doesNotMatch(resumeSrc, /TurnSerial|CanPickGems|applyTurnGateGlobals|restorePlayableHeroInput/);
  assert.doesNotMatch(src, /restorePlayableHeroInputAfterDevToolingResume/);
});

test('startup preload can prepare combat assets while story mock is active', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const initializerSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'combatSessionInitializer.js'), 'utf8');
  const preloadSrc = extractFunctionSource(src, 'loadC3ProjectAssets');
  const prepareSrc = extractFunctionSource(src, 'prepareCombatSetupFromInstances');

  assert.doesNotMatch(preloadSrc, /assertCombatLayoutDev\('loadC3ProjectAssets'\)/);
  assert.doesNotMatch(prepareSrc, /assertCombatLayoutDev\('prepareCombatSetupFromInstances'\)/);
  assert.match(src, /createCombatSessionInitializer/);
  assert.match(initializerSrc, /assertCombatLayoutDev\('initEntities'\)/);
  assert.doesNotMatch(src, /function createGemBoard\(/);
  assert.match(src, /assertCombatLayoutDev\('StartRound'\)/);
});

test('runtime render scope includes board integrity helper used by extracted runtime', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');
  const appSrc = fs.readFileSync(filePath, 'utf8');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const drawFrameSrc = extractFunctionSource(appSrc, 'drawFrame');

  assert.match(runtimeSrc, /assertBoardIntegrity\(/);
  assert.match(drawFrameSrc, /const runtimeScope = \{/);
  assert.match(drawFrameSrc, /assertBoardIntegrity,/);
});

test('runtime render scope includes gem gate snapshot helper used by extracted runtime', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');
  const appSrc = fs.readFileSync(filePath, 'utf8');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const drawFrameSrc = extractFunctionSource(appSrc, 'drawFrame');

  assert.match(runtimeSrc, /getGemGateSnapshot\(/);
  assert.match(drawFrameSrc, /getGemGateSnapshot,/);
});

test('debug gem diagnostics do not mutate timing samples unless explicitly requested', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');
  const appSrc = fs.readFileSync(filePath, 'utf8');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');

  assert.doesNotMatch(appSrc, /GEM_INTERACTIVITY_DIAGNOSTIC_QUERY|runGemInteractivityDiagnostic|gemdiag/);
  assert.match(appSrc, /const boardIntegrityLog = ok \? console\.log : console\.error;/);
  assert.match(runtimeSrc, /state\.globals\.IsPlayerBusy === 0 &&\\n\s+!state\.globals\.DeferAdvance &&\\n\s+!state\.globals\.AdvanceAfterAction;/);
  assert.doesNotMatch(runtimeSrc, /GATE_STUCK_AFTER_REFILL[\s\S]*state\.globals\.CanPickGems = true;/);
  assert.doesNotMatch(runtimeSrc, /console\.error\('\[GATE_STUCK_AFTER_REFILL\]'/);
});


test('combat end clears staged dev overrides while preserving gold', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(__dirname, '../web-runner/systems/devToolingRuntime.js'), 'utf8')
    .replace(/^import .*;$/gm, '')
    .replace(/export \{[\s\S]*?\};/, '')
    .replace('export function createDevToolingRuntime', 'function createDevToolingRuntime');
  const removed = [];
  const calls = [];
  const context = vm.createContext({
    window: { addEventListener() {}, sessionStorage: { removeItem: key => removed.push(key) } },
    document: { getElementById: () => null },
    normalizeCombatOrientation: () => 'rtl',
  });
  vm.runInContext(src, context);
  const state = { globals: { goldTotal: 4321,
    DevToolingConfig: { combatSpeed: 4, boardGemColor: 1, goldAmount: 0 },
    DevForcedEnemyType: 'boss', DevToolingPaused: 1 }, entities: [] };
  const runtime = context.createDevToolingRuntime({ state, gameState: {},
    CANONICAL_HERO_ROSTER: [{ name: 'Hero' }],
    callFunctionWithContext: (_, name) => calls.push(name),
  });
  runtime.clearCombatSessionOverrides();
  const g = state.globals;
  assert.equal(g.goldTotal, 4321);
  assert.equal(g.DevToolingConfig.goldAmount, 4321);
  assert.equal(g.DevCombatSpeedMultiplier, 1);
  assert.equal(g.DevForcedBoardColor, -1);
  assert.equal(g.DevForcedEnemyType, '');
  assert.equal(g.DevToolingPaused, 0);
  assert.equal(g.DevDoubleAttackHolderUID, 0);
  assert.equal(g.DevRewardDrops.length, 0);
  assert.equal(g.DevEnemySlots.join(','), '__RANDOM__,__RANDOM__,__RANDOM__');
  assert.deepEqual(removed, ['orka.dev_tooling_config.v1']);
  assert.ok(!calls.includes('ClearSessionSkillDraught'));
});

test('Speed Link Fixture uses the existing dev selector to force one two-times-Speed threshold', async () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(__dirname, '../web-runner/systems/devToolingRuntime.js'), 'utf8')
    .replace(/^import .*;$/gm, '')
    .replace(/export \{[\s\S]*?\};/, '')
    .replace('export function createDevToolingRuntime', 'function createDevToolingRuntime');
  const context = vm.createContext({ window: { addEventListener() {}, sessionStorage: { setItem() {} } }, document: { getElementById: () => null }, normalizeCombatOrientation: () => 'left-wise' });
  vm.runInContext(src, context);
  const state = { globals: { CombatOrientation: 'left-wise', DevToolingConfig: {} }, entities: [
    { uid: 1, kind: 'hero', name: 'Hondo', hp: 40, stats: { SPD: 11 } },
    { uid: 101, kind: 'enemy', hp: 40, stats: { SPD: 13 } },
  ] };
  let refreshCalls = 0;
  const runtime = context.createDevToolingRuntime({
    state, gameState: {}, CANONICAL_HERO_ROSTER: [{ name: 'Hondo' }],
    callFunctionWithContext() {}, getLayoutState: () => ({ getActiveLayoutId: () => 'combat' }),
  });
  runtime.setRefreshHandler(async () => { refreshCalls += 1; });
  await runtime.applyDevToolingConfig({ doubleAttackHeroName: 'Hondo' }, { closeModal: false });
  assert.equal(state.entities[0].stats.SPD, 26);
  assert.deepEqual(JSON.parse(JSON.stringify(state.globals.DevSpeedLinkFixture)), {
    holderUID: 1, holderName: 'Hondo', baseSpeed: 11, fastestEnemySpeed: 13, linkedSpeed: 26,
  });
  assert.equal(refreshCalls, 1, 'Apply & Refresh can stage Hondo through the existing Speed Link Fixture selector');
  await runtime.applyDevToolingConfig({ doubleAttackHeroName: '' }, { closeModal: false });
  assert.equal(state.entities[0].stats.SPD, 11);
  assert.equal(state.globals.DevSpeedLinkFixture, null);
});
