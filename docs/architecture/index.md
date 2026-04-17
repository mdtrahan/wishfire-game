# Architecture Index

Role: architecture
Status: canonical

## Purpose

- Map the runtime seams before opening hot files.
- Keep code navigation seam-first.

## Canonical Seams

- Combat orchestration: live browser runtime `web-runner/src/core/combatRuntimeGateway.js`; compatibility/audit seam `src/core/combatRuntimeGateway.js`
- Layout ownership: `src/core/layoutState.js`
- Input ownership: `src/core/inputDomains.js`
- Turn control and input windows: `src/core/turnGateController.mjs`
- Shared deterministic rules: `src/core/`
- Gameplay mirrors: `Scripts/functionBank.js`, `web-runner/modules/functionBank.js`
- Runtime render shell: `web-runner/app.js`

## Refactor Priority Zones

- `web-runner/app.js`: highest-risk integration shell; owns startup, render flow, layout registration, and live seam wiring.
- `Scripts/functionBank.js` and `web-runner/modules/functionBank.js`: highest-value consolidation pair; duplication cluster layered on top of the deterministic rules in `src/core/`.
- `tools/balance_harness.js`: large tooling file with medium runtime blast radius; safer than `app.js` but still a cleanup target.
- `src/core/layoutState.js`, `src/core/inputDomains.js`, `web-runner/src/core/combatRuntimeGateway.js`, `src/core/combatRuntimeGateway.js`, and `src/core/turnGateController.mjs`: tightly coupled seam cluster; changes here should be sequenced before shell extraction, not mixed into deletion work.

## Candidate Cleanup Targets

- High confidence: `web-runner/gameLogic.js`; legacy entrypoint `Scripts/legacy but partially working/scripts/main.js`.
- Medium confidence: `Scripts/legacy but partially working/scripts/CombatLogic.js`, `EventHandlers.js`, and adjacent legacy siblings.
- Conflict flag: `src/core/combatRuntimeGateway.js` was suggested as unused by the debt scan, but direct source review shows the live shell imports `web-runner/src/core/combatRuntimeGateway.js` and the root file remains part of the documented compatibility/audit surface; keep both out of first-pass deletion plans.

## Dependency-Aware Order

1. Confirm and delete isolated dead files.
2. Validate the rest of the legacy subtree as an orphaned cluster before bulk removal.
3. Reduce mirror drift between the `functionBank` pair and `src/core/`.
4. Only then split `web-runner/app.js` along seam ownership.
5. Handle dependency cleanup such as `gsap` after runtime and harness cleanup.

## Reading Order

1. Start from the seam that owns the behavior.
2. Read shared deterministic logic before mirrored hot files.
3. Use the weekly `reports/debt-actions.json` refresh to rank which hot files deserve extra caution, then validate against live seams.
4. Open hot files only when the seam route points there.

## Related Docs

- Product docs: [../product/index.md](../product/index.md)
- QA docs: [../qa/index.md](../qa/index.md)
- Workflow docs: [../workflow/index.md](../workflow/index.md)
