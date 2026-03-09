# PM Status

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-jmf (yellow-match completion regression stabilized; multi-pass checks clean)

## Active Work
- ORKA-cpc (in_progress):
  - encounter request injection hook (`setEncounterRequest`)
  - map-return CP policy stub (`warMeter -> targetCP/policy`)
  - policy/faction contract hardening

## Next Tasks
- Drive `EncounterLocale`/`EncounterFaction` from concrete map-node metadata once map schema is finalized.
- Promote behavior-level (non-regex) solver tests when builder is moved to a dedicated shared module.

## Known Issues
- Debug-only `BOARD_INTEGRITY` logs remain too noisy at error level when `ok=true` (cleanup follow-up).

---
_Last updated: 2026-03-07_

## Completed Beads
- ORKA-jmf (yellow-match completion regression stabilized; multi-pass checks clean)

## Active Work
- ORKA-cpc (in_progress): CP-budget encounter system hardening and caller-owned encounter request integration.

## Next Tasks
- Add faction/policy behavior coverage tests (solo commander, fodder-only, mixed fit quality).
- Wire map/tower stub to call `setEncounterRequest` before combat entry.

## Known Issues
- Debug-only `BOARD_INTEGRITY` logs are noisy at error level even when `ok=true`; non-blocking, should be downgraded in a cleanup bead.

---
_Last updated: 2026-03-07_

## Completed Beads
- None in this cycle (ORKA-jmf remains active until user QA confirmation).

## Active Work
- ORKA-jmf (in_progress): yellow-match completion regression fix + multi-pass validation + insights traceback.

## Next Tasks
- QA yellow matching interactively in runtime and close ORKA-jmf on confirmation.
- Resume ORKA-cpc after ORKA-jmf closure.

## Known Issues
- Existing debug diagnostics still emit noisy `BOARD_INTEGRITY` error-level logs even on `ok=true`; functional blocker cleared but log hygiene follow-up recommended.

---
_Last updated: 2026-03-07_

## Completed Beads
- None in this traceability correction cycle.

## Active Work
- ORKA-cpc (in_progress): CP-budget encounter builder + strict locale narrative filter + doctrine metadata normalization now formally tracked in Beads lane.

## Next Tasks
- Close ORKA-cpc after gameplay QA pass and bead closeout commit.
- Continue ORKA-cpb for doctrine taxonomy/content migration follow-ups only.

## Known Issues
- `bd` CLI unavailable in this shell; Beads state reconciled via `.beads/` files directly to preserve policy traceability.

---
_Last updated: 2026-03-06_

## Completed Beads
- ORKA-mwl (turn flow unscheduled back-to-back fix + blue handoff sequencing)
- ORKA-z0b (hero selector consistency)
- ORKA-855 (hit-flash opacity + alpha mask fix)
- ORKA-cxi (rollback ORKA-jj0 regression)
- ORKA-9hl (yellow->gold without fly-up)

## Active Work
- ORKA-69r blue lane closeout verification

## Next Tasks
- Finalize ORKA-69r and close if QA remains clean
- Continue player-facing feature lanes after blue lane closure

## Known Issues
- Netlify path/deploy issues are tabled until product flow prioritizes deployment hardening
- Hero-screen progression binding lane remains blocked on product specification decisions

## Execution Kernel Improvements
- Assignment bottleneck reduced: workers may claim the highest-priority READY bead when PM has not explicitly assigned one that cycle.
- Autonomy improved: `/agents/**` coordination files are formally reporting-only and ignored by workers unless a bead explicitly scopes them.
- Safeguards introduced:
  - queue availability target (maintain at least 3 READY beads when possible)
  - repeated-failure decomposition requirement (>2 failed reviews)
  - scope-drift rejection and documentation in `/agents/issues.md`

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-dwg (Combat power index added to hero/enemy runtime arrays for gating stubs)

## Active Work
- Resume prioritized scaffold queue after user-prioritized combat-power indexing lane.

## Next Tasks
- ORKA-axd (Pets scaffold), then ORKA-c1j (Vault scaffold).

