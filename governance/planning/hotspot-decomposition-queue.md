# Hotspot Decomposition Queue

## Scope

This is the ORKA-yib8.1 planning output for high-risk hotspot decomposition across:

- `web-runner/app.js`
- `web-runner/systems/renderRuntime.js`
- `web-runner/systems/simulationCoreShadow.js`
- `web-runner/modules/functionBank.js`
- `Scripts/functionBank.js`
- `rust/simulation_core/src/lib.rs`

This document does not authorize runtime edits. Each extraction or ownership move needs its own bead, clean lane, hot-file scope check, focused validation, and rollback note.

## Current Evidence

Source snapshot:

- Bead: `ORKA-yib8.1`
- jcodemunch repo: `local/Codex-Orka-904e2bad`
- jcodemunch source root: `/Users/Mace/Codex-Orka`
- jcodemunch indexed at: `2026-06-27T18:01:16.066318`
- codebase-memory project: `Users-Mace-Codex-Orka`
- codebase-memory status: ready

Repo health from jcodemunch reports average cyclomatic complexity `8.68`, no dependency cycles, and `11` unstable modules. The top current hotspot is not just the largest file; it is the file/function shape where high complexity meets recent churn.

## Ranked Hotspots

| Rank | Surface | Current risk signal | Blast radius | Existing coverage | Next safe seam |
|---|---|---:|---|---|---|
| 1 | `web-runner/systems/renderRuntime.js` | `renderRuntime` cyclomatic `1330`, churn `39`, hotspot score `4906.2097` | Imported by `app.js`; generated body is one review-hostile runtime string | `ORKA-yib8.1.2`, PR #160 | Finish same-file generated-body decomposition before any behavior refactor |
| 2 | `web-runner/app.js` | `main` score `4663.272`; `tick` score `736.8065`; `handlePointerDown` score `589.4452`; churn `115` | Broad importer hub: depth-1 graph has `39` nodes and `38` edges | `ORKA-yib8.1.1` closed; app thinning docs exist | Move narrow behavior into existing owners while leaving `app.js` as wiring |
| 3 | `web-runner/modules/functionBank.js` and `Scripts/functionBank.js` | mirrored `ApplyDamageToTarget`, `ExecuteSkill`, `ProcessCurrentTurn`, `ProcessTurn`, and DoT/skill paths all score high | Two mirrored hot files plus registry/state/token dependencies | `ORKA-yib8.5` PR #165; `ORKA-yib8.7` PR #163; feature/bug PRs #158, #159, #161, #162 | Extract one deterministic rule family at a time to `src/core` or Rust-owned packets; preserve mirror parity |
| 4 | `web-runner/systems/simulationCoreShadow.js` | `updateShadowDomMarker` cyclomatic `161`, churn `34`, hotspot score `572.411` | Imported by `app.js`; governs Rust owner markers, export checks, startup checks, and shadow resolution factories | `ORKA-yib8.1.3` PR #168 | Split marker/export metadata from startup checks before changing ownership behavior |
| 5 | `rust/simulation_core/src/lib.rs` | churn `27`; many small exported rule functions in one deterministic owner file | No JS import edge in the file graph, but every export is a WASM contract surface | Rust final audit and ownership contract suite exist; PR #168 documents JS boundary | Only modularize Rust after a rule-family bead proves the current single file is blocking safe edits |

Observed but not part of this bead's named target set: `web-runner/systems/devToolingRuntime.js` is a high hotspot in the live ranking. Treat it as an app-shell follow-up only if a future bead scopes dev tooling directly.

## Existing Overlap

Open draft PRs that constrain sequencing:

| PR | Bead | Surface | Sequencing impact |
|---:|---|---|---|
| #160 | `ORKA-yib8.1.2` | `renderRuntime.js` | Must land or be abandoned before new render-runtime refactors; it changes review and rollback shape. |
| #168 | `ORKA-yib8.1.3` | `simulationCoreShadow.js` boundary docs | Use as the current shadow ownership map before splitting marker/export logic. |
| #165 | `ORKA-yib8.5` | mirror ownership docs | Use before any mirrored `functionBank.js` extraction or parity exception. |
| #163 | `ORKA-yib8.7` | shared initiative guard import | Blocks turn/initiative extraction sequencing until merged or rebased. |
| #158 | `ORKA-zvq1` | Power Amp baseline tests | Function-bank changes must not weaken this proof. |
| #159 | `ORKA-p3rw` | Destiny dev panel proof | Dev tooling/app shell changes must not regress clear-state evidence. |
| #161 | `ORKA-rrxj.18` | dead skill runtime pathways | Skill extraction must not conflict with dead-stub removal. |
| #162 | `ORKA-rrxj.19` | KO/orb presentation | Render and combat presentation changes must sequence after this or rebase over it. |
| #164, #166, #167, #169, #170, #171 | repo-health docs/tooling | Mostly planning/support docs; keep them in mind for merge order, but they do not authorize runtime edits. |

## Decomposition Queue

### Queue 1: Render Runtime Patchability

Owner: `web-runner/systems/renderRuntime.js`.

Do first because the current generated body shape makes normal review unsafe. The only safe first move is the already-scoped same-file chunking from `governance/planning/render-runtime-body-decomposition-plan.md`.

Validation gate:

- Extract pre/post generated body and compare hashes.
- Compile the generated body through the existing wrapper.
- Run focused render contracts named in the render plan.
- Run `git diff --check`.

