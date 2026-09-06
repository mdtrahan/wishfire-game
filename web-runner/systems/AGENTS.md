# Web Runner Systems DOX

## Purpose
- Own browser runtime systems around rendering, input, local persistence, supergem runtime behavior, dev tooling, and SimulationCore shadow diagnostics.
- Keep presentation and browser integration out of deterministic rule ownership.

## Ownership
- `render*.js` files own Canvas/UI presentation for combat, HUD, map, overlays, and progression shells.
- `renderRuntime.js` owns a large partially purified runtime render path and remains high-risk.
- `inputHandling.js` owns browser pointer/map input helpers.
- `superGemRuntime.js` owns supergem board/effect runtime behavior.
- `heroGemProgressStorage.js` owns localStorage-backed hero gem progression persistence.
- `simulationCoreShadow.js` owns WASM loading, Rust owner markers, shadow checks, and mismatch diagnostics.
- `devToolingControls.js` and runtime debug helpers own QA/dev surfaces.

## Local Contracts
- `storyEntryFlow.mjs` owns quest card flow. Confirmed Skip advances within the current card; embedded combat begins immediately. Defeat waits for Continue or Quit; Quit returns to Quests.
- Narrative rendering preserves the existing two-sentence pages and solo/pair shots. Scene startup, Auto advancement, and layout changes belong to the controller/entry flow, outside `renderNarrativeScene.js`.
- Combat actor orientation must project canonical left-wise anchors through `src/core/combatOrientation.mjs`; mirror actor-attached x offsets, never combat rules or canonical positions. Right-wise actor sprite pixels mirror about each oriented pivot so both teams face inward and asymmetric art remains visually reflected.
- The dev-tool orientation control stages the next combat orientation and uses the existing fresh combat-refresh path when changed during combat; never flip a live combat frame in place.
- Right-wise rendering consumes the shared formation projection: both teams use the same `-40` logical-X translation after reflection, heroes keep canonical Y, and enemy-attached visuals share the one block-Y midpoint-alignment offset. The offset is fixed from structural enemy slot anchors for the combat layout; do not recenter from living entities after death or refill.
- Render modules may read state and draw presentation; they must not become owners of deterministic combat rules.
- Late combat overlays must resolve authored asset dimensions after `assetsLayout` loads, then apply the active layout scale through `combatPresentationScale.mjs`. DOM overlays use that same scale instead of fixed CSS dimensions.
- Developer panels may scroll vertically at compact viewports. Their transformed shells must opt out of flex shrink and finish with 16px physical viewport gutters; every child keeps `scrollWidth <= clientWidth`.
- Dev Panel 1 keeps Close in the upper-right header. Its action-button row follows that header and precedes every settings field and dropdown while retaining compact-width wrapping.
- Developer controls overlay the contained game stage; their presence must never reserve viewport width or shrink the Canvas.
- Full-screen Canvas overlays use the 360x640 reference coordinate system and apply the active layout scale once to the whole overlay, including hit zones.
- Combat Canvas text must derive its font size from the active layout scale through `combatPresentationScale.mjs` and fit its measured slot. Desktop font minimums must not override compact Canvas geometry.
- Party Health and Astral Flow progress fills use an 8-unit reference height before layout scaling.
- Combat must not draw the legacy `radiatorPanels.track` backdrop. The jagged arena-floor asset is the sole ground plane behind combat actors.
- `renderRuntime.js` should shrink over time. Do not add broad new gameplay branches there when a focused render module or gameplay module can own the change.
- `heroGemProgressStorage.js` may use `window.localStorage`; SimulationCore packets and Rust-owned code must not.
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
