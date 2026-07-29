# Web Runner Systems DOX

## Purpose
- Own browser runtime systems around rendering, input, local persistence, supergem runtime behavior, dev tooling, and SimulationCore shadow diagnostics.
- Keep presentation and browser integration out of deterministic rule ownership.

## Ownership
- `render*.js` files own Canvas/UI presentation for combat, HUD, map, overlays, and progression shells.
- `renderRuntime.js` owns a large partially purified runtime render path and remains high-risk.
- `inputHandling.js` owns browser pointer/map input helpers.
- `superGemRuntime.js` owns supergem board/effect runtime behavior.
- `heroGemProgressStorage.js` owns localStorage-backed hero gem progression persistence.
- `simulationCoreShadow.js` owns WASM loading, Rust owner markers, shadow checks, and mismatch diagnostics.
- `devToolingControls.js` and runtime debug helpers own QA/dev surfaces.

## Local Contracts
- Combat actor orientation must project canonical left-wise anchors through `src/core/combatOrientation.mjs`; mirror actor-attached x offsets, never combat rules or canonical positions. Right-wise actor sprite pixels mirror about each oriented pivot so both teams face inward and asymmetric art remains visually reflected.
- The dev-tool orientation control stages the next combat orientation and uses the existing fresh combat-refresh path when changed during combat; never flip a live combat frame in place.
- Right-wise rendering consumes the shared formation projection: both teams use the same `-40` logical-X translation after reflection, heroes keep canonical Y, and enemy-attached visuals share the one block-Y midpoint-alignment offset. The offset is fixed from structural enemy slot anchors for the combat layout; do not recenter from living entities after death or refill.
- Render modules may read state and draw presentation; they must not become owners of deterministic combat rules.
- `renderRuntime.js` should shrink over time. Do not add broad new gameplay branches there when a focused render module or gameplay module can own the change.
- `heroGemProgressStorage.js` may use `window.localStorage`; SimulationCore packets and Rust-owned code must not.
- `simulationCoreShadow.js` must expose stable owner markers for Rust-owned rule families and should surface mismatches as diagnostics, not silent fallbacks.
- Supergem runtime must preserve the product split between hero-specific supergem behavior and skill-card behavior.
- Input gates must respect `CanPickGems`, hero/enemy turn phase, pending skill draught, and presentation barriers.

## Work Guidance
- For visual changes, identify whether the owner is a narrow `render*.js` module before touching `renderRuntime.js`.
- For persistence changes, include save/load compatibility tests and confirm no deterministic packet now depends on browser storage.
- For SimulationCore ownership changes, update Rust exports, WASM build, shadow markers, JS packet routing, fixtures, and tests together.
- For supergem changes, check `governance/product/hero-supergem-bead-ledger.md` and the relevant supergem tests first.

## Verification
- Focused render/input/supergem/persistence tests for the touched surface.
- `node --test tests/finalRustOwnershipBoundaryContract.test.js` for SimulationCore boundary changes.
- `npm run rust:build-wasm` when Rust exports or WASM behavior changes.
- Browser QA through `npm run serve:qa` plus the Codex in-app Browser for visual runtime changes.

## Child DOX Index
- None.
