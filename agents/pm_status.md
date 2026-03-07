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
