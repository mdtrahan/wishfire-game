# Arcane Pulse v4c-f

Owner-approved 2026-10-30. Source: local study `v4c-arcane/scene.js` and `rounds/arcane-v4c-f/`; exact approved code in `reference-code/arcane-pulse-scene.js`.
Reference construction: planted Kaja gathers hand light, then sends white-hot violet→blue→cyan comet beams along five fixed paths into the target. Uneven repeats and irregular launches separate the streaks; each arrival adds a targeting ring, core burst and thin hot-yellow radial lines.

Five immutable templates, ordered LO / LI / M / RI / RO. Each pair below is a cubic control's `(forward fraction, lateral fraction)` of the projected caster-to-target vector:
- Left outer LO: `(0.2522677418775857,-0.8622257295977709)`, `(0.6319342260807751,-0.1590524583508562)`, side +1.
- Left inner LI: `(0.23252791421487892,-0.40975136041685756)`, `(0.6352939597517252,-0.07321864887858688)`, side +1.
- Straight middle M: inner forward fractions, side 0, exact centre throughout.
- Right inner RI: inner controls, side -1.
- Right outer RO: outer controls, side -1.
For start A, end B and `(dx,dy)=B-A`, control = `A+(dx*f-dy*l*side*w, dy*f+dx*l*side*w)`. Outer/inner templates preserve the approved bulb silhouette, mirrored across the centre line.
Start is caster body height 0.72; end is target height 0.48. Study heroes are 58 px high, caster (-20,0,115), target (35,0,-20). Port endpoints come from the actual actors.
Each cast rolls `8+floor(random*5)` beams, inclusive 8–12. Shuffle one guaranteed assignment to each path, then independently pick each extra path uniformly at random. Reroll the extras until `max(counts)-min(counts)>=2`; every path appears and totals stay uneven. Allocation order and launch order differ.
Each bowed beam uses width multiplier `w=1±(0.03+random*0.03)`, a seeded random sign. Middle width stays zero. Per-beam flight, trail history, foreground/background choice, impact-line count and angle also vary; shared templates remain fixed across casts.

Timeline uses real playback seconds below. `EFFECT_TIME_SCALE=2`, `authoredTime=realTime/2`: the approved 1× view runs the whole effect at half speed, including trail history. Additional 0.5× media slows that playback again.
1. Hand charge 0–0.500: three additive discs 25/12/6, colours #8a12ff/#e299ff/#ffffff, alpha `sin(π*realTime/0.500)` times 0.8/1.4/2. Seven short 0.9-wide radial lines orbit at authored radius `8+5*sin(25*t+i)` and angular rate 12 rad/authored second.
2. Launches: for a path with n beams, shuffle its beams, sort n independent samples over authored window `0.5-0.04*(n-1)`, then add `0.04*i` to sample i. Real window is `1.0-0.08*(n-1)`, giving at least 0.080 s between launches on that path. Different paths interleave freely. Approved overlay's real adjacent launch gaps: seed 1, 0.007–0.306 s; seed 1456, 0.022–0.208 s; seed 1972, 0.021–0.213 s. These are captured ranges, not global clamps.
3. Flight: authored `0.35+(random-0.5)*0.025`, real 0.675–0.725 s. Shift every launch/arrival together until the earliest arrival is exactly 0.900 s. First launch therefore lies within 0.175–0.225 s. Each path's pre-shift launches span at most 1.000 s; latest arrival is at most 1.950 s.
4. For normalized flight p<0.5, follow cubic parameters 0→0.60. At p>=0.5, `q=2*(p-0.5)`, interpolate cubic(0.60)→target with weight `0.25*q+0.75*q²`: a tangent accelerating straight dart. Half-flight lasts 0.3375–0.3625 real s.
5. Trail history authored 0.160–0.185, real 0.320–0.370 s. Curved flight uses 0.65×history; dart uses 0.45×history and clamps its tail to the half-flight join. Dart tail length additionally caps at 0.45 of a 12-sample curve-history length.
6. Each arrival plays a 0.440 s impact. Enemy light fades over 0.200 s. End is `max(realArrival)+0.440`, bounded by 2.390 s. Overlay seeds 1 / 1456 / 1972 finish at approximately 2.194 / 2.290 / 2.261 s. The last-arriving beam receives impact size gain 1.12.

Beam geometry: camera-facing 28-quad ribbon (56 triangles) plus three head billboards (6 triangles). Ribbon half-width `(0.12+0.88*u^0.7)*6`, u tail→head; dimensions scale by heroHeight/58.
Ribbon uses additive blending, double-sided faces, depth test/write off. Procedural 64×2 transverse texture: stops 0/0.30/0.46/0.54/0.70/1, alpha 0/0.6/1/1/0.6/0, linear sampling.
Lengthwise RGB `(0.55,0.07,1)`→`(0.05,0.25,1)`→`(0.03,1,1)` (violet→blue→cyan), blue transition u=0.48. White-hot core RGB `(1,0.98,1)`, transverse power 12 and mix gain 0.98; opacity multiplies `u^0.65`.
Head sizes 18/11/5, colours #008aff/#60eaff/#ffffff, alpha 0.8/1.5/2; dart core alpha 2.6. Core rotates along flight and stretches x=`1.2+1.1*(p-0.5)`, y=0.85. Short tapered tails and a bright capsule-like head preserve the comet look.
Seeded `behind` beams render behind actors until p=0.48; afterwards ribbon/head render at foreground order 3/4.

Per-hit impact age a uses real fraction `f=a/0.440`, fade `(1-f)^1.7`, size gain g=1.12 only for the final arrival:
- Independent foot ring: rx=`(17+10*f)*g`, ry=0.47*rx; 40 segments, width 1.1, #ffd83c, alpha 0.85*fade. Four cross ticks #fff4a0 at order 2.
- Body core burst: three billboard sizes `(28+15*f)*g`, `(15+9*f)*g`, `7+4*f`; #ffc92e/#fff1b4/#ffffff, alpha 0.75/1.5/2 times fade.
- Thin outward radial lines: seeded count 10–16 and starting angle; width 1.05, #ffe36a. Inner radius `5+18*f`; outer adds `(23+10*sin(4.3*j))*(1-f)*g`. Lifetime 0.440 s with the same fast fade.
Per hit: ring 80 triangles, ticks 8, glows 6, radial lines 20–32, total 114–126. Enemy light is a separate additive sprite overlay, peak 0.38 fading linearly over 0.200 s.

Randomisation: unsigned cast seed, LCG `(imul(seed,1664525)+1013904223)>>>0`, return /2^32. Keep the count draw even with a debug count override. Store seed/count for replay and scrubbing; recast chooses fresh entropy. Use a presentation RNG stream independent of combat RNG.
Sim mapping: align the first arrival at study 0.900 s to ArcanePulse resolve, fitting charge/flight to the actual cast window. Subsequent beams express the same authoritative damage cosmetically. Beam count never changes damage, victim set or footprint.
Macroquad port: use `Camera3D`, `Mesh`/`draw_mesh`, billboard quads and GLSL ES `Material` shaders. Preserve projected path controls, additive order, shader falloffs and seeded clocks. Render into 180×320, nearest-enlarge into 360×640 with 5-bit colour quantisation and the small ordered pattern; camera uses orthographic projection and 0.75 ground squash.
Owner rules: Kaja stays planted and faces the target through source-facing XOR texture-U mirroring (art faces right). Preserve original sprite pixels, colours and transform; hand light and target illumination stay separate layers. This spec/reference ships no runtime port.
