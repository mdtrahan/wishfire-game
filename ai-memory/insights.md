# Insights / Decisions Log

## 2026-02-14
- Initialized memory system files.
- Next: Inventory repo structure and key gameplay loop files.
- Repo structure inventory:
  - Runtime roots: `web-runner/`, `Scripts/`, `src/core/`, `src/layout/`, `tests/`.
  - Legacy/archive roots present but non-runtime: `_archive/`, `project_C3_conversion/` (per guardrails).
- Key gameplay loop files and anchors:
  - `web-runner/app.js`: layout registration (`registerLayout`), initial activation (`activateInitialLayout('combat')`), input/match handling (`handleGemMatch`), main tick loop (`tick` + `requestAnimationFrame`), debug state export (`window.render_game_to_text`).
  - `src/core/combatRuntimeGateway.js`: combat authority boundary (`runCombatStep`, `suspend/resume`, `isInAtomicSection`).
  - `src/core/layoutState.js`: layout transition/atomic guard integration.

CHECKPOINT
- processed: Inventory repo structure and key gameplay loop files
- added: runtime directory map + key gameplay loop file anchors
- next: Add a deterministic debug snapshot output for testing

- Deterministic debug snapshot is already implemented in runtime:
  - `web-runner/app.js` exports `window.render_game_to_text` with stable JSON payload (turn, order, resources, entities, gems, flags).
  - `web-runner/app.js` exports `window.advanceTime(ms)` stepping frames deterministically via fixed `1/60` step.
  - `window.__codexGame` helper object exists for targeted test control hooks.

CHECKPOINT
- processed: Add a deterministic debug snapshot output for testing
- added: verified existing deterministic snapshot + time-step hooks; no code changes needed
- next: Implement <next feature you want>

- Placeholder todo item was not actionable without a concrete feature spec; closed to keep queue deterministic.
- Follow-up expectation: next run should replace placeholder with one explicit feature request before coding.

CHECKPOINT
- processed: Implement <next feature you want> (placeholder)
- added: marked placeholder closed + documented requirement for explicit feature spec
- next: Wait for concrete feature request
