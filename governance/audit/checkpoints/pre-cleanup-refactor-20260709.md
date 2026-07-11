# Pre-Cleanup Refactor Checkpoint

Status: historical recovery record only. This report does not authorize lane cleanup, branch deletion, Beads changes, PR closure, or runtime edits.

## Recovery Point

- Tag: `checkpoint/pre-cleanup-refactor-20260709`
- Tagged HEAD: `720b74ba215833c8b8f53b5e175b192fb9d819c7`
- Current branch: `main`
- Tag timestamp: `2026-07-09T11:30:26-07:00`
- Starting commit: `Merge pull request #198 from mdtrahan/codex/integration-ready-docs-20260709`
- Tracked worktree state: clean
- Untracked files preserved:
  - `.beads/dolt-server.lock`
  - `.beads/dolt-server.log`

## Live Beads

The default PATH resolved `/Users/Mace/.local/bin/bd` version `0.56.1`, which could not query the `0.63.3` database schema and failed with `column "crystallizes" could not be found`. A read-only SQL fallback returned the inventory below. The already-installed `/opt/homebrew/bin/bd` version `0.63.3` was later verified as schema-compatible; no database migration was required.

| Bead | Title | Status |
| --- | --- | --- |
| `ORKA-6fw` | Implement deterministic enemy behavior scripts | `in_progress` |
| `ORKA-bo1` | Refactor root AGENTS.md into thin governance orchestrator | `in_progress` |
| `ORKA-k61` | Fix merged dev panel and speed initiative regressions | `closed` |

`bd ready` returned no ready work.

## Registered Worktrees

Thirty-six worktrees were registered. Only `ORKA-6fw` and `ORKA-bo1` matched live `in_progress` Beads. Every other lane is preserved as historical or ownership-unclear evidence. No cleanup decision was made.

```text
/Users/Mace/Codex-Orka                                                                      720b74b [main]
/Users/Mace/.codex/worktrees/5ade/Codex-Orka                                                71cd9c6 (detached HEAD)
/Users/Mace/.codex/worktrees/846f/Codex-Orka                                                99bcdbc (detached HEAD)
/Users/Mace/Codex-Orka/.worktrees/ORKA-nnsg-enemy-selector-sync                             d5c69ec [bead/ORKA-nnsg-enemy-selector-sync]
/Users/Mace/Codex-Orka/.worktrees/ORKA-yib8.1.1-appjs-orchestrator                          b65301f [quarantine/ORKA-yib8.1.1-appjs-orchestrator-divergent]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-6fw-deterministic-enemy-behavior                  eecec0f [bead/ORKA-6fw-deterministic-enemy-behavior]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-7tr2-asset-audit-historical                       515b9ca [bead/ORKA-7tr2-asset-audit-historical]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-8ww8-destiny-heal-bloom                           88bcce1 [bead/ORKA-8ww8-destiny-heal-bloom]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-8ww8-destiny-heal-bloom-clean                     208a2ed [bead/ORKA-8ww8-destiny-heal-bloom-clean]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-9c7u-dynamic-speed-turn-system-checkpoint         f772fed [bead/ORKA-9c7u-dynamic-speed-turn-system-checkpoint]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-bo1-thin-root-agents                              d9a94cf [bead/ORKA-bo1-thin-root-agents]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-bpkv-open-design-workflow                         99bcdbc [bead/ORKA-bpkv-open-design-workflow]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-dxrq-narrative-framework                          ef1f146 [bead/ORKA-dxrq-narrative-framework]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-eih7-browser-policy-routing                       410c46a [bead/ORKA-eih7-browser-policy-routing]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-iqg1-arcane-pulse-split                           4168b35 [bead/ORKA-iqg1-arcane-pulse-split]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-k34f-dynamic-initiative-human-gameplay-validation 97f2559 [bead/ORKA-k34f-dynamic-initiative-human-gameplay-validation]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-n765-dynamic-initiative-live-authority-experiment 1d7c936 [bead/ORKA-n765-dynamic-initiative-live-authority-experiment]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-r1q1-readme-docs                                  2b9a0d0 [bead/ORKA-r1q1-readme-docs]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-rrxj.13-chain-strike-i                            95fc19e [bead/ORKA-rrxj.13-chain-strike-i]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-rrxj.16-magic-fruit-maxhp                         08c1e9c [quarantine/ORKA-rrxj.16-magic-fruit-maxhp-stale]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-rrxj.18-remove-dead-skill-stubs                   4520b3d [bead/ORKA-rrxj.18-remove-dead-skill-stubs]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-rrxj.20-force-draw-skill-exhaustion               69d1c82 [bead/ORKA-rrxj.20-force-draw-skill-exhaustion]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-sdi7-dynamic-initiative-runtime-shadow-adapter    1a7207e [bead/ORKA-sdi7-dynamic-initiative-runtime-shadow-adapter]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-w4ct-default-speed-based-initiative               2479c3d [bead/ORKA-w4ct-default-speed-based-initiative]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-w4ct-default-speed-based-initiative-clean         604a175 [bead/ORKA-w4ct-default-speed-based-initiative-clean]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.1-hotspot-decomposition-plan                 3ff1cd6 [bead/ORKA-yib8.1-hotspot-decomposition-plan]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.1.3-simulation-shadow-audit                  4a56f65 [bead/ORKA-yib8.1.3-simulation-shadow-audit]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.10-retrieval-index-hygiene                   8218723 [bead/ORKA-yib8.10-retrieval-index-hygiene]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.11-beads-backup-warning                      7036f0f [bead/ORKA-yib8.11-beads-backup-warning]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.4-legacy-scaffold-review                     db7ef65 [bead/ORKA-yib8.4-legacy-scaffold-review]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.5-mirror-ownership                           f87389b [bead/ORKA-yib8.5-mirror-ownership]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.6-fallow-entrypoints                         1e4e273 [bead/ORKA-yib8.6-fallow-entrypoints]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.7-initiative-guards-import                   0a46450 [bead/ORKA-yib8.7-initiative-guards-import]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.8-npm-test-baseline-status                   ad55735 [bead/ORKA-yib8.8-npm-test-baseline-status]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-yib8.9-stale-path-classification                  ca2d781 [bead/ORKA-yib8.9-stale-path-classification]
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-zvq1-power-amp-baseline                           e08aa53 [bead/ORKA-zvq1-power-amp-baseline]
```

