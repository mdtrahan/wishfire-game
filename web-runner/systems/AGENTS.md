# Web Runner Systems DOX

## Purpose
- Own browser runtime systems around rendering, input, local persistence, supergem runtime behavior, dev tooling, and SimulationCore shadow diagnostics.
- Keep presentation and browser integration out of deterministic rule ownership.

## Ownership

- `heroCooldownStrip.mjs` owns the read-only eight-slot portrait row above equipment: centered 344px width, 41.28px height at logical Y441.6. Mini-quest starts at Y370 so its whole box clears the party buff row. Fill canonical deployed heroes left to right, retain visible empty slots, and preserve Bag/conveyor hit areas. Shading reads the Special clock in combat time; clicking a clock opens that hero's Skills tab at the Special (`focusHeroSpecial`) and clicking a party icon opens Training Ground > Party Skills at its exact entry. Strip clicks never propagate to the quest or canvas; ready shading promises neither a valid target nor a cast. No skill, save or timer state is written here. `npm run test:hero-cooldowns` enforces geometry, pause behavior and Bag access at five viewport/DPR settings.
- The same strip renders buff signals from `assets/images/ui/buff-signals.png` (bitmap only, no debuff icons). It only translates live effects into modifier channels; `src/core/buffSignalRules.mjs` decides party-wide vs per-hero placement. Party icons sit centered over the full eight-slot width directly above it. Hero badges (max three) sit bottom-aligned on the clock, filling left to right by arrival; any one may end and the rest close up. No words, numbers or durations.
- `render*.js` files own Canvas/UI presentation for combat, HUD, map, overlays, and progression shells.
- `heroGearUI.mjs` renders equipped gear levels with the shared lower-right `.lamp-level` badge inside the art; empty slots retain their slot label and filled slots omit the redundant top label.
- Hero-screen navigation selects canonical roster records from `HERO_DEFINITIONS`, matching equipment ownership. Combat `*#1` progression copies remain saved but must never appear as duplicate heroes with empty loadouts. Equipped gear stays with its hero until a cached positive-CP replacement changes that same slot; it cannot transfer to another hero.
- `renderRuntime.js` owns a large partially purified runtime render path and remains high-risk.
- `combatSimulationTick.mjs` owns the frozen-aware combat clock, queued hero impacts, independently scheduled hero/enemy actions, action presentation, status/effect timing, and reward settlement; renderers consume prepared state and presentation events.
- `inputHandling.js` owns browser pointer/map input helpers.
- `superGemRuntime.js` owns supergem board/effect runtime behavior.
- `heroProgressStorage.js` owns versioned localStorage hero EXP/progression persistence.
- `simulationCoreShadow.js` owns WASM loading, Rust owner markers, shadow checks, and mismatch diagnostics.
- `runtimeAssetUrl.mjs` owns document-base asset resolution and embedded offline JSON/WASM payload lookup; hosted runtime loading remains the default path. Hero skill icons use this resolver so the classic offline bundle can open the current Skills screen.
- `devToolingControls.js` and runtime debug helpers own QA/dev surfaces.
- `devMovementTuningPanel.mjs` mounts live movement/camera sliders in the dev modal; values persist only under the dev localStorage key and never enter save data.
- Boss HUD fractions and timeout receipts use the stage core's fixed 30-second limit, including old stage objects carrying a prior limit.
- `renderCombatBossControl.mjs` owns the combat progress rail and manual boss retry group. The group appears only in unobstructed combat at logical Y=42 below resources; non-combat layouts, blocking modals and entry/terminal phases hide it without changing earned readiness. Detect visible dialogs independently of layout because Growth retains the underlying combat layout. An active boss keeps the Canvas timer rail. First approaches enter automatically; latched retries use the guarded summon path without reinitializing combat. Keep DOM and Canvas anchors in the shared 360x640 frame.

