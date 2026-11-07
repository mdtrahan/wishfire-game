import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commitPlan} from '../tools/run_commit_tests.mjs';
import {runPreCommit,runMerge,mergeSource} from './preCommitRouting.mjs';

// After the Rust cutover (ORKA-63bf.11) the commit hook runs one fast tier and the merge tier runs
// the retained Node suite plus every Rust crate; no JS-game owner routes remain.
test('commit hook routes every staged change to the fast tier only',()=>{
 for(const owner of ['rust/wf_app/src/main.rs','tools/build_wf_app.sh','README.md'])assert.deepEqual(runPreCommit([owner]).commands,['node tools/run_commit_tests.mjs'],owner);
});
test('commit hook fails closed when fast checks fail',()=>{
 assert.notEqual(runPreCommit(['README.md'],'node tools/run_commit_tests.mjs').status,0);
 assert.doesNotMatch(readFileSync(new URL('../.beads/hooks/pre-commit',import.meta.url),'utf8'),/test:lamp-ui|test:ui-lock|lampAutoEquipGameplay|ensure_simulation_core/);
});
test('merge tier runs the retained suite and the Rust crates, and blocks on failure',()=>{
 const commands=runMerge(['rust/wf_meta/src/hero.rs']).commands;
 assert.ok(commands.includes('npm test'),'retained Node suite');
 assert.notEqual(runMerge(['rust/wf_meta/src/hero.rs'],'npm test').status,0,'failed suite must block merge');
 assert.match(mergeSource(),/cargo test --manifest-path "\$manifest"/);
 assert.match(mergeSource(),/wf_pack/);
 assert.doesNotMatch(mergeSource(),/web-runner\/app\.js|playwright|ensure_simulation_core/);
});
test('fast selection follows changed owners, routing files and Rust crates',()=>{
 assert.ok(commitPlan(['tools/storage_hygiene.mjs']).tests.includes('tests/storageHygieneContract.test.mjs'));
 assert.ok(commitPlan(['rust/wf_combat/src/lib.rs']).crates.includes('rust/wf_combat/Cargo.toml'));
 assert.ok(commitPlan(['rust/deleted-crate/Cargo.toml']).crates.length>0,'deleted Rust owners require remaining crate checks');
 assert.ok(commitPlan(['tools/run_merge_tests.sh']).tests.includes('tests/preCommitRouting.test.mjs'));
 assert.deepEqual(commitPlan(['README.md']).tests,[]);
 assert.doesNotMatch(readFileSync(new URL('../tools/run_commit_tests.mjs',import.meta.url),'utf8'),/ensure_simulation_core|uiPresentationLockGateContract/);
});
