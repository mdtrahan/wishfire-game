# Tests DOX
- `combatArenaBackground.test.mjs` covers chapter 1–4 asset availability, chapter 5+ grid retention, undecoded-image fallback and camera orientation without changing vertical framing.
- `balanceTelemetryContract.test.mjs` protects opt-in capture, bounded event retention and pre-hit range geometry and enemy-tier attribution; `balanceHarnessEntryContract.test.js` protects exact-event use alongside sampled HP, including bounded impact samples and per-tier totals, ordered first-hero casualty aggregation, labeled post-recovery gear/stat samples, fail-closed uninterrupted ordinary acceptance and CSV output.
- `balanceHarnessEntryContract.test.js` also keeps the synthetic ordinary-KO probe opt-in and routed through production damage; integrated proof still requires recovery events and a later wave clear.
- Boss clock contracts require a fixed 30-second runtime deadline, reload normalization, and matching HUD and timeout receipt, even if an older stage object carries 18 seconds.
- `combatKnowledgeLabContract.test.mjs` proves the combat lab rejects provenance mismatches and undeclared or late claims, keeps missing data and gaps explicit, finds the first shadow-model divergence, stops counterfactuals at KO/guard/raw-damage cutoffs, never lets retrospective or MODEL evidence pass, and keeps harness logging/boss policy default-off.
- `sustainTrackerContract.test.mjs` protects fixed case IDs, compact verdict receipts, parallel duplicate suppression and immediate FAIL on any ordinary-farming Hero KO, even with incomplete later trace data.
- `partySustain.test.mjs` protects full-party five-seed, 20-wave trace projections, whole-HP credit accrual and reset at full HP, the 90% and 95% HP floors, quantized hit pressure, delayed refund burst vulnerability, boss timeout separation and compact concurrent tracker writes. A MODEL PASS is not live combat acceptance.
- `questCombatSessionContract.test.js` also proves recovery events record each hero's restored HP without attributing it to a healer. Its app-source routing contract checks the tick's ordinary recovery seam, executes that helper, and exercises the extracted app outcome check for boss continuation and full-wipe recovery.
- `storageBudgetContract.test.mjs` proves oversized payload/tree/runtime rejection and staged generated-output refusal. Worktree linking tests prove output/backup exclusion, preservation of source and refusal over dirty tracked excluded paths.

- `storageHygieneContract.test.mjs` must cover default detached and unmerged refusal, the opt-in historical path's ancestry and local guards, and opt-in superseded-ancestor refusal for missing successor ancestry, non-CLOSED Beads, dirty source, Dolt, or protected evidence.
- General `--historical` coverage must prove unmerged branches with durable refs can retire while dirty source, unknown evidence, Dolt, main, and detached HEADs without a local ref refuse.
- `linkBeadsWorktreeContract.test.mjs` verifies a fresh checkout points at the root Beads database and refuses pre-existing lane-local Dolt state.
- The storage cleanup contract treats only the exact ignored `.beads/redirect` file as regeneratable; lane-local `.beads/dolt` state remains protected.

## Purpose
- Own regression contracts, ownership-boundary proofs, fixture parity, and targeted runtime behavior tests.
- Make historically fragile behavior explicit and repeatable.

## Ownership
- `*.test.js` files use Node's built-in test runner for contracts and static/runtime checks.
- `*.spec.js` files cover browser-style flows where present.
- `offlineBundleContract.test.js` protects the portable file:// release shape, embedded startup and elemental impact manifests, relative frame assets, manifest hashes, and separation from the hosted release.
- `fixtures/` owns deterministic CSV cases shared by JS and Rust/WASM tests.

