id: ORKA-spt
title: [TEST] Seed party skill points to 300 and multipass consumption validation
priority: P1
status: done

## Objective
Seed all heroes to 300 skill points for deterministic upgrade-consumption testing and run repeated multipass verification.

## Scope
- Add deterministic seed hook for party skill points (set exact value, not additive drift).
- Invoke seed at combat entity init for this test lane.
- Execute repeated upgrade-consumption passes and verify balance decreases and upgrade caps hold.

## Acceptance
- Each hero starts with exactly 300 skill points at session init.
- Repeated skill upgrade calls reduce skill points according to configured costs.
- Upgrade attempts stop at max rank and do not over-consume points.
- Test evidence captured from multipass run output.


## Completion Note (2026-03-08)
- Implemented deterministic party seed to 300 at combat init via `SetHeroSkillPointsForParty`.
- Playwright multipass validation passed 12/12 session passes for all 4 heroes.
- Verified spend/cap behavior per pass: start=300, end=279 after full 3-skill progression, 9 applied upgrades, 3 max-rank rejects, no over-consume.
