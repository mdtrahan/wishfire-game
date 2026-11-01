# Djinn beam v8

Owner-approved 2026-10-31, ORKA-6jh1.43. Binding source: local
`output/ORKA-3d-spell-study/rounds/djinn-beam-v8/{study.html,app.js,README.md,REVIEW.md}`,
with `proof/clip-vs-v8.jpg`. Approval supersedes the study's pending-review labels.
Our byte-identical [JavaScript](reference-code/djinn-beam-v8.js) and
[HTML](reference-code/djinn-beam-v8.html) retain the original shaders, geometry,
parameters, controls and postprocessing. HTML's study-relative `app.js`, vendor
and reference image paths document its original host; this text archive omits
three.js and all media. It is a construction reference, not a runnable package.

Design frame: 360×640, zoom .5, ground squash .75, actor 58 px. Torso (31,291),
globe (38,317), globe diameter 62, lane start (45,320). Thus globe offset from
torso is (+7,+26), beam root (+14,+29); mirror x offsets with facing. Keep these
recorded offsets rather than substituting the former painted hand socket.
World lane 120 u projects to 45 px perpendicular to horizontal travel; twin
world directions are centre ±18° (projected width 45.97 px). Use the sim's
actual direction, length and width, including enraged 180 u; cosmetic lift
moves the beam above its ground warning without changing that footprint.

Phases: study tracking 1 s + lock 120/90 s; charge progress follows the actual
sim's entire warning, monotonically. Release starts on the hazard Active
transition. Head travels source→target in .120 s, followed by full beam until
.390 s. Release ends .450 s, including final .060 s shard breakup.
`S(x)=clamp(x)^2*(3-2*clamp(x))`. Fade `S((age-.390)/.060)`; no post-.450 tail.
Combat time freezes enemy art during spotlight/hit-stop. Never schedule damage.

Globe: IcosahedronGeometry detail1 (80 triangles), diameter `8+54*S(progress)`;
hot core radius .38×, violet rim 1.045×. Body/core rotate at .45 rad/s. Eight
actual five-sided cone flares, angular jitter `.12*sin(i*4.1)`, length
`10+14*(.5+.5*sin(time*26+i*2.7))`, radius2.7; pale cyan #86fff1 with linear
emission (1.2,3,2.6), gain1.2. Release globe opacity
`1-S((age-.18)/.25)`. Original source pixels and warning remain readable.

Beam: ten-sided cylinder, 24 longitudinal segments, parallel sides; length
`L*clamp(age/.120)`, body ends .42 radii short of the travelling cap.
Hemisphere cap10×5, longitudinal radius .42× transverse radius; six four-sided
head cones during travel (length5–11, radius1.5). Twin roots alone taper from
.18 to full radius over28 design units. Source globe covers their origin.
Body radius shrinks by20%×fade; shell1.035× radius; dark rod .25× radius,
shrinking12%×fade. Rod envelope `sin(pi*u)^.82*(.94+.06*sin(u*31+time*.8))`.
Six short jagged tube veins at u=.27+i*.085; five points per vein, radial
2+k*2.2, along-step .014L, tube radius .68/four sides. Render ink after bloom,
normal alpha blend, so glow never erases the dark spindle.

Body shader: 3D value noise hash dot(127.1,311.7,74.7), multiplier43758.5453;
fbm weights .64/.26/.10 at1/2.03/4.01. Flow coordinate
`(u*L*.052-time*4.7,cos(angle)*1.7,sin(angle)*1.7+time*.38)`, warped by
three fbms at offsets11/23/37 with gain1.15. Crests smoothstep(.44,.67).
Deep teal(.002,.105,.115)→turquoise(.035,1.05,.94), crests(1.3,2.2,2.05),
pink(2.3,1.3,2) biased toward u>.4 and the rim. Facing exponent1.6;
key direction(-.35,1,-.65), ambient/key .42/.72. Pulses
`(.5+.5*sin(u*L*.12-time*55+billow*7))^9` add(1.6,2.8,2.65)*.11.

40 low-poly sphere billows per lane advect at1.1L/s and roll2.6 rad/s;
radius4.5+(i%4)*1.35, axial stretch1.3, radial placement .48 radii,
growing25% during fade and spreading to .80 radii. Normal-blended noisy
facing feather, alpha .34→.72 toward target, pink-white tint
(.15+2.50*p,1.40+.35*p,1.28+.85*p), p=S((u-.34)/.52).
Violet shell linear(.40,.04,1.55)→(1.3,.23,2.8), alpha .85×rim×.65.
Two rotating 1.22pi torus segments at .22L/.68L, major radius .47 width,
tube3.5, 4×22 segments, violet(1.15,.14,3.3), rotation .95rad/s.
Ten glowing tetrahedral motes per lane move at2.4L/s, size .7–1.5,
colour(2.7,5.2,4.6); present only behind the travelling head.

Final60ms: noise fragments the cylinder; surface turns pink-white/pale cyan
(1.6,2.7,3)→(3.1,1.25,2.8). Body opacity `1-S(fade/.48)`, cap
`1-S(fade/.55)`, shell `.85*(1-S((fade-.1)/.45))`; spindle/veins fade last
`1-S((fade-.82)/.18)`. 28 actual tetrahedral shards scatter across the lane,
size2–4.7, y stretch1.1/1.5/1.9 and z squash .55; colour
(2.2+.8*u,2.9-1.9*u,3.1), expansion40%×radius×fade. Billows grow pink-white
through their last38% fade. Avoid replacing breakup with a thin helical row.

Ground: shadow alpha .27, width4.1 radii; turquoise glow(.12,2.4,1.9),
alpha .45, width4.6 radii. Both length L+30 and fade by(1-.6*fade).
Bloom: threshold smoothstep(.70,1.15,maxRGB), separable Gaussian weights
.227/.3162/.0703 at0/±1.3846/±3.2307, radii1/3/6, gain .44; ink masks98%
of surrounding bloom. Exposure1.05, exponential tone mapping, gamma1/2.2.
Runtime uses the existing live-framebuffer PS1 quantisation/snap/dither contract;
L3 native default. Study's fixed720×1280/final6-bit pass is archival only.

Twin membership persists from warning through each lane release, even when wall
distances give different resolve ticks. Share one globe while either lane warns
or releases, and keep each lane's own120ms/450ms clock. Release geometry retains
the captured caster torso and authoritative locked hazard direction.

Lifecycle: cancel/interruption/dead or missing caster/reset discards its charge
and release. A normally resolved hazard may disappear before the .450s visual
finishes. Retain that bounded decoration on combat time; it never gates hero
spotlight completion. Cone attacks and all mechanics stay unchanged. Presentation
seed derives from hazard identity/release, independently of simulation RNG.
