# Implementation Gate

## Purpose
- Keep non-minor repository changes scoped, owned, isolated, and recoverable.
- Preserve the Beads-first workflow while keeping root `AGENTS.md` thin.
- Define the pre-edit checks that must pass before implementation starts.

## Authority
- Live `bd` state controls scope and workflow.
- Git transports work; it is not the task tracker.
- The root `AGENTS.md` and nearest child `AGENTS.md` chain are binding local contracts.
- Governance docs guide process, but do not authorize runtime changes outside the active bead.

## Pre-Edit Gate
Before editing any non-minor file:

1. Read root `AGENTS.md` and every nearer child `AGENTS.md` on the target path.
2. Confirm the action is either minor-exempt or covered by one active bead.
3. For bead work, run `bd show <id>` and confirm objective, acceptance criteria, scope boundary, validation path, and no unresolved blockers.
4. Inspect `git status --short --branch` and relevant worktree state.
5. Confirm touched paths are clean or explicitly owned by the active lane.
6. Confirm a bead-scoped branch/worktree unless the action is minor-exempt.
7. Mark implementation beads `in_progress` before editing.

Stop under the Escalation section if repo state, ownership, requirements, or scope is unclear.

## Minor Exemption
Minor actions may stay in the active workspace:

- read-only review, policy analysis, bead creation, and bead triage
- spelling fixes, small reference `.md` additions, metadata/doc touch-ups
- tiny policy wording edits with no runtime behavior change

Minor exemption does not apply when touching runtime code, hot files, package/build/deploy config, persistence/data-model surfaces, overlapping dirty paths, or multi-agent write work.

## Scope Control
- Edit the minimum necessary files.
- Avoid unrelated refactors.
- Do not implement out-of-scope fixes.
- If scope changes, stop and clarify, reopen the bead, or create a new bead.
- For gameplay/content bead creation, check `governance/product/player-living-guide.md`; if it conflicts with the request, ask before implementation.

## Runtime Ownership
- Prefer deterministic shared logic in `src/` or Rust-owned SimulationCore seams over new browser-shell logic.
- Keep `web-runner/app.js` orchestration-only: lifecycle, imports, init, and composition wiring.
- Do not add business logic, utilities, feature state, or large implementations to `web-runner/app.js`.
- Extend contextual modules or create dedicated modules, then wire them through minimal `web-runner/app.js` changes.
- Treat `web-runner/app.js` growth as architectural debt.

## Containment
- Stay inside the repo root.
- Confirm clean git status before editing, commit, merge, or cleanup.
- Prefer live `bd` state over `.beads/` files.
- Do not write outside the repo without approval.

## Escalation
Stop and ask when:

- requirements conflict
- scope is unclear
- architecture impact is significant
- persistence, deployment, schema, or data-model behavior changes
- repo state is unexpected
- worktree ownership is unclear
- dirty paths overlap another lane
- live Beads state and Git state disagree in a way that affects execution
- product docs conflict with requested gameplay/content work
- validation would require broad red-suite interpretation instead of focused proof

Tooling blockers:
- Report the exact failing command and error.
- Use a compatible already-installed tool version when safely available.
- Do not install, migrate, or reconfigure global tooling unless explicitly approved or clearly within the user's requested scope.

Recovery bias:
- Preserve source evidence.
- Prefer explicit owner decisions over guessed intent.
- Create or update a bead when a blocker represents follow-up work rather than a local transient issue.

## Reporting
Report files inspected, files changed, validation performed, unresolved uncertainty, and any retrieval receipt required by `governance/execution/retrieval.md`.

## Subagents
- Use subagents only when they improve retrieval, implementation, QA/review, or docs/API verification.
- Report subagent findings, files inspected, files changed, validation performed, and uncertainty/risk.