Stop if the generated body hash changes, the wrapper does not compile, or the work pulls in `app.js`, `superGemRuntime.js`, or behavior changes.

### Queue 2: App Shell Thinning

Owner: `web-runner/app.js` as wiring only; implementation owners should be `web-runner/systems/`, `web-runner/state/`, `web-runner/modules/`, `web-runner/src/core/`, or shared `src/core/`.

First safe slices:

- Pointer routing: split `handlePointerDown` branches into owner modules such as modal routing, map routing, combat selection, and nav routing.
- Tick orchestration: separate presentation pump, turn barrier readout, and dev/autoplay cadence without changing turn semantics.
- Startup/loading: keep asset load and runtime layout registration behind explicit owner modules.
- Hero screen helpers: keep roster/skill-card shaping out of `app.js` when an owner module can expose a read model.

Validation gate:

- `npm run test:appjs-boundary`
- Focused tests for the moved surface, for example nav, map close, combat click gate, layout scaffold, or dev tooling contracts.
- No new dependency enters the startup path without a bead-level justification.

Stop if the slice requires broad `app.js` rewiring, package changes, persistence behavior, SimulationCore shadow changes, or mixed gameplay/render ownership.

### Queue 3: Function Bank Rule-Family Extraction

Owners: `web-runner/modules/functionBank.js`, `Scripts/functionBank.js`, shared `src/core/`, and Rust-owned packets where applicable.

Do not extract by file size. Extract by rule family:

- damage/accounting: `ApplyDamageToTarget`, party damage, shields, power amp, damage floats
- skill execution: `ExecuteSkill`, skill draught state, one-off/tiered/repeatable semantics
- turn progression: `ProcessCurrentTurn`, `ProcessTurn`, `HeroTurn`, `EnemyTurn`
- status effects: enemy DoT, debuffs, party regen, lifecycle ticks
- enemy action: target selection, job skill choice, start-action packet, board pressure
- gem action: `ResolveGemAction`, wallets, consumed-gem accounting, action locks

Validation gate:

- `node --test tests/functionBankParityContract.test.js`
- The focused contract for the touched rule family.
- Rust/WASM and ownership tests only when the family crosses the SimulationCore boundary.
- Mirrored runtime paths must stay in parity unless the bead explicitly documents and tests an intentional divergence.

Stop if the change touches both gameplay behavior and presentation in one bead, changes one mirror only without an explicit parity exception, or recomputes a Rust-owned outcome in JavaScript.

### Queue 4: SimulationCore Shadow Hygiene

Owner: `web-runner/systems/simulationCoreShadow.js`.

The immediate risk is not that the file is widely imported; it is that one module now owns marker DOM state, export capability checks, startup owner checks, packet resolution factories, and mismatch diagnostics.

Safe slices after PR #168:

- owner marker catalog and DOM marker update
- export capability matrix
- startup owner checks by rule family
- packet resolution factories by rule family
- mismatch diagnostics and trace recording

Validation gate:

- `node --test tests/simulationCoreShadowContract.test.js tests/finalRustOwnershipBoundaryContract.test.js`
- Relevant `*OwnershipContract.test.js`, `*PacketContract.test.js`, or `*ShadowWiringContract.test.js`
- `npm run rust:build-wasm` and Rust tests only when exports or Rust behavior change

Stop if the slice changes Rust ownership, hides mismatches, weakens diagnostics, or makes JavaScript authoritative for a Rust-owned rule family.

### Queue 5: Rust SimulationCore File Split

Owner: `rust/simulation_core/src/lib.rs`.

This ranks below JS hotspots because the current file is complex but not currently a dependency hub. Split Rust only when a rule-family change becomes hard to review in the single-file layout.

Safe future slices:

- numeric helpers and JS rounding compatibility
- turn/order helpers
- enemy action helpers
- status effect helpers
- shadow export wrappers
- Rust-side fixture tests

Validation gate:

- `cargo test --manifest-path rust/simulation_core/Cargo.toml`
- `npm run rust:build-wasm`
- focused JS ownership/shadow tests for any affected exports

Stop if public export names change without contract updates, WASM is not rebuilt after behavior/export changes, or fixture parity depends on browser presentation data.

## Child Bead Template

Every future implementation bead from this queue should define:

- target surface and single owner
- forbidden owners
- exact functions or blocks in scope
- expected no-behavior-change or behavior-change statement
- rollback path
- focused validation commands
- stop conditions
- overlapping PRs to merge, rebase, or avoid

Do not combine docs, runtime extraction, Rust export changes, and dependency changes in one bead.

## Retrieval Receipt

- Tool used: jcodemunch first for indexed code-location, dependency, ownership, and risk evidence; codebase-memory for project index status and indexed text lookup; focused `rg` only for docs/tests and exact validation names.
- Repo/query used: jcodemunch `local/Codex-Orka-904e2bad`; codebase-memory `Users-Mace-Codex-Orka`.
- Files/symbols retrieved: `renderRuntime`, `main`, `main.tick`, `main.handlePointerDown`, `updateShadowDomMarker`, `ApplyDamageToTarget`, `ExecuteSkill`, `ProcessCurrentTurn`, `ProcessTurn`, and `rust/simulation_core/src/lib.rs` rule/export functions.
- Full-file reads avoided: yes for runtime hot files. Full reads were limited to AGENTS.md and governance planning docs needed for this planning bead.
