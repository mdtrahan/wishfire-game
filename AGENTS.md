# AGENTS.md --- Codex-Orka (Execution Kernel)

## 0) Purpose
- Keep always-on context minimal.
- Use the active Beads issue from live `bd` output and the codebase as the primary source of truth.
- Put task-specific gameplay and product rules in Beads acceptance, not here.

## 1) Canonical Code
- Runtime code: `Scripts/`, `web-runner/`
- Supporting core modules: `src/`
- Construct 3 artifacts are retired. Do not infer or regenerate runtime behavior from legacy C3 sources.
- Active integration branch: `codex/live`
- Release branch: `main`

## 2) Startup Order
1. Read `ai-memory/context.md`
2. Ensure `bd` resolves in shell. If not, repair `PATH` first: `export PATH="$HOME/.local/bin:$PATH"`
3. Run `bd ready`
4. Select one issue and run `bd show <id>`
5. Read extra docs only if the issue requires them

## 3) Beads Gate
- No issue, no work.
- Work one Beads issue at a time.
- Before editing code:
  1. `git checkout codex/live`
  2. `git pull --ff-only`
  3. ensure `bd` resolves in shell (`export PATH="$HOME/.local/bin:$PATH"` if needed)
  4. `bd ready`
  5. `bd show <id>`
  6. Mark that issue `in_progress`
- Commits must include `bd-<id>`.
- If scope is ambiguous, stop and clarify on that issue.
- PM/assigner must always provide the explicit Beads issue ID when assigning a lane. Do not start from title-only instructions.

### 3.0) Macro Trigger (Hardcoded)
- Trigger phrase: `RUN PM-DEV CYCLE`
- Equivalent accepted aliases:
  - `PMCYCLE`
  - `NEXT BEAD CYCLE`
  - `CONTINUE PM-DEV`
- On trigger, execute this sequence in order:
  1. PM flow (`agents/prompts/pm_agent.md`)
  2. Dev flow (`agents/prompts/dev_agent.md`)
  3. PM review/closure flow (`agents/prompts/pm_agent.md`)
- If no explicit bead is currently assigned, claim the highest-priority READY bead and state its ID before edits.

### 3.3) PM/Dev Prompt Contract (Required)
- The authoritative role flows are:
  - `agents/prompts/pm_agent.md`
  - `agents/prompts/dev_agent.md`
- These are policy, not reference notes.
- Every bead cycle must follow:
  1. **PM flow**: bead readiness/scope/acceptance/test requirements are validated and tracked.
  2. **Dev flow**: implementation + phased testing + report in `/agents/dev_reports.md`.
  3. **PM flow**: review against acceptance + evidence, then mark `done` or return to `todo/blocked`.
- If PM/Dev prompt rules conflict with ad-hoc execution, PM/Dev prompt rules win unless user explicitly overrides.
- Do not skip PM review semantics by directly treating code changes as completed work.

### 3.1) Task Boundary Enforcement (Required)
- If a user request is **not** part of the active bead scope, do not start implementation under the current bead.
- Required action for out-of-scope requests:
  1. reopen current bead with scope change **or**
  2. create/claim a new bead
  3. then implement
- “Quick fix first” outside bead scope is non-compliant.
- If the user asks to continue and no explicit bead is assigned, claim the highest-priority READY bead and state that ID before edits.

### 3.2) Bead Transition Contract (Required)
- Every lane switch must explicitly record one of:
  - `REOPEN: <bd-id>`, or
  - `NEW: <bd-id>`
- Before first code edit after a lane switch, ensure live `bd` state reflects the intended status (`open`/`in_progress`).
- Completion requires:
  - acceptance evidence
  - scope confirmation
  - insights check (for bug/regression beads)

## 4) Execution Rules
- Edit the minimum files needed.
- No opportunistic refactors or side work.
- Resolve Git conflicts locally. Do not ask the user to resolve them.
- If unexpected tracked changes appear, stop and ask how to proceed unless the user already authorized them.
- Repository artifacts and Beads are the durable coordination channel.
- PM/assigner must not implement, commit, or push worker-owned feature/refactor lanes. PM creates/issues prompts/tracking only unless the user explicitly assigns PM a separate scoped repo change.

