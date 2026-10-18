# Character identity rebuild: audit and proposed plan

Status: planning only, ORKA-90u. Runtime implementation requires a separately scoped execution decision. No runtime files, assets or player saves were changed for this audit.

## Owner requirements

The rebuild preserves what a player currently sees and owns. Current hero/enemy names, artwork, authored stats, skills, party composition, equipment, progression, currencies, HP/KO state and combat rules stay intact. Existing saves must survive. Future changes to names, art or tuning happen through deliberate content edits after the structural rebuild.

Character objects must be modular. Retired names and name-derived formats must disappear from active identity contracts. Adding characters or appearances must use the same model as the existing roster. The model must distinguish separately owned copies of one character if that product decision is made later. This plan adds no recruitment, gacha economy, duplicate-merging system, skin shop or new combat mechanics.

## Audit findings

Audit base: local main `97f77474e44cb1f869ec2ecd227cc397fe4aac75`. The separate ORKA-bhb candidate ends at `f506f2d255d8d47f9e4201ac57a1a249a0288c1d`; its CP and Hero-screen fixes remain unmerged. Choose the current game baseline again before implementation.

| Current seam | Verified problem | Proposed owner |
| --- | --- | --- |
| [heroDefinitions.mjs](../../web-runner/src/core/heroDefinitions.mjs) | Definition keys retain retired names; `heroKey` translates display names into identity. | Hero content registry with immutable IDs. |
| [heroProgression.mjs](../../web-runner/src/core/heroProgression.mjs) | `attachHeroProgress` creates saved records using combat instance keys. `saveHeroProgress` writes actor identity back into permanent storage. | Permanent owned-hero store; actors reference its records. |
| [heroScreenConfig.js](../../web-runner/state/heroScreenConfig.js), [devToolingRuntime.js](../../web-runner/systems/devToolingRuntime.js) | Combat roster has another set of base stats, names and roles; actor keys are derived from names and clone ordinals. | Content definitions plus explicit party/actor creation. |
| [equipmentStorage.mjs](../../web-runner/systems/equipmentStorage.mjs) | Gear projection bridges permanent and actor keys with a name/`#1` fallback. | Loadouts keyed only by owned hero ID. |
| [renderHeroScreen.js](../../web-runner/systems/renderHeroScreen.js) | Main enumerates all saved records as selectable heroes. ORKA-bhb fixes the observed duplicate screen, while broader owner duplication remains. | Owned roster selection; presentation never creates ownership. |
| [combatProgressionRules.mjs](../../web-runner/src/core/combatProgressionRules.mjs), [heroCommands.mjs](../../web-runner/modules/heroCommands.mjs) | Ticket wallets, objective targets, pending spends and battle participants carry instance/name-derived references. | Permanent targets use owned hero IDs; combat events resolve their source owner explicitly. |
| [heroArtAssets.mjs](../../web-runner/state/heroArtAssets.mjs), [runtimeVisualAssetLoader.js](../../web-runner/systems/runtimeVisualAssetLoader.js) | Portraits use display-name keys and aliases. Some asset filenames retain retired names. Enemy images are indexed by animation names. | Appearance definitions with explicit asset references. |
| [realtimeHeroSkills.mjs](../../web-runner/src/core/realtimeHeroSkills.mjs) | At least one live skill guard branches directly on a retired hero key. | Authored skill/effect IDs and capability checks. |
| [combatSessionInitializer.js](../../web-runner/systems/combatSessionInitializer.js), [continuousCombatStage.mjs](../../web-runner/src/core/continuousCombatStage.mjs) | Enemy catalog selection, encounter history and some attack delivery rules use enemy names. | Enemy definitions and explicit combat traits keyed by enemy ID. |
| [renderRuntime.js](../../web-runner/systems/renderRuntime.js), [functionBank.js](../../web-runner/modules/functionBank.js) | Enemy presentation/spawn paths still carry name-based lookup; the render shell also includes generated source. | Renderer consumes appearance data; spawn consumes definition IDs. Inspect supported generated consumers during cutover. |

The approved [hero ownership decision](wishfire-progression-adaptations/hero-owner-decision.md) already specifies one permanent owner and disposable combat copies. ORKA-5af.3 remains open. This proposal extends that repair to content identity and enemy/presentation boundaries; it does not claim that the repair has shipped. The source review establishes concrete coupling points, rather than a complete reference census or proof that every reported failure shares one cause.

## Proposed identity model

