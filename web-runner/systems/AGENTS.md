# Web Runner Systems DOX

## Purpose
- Own browser runtime systems around rendering, input, local persistence, supergem runtime behavior, dev tooling, and SimulationCore shadow diagnostics.
- Keep presentation and browser integration out of deterministic rule ownership.

## Ownership
- `render*.js` files own Canvas/UI presentation for combat, HUD, map, overlays, and progression shells.
- `renderRuntime.js` owns a large partially purified runtime render path and remains high-risk.
- `inputHandling.js` owns browser pointer/map input helpers.
- `superGemRuntime.js` owns supergem board/effect runtime behavior.
- `heroProgressStorage.js` owns versioned localStorage hero EXP/progression persistence.
- `simulationCoreShadow.js` owns WASM loading, Rust owner markers, shadow checks, and mismatch diagnostics.
- `runtimeAssetUrl.mjs` owns document-base asset resolution and embedded offline JSON/WASM payload lookup; hosted runtime loading remains the default path.
- `devToolingControls.js` and runtime debug helpers own QA/dev surfaces.

## Local Contracts
- Combat initialization consumes supplied hero members through slot 5, preserving sparse formation indexes and instance identity. Catalog size must not cap deployed members; escort and enemy UIDs follow the instantiated heroes. This initializer capacity does not expand the configuration UI or define new hero content.
- Production mixed routine encounters target 30% of starting party CP and remain within a 25–35% party-CP band so the party clears ordinary packs decisively.
- `storyEntryFlow.mjs` owns quest card flow. Confirmed Skip advances within the current card; embedded combat begins immediately. Defeat waits for Continue or Quit; Quit returns to Quests.
- Active combat can leave through the shared navigation at a synchronous frame boundary. Layout snapshots preserve CTB, the current fan and pending target state; Quests uses the existing ladder modal for Continue Battle or Quit Battle, and only Quit clears the combat snapshot and resets a fresh session.
- Narrative rendering preserves the existing two-sentence pages and solo/pair shots. Scene startup, Auto advancement, and layout changes belong to the controller/entry flow, outside `renderNarrativeScene.js`.
- Combat actor orientation must project canonical left-wise anchors through `src/core/combatOrientation.mjs`; mirror actor-attached x offsets, never combat rules or canonical positions. Right-wise actor sprite pixels mirror about each oriented pivot so both teams face inward and asymmetric art remains visually reflected.
- The dev-tool orientation control stages the next combat orientation and uses the existing fresh combat-refresh path when changed during combat; never flip a live combat frame in place.
- Right-wise rendering consumes the shared formation projection: both teams use the same `-40` logical-X translation after reflection, heroes keep canonical Y, and enemy-attached visuals share the one block-Y midpoint-alignment offset. The offset is fixed from structural enemy slot anchors for the combat layout; do not recenter from living entities after death or refill.
- Render modules may read state and draw presentation; they must not become owners of deterministic combat rules.
- Late combat overlays must resolve authored asset dimensions after `assetsLayout` loads, then apply the active layout scale through `combatPresentationScale.mjs`. DOM overlays use that same scale instead of fixed CSS dimensions.
- Developer panels may scroll vertically at compact viewports. Their transformed shells must opt out of flex shrink and finish with 16px physical viewport gutters; every child keeps `scrollWidth <= clientWidth`.
- Quest-QA controls are query-gated and use fixed side-gutter rails from measured Canvas bounds; when gutters are too narrow they use a contained scrollable two-column dock below the diagnostics z-order.
- Quest-QA scenario controls start from one shared fresh-session reset and remain behind the existing dev-tooling pause plus fixture turn hold until explicit QA resume. Opening choices and AF specials keep their production selection callbacks.
- Dev Panel 1 keeps Close in the upper-right header. Its action-button row follows that header and precedes every settings field and dropdown while retaining compact-width wrapping.
- Developer controls overlay the contained game stage; their presence must never reserve viewport width or shrink the Canvas.
- Full-screen Canvas overlays use the 360x640 reference coordinate system and apply the active layout scale once to the whole overlay, including hit zones.
- Combat Canvas text must derive its font size from the active layout scale through `combatPresentationScale.mjs` and fit its measured slot. Desktop font minimums must not override compact Canvas geometry.
- Native hero cards use 5-unit HP fills and 4-unit personal FLOW fills. The shared Astral Flow HUD and pooled health bar are retired.
- Combat must not draw the legacy `radiatorPanels.track` backdrop. The jagged arena-floor asset is the sole ground plane behind combat actors.
- `renderRuntime.js` should shrink over time. Do not add broad new gameplay branches there when a focused render module or gameplay module can own the change.
- `heroProgressStorage.js` may use `window.localStorage`; SimulationCore packets and Rust-owned code must not.
- `simulationCoreShadow.js` must expose stable owner markers for Rust-owned rule families and should surface mismatches as diagnostics, not silent fallbacks.
- Supergem runtime must preserve the product split between hero-specific supergem behavior and skill-card behavior.
- Input gates must respect `CanPickGems`, hero/enemy turn phase, pending skill draught, and presentation barriers.

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