## Local Contracts
- Continuous combat has one stage/checkpoint and one boss per chapter. Chapter 1 has 10 waves and Chapter 2 has 15; Chapters 3 onward have 20 except every fifth chapter, which has 5. Label the UI Chapter N. Three packs/sectors and 1.5x enemy HP in five-wave chapters are provisional candidates. Treat 0.4% maxHP/s passive recovery and gear maxHP delta fill as provisional candidates.
- `devBrowserTestHooks.js` exposes read-only ordinary clear and recovery counters, actor progression, and the live hero recovery reveal flag for the balance harness. Exact opt-in combat events come from live globals; unknown mechanical type and any bounded-ring gap remain explicit in reports.
- Puppet identity routing covers the four current hero display names and save keys plus all ten authored monster names; portrait aliases fall through to canonical identities. Keep clip selection independent of combat and save ownership.
- Newly introduced combat actors and elements reveal through an appropriate transition; instant pop-in requires an explicit user request or approved prompt/goal. Enemy actors and their HP bars use one short alpha fade driven by active combat time, reset only at true activation.
- `realtimeSkillGroundPresentation.mjs` draws committed Burn Sigil circles and active timed-effect foot cues before the shared actor paint queue. Use canonical actor feet and the current formation projection; rendering never changes effect records, clocks or mechanics. Cover links require a living source; committed Blight keeps its existing source-KO lifetime. Chibi heroes do not carry letter/square skill or status badges, or a multiplier badge; existing body, ground, projectile and impact VFX communicate these effects. Ground art adds one Cover source diamond per frame with links/shield outlines, Destiny healing marks and Blight thorn rings with stable effect-owned sizes, without duplicate status labels; paused combat time freezes their lifetime.
- Puppet combat rendering never draws static actor art or placeholder rectangles. Retain the exact outgoing puppet frame through asynchronous state, facing, KO and revival switches; HP still selects KO. Finish one initial load before chasing changing keys, and synchronously sample decoded cache hits. Never resample the outgoing clip with a replacement action clock. Missing authored packages are asset defects, covered by full enemy-manifest tests.
- Lamp equipment commits one v4 record before changing runtime Gold, exact rolls or loadouts. Preserve old save records on migration/error. Equip applies canonical stats and fills current HP by any gained max HP without reviving a KO. The comparison keeps four portrait recipients and their changes above the candidate; inspection must leave combat advancing.
- `combatAttackVfxPresentation.mjs` lazily requests elemental impact flipbooks by skill slug and centers their one-shot frame on the queued target point; keep the rendered canvas within 52 logical pixels at layout scale 1.
- `combatSimulationTick.mjs` ages and expires damage text on simulation time; `renderRuntime.js` only spawns its DOM presentation. Damage text must clear so the continuous-stage boss gate can advance.
- Combat initialization consumes supplied hero members through slot 5, preserving sparse formation indexes and instance identity. Catalog size must not cap deployed members; escort and enemy UIDs follow the instantiated heroes. This initializer capacity does not expand the configuration UI or define new hero content.
- Production mixed encounters draw only fodder/routine catalog tiers and remain within a 13–18% party-CP band so the party clears ordinary packs decisively; hard, elite and boss tiers require an explicit encounter policy.
- Production, orientation, and developer QA entry use the authored continuous stage adapter: ordinary chapters preserve six pack-sector identities and one seeded solo per sector; five-wave chapters use sectors 0, 2, and 4. Initial finalization, wave spawn, and recovery pass the planned solo marker and solved feet unchanged. Each chapter's final ordinary wave unlocks its boss, and a boss clear advances to the next chapter. Heroes and engaged enemies schedule independently; no entry variant dispatches turn initiative.
- Pending hero hits in production may retarget after a death only to living enemies already inside the hero attack range; renderer fallback must agree with the shared focus rule.
- Refill bounce, YellowCasino progression and payout, BlueBuff logical completion, buff-icon phase transitions, and gem-merge payout/gate release advance from simulation time without drawing. YellowCasino's ghost remains a presentation read in `renderBoard.js`.
- Continuous combat is the automatic action owner. Finite/story defeat remains Rust-owned after scheduled work; ordinary roaming stops its current scheduler batch at the first deployed hero KO and routes to free full-party recovery. Recovery clears debuffs, uses the authored role huddle and one shared 350 ms reveal, preserves the current wave and its saved six-sector clear mask, and respawns only unfinished packs. Boss readiness stays at 100% through defeat and retries after recovery pacing; boss fights retain the existing whole-party defeat rule. Every paused/background/defeat frame resets the simulation timestamp and performs no simulation work; resume starts with a bounded first step.
- An active continuous boss is witnessed only while combat stays active through the normal clear path. Leaving combat, opening the Lamp collection, pausing into another surface, hiding the document, or firing `pagehide` surrenders before snapshot capture or simulation suspension; remove the boss from pending reward settlement, clear queued combat work, recover the party, and retain readiness with the manual-summon latch. Keep the spawned numeric boss UID on the active stage and checkpoint it only while active; this identifies its pending reward if death already removed the actor. Clear it after surrender, stage advance or a new wave, and filter it before reload settlement while preserving fodder entries. Ordinary non-boss menu pause remains unchanged.
- If the last Hero and boss die in one scheduler step, defer whole-party recovery while the boss death presentation drains. The stage clear then settles the win and restores the party once; a living enemy still routes the wipe to recovery.
- `storyEntryFlow.mjs` owns quest card flow. Confirmed Skip advances within the current card; embedded combat begins immediately. Defeat waits for Continue or Quit; Quit returns to Quests.
- Active combat can leave through the shared navigation at a synchronous frame boundary. Layout snapshots preserve CTB, the current fan and pending target state; Quests uses the existing ladder modal for Continue Battle or Quit Battle, and only Quit clears the combat snapshot and resets a fresh session.
- Narrative rendering preserves the existing two-sentence pages and solo/pair shots. Scene startup, Auto advancement, and layout changes belong to the controller/entry flow, outside `renderNarrativeScene.js`.
- Combat actor orientation must project canonical left-wise anchors through `src/core/combatOrientation.mjs`; mirror actor-attached x offsets, never combat rules or canonical positions. Right-wise actor sprite pixels mirror about each oriented pivot so both teams face inward and asymmetric art remains visually reflected.
- The dev-tool orientation control stages the next combat orientation and uses the existing fresh combat-refresh path when changed during combat; never flip a live combat frame in place.
- Right-wise rendering consumes the shared formation projection: both teams use the same `-40` logical-X translation after reflection and preserve the shared canonical Y homes. Structural formation anchors do not recenter after death or refill.
- The numbered combat grid, hero formation centers, and enemy actor centers share logical canvas coordinates. Derive hero feet from the rendered sprite half-height so effects keep their ground anchor.
- Continuous combat projectiles travel linearly through contact. An enemy action completes and re-arms its cooldown after its own presentation clears, regardless of simultaneous hero basic effects.
- Render modules may read state and draw presentation; they must not become owners of deterministic combat rules.
- Hero rendering publishes each caster's resting sprite-base anchor before applying lunge offsets so attached effects such as Arcane Pulse remain planted.
- Impact presentation uses the pale diffused glance ring for non-critical damage at or below 5% target max HP. Keep that ring at the target's rendered midpoint on Y while retaining the attacker-facing contact X. Stronger physical basics use the red-orange melee flare on the common contact line, 17% of actor size above that midpoint.
- Impact rasters face into their target: enemy-target art uses the authored orientation and hero-target art mirrors on X. Common contact stays on the attack-facing side within 5% of the target's actor-size center, matching the Photoshop guide; projectile travel must not pull it toward the attacker. Ground effects stay behind targets. Eruptions, including Venom Sigil and enemy heal blooms, begin at the target's feet and remain in front through every frame. Slice contacts retain their authored completion offset.
- Launched hero projectile visuals keep their first heading independent of pending-hit removal and target movement. A landed hit clears its projectile at impact; a missed shot travels until its drawn center passes five percent beyond the canvas edge.
- Late combat overlays must resolve authored asset dimensions after `assetsLayout` loads, then apply the active layout scale through `combatPresentationScale.mjs`. DOM overlays use that same scale instead of fixed CSS dimensions.
- Developer panels may scroll vertically at compact viewports. Their transformed shells must opt out of flex shrink and finish with 16px physical viewport gutters; every child keeps `scrollWidth <= clientWidth`.
- Quest-QA controls are query-gated and use fixed side-gutter rails from measured Canvas bounds; when gutters are too narrow they use a contained scrollable two-column dock below the diagnostics z-order.
- Quest-QA scenario controls enter the production Combat layout, start from one shared fresh-session reset, and remain behind the fixture turn hold plus dev-tooling pause until explicit QA resume. Presentation frames continue under that scheduler hold so live combat effects remain inspectable. Closing diagnostics preserves the scenario pause. Enemy HP setup mutates only living enemies and records its affected UIDs and HP changes.
- Dev Panel 1 keeps Close in the upper-right header. Its action-button row follows that header and precedes every settings field and dropdown while retaining compact-width wrapping.
- Developer controls overlay the contained game stage; their presence must never reserve viewport width or shrink the Canvas.
- Full-screen Canvas overlays use the 360x640 reference coordinate system and apply the active layout scale once to the whole overlay, including hit zones.
- Combat Canvas text must derive its font size from the active layout scale through `combatPresentationScale.mjs` and fit its measured slot. Desktop font minimums must not override compact Canvas geometry.
- Hero status presentation uses actor-owned HP and readiness state. The shared Astral Flow HUD and pooled health bar are retired.
- `combatHealthBarPresentation.mjs` draws both actor HP bars as rounded dark-grey tracks with blue hero and orange enemy fills; keep the hero bar's existing width and height rule for both teams.
- Combat draws neither the legacy `radiatorPanels.track` backdrop nor the `EnemyArea` texture. At the `EnemyArea` layer, combatArenaBackground.mjs paints chapter 1–4 ground panoramas with the actors' horizontal camera and fixed vertical layout frame. Chapter 5 onward retains the full-canvas reference grid; undecoded art also keeps that grid visible.
- `renderRuntime.js` should shrink over time. Draw calls may prepare buff-icon geometry for the ticker, but must not advance refill, buff completion, icon phases, merge payout, or turn dispatch. Do not add broad new gameplay branches there when a focused render module or gameplay module can own the change.
- `heroProgressStorage.js` may use `window.localStorage`; SimulationCore packets and Rust-owned code must not.
- `simulationCoreShadow.js` must expose stable owner markers for Rust-owned rule families and should surface mismatches as diagnostics, not silent fallbacks.
- Supergem runtime owns native board effects only. Production action selection uses actor readiness and cooldowns.
- Input gates must respect `CanPickGems`, hero/enemy turn phase, and presentation barriers. Retired offer and card flags cannot block production.

