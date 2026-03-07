# PM Status

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
