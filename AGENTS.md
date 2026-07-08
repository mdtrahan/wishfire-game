# AGENTS.md - Codex-Orka DOX Root

## Repository Philosophy
- Beads represent work.
- Git transports work.
- Main represents the game.
- Branches are temporary.

Primary branch: `main`; legacy Construct 3 artifacts are retired.

## Purpose
- Keep always-on context minimal, local, and operational; use live `bd` state, the codebase, and the nearest applicable `AGENTS.md` chain as source of truth.
- Use `soul.md` for judgment preferences only; it is not execution policy or task tracking.
- This file owns repo-wide invariants and the top-level Child DOX Index. Detailed process policy lives in `governance/execution/`.

## Core Principles
- `AGENTS.md` files are binding work contracts; before editing, read root and every `AGENTS.md` on the path to the target.
- Do not rely on memory for local rules; re-read the applicable DOX chain in the current session.
- Child `AGENTS.md` files inherit parent rules. No child may weaken Beads, safety, validation, retrieval, or DOX update rules.
- After meaningful changes, update the closest owning `AGENTS.md`; refresh parent Child DOX Indexes when adding, moving, or deleting child docs.
- Keep DOX concise: stable contracts and common failure points, not file trivia; add root policy only for repeated failures or durable architecture boundaries.

## Golden Path
Startup
    ↓
Read AGENTS chain
    ↓
Implementation Gate
    ↓
Implement
    ↓
Validate
    ↓
Integration Ready

## Startup
1. Run `pwd`.
2. Read `ai-memory/context.md`.
3. Ensure a compatible `bd` resolves.
4. Run `bd ready`.
5. Verify `bd list`.
6. Run `bd show <id>` once a bead is selected or assigned.

Shell notes: prefix commands with `rtk` when available; keep output bounded and targeted.

After startup, execution policy is governed by:
- `governance/execution/implementation-gate.md`
- `governance/execution/retrieval.md`
- `governance/execution/validation.md`
- `governance/execution/integration.md`

## Beads Gate
- No implementation work without a bead; one active implementation bead per agent run; commits must include `bd-<id>`.
- Follow `governance/execution/beads-process.md` and `governance/execution/implementation-gate.md`.
- Minor exemptions are only those listed in the Implementation Gate.
- For gameplay/content bead creation, check `governance/product/player-living-guide.md`; if it conflicts with the request, ask before implementing.
- If scope changes, stop and clarify, reopen the bead, or create a new bead.

## Worktree Discipline
- Follow `governance/execution/integration.md` for lane creation, branch disposition, merge, cleanup, and deletion rules.
- Keep one implementation bead per bead-scoped branch/worktree; include the bead id in branch and worktree names.
- Never merge without validation, current Integration Ready evidence, and a rollback checkpoint.
- QA PASS certifies feature quality only; Integration Ready certifies merge readiness against current `main`.

## Repository Map
Runtime
├── `Scripts/`, `web-runner/`, `src/`
└── `rust/`
Product └── `governance/product/` (`abilities.html`)
Execution └── `governance/execution/`
Memory └── `ai-memory/`
Reference ├── `docs/`, `goals/`, `skills/`
          └── `inputs/`, `output/`
Support ├── `agents/` (retired)
        └── `node-app/`, `python-app/`, root package/deploy/config files

## Implementation Rules
- Edit the minimum necessary files; avoid unrelated refactors; resolve conflicts locally.
- Stop on unexpected tracked changes unless authorized; keep one ownership lane per bead unless authorized.
- Prefer deterministic shared logic in `src/` or Rust-owned SimulationCore seams over new browser-shell logic.
- Keep `web-runner/app.js` orchestration-only; detailed ownership rules live in `governance/execution/implementation-gate.md`.
- Use `governance/execution/validation.md` for focused proof and `governance/execution/integration.md` for merge readiness.

## Escalation
- Follow the Escalation section in `governance/execution/implementation-gate.md`.
- Do not write outside the repo without approval.

## Child DOX Index
- `Scripts/AGENTS.md` - Construct-style runtime mirror and high-risk function parity.
- `web-runner/AGENTS.md` - browser runtime shell, rendering/input systems, runtime data, and browser-shipped core rules.
- `src/AGENTS.md` - shared deterministic JS rules and layout contracts.
- `rust/AGENTS.md` - Rust SimulationCore deterministic boundary and WASM exports.
- `tests/AGENTS.md` - contract tests, fixtures, and regression proof surfaces.
- `tools/AGENTS.md` - repo automation, QA harnesses, local server, and build helpers.
- `governance/AGENTS.md` - product, planning, audit, and Beads review documentation.