## Work Guidance
- For visual changes, identify whether the owner is a narrow `render*.js` module before touching `renderRuntime.js`.
- For persistence changes, include save/load compatibility tests and confirm no deterministic packet now depends on browser storage.
- For SimulationCore ownership changes, update Rust exports, WASM build, shadow markers, JS packet routing, fixtures, and tests together.
- For supergem changes, check `governance/product/hero-supergem-bead-ledger.md` and the relevant supergem tests first.

## Verification
- Focused render/input/supergem/persistence tests for the touched surface.
- `node --test tests/finalRustOwnershipBoundaryContract.test.js` for SimulationCore boundary changes.
- `npm run rust:build-wasm` when Rust exports or WASM behavior changes.
- Browser QA through `npm run serve:qa` plus the Codex in-app Browser for visual runtime changes.

## Child DOX Index
- None.

- Chapter 1 begins in the map phase. The rendered town token and START button open Quests; map and hit zone share the narrative 360x640 viewport transform. Developer Skip also bypasses map entry.

- Player-facing labels use Quests, Main Story and Stage; Back is a compact curved arrow. Quest ladder owns progressive card completion, one-time dummy rewards, confirmed story Skip and Continue/Quit. The shared renderExistingNavigation menu owns DAILY, HERO, QUESTS, VAULT, SHOP and FLOW across layouts. Dialogue hides and disables it; DAILY and SHOP remain disabled until their screens exist. Badges use object-only illustrated assets, without characters. Its 360x60 frame begins at reference Y=580. The charcoal navigation bar uses a teal glow behind the active badge, without an enclosing selection frame. Cards are 56/640 of the reference height, with the map visible and light panels. Quest progress and economy are session-local until versioned player saves are designed.

- Main Story 2 follows Stage 5 in the current ten-stage roster; synthetic stages are sorted by existing Encounter CP (name breaks ties). Each uses its roster enemy through the existing encounter slot path and a CSS-cropped sprite thumbnail. They preserve combat rules and progressive unlocks; the roster determines the stage count. Main Story parts are numbered.

- Quest cards retain the chapter panel's 320-unit width regardless of overflow. The scrollbar occupies the right margin outside that column; the list clips 18 units above the combat navigation, with Back overlaid instead of reserving a footer row.

- Pending single-target attacks receive an actor-owned living default target before rendering, using the same target-intent capture as an enemy click. Preserve a valid player choice; replace dead/stale targets. ATK must accept the displayed default without an extra enemy tap.

- Fresh encounter initialization clears transient battle conditions and pending realtime hero basic clocks through combatSessionReset.mjs. Production combat uses speed readiness and skill cooldowns. Gold and persistent progression are outside this reset. Hero and enemy HP bars render over their owning actors.

- Gold is currency persisted by goldProgressStorage.mjs under wishfire.gold.v1. Fresh encounters and resurrection never reset it; balance changes, including spending, are saved locally.

