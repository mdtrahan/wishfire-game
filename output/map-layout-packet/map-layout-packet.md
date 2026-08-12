# Genielands Map Layout Packet

## Purpose
This packet explains how the Genielands overworld map is constructed and how markers are placed deterministically by grid cell label.

The key idea is simple: the map image is not manually annotated in pixels. The game stores a marker by coordinate label, such as `G11` or `K05`, then resolves that label into a cell center or an intercept point at render time.

## Included Files
- `assets/genielands-geography.png` - current player-facing map image.
- `assets/genielands-geography-grid.png` - same map with coordinate grid and cell labels.
- `assets/genielands-geography-grid-markers.png` - sample map showing marker placements translated onto the grid.
- `data/map-marker-manifest.json` - machine-readable grid spec, placement rules, and marker table.
- `map-layout-packet.md` - this explanation.

## Grid Contract
- Grid id: `genielands-v1`
- Canonical source frame: `1549 x 1361`
- Current presentation PNG: `1338 x 1176`
- Columns: `16`, labeled `A` through `P`
- Rows: `24`, labeled `01` through `24`
- Coordinate format: uppercase column plus two-digit row, for example `H11`, `C24`, `P07`.

Each cell is resolved from the canonical grid, then scaled to the currently drawn map image.

## Placement Rules
1. Single-cell markers use `placement: center`; a cave at `F04` draws at the center of `F04`.
2. Edge or in-between markers use `placement: intercept` with `anchorCoordinates`; a cape anchored to `G07/H07` draws on the shared boundary.
3. Larger anchor groups use the average of anchor cell centers; `M08/N08/M09/N09` lands in the middle of that 2x2 block.
4. Explicit offsets are small art-direction adjustments after deterministic resolution; `I14` plus `offsetY: -20` still starts from cell `I14`.

## Current Marker Groups
- Caves: 6
- Teleports: 2
- Towers: 5
- Town-family markers: 15 towns, moors, castles, and capes

## Why This Is Deterministic
The marker source of truth is a stable label, not a pixel. Given the same grid dimensions and coordinate label, the helper always calculates the same cell bounds and center point. Rendering may scale the map for different screens, but the marker is recalculated from world-grid space into screen space each frame.

## Source References
- `governance/planning/genielands-world-map-coordinate-grid.md`
- `web-runner/src/core/worldMapCoordinates.mjs`
- `web-runner/src/core/worldMapCaveInstances.mjs`
- `web-runner/src/core/worldMapPortalInstances.mjs`
- `web-runner/src/core/worldMapTowerInstances.mjs`
- `web-runner/src/core/worldMapTownInstances.mjs`
- `web-runner/systems/renderMap.js`
