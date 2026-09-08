# Combat migration checkpoint

2026-09-07 • Epic ORKA-49k • Implementation task ORKA-49k.1

## Recovery and authority
- Implementation starts from local main `818cc1fc06338ef6e92af48cd3891a6085de5162`.
- Worktree: /Users/Mace/Codex-Orka/.worktrees/wt-ORKA-49k.1-combat-party-init
- Branch: `codex/ORKA-49k.1-combat-party-init`.
- Original checkout remains at `2c9a03605caf2e83f5407fd3a08ef118d19793b1` on `codex-preserve-root-dirt-20260811`. Its unrelated uncommitted changes were neither staged nor moved. This checkpoint does not archive that unrelated dirt.
- COMBAT_MIGRATION_PLAN.md captures the plan before implementation. The user has authorized implementation; statements in the captured assessment about no code changes describe the planning stage.
- Local main has progressed since assessment: Energy now funds quest entry rather than combat actions; current fresh encounters reset AF. Preserve these current behaviors in this prerequisite and explicitly decide later migration changes.
- Beads writes were confirmed by separate live reads. Automatic backup reports `strconv.ParseUint: parsing "305\\n": invalid syntax`. A successful tracker write is not proof of a successful database backup.

## Decisions recorded
SPEED orders ordinary turns. Deploy 1–6 heroes with individual HP in the completed migration. Commands use visible buttons and standard mouse/touch/keyboard inputs. AF stays slim at upper-left, with exact fractional milestones and SPEED-ordered hero diamonds. Reached diamonds enable their heroes. One spendable AF balance funds early specials and full-bar buff/group opportunities.

## Current decisions and remaining choices
Owner answers on 2026-09-07: every standalone action, including an AF special, consumes a turn. Future stored sequences consume one turn upon completion. Each individual special costs exactly 1/N of full capacity. Deduct only that cost from current charge and retain the remainder, with milestone eligibility recalculated after spending. Six heroes at 22% leave 5⅓% after one special.

Remaining choices include group/card-draw costs, AF earnings, normal MP, healing allocation, KO/re-entry, roster content/duplicates and save conversion.

## First implementation boundary
Remove the initializer's catalog-length cap so supplied configured parties can initialize through six slots. Preserve formation positions, identities, stats, HP sanitization and escort/enemy UID separation. Do not expose incomplete six-member gameplay or claim the menu, individual-HP survival or gacha roster is delivered. Current configuration UI still supplies four slots; later children own that migration.

## Files in this checkpoint
- COMBAT_MIGRATION_PLAN.md: captured migration plan.
- MIGRATION_CHECKPOINT.md: this receipt and preflight.
- ai-memory/todo.md: active task pointer.
- ai-memory/insights.md: dated migration boundary.

# Bead Preflight Checkup

## Bead
ORKA-49k.1 — Initialize configured combat parties through six hero slots

## Readiness Confidence
95% for this initializer prerequisite only.

## Status
READY FOR FLIGHT

## Findings
Live Beads has no existing migration owner. Adjacent active tasks cover input, render, skills, enemy behavior and dev-panel placement; this lane avoids those implementations. Current initializer loops over the four-entry canonical hero catalog, even when supplied more configured members. This gate can be changed without deciding special prices or new hero content.

## Preflight Notes
Scope: initializer capacity, focused behavioral test, nearest systems contract, checkpoint documents.
Acceptance Criteria: 1–6 supplied members survive construction; sparse slots stay fixed; >6 slots are excluded; HP normalization and escort/NextUID remain correct.
Edge Cases: fifth/sixth member, gaps, excess input, zero/invalid/over-max HP, escort after six heroes.
Non-Goals: UI, roster acquisition, scheduler changes, individual-HP authority, AF economics, deployment and integration.
Known Risks: downstream four-slot consumers remain for future children; no whole-game six-hero readiness claim.

## Recommended Action
Implement in the isolated worktree. Run the new initializer test plus combat power, RNG ownership, seeded RNG and dev-tool initializer contracts, followed by git diff --check. Record baseline differences instead of changing unrelated tests.

## Retrieval receipt
codebase-memory searched party formation symbols in Users-Mace-Codex-Orka. jcodemunch resolved local/Codex-Orka-904e2bad and returned no formation importers; targeted git grep on current main found actual app/test consumers, so the index was insufficient for current caller evidence. Direct reads verified combatSessionInitializer and its imported configuration. Large functionBank/renderRuntime files were not read in full. Runtime implementation stays in the existing JavaScript initialization owner; no Rust-owned outcome changes.

