# Lamp strip alignment correction

Served checkout: `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-0ln-lamp`, branch `codex/ORKA-0ln-lamp`, bead ORKA-0ln. Player URL: `http://localhost:8027/web-runner/index.html?strip-redesign=1`.

The previous comparison checked relative sizes while leaving the right-side anchors dependent on flex layout. This revision positions controls in the strip coordinate space. The level disc now has explicit width and separately placed number/label, preventing text from stretching its backer. The supplied lamp bitmap has a small independent height correction to match both painted axes. Arrival content scales 95% around its existing left-center; the strip and controls retain their anchors.

## Comparison evidence

- `../../test-results/lamp/alignment/annotated-comparison.png`: reference, prior delivery, correction at one uniform scale; colored solid outlines are reference bounds, white dashed outlines are current bounds.
- `../../test-results/lamp/alignment/level-type-comparison.png`: identical Level 4 crop and magnification. The current Level 4 screenshot uses a disclosed disposable capacity-tier-3 fixture; it does not modify the user's save.
- `../../test-results/lamp/alignment/pixel-comparison.json`: X/Y edge deltas at 360 logical pixels. Lamp bounds use alpha >=128; maximum painted lamp edge difference is 0.30 logical pixels at the 360px reference width. Reference edges are manually measured from source pixels; this is approximate raster evidence, not exact source design coordinates.
- `../../test-results/lamp/alignment/type-paint-bounds.json`: separately measured yellow number and label pixels. Number edge error reaches 1.12px; Level label edge error reaches 0.85px. Glyph shapes and CSS pill textures remain different from the raster mockup.
- `../../test-results/lamp/alignment/geometry.json`: final 360×640/DPR1, 216×384/DPR2, 233×452/DPR2 and 316×452/DPR2 geometry. Row width is 248.81px, 95% of 261.91px, with unchanged left anchor and center Y. Disc hides the full left rounded corner of the extended progress pill.

## Recorded player journey

Final video: `lamp-reveal-feedback.webm`. Continuous fresh player save; no injected gear or progression. Recording uses installed Playwright because native in-app capture cannot sustain animation cadence. The same final build was separately reloaded and operated in the in-app browser.

| Criterion | Visible outcome | Video time | Status |
|---|---|---|---|
| Lamp X/Y alignment | Painted edges match annotated target; placement remains steady outside the requested jiggle | 13.0–14.0s | Observed |
| AUTO placement and bubble height | AUTO upper-left; count bubble at reference upper-right height | 13.0–15.8s | Observed |
| Five-slot group reduction | Filled row uses 95% group scale with fixed left edge and vertical center | 15.4–15.8s | Observed |
| Puff and growing bounce retained | Held puff, fade, equipment growth and settling | 14.2–15.6s | Observed |
| Review and dismantle remain connected | Raw cache enters review, remaining gear enters dismantling, reward banner follows confirmation | 30–35s | Observed |
| Cache clears and accepts next item | Five empty positions with count zero after conversion; next emission returns one item | 35–40s | Observed |
| Number and Level label | Separate painted regions, reference position and label size | Level 4 fixture comparison | Observed |
| Progress left corner concealed | Disc covers the complete left rounded end | 13.0–15.8s and Level 4 fixture | Observed |

Supplemental checks: four-width alignment driver passed after the last typography edit. The reusable alignment guard also enforces the lamp painted edges within 0.5px, circle proportions, and unchanged gear center. Final natural recording asserts held puff, growing gear, eight raw emissions, five arrivals, eight skipped/dismantled, zero cache/arrivals, one next item, and no page errors. Existing four-phone player-flow/containment test passed before the final typography-only adjustment; the final alignment driver and recording verify that adjustment. `git diff --check` passes. No economy, generation, capacity, sorting, or equip rules changed.

Reproduce with `node output/qa/lamp-check-alignment.cjs`, `node output/qa/lamp-record-reveal-feedback.cjs`, then `python3 output/qa/lamp-compare-alignment.py` while this checkout is served on port 8027.

## Subsequent owner adjustment

Owner requested the arrival group move right about25px at the then-current 1.6× preview. The group now translates1.42em right (15.62 reference pixels, 25 preview pixels) while retaining95% scale and centerY. This supersedes the row-X position in the earlier annotated/video evidence. The updated four-width guard passes; lamp/control bounds remain fixed. Current in-app proof: `../../test-results/lamp/alignment/shifted-in-app.png`.
