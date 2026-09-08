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
- Personal FLOW owns combat charge. Roguelite card acquisition and proc entrypoints are paused; stale draw fields must not block combat. Parked definitions do not authorize reactivation.
- Native wards, Cover, Reprisal, Rally and weakness are actor-owned combat effects; card-session records cannot activate them.
- Supergem behavior is separate from skill-card selection. Kojonn's Faze is not a green gem or green supergem trigger, and retired green supergem state must fail closed.
- Once a rule family is Rust-owned, route through the owner packet/shadow seam and apply the returned decision instead of recomputing the outcome.

## Work Guidance
- Start gameplay edits by locating the current function and its contract test. Add or update the contract before changing behavior when practical.
- Keep local helper names aligned with product docs and tests; avoid aliases like old placeholder skill names unless a compatibility test requires them.
- For progression changes, verify whether the owner is runtime session state, hero EXP persistence, Vault/relic progression, or token wallet.
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

- Energy is a macro balance: quest entry spends it, combat actions do not. Purple recovery remains active. Combat defeat depends on living heroes; Continue preserves energy.

- Initiative rosters and turn-start hooks exclude KO actors independently of pooled HP. Keep HP roster enumeration separate from acting/target eligibility while the remaining HP writers migrate.

- Hero entity HP/maxHP owns health. getDeployedHeroes retains KO identity and fixed display slots; getHeroes returns living targets. Rebuild health projections from the deployed roster, clearing stale arrays. Damage and Destiny ignore KO recipients; ApplyPartyDamage handles up to six actual members through its Rust owner.

- heroCommands.mjs commits native commands through the existing lunge and shared damage path. Validate the scheduled living actor, living target, enemy roster stability and presentation barrier before writing intent. A refused handoff keeps the draft unspent. Command slots preserve loaded display positions through KO; six is capacity.
- ApplyActiveHeroHeal replaces pooled healing: resolve the scheduled living hero, clamp healing to that actor, and reproject totals. DoHeal rejects non-active/KO actors and retains its turn-spending sequence. Percentage recovery uses the recipient maximum. Magic Fruit keeps party max-HP growth while healing only the active hero.
- heroCommands.mjs commits one ordered native sequence after full validation and spends personal charge only after the lunge accepts. FLOW overrides the queue; the normal presentation barrier advances once. Active-turn ownership remains with the scheduled actor through animation.

- Paid sequences reserve only their actual SP costs after accepted launch; FLOW specials empty FLOW and preserve SP. Neither resource is projected from the other.

- `heroCommands.mjs` reserves a legal sequence once, revalidates each action, refunds only unexecuted costs, and settles victory before progression. Ordinary counters never own a turn.

- Resolved skill events call orb generation/passive checks with shared per-action deduplication. rulesContext supplies separate FlowRandom and RuntimeRandom streams. Personal meter charge occurs at orb collection only.
