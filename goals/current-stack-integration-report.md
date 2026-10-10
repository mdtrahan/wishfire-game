# Current game stack integrated — ORKA-dwy

Merged into local main on October 9, 2026 PDT. Game integration commit: `bd3c81d7`.

The merge includes the 76 committed changes from `codex/ORKA-bnw-cp-refresh`, the preservation audit and the agreed hero-ownership follow-up. All three source branch tips are ancestors of main.

## Verification

| Check | Result |
| --- | --- |
| Complete final-state suite | 1,129 passed, zero failed, three skipped |
| Lamp browser proof | All four phone viewports passed |
| Post-merge focused checks | 16 passed |
| Hosted and offline builds from the merged commit | Both passed with zero warnings |
| In-app smoke check | Combat and current Fara Skills screen loaded; four icons decoded; no console errors or horizontal overflow |

Integration corrected stale health-bar and KO test contracts, updated the lamp fixture for the current hero screen and bounded its waits. The sole new runtime repair routes a skill-icon URL through the existing asset resolver so the classic offline bundle can use it.

The in-app browser blocks file URLs, so the offline artifact has build/contract proof without a visual file-playback check.

## Recovery and remaining work

Rollback tag: `checkpoint/ORKA-dwy-main-before-merge-20261009`, pointing to the prior main `2429777f`.

The private checkpoint independently restored the integration candidate and the byte-verified root stash `1e225129`. Twelve root files were preserved before refreshing the checkout: their old planning copies remain recovery material. Main uses the current agreed documents. Original source worktrees and branches are retained.

Of the 179 branch tips captured before the audit, 35 additional tips are now reachable from main: 108 total. The remaining 71 captured tips retain their earlier review, legacy or unfinished-work dispositions. This merge does not absorb the private archival WIP commits.

Resume [ORKA-5af.3: hero ownership repair](../governance/planning/wishfire-progression-adaptations/hero-owner-decision.md) from this merged main. Hero/save reconciliation and balance tuning remain pending. Cloud cutover, remote publication and off-machine checkpoint verification remain pending.

Full logs, containment results and preservation receipts live in the private checkpoint's integration evidence directory.
