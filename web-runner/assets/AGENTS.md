# Web Runner Assets DOX

## Purpose
- Own runtime data and media consumed by the browser runner.
- Keep generated and hand-authored runtime assets from becoming hidden gameplay-code owners.

## Ownership
- `layouts.json`, `objectTypes.json`, and `enemies.json` are structured runtime data.
- `simulation_core.wasm` is generated from `rust/simulation_core/`.
- `images/`, `gems/`, and `fonts/` are presentation assets referenced by render/runtime code and tests.

## Local Contracts
- `arenas/` owns muted original Genielands panoramas for chapters 1–4 and their generation prompts. Keep open combat ground, scenery at edges, and UI independent. Chapter 5 onward has no arena art assignment.
- `images/lamp/ART.md` records original gear/device atlas hashes and grid order. Rarity is conveyed separately through white/green/blue/purple/gold frames/glow. Collector cells are unused; only the shared lamp appears in acquisition UI.
- The `.lamp-level` badge is shared by lamp equipment and equipped hero gear art; keep its lower-right placement and legibility sizing consistent across both.
- `narrative/characters/` contains the existing Hondo, Fara, Kaja, and Runa scene sprites. Content character IDs resolve these filenames through the narrative renderer; the opening uses the existing solo/pair shot contract.
- Do not hand-edit `simulation_core.wasm`; rebuild it with `npm run rust:build-wasm`.
- Treat `layouts.json` as large structured data from the retired Construct surface. Use JSON-aware edits and keep gameplay rules in code/product docs.
- Asset filenames are often referenced directly by render code and tests; rename only with a full reference search.
- Hero art files use the current display names `Fara.png`, `Hondo.png`, `Runa.png`, and `Kaja.png`; they are transparent full-body portraits; combat actors consume puppet packages. Legacy hero IDs resolve through `state/heroArtAssets.mjs` and never own filenames.
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
- `puppets/hondo/AGENTS.md` - shared pilot rig and character-painted source.
- `puppets/kaja/AGENTS.md` - shared pilot rig and character-painted source.
- `puppets/chimerilass/AGENTS.md` - actor source geometry, identity and native motion contracts.
- `puppets/highgobloc/AGENTS.md` - actor source geometry, identity and native motion contracts.
- `puppets/lizardo/AGENTS.md` - actor source geometry, identity and native motion contracts.
- `puppets/marid/AGENTS.md` - actor source geometry, identity and native motion contracts.
- `puppets/orc/AGENTS.md` - actor source geometry, identity and native motion contracts.
- `puppets/runa/AGENTS.md` - actor source geometry, identity and native motion contracts.
- `puppets/skeleton/AGENTS.md` - actor source geometry, identity and native motion contracts.
- `puppets/troll/AGENTS.md` - actor source geometry, identity and native motion contracts.
- `puppets/djinn/AGENTS.md` - recovered native Djinn source and complete runtime export contract.
- `puppets/highorc/AGENTS.md` - recovered High Orc source, authored sword actions and complete runtime export contract.

- `narrative/chapter-1-map.png` is a terrain-only 360x640 background. `chapter-town-token.png` is a separate transparent token; chapterMapPresentation.mjs owns overlay positions and labels.

- Navigation badges in images/navigation are transparent 128px object-only illustrations designed to read at 40–50px: bold silhouettes, broad color blocks, minimal interior detail; preserve six labels and hide the shared menu during dialogue. Generation prompts accompany the assets.

- Never bake UI into gameplay backgrounds: headings, dividers, chapter labels, map tokens and buttons must be independent rendered layers. Baked UI is allowed only in mockups or simulated screenshots.
- Combat VFX rasters use transparent backgrounds, bold silhouettes, broad color blocks and minimal interior detail so their impression reads during sub-second attacks.
- `elemental-impact/` contains approved one-shot skill impact flipbooks. Load frames on first use; keep the manifest timing and transparent frame canvases intact.
- `images/boss_button.png` is the 50px combat boss control graphic rendered at reference-canvas X 150, Y 50.

- Lamp item stats occupy the full candidate width with fixed label tracks and left-aligned values. Keep six-digit values contained and preserve the enlarged comparison type across phone widths.

- Pending and discarded gear tiles use rarity-colored backgrounds; the currently compared item alone carries a gold selection halo and aria-current. Positive total-hero CP gain uses a contained green arrow on every eligible queued tile, with a solid black offset shadow and no pale glow. Five columns of square art with compact item-CP footers fill the equip frame; selection and arrivals preserve the two-to-two-and-a-half-row viewport. The dismantling view keeps queued tiles inspectable and shows resources only after confirmation.

- Hero Gear Upgrade idle guidance uses the Hondo-inspired blue pointer and cyan rings: 15 seconds since input points to Hondo (Huun), or Auto-Equip after portrait selection. Document pointer/click, key and wheel input dismisses and resets it. Hidden/busy surfaces, active reward banners and the completed strip tutorial suppress guidance; the overlay never intercepts input.

