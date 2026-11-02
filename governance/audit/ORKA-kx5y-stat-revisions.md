# ORKA-kx5y permanent-input revisions

Branch: `bead/ORKA-kx5y-stat-revisions`. Remediation starts at `141231b553527575a0e0941a63e3ac493afa5e51`; baseline `fbaab92fa70b06944772d80bac9e88ae84cfb827`. Independent FAIL report: `/tmp/verify-kx5y/report.md`. No push or merge. Work stayed in the assigned worktree; local Beads reads required sandbox escalation.

## Verifier remediation

F1: Phoenix captures its recipient maximum when a channel begins. Actor revival consumes `action_target_max_hp`; both cap healing at the current maximum and emit the actual healed amount. Arcane Pulse and Faze retain permanent offence/potency at commitment and read transient Elevate live at impact (lead ruling below). The additional commitment audit found Shadow landing reading live reach; it now combines committed permanent reach with live Wings. Boss basic and Mirewing release paths now use the shared committed-stat reader, and WFM action damage/healing uses committed MAG/ATK. Enemy revisions remain unsupported, so those enemy substitutions currently preserve behavior. Incoming mitigation, positions tracked by the existing targeting policy, passive aura/Mend and regeneration ticks remain live by design. No additional supported hero commitment leak was found in the source audit.

F2: native stats and the create/spawn/marker/revision payloads retain independent ATK, DEF, MAG and RES. Physical actions use ATK/DEF; magic actions use MAG/RES. Shadow remains physical with Arcane impact art; Bubble Pop/Pulse/Faze use magic. Djinn and Chimerilass select the channel per physical/magic action. Projectiles retain their launch channel. Supported schema-1.0 requests without the added fields retain their established equal-channel defaults; the production host emits every channel. The former `wfm_magic` actor stat is removed; the four ported WFM definitions retain their authored MAG/RES bases (Djinn 28/14, Chimerilass 26/16, High Gobloc 8/12, Skeleton 4/4). MATK/RES Training changes payload signatures and accepted Rust stats. Creation now computes the permanent projection once, retaining entry HP's host ratio (review F5).

F3: `attachHeroProgress` routes the entire operation through detached meta while bound. The shared session reset refuses to reset bound actors; developer presets preserve the active Rust encounter and queue revisions. Watched real-host tests cover HP, maxHP, stats and statuses; accepted snapshots own live changes.

F4: the ABI gameplay hash includes host maxima in actor order, command sequence, encounter mode/state, identity reservations and ordinary-clear receipts. Current/captured independent stats, active Phoenix maximum, pending spawn stats and projectile launch channels also enter the appropriate production hash. The frozen harness retains its established host hash stream and equal stat pairs.

## Regression evidence

Tracked adaptations of verifier probes: `tests/combatRevisionVerifier.test.mjs` from `probes.mjs`; `tests/combatRevisionVerifier.before.json` preserves `wasm-host-probe.json`; the Phoenix test in `tests/combatPermanentInputs.test.mjs` derives from `phoenix.mjs`; native Pulse/Faze checks in `permanent.rs` derive from `native/src/bin/elevate.rs`.

Native tests cover actor/Phoenix revival after HP growth and shrink, the current healing cap, exactly one heal, committed Pulse/Faze Elevate and MAG, Shadow reach, independent incoming mitigation, next-action replacement, physical Shadow art and per-action Djinn channels. Real WASM covers Phoenix maxima 420/840/210/100, atomic rejection, coalescing, lost/stale ack rules, reload before ack, equipment/EXP/ticket/Training/developer commits, creation/spawn/marker channels and equal-HP hash divergence. The existing 13-result native/WASM fixture compares every event, snapshot and gameplay hash.

The initial focused run passed 65 tests. A follow-up preserves authored WFM MAG/RES bases after removing the separate magic field; final-state counts and full-suite evidence follow below.

## Full validation