## Local Contracts
- Equipment-service fixtures initialize HeroProgress with createHeroProgressStore unless they explicitly test missing-owner rejection. Retain reward, quota and persistence assertions when repairing setup.
- Lamp browser proofs check full opacity in cache and selected-item views, including unavailable Equip actions, while retaining disabled overview selection and equip eligibility.
- Boss progress proof executes the production tick: each chapter's final ordinary wave enters once and saves readiness before the wipe; ordinary recovery preserves wave and sector-mask progress, boss defeat saves full readiness, and both survive reload without duplicate packs. HP depth checks preserve puppet-foot anchors during clip loading. Hit-flash contracts inspect assembled puppet callbacks. Keep chapter/rail centering and dynamic notch geometry measured independently.
- Manual retry proof keeps first clean boss entry automatic, latches every stage KO and boss defeat through checkpoint reload, loops ready fodder at 100%, blocks summon during KO/recovery reveal, and verifies explicit summon uses the existing arm path. Boss victory clears the retry latch; a single KO during the boss still follows the whole-party defeat rule.
- Arena engagement proof advances the real arena owner and enemy scheduler together: all living actors in local sectors can enter independent melee/ranged actions in one tick, out-of-reach actors remain unscheduled, and remote roaming packs remain dormant.
- `combatBossFallbackContract.test.mjs` protects ready/active interrupted visibility, compact top-band bounds, suppression of the rail, transaction-safe lamp closure, and one-time return to the existing combat snapshot.
- Ground-skill presentation checks preserve planted zone point/radius across caster movement, recipient foot projection, source/target KO eligibility, exact expiry, paused-frame equality and zero simulation mutation.
- Puppet selection tests route actual hero definitions and enemy catalog names to their source IDs, keep KO owned by HP, reject stale KO facing for living actors, and preserve simulation clocks while outgoing puppet images bridge death/revival loads. Initial-load churn, synchronous decoded flips, full enemy manifest coverage and executed assembled draw callbacks must prevent actor disappearance and static substitution.
- `storageHygieneContract.test.mjs` protects the worktree-retirement guard and an apply fixture; a lane is eligible only when present, clean, merged, tied to a CLOSED Bead, and free of protected ignored files. Unknown evidence and dirty source must survive a refused apply.
- Lamp browser fixtures use bounded page waits and the current Hero screen tabs/selected conditional-skill detail, with unlock checks against authored definitions. Measure upgrade geometry after the runtime positioning frame, preserving all containment assertions.
- Lamp rules protect durable spending, migration, unique assignment and previewed salvage. `npm run test:lamp-ui` starts an owned local server, checks four phone viewports and proves combat continues during comparison; screenshots and numeric evidence live under `test-results/lamp/`.
- `elementalImpactVfxContract.test.mjs` protects lazy per-element frame loading, approved manifest cadence, skill mapping, target centering and the 52 logical-pixel impact size cap.
- Function-bank VM tests that extract individual helpers must terminate slices at either exported or private function declarations.
- Story-entry checks exercise the shared layout registry and transition controller: deny early navigation, preserve pagination, hand off at the authored marker or Skip, stop Auto in combat, and retain Town recovery. Browser QA must exercise the visible Canvas controls too.
- Quest-QA layout contracts cover fixed rail containment, the compact dock fallback, Canvas geometry preservation, diagnostics z-order, zero horizontal overflow, Combat-layout scenario setup, pause ownership, fresh telemetry reset, and isolated role-award readouts.
- Paused-combat navigation checks must preserve the active card and snapshot through Continue, intercept Quests from any suspended screen, and clear the snapshot only on Quit without settlement or rewards.
- Tests are often the clearest owner of regression-prone behavior. Read the relevant test before changing gameplay, rendering, persistence, or SimulationCore code.
- The continuous stage contract distinguishes ordinary wave HP carryover from boss-clear full-party revival, cleanse and saved HP refresh.
- Balance harness contracts must count earned ordinary clears and boss clears from stage transitions, treat defeat recovery as a tracked route, and distinguish observe-only runs from visible lamp collection and auto-equip scenarios.
- Boss-surrender coverage exercises queued near-lethal work, reward-ledger removal before settlement, full recovery with readiness/manual retry preserved, active-attempt checkpoint normalization, non-boss no-op, and the production layout, Lamp, visibility and `window.pagehide` exit seams.; an already-removed boss actor must still be identified by its active-stage UID without discarding earlier fodder rewards.
- Prefer focused deterministic tests over broad suite runs during development.
- Static source assertions are allowed in this repo when they protect architecture boundaries, but avoid adding brittle source-shape checks when behavior can be tested directly.
- Full `npm test` may include unrelated legacy/static failures; report focused validation scope honestly.
- Do not weaken an ownership contract to make an implementation pass unless the product/architecture source changed too.

