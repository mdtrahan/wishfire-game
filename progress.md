# Moved To Archive

Moved to: `docs/archive/2026-02/progress.md`

Reason: Superseded by Beads issue state and activity history

## ORKA-aoq · 2026-09-05

User request: checkpoint the current work, replace Story Mock with existing dialogue, gate combat until the authored combat point, and let Skip enter combat directly. Validate in the in-app Browser.

Checkpoint: local main and latest narrative source have named rollback tags. The complete reviewed case-study artifact is archived with a SHA-256 manifest under output/ORKA-aoq-checkpoint. Source narrative runtime/assets are clean; source skill edits and root dirt remain preserved.

Implemented: selectively imported the latest narrative runtime/content/artwork and connected it to the existing Story Mock slot. Combat unlocks at warp-017 or Skip. Existing developer combat scenarios use the same Skip route; failure returns through Town recovery. Dialogue after warp-017 remains in the content pack, pending an authored combat-completion route.

Validation complete for opening-to-combat scope: 54 focused tests pass. Full suite has 820 passes and the same three failures as current main (794 passes): heal-bloom wiring, Kojonn red queued totals, and Clear Skills cleanup. In-app Browser manual progression, Auto, Skip, compact Skip, combat interaction, and post-handoff map navigation were exercised. Evidence and recoverable candidate bundle: output/ORKA-aoq-checkpoint/QA.md. Changes remain uncommitted in the isolated branch.

## Chapter 1 map entry (2026-09-05)
- Checkpoint: output/ORKA-aoq-checkpoint/pre-chapter-map/checkpoint.tar.gz and manifest.json preserve pre-edit owned files and approved art.
- Approved C map exported at 360x640, caption removed; rendered START button beneath token. Either token or START begins first dialogue page; terrain clicks stay on map.
- 56 focused tests pass. In-app Browser at localhost:8027: fresh map, terrain click ignored, START -> first page -> Skip -> combat; compact 240x426 town tap -> first page. No browser errors.
- Changes remain in the ORKA-aoq lane; no commit or merge.

## ORKA-aoq synthetic quests · 2026-09-05
- Added 10 roster-derived stages in existing Encounter CP order, each using the existing enemy-slot encounter path and sprite crop. Restored numbered Main Story parts.
- Preserved 320-unit chapter/card alignment with scrollbar outside the column, thin scrollbar and crop line 18 units above navigation.
- Focused flow, CP, encounter-pool and app-boundary checks: 15 passed. In-app QA verified story completion, Stage 1-3 battles, progressive unlocks, cropped portraits and Back; final viewport gate evidence under test-results/ui-lock.

- Main Story 2 moved between Stage 5 and Stage 6; its creature question now reads “What were those things?” Focused narrative/quest checks: 17 passed. Midpoint unlock screenshot captured by the existing quest viewport gate.

- Restored normal-play default enemy targeting by reusing the pending-target fallback before render and capturing a valid target intent. In-app QA: red attack showed default yellow selector, ATK hit without enemy tap, manual selection moved selector. 21 focused target/handoff/autoplay/boundary checks passed.

- Fresh encounter initialization now resets Astral Flow charge and transient battle conditions; Continue preserves its current instance. Gold uses local persistent storage and stays outside the combat reset. Removed the duplicate static HP bar drawing. In-app proof: earned 3 gold, reloaded, entered a new battle, retained 3 gold with empty Astral Flow and one HP bar. Focused startup/reset/currency tests passed (24); quest viewport gate passed 15/15.

## 2026-09-06 publication preparation
- Verified pre-publication checkpoint: 64 files in output/ORKA-aoq-checkpoint/pre-publication with per-file SHA-256.
- Shared navigation migrated fully; removed unreachable Canvas nav handlers and updated route tests.
- Candidate full suite: 826 pass, 3 inherited failures (heal bloom source contract, Kojonn red queued totals, Clear Skills unload); current main baseline has the same three failures.
- Netlify linked site orka-alpha-mvp automatically builds GitHub main; runtime-only dist build replaces repository-root publication. Existing local main is 15 commits ahead of origin/main.
