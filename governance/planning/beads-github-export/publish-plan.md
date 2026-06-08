# Beads to GitHub Publish Plan

Repository: `mdtrahan/wishfire-game`

Beads remains source of truth. Publish GitHub records as visibility mirrors only.

## Current Gates

| Gate | State | Evidence |
| --- | --- | --- |
| Remote baseline | blocked | Sync local main to GitHub before opening Bead branch PRs. |
| Issue creation | ready | Manifest contains one create/update operation per visible non-closed Bead. |
| Draft PR creation | blocked | Requires pushed branch/review artifact and remote main parity. |

## GitHub Access Notes

- Local `gh auth status` currently reports an invalid token for `mdtrahan`, so the publisher cannot apply writes from local CLI until auth is repaired.
- GitHub connector read access confirmed recent repository PRs are closed/merged; no current open PR collision was found through the connector read.
- The first connector write rejected detailed Bead bodies as too much non-public workspace data; `github-publish-manifest.json` is now public-safe and omits detailed scope, acceptance criteria, changed-file paths, worktree paths, and raw Beads internals.

## Remote Baseline

- `main` is `35` commits ahead of `origin/main`.
- `origin/main` is `0` commits ahead of `main`.
- Do not open Bead branch PRs while local main is ahead of GitHub main; those PRs would include unrelated baseline commits.

## Publish Phases

1. Create or update GitHub Issues for all visible non-closed Beads from the public-safe `github-publish-manifest.json`.
2. Add those Issues to the team Project and expose the listed project fields.
3. Sync local `main` to GitHub through the protected-branch PR process.
4. Push selected Bead branches or create tracked review artifacts.
5. Open draft PRs for active, blocked, QA-ready, or review-worthy Beads.

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
