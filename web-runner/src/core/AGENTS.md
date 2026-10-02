# Web Runner Core DOX

## Purpose
- Own browser-shipped ESM rule modules and runtime helpers used directly by `web-runner/app.js`, modules, and systems.
- Keep deterministic browser rules aligned with shared `src/core/` and Rust SimulationCore ownership where applicable.

## Ownership
- Turn gates, scheduler, gem action, combat outcome, status, targeting, RNG, and packet helper modules used by the browser runtime.
- Runtime-only helpers such as animation/math helpers that must ship with the browser bundle.
- Browser-specific copies of shared rule modules when the runtime cannot import the root `src/core/` file directly.

## Local Contracts
- `lampGear.mjs` owns seeded Hat/Body/Boots generation and pure collection transactions. Every generated piece has ATK/DEF/MAG/RES/HP, never SPD; highest generation tier persists across retries. Do not add loadout reassignment.
- Narrative content owns localized dialogue, camera-shot references, and the opening combat handoff marker. `narrativeRuntime.mjs` owns deterministic scene progression; browser timing, input, and combat routing stay in systems. Preserve dialogue after the handoff until an authored combat-completion route is integrated.
- Most rule modules should be pure and deterministic: no DOM, Canvas, localStorage, network, or deployment behavior.
- If a matching module exists in root `src/core/`, keep behavior mirrored or document/test the intentional divergence.
- Rust-owned rule families should preserve owner-hook packet shapes and diagnostics.
- Hero `MAG` is the internal MATK stat. Listed skill potency enters base damage as a percentage before resistance and crit; tier durability tuning must leave early packs farmable and elite/boss gates longer lived.
- Presentation helper modules may touch Canvas-like drawing inputs, but must not own gameplay state transitions.
- DOM presentation helpers accept viewport-projected sizes from their caller; they must not invent fixed CSS sizes that bypass the Canvas layout scale.
- DOM child canvases keep CSS dimensions in logical pixels and multiply backing-store dimensions by `devicePixelRatio` before drawing.
- Damage-number palettes preserve semantic kinds; Blight `dot` text uses the shared purple affliction palette in both DOM and Canvas paths.
- Damage floats keep their spawn X and rise vertically, popping from 40% to full size at the top of a short rise, then holding and fading quickly in both DOM and Canvas paths.
- New deterministic rule changes need focused contract tests and, when applicable, fixture rows.
- `continuousCombatStage.mjs` owns the queryless production stage sequence, one off-stage X emitter, four hero-aligned enemy Y homes, and the independent hero-basic timer tick. Each region has ten stages; every stage loops four normal waves until its boss is armed and cleared. Low, mixed, and high CP pools emit five, four, and three enemies three seconds after the current pack reaches hero attack range; survivors can keep fighting during the next pack's walk. The fifth enemy uses a separate X home when its Y lane repeats. Clear-field transitions wait for active attack presentation to finish.
- Ordinary continuous wave loops preserve every hero's HP and KO state. A boss clear restores every hero to full HP, revives KO heroes and clears harmful statuses while retaining buffs before the next stage. Defeat recovery also restores the party before restarting wave one of the current stage.
- `maybeAdvanceContinuousCombatStage` must be inert while dev tooling, QA scenarios, or QA fixture holds are paused; the app also freezes it for story pause, background, and defeat presentation.
- Continuous enemy attack intervals use the existing 1.6–5 second band: melee takes 1.6 seconds, ranged takes 5 seconds, and an explicit boss attack-pattern interval wins. Approach travel does not alter attack cooldown.
- Approaching enemies become hero-targetable at the shared arena attack line while continuing to walk, and join the enemy action scheduler only after reaching their melee or ranged home X. Enemy sprites draw from larger Y to smaller Y so the lower numeric Y appears in front.
- Hero basics use each hero's effective SPD and a community-estimated main-character curve to derive independent clocks. The four heroes are the attack sources; no hidden Pal assignments contribute attacks. Fire at most one basic per hero per tick while preserving each hero's due-time cadence. Continuous enemies use independent per-UID action clocks and may overlap one another and pending hero projectiles; each enemy starts at most one action per tick.
- Continuous production initializes the shared hero focus to zero; runtime basics retain its UID until death and clear it when no living target remains.
- Marid, Djinn and Chimerilass use ranged homes. Every other enemy uses melee homes.
- Armed bosses enter from off-stage and hold the combat-grid home at X 290, Y 290 before joining the enemy action scheduler.
- Engaged enemy cooldowns keep ticking while hero basic projectiles are pending; their actions do not wait for the old presentation barrier. Captured hero targets are revalidated at impact, with stable encounter-order fallback after existing Provoke/Cover rules; no eligible target leaves the enemy ready.
- The continuous enemy scheduler may tick while stale `IsPlayerBusy` or `DeferAdvance` flags remain; `ActionInProgress` still protects the active action lane.
- When a target enters range after an empty lane, each hero waits for its own cooldown plus a deterministic stagger within 1.5 seconds before its first attack. Engaged enemies are ready on arrival and retain start-to-start cooldown cadence independently of animation length.
- Continuous enemy actions use per-enemy clocks. Real-time skills and their effects use simulation seconds; pause and background state freeze those clocks.

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

