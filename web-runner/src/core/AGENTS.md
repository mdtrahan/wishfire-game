# Web Runner Core DOX

## Purpose
- Own browser-shipped ESM rule modules and runtime helpers used directly by `web-runner/app.js`, modules, and systems.
- Keep deterministic browser rules aligned with shared `src/core/` and Rust SimulationCore ownership where applicable.

## Ownership
- Turn gates, scheduler, gem action, combat outcome, status, targeting, RNG, and packet helper modules used by the browser runtime.
- Runtime-only helpers such as animation/math helpers that must ship with the browser bundle.
- Browser-specific copies of shared rule modules when the runtime cannot import the root `src/core/` file directly.

## Local Contracts
- `lampGear.mjs` owns seeded Hat/Body/Boots generation and pure collection transactions. Every generated piece has ATK/DEF/MAG/RES/HP, never SPD; highest generation tier persists across retries. New Epic rolls floor each stat above the same-slot lower-rarity ceiling at that ordinal, and Legendary rolls floor above Epic; saved rolls remain unchanged. `lampReviewCandidates` is the shared pending/discarded eligibility and CP-preview seam. Auto evaluates all four heroes' three slots, uses each item at most once, and keeps strictly positive total-hero CP improvements until no queued assignment can improve the party. Manual equip may choose discarded gear. Dismantle requires the current heroes and rejects positive queued gear before conversion.
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
- `continuousCombatStage.mjs` owns the queryless production stage sequence, off-stage emitter, compact-arena actor advance, and independent hero-basic timer tick. Each region has ten stages; every stage loops four normal waves until its boss is armed and cleared. Before the first continuous spawn plan, the stage seed is synchronized to the selected encounter seed, including explicit QA seeds. Normal waves keep six deterministic sector identities of two to six enemies across the three-screen world, distributed over the HUD-safe world height. Pack members form a reproducible bounded two-dimensional cloud, including CP extras up to six members per sector and 36 per wave. Each whole cloud translates as needed outside a central recovery moat sized from enemy detection, a quarter-screen travel runway, and actor footprints; local cloud shape stays rigid and bosses retain their authored home. A six-bit current-wave mask records each cleared sector once and persists with its wave; recovery and reload spawn only unfinished sectors. HUD progress reads the mask plus currently absent sectors from the actual spawn plan, while a wave transition still waits for all actors and presentation effects. Each next wave keeps the existing three-second minimum interval. Fresh continuous combat and recovery huddles center at worldX1080 in the middle third; the recovery reveal holds before the squad travels toward a roaming pack. Later wave and boss transitions preserve current actor positions. Heroes and enemies move to delivery-specific contact inside shared bounds; clear-field transitions wait for active attack presentation to finish.
- Ordinary continuous waves preserve HP and KO state until the first deployed hero KO interrupts the current scheduler batch. Free recovery restores and cleanses the full party, places everyone in the authored role huddle, then starts one shared 350 ms reveal while keeping the same wave and earned pack progress. Boss readiness stays at 100% through defeat and retries automatically after recovery pacing; legacy four-wave-refill flags do not erase it. Boss fights retain the existing whole-party defeat rule.
- A boss clear restores every hero to full HP and clears harmful statuses and attempt-owned skill effects. If any hero was KO at the clear, revival places the full party in its authored role huddle and starts one shared reveal; an all-living party keeps its completed-fight positions. Skill revival retains its own position rules.
- `maybeAdvanceContinuousCombatStage` must be inert while dev tooling, QA scenarios, or QA fixture holds are paused; the app also freezes it for story pause, background, and defeat presentation.
- Continuous enemy attack intervals use the existing 1.6–5 second band: melee takes 1.6 seconds, ranged takes 5 seconds, and an explicit boss attack-pattern interval wins. Approach travel does not alter attack cooldown.
- The arena tick commits the party to every detected local sector until its living threats are neutralized, including temporarily retreating enemies. Hero basics and conditional skills can target any actor in those local sectors; distant roaming sectors stay dormant. Each enemy independently engages only when a living hero enters its delivery reach, and each eligible UID keeps its own scheduler clock. Detection and pursuit use two-dimensional actor feet; bounded movement and retreat share the HUD-safe world-height interval.
- Actor foot distance gates basics, direct skill geometry, projectile revalidation and enemy actions. Both Fara/Hondo lead both Runa/Kaja along actual travel and target vectors through reversals; supports ease back during a compact regroup, while contact waypoints preserve authored reach for all four. Roaming formation, row, regroup and straggler spacing use 0.8 of their prior authored offsets; collision footprints and attack reach stay unchanged. Static sprite fallbacks combine per-actor world facing with camera reflection. Enemy sprites draw from larger Y to smaller Y so the lower numeric Y appears in front.
- Hero basics use the canonical hero's explicit `baseAttackInterval` in seconds (Fara 1.8, Hondo 1.2, Runa 1.4, Kaja 1.6) to derive independent clocks. SPD informs the authored Level 1 silhouette only; changes to SPD never recalculate these baselines. Skill cooldowns remain static and independent; Quickload retains its existing temporary basic override. The four heroes are the attack sources; no hidden Pal assignments contribute attacks. Fire at most one basic per hero per tick while preserving each hero's due-time cadence. Continuous enemies use independent per-UID action clocks and may overlap one another and pending hero projectiles; each enemy starts at most one action per tick.
- Continuous production initializes the shared hero focus to zero; runtime basics retain its UID until death and clear it when no living target remains.
- Marid, Djinn and Chimerilass use ranged homes. Every other enemy uses melee homes.
- Armed bosses retain authored Y 290 home before joining the enemy action scheduler; manual boss mode places their X at the staged world-space encounter anchor.
- During a manual boss encounter, stage state owns the world-space boss anchor; actor pursuit, footprint separation and post-movement clamping keep all heroes left of the boss's 4x footprint in the fixed local band. Boss body reach includes its own footprint, while ordinary actor reach stays foot-to-target.
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

