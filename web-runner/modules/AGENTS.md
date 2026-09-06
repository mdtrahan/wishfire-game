# Web Runner Modules DOX

## Purpose
- Own Construct-style runtime gameplay modules for the browser runner.
- Keep combat, skills, state shape, enemy behavior, and progression bridges understandable without rediscovering `functionBank.js`.

## Ownership
- `state.js` owns the live `state.globals` and `state.entities` shape.
- `functionBank.js` owns high-risk gameplay functions: turns, damage, gem actions, skill draw, enemy behavior, status effects, progression bridges, and Rust-owner packet routing.
- `functionRegistry.js` owns context creation and function dispatch.
- `mainSheet.js` and `skillSheet.js` own smaller Construct-era behavior surfaces used by the registry.

## Local Contracts
- `state.globals` is the live runtime envelope. New fields need a clear owner, reset/init behavior, tests, and debug/proof visibility when user-facing.
- `Scripts/functionBank.js` mirrors selected high-risk functions. Do not drift mirrored functions without a test and explicit bead scope.
- Combat uses speed-based interleaved initiative for normal combat. Do not force strict `Heroes -> Enemies -> Heroes` team phases unless a future bead explicitly changes that product decision.
- Use `CanPickGems` through numeric readiness helpers such as `isCanPickGemsReady`; do not rely on strict boolean checks.
- Astral Flow fills the SkillDraught path. Skill cards must declare `one_off`, `tiered`, or `repeatable`, and one-off exposure/selection must suppress duplicates.
- Active party draw behavior is party-scoped. Do not couple party skills such as Crimson Ward to a hero supergem unless the product docs and tests explicitly say so.
- Supergem behavior is separate from skill-card selection. Kojonn's Faze is not a green gem or green supergem trigger, and retired green supergem state must fail closed.
- Once a rule family is Rust-owned, route through the owner packet/shadow seam and apply the returned decision instead of recomputing the outcome.

## Work Guidance
- Start gameplay edits by locating the current function and its contract test. Add or update the contract before changing behavior when practical.
- Keep local helper names aligned with product docs and tests; avoid aliases like old placeholder skill names unless a compatibility test requires them.
- For progression changes, verify whether the owner is runtime session state, hero gem persistence, skill points, Vault/relic progression, or token wallet.
- Keep debug/dev-panel controls mutating only the intended QA state; side-panel readouts should remain informational.

## Verification
- `node --test tests/functionBankParityContract.test.js`
- Focused contracts for touched systems, for example:
  - `tests/speedInitiativeSchedulerContract.test.js`
  - `tests/skillDraughtDevPanelContract.test.js`
  - `tests/heroSkillDefinitionRegistryContract.test.js`
  - `tests/finalRustOwnershipBoundaryContract.test.js`
- Run fixture/Rust shadow tests for migrated deterministic rule families.

## Child DOX Index
- None.

- QuestFiniteEncounter is set for authored quest combat and suppresses enemy replenishment at the existing death-removal and respawn seams. It must not alter damage, skills or initiative. Quest resurrection restores heroes while retaining skills, buffs and enemy progress.
