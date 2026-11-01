# Split and Faze provenance

Date: 2026-10-25. Artist: Astra task 2. Art director: Claude.

These files are authoritative for Split and Faze in the isolated ORKA-6jh1 experiment. Scope is artwork and integration specifications. Application source, Git and Beads were untouched.

## Generation

Tool: built-in `image_gen.imagegen` (`tools.image_gen__imagegen`), transparent_background=true for all eight independent generated paintings. The service did not expose a model/version identifier. No other task artwork was used.

Eight generated masters remain at the auto-save paths below. Full prompt and source map also lives in `art/_work/astra-split-faze/generation.json`.

## Post-process

Pillow and NumPy in `art/_work/astra-split-faze/process.py`: remove alpha values <=6, remap surviving alpha, crop transparent noise, align frame centres or surface anchors, Lanczos resize, repack rows as horizontal strips, apply authored opacity envelopes and save optimized RGBA PNGs. Shape and texture come from generated raster paintings; no vector/procedural VFX shapes were drawn. Split rim derives from violet/bright pixels of slash. Black cores are retained using alpha, never luminance-keyed. Faze interior alpha uses a softened painted-silhouette mask with stronger glossy wet banks. Transparent RGB is zero. No palette quantization.

The last slash, impact, splash and tick frames are transparent terminal holds; fumes start and end transparent. Bubbles retain only a faint wet footprint at the loop seam. Bubble and fume playback includes staggered rest periods.

## Preview and verification

`preview.jpg` combines two exact 360 x 640 logical crops. Background: supplied `art/arena/oasis-corridor.png`, world crop (120,200)-(840,1907) resized to 360 x 640. Actors: current `gen/assets.json` idle frames from atlas pages, resized to 32 pixels tall. Split shows five Gobloc recipients and Hondo; Faze shows three Gobloc and Kaja. Faze is drawn at 138 x 103.5 pixels. Compositing uses straight alpha; fumes and rim use source-alpha additive RGB. Text labels are QA presentation only.

Verified exported dimensions/frame counts, clear frame boundaries, zero RGB outside alpha and package size. Inspected every exported sequence in a contact sheet and the phone-scale scene composite. Review animation is an art-only browser playback in scratch. T3 html_preview loaded all 13 images without console errors. Native browser controls advanced time from 0.2951 to 0.665 seconds and reset to the 0.235-second division beat; both canvas CSS bounds measured exactly 360 x 640 at DPR 1. Runtime wiring, engine blend behavior and in-game timing still need integration verification.

## Self-critique

Split reads as dark fractured energy and gives each target a distinct share. The painted shard texture becomes a small silhouette at phone scale; division depends on the specified travel beat. Generated fracture frames change shape rather than tracking identical fragments throughout, so movement is a painted flipbook approximation. Faze reads as glossy purple liquid and preserves actor silhouettes. Its quiet fumes will be subtle on bright sand; increasing their density would compete with actors. The static pool has prominent wet banks, and five moving bubble instances are essential to keep it alive. The generated look is a candidate for art-director approval; engine playback has not been certified.

## Exact prompts

### pool
Source: `/Users/Mace/.codex/generated_images/01a1723b-555d-7240-a17c-c120205dc799/exec-5b50cce4-d88d-4668-8acb-5506bc2da1ce.png`
SHA-256: `6769805aecad9178ce6269e22ac5682fe58183d1dd41676e3f111b88419edb7d`

Use case: stylized-concept. Production game VFX sprite, isolated on REAL TRANSPARENT background. Paint ONE purple poison liquid puddle for a premium hand-painted JRPG with chibi characters, top-down slightly three-quarter view, broad horizontal footprint aspect 4:3. Organic irregular asymmetric wobbly lobed outer contour. Viscous toxic amethyst violet liquid, deep muted plum interior, uneven shallow banks, small glossy lavender reflections broken across surface, several unequal bubbles partly submerged, a few tiny purple droplets at shoreline. Center must feel thin translucent liquid, subtly mottled, plenty of quiet space for actors. Bold readable at 138 screen pixels wide. Elegant painted texture, rich material. No ground, no sand, no props, no characters, no scene, no text, no diagram, no border. Not a ring, sigil, magic circle or geometric decal. No red, green or orange. No luminous circular outline. No large smoke plume. Use full image with about 7 percent transparent margin. Output 1024x768 or equivalent 4:3 transparent RGBA.

### slash
Source: `/Users/Mace/.codex/generated_images/01a1723b-555d-7240-a17c-c120205dc799/exec-b57dd826-6bed-4499-916f-0c345d17bfc7.png`
SHA-256: `e960d51701c84f3fb186d9af4425bdf1955dcc68db0c36b4d44dc3215274bdbc`

