# Crimson Sweep provenance

Date: 2026-10-25. Artist: GPT Astra. Art director: Claude. Workspace: isolated ORKA-6jh1 Rust combat MVP.

## Sources and tools

Three new source paintings generated with built-in image_gen.imagegen, transparent_background=true. Backend model/version identifier was not exposed. References were studied visually; generation calls used text prompts without reference-image inputs. No third-party art was downloaded.

Read-only references: art/vfx-astra/PROVENANCE.md, art/vfx-astra/split-faze/spec.json and PROVENANCE.md, art/vfx-astra/shadow/PROVENANCE.md, preview.jpg and shadow-impact.png (current red exterior rim), art/vfx-astra/preview.jpg, art/wishfire-skills/SOURCE.md and vfx_split_slash.png, plus Fara idle-right-000.png in the worktree's web-runner/assets/puppets/fara/frames/. Preview uses actual Fara and Gobloc idle crops from web/gen/assets.json / atlas-001.png, visible height 32 px.

## Process

Generated eight arc cels, six impact cels and four gather cels. Source masters copied into art/_work/crimson-sweep/source-*.png; generation.json retains exact prompt/source mapping. The same scratch folder owns pack.py, review.jpg and small actor crops. Tool autosaves remain untouched.

Pillow and NumPy cut the generated grid into cells, remapped alpha (alpha-8)/246, removed transparent colour residue, scaled raster cels with Lanczos and packed horizontal strips. Arc cells share source pivot (20,192) and output pivot (16,96); source X/Y scale 0.47/0.60. Impact source pivot (272,276) maps to (48,48), scale 0.185. Windup uses explicit per-frame painted-core alignment, scale 0.19. All output frames have at least 3 transparent texels at each edge. RGB is zero wherever alpha is zero. Straight alpha retained; no palette quantization or premultiplication.

Decay opacity envelopes: arc [0.75,1,1,1,0.9,0.7,0.42,0.12], impact [0.8,1,1,0.85,0.5,0.15], windup [0.65,0.8,0.95,1]. Actual changing silhouettes come from separate generated cels. No procedural effect strokes, vector primitives, added flame/wing forms, filled cone or danger decal. Soft red edge comes from generated raster paint and its partial alpha.

## Placement and timing

Spec follows Split/Faze schema version 1: asset array, horizontal UV convention, explicit frame dimensions, pivots, blend, world/screen sizes and clip lifetimes. Alpha is the baseline for all three layers so crimson body remains visible. Additive windup is optional and unverified in engine.

Arc opens RIGHT. Rotate the quad about (16,96) at the spear origin. At zoom 0.5 use 84x72 screen pixels; painted maximum reach from pivot is 74.48 px. This is stylized weapon motion, not an exact 140-degree cone outline. Windup attaches to spear tip, which differs from arc origin. Impact centres on each actual victim. Camera rotation and Y projection must be handled by the integrator as documented in spec.

Cast impact is t=0; windup lasts 0–300 ms. Arc begins at 220 ms, reaches its peak cel at 300 ms, and ends at 540 ms. Victim clips run 300–500 ms. Actual simulation resolution overrides these nominal times. No changes to damage, targeting or knockback.

## Preview and acceptance limits

preview.jpg is a 720x590 art contact sheet on #1c1822, every cel shown at its specified in-game size alongside Fara or Gobloc. Larger raster review lives in scratch. JPEG only for previews; deliverable textures are RGBA PNG. Checked every exported frame for clean edges, cell isolation, changing silhouettes and colour at game scale. Export validator checks dimensions, unique cels, 3 px transparent gutters, zero RGB under zero alpha, hashes and total size.

Engine rendering, animation playback in the Rust client, socket positions and final art-director acceptance remain unverified. No application code or other artwork edited. No commits.

## Exact generation prompts

### arc

Source: /Users/Mace/.codex/generated_images/01a17410-eafe-7973-afda-527ddee07392/exec-bdb3bf58-e3d7-4570-af56-49a78019e5d9.png