## Known Issues
- None newly introduced in ORKA-dwg; formula is deterministic and surfaced for downstream consumers.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-a0k (Chests layout scaffold: mission-nav entry, deterministic tabs/progress/reward shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-axd (Pets scaffold) and ORKA-c1j (Vault scaffold).

## Known Issues
- None newly introduced in ORKA-a0k; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-51g (Homestead layout scaffold: map locale entry, deterministic scene metadata, runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-a0k (Chests scaffold) and ORKA-axd (Pets scaffold).

## Known Issues
- None newly introduced in ORKA-51g; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-khb (Collectibles layout scaffold: map locale entry, deterministic gallery metadata, runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-51g (Homestead scaffold) and ORKA-a0k (Chests scaffold).

## Known Issues
- None newly introduced in ORKA-khb; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-8k4 (Mounts layout scaffold: map locale entry, deterministic gallery metadata, runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-khb (Collectibles scaffold) and ORKA-51g (Homestead scaffold).

## Known Issues
- None newly introduced in ORKA-8k4; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-3e4 (Artifacts layout scaffold: map locale entry, deterministic gallery/passive metadata, runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-8k4 (Mounts scaffold) and ORKA-khb (Collectibles scaffold).

## Known Issues
- None newly introduced in ORKA-3e4; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-7pi (Tomes layout scaffold: map locale entry, deterministic gallery state, and runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-n0g (Relics scaffold) and ORKA-c1j (Vault scaffold) from current P1 readiness order.

## Known Issues
- None newly introduced in ORKA-7pi; mechanics intentionally left as scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-fp9 (debuff lifecycle reliability hardening)

## Active Work
- Preparing ORKA-9ri (Kojonn DoT/debuff support conversion) now that ORKA-fp9 blocker is resolved.

## Next Tasks
- Close ORKA-fp9 in Beads after commit and proceed with ORKA-9ri implementation.

## Known Issues
- None new in this cycle.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-6gt (Falie enmity target-bias with capped guardrail)

## Active Work
- Queue health check and next class-identity slice selection.

## Next Tasks
- Reframe ORKA-9ri to align with skill/passive model before implementation.

## Known Issues
- None new in this cycle.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-2sa (Runa magic-resist trigger vs enemy caster magic paths)

## Active Work
- Continue class identity slices aligned to skill/passive progression model.

## Next Tasks
- ORKA-mo4 (Huun execution drop bonus) or ORKA-69r QA closeout.

## Known Issues
- ORKA-9ri remains intentionally held for scope reframing to avoid RPG-style persistent debuff model drift.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-mo4 (Huun execution drop bonus chance via existing TH drop pipeline)

## Active Work
- Queue continuing through aligned class-identity + wallet/progression lanes.

## Next Tasks
- ORKA-69r QA closeout or ORKA-9hl cleanup/closure alignment.

## Known Issues
- ORKA-9ri remains on hold pending model-aligned rewrite.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-69r (QA contract lock for blue->Astral wallet and no direct blue stat apply)

## Active Work
- Continue aligned backlog slices (non-RPG timer-stack model).

## Next Tasks
- ORKA-9hl closure cleanup and/or queue governance bead cleanup.

## Known Issues
- ORKA-9ri still requires acceptance rewrite before implementation.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-xnz (hit-flash feedback contract lock)

## Active Work
- Continuing low-conflict cleanup/hardening beads.

## Next Tasks
- ORKA-ohb (regen debug noise cleanup) as next low-risk runtime hygiene slice.

## Known Issues
- ORKA-9ri remains held pending acceptance rewrite.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-ohb (regen debug noise contract lock)

## Active Work
- Continue queue on low-conflict, model-aligned slices.

## Next Tasks
- ORKA-y5x / ORKA-zys governance cleanup, then revisit high-priority epic slicing.

## Known Issues
- ORKA-9ri still pending rewrite for model alignment.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-6x3 (yellow per-gem slam settle sequence)

## Active Work
- Priority queue shifted toward layout scaffolds (tomes/relics/vault/chests/evolution/homestead/pets/artifacts/mounts/collectibles).

## Next Tasks
- Begin first layout scaffold implementation bead from new P1 queue.

## Known Issues
- ORKA-9ri still pending model-aligned rewrite before execution.

---
_Last updated: 2026-03-07_

## Completed Beads
- ORKA-cpc (CP-budget encounter wiring complete: builder spawn path, map request stub, caller-owned request API)

## Active Work
- ORKA-cpb (in_progress): doctrine taxonomy/content migration follow-up and consistency contracts

## Next Tasks
- Finalize doctrine taxonomy pass across current placeholder roster.
- Keep locale/faction defaults stable for future enemy additions via contract tests.

## Known Issues
- `bd` CLI is unavailable in this shell session; Beads file-state updates are being applied directly under `.beads/`.

---
_Last updated: 2026-03-07_

## Completed Beads
- ORKA-cpb (doctrine metadata follow-up complete: taxonomy consistency + default fallback contracts)

## Active Work
- ORKA-cpc (in_progress): final hardening/traceability pass for map encounter-node request authority

## Next Tasks
- Resolve underspecified P0 bead bodies (`null` scope) so priority queue is executable again.
- Promote next fully-specified runtime bead once P0 scopes are clarified.

## Known Issues
- Several open P0 beads are currently header-only and blocked by missing scope/acceptance content.

---
_Last updated: 2026-03-08_

## Completed Beads
- None newly closed this pass.

## Active Work
- ORKA-cpc (in_progress): final CP encounter normalization hardening complete; awaiting lane closure decision.

## Next Tasks
- Close ORKA-cpc after final QA checkpoint.
- Continue ORKA-cpb only if additional doctrine content migration is requested.

## Known Issues
- Open P1/P2 queue is largely non-executable (`null` issue bodies) except ORKA-cpc/ORKA-cpb.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-jj0 (yellow->gold fly-up behavior confirmed in runtime + contract tests)

## Active Work
- Legacy bead-state reconciliation in progress (open vs implemented runtime)

## Next Tasks
- Continue status cleanup for open beads already evidenced in dev_reports/tests.
- Keep only truly unstarted/unimplemented beads in open queue.

## Known Issues
- Conflicting legacy bead ORKA-9hl moved to blocked; contradicts current shipped yellow fly-up behavior.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-hlc (closed obsolete; blue-match buffs removed by product direction)

## Active Work
- Backlog/bead decision cleanup to align queue with current non-buff gem model.

## Next Tasks
- Continue P0/P1 decision-gated bead closures/rewrites one-by-one.

## Known Issues
- Legacy open queue still contains stub beads needing explicit keep/close/scope decisions.

---
_Last updated: 2026-03-08_

## Completed Beads
- None newly closed in this pass.

## Active Work
- ORKA-hsf (in_progress): Hero screen Figma 1:3 compliance implementation complete; pending visual QA confirmation.

## Next Tasks
- Visual compare runtime Hero screen vs Figma node 1:3 and resolve remaining pixel-level variance.

## Known Issues
- Browser MCP localhost access is unreliable on current network, so visual validation may require user-side runtime check.

---
_Last updated: 2026-03-08_

## Completed Beads
- None newly closed this pass.

## Active Work
- ORKA-mwl (in_progress): initiative repeat-turn regression fix implemented with queue sanitizer + explicit-extra provenance gate.

## Next Tasks
- Runtime QA confirm: no hero stacking in initiative order under repeated turn advancement.
- Close ORKA-mwl after user validation.

## Known Issues
- MCP Playwright transport is unstable in this session; CLI Playwright remains available for screenshots/QA fallback.

## Completed Beads
- ORKA-spt (party skill points seeded to 300 + multipass spend/cap validation complete)

## Active Work
- ORKA-mwl remains in_progress (initiative queue regression verification/closure lane).

## Next Tasks
- Resume highest-priority READY/in_progress bead with executable scope.

## Known Issues
- `bd` CLI remains unavailable in-shell; bead file-state updates continue via direct `.beads/` file edits.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-lod (startup loading staged + parallelized)
- ORKA-bar (enemy HP bar distortion fix)

## Active Work
- Continue highest-priority remaining in-progress bead after runtime QA confirmation.

## Next Tasks
- Runtime QA: verify perceived first-load improvement and enemy bar visual quality in live combat scene.

## Known Issues
- `bd` CLI unavailable in current shell; bead state updated directly in `.beads/` files.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-lod (load staging + parallelized core startup)
- ORKA-bar (enemy HP bar distortion rendering fix)
- ORKA-lpb (Layout 0 loading/progress bar implementation)

## Active Work
- None in this lane.

## Next Tasks
- Runtime QA pass on perceived startup time and loading bar behavior under cold cache.

## Known Issues
- `bd` CLI unavailable in shell; Bead status maintained directly in `.beads/` files.

---
_Last updated: 2026-03-08_

## QA Pass
- Startup/load regression retest: PASS
- Full sprite preload before runtime activation confirmed.
- Layout 0 loading/progress bar confirmed visible through bootstrap.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-vlt (Vault nav rename + retention button move Map -> Chests)
- ORKA-l0p (Layout 0 loading bar moved to bottom mobile style)

## Active Work
- None in this request lane.

## Next Tasks
- User visual QA of chests top-rail buttons and new loading bar placement.

## Known Issues
- None newly introduced in this lane.

---
_Last updated: 2026-03-08_