Use case: stylized-concept. Production hand-painted JRPG VFX animation sprite sheet on REAL TRANSPARENT background. EXACTLY EIGHT frames in a precise 4 column by 2 row grid, read left to right then next row. Every cell 2:1 wide, equal dimensions and clear transparent padding; total canvas ratio 4:1, or if necessary 2:1 with equal cells. A DARK BLACK ENERGY SLASH cracks and DIVIDES into separate obsidian shadow shards. Charcoal-black heavy ink core, restrained deep indigo and violet rim, painterly fracture edges. Each cell shows temporal evolution of same horizontal diagonal attack at fixed center: 1 thin black incision; 2 broad black crescent fracture; 3 peak broad void slash; 4 fractured slash separating into five pieces; 5 five dark pointed energy slivers peeling outwards; 6 more widely separated violet-edged black slivers; 7 small fading fragments; 8 faint terminal fragments. Crisp silhouette, chunky shapes that survive mobile scale, painterly finishing like high-end Final Fantasy / Capcom combat VFX. No fire, flames, orange, yellow, red, blue-white lightning, stars, runes, symbols, text, labels, cell borders, characters or backdrop. No geometric vector linework. Grid cells separate, no overlap. Black must remain opaque even though background transparent.

### shard
Source: `/Users/Mace/.codex/generated_images/01a1723b-555d-7240-a17c-c120205dc799/exec-b2742ac0-0c77-492d-8f81-be7aea82410c.png`
SHA-256: `7c6fedcaec2800289f379abc9707459d220b11f709da12c09ccb40f716a879b3`

Use case: stylized-concept. ONE small hand-painted dark-energy shard game projectile, pointing RIGHT, center composition, isolated on true transparent background. Compact spear-like broken obsidian sliver with asymmetric jagged fracture edge and subtle violet-indigo rim light. Solid near-black core occupies 75% of silhouette. Short taper of purple shadow dust trails left. Large readable chunky brushwork, strong simple silhouette at 16 screen pixels. Premium JRPG combat VFX sprite. No flame, no fire, no orange, no yellow, no red, no decorative lines, no words, no scene. Wide shard contained within square image, generous transparent margins, not cropped.

### impact
Source: `/Users/Mace/.codex/generated_images/01a1723b-555d-7240-a17c-c120205dc799/exec-e35dd74e-5b54-4c5a-a95e-7f0bea95d50c.png`
SHA-256: `e0db41ba4f58306f72c986c39abf630bcc4940a3f211e6e9ca960b6883e8aa65`

Use case: stylized-concept. Hand-painted dark void implosion HIT sprite sheet, REAL transparent background. EXACTLY SIX animation frames arranged in precise 3 columns x 2 rows of equal square cells, clear transparent gutters, canvas aspect 3:2. Fixed center every cell. Opaque BLACK and dark indigo energy collapsing INTO a tiny rupture, fractured violet rim accents. Temporal sequence: frame1 four short black torn slivers pointing inwards with violet edges; frame2 compact jagged black rupture and inward fragments; frame3 bold darkest compact jagged impact with thin violet edge; frame4 rupture contracting with isolated black shards; frame5 tiny broken violet-black flecks; frame6 almost vanished dust. No round magic ring, no fire, no flames, no radial starburst, no lightning, no red/orange/yellow/white. Bold painterly organic shapes at mobile size, premium Capcom JRPG VFX brushwork. No text labels or grid lines. Each frame stays within its cell.

### bubbles
Source: `/Users/Mace/.codex/generated_images/01a1723b-555d-7240-a17c-c120205dc799/exec-0fe352da-73ae-40ba-8379-b4a66bb9b8de.png`
SHA-256: `7e0d2c0e35888655822cd80ce80f55102639d5e21d60846a4ffd5b3b12f07788`

Use case: stylized-concept. Hand-painted purple POISON LIQUID bubble animation sprite sheet on TRUE TRANSPARENT background. EXACTLY EIGHT frames in equal square cells, 4 columns x 2 rows grid. Consistent camera, position, scale across frames; stable waterline near lower third. Sequence: 1 tiny glossy lavender bulge in purple liquid footprint, 2 small rising dome, 3 inflated violet bubble, 4 largest plump translucent amethyst bubble with off-center creamy-lavender reflection, 5 skin breaks and folds into wet petals, 6 small wet crown splash with 3-4 rounded liquid drops, 7 falling purple drops with contracting wet footprint, 8 nearly gone flat small wet footprint matching first. Broad simple forms readable at 8 screen pixels. Paint beautiful translucent viscous material, no thick outlines. No background ground or pool, only tiny local bubble. No magic ring, neon, geometric symbols, flames, red, pink, green, text, cell borders. Transparent separation between frames, no overlap.

### fumes
Source: `/Users/Mace/.codex/generated_images/01a1723b-555d-7240-a17c-c120205dc799/exec-7a8ea203-ef96-409d-9ee4-9ca42c3164b4.png`
SHA-256: `249f53c0ac710f953464a85650d447719d23d2ffcf5ea71eb688891a1e0d1cbf`

