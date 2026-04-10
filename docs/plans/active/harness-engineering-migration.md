# Harness-Engineering Migration Plan

Role: plan
Status: active

## Rollback Anchors

- Checkpoint tag: `checkpoint/harness-migration-pre-20260409`
- Checkpoint branch: `codex/checkpoint-harness-migration-pre-20260409`
- Base commit: `6075f9dc7a19d12f5b49308037fe2a488775d1b4`

## Baseline Metrics

- `AGENTS.md` lines before migration: `263`
- Front-door docs before migration: `4`
- Browser policy contradiction: `docs/backend/browser-backend-policy.md` vs `governance/qa/browser-battery-minimal.md` vs `governance/qa/combat-playwright-control-model.md`

## Baseline Discovery Paths

- Combat bug: `AGENTS.md` -> `governance/product/game-function-reference.md` -> `governance/qa/combat-playwright-control-model.md` -> hot files
- Progression task: `AGENTS.md` -> `ai-memory/project.md` -> product docs -> hot files
- UI/layout bug: `AGENTS.md` -> product docs -> browser docs -> `web-runner/app.js`
- Workflow question: `AGENTS.md` -> workflow prose inside `AGENTS.md` -> `governance/execution/beads-process.md`

## Migration Goals

- One primary repo map
- Seam-first routing
- One canonical browser policy
- Compatibility shims instead of duplicate front doors
- Mechanical checks for drift
