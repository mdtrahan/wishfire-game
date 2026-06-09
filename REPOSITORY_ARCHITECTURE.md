# Repository Architecture

## Retrieval Receipt
- Tool used first: `jcodemunch-mcp`.
- Repo/query used: `local/Codex-Orka-904e2bad`; `get_repo_health`, `get_symbol_importance`, `get_signal_chains`, and `get_dependency_graph`.
- Files/symbols retrieved: repository health and hotspots; import importance for `web-runner`, `src`, `Scripts`, and `tools`; dependency graphs for `web-runner/app.js`, `web-runner/systems/renderRuntime.js`, `web-runner/modules/functionBank.js`, `src/core/index.js`, and `src/core/combatRuntimeGateway.js`.
- Full-file reads were avoided for first orientation, then focused reads were used for architecture docs, product docs, tests, and representative source files.
- `get_signal_chains` found no conventional HTTP/CLI/task gateways, which fits this browser-game repo.

## Architecture Map

Codex-Orka is a browser-game repository with three runtime layers:

1. Browser shell and presentation in `web-runner/`.
2. Shared deterministic JS contracts in `src/`.
3. Rust deterministic SimulationCore in `rust/simulation_core/`, shipped to the browser as `web-runner/assets/simulation_core.wasm`.

Supporting surfaces:
- `Scripts/` keeps mirrored Construct-style runtime code for parity and compatibility.
- `tests/` encodes regression contracts, ownership boundaries, and Rust/JS fixture parity.
- `tools/` runs local QA, browser harnesses, Rust WASM builds, and Beads/Git support tasks.
- `governance/` stores product truth, planning contracts, audits, and Beads review material.

## Core Systems
- `src/core/` owns reusable deterministic rules, packet shapes, layout/input controllers, and CJS exports.
- `web-runner/src/core/` carries browser-shipped ESM rule modules and runtime-only helpers.
- `rust/simulation_core/` owns deterministic simulation shadows for rule families that have been migrated or packetized.
- `web-runner/systems/simulationCoreShadow.js` bridges browser JS to Rust/WASM owner markers and mismatch diagnostics.

## Runtime And Gameplay Systems
- `web-runner/app.js` is the browser runtime orchestrator and import hub. It should stay thin and delegate to contextual modules.
- `web-runner/modules/state.js` is the live global state shape for combat, resources, skill draw, progression counters, party HP, turn arrays, UI flags, and transient state.
- `web-runner/modules/functionBank.js` owns high-risk gameplay functions: turn processing, damage, gem actions, skill draw, enemy behavior, status effects, progression bridges, and Rust-owner packet routing.
- `Scripts/functionBank.js` mirrors selected high-risk function-bank behavior; `tests/functionBankParityContract.test.js` protects parity.

## Combat Systems
- Combat uses strict team phases: heroes open, then phases alternate `Heroes -> Enemies -> Heroes -> Enemies`.
- Speed can sort actors only within the active team phase.
- Normal combat should not reintroduce enemy-first initiative, ambush opening, or woven global speed queues.
- Canonical turn-state source docs: `governance/planning/turn-state-invariants.md`.
- Runtime owners include `web-runner/modules/functionBank.js`, `src/core/schedulerRules.mjs`, `web-runner/src/core/schedulerRules.mjs`, and related SimulationCore shadow exports.

## Progression Systems
- Visible resources and progression counters include Energy, Gold, Astral Flow Wallet, Hero Gem Usage, Hero Gem Milestones, Hero Skill Points, Token Wallet, and LiveOps progress.
- Hero gem usage is real progression input, not temporary combat telemetry.
- Vault, Relics, Pets, Mounts, Artifacts, Tomes, Homestead, and related shells exist but many child systems remain scaffolded.
- Vault/relic passives are not live draw skill cards; they belong to long-horizon progression.

## Skill And Supergem Systems
- Astral Flow and SkillDraught govern session skill-card selection.
- Skill-card definitions must declare `one_off`, `tiered`, or `repeatable`.
- Active party draw behavior currently includes party skill definitions such as `party_crimson_ward`, `party_magic_fruit`, `party_destiny`, and `party_faze`.
- Supergems are separate from skill-card selection. Do not infer a skill trigger from a supergem path without product and test evidence.
- Kojonn's Faze is a skill path, not a green gem or green supergem trigger.
- Green supergem behavior is retired/fails closed.
- Falie/Huun hero-specific supergem behaviors are tracked in `governance/product/hero-supergem-bead-ledger.md`.