- `heroDefinitions.mjs` is the single source for the four five-active-skill kits and basic attacks. Active skills unlock at configured hero levels; `heroProgression.mjs` owns individual EXP and stat growth. KO remains zero HP during growth.
- `heroDefinitions.mjs` owns role-shaped HP directly. Do not add a global hero HP multiplier; it hides role balance and breaks CP calibration.
- Realtime hero skills resolve target geometry from the casting hero’s current foot position and reach. Direct hits, area effects, marks, splashes, and Burn Sigil ticks exclude targets outside the source’s current reach. Null Field marks current occupants once; Burn Sigil ticks at each simulation second through expiry. A committed basic projectile may resolve after its hero is KO when the impact supplies `allowSourceKO`, provided its target is still in range.
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

- Auto Equip compares positive total-hero CP changes for every queued item and matching hero slot; it can fill all 12 Hat/Body/Boots slots and replace a weaker manual choice. Re-evaluate after each assignment because CP depends on the full stat profile. Equal gains favor lowest current max HP then party order. Keep displaced and unused gear inspectable until explicit dismantling.

- Lamp draws preserve the configured saved party EXP and timing. Essence is a bank, never a level calculation: each earned lamp level requires four explicitly purchased stages, then seven-hour construction and automatic completion. `capacityTier` is level minus one; optional v5 `upgradeStage` defaults to zero. Levels 1–100 interpolate the original initial/final rarity odds; capacities remain 20/30/40/50 at levels 1/2/3/4+. Future gear gains 0.5% linear stat scaling per map ordinal. Saved gear rolls, hero EXP and earned lamp levels remain intact.

- Raw lamp emissions append every roll without CP filtering. lamp.recent preserves the last five emission snapshots independently of equip/collection routing. Equip review sorts descending lampGearCP, derived from the shared CP evaluator using gear stats at neutral level 1; item level already scales those stats. Auto compares every queued candidate against all four heroes' three matching slots and keeps strictly positive party improvements until no queued candidate adds CP. Equal gain favors lowest maxHP then party order. Manual equip permits lower-CP overrides from pending or discarded queues. Auto completion or finishing review moves remaining pending pieces into lamp.discarded, where they stay inspectable and equipable. Dismantle rejects queued positive-gain gear before spending; confirmed conversion grants essence only and shows its receipt. Later raw arrivals remain separate from the confirmed pile. Capacity includes pending, discarded and historical aggregate credits; full storage stops Auto/EXP. Optional recent/discarded fields preserve supported older v5 saves.

- Every successful lamp emission shares a saved two-second minimum interval. The core rejects early calls before rolling or granting EXP; UI disables/re-enables the lamp from that saved cooldown. Auto keeps its five-second cadence. Reloads, concurrent clicks and switching manual/Auto cannot reset the gate.

- Dismantling grants essence only. It never changes cumulative party EXP, hero EXP/levels or emits an EXP float; resource previews and receipts show essence. Lamp emissions remain the EXP source.

- Upgrade preview shows current/next odds to three decimals, capacity, essence bank and next installment. Purchase carries the rendered tier and stage; locked storage rejects stale clicks before spending. Four saved purchases expose Lv.UP, which alone promotes the lamp and resets stages. Failed writes retain the bank, stage and level. Only the odds table may scroll on compact phones; purchase controls stay visible.

- Lamp guidance stores validated optional v5 bits for actual storage/comparison/preview actions. They are monotonic receipts with no currency, EXP, gear or tier effect; existing earned draw/equip/dismantle/tier records own the other milestones.

- Four cleared waves set boss readiness and enter the boss automatically through the existing 440ms wipe, with no intervening fodder wave. A restored readiness checkpoint enters once on the first unpaused runtime tick. Boss defeat keeps readiness at 100%, restores the full party, then retries after the existing recovery interval; victory clears readiness and advances the tier. Boss entry cancels queued fodder actions immediately. Never carry bossArmed into the next tier.
- Canonical hero levels cap at100. Existing five-skill kits declare unlock levels1/5/10/15/25; scheduler eligibility, direct casts, reactive retaliation and menu disclosure read those definitions. Preserve earned EXP and gear; defaults are configurable tuning.
- Lamp v5 accepts optional upgradeEndsAt and speedUpTickets. The fourth paid stage records a7-hour deadline; only expiry grants the next level. Five-minute tickets reduce that same deadline and SPD UP ALL spends only the amount needed. Partial stages and already-earned levels remain intact.

- The conditional hero kits have 33 stable skill IDs and explicit unlocks. Target selection and commitment share the same composable predicates, shapes, recipient policies and projected stat reader. Attempt state owns Fruit/Grow; ordinary waves and boss entry preserve hero state, while boss victory, defeat and exit clear it. Level/gear refresh preserves clean max HP and never saves battle modifiers.

- Seeded RNG preview stays byte-identical to the shared source mirror; preview must never advance the combat draw owner.
- Continuous roaming owns pack spawns and settlement. Every wave clears before the next emission, with at least three seconds between emissions; the boss gate and existing reward/KO rules remain stage-owned. Arena displacement uses full world bounds for arena-enabled actors.

- Boss CP uses one local pack's baseline (wave CP divided by pack count), then the existing boss premium and stage curve. Increasing dispersed pack count must not inflate one boss's damage or defenses.
- The first region's first boss retains its catalog-tuned stats. This introductory encounter must not inherit CP-driven offense/defense amplification; later bosses retain the pack-normalized stage curve.