```text
Use case: stylized-concept. Asset type: hand-painted 2D JRPG spear slash animation source sheet, REAL TRANSPARENT RGBA background. EXACTLY EIGHT separate temporal frames arranged FOUR columns by TWO rows in evenly sized 4:3 cells; 2048x768 canvas if possible. No labels/grid. Crimson Sweep for Fara, crimson-armoured spear tank. Paint one powerful wide HORIZONTAL spear-sweeping arc in front of an invisible wielder whose fixed pivot is LEFT CENTRE of each cell. Native attack direction is RIGHT (+X). An open crescent slash curves out toward the right from the left-centre spear origin, two tapering ends with transparent opening to RIGHT, blade edge a long horizontal scything stroke; strongly horizontal elliptical perspective, no circular ring or vertical crescent. Sequence in reading order: 1 short rising razor nick close to origin; 2 fast lengthening broad curved blade; 3 full wide deep-crimson sweep with a sharp pink-white cutting core; 4 widest sharp peak held open; 5 cutting edge breaks into TWO broad curved blade fragments; 6 fragments thin and separate along sweep; 7 just two short scarlet streak remnants; 8 tiny fading fragments. Constant pivot and constant camera across all eight cells, genuine changing silhouettes. High-end Final Fantasy / Dragon Quest / Capcom hand-painted 2D combat effect, bold confident opaque scarlet/red blade planes, deep crimson body, hot pale-pink-to-white sharp central edge, restrained SOFT RED exterior rim, sparse sharp metallic sparks. Broad flat colour shapes and painted edge rhythm, extremely little texture, excellent silhouette at 75 screen pixels reach. Entire art within cell with 8% transparent gutters, no overlapping cells. The open interior stays EMPTY TRANSPARENT. NO fire, no flames, no wing/hair/feather shapes, no ornamental flourishes, no geometric wedge or cone fill, no danger telegraph, no red flat area, no weapon/person, no scenery, no text, no checkerboard.
```

### impact

Source: /Users/Mace/.codex/generated_images/01a17410-eafe-7973-afda-527ddee07392/exec-5eb82f47-65e8-400f-8101-ab421058fcd2.png

```text
Use case: stylized-concept. Asset type: 2D game per-victim spear HIT animation. True TRANSPARENT background. Exactly SIX frames, 3 columns by 2 rows, equal square cells, wide 3:2 sheet. Every frame shares fixed center and same scale with generous clear gutters. Hand-painted Japanese action RPG / Capcom impact cel: an asymmetric short diagonal jagged spear-cut burst of opaque DEEP CRIMSON and SCARLET metal-like splinters with broad hot pink-white center and a restrained soft red silhouette rim. Compact bold colour blocks, crisp irregular chiselled edges, little surface noise, clear at 26 pixels. SIX stages reading order: tiny diagonal pink nick; fast sharp broad impact with two principal blade shards and three short chips; largest brilliant pink-white cut with crimson body; white core collapses and scarlet shards fly apart; only separated short red/pink chips; two small fading scarlet chips. Make temporal changes in shape, not identical copies. No fire/flames, no feathers/wings/hair, no round radial star, no perfect geometric primitives, no circles/rings, no ground, no background fog, no full-cell glow, no scenery, no characters, no letters or numbers, no checkerboard. All content confined to central 75% of each cell. Exterior of each burst entirely transparent. Limited glow only hugging silhouette.
```

### windup

Source: /Users/Mace/.codex/generated_images/01a17410-eafe-7973-afda-527ddee07392/exec-7a1c21e0-3a33-4edf-8c40-09c1a4ee6c4f.png

```text
Use case: stylized-concept. Asset type: transparent production sprite animation for Fara's spear tip gathering energy before Crimson Sweep. Exactly FOUR square animation cells in ONE HORIZONTAL ROW. Real transparent alpha, fully invisible background, no black rectangle or glowing background wash. Fixed centered pivot and constant scale. Premium hand-painted JRPG 2D cel animation, confident broad crisp paint planes and simple silhouette at 12 screen pixels. Four progressive frames: (1) small oblique deep-crimson sliver with a pink pinprick; (2) two tiny scarlet blade flecks gathering into that pinprick; (3) compact strong hot-pink-to-white metallic glint with two asymmetric scarlet ticks hugging it; (4) compressed white-pink razor glint, bright but small, scarlet rim and two tiny incoming chips. Slight tilted diamond-like spear reflection with irregular hand-painted edges, NOT a symmetric star icon. Centre stays opaque bright, restrained soft red rim hugging silhouette only. Leave 25% entirely transparent padding in every cell. Palette matches crimson armour, scarlet body, deep wine shadows, white-pink core. No weapon object, no character, no scenery, no text/grid/checkerboard, no flames, fire, wings, feathers, hair, flowers, circles, rings, radial starburst or hostile danger fill.
```


## Source hashes

arc: `c2fe1eaa437c860c1d535b94ba3bb4720ebb173354beae8b14ae0ab50a0d5ccd`

impact: `586d768ec20ac526d2c97766eb46a0c3d4059adb21abd4cd215cb6ff29b14a49`

windup: `9586749ba44a9e28617c22f647b8b3de344e9e5e4efeb577397e73c782d2fd28`

