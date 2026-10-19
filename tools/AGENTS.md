# Tools DOX

## Purpose
- Own repo automation for local serving, browser QA support, Rust WASM builds, Beads/Git support, and harness execution.

## Ownership
- `serve_web.js` serves the browser runner and writes `web-runner/runtime-fingerprint.js`.
- `balance_harness.js` is the canonical batch game automation path.
- Balance fixtures preload lamp and `orka.hero_progress.v2` saves before navigation, preserve input/output bytes for provenance, and reject progression saves whose version, roster, identity, level, or HP would normalize on restore.
- Recovery evidence records observed progression boundaries and ordered post-recovery enemy KOs; skipped polls or event gaps remain unknown rather than inferred.
- Recovery loadouts and Hero stats are sampled at the first post-transition poll and labeled as such; they are not exact event-time state.
- Ordinary acceptance requires an exact runtime wave counter, ordered events, zero Hero KOs/recoveries and no gaps; total clears remain a separate count.
- `ui_presentation_lock_gate.mjs` is the canonical fail-closed rendered presentation gate for approved responsive UI seams. It also renders the manual boss retry group and guards its combat Y anchor, resource separation and horizontal containment, then checks modal/menu hiding with readiness preserved; its renderer is a pre-commit UI owner.
- UI-lock startup waits for realtime basic clocks, then its automatic-focus check uses the shared encounter filter and basic-target selector. Focus may be zero only when no living hero can reach a living eligible enemy in the committed encounter; nonzero focus must match the canonical selector.
- Playwright doctor, launch matrix, and Chrome CDP helpers diagnose browser startup/control issues.
- Rust build helper generates the browser WASM artifact.
- `build_offline_release.mjs` reuses hosted runtime staging, embeds startup JSON, the optional elemental impact manifest, and SimulationCore WASM, and emits the portable file:// artifact with relative frame assets; it must leave the Netlify release path unchanged.
- Offline builds must validate dependencies before touching `dist-offline`, assemble in a sibling candidate directory, and replace the prior playable artifact only after the bundle and manifest are complete.
- Hot-file, cleanup, archive, and Beads/Git visibility helpers support repo workflow. Generated review/export output belongs in an explicit temporary directory outside current main.