- Map presentation draws terrain first, then independent headings, divider, chapter label, token and START from chapterMapPresentation.mjs. Token hit bounds derive from its draw rectangle. The QUESTS page banner stays visible in both map and ladder phases. The ladder wallet shares its top row; its chapter panel begins below that row. The town token stays at its world position behind ladder cards; it never belongs inside the chapter panel. Only the map-specific chapter label, divider and START hide when the ladder opens. Never bake runtime UI into scenery; only mockups or simulated screenshots may do so.

- Chapter map and quest ladder share identical banner/resource header anchors at reference Y=48. The ladder panel begins at Y=92 and retains a centered title, existing location artwork and completion count. Quest cards keep 56-unit height with thumbnail left, title/energy center and one-time reward right; shared nav remains unchanged.

- Quest resource strip reads live saved gold through getGold from state.globals.goldTotal, followed by resources and energy, identically on map and ladder. Gold changes invalidate the header render. QUESTS banner is 24 reference units high with 13px text.

- Chapter progress counts completed sub-chapter cards of every kind against the entire chapter roster, including unrevealed combat stages. The UI cache must invalidate when the asynchronously populated roster size changes.

- Chapter, story and combat panels use fully opaque fills. Do not reuse the world map as chapter-panel artwork or apply translucent fills that visually merge the panel with terrain.

- Combat-session completion, Quit, or return to Quests clears dev-tool overrides. Continue retains the same session. Reset staged settings and persisted dev config while preserving saved gold.

- Resource Continue restores party HP while preserving energy, encounter progress, buffs and skills.

- Energy is a macro balance: quest entry spends it, combat actions do not. Purple recovery remains active. Combat defeat depends on living heroes; Continue preserves energy.

- Starting macro energy is 200. Stage cards cost 15 per entry; all Main Story cards cost zero and omit the energy row, including embedded combat.

- Combat entry uses a 250ms eased blackout, 500ms black hold, then 1000ms eased reveal. Change layout under black; block pointer input throughout.

- Enemy-target owner wiring serializes six hero records, preserving KO slots for Rust to filter. Pooled HP is diagnostic for combat outcome; fresh-encounter and Continue behavior remain unchanged.

- Combat initialization derives health totals from the initialized actors; it must not overwrite the total with full HP while actors remain injured. Party-damage owner wiring serializes six HP slots with actual member count.

- Combat has no hero status-card strip. `renderRuntime.js` draws the full-body hero sprites at one shared arena scale and anchors each compact HP bar from the sprite feet so the gap remains correct when art dimensions change. Names, roles, levels and AF stay off the battlefield. Narrative quest cards remain separate.
- Combat formation anchors remain in the 360x640 logical presentation frame, while the camera follows all living heroes through a bounded four-screen world at 0.5 battlefield zoom. Keep HUD geometry in layout space. Hero sprites stop at visible X 106; hero and enemy spawn/home sprites fit within visible Y 170-375. The highest hero HP bar begins below grid Y 150. Temporary action animation may leave that Y band.
- The numbered floor grid follows the same world camera across all four screens. Keep 10-unit minor lines and 50-unit major labels visible in the current viewport as it pans.
- World-sized ground skill cues and heal-bloom Canvas dimensions use the shared battlefield zoom scale once, while their centers use the world camera projection. Keep damage text and HUD geometry in their current presentation scales.
- Continuous production assigns six deterministic sector identities, spreads seeded cloud footprints by at least 400 world units (200 logical pixels), and keeps every footprint outside the centered 150-logical-pixel recovery moat; the recovery huddle remains at the true midpoint of section B. Ordinary packs become local within 460 world units of a living hero or actor-specific attack reach. Stale `in_range` or `engaged` state cannot pull a remote group into local commitment, and packmates beyond notice range remain dormant until they approach. Heroes travel in compact frontline/rear roles, share nearby threats, regroup stragglers before choosing a farther pack, and pursue within world edges. Ordinary waves require full clear and the existing three-second minimum before the next emission; boss activation remains automatic after earned readiness. After existing weak-CP scaling, each lone wanderer has half HP, rounded up with a minimum of one, and its CombatPower is recomputed; its other stats retain their existing weak-CP values.
- The compact combat progress HUD stays in the upper combat frame and shows Chapter N through roam, boss entry wipe and boss combat. Its dynamic notches mark each ordinary wave; within a live wave, the rail advances once per cleared active sector using the saved wave mask plus current actor pack identities. Boss availability or activity fills the meter. Reuse the loaded Hondo puppet source head for the moving marker.
- During an active boss attempt, the progress rail becomes a blue draining game-time gauge; ordinary wave notches return after recovery. `questCombatSession.mjs` records timeout HP and the living party before clearing the boss, restores the party through the same-stage recovery route, and preserves the manual Summon Boss latch.
- Hero and enemy HP bars are drawn immediately after their owners from the shared foot-Y-sorted actor queue. Keep each bar below its owner's feet and preserve HP trail timing and fill behavior.
- Cooldown and readiness rules belong to the deterministic combat owners. Hero lunges use display slots, so catalog identity does not collapse repeated or later formation positions.
- Prepared commands belong to the combat session and member UIDs. Replacing actor objects while restoring the same session must preserve prepared selections; a new session or changed roster clears them.
- Full-health recovery is owned by questCombatSession.mjs for both Town and Continue. Restore actual hero actors, then project HP through UpdateHeroHPUI; empty groups clear old totals. Continue resumes the same encounter with its realtime cooldown/effect state. Only a continuous-combat KO revival relocates the whole party into the authored huddle and starts the shared reveal; finite/story recovery keeps its existing placement.
- Opt-in balance capture emits one recovery event per restored hero with reason, recovery generation and before/after HP; this is distinct from effective skill healing.

- Active production combat has no SP or FLOW resource gates or gauges. Skill readiness is cooldown-owned.