## Work Guidance
- Name new tests after the behavior or contract, not the implementation detail alone.
- For bug/regression beads, add the smallest test that fails for the old behavior and protects the intended owner.
- Update fixture tests and CSV data together.
- Keep helper extraction inside tests small; if helpers become shared, move them deliberately.

## Verification
- `node --test tests/<file>.test.js`
- `npm test` only when broad validation is needed and expected to be meaningful.
- Browser/Playwright checks only for behavior that cannot be covered deterministically.
- `tests/uiPresentationLockGateContract.test.js` protects the rendered gate command, viewport matrix, rejection mode, evidence inventory, and staged-path routing. The browser gate supplies the behavioral proof for those static seams.

## Child DOX Index
- `tests/fixtures/AGENTS.md` - deterministic CSV fixtures and JS/Rust parity data.

- Story entry proof covers map-only startup, town hit gating, first-page preservation, Skip, authored combat handoff, and Town recovery.

- Quest flow tests replace direct story-to-Town recovery expectations with ladder completion and Continue/Quit; gallery/map Back routes now return to the quest ladder.

- Health contracts verify actual actor HP, stable sparse/KO slot projections, cleared previous-group totals, and real JS-to-WASM damage for every loaded size from one through six.

- Native command proof covers scheduled actor ownership, rejected/stale targets, missing-actor handoff, animation handoff and exact loaded slots. Legacy board click/refill assertions are retired with their consumers. The UI lock checks actor-owned HP bars, absent combat-card UI and real battlefield targeting for groups of one through six.
- Full-recovery proof exercises both the app Town wrapper and Continue with zero through six loaded heroes, sparse slots, KO, stale UI health and retained encounter resources.
- Self-heal checks must use differing actor and party maxima, actual groups 1–6, and KO/wrong-actor cases. Percentage recovery cannot grow with party size.

