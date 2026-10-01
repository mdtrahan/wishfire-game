# Web Runner Assets DOX

## Purpose
- Own runtime data and media consumed by the browser runner.
- Keep generated and hand-authored runtime assets from becoming hidden gameplay-code owners.

## Ownership
- `layouts.json`, `objectTypes.json`, and `enemies.json` are structured runtime data.
- `simulation_core.wasm` is generated from `rust/simulation_core/`.
- `images/`, `gems/`, and `fonts/` are presentation assets referenced by render/runtime code and tests.

## Local Contracts
- `images/lamp/ART.md` records original gear/device atlas hashes and grid order. Rarity is conveyed separately through white/green/blue/purple/gold frames/glow. Collector cells are unused; only the shared lamp appears in acquisition UI.
- `narrative/characters/` contains the existing Hondo, Fara, Kaja, and Runa scene sprites. Content character IDs resolve these filenames through the narrative renderer; the opening uses the existing solo/pair shot contract.
- Do not hand-edit `simulation_core.wasm`; rebuild it with `npm run rust:build-wasm`.
- Treat `layouts.json` as large structured data from the retired Construct surface. Use JSON-aware edits and keep gameplay rules in code/product docs.
- Asset filenames are often referenced directly by render code and tests; rename only with a full reference search.
- Hero art files use the current display names `Fara.png`, `Hondo.png`, `Runa.png`, and `Kaja.png`; they are transparent full-body combat sprites. Legacy hero IDs resolve through `state/heroArtAssets.mjs` and never own filenames.
- Battlefield selectors have no raster assets; actor readiness and enemy targeting are state-owned and render no marker.
- Do not store secrets or environment-specific paths in assets.

## Work Guidance
- For enemy/data changes, verify the runtime loader and tests that consume the data.
- For image/font changes, run visual/browser QA if the changed asset is visible in `web-runner`.
- For layout JSON changes, keep diffs as narrow as possible and validate JSON parseability.

## Verification
- `node --test` focused tests for consumers of changed data.
- `npm run rust:build-wasm` after Rust changes that regenerate `simulation_core.wasm`.
- Browser visual QA for visible asset or layout changes.

## Child DOX Index
- None.

- `narrative/chapter-1-map.png` is a terrain-only 360x640 background. `chapter-town-token.png` is a separate transparent token; chapterMapPresentation.mjs owns overlay positions and labels.

- Navigation badges in images/navigation are transparent 128px object-only illustrations designed to read at 40–50px: bold silhouettes, broad color blocks, minimal interior detail; preserve six labels and hide the shared menu during dialogue. Generation prompts accompany the assets.

- Never bake UI into gameplay backgrounds: headings, dividers, chapter labels, map tokens and buttons must be independent rendered layers. Baked UI is allowed only in mockups or simulated screenshots.
- Combat VFX rasters use transparent backgrounds, bold silhouettes, broad color blocks and minimal interior detail so their impression reads during sub-second attacks.
- `elemental-impact/` contains approved one-shot skill impact flipbooks. Load frames on first use; keep the manifest timing and transparent frame canvases intact.
- `images/boss_button.png` is the 50px combat boss control graphic rendered at reference-canvas X 150, Y 50.

- Lamp item stats occupy the full candidate width with fixed label tracks and left-aligned values. Keep six-digit values contained and preserve the enlarged comparison type across phone widths.

- Pending gear tiles use rarity-colored backgrounds; the currently compared item alone carries a gold selection halo and aria-current. Five columns of square art with compact item-CP footers fill the equip frame; selection and arrivals preserve the one-and-a-half-row viewport. The separate dismantling view has three-and-a-half inert rows and shows resources only after confirmation.

- Hero Gear Upgrade idle guidance uses the Hondo-inspired blue pointer and cyan rings: 15 seconds since input points to Hondo (Huun), or Auto-Equip after portrait selection. Document pointer/click, key and wheel input dismisses and resets it. Hidden/closed/busy review suppresses guidance; the overlay never intercepts input.

- Lamp progression: manual/Auto draws grant all four heroes saved EXP, with cumulative receipts and per-hero lampEXPClaimed replay. Enemy rewards grant zero new EXP/Gold. Auto requires all four Lv5, switches off at capacity, and requires explicit restart. Dismantling essence upgrades lamp levels 1–4, raising capacity 20/30/40/50 and rarity odds. The lower-right level disc/bar opens current/next bonuses and cost; no Gold is used. Strip arrivals omit rarity initials while review retains them. The blue speech counter opens storage; lamp taps generate. The strip disc/bar shows the lowest party hero level and its current EXP toward the next level; leftover EXP resets the bar on level-up. Lamp tier, essence and upgrade costs remain in the upgrade modal. The disc label is Party to distinguish these systems.

- Equip feedback animates only the saved CP value. Keep hero art stationary and name the recipient in the accessible status announcement.

- Emission tilts the existing lamp art only. Newly revealed gear follows the supplied puff, then scales upward through a short overshoot and settles at full size/opacity. The current lamp retains its tilt.

- Every raw emission tilts the lamp and pops its newest arrival; CP selection occurs in equip review. Persisted five-item arrival history remains independent of review/dismantling routing.

- Gear review displays stats in HP, ATK, DEF, MAG, RES order. Candidate HP occupies its first row above the two-column attack/defense stats; presentation order does not change saved rolls.

- Confirmed dismantling closes the item modal and shows a passive essence reward strip with one original orb and the saved awarded total. Hold three seconds, fade over 250ms, remove automatically. No Close/Continue control; pointer events pass through to combat. Failed saves never show rewards.

- CP floats retain an 18px font inside each portrait's width. Allow the CP label and value to wrap, so simultaneous Auto gains stay separated on narrow phones. Portrait art remains stationary.

- Strip presentation uses supplied transparent lamp/puff rasters. Manual and Auto share one puff-before-bounce emission path. Larger five-position gear art retains quality glow and item level; AUTO is upper-left with on/off/locked pills. Controls and strip remain anchored to the existing 360×640 Canvas frame.

- Emission puff holds at full opacity for roughly 585ms and fades by 900ms. Gear appears after roughly 650ms, grows from 65% through a 115% upward overshoot, then settles at 100% by 1.35s. Keep the emission class alive 1.45s for both manual and Auto; the saved two-second draw gate is unchanged.

- Lamp-strip comparison anchors use the strip coordinate space rather than the flexible side group. AUTO follows the reference upper-left anchor; the cache bubble aligns at the upper-right. Arrival group scales 95% about its left-center, then shifts right 1.42em (25px at the 1.6× natural preview); its Y anchor and the lamp controls stay fixed. Arrival cells use a 1.05em gap and centered 112.1% art (5% smaller than the previous 118% art) to give icons breathing room. Keep the level disc circular with an explicit width so text cannot stretch it, and place the progress pill's full left corner beneath it. `output/qa/lamp-check-alignment.cjs` enforces the corrected anchors at four phone widths.
