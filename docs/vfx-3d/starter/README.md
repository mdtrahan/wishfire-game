# Art-free WebGL starter

Own code generalized from the approved studies. Pinned renderer: **three.js 0.160.1,
revision 160**. Classic scripts load directly from `file://`; no module loader,
server or asset fetch runs at playback. Actors are plain asymmetric coloured quads.

## Fetch and run

From this `starter/` directory:

```sh
mkdir -p vendor
curl --fail --location 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js' --output vendor/three.min.js
printf '%s  %s\n' '170c6789f43217c96b3170f4b42fafe135de7f7cd48497a4218f9757ee1d49fa' 'vendor/three.min.js' | shasum -a 256 -c -
```

Open `index.html` as a local file, for example
`file:///absolute/path/to/starter/index.html`. Recast rolls a fresh uint32 seed;
Replay seed repeats it. Scrubbing pauses and evaluates absolute time. Speed controls
use 1× / 0.5×; autoplay rolls a fresh seed at each cycle. Keyboard controls use ordinary
buttons, labelled inputs and visible focus. Missing vendor displays a fetch instruction.

`vendor/` is gitignored. Fetch from that exact URL rather than replacing it with an
unversioned CDN build. It supplies the locally loaded global `THREE`; it is never vendored
into this package. Three.js is MIT licensed; retain its fetched license notice when distributing
an assembled demo. Generated textures live only in browser memory.

## Build a spell

Read [PLAYBOOK.md](../PLAYBOOK.md) and the [approved specs](../README.md).
Replace the tiny comet's `build` / `render` in [app.js](app.js).
[helpers.js](helpers.js) exposes `window.VFX`:

| Helper | Contract |
| --- | --- |
| `rng(uint32)`, `freshSeed(previous)` | Same seed reproduces construction; fresh casts change seed. Keep combat RNG separate. |
| `billboard(parent,camera,w,h,material)` | Camera-facing two-triangle quad; set position and render order explicitly. |
| `material(fragment,uniforms,options)` | Transparent shader, depth-write off, additive by default; `additive:false` uses normal blending. Projected snap defaults on. |
| `glow(parent,camera,size,color,options)` | Feathered additive card; animate `material.uniforms.alpha.value`. |
| `ribbon(parent,camera,segments=28)` | Reusable camera-facing geometry. `update(sample,halfWidth,alpha)` samples world positions tail→head. |
| `gasParticles(parent,camera,rng,origin,count)` | Feathered noisy normal-blended puffs, depth test on/write off. `update(age)` changes drift, curl, scale, alpha and density. Separate meshes use three.js depth sorting. |
| `mistPoints(postScene,rng,origin,count)` | Gaussian additive points; `update(age,outputScale)` preserves 1–2 logical px dots. Render after post; depth disabled deliberately for this overlay. |
| `dispose(group)` | Dispose this group's owned geometry/materials before replacing a cast. Helpers share no textures. |

The canvas drawing buffer follows its live CSS size × `devicePixelRatio`. Sampling
levels divide that buffer: L0=/6, L1=/3, L2=/1.5, L3=native, rounded to whole pixels.
Use `index.html?vfxres=0|1|2|3&ps1=0|1`. Default: L3 + PS1 on. As in the runtime,
lower levels always stylize; `ps1=0` bypasses vertex snap and 5-bit Bayer quantization
at L3. Targets, projected snap grid and dither share the derived dimensions.
Layout/DPR changes rebuild the target and redraw even while paused. Nearest filtering
preserves deliberately coarse levels. The CSS stage keeps its 9:16 aspect ratio and
360×640 orthographic world framing at every size; resolution never changes placement.
World cards/ribbons snap projected vertices; mist retains smooth round sampling in its
separate full-resolution scene. Ground gas stays in the base pass, matching Ground Pound.

Camera follows the approved Arcane orthographic framing: ground squash .75, upright
58 px actors, zoom .5. `groundPoint(simX,simY)` converts sim units to design coordinates;
the arena plane represents 2160×900 sim units. These fixed example anchors illustrate
placement, with no sim connection. The brighter face marker on each placeholder proves
the source-facing XOR mirror. Real actors need their manifest source-facing metadata.