## Local Contracts
- `enforce_storage_budget.mjs` rejects staged recovery/evidence output, files over 20 MiB, indexed trees over 384 MiB and runtime source/assets over 200 MiB. `enforce_commit_check.sh` runs it before commit compliance; Git hooks can be bypassed and do not govern external snapshot writers.
- `link_beads_worktree.mjs` preserves existing sparse selections and excludes tracked `output/` and `.beads/backup/` from auxiliary checkouts. Dirty tracked excluded paths refuse; authoritative root data stays in place.
- `storage_hygiene.mjs` audits read-only. Its cleanup command defaults to dry-run and must fail closed on unreadable Beads state, dirty, unmerged, OPEN/unknown, missing, main, or protected ignored-file worktrees. Detached worktrees remain refused unless `--historical-detached` is explicitly passed; that mode requires a detached HEAD already on main, no lane-local Dolt state, and the same clean/allowlisted-local checks. Apply removes only the explicit regeneratable path allowlist, rescans the lane, then uses Git worktree removal without force and retains branches. Commit-check records, QA evidence, Dolt state, backups, output, and unknown paths stay protected until separately preserved or resolved.
- `link_beads_worktree.mjs` adds only the ignored native `.beads/redirect` in a Codex-created worktree. It refuses lane-local Dolt state or a conflicting redirect and points at the authoritative checkout's live Beads database and backup. The exact redirect file is disposable at guarded retirement; lane-local Dolt state is not.
- Superseded-ancestor retirement requires explicit `--superseded-by <registered-successor-path>`, a CLOSED clean target, exact target HEAD ancestry in the live registered successor HEAD, and no Dolt or protected local material. Patch equivalence is insufficient; the successor is never modified.
- General historical retirement requires explicit `--historical`, a clean registered non-main checkout, a durable local branch or tag containing HEAD, no Dolt or protected local files, and a separate live-process check. It does not require merge ancestry or Bead status. Unknown material remains protected; refs remain.
- The hot-file regression gate exercises live realtime hero/enemy scheduling, impact timing, rewards, and the shared damage/skill mirror; retired turn and gem scheduler tests are outside that gate.
- The hot-file regression gate runs the lamp phone gate when lamp presentation owners change. That gate owns and stops its temporary server; `LAMP_QA_URL` explicitly selects an existing review server.
- Do not create a second batch game-test pipeline beside `npm run balance-harness` without explicit scope.
- Keep `npm run test:ui-lock` presentation-only. It may arrange deterministic test state through `window.__codexGame`; it must not become a balance or gameplay simulation harness.
- UI lock failures must name the viewport, invariant, measured value, allowed range, and JSON report path.
- Command/fan UI-lock fixtures clear prior damage floats and presentation queues before arranging an opening offer; production serialization correctly keeps that offer hidden while an earlier float or effect still owns the stage.
- The UI lock runs reference, compact, live-narrow `233x452`, approved natural-preview, and compact-Retina viewports; it records requested and actual viewport/zoom/DPR metrics, covers stage containment, developer controls, transient combat controls, damage density, progress-bar height, personal FLOW and command queue routing, and can prove stage and panel rejection through `--prove-rejection`.
- Treat Playwright/Chrome tools as support tools unless the user asks for that surface.
- `serve_web.js` intentionally writes a runtime fingerprint at server start; account for that generated file in diffs.
- Hot-file commit helpers own `.beads/hot-file-lock` metadata generation; do not hand-author scope files except when debugging the tooling.
- Tooling should not mutate runtime gameplay state except through explicit test/harness interfaces.
- The balance harness enters through the current Canvas START hit target, fixes the encounter seed, and drives native autoplay. It writes completed metrics before bounded cleanup and force-closes only browser/server processes it owns.
- `--forceOrdinaryKo true` is an opt-in synthetic recovery probe: it lowers one living Hero to 1 HP and applies a lethal hit through the production damage function from a spawned enemy. Keep its recovery proof separate from organic enemy-pressure measurements.