- Bag progression keeps Essence in its existing bank. One explicit full-cost Level Up grants the next earned level immediately after persistence; no installments, construction timer or speed-up action remain. Bank growth never promotes automatically. Capacity, odds, gear rolls, hero EXP and draw cadence retain current tuning.

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

- Bag odds retain equal numeric weight and percentages rounded upward to one decimal inside full-width colored pills, with 5px extra scaled left padding on rarity labels; only their viewport may scroll if needed. Keep level/action controls, the separate probability footer and shared close fully contained at reference and compact widths.
- When the shared boss fallback is visible over an open lamp modal, `#lamp-overlay` reserves the measured fallback bottom plus gutter above `#lamp-dialog`, including centered letterbox offset; the dialog remains scrollable within the reduced space, and lamp close remains gated by in-flight receipts.

- Bag upgrade and completion windows share one slate rounded-square control with the existing X glyph cropped to actual painted pixel bounds and centered inside it; retain its colors. It floats below the complete window/footer with a visible scaled gap. Completion ends closely beneath Bag Capacity X > Y, with original bag art and fanfare, one close control and no odds, Continue or extra notes.

- `puppets/` holds independently accepted layered actor sources and Synfig-authored clips. Adopt each roster entry only after its source and seven-state motion gates pass; final assembled acceptance remains separate. Keep rejected/native QA recovery in task checkpoints instead of the active asset tree. Preserve original static hero/enemy sprites. Native bone sources export transparent PNG frames; runtime metadata owns presentation cadence and foot origins only. Opposite facing uses documented mirrored source until authored coverage replaces it.
- Puppet action clips must read at their battlefield size through anticipation, a target-directed strike or outward release, and recovery. Hurt requires a distinct recoil silhouette. Judge motion independently from neutral source coverage.
- Nonzero basic/cast torso anticipation channels lean toward the target in the actor's authored facing at 60% of the prior angular amplitude. Keep facing cadence, foot origins, impact/release markers and identity art fixed; zero torso channels stay zero, while hurt and KO recoil remain independently authored.

- Hondo and Kaja share Fara's fifteen-bone rig and fourteen paint slots. Character repainting stays within this common chibi silhouette; retain joints, pivots and motion channels. Canonical source and exported states remain presentation-only.

- Current combat strip uses images/lamp/equipment-bag.png. Progression resource/stat/ticket assets and Training Ground scene are approved raster art; resource consumers display the matching icon and yellow held / white required amounts. Preserve Bag wish-ring styling, center emission, randomized sizes and directions, and current bounce timing.

- Every authored enemy must have all seven states in both facings in `puppets/manifest.json`; combat has no static-art fallback.

- Conveyor empty spacing is measured between the full 112.1% artwork bounds. Preserve the five-second emission rate and art size; the visible gap is 60% of the previous `.6*.7` gap. `data-conveyor-paused=true` freezes travel with the creation gate.

- images/boss-hud contains generated transparent raster boss, clock and inspect icons; ART.md records provenance. They serve the active battle HUD independently from the chapter rail and summon control.
- Preserve embedded color profiles when matching owner references; convert sampled colors to CSS sRGB rather than copying raw RGB from a display-profile PNG. The Bag menu palette and provenance are recorded in `images/ui/ART.md`.

- Bag progress follows the owner sample: thin straight-ended rectangular meter at 17.28px reference height, outlined readout at 13.2px reference scale centered across it with a 2px outer outline (4px centered stroke painted beneath the white fill), and prominent rounded diamonds at both ends. Keep diamonds unscaled after rotation; shrinking the whole badge also shrinks its numeral. Preserve these proportions in the five-profile Bag browser guard.

- Bag rarity pills are authored CSS surfaces, one continuous rounded backdrop and edge per row. Cells stay transparent; screenshot fragments and cell-by-cell fills/bevels are prohibited. Preserve the approved five-color palette and geometry.

- All six Bag comparison arrows are code-drawn triangles sized to the prior glyph paint bounds (.307em by .317em at 120% font size and 1.625 visual scale). Center their visible boxes vertically on the row/strip, avoiding font baseline drift. Both percentage labels center horizontally within their columns. Only each arrow moves to the measured midpoint between its adjacent percentage labels, giving equal gaps.

- Disabled Bag Level Up uses an opaque aqua-gray palette with a lighter gray label. Override shared disabled opacity to1; preserve button geometry and bevels through explicit gray color tokens, with no dimming/filter/blend treatment. Enabled teal styling stays unchanged.

- Bag probability footer shares the main window dark gradient and 2px gold border; retain its existing text, dimensions and detached close spacing.

- Shared Bag/Training Ground close styling and glyph painting live in `systems/modalClose.mjs`; retain the accepted slate palette, floating gap and painted-bounds centering when changing either consumer.
