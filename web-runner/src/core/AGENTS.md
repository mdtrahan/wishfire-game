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

- Combat outcome ignores macro energy. Only living heroes determine defeat; energy is spent at quest entry and purple gems may restore it.

- Combat defeat uses the living deployed hero count. Pooled HP is diagnostic. Individual actor HP gates new turns, including when old pending-group markers remain; enemy-target packets support six slots.

- Party-damage packets support up to six actual members; match the root core and shipped Rust ABI, including zero-filled unused entries.

- personalFlow.mjs owns browser-shipped personal charge and current hero skill budgets, shared with both function registries. It has no DOM or timer access. FLOW event attribution occurs only at resolved gameplay seams.

- Combat SP and FLOW are independent actor balances: fresh encounters start full SP and zero FLOW; enemy defeat produces orbs only.

- `heroDefinitions.mjs` is the single kit/tuning source for combat and hero detail UI. `heroProgression.mjs` owns individual EXP, stat growth and unlock evaluation; KO remains zero HP during growth.
- `heroDefinitions.mjs` owns role-shaped HP directly. Do not add a global hero HP multiplier; it hides role balance and breaks CP calibration.
- `combatRules.mjs` resolves statuses, accuracy, Cover and reactions. Preserve action source ancestry, reject illegal actions before spending, and grant no routine periodic FLOW.

- Hero card single-enemy actions consume the current living battlefield selection on card tap, falling back to the first living enemy. Single-ally cards retain ally selection; self and group cards resolve immediately. Resolved hero-card healing reports only its actual HP delta to presentation, while barrier visuals project from the actor-owned barrier status.

- `actionSelection.mjs` owns action capacity and draft budgets independently of SP and CTB scheduling. High SP cannot increase the action count.

- FLOW charging is owned only by flowOrbs.mjs collection. Enemy KO produces a single configured reward; role triggers award nothing. Combat RNG and orb RNG remain separate. Session reset cancels pending flights.

- Role-earned AF replaces death-lottery rewards: qualifying resolved role actions queue one directed blue orb, and AF changes only when that orb reaches its living recipient. Enemy KO does not assign AF.

- equipment.mjs is the canonical placeholder catalog, slots, rarity balance and loadout math. astralMarket.mjs reconstructs only the live offer window using persisted seed/epoch and a monotonic time floor. Each offer ID may be acquired once; revalidate price, expiration and Gold at commit.
- Equipment stats are a derived projection used by levelStats, not a second inventory. Persist the projection with hero HP so loading HP above unequipped max does not truncate it before the authoritative equipment record reapplies.

- isEquipmentUpgrade requires compatible item types, no lower stat and at least one higher stat; stat tradeoffs are not automatic upgrades. Empty compatible slots qualify.
