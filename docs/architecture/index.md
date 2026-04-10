# Architecture Index

Role: architecture
Status: canonical

## Purpose

- Map the runtime seams before opening hot files.
- Keep code navigation seam-first.

## Canonical Seams

- Combat orchestration: `src/core/combatRuntimeGateway.js`
- Layout ownership: `src/core/layoutState.js`
- Input ownership: `src/core/inputDomains.js`
- Turn control and input windows: `src/core/turnGateController.mjs`
- Shared deterministic rules: `src/core/`
- Gameplay mirrors: `Scripts/functionBank.js`, `web-runner/modules/functionBank.js`
- Runtime render shell: `web-runner/app.js`

## Reading Order

1. Start from the seam that owns the behavior.
2. Read shared deterministic logic before mirrored hot files.
3. Open hot files only when the seam route points there.

## Related Docs

- Product docs: [../product/index.md](../product/index.md)
- QA docs: [../qa/index.md](../qa/index.md)
- Workflow docs: [../workflow/index.md](../workflow/index.md)