- Continuous-production coverage proves deterministic stage order, independent per-hero basic rates with staggered due-time starts, enemy cooldown ownership and clean skill presentation barriers. Combat-card modules, assets, connectors and UI must remain absent. Production-party regressions must construct the configured canonical roster before testing UID and role attribution.
- `realtimeHeroBasicSchedulingContract` exercises live `TickRealtimeHeroBasics` for opening cooldown seeding, staggered due-time dispatch, target-range revalidation, overdue readiness, bounded catch-up, and same-UID session reset.
- Its focus fallback cases require simultaneous Heroes and pending hits to resolve only targets within each source Hero's own reach.
- `realtimeTwoWaveIntegration.test.mjs` records scheduled hero and enemy actions across overlapping waves, active-skill recurrence, per-actor clocks, impact HP/time, boss gating, pause/resume, and once-only defeat/retry reward receipts.
- `continuousCombatLifecycleContract` protects continuous-mode fences around app-owned legacy turn calls and requires pause/hidden/defeat exits before simulation scheduling. `continuousCombatStageContract` proves one stage/checkpoint and one boss per chapter, with 10 waves in Chapter 1, 15 in Chapter 2, then 20 except 5 on every fifth chapter; report the UI label as Chapter N, six deterministic sector identities for regular chapters, six seeded weak solos with distinct runtime encounter groups, 120-unit minimum pack clearance across 64 seeds/two enemy sizes, moat and world bounds, 40-unit patrol bounds with at least 100-unit enemy separation and normal detection/recovery behavior, persisted per-sector HUD progress, unfinished-pack-only recovery, full-clear plus three-second ordinary wave pacing, edge-safe left/right boss staging, fixed roster slots, and encounter traversal; reward integration confirms solo deaths use the once-per-UID receipt. Three packs/sectors and 1.5x enemy HP in five-wave chapters remain provisional candidates; 0.4% maxHP/s passive recovery and gear maxHP delta fill remain provisional. Recovery tests project the huddle to section B center and hold it during the 350 ms reveal before pack detection. Pack feedback must not weaken the actual wave-clear presentation barrier. `combatSimulationTickContract` also proves first-KO scheduler interruption, 350 ms recovery holds and unchanged boss-entry wipe behavior. Progression tests cover partial/full checkpoint reload, full boss readiness after defeat, and legacy deferred-flag migration; combat boss fallback tests cover explicit return.
- `realtimeEnemyActionSchedulingContract` exercises independent concurrent enemy actions, later wave entrants, stable target revalidation at impact, no-target readiness, tier-scoped melee/ranged/boss intervals, bounded per-tick service, and start-to-start cooldown cadence.
- `realtimeBasicCombatRulesContract` proves launch damage parity and impact-time Blind, damageCut/barrier, counter, KO reward, source-KO projectile continuity during a boss attempt with a surviving ally, ordinary first-KO interruption, target-range revalidation and impact VFX through the shared resolver.
- Combat simulation tick coverage executes pending hits, damage-text expiry, HeroAction, refill, YellowCasino progression/payout, BlueBuff, buff-icon, and merge transitions without relying on draw calls; assembled-renderer checks protect boss camera/orientation/scale/wipe and the remaining presentation-only seams for those flows. YellowCasino tests also preserve ghost drawing through `renderBoard.js` and guard one-shot Gold/gate settlement.
- Shared-focus coverage keeps all continuous hero basics on one living enemy until death, then advances in encounter order without random selection. Legacy HERO_SINGLE random fallback and effect-owned area targeting remain separate.
- Enemy-stream coverage fixes the single-X staggered emitter, bounded varied Y homes, Y-based sprite depth, three-second post-range-entry cadence, seeded per-sector CP padding from two-or-three base actors up to six, shallow linear CP rise, survivor overlap, role-shaped attack motion and boss clear gate.

- Migration coverage uses `combatRulesMigration`, `heroProgressionMigration` and `continuousCombatStageContract` for canonical effects, growth, infinite stage wrapping, and immediate no-reward enemy removal. VM function-bank harnesses must inject the real core/module imports.
- Timed boss contracts cover live-boss deadline expiry, victory precedence including a last-Hero lethal trade behind death presentation, same-stage recovery with failure HP, the blue HUD gauge, and separate game versus harness timeout reporting.

- Action capacity tests cover mixed 1/2/3 slots, affordability, removal and early commit. Browser proof exercises real target clicks and capacity auto-commit. Paused frame-based regeneration must not affect combat.

- Presentation serialization contracts keep attack motion before damage floats, heal art before heal floats, and defeated targets visible from their lethal native command through the completed package.
- Impact contracts keep weak rings at each rendered sprite midpoint, place common non-weak contacts 17% of actor size above it, and verify that Venom plus enemy heal eruptions begin at the target's feet. Spectral Orb must travel as the counter-clockwise drain orb before its G01 blue contact.
- Quest-QA enemy HP setup tests cover every refusal state, exact living-enemy HP mutation, preserved enemy identity and placement, and the absence of damage, AF, gem, reward or animation side effects.
- Faze presentation proof covers live purple-hit and `dot` damage-text state before each deferred Blight damage call; palette contracts and in-app QA must show a purple number over every living enemy at impact.
- Arcane Pulse presentation proof binds the queued visual source to the casting hero's rendered resting sprite base and keeps it independent of lunge offsets.

- Hero management browser proof covers overview disclosure, roster containment and separate canonical active/passive/FLOW categories.