- `renderHeroScreen.js` consumes canonical hero definitions and owned progression; each hero presents a basic attack and five active skills without unlock/rank/passive categories.
- `questCombatSession.mjs` presents settled progression before allowing the victory return. Queue settlement and EXP computation remain core/module-owned.
- Player Start enters an endless combat session through `storyEntryFlow.mjs`; it sets `QuestFiniteEncounter` to zero and never inserts Quest Ladder stages or opening dialogue. QA may still reach retained story hooks explicitly.

- Skill taps queue directly. Independent per-hero action slots auto-commit at capacity; ACT ends selection early. Battlefield selection persists; queued targets are snapshots. Removing entries restores reservations.

- renderFlowOrbs.mjs draws the shared 520ms gem flight using the actor projection. Collection belongs to the core update at impact; presentation never blocks CTB. Hero detail text describes enemy-death orbs and random distribution.


- Battlefield actor and enemy selectors are retired. Keep `SelectedEnemyUID` and target ownership intact so cooldown actions retain valid targets without drawing a marker.

- Victory results use 80% of the game canvas width and height, centered on that canvas. A separate canvas-sized black shade has 40% opacity; the native modal backdrop is transparent. ResizeObserver keeps panel/shade geometry current and cleanup removes both shade and observer.

- Hero management uses HERO / GEAR / SKILLS with a persistent hero display and roster. Overview shows EXP and full stats through a disclosure control. Skills presents one basic attack and five active skills. Gear uses the canonical equipment economy and loadouts.

- equipmentStorage.mjs owns the v5 lamp/equipment record and Web Lock transactions. Commit exact rolls, assignments, essence and cumulative EXP before projecting onto saved heroes and live actors. Each hero saves lampEXPClaimed to replay a missing grant once. Auto plans across all 12 hero Hat/Body/Boots slots in the same transaction, and dismantling rejects any queued positive total-hero-CP candidate before spending cache contents. Auto remains saved while the cache is full and pauses only its draws; explicit battle exit persists Auto-off before resetting the combat session.
- Historical pending enemy rewards persist beside HeroProgress until recovery settlement; new KOs record zero EXP/Gold. Persist a Gold settlement receipt before wallet sync, commit the receipt with Gold in equipmentStorage, then clear the HeroProgress outbox after wallet confirmation. The two localStorage records remain separate; receipt replay must stay idempotent across interrupted sync.
- astralMarketUI.mjs replaces the collector at idleFarmLayout. Only the active screen reconstructs/draws offers; leaving checkpoints time without running a hidden simulation. Item inspection never pauses expiration. No collector update/claim path remains.



- Shop Back is left-aligned with its bottom five reference pixels above the purchase tray; keep inspection clear of its hit area.
- Quests Back matches that lower screen position: its bottom is -3 reference pixels relative to the screen container ending 78 pixels above the game bottom. The shop presentation test compares both buttons' position and size.

- drawPageBanner in chapterMapPresentation.mjs owns the brass arrow banner shared by Quests and Flow Shop; keep its gradient, outline and typography identical.

- Flow Shop pointer dragging keeps a captured offer ID and uses the same atomic purchase as BUY when dropped into the compact lower tray. Expiration continues while dragging. Pointer cancellation/outside drops never spend. Gear uses rarity tiles and green upgrade badges for unequipped stat-dominant items against the selected hero slots.
- An expired inspected offer disables purchase immediately, fades its details, and restores the default drop-to-buy hint. Selecting another live offer cancels the expired detail state.

- Faze's initial Blight hit must publish its purple flash and `dot` damage-text kind to live globals before `ApplyDamageToTarget`; both DOM and Canvas damage-number paths preserve that kind with the Blight purple palette. Deferred end-of-frame patches arrive too late for that resolved hit.


- Shared Back chrome uses a single thin gold edge and proportional padding/corner radius; avoid the older thick ridge treatment on Quests.

- Flow Shop preserves the Quests header anchors: banner (0,48,112,24), resources (122,48,230,24) in the 360x640 frame. The stream spans the full game canvas behind the header and purchase controls, with clipping only at the outer screen edges. Do not stack or redistribute the shared header to fit its title.

- Background lights come from live offer progress and rarity data only, anchored at each card's upper edge. Vertical pearl folds carry travelling sheen and narrow iridescent edges; each fold refracts the quality-color wash into its own reflection. Wake color exists only above that edge and fades upward inside its lane. Drag pointer/ghost coordinates never feed shader uniforms or alter stream scheduling.
- `combatAttackVfxPresentation.mjs` owns typed attack delivery and skill contact rasters for both factions. Regular hero and enemy basics suppress contact splashes; melee heroes travel with the individual G09 crescent and ranged attacks retain their delivery art. Named skills may enqueue contacts after their HP delta.
- Approved impact assignments are semantic: Kaja uses G03 purple, Runa uses G03 blue, Spectral Orb uses G01 blue, Chain Strike uses G04 original, and Split uses G03 original. Preserve the reviewed source rasters and their intrinsic aspect ratios. The maximum animated painted width is 55 logical pixels at layout scale 1; calculate compliance from the alpha bounding box rather than the full canvas.
- Hero and enemy weak contacts use the visible sprite midpoint. Common non-weak contacts share the tuned line 17% of actor size above it; do not reuse either contact line for eruptions, ground effects, or slice exceptions.
- `output/qa/splash-candidates/guide/` and `guide-v2/` are cropped reference tiles and are forbidden as runtime assets. A guide ID may enter runtime only from its reviewed `individual-approved/gNN.png` master.
- Lethal attack presentation keeps its defeated target visible until queued and active contact impacts clear. Combat outcome checks run after scheduled actions and impacts.
- Action presentation stays with its actor until the last visible effect completes. Ranged and healing profiles remain on their stored slot-home anchors, while melee `HOLD` waits for the owner's pending hits, impacts, blooms, and `ActionLockUntil` before retreat and handoff. A hero action claimed during its heal keeps its timer at zero until the heal lock clears.
- Named enemy skills override that basic profile: Scathe crackles on its target, Sweep emits its own crescent, Wipe washes the enemy group, and heal skills rely on resolved heal blooms instead of offensive imagery.
- Shipping enemy magic AOE and Drain Buff use their own brushfire and inward-orb sequences rather than a generic caster profile. Spectral Orb reuses the drain-orb raster as its counter-clockwise rotating projectile, then resolves with its approved G01 blue contact.
- Vertical magic reveals progressively along its travel direction. Heal presentation stages a ground sigil, rising fountain, and falling motes; Arcane Pulse renders its illustrated charge, straight travel, trail, and matched contact in `combatAttackVfxPresentation.mjs`.
- Grow preserves its established hero scale state and adds one short bottom-up spectral-hand lift from each living hero's ground anchor.
- Session behavior procs publish semantic visuals: Spectral Orb shares Arcane Pulse, Chain Strike shares its ribbon, Venom reveals a ground sigil upward, Glass Reprisal travels as a glass crescent with matching contact, and Dawn Chorus shares staged revival healing.
- Immediate multi-target damage publishes timed `CombatImpactRequests`; the shared attack presentation consumes one request per resolved target.
- Standalone combat VFX scenarios must clear any opening buff queue and enter through `StartRound` plus `ProcessTurn`; do not leave retired manual `PendingSkillID` fixtures holding the scheduler busy.

