# Codex-Orka Repo Map

Role: map
Status: canonical

## Purpose

- Keep startup context small.
- Show what is here and where to go next.
- Treat repo-local knowledge as the system of record.

## What This Repo Is

- Runtime game code lives in `Scripts/`, `web-runner/`, and `src/`.
- `Construct 3` artifacts are retired and are not runtime truth.
- Default integration branch: `codex/live`
- Current release branch: `main`

## Repo Shape

```text
AGENTS.md
docs/
  architecture/   top-level domain and seam map
  product/        design intent and runtime behavior reference
  qa/             browser policy, validation guides, control models
  workflow/       process and coordination authority
  plans/          active and completed execution plans
  references/     stable external or tooling references
agents/
  pm_status.md    current PM snapshot
  dev_reports.md  recent dev handoffs only
  issues.md       active blockers and ambiguities
governance/
  execution/      Beads workflow authority
ai-memory/
  context.md      compact retrieval/startup support
  insights.md     reusable heuristics from bug and regression work
```

## Architecture Seams

- Combat orchestration: `src/core/combatRuntimeGateway.js`
- Layout routing: `src/core/layoutState.js`
- Input ownership: `src/core/inputDomains.js`
- Turn gating: `src/core/turnGateController.mjs`
- Shared deterministic rules: `src/core/`
- Gameplay mirrors: `Scripts/functionBank.js`, `web-runner/modules/functionBank.js`
- Runtime integration/render seam: `web-runner/app.js`

## Canonical Docs

- Architecture map: [docs/architecture/index.md](docs/architecture/index.md)
- Product docs: [docs/product/index.md](docs/product/index.md)
- QA docs: [docs/qa/index.md](docs/qa/index.md)
- Workflow docs: [docs/workflow/index.md](docs/workflow/index.md)
- References: [docs/references/index.md](docs/references/index.md)
- Plans: `docs/plans/active/` and `docs/plans/completed/`

## What To Do Next

### Combat or turn-flow issue

1. [docs/product/index.md](docs/product/index.md)
2. [docs/qa/index.md](docs/qa/index.md)
3. `src/core/turnGateController.mjs` or `src/core/combatRuntimeGateway.js`
4. only then the mirrored function bank or `web-runner/app.js`

### Progression or economy task

1. [docs/product/index.md](docs/product/index.md)
2. relevant domain spec from the product index
3. shared progression seam or mirrored function bank

### UI or layout bug

1. [docs/product/index.md](docs/product/index.md)
2. [docs/qa/browser-validation.md](docs/qa/browser-validation.md)
3. `src/core/layoutState.js`
4. `web-runner/app.js`

### Workflow or Beads question

1. [docs/workflow/index.md](docs/workflow/index.md)
2. live status artifacts under `agents/`

## Validation Surfaces

- Contract tests under `tests/`
- Browser validation guide: [docs/qa/browser-validation.md](docs/qa/browser-validation.md)
- Browser backend policy: [docs/qa/browser-policy.md](docs/qa/browser-policy.md)

## Live Workflow State

- Blockers and unresolved issues: [agents/issues.md](agents/issues.md)
- Current PM snapshot: [agents/pm_status.md](agents/pm_status.md)
- Recent dev handoffs: [agents/dev_reports.md](agents/dev_reports.md)
- Workflow authority: [governance/execution/beads-process.md](governance/execution/beads-process.md)

## Compatibility Notes

- [README.md](README.md), [claude.md](claude.md), and [ai-memory/project.md](ai-memory/project.md) are compatibility shims, not alternate repo maps.
