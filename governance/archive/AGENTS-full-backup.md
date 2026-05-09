# AGENTS.md --- Codex-Orka (Execution Kernel)

## 0) Purpose
- Keep always-on context minimal.
- Use the active Beads issue from live `bd` output and the codebase as the primary source of truth.
- Put task-specific gameplay and product rules in Beads acceptance, not here.

## 1) Canonical Code
- Runtime code: `Scripts/`, `web-runner/`
- Supporting core modules: `src/`
- Construct 3 artifacts are retired. Do not infer or regenerate runtime behavior from legacy C3 sources.
- Primary branch: `main`
- Feature work must occur in bead-scoped branches/worktrees.

## 2) Startup Order
1. Read `ai-memory/context.md`
2. Ensure `bd` resolves in shell. If not, repair `PATH` first: `export PATH="$HOME/.local/bin:$PATH"`
3. Run `bd ready` and verify `bd list` works
4. Select one issue and run `bd show <id>`
5. Read extra docs only if the issue requires them

## 3) Beads Gate
- No issue, no work.
- Work one Beads issue at a time.
- Creating a bead does not authorize implementation.
- Queue entry and lane assignment are separate acts.
- Commits must include `bd-<id>`.

New bead requests should automatically create:
- a bead-scoped branch
- a dedicated worktree
- an isolated implementation lane

Before editing:
1. ensure `bd` resolves
2. `bd ready`
3. `bd show <id>`
4. confirm bead-scoped worktree + branch
5. confirm clean git status
6. mark issue `in_progress`

If scope is ambiguous or outside the active bead:
- stop and clarify
- reopen the bead, or
- create a new queued bead

Do not implement out-of-scope quick fixes.

Every lane switch must record:
- `REOPEN: <bd-id>`
- or `NEW: <bd-id>`

Before editing after a lane switch:
- ensure live `bd` state matches intended status

Before completion:
- confirm acceptance criteria
- confirm final scope
- perform insights review for bug/regression beads

## 3.1) Bead Worktree Workflow

Use one dedicated worktree per active bead.

Beads is the workflow authority. Git is implementation transport.

Naming:
- worktree: `wt-<bd-id>-<slug>`
- branch: `bead/<bd-id>-<slug>`

Branch lifecycle:
- create for one bead only
- merge by PR only
- delete after merge confirmation
- keep rollback as a tag, not a branch

Do not:
- develop in the main worktree
- mix multiple beads in one worktree
- merge without validation + rollback checkpoint
- keep merged bead branches
- treat missing standalone `dolt` as a blocker if `bd` commands succeed

## 4) Execution Rules
- Edit the minimum files required.
- Avoid opportunistic refactors and unrelated changes.
- Resolve Git conflicts locally.
- If unexpected tracked changes appear, stop unless already authorized.
- Use repository artifacts and Beads as the coordination source of truth.

### 4.1) Ownership Discipline
- Keep one ownership lane per issue unless explicitly authorized.
- Define allowed files/systems before editing hot paths.
- Avoid cross-system globals and mirrored logic when possible.
- Move shared deterministic rules into `src/` when practical.

## 4.2) Command Output Discipline
Cap all potentially large output.

Preferred patterns:
- COMMAND 2>&1 | head -c 4000
- COMMAND 2>&1 | tail -c 4000


Prefer:
* `rg -l`
* `rg -n -m`
* focused diffs
* targeted logs

Avoid:
* recursive repo dumps
* unbounded output
* full test suites without justification

## 4.3) Decision Escalation Discipline
Stop and ask before proceeding when:
- requirements conflict
- acceptance criteria are unclear
- multiple architectural paths are equally valid
- a change affects cross-system ownership
- security, persistence, deployment, or schema behavior may change
- unexpected repo state appears without prior authorization

Do not silently choose major product or architecture decisions.
Prefer narrow implementation over inferred intent.

## 4.4) Subagent Discipline
Use subagents only when they save context, save time, or improve review quality.

Good uses:
- repo exploration
- scoped implementation
- QA/review
- docs/API checks

Avoid subagents for trivial work the main agent can finish faster.

Subagent reports must include:
- findings
- files inspected
- files changed, if any
- validation run, if any
- risks or uncertainty

The main agent owns final judgment and integration.

## 5) Containment
- First shell command: `pwd`
- Work only inside the repo root.
- Confirm clean git status before editing and before merge/commit.
- Do not treat repo-side `.beads/` files as workflow authority when live `bd` is available; use `bd show`, `bd ready`, and `bd list` for issue state.
- Do not write outside the repo unless the user explicitly authorizes it.
- Prefer the built-in `@browser` tool before external browser automation.
- Escalate to `playwright`, `agent-browser` only when additional automation, inspection, or control is required.

## 6) Validation
- Use existing repo test commands when available.
- Prefer small deterministic checks tied to the active issue.
- Manual browser QA is valid for MVP runtime behavior.
- Keep new instrumentation isolated and removable.
- When a repo already owns a browser harness/CLI for the bead, treat that harness as the canonical batch path; use Playwright MCP/skill for interactive inspection or diagnosis, not as a silent replacement execution lane.

## 6.1) Large Code Exploration
For large files, hot paths, mirrored systems, or cross-file tracing, use `jcodemunch-mcp` before broad file reads.

Prefer symbol and targeted retrieval before full-file reads.

Use `jdocmunch-mcp` for external/project docs when available.

Do not default to full-file reads for large or known hot-path files when MCP tooling can answer the query directly.

### 6.1.1) Retrieval Receipt

When using `jcodemunch-mcp`, report:
- query used
- symbols/files retrieved
- whether full-file reads were avoided

If `jcodemunch-mcp` is unavailable, say so before falling back to `rg` or file reads.

## 6.2) Insights Discipline
- `ai-memory/insights.md` is mandatory for reusable lessons from bug/regression work.
- For any bead that fixes a bug, regression, or production-behavior mismatch:
  1. Add/update at least one reusable heuristic in `ai-memory/insights.md` before marking the bead done.
  2. Write guidance that is future-facing (diagnostic order, guardrails, seam ownership), not a raw event log.
  3. If no reusable insight exists, explicitly state that in the bead completion note.
- Bead completion is not valid until this check is satisfied.

## 7) Output Contracts
- `commit check <bd-id>`:
  - `COMMIT: YES|NO`
  - `Reason: <one line>`
  - `If YES: Commit Message: <type: summary bd-<id>>`
  - `If NO: Missing: <1-2 concrete items>`
- `qa handoff <bd-id>`:
  - `Test URL: <local/runtime url or artifact path>`
  - `Steps: <3 short deterministic steps>`
  - `Expected: <pass condition>`

## 8) Deeper Policy
- Keep deeper process/governance rules in `governance/` and in Beads issue acceptance.
- Repo-specific Beads workflow rules live in `governance/execution/beads-process.md`.
- Keep this file minimal and edit it only to correct repeated workflow failures.