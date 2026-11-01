---
name: ps1-vfx-study
description: Build reference-led PS1/PS2 low-poly 3D spell VFX studies. Use for "make this spell look like this", "3D WebGL spell", "PS1 VFX", "low-poly spell effect", "spell reference clip", or a new spell study or approved-effect revision. Provider-neutral workflow for Claude, GPT and other coding agents.
---

**PORTABILITY CONTRACT:** This directory is a required part of the slice. Every export,
subtree split, port or merge into the main Wishfire game must carry `docs/vfx-3d/`,
including this skill, intact and preserve its owning AGENTS index entry.
Resolve paths relative to this file after relocation; no global skill installation is required.

# PS1/PS2 spell study

Read [PLAYBOOK.md](PLAYBOOK.md) first. Exact approved art contracts:
[Healing](healing.md), [Ground Pound](ground-pound.md), [Bubble Pop](bubble-pop.md),
[Arcane Pulse](arcane-pulse.md), [Djinn beam v8](djinn-beam.md). [reference-code/](reference-code/) contains our study
sources; [starter/README.md](starter/README.md) explains the independent runnable harness.

## Workflow

1. Read the destination's AGENTS chain and confirm task ownership, storage budget,
   authoritative gameplay footprint, event clock and owner reference. Lead/art director
   decomposes the reference into timed visible layers and automatic-fail signatures in
   `LAYERS.md`. Use the owner's drawing for composition when supplied.
2. Lead briefs the implementer with exact writable paths, protected rounds, requested
   changes and acceptance frames. An agent working alone performs these roles in sequence.
   Use generic roles; provider names and delegation tools carry no art authority.
3. Implementer copies the text-only starter into an authorized study workspace, fetches
   its pinned renderer locally and builds the reference-camera trace. Use placeholder
   actors until approved source art is available. Keep combat state untouched.
4. Adapt to 360×640, 58 px actors, zoom .5 and .75 ground squash. Apply PLAYBOOK's
   sand contrast, chunky faces, gas, soft mist, facing XOR and clean sprite-release rules.
   Store per-cast seeds and keep Recast, scrub, 1× and 0.5× controls working.
5. Generate proof with the starter capture script or the owning study harness. Primary proof:
   lossless PNG stills at TRUE device pixels (e.g. 390×844@3 → 1170×2532) with 1:1 crops,
   across several responsive sizes (PLAYBOOK § Review). Never size VFX targets, snap grids or
   dither to a fixed resolution; derive them from the live framebuffer. Then review
   720×1280 / 30 fps in-game GIFs and a roughly 600 px / 3× close-up at both speeds;
   include a strip and consecutive labelled casts. Inspect decoded frames yourself.
6. Lead checks signatures, sprite release, timing and untouched pixels against the
   approved snapshot. “Only alter X” requires zero differences in protected pixels/frames.
   Unclear intent gets labelled options. Snapshot each round before the next edit.
7. Present a static no-JS light gallery; keep current approved work visible. Owner approval
   precedes shipping an art revision. Regenerate affected proof after the final edit.
8. Ship only text specifications and our own code into this package. Update
   [README.md](README.md) and its owning AGENTS entry. Preserve this whole package
   through integration. Exclude vendor, media, references and browser profiles from Git.
   Validate links, size and headless file:// startup; report exact checks and limits.

Runtime port: an approved study is not in the game until it is ported to the client and
reviewed in the running build at native resolution on several sizes. Report "spec shipped"
and "playing in game" as separate states. See [README.md § Fidelity](README.md#fidelity).

The simulation owns damage, targets and cadence. Presentation RNG never consumes combat
RNG. A desktop study proves construction; a runtime port still needs integration and
device-performance evidence. Source study history is optional context, never a runtime dependency.
