# Provenance

Date: 2026-10-25. Art direction and packing: Astra.

Tool: built-in `image_gen.imagegen`, six successful generation calls with `transparent_background=true`. Backend image-model identifier was not exposed by the tool; no model name is inferred. All generated images had real RGBA transparency. Prompt requested large regular atlases; actual dimensions were inspected and normalized in packing.

Approved identity references inspected: `art/wishfire-skills/skill_chain_strike_arc_160x48.png`, `vfx_split_slash.png`, and `vfx_impact_g03_purple.png`; their SOURCE.md records Wishfire commit fdc6d523. They informed silhouettes and palette. Generated repaints were text-directed, with no reference-image input passed to the generation calls.

Raw generated masters are copied into `../_work/astra/master-*.png`. Tool autosaves remain untouched. `generations.json` records original autosave paths and exact prompts. Packing/review/manifest scripts live exclusively in `../_work/astra/`.

## Post-processing

Pillow and NumPy, through `pack.py`: split each atlas into row/cell crops; remove alpha below .045 and remap remaining alpha with exponent1.22; remove neighboring-row color contamination from nature, smoke and gold support cells; common per-row scaling preserves relative ignition/peak/decay sizes; center or foot-align frames; Lanczos resize into power-of-two frames with transparent gutters; flip cast flash to face right; compress Chain ribbon height to its integration ratio. Crit variants combine a brightened family raster and a smaller rotated copy of that same authored shard. Neutral derivatives use max(R,G,B) with preserved alpha. No effect shape was drawn with procedural vector strokes. Telegraph meshes specified for runtime remap the authored raster to exact sim geometry.

PNG outputs retain straight alpha and lossless compression. Full prompt atlases and all frame exports were visually inspected through contact sheets. Runtime animation quality remains the engineer acceptance gate.

Review composites: `review.py` uses the real oasis-corridor PNG, crops real characters from gen atlas pages, resizes their visible bodies to32px (boss70px), and alpha-composites delivered PNGs. Arena scaling follows x*.5 and y*.375. Current live HUD crop supplies farming/barrage overlays; supplied historical boss HUD supplies the enraged top bar. Layouts are composed illustrations, not recorded gameplay. Thin boss rim in the mock uses morphological narrowing of the supplied raster; runtime must use the constant-width textured mesh described in INTEGRATION.md.

## Exact prompts

### hits

Master SHA-256: `dda03ffcbcc093b34d0cc61745b3590dcecf4abe428e55183344667c19064a7d`

```text
Use case: stylized-concept. Production game VFX sprite atlas, transparent background. EXACT 4 columns by 6 rows, 1536x2304 total preferred, equal rectangular cells with generous transparent gutters. No labels, letters, grid lines, background, shadows or checkerboard. Each row is one left-to-right four-frame impact animation: compact ignition, explosive sharp peak, separated fragments, sparse dying fragments. Every cell shares centered pivot and same scale; all strokes stay inside its cell. Row 1 physical: ivory and pale amber asymmetric metallic blade splinters, three bold wedges. Row 2 fire: white-hot buttery yellow core, broad orange flame lobes and two ember shards. Row 3 ice: white and glacier cyan spear-like crystals in sharp angular asymmetric fracture. Row 4 arcane: white lavender center, deep indigo diamond fracture with violet winglike shards. Row 5 nature: warm white center with jade green leaf blades curling outward, no flowers. Row 6 poison: Wishfire electric purple and magenta forked flame splash, white core, purple teardrops, NEVER green. Premium Japanese action RPG painted effects, crisp confident silhouette, broad color blocks, extremely little interior detail, restrained luminous edge, opaque colored midtone shapes plus luminous white cores. Designed to read at only 24 pixels tall. Do not make repeated generic stars, circles or radial glows. Four distinct animation frames per row, not four copies. Transparent real alpha.
```

### blast

Master SHA-256: `473f75ca7af2fa4e18da43c0db3eaad11cab8eefa400f6429f0a48377c753671`

```text
Use case stylized-concept. Transparent game VFX sprite atlas, 4 columns x 4 rows, perfectly evenly spaced square cells, 1536x1536. No text, labels, grid, ground plane or background. Each row is a separate FOUR FRAME left-to-right animation, centered consistent anchor. R1: bomb explosion fireball, tiny white-hot ignition, big scalloped yellow-white center with bold orange outward flame petals, then hollow separating orange curls, then two dark ember fragments. R2: charcoal and umber blast smoke plus chunky rock debris, compact rising puff then broad low rolling separated lobes then sparse disconnected wisps then two dying wisps. R3: enemy KO dissolve puff in desaturated blue-grey, split wisps and a few broad fragments, compact to expanded to dissipated, never skull or symbol. R4: boss enrage roar BURST, carmine and crimson torn flame mane sweeping outwards in an open horseshoe with EMPTY transparent center, wider and more torn each frame, last frame only sparse tips. Premium Japanese action JRPG painted FX, bold silhouettes, broad flat shading, little interior texture, white hot cores only on fire and roar, clear at 32-80 pixels, all art fits with 12% transparent cell margin, no overlapping cells, no generic stars. True alpha transparency.
```

### travel

Master SHA-256: `d1d32cea5e89e7bb50a494b25ac22886dba5f0785db9fdd19786e9bc128aa473`

