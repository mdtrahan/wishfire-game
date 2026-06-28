# SimulationCore Shadow Ownership Audit

Bead: `ORKA-yib8.1.3`

## Scope

This audit classifies current ownership inside `web-runner/systems/simulationCoreShadow.js`. It is documentation only: no Rust implementation, JavaScript refactor, WASM rebuild, app wiring change, or shadow-check deletion is authorized here.

## Retrieval Receipt

| Tool | Query | Evidence |
|---|---|---|
| `codebase-memory` | project `Users-Mace-Codex-Orka`; `simulationCoreShadow` search | Live root `/Users/Mace/Codex-Orka` is indexed and ready; `web-runner/app.js` imports `initializeSimulationCoreShadow()` and shadow helpers; tests and governance docs reference the shadow boundary. |
| `jcodemunch-mcp` | `resolve_repo` for this worktree | Resolved to live repo id `local/Codex-Orka-904e2bad`; watch status reported no stale indexes. |
| `jcodemunch-mcp` | `get_file_risk web-runner/systems/simulationCoreShadow.js` | File metrics: one incoming file, `churn_30d=32`, no direct test file marker; `updateShadowDomMarker` has cyclomatic `161`; `initializeSimulationCoreShadow` begins at line `1120`. |
| `jcodemunch-mcp` | dependency graph for `web-runner/systems/simulationCoreShadow.js` | One runtime importer: `web-runner/app.js`. No imports except the direct seeded RNG packet helper surfaced by file read. |
| focused `rg` | exports, owner markers, tests, planning docs | Found exported owner/shadow helpers, 33 tests referencing `simulationCoreShadow.js`, and planning contracts that separate Rust deterministic ownership from JavaScript browser integration. |

Full-file reads were avoided except for small targeted slices around startup, DOM marker, and existing boundary tests.

## Current Boundary

| Responsibility | Current owner | Forbidden owner | Evidence |
|---|---|---|---|
| WASM loading and readiness state | `web-runner/systems/simulationCoreShadow.js` | `web-runner/app.js`, Rust | `initializeSimulationCoreShadow()` loads `./assets/simulation_core.wasm`, stores `shadow.exports`, and reports `ready`, `missing-export`, `unavailable`, or `error`. |
| Browser debug marker projection | `web-runner/systems/simulationCoreShadow.js` | Rust, deterministic rule modules | `updateShadowDomMarker()` writes `document.documentElement.dataset.simCoreShadow*` fields. This is browser diagnostics, not simulation truth. |
| Window owner/shadow hooks | `web-runner/systems/simulationCoreShadow.js` | `app.js` | Startup assigns `window.__ORKA_*_OWNER__` and selected `window.__ORKA_*_SHADOW__` hooks for current deterministic families. |
| Rust deterministic rule families | `rust/simulation_core/src/lib.rs` plus `web-runner/assets/simulation_core.wasm` | JavaScript recomputation | `governance/planning/simulation-core-rust-final-audit.md` lists completed Rust ownership slices; `tests/finalRustOwnershipBoundaryContract.test.js` checks owner markers and Rust exports. |
| Shared JS packet and normalization rules | `src/core/` and `web-runner/src/core/` | DOM/browser systems and Rust-only source | Boundary tests name `src/core/simulationCorePacket.cjs`; `simulationCoreShadow.js` imports only `createSeededRngSimulationPacket` from browser core. |
| Browser application wiring | `web-runner/app.js` | shadow helper internals | `app.js` imports the shadow helpers and calls `initializeSimulationCoreShadow()` once at startup; jcodemunch dependency graph shows it as the only importer. |
| Observe-only mismatch diagnostics | `web-runner/systems/simulationCoreShadow.js` | Silent runtime fallback, product logic | Existing tests assert mismatch dataset fields, warning markers, and observe-only behavior. |

## Risk Classification

`simulationCoreShadow.js` is intentionally central but too broad to refactor casually:

| Surface | Risk | Reason |
|---|---|---|
| `updateShadowDomMarker()` | High | It projects many counters and owner states into DOM dataset fields; jcodemunch reports cyclomatic `161`. Safe follow-up is data-driven projection, not semantic edits. |
| export presence checks and startup owner smoke checks | Medium | These are repetitive and reviewable, but they encode the Rust/JS contract. Any extraction must keep marker names and focused ownership tests green. |
| `createSimulationCore*Resolution()` helpers | High | These bridge JS packet expectations and Rust return codes. Treat each rule family as its own bead if changed. |
| `shadow*` observe helpers | Medium | They compare Rust/JS or preserve fallback values. They must not become final JavaScript authority for Rust-owned behavior. |
| `initializeSimulationCoreShadow()` | High | It owns global hook registration and startup checks. Changes require `simulationCoreShadowContract`, final ownership boundary, and focused affected family tests. |

## Follow-Up Decisions

| Candidate | Track? | Reason |
|---|---|---|
| Extract DOM marker projection from `updateShadowDomMarker()` | Yes, separate refactor bead | High complexity and browser-only ownership make this the safest mechanical reduction target. Validation: `tests/simulationCoreShadowContract.test.js`, `tests/finalRustOwnershipBoundaryContract.test.js`, and `git diff --check`. |
| Generate owner hook/DOM field lists from one table | Yes, separate refactor bead after marker extraction | The current duplicated counters and marker strings are the main reviewability problem. Stop if tests require changing marker names. |
| Split each `createSimulationCore*Resolution()` by rule family | Track only when a rule family needs behavior work | Broad extraction would risk packet drift. Each rule family needs its own owner tests and Rust/WASM gate. |
| Move WASM loading into `app.js` | Do not track | Violates `app.js` orchestration-only and `web-runner/systems/AGENTS.md` ownership. |
| Move browser dataset diagnostics into Rust or shared `src/core/` | Do not track | DOM and browser globals are explicitly JavaScript/browser-system ownership. |
| Delete shadow helpers now that Rust owns the deterministic families | Do not track | Tests and final Rust audit still rely on owner markers and observe-only mismatch diagnostics. |

## Validation Gates For Future Work

Minimum gates for any future `simulationCoreShadow.js` change:

- Read `AGENTS.md`, `web-runner/AGENTS.md`, and `web-runner/systems/AGENTS.md`.
- Use `jcodemunch-mcp resolve_repo` to avoid stale worktree indexes.
- Run `node --test tests/simulationCoreShadowContract.test.js tests/finalRustOwnershipBoundaryContract.test.js`.
- Add the focused ownership/fixture test for any touched rule family.
- Run `git diff --check`.
- Run `npm run rust:build-wasm` and `cargo test --manifest-path rust/simulation_core/Cargo.toml` only when Rust exports, WASM behavior, or rule-family ownership changes.

## Stop Conditions

Stop before editing runtime code if:

- the change would move deterministic ownership from Rust back to JavaScript;
- a marker name or packet shape must change without updating the matching Rust export and ownership tests;
- the change mixes DOM projection cleanup with rule-family behavior;
- `app.js` would gain shadow implementation logic instead of startup wiring;
- jcodemunch resolves a stale/non-live repo id or index freshness is unclear.
