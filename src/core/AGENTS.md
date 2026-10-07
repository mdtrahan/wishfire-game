# Source Core DOX

## Purpose
- Own deterministic JavaScript rules and core contracts used by tests, runtime mirrors, and SimulationCore migration seams.

## Ownership
- Combat formulas, turn gates, scheduler rules, targeting, status effects, RNG, packet normalization, GameState envelope rules, input domains, and layout state primitives.
- CommonJS entrypoints used by tests and compatibility surfaces.
- Session level-up owns visible XP settlement only. Retired combat-card catalogs and offer queues have no production owner.

## Local Contracts
- Keep rule modules deterministic and JSON-safe.
- Do not import DOM, Canvas, localStorage, audio, Netlify, or browser globals into deterministic modules.
- Speed-based interleaved initiative is canonical for normal combat; team-phase helpers are compatibility/shadow surfaces unless a bead explicitly changes the product decision.
- SimulationCore packet shapes must exclude browser-owned presentation/storage state.
- If Rust owns a rule family, JS code should preserve packet/diagnostic compatibility and avoid acting as final authority.
- Damage packets carry attack percentage plus matching and general resistance percentages. The shared base rule subtracts applicable defense, permits zero damage, applies resistance, then preserves crit and final modifier order; keep the browser copy and Rust/WASM export in parity.
- `heroAttackTargetingRules.mjs` owns the continuous party's persistent first-living focus inside the current X attack range and the legacy random HERO_SINGLE fallback. Manual target ownership remains in functionBank.
- CJS mirrors such as `simulationCorePacket.cjs`, `gameStateEnvelopeRules.cjs`, and `combatRuntimeGateway.cjs` must stay aligned with their intended test/runtime consumers.
- `combatOrientation.mjs` owns presentation-only left/right normalization, static formation projection, and wide-world camera projection. Right-wise static formation geometry reflects then translates both formations `-40` logical X; the wide-world camera reflects without that offset so the hero's 40-unit world-edge margin remains visible. Heroes keep Y while enemies receive one derived block-Y offset aligning team formation midpoints. Derive that enemy offset from the fixed slot grid, never the currently living roster, so death and refill cannot move survivors. Do not put orientation in SimulationCore packets or mutate canonical actor coordinates.
- `deriveCombatFormationAnchors` reserves an 18-unit hero buff-icon row plus a 2-unit gap above HP bars. The four-slot hero sprite band spans Y 190-395, and continuous enemy lanes follow those hero anchors.

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

- Normal-turn eligibility uses the individual actor HP; pooled HP and pending-group markers never grant a KO actor a new action. Enemy-target owner packets support six formation slots.

- Party-damage packets carry six HP entries and the actual loaded member count. Empty capacity contributes no damage recipient or health.

- Presentation barriers ignore retired combat-card flags. Animation, pending-hit and refill barriers remain enforced.

- Conditional combat predicates and modifier limits are shared pure rules. HP thresholds are fractions; comparison groups use current projected stats. Repeated stat changes resolve the strongest increase and strongest decrease against a clean baseline. Seeded RNG previews never consume a draw.