- Fresh encounter initialization clears Astral Flow charge and transient battle conditions through combatSessionReset.mjs. Continue bypasses initialization and preserves them. Gold and persistent progression are outside this reset. PartyHP_Bar supplies geometry only; the live HP renderer owns its sole visible fill.

- Gold is currency persisted by goldProgressStorage.mjs under wishfire.gold.v1. Fresh encounters and resurrection never reset it; balance changes, including spending, are saved locally.

- Map presentation draws terrain first, then independent headings, divider, chapter label, token and START from chapterMapPresentation.mjs. Token hit bounds derive from its draw rectangle. The QUESTS page banner stays visible in both map and ladder phases. The ladder wallet shares its top row; its chapter panel begins below that row. The town token stays at its world position behind ladder cards; it never belongs inside the chapter panel. Only the map-specific chapter label, divider and START hide when the ladder opens. Never bake runtime UI into scenery; only mockups or simulated screenshots may do so.

- Chapter map and quest ladder share identical banner/resource header anchors at reference Y=48. The ladder panel begins at Y=92 and retains a centered title, existing location artwork and completion count. Quest cards keep 56-unit height with thumbnail left, title/energy center and one-time reward right; shared nav remains unchanged.

- Quest resource strip reads live saved gold through getGold from state.globals.goldTotal, followed by resources and energy, identically on map and ladder. Gold changes invalidate the header render. QUESTS banner is 24 reference units high with 13px text.

- Chapter progress counts completed sub-chapter cards of every kind against the entire chapter roster, including unrevealed combat stages. The UI cache must invalidate when the asynchronously populated roster size changes.

- Chapter, story and combat panels use fully opaque fills. Do not reuse the world map as chapter-panel artwork or apply translucent fills that visually merge the panel with terrain.

- Combat-session completion, Quit, or return to Quests clears dev-tool overrides and invalidates pending autoplay work. Continue retains the same session. Reset staged settings and persisted dev config while preserving saved gold.

- Resource Continue restores party HP while preserving energy, encounter progress, buffs and skills.

- Energy is a macro balance: quest entry spends it, combat actions do not. Purple recovery remains active. Combat defeat depends on living heroes; Continue preserves energy.

- Starting macro energy is 200. Stage cards cost 15 per entry; all Main Story cards cost zero and omit the energy row, including embedded combat.

- Combat entry uses a 250ms eased blackout, 500ms black hold, then 1000ms eased reveal. Change layout under black; block pointer input throughout.

- Enemy-target owner wiring serializes six hero records, preserving KO slots for Rust to filter. Pooled HP is diagnostic for combat outcome; fresh-encounter and Continue behavior remain unchanged.

- Combat initialization derives health totals from the initialized actors; it must not overwrite the total with full HP while actors remain injured. Party-damage owner wiring serializes six HP slots with actual member count.

- heroCommandUI.mjs owns decorative hero status cards only. Cards show the cropped portrait, HP and personal AF, with a steady cyan highlight for the scheduled living actor. AF reads canonical personal FLOW and starts each combat at zero. Eligible role actions increase the actor's AF directly once per separately resolved action. Only an enemy KO emits the existing blue gem; it awards AF to its assigned living hero on arrival. Reaching 100 emits a deduped threshold signal that reconciles into the cached special-card queue before any further scheduler action. The retired command editor, native skill buttons, prepared queue controls, Auto, Reload and Menu entrypoints are absent from player presentation. Enemy and ally taps remain owned by the existing battlefield selectors while a targeted fan card is pending. The underlying heroCommands native resolver remains available to the fan and dev autoplay seams.
- heroTurnCardFanUI.mjs presents the three drawn hero cards in a canvas-anchored overlay. Its callbacks use the function-bank fan lifecycle, preserve a cancelled draw for reopen, and interrupt on menu, modal, KO or battle settlement. Targeted cards hand off to the existing battlefield selectors through app integration; the fan owns no target controls. The overlay omits card Energy metadata from presentation. Selection keeps the three button nodes stable, cues the chosen card while the other two fall away, and clears that presentation on interruption without delaying the callback.
- Personal FLOW currency rules belong to heroCommands.mjs and gameplay owners. The old shared meter and portrait milestones have no live HUD wiring. Hero lunges use display slots, so catalog identity does not collapse repeated or later formation positions.
- Prepared commands belong to the combat session and member UIDs. Replacing actor objects while restoring the same session must preserve prepared selections; a new session or changed roster clears them.
- Full-health recovery is owned by questCombatSession.mjs for both Town and Continue. Restore actual hero actors, then project HP through UpdateHeroHPUI; empty groups clear old totals. Continue alone retains its existing turn-restart sequence.

