# Insights (Canonical, Minimal)

## Purpose
- Capture reusable heuristics, not incident logs.
- Write the lesson that generalizes.
- If a detail needs issue IDs, stack traces, or step-by-step failure narration, it belongs in `/agents/issues.md` or bead history.

## Current Heuristics
- Figma layouts may use user-set positioning, so solve element placement with geometry relative to anchors instead of recentering whole groups.
- Overlay elements must stay in the same coordinate space as their anchor group.
- If one child is off, adjust that child from neighboring anchors rather than recentering the cluster.
- Canvas-rendered UI usually cannot be fixed with CSS alone; change the render seam.
- If browser output disagrees with source, verify the served asset and runtime owner seam before assuming rollback.
- For mirrored runtime logic, change both mirrors in the same patch or move the rule into a shared seam.
- For combat text, keep color, motion, crit emphasis, and suffix rules separate.
- For health bars, preserve the state model and only change the plateau, palette, or timing requested.
- For party/shared resources, preserve the total and distribute remainders instead of flooring each share independently.
- For persistent status visuals, render from the owner ledger, not from transient flashes or slot tint.
- For browser QA, distinguish browser startup failure from browser control failure.
- For Playwright on macOS from Codex, treat Crashpad / startup aborts as environment boundaries before tuning test logic.
- For browser batteries, prefer attached-browser probes when launch itself is already a known boundary.
- If Chrome aborts in HIServices/TransformProcessType during startup, treat it as a pre-control macOS launch boundary and prefer a CDP-attached browser path.
- For browser-imported runtime dependencies, deleting `node_modules` can break the page before any canvas or loading UI appears; verify served module paths after cleanup and restore the exact import seam before chasing gameplay logic.
- For floating-number readability, animate one value node per hit unless the bead explicitly asks for digit-level choreography.
- For modal overlays, let the modal own input before the background layout sees the event.
- For hot-file work, keep the patch narrow and avoid “while I am here” cleanup.
- For bead work, keep queue creation separate from execution.
- For bug/regression beads, add one reusable future-facing heuristic before closing.

## Anti-Patterns
- Don’t turn this file into a changelog.
- Don’t store duplicate process policy here.
- Don’t copy exact failure narratives from `/agents/issues.md` into insights.