Runtime source: `9fa3b887718c1feefc3fd7cf06099e59f7bc1bda` (with `2aaf038599deb5e1f68e0a5692e739905b836411`). All three Cargo crates pass: SimulationCore 34 (33 library + 1 contract), wf_combat 35, frozen harness 537; **606 passed, 10 ignored**. The harness’s unchanged `baseline-trace.tsv` matches every-step hash folds and ordered events for seeds 1/7/42, spotlight off/on, through 27,000 steps. Bound-diagnostics compilation also passes. The last full harness took 265.84 seconds under load; it completed.

The final focused JS/WASM/boundary suite passes **66 tests**. The shipped WASM and source/binary provenance were rebuilt. `npm run build:offline` passes on the clean runtime commit.

Final `npm test -- --test-concurrency=4 --test-timeout=120000`: unit phase **1482 tests, 1461 passed, 18 failed, 3 skipped**. Exact failure names match the supplied verifier’s clean baseline: **added 0, removed 0**. That baseline was not rerun in another checkout. The earlier 2aaf0385 unit phase also matched all 18 names (1481/1460/18/3), before the final WFM base-stat test was added; its browser phase was deliberately interrupted for that correction. Both attempts are retained.

Final browser batch: **27 reported tests, 23 passed, 3 failed, 1 skipped**. The natural Hero-screen failure is the supplied baseline’s exact `pendingBagKillRewards: {}` save-shape mismatch at `heroScreenUILayout.test.mjs:411`. DPS timed out waiting for `#combat-dps-overlay` at `combatDpsOverlay.test.mjs:32`; one isolated retry also timed out. The test uses the flag-off URL. This remains an unresolved browser check, with no broad browser PASS or assertion change claimed.

All six Auto-Equip gameplay cases passed on the final runtime. `lampPresentation` completed its first actual-CP invariant across four phones, then its owned process tree was stopped at the **180-second file time box** with no cleanup errors. The remaining four cases are **unverified**: continuous equipment lifecycle; emitter pause/cadence; trash-only dismantling; Auto-Equip empty disposal/legacy salvage. Their interrupted remainder is not a product-failure verdict. The final npm run completed in 535.22 seconds with exit 1.

The initial implementation commit’s required gameplay/roster hook passed all 10 tests. Both runtime commits used `tools/prepare_commit_check.sh ORKA-kx5y` and normal hooks; neither bypassed verification. The first rejected UI-lock attempt is retained separately below. Final Boss HUD, formation, cooldown strip and the other completed browser cases retain their individual outcomes in the batch log.

Evidence: `test-results/ORKA-kx5y/final-verifier-fixes/summary.json`, `failure-set.json`, `kx5y-final-{simulation_core,wf_combat,wf_slice_harness}.log`, `kx5y-focused-full.log`, `kx5y-npm-test.log`, `kx5y-dps-retry.log`, build/commit logs and the first-attempt logs. The DPS retry’s bounded failure needs a separate startup/START-readiness investigation; that follow-up was not folded into this stat-revision bead.

## Exact inherited unit failure set

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


## Limits and retained evidence

The first commit attempt stopped at the broad UI lock’s nearest-target invariant. Its unchanged assertions and report are retained in `test-results/ui-lock/2026-11-01T20-42-21-767Z/`. The final reset guard lives in the shared combat session owner; developer UI source is unchanged. No visual review or release acceptance is claimed. Native and WASM evidence covers the named fixtures rather than every possible state. Full-suite failures and browser time boxes are reported above. Temporary Cargo caches and logs use `/tmp/kx5y-*` and `/tmp/ORKA-kx5y-*`; offline outputs and ignored test artifacts remain in this worktree for review. Integration Ready against newer main is outside this commit-only delivery.

## Second-verifier remediation and lead commitment ruling

Review source: `63a35500d21aa9e3a7ff027803d3fee0fa1f8bf5`; independent report `/tmp/verify-kx5y2/report.md`, read in full. The lead explicitly ruled that TDD-A A6/§3.3 captures **permanent inputs and definition/modifier parameters**: progression stats, maxima, potency/radius/duration/cooldown modifiers. Elevate is transient slice combat behavior and remains **live at impact in every path, with or without a revision**. No reference-only mode or fixture change is authorized. The earlier F1 claim about captured Elevate is superseded. Phoenix and actor-revival recipient maxima remain captured, with current maxima as heal caps.