- Manual Equip commits immediately and retains the screen for player choices. Auto processes the sorted cache sequentially and enters disposal after saved CP floats finish. Replaced gear never returns to the cache.

- Gear artwork carries item level and rarity color, with no corner rarity letters. Full rarity names remain in item identity and accessible labels.


- Pending gear fills five equal square columns across the review frame. Its scrolling viewport exposes two to two-and-a-half rows at each phone width; incoming rolls and recipient selection preserve frame height and scroll position.

- Equip returns saved permanent CP before/after/change; only the CP value floats after successful persistence, anchored at the stationary recipient portrait, and reports positive, zero or negative values honestly. HP gear raises max HP and fills the same HP delta without reviving. v3 migrates to v5 with HP zero, preserving previous stat rolls and source records.

- Pending gear tiles use rarity-colored backgrounds; the currently compared item alone carries a gold selection halo and aria-current. Selection preserves the fixed queue dimensions.

- Hero Gear Upgrade idle guidance uses the Hondo-inspired blue pointer and cyan rings: 15 seconds since input points to Hondo (Huun), or Auto-Equip after portrait selection. Document pointer/click, key and wheel input dismisses and resets it. Hidden/closed/busy review suppresses guidance; the overlay never intercepts input.

- Bag progression keeps Essence in its existing bank. One explicit full-cost Level Up grants the next earned level immediately after persistence; no installments, construction timer or speed-up action remain. Bank growth never promotes automatically. Capacity, odds, gear rolls, hero EXP and draw cadence retain current tuning.

- Lamp burp presentation clears its trigger at animation completion so unrelated review renders do not repeat emission. Manual and Auto share the same current-lamp tilt and gear pop tween.

- Review derives eligibility and rank from actual matching-slot replacement changes in total hero CP. Recompute all remaining items after every equip. Strict increases are green; equality/decreases are red and cannot be equipped. Previously queued gear that becomes useful returns to pending. Queueing or confirming disposal cannot bypass upgrade protection; only all-red gear is convertible.

- Gear review displays stats in HP, ATK, DEF, MAG, RES order. Candidate stats occupy three columns: HP/ATK/DEF followed by MAG/RES; presentation order does not change saved rolls.

- Equip releases its save/action guard before the 1.8-second CP float finishes, allowing immediate recipient and item selection. Only the final review transition or modal close waits for all active floats; feedback stays inside the modal.

- Every successful lamp emission shares a saved two-second minimum interval. The core rejects early calls before rolling or granting EXP; UI disables/re-enables the lamp from that saved cooldown. Auto keeps its five-second cadence. Reloads, concurrent clicks and switching manual/Auto cannot reset the gate.

- Dismantling grants Essence only. Gear emissions grant no new EXP; COT Hero tickets fund individual level-ups.

- Confirmed dismantling closes review and shows the saved Essence receipt for two seconds. COT claims show Reward Obtained for 1.5 seconds. Both receipts emit the approved VFX and close automatically.

- Empty lamp storage opens no review/dismantling modal. Finishing a review with no remaining pieces closes after CP feedback; lamp upgrades still open independently of storage count.

- Equip and Auto restore the portrait row before measuring CP feedback anchors. Validate the equip → dismantle → passive reward → next equip sequence through player controls and recorded visual evidence before presentation handoff.

- Game boot restores the saved cache, EXP, loadouts and Auto preference, including when the cache is full. Arrival positions display only emission sequences at or after the UI session baseline; gear sequence is zero-based while the saved lamp sequence counts completed emissions. Auto is available at capacity so the player can explicitly turn it off; only the battle-exit transaction clears it automatically.

- Arrival illustrations display only session emissions still in pending or discarded storage. Equipped and confirmed-dismantled pieces disappear from the strip; a zero cache leaves all five positions empty. Historical emission snapshots remain saved independently.

- Strip presentation uses supplied transparent lamp/puff rasters. Manual and Auto share one puff-before-bounce emission path. Larger five-position gear art retains quality glow and item level; AUTO is upper-left with on/off/locked pills. Controls and strip remain anchored to the existing 360×640 Canvas frame.

- Emission puff holds at full opacity for roughly 585ms and fades by 900ms. Gear appears after roughly 650ms, grows from 65% through a 115% upward overshoot, then settles at 100% by 1.35s. Keep the emission class alive 1.45s for both manual and Auto; the saved two-second draw gate is unchanged.

