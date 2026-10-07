# Web Runner Modules DOX

## Purpose
- Own Construct-style runtime gameplay modules for the browser runner.
- Keep combat, skills, state shape, enemy behavior, and progression bridges understandable without rediscovering `functionBank.js`.

## Ownership
- `state.js` owns the live `state.globals` and `state.entities` shape.
- `functionBank.js` owns high-risk gameplay functions: turns, damage, gem actions, enemy behavior, status effects, progression bridges, and Rust-owner packet routing. Retired combat-card draw and offer entrypoints are absent.
- `functionRegistry.js` owns context creation and function dispatch.
- `mainSheet.js` and `skillSheet.js` own smaller Construct-era behavior surfaces used by the registry.
- `sessionLevelUpSettlementPresentation.mjs` owns the visible XP settlement presentation. It has no offer or card-selection path.

## Local Contracts
- `state.globals` is the live runtime envelope. New fields need a clear owner, reset/init behavior, tests, and debug/proof visibility when user-facing.
- `Scripts/functionBank.js` mirrors selected high-risk functions. Do not drift mirrored functions without a test and explicit bead scope.
- `CalculateDamage` uses each hero's primary ATK or MAG regardless of attack delivery, enemy offense by delivery type, and target DEF or RES by delivery type. Forward skill percentage and target resistance fields through both Rust owner and single-hit shadow packets.
- Combat uses speed-based interleaved initiative for normal combat. Do not force strict `Heroes -> Enemies -> Heroes` team phases unless a future bead explicitly changes that product decision.
- A completed native hero action owns its deferred scheduler handoff through `ProcessTurn`. If presentation release exposes another living hero first, reconcile from `ActionOwnerUID` before advancing; retain enemy-roster holds and terminal settlement guards. If the resulting scheduler UID has no live entity, advance before native turn setup.
- A late enemy-death removal must retain or create that deferred handoff; clearing the defeated actor after FLOW delivery cannot leave `IsPlayerBusy` without `DeferAdvance`.
- Use `CanPickGems` through numeric readiness helpers such as `isCanPickGemsReady`; do not rely on strict boolean checks.
- Continuous production uses deterministic readiness and cooldowns. Combat-card acquisition, offers, and proc entrypoints are retired; stale data must not block combat.
- Continuous hero basics schedule independently from each SPD-derived cooldown. Opening readiness starts on first in-range acquisition with the existing UID phase; staged starts wait for their scheduled time, and fresh-session reset clears pending basic clocks so reused actor UIDs do not inherit old actions.
- Continuous enemy actions use independent UID clocks and action states. They share the legacy action-state builder, while `StartEnemyAction` and `ProcessTurn` remain the story/QA path; continuous actions do not use the global `ActionInProgress` lane. Revalidate target at impact and leave readiness available when no eligible target remains.
- Ordinary continuous `HeroAttackSingle` packets keep launch-computed `finalDmg`, then resolve through `heroCommands` and `combatRules` at impact. The resolver preserves on-hit hooks, counter/KO effects, and committed projectiles after source KO; Split, Incinerate, Chain Strike, and Arcane Pulse keep their existing effect-specific queues.
- Continuous hero basics share one in-range enemy focus UID until that enemy dies, then choose the first living in-range enemy in encounter order. Engaged enemies acquire only heroes inside the combat group; area-skill target sets remain effect-owned.
- Native wards, Cover, Reprisal, Rally and weakness are actor-owned combat effects; card-session records cannot activate them.
- HERO_SINGLE keeps a valid owner-matched manual enemy selection; its automatic fallback delegates to the shared role-targeting rule.
- Supergem behavior is limited to native board actions. Retired card selection and offer state must fail closed.
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
- `ActionOwnerUID` and `ActionLockUntil` are the single presentation handoff boundary. Every resolved heal, hit, bloom, or special effect must extend the current action through its final visible frame before `ProcessTurn` can claim another action. A cross-actor heal preserves that action owner; a heal emitted after a hero command claim delays that hero's motion and queued hits until the bloom releases.
- Defeated enemies remain renderable through the complete attack package, including every Chain Strike target, impact and damage float. Their FLOW gem delivery follows that package and must finish before removal or another actor action. A lethal native command creates the held death state in the same resolution step that reaches zero HP. Starting gem delivery preserves that state so the sprite cannot leave and re-enter the scene.
- The queryless `ContinuousCombatStageLoop` advances only after the shared presentation barrier and enemy-death holds clear. Enemy FLOW delivery and removal therefore remain inside the completed action package.
- Streamed enemies become hero-targetable after entering the compact arena. Heroes and enemies travel through bounded foot coordinates until their own delivery reach is met. The simulation publishes `footX`, `footY`, `facing`, `locomotion`, `actionState`, `actionStateStartedAt`, `actionImpactAt`, and `actionStateUntil`; clip keys are `idle`, `walk`, `basic`, `cast`, `hurt`, `ko`, and `spawn`. Playback prioritizes an active action over locomotion and samples simulation time only. Basic impact remains at 520ms with a 200ms recovery window; instant skill casts begin at their release marker. Sprite clips cannot grant damage or readiness. Their transient slot indices support identity and death cleanup only.
- Continuous combat ignores the retired slot-refill stability gate when scheduling enemy actions; streamed slot indices are not fixed encounter homes. Streamed enemy delivery owns its cooldown band, and targeting uses living actors only after spatial contact. A stale hero scheduler claim must yield to an eligible engaged enemy.
- `reconcileSessionFlowThresholds` no longer opens combat offers. Production stage flow is owned by deterministic readiness and cooldowns; narrative and quest rewards remain separate.