N1: remove every `channel` declaration from the JavaScript combatant adapter. Rust action definitions are authoritative; slice Lizardo uses magic. Host tests reject any channel property, while native unequal-ATK/MAG proof pins Lizardo's actual projectile damage/channel.

N2: active Basic/Cast actions consume captured permanent stats/maxima/potency even when revisions match; Healing Spring always uses the captured recipient maximum for its committed cast. Remove `action_elevate` and all committed-Elevate dispatch. Native tests combine a mid-wind-up MAG revision with newly gained Sword, asserting old permanent MAG plus live Sword. Unrevised gain/loss and live Wings landing controls pin slice behavior. Rechecking the twelve action families from `commitments.log` preserves growth/shrink impact, hazard, projectile and ordered-event equality.

N3: QA Speed Link applies and restores SPD through detached permanent inputs. Low-HP and healing fixtures report “not supported in Rust encounters.” Shared story/session HP restoration, legacy skill setup and direct reset reject bound actors. Developer refresh and QA reset tear down Rust before actor replacement. Ordinary Rust stepping continues to exclude legacy function-bank/skill handlers; no new Rust HP command was added.

N4: real Chapter 1 Chromium CPU profiles identify `drawFrame → equipmentStorage.sync → apply → routeHeroPermanentInputs → binding.commit → queuePermanentInputs → driver.read`. The unchanged sync fast path re-applied every hero each frame, cloning the complete Rust snapshot and rebuilding payload/signatures despite no permanent change. In the 60-second before profile, diagnostic `driver.read` alone consumed 281 ms of sampled self time, almost entirely below the equipment-sync call chain; revision signatures and projections add further cost. The fix tests gear/EXP changes before routing, processes bound live actors before saved records, uses a non-copying activity predicate and builds command envelopes only for pending revisions. Thirty unchanged real-host syncs assert zero clones and zero pending revisions; actual gear purchases still reach WASM.

The verifier measured base/head frame p95 **33.4/66.6 ms**, with reverse-order **33.3/50.0 ms**. Fresh 60-second CPU profiles here measured **16.8/16.8 ms** before the fix, so the earlier frame gap did not reproduce under this run's host load. CPU attribution and zero-work regression coverage establish the repeated work independently; final harness measurements are recorded after validation below.

Evidence directory: `/tmp/kx5y-fix/`. `profile-{base,before}/cpu.cpuprofile` and `trace.json` retain the same seed-7 Chapter 1 workload and iPhone 13/DPR3 observations. No profile changes combat inputs. Final validation and cleanup are recorded below.

## Final second-verifier evidence

Validated runtime commit: `ca2f6fe11e1e3024f6e0822b52512771cb8577c8`. Follow-up changes only finalize this audit. The assigned branch remains active for lead verification; no push, merge or Integration Ready claim.

All crates pass: SimulationCore **34**, combat **37**, frozen harness **537**; **608 passed, zero failed, ten ignored**. Both frozen hash checks pass and `baseline-trace.tsv` is untouched. The verifier's unchanged twelve-path commitment probe passes growth/shrink controls. Focused rebuilt-WASM/boundary proof passes **14** tests; adapter/QA/equipment/VM proof passes **77** tests. WASM and offline release builds succeed; shipped WASM is **660,552 bytes**.

The clean complete `npm test -- --test-reporter=tap` unit phase reports **1,483 / 1,462 passed / 18 failed / 3 skipped**. Exact inherited names: **added 0, removed 0** (`unit-comparison.json`). Browser phase: **30 reported / 28 passed / 1 failed / 1 skipped**, completing all lamp cases. The sole browser failure is the inherited Hero-screen `pendingBagKillRewards` save-shape comparison at `heroScreenUILayout.test.mjs:411`. Full npm exits 1 for these inherited failures. No broad green-suite claim.