| Record | Stable key | Responsibility |
| --- | --- | --- |
| Hero definition | `characterId`, such as `character_0001` | Editable display name, class/role, authored base stats/growth, skill definitions and default appearance. IDs never derive from a name, path, roster position or stats. |
| Owned hero | `heroId`, such as `owned_0001`, referencing `characterId` | Player's permanent level/EXP, reward watermarks, selected appearance and loadout ownership. Another owned copy may reference the same definition without sharing gear or progression. |
| Combat actor | Battle-local `entityId`; heroes reference `heroId` | Temporary HP/effects, cooldowns, position and simulation state. Creating or discarding an actor cannot create, rename or delete a permanent hero. |
| Enemy definition | `enemyId`, such as `enemy_0001` | Editable name, stat profile, behavior/role, attack delivery, locale tags and default appearance. Each spawned enemy gets a distinct battle-local entity ID. |
| Appearance definition | `appearanceId`, such as `appearance_0001` | Explicit portrait, combat art, animation/rig references, crop, scale and anchors for its supported surfaces. |
| Equipment instance | Existing unique item ID | Owned by one loadout slot or one cache location. Ownership uses `heroId`; it never uses an actor or character name. |

Definitions describe a character. An owned hero records the player's individual copy. Combat actors reference that copy. This distinction is required for flexible ownership; it does not create additional playable copies during the rebuild.

Assign existing content its new IDs once using a reviewed manifest. Mint future owned hero IDs once when ownership is granted and persist them; use an existing native ID facility. Never regenerate ownership from a display label. Keep definition IDs unique and immutable, including after retirement; do not reuse an ID for a different character.

The owned roster and four deployed party slots are explicit saved references. Definitions may contain unowned characters. Hero navigation reads the owned roster; combat reads party slots. Adding a fifth definition must not silently acquire it, deploy it, hide another hero or depend on object enumeration order. Current ownership and party order remain unchanged.

## Module contracts

- Content definitions own authored values. Reuse the existing definition modules and existing asset loading seams; use one source for each value. Remove duplicate roster stat tables after their consumers move. Avoid a generic content engine or one subclass per character.
- The owned-hero/progression service owns permanent writes. Equipment transactions own item assignment. Combat projection reads those sources to build actors, and settlement resolves the explicit `heroId` with existing once-only receipts. Actors and renderers cannot mint saved heroes.
- Runtime selectors accept the appropriate ID type. Definition ID, owned hero ID and battle entity ID must never substitute for one another. Validate references at loading, save and settlement boundaries. Report unresolved identity without silently choosing a similarly named character or resetting a save.
- Skill eligibility uses authored skill/effect IDs or explicit traits. Names and art carry no mechanical authority. Replace identity-related name switches while preserving every current skill guard, cooldown and effect.
- Presentation resolves an appearance ID to its surface-specific assets. A skin selection changes appearance without replacing the owned hero. It preserves stats and gear under this rebuild. Asset filenames are implementation details and may be renamed or replaced without rewriting saves.
- Enemy encounters and history store enemy IDs; behaviors use explicit traits. Replacing a name or sprite must not change melee/ranged delivery, spawn eligibility, targeting, rewards or roster history. Stat tuning remains an intentional content change with balance proof.
- Shared deterministic rules keep their existing JS/Rust ownership. Browser code handles loading, UI and persistence. Keep `app.js` orchestration-only. Required supported JS mirrors and generated consumers must migrate in the same cutover; retired consumers receive no new compatibility layer.

## Save preservation and one-time conversion

Preserving current saves is settled owner intent. A reset is outside this plan.

Before conversion, checkpoint the complete related save set together: progression, equipment, combat progression/tickets, pending settlements, objectives, party references and saved encounter state. Record current item ownership and player-visible values. An isolated preflight conversion reports every old reference and its proposed new owner.

Follow the existing owner reconciliation decision: retain the greatest earned progression across accidental combat copies without summing duplicated EXP. Preserve reward watermarks and resources. Keep the menu's equipped item when a slot conflicts; return genuinely displaced items to the existing cache under unique ownership. Preserve current HP and KO. A true separately owned hero must retain its own owner; never merge records solely because their labels match. Any ambiguous record blocks that save's conversion with its original bytes intact.

Convert all cross-record references together, including ticket wallets, pending spends, objective/reward targets, battle participants, equipped item owners and encounter histories. Recompute derived stats from the same authored definitions and retained gear, then compare with the agreed current-game baseline. Do not carry contradictory cached base stats forward as another authority.

Existing persistence spans multiple keys, so sequential writes alone cannot make conversion atomic. The implementation must stage a complete versioned generation, validate it, and commit a single active-generation marker only after every component exists. All participating readers must follow that marker. A failed or interrupted conversion retains the complete old generation or resumes the complete new one exactly once. Check capacity before staging; keep a recoverable checkpoint. This is a cutover protocol, not an invented replacement storage framework.

Retired identifiers are permitted only in the bounded conversion input map while converting supported saves. They must not remain normal gameplay aliases. Once supported current saves are verified, remove that conversion path and legacy input map from the active deliverable. Keep original backups and recovery material outside ordinary runtime/search/index paths under the existing checkpoint policy. Define the supported save set before this gate; do not delete the converter while a supported save still needs it. Git history remains historical evidence.

If reconciliation would change anything the owner has asked to preserve, report the exact discrepancy before applying it. An inherited split between menu and combat stats cannot be resolved by silently choosing a new balance outcome.

## Execution sequence, proposed only

