# Development Reports

Active handoff file only. Keep only the current review window here; move older entries to `/agents/archive/dev_reports_archive.md` and do not read that archive during normal startup unless historical investigation is required.

## Template
- bead id:
- summary of changes:
- files modified:
- test evidence:
- discovery lane comparison:
- pilot value signals:
- scope confirmation:

## Recent Reports
- bead id: ORKA-h3x
- summary of changes: Replaced the overloaded repo instruction file with a thin repo map, added canonical docs indexes under `docs/`, converted `README.md`, `claude.md`, `ai-memory/project.md`, and the old browser backend policy into short compatibility shims, created a migration plan artifact with rollback anchors, added a doc contract test to keep the new map thin and singular, and then refined `AGENTS.md` toward a more literal repo-shape tree so the front door answers “what is here and where do I go next?” before any deeper routing prose.
- files modified: `AGENTS.md`; `README.md`; `claude.md`; `ai-memory/project.md`; `docs/architecture/index.md`; `docs/product/index.md`; `docs/qa/index.md`; `docs/qa/browser-policy.md`; `docs/qa/browser-validation.md`; `docs/workflow/index.md`; `docs/references/index.md`; `docs/generated/index.md`; `docs/plans/active/harness-engineering-migration.md`; `docs/knowledge-registry.json`; `docs/backend/browser-backend-policy.md`; `governance/qa/browser-battery-minimal.md`; `governance/qa/combat-playwright-control-model.md`; `governance/product/game-design-document.md`; `governance/product/game-function-reference.md`; `governance/execution/beads-process.md`; `ai-memory/context.md`; `ai-memory/insights.md`; `tests/harnessDocsContract.test.js`; `output/checkpoints/harness-migration-pre-20260409.md`; `.beads/blocked/ORKA-h3x.md`
- test evidence:
  - `node --test tests/harnessDocsContract.test.js` -> 4 passed, 0 failed
  - `wc -l AGENTS.md README.md claude.md ai-memory/project.md docs/backend/browser-backend-policy.md` -> `AGENTS.md` 80 lines; shims 10-12 lines
  - `git tag --list 'checkpoint/harness-migration-pre-20260409'` -> tag present
  - `git branch --list 'codex/checkpoint-harness-migration-pre-20260409'` -> branch present
- discovery lane comparison: no sub-agent used; the migration was grounded by direct doc inspection plus the harness-engineering article and implemented as a narrow, reversible doc-system cut rather than a broad rewrite
- pilot value signals: token cost `medium`; operator overhead `low`; reusable output `yes` (single repo map, doc registry, and regression contract)
- scope confirmation: Confined to repository knowledge architecture, compatibility shims, browser-policy normalization, and rollback/checkpoint artifacts. No gameplay logic, runtime balance, or UI behavior changed.

- bead id: ORKA-dm5
- summary of changes: Aligned the damage-number glow pass with the main glyph baseline so Falie hits no longer read as doubled. Also hardened canvas suppression so the DOM path claims ownership before the canvas fallback can draw the same entry.
- files modified: `web-runner/src/core/damageNumberAnimation.mjs`; `web-runner/app.js`; `tests/damageNumberTimelineContract.test.js`; `tests/damageTextPaletteContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`
- test evidence:
  - `node --test tests/animationShimBehavior.test.js tests/damageNumberTimelineContract.test.js tests/damageTextPaletteContract.test.js tests/hpBarAnimationContract.test.js` -> 17 passed, 0 failed
  - `node --check web-runner/src/core/damageNumberAnimation.mjs` -> pass
- discovery lane comparison: `debugger` confirmed the root cause was the glow/main glyph baseline mismatch, not a second combat event
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (baseline alignment heuristic + DOM-ownership claim guard)
- scope confirmation: Confined to the damage-number render seam and duplicate suppression guard. No combat resolution, targeting, or animation timing changes were made.

- bead id: ORKA-dm4
- summary of changes: Reduced damage text size by 30% with a uniform scale change only. The tween path, travel distance, and aspect ratio were left unchanged.
- files modified: `web-runner/src/core/damageNumberAnimation.mjs`; `tests/damageNumberTimelineContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`
- test evidence:
  - `node --test tests/animationShimBehavior.test.js tests/damageNumberTimelineContract.test.js tests/damageTextPaletteContract.test.js tests/hpBarAnimationContract.test.js` -> 17 passed, 0 failed
  - `node --check web-runner/src/core/damageNumberAnimation.mjs` -> pass
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (uniform scale contract + no motion drift heuristic)
- scope confirmation: Confined to the damage-number text scale constant and its contract coverage. No tween timing, rise distance, font face, or palette changes were made.

