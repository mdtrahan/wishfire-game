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

## 4) Execution Rules
- Edit the minimum files needed.
- No opportunistic refactors or side work.
- Resolve Git conflicts locally. Do not ask the user to resolve them.
- If unexpected tracked changes appear, stop and ask how to proceed unless the user already authorized them.
- Repository artifacts and Beads are the durable coordination channel.

## 5) Containment
- First shell command: `pwd`
- Work only inside the repo root.
- Run `git status` before and after execution.
- Do not write outside the repo unless the user explicitly authorizes it.
- Allowed browser/runtime verification tool: `agent-browser`
- Do not use Playwright unless explicitly authorized for the named issue.

## 6) Validation
- Use existing repo test commands when available.
- Prefer small deterministic checks tied to the active issue.
- Manual browser QA is valid for MVP runtime behavior.
- Keep new instrumentation isolated and removable.

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
