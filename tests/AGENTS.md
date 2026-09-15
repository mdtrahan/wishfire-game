# Tests DOX

## Purpose
- Own regression contracts, ownership-boundary proofs, fixture parity, and targeted runtime behavior tests.
- Make historically fragile behavior explicit and repeatable.

## Ownership
- `*.test.js` files use Node's built-in test runner for contracts and static/runtime checks.
- `*.spec.js` files cover browser-style flows where present.
- `offlineBundleContract.test.js` protects the portable file:// release shape, embedded startup payloads, relative assets, manifest hashes, and separation from the hosted release.
- `fixtures/` owns deterministic CSV cases shared by JS and Rust/WASM tests.

## Local Contracts
- Story-entry checks exercise the shared layout registry and transition controller: deny early navigation, preserve pagination, hand off at the authored marker or Skip, stop Auto in combat, and retain Town recovery. Browser QA must exercise the visible Canvas controls too.
- Quest-QA layout contracts cover fixed rail containment, the compact dock fallback, Canvas geometry preservation, diagnostics z-order, zero horizontal overflow, Combat-layout scenario setup, pause ownership, fresh telemetry reset, and isolated role-award readouts.
- Paused-combat navigation checks must preserve the active card and snapshot through Continue, intercept Quests from any suspended screen, and clear the snapshot only on Quit without settlement or rewards.
- Tests are often the clearest owner of regression-prone behavior. Read the relevant test before changing gameplay, rendering, persistence, or SimulationCore code.
- Prefer focused deterministic tests over broad suite runs during development.
- Static source assertions are allowed in this repo when they protect architecture boundaries, but avoid adding brittle source-shape checks when behavior can be tested directly.
- Full `npm test` may include unrelated legacy/static failures; report focused validation scope honestly.
- Do not weaken an ownership contract to make an implementation pass unless the product/architecture source changed too.

## Work Guidance
- Name new tests after the behavior or contract, not the implementation detail alone.
- For bug/regression beads, add the smallest test that fails for the old behavior and protects the intended owner.
- Update fixture tests and CSV data together.
- Keep helper extraction inside tests small; if helpers become shared, move them deliberately.

## Verification
- `node --test tests/<file>.test.js`
- `npm test` only when broad validation is needed and expected to be meaningful.
- Browser/Playwright checks only for behavior that cannot be covered deterministically.
- `tests/uiPresentationLockGateContract.test.js` protects the rendered gate command, viewport matrix, rejection mode, evidence inventory, and staged-path routing. The browser gate supplies the behavioral proof for those static seams.

## Child DOX Index
- `tests/fixtures/AGENTS.md` - deterministic CSV fixtures and JS/Rust parity data.

- Story entry proof covers map-only startup, town hit gating, first-page preservation, Skip, authored combat handoff, and Town recovery.

- Quest flow tests replace direct story-to-Town recovery expectations with ladder completion and Continue/Quit; gallery/map Back routes now return to the quest ladder.

- Health contracts verify actual actor HP, stable sparse/KO slot projections, cleared previous-group totals, and real JS-to-WASM damage for every loaded size from one through six.

- Native command proof covers scheduled actor ownership, rejected/stale targets, animation handoff and exact loaded slots. Legacy board click/refill assertions are retired with their consumers. The UI lock checks decorative hero status-card containment, fan-only player actions and real battlefield selector targeting for groups of one through six.
- Hero Turn Card Fan integration proof covers the shared lifecycle exports, persisted draw state, native command resolution, source-scoped taunt, one-shot interception, queue delay offsets, rewritten four-card effects, and reset/KO/battle-end clearing. Independent browser QA must exercise the full interruption matrix.
- Full-recovery proof exercises both the app Town wrapper and Continue with zero through six loaded heroes, sparse slots, KO, stale UI health and retained encounter resources.
- Self-heal checks must use differing actor and party maxima, actual groups 1–6, and KO/wrong-actor cases. Percentage recovery cannot grow with party size. Personal FLOW checks cover attributed earning, full-charge consumption, queue order and paused party-card boundaries.

- Personal FLOW replaces shared AF and pauses roguelite card acquisition/procs. Historical integration checks for those parked systems use explicit skip reasons; pure isolated math and active combat checks stay runnable. VM loaders that strip function-bank imports must supply the real personalFlow.mjs, heroCommands.mjs, and any shared targeting exports exercised by the loaded path. Production-party regressions must construct the configured canonical roster before testing UID and role attribution.

- Migration coverage uses `combatRulesMigration`, `heroProgressionMigration` and `personalFlowContract` for canonical effects, growth and sequence settlement. VM function-bank harnesses must inject the real core/module imports.

- Action capacity tests cover mixed 1/2/3 slots, affordability, removal and early commit. Browser proof exercises real target clicks and capacity auto-commit. Paused frame-based regeneration must not affect combat.

- flowOrbsContract covers enemy-death blue transfers, deterministic living recipients, the three-gem spawn/early/mid/pre-impact/arrival/post-arrival timeline, ground-bounce/collection timing, threshold signals, and dead-recipient safety. personalFlowContract covers immediate once-per-action role charge with no orb.
- Immediate AF multi-kill tests prove damage records before the owner FLOW reset, then route every newly defeated enemy through the shared KO transition. They cover one kill, multi-kill, nonlethal and already-dead targets, cleanup deduplication, and arrival-only AF.
- AF-choice scheduler coverage preserves an already-owned deferred handoff and forbids a second queue resume. Live browser proof must confirm Destiny healing cannot prevent each following hero from starting a native command.
- Quest-QA enemy HP setup tests cover every refusal state, exact living-enemy HP mutation, preserved enemy identity and placement, and the absence of damage, AF, gem, reward or animation side effects.

- Hero management browser proof covers overview disclosure, roster containment and separate canonical active/passive/FLOW categories.

- equipmentMarketContract covers elapsed-time reconstruction, live/expired/duplicate/insufficient purchases, atomic save failure, shared loadouts, gear-stat reloads and once-only victory Gold. Retired idle-collector tests were removed with their runtime.

- Run node --test tests/astralShopPresentation.test.mjs with localhost:8047 serving the owned checkout to check the shop shader, reduced motion, shared balances, Back navigation and compact/reference containment in isolated contexts.

- Shop presentation test covers touch and mouse drop purchases without confirmation, exact wallet deduction, canonical inventory and green upgrade badges. Equipment contract tests cover equal, stronger, incompatible and tradeoff comparisons.