- `heroDefinitions.mjs` is the single source for the four five-active-skill kits and basic attacks. Skills are available from the start; `heroProgression.mjs` owns individual EXP and stat growth. KO remains zero HP during growth.
- `heroDefinitions.mjs` owns role-shaped HP directly. Do not add a global hero HP multiplier; it hides role balance and breaks CP calibration.
- Realtime hero skills resolve target geometry against enemy centers inside the shared attack line. Direct hits, area effects, marks, splashes, and Burn Sigil ticks exclude enemies beyond that line. Null Field marks current occupants once; Burn Sigil ticks at each simulation second through expiry. A committed basic projectile may resolve after its hero is KO when the impact supplies `allowSourceKO`, provided its target is still in range.
- Party-wide support skills enqueue one impact visual per affected ally and leave hero point resolution to the shared renderer anchor; no missing selection point may become a canvas-origin impact.
- `routineEnemyScaling.mjs` preserves each enemy row's authored combat stats and applies only the level curve. Tier profiles are fallbacks for missing values, not replacements that make ordinary enemies disposable.

- Narrative quest cards remain outside the combat core. Resolved healing reports only its actual HP delta to presentation.

- Production uses independent hero basics, active skill cooldowns, and enemy action clocks.
- Queryless production emits staggered fodder packs from off-stage on a shallow stage-owned linear CP ramp. Hero level does not scale enemies. The next cadence starts when a pack reaches its engagement boundary; survivors may overlap later packs, while bosses wait for a clear field.
- Combat presentation consumes simulation events; it does not grant actor readiness or advance the combat clock.
- A fresh session enters with the restored party and deterministic actor cooldown state. Defeat recovery remains owned by the encounter session.

- equipment.mjs owns supported slots, rarity presentation and loadout math. lampGear.mjs owns deterministic rolls, cache capacity, essence upgrades and EXP receipts; the equipment shop is retired.
- Equipment stats are a derived projection used by levelStats, not a second inventory. Persist the projection with hero HP so loading HP above unequipped max does not truncate it before the authoritative equipment record reapplies.

- isEquipmentUpgrade requires compatible item types, no lower stat and at least one higher stat; stat tradeoffs are not automatic upgrades. Empty compatible slots qualify.

- Auto Equip filters and ranks recipients by strictly positive matching-slot total hero CP gain. Scan eligible items in displayed item-CP order without truncating to four before recipient allocation; the transaction limits assignment to one piece per hero/four total. Equal hero gains favor lowest current max HP then party order. Manual overrides can decrease CP.

- Lamp draws preserve the configured saved party EXP and timing. Essence is a bank, never a level calculation: each earned lamp level requires four explicitly purchased stages, then manual Lv.UP. `capacityTier` is level minus one; optional v5 `upgradeStage` defaults to zero. Levels 1–100 interpolate the original initial/final rarity odds; capacities remain 20/30/40/50 at levels 1/2/3/4+. Future gear gains 0.5% linear stat scaling per map ordinal. Saved gear rolls, hero EXP and earned lamp levels remain intact.

- Raw lamp emissions append every roll without CP filtering. lamp.recent preserves the last five emission snapshots independently of equip/collection routing. Equip review sorts descending lampGearCP, derived from the shared CP evaluator using gear stats at neutral level 1; item level already scales those stats. Auto silently selects the top four slot-CP upgrades, greedily assigns at most one per hero, and also requires positive actual hero CP gain. Ties use lowest max HP then party order. Manual equip permits lower-CP overrides. Auto completion or finishing review moves all remaining pending pieces permanently into lamp.discarded. Dismantle All has an inert item grid, no rescue/review/equip controls and no resource amount before confirmation. Confirmed conversion grants essence only and shows its receipt. Later raw arrivals remain separate from the confirmed pile. Capacity includes pending, discarded and historical aggregate credits; full storage stops Auto/EXP. Optional recent/discarded fields preserve supported older v5 saves.

- Every successful lamp emission shares a saved two-second minimum interval. The core rejects early calls before rolling or granting EXP; UI disables/re-enables the lamp from that saved cooldown. Auto keeps its five-second cadence. Reloads, concurrent clicks and switching manual/Auto cannot reset the gate.

- Dismantling grants essence only. It never changes cumulative party EXP, hero EXP/levels or emits an EXP float; resource previews and receipts show essence. Lamp emissions remain the EXP source.

- Upgrade preview shows current/next odds to three decimals, capacity, essence bank and next installment. Purchase carries the rendered tier and stage; locked storage rejects stale clicks before spending. Four saved purchases expose Lv.UP, which alone promotes the lamp and resets stages. Failed writes retain the bank, stage and level. Only the odds table may scroll on compact phones; purchase controls stay visible.

- Lamp guidance stores validated optional v5 bits for actual storage/comparison/preview actions. They are monotonic receipts with no currency, EXP, gear or tier effect; existing earned draw/equip/dismantle/tier records own the other milestones.
