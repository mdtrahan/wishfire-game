# Djinn v8 port validation · ORKA-6jh1.43

Owner-approved study: 2026-10-31. Implementation branch:
`bead/ORKA-6jh1.43-djinn-beam-port`. Rebased onto current slice
`bb2a1bdcdc1d8d4d58b5f6ada1937050016b9d42`; no merge into the slice.
Own diff changes only `experiments/rust-combat-mvp/`; `wf_sim` is unchanged
relative to that slice head.

## Delivered files

- [Specification](djinn-beam.md), byte-identical own v8 JavaScript/HTML in
  `reference-code/`, package index and AGENTS contracts. No vendor or media.
- `crates/wf_client/src/render/djinn.rs` and `djinn.glsl`: projected mesh globe,
  cylinders/caps, cone flares, noisy billows, violet arcs, spindle/veins and
  tetrahedral motes/breakup. `boss.rs` binds sim warnings/releases and cleanup;
  `vfx3d.rs` adds isolated packed-radiance bloom and keeps existing hero shaders.
- `assets.rs` removes retired banks and rejects stale beam sheet registrations;
  `art/vfx-astra/boss/spec.json` retains frozen Troll assets and names v8.
- `scripts/capture-djinn.cjs` reproduces the native captures using the existing
  sim BossSnipe DodgeTrial. `.gitignore` excludes copied local puppet inputs.

## Tests and builds

`CARGO_BUILD_JOBS=3 scripts/cargo.sh test --workspace --no-fail-fast`:
769 passed, 13 ignored, one inherited failure. By target: assets6, bench3,
client223 passed/1 failed/3 ignored, sim537 passed/10 ignored. All11 focused
boss tests passed: sim warning clock,120ms travel,390ms full/fade boundary,
450ms expiry, independent simultaneous/staggered twin angles, cancellation,
interrupted stagger, dead/missing caster, scene/wave/stage reset, spotlight
transfer and combat freeze.

The inherited failure is
`motion::tests::attacking_heroes_show_target_facing_in_seeded_combat_and_spotlights`:
Hondo has zero Performing frames. Reproduced with exact baseline presentation
sources on both assigned `dc6e174c` and current `bb2a1bdc`, without changing its
assertions or seed. Logs stay under `art/_work/djinn-v8/`.

WASM release build and `scripts/build-web.sh` passed with three build jobs.
Final staged WASM SHA256: `1800a01c2929f39bdc9a715d6e1f4f0e4ba91fd65ae2e252022052bd51b4de05`.

## Native runtime proof

[Capture metadata](../../art/_work/djinn-v8/native/capture.json),
[native PNG directory](../../art/_work/djinn-v8/native/).
20 full native frames cover charge,67ms travel,167ms full,433ms breakup and
restart cleanup across390×844@3 (1170×2532),360×640@2 (720×1280),
820×1180@2 (1640×2360) and1440×900@2 (2880×1800). An additional phone
mid-cast resize frame is1206×2460; geometry/clock probes remain identical,
and the sampled target matches the new live drawing buffer. L3+PS1 is default.
No browser/WebGL errors. Native preview also loaded the running build and
showed the same late-breakup construction without console errors.

Inspected charge/full/breakup against the approved paired sheet: faceted volume,
parallel cylinder sides, turquoise/white emission, violet detail, dark spindle
and pink-white shard/billow breakup remain visible. Runtime bloom packs linear
radiance into RGBA8 through the existing macroquad path; the study uses float
HDR. The runtime retains five-bit PS1 quantisation. No physical-phone or GPU
performance certification. Captures exercise single/enraged beams; twin
membership, geometry and cleanup have focused client test proof.

DodgeTrial intentionally stops its sim at433ms after release for seed1. Its
combat-owned decoration freezes there. Cleanup PNGs exercise the R restart;
client tests independently enforce450ms expiry while combat time continues.

## Asset audit

Removed only `beam-body.png`, `beam-head.png`, `beam-charge-core.png` and
`beam-charge-lines.png`:253173 bytes total. Removed manifest registrations and
bank-only uploader/page bookkeeping; tests reject all four stale registrations.
Cone and Troll source PNGs remain byte-identical to the slice baseline.
The inherited `charge-lines.png` manifest frozen hash is stale; actual unchanged
SHA256 is `a715942280598d3bb19f18e455f863b30947ea94a7ed91042d7ce574f9108a31`.
That unrelated historical hash was preserved.

The fresh lane initially lacked ignored `gen/` and local `art/puppets/` inputs.
Copied those read-only from the slice checkout into this lane, preserving all
source files. All builds ran in this lane. The native server used port8791;
port8772 and the owner's main checkout were untouched.
