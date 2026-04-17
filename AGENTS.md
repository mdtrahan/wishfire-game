# Codex-Orka Agent Router

Role: execution-router
Status: canonical

## Scope

- This file defines execution rules for agent work.
- Runtime authority: `Scripts/`, `web-runner/`, and `src/`.
- `Construct 3` is retired; reference only as retirement context, never as operational source of truth.
- Default integration branch: `codex/live`
- Current release branch: `main`
- ALWAYS prefer value over process bloat.

## Retrieval Order

1. Open [docs/product/index.md](docs/product/index.md) and [docs/qa/index.md](docs/qa/index.md) for runtime behavior and validation intent.
2. Open [docs/architecture/index.md](docs/architecture/index.md) for seam ownership.
3. For workflow/process questions, open [docs/workflow/index.md](docs/workflow/index.md) and [governance/execution/beads-process.md](governance/execution/beads-process.md).
4. Use `jcodemunch` first on hot or large files, then open the smallest owning seam before broad reads.

## Hot Surfaces + Retrieval Rules

- Highest blast radius: `web-runner/app.js`.
- High-risk mirrors: `Scripts/functionBank.js` and `web-runner/modules/functionBank.js`.
- Prefer seam files first:
  - `src/core/turnGateController.mjs`
  - `src/core/layoutState.js`
  - `src/core/inputDomains.js`
  - `web-runner/src/core/combatRuntimeGateway.js`
- Use `rtk` for noisy shell output when available: `rtk git status`, `rtk git diff`, `rtk grep`, `rtk test`.
- If the owning seam explains the behavior, do not open or edit a larger hot surface.

## Karpathy-Lite Execution Gate (A-M-P)

Apply this gate for high-blast-radius runtime edits and all bug/regression fixes.

Before editing:
- A (Assumptions): list unknowns and the exact validation step for each.
- M (Minimality): define the smallest patch boundary (files/symbols) and explicit non-goals.
- P (Proof): define the concrete test/repro command and expected pass signal.

Stop rules:
- If scope expands beyond boundary, split the expansion into follow-up work.
- If proof cannot be produced, do not mark the task complete.

## Skill Routing (Minimal, Runtime-Only)

Use exactly one primary skill per task unless the user explicitly asks for alternatives.

- Trigger: bug/regression in JavaScript runtime behavior.
  - Primary skill: `debug-javascript`
  - Evidence: one root cause and failing->passing repro proof.

- Trigger: browser/runtime behavior validation or UI flow verification.
  - Primary skill: `webapp-testing`
  - Evidence: reproducible Playwright check with a clear pass signal.

- Trigger: feature planning that touches multiple seams or has ambiguous scope.
  - Primary skill: `feature-planning`
  - Evidence: ordered plan with dependencies, testing strategy, and explicit non-goals.
  - Constraint: planning pass does not edit code.

- Trigger: user requests options, trade-off analysis, or "best approach" selection.
  - Primary skill: `ensemble-orchestrator`
  - Evidence: 3 materially different options, rubric scoring, and a justified winner.

Fallback:
- If no trigger matches, use seam-first workflow in this file.
- `javascript-typescript` is reference-only and not a default routing target.

## Subagent Escalation

- `search-specialist`: ownership lookup and fast codebase search.
- `debugger`: deep root-cause isolation.
- `game-developer`: gameplay/runtime/render-loop implementation.
- `refactoring-specialist`: behavior-preserving structural cleanup.
- `reviewer`: optional escalation for large or risky diffs only.

## Done Criteria

- Proof artifact exists and matches the expected pass signal.
- Change stays within declared minimal boundary, or expansion is split and documented.
- No Construct 3 operational dependency or source-of-truth claim is introduced.
- Validation surfaces are consulted as needed:
  - `tests/`
  - [docs/qa/browser-validation.md](docs/qa/browser-validation.md)
  - [docs/qa/browser-policy.md](docs/qa/browser-policy.md)

## Operational Links

- Architecture: [docs/architecture/index.md](docs/architecture/index.md)
- Product: [docs/product/index.md](docs/product/index.md)
- QA: [docs/qa/index.md](docs/qa/index.md)
- Workflow: [docs/workflow/index.md](docs/workflow/index.md)
- References: [docs/references/index.md](docs/references/index.md)
- Refactor vectors: [docs/references/refactor-vectors.md](docs/references/refactor-vectors.md)
- Live status: [agents/issues.md](agents/issues.md), [agents/pm_status.md](agents/pm_status.md), [agents/dev_reports.md](agents/dev_reports.md)