Custom shader colours and built-in three.js colours need consistent colour-space handling.
Keep the existing output chunks when modifying shaders. Preserve clean release: all effect
alphas reach zero and the original actor pixels return. The sibling reference sources require
study `ART` globals and hosts; this starter has no dependency on those omitted assets.

## Headless verification and native PNG proof

Requires Node, Playwright with Chromium, and ffmpeg/ffprobe for full proof. Reuse installed
Playwright if available; otherwise, install locally here (ignored; no project dependency change):

```sh
npm install --no-save --package-lock=false playwright@1.58.2
node node_modules/playwright/cli.js install chromium
node capture.cjs --smoke
node capture.cjs
# PNG-only alternative, using a fresh destination:
node capture.cjs --stills --out=proof/native
```

If reusing a dependency outside normal Node resolution, set `PLAYWRIGHT_MODULE` to its
absolute module path. `--smoke` writes no proof files. It checks file:// rendering, console
errors, seed replay and variation, reverse scrubbing, time/seed input validation, control
state, repeated-cast disposal and exact baseline pixels after release. It also checks
all four sampling levels, L0/L3 actor silhouettes and the comet's high-contrast footprint
(within two L0 pixels), live DPR changes, mid-effect resize roundtrips and native PS1 bypass.
The comet mask uses a 64/255 change from its clean frame; faint 32/255 bounds are logged
separately because L0 loses the subpixel tail. Projected actor anchors must match exactly.

Full capture defaults to ignored `proof/`; choose a fresh `--out=/absolute/path/to/round`
to preserve snapshots. The script refuses an existing destination. Never commit that output.
All browser work remains headless; no server or port is opened.

Primary proof uses Playwright `deviceScaleFactor` at 390×844@3, 360×640@2,
820×1180@2 and 1440×900@2. At each size it saves lossless device-pixel page PNGs,
native canvas PNGs and unscaled 1:1 crops at 0.100, 0.500, 0.900, 1.200 and 2.200 s.
The stage remains at most 360 CSS px wide; page screenshots retain the device viewport
and crisp DOM controls for comparison. Crop logical x=40,y=190,w=220,h=240 follows the
actual canvas pixel ratio. Change it for larger spells. The static light-mode gallery
shows crops at their intrinsic pixel dimensions with `image-rendering:pixelated` and
horizontal scrolling, without browser downscaling. Inspect at 100% browser zoom.
`--stills` skips ffmpeg/GIF work; it needs only Node, Playwright and Chromium.

Full capture adds secondary motion proof: three labelled seeds at 60 source samples/s
from a native 360-CSS-px canvas at DPR 3. In-game GIF exports at 720×1280; close-ups
export at 660×720 (3×). Both encode at nominal 30 fps, at 1× and 0.5×.
`capture.json` records native dimensions, DPR, level comparisons, crops, seeds, measured
GIF dimensions/durations and ffmpeg arguments. GIF delays quantize to centiseconds.

The script runs these ffmpeg filters; equivalent commands from `starter/`:

```sh
ffmpeg -n -framerate 60 -i proof/ingame/%04d.png -filter_complex 'setpts=PTS/1,fps=30,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a' -loop 0 proof/review-ingame-1x.gif
ffmpeg -n -framerate 60 -i proof/ingame/%04d.png -filter_complex 'setpts=PTS/0.5,fps=30,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a' -loop 0 proof/review-ingame-0.5x.gif
```

Substitute `proof/closeup/%04d.png` to encode close-ups. `closeup-strip.png` is made from
every fourth **decoded GIF** frame; `gallery.html` is a light-mode no-JS gallery, tested
with JavaScript disabled. Inspect its motion, strip and final decoded frames before review.
Capture failure exits nonzero; a partially written round remains for diagnosis.

This starter proves reusable rendering seams. The four approved spell specs still own
their art. Runtime timing, targets and damage must bind to simulation events; a desktop
SwiftShader run supplies no mobile GPU or Rust integration claim.

Keep the fetched vendor and generated media untracked. Re-run capture after changes;
inspect native PNGs and decoded GIF frames before reporting visual acceptance.