| Phase | Scope and owner | Exit evidence |
| --- | --- | --- |
| 0. Freeze baseline | One coordinator pins current main and any accepted ORKA-bhb changes; capture supported saves, screenshots, menu/deployed base stats, authored values and reference inventory. Coordinate with the existing Hero screen/art lanes. | Exact source/save hashes and explicit same-state comparison fixtures. No mixed historical branch restoration. |
| 1. Permanent identity and save ownership | Extend ORKA-5af.3 as the single owner of hero definitions, owned records, combat projection, settlement and the save conversion. Inventory every supported consumer before implementation. | Renaming a display field cannot change ownership; repeated combat cannot increase saved hero count. Divergent-save and interrupted-conversion tests pass. |
| 2. Enemies and encounter references | A separately scoped bead moves enemy catalog, encounters, history, delivery traits and runtime spawn references to immutable enemy IDs. Coordinate conversion of any persisted encounter fields with phase 1. | Same seeds produce the same enemy definitions, stats, positions and rewards. Duplicate or renamed enemy labels cannot change selection or delivery. |
| 3. Presentation indirection | A separately scoped bead moves portraits, combat sprites, animation/puppet references, UI icons and loader caches to appearance IDs. Populate the initial registry with the exact existing art and measured transforms. | Existing frames match. A test-only appearance substitution leaves permanent state and combat results unchanged. |
| 4. Remove retired identity contracts | After all dependent consumers and saves are proven, remove alias resolution, name-derived keys, duplicated tables and obsolete generated artifacts. Rename/repoint legacy asset paths while preserving their exact bytes. Refresh active docs and fixtures to use current names plus neutral IDs. | Final reference census finds no retired character identifiers in active code, data, test fixtures, filenames or current docs. Every reference resolves through the new registries. |
| 5. Integration and maintenance gates | Coordinator validates against current main with a rollback checkpoint, then follows the repo's QA and Integration Ready gates. | Baseline-relative results, actual player controls and source-matched screenshots. Main merge is a separate lifecycle step. |

Phases may be developed in reviewable slices, but the supported release must expose one identity contract. Do not ship a mixture of permanent alias tables and partly converted consumers. Stage unpublished changes in the bead lanes; cut over all dependent readers together. Record cross-bead dependencies before execution. No parallel agent work is requested by this plan.

## Required acceptance proof

- Current saves retain every equipped item and owner, exact progression/resources, party order, claimed receipts, HP/KO and existing cache state. Check JSON ownership and rendered controls. Derive menu and deployed base stats from the same owner and definitions; document inherited discrepancies before reconciliation.
- Repeated combat entry, exit, KO recovery, reload and temporary actor creation leave owned hero count and IDs unchanged. Existing reward/settlement idempotency remains intact.
- Auto/manual equip changes only the intended owner's matching slot and strictly increases CP. An equipped item never transfers between owners. Every remaining cached item is reassessed against the current loadouts, and useful items stay protected from dismantling.
- Rename every hero and enemy in an isolated fixture, including duplicate labels and punctuation. Progression, gear, tickets, objectives, enemy delivery, encounter membership and deterministic combat outcomes stay attached to the same IDs. Restore the original labels for player-facing verification.
- Add a test-only fifth hero definition and a second owned copy of an existing definition. They remain distinct; acquisition and party deployment require explicit saved references. No production character or gacha mechanic is added by these tests.
- Swap only an appearance in an isolated fixture and verify portraits/combat surfaces use it while permanent IDs, stats, CP and seeded combat outcomes remain unchanged. Test missing assets without inventing another character identity.
- Change an enemy stat profile in an isolated fixture: only the intended balance outputs change, with no loss of encounter/save references. The production rebuild retains the original stat profiles.
- Inject failure at every conversion write and before/after the active marker. Recover one complete generation, preserving receipts and preventing duplicate items, rewards or migration. Reject unresolved foreign IDs and corrupted records without destructive fallback.
- Validate duplicate IDs and missing definition/appearance/party/owner references at build/load boundaries. Add contract checks that ordinary selectors and persistence keys never derive identity from names or paths. Required mirrors must pass parity checks; inspect Rust/WASM fields before claiming that boundary needs no changes.
- Verify current natural viewport plus existing phone profiles in the in-app preview. Compare current hero/enemy artwork, names, equipment, CP and visible behavior to pinned baseline evidence. A successful build or static fixture alone cannot certify the rebuild.

## Stop conditions and limits

Pause the affected conversion for ambiguous ownership, unexplained state differences, missing supported consumers or failed interrupted-write recovery. Do not repair these by summing rewards, reallocating equipped items, rerolling gear, changing formulas or silently starting fresh. Coordinate existing lane ownership before touching their paths. Runtime implementation remains outside ORKA-90u.

This audit inspected the concrete seams linked above. It did not run the rebuild, convert saves, exhaustively inspect every asset/generated file, establish a full-suite baseline or certify Integration Ready. The implementation starts with the reference census and baseline proof in phase 0.
