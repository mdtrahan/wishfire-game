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

2026-09-14: ORKA-krv now preserves Faze's `dot` kind through the DOM and Canvas damage-number renderers and colors it with the existing Blight purple palette. Focused contracts passed 17/17 with 4 intentional skips; fresh in-app QA showed purple `2` floats over all three living enemies at Faze impact.

2026-09-14: ORKA-t3r replaces Arcane Pulse's party-midpoint source with the casting hero's rendered resting sprite-base anchor. The renderer publishes that point before lunge offsets; both function-bank mirrors consume it. Focused contracts passed 9/9 with 18 paused-system skips; fresh in-app QA showed Runa's Pulse curving from her planted base toward the selected enemy.

2026-09-15: ORKA-7p7 adds four low-detail raster combat effects: a shared contact flare, Split's broad sweep, Runa's blue bolt and Kaja's purple orb. Magic basics remain at their resting positions. Normal-player autoplay exposed missing VFX metadata on native-command packets after the first QA pass; the shared command packet now carries that presentation through the production path. Fresh regular-session QA showed Hondo's contact flare and Kaja's orb plus contact flare with no Quest-QA query.
2026-09-15: Added `governance/product/combat-vfx-index.md` as the authoritative origin/delivery/contact/residue inventory. Existing accepted effects are locked, and separate Asset/Wire/Live gates expose every remaining hero, enemy, board-control, ground, and healing presentation gap.
2026-09-15: ORKA-7p7 extends the shared VFX path to enemy attacks and healing. Physical enemies now flare on damaged hero sprites; `MAG > ATK` keeps enemy casters at rest and selects Djinn rain, Marid crescent or Chimerilass eruption with matching purple, blue or rose contact art. Magic Fruit uses the illustrated green-gold bloom, and simultaneous heals share a healing-rain canopy. Normal player-path captures verified the enemy melee impact and Magic Fruit blooms; rare caster and enemy-heal sequences remain Live 0 in `combat-vfx-index.md` until encountered naturally.
2026-09-15: ORKA-7p7 adds named enemy magic precedence. Scathe now uses target-centered electric crackle, Sweep uses its own aqua crescent, and Wipe uses an overhead mint-gold wash before resolved heal blooms. Enemy heal actions no longer inherit Chimerilass's offensive eruption. Ordinary autoplay visibly confirmed Destiny's restored heal bloom; rare named enemy skills remain Live 0 pending natural observation.
2026-09-15: ORKA-7p7 replaces Arcane Pulse's legacy procedural arcs with an illustrated charge, straight crescent travel, short trail, and matched contact. Heals now stage a ground sigil, rising fountain, falling motes, and progressive group rain; vertical attack assets reveal upward or downward according to their motion. Fresh ordinary autoplay showed the staged Destiny fountain with a clean console.
2026-09-15: ORKA-7p7 adds the shipping Enemy MAG AOE brushfire and Drain Buff inward-orb/aura sequences. The AOE rises from the hero group's ground line and gives every damaged hero a matching rose contact splash.
2026-09-15: ORKA-7p7 closes the party draw-pool inventory gap for Grow. Its established persistent hero scaling remains intact, while a new turquoise-gold spectral-hand pair reveals upward around every affected hero during the initial application.
2026-09-15: ORKA-7p7 audits the separate 44-card session buff allowlist by effect family. Spectral Orb and Chain Strike reuse their accepted illustrated paths, Dawn Chorus reuses staged revival healing, Venom Sigil now rises from an illustrated poison glyph, and Glass Reprisal sends a cyan-white shard crescent into a matching contact splash before its heal bloom.
2026-09-15: Fresh ordinary-session capture at `?build=session-proc-vfx-v1` visibly verified Runa's straight blue projectile and Kaja's violet orb with their matching contacts; the browser warning/error log was empty. Both rows advance to Live/Done in the combat VFX index.
2026-09-15: Ordinary-session capture exposed AF Chain Strike II rendering beneath the 344 ms card-selection fan. Both function-bank mirrors now delay AF Chain Strike and Arcane Pulse transient presentation until the fan clears. `?build=chain-reveal-delay-v1` visibly captured the cyan ribbon joining damaged enemies with an empty warning/error log; Chain Strike advances to Live/Done.
2026-09-16: ORKA-7p7 contact splashes now center their painted alpha bounds on the target-facing torso surface, 12 logical pixels toward the attacker. Strong Runa blue and Kaja purple basic impacts render at 1.6x the shared regular size; weak hits retain the small white tier. The live comparison sheet is `output/qa/impact-splash-size-report.html`. Focused VFX contracts pass 10/10; a fresh ordinary session started through the map and opening party draw with an empty browser warning/error log.
2026-09-17: ORKA-7p7 presentation-serialization plan checkpoint. One actor owns presentation until its last visual completes. Melee sequences lunge, resolve and finish effects before retreat and handoff. Ranged attacks and every heal resolve from the actor's stored slot-home with no lateral lunge. Chimerilass self-heal and hero Magic Fruit are the required live regressions; combat math and initiative order remain unchanged. Files currently touched are listed by `git status --short` in this bead worktree before delegated implementation.
2026-09-16: Restored per-target contact splashes for Chain Strike and multi-target attacks. Chain bounce and hero AOE packets now carry the attacking hero's VFX kind; immediate AF Chain Strike II publishes one timed impact request per resolved target; shared target anchoring now mirrors enemy slot fallback geometry so implicit enemy coordinates no longer collapse splashes onto one body. Verified 21 focused contracts and live V30 runtime: primary target splash followed by distinct upper/lower bounce splashes.
2026-09-16: Restored independent random living-enemy selection for automatic hero single-target attacks. Role labels no longer collapse the party onto one deterministic target; owned manual selections remain exact.
2026-09-16: Corrected the shipping native `HeroTurn` path, which was reusing `SelectedEnemyUID` across actors and bypassing the shared random target rule. Each automatic hero now draws and records a fresh living-enemy target before issuing its command.
2026-09-16: Live production QA caught and fixed the initial `HeroTurn` randomization patch passing the full actor roster to the chooser. The shipping call now supplies enemies only, preventing invalid ally targets and command stalls.
2026-09-16: AF Chain Strike II now uses one neutral impact splash for its primary hit and both bounces. Party-owned Chain Strike no longer inherits Kaja's purple basic-attack contact; ordinary Kaja attacks remain purple. Focused contracts pass 20/20, and the isolated Kaja runtime completed all three Chain Strike hits with an empty error log.
2026-09-16: Fixed the refreshed Chain Strike QA lock. Its retired manual-action setup left dev tooling paused and published an enemy-slot registry that disagreed with the rendered encounter, so the production scheduler waited forever for a refill. The scenario now resumes through the existing dev-runtime seam, synchronizes the three live enemy slots, and enters combat through `StartRound` plus `ProcessTurn`. Focused contracts pass 14/14; fresh V38 in-app runtime advanced through all four heroes and the enemy round. A separate normal session resumed autoplay after its opening card choice.
