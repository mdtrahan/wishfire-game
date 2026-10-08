# Kaja shared puppet

- Reuse the Fara fifteen-bone rig, fourteen painted slots, joints and motion channels. Character art may differ inside the common chibi silhouette.
- Source `parts.json` records paint crops and pivots; regenerate with `PUPPET_ACTOR=kaja node tools/export_actor_puppets.mjs`, then the same command with `--render`.
- Original static sprites stay preserved. Clips change presentation only; simulation owns movement, damage and action clocks.
- Basic and cast torso anticipation leans toward Kaja's target at 60% of the prior angular amplitude in both facings. Preserve action timing, foot origin, and the separate hurt/KO response.
- Current source reads at56px; enlarged220px contour fringe remains disclosed in QA.
