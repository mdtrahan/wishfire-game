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
4. Confirm the bead is executable.
5. Mark `in_progress`.
6. Implement only the scoped change.
7. Run targeted verification.
8. Record closeout artifacts.
9. Confirm `bd` write results.
10. Close the bead.

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
  - declare exact allowed files/functions before editing
  - do not mix unrelated runtime lanes in the same patch
  - stop if unrelated dirty work is already present and cannot be cleanly isolated

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
  - rejects vague work
  - closes only with evidence
- Dev:
  - implements one bead at a time
  - stays inside scope
  - reports exact tests and touched files
- Review:
  - checks acceptance, evidence, and scope compliance
  - rejects mixed-scope closeouts

## Anti-Patterns
- Starting work from stale `.beads/` mirrors instead of live `bd`
- Treating a null/underspecified bead as executable
- Mixing multiple hot-file lanes in one dirty worktree without isolation
- Closing a bead based on code presence alone without targeted validation
- Trusting a single immediate `bd` read after a write when the tool has shown inconsistency
