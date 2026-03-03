# AGENTS.md --- Codex-Orka (Execution Kernel)

## 0) Purpose
- Keep always-on context minimal.
- Use the active Beads issue and the codebase as the primary source of truth.
- Put task-specific gameplay and product rules in Beads acceptance, not here.

## 1) Canonical Code
- Runtime code: `Scripts/`, `web-runner/`
- Supporting core modules: `src/`
- Construct 3 artifacts are retired. Do not infer or regenerate runtime behavior from legacy C3 sources.
- Active integration branch: `codex/live`
- Release branch: `main`

## 2) Startup Order
1. Read `ai-memory/context.md`
2. Run `bd ready`
3. Select one issue and run `bd show <id>`
4. Read extra docs only if the issue requires them

## 3) Beads Gate
- No issue, no work.
- Work one Beads issue at a time.
- Before editing code:
  1. `git checkout codex/live`
  2. `git pull --ff-only`
  3. `bd ready`
  4. `bd show <id>`
  5. Mark that issue `in_progress`
- Commits must include `bd-<id>`.
- If scope is ambiguous, stop and clarify on that issue.
- PM/assigner must always provide the explicit Beads issue ID when assigning a lane. Do not start from title-only instructions.

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
- PM-authored governance/tracking files may remain dirty if they are explicitly identified as PM-authorized and out-of-scope for the active worker lane. Workers should ignore them, not stage them, and continue.
- Do not write outside the repo unless the user explicitly authorizes it.
- Allowed browser/runtime verification tools: `agent-browser`, `playwright`
- Use the tool named in the active issue when specified; otherwise prefer the lightest tool that fits the task.

## 6) Validation
- Use existing repo test commands when available.
- Prefer small deterministic checks tied to the active issue.
- Manual browser QA is valid for MVP runtime behavior.
- Keep new instrumentation isolated and removable.

## 6.1) Large Code Exploration
- For large hot files and cross-file rule tracing, prefer `jcodemunch-mcp` when available instead of brute-force full-file reads.
- Keep `jcodemunch` use focused on symbol retrieval and dependency tracing; do not use it as a substitute for the active Beads issue scope.
- PM and worker should both use the same exploration order for hot code:
  1. repo outline / file tree
  2. symbol search / file outline
  3. exact symbol retrieval
  4. only then fall back to broad file reads if still necessary
- Use `jcodemunch` first when a file is large, mirrored, or known to be a hot regression surface.

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
- Keep this file minimal and edit it only to correct repeated workflow failures.
