# Web Runner DOX

## Purpose
- Own the browser-playable runtime: HTML shell, app orchestration, shipped assets, rendering/input systems, runtime modules, and browser-local core helpers.
- Keep browser integration separate from deterministic rule ownership.

## Ownership
- `app.js` is orchestration and composition wiring.
- `modules/` owns Construct-style runtime state and gameplay functions.
- `systems/` owns rendering, input, supergem runtime, persistence wrappers, dev tooling, and SimulationCore shadow wiring.
- `state/` owns small UI/layout state holders for browser presentation surfaces.
- `src/core/` owns browser-shipped ESM rule modules and runtime helpers.
- `assets/` owns runtime JSON, media, fonts, gems, and the shipped SimulationCore WASM artifact.

## Local Contracts
- Keep `app.js` thin. Add business logic to contextual modules or shared core files, then wire minimally through `app.js`.
- Before expanding `app.js`, read `governance/planning/app-js-thinning-playbook.md` and apply `governance/planning/js-orchestration-review-checklist.md`.
- JavaScript owns browser integration: Canvas rendering, input, menus, overlays, audio, save/load wrappers, deployment, and presentation timing.
- Rust SimulationCore owns deterministic simulation rule families that have owner markers and fixture contracts.
- Browser runtime code may apply returned state and render presentation events; it must not recompute Rust-owned outcomes.
- Do not store durable gameplay rules in render modules, asset JSON, or `app.js` when a module/core owner exists.

## Work Guidance
- Before editing, read the child AGENTS.md for the touched subfolder.
- Treat `app.js`, `modules/functionBank.js`, `systems/renderRuntime.js`, and `systems/simulationCoreShadow.js` as hot files.
- For gameplay behavior, start from `web-runner/modules/` plus shared `src/core/` or `web-runner/src/core/` rules.
- For visual behavior, start from `web-runner/systems/render*.js` and keep deterministic state changes outside render code.

## Verification
- Use focused `node --test tests/<relevant-contract>.test.js` first.
- For runtime/manual QA, start `npm run serve:qa` and use the Codex in-app Browser when a visual check is needed.
- For batch game automation, prefer the repo-owned `npm run balance-harness` path.

## Child DOX Index
- `web-runner/modules/AGENTS.md` - gameplay state, function registry, combat, skills, progression bridges.
- `web-runner/systems/AGENTS.md` - rendering, input, local persistence, supergem runtime, dev tooling, SimulationCore shadow.
- `web-runner/src/core/AGENTS.md` - browser-shipped deterministic rules and runtime helpers.
- `web-runner/assets/AGENTS.md` - runtime data, images, fonts, gems, and WASM artifact.
