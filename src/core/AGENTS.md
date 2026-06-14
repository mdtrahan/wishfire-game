# Source Core DOX

## Purpose
- Own deterministic JavaScript rules and core contracts used by tests, runtime mirrors, and SimulationCore migration seams.

## Ownership
- Combat formulas, turn gates, scheduler rules, targeting, status effects, RNG, packet normalization, GameState envelope rules, input domains, and layout state primitives.
- CommonJS entrypoints used by tests and compatibility surfaces.

## Local Contracts
- Keep rule modules deterministic and JSON-safe.
- Do not import DOM, Canvas, localStorage, audio, Netlify, or browser globals into deterministic modules.
- Team-phase rules are canonical: heroes open, phases alternate by team, speed sorts only inside the active team.
- SimulationCore packet shapes must exclude browser-owned presentation/storage state.
- If Rust owns a rule family, JS code should preserve packet/diagnostic compatibility and avoid acting as final authority.
- CJS mirrors such as `simulationCorePacket.cjs`, `gameStateEnvelopeRules.cjs`, and `combatRuntimeGateway.cjs` must stay aligned with their intended test/runtime consumers.

## Work Guidance
- Add fixture rows for deterministic behavior with meaningful edge cases.
- Use explicit owner-hook diagnostics when a rule can be resolved by Rust or JS.
- Keep normalization helpers boring and defensive; packet drift creates save/load and Rust/JS mismatch failures.
- For layout-state changes, check `src/layout/` descriptors and transition tests.

## Verification
- Focused `node --test tests/*OwnershipContract.test.js` or `tests/*FixtureContract.test.js`.
- `node --test tests/finalRustOwnershipBoundaryContract.test.js` for packet/boundary changes.
- `cargo test --manifest-path rust/simulation_core/Cargo.toml` and `npm run rust:build-wasm` when Rust-owned semantics or exports change.

## Child DOX Index
- None.
