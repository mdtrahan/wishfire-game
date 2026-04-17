# Refactor Vectors

Role: heuristic
Status: active

## Purpose

- Keep refactor strategy and cleanup prioritization out of the repo map.
- Record high-risk zones, delete candidates, and cleanup order as reference material.

## Refactor Vectors

- Treat the weekly `reports/debt-actions.json` refresh as a prioritization layer on top of the seam map, not as runtime truth.
- Highest-risk change zone: `web-runner/app.js` because it owns runtime boot, layout registration, render flow, and direct wiring into combat/layout/input seams.
- Highest-value consolidation zone: `Scripts/functionBank.js` and `web-runner/modules/functionBank.js`; both are large mirrors and should only be touched after reading the shared deterministic rules in `src/core/`.
- High-friction tooling zone: `tools/balance_harness.js`; large single-file harness, but lower runtime blast radius than `web-runner/app.js`.
- High-confidence delete candidates: `web-runner/gameLogic.js`; legacy subtree entrypoint `Scripts/legacy but partially working/scripts/main.js`.
- Medium-confidence legacy delete cluster: `Scripts/legacy but partially working/scripts/CombatLogic.js`, `EventHandlers.js`, and nearby legacy siblings; confirm no manual/offline workflow still points at them before removal.
- False-positive conflict to remember: `reports/debt-report.md` marks `src/core/combatRuntimeGateway.js` unused, but the live browser shell uses `web-runner/src/core/combatRuntimeGateway.js` and the root file still matters as a documented compatibility/audit surface; do not treat either as a first-pass deletion target.

## Safe Cleanup Order

1. Remove high-confidence dead standalone artifacts first: `web-runner/gameLogic.js`, then the legacy subtree entrypoint after dependency confirmation.
2. Validate the full legacy `Scripts/legacy but partially working/scripts/` cluster before any broad deletion sweep.
3. Consolidate the mirrored `functionBank` pair behind `src/core/` rules before splitting render/runtime ownership in `web-runner/app.js`.
4. Split `web-runner/app.js` by seam ownership only after mirror drift is reduced; otherwise refactors amplify coupling.
5. Refactor `tools/balance_harness.js` after runtime seams stabilize.
6. Revisit `package.json` dependency cleanup last; `gsap` looks unused in live source, but dependency removal is lower priority than eliminating duplicated runtime logic.
