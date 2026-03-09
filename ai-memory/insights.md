# Insights (Canonical, Minimal)

## Purpose
- This is the only active insights log.
- Capture only decisions that change future behavior.
- Do not log routine execution history, file lists, or status chatter.

## Operating Constraints
- Beads are the sole work authorization channel.
- Use one lane at a time; mirror deterministic rule edits in both runtime mirrors when required.
- When a problem appears, check this file for prior fixes before expanding scope.

## Product Model (Current)
- ORKA progression is mobile-casual leaning: power should come from skills, trait passives, and booster/meta systems.
- Avoid reintroducing classic RPG-style timed character buff/debuff stacks unless explicitly approved in bead acceptance.
- Blue gem flow is wallet/progression oriented (Astral Flow), not direct party-stat buff application.
- Progression-family scaffolds (tomes/relics/vault/chests/etc.) should ship as deterministic layout/state shells first, with map-locale entry mappings where menu pointers are intentionally absent.

## Bead Triage Guidance
- Prefer: skill/passive/trait behavior beads (`ORKA-6gt`, `ORKA-2sa`, `ORKA-mo4`, `ORKA-hvj`).
- Reframe before implementation when acceptance language implies persistent timed stat stacks (`ORKA-9ri`, `ORKA-zih`, residual wording in `ORKA-69r`).

## Regression Triggers
- Before starting combat-system beads, scan acceptance + code for: `buff`, `debuff`, `duration`, `turns`, `stack`.
- If these imply outdated model assumptions, pause and rewrite bead scope before coding.

## 2026-03-07 Regression Note
- Hero selector render gate must treat hero-turn as `TurnPhase === 0` (not `1`) in web-runner runtime.
- Core runtime modules under `web-runner/src/core/` must be treated as required deployment artifacts; missing files there can silently regress previously fixed UI/turn behavior.
- For web-runner startup regressions, verify module parity first (`heroSelectorRules`, `initiativeGuards`, `combatRuntimeGateway` lifecycle API) before broader combat debugging.
- Yellow-match completion can regress from merge-target helper scope errors; keep target lookup dependency-free inside `handleGemMatch` (do not rely on out-of-scope locals like `instances`/`assetsLayout`).
- When diagnosing yellow stalls, run multi-pass checks through `__codexGame.forceMatch(3)` and confirm `BoardFillActive` returns to `0` within settle window.
- 2026-03-08: Gem matches are not a buff source. Any buff-like systems must be implemented as separate booster mechanics (free/paid), decoupled from gem-color match lifecycle.

## 2026-03-08 Figma Parity (Hero Layout)
- For `heroLayout` visual QA, use Figma node coordinates as source of truth and render placeholders exactly (`NUM`, `Skill Title`, `Skill Title Lv.2`) until behavior beads replace them.
- Keep icon assets wired to MCP-exported Figma URLs for arrows, plus/minus, and close oval when parity is the goal.
- Use Playwright screenshots for side-by-side parity checks; fix drift with coordinate-level updates (not subjective spacing tweaks).
- During parity checks, force background to pure white (`#ffffff`) to isolate color mismatches before reintroducing any tint.
- Figma instance transforms on nav icons (e.g., `rotate-90`, mirrored variants) must be replicated in canvas draw transforms; drawing raw source PNG orientation causes obvious parity drift.
- Hero nav arrows: treat Figma slot geometry (`24x38`) as canonical and enforce inward direction by draw-path when remote arrow assets are unreliable.
- Minus control icon in Hero skills uses vertical mirror (`scaleY=-1`) semantics from Figma, not 180-degree rotation.
- Hero-screen Figma parity lesson: validate nav arrow direction against frame screenshot, not naming assumptions ('back/next' can be visually opposite to expected UX convention).
- When doing visual parity, complete full top-to-bottom audit in one pass before declaring done; partial fixes create false confidence.
- Playwright launch failure pattern (`Opening in existing browser session`) is usually stale `playwright-mcp` + `mcp-chrome` processes. Kill stale processes first; if MCP transport dies, use CLI Playwright (`npx playwright screenshot ...`) as QA fallback until MCP restarts.
- Initiative regression guard: sanitize time-mode turn queues before commit so duplicate non-extra hero slots cannot accumulate from queue reconciliation drift.
- Preserve extra turns only when provenance is explicit mechanic; otherwise drop extra repeats during reconciliation.

## 2026-03-08 — ORKA-spt multipass QA note
- For skill-point consumption multipass checks, reset `HeroSkillProgressByHeroId` per session/pass (or reload page) before asserting spend deltas.
- Without progress-state reset, later passes can show all `max_rank_reached` rejects with no spend despite point reseed at 300, which is a test artifact (not overdraft behavior).

## 2026-03-08 — Startup and bar rendering reliability
- Startup load stalls were amplified by serial `await loadImage(...)` chains; switching to parallel `Promise.all` for core visuals and staged critical/deferred sprite loads improves first-ready behavior without changing gameplay paths.
- Enemy gradient HP bars become visibly distorted when drawn with fractional sizes/positions and smoothing enabled; fix by integer snapping draw rects and disabling image smoothing only around bar draws.

## 2026-03-08 — Layout 0 loading UX strategy
- Keep a dedicated pre-bootstrap draw path (`drawStartupLoadingFrame`) so canvas never appears blank while assets initialize.
- Progress should advance by deterministic stage weights (layout/object/enemy/critical/core/finalize) and explicitly resolve to 100% at runtime-ready transition.

## 2026-03-08 — Vault Close-Control Regression Guard
- Helper functions declared before runtime asset variables must not capture later block-scoped symbols directly; pass assets as explicit parameters (`drawHeroStyleCloseControl(..., closeOvalImage, ...)`) to avoid `ReferenceError` in non-hero layout draw paths.
- When reusing Hero UI primitives across other layouts, update both draw path and hit-zone routing together; visual parity without input wiring causes partial regressions.
