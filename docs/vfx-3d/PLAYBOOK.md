# Spell craft playbook

Approved study recipes: [Healing v2d](healing.md), [Ground Pound v4g](ground-pound.md),
[Bubble v3e](bubble-pop.md), [Arcane v4c-f](arcane-pulse.md).
Their [reference code](reference-code/) preserves exact construction. The
[starter](starter/README.md) provides a small, art-free working scene.

## Standing direction and why

| Rule | Why / enforcement |
| --- | --- |
| Bold energy on light sand. | Pale effects disappear at phone scale. Keep saturated shoulders around white-hot cores; check the weakest frame against sand. |
| PS1 pass: 180×320 → 360×640 nearest; 5-bit colour + dither; projected vertex snap. | This supplies the coarse raster and stepped silhouettes. Enlarging a smooth render alone loses the approved look. |
| Chunky low-poly forms with Gouraud lit/mid/shadow faces. | Broad facets communicate volume at 58 px actor scale. Keep split face normals and interpolate light within each face. |
| Dust/smoke is GAS: soft translucent drifting billboards, NormalBlending, depthWrite off. | Independent drift, curl, growth and changing density keep clouds alive. Opaque puff meshes read as solid props. Depth testing remains on; sort alpha cards back-to-front. |
| Particles are fine soft round mist, rendered after the PS1 pass. | A low-resolution particle pass turns small specks into square confetti. Keep the approved smooth release pass separate; ground dust retains its study's low-resolution gas pass. |
| Preserve hero source art. Draw glows around heroes; release lifts to source pixels. | The actor must remain readable and recover its exact colours and alpha. Healing's approved temporary source-chroma light is bounded and returns exactly to zero; it never rewrites the texture. |
| Hero always faces target. | Preserve source-facing metadata: `flip = (sourceFacing === 'left') !== actorFacesLeft`. This is the XOR used in `crates/wf_client/src/render/actors.rs`; a right-facing source aiming left flips once. |
| Randomise each cast; keep a seed and Recast button. | Natural variation must still replay exactly for review. Store the seed in presentation state, separate from combat RNG; scrubbing consumes no randomness. |
| “Only alter what I ask.” | Approved layers are contracts. Compare identical seed/time/camera pixels with the approved round; mask only the authorized region/time and require zero differences everywhere else. |
| Don't guess: show options. | Ambiguous shape words can steer an entire pass wrong. Lead presents small labelled alternatives, with the binding reference visible, before committing to a new art interpretation. |

## Rejections worth remembering

Symptom → cause → fix:

- v1 timid/flat → weak energy and silhouettes on sand → increase body saturation, core contrast and readable volume.
- “Ring” overfit → reference named by its overhead outline → trace the alpha-clipped column wall, scrolling electric veins and visible height.
- Thin needles → narrow cone silhouettes → broad 8–14-face wedges with blunt crowns.
- Grey rocks → uniform slate material → seven-brown mottled pigment under the approved directional slate lighting.
- Opaque dust, “frozen shit explosion” → static solid puff bodies → translucent feathered gas cards with continuous internal motion.
- Fara sprite tint → light applied to the actor → remove tint; keep hand glow and ground wash in separate layers.
- Bubble v2 flat → outline/crescent bands replaced volume → restore v1 glossy rainbow sphere, specular and wobble.
- Bubble chunky fragments → heavy solid droplets → v3b disconnected confetti → emission from the entire sphere surface and orb trails, v3c continuous fine mist; v3e adds seeded motion.
- Healed heroes left darkened → wrong colour/lift release → v2d lit-in-aura with nondecreasing source-chroma channels, then exact ordinary sprite path on release.
- Arcane count change altered path shape → count also controlled curve geometry → separate path templates from beam allocation.
- v4c-d outer-lane clusters → coverage and launch allocation favoured edges → redistribute; v4c-e left centre unused → require the exact middle path.
- v4c-f resolution → five fixed paths, random picks with every path reserved once, uneven counts, irregular timing and half-speed clock → retain all constraints together.
- Low-res review GIFs hid motion → phone-scale encode discarded timing/detail → capture 60 samples/s and deliver 30 fps high-resolution 1× and 0.5× GIFs plus a 3× close-up.
- In-game VFX looked “fuzzy, unrefined, like a wrong graphics-scaling setting” → the runtime port rendered every effect into a fixed 180×320 target and stretched it ~6× onto a high-DPI 1170×2532 canvas, while sprites/UI stayed crisp; mockups judged at 360×640 hid it → size every VFX target, snap grid and dither from the LIVE framebuffer (default native + PS1 dither), rebuild on resize/DPR change, and review lossless PNGs at true device pixels.
- “Shipped” misread as “in the game” → only text specs had landed → say plainly whether an effect is a study/spec or playing in the build.