- CP receipt lifetime never holds the durable action lock or freezes ordinary recipient/item selection. Track concurrent receipt elements; only final review/close waits for all receipts, keeping feedback inside the modal. Collection entry awaits any in-flight transaction, storage sync and decoded shared gear atlas, then renders the full sorted cache together. Auto generation pauses while collection is opening/open and resumes afterward when enabled.

- The strip disc displays the earned Bag level; its smooth meter follows banked Essence divided by the full next-level cost, capped visually at 100%, or MAX. It has no intermediate notches. Overflow remains in the bank after Level Up.

- Bag upgrade preview uses full-cost Essence progress and Current/Next odds with Common/Uncommon/Rare/Epic/Legendary labels. Preserve the owner reference's gray/green/teal/orange/red pills independently of equipment rarity frames. A stale expected tier rejects before spending; a failed write shows no promotion or reward.

- The lamp helper extends the15-second idle threshold through draw, collection, Hondo comparison, equip, dismantle and free/affordable upgrade preview. Retarget disabled controls to useful enabled actions; hide during reward banners and after a completed upgrade loop outside review. Any input dismisses it. Guide receipts persist once through the existing locked equipment transaction.

- Selected-item portrait arrows and Equip use `lampItemCPGain`, the actual hero CP after replacing the matching slot minus before. Green strictly predicts a positive saved receipt; equality/decrease is red and disables Equip. Several heroes can show green for one item. Standalone item score never determines a portrait arrow.
- Done / Dismantle is disabled while any current upgrade remains; a stale transition returns to equipment review. Send selected item is disabled if any hero benefits; storage enforces the same guard. Recheck pending disposal previews after loadout or inventory changes and return to review if a green item appears.

- Concurrent saved CP receipts use their measured wrapped heights and34px spacing for32px animation travel. Place each hero column in modal coordinates under its stationary portrait; keep ordinary rapid bursts within the visible modal.

- Hero Gear inspection displays the owned item level beside rarity. Read the existing item record; presentation must never reroll, rescale, reassign or mutate saved gear.

- Hero presentation keeps one centered full-body portrait size across Orb, Gear and Skills. Gear and Orb show a four-slot horizontal Hat/Body/Boots/disabled Orb row; Skills replaces that row with exactly four selectable active-skill icons. Pages expose every canonical active skill, with an overlapping final page when needed to keep four visible. The cream panel shows the selected skill's canonical target geometry or actor reach, cooldown, condition, unlock level and description; Basic Attack remains accessible there. Orb preserves level EXP and current stats while identifying Orb equipment as unavailable. Previous/next controls traverse the four canonical HERO_DEFINITIONS save keys exactly once, excluding combat-instance and retired records; gear cards inspect saved items without mutation. The visible stat bar shows ATK, DEF and HP, and the footer remains reserved.

- Hero is a primary shared-navigation destination. Its screen has no Back button; use the existing main navigation to switch destinations.

- Hero identity, portrait scale and equipment/skill stage geometry remain consistent across all three tabs.

- Preserve canonical hero art, three-column stat comparison and existing geometry. Portrait and cache green markers use shared actual hero CP eligibility; individual unchanged stat rows have no arrow. Manual CP-decreasing overrides are forbidden. Saved CP feedback remains factual and strictly positive for every successful equip.

- Selected-stat numbers and arrows share one font-derived digit height across both rows, independent of the displayed numeral. Normalize digit ink into that height; keep arrows pointed in both Canvas and CSS.

- Lamp gear decodes original alpha bounds once. Cache/card artwork keeps its derived centered atlas. Arrivals paint the original raster through a sprite-only offset: every silhouette midpoint equals the tallest current arrival's midpoint, independently of fixed level badges. Manual and Auto reveal await preparation before spending/granting or starting the bounce; its final transform returns to zero.

- Equipment storage normalizes supported paid-stage saves under the same Web Lock, preserving original bytes at `wishfire.equipment-economy.v5.before-bag-upgrades`. No load, clock expiry or sync grants a Bag level. An upgrade returns a saved capacity receipt for presentation only.
- Developer progression controls live only in the existing DEV modal. LV 1/5/25/100 saves canonical HeroProgress, refreshes deployed stats/HP and clears pending skills/effects; lampEXPClaimed starts at the current cumulative draw receipt so old EXP cannot replay. RESET GAME backs up this game's localStorage namespaces before clearing them and reloading the clean entry.
- HeroProgress optionally persists the current continuous tier, wave and boss access; reload restores farming with access retained, never an armed/active boss encounter.

- The generated render body must pass layoutScale into each injected DOM damage-number call; a scaled replacement elsewhere does not fix an unscaled injection.

- Shrink scales only the enemy sprite to 70% around its existing center/feet; expiry restores its original size and never changes hitboxes or movement. Skill impact mappings share the authored realtime ID registry. Combat session reset restores clean temporary-HP baselines before creating the next encounter.

- `actorClipPlayback.mjs` lazily loads explicit actor/state/facing PNG sequences and samples supplied simulation age. It never advances clocks or computes gameplay outcomes; unsupported facing/state returns null; combat never substitutes static art.
- Camera-following projectile visuals retain world-space endpoints and reproject them each frame. Their visible travel is capped to one current viewport in world units and fades before removal; culling uses visible canvas bounds, not legacy arena coordinates. Boss mode uses a temporary left-heroes/right-boss camera and orientation while the saved roam orientation remains unchanged; the entry wipe freezes simulation and consumes pointer input until it ends.

- Hero menus read canonical HeroProgress records for CP, stats and EXP. Combat actor snapshots may lag committed gear; they must not override owned progression in presentation. Equipment commits project the shared CP formula to saved and live heroes before their promise resolves. The first deployed clone (`#1`) inherits canonical gear unless an explicit instance-key loadout exists; later clones require their own loadouts so one item cannot buff multiple actors.

