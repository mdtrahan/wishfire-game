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

- Pending gear tiles use rarity-colored backgrounds; the currently compared item alone carries a gold selection halo and aria-current. Five columns of square art with compact item-CP footers fill the equip frame; selection and arrivals preserve the two-to-two-and-a-half-row viewport. The separate dismantling view has three-and-a-half inert rows and shows resources only after confirmation.

- Hero Gear Upgrade idle guidance uses the Hondo-inspired blue pointer and cyan rings: 15 seconds since input points to Hondo (Huun), or Auto-Equip after portrait selection. Document pointer/click, key and wheel input dismisses and resets it. Hidden/busy surfaces, active reward banners and the completed strip tutorial suppress guidance; the overlay never intercepts input.

- Lamp draws preserve the configured saved party EXP and timing. Essence is a bank, never a level calculation: each earned lamp level requires four explicitly purchased stages, then seven-hour construction and automatic completion. `capacityTier` is level minus one; optional v5 `upgradeStage` defaults to zero. Levels 1–100 interpolate the original initial/final rarity odds; capacities remain 20/30/40/50 at levels 1/2/3/4+. Future gear gains 0.5% linear stat scaling per map ordinal. Saved gear rolls, hero EXP and earned lamp levels remain intact.

- Equip feedback animates only the saved CP value. Keep hero art stationary and name the recipient in the accessible status announcement.

- Emission tilts the existing lamp art only. Newly revealed gear follows the supplied puff, then scales upward through a short overshoot and settles at full size/opacity. The current lamp retains its tilt.

- Every raw emission tilts the lamp and pops its newest arrival; CP selection occurs in equip review. Persisted five-item arrival history remains independent of review/dismantling routing.

- Gear review displays stats in HP, ATK, DEF, MAG, RES order. Candidate stats occupy three columns: HP/ATK/DEF followed by MAG/RES; presentation order does not change saved rolls.

- Confirmed dismantling closes the item modal and shows a passive essence reward strip with one original orb and the saved awarded total. Hold three seconds, fade over 250ms, remove automatically. No Close/Continue control; pointer events pass through to combat. Failed saves never show rewards.

- CP floats retain an 18px font inside each portrait's width. Allow the CP label and value to wrap, so simultaneous Auto gains stay separated on narrow phones. Portrait art remains stationary.

- Strip presentation uses supplied transparent lamp/puff rasters. Manual and Auto share one puff-before-bounce emission path. Larger five-position gear art retains quality glow and item level; AUTO is upper-left with on/off/locked pills. Controls and strip remain anchored to the existing 360×640 Canvas frame.

- Emission puff holds at full opacity for roughly 585ms and fades by 900ms. Gear appears after roughly 650ms, grows from 65% through a 115% upward overshoot, then settles at 100% by 1.35s. Keep the emission class alive 1.45s for both manual and Auto; the saved two-second draw gate is unchanged.

- Lamp-strip comparison anchors use the strip coordinate space rather than the flexible side group. AUTO follows the reference upper-left anchor; the cache bubble aligns at the upper-right. Arrival group scales 95% about its left-center, then shifts right 1.42em (25px at the 1.6× natural preview); its Y anchor and the lamp controls stay fixed. Arrival cells use a 1.05em gap and centered 112.1% art (5% smaller than the previous 118% art) to give icons breathing room. Keep the level disc circular with an explicit width so text cannot stretch it, and place the progress pill's full left corner beneath it. `output/qa/lamp-check-alignment.cjs` enforces the corrected anchors at four phone widths.

- Helper hand direction and ring diameter follow the target’s distance from viewport edges. Preserve the supplied blue art, bob and ring timing; only decorative orientation/bounds adapt, with strip/modal geometry unchanged. `test:lamp-ui` checks every new target over animation frames and runs on staged lamp presentation owners.

- The rounded selected-item card groups identity and five stats. Current gear comparisons use selected-hero stat arrows; equality has no indicator. Direct portrait/cache selection replaces Previous/Next and the inline Dismantle link. Finish review through Skip/Auto-Equip before dismantling confirmation.

- Lamp modals stack above fixed DEV launchers (10000); idle guidance stacks above the modal and remains pointer-transparent. Close must receive a pointer at its center while saved CP feedback is active.

- CP feedback positions are absolute within the fixed lamp overlay, so modal offsets never shift receipts away from their hero. Preserve18px type and1.8-second animation.

- Lamp readiness uses 80% image brightness whenever its shared reveal button is disabled. Let supplied smoke paint above the fixed 92 logical-pixel strip; preserve control anchors and horizontal containment.

- Lamp cache review follows a 4/8px internal rhythm, rounded bordered identity/stat card and three-column stats. The equip frame has no master scrollbar; only its five-column inventory scrolls and exposes two to two-and-a-half rows across the phone profiles. CP direction glyphs use green up/red down; equal stats/CP omit glyphs.

- Nonempty equip notices, including save failures, stay visible as compact callouts above the action row without consuming inventory height. Empty notices reserve no space.

- Comparison CP arrows use a single pointed apex; preserve their bounds and direction colors. The selected-stat Canvas renderer shares this silhouette.

- Selected-item identity bands retain the shared rarity palette through --rarity. Removing corner rarity letters never removes color cues.

- Selected-item stat groups span the centered card content width. Both rows share six equal label/value subgrid tracks; right-align labels, separate each value by roughly one stat digit width and reserve flexible value tracks for larger numbers.

- Cache/card frames center visible artwork vertically, excluding near-transparent atlas bleed. Strip sprites translate separately from their fixed level badges to the tallest arrival's shared midpoint; the final bounce transform is zero. Preserve square art space, CP footers, scale and the original raster.

- Selected equip-cache artwork undulates from100% to94% and back over1.6 seconds, centered inside its fixed tile. The gold outer halo uses4.92px blur/2.46px spread,23% above the prior4px/2px; reduced motion retains this static halo.

- Lamp odds keep equal numeric weight across Current/Next and reserve 40% of table width for quality names; three-decimal percentages must fit each cell on compact phones. The odds viewport may scroll vertically while purchase controls remain visible.

- Construction replaces the stage/flame card with a centered tabular countdown. SPD UP ALL uses the blue alternate button state below it; zero tickets disables it. Keep the card and countdown centered at compact and reference widths.

- `puppets/` holds the Fara/Gobloc layered source pilot and Synfig-authored clips. Preserve original static hero/enemy sprites. Native bone sources export transparent PNG frames; runtime metadata owns presentation cadence and foot origins only. Opposite facing uses documented mirrored source until authored coverage replaces it.
- Puppet action clips must read at their battlefield size through anticipation, a target-directed strike or outward release, and recovery. Hurt requires a distinct recoil silhouette. Judge motion independently from neutral source coverage.
