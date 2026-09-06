# Web Runner Core DOX

## Purpose
- Own browser-shipped ESM rule modules and runtime helpers used directly by `web-runner/app.js`, modules, and systems.
- Keep deterministic browser rules aligned with shared `src/core/` and Rust SimulationCore ownership where applicable.

## Ownership
- Turn gates, scheduler, gem action, combat outcome, status, targeting, RNG, and packet helper modules used by the browser runtime.
- Runtime-only helpers such as animation/math helpers that must ship with the browser bundle.
- Browser-specific copies of shared rule modules when the runtime cannot import the root `src/core/` file directly.

## Local Contracts
- Narrative content owns localized dialogue, camera-shot references, and the opening combat handoff marker. `narrativeRuntime.mjs` owns deterministic scene progression; browser timing, input, and combat routing stay in systems. Preserve dialogue after the handoff until an authored combat-completion route is integrated.
- Most rule modules should be pure and deterministic: no DOM, Canvas, localStorage, network, or deployment behavior.
- If a matching module exists in root `src/core/`, keep behavior mirrored or document/test the intentional divergence.
- Rust-owned rule families should preserve owner-hook packet shapes and diagnostics.
- Presentation helper modules may touch Canvas-like drawing inputs, but must not own gameplay state transitions.
- DOM presentation helpers accept viewport-projected sizes from their caller; they must not invent fixed CSS sizes that bypass the Canvas layout scale.
- DOM child canvases keep CSS dimensions in logical pixels and multiply backing-store dimensions by `devicePixelRatio` before drawing.
- New deterministic rule changes need focused contract tests and, when applicable, fixture rows.

## Work Guidance
- Prefer extracting deterministic decisions here or in root `src/core/` instead of adding branches to `app.js` or render modules.
- When duplicating between root `src/core/` and `web-runner/src/core/`, update both copies and their tests in the same bead unless explicitly scoped otherwise.
- Keep packet helpers JSON-safe and free of browser-only state.

## Verification
- Focused `node --test tests/*Contract.test.js` for the touched rule.
- Fixture tests in `tests/*FixtureContract.test.js` when CSV fixtures exist.
- Rust/WASM shadow tests when owner hooks or migrated rule families change.

## Child DOX Index
- None.

- Combat outcome ignores macro energy. Only party HP and living heroes determine defeat; energy is spent at quest entry and purple gems may restore it.
