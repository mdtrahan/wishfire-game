# Moved To Archive

Moved to: `docs/archive/2026-02/progress.md`

Reason: Superseded by Beads issue state and activity history

## ORKA-aoq · 2026-09-05

User request: checkpoint the current work, replace Story Mock with existing dialogue, gate combat until the authored combat point, and let Skip enter combat directly. Validate in the in-app Browser.

Checkpoint: local main and latest narrative source have named rollback tags. The complete reviewed case-study artifact is archived with a SHA-256 manifest under output/ORKA-aoq-checkpoint. Source narrative runtime/assets are clean; source skill edits and root dirt remain preserved.

Implemented: selectively imported the latest narrative runtime/content/artwork and connected it to the existing Story Mock slot. Combat unlocks at warp-017 or Skip. Existing developer combat scenarios use the same Skip route; failure returns through Town recovery. Dialogue after warp-017 remains in the content pack, pending an authored combat-completion route.

Validation complete for opening-to-combat scope: 54 focused tests pass. Full suite has 820 passes and the same three failures as current main (794 passes): heal-bloom wiring, Kojonn red queued totals, and Clear Skills cleanup. In-app Browser manual progression, Auto, Skip, compact Skip, combat interaction, and post-handoff map navigation were exercised. Evidence and recoverable candidate bundle: output/ORKA-aoq-checkpoint/QA.md. Changes remain uncommitted in the isolated branch.

## Chapter 1 map entry (2026-09-05)
- Checkpoint: output/ORKA-aoq-checkpoint/pre-chapter-map/checkpoint.tar.gz and manifest.json preserve pre-edit owned files and approved art.
- Approved C map exported at 360x640, caption removed; rendered START button beneath token. Either token or START begins first dialogue page; terrain clicks stay on map.
- 56 focused tests pass. In-app Browser at localhost:8027: fresh map, terrain click ignored, START -> first page -> Skip -> combat; compact 240x426 town tap -> first page. No browser errors.
- Changes remain in the ORKA-aoq lane; no commit or merge.

## ORKA-aoq synthetic quests · 2026-09-05
- Added 10 roster-derived stages in existing Encounter CP order, each using the existing enemy-slot encounter path and sprite crop. Restored numbered Main Story parts.
- Preserved 320-unit chapter/card alignment with scrollbar outside the column, thin scrollbar and crop line 18 units above navigation.
- Focused flow, CP, encounter-pool and app-boundary checks: 15 passed. In-app QA verified story completion, Stage 1-3 battles, progressive unlocks, cropped portraits and Back; final viewport gate evidence under test-results/ui-lock.

- Main Story 2 moved between Stage 5 and Stage 6; its creature question now reads “What were those things?” Focused narrative/quest checks: 17 passed. Midpoint unlock screenshot captured by the existing quest viewport gate.

- Restored normal-play default enemy targeting by reusing the pending-target fallback before render and capturing a valid target intent. In-app QA: red attack showed default yellow selector, ATK hit without enemy tap, manual selection moved selector. 21 focused target/handoff/autoplay/boundary checks passed.

- Fresh encounter initialization now resets Astral Flow charge and transient battle conditions; Continue preserves its current instance. Gold uses local persistent storage and stays outside the combat reset. Removed the duplicate static HP bar drawing. In-app proof: earned 3 gold, reloaded, entered a new battle, retained 3 gold with empty Astral Flow and one HP bar. Focused startup/reset/currency tests passed (24); quest viewport gate passed 15/15.

## 2026-09-06 publication preparation
- Verified pre-publication checkpoint: 64 files in output/ORKA-aoq-checkpoint/pre-publication with per-file SHA-256.
- Shared navigation migrated fully; removed unreachable Canvas nav handlers and updated route tests.
- Candidate full suite: 826 pass, 3 inherited failures (heal bloom source contract, Kojonn red queued totals, Clear Skills unload); current main baseline has the same three failures.
- Netlify linked site orka-alpha-mvp automatically builds GitHub main; runtime-only dist build replaces repository-root publication. Existing local main is 15 commits ahead of origin/main.

