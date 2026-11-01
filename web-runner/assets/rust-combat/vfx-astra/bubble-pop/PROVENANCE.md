# Bubble Pop provenance

Date: 2026-10-25. Artist: GPT Astra. Art director: Claude. Bead: ORKA-6jh1.

## Owner direction

One giant comical soap bubble swells around Runa's selected TARGET ENEMY, then tears and pops. Runa conjures from range. Enemy stays visible through the centre. Radius 140 world units; knockback 70 units. The latest owner update supersedes the initial caster-centred brief. No game code, other artwork, tracker state, or commits were changed.

## Sources and method

Five new raster masters generated through built-in `image_gen.imagegen`, with `transparent_background=true`. The tool did not expose a model/version identifier. Initial swell prompt referenced an unseen mage before the owner update; no character is baked into any VFX. Enemy anchoring is specified in spec.json and demonstrated in preview.jpg.

Read-only references: `art/vfx-astra/split-faze/spec.json` and `PROVENANCE.md` for strip schema/sampling; `art/vfx-astra/preview.jpg` for painterly VFX density; Runa's idle frame from `web/gen/assets.json` and `web/gen/atlas-001.png` for gold, white and violet palette. Preview actors are exact atlas crops of Runa idle/cast, Orc, Gobloc and Boss. These existing sprites remain unmodified outside authorized scratch. Final art contains only the new soap effects.

Mechanical packing uses Pillow and NumPy in `art/_work/bubble-pop/package.py`: remove alpha <=6, remap remaining alpha, crop transparent margins, resize via premultiplied-alpha Lanczos and convert back to straight RGBA, align painted frames, pack horizontal strips, apply authored tail opacity, clear three-pixel borders and zero transparent RGB. No vector shapes or procedural VFX strokes were drawn. Swell frames use individually painted silhouettes with authored size/wobble envelopes. Pop frames retain a shared source transform; first pop frame copies the final swell pixels exactly. Droplets are four independently painted variants. Generation masters, prompts, source hashes, packing scripts, validation.json and review.html are retained in gitignored `art/_work/bubble-pop/`.

## Timing and placement

`bubble-swell.png`: 6 frames, 192x192, 58.333333ms each, 350ms total, pivot (96,189). Display full quad at 149.333px square at zoom 0.5. Final painted sphere occupies 140x140px; slight overshoot reaches 143.1px wide.

`bubble-pop.png`: 8 frames, 256x256, 40ms each, 320ms total, pivot (128,253). Display quad at 199.111px square with same source density as swell. Full bubble, film tear, white irregular star snap, recoil, soft droplets, then faint suds/bubbles. Snap starts on frame index 2, 430ms after cast begins. Client should align existing gameplay resolve with this beat. Fade final frame globally over 40ms.

`bubble-suds.png`: 6 frames, 64x64, 40ms each, 240ms total, centred pivot (32,32). Display 28px square over each knocked enemy's body; follow their displacement.

`bubble-droplets.png`: 4 variants, 24x24, centred pivot (12,12). Select once per particle, display 8-12px, drift/fade over 0.3-0.65s. This is a variant atlas, not an animation.

`bubble-cast.png`: 6 frames, 48x48, 50ms each, 300ms total, centred pivot (24,24). Display 18px at Runa's staff/hands as target swell starts. Cue stays with caster.

All strips use alpha blending and screen-facing quads. Track target ground contact through swell and latch pop position at resolve. Bubble is upright and round; ground projection must never squash the art. The requested 140x70px ground footprint is a gameplay projection, without a ring texture. Current owner instruction specifies 0.5 ground squash; older split-faze/architecture references used 0.75. Boss fit may uniformly scale the sphere and pivot offsets up to 2x while keeping gameplay radius independent.

## Verification and limits

