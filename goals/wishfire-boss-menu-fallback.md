# Wishfire boss fallback during menus

Bead: ORKA-dwa. Baseline: 678d5211. Status: implementing.

When a continuous boss is ready or active and the player is occupied with a menu or another non-combat surface, show a centered enlarged version of the existing red monster head in place of the notched progress rail. Keep the Chapter region-stage label above it and put “Summon Boss” beneath it. Omit the auto-summon toggle shown in the supplied reference.

The button returns to the current boss encounter. A ready boss is armed once through the existing entry flow; an active boss resumes without a duplicate spawn or a reset to its HP. Leaving combat must preserve the encounter and existing menu transactions. Ordinary combat continues entering bosses automatically.

## Proof

Verify ready and active states, menu interruption, safe return, repeated activation, current stage label, hidden fallback during ordinary roaming, and unchanged four-wave progression/defeat reset. Use focused production-path tests, the rendered UI lock and in-app Browser captures of the final candidate. Review against the supplied StoneAge image with an independent Luna critic. Preserve checkpoints and keep one preview server on localhost:8148.

The previous preview is checkpointed on codex/ORKA-aee-pack-count. Main integration retains the repository QA and ordered dependency gates.