- Bag presentation preserves the approved conveyor, Bag art and Wish Ring. Manual Equip immediately commits a strictly positive actual hero CP replacement. Auto repeatedly chooses the highest current gain, recomputes the cache after each assignment, and enters disposal after positive saved feedback only when all remaining gear is red for all heroes. Queue and locked dismantle reject upgrades; later arrivals remain outside an existing confirmation. Replacement destroys old gear without Essence. COT claims and receipt timings remain unchanged.

- `actorClipPlayback.mjs` retains its 24MiB logical RGBA budget and 32-record ceiling. Pin displayed/replacement keys, retire absent slots at scene boundaries, reject obsolete completions after first readiness, and retry capacity denial. Physical browser/GPU ownership remains outside this logical budget.

- actorPuppetDefeats.mjs keeps removed enemy pictures for their one-second KO clip in a session-keyed WeakMap. Pictures never re-enter targeting, rewards or persistence; reset them on session/recovery. Start a retained defeat clip when decoded so its full motion can finish. Overscanned clips use canvas.referenceHeight for constant body scale and explicit padded foot origins.

- The Bag conveyor freezes emissions, movement, active age and capture whenever combat is inactive, any modal is visible, or stored count reaches capacity. Capture and creation recheck these gates after acquiring the save lock; freeing capacity resumes the preserved cadence without catch-up bursts. Bag count always reports durable cache contents. Animation completion only requests collection; a successful new saved arrival alone may trigger bag bounce/Wish Ring, including the final available slot. Storage checkpoints its active coordinate through the shared save lock on pause/visibility/page exit; presentation pauses CSS on the same gate. Reload reconstructs age and remaining cadence from saved active timestamps. A synchronous session-storage clock checkpoint, matched to seed/sequence/last emission, preserves same-tab reload position without writing inventory outside its lock. Abrupt process termination resumes the last checkpoint.
- Hiding the Bag strip discards CSS animations while retaining gear nodes. Seek each replacement animation and pause/resume transition to the item's active age; preserve spacing across repeated menu returns without carrying animation-delay offsets from discarded timelines.

- Disposal review opens only when the current preview contains gear IDs or saved legacy salvage. When Auto-Equip consumes the final item, finish CP feedback and close the overlay without an empty dismantle interstitial.

- `renderCombatDps.mjs` owns the session-only DEV DPS readout, scaled with the Canvas frame below the progress rail and hidden on modals/non-combat screens. Its toggle never resets damage or combat; columns follow Hero / CP / Damage / Hits / H.Rate, using canonical equipped CP, resolved damage, outgoing hit counts and session hits per active combat second. Party CP sums deployed heroes through the existing CP formula.

- DPS Party total row follows all Hero rows and stays muted light blue; yellow follows the highest positive cumulative Hero damage total. All-zero totals have no leader, ties keep displayed roster order, and H.Rate/CP never select the highlight.

- Active boss battles retain the notched chapter rail and use renderBossBattleHud.mjs for centered HP (percentage) and a separate cyan timer without text. Generated raster boss/clock/magnifier icons belong to this battle HUD. The inspector resolves the stage bossUID to the live enemy instance, updates its actual stats, keeps combat running, and dismisses on outside pointer/Escape, actor replacement or authoritative boss-stage exit. Keep the exact attempt's actor available through zero HP and simulation removal during death presentation; HP, hero KO and deadline thresholds must not dismiss inspection ahead of the stage lifecycle. Suppress that actor's local HP bar; preserve summon/retry presentation.

- DEV Boss Battle QA accepts a positive whole chapter number and launches that chapter through the canonical stage planner/arm path after the existing combat refresh and story-entry handoff. It uses current hero builds at full HP, clears transient battle conditions, and awards no skipped-wave clears. Validate input before refreshing; surface setup errors in the open DEV panel.
- Combat progression observes canonical saved equipment plus deployed heroes and chapter transitions. Cache observation by equipment record identity and progression signature, recheck milestone facts on claim, and commit before reward feedback. Long COT labels wrap within the existing HUD footprint; rarity objectives use canonical rarity colors.
- The mini-quest text backer uses neutral medium grey (#808080) with its existing gradient alpha bytes 85/4d and transparent endpoint; preserve opacity and fade geometry when changing its color.
- `bagUpgradePresentation.mjs` owns the approved menu/reward markup; `bagUpgradeUI.css` follows the measured Canvas scale. Scope upgrade render keys to visible balances/state so unrelated combat receipts cannot detach controls. The reward appears only after a successful saved transaction; both views share the floating CSS rounded-square X and existing fanfare.

- Bag upgrade progress uses the reference `(current/required)` readout without spaces or thousands separators at ordinary values; exact accessible values remain available and large banks use compact notation.

- Bag odds round upward to one decimal only for display; underlying rarity weights remain unchanged.

- Bag comparison arrow alignment measures the visible triangle box and neighboring text bounds after render, stylesheet load and font readiness. Move arrows only; current/next percentage labels remain centered within their respective columns, including on resize.

- Bag close glyphs use actual alpha-pixel bounds, cropped on a DPR-aware Canvas and centered within the square frame. Reuse the UI font-measure context and repaint after stylesheet/font readiness on both views; no font-line-box centering or hardcoded offset.

- `modalClose.mjs` owns the shared slate rounded-square frame, mark and alpha-cropped X painting for Bag and Training Ground. Both consumers supply their Canvas-relative close scale; maintain one style source. Training Ground has one floating close below all window tabs, restores opening focus on click/Escape/programmatic closure and traps Tab while open. Its visible ribbon-to-close-frame block is vertically centered after opening, fonts and resize; preserve all internal training geometry and state.

- Cache opening and disposal recovery show aggregate arrows with full-cache Auto. Explicit item review shows per-item arrows, manual Equip and Back to cache; its controls never invoke full-cache Auto. All lamp readers use lampHeroRoster in authored definition order, and transactions reject incomplete owner records before any save or backup write.
