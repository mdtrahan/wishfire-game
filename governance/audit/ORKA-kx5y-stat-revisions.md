# ORKA-kx5y permanent-input revisions

Implementation source: `dcb3449e` (includes `b34c3fb1`). Baseline: `fbaab92fa70b06944772d80bac9e88ae84cfb827`.
Branch: `bead/ORKA-kx5y-stat-revisions`. No push, merge, or review server.

## Delivered contract

Combat schema 1.1 advertises `replace_permanent_inputs_v1`; the existing raw ABI 1.0 layout and schema 1.0 requests remain supported. Step requests accept ordered, encounter/step-tagged `ReplacePermanentInputs` commands with expected/current per-hero revisions. A batch validates before mutation. Applied commands emit `permanent_inputs_applied` with revision and command sequence.

Rust replaces permanent inputs while preserving committed action parameters, cooldowns, meters, targets, ward, statuses, spotlight and RNG. HP follows R1, including downed HP zero. Growth emits no healing or revival fact. Committed healing also retains its recipient maximum; repeated commands cannot grant another action or heal.

The host coalesces newest hero inputs, retains them across pause, and validates acknowledgements against submitted commands. Equipment, EXP/ticket levels and Training use detached raw meta, the existing primary-channel R5 projection and R6 passive meter refill. Accepted snapshots own live HP; Rust-path transactions do not rewrite live actor HP/stats. Creation reads durable meta after a reload before ack. Ordinary-clear saves and host party CP use the bound raw source. Flag-off follows the existing JS path.

R5 retains the baseline adapter's single primary ATK/DEF pair. Separate physical/magic mitigation and the broader stat catalog remain outside this prerequisite.

## Verification

All crates pass: SimulationCore 33, wf_combat 26, frozen harness 537; total 596 passed, 10 ignored. The supplied baseline was 586 passed, 10 ignored. Native/WASM revision traces match every event, snapshot and gameplay hash. The shipped WASM and source/binary provenance were rebuilt and verified.

Focused host tests cover the original HP gear case (75→125 host; 420→700 Rust), R1 wounded HP (200→480), shrink, downed, paused coalescing, duplicate/out-of-order acknowledgements, stale/mixed atomic rejection, reload before ack, ordinary-clear saving, EXP, ticket levels and Training. Rust tests cover casting, poison, ward, spotlight, cooldown/target/status/RNG preservation, committed healing, no free attack/double heal and replacement without buff multiplication.

The repository commit hook passed its real gameplay/roster proof: 10 tests. A later focused run covering the final CP adjustment passed 86 tests. All seven offline tests run after `npm run build:offline`.

## Exact failure comparison

Baseline unit suite: 1472 tests, 1451 passed, 18 failed, 3 skipped. Candidate final unit suite: 1477 tests, 1456 passed, 18 failed, 3 skipped. Exact failure sets match: zero added and zero removed. The clean run includes all seven passing offline cases and the final CP adjustment. The first dirty candidate run had one additional mechanical failure, `the lab does not import Wishfire combat modules as its model oracle`, because it asserts an entirely clean runtime checkout. Its unchanged assertion passes after committing.

The 18 baseline failure names are:

- hero screen reads every accepted kit skill from shared data
- automatic HERO_SINGLE uses the runtime random target in web-runner/modules/functionBank.js
- Tank HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Fighter HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Controller HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Support HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- random targeting excludes dead enemies in web-runner/modules/functionBank.js
- automatic HERO_SINGLE uses the runtime random target in Scripts/functionBank.js
- Tank HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Fighter HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Controller HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Support HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- random targeting excludes dead enemies in Scripts/functionBank.js
- leader-target bias spans own-nearest to the legacy shared target
- heroes split across nearby enemies by default and dog-pile under the legacy toggle
- heroes may stack on one target while hero-enemy spacing stays whole
- boss encounters keep full hero spacing along the front edge
- boss defeat is free, retains the full ready milestone, and resumes farming until summoned

Browser baseline's natural failure is `hero party screen uses saved canonical data and stays contained across portrait viewport profiles` (`heroScreenUILayout.test.mjs:411`, persisted `pendingBagKillRewards: {}`). The fresh baseline passed the first lamp-emitter case; later lamp cases stalled and its owned process tree was stopped. `Auto-Equip closes empty disposal after feedback and preserves legacy salvage review` then reported a closed browser. That interruption is agent-induced, with no claim of an independent product failure. Fresh baseline browser totals: 30 tests, 27 passed, 2 failed, 1 skipped.

Candidate full run used `npm test -- --test-timeout=240000`. Browser totals: 29 tests, 26 passed, 2 failed, 1 skipped. Its exact failures were the same natural Hero-screen failure and `tests/lampPresentation.test.mjs`, which was stopped with SIGKILL after 7:03 without further progress. Node had received the timeout flag but did not end the stall. The first two lamp cases passed; these three candidate cases remain unverified:

- lamp emitter: full cache and every modal freeze movement, capture and cadence
- trash-only full cache and held item open directly to one dismantle-all action
- Auto-Equip closes empty disposal after feedback and preserves legacy salvage review

The baseline interruption affected a later case after its lamp-emitter case passed. These differently interrupted runs establish the same natural browser failure; they do not establish a lamp regression or a complete lamp PASS. Interruption details and exact set comparison are retained in `candidate-lamp-interruption.json` and `failure-comparison.json`.

The initial full `npm test` unit pass ran while runtime files were dirty (19 failures, including the cleanliness prerequisite); the complete final unit pass on the clean committed runtime cleared that prerequisite and retained exactly the baseline 18. Browser verification and the commit's separate gameplay/roster hook ran headlessly. Their owned test servers were stopped; no review server was created.

## Evidence and retained artifacts

Logs: `test-results/ORKA-kx5y/` (baseline/after/final unit and browser output, offline builds, Cargo suites, focused proof, commit hooks and storage audit). `output/balance/simulation-core-wasm-provenance.json` pins the checked-in binary and every Rust input. Offline output, ignored test evidence and Cargo build caches are retained for review. No tests or assertions were retired or weakened to clear inherited failures. Integration Ready against a newer main is outside this worker's commit-only delivery.
