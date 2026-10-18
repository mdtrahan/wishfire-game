# ORKA-5wt: bounded ordinary party roaming

Source baseline: `97f77474e44cb1f869ec2ecd227cc397fe4aac75`.
Rollback: `checkpoint/ORKA-5wt-before-roaming-97f77474`.
Owner authorized local implementation, validation and commits; parent owns review, integration and bead closure. No push or deployment.

## Goal and geometry

Keep a compact moving four-Hero party in the central combat band while the existing horizontal camera follows travel through the three-screen world. Direct StoneAge recording at `/Users/Mace/Codex-Orka/output/party-movement-audit-2026-10-18/stoneage-direct-60s.mp4` shows ordinary travel in a stable lower combat band, with a separate boss exception. Its internal bounds are unknown. Wishfire's values below are explicit design choices.

Before: ordinary Hero feet X **40..2120**, Y **-40.5..679.5**. At zoom **0.5**, concentrated feet can reach logical screen X **20..340**, Y **116..476**, or normalized full-frame X **5.56%..94.44%**, Y **18.13%..74.38%**. Formation spread and sprite extent can extend past the mean; the earlier short recording supplies observations only.

Chosen after: ordinary Hero feet X **520..1640**, Y **290..450**. World width stays **2160**, visible width **720**, logical frame **360×640**, zoom **0.5**. Camera center follows living-Hero mean X within **360..1800**, with offset **0..1440** and fixed Y pivot **272.5**. The new X inset retains **160 world units** of headroom inside both follow limits, exceeding the existing **144** straggler radius. Formation lead offsets and delivery-specific reach stay unchanged. Hero foot Y projects to **281.25..361.25**, normalized frame **43.95%..56.45%**; the **80-logical-pixel** band permits visible diagonal motion without vertical corner sweeps. Relative to HUD-safe Y95..478, feet occupy **48.63%..69.52%**. Ordinary footprint radius **18 world units** adds **9 logical pixels**, giving vertical footprint envelope **272.25..370.25**. Recovery huddle and moat center at patrol Y370. Sprite/HP/buff extents require measured rendered proof. Direct StoneAge ordinary samples place the visible feet-envelope midpoint at crop u0.37..0.65, v0.56..0.77, with conservative comparison u0.33..0.68, v0.50..0.82. Typical foot-envelope spans are 26–41% horizontally and 14–21% vertically; individual contacts occupy a larger union. Manual estimates carry ±10–15px uncertainty, and 2fps samples do not establish universal containment. Wishfire uses its own HUD-safe crop X0..360/Y95..478. Compare both envelope midpoint and arithmetic four-Hero centroid explicitly; sprite excursions remain separate. The patrol midpoint projects to crop v59.07%, inside the reference range. Its full 80px foot span is 20.89% of the safe crop, matching the observed 14–21% height; a contact foot may pass the conservative midpoint band. Keeping the huddle at Y370 also preserves the original bottom pack clouds outside the 150-world-unit recovery moat. Y400 failed that clearance for some seeds, so it was rejected before acceptance.

X520..1640 bounds every ordinary Hero, including separation and restored positions. With mean-follow projection, a Hero's screen X is `180 + (footX - meanX) × 0.5`, reflected for right-wise orientation. This formula and the observed maximum party separation must accompany captures; hard world bounds alone do not prove a compact screen envelope.

Enemies retain full world X40..2120, Y-40.5..679.5, six separated pack clouds and six solos. Search projects remote goals into the patrol rectangle. Once the squad reaches a remote group's bounded approach point, that selected group may approach the squad so unreachable corner spawns cannot stall. Other remote groups retain local detection. Boss-local constraints and authored boss placement remain separate from ordinary patrol limits.

## Acceptance and proof

- Enforce bounds through search, shared pursuit, reversals, separation, stationary/out-of-bounds restore, recovery and reload. Preserve Fara/Hondo leadership, actor reach/cooldowns, save formats, rewards, KO and boss rules.
- Execute production movement across multiple seeded complete waves, all sectors and solos, sparse final targets and both orientations; prove finite clear and boss progression. Cover boss edges, recovery, separation and extreme feet with deterministic tests.
- Run focused existing combat/stage/orientation/session regressions. Parent owns complete current-main baseline and independent exact-content review before integration.
- Before runtime commit, serve exact candidate through queryless normal player entry in T3 preview at localhost. Inspect actual screenshot and console; retain continuous full-wave/direction/boss footage and naturally reachable recovery. Diagnostic fixtures remain supplemental. Measure CSS viewport, DPR, canvas, actor feet and projection. Check natural and compact presentation without renderer/zoom changes.
- Retain source hashes, code-bound probes, sampled feet/screen envelopes, console results, raw footage and annotated comparison to baseline/StoneAge. Parent collects final-main smoke after integration. Any unproved criterion stays explicit.

## Evidence status

Goal written before runtime implementation. Focused combat/stage/orientation checks passed **112/112**; scheduler/session/presentation checks passed **44/44**. Logs: `output/ORKA-5wt/focused-final.tap`, `scheduler-session.tap`.

Normal entry at `http://localhost:8015/web-runner/` used the Chapter 1 START control and shipping runtime, without QA queries or game-state injection. Its saved checkpoint resumed wave 2; recording then includes a complete fresh wave 3 clear and both travel directions. The candidate remains running toward boss entry. Natural CSS viewport1280×800/DPR2 has canvas450×800/backing900×1600. Compact240×452/DPR2 has canvas240×426/backing480×852, with no horizontal body overflow. T3 rejects widths below240; its diagnostic override was restored to fill. Wide/compact screenshots were inspected. No captured runtime errors or Hero KOs so far. Boss/recovery footage, final measurements, parent review and final-main proof remain pending.

Browser-fetched SHA256 matches disk: `src/core/combatOrientation.mjs` = `efb1c3a544fc823d19fc82301e43b10447d7f6351175d5c9350fc3294385fa9d`; `web-runner/src/core/arenaCombat.mjs` = `666896838e8ad217c9515c18c1e06d98ae156eb7041e9103cb9cf159486e351f`. Startup fingerprint predates edits and still names the baseline; these exact module hashes identify the recorded candidate. Evidence remains local under `output/ORKA-5wt/`.

Parent supplied canonical-main baseline:1297 tests,1291 pass,2 fail,4 skipped at97f77474. Existing failures are missing default Chromium for lampBagCount and a lampPresentation timing assertion under full-suite load. Parent owns candidate canonical-suite comparison; no lamp code changes belong to this bead.
