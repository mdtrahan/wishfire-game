# Ground Pound v4g

Owner-approved 2026-10-30. Source: local study `v4-ground-pound/scene.js`, `AGENTS.md`, `proof/notes.md`, `ref/LAYERS.md`.
Reference construction: a glowing fist charges, a low fiery front travels through successively larger wedges, three chunky prongs heave up around the enemy, then a closing front spine flashes gold. Rounded dust conceals the rocks sinking into the ground.
Final approved retreat supersedes the reference's earlier translucent fallback: climax rocks retain 0.99 opacity throughout their downward sink.

Clock: canonical study seconds `a`; game seconds `t=a*6/13`. All times below use a except the final camera shake. Geometry dimensions are design pixels at the game view, with perspective factor `d` applied at each anchor.
Footprint: sim-owned 300×80 world-unit line and 80-radius endpoint burst. Study caster (-100,100), target (20,10); these anchors illustrate placement only. Orient travel from caster toward the actual target.

Layers in order:
1. Charge 0–0.77: gold ground disc r=53*d (24 triangles), separate hand/core cards initially 31/14*d. Alpha `S(a/0.08)*(1-S((a-0.67)/0.10))`; hand pulse `0.72+0.28*sin(45*a)`. Hand/core sizes `(28+8*pulse)` / `(13+5*pulse)` times d.
2. Ground runner 0.68–1.39: two additive billboard cards; progress `clamp((a-0.70)/0.60)`. Fire width 48→68, height 23→31; hot core width 28→38, height 14. Height offset 5*d. Fade in over 0.05, out 1.30–1.39.
3. Four fixed travel rocks: line fractions 0.15,0.36,0.57,0.78; births 0.73,0.87,1.01,1.15. Size `s=i/3`: height `18+27*s`, radius `8+10*s`, lean x `-8-8*s`. Rise `S((a-born)/0.12)`.
4. Endpoint prongs: relative (x,z,height,radius,leanX,leanZ,born) = (-25,-5,86,25,-39,-6,1.30), (27,-8,94,26,31,-9,1.34), (-1,11,78,26,-15,7,1.39). Each rises over 0.15.
5. Closing front spine: (1,27,69,25,0,0,1.73), 0.15 rise; gold bloom begins 1.75. Prong rotations y=0.42/0.72/0.42; spine y=-0.38; all x=0.035 radians.
6. Fire beds and rings: endpoint bloom begins 1.28; closing bloom 1.75–2.07; gold wash on enemies 1.75–2.17. Two endpoint rings and one per travel cluster expand and fade.
7. Retreat gas builds from 1.60; prongs sink 1.90–2.15, spine 2.11–2.36; gas disperses fully by 2.92. The hold remains visible until dense gas conceals the sink.

Rock geometry: eight rocks total, each nine conceptual vertices split into 14 broad triangle faces (42 emitted vertices), total 112 rock triangles. Broad shoulders and blunt crown; preserve side faces and large Gouraud-shaded facets.
Rock materials: depth-test/write on, front faces, clip below ground, split face normals. Key direction (-0.65,0.8,0.55); shade anchors #b8b8b0/#7a7c78/#3a3d3c, vertex-height gain 0.67→1.10.
Multiply by a nearest-sampled 64² seven-pigment noise texture: #4a3020, #634027, #7d502e, #a07040, #b3844d, #bf965c, #c9a46a. Noise octave weights 0.65/0.25/0.10; quantise to seven levels; affine UV sampling and half-resolution vertex snap supply the PS1 treatment.
Heat falls with squared distance from the fire base inside 88*d; add RGB `(0.75,0.32,0.055)*heat`. Matte slate lighting must keep the warm pigment distinct from light sand.
Ground contacts use soft 32² radial cards sized `2.1*r*d × 1.45*r*d`, below actors/stone; alpha `0.72*rise*(1-sink)*(1-release)`.
Travel fade starts born+0.34 over 0.50; travel sink starts born+0.48 over 0.38. Climax sink is `1-(1-clamp((a-sinkAt)/0.25))^3`; retain opacity 0.99, translate down one full rock height.

