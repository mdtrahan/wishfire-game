# Web Runner Systems DOX

## Purpose
- Own browser runtime systems around rendering, input, local persistence, supergem runtime behavior, dev tooling, and SimulationCore shadow diagnostics.
- Keep presentation and browser integration out of deterministic rule ownership.

## Ownership
- `render*.js` files own Canvas/UI presentation for combat, HUD, map, overlays, and progression shells.
- `renderRuntime.js` owns a large partially purified runtime render path and remains high-risk.
- `combatSimulationTick.mjs` owns the frozen-aware combat clock, queued hero impacts, independently scheduled hero/enemy actions, action presentation, status/effect timing, and reward settlement; renderers consume prepared state and presentation events.
- `inputHandling.js` owns browser pointer/map input helpers.
- `superGemRuntime.js` owns supergem board/effect runtime behavior.
- `heroProgressStorage.js` owns versioned localStorage hero EXP/progression persistence.
- `simulationCoreShadow.js` owns WASM loading, Rust owner markers, shadow checks, and mismatch diagnostics.
- `runtimeAssetUrl.mjs` owns document-base asset resolution and embedded offline JSON/WASM payload lookup; hosted runtime loading remains the default path.
- `devToolingControls.js` and runtime debug helpers own QA/dev surfaces.

## Local Contracts
- Lamp equipment commits one v4 record before changing runtime Gold, exact rolls or loadouts. Preserve old save records on migration/error. Equip applies canonical stats without healing. The comparison keeps four portrait recipients and their changes above the candidate; inspection must leave combat advancing.
- `combatAttackVfxPresentation.mjs` lazily requests elemental impact flipbooks by skill slug and centers their one-shot frame on the queued target point; keep the rendered canvas within 52 logical pixels at layout scale 1.
- `combatSimulationTick.mjs` ages and expires damage text on simulation time; `renderRuntime.js` only spawns its DOM presentation. Damage text must clear so the continuous-stage boss gate can advance.
- Combat initialization consumes supplied hero members through slot 5, preserving sparse formation indexes and instance identity. Catalog size must not cap deployed members; escort and enemy UIDs follow the instantiated heroes. This initializer capacity does not expand the configuration UI or define new hero content.
- Production mixed encounters draw only fodder/routine catalog tiers and remain within a 13–18% party-CP band so the party clears ordinary packs decisively; hard, elite and boss tiers require an explicit encounter policy.
- Production, orientation, and developer QA entry use the authored continuous stage adapter: four repeating fodder waves unlock each boss, an armed boss clear advances to the next stage, and stage ten advances the region. Heroes and each engaged enemy schedule independently; no entry variant dispatches turn initiative.
- Pending hero hits in production may retarget after a death only to living enemies already inside the hero attack range; renderer fallback must agree with the shared focus rule.
- Refill bounce, YellowCasino progression and payout, BlueBuff logical completion, buff-icon phase transitions, and gem-merge payout/gate release advance from simulation time without drawing. YellowCasino's ghost remains a presentation read in `renderBoard.js`.
- Continuous combat is the automatic action owner. The app asks the Rust-owned combat outcome resolver after scheduled combat work; continuous defeat settles rewards, resets the stage gate, restores heroes, and resumes from wave one with `QuestFiniteEncounter=1` so legacy slot refill stays disabled. Every paused/background/defeat frame resets the simulation timestamp and performs no simulation work; resume starts with a bounded first step.
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
- Combat draws neither the legacy `radiatorPanels.track` backdrop nor the `EnemyArea` texture. The `EnemyArea` layer position triggers one full-canvas logical reference grid behind combat actors.
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
- Combat home geometry uses the shared 360-wide arena contract. Hero sprites stop at visible X 106; hero and enemy spawn/home sprites fit within visible Y 170-375. The highest hero HP bar begins below grid Y 150. Temporary action animation may leave that Y band.
- The combat boss control is hidden during normal waves. At the boss gate its 50x50 graphic is centered on the game grid's horizontal midpoint, X 180, and vertically centered on Y 50. Its draw and pointer boxes use the same `worldToCanvas` projection as the reference grid.
- Cooldown and readiness rules belong to the deterministic combat owners. Hero lunges use display slots, so catalog identity does not collapse repeated or later formation positions.
- Prepared commands belong to the combat session and member UIDs. Replacing actor objects while restoring the same session must preserve prepared selections; a new session or changed roster clears them.
- Full-health recovery is owned by questCombatSession.mjs for both Town and Continue. Restore actual hero actors, then project HP through UpdateHeroHPUI; empty groups clear old totals. Continue resumes the same encounter with its realtime cooldown/effect state.

