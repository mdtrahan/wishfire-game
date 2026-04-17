# Project Context (stable)

Role: heuristic
Status: active
Canonical map: [../AGENTS.md](../AGENTS.md)

## Project

- HTML5 game repo.
- Primary goal: ship features incrementally without losing decisions across sessions.

## Working rules

- Single-task focus: one todo item per Codex run.
- Prefer minimal changes over refactors unless the todo explicitly requests it.
- When mapping, layer the weekly `reports/debt-actions.json` refresh onto the seam map as refactor guidance only.
- Validate any suggested delete action against direct source references before treating it as safe.

## Refactor Snapshot

- Primary refactor priority zone: `web-runner/app.js`.
- Consolidation priority: `Scripts/functionBank.js` and `web-runner/modules/functionBank.js`.
- Safer cleanup entry points: `web-runner/gameLogic.js` and the legacy subtree entrypoint `Scripts/legacy but partially working/scripts/main.js`.
- Conflict to remember: the live browser shell uses `web-runner/src/core/combatRuntimeGateway.js`, and `src/core/combatRuntimeGateway.js` is still a compatibility/audit surface; neither is a high-confidence delete target despite the debt report.
- Safe sequence: delete isolated dead files, validate the rest of legacy scripts, reduce mirror drift, then split the runtime shell.

## Output expectations

- When coding: edit the minimum files needed.
- When uncertain: write a TODO item instead of guessing.

## Definitions

- "Checkpoint" = todo updated + insights appended (dated) + list of files touched.