## Implementation receipt
- Pre-edit checkpoint commit: `9a31fe5`; tag: `checkpoint/ORKA-49k-pre-implementation-20260907`.
- Runtime change: `web-runner/systems/combatSessionInitializer.js` consumes the supplied roster up to six slots, removing the catalog-size dependency.
- Contract: `web-runner/systems/AGENTS.md` records capacity and scope.
- Behavioral proof: `tests/combatPartyInitializationContract.test.js` invokes the initializer with controlled dependencies. Five relevant cases failed against the old four-member cap; all nine pass after the change. Test fixtures for extra heroes are not launch content.
- Focused validation: 33/33 passed across combatPartyInitializationContract, combatPowerIndexContract, combatRuntimeRngOwnershipContract, seededRngOwnershipContract, devToolingModalContract and partyFormationContract. `git diff --check` passed.
- Scope status: this prerequisite is Development Complete. The migration remains active, with downstream four-slot configuration/rendering and shared-HP behavior still present. No browser proof, Integration Ready claim, merge or deployment.

## Second implementation receipt: ORKA-49k.2
- Base: `5a4ed8498bdf7f98554576f4d3f5456247fc1c44`, preserving the initializer checkpoint. Branch `codex/ORKA-49k.2-individual-survival`, worktree `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-49k.2-individual-survival`.
- Preflight: READY 94%, scope limited to individual actor survival, turn-start eligibility, six-slot enemy targeting, Rust/WASM mirrors and current decision records. Healing/damage aggregation, command UI, AF runtime and saves remain subsequent work.
- Retrieval: read-only investigations used codebase-memory and jcodemunch at parent 5a4ed84. The index predates current main; focused symbol/caller reads verified functionBank initiative, ProcessTurn, outcome/eligibility rules, targeting, Rust exports and SimulationCore bridge. Full functionBank reads avoided.
- Rule changes: individual HP gates new turns; KO actors receive no turn-start hooks; living hero count determines defeat regardless of stale PartyHP. Fifth/sixth heroes reach the existing Rust enemy-target owner. Target preferences and RNG remain unchanged.
- Proof: new fixtures reproduced five failures before changes. After rebuilding WASM, 34 focused Node tests pass, including actual JS-to-WASM sixth-member selection and both runtime roster functions. Rust: 29 tests pass. Full suite: 844/847 pass; the same three failures occur at the parent baseline (842/845).
- Inherited failures: app heal-bloom source contract; Kojonn red-single queued-total contract; Clear Skills visible-effects contract. Full output: `/tmp/orka-49k-survival-suite.log`; parent output: `/tmp/orka-49k-pre-hp-baseline.log`.
- No browser UI proof, Integration Ready, merge or deployment. This slice does not complete individual HP migration: pooled healing and some bulk damage writers still require replacement.

## Group-size clarification
The current four heroes are sufficient. Any loaded group of 1–6 members is valid, including scripted solo or small-party encounters. Six is capacity. Empty positions create no actors or missing-member requirement. AF denominator and milestone count use the loaded group; KO preserves its milestone/slot within the encounter. Additional heroes and story scenarios are future content.

## Third implementation receipt: ORKA-49k.3
- Base checkpoint: `b852cf3`. Branch `codex/ORKA-49k.3-hero-hp-authority`; worktree `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-49k.3-hero-hp-authority`.
- Preflight: READY 93% for damage/projection scope. Healing allocation question remains pending; no choice inferred from elapsed time.
- Retrieval: jcodemunch found syncPartyHpTotalsFromHeroes and app health synchronization; current worktree reads traced all getHeroes callers, health-array writes, initializer, Destiny heal, party-damage core, Rust ABI and bridge. Indexed root predates stacked changes, so focused current source reads verified ownership. Full functionBank reads avoided.
- Implemented: separate deployed roster from living actors; rebuild derived arrays by stable display slot and totals from actor HP; preserve KO slots and clear previous-group values. Single-target damage updates only its recipient and recomputes totals. KO recipients consume no shield and receive no Destiny revival. Initializer preserves configured HP. Party-damage owner and WASM handle actual groups through six while preserving shared barrier semantics.
- Validation: 54 focused Node checks PASS; Rust 29 tests PASS; WASM rebuilt; git diff --check PASS. New sparse/KO projection and repeated-KO-hit cases failed before implementation. Real JS/WASM bulk-damage test covers every group size 1–6. Existing Magic Fruit value assertions normalize VM arrays while retaining exact expected HP and heal counts.
- Remaining HP work: replace ApplyPartyHeal/SyncPartyHPToHeroes redistribution after the owner selects allocation. App legacy restorePartyToFullHP still restores presentation totals, while quest Continue correctly restores actors through questCombatSession; migrate the legacy restoration wrapper during command/lifecycle integration. Normal MP, special income, group/card prices, command UI and save conversion remain separate work.

