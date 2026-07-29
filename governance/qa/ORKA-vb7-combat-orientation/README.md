# ORKA-vb7 Combat Orientation Proof

- Runtime correction commit: `d9614d19864e020abcc6c92e83734e4861122f47`
- Branch: `bead/ORKA-vb7-combat-orientation`
- Seed: `424242`
- Roster: Falie, Huun, Runa, Kojonn vs Gobloc, Orc, Skeleton
- Logical viewport: `360x640`; reflection axis: `x=180`
- Browser viewports: `1200x800` and `900x700`
- Browser page errors: none

The cyan line marks the reflection axis. Green rings mark hero standing pivots; red rings mark enemy pivots. Each right-wise x equals `360 - left-wise x - 40`. Hero Y is unchanged. Enemies receive one `+5.515475986` world-Y block translation, aligning both formation midpoints at world Y `121.305986421` while preserving all intra-team spacing.

The original right-wise QA frame exposed a presentation defect: reflected pivots moved directional/asymmetric art without reflecting its pixels, leaving teams back-to-back and silhouettes biased right. Commit `efaf1e0` fixed facing. Follow-up commit `d9614d1` applies the approved shared left translation and derived enemy midpoint alignment to sprites, hit regions, bars, text, and actor-attached effects. Source assets, canonical combat state, and rules are unchanged.

The corrected right-wise captures were taken from exact commit `d9614d1`, frozen at full party HP (`147/147`) with 24 gems and no page errors. The left-wise captures are the unchanged `efaf1e0` reference baseline; the correction contract and tests prove left-wise remains byte-compatible.

## Images

- `left-wise-1200x800.png` / `right-wise-1200x800.png`
- `left-wise-900x700.png` / `right-wise-900x700.png`
- `dev-panel-orientation-toggle.png`

The dev control was also exercised from an active right-wise combat. Applying left-wise returned `orientationChanged=true`, `appliedSessionChange=combat_refresh`, and a fresh left-wise combat payload.

Machine-readable geometry and image hashes are in `geometry-proof.json`.
