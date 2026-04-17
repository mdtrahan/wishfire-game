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
- bead id: ORKA-wao
- summary of changes: Replaced the old placeholder hero-skill presentation map with a three-skill CS/JS dataset per hero, loaded the provided skill icon sprite sheet, and rendered masked circle/diamond node art directly into the live hero-screen skill frames and modal path.
- files modified: `web-runner/app.js`; `web-runner/src/core/heroSkillPresentation.mjs`; `tests/heroSkillPresentationContract.test.js`; `.beads/blocked/ORKA-wao.md`
- test evidence:
  - `node --test tests/heroSkillPresentationContract.test.js` -> 2 passed, 0 failed
  - browser runtime: `agent-browser` on `http://127.0.0.1:8000/web-runner/index.html` -> Falie hero screen shows Block / Shield Bash / Bounce masked node icons; Huun hero screen shows Steal / Lift / Assault masked node icons
- discovery lane comparison: `debugger` was unnecessary; this was a presentation/data-lane change in the hero-screen render seam with one real runtime bug found by browser QA (sprite-sheet scope leak) and fixed in the same cycle
- pilot value signals: token cost `low`; operator overhead `medium`; reusable output `yes` (sprite-sheet crop metadata + masked circle/diamond node renderer)
- scope confirmation: Confined to hero-screen presentation data and rendering. No skill wiring, proc logic, combat math, or progression behavior changed.

- bead id: ORKA-dm6
- summary of changes: Removed the hardcoded Falie enmity bias from enemy single-target selection in both mirrored function banks. Enemy attacks now pick uniformly from living heroes unless a bead explicitly adds a validated taunt/enmity mechanic.
- files modified: `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/falieEnmityTargetBiasContract.test.js`; `ai-memory/insights.md`; `.beads/blocked/ORKA-dm6.md`
- test evidence:
  - `node --test tests/falieEnmityTargetBiasContract.test.js tests/huunExecutionDropBonusContract.test.js` -> 6 passed, 0 failed
- discovery lane comparison: `debugger` isolated the failure to an explicit Falie-targeting rule in both function-bank mirrors rather than a render or runtime-projection bug
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (uniform living-hero target-selection rule + mirrored-contract behavior test)
- scope confirmation: Confined to enemy single-target hero selection in the mirrored function banks and its contract coverage. No enemy damage formulas, skill rates, or hero stats changed.

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

- bead id: ORKA-ksw
- summary of changes: Replaced the hero-skill modal placeholder text with the actual per-skill usefulness description sourced from the hero skill presentation data, so players can evaluate upgrade value without guessing.
- files modified: `web-runner/app.js`; `web-runner/src/core/heroSkillPresentation.mjs`; `tests/heroSkillButtonsContract.test.js`
- test evidence:
  - `node --test tests/heroSkillButtonsContract.test.js tests/heroSkillPresentationContract.test.js` -> 10 passed, 0 failed
- discovery lane comparison: no specialist sub-agent needed; the issue was a narrow hero-screen render defect because the description data already existed and the modal was hardcoding a placeholder.
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (modal summary now bound to skill description data; regression guard prevents placeholder reintroduction)
- scope confirmation: Confined to hero-screen modal copy rendering and one description grammar correction. No skill wiring, balance, proc logic, or upgrade economy changed.