### 4.1) Ownership Discipline
- Keep one ownership lane per issue: change only one of render/projection, combat rules, or lifecycle/state cleanup unless the issue explicitly authorizes a cross-boundary change.
- For hot-file issues, define exact allowed files/functions and name forbidden adjacent systems before editing.
- Do not write feature-owned globals outside the owning seam. If no clear owner exists yet, inventory direct read/write sites first, then extract the seam before expanding the feature.
- If a deterministic rule must change in both `Scripts/` and `web-runner/`, move that rule into `src/` or mark the duplicate edit as temporary mirrored maintenance in the issue.

## 5) Containment
- First shell command: `pwd`
- Work only inside the repo root.
- Run `git status` before and after execution.
- Do not treat repo-side `.beads/` files as workflow authority when live `bd` is available; use `bd show`, `bd ready`, and `bd list` for issue state.
- PM-authored governance/tracking files may remain dirty if they are explicitly identified as PM-authorized and out-of-scope for the active worker lane. Workers should ignore them, not stage them, and continue.
- Do not write outside the repo unless the user explicitly authorizes it.
- Allowed browser/runtime verification tools: `agent-browser`, `playwright`
- Use the tool named in the active issue when specified; otherwise prefer the lightest tool that fits the task.

## 6) Validation
- Use existing repo test commands when available.
- Prefer small deterministic checks tied to the active issue.
- Manual browser QA is valid for MVP runtime behavior.
- Keep new instrumentation isolated and removable.

## 6.2) Insights Discipline (Required)
- `ai-memory/insights.md` is mandatory for reusable lessons from bug/regression work.
- For any bead that fixes a bug, regression, or production-behavior mismatch:
  1. Add/update at least one reusable heuristic in `ai-memory/insights.md` before marking the bead done.
  2. Write guidance that is future-facing (diagnostic order, guardrails, seam ownership), not a raw event log.
  3. If no reusable insight exists, explicitly state that in the bead completion note.
- Bead completion is not valid until this check is satisfied.

## 6.1) Large Code Exploration
- For large hot files and cross-file rule tracing, prefer `jcodemunch-mcp` when available instead of brute-force full-file reads.
- Keep `jcodemunch` use focused on symbol retrieval and dependency tracing; do not use it as a substitute for the active Beads issue scope.
- For external/project documentation retrieval, prefer `jdocmunch-mcp` over broad doc file reads.
- PM and worker should both use the same exploration order for hot code:
  1. repo outline / file tree
  2. symbol search / file outline
  3. exact symbol retrieval
  4. only then fall back to broad file reads if still necessary
- Use `jcodemunch` first when a file is large, mirrored, or known to be a hot regression surface.

## 6.3) Skill and MCP Invocation Policy (Required)
- Skills/MCP usage is policy, not a suggestion, when triggers match:
  - Browser/UI flow debugging -> `playwright` skill (or issue-specified browser tool)
  - Large codebase tracing/hot files -> `jcodemunch-mcp`
  - External/project docs retrieval -> `jdocmunch-mcp`
  - Netlify deployment tasks -> `netlify-deploy` skill
- If a triggered skill/MCP is unavailable, log the blocker and use the nearest compliant fallback.
- Do not default to broad file reads when a configured MCP can answer the query directly.
- For bug beads touching runtime behavior, include at least one runtime-path validation (browser or deterministic simulation), not just static code inspection.

## 6.4) Non-Compliance Recovery
- If any of these are missed (bead gating, insights update, required skill/MCP use), stop and correct in the same cycle:
  1. record/repair bead contract
  2. execute missing required step
  3. then continue feature work

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

## 7.1) Role Handoff Artifacts (Required)
- Dev completion handoff must include `/agents/dev_reports.md` entry with:
  - bead id
  - changed files
  - tests run + results
  - explicit scope confirmation
- Historical dev handoffs belong in `/agents/archive/dev_reports_archive.md`; keep `/agents/dev_reports.md` concise and limited to current/recent review context.
- PM review handoff must update `/agents/pm_status.md` with:
  - Completed Beads
  - Active Work
  - Next Tasks
  - Known Issues
- Historical PM snapshots belong in `/agents/archive/pm_status_archive.md`; keep `/agents/pm_status.md` as the current snapshot only.
- Ambiguities/blocked reasons must be recorded in `/agents/issues.md` using PM/Dev prompt categories.

## 8) Deeper Policy
- Keep deeper process/governance rules in `governance/` and in Beads issue acceptance.
- Repo-specific Beads workflow rules live in `governance/execution/beads-process.md`.
- Keep this file minimal and edit it only to correct repeated workflow failures.
