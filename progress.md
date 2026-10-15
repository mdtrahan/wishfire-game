# ORKA-kk4 moving-arena combat pilot

Build a compact realtime arena where the four canonical heroes and spawned enemies travel to delivery-specific contact, while preserving the established independent basic and skill clocks, saves, rewards, boss flow, and health recovery rules. Publish foot position and semantic locomotion/action state for puppet playback, with simulation retaining combat authority.

## Progress

- Added shared actor-foot reach and bounded movement rules.
- Routed continuous stage movement, hero basics, skills, impacts, and enemy action eligibility through the spatial seam.
- Verified ordinary Quest -> Start reaches the moving arena: four heroes advance into spawned enemies and damage resolves at contact. Focused spatial/realtime contracts (120), the hot-file regression gate (119), UI lock (31), and diff check pass.
- Remaining integration seam: puppet clip loader/export is owned by the asset lane. It receives simulation-owned `actionStateStartedAt`, `actionImpactAt`, and `actionStateUntil`; clip timing must remain presentation-only.