- Active production combat has no SP or FLOW resource gates or gauges. Skill readiness is cooldown-owned.

- `renderHeroScreen.js` consumes canonical hero definitions and owned progression; each hero presents a basic attack and five active skills without unlock/rank/passive categories.
- `questCombatSession.mjs` presents settled progression before allowing the victory return. Queue settlement and EXP computation remain core/module-owned.
- Player Start enters an endless combat session through `storyEntryFlow.mjs`; it sets `QuestFiniteEncounter` to zero and never inserts Quest Ladder stages or opening dialogue. QA may still reach retained story hooks explicitly.

- Skill taps queue directly. Independent per-hero action slots auto-commit at capacity; ACT ends selection early. Battlefield selection persists; queued targets are snapshots. Removing entries restores reservations.

- renderFlowOrbs.mjs draws the shared 520ms gem flight using the actor projection. Collection belongs to the core update at impact; presentation never blocks CTB. Hero detail text describes enemy-death orbs and random distribution.


- Battlefield actor and enemy selectors are retired. Keep `SelectedEnemyUID` and target ownership intact so cooldown actions retain valid targets without drawing a marker.

- Victory results use 80% of the game canvas width and height, centered on that canvas. A separate canvas-sized black shade has 40% opacity; the native modal backdrop is transparent. ResizeObserver keeps panel/shade geometry current and cleanup removes both shade and observer.

- Hero management uses HERO / GEAR / SKILLS with a persistent hero display and roster. Overview shows EXP and full stats through a disclosure control. Skills presents one basic attack and five active skills. Gear uses the canonical equipment economy and loadouts.

- equipmentStorage.mjs owns the v5 lamp/equipment record and Web Lock transactions. Commit exact rolls, assignments, essence and cumulative EXP before projecting onto saved heroes and live actors. Each hero saves lampEXPClaimed to replay a missing grant once.
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

- The item selector offers immediate Auto Equip through the same atomic transaction as manual equip; it greedily assigns the top four qualifying items with at most one per hero before permanently routing the remaining gear to Dismantle All.

- Lamp gear illustrations carry the rarity initial C/U/R/E/L in addition to quality color and full rarity text. Item level remains separate from rarity.


- Pending gear fills five equal square columns across the review frame. Its scrolling viewport exposes one-and-a-half rows at each phone width; incoming rolls and recipient selection preserve frame height and scroll position.

- Equip returns saved permanent CP before/after/change; only the CP value floats after successful persistence, anchored at the stationary recipient portrait, and reports positive, zero or negative values honestly. HP gear raises max HP without healing or reviving. v3 migrates to v5 with HP zero, preserving previous stat rolls and source records.

- Pending gear tiles use rarity-colored backgrounds; the currently compared item alone carries a gold selection halo and aria-current. Selection preserves the fixed queue dimensions.

- Hero Gear Upgrade idle guidance uses the Hondo-inspired blue pointer and cyan rings: 15 seconds since input points to Hondo (Huun), or Auto-Equip after portrait selection. Document pointer/click, key and wheel input dismisses and resets it. Hidden/closed/busy review suppresses guidance; the overlay never intercepts input.

- Lamp progression: manual/Auto draws grant all four heroes saved EXP, with cumulative receipts and per-hero lampEXPClaimed replay. Enemy rewards grant zero new EXP/Gold. Auto requires all four Lv5, switches off at capacity, and requires explicit restart. Dismantling essence upgrades lamp levels 1–4, raising capacity 20/30/40/50 and rarity odds. The lower-right level disc/bar opens current/next bonuses and cost; no Gold is used. Strip arrivals omit rarity initials while review retains them. The blue speech counter opens storage; lamp taps generate. The progress bar measures saved essence toward the next upgrade and the disc shows the current tier.

- Lamp burp presentation clears its trigger at animation completion so unrelated review renders do not repeat emission. Manual and Auto share the same current-lamp tilt and gear pop tween.

- Raw lamp emissions append every roll without CP filtering. lamp.recent preserves the last five emission snapshots independently of equip/collection routing. Equip review sorts descending lampGearCP, derived from the shared CP evaluator using gear stats at neutral level 1; item level already scales those stats. Auto silently selects the top four slot-CP upgrades, greedily assigns at most one per hero, and also requires positive actual hero CP gain. Ties use lowest max HP then party order. Manual equip permits lower-CP overrides. Auto completion or finishing review moves all remaining pending pieces permanently into lamp.discarded. Dismantle All has an inert item grid, no rescue/review/equip controls and no resource amount before confirmation. Confirmed conversion grants essence only and shows its receipt. Later raw arrivals remain separate from the confirmed pile. Capacity includes pending, discarded and historical aggregate credits; full storage stops Auto/EXP. Optional recent/discarded fields preserve supported older v5 saves.