Command: `NODE_OPTIONS='--require /tmp/kx5y-fix/guard.cjs' node /tmp/kx5y-handoff-tool/tools/verify_handoff.mjs --base fbaab92f --head ca2f6fe1 --quick --cache-dir /tmp/kx5y-fix/harness-cache --out /tmp/kx5y-fix/harness`. Tool source is temporary `origin/main@d1e4a0fa811a8a837a4d1a8603fa304a22244ba5`. The provisioning guard preserves tracked files by building/installing dependencies in disposable mirrors, as in verifier 2; runtime tests use pinned shipped WASM. Only the SHA-matched baseline npm failure set was cached. All builds, Cargo checks, head npm tests and three 60-second runtime probes per ref reran.

Harness result: **INCONCLUSIVE**, zero execution errors, all five runtime claims PASS, zero new/fixed failure names (21 retained raw failures). Sparse-checkout omissions of `.beads/hooks` add the same two hook-file failures to both refs; the complete lane run above has the expected 18 unit failures. Step p95 **0.6 → 0.7 ms**, heap growth **21,492,732 → 14,297,968 bytes**, and WASM size **610,517 → 660,552 bytes** all pass their gates.

Frame p95 medians are **base 16.8 ms / fixed head 33.3 ms**. Base samples: **16.8, 16.8, 33.3**; head: **16.8, 33.3, 33.3**. Ranges overlap, yielding INCONCLUSIVE rather than FAIL. Page-load ranges overlap too. Preserve this outcome; it does not certify a frame-performance PASS.

One final reversed-order control used the unmodified harness `combatProbe` without CPU profiling, with identical seed/chapter/profile and 60 seconds per ref: **head 16.8 ms, then base 33.3 ms**, complete coverage and zero errors on both. The reversed CPU-profile control measured **16.8 ms on both refs**. Thus a stable head-only frame penalty did not reproduce after the fix; host/order variance remains material. The source-cost defect is independently established and removed: before profile `routeHeroPermanentInputs` sampled **547 ms inclusive**, `queuePermanentInputs` **434 ms inclusive**, and driver snapshot read **281 ms self**; the after profile contains no sampled route/queue work. Dirty-save cost drops from **147 ms to 20 ms**. Idle callbacks also marked HeroProgress dirty, forcing JSON/localStorage saves; the changed-input gate removes that path. The deterministic thirty-sync test proves zero clones/revisions. These timings are nested sampled CPU costs, not additive frame durations.

The JS-cost hypothesis was supported by profiling. The earlier 33.4/66.6 ms gap did not reproduce consistently after correction, and the full harness remains statistically inconclusive. No further source change is justified by these conflicting frame samples. Lead verification should retain the timing uncertainty and use stable host conditions for any additional acceptance run.

The first normal commit-hook attempt stopped on a flag-off encounter-layout RangeError during developer boss setup. An unchanged retry passed the rendered UI lock, five-phone cooldown gate and all ten Auto-Equip/roster tests; no assertions or hooks were bypassed. An earlier in-progress npm run exposed missing VM imports and CP publication, both corrected before the clean final run; its logs remain. All commits use normal verification and `bd-ORKA-kx5y` messages.

Cleanup: the harness removed its generated worktrees. The task's temporary origin/main tool checkout and base profiling checkout were removed through `git worktree remove` after clean tracked-state checks. The tool checkout held only task-created profiling helpers/symlinks; used tool sources were retained in `/tmp/kx5y-fix/tool-source/`. Task-owned Cargo/WASM caches were removed. Logs, CPU profiles, traces, reports and probe sources remain under `/tmp/kx5y-fix/`; prior verifier evidence is untouched.

## Third-verifier raw-hook remediation

Runtime commit `32f5cd61c5644338bcfe16be55c58cf2b0586345` guards `devBrowserTestHooks.js:480-482`: every exposed `__codexGame.callFunction` call throws `Legacy function hook not supported in Rust encounters` before dispatch when Rust authority is enabled. This covers existing and future registry handlers. Internal presentation callbacks retain their registry access; named diagnostic reads remain available. R2 is preserved: no Rust command or ABI change.

