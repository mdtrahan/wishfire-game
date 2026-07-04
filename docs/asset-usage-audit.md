# Historical Asset Usage Audit (web-runner images)

Date: 2026-02-20
Scope: `/Users/Mace/Wishfire/Codex-Orka/web-runner/assets/images`

## Status
This is a historical snapshot, not current prune authority.

The runtime asset tree and map image loaders changed after this audit. Current
evidence should be reconstructed from live code and tests, especially
`web-runner/systems/runtimeVisualAssetLoader.js`,
`tests/worldMapRuntimeContract.test.js`,
`tests/worldMapCaveInstancesContract.test.js`,
`tests/worldMapWarpPortalAssetContract.test.js`,
`tests/worldMapTowerInstancesContract.test.js`, and
`tests/worldMapTownAssetsContract.test.js`.

For newer duplicate-asset findings, use
`docs/duplicate-asset-analysis-2026-06-28.md`.

## Method
- Enumerated all `.png` files in `web-runner/assets/images` as of 2026-02-20.
- Reconstructed the then-current runtime image load set from runtime wiring:
  - Base sprite preload from `typesNeeded` in `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`.
  - Core/deferred explicit loads in `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`.
  - Object animation metadata in `/Users/Mace/Wishfire/Codex-Orka/web-runner/assets/objectTypes.json`.
- Compared used set vs on-disk files.
- Ran SHA-256 duplicate-content grouping.

## Summary
Historical counts from 2026-02-20:

- Total image files: 86
- Runtime-used files: 68
- Not used by runtime in this snapshot: 18

## Not Used In Game In This Snapshot
- `4X_tower.png`
- `4x_map.png`
- `attackbutton-animation 1-001.png`
- `attackbutton-animation 1-002.png`
- `bufficon5-animation 1-000.png`
- `bufficon5-animation 1-001.png`
- `bufficon5-animation 1-002.png`
- `bufficon5-animation 1-003.png`
- `bufficon5-animation 1-004.png`
- `fake_party-animation 1-000.png`
- `hero1-animation 1-000.png`
- `hero2-animation 1-000.png`
- `hero3-animation 1-000.png`
- `hero4-animation 1-000.png`
- `manager-animation 1-000.png`
- `ph-animation 1-000.png`
- `sprite2-animation 1-000.png`
- `spritefont.png`

## Duplicate Content Groups (SHA-256)
- `attackbutton-animation 1-000/001/002.png` are byte-identical.
- `bufficon1..5-animation 1-000.png` are byte-identical.
- `bufficon1..5-animation 1-001.png` are byte-identical.
- `bufficon1..5-animation 1-002.png` are byte-identical.
- `bufficon1..5-animation 1-003.png` are byte-identical.
- `bufficon1..5-animation 1-004.png` are byte-identical.
- `hero1..4-animation 1-000.png` each duplicate corresponding `icon_hero1..4-animation 1-000.png`.
- `sprite2-animation 1-000.png` duplicates `sprite-animation 1-000.png`.

## Buff Icon Clarification
- At the time of this audit, runtime preloaded buff icons only for `buffIcon1..4`, frames `000..004`.
- That is 20 image files by design (4 icons x 5 frames).
- `bufficon5-*` files existed on disk but were not used by that runtime path.

## Tech Debt Note
- Do not use the 18-file list above as a current deletion list.
- Before any future asset deletion, regenerate a fresh live usage report from current loader code, tests, and on-disk assets.

## PM Intake Packet (Scoping Ready)
Historical intake guidance from this snapshot:

1. Create one task for manifest + prune plan only (no deletion yet).
2. Create one execution task for controlled prune of the then-unused list after refreshing live usage evidence.
3. Create one validation task for post-prune runtime smoke evidence and rollback criteria.

Suggested planning constraints:
- Keep scope to `web-runner/assets/images` only.
- No gameplay logic changes.
- No UI style/placement changes.
- Any runtime reference discovered during execution removes that file from prune set and logs rationale.
