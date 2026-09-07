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

## Unselected decisions
AF interruption timing and whether specials consume ordinary turns; early solo/group prices; exact full-bar spending; normal MP; KO/re-entry; roster content and duplicate policy; save conversion. The user's instruction to begin is not an answer selecting options 4 or 5 from the outstanding interview. Do not infer those answers.

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
