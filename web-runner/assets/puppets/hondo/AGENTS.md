# Hondo shared puppet

- Reuse the Fara fifteen-bone rig, fourteen painted slots, joints and motion channels. Character art may differ inside the common chibi silhouette.
- Source `parts.json` records paint crops and pivots; regenerate with `PUPPET_ACTOR=hondo node tools/export_actor_puppets.mjs`, then the same command with `--render`.
- Original static sprites stay preserved. Clips change presentation only; simulation owns movement, damage and action clocks.
- Current source reads at56px; enlarged220px contour fringe remains disclosed in QA.