- Hero-card AF fills are blue. Active combat never spends, regenerates, or gates actions on SP.

- `renderHeroScreen.js` consumes canonical hero definitions and owned progression; skill ranks and independent skill-point upgrades are retired. Show all level locks, passives and personal AF.
- `questCombatSession.mjs` presents settled progression before allowing the victory return. Queue settlement and EXP computation remain core/module-owned.
- Player Start enters an endless combat session through `storyEntryFlow.mjs`; it sets `QuestFiniteEncounter` to zero and never inserts Quest Ladder stages or opening dialogue. QA may still reach retained story hooks explicitly.

- Skill taps queue directly. Independent per-hero action slots auto-commit at capacity; ACT ends selection early. Battlefield selection persists; queued targets are snapshots. Removing entries restores reservations.

- renderFlowOrbs.mjs draws gem flights using the actor projection. Collection belongs to the core update; presentation never blocks CTB. Hero detail text describes enemy-death orbs and random distribution.

- Qualifying resolved role actions increase the eligible hero's AF directly. Enemy KOs may emit the one blue AF gem, which assigns its arrival award to a living recipient; no other action emits that gem.

- Enemy targeting triangles render only during hero turns and hide when combat ends. Keep SelectedEnemyUID intact across enemy turns so the next hero retains the player choice.

- Victory results use 80% of the game canvas width and height, centered on that canvas. A separate canvas-sized black shade has 40% opacity; the native modal backdrop is transparent. ResizeObserver keeps panel/shade geometry current and cleanup removes both shade and observer.

- Hero management uses HERO / GEAR / SKILLS with a persistent hero display and roster. Overview shows EXP and three upcoming unlocks; full stats use a disclosure control. Skills separates seven actives, six passives and the unique FLOW special. FLOW copy follows enemy-death orb rules. Gear uses the canonical equipment economy and loadouts.

- equipmentStorage.mjs owns the single persisted Gold/equipment/loadout/market record. Import the legacy Gold value once, serialize purchases/equips with Web Locks, and save before applying mutations to runtime state. Equipment bonuses are derived from owned item IDs and projected to saved heroes and live actors; removing equipment never heals or revives.
- astralMarketUI.mjs replaces the collector at idleFarmLayout. Only the active screen reconstructs/draws offers; leaving checkpoints time without running a hidden simulation. Item inspection never pauses expiration. No collector update/claim path remains.

- Shop background uses an original pearly vertical-ribbon shader with rarity-color blooms following the timed item stream driven by the visible shop draw loop, capped to 360 pixels across and 30 FPS. Reduced motion freezes it; unavailable WebGL uses a static pearl gradient. resourceChrome.mjs shares the existing Quests wallet and curved SVG Back control with the shop; balances read canonical Gold and story-entry resources/energy.

- Shop Back is left-aligned with its bottom five reference pixels above the purchase tray; keep inspection clear of its hit area.
- Quests Back matches that lower screen position: its bottom is -3 reference pixels relative to the screen container ending 78 pixels above the game bottom. The shop presentation test compares both buttons' position and size.

- drawPageBanner in chapterMapPresentation.mjs owns the brass arrow banner shared by Quests and Flow Shop; keep its gradient, outline and typography identical.

- Flow Shop pointer dragging keeps a captured offer ID and uses the same atomic purchase as BUY when dropped into the compact lower tray. Expiration continues while dragging. Pointer cancellation/outside drops never spend. Gear uses rarity tiles and green upgrade badges for unequipped stat-dominant items against the selected hero slots.
- An expired inspected offer disables purchase immediately, fades its details, and restores the default drop-to-buy hint. Selecting another live offer cancels the expired detail state.


- Shared Back chrome uses a single thin gold edge and proportional padding/corner radius; avoid the older thick ridge treatment on Quests.

- Flow Shop preserves the Quests header anchors: banner (0,48,112,24), resources (122,48,230,24) in the 360x640 frame. The stream spans the full game canvas behind the header and purchase controls, with clipping only at the outer screen edges. Do not stack or redistribute the shared header to fit its title.

- Background lights come from live offer progress and rarity data only, anchored at each card's upper edge. Vertical pearl folds carry travelling sheen and narrow iridescent edges; each fold refracts the quality-color wash into its own reflection. Wake color exists only above that edge and fades upward inside its lane. Drag pointer/ghost coordinates never feed shader uniforms or alter stream scheduling.