Use case: stylized-concept. Hand-painted soft PURPLE poison vapour WISP animation sprite sheet, true transparent background, premium JRPG VFX. Exactly EIGHT equally sized frames, 4 columns by 2 rows grid, cells vertical ratio 2:3. One delicate wispy column of translucent lavender gas per cell, fixed bottom anchor and stable scale. Sequence: 1 tiny faint curl forming near ground, 2 small curled puff rises, 3 slender soft S-shaped wisp, 4 taller curling lavender tendril, 5 delicate separated curls moving upward, 6 wisps thinning, 7 tiny upper fragments fading, 8 almost fully dissipated haze. Low opacity, smoky organic brush texture, feathered diffuse edges, nuanced violet/lavender midtones, only very gentle luminosity. No solid backdrop, no black matte, no objects, no pool, no sparkles, no fire, no white hot glow, no magenta, no red, no cyan. No symbols or text or grid lines. Separated frames and transparent padding on every cell. Designed for additive use at 12x20 pixels.

### splash
Source: `/Users/Mace/.codex/generated_images/01a1723b-555d-7240-a17c-c120205dc799/exec-9ecad32b-09da-4f4f-b92e-cb7d1923fe38.png`
SHA-256: `36967a49b1e31bcaff91fd0682638ca25d899745ebdfd39963d824e66bd4145e`

Use case: stylized-concept. Premium hand-painted JRPG purple liquid poison PLACEMENT SPLASH animation sprite sheet on true transparent background. EXACTLY SIX temporal frames in 3 columns x 2 rows of equal 4:3 cells, each separate with transparent gutters. Slightly top-down three-quarter viewpoint, stable center/waterline, entire effect in each cell. Frame1 heavy compact violet liquid blob arrives; frame2 blob flattens with an uneven wet crown; frame3 broad low lateral splash with irregular rounded liquid fingers and several fat glossy drops; frame4 drops fall into a wide shallow lobed puddle; frame5 ripples settle leaving shallow irregular puddle; frame6 low faint residual purple liquid shimmer. Viscous purple amethyst fluid, darker pooled depths, broken glossy lavender reflections. Shape language wet organic asymmetrical, broad bold strokes. No flames, starbursts, sigils, circles, geometric decoration, red, orange, green, text, cell labels, scenery, characters. All six frames same ground anchor. Keep splash low and wide to preserve actor silhouettes.

### tick
Source: `/Users/Mace/.codex/generated_images/01a1723b-555d-7240-a17c-c120205dc799/exec-0c0e74ae-8dd7-40ea-8a58-d14c0c299ac6.png`
SHA-256: `3f27137e42daf42fb8dc9370777455261bbea06fab3848ec9e812cb881d4295a`

Use case: stylized-concept. Five-frame hand-painted PURPLE POISON DAMAGE TICK VFX animation sprite sheet, REAL transparent background. EXACTLY FIVE equal square cells in a SINGLE HORIZONTAL ROW. Quiet small liquid poison sting: 1 dark violet bead with tiny cloudy halo, 2 bead bursts into uneven wet purple droplets, 3 short local dark amethyst splat with 4 rounded lavender droplets, 4 droplets separate and soften into a tiny puff, 5 few fading tiny purple specks. Stable center, simple thick readable shapes. Premium JRPG painterly material, intended 12x12 screen pixels over enemy ankles. Glossy but restrained. No star-shaped magical flare, no lightning, no blades, no fire, no white-hot light, no red, no green, no rings, no words or frames. Transparent padding in every cell, no overlap.

## 2026-10-25 owner family edit: Split red exterior rim (Hondo family)
Owner reported Split invisible in battle. split-slash, split-impact and split-shard received the
same soft red exterior rim as Hondo's Shadow (`scripts/shadow_red_rim.py ... split`): interiors,
frames, pivots and timings unchanged; split-slash-rim (additive highlight) untouched. Client draw
sizes were raised to hero scale (slash 128x64, impact 44, shard 28 at zoom 0.5) and the additive
rim layer is now drawn over the slash.

## 2026-10-25 owner edit: Faze pool fully opaque
Owner: "Kaja's Faze is slightly translucent. Make it 100% opaque." faze-pool.png alpha remapped
(alpha >= 110 -> 255, fainter fringe scaled up proportionally) so 97.5% of painted pixels are fully
opaque and only a 1-2 px anti-aliased silhouette edge remains soft. RGB, size and shape unchanged.
Original kept locally in art/_work/faze-originals/.

## 2026-10-25 owner edit: Faze recoloured to dark emerald
Owner: Kaja's Faze was purple while his Toxic Aura is green; "change Faze to dark emerald pool not
purple goo." faze-pool/splash/bubbles/fumes/tick: violet hue band remapped to emerald (~150 deg),
value x0.82 for depth; shading, highlights and shapes unchanged; faze-pool opacity remap re-applied.
Originals in art/_work/faze-originals/.
