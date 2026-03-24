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
4. State the bead purpose in one short plain-language sentence.
5. Confirm the bead is executable.
6. Mark `in_progress`.
7. Implement only the scoped change.
8. Run targeted verification.
9. Record closeout artifacts.
10. Confirm `bd` write results.
11. Close the bead.

## Orphaned Bead Prevention Rule
- PM cycle must not leave avoidable orphaned beads behind.
- If a bead is claimed, set `in_progress`, or otherwise made active during a cycle, that same cycle must do one of the following before ending:
  - execute the bead and continue normal closeout,
  - explicitly hand it off as the active lane with matching coordination-file state, or
  - return it to `open`/ready state with a short reason recorded.
- Inspection-only or proof-of-close review is not enough reason to leave a bead active.
- If a bead was touched only for triage, queue audit, or selection and no real execution started:
  - restore truthful live `bd` status in the same cycle
  - record why it was restored if the temporary activation could confuse the queue
- Proof-or-close lanes follow the same rule:
  - close them on evidence, or
  - return them to `open`/blocked with the missing proof called out
- Avoid carrying forward “placeholder” active beads just to remember what was looked at.

## Purpose Statement Rule
- Before execution, reassignment, or review, state the active bead purpose in one short plain-language sentence.
- The statement must:
  - describe the player-facing or system-facing behavior plainly
  - avoid internal shorthand when a human-readable phrase is available
  - be short enough to make the intended QA mode obvious
- If the bead is not meaningfully player-facing, say that explicitly and bias toward deterministic validation.
- Missing this statement is process non-compliance, not a cosmetic miss.

## Queue Creation vs Execution
- Creating a bead is not the same as starting a lane.
- If a user asks to create/make/add a bead, default behavior is:
  1. create the bead
  2. leave it `open`
  3. do not mark `in_progress` until it is explicitly assigned or selected by the loop
- Execution starts only when one of these is true:
  - the user explicitly says to work that bead now
  - PM explicitly assigns that bead
  - the standard loop selects it as the next executable bead

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

## Closeout Rules
- A bead is not ready to close unless all of the following are true:
  - acceptance criteria are satisfied
  - tests or validation were actually run
  - `/agents/dev_reports.md` contains a scoped report
  - `/agents/pm_status.md` reflects the result
  - bug/regression beads update `/ai-memory/insights.md`
- Archive historical PM/dev entries into `/agents/archive/` so active coordination files stay concise for startup and review.
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
- PM:
  - shapes executable beads
  - states the bead purpose plainly before assigning, rewriting, or reviewing
  - must restore a bead to truthful queue state if it was only inspected and not actually handed off for work
  - rejects vague work
  - closes only with evidence
- Dev:
  - implements one bead at a time
  - restates the bead purpose plainly before claiming and implementing
  - must not keep a claimed bead active if execution never actually starts
  - stays inside scope
  - reports exact tests and touched files
- Review:
  - checks that the bead purpose was stated plainly
  - checks that PM cycle did not leave an avoidable orphaned active bead
  - checks acceptance, evidence, and scope compliance
  - rejects mixed-scope closeouts

## Anti-Patterns
- Starting work from stale `.beads/` mirrors instead of live `bd`
- Treating a null/underspecified bead as executable
- Mixing multiple hot-file lanes in one dirty worktree without isolation
- Closing a bead based on code presence alone without targeted validation
- Trusting a single immediate `bd` read after a write when the tool has shown inconsistency