```text
Use case stylized-concept. Transparent production VFX ATLAS with exactly FOUR columns and FOUR rows, evenly spaced square cells on 1536x1536 canvas. No labels, no grid, no background. Each row a 4-frame left-to-right evolution with constant centered pivot and equal scale. Row 1: white-hot pale gold and blue MUZZLE / magic cast flash, asymmetric compact 3-prong forward burst pointing RIGHT; ignition, peak, separated shards, sparse remnants. Row 2: luminous cyan-white magic ORB HEAD, bold teardrop silhouette aimed RIGHT with trailing curved fins, four subtle pulse frames, no circular halo. Row 3: gold-white spear BOLT HEAD pointing RIGHT with sharp broad front and two feathered tail points, four subtle pulse frames. Row 4: gold-white bomb FUSE SPARK, miniature asymmetrical 3-spoke molten spark and two embers, four flicker frames. Render painted premium JRPG effect cels with crisp silhouettes, broad colour fields and clean white hot centers. Readable at 10-24px, no noisy detail, every shape stays inside its own cell with 15% blank margin. Real transparent alpha.
```

### skills

Master SHA-256: `7eac05e004b917415e6a0def5a8a7ffb38c4cdbdee91b77a695383d58fcf4e0e`

```text
Use case stylized-concept. Production transparent VFX sprite sheet. EXACT 4 columns and 3 rows equal cells in a 1536x1152 image. No text/grid/background. Each row is a four-frame left to right painted animation, consistent centered pivot, broad flat colors, very little interior detail. Row 1: Wishfire CHAIN STRIKE ribbon, long horizontal pale cyan ribbon arch bowing upward with pearly white center and soft lavender fringes, endpoints equal height; ignition thin ribbon then full curved ribbon then splitting ribbon then sparse wisp, NO lightning zigzags. Row 2: Wishfire SPLIT slash, double blade-shaped crescent swoosh opening to LEFT, strongest thick edge at RIGHT, ivory white hot slash face, orange and red-orange trailing edge, silhouette like a C with tapered upper and lower tails; first small sweep, second broad powerful sweep, third separated slash fragments, fourth sparse thin edge. Row 3: Wishfire FAZE poison splash, vivid royal purple and magenta flame tongues flowing out from an open dark/transparent center on RIGHT toward long torn tails on LEFT, pearly lavender highlights; compact start, broad full impact, separating droplets, sparse fragments. Preserve these three very different silhouettes and color identities. Generous transparent gutters, entire art within each cell. Polished action JRPG authored cel VFX, legible on mobile. TRUE alpha transparency.
```

### support

Master SHA-256: `6fa0ed62807298f04c5f2cb8e8454a83ffb18d9ed4838e87df62474d1ca55949`

```text
Use case stylized-concept. Transparent game VFX sheet, exact 4 COLUMNS x 4 ROWS equally sized square cells, 1536x1536. Every row is a coherent four-frame left-to-right animation with centered fixed origin. No labels/grid/text/background. R1 neutral spawn-in portal: muted pearl GOLD open broken-ring vortex lying flat viewed from directly above, three broad tapered curved ribbons and a few rising diamond flecks, opening, unfurling, fully open, dissolving. R2 treasure chest opening sparkle: compact gold-white flare followed by few broad diamond sparks flying UP and out in two curved arcs; then floating separated sparkles then sparse embers. No chest object. R3 buff pickup: BLUE and GREEN luminous paired ascending ribbon helix, elegant leaflike tapered ends, mostly empty central gap so a hero remains visible, unfurl, rise, split, disperse. R4 holy resurrection: white and pale gold upward spearburst with two sweeping featherlike flanks and transparent center, compact ignition, tall peaked spread, rising detached shards, sparse flecks. Premium Japanese action RPG painted effects, confident thick clean edges, broad colored midtone shapes, little microtexture, preserve negative space. Each image fits inside its cell with transparent gutters. Real transparent alpha.
```

### decals

Master SHA-256: `2f488ab0dcc65ad754870b4cb289ff8f0a405ce4ac1b22755a026e1f398d0fda`

```text
Use case stylized-concept. A carefully organized transparent game VFX parts atlas, EXACT 4 columns by 3 rows of equal square cells, 1536x1152. 12 standalone separate painted assets, centered in each cell, with generous blank gutters, no grid, labels, lettering, symbols or background. Row1 col1: dark umber charred ground SCORCH with irregular broken broad edges and transparent center cracks, viewed straight from above; col2: brilliant ivory-cyan horizontal SNIPER BEAM with pointed ends and 3 broad parallel tapered ribbons, horizontal right facing, much wider than tall; col3: cyan-white tapered projectile TRAIL flowing horizontally LEFT from bright right tip, two soft curved tapering ribbons, no head; col4: ivory gold tapered bolt TRAIL pointing right, narrow streak with two separated wisps. Row2 col1: deep PURPLE poison pool viewed directly above, shallow violet translucent broad puddle with three curved magenta flame tips around border and EMPTY clear center; col2: amber-gold boss energy backlight, two tall featherlike flame lobes with EMPTY center; col3: elegant narrow gold-white resurrection COLUMN, long vertical upward white light with fading sides, no symbols; col4: subtle cyan shield shell, two pale blue curved vertical wings with empty center, no sphere fill. Row3 col1: single clean WHITE continuous circular warning rim viewed directly above, even thickness about 1% diameter, isolated on transparency, no decoration; col2: quiet solid WHITE circular filled mask viewed directly above with crisp clean edge, uniform white interior; col3: narrow horizontal WHITE continuous border strip with crisp edges for mapping onto hazard boundaries; col4: neutral white soft horizontal shadow dab with no color. Premium action JRPG raster painting, broad shapes, minimal texture, no microscopic sparks, real alpha transparency. Ground masks must be exact symmetric circles before projection; keep all in own cell.
```

## `orb-head-kaja.png`, `orb-trail-kaja.png` (2026-10-27)
- Derived from `orb-head.png` / `orb-trail.png` with a Pillow HSV hue rotation of +70 degrees (alpha, saturation and value untouched). Owner: Kaja's orb is purple; shape, frames and delivery identical to Runa's.