All five PNGs pass dimensions, frame counts, unique-frame checks, straight-alpha storage conventions, zero transparent RGB and three-pixel empty borders. Swell-to-pop transition matches pixel-for-pixel. Final bubble central sample: median alpha 0, 95th percentile 8/255. Every exported frame was visually inspected on #1c1822 at display scale. preview.jpg shows target-centred Orc enclosure, Runa cast cue, idle reference, snap and separate 2x Boss comparison. It is a staged art composite, not a game screenshot.

T3 html_preview loaded all nine playback sprites after correcting composed local paths, with no console errors. Native preview evaluation verified scrub at .300s, boss toggle and replay; canvas CSS dimensions were 360x390 at DPR 1. Native preview_snapshot twice returned `Preview automation snapshot timed out after 15000ms`; its visible state stayed false. Inline T3 HTML provides the review surface. No external browser was opened.

Self-critique: the broad bubble is deliberately oversized relative to 32px actors, making the trapped victim small near the lower rim. The snap reads as a soft, irregular soap star with rounded tips. Generated shapes morph between frames, rather than tracking a simulated film surface. At 2x the painted rim stays legible but its raster softness becomes visible. Actual engine timing, sorting, blend configuration, boss fit, recipient placement and art-director acceptance remain pending integration review.

## Exact generation prompts

### swell

Source: `/Users/Mace/.codex/generated_images/01a17416-f82b-78f3-9c76-8800bfc1cfe1/exec-003ce75a-b726-4313-849b-f399dd7fb5a0.png`

SHA-256: `c116d3b05b2e65f0516dd32d64dabee1c0e7c079f9295c8d71bf018b7f57a93b`

Use case: stylized-concept. Asset: animated bubble swell frames for a game. Hand-painted 2D JRPG combat VFX, playful Dragon Quest slapstick with polished Capcom sprite craft. Pearl-white highlights, warm pink, cyan and buttery gold iridescent soap film. Delicate lavender outlines and crisp painterly edges, enough bold shapes to read at 140 pixels. Genuine transparent RGBA background and CLEAR TRANSPARENT interiors; absolutely no black/gray fill, checkerboard, panels, ground, characters, shadows, text, digits or labels. No rocks, shards, crystals, fire, wings, energy bolts, radial magic rings, vector/procedural outlines. ONE giant ROUND soap bubble enclosing an unseen small mage, inflated from bottom centre; frontal sphere, NOT a flat ground ellipse. Thin see-through soap skin, asymmetrical rainbow sheen curling just inside its rim, a large white upper-left specular glint and a small upper-right glint. Draw SIX separate successive painted frames in a precise 3 column by 2 row equally sized grid on a 1536x1024 transparent canvas, each cell 512x512, no grid lines. Animation order left to right then down: tiny 35% bubble, 52% wobble, 70% squash, 87% stretch, 102% overshoot, full settled 100% round bubble. SAME ground contact at x=256 y=475 within EVERY cell. Full bubble diameter 430px. Leave ample gutters and transparent margin. All six frames independent, NO droplets yet. Centre nearly empty and transparent; colorful film occupies only perimeter. Soft asymmetry gives rubbery soap feel; no thick donut or neon halo.

### pop

Source: `/Users/Mace/.codex/generated_images/01a17416-f82b-78f3-9c76-8800bfc1cfe1/exec-0b22c642-4fc0-43ab-a434-cc908f9d3e30.png`

SHA-256: `074656b005151d29d50b35837204dab12c0aef7b9b2b37c0360678c486e62e56`

