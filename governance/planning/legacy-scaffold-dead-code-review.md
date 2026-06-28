# Legacy And Scaffold Dead-Code Review

Status: review packet for `ORKA-yib8.4`. This document classifies Fallow dead-code candidates before any retirement. It does not authorize deletion, archive movement, or runtime behavior changes.

## Current Evidence

Checked on 2026-06-28 from `origin/main` in the `ORKA-yib8.4` worktree.

- `ORKA-yib8.4` notes cite Fallow 2.87.0 unused-file findings across `tests/`, `web-runner/`, `src/`, `Scripts/`, `tools/`, and `node-app/`.
- `ORKA-yib8.6` owns Fallow entrypoint calibration because package-script-only analysis can falsely mark browser runtime files as unused.
- `ORKA-yib8.5` owns mirror policy for `Scripts/` and `web-runner/modules/`.
- `rg` found active runtime imports for `web-runner/modules/functionRegistry.js` from `web-runner/app.js`.
- `rg` found `netlify.toml` itself as deployment routing configuration; it is not an imported JS module and should not be judged by import reachability.
- `bd show ORKA-p8t` found an open Bead for `web-runner/gameLogic.js`, which means that file has unresolved historical ownership rather than safe deletion status.

## Candidate Disposition Matrix

| Candidate | Disposition | Evidence | Next safe action |
| --- | --- | --- | --- |
| `netlify.toml` | Keep | Defines deploy publish root and redirects `/`, `/web-runner`, and `/favicon.ico`. Static analysis import reachability does not model deployment config. | No cleanup. Any deploy change needs a deployment/config bead and Netlify validation. |
| `web-runner/modules/functionRegistry.js` | Keep | Imported by `web-runner/app.js`; DOX says it owns context creation and function dispatch. | No cleanup. Changes require runtime registry tests and `tests/functionBankParityContract.test.js` if dispatch affects mirrored behavior. |
| `web-runner/gameLogic.js` | Blocked retire candidate | Zero-import legacy/simple game-state surface, but open Bead `ORKA-p8t` still targets duplicate keyboard listener behavior in this file. | First decide whether `ORKA-p8t` should be closed as obsolete, converted to archive, or implemented. Do not edit or delete under this review bead. |
| `node-app/server.js` and `node-app/README.md` | Scaffold archive candidate | Minimal standalone Node health server, no package script, no deploy reference found in focused search. | Create a narrow archive/removal bead if the user wants scaffold cleanup. Preserve README context or move it with the file. |
| `Scripts/functionBank.js`, `Scripts/state.js`, `Scripts/functionRegistry.js`, `Scripts/mainSheet.js`, `Scripts/skillSheet.js`, `Scripts/liveOpsTokens.js`, `Scripts/monsterLootTableEventTokens.js` | Keep as intentional mirror until pair-specific audit says otherwise | Scripts DOX marks these as Construct-style runtime mirror and compatibility vocabulary. `ORKA-yib8.5` classifies mirror cleanup as dangerous without pair-specific validation. | Use `ORKA-yib8.5` follow-up split. No deletion from aggregate Fallow output. |
| `Scripts/main.js`, `Scripts/runtimeAdapter.js`, `Scripts/logicCore.js` | Legacy Construct startup review candidate | `Scripts/main.js` exports `runOnStartup(runtime)` and delegates to runtime adapter plus logic loop. This looks Construct-facing even if browser runtime does not import it. | Create a Construct-legacy boundary bead to decide keep/archive/retire together. Do not split these files independently. |
| `Scripts/config.js`, `Scripts/utils.js`, `Scripts/entities.js` | Legacy helper archive candidate, blocked by Construct boundary decision | Small helper/scaffold files with no focused live references found in this pass, but they sit under the Scripts legacy surface. | Review with `Scripts/main.js` and `Scripts/runtimeAdapter.js` in the same Construct-legacy boundary bead. |

## Required Follow-Up Beads

1. `web-runner/gameLogic.js` disposition bead: decide whether `ORKA-p8t` is obsolete because `web-runner/app.js` is canonical, or whether `gameLogic.js` remains a supported legacy surface.
2. `node-app` scaffold archive bead: if approved, move or remove `node-app/server.js`, `node-app/README.md`, and generated `node-app/server.log` with rollback evidence.
3. Scripts legacy boundary bead: classify `Scripts/main.js`, `runtimeAdapter.js`, `logicCore.js`, `config.js`, `utils.js`, and `entities.js` together.

## Do Not Change

- Do not delete `netlify.toml` based on import reachability.
- Do not delete `web-runner/modules/functionRegistry.js`; it is live.
- Do not delete any `Scripts/` mirror file from aggregate Fallow output.
- Do not fix `web-runner/gameLogic.js` until its ownership is decided.
- Do not run `fallow fix --yes`.

## Validation For This Review

- Focused file reads for each named candidate.
- Focused search for references to `node-app`, `netlify`, `gameLogic`, `Scripts/main`, `Scripts/config`, `Scripts/utils`, and `functionRegistry`.
- `bd show ORKA-p8t` for historical `gameLogic.js` ownership.
- `git diff --check`.
