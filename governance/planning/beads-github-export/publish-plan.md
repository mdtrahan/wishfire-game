# Beads to GitHub Publish Plan

Repository: `mdtrahan/wishfire-game`

Beads remains source of truth. Publish GitHub records as visibility mirrors only.

## Current Gates

| Gate | State | Evidence |
| --- | --- | --- |
| Remote baseline | blocked | Sync local main to GitHub before opening Bead branch PRs. |
| Issue creation | complete | All 99 visible non-closed Beads in the manifest are published as GitHub Issues #23 through #121. |
| Project item operations | prepared | Manifest contains 99 Project item operations with the public-safe Project fields. Apply still needs Project V2 access. |
| Draft PR review surface | partial | ORKA-7ff6 has clean draft PR #122; remaining Bead-lane PRs require pushed branches/review artifacts and remote main parity. |

## GitHub Access Notes

- Local `gh auth status` currently reports an invalid token for `mdtrahan`, so the publisher cannot apply writes from local CLI until auth is repaired.
- GitHub connector read access confirmed recent repository PRs are closed/merged; no current open PR collision was found through the connector read.
- The first connector write rejected detailed Bead bodies as too much non-public workspace data; `github-publish-manifest.json` is now public-safe and omits detailed scope, acceptance criteria, changed-file paths, worktree paths, and raw Beads internals.
- GitHub connector issue creation completed all issue mirrors, but no GitHub Project V2 write tool is available in this session.
- GitHub connector draft PR creation completed ORKA-7ff6 as #122 from a clean branch based on `origin/main`, avoiding the 35 local-only `main` commits.
- `tools/publish_beads_github_visibility.py` now has a Project V2 path that can add existing mirror Issues to a Project and set the configured fields once `gh` auth and the Project number are available.

## Remote Baseline

- `main` is `35` commits ahead of `origin/main`.
- `origin/main` is `0` commits ahead of `main`.
- Do not open Bead branch PRs while local main is ahead of GitHub main; those PRs would include unrelated baseline commits.

## Publish Phases

1. Create or update GitHub Issues for all visible non-closed Beads from the public-safe `github-publish-manifest.json`. Completed; see `published-issue-mapping.md`.
2. Add those Issues to the team Project and expose the listed project fields. Operations prepared; apply is gated on Project V2 write access and Project number.
3. Sync local `main` to GitHub through the protected-branch PR process.
4. Push selected Bead branches or create tracked review artifacts.
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

Apply after `gh auth status` passes and the team Project number is known:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --project-owner mdtrahan --project-owner-type user --project-number <project-number>
```

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
