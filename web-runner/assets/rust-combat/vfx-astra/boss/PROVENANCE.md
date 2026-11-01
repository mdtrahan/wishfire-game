# Boss VFX pass8: Djinn windup revision, lead review pending

2026-10-25. Troll pass7 received lead PASS and is frozen. charge-shell.png and charge-lines.png match pre-pass8 hashes exactly. Approved beam-head/body and stomp also remain exact. Replaced only beam-charge-lines.png and beam-charge-core.png, updated spec/provenance and local art contract. No Rust edits, commits, or runtime integration. Previous production set archived in art/_work/boss-telegraphs/pass8/archive.

## Lead feedback and revision

Lead rejected pass7's tiny dashes and subpixel core at game scale. Lead explicitly relaxed aperture matching: core glow may exceed aperture and fade60ms over release. Pass8 uses10/11/12/13/14 packet tracks by progress bank, base width5-7screen px, lengths14-30screen px, maximum90px diameter field. Alpha rises .72/.79/.86/.93/1. Packet tip approaches core and length contracts; last cel goes beneath rim with40%alpha before respawn. Timing offsets and irregular angles differ; ten of fourteen tracks are beam-side, backside additions stay below face. Core occludes incoming tips. Authored track count does not guarantee each overlapping packet reads separately at every pose.

New core grows8/11/14/17/20/23/26/29/32px diameter over nine progress cels, with dense white/cyan interior and violet rim. Small runtime scale pulse+/-2.5%at7Hz, about hand pivot. On release lines clear and head/body begin immediately; core frame8 remains atop head with linear60ms fade. Cancellation clears all immediately. Warning p uses full scheduled tracking+lock duration. Enraged dimensions scale1.5x.

## Method and painted provenance

Inherited matched-scale hero-reference trace is retained as beam-reference-trace.png; reference and trace accompany candidate boundaries using A purple/B green. A reuses pass6's generated single straight white/cyan/violet painted stroke (source and exact prompt recorded in pass6/generation.json), resizing and rotating bitmap packets. First pass8 mock looked like connected spokes; final revision keeps gaps from core until absorption, and narrows/asymmetrically spaces arrivals. No code-drawn production shapes. B is new built-in image_gen.imagegen transparent painted core, source retained as core-master.png/core-source.png. Mechanical alpha cleanup removes near-transparent fringe, then crop/downscale; no generated geometry masks. Exact model version unavailable. Source hash below. Full prompt retained in generation.json.

## Integration contract

A strip13440x192RGBA: sixty224x192cels, arranged as five groups of twelve. normal quad112x96px, texture pivot80,96. Frame=12*clamp(floor(4p+.5),0,4)+floor(elapsed*30)%12. This is a declared progress-bank contract for lead integration, not a runtime implementation. B strip1152x128RGBA: nine128cels, normal quad64x64px, pivot64,64. Frame=clamp(floor(8p+.5),0,8); baked diameters above, no extra p-scale. Pulse around anchor. On release freeze frame8, opacity=max(0,1-release_elapsed/.060). Head/body geometry/pixels and flush wall ending unchanged.

## Review and proof limits

beam-vs-reference.png: annotated A/B side-by-side with original hero reference and matched-scale trace, plus full sand/spotlight360x640phones. beam-phones.png and separate background PNGs show0/25/50/75/100%and release+0ms. handoff-0-30-60ms.png shows glow fade over frozen head. Fixed-progress GIFs show loops/core pulse; warning-release GIFs show full2.3s warning followed by release/fade. Boss70px, hero32px, head60px. Art mocks only: runtime sockets, animation poses, authoritative schedule, blending and performance remain lead integration checks. Self-review: broader separated strokes and8-32px core are visible on sand; core covers forearm but leaves sampled face clear. Reviewer decides whether the asymmetric radial arrivals sufficiently avoid a burst read.

validation.json covers dimensions, unique cels, alpha-zeroRGB,2pxclear cell edges, frozen hashes, authored packet sizes/field and consecutive inward/shortening samples. Alpha mass rises between every progress bank at every loop phase. This measures coverage, not perceptual brightness or packet separation. No runtime tests run for art-only changes.

## Sheets and hashes

- stomp-impact.png: [1536, 160], 8cels, SHA256 d4d5c7594a23327a15e85d42d137e0193ec55a8c80e445e0f195065d20743c4a
- charge-shell.png: [1536, 192], 6cels, SHA256 46fe9dd9e8a3e87a087109571772cae2c5aa1d449df3f82c0842b2c7e471e39c
- beam-body.png: [1536, 96], 6cels, SHA256 3e4f6e156031bd554b84dab7d3904431b790822e399537c03cbc6c6b5f0ddcbb
- charge-lines.png: [1536, 192], 6cels, SHA256 7981c7343cfbe59e021e3530044f9b40561b137cdc1239ad5ad0aa44eaaecf95
- beam-head.png: [960, 160], 6cels, SHA256 9770267f00928faee8e4da4b0eac55874d73f6dcf6f7bc91cb27725c9292affb
- beam-charge-lines.png: [13440, 192], 60cels, SHA256 02a45d70ca772f3b61daf269d5dc0cdbf1f7c2d5793d19398132a9f906f40019
- beam-charge-core.png: [1152, 128], 9cels, SHA256 9910a973fe6c3651210de23f82e0b1d58b6d6132ae689d8db02628d8455627aa

Core master SHA256 ee06fcdbaa8f0f5672c66cc1c80bcf00e97848d0455bbaa717998d2226215ad0