- Full suite after HP changes: 847/850 PASS; the same three inherited failures as parent b852cf3 (844/847). Output: `/tmp/orka-49k-hp-suite.log`. Final removal of an unreachable empty-party max-HP branch passed focused Magic Fruit and mirror checks.

## Fourth implementation receipt: ORKA-49k.4
- Base: `bff8da2`. Branch `codex/ORKA-49k.4-hero-commands`; worktree `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-49k.4-hero-commands`.
- Preflight: live Beads ownership verified before edits; isolated branch clean. User authorization covers retiring the board, individual health UI, native buttons and groups up to six. Pending healing allocation and AF economics do not block this slice.
- Retrieval: the root index predates these stacked lanes. Focused current-source reads traced ExecuteSkill, StartHeroLunge, HeroTurn, presentation barriers, target capture, initializer, renderRuntime chunks, pointer/keyboard handlers, developer autoplay and the existing UI gate. No full functionBank read or source-game research was needed.
- Implemented: black native command cards with small cropped portraits, individual HP and six fixed column-major positions; Actions/Set Action/Back editing; scheduled basic Attack; Auto/Repeat/Reload/Menu. A stale manual target returns to selection without a spend. Automatic commands use the same commit boundary and leave AF choices to the player. Opening the editor pauses automation. KO retains the card position.
- Removed the live gem board draw, board creation, gem pointer commands, gem keyboard shortcut, developer forceMatch hook and global attack button. Combat enters RUNTIME after actors initialize, removing the full-board startup gate. Legacy gem helper/rule retirement and content translation remain under the parent migration.
- Astral Flow presentation is a separate slim upper-left meter with exactly N SPEED-ordered portrait notches. KO stays in that N. Its earning/spending behavior is still the old gameplay owner and remains unfinished. Hero lunges now use display slots, including slot six.
- Browser baseline: 130/130 existing invariants passed before changes. The updated gate checks cards/editor, retired UI absence and actual prepared attacks for every group size across five viewport/DPR cases: 185/185 passed. Evidence: `test-results/ui-lock/2026-09-08T00-48-35-043Z/ui-lock-report.json`. Extra members in QA are fixtures, not added launch content.
- Natural in-app proof: measured 709×1239 CSS viewport, DPR 1, canvas 696×1239. Hondo prepared an attack on Gobloc, executed it, enemy turns resolved, Hondo alone lost HP and Kaja became available. No browser errors observed. Reference/compact screenshots and editor screenshots inspected.
- Regression changes retire ten tests for deleted board consumers and replace obsolete pooled-HP/global-attack assertions with the new UI gate and command contracts. Developer automation contracts now enforce native commands and preserve player AF choices. Core gem/skill behavior tests remain while content migration continues.
- Remaining parent scope: individual healing/legacy restore; AF currency and special payloads; full-meter draw/group selection; normal skill definitions; save/progression conversion; remaining obsolete board/dev consumers. This checkpoint does not complete the migration or certify Integration Ready. No merge or deployment.
- Final deterministic checks: 15/15 focused checks pass. Full suite 839/842 passes, with the same three inherited failures from bff8da2; `/tmp/orka-49k-commands-suite-final2.log`. Retired source contracts account for the changed test count. `git diff --check` passes.
- Checkpoint `1d0ac8b` includes a pre-commit UI gate PASS, 185/185, at `test-results/ui-lock/2026-09-08T00-58-25-004Z/ui-lock-report.json`. Follow-up hardens same-session restoration: draft history survives replaced actor objects with unchanged UIDs. The browser group loop now selects an explicit non-default target, restores actor objects, and checks that the attack retains that target.