## Tuned recipes

Dimensions are study design units at a 360×640 frame and 58 px actors.
They require projection-aware conversion when binding to sim world units.
`S(x)=smoothstep(0,1,clamp(x,0,1))`. The linked specs own complete curves.

### Holy aura / motes

From [Healing](healing.md) and `reference-code/healing-scene.js`:

- Caster disc radius 45; 56 rising cards, height 110–240, width 0.55–1.35; six lavender 12-segment annuli, radii 3.8/5.1, rising 8→198 over 1.2 s.
- Per recipient: six separated normal-blended shafts, width 9–15, height 137–191, across ±17. Build at 1.20 over 0.50 s; retreat from 2.60 with ≤0.15 s shaft offsets. Lift lower edges by 220 while narrowing width to 3% and height to 44%.
- 32 independent motes: 20 small stars 3–5 px, six medium 8–12 px, two rare 16–22 px stars, four round motes. Twinkle 1.4–3.4 Hz; ordinary tails end 3.50–4.15. Recipient delays 0.16 s; cycle 4.40 s.
- White-gold `#ffef94`, warm wash `#ffd77b`, lavender `#9470e2`. Curtain order 4, hero 6, rim 7, motes 8. Preserve this occlusion seam when moving ordinary round motes to the full-resolution pass.
- Approved illumination: `healLift=0.2*energy`, added along source chroma with fixed minimum channel; exact zero at recipient-local 3.80. Compare baseline and release pixels, including alpha fringes with persistent effects disabled.

### Rock spikes / gas / single shake

From [Ground Pound](ground-pound.md) and `reference-code/ground-pound-scene.js`:

- Canonical seconds `a`; game seconds `t=a*6/13`. Charge through 0.77; travel rocks born 0.73/0.87/1.01/1.15 at line fractions .15/.36/.57/.78, heights 18→45 and radii 8→18.
- Three endpoint prongs: heights 86/94/78, radii 25/26/26, born 1.30/1.34/1.39. Closing spine height 69, radius 25, born 1.73. Each rock has 14 broad triangle faces; eight rocks total.
- Light anchors `#b8b8b0/#7a7c78/#3a3d3c`; key direction (-.65,.8,.55). Nearest 64² pigments: `#4a3020 #634027 #7d502e #a07040 #b3844d #bf965c #c9a46a`; octave weights .65/.25/.10.
- Final gas capacity 92: 40 travel + 52 retreat (8 ring, 40 body, 4 wisps). Use 64² feathered density, UV warp .18, per-puff alpha ≤.36, NormalBlending, depth test on/write off, global depth sort. Earlier smoke research's 24–30-puff suggestion predates this approved recipe.
- Retreat builds at 1.60; opaque .99 prongs sink 1.90–2.15, spine 2.11–2.36; gas clears 2.92. Sprite-alpha attenuation .015 bounds 52-puff combined coverage to 24.54%. Register masks through shake.
- One whole-view thump at `t=1.75*6/13=0.807692`: duration .22 s, 2.5 damped cycles, vertical amplitude 6 logical px, horizontal 1.5; snap to internal pixels and return exactly to zero.

### Glossy iridescent sphere / mist burst

From [Bubble](bubble-pop.md) and `reference-code/bubble-pop-scene.js`:

- Radius 83, centre y=108×scale; IcosahedronGeometry detail 2. Swell `scale=.32+.68*clamp(t/.35)`; pop .350 s. Normal wobble amplitude 1.8 at `sin(y*.12+t*14+x*.04)`.
- Fresnel `pow(1-abs(dot(n,view)),2)`, cyan↔pink iridescence, specular exponent 14, white highlight. Keep the glossy volume through the final pre-pop frame.
- Pop flash lasts .075 s; ten round blue orbs live .44–.51 s. Fine mist: 760 surface + 240 trail points, trail delay .02–.26 s; ordinary sizes 1–2 logical px, every 37th 2.6 px.
- Gaussian `exp(-4.5*r²)` with .72–1 outer feather, linear sampling, additive release after post. Surface speed 260–460; lifetime .60–.92 s; drag 5.4–6.6; fall `48*a+13*a²`. Release ends .94 s after pop.
- Fixed style seed 91731; motion seed per cast. Preserve size/colour/delay style while varying surface samples, directions, speed, drag and flutter. Palette `#92eaf6/#ffffff/#f3b6ed`.

