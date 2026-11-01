# Healing v2d

Owner-approved 2026-10-30. Source: local study `v2-healing/scene.js`, `AGENTS.md`, `proof/notes.md`, `ref/LAYERS.md`.
Reference construction: ground shimmer emerges beneath the caster; rising streaks and sparse lavender rings prepare descending white-gold curtains over recipients. Individual stars twinkle through the aura, then linger as the shafts lift away.

Layers in playback order; `t=0` is study cast start, recipient `j` uses `q=t-0.16*j`:
1. Caster ground light, 0–1.20: envelope `S(t/0.5)*(1-S((t-0.65)/0.55))`; disc radius 45, wash width 101.25. Two thin concentric gold rings with white inner edges share one shader quad (2 triangles); a second quad carries the radial wash.
2. Caster risers, same envelope: 56 camera-facing quads, 2 triangles each; radius 8–44, height 110–240, width 0.55–1.35. Seeded phase 0–1 and speed 0.7–1.4 give independent rising streaks; onset `S((t-phase*0.3)/0.45)`, alpha multiplier 0.85.
3. Lavender wisps: six 12-segment annuli (24 triangles each), inner/outer radii 3.8/5.1. Birth offsets `i/6*0.5`; rise from y=8 to 198 over 1.2. Alpha `0.82*S(age/0.32)*(1-S((age-0.75)/0.35))`; angular drift `t*0.22+i/6`.
4. Recipient ground disc: radius 23, wash width 51.75; build 1.20–1.70, retire 2.60–3.70 in q. Broad halo card 47×195 centred y=70; opacity `0.18*energy*(1-ret)`.
5. Recipient curtain: six separate normal-blended quads (12 triangles total), x about -17…17 with ±0.765 jitter, height 137–191, width 9–15. Keep the recipient in front of these cards.
6. Foreground light: source-chroma sprite illumination, a separate silhouette rim quad, and 32 mote quads per recipient; preserve colours, outline and ground contact.
7. Retreat: shafts thin and lift from q=2.60, with per-shaft phase delays ≤0.15. Stars survive beyond the retreat and fade independently; full study cycle ends at t=4.40.

Ring shader: quad width `2*r`; UV outer radius `0.425+0.035*(1-exp(-max(0,time)*0.55))`, inner `0.29+0.045*expansion`. Band half-width 0.005 UV with derivative antialiasing; white edge lies 0.004 inward. Ring alpha gain 0.78 (caster overrides to 0.95); wash gain 0.62.
Curtain curves: `on=S((q-1.2)/0.5)`, `ret=S((q-2.6)/1.2)`, `energy=on*(1-ret)`.
For each shaft, `R=S((q-2.6-phase*0.15)/1.0)`; lower edge `(1-on)*80+220*R`, height `h*(1-0.56*R)`, width `max(0.005,w*(1-0.97*R))`.
Shaft alpha `on*(1-R)*(0.64+0.20*sin(q*(2.2+3*phase)+phase*2π))`; vertically scrolling streak UVs at 0.16/s, feathered ends. Preserve visible gaps between the six shafts.

Motes per recipient: 20 small 3–5 px stars, six medium 8–12 px stars, two rare 16–22 px hero stars, four round motes with 3–5 design-unit base sizes. Every mote is a 2-triangle billboard.
Place them in seven columns across 66 units, five rows at `8+floor(i/7)*24+random*13`, with z jitter ±4. Star scale compensates perspective to preserve the stated phone pixel widths.
Small/medium/dot start 1.35–1.95, end `3.5+phase*0.65`; typical lifetime 1.55–2.80. Birth and tail ease over 0.30/0.35; twinkle frequency 1.4–3.4 Hz, raised to power 1.2; opacity `peak*birth*tail*(0.06+0.94*twinkle)`.
Hero stars start `1.2+phase*0.1+i*0.2`; pulse lifetime 0.32–0.47, repeated at `0.8+freq*0.015` only before q=3.65. Pulse is `sin(π*age/lifetime)^1.5`; peak 0.85–1.0. Approved captured lifetimes were 0.325–0.404.
Motes rise at most 7 units after q=2.6. Preserve independent phase, peak, end and frequency; avoid synchronized clouds.

Materials: streaks, rings, wash, motes and silhouette rim use additive blending; curtains use normal alpha blending. Transparent cards are double-sided, depth-write off. Render curtain=4, recipient=6, rim=7, motes=8.
Palette: white-gold streaks #ffef94→#ffffff; star core #fffef2; round core #fffff8→#fff5b0; wash #ffd77b, lavender #9470e2. Curtain shader edge/core RGB `(1,0.58,0.045)`→`(0.96,0.99,1)` (approximately #ff940b→#f5fcff); ring RGB `(1,0.66,0.13)`→`(1,0.98,0.87)` (#ffa821→#fffade).
Textures are procedural: 64² streak/wash, 32² four-point glint, 16² dot. Recreate shader/procedural falloffs during porting.
Randomisation: study LCG seed 137, `seed=(1664525*seed+1013904223) mod 2^32`; consume the approved reference stream in order for streaks, shafts and motes. Repeatable scrubbing preserves every phase.

Sim mapping: the study's 1.20 blessing onset is an art cue. Bind recipient onset to the actual target-locked heal event, map prelude to its sim cast window, then play the blessing once. Membership and heal amounts come from the sim.
The retained HealingSpring demonstration has radius 138 world units (69 design px), 10 s duration and 1 s ticks. Its broad wash ramps 0.20–0.70 and releases 10.20–11.00; its duplicate ring quad stays disabled. This demonstration supplies no new pool gameplay to the current target-locked heal.
Later spring ticks use six 5×5 glint quads per recipient, 0.24 s sinusoidal flashes at phase `(t-1.2) mod 1` after t=4 and before t=10. Regen keeps its separate 0.5 s combat cadence. Neither tick restarts the full curtain.

Owner rules: luminous emergence and a lifted blessing retreat; preserve separately twinkling stars. White normal-blended sRGB hero material stays intact, with no recolour or source-sprite mutation.
Recipient-only light follows source chroma: for RGB c, hi=max(c), lo=min(c), add `(c-lo)/(hi-lo)*healLift*(1-hi)` when hi>lo; grayscale uses unit light. `healLift=0.2*energy`; channels never decrease and minimum channel stays fixed.
At q=3.80 the lift is exactly zero, restoring the ordinary sprite path byte-for-byte (t=3.80/3.96 for two recipients). Rim also releases; preserve original sprite transform and alpha.
Hero faces target through source-facing XOR mirroring. Runa art faces right; the demonstrated left-side recipient requires mirroring.
