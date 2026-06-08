# Beads to GitHub Publish Plan

Repository: `mdtrahan/wishfire-game`

Beads remains source of truth. Publish GitHub records as visibility mirrors only.

## Current Gates

| Gate | State | Evidence |
| --- | --- | --- |
| Remote baseline | complete | PR #123 merged the 46 local `main` commits into GitHub `main`; export branch is merged with current `origin/main`. |
| Issue creation | complete | All 99 visible non-closed Beads in the manifest are published as GitHub Issues #23 through #121. |
| Project item operations | prepared | Manifest contains 99 Project item operations with the public-safe Project fields. Apply still needs an existing Project owner/number. |
| Review packet artifacts | complete | Generated 36 public-safe review packets, one for each draft PR candidate, under `governance/bead-reviews/`. |
| Draft PR review surface | partial | ORKA-7ff6 has draft PR #122; remaining Bead-lane PRs require branch pushes or review decisions. |

## GitHub Access Notes

- Local `gh auth status` is valid for `mdtrahan` and includes Project scope.
- GitHub `main` is caught up with the committed local `main` history through merged PR #123.
- The first connector write rejected detailed Bead bodies as too much non-public workspace data; `github-publish-manifest.json` is now public-safe and omits detailed scope, acceptance criteria, changed-file paths, worktree paths, and raw Beads internals.
- GitHub issue creation completed all 99 public-safe issue mirrors.
- No open `mdtrahan` user Project currently exists; Project insertion remains prepared but unapplied until an existing board is provided or a new board is explicitly approved.
- GitHub draft PR creation completed ORKA-7ff6 as #122.
- `tools/publish_beads_github_visibility.py` now has a Project V2 path that can add existing mirror Issues to a Project and set the configured fields once the Project owner and number are available.
- `tools/generate_bead_review_packets.py` generated public-safe review packets for all 36 draft PR candidates; `--review-required-only` still reproduces the 32 no-branch subset.

## Remote Baseline

- `main` and `origin/main` are aligned after merged PR #123.
- The ORKA-7ff6 export branch has been merged with current `origin/main`.
- Future Bead branch PRs no longer need to carry the former local-only baseline.

## Publish Phases

1. Create or update GitHub Issues for all visible non-closed Beads from the public-safe `github-publish-manifest.json`. Completed; see `published-issue-mapping.md`.
2. Add those Issues to the team Project and expose the listed project fields. Operations prepared; apply is gated on an existing Project owner/number.
3. Sync local `main` to GitHub through the protected-branch PR process. Completed by PR #123.
4. Push selected Bead branches or create tracked review artifacts. Review artifacts completed for all 36 draft PR candidates, including branch-backed Beads; see `governance/bead-reviews/INDEX.md`.
5. Open draft PRs for active, blocked, QA-ready, or review-worthy Beads. Started with ORKA-7ff6 clean draft PR #122; other lanes remain gated.

## Published Draft PRs

| PR | Bead | Branch | Base | State | Notes |
| --- | --- | --- | --- | --- | --- |
| [#122](https://github.com/mdtrahan/wishfire-game/pull/122) | ORKA-7ff6 | `bead/ORKA-7ff6-github-visibility-export-clean-pr` | `main` | draft | Clean review branch replayed only the export commits onto `origin/main`. |

## Project V2 Apply Command

Dry-run all Project item operations:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json
```

Apply after the team provides an existing Project owner and Project number:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --project-owner mdtrahan --project-owner-type user --project-number <project-number>
```

## Review Packet Artifacts

| Artifact | Count | Notes |
| --- | --- | --- |
| [governance/bead-reviews/INDEX.md](../../bead-reviews/INDEX.md) | 36 | Public-safe packets for every draft PR candidate, including branch-backed Beads and Beads that need triage before code. |

## First Batch

| Bead | Status | Priority | Surface | Branch Or Artifact | Needs PR |
| --- | --- | --- | --- | --- | --- |
| ORKA-7ff6 | in_progress | P1 | draft_pr | bead/ORKA-7ff6-github-visibility-export | yes |
| ORKA-zy2o | in_progress | P1 | draft_pr | bead/ORKA-zy2o-remove-green-gems | yes |
| ORKA-v4mh | open | P1 | draft_pr | bead/ORKA-v4mh-simulation-core-contract | yes |
| ORKA-idfa | open | P2 | draft_pr | bead/ORKA-idfa-appjs-offload | yes |
| ORKA-iz4q | recovery | P1 | review_packet_pr | governance/bead-reviews/ORKA-iz4q.md | yes |
| ORKA-03d | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-03d.md | yes |
| ORKA-39i0 | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-39i0.md | yes |
| ORKA-6opp | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-6opp.md | yes |
| ORKA-macy | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-macy.md | yes |
| ORKA-tk9 | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-tk9.md | yes |
| ORKA-b2c | blocked | P2 | review_packet_pr | governance/bead-reviews/ORKA-b2c.md | yes |
| ORKA-e67 | blocked | P2 | review_packet_pr | governance/bead-reviews/ORKA-e67.md | yes |

## Safety Rules

- Do not publish raw `.beads` internals.
- Do not use GitHub status to overwrite Beads status in this pass.
- Do not create fake implementation PRs for backlog-only Beads.
- Prefer a small first batch before publishing the entire backlog.
