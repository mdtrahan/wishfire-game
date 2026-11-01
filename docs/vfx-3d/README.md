# 3D spell VFX direction

**PORTABILITY CONTRACT:** This directory is a required part of the slice. Every export,
subtree split, port or merge into the main Wishfire game must carry `docs/vfx-3d/`,
including [SKILL.md](SKILL.md), intact and preserve its owning AGENTS index entry.

Owner approval: 2026-10-30. Bead: ORKA-sl7u.
Use low-poly 3D spell VFX in a PS1/PS2 style alongside the existing 2D heroes.
The visual studies were built in three.js. All four approved spells are ported to the Rust/macroquad client (bd-ORKA-6jh1.37) in `crates/wf_client/src/render/vfx3d.rs` and the per-spell renderers. Djinn single/twin v8 follows in `render/djinn.rs`/`djinn.glsl` (bd-ORKA-6jh1.43), with isolated bloom and post-bloom ink.

## Fidelity

Runtime levels are relative to the live device framebuffer: L0 = /6, L1 = /3,
L2 = /1.5, L3 = native. L3 with PS1 snap/dither ON is the default.
Use `?vfxres=0|1|2|3` and `&ps1=0|1`, or V / Shift+V, for debug comparisons.
Always review at native device pixels.

Portable package index:
- [PLAYBOOK.md](PLAYBOOK.md): craft rules, rejection history, tuned recipes and proof gate.
- [SKILL.md](SKILL.md): provider-neutral lead / implementer workflow for Claude, GPT and other agents.
- [starter/README.md](starter/README.md): pinned renderer fetch, file:// setup, helper API and GIF commands.
- [starter/index.html](starter/index.html), [app.js](starter/app.js), [helpers.js](starter/helpers.js): art-free runnable harness, PS1 pass and example.
- [starter/capture.cjs](starter/capture.cjs): headless smoke, seeded multi-cast proof and static no-JS gallery export.

Spell specifications:
- [Djinn beam v8](djinn-beam.md): owner-approved 2026-10-31; faceted torso globe, travelling cylinder, twin roots, dark spindle, billows and shard release. [Port validation](djinn-beam-validation.md).
- [Healing v2d](healing.md): gold blessing, separate light curtains, lingering holy motes and exact sprite-colour release.
- [Ground Pound v4g](ground-pound.md): chunky travelling rocks, opaque sinks, soft gas dust and one closing shake.
- [Bubble Pop v3e](bubble-pop.md): glossy soap volume and airy, seeded particle release.
- [Arcane Pulse v4c-f](arcane-pulse.md): approved five fixed paths, uneven seeded 8–12 beams and a half-speed clock; first arrival 0.900 s.

The spell files in `reference-code/` preserve our approved study code with identification headers.
They require study-only `THREE`/`ART` globals and DOM hosts. Assets and vendor code are omitted.

Port plan:
- Use macroquad `Camera3D`, `Mesh`/`draw_mesh` and custom `Material` shaders in GLSL ES for the geometry and light.
- Render the PS1 pass into a low-resolution render target with nearest enlargement; preserve Bubble's full-resolution release pass.
- Use camera-facing billboards for particles, light cards and glints; batch matching materials while preserving blending and depth order.
- Let the sim own timing, recipients and footprints. Bind visual phases to existing skill/hazard/heal events and their clocks; beam count creates cosmetic hits only.
- Make heroes face the target through the existing source-facing XOR mirror rule; retain planted actors, original sprite art and source colours.

Dimensions below describe the study at a 360×640 phone frame, 58 px heroes and zoom 0.5.
Ground-plane squash is 0.75. Design pixels and shader-local units require projection-aware conversion during the port.
`S(x)` means `smoothstep(0,1,clamp(x,0,1))`; times are seconds unless stated otherwise.
`Snapshot.time` advances presentation through spotlight/hit-stop; `combat_time` freezes there.
Preserve the existing foreground/background clock handoff when binding VFX; healing cadence stays combat-owned.
This package supplies specifications, reference code and an independent starter. Runtime ports bind these specifications to client presentation; simulation remains authoritative.

The full study (refs, rounds, GIFs; approximately 2 GB) stays local at `output/ORKA-3d-spell-study/` and is not committed.
Each spell document identifies its local construction notes. Reference layer descriptions are paraphrased without third-party image links.
