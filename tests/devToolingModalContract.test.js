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
  assert.match(runtimeSrc, /import \{ renderCombatTurnQaReadoutHtml \} from '\.\/combatTurnQaReadout\.mjs';/);
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
  assert.match(src, /Save Staged/);
  assert.match(src, /data-devtool-restart/);
  assert.match(src, /Double Attack/);
  assert.match(src, /Skill Draw Hero UID/);
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
  assert.match(runtimeSrc, /function collectDevToolSkillLegendRows\(\)/);
  assert.match(runtimeSrc, /const DEV_TOOL_SKILL_ID_LEGEND = Object\.freeze\(\[/);
  assert.match(runtimeSrc, /party_magic_fruit/);
  assert.match(runtimeSrc, /party_crimson_ward/);
  assert.match(runtimeSrc, /party_split/);
  assert.match(runtimeSrc, /party_faze/);
  assert.match(runtimeSrc, /party_destiny/);
  assert.match(runtimeSrc, /party_chain_strike_i/);
  assert.match(runtimeSrc, /party_chain_strike_ii/);
  assert.match(runtimeSrc, /party_grow/);
  assert.doesNotMatch(runtimeSrc, /callFunctionWithContext\(fnContext, 'GetPartySkillDefinitions'\)/);
  assert.doesNotMatch(runtimeSrc, /GetHeroSkillDefinitions/);
  assert.doesNotMatch(runtimeSrc, /ownerFallback/);
  assert.doesNotMatch(runtimeSrc, /party_second_chance/);
  assert.doesNotMatch(runtimeSrc, /party_weaken/);
  assert.doesNotMatch(runtimeSrc, /party_blue_spark/);
  assert.doesNotMatch(runtimeSrc, /party_hot_streak/);
  assert.doesNotMatch(runtimeSrc, /party_momentum/);
  assert.doesNotMatch(runtimeSrc, /party_guard_rail/);
  assert.doesNotMatch(runtimeSrc, /party_chain_pop/);
  assert.match(runtimeSrc, /data-devtool-skill-legend/);
  assert.match(runtimeSrc, /data-devtool-turn-order-qa-slot/);
  assert.match(runtimeSrc, /function refreshCombatTurnQaReadout\(\)/);
  assert.match(runtimeSrc, /renderCombatTurnQaReadoutHtml\(\{/);
  assert.match(runtimeSrc, /Skill ID Legend/);
  assert.match(runtimeSrc, /data-devtool-button-row[\s\S]*\$\{renderDevToolSkillLegendHtml\(\)\}/);
  assert.match(src, /data-devtool-double-attack-hero/);
  assert.match(src, /devToolingDom\.apply\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ closeModal: true \}\)\);/);
  assert.match(src, /devToolingDom\.refresh\.addEventListener\('click', \(\) => applyDevToolingConfig\(readDevToolingDomConfigPatch\(\), \{ closeModal: false \}\)\);/);
  assert.match(src, /devToolingDom\.restart\.addEventListener\('click', async \(\) => devToolingControls\.handleRestartClick\(\{/);
  assert.match(src, /devToolingDom\.autoplay\.addEventListener\('click', async \(\) => \{/);
  assert.match(src, /closeDevToolingModal\(\{ restorePauseSnapshot: true \}\);/);
  assert.match(src, /function syncConfiguredDoubleAttackHarness\(cfg = ensureDevToolingConfig\(\)\)/);
  assert.match(src, /function syncIdleFarmDevLoadoutConfig\(cfg = ensureDevToolingConfig\(\)\)/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'ConfigureActorExtraTurnSkill', actor\.uid, \{/);
  assert.match(src, /syncIdleFarmDevLoadoutConfig\(next\);/);
  assert.match(src, /if \(activeLayoutId === 'combat' && typeof devToolingRefreshHandler === 'function'\) \{/);
  assert.match(src, /await devToolingRefreshHandler\(\{ forceCombat: false, resetGame: false \}\);/);
  assert.match(src, /else if \(activeLayoutId === 'idleFarmLayout'\) \{/);
  assert.match(src, /restartIdleFarmSession\(performance\.now\(\) \/ 1000\);/);
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
  assert.match(src, /Double Attack: \$\{next\.doubleAttackHeroName \|\| 'Off'\}/);

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
  assert.ok(
    keydownSrc.indexOf('return;\n    }\n    if (state.globals.DevTestMode)')
      < keydownSrc.indexOf("ev.code === 'KeyA'"),
    'editable modal targets must return before the KeyA gameplay shortcut',
  );
});

test('dev browser hooks expose an explicit dynamic initiative authority QA scenario', () => {
  const devHooksPath = path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js');
  const src = fs.readFileSync(devHooksPath, 'utf8');

  assert.match(src, /setupDynamicInitiativeAuthorityScenario/);
  assert.match(src, /DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID/);
  assert.match(src, /DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP/);
  assert.match(src, /DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT/);
  assert.match(src, /DynamicInitiativeAuthorityEnabled\s*=\s*1/);
  assert.match(src, /DynamicInitiativeAuthorityExperimentId\s*=\s*DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID/);
  assert.match(src, /DynamicInitiativeAuthoritySeed\s*=\s*DYNAMIC_INITIATIVE_AUTHORITY_SEED/);
  assert.match(src, /DynamicInitiativeAuthorityBattleId\s*=\s*DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID/);
  assert.match(src, /BattleStartClearedForSession\s*=\s*1/);
  assert.match(src, /CanPickGems\s*=\s*true/);
  assert.match(src, /const proofHeroSlots = \['Falie',\s*'Huun',\s*'Runa',\s*'Kojonn'\]/);
  assert.match(src, /const proofEnemySlots = \['Skeleton',\s*'Gobloc',\s*'Troll'\]/);
  assert.match(src, /heroSlots: proofHeroSlots/);
  assert.match(src, /enemySlots: proofEnemySlots/);
  assert.match(src, /boardGemColor:\s*1/);
  assert.match(src, /actor\.hp = DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP/);
  assert.match(src, /actor\.stats\.ATK = DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT/);
  assert.match(src, /const authorityEnemies = state\.entities[\s\S]*\.filter\(\(entity\) => entity && entity\.kind === 'enemy'\)[\s\S]*\.sort\(/);
  assert.match(src, /g\.EnemyIDs = \[/);
  assert.match(src, /g\.EnemySlots = \[/);
  assert.match(src, /g\.PendingEnemyRespawnSlots = \[0, 0, 0\];/);
  assert.match(src, /g\.PendingEnemyRespawnTimerActive = 0;/);
  assert.match(src, /scenario === 'dynamic-initiative-authority'/);
  assert.match(src, /scenario === 'dynamic-initiative'/);
});

test('dev tooling resume restores playable hero input when combat is idle', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const resumeSrc = extractFunctionSource(src, 'resumeGameplayFromDevTooling');
  const restoreSrc = extractFunctionSource(src, 'restorePlayableHeroInputAfterDevToolingResume');

  assert.match(resumeSrc, /applyTurnGateGlobals\(devToolingPauseSnapshot\);[\s\S]*restorePlayableHeroInputAfterDevToolingResume\(\);/);
  assert.match(restoreSrc, /state\.globals\.GamePhase === 'RUNTIME'/);
  assert.match(restoreSrc, /callFunctionWithContext\(fnContext, 'GetCurrentType'\) === 0/);
  assert.match(restoreSrc, /state\.globals\.TurnPhase === 0/);
  assert.match(restoreSrc, /!\(gameState\.refillBounce && gameState\.refillBounce\.active\)/);
  assert.match(restoreSrc, /!\(gameState\.yellowCasino && gameState\.yellowCasino\.active\)/);
  assert.match(restoreSrc, /!hasEmptySlots\(\)/);
  assert.match(restoreSrc, /getPresentationTurnBarrier\(\{[\s\S]*enemyLineClearPressureActive: !!state\.globals\.EnemyLineClearPressureActive,[\s\S]*\}\)/);
  assert.match(restoreSrc, /heroInputBarrier\.canRestoreHeroInput/);
  assert.match(restoreSrc, /getEnemyRosterStabilitySnapshot\(\)\.stable/);
  assert.doesNotMatch(restoreSrc, /clearSelectionOnly\(\);/);
  assert.match(restoreSrc, /gameState\.selectedGems = \[\];/);
  assert.match(restoreSrc, /gameState\.selectionLocked = false;/);
  assert.match(restoreSrc, /for \(const gem of \(gameState\.gems \|\| \[\]\)\) \{/);
  assert.match(restoreSrc, /gem\.selected = false;/);
  assert.match(restoreSrc, /gem\.Selected = 0;/);
  assert.match(restoreSrc, /state\.globals\.TapIndex = 0;/);
  assert.match(restoreSrc, /state\.globals\.CanPickGems = true;/);
  assert.match(restoreSrc, /state\.globals\.IsPlayerBusy = 0;/);
  assert.match(restoreSrc, /state\.globals\.DeferAdvance = 0;/);
  assert.match(restoreSrc, /state\.globals\.BoardFillActive = 0;/);
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
  assert.match(src, /assertCombatLayoutDev\('createGemBoard'\)/);
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

  assert.match(appSrc, /const GEM_INTERACTIVITY_DIAGNOSTIC_QUERY = \(\(\) => \{/);
  assert.match(appSrc, /return params\.get\('gemdiag'\) === 'true';/);
  assert.doesNotMatch(appSrc, /params\.has\('gemdiag'\)/);
  assert.match(appSrc, /runtimeDebugLogging\.isGemDebugEnabled\(state\) && GEM_INTERACTIVITY_DIAGNOSTIC_QUERY/);
  assert.match(appSrc, /const boardIntegrityLog = ok \? console\.log : console\.error;/);
  assert.match(runtimeSrc, /state\.globals\.IsPlayerBusy === 0 &&\\n\s+!state\.globals\.DeferAdvance &&\\n\s+!state\.globals\.AdvanceAfterAction;/);
  assert.doesNotMatch(runtimeSrc, /GATE_STUCK_AFTER_REFILL[\s\S]*state\.globals\.CanPickGems = true;/);
  assert.doesNotMatch(runtimeSrc, /console\.error\('\[GATE_STUCK_AFTER_REFILL\]'/);
});


test('combat end clears staged dev overrides and autoplay while preserving gold', () => {
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
  const state = { globals: { goldTotal: 4321, DevAutoplayRunId: 7, DevAutoplayActive: 1,
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
  assert.equal(g.DevAutoplayActive, 0);
  assert.equal(g.DevAutoplayRunId, 8);
  assert.equal(g.DevCombatSpeedMultiplier, 1);
  assert.equal(g.DevForcedBoardColor, -1);
  assert.equal(g.DevForcedEnemyType, '');
  assert.equal(g.DevToolingPaused, 0);
  assert.equal(g.DevDoubleAttackHolderUID, 0);
  assert.equal(g.DevRewardDrops.length, 0);
  assert.equal(g.DevEnemySlots.join(','), '__RANDOM__,__RANDOM__,__RANDOM__');
  assert.deepEqual(removed, ['orka.dev_tooling_config.v1']);
  assert.ok(calls.includes('ClearSessionSkillDraught'));
});