- Paid sequences reserve only their actual SP costs after accepted launch; FLOW specials empty FLOW and preserve SP. Neither resource is projected from the other.

- `heroCommands.mjs` reserves a legal sequence once, revalidates each action, refunds only unexecuted costs, and settles victory before progression. Ordinary counters never own a turn.
- Native hero actions remain session and turn serial scoped. Automatic production actions resolve through readiness and cooldowns, then hand off to the shared lunge, targeting, damage, and healing seams. Narrative quest cards remain owned by `storyEntryFlow`, outside the combat action path.

- Enemy KO uses one per-enemy reward ledger shared by direct damage and role-rule callbacks. The active battle binds an immediate HeroProgress flush at that shared seam; reload recovery settles any durable pending ledger before a fresh session reuses enemy UIDs.

- Victory and non-continuous defeat settle each earned enemy EXP and Gold reward once. Gold settlement receipts remain in HeroProgress until equipmentStorage confirms the wallet commit; continuous defeat pays the pending ledger during retry recovery.
- In continuous production combat, party KO settles earned kills, clears transient combat state, disarms boss progression, fully heals the party, and restarts Wave 1 of the current stage without a resource cost or defeat menu. Other modes retain the native defeat terminal path.
- Resolved healing emits one `DamageTexts` heal record with the actual positive HP delta; the app-owned bloom follows that record. Crimson Ward consumes its shared ward before every hostile hero HP change. Dawn Chorus checks its owned seeded session roll once at full-party defeat and restores the party only on success.
- Arcane Pulse visual packets source from the casting hero's rendered resting sprite base. They never average the party formation or inherit lunge displacement.
- Transient Astral Flow attack visuals begin after the owning action claims the presentation lane and remain visible through delivery.
- Turn-start Destiny healing runs only after the scheduled hero has claimed its native command. Its bloom and combat text must not activate the presentation barrier before that same command starts.
- `ApplyActiveHeroHeal` and `DoHeal` use `emitResolvedHealEvent` through their mirrored skill-sheet helper. The local fallback only supports stripped-import contract harnesses; shipped runtime never bypasses the shared emitter.
- Hero damage packets declare only their attack VFX kind. Magic basic attackers keep their resting position while the presentation system carries the projectile to the target; both function-bank mirrors must remain identical.
- Native basic command resolution writes the actual dealt damage onto its presentation packet so impact tiers compare against target max HP without estimating combat math.
- Chain Strike and hero AOE damage packets carry the attacking hero's VFX kind on every target packet so each resolved target receives its own contact splash.
- `HeroTurn` must draw a fresh living-enemy target for each automatic hero action. `SelectedEnemyUID` records that actor's choice for presentation and follow-up effects; it must not become the next hero's targeting input.

- Lamp progression: manual/Auto draws grant all four heroes saved EXP, with cumulative receipts and per-hero lampEXPClaimed replay. Enemy rewards grant zero new EXP/Gold. Auto requires all four Lv5, switches off at capacity, and requires explicit restart. Dismantling essence buys 20/30/40/50 capacity tiers; the combat-only strip carries item levels and a collection bubble above Auto.

- Realtime hero skill scheduling filters the canonical unlock level before reserving a cooldown; shared cast validation rechecks it at impact, including reactive skills. Level presets clear stale scheduled actions and effects.

- Conditional skills execute through the live realtime scheduler and UID damage/heal adapters. Scheduled commits revalidate targets; cancelled casts refund readiness. Deployed KO heroes remain visible to Sanctuary and retain cooldowns; only living heroes take actions. Retaliation and Chain evaluate immediate damage/basic events once, without recursive skill triggers.
