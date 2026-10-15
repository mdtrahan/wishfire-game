# Tools DOX

## Purpose
- Own repo automation for local serving, browser QA support, Rust WASM builds, Beads/Git support, and harness execution.

## Ownership
- `serve_web.js` serves the browser runner and writes `web-runner/runtime-fingerprint.js`.
- `balance_harness.js` is the canonical batch game automation path.
- Balance fixtures preload lamp and `orka.hero_progress.v2` saves before navigation, preserve input/output bytes for provenance, and reject progression saves whose version, roster, identity, level, or HP would normalize on restore.
- Recovery evidence records observed progression boundaries and ordered post-recovery enemy KOs; skipped polls or event gaps remain unknown rather than inferred.
- `ui_presentation_lock_gate.mjs` is the canonical fail-closed rendered presentation gate for approved responsive UI seams.
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

- The balance harness creates one fresh browser context per seed, reports stage clears, boss clears, defeat recoveries, sampled hero HP, ordered KO and exact opt-in damage/healing events, and progression endpoints. It keeps incomplete wave targets, event gaps, and unknown mechanical types explicit; `--captureFrames true` saves real rendered combat and recovery frames, with a runtime reveal-state gate for the recovery frame.
- Opening-roam reports retain the first observed start and the pre-recovery release point; a missing start or release remains unknown instead of becoming a successful-stall claim.
- `--serveRoot` permits an unchanged SHA checkout as the game source while the harness runs from this lane. Reports pin both game and harness fingerprints. On older builds without the wave-clear or recovery counters, observed stage transitions are a limited fallback; ambiguous changes stay explicit, and missing recovery/ordered-event telemetry stays unknown.
- On deadlock or timeout, preserve the final rendered frame, actor coordinates and enemy stream state so movement stalls can be distinguished from unavailable enemies.
- Session output includes each starting hero's level, combat stats, attack type and CP plus starting/ending equipment loadouts for strength-matched comparisons.
- Boss attempt records distinguish clear, KO recovery and harness timeout, preserving last observed HP. The current runtime has no observed boss game timer, so harness timeout must never be reported as a game timer loss.
- Defeat recovery is a normal route through continuous stages. Balance acceptance gates earned wave completion and deadlocks; recovery count remains a diagnostic and separate recovery fixture surface.
- The optional `--autoEquip true` scenario clicks the visible Collect and Auto-Equip lamp controls during combat and records initial/final equipped slots and lamp emissions. Reports without that flag observe fresh unbuffed play; do not present them as geared player outcomes.
- For matched equipment draws, `--lampSeed <uint32>` preloads a fresh save built by the game's own lamp constructor before startup. The harness verifies and reports the loaded seed; collection and equipping still use visible controls. A shared lamp seed does not imply identical final gear when sessions take different actions or durations, so compare recorded loadouts.
- `--saveLampFixture <path>` exports a headless session's lamp save for reuse. `--lampFixture <path>` validates that save through the served build's conveyor rules and preloads the same equipment state in each isolated browser context. The reported SHA-256 covers exact fixture file bytes. Compare opening hero stats before calling a matrix matched-strength.
- `--heroSlots` accepts four comma-separated canonical hero slots, including empty slots, through the existing dev tooling config before Canvas START. Verify and report the applied party so healer and no-healer runs cannot silently use a different roster.
- `--maxBossClears 1` targets a boss victory instead of ordinary-wave count. After a recovery latches manual retry, the harness uses the visible Summon Boss control; a boss trial must record its own clearance and completion.

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
