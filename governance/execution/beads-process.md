# Codex-Orka Beads Process

## Purpose
- Define the repo-specific Beads workflow for Codex-Orka.
- Keep bead execution deterministic, auditable, and scoped.
- Prevent drift between live `bd` state, hot-file work, and closeout claims.

## Source Of Truth
- Live `bd` state is authoritative for issue selection and status.
- Use `bd ready`, `bd show <id>`, `bd list`, and `bd query` for workflow decisions.
- Repo-side `.beads/` files may exist as local artifacts, but they are not workflow-authoritative when live `bd` is available.
- If `bd` does not resolve, repair shell `PATH` first:
  - `export PATH="$HOME/.local/bin:$PATH"`

## Standard Loop
1. Run `bd ready`.
2. Select the highest-priority ready bead or the explicitly assigned bead.
3. Run `bd show <id>`.
4. Confirm the bead is executable under `governance/execution/implementation-gate.md`.
5. Mark `in_progress`.
6. Implement only the scoped change.
7. Run targeted feature verification.
8. Record QA PASS artifacts only after feature quality is proven.
9. Run the Integration Ready gate against current `main`.
10. If Integration Ready fails, report the exact blocker and keep the branch out of the merge queue.
11. Merge only after Integration Ready passes.
12. After merge, verify containment on `main`, smoke tests, and clean repository state.
13. Confirm `bd` write results for any workflow-state changes.

Detailed implementation, integration, and validation rules live in:
- `governance/execution/implementation-gate.md`
- `governance/execution/integration.md`
- `governance/execution/validation.md`

## Queue Creation vs Execution
- Creating a bead is not the same as starting a lane.
- Read-only review, policy analysis, and bead creation are not implementation lanes by default.
- If a user asks to create/make/add a bead, default behavior is:
  1. create the bead
  2. leave it `open`
  3. do not mark `in_progress` until it is explicitly assigned or selected by the loop
- For gameplay/content beads, check `governance/product/player-living-guide.md` during creation. If the requested bead conflicts with the guide's player-facing description, pause and ask the user whether to update the guide, adjust the bead, or treat the conflict as intentional.
- Execution starts only when one of these is true:
  - the user explicitly says to work that bead now
  - PM explicitly assigns that bead
  - the standard loop selects it as the next executable bead

## Workspace And Isolation Policy
- Default implementation uses a bead-scoped branch/worktree.
- Active workspace work is allowed only for minor actions.
- Beads are the primary unit of task isolation, checkpointing, recovery, and rollback.
- Include the bead id in both branch and worktree names.
- Follow concurrency and delegation limits from the active orchestrator skill.
- Follow `governance/execution/integration.md` for branch/worktree creation, branch disposition, merge, cleanup, and deletion rules.

Minor exemption rules live in `governance/execution/implementation-gate.md`.

## Executable Bead Criteria
- A bead is executable only if live `bd` state includes:
  - clear objective
  - acceptance criteria
  - scope boundary
  - test requirement or obvious validation path
- If any of those are missing, do not implement.
- Rewrite, decompose, or block the bead first.

## Size And Dependency Discipline
- A bead should be the smallest unit that can be completed and verified in one cycle.
- Prefer beads that are:
  - independently testable
  - short-lived
  - easy to review
- Use explicit Beads dependencies rather than implied order.
- Only start beads with no unresolved blockers.

## Hot-File Discipline
- Treat these as serialized hot files unless a bead explicitly proves isolation:
  - `web-runner/app.js`
  - `web-runner/modules/functionBank.js`
  - `Scripts/functionBank.js`
- For hot-file beads:
  - stage the intended hot-file diff first
  - run `tools/prepare_hot_file_commit.sh <bd-id>` to generate `.beads/hot-file-lock/<bd-id>.scope`
  - treat `.scope` files as generated commit metadata, not hand-authored governance files
  - generated scope may include `__MODULE__` when a reviewed hot-file diff includes top-level imports, constants, or state-shape wiring
  - do not mix unrelated runtime lanes in the same patch
  - stop if unrelated dirty work is already present and cannot be cleanly isolated
- If active Beads state is not aligned to the commit lane:
  - run `tools/prepare_hot_file_commit.sh <bd-id> --align-active`
  - use the printed restore commands after commit to return live `bd` to the truthful queue state
- If staged hot-file diffs change after preparation:
  - rerun `tools/prepare_hot_file_commit.sh <bd-id>`
- Hot-file enforcement now expects prepared metadata and should fail once with:
  - one actionable prepare command when preparation is missing
  - one batched error list when top-level or undeclared-function violations exist

## QA PASS And Integration Closeout Rules
- Follow `governance/execution/validation.md` for feature proof and bug/regression insight requirements.
- Follow `governance/execution/integration.md` for QA PASS, Integration Ready, repository audit classification, and Integration Drift.
- If unrelated dirty changes remain in touched hot files, do not treat the lane as cleanly reviewable without explicitly calling out that risk.

## `bd` Write Confirmation Rule
- Treat `bd` writes as unconfirmed until a second read succeeds.
- Acceptable confirmation patterns:
  - `bd show <id>` twice in separate invocations
  - `bd show <id>` plus `bd list` or `bd query`
- If reads disagree after a write:
  - stop stateful lane transitions
  - record the inconsistency in coordination artifacts if it affects execution
  - do not assume the first follow-up read is canonical

## PM / Dev / Review Contract
- PM shapes executable beads, rejects vague work, confirms significant-diff commit prep when the guard applies, and closes only with evidence.
- Dev implements one bead at a time, stays inside scope, prepares significant staged diffs with the repo-owned commit-check helper before commit, and reports exact tests and touched files.
- Review checks acceptance, evidence, scope compliance, and commit-prep evidence when required; mixed-scope closeouts should be rejected.

## Anti-Patterns
- Starting work from stale `.beads/` mirrors instead of live `bd`
- Treating a null/underspecified bead as executable
- Running implementation beads in the active workspace without minor exemption or explicit override
- Mixing multiple hot-file lanes in one dirty workspace without explicit recovery plan
- Closing a bead based on code presence alone without targeted validation
- Bypassing Integration Ready after QA PASS
- Leaving QA PASS branches to drift without repository audit classification
- Trusting a single immediate `bd` read after a write when the tool has shown inconsistency
