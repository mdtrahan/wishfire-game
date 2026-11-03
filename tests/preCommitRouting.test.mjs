import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commitPlan} from '../tools/run_commit_tests.mjs';
import {runPreCommit,runMerge,mergeSource} from './preCommitRouting.mjs';

const routes=[
 ['web-runner/systems/renderRuntime.js','npm run test:ui-lock'],
 ['web-runner/systems/heroCooldownStrip.mjs','npm run test:hero-cooldowns'],
 ['web-runner/systems/heroSkillCopy.mjs','node --import ./tools/ensure_simulation_core.cjs --test tests/heroScreenUILayout.test.mjs'],
 ['web-runner/assets/lampEquipmentUI.css','npm run test:lamp-ui'],
 ['web-runner/assets/lampEquipmentUI.css','node --import ./tools/ensure_simulation_core.cjs --test tests/lampRoster.test.mjs'],
 ['web-runner/src/core/combatPower.mjs','node --import ./tools/ensure_simulation_core.cjs --test --test-concurrency=1 tests/lampAutoEquipGameplay.test.mjs tests/lampRoster.test.mjs'],
];
for(const [owner,command]of routes)test(`${owner}: merge route and rejection remain enforced`,()=>{
 const check=source=>assert.ok(runMerge([owner],'',source).commands.includes(command),`${owner} must run ${command}`);
 check(mergeSource());
 assert.notEqual(runMerge([owner],command).status,0,'failed proof must block merge');
 assert.throws(()=>check(mergeSource().replace(command,'true')),'removing proof must break routing contract');
 assert.deepEqual(runPreCommit([owner]).commands,['node tools/run_commit_tests.mjs']);
});
test('commit hook fails closed when fast checks fail',()=>{
 assert.notEqual(runPreCommit(['README.md'],'node tools/run_commit_tests.mjs').status,0);
 assert.doesNotMatch(readFileSync(new URL('../.beads/hooks/pre-commit',import.meta.url),'utf8'),/test:lamp-ui|test:ui-lock|lampAutoEquipGameplay/);
});
test('fast selection follows changed owners, test helpers, deleted files and Rust crates',()=>{
 const cp=commitPlan(['web-runner/src/core/combatPower.mjs']);
 assert.ok(cp.tests.includes('tests/lampCPInvariant.test.mjs'));
 assert.ok(!cp.tests.includes('tests/lampAutoEquipGameplay.test.mjs'));
 const helper=commitPlan(['tests/fixtures/lampTrust.mjs']);
 assert.ok(helper.tests.includes('tests/lampRoster.test.mjs'));
 assert.ok(!helper.tests.includes('tests/lampAutoEquipGameplay.test.mjs'));
 assert.ok(commitPlan(['rust/wf_combat/src/lib.rs']).crates.includes('rust/wf_combat/Cargo.toml'));
 assert.ok(commitPlan(['rust/deleted-crate/Cargo.toml']).crates.length>0,'deleted Rust owners require remaining crate checks');
 for(const file of ['tests/preCommitRouting.test.mjs','tests/lampRoster.test.mjs','tests/uiPresentationLockGateContract.test.js'])assert.ok(commitPlan(['tools/run_merge_tests.sh']).tests.includes(file),file);
 assert.doesNotMatch(readFileSync(new URL('./uiPresentationLockGateContract.test.js',import.meta.url),'utf8'),/chromium\.(launch|connect)|launchBrowserTest/);
 assert.deepEqual(commitPlan(['README.md']).tests,[]);
});
test('all-mode runs each heavy route once, lamp presentation subsumes gameplay',()=>{
 const source=mergeSource().replace('case "${1:-}" in','case --all in');
 const commands=runMerge([],'',source).commands;
 for(const command of new Set(routes.map(([,command])=>command).filter(command=>!command.includes('--test-concurrency=1 tests/lampAuto'))))assert.equal(commands.filter(c=>c===command).length,1,command);
 assert.ok(!commands.some(command=>command.includes('--test-concurrency=1 tests/lampAuto')));
});

test('removing a CP owner from merge routing breaks the contract',()=>{
 const check=source=>assert.ok(runMerge(['web-runner/src/core/combatPower.mjs'],'',source).commands.some(c=>c.includes('tests/lampAutoEquipGameplay.test.mjs')));
 check(mergeSource());assert.throws(()=>check(mergeSource().replaceAll('combatPower','retiredPower')));
});

const legacyPatterns=[
 "^(package\\.json|tools/ui_presentation_lock_gate\\.mjs|tests/uiPresentationLockGateContract\\.test\\.js|tests/bossBattleHud\\.test\\.mjs|tests/devBossLaunch\\.test\\.mjs|web-runner/index\\.html|web-runner/app\\.js|web-runner/src/core/damageNumberAnimation\\.mjs|web-runner/systems/renderCombatBossControl\\.mjs|web-runner/systems/renderBossBattleHud\\.mjs|web-runner/systems/renderRuntime\\.js|web-runner/systems/devToolingRuntime\\.js|web-runner/systems/devToolingControls\\.js|web-runner/systems/combatPresentationScale\\.mjs|web-runner/systems/appShellViewport\\.js|web-runner/systems/surfaceRenderRouter\\.js|web-runner/systems/pointerRoutingShell\\.js|web-runner/assets/images/boss-hud/.*)$",
 "^(web-runner/app\\.js|web-runner/systems/(heroCooldownStrip|combatProgressionUI)\\.mjs|web-runner/state/heroArtAssets\\.mjs|src/core/buffSignalRules\\.mjs|web-runner/src/core/(heroDefinitions|realtimeHeroPassives|partySkillCatalog)\\.mjs|web-runner/assets/images/ui/buff-signals\\.png|tests/(heroCooldownStrip(Browser)?|buffSignalRules)\\.test\\.mjs)$",
 "^(web-runner/systems/(renderHeroScreen\\.js|heroSkillCopy\\.mjs)|web-runner/src/core/heroDefinitions\\.mjs|tests/heroScreenUILayout\\.test\\.mjs)$",
 "^(web-runner/systems/lampEquipmentUI\\.mjs|web-runner/assets/lampEquipmentUI\\.css|tests/lampPresentation\\.test\\.mjs|web-runner/systems/modalClose\\.mjs|web-runner/systems/combatProgressionUI\\.mjs|web-runner/systems/bagUpgradePresentation\\.mjs|web-runner/assets/bagUpgradeUI\\.css|web-runner/systems/lampConveyorPresentation\\.mjs|web-runner/assets/images/ui/bag-tier-medallion\\.png|tests/bagUpgradePresentation\\.test\\.mjs)$",
 "^(\\.beads/hooks/pre-commit|package\\.json|web-runner/app\\.js|web-runner/src/core/(lampGear|lampConveyor|lampHeroRoster|equipment|heroProgression|heroDefinitions|combatPower)\\.mjs|web-runner/systems/(equipmentStorage\\.mjs|renderHeroScreen\\.js|heroGearUI\\.mjs)|tests/(lampAutoEquipGameplay|lampRoster|lampCPInvariant|lampConveyor|lampEquipment)\\.test\\.mjs|tests/fixtures/lampTrust\\.mjs)$"
];
test('every legacy owner pattern occurs in exactly the merge tier',()=>{
 const hook=readFileSync(new URL('../.beads/hooks/pre-commit',import.meta.url),'utf8'),merge=mergeSource();
 for(const pattern of legacyPatterns){assert.equal(merge.split(pattern).length-1,1,pattern);assert.equal(hook.includes(pattern),false);}
});