- equipmentMarketContract covers elapsed-time reconstruction, live/expired/duplicate/insufficient purchases, atomic save failure, shared loadouts, gear-stat reloads and once-only victory Gold. Retired idle-collector tests were removed with their runtime.

- Run node --test tests/astralShopPresentation.test.mjs with localhost:8047 serving the owned checkout to check the shop shader, reduced motion, shared balances, Back navigation and compact/reference containment in isolated contexts.

- Shop presentation test covers touch and mouse drop purchases without confirmation, exact wallet deduction, canonical inventory and green upgrade badges. FLOW Back returns to the main shell; open Quests explicitly before comparing the shared wallet. Equipment contract tests cover equal, stronger, incompatible and tradeoff comparisons.

- Lamp equip proof covers five mandatory stats including HP, v3-to-v5 preservation, filling only gained max HP on gear growth, Skip retention, and recipient floats using the saved before/after CP receipt.
- Continuous-stage proof covers the capped ordinary-wave heal for living Heroes and keeps gear max-HP growth fill separate.

- Lamp presentation verifies 15-second idle guidance, Hondo-to-Auto-Equip targeting and dismissal by ordinary document clicks using an offset monotonic clock, preserving live combat timing.

- Bag draws preserve old saved EXP while granting none. Full-cost Bag upgrades preserve the existing capacity/rarity curves and draw cadence.

- Lamp cache presentation checks five full-width square columns, a stable two-to-two-and-a-half-row scroll viewport, selected halo and preserved idle guidance across four phone widths.

- Lamp regression proof enforces one actual hero CP invariant across arrows, manual Equip, Auto, queueing, preview and locked dismantling. Every successful equip raises CP; every item in disposal is red for every current hero. Re-evaluate all remaining items after each assignment, preserve unique ownership and failed-save atomicity, and verify newer arrivals survive old disposal snapshots.

- Equip-close proof requires the modal to remain visible while its CP float plays, including the last Auto-Equip item; after automatic close no CP float may remain.

- Every successful lamp emission shares a saved two-second minimum interval. The core rejects early calls before rolling or granting EXP; UI disables/re-enables the lamp from that saved cooldown. Auto keeps its five-second cadence. Reloads, concurrent clicks and switching manual/Auto cannot reset the gate.

- Dismantling grants Essence only. Gear draws grant zero EXP; Hero ticket spends use saved progression receipts.

- Receipt tests enforce two seconds for dismantling and 1.5 seconds for COT, then automatic removal.

- Lamp restart proof separates durable cache/EXP/loadouts from session arrivals. Test saved Auto-on restarts off, idle emits nothing, the first manual burp appears, and an explicit unlocked Auto toggle resumes generation.

- Dismantle lifecycle proof generates more than five raw items, confirms conversion, requires five empty arrival positions at cache zero, then verifies exactly one new arrival on the next manual burp.

- Strip redesign checks the count-only speech bubble, upper-right Auto states and saved essence/current-tier progress. Review omits corner rarity letters; restored arrivals stay empty. Use natural emission video plus separately disclosed Lv5/essence fixture for the upgrade and Auto-state proof.

- Lamp strip checks follow the reference upper-left AUTO position and require the complete left progress corner beneath the level disc. Shared strip coordinates, circular badge bounds and the left-centered 95% arrival group are measured by `output/qa/lamp-check-alignment.cjs`.

- The strip disc displays the earned Bag level; its smooth meter follows banked Essence divided by the full next-level cost, capped visually at 100%, or MAX. It has no intermediate notches. Overflow remains in the bank after Level Up.

- Bag upgrade regression covers full-cost spending, stale/concurrent requests, failed saves, overflow, reload, MAX and exact paid-stage credit/backup. Verify existing gear, canonical Hero EXP and draw behavior are unchanged.

- Guidance proof checks durable duplicate receipts and failed saves without rewards; phone QA covers dismantle/preview/shortfall/affordable/MAX retargets and reload. Disclosed monotonic-clock offsets test idle guidance only, preserving Date.now draw cooldown and combat inputs.