Fire is additive: procedural 128² cards with seven broad orange tongues and soft white-hot cores; #ff7a14/#ff9c23/#ffef99/#ffffff, impact falloff #ffc655→#ffffff. Use two cards per cluster; endpoint sizes 105×59 and 68×32, travel `(39+31*s)×(23+20*s)` and `(23+22*s)×(14+15*s)`.
Bloom envelope `S(age/0.04)*(1-S((age-hold)/0.20))`, hold=0.30 endpoint /0.08 travel; closing `S((a-1.75)/0.04)*(1-S((a-1.87)/0.20))`.
Six ground annuli use 32 segments (64 triangles each); travel radii `15+8*s`/`16+8*s`, endpoint 31/32, inner/outer. Second endpoint ring delayed 0.06; 0.45 lifetime, scale 0.55→2.25, alpha 0.32→0, colour #ffe9b2.

Dust capacity 92: ten travel puffs per eruption (40) plus 52 retreat puffs (8 ring,40 body,4 wisps). Every puff is a 2-triangle camera-facing quad; one global back-to-front sorted batch per view. Depth test on/write off, normal blending.
Use 64² grayscale feathered density noise, continuous UV warp amplitude 0.18, independent rotation, curl and outward drift. Density has no solid core; dust must read as gas.
Travel puff birth `offset+0.03+max(0,i-3)*0.015`, lifetime `0.90+(i%5)*0.07`; size `(50+70*s)×(38+28*s)` times d; drift 10–18*d, lift 5–9*d, initial radius 2–7.4*d.
Travel growth 0.20→1 at normalized life u=0.55, then →1.10. Alpha rises to 0.36 by u=0.15, reaches 0.28 at 0.55, eases to zero at 1. Drift uses `(1-exp(-2.6*u))/(1-exp(-2.6))`; sinusoidal curl amplitudes 2.2/1.7*d.
Retreat ring/body births `1.60+(i%5)*0.012`; wisps 2.02,2.055,2.09,2.125; each dies at 2.92. Ring size 50×34, body 50–64×48–56 (low body 64×53), wisps 38×42, times d.
Retreat drift: ring 37, body 22–31, wisps 30; lift low=8, high body=20–29, wisp=35, times d. Growth `0.35+0.75*S(u/0.22)+0.28*S((u-0.22)/0.78)`; alpha `0.36*S(u/0.13)*(1-S((u-0.43)/0.57))`.
Retreat palette #a57b4c (low) / #d1ad73 (high) → #d7bd8d, shade 0.83–1.19, warm lit tops/toasted bases. Spin ±0.80–1.72 rad/canonical s; sinusoidal curl 4*d and vertical roll 3*d.
Feather dust across ground and fire-bed bottom. Enemy sprite-alpha masks attenuate retreat density to 0.015: worst-case cumulative alpha `1-(1-0.36*0.015)^52=24.54%`. Keep masks registered through camera shake and retain near-side cloud depth over sinking rocks.
Randomisation uses deterministic formulas (`i*2.399963` emission angles and per-puff seeds); shader value-noise hashes fixed constants. Preserve placement and timing across replay.

One closing camera shake: start canonical 1.75 (game 0.807692), last 0.22 game s; pulse `sin(2π*2.5*u)*exp(-1.6*u)` for u in [0,1). Nominal vertical amplitude 6 px at 360×640, horizontal 1.5 px; round offsets to 2 px render blocks. Return exactly to zero. Scale with viewport; apply equally to scene and silhouette masks.
Sim mapping: canonical 1.30 corresponds to 0.60 game s in the study. Align that first endpoint eruption to the authoritative hazard resolve; fit anticipation into the live sim windup and retain the ordered tail. Use actual sim line direction/length/width and victim set; VFX never causes damage.
Owner rules: Fara stays planted with original sprite, transform and colour; hand glow and gold floor tint are separate overlays. Hero faces target. Preserve travelling buildup, gas clouds and opaque sinks; omit the reference's triangle explosion.
