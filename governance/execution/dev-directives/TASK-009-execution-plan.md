# TASK-009 Execution Plan

## Objective
Implement Map-button routing to a dedicated overworld layout (not modal), with deterministic pan/drag interaction and a top war-meter, while preserving combat-layout integrity.

## Scope Boundaries
- In scope (only):
  - Map button opens a dedicated map/overworld layout container.
  - Map view supports pan/drag interaction.
  - A top war-meter is visible and stable in the map layout.
  - Deterministic transition path between combat and map layouts.
- Explicit exclusions:
  - no tower war-beacon loop logic (TASK-010)
  - no unrelated combat math/turn-flow changes
  - no broad UI redesign beyond required map layout elements

## Phase 1
- Add/enable dedicated map layout routing from existing Map button path.
- Ensure transition enters map layout container (not overlay/modal mode).
- Keep layout boundaries strict so map-state visuals do not contaminate combat layout.

## Phase 2
- Implement deterministic pan/drag handling in map layout only.
- Add top war-meter render/data binding for map layout.
- Keep event/input handling isolated per layout container contract.

## Phase 3
- Validate with deterministic evidence:
  - combat -> map transition success
  - map -> combat return success
  - pan/drag operates only in map layout
  - war-meter is present at top in map layout and absent from combat layout
- Publish artifacts under:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/`

## Verifiable Success Criteria
- Map button always routes to dedicated map layout (not modal).
- Pan/drag works in map layout without affecting combat container state.
- Top war-meter is correctly rendered in map layout.
- Transition flow remains deterministic and layout-contained across repeated runs.

## Lead Closure Gate (2026-02-20)
- Verdict: PASS
- Basis:
  - Required TASK-009 artifact bundle is present under `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/`.
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/assertions.json` reports `pass: true` for:
    - map entry to `mapLayout`
    - war-meter presence
    - drag updates pan
    - drag scoped to map layout
    - return to combat
  - Transition snapshots in `map-enter.json`, `map-drag.json`, and `map-return.json` show deterministic layout and pan-state behavior.

## Lead Reopen Gate (2026-02-20)
- Verdict: PARTIAL PASS (BLOCKED)
- Blocker:
  - Canonical map art asset is not yet created/distributed for runtime use.
  - Current implementation relies on interface/placeholder presentation and cannot be treated as final map-asset acceptance.
- Blocking requirement:
  - Asset creation + distribution package for map layout must be delivered before further map/tower feature advancement.
- Unblock criteria:
  - Approved map asset bundle is available in runtime asset path.
  - Asset integration references are deterministic and validated in Layout 2 (`mapLayout`) without placeholder fallback.

## Lead Reopen Gate (2026-02-20, post-asset delivery)
- Verdict: PARTIAL PASS (CORRECTIVE PACKET REQUIRED)
- Asset blocker status:
  - Unblocked. Map asset is now delivered to runtime path (`images/map-layout.png`) and wired in loader.
- Remaining acceptance gaps from QA:
  - Remove standalone tower overlay object in map layout (tower will be baked into updated map art; no guessed overlay composition).
  - Scale map background to fill vertical map viewport while preserving aspect ratio.
  - Lock map pan to horizontal axis only (no vertical pan).
  - Eliminate sticky drag/follow behavior; drag must terminate immediately on pointer/touch release/cancel.
  - Prevent map drift off viewport; maintain deterministic containment while preserving vertical-fit scaling.
  - Keep `Return Combat` behavior unchanged.
  - Keep war-meter as stub (no expansion in this packet).
- Corrective packet:
  - Step 1: Remove map tower overlay render/object path from `mapLayout` presentation.
  - Step 2: Implement deterministic vertical-fit map scaling (aspect-ratio preserved), horizontal-only pan, immediate drag-end handling, and viewport containment (no vertical drift).
  - Step 3: Publish corrective artifacts in `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/`:
    - updated map screenshot showing full vertical fit, no standalone tower overlay, and contained map bounds
    - assertion JSON for vertical-fit + no-overlay + horizontal-only pan + non-sticky drag-end + containment checks
    - transition check proving return-to-combat still functional

## Lead Reopen Closure Gate (2026-02-20, corrective packet)
- Verdict: PASS
- Basis:
  - Corrective artifact bundle is present:
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/assertions-corrective.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/closure-recommendation-corrective.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/map-layout-corrective.png`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/map-enter-corrective.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/map-drag-corrective.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/map-postrelease-corrective.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/map-return-corrective.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/console-corrective.log`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task009/assertions-corrective.json` reports `pass: true` including:
    - vertical-fit mode + height match
    - no tower overlay
    - horizontal-only pan
    - non-sticky post-release behavior
    - contained bounds
    - return-to-combat success