The two live implementation worktrees had no uncommitted changes at checkpoint time. Targeted status checks found no uncommitted `tests/`, `tools/`, or checkpoint-report changes in registered repo-owned worktrees.

## Open Pull Requests

Nineteen open pull requests were recorded:

| PR | Draft | Base | Head | Title |
| --- | --- | --- | --- | --- |
| #195 | yes | `main` | `bead/ORKA-6fw-deterministic-enemy-behavior` | feat(combat): add deterministic enemy behavior scripts |
| #191 | no | `main` | `bead/ORKA-eih7-browser-policy-routing` | docs: refresh browser policy routing |
| #189 | no | `bead/ORKA-n765-dynamic-initiative-live-authority-experiment` | `bead/ORKA-w4ct-default-speed-based-initiative` | Make Dynamic Initiative the default combat selector |
| #188 | no | `main` | `bead/ORKA-7tr2-asset-audit-historical` | Docs: mark stale asset usage audit historical |
| #187 | yes | `main` | `bead/ORKA-n765-dynamic-initiative-live-authority-experiment` | fix(combat): stabilize dynamic authority QA lane |
| #186 | yes | `main` | `bead/ORKA-wmbr-map-war-meter-remove` | [codex] Remove map war meter chrome |
| #185 | yes | `main` | `bead/ORKA-r1q1-readme-docs` | [docs] Refresh README repo orientation |
| #183 | yes | `main` | `bead/ORKA-rrxj.20-force-draw-skill-exhaustion` | [codex] Fix Force Draw exhaustion audit and remove Destiny button |
| #173 | yes | `main` | `bead/ORKA-yib8.8-npm-test-baseline-status` | docs(repo-health): map npm baseline restoration |
| #172 | yes | `main` | `bead/ORKA-yib8.1-hotspot-decomposition-plan` | docs(repo-health): plan hotspot decomposition |
| #171 | yes | `main` | `bead/ORKA-yib8.11-beads-backup-warning` | docs(repo-health): document Beads backup warning |
| #170 | yes | `main` | `bead/ORKA-yib8.10-retrieval-index-hygiene` | docs(repo-health): document retrieval index hygiene |
| #169 | yes | `main` | `bead/ORKA-yib8.9-stale-path-classification` | docs(repo-health): classify stale absolute paths |
| #168 | yes | `main` | `bead/ORKA-yib8.1.3-simulation-shadow-audit` | docs(repo-health): audit SimulationCore shadow ownership |
| #166 | yes | `main` | `bead/ORKA-yib8.4-legacy-scaffold-review` | docs(repo-health): review legacy scaffold candidates |
| #165 | yes | `main` | `bead/ORKA-yib8.5-mirror-ownership` | docs(repo-health): define mirror ownership strategy |
| #164 | yes | `main` | `bead/ORKA-yib8.6-fallow-entrypoints` | docs(fallow): calibrate browser entrypoints |
| #163 | yes | `main` | `bead/ORKA-yib8.7-initiative-guards-import` | fix(imports): mirror initiative guards into shared core |
| #161 | yes | `main` | `bead/ORKA-rrxj.18-remove-dead-skill-stubs` | Remove dead skill stub runtime pathways |

## Recovery

To inspect the exact pre-cleanup state:

```bash
git show checkpoint/pre-cleanup-refactor-20260709
```

To restore files from the checkpoint without moving branch history:

```bash
git restore --source checkpoint/pre-cleanup-refactor-20260709 -- <paths>
```

Any branch reset to the checkpoint is destructive and requires explicit owner approval.