- Lamp comparison proves positive/zero/negative actual matching-slot replacement CP, per-hero arrows, blocked red Equip, blocked green disposal, and strictly positive saved receipt agreement across four phone profiles.

- The four-phone lamp guard hit-tests and clicks Close during active CP feedback, verifies deferred closure, and rejects remaining CP floats after departure.

- Four-phone rapid feedback proof uses a disclosed six-item fixture, alternates three receipts per hero, and samples12 animation frames for containment and pairwise overlap. Earned videos separately prove saved values and natural pacing.

- Auto Equip regression freezes the ordinary 69-draw candidate batch whose standalone CP leaders hide total-party tradeoffs. It compares all four heroes' three slots, permits multiple assignments per hero, preserves unique items and EXP, and leaves no positive queued candidate after convergence. Reverse cache order, a nonlinear slot revisit, exact +0.1 gain, failed save, and the 50-item capacity path keep the planner deterministic and bounded by the finite inventory state.

- The four-phone lamp guard rejects ancestor clipping of smoke above the unchanged strip and verifies 80% disabled brightness with full brightness restored after cooldown.

- Lamp review checks positive-upgrade-first entry, eligible-only Skip traversal, final Dismantle preview, all-gear manual inspection, protected Auto-Equip, and atomic queue retention on failed saves. Compact presentation still checks hero art, CP direction/arrows, card geometry, inventory rows and overflow; await durable guide/Skip transactions before asserting enabled actions or dismantling contents.

- Lamp phone proof injects one isolated equipment-save failure, requires the saved record to remain byte-identical and no CP receipt, and verifies a readable contained notice without master overflow.

- Lamp phone proof samples rendered arrow tip/head widths for positive and negative portrait and stat glyphs; reject flat tips independently of ancestor overflow.

- Lamp stat-height proof compares all five backing/display heights and painted numeral heights across both rows; different numeral bounds must not resize arrows.

- Lamp band proof checks all five shared rarity colors in an isolated CSS palette fixture, then restores the candidate; rarity letters remain absent.

- Lamp stat alignment proof checks matching label right edges/value left edges across rows, right justification, centered allocated grid within1px, broad card coverage, mockup column anchors, a digit-width label/value gap and value headroom at all phone profiles.

- Lamp centering proof retains cache/card atlas bounds and checks all nine real strip sprites in five-slot arrays at the final bounce frame, against the tallest silhouette's midpoint within0.5CSSpx. A held artwork-preparation fixture must prevent a draw/EXP receipt until release, then settle the real cap draw without a residual transform.

- Cache-selection proof samples full/shrunken/full animation phases, preserving artwork midpoint, tile/CP-footer bounds and containment. Check selection transfer,23% halo dimensions and reduced-motion suppression.

- Lamp odds containment checks text ranges inside every table cell, alongside panel and action bounds; a contained outer panel cannot certify unclipped percentages.

- progressionTransitions protects atomic immediate Bag promotion and reload, plus unlocked/direct/reactive skill gates, progression presets, namespace-only reset and tier-owned boss restoration.

- Basic-rate coverage preserves authored hero ordering, SPD independence and independent skill cooldown clocks; representative four-hero combat must keep basic cadence and skill recurrence valid.
- Conditional-skill proof covers all 33 IDs, current-stat comparisons, recipient guards, modifier bounds, deterministic RNG preview, final expiry ticks, KO/revival identity, clean saved progression and real scheduler dispatch/refunds. Runtime VM fixtures must bind the actual imported realtime services when exercising changed seams.

- `actorClipPlayback.test.mjs` compares Hondo/Kaja normalized native XML to Fara across all seven states and both facings, preserving cadence and foot origins while checking every frame exists. It also checks every loaded actor's basic/cast torso source in both facings, including the forward 0.6-amplitude curves and untouched zero/recoil channels.

- Bag curve tests preserve all 100 accelerating capacities, full-level geometric Essence costs and fractional rarity odds. Retired installment fields are tested only as supported save imports.