Use case: stylized-concept. Asset: comic soap bubble POP flipbook for a game. Hand-painted 2D JRPG combat VFX, playful Dragon Quest slapstick with polished Capcom sprite craft. Pearl-white highlights, warm pink, cyan and buttery gold iridescent soap film. Delicate lavender outlines and crisp painterly edges, enough bold shapes to read at 140 pixels. Genuine transparent RGBA background and CLEAR TRANSPARENT interiors; absolutely no black/gray fill, checkerboard, panels, ground, characters, shadows, text, digits or labels. No rocks, shards, crystals, fire, wings, energy bolts, radial magic rings, vector/procedural outlines. Draw EIGHT successive different frames in a precise 4 column by 2 row equally sized grid on a 2048x1024 transparent canvas, each cell 512x512. Left to right then next row. Each cell has same unseen sphere centre x=256,y=240, diameter 340; keep all action within x=25..487,y=20..470. Frame 1: one complete round translucent soap bubble with rainbow rim, large white upper-left reflection and small secondary glint. Frame 2: bubble suddenly tears OPEN at upper right, soap membrane curls inward into a soft scalloped wet ribbon. Frame 3: BRIGHT funny asymmetric STAR-SHAPED WHITE POP FLASH with pastel yellow/cyan edge, four chunky unequal lobes and some tiny rounded soap drops, clearly cartoon POP not explosion. Frame 4: flash shrinks to smaller crooked star as torn liquid soap film curls into soft round droplets. Frame 5: flash gone, six rounded watery soapy drops fling apart and two tiny leftover soap bubbles. Frame 6: only three drifting little bubbles and soft white suds wisp. Frame 7: a smaller faint suds wisp and two tiny transparent bubbles. Frame 8: one last tiny bubble and fading wispy foam. NO solid debris, NO streaky bolts, NO angular colored fragments. Maintain central clear space and same palette throughout; do not include any ground ring. Make the snap theatrical and ridiculous.

### suds

Source: `/Users/Mace/.codex/generated_images/01a17416-f82b-78f3-9c76-8800bfc1cfe1/exec-911808b8-9613-492c-b6dd-323d37e75211.png`

SHA-256: `4d05639944cb16945aa4d2f4f923723797324b90bcc494f2adbf8e992399514b`

Use case: stylized-concept. Hand-painted 2D JRPG soap comedy VFX, polished Dragon Quest / Capcom raster sprite craft. On true transparent background, paint SIX animation frames in a strict 3-column 2-row grid, equally sized cells, no labels, no lines. One SMALL soapy SUDS SPLAT hitting an enemy's body, not an explosion. Sequence: compact milky-white bubbly impact; playful asymmetric plop with cyan and pale pink wet rim; squishy foam crown breaking into pearl beads; smaller soft suds puff dispersing; three tiny pearly soap bubbles; one faint wispy foam tuft. Keep centre same throughout every frame and each effect within central 75% of its cell. Friendly rounded wet forms, white specular glints, iridescent pink/cyan/gold film, slight lavender shading. At final 64x64 frame and 26px screen size needs clear juicy silhouette. No sharp shards, rocks, smoke cloud, fire, energy, beams, background, ground, characters, text, watermark or checkerboard. Genuine RGBA transparency around and between each painted frame.

### droplets

Source: `/Users/Mace/.codex/generated_images/01a17416-f82b-78f3-9c76-8800bfc1cfe1/exec-97573d70-a678-41d7-a52e-464f30c49e92.png`

SHA-256: `77d8a8f9b5caee0ae3e76e5759085df8770f9c12eafe1b8276201d71ceb852e0`

Use case: stylized-concept. Transparent sprite sheet of FOUR small leftover SOAP particles for a playful hand-painted JRPG combat VFX. Arrange in strict 2x2 grid, one object in each equally sized square cell, generous transparent margins. Top-left round transparent soap bubble with pink-gold-cyan rim and big white glint; top-right smaller pear-shaped soap drop in pale cyan and pink; bottom-left a wobbly oval transparent bubble with a golden bottom rim; bottom-right a small round milky foam bead with a tiny secondary bubble attached. Each isolated sprite fills 65% of its cell and is centered. Distinct hand-painted wet highlights, subtle lavender edge, clear centre, bold readable silhouette when shrunk to 24x24 texels / 8px display. True RGBA transparent background, no shadow, no ground, no haze, no glow, no noise, no border, no text, no panel or checkerboard, no crystals, no magic energy. Charming Dragon Quest slapstick with polished 2D raster painting.

### cast

Source: `/Users/Mace/.codex/generated_images/01a17416-f82b-78f3-9c76-8800bfc1cfe1/exec-510b3876-94e7-453c-b91b-7fb78bb2f3ff.png`

