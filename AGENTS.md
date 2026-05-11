# AGENTS.md --- Codex-Orka

## 0) Purpose
- Keep always-on context minimal.
- Beads controls scope and workflow.
- Use live `bd` state and the codebase as the source of truth.

## 1) Canonical Code
- Runtime: `Scripts/`, `web-runner/`
- Core modules: `src/`
- Legacy Construct 3 artifacts are retired.
- Primary branch: `main`

## 2) Startup
1. Read `ai-memory/context.md`
2. Ensure `bd` resolves
3. Run `bd ready`
4. Verify `bd list`
5. Run `bd show <id>`

## 3) Beads Gate
- No issue, no work.
- One bead at a time.
- Commits must include `bd-<id>`.

New bead requests should automatically create:
- a bead-scoped branch
- a dedicated worktree
- an isolated implementation lane

Before editing:
- confirm active bead
- confirm bead-scoped worktree + branch
- confirm clean git status
- mark bead `in_progress`

If scope changes:
- stop and clarify
- reopen bead, or
- create a new bead

Do not implement out-of-scope fixes.

## 3.1) Bead Worktree Workflow
- One worktree per bead.
- Git is transport; Beads is workflow authority.

Naming:
- worktree: `wt-<bd-id>-<slug>`
- branch: `bead/<bd-id>-<slug>`

Branch lifecycle:
- create for one bead only
- merge by PR only
- delete after merge confirmation
- keep rollback as tags, not branches

Do not:
- develop in the main worktree
- mix multiple beads in one worktree
- merge without validation + rollback checkpoint

## 4) Execution Rules
- Edit minimum necessary files.
- Avoid unrelated refactors.
- Stop on unexpected tracked changes unless authorized.
- Resolve conflicts locally.

`web-runner/app.js`:
- Orchestration-only; keep it thin.
- Use it as pointer/composition wiring, not feature storage.
- Do not add business logic, utilities, feature state, or large implementations.
- Extend contextual modules or create dedicated modules for new features.
- Wire new modules through minimal `web-runner/app.js` changes.
- Treat `web-runner/app.js` growth as architectural debt.

## 4.1) Ownership
- One ownership lane per bead unless authorized.
- Prefer deterministic shared logic in `src/`.

## 4.2) Output Discipline
Cap large output.

Prefer:
- `rg -l`
- `rg -n -m`
- focused diffs
- targeted logs

Avoid:
- recursive dumps
- unbounded output
- unnecessary full test suites

## 4.3) Escalation
Stop and ask when:
- requirements conflict
- scope is unclear
- architecture impact is significant
- persistence/deployment/schema behavior changes
- repo state is unexpected

## 4.4) Subagents
Use subagents only when they improve:
- retrieval
- implementation
- QA/review
- docs/API verification

Report:
- findings
- files inspected
- files changed
- validation performed
- uncertainty/risk

## 5) Containment
- First command: `pwd`
- Stay inside repo root.
- Confirm clean git status before editing and before merge/commit.
- Prefer live `bd` state over `.beads/` files.
- Do not write outside repo without approval.

## 6) Validation
- Use existing repo test commands.
- Prefer focused deterministic validation.
- Manual browser QA is acceptable for runtime behavior.
- For local `web-runner` visual/manual QA, use `@Browser` / the Codex in-app browser first. Use standalone Playwright, Chrome, or `agent-browser` only if Browser is unavailable, the user asks for another surface, or the check requires unsupported Browser capability.

## 6.1) Retrieval
For code-location, ownership, dependency, or call-path questions, first use `jcodemunch-mcp`.

Do not use `rg` first unless `jcodemunch-mcp` is unavailable or unsuitable.

Retrieval Receipt is required for code-location, ownership, dependency, or call-path answers:
- tool used
- if not `jcodemunch-mcp`, why not
- repo/query used
- files/symbols retrieved
- whether full-file reads were avoided

Prefer indexed symbol/text search before full-file reads.

## 6.2) Insights
Bug/regression beads must update:
- `ai-memory/insights.md`

Use reusable heuristics, not event logs.

## 6.3) Skills
- Use `$bead-worktree-lifecycle` for `new bead`, bead-scoped worktree creation, QA PASS cleanup, safe merge, worktree removal, and merged branch deletion.

## 7) Output Contracts
`commit check <bd-id>`:
- `COMMIT: YES|NO`
- `Reason: <one line>`
- `If YES: Commit Message: <summary bd-<id>>`

`qa handoff <bd-id>`:
- `Test URL`
- `Steps`
- `Expected`

## 8) Deeper Policy
- Keep deeper governance in `governance/`
- Keep this file minimal
- Add policy only for repeated failures