The complete sweep of `devBrowserTestHooks.js` and `devToolingRuntime.js` found these actor-write paths:

- `devBrowserTestHooks.js:480`: raw registry dispatch, now refused. Covered HP writers include `ApplyDamageToTarget`, `HealRealtimeActor`, `ApplyPartyDamage`, `TickRealtimeHeroBasics`, `Enemy_Heal_Self`, `Enemy_Heal_Allies`, `Enemy_Heal_Ally`, `Enemy_Wipe`, `TryPartyDestiny` and `ApplyActiveHeroHeal`; `Enemy_Drain_Buff` mutates stats. The guard also rejects status/ward handlers and unknown names without a handler-name allowlist.
- `devBrowserTestHooks.js:8-17`: `applyQaEnemyLowHpFixture`, already refuses Rust authority before writing enemy HP.
- `devToolingRuntime.js:131-169`: Speed Link application/restoration uses `routeHeroPermanentInputs` for bound actors. The existing real-WASM verifier proves zero live SPD writes and acknowledged revisions for both directions; this supported permanent-input route remains intact. Its legacy extra-turn cleanup touches JS bookkeeping, not Rust actor statuses or ward.
- `devToolingRuntime.js:282-335`: party/escort construction creates detached records. Developer levels at `:736` use the tested detached progression/revision path. Boss launch at `:708` refreshes/tears down the outgoing world before actor replacement. Fresh-session reset at `:817` calls the existing bound-actor reset guard. No additional live HP/stat/status/ward writer was found.

Real browser replay of the verifier's Chapter 1 Rust boss tested thirteen actual legacy mutation calls, including `ExecutePurpleDebuff` and `StartBuffRoll`. Every call refused; all actor HP/maxHP/stats/statuses/ward and the complete Rust receipt remained byte-identical in the synchronous probe (step 3). `raw-browser.json` and its executable probe remain under `/tmp/kx5y-followup/`.

DPS attribution: the original test is unchanged and uses the flag-off URL without invoking the raw hook. It passed on the supplied head before edits. Matching base `fbaab92f` and amended-head runs retained every original assertion and added read-only entry/damage telemetry in temporary copies: both entered normal combat with Rust authority false, no page errors, and organic damage (base 13/one hit; head 48/three hits). Both passed the complete four-viewport/toggle test. The full clean-head browser batch also passed it. The reported line-34 stall did not reproduce; the older verifier establishes the earlier line-32 entry timeout on base. These observations establish no refused-hook dependency, but cannot identify the cause of the earlier damage stall. No timeout, assertion, fixture damage or production DPS code changed.

Validation evidence lives under `/tmp/kx5y-followup/`: offline build succeeded; focused developer-hook, revision-verifier, permanent-input, Rust-authority and DPS contracts passed **42/42** after the build. The first broad run was stopped after the clean-checkout test rejected uncommitted runtime edits; its log is retained as `npm-test-dirty-aborted.log`. Committing the runtime fix before the replacement run restored that check without editing its assertion.

Completed replacement `npm test -- --test-reporter=tap`: **1,484 unit tests, 1,463 passed, 18 failed, 3 skipped**; exact names match the 18-name baseline above, with **zero additions/removals** (`unit-comparison.json`). Browser batch: **30 tests, 28 passed, 1 failed, 1 skipped**. Its sole failure is the inherited canonical Hero-screen `pendingBagKillRewards` save-shape mismatch at `heroScreenUILayout.test.mjs:411`; DPS and every lamp case passed. Exit 1 preserves those baseline failures. `final-results.json` and the complete `npm-test.log` record the result. No full-suite PASS is claimed.

Cleanup/disposition: removed the task-created temporary baseline source archive and its dependency symlink. Retain this active implementation worktree, rebuilt offline outputs and ignored browser evidence for lead review; retained `/tmp/kx5y-followup/` scripts/logs support the hook and DPS findings. The existing task footprint record has no pre-allocation baseline, so footprint growth cannot be attributed retrospectively. No push, merge, bead closure or primary-checkout edit.