SHA-256: `256c53bb7bd1e8f02ca12dd45a565eca82c6024ef0141858359941de98297f59`

Use case: stylized-concept. Tiny playful SOAP WAND PUFF for a JRPG mage casting at a distant enemy. Hand-painted polished 2D game VFX. SIX frames on a strict 3-column by 2-row evenly spaced grid, transparent canvas. No characters, no wand itself, no ground, no labels or panel borders. All action centred in each cell. Sequence: tiny pearl glint with one bead; a soft little squish of white suds; three small pink-cyan-gold soap bubbles emerging upward/right from suds; bubbles drift up/right apart with a curved milky foam wisp; two tiny bubbles and faint wisp; one faint single bubble. Scale gently expands then recedes, small intimate conjuring gesture, comedic bubble-blowing cue, not a projectile trail. Bright white reflections, lavender shaded outlines, transparent bubble centres, warm golden small rim accents that suit a gold-and-white hooded mage. Chunky readable shapes for 48x48 sprite, 18px displayed size. True RGBA transparent background including all gutters. No glow fog, no spark shower, no stars, bolts, fire, shards, rocks, typography or checkerboard.


## Owner-requested outer-stroke edit (2026-10-25)

Minimal deterministic alpha-only correction across all five strips. Original PNGs plus original spec/provenance are preserved in gitignored `art/_work/bubble-pop/originals/`. Script: `art/_work/bubble-pop/soften_edges.py`. No generation or repainting was needed for this pixel-opacity operation.

Exterior-connected transparency determines each painted silhouette; enclosed clear bubble centres are protected. Three inward edge texels on swell/pop, two on suds/droplets/cast, receive a luminance-weighted opacity fade. Dark outer contours retain 20%, 50%, then 82% of their original alpha at successive depths; brighter film receives proportionally less attenuation. White glints with every RGB channel >=220 remain identical. All RGB values, nonzero-alpha support, silhouettes, interior pixels outside that narrow band, frame sizes/counts, pivots and timings remain byte-for-byte unchanged. Straight-alpha storage and empty gutters are preserved. spec.json changed only asset byte counts and SHA-256 hashes.

`art/_work/bubble-pop/edge-compare.jpg` compares every frame before/after at the specified in-game quad sizes on sand RGB (163,146,120). Existing preview.jpg was not regenerated or changed and represents the original edges. `edge-validation.json` records per-file changes and verifies exact swell-to-pop continuity. This is an asset-only edge correction; in-engine playback remains for the art director to verify.


## Outer-stroke second pass (2026-10-25)

Art director found the first pass too subtle: its luminance weighting preserved the pale pink-white contour. This pass starts again from the untouched PNGs in `art/_work/bubble-pop/originals/`, using `soften_edges_pass2.py`. No pass-one opacity loss is compounded.

The exterior silhouette now receives a colour-independent alpha multiplier of 0.375 over its outer 2.5 texels, followed by a smooth cubic rise to original opacity at five texels inward. Exact Euclidean distance keeps the feather width consistent around curves. Broad near-white specular patches are identified separately from the thin pale stroke and protected; interior white cores are also unchanged. RGB, nonzero-alpha support and every pixel beyond the five-texel exterior band are identical to the originals. All frames, dimensions, pivots and timings remain unchanged. The small strips receive the same five-texel maximum feather; this makes their outline substantially lighter at their intended display size.

Every frame is compared at in-game scale against the originals in `art/_work/bubble-pop/edge-compare.jpg`, on sand RGB (163,146,120). `art/_work/bubble-pop/edge-zoom.jpg` shows the final swell frame's left rim and glint at 3x in-game scale, original left and second pass right. Straight-alpha RGB conventions, transparent gutters, protected glints, unchanged inner pixels and exact swell-to-pop alignment were checked. spec.json changes remain limited to byte counts and SHA-256 hashes. Existing art-folder preview.jpg remains untouched. Engine playback and owner acceptance remain with the art director.