- Gear review displays stats in HP, ATK, DEF, MAG, RES order. Candidate HP occupies its first row above the two-column attack/defense stats; presentation order does not change saved rolls.

- Equip releases its save/action guard before the 1.8-second CP float finishes, allowing immediate recipient and item selection. Only the final review transition or modal close waits for all active floats; feedback stays inside the modal.

- Every successful lamp emission shares a saved two-second minimum interval. The core rejects early calls before rolling or granting EXP; UI disables/re-enables the lamp from that saved cooldown. Auto keeps its five-second cadence. Reloads, concurrent clicks and switching manual/Auto cannot reset the gate.

- Dismantling grants essence only. It never changes cumulative party EXP, hero EXP/levels or emits an EXP float; only post-confirmation receipts show essence. Lamp emissions remain the EXP source.

- Confirmed dismantling closes the item modal and shows a passive essence reward strip with one original orb and the saved awarded total. Hold three seconds, fade over 250ms, remove automatically. No Close/Continue control; pointer events pass through to combat. Failed saves never show rewards.

- Empty lamp storage opens no review/dismantling modal. Finishing a review with no remaining pieces closes after CP feedback; lamp upgrades still open independently of storage count.

- Equip and Auto restore the portrait row before measuring CP feedback anchors. Validate the equip → dismantle → passive reward → next equip sequence through player controls and recorded visual evidence before presentation handoff.

- Game boot restores the saved cache, EXP and loadouts while switching Auto off in the first durable transaction. Arrival positions display only emission sequences at or after the UI session baseline; gear sequence is zero-based while the saved lamp sequence counts completed emissions. Reload starts an empty strip and requires a fresh unlocked Auto toggle.

- Arrival illustrations display only session emissions still in pending or discarded storage. Equipped and confirmed-dismantled pieces disappear from the strip; a zero cache leaves all five positions empty. Historical emission snapshots remain saved independently.

- Strip presentation uses supplied transparent lamp/puff rasters. Manual and Auto share one puff-before-bounce emission path. Larger five-position gear art retains quality glow and item level; AUTO is upper-left with on/off/locked pills. Controls and strip remain anchored to the existing 360×640 Canvas frame.

- Emission puff holds at full opacity for roughly 585ms and fades by 900ms. Gear appears after roughly 650ms, grows from 65% through a 115% upward overshoot, then settles at 100% by 1.35s. Keep the emission class alive 1.45s for both manual and Auto; the saved two-second draw gate is unchanged.

- CP receipt lifetime never holds the durable action lock or freezes ordinary recipient/item selection. Track concurrent receipt elements; only final review/close waits for all receipts, keeping feedback inside the modal. Collection entry awaits any in-flight transaction, storage sync and decoded shared gear atlas, then renders the full sorted cache together. Auto generation pauses while collection is opening/open and resumes afterward when enabled.

- Strip party progress reads currentLevel/currentEXP/EXPToNextLevel from the lowest-level hero. Include EXP in the render key so every draw updates the meter. Manual and Auto share level-up feedback; preserve leftover EXP rather than showing a full meter after a level increase. Lamp tier/essence are a separate upgrade-modal display.

- Lamp upgrade preview shows current/next rarity odds, increased percentages, capacity, exact cost, balance and shortfall; final tier displays MAX. Confirmation passes the rendered tier to equipmentStorage, whose locked transaction rejects stale confirmations before spending. Verify hero EXP separately from the combat reward ledger because combat continues while the modal is open.

- The lamp helper extends the15-second idle threshold through draw, collection, Hondo comparison, equip, dismantle and free/affordable upgrade preview. Retarget disabled controls to useful enabled actions; hide during reward banners and after a completed upgrade loop outside review. Any input dismisses it. Guide receipts persist once through the existing locked equipment transaction.

- Lamp recipient previews use lampItemCPGain for signed total hero CP changes. Previous/Next reuse hero selection and wrap the four portrait recipients; current matching-slot gear is identified before confirmation. These UI reads do not repair canonical versus combat-instance ownership.

- Concurrent saved CP receipts use their measured wrapped heights and34px spacing for32px animation travel. Place each hero column in modal coordinates under its stationary portrait; keep ordinary rapid bursts within the visible modal.