ORKA-49k.7: personal charge and native queues implemented; party cards paused. Follow COMBAT_MIGRATION_PLAN.md for current rules and COMBAT_MIGRATION_REPORT.md for validation. Historical milestone economics are superseded.


2026-09-08: Implemented canonical progression/kits/effects, independent action slots and battlefield targeting. Removed paused frame-tick callers. Final validation and checkpoint receipts are in COMBAT_MIGRATION_REPORT.md.

## ORKA-49k.7 · FLOW orb conversion

Owner requested replacing direct role charge with random-distribution orb collection while preserving ten role triggers as orb passives. Implemented capped base rolls, per-action passive checks, separate RNG, delayed collection and actor-projected gem flights. Full Node suite: 803 passed, 73 historical skips. Browser validation in progress.

## FLOW correction: enemy death and original bounce

Owner confirmed death-only rewards and requested the original blue death-orb ease/tween. Removed attack/passive drop paths and reused getAstralFlowKoOrbFrame. Full suite799 passed/73 historical skips; browser gate241/241 passed, including ground-bounce captures and production victory results.

## Results canvas layout

Owner approved 80% canvas width/height centered on both axes with full-canvas 40% black dimming. Implemented ResizeObserver layout and native modal backdrop isolation; browser gate250/250 passed across five viewport profiles.

2026-09-08: Hero management and Astral Flow equipment loop implemented in ORKA-49k.7. Shared equipment/Gold persistence, six slots, 16 placeholder items, four real-time tracks, purchase/equip/stat integration, CP/SP/AF trait display, and once-only victory Gold. Removed idle collector runtime. Node 800 passed/0 failed/73 historical skips; browser 265/265 at test-results/ui-lock/2026-09-08T21-51-41-128Z/ui-lock-report.json. Natural hidden-expiration proof passed. See EQUIPMENT_MIGRATION_REPORT.md. Work remains uncommitted in the owned worktree.

2026-09-13: ORKA-658 recovered the current native-autoplay balance harness and measured six fixed seeds. A single 2x canonical hero HP scale raised the minimum from 0 to 2 defeated enemies, median from 1.5 to 2.5, and median survival from 27.5 to 57.5 turns with zero deadlocks; every party still lost within the five-wave bound. Root IAB QA remains required because subagent IAB visibility is unsupported.

2026-09-13: ORKA-ymk.2 recovery made canonical hero definitions the sole role-AF owner, proving the initialized Falie/Huun/Runa/Kojonn party awards Comrade only to Kaja. Quest-QA fresh session now rebuilds deterministic production actors, clears prior telemetry, and holds the existing scheduler barrier until explicit resume. Heal, AF-special, enemy-hit, and Dawn controls run through production seams while paused; Dawn declares and enforces rank → forced roll → defeat. Focused contracts cover the opening party draw, generic-offer isolation, Magic Fruit heal text deltas, 396% Chain Strike II, and shield-first Crimson Ward. Subagent IAB visibility remains unavailable for the independent live smoke.

2026-09-14: ORKA-ymk.8 adds an active-combat Kaja Destiny QA condition and bounded scheduler trace. The trace exposed two runtime faults: the AF choice could request a second resume despite an existing enemy-owned handoff, and Destiny's turn-start heal presentation could block the same hero's native command. The choice now preserves its sole scheduler handoff, while Destiny applies after command claim. Fresh in-app runtime QA reached Destiny through Kaja's natural Comrade gain, then recorded native-command-started for Hondo, Runa, and Kaja before advancing to the next enemy. Focused contracts passed 35/35.

2026-09-14: ORKA-1uo makes Runa's Tactician AF reachable in native autoplay. Successful magic damage now qualifies alongside new status application, with one immediate 10-point award per resolved action and no role gem. Focused contracts passed 29/29; fresh in-app combat showed Runa at 10 AF after her first basic while combat continued.

2026-09-14: ORKA-krv restores Faze's enemy damage floats. The deferred Blight resolver again publishes purple-hit and damage-text state before applying damage, matching the earlier working runtime order. Focused contracts passed 25/25; fresh in-app QA showed a `1` floating over each of three living enemies at Faze impact.
