# Genielands World Map Coordinate Grid

## Source Decision

Use `web-runner/assets/images/genielands-geography.png` as the browser runtime presentation source for the Genielands overworld map. Keep `web-runner/assets/images/genielands-geography.svg` as the geography-only vector provenance source.

Rationale:
- The PNG provides the current player-facing painted presentation at 1338 x 1176.
- The PNG keeps the same near-identical aspect ratio as the canonical 1549 x 1361 source frame, so the existing coordinate grid can remain stable.
- The visible PNG contains no labels, towns, roads, borders, political overlays, resource markers, compass art, or text.
- The SVG preserves the original 1549 x 1361 vector coast/lake geometry and remains the best provenance artifact for future coastline edits.
- The visible SVG layers are geography-only: ocean, landmass, lakes, and coastline.
- The native `.map` and minimal JSON exports are useful provenance, but they contain generator simulation data such as burgs, states, provinces, rivers, routes, markets, cultures, religions, climate, population, and other metadata that must not become player-facing map truth.
- Earlier unpainted PNG previews and tile ZIPs are derived exports and should not define canonical gameplay coordinates.

The map is spatial infrastructure only. Do not import labels, towns, roads, political data, biome data, population, climate, cultures, religions, resources, or generated lore from the source package.

The painted terrain in the PNG is presentation art only. It must not become canonical biome, resource, encounter, or lore data unless a future bead explicitly promotes that data through gameplay systems.

## Coordinate Contract

The canonical grid for Genielands v1 is 16 columns by 24 rows over the full source image.

- Map width: `1549`
- Map height: `1361`
- Columns: `A` through `P`
- Rows: `01` through `24`
- Cell width: `1549 / 16 = 96.8125`
- Cell height: `1361 / 24 = 56.7083333333`

Coordinate format is `<column><row>`, with uppercase column letters and two-digit row numbers. Examples: `H11`, `C24`, `P07`.

Bounds for a coordinate are calculated as:

```text
columnIndex = zero-based index of column label
rowIndex = rowNumber - 1
x = columnIndex * cellWidth
y = rowIndex * cellHeight
centerX = x + cellWidth / 2
centerY = y + cellHeight / 2
```

Point lookup is the inverse:

```text
columnIndex = floor(x / cellWidth)
rowIndex = floor(y / cellHeight)
coordinate = columnLabel(columnIndex) + pad2(rowIndex + 1)
```

Points outside `0 <= x < 1549` or `0 <= y < 1361` do not resolve to a coordinate.

## Runtime API

Use `src/core/worldMapCoordinates.mjs` for shared deterministic references and `web-runner/src/core/worldMapCoordinates.mjs` for browser rendering.

Future quest, POI, fast travel, event, or documentation data should store locations by coordinate only. Rendering code can resolve bounds or center points through the coordinate helper instead of hand-placing pixels.

The coordinate grid is not player-facing UI. It is hidden by default, ignored by player-mode rendering, and may only be toggled in dev/test sessions. While the map layout is active in dev/test mode, press `g` to toggle the coordinate grid.
