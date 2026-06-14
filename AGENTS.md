# AGENTS.md - Codex-Orka DOX Root

## Purpose
- Keep always-on context minimal, local, and operational.
- Beads controls scope and workflow; Git is transport.
- Use live `bd` state, the codebase, and the nearest applicable AGENTS.md chain as source of truth.
- This file owns repo-wide rules and the top-level Child DOX Index.

## DOX Contract
- AGENTS.md files are binding work contracts for their subtrees.
- Before editing, read this root file, identify the expected files/folders, then read every AGENTS.md on each path from the root to the target.
- Child AGENTS.md files inherit parent rules. The closer file controls local details, but no child may weaken Beads, safety, validation, retrieval, or DOX update rules.
- Do not rely on memory for local rules. Re-read the applicable DOX chain in the current session.
- After meaningful changes, update the closest owning AGENTS.md if purpose, ownership, contracts, workflows, constraints, artifacts, or child index contents changed.
- Parent AGENTS.md files own their direct Child DOX Index; refresh indexes when adding, moving, or deleting child docs.
- Keep DOX concise. Document stable contracts and common failure points, not file-by-file trivia.

## Startup
1. Run `pwd`.
2. Read `ai-memory/context.md`.
3. Ensure `bd` resolves.
4. Run `bd ready`.
5. Verify `bd list`.
6. Run `bd show <id>` once a bead is selected or assigned.

Shell notes:
- Prefix shell commands with `rtk` when available.
- Keep command output bounded and targeted.

## Beads Gate
- No implementation work without a bead.
- One active implementation bead per agent run.
- Commits must include `bd-<id>`.

Default implementation flow:
- create or select the bead
- create a bead-scoped branch/worktree before marking `in_progress`
- cap active bead worktrees at 5; close, merge, or clean up before opening more
- use Beads for task tracking, checkpoints, recovery, and rollback
- make periodic commits for historical safety

Minor actions may stay in the active workspace:
- read-only review, policy analysis, bead creation, and bead triage
- spelling fixes, small reference `.md` additions, metadata/doc touch-ups
- tiny policy wording edits with no runtime behavior change

Minor exemption does not apply when touching runtime code, hot files, package/build/deploy config, overlapping dirty paths, or multi-agent write work.

Before editing:
- confirm active bead unless the action is minor-exempt
- inspect git status; confirm touched paths are clean or explicitly owned
- confirm bead worktree or minor exemption
- mark implementation beads `in_progress`

If scope changes, stop and clarify, reopen the bead, or create a new bead.

For gameplay/content bead creation:
- check `governance/product/player-living-guide.md` for player-facing drift
- if the bead conflicts with the guide, ask the user for direction before implementing

Do not implement out-of-scope fixes.

## Worktree Discipline
- Use `$bead-worktree-lifecycle` for bead-scoped worktree creation, QA PASS cleanup, safe merge, worktree removal, and merged branch deletion.
- One implementation bead gets one bead-scoped worktree unless a minor exemption applies.
- Include the bead id in branch and worktree names.
- Stop and ask before exceeding 5 active bead worktrees.
- Never mix multiple implementation beads in one worktree.
- Never merge without validation plus a rollback checkpoint.

## Canonical Code
- Runtime: `Scripts/`, `web-runner/`
- Shared deterministic JS and layout contracts: `src/`
- Rust deterministic simulation core: `rust/simulation_core/`
- Product and workflow truth: `governance/`
- Ability system map: `governance/product/abilities.html` for skills, abilities, supergems, affinity, Vault/relic taxonomy, function shapes, lifetimes, and drift.
- Legacy Construct 3 artifacts are retired.
- Primary branch: `main`

## Execution Rules
- Edit minimum necessary files.
- Avoid unrelated refactors.
- Stop on unexpected tracked changes unless authorized.
- Resolve conflicts locally.
- One ownership lane per bead unless authorized.
- Prefer deterministic shared logic in `src/` or Rust-owned SimulationCore seams over new browser-shell logic.

`web-runner/app.js`:
- Orchestration-only; keep it thin.
- Use it as pointer/composition wiring, not feature storage.
- Do not add business logic, utilities, feature state, or large implementations.
- Extend contextual modules or create dedicated modules for new features.
- Wire new modules through minimal `web-runner/app.js` changes.
- Treat `web-runner/app.js` growth as architectural debt.

## Output Discipline
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

## Retrieval
For code-location, ownership, dependency, or call-path questions, first use `jcodemunch-mcp`.

Retrieval Receipt is required for code-location, ownership, dependency, or call-path answers:
- tool used
- if not `jcodemunch-mcp`, why not
- repo/query used
- files/symbols retrieved
- whether full-file reads were avoided

Prefer indexed symbol/text search before full-file reads. Use focused `rg -l` or `rg -n -m` after indexed retrieval or when searching docs/data/non-code files.

## Containment
- First command: `pwd`.
- Stay inside repo root.
- Confirm clean git status before editing and before merge/commit.
- Prefer live `bd` state over `.beads/` files.
- Do not write outside repo without approval.

## Validation
- Use existing repo test commands.
- Prefer focused deterministic validation.
- Manual browser QA is acceptable for runtime behavior.
- For local `web-runner` visual/manual QA, use `@Browser` / the Codex in-app browser first. Use standalone Playwright, Chrome, or `agent-browser` only if Browser is unavailable, the user asks for another surface, or the check requires unsupported Browser capability.
- Bug/regression beads must update `ai-memory/insights.md` with reusable heuristics, not event logs.

## Escalation
Stop and ask when:
- requirements conflict
- scope is unclear
- architecture impact is significant
- persistence/deployment/schema behavior changes
- repo state is unexpected
- worktree cap or ownership is unclear

## Subagents
Use subagents only when they improve retrieval, implementation, QA/review, or docs/API verification.

Report findings, files inspected, files changed, validation performed, and uncertainty/risk.

## Child Doc Shape
Use this section order for child AGENTS.md files:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

Leave sections empty only when there is no stable local guidance yet.

## Output Contracts
`commit check <bd-id>`:
- `COMMIT: YES|NO`
- `Reason: <one line>`
- `If YES: Commit Message: <summary bd-<id>>`

`qa handoff <bd-id>`:
- `Test URL`
- `Steps`
- `Expected`

## Child DOX Index
- `Scripts/AGENTS.md` - Construct-style runtime mirror and high-risk function parity.
- `web-runner/AGENTS.md` - browser runtime shell, rendering/input systems, runtime data, and browser-shipped core rules.
- `src/AGENTS.md` - shared deterministic JS rules and layout contracts.
- `rust/AGENTS.md` - Rust SimulationCore deterministic boundary and WASM exports.
- `tests/AGENTS.md` - contract tests, fixtures, and regression proof surfaces.
- `tools/AGENTS.md` - repo automation, QA harnesses, local server, and build helpers.
- `governance/AGENTS.md` - product, planning, audit, and Beads review documentation.

Root-owned areas without child AGENTS.md:
- `ai-memory/` - stable context and insights; follow startup and bug/regression rules above.
- `docs/`, `agents/`, `goals/`, `skills/`, `inputs/`, `output/` - reference, archive, and support materials unless a future bead creates a durable local boundary.
- `node-app/`, `python-app/` - scaffold/support apps, not current canonical runtime.
- root package/deploy/config files - repo-level tooling and deployment surface.

## Deeper Policy
- Keep deeper governance in `governance/`.
- Keep this file minimal enough to remain useful.
- Add policy only for repeated failures or durable architecture boundaries.
