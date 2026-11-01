# Spawn vortex / pass2 / ORKA-6jh1

Art-only handoff, 2026-10-25. Second lead review pending. No runtime changes or commits.

## Authority and references

Latest lead review supersedes the maroon-rim direction: emissive red disc, fuzzy lighter pink-red halo, subtle rotating bands, approximately52x34px at game zoom, squash34/52=0.654. Six loop cels and four appear cels retained.

All seven owner-provided Dragon Quest Smash/Grow images were inspected in pass1. This revision compares `art/_work/refs/dqsg-spawns/spawn-3.png`, `spawn-4.png` and `spawn-6.png`, plus owner crop `/tmp/ref3.png` copied into scoped scratch as `ref3-owner-crop.png`. Underlying reference imagery belongs to its respective rights holders; no licence determination is claimed. No screenshot pixels appear in delivered sprite sheets.

## Method and retained evidence

Pass1 source decomposition and matched-size contour traces remain in scratch. Prior sheets/spec/provenance and packer are preserved under `art/_work/spawn-marker/pass1/`.

Before revised packing, saved `02-emissive-layer-study.png` and matched-size emissive traces `pass2-spawn-3-matched-trace.svg`, `pass2-spawn-4-matched-trace.svg`, `pass2-spawn-6-matched-trace.svg`. The traces interpret curved source strokes at their original crop dimensions. Stills cannot establish rotation direction or speed.

Built-in imagegen revised the existing painted source using the corrected layer study and owner spawn3 crop. Generation ID `exec-5915ac44-3eec-4ec6-a30e-1b92bdc75808`; preserved source `painted-source-pass2.png`. Exact prompt is in this task's transcript.

Reproducible `pack.py` uses existing Pillow/NumPy. It averages180-degree orientations for exact two-fold arm symmetry, gently mixes internal colours toward scarlet to reduce contrast, grades the outer colour toward pink-red, and applies a continuous smooth alpha feather plus a small alpha blur. The maroon grade is removed. Source rotates30degrees per cel before ground squash. Six cels complete a half-turn over0.6s, equivalent to a full turn in1.2s. Pulse remains3% scale/6% opacity. Four appear cels run once over0.2s and meet loop cel0.

## Contract and validation

`spec.json` owns current geometry, centre pivot, alpha blend and hashes. Each cel144x104px, pivot72/52, screen quad72x52px at zoom0.5. Feathered visible footprint approximately52x34px; opaque body is smaller. Squash is baked once. Straight alpha and luminous painted colour provide the reviewed glow; no engine bloom dependency. Runtime integration remains pending.

Staged portraits show nine markers around four current hero idle sprites, read-only crops from `gen/assets.json`, each resized32px high. Absolute52x34px marker size follows the explicit review target. Current narrow hero silhouettes are approximately16-20px wide, so the separate reference estimate of1.4x body width cannot simultaneously hold at32px hero height; review mocks expose the resulting proportions. Sand is RGB163/146/120. Dark ground is RGB33/29/24, approximating sand under80% black scrim; heroes and markers are staged above that scrim.

Review evidence: `annotated-side-by-side.png` compares spawn3/4/6; `mock-sand-360x640.png` and `mock-dark-360x640.png` show game scale. `loop-sand.gif`, `loop-dark.gif`, formation animation sheets and `review.html` show rotation. `all-cels.png` and `validation.json` document packing, transparent borders, filled centre, adjacent-frame differences and wrap seam. These are offline art proofs awaiting lead acceptance.
