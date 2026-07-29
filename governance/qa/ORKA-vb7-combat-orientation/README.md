# ORKA-vb7 Combat Orientation Proof

- Runtime commit: `efaf1e03688e9d7fafc353c46efaefcb5bb70e42`
- Branch: `bead/ORKA-vb7-combat-orientation`
- Seed: `424242`
- Roster: Falie, Huun, Runa, Kojonn vs Gobloc, Orc, Skeleton
- Logical viewport: `360x640`; reflection axis: `x=180`
- Browser viewports: `1200x800` and `900x700`
- Browser page errors: none

The cyan line marks the reflection axis. Green rings mark hero standing pivots; red rings mark enemy pivots. Yellow arrows annotate inward facing. Each right-wise x equals `360 - left-wise x`; UID, kind, slot, y, HP, stats, initiative order, and board state remain equal.

The original right-wise QA frame exposed a presentation defect: reflected pivots moved directional/asymmetric art without reflecting its pixels, leaving teams back-to-back and silhouettes biased right. Commit `efaf1e0` reflects only right-wise actor pixels about the already-correct oriented pivot, including hit-flash redraws. Source assets, pivots, hit regions, combat state, and rules are unchanged.

## Images

- `left-wise-1200x800.png` / `right-wise-1200x800.png`
- `left-wise-900x700.png` / `right-wise-900x700.png`
- `dev-panel-orientation-toggle.png`

The dev control was also exercised from an active right-wise combat. Applying left-wise returned `orientationChanged=true`, `appliedSessionChange=combat_refresh`, and a fresh left-wise combat payload.

Machine-readable geometry and image hashes are in `geometry-proof.json`.
