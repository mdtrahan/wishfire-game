# HighOrc native source

- Own HighOrc layered paint, per-part geometry, native anatomy source and actor-local QA. Shared exporter, runtime manifest and gameplay stay with their assigned lanes.
- Preserve original generated atlases and every frozen/rejected candidate. `qa/accepted-c4c8b97d-source/` holds the earlier accepted source; its hollow arm anatomy failed later full-motion review.
- Current arms use complete painted grey-green skin beneath maroon sleeves and bronze/navy bracers, with solid wrist/fist overlaps. Torso/shoulder ownership must stay coherent through the full shoulder/elbow/wrist action envelope.
- `source/isolate-repair-parts.py` mechanically reproduces recorded replacement crops with stripped PNG32 output. `source/prepare-repaired-source.py` regenerates native neutral/movement/action SIFs and controls; it overwrites manual edits. The retired atlas-isolation helper remains only in the preserved earlier source.
- `parts.json` owns geometry, per-part normalized pivots, parent chains and nativeSourceModes. `movement-controls.json` owns actor-local source pose controls. The actual sword stays parented to `hand_near`, with its original169px blade scale and grip preserved.
- Source256 foot(128,250) maps to128 foot(64,125). Opposite facing explicitly mirrors source handedness. All pose frames retain one body origin and fixed actor scale.
- Cast recovery holds the extended shoulder/elbow while the blade unwinds before folding the arm; folding too early clips the long blade. Preserve the rejected recovery source/frames before changing this envelope.
- Run source/check-source.py after native QA export; qa/check-repaired-envelope.py checks full source frames and retained original paint. Native1024 linear frames reduce offline through Lanczos to128. Compare reflection at native1024;128 reduction introduces subpixel reflection rounding.
- The source review page is qa/repair.html. Full source anatomy/action proof supports source critique; full seven-state runtime motion and assembled battle acceptance remain separate gates.

- ORKA-nst restores the owner-supplied rig-guide source checkpoint and completes seven runtime states in both facings. Preserve neutral geometry and paint. Generated motion keeps actor-local attachment origins; shared curves supply rotations and body translation. Existing High Orc walk/basic/cast sources remain intact. Transparent overscan keeps the full fall inside the export canvas; referenceHeight preserves body scale. Motion exports are review candidates, with source hashes and frame evidence in the owner review folder.