- `heroScreenUILayout.test.mjs` serves the production Hero renderer, shared gear CSS/atlas and navigation in isolated browser contexts. Check portrait/row/tab/footer geometry at reference, compact Retina and natural sizes, all canonical active skills through four-card pages, actual metadata and unlock gates, hero/tab selection, and byte-identical saved/in-memory progression and loadouts. Keep isolated fixture proof distinct from native full-app captures.

- Hero roster fixtures place retired instance saves before canonical records with differing levels and loadouts; navigation wraps after four heroes while saved and in-memory records remain unchanged.

- Hero CP refresh proof keeps stale combat actors beside updated canonical progression, checks next-render CP across heroes and all tabs, and verifies manual/Auto equip receipts match saved and live CP before resolving.

- Bag/Equip proof covers highest actual gain recipient allocation, lower-hero-CP/party-order ties, re-ranking after every assignment, upgrade protection at destructive boundaries, permanently removed replacements, factual positive CP feedback, and unchanged COT/Essence receipts.

- actorPuppetDefeats tests isolate presentation lifetime, duplicate KO, expiry and session/reset handling. Reward lifecycle fixtures bind the real browser defeat-copy module; presentation must never alter reward counts or actor removal.
- Cross-tab Bag arrival checks wait for the specific emitted item ID to appear outside the frozen disposal snapshot; an unrelated unselected tile does not prove that arrival. Post-disposal phone checks sum salvage for every selected item because autonomous issuance can collect another valid item during the arrival wait.

- `continuousCombatStageContract` keeps ordinary-wave respite separate from boss-clear restoration. A Hero KO blocks ordinary settlement; surviving Hero HP must persist through HeroProgress JSON reload after either clear path.

- Lamp conveyor checks cover active-time pause/collection/restore, malformed clocks, failed checkpoint preservation, synchronous same-tab restore when exit transactions are lost, session checkpoint identity/number validation, and supported wall-clock saves. Bag presentation measures 40% tighter artwork-edge gaps at 360/450 and compact widths with travel below 27 seconds; production emitter QA holds full cache, equipment/disposal, native dialog and unrelated alertdialog states beyond the emission cadence and compares retained positions, ages, count, sequence and bounce totals. Saved-only feedback checks cover the last slot, duplicates, failed saves and lock-queued modal gates.
- `lampConveyorPause.test.mjs` retains real gear nodes through repeated CSS display-none menu exits and modal pause cycles at four phone sizes; restored positions and ordering must match the saved active age after the browser replaces its animations.

- Auto-Equip phone coverage checks that consuming the final cache item closes after feedback without displaying empty disposal; saved legacy salvage still opens an enabled confirmation.

- Boss fallback geometry checks keep combat at logical Y=42 below resources, including letterboxing. Visibility checks reject every non-combat layout, blocking modal and terminal phase without changing readiness. The rendered UI lock drives retry, equipment/Growth modals and HERO navigation on all standard phone profiles.

- `boundedPartyRoamingContract.test.mjs` checks stationary restored feet and separation in both camera projections, recovery, fifteen seeded complete waves through actual reach, and sparse melee/ranged world-corner targets. A production boss-clear regression covers right-edge and Y-outside all-living returns in both orientations, preserving settlement positions and limiting each0.1s step to7.8 world units. Oversized-Y return proof preserves separated targets and paths, then rejects collision pops on zero-time and first moving ordinary ticks. Synthetic damage is diagnostic; normal-entry candidate footage remains required. Formation fixtures belong inside the ordinary patrol; enemy placement fixtures retain full-world geometry.

- `combatDpsContract.test.mjs` protects actual-damage attribution, active-time hit rates and successful hit counts, no toggle reset, fresh-session reset, idle hit-rate decay and scaled overlay containment and canonical current CP refresh without importing boss policy.