## Full-health recovery checkpoint: ORKA-49k.5

- Base: 7578dbb, the final native command checkpoint. Its commit hook passed 185/185 rendered invariants at test-results/ui-lock/2026-09-08T01-04-01-890Z/ui-lock-report.json in the ORKA-49k.4 worktree.
- Lane: codex/ORKA-49k.5-full-recovery, .worktrees/wt-ORKA-49k.5-full-recovery. Preflight READY 95%; only full recovery is in scope. The partial-healing allocation and AF interrupt-turn questions remain unanswered.
- Town and Continue share the existing actor-restoration behavior in questCombatSession.mjs. Town no longer writes pooled HP arrays. Every loaded hero recovers to its own maximum; hero pending-death entries clear, enemy entries remain. UI projections come from UpdateHeroHPUI, including empty arrays. Continue keeps its existing initiative restart and encounter resources.
- Focused validation: 22/22 pass across partyDamageAccountingContract, questCombatSessionContract, storyEntryFlowContract and appJsOrchestrationBoundaryContract. One added behavioral check covers both recovery entry points for zero through six heroes, sparse slots, KO, stale health, energy, AF and skills.
- Retrieval: jcodemunch local/Codex-Orka-904e2bad query restorePartyToFullHP located the app wrapper and runtimeLayoutRegistry. Targeted reads in this lane verified each caller and the existing quest resurrection loop; full app/functionBank reads were avoided. The combat gateway snapshot restores turn state, leaving actor HP with the lifecycle owner.
- Files: web-runner/app.js, web-runner/systems/questCombatSession.mjs, tests/partyDamageAccountingContract.test.js, owning systems/tests AGENTS, ai-memory/insights.md, ai-memory/todo.md, this checkpoint. No merge or deployment.

## Owner clarification and actor healing: ORKA-49k.6

This section supersedes earlier fractional-cost and unresolved-healing statements above. Only the scheduled actor can take a standalone action; any such action spends their current turn. Combat healing targets that living hero, using their own max HP. Full-health lifecycle recovery stays separate. AF partial segments use floor(100/N) percent, with the final milestone/full-group use at 100%. Six heroes therefore use 16/32/48/64/80/100. At 64%, four of six cost 64%, leaving zero; two of four cost 50%, leaving 14%. Group combos remain undesigned future work.

- Lane: codex/ORKA-49k.6-actor-healing, based on bae2ac3. Preflight READY 93%; the approved self-healing behavior includes exposing retained DoHeal through native Actions.
- ApplyActiveHeroHeal replaces the pooled writer in both supported mirrors. Removed reverse HP synchronization and pooled heal-text routing. DoHeal enforces active/living actor ownership; normal Heal retains 7%, critical recovery retains its existing 32–42% band. Magic Fruit and Destiny use recipient max HP for healing; party max-HP growth and acquisition remain party-scoped.
- The native editor prepares Attack or Heal; only execution spends a turn. AF drawing reads rounded tiers from heroCommands.mjs. The layout and slim bar dimensions stay unchanged.
- New proof covers active-only healing for groups 1–6, KO/inactive rejection, no spillover, percentage basis, exact rounded examples, and real browser self-heal/turn handoff. Existing contract consumers use the renamed healing API.
- Retrieval: jcodemunch query ApplyPartyHeal located both skillSheet owners. Targeted current reads verified Magic Fruit, Destiny, DoHeal, rewards and regen callers; no full app/functionBank reads. Current owning DOX, hot-file and validation rules were read.
- Remaining AF work includes an explicit player spending/draw path. Normal AF income and card-draw price are still proposals; preserve existing KO income until tuning is selected. No new combo behavior, merge or deployment.

## Revised direction: personal AF and stored SP sequences (ORKA-49k.7)

The latest owner messages supersede earlier shared-gauge and milestone requirements. Each hero now owns a personal AF gauge on their card and glows when ready. SP (Special Points) budgets a stored skill sequence; a free basic Attack occupies the turn alone. Remove separate Attack/Actions card buttons and strengthen the active hero highlight. The active-turn glow and personal-special readiness must remain distinguishable.