## Save And Persistence Systems
- JavaScript owns browser save/load wrappers.
- `web-runner/systems/heroGemProgressStorage.js` owns localStorage-backed hero gem progression persistence.
- SimulationCore packets and Rust-owned deterministic logic must exclude browser storage APIs.
- Save/load compatibility is tested through boundary contracts such as `tests/finalRustOwnershipBoundaryContract.test.js`.

## UI And Layout Systems
- `src/core/layoutState.js` owns layout registration, allowed transitions, transition queuing, input-domain locks, suspend/resume snapshots, and atomic transition guards.
- `src/layout/` owns reusable layout descriptors and core layout registration.
- `web-runner/systems/render*.js` owns Canvas presentation and UI drawing.
- `web-runner/assets/layouts.json` is runtime layout data derived from the retired Construct surface; treat it as structured data, not a place for gameplay rules.

## Data Ownership
- Runtime mutable state: `web-runner/modules/state.js`.
- Static/enemy/object/layout data: `web-runner/assets/*.json`.
- Image/font/gem assets: `web-runner/assets/`.
- Golden fixtures: `tests/fixtures/*.csv`.
- Product truth: `governance/product/`.
- Planning and architecture contracts: `governance/planning/`.
- Rust deterministic source: `rust/simulation_core/src/lib.rs`.
- Shipped WASM artifact: `web-runner/assets/simulation_core.wasm`.

## Tooling
- `npm test` runs Node's built-in test runner across contracts.
- `npm run serve:qa` serves the web runner and writes `web-runner/runtime-fingerprint.js`.
- `npm run rust:build-wasm` builds the SimulationCore WASM artifact.
- `npm run balance-harness` is the canonical batch game automation path.
- Playwright doctor/launch-matrix/CDP tools are support tools, not replacement pipelines.
- Hot-file commit prep lives in `tools/prepare_hot_file_commit.sh` and related helpers.

## Documentation Areas
- `governance/product/` stores player-facing and design-facing gameplay truth.
- `governance/planning/` stores architecture contracts, workflow plans, and invariants.
- `governance/audit/` stores historical audits and regression history.
- `governance/bead-reviews/` stores Beads review packets.
- `docs/` is mostly reference/archive support and is root-owned in the DOX hierarchy until a durable sub-boundary emerges.

## High-Risk And Historically Complex Systems
- `web-runner/app.js`: large import/orchestration hub; app growth is architectural debt.
- `web-runner/systems/renderRuntime.js`: large partially purified mixed render/runtime module.
- `web-runner/modules/functionBank.js` and `Scripts/functionBank.js`: high-risk parity mirror.
- Turn sequencing and turn gates: repeated regressions around `CanPickGems`, `TurnPhase`, deferred advances, and team-phase ownership.
- Rust/JS SimulationCore ownership: JS must not recompute Rust-owned deterministic outcomes.
- SkillDraught/Astral Flow: pending/open state, one-off exposure, and dev panel readout are regression-prone.
- Supergem behavior: hero-specific supergem paths must not bleed into skill-card behavior.
- Save/persistence: localStorage wrappers must stay outside deterministic packets.
- Layout transitions: combat suspend/resume and atomic transition queues protect turn state.
- Browser QA: sandboxed browser launch can fail independently of game behavior; use the repo-supported CDP/harness path when needed.

## DOX Boundaries Chosen
- Root: repo-wide workflow, Beads, validation, retrieval, and child index.
- `Scripts/`: mirrored runtime parity.
- `web-runner/`: browser runtime shell and shipped assets.
- `web-runner/modules/`: gameplay state and combat/skill function surface.
- `web-runner/systems/`: rendering, input, persistence, dev tooling, supergem runtime, and SimulationCore shadow.
- `web-runner/src/core/`: browser-shipped rules and runtime core helpers.
- `web-runner/assets/`: structured runtime data, media, and generated WASM.
- `src/`: shared JS rules and layout contracts.
- `src/core/`: deterministic rules, packet contracts, layout/input primitives.
- `src/layout/`: layout descriptors and registration.
- `rust/`: SimulationCore source and WASM export boundary.
- `tests/`: contracts and regression proof.
- `tests/fixtures/`: shared deterministic CSV fixtures.
- `tools/`: automation and QA/build helpers.
- `governance/`: product/planning/audit docs.
- `governance/product/`: gameplay and player-facing truth.
- `governance/planning/`: process, architecture, and invariant contracts.
