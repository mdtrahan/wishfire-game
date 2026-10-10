# Cloud preparation checkpoint and commit audit

Bead: ORKA-dwy. Captured October 9, 2026 PDT. Cloud cutover remains pending.

## Preserved state

Private checkpoint: `/Users/Mace/Codex-Orka-safe-checkpoints/cloud-prep-20261010T043256Z`. Its `README.md` explains recovery. The full source checkout and all 81 registered worktrees were captured, including staged state, untracked files, ignored material, Git storage and authoritative Beads. A SHA-256 manifest verified 286,755 files totaling 46,948,045,690 bytes across 37 physical roots. The capture preserved every original ref and worktree status. The IPC socket is transient and requires a fresh process on restore.

An independent mirror restored all 703 Git refs from the bundle. A separate cold Dolt copy successfully queried all 163 captured Beads. This validates local recovery. The external drive was disconnected; an off-machine copy remains required.

Sixteen private archival commits preserve 3,459 changed or newly authored files. They live under `refs/recovery/cloud-prep-20261010/` in `restore-test.git` and in the self-contained `recovery-commits.bundle`. Each commit retains its lane's original HEAD as parent; every changed regular-file blob was compared byte-for-byte with the captured source. Source worktree indexes and branches were retained. These are WIP recovery commits, with feature acceptance and integration gates pending. The separate mirror uses Git plumbing to preserve unfinished files without running implementation commit hooks or marking features complete.

The other 39,053 untracked files are retained in the verified filesystem archive. They consist of output, reference recordings and lane metadata excluded from recovery commit additions. Originally tracked or staged evidence is included in the relevant recovery commit. `recovery-commits.json` identifies each included/excluded path and its worktree. Never push all recovery refs or bundles to the public origin: they contain historical and local material outside publication scope.

Four loose root goals for boss menus, boss progress, pack compensation and pack huddles are byte-identical to files already committed in the gameplay candidate. Their root copies are also captured.

## Integration evidence

Main baseline: `2429777f55b917bba183895ab613ca92441fea0d`. Current game candidate: `4338182db5cea6322368b6927b08ee61248af8e5`, 76 commits ahead, zero behind. Main has 84 unpublished commits relative to the verified origin.

| Check | Main | Candidate | Disposition |
| --- | --- | --- | --- |
| Complete `npm test -- --test-reporter=tap` | 992 tests; 982 pass, 7 fail, 3 skipped | 1,131 tests; 1,117 pass, 11 fail, 3 skipped | Candidate full suite is red. |
| Seven offline contracts from full suite | Missing local esbuild executable path | Same setup failure | Resolved on both using the existing helper's `ORKA_OFFLINE_ESBUILD` override. |
| Offline contracts after setup correction | 7 pass | 7 pass | No source edit or dependency installation required. |
| Runtime release builder | Pass, 481 files | Pass, 2,472 files | Both tracked releases build. |
| Offline release after setup correction | Pass, 275 files | Pass, 2,244 files | Both offline releases build. |
| Lamp browser test | Completed successfully | Stalled for over five minutes; stopped the owned test process | Browser QA remains unresolved. |

The override points to `/Users/Mace/Codex-Orka/node_modules/esbuild/bin/esbuild`. Complete logs and setup results remain inside the private checkpoint. The configured rerun was limited to the affected offline contracts and builds; no claim is made that the original complete-suite run became green.

Three candidate-only failing contracts remain:

- `combatCardRetirementContract.test.js`: expects a direct `drawCombatHealthBar` call, while the candidate wraps it with activation alpha.
- `heroArtAssetsContract.test.mjs`: makes the same direct-call assertion. Review against the accepted fade behavior before changing these contracts.
- `realtimeBasicCombatRulesContract.test.mjs`: expects a projectile to damage its target after the source hero is KO; the candidate leaves target HP unchanged. Establish the approved KO/attempt behavior before changing runtime or the test.

The in-app Browser loaded the normal entry and entered combat at a measured 529×1025 CSS viewport, DPR 2, without horizontal overflow or captured console errors. This smoke check covers entry and combat loading. It does not certify all feature behavior or replace human visual acceptance. No gameplay source was changed.

## Branch decisions

[The complete branch audit](chatgpt-cloud-checkpoint-audit.json) provides branch, bead, current/recommended disposition, merge intent, reason, blocker, next action and owner-decision fields for all 180 local branches, including this new audit lane. Exact ancestry establishes integrated tips; dirty source is assessed separately even when its tip is on main.

After comparing 100 unique unmerged heads and captured file states with the candidate, the audit records 63 closed branches, 52 legacy/source branches, 3 deprecated branches, 27 that need scope, 33 that need an owner decision, and 2 active branches (main and this audit). Forty-two branches have no distinct ordinary patches beyond the current candidate. The hero-turn-card fan, Astral shop and Astral KO-orb tuning are deprecated under the accepted current combat contract. Highorc's 233 differing recovery files are QA-source archive copies with no differing shipping-runtime path; the elemental VFX study is separate reference material. Patch equivalence does not certify merge-only changes or authorize deletion. An `in_progress` Bead alone does not prove current owner intent. Conflict and total-debt counts remain unmeasured where scope/acceptance gates precede merge evaluation; the report uses null rather than reporting zero. The current endpoint is not Integration Ready. Historical task statuses were retained.

The owner directed disposition by relevance to current implementation. Production checks confirmed manual 2s/Auto 5s, 25 EXP per draw, and the retained EXP curve (Lv4 cost 800), so the proposed deletion of the current tuning decision was discarded. The eight-second/150-draw trial is now labelled declined historical context. A production-function reproduction also confirmed the primary progression-owner defect remains on the candidate: canonical Fara gains equipped stats while `falie#1` receives none. Those documents now record current evidence under the existing open ORKA-5af.3, with its persistence decision still pending. The redundant planning-index addition was removed. The four gameplay goal copies already match committed candidate files. Unrelated root metadata and documentation remain in place.

## Ordered continuation

1. Copy the verified checkpoint to approved off-machine private storage and verify its manifest there.
2. Resolve the three contract failures and the lamp browser-test stall in scoped validation/bug beads. Compare the intended KO rule with accepted current product decisions.
3. Review the current stack in commit order, with acceptance and dependency proof per Bead. Review separate dirty art/motion and rendering lanes from their recovery commits; choose scoped continuations or reference retention.
4. Re-run Integration Ready against the current main baseline in a clean integration checkout. Create its rollback checkpoint and integrate accepted scopes only. Main remains at its original game SHA during this audit.
5. Continue the cloud plan's publication, tracker portability, environment and Mac-off trial gates after owner approval.

No source/worktree was deleted, reset or cleaned. Cloud environments, repository visibility, remote refs and deployment were retained. The original dirty lanes remain available for their owners; private recovery commits do not change what the desktop's pending-change counter displays.