- `combatDpsOverlay.test.mjs` drives normal entry and the real DEV checkbox at four viewport sizes, compares current CP with canonical equipped heroes, checks text/Canvas containment and saves screenshots. Hide/show must retain nonzero earned damage.

- bossBattleHud.test.mjs resolves the exact active boss UID, tests current stat changes and dismissal, and drives production summon plus four phone sizes at DPR 2. Its screenshots/report distinguish seeded readiness and paused presentation captures from organic balance proof. The UI lock runs this contract and guards its renderer/assets in pre-commit.

- Boss inspection stays open through zero HP, an expired clock and removal of the defeated actor while the same boss stage remains active. Actual stage exit dismisses in that render; retained actor data cannot cross into another attempt.

- devBossLaunch.test.mjs compares developer launches against canonical chapter spawn plans, rejects invalid input before refreshing, and drives the real numeric control from map and repeated boss sessions. Four phone captures guard control containment.
- `lampCPInvariant.test.mjs` supersedes the rejected standalone-slot tests. It protects one actual CP predicate, the Hondo +15 example, repeated full-cache reassessment, illegal zero/negative equips, green disposal rejection, stale-preview protection after another legal equip, and the valid case where a better equipped item makes the leftover red.
- Equipment ownership regressions replay Auto assignments against all twelve equipped slots and reject cross-hero transfers even when the foreign item would increase CP. Hero-screen browser proof includes canonical heroes plus combat-copy progression, cycles twice through the four canonical heroes, and checks unchanged saves and equipped slots at reference, compact Retina and natural sizes.
- Extracted app-tick fixtures provide the progression observation hook while testing checkpoint persistence independently.
- questMilestones.test.mjs protects saved per-slot equipment coverage, level steps of five, at-or-above rarity/level credit, family diversity across reloads, stale/duplicate claims, and witnessed zero-KO chapter clears including revival and unknown-history refusal.

- Chapter quest-band coverage checks inclusive endpoints, seeded enemy/gear generation, capped late chapters, frozen active targets and 40-count save reloads.
- `bagUpgradePresentation.test.mjs` drives production UI/storage in an isolated component fixture at four phone sizes and the natural desktop size. Guard reference pill colors, cell/close containment, disabled/ready/MAX states, failed-save suppression, capacity-only reward and detached X hit testing. Keep this component evidence separate from full-app native proof.

- Bag component proof locks the sample meter to a straight-ended 17.28px track at reference scale, 43px rotated badge bounds, 18px level labels and 13.2px parenthesized progress text across all five profiles; retain existing palette and save checks.

- Both Bag views must share the CSS rounded-square X with no image child; preserve detached placement and close behavior. Progress readout outer outline is2px (4px centered stroke beneath fill).

- Bag arrow midpoint proof measures the visible CSS triangle box against every row/level-strip center (under0.1px), with equal horizontal label gaps in ordinary and MAX states. Numeric text stays contained in its own columns; arrows stay within their pill and label gap.

- Both Bag close glyphs must crop to nontransparent painted pixels and center that cropped raster within the square (under0.1px). Keep the Canvas CSS background transparent and preserve existing frame colors.

- The five-profile Bag component guard also covers Training Ground: exactly one shared floating close outside the sheet, 24px scaled gap below tabs, full hit-area containment, exact visible-block vertical centering, resize recentering, close/Escape/focus return and keyboard wrap. Closing cannot purchase training or mutate its fixture state.

- lampAutoEquipGameplay runs the full game in isolated contexts through cache/item controls, Auto receipts, Hero screens and reload. Its red-promise test fails on main 5d7910f9 after an actual Auto click. Fixed golden gains and a separate stat-projection oracle check allocation; lampRoster covers all 120 five-record orders and atomic guards. Both browser files run in test:lamp-ui.

- Auto gameplay proof asserts every pending, discarded and held leftover is nonpositive for every canonical owner. Negative controls must demonstrate failure for a positive item in each queue. The commit guard runs this browser file and lampRoster for CP/equipment/roster changes even when presentation files are untouched.