### Homing comets / radial impacts

From [Arcane](arcane-pulse.md) and `reference-code/arcane-pulse-scene.js`:

- Use its exact LO/LI/M/RI/RO cubic controls. Count `8+floor(r*5)`; reserve each path, shuffle, pick extras uniformly and reroll extras until max-minus-min totals ≥2. Paths remain independent of count.
- Bow width jitter signed 3–6%; middle stays exact. Same-path launches ≥.080 real seconds apart. Real time = 2×authored time for every phase; charge .500 s, first arrival .900, flight .675–.725, impact .440.
- Tangent handoff: first half follows cubic 0→.60; final half darts from cubic(.60) to target with `.25*q+.75*q*q`. Keep its tangent and cap the short dart trail.
- 28-quad additive ribbon, half-width `(.12+.88*u^.7)*6`; violet→blue→cyan with white core power 12. Head cards 18/11/5; trail history .320–.370 s before phase shortening.
- Per hit: 40-segment gold foot ring, body glows 28/15/7 plus growth, 10–16 yellow radial lines width 1.05; fade `(1-age/.440)^1.7`. Latest arrival alone gets 1.12 size gain. Beam count changes no damage.

### Shared building blocks

Use camera-facing two-triangle billboards and cross-product ribbon sides; additive energy
keeps a saturated shoulder around the core. Gas uses source-over alpha, independent
growth/opacity envelopes and continuous density warp. Batch matching materials only
after their sorting and depth contracts work. Dispose replaced geometry/materials.

Use unsigned LCG `(imul(seed,1664525)+1013904223)>>>0`, divided by 2³².
Construct motion once per cast, evaluate positions from absolute age for reversible scrubbing.
The starter exposes billboard, ribbon, gas and mist helpers; its small comet demonstrates
these seams without claiming to reproduce any approved spell.

## Review / proof gate

- **Native resolution first.** PS1 character is a deliberate texture, never resolution loss. Never hard-code an internal size (e.g. 180×320) in targets, snap grids, mask/`gl_FragCoord` lookups or dither; derive them from the live device framebuffer. The game uses responsive page scaling and high DPI, so test at least 390×844@3, 360×640@2, 820×1180@2, 1440×900@2 and a live resize mid-effect. The primary proof is lossless PNG stills at true device pixels with 1:1 crops shown at 100% (`image-rendering: pixelated`, no browser downscale); GIFs are secondary motion proof. Compare VFX edge sharpness against the crisp sprites/UI in the same frame.
- Missing LAYERS signature means rejection. Check final peak, onset, retreat and clean release at native game scale; inspect weakest sand contrast, feet, faces and health bars.
- Capture 60 source samples/s. Deliver in-game GIFs 720×1280 at nominal 30 fps, plus roughly 600 px wide 3× close-ups, each at 1× and 0.5×. GIF delays quantize to centiseconds; record measured duration.
- Use `palettegen=stats_mode=diff` and `paletteuse=dither=sierra2_4a`; keep nearest enlargement for the PS1 base. Inspect decoded GIF frames, rather than only source PNGs.
- Include `closeup-strip.png` sampling every second–fourth frame, exact-time keys, seed labels and several consecutive casts. Log dimensions, fps, crop, clocks, seeds and console failures.
- Keep one light-mode, static no-JS gallery. Approved-only cards for approved spells; labelled alternatives side by side for open work. Test with JavaScript disabled.
- Every “only X” change needs pixel equivalence against the approved round at unchanged seed/time/camera. Compare untouched regions and all frames outside the authorized time window. Recapture after the final edit.

## Iteration / handoff

1. Lead/art director inspects owner reference contact sheets and writes `LAYERS.md`: describe visible geometry, motion, layering and times, regardless of the owner's shorthand noun. Record automatic-fail signatures and the authoritative sim footprint/clock.
2. Implementer traces at the reference camera, then adapts to the slice camera and actual gameplay footprint. Use [starter](starter/README.md); show options when intent remains unresolved.
3. Snapshot each round before replacing proof. Lead checks layers, pixels and decoded motion, then updates the static gallery for owner review.
4. After explicit approval, ship text spec + our reference code in this package. Preserve approved versions and the skill through export. Media, vendor files and third-party imagery stay outside tracked source; runtime ports require their own scope and proof.
