# Bubble Pop v3e

Owner-approved 2026-10-30. Source: local study `v3-bubble/scene.js`, `AGENTS.md`, `README.md`; release interpretation in `v3-bubble-ref/LAYERS.md`. This folder has no `proof/notes.md`.
Reference construction: a glossy volumetric soap sphere swells around the target, then releases a brief cyan-white flash, ten soft glowing orbs and hundreds of tiny airy glints dispersing outward and upward. Preserve the rainbow Fresnel rim, white specular highlight and wobble.

Layers in order; study time t begins at cast start:
1. Sphere swell 0–0.350: radius 83, centre y=`108*s`, scale `s=0.32+0.68*clamp(t/0.35)`. Three.js IcosahedronGeometry detail 2 gives 180 triangles. Vertex displacement along normals `1.8*sin(position.y*0.12+14*t+position.x*0.04)`.
2. Rim/highlights during swell: torus radius 81, tube 2.4, segments 4×48 (384 triangles), camera-facing; white 39×39 glow scaled 0.8×1.7; white 12-radius subdivision-1 icosahedron sheen (80 triangles) scaled 0.48×1.5×0.2. Highlights at (-32,151,43)*s.
3. Ground contact glow: additive quad size 157, #19dbff; opacity 0.50 through swell, fading over 0.10 after pop.
4. At t=0.350 hide sphere, rim and highlights. Flash: two additive radial quads 250/130, #48dfee/#c0faff, y=108. For pop age a<0.075, alpha `0.50*(1-a/0.075)^2` / `0.28*(1-a/0.075)^2`; larger glow scales `1+3*a`.
5. Ten soft blue orbs launch immediately at pop; camera-facing quads 19/22/25, 2 triangles each. Duration `0.44+(i%3)*0.035`; scale `1+0.65*u`, alpha `0.95*(1-u*u)^1.5`, u=clamped age/duration.
6. Mist: 760 surface motes at a=0 and 240 orb-trail motes delayed 0.02–0.26. All 1,000 are additive Gaussian points; a billboard port uses 2,000 triangles. Release scene ends at a=0.94; complete study length 1.50.
7. Faint cloud light: additive 325-square #61e3f7 glow; opacity `0.12*(1-smoothstep(0.2,0.88,a))`, scale `1+0.26*a`, centre follows `(0,108-48*a-13*a*a,0)`. This is a soft falloff without a hard boundary.

Sphere shader uses normal alpha blending, front faces, depth-write off. Facing f gives Fresnel `(1-f)^2`; hue mixes RGB `(0.03,0.8,0.92)`→`(0.95,0.16,0.7)` (approximately #08cceb→#f229b3) by normal direction.
Specular uses upper-left light (-0.55,0.85,0.8), exponent 14; mix toward white with `clamp(2*spec+0.35*rim)`. Alpha `0.14+0.77*rim+0.8*spec+0.035*sin(57*v+17*u)`; rim material #c49cff.
Orb Gaussian shader mixes #0db3e0 with white at its core: core `exp(-65*r²)`, body `exp(-7*r²)`, halo `0.42*exp(-2.5*r²)`, feather from r=0.72 to 1. Keep round luminous orbs, with no solid droplets.
Mote palette fixed per index: every 17th #f3b6ed, otherwise every fifth #ffffff, others #92eaf6; each lerps ≤0.40 toward white. Ordinary size 1–2 phone px; every 37th is 2.6 px. Style RNG seed 91731 fixes sizes, colours and delays across casts.
Mote texture: 64² white RGB, Gaussian alpha `exp(-4.5*r²)` with outer 0.72–1 feather; linear sampling. Depth test/write off for mist, additive blending; keep subpixel specks soft and round.

Seeded emission: `castSeed` unsigned 32-bit; LCG `(imul(seed,1664525)+1013904223)>>>0`, return /2^32. Live study recast uses fresh crypto entropy; a port stores a presentation seed per cast without consuming sim RNG. Scrubbing retains the seed.
Two streams: fixed style seed 91731 and motion stream castSeed. Seed 91731 reproduces the approved baseline arrangement; other seeds vary only emission and movement. Preserve this baseline branch for reference replay.
Motion samples uniform unit spheres with y uniform [-1,1], azimuth [0,2π). Global bias is a sphere vector ×0.075; global rotation uniform [0,2π). Outward direction = normalized(sample + 0.18*secondSample + bias).
Orb direction i: azimuth `i/10*2π+0.24+turn+jitter`, jitter ±0.225; y `0.24+0.56*sin(2.3*i)` plus ±0.10, z component `0.8*sin(azimuth)`, then add bias and normalize. Speed 300–380; baseline 300/340/380.
Emission surface at pop: `p=83*n + n*1.8*sin((83*n).y*0.12+0.35*14+(83*n).x*0.04)+(0,108,0)`.
Orb position at age a: `origin+velocity*(1-exp(-6*a))/6+(0,-48*a-13*a²,0)`.
Surface motes originate on that sphere; speed 260–460, lifetime 0.60–0.92. Trail motes originate at their orb's delayed position plus ≤5-unit radial jitter; velocity `orbVelocity*exp(-6*delay)*0.55+outward*(40…110)`, lifetime 0.60–0.78.
Mote drag k=5.4–6.6 (baseline 6); flutter frequency/amplitude multipliers 0.85–1.15 (baseline 1). At age b after delay: position += `velocity*(1-exp(-k*b))/k`; y -= `48*b+13*b²`.
Flutter x += `sin(11*b*rate+phase)*2*b*amplitude`; y += `(sin(9*b*rate+phase)-sin(phase))*1.8*b*amplitude`.
Alpha starts at the emission delay and fades with `1-smoothstep(0.38,1,b/life)`; twinkle multiplier `0.88+0.12*sin(17*b+phase)`, spatial-core gain 0.75–1.00. Lifetime, direction, speed, drag, phase and flutter vary with cast seed; presentation counts and style stay fixed.

Render order: base sphere/actors at 180×320, nearest enlarged into 360×640 with 5-bit Bayer quantisation and eight-tap faint bloom. Then clear depth and render release orbs/mist at full output resolution; preserve their 1–2 px sizes. Generic low-resolution-only particles would change this approved release.
Sim mapping: align study t=0.350 to the sim's BubblePop resolve, fit swell to its cast window, then let the airy tail play once. Actual hazard footprint, enemies affected and knockback remain sim-owned; study radius 83 is presentation geometry. Use existing spotlight/clock handoff.
Owner rules: light, airy spray with quick fade and readable volume. Keep heroes' original art, material and colours; sphere/mist are independent layers. Runa faces the target: right-facing source at x=98 with target x=15 uses XOR UV mirroring.