- Current runtime checkpoint remains d17fec6. The superseded uncommitted shared-AF spending implementation was discarded. A subsequent retirement script failed before any file write, so no resource or buff logic was removed.
- COMBAT_MIGRATION_PLAN.md now describes personal resource ownership, card interaction, SP queue exclusivity and proposed role budgets: Fara 50, Hondo 50, Runa 70, Kaja 60. Values are initial tuning proposals, not measured balance.
- Combat SP must have its own fields because the existing progression system already uses skill points. No progression balances were changed.
- Owner questions pending: SP refills each turn versus persists; personal AF special uses the whole turn versus fits the queue; personal full gauge may buy a party buff versus specials only.
- The old shared-bar browser preview does not demonstrate these new requirements. Runtime implementation of the new model has not started; no merge or deployment.

## FLOW mode selection

Owner requested six modes and one assignment for each current hero. Initially selected Rook/Fara, Warrior/Hondo, Tactician/Runa and Comrade/Kaja, with Stoic and Slayer reserved for additional loadouts. The Fara assignment is superseded by the owner correction below. Solo Kaja encounters load Warrior before battle. Runa requires an implemented enemy-debuff command. These are design assignments, not claims of implemented skill payloads. Gauge text is FLOW. The migration plan specifies event qualification, attribution and exclusions; gain rates remain tuning work. No runtime files changed in this selection pass.

### Owner correction: Fara uses Stoic

Fara is the pure tank and gains personal FLOW by taking hostile HP damage, including damage received while covering an ally. Rook moves to the reserve modes alongside Slayer. Hondo remains Warrior, Runa Tactician and Kaja Comrade. This updates the migration specification; personal FLOW accumulation is still awaiting implementation.

### Owner revision: ten-mode FLOW role catalog

The supplied role table supersedes the earlier six-mode limit and exclusions. The catalog is now Stoic, Warrior, Slayer, Healer, Tactician, Comrade, Dancer, Rook, Daredevil and Loner. Current hero assignments remain Fara/Stoic, Hondo/Warrior, Runa/Tactician and Kaja/Comrade. COMBAT_MIGRATION_PLAN.md records the supplied job mappings and earning triggers using FLOW terminology. This revision changes documentation only; catalog membership does not certify implemented earning mechanics or hero kits.

### Personal FLOW runtime migration: ORKA-49k.7

Owner requested completion and live testing. Personal FLOW/SP charge, current role kits and native command queues now replace the shared AF/milestone design. Party-card draws and proc eligibility are disconnected; historical definitions remain parked. The latest card layout follows the compact two-row reference. Full implementation and validation details are recorded in COMBAT_MIGRATION_REPORT.md. No external deployment or integration into root main is implied by a local preview.

## SP/FLOW separation correction
Owner clarified: fresh encounters grant full SP and zero FLOW. Independent actor balances now govern their respective commands. Role events earn FLOW only. SP is blue; FLOW is red. Post-use SP recovery remains unresolved after separating the resources.

## Owner scope correction: SP economy deferred
SP recovery and action-cost balancing are deferred and do not block migration completion. Full SP and zero FLOW on fresh combat remain required. The migration report records remaining skill-content and legacy-runtime work.

## Consolidated progression and combat contract
Owner authorized replacing all current skills with role-template kits: Fara Stoic, Hondo Warrior, Runa Tactician, Kaja Comrade. The active plan now includes 7 actives/6 passives/unique FLOW/basic attack, level-1 migration, individual victory EXP and cap 50, configurable unlocks/growth, SP 100/start 100/own-turn regen 5, exact-cost reservation/refunds, per-action targeting, status/periodic semantics, role-event attribution, Provoke/Cover and counter ordering. The clarification sequence is consolidated in COMBAT_MIGRATION_PLAN.md. Older preserve-three-skills, SP deferral, full-SP-drain, auto-retarget and periodic-tick FLOW directions are superseded. This checkpoint changes specification only; runtime implementation and final validation remain outstanding.

## Runtime migration delivered: ORKA-49k.7

Canonical progression, complete four-hero kits, personal FLOW, exact SP queue accounting, independent action capacity, combat resolution and hero-screen integration are implemented in the playable lane. Final validation: 791 Node tests passed, 73 historical tests skipped, 236/236 rendered invariants passed. See COMBAT_MIGRATION_REPORT.md for evidence and scope limits. Earlier documentation-only and SP-deferral checkpoints above are superseded. This is a local checkpoint; no merge or deployment.