- bead id: ORKA-dm3
- summary of changes: Adjusted the damage-number entry pose so the first visible frame starts from the intended hidden/compressed state instead of flashing at the target anchor. The shared GSAP shim now preserves existing DOM transforms, and the damage number animation applies the initial pose before making the wrapper visible.
- files modified: `web-runner/src/core/gsapShim.mjs`; `web-runner/src/core/damageNumberAnimation.mjs`; `tests/animationShimBehavior.test.js`; `tests/damageNumberTimelineContract.test.js`; `ai-memory/insights.md`; `progress.md`; `agents/dev_reports.md`
- test evidence:
  - `node --test tests/animationShimBehavior.test.js tests/damageNumberTimelineContract.test.js tests/damageTextPaletteContract.test.js tests/hpBarAnimationContract.test.js` -> 17 passed, 0 failed
  - `node --check web-runner/src/core/damageNumberAnimation.mjs && node --check web-runner/src/core/gsapShim.mjs` -> pass
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (entry-pose contract + transform composition behavior test)
- scope confirmation: Confined to the shared animation shim and the damage-number entry pose. No combat formulas, enemy AI, or UI layout changes were made.

- bead id: ORKA-dm2
- summary of changes: Fixed the shared GSAP shim so combat damage text can stay mounted long enough to render and enemy HP bars interpolate instead of snapping. The shim now interpolates numeric state over time, and the damage-number / enemy-bar callers use that behavior unchanged.
- files modified: `web-runner/src/core/gsapShim.mjs`; `tests/animationShimBehavior.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`
- test evidence:
  - `node --test tests/animationShimBehavior.test.js tests/damageNumberTimelineContract.test.js tests/damageTextPaletteContract.test.js tests/hpBarAnimationContract.test.js` -> 16 passed, 0 failed
  - `node --check web-runner/src/core/gsapShim.mjs && node --check tests/animationShimBehavior.test.js` -> pass
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (shared interpolation shim behavior test)
- scope confirmation: Confined to the shared animation shim and its behavior coverage. No combat formulas, enemy AI, or UI layout changes were made.

- bead id: ORKA-dmg
- summary of changes: Hardened combat damage numbers so the canvas fallback is no longer globally suppressed by the DOM overlay layer before an individual DOM animation is confirmed. The renderer now keeps per-entry fallback available, and the overlay bounds are re-synced during render.
- files modified: `web-runner/app.js`; `tests/damageNumberTimelineContract.test.js`; `tests/damageTextPaletteContract.test.js`; `ai-memory/insights.md`; `progress.md`; `.beads/in_progress/ORKA-dmg.md`
- test evidence:
  - `node --test tests/damageNumberTimelineContract.test.js tests/damageTextPaletteContract.test.js tests/damageTextFormattingContract.test.js` -> 13 passed, 0 failed
  - `node --test tests/hitFlashFeedbackContract.test.js` -> 3 passed, 0 failed
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (per-entry fallback guard for overlay-owned combat text)
- scope confirmation: Confined to combat damage-text rendering fallback hardening and contract updates. No combat math, damage formulas, or balance logic changed.

- bead id: ORKA-h9q
- summary of changes: Added a mirrored hero leveling system with a deterministic Lv1-99 XP curve, per-hero XP state, kill-based XP awards wired into the enemy-death / AwardMonsterDrop seam, and a validation simulation for pacing bands.
- files modified: `Scripts/functionBank.js`; `web-runner/modules/functionBank.js`; `tests/heroLevelingContract.test.js`; `.beads/blocked/ORKA-h9q.md`
- test evidence:
  - `node --test tests/heroLevelingContract.test.js tests/huunExecutionDropBonusContract.test.js` -> 7 passed, 0 failed
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (deterministic progression helper + kill-award seam)
- scope confirmation: Confined to mirrored combat/progression runtime helpers and a focused validation test. No UI or governance files were changed for this bead.
