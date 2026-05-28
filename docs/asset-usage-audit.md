# Asset Usage Audit (web-runner images)

Date: 2026-02-20
Scope: `/Users/Mace/Wishfire/Codex-Orka/web-runner/assets/images`

## Method
- Enumerated all `.png` files in `web-runner/assets/images`.
- Reconstructed runtime image load set from current runtime wiring:
  - Base sprite preload from `typesNeeded` in `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`.
  - Core/deferred explicit loads in `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`.
  - Object animation metadata in `/Users/Mace/Wishfire/Codex-Orka/web-runner/assets/objectTypes.json`.
- Compared used set vs on-disk files.
- Ran SHA-256 duplicate-content grouping.

## Summary
- Total image files: 86
- Runtime-used files: 68
- Not currently used by runtime: 18

## Not Currently Used In Game
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
- Runtime currently preloads buff icons only for `buffIcon1..4`, frames `000..004`.
- That is 20 image files by design (4 icons x 5 frames).
- `bufficon5-*` files exist on disk but are not used by current runtime path.

## Tech Debt Note
- Candidate prune set is the 18-file "Not Currently Used In Game" list above.
- Before deletion, run one post-prune runtime smoke test for layout load + combat UI image preload.

## PM Intake Packet (Scoping Ready)
Use this packet to convert visual-asset debt into planned sprint work without code-scope drift:

1. Create one task for manifest + prune plan only (no deletion yet).
2. Create one execution task for controlled prune of the 18-file unused list.
3. Create one validation task for post-prune runtime smoke evidence and rollback criteria.

Suggested planning constraints:
- Keep scope to `web-runner/assets/images` only.
- No gameplay logic changes.
- No UI style/placement changes.
- Any runtime reference discovered during execution removes that file from prune set and logs rationale.