- The balance harness creates one fresh browser context per seed, reports stage clears, boss clears, defeat recoveries, sampled hero HP, ordered KO and exact opt-in damage/healing events, and progression endpoints. It retains at most 100 incoming-hit position samples plus the first KO impact; these are impact-time geometry, not launch-time target decisions. New damage events carry their event-time wave so a same-poll recovery cannot relabel the KO with the reset wave; older events retain a sampled-wave fallback. It keeps incomplete wave targets, event gaps, and unknown mechanical types explicit; `--captureFrames true` saves real rendered combat and recovery frames, with a runtime reveal-state gate for the recovery frame.
- JSON and CSV first-hero casualty summaries use ordered KO events when available; sampled dead-hero roster order applies only without an event stream.
- Opening-roam reports retain the first observed start and the pre-recovery release point; a missing start or release remains unknown instead of becoming a successful-stall claim.
- `--serveRoot` permits an unchanged SHA checkout as the game source while the harness runs from this lane. Reports pin both game and harness fingerprints. On older builds without the wave-clear or recovery counters, observed stage transitions are a limited fallback; ambiguous changes stay explicit, and missing recovery/ordered-event telemetry stays unknown.
- On deadlock or timeout, preserve the final rendered frame, actor coordinates and enemy stream state so movement stalls can be distinguished from unavailable enemies.
- Session output separates opening level/EXP/CP from sampled ending level/EXP/CP, with starting/ending equipment loadouts. Per-seed console lines show clears, recoveries, first casualty and end reason; incoming damage totals group by authored enemy tier, and opening `currentLevel` never proves the ending level.
- Canonical-name gear can apply to deployed clone actors through equipment storage; verify active starting stats rather than inferring gear effects from loadout keys alone.
- Boss attempt records distinguish clear, game boss timeout, KO recovery and harness wall timeout. An attempt also closes when the timeout, clear or recovery counter moves while the boss reads active, because timeout, recovery and a re-armed boss can fall between polls. Game timeout reports capture the boss and party HP before recovery from runtime state; wall timeout remains an unfinished measurement. `--maxBossTimeouts 1` can end an underprepared trial after its first game timeout.
- Defeat recovery is a normal route through continuous stages. Balance acceptance gates earned wave completion and deadlocks; recovery count remains a diagnostic and separate recovery fixture surface.
- The optional `--autoEquip true` scenario clicks the visible Collect and Auto-Equip lamp controls during combat and records initial/final equipped slots and lamp emissions. Lamp actions pause (Close only) while a boss is active, transitioning or about to auto-enter, because opening the Lamp surrenders the attempt; event logs record each equipment action. Reports without that flag make no new equip actions; inspect the starting loadout and active hero stats before labeling them geared or unbuffed.
- Balance reports attribute effective Hero healing by event source UID and event reason. Ordinary-wave respite uses `ordinary_wave_clear`; keep it distinct from skill healing and full-party defeat recovery.
- For matched equipment draws, `--lampSeed <uint32>` preloads a fresh save built by the game's own lamp constructor before startup. The harness verifies and reports the loaded seed; collection and equipping still use visible controls. A shared lamp seed does not imply identical final gear when sessions take different actions or durations, so compare recorded loadouts.
- `--saveLampFixture <path>` exports a headless session's lamp save for reuse. `--lampFixture <path>` validates that save through the served build's conveyor rules and preloads the same equipment state in each isolated browser context. The reported SHA-256 covers exact fixture file bytes. Compare opening hero stats before calling a matrix matched-strength.
- `--heroSlots` accepts four comma-separated canonical hero slots, including empty slots, through the existing dev tooling config before Canvas START. Verify and report the applied party so healer and no-healer runs cannot silently use a different roster.
- `--maxBossClears 1` targets a boss victory instead of ordinary-wave count. After a recovery latches manual retry, the harness uses the visible Summon Boss control; a boss trial must record its own clearance and completion.
- `--eventLog <path|true>` (default off) appends an ordered NDJSON observation log: every opt-in combat event with actor names, source and EnemyData tiers and poll-time max HP, plus poll-derived wave clears, boss start/end, recovery transitions, Hero state changes, gaps and deadlocks. Poll-derived records carry poll time, never invented event time. It is evidence retention, not a second pipeline.
- After 300 simulated seconds without an enemy KO during an active ordinary encounter, the harness ends with `no_enemy_ko` and emits one compact `stall_diagnostic` with actor positions, focus, Hero action clocks, and pending hits. This is a productivity failure, distinct from the state-signature deadlock detector.
- `--bossPolicy auto|hold|summon|farm:N` makes the manual-boss choice explicit. `auto` keeps the historical rule (summon only when `maxBossClears > 0`); `hold` farms at readiness; `farm:N` summons after N ordinary clears since the last attempt or recovery. Reports record the policy and run start/finish times.
- `combat_knowledge_lab.mjs` with `combat_lab/` evaluates committed claim files against harness evidence. OBS (unchanged-game observation) and MODEL (shadow prediction) streams stay separate; the model never imports Wishfire combat code, and its rule values are hand-transcribed, declared assumptions. Prospective evidence must start after the claim commit and serve runtime trees identical to the declared candidate; retrospective reports can contradict but never confirm. Unexposed values (pre-cap damage, cap binding) stay `?`/UNKNOWN. The design verdict stays NOT PROVEN unless survival, pressure, earned-boss and recovery pillars all pass. `--gzipStreams` writes deterministic `.ndjson.gz` streams so tracked samples stay under the 20 MiB file guard.
- `combat_lab/sustain_tracker.mjs` runs one-Hero MODEL diagnostics; post-hit shields use whole-HP damage and cannot stand in for DEF. `combat_lab/party_sustain.mjs` grades all Heroes over 20 observed waves per seed, with immediate farming KO failure, whole-HP regen/refund payout, credits cleared at full HP, separate boss-timeout checks and explicit synthetic pressure. Keep shared receipts compact and hash-deduplicated. Refund, regen and gear-growth healing are hypothetical design settings until live integration proves them.
- `combat_lab/model.mjs` shadow-1 retains its historical 18-second boss assumption for archived sample provenance; current runtime boss timeout is fixed at 30 game seconds.

