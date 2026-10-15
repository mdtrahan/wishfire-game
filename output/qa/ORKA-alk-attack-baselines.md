# Wishfire basic attack baseline tuning (ORKA-alk)

Authoritative research: https://wishfire-attack-rate-evidence-20261003.netlify.app/
The report labels 1.2–1.8 seconds as an inferred prototype recommendation. These authored values use Level 1 SPEED for ordering; runtime SPD changes do not recalculate basics.

| Hero | L1 SPEED | baseAttackInterval (s) | Basics/s | Placement |
| --- | ---: | ---: | ---: | --- |
| Fara | 8 | 1.8 | 0.556 | Slowest SPEED gives the tank the most measured cadence. |
| Hondo | 12 | 1.2 | 0.833 | Fastest SPEED gives the fighter the quickest baseline. |
| Runa | 11 | 1.4 | 0.714 | Second-fastest SPEED places Runa just behind Hondo. |
| Kaja | 10 | 1.6 | 0.625 | Lower-middle SPEED gives Kaja a steady intermediate cadence. |

Party total: 2.728 basics/second before skills. A future 3x increase gives 0.6/0.4/0.467/0.533 seconds respectively; that progression is not implemented.

## Recovery and source

Checkpoint tag: wishfire-checkpoint-20261003-before-attack-tuning at 0a24c72.
Recovery artifacts: /Users/Mace/Codex-Orka/output/checkpoints/wishfire-20261003-before-attack-tuning/ contains both root and current Wishfire HEAD bundles, binary HEAD patches, nonignored untracked tarballs and verified SHA-256 manifest. Original checkouts retain their existing dirt. The tuning branch derives from the current realtime progression build, rather than the older turn-based main.

## Validation

51 focused checks pass across realtime action scheduling, cooldowns, enemy scheduling, hero basic scheduling/focus, skill targeting/effects, two-wave integration and progression transitions. A 120-second production scheduler run with all four canonical heroes and no active skill modifiers yields Fara 67, Hondo 100, Runa 86, Kaja 75 basics. Each due-time interval matches its authored baseline and no baseline approaches 0.4–0.6 seconds.

All 20 canonical active definitions are deep-equal to checkpoint. Cooldown tests exercise each active with both 1.8 and 0.4 second basic inputs, proving the same skill action and cooldown reset. A subsequent basic preserves each skill readiness timestamp. Skill implementation, scheduler arbitration, cast/queue timing, SP and FLOW source remain untouched. Quickload retains its temporary 0.4-second override and slowest-clock selection; the current full party now selects Fara through the existing rule. Its SPEED-based targeting fixture was updated to assert this authored-clock input.

The two-wave fixture now allows the existing runtime to clear an empty projectile queue. This became reachable during slower cadence; only the test harness changed.

Native Browser: http://localhost:8041/web-runner/index.html. Fresh origin, four canonical heroes, combat speed 1, developer Lv1 preset explicitly confirmed all heroes Lv1/EXP0. Combat visibly advances with all four active, independent projectiles and skills. Viewport 751x893 CSS pixels, DPR1, Canvas 502x893 at x124.5. No console warnings/errors observed. No layout edits.

Expanded basic-rule suite has one inherited failure: realtimeBasicCombatRulesContract expects enemy EXP 7 while current progression grants 0. It fails identically on unchanged checkpoint; reward rules were not changed.

Scope: two runtime core files, owning contracts and focused test fixtures. Preserved on codex/ORKA-alk-attack-baselines, dependent on the unmerged progression build. No main merge, push or deployment performed; Integration Ready against main is not claimed.