## Work Guidance
- Keep command output bounded and failure messages classifiable.
- For browser automation failures, distinguish browser startup/attach failure from game behavior failure.
- For Beads/Git helpers, preserve unrelated dirty files and avoid destructive cleanup without explicit approval.

## Verification
- Focused `node --test tests/playwrightSupportContract.test.js` or tool-specific tests.
- `npm run playwright:doctor` / `npm run playwright:launch-matrix` only when diagnosing browser startup/control.
- `npm run balance-harness` for bounded batch game automation.
- `npm run test:ui-lock` after changes to a listed UI presentation owner; inspect its compact, reference, natural-preview, and Retina screenshots before accepting new bounds.

## Child DOX Index

- build_runtime_release.mjs packages only tracked runtime files from web-runner/ and src/ into dist/, with commit and SHA-256 manifest. Netlify publishes dist/; checkpoints, governance reviews and generation prompts are excluded.

- UI lock checks that combat hero cards and AF readouts stay absent, that hero and enemy HP bars remain actor-anchored, and that combat controls stay within the Canvas.
- Actor HP bars use rounded dark tracks; the UI lock counts each clipped track fill for every hero and living enemy.
- The native command UI gate prepares and executes self Heal, checks only the active hero recovers, and waits for the ordinary turn handoff.

- The UI gate checks full-charge FLOW and a 45/50 SP queue through Act, single-turn completion, absent retired draw controls, and steady scheduled-actor highlighting through busy action frames.

- The UI gate also verifies canonical hero-detail kit counts and overflow, and the production victory dialog after a native final hit.

- The UI gate captures enemy-to-nonattacker orb flight before charge and verifies collection, readiness and one-turn completion across its viewport profiles.

- Death-only FLOW supersedes attack/proc drops: enemy KO awards once; collection charges a random living hero after the original blue death-orb ground-bounce tween. Role events award nothing.

- Results presentation lock measures 80% canvas width/height, center alignment, full-canvas shade bounds and rgba black0.4 across every viewport profile.

- The UI lock now drives an exact displayed shop offer through Gold purchase and Hero Gear equip at every profile, checking four tracks, containment, canonical ownership and stat effects. Test wallets are arranged only in isolated browser contexts.

- `export_actor_puppets.mjs` rebuilds editable Synfig pilot sources by default; `--render` exports existing SIF files without overwriting manual edits. Keep native bones in authoring sources and simulation authority outside clip metadata. Attack/cast torso and companion head keys lean toward the target at the reduced amplitude; verify pivot direction in native renders before changing angle signs.

- Hondo and Kaja reuse the Fara pilot layout and motion curves with character-painted slots. `PUPPET_ACTOR=hondo,kaja` regenerates only those actors and preserves other manifest entries; source metadata supplies facing and relative paint paths.

- Server fingerprints identify actual repository origin, commit, source root and Bag/legacy renderer. A Bead ID comes only from the branch; never infer ownership from the tracker queue or unrelated commit history.

- `complete_missing_actor_clips.py` exports only recovered Djinn/High Orc sources through native Synfig1024 to Lanczos128. It preserves existing sources and supports actor/state-scoped re-export; never run the pilot exporter over recovered packages.

- Run pad_actor_motion_clips.py after affected native exports. It re-renders an expanded view box rather than padding already-clipped PNGs; referenceHeight128 and translated foot origins preserve body scale. The owner review capture script lives with its generated output, outside the production game.

- The rendered UI lock also runs bossBattleHud.test.mjs for independent boss HP/countdown rails, actor identity, inspector lifecycle and phone containment.
