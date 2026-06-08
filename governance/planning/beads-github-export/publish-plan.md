# Beads to GitHub Publish Plan

Repository: `mdtrahan/wishfire-game`

Beads remains source of truth. Publish GitHub records as visibility mirrors only.

## Current Gates

| Gate | State | Evidence |
| --- | --- | --- |
| Remote baseline | complete | Local main matches remote main after merged PR #123. |
| Issue creation | complete | 99 total Bead mirror issues were published; 98 remain open for current non-closed Beads after closing ORKA-zy2o mirror #24. |
| Project item creation | prepared | Manifest contains 98 Project item operations for current non-closed Beads. Apply needs explicit confirmation of Project #2 or another target board plus field setup. |
| Review packet artifacts | complete | Generated 35 public-safe review packets for current non-closed draft PR candidates. |
| Draft PR review surface | partial | ORKA-7ff6 has draft PR #122; remaining Bead-lane PRs require branch pushes or review decisions. |

## GitHub Access Notes

- Verify local `gh auth status` and Project scope before applying writes from the local CLI.
- Project item apply requires an existing GitHub Project owner and Project number; do not create a new Project without explicit approval.
- The first connector write rejected detailed Bead bodies as too much non-public workspace data; `github-publish-manifest.json` is now public-safe and omits detailed scope, acceptance criteria, changed-file paths, worktree paths, and raw Beads internals.
- Open `mdtrahan` Project #2 exists, but it is untitled, empty, and currently has only GitHub default fields. Do not populate it without explicit user approval.

## Remote Baseline

- `main` is `0` commits ahead of `origin/main`.
- `origin/main` is `0` commits ahead of `main`.
- If the local baseline has commits not yet on GitHub, sync it through the protected-branch PR process before opening Bead branch PRs.

## Publish Phases

1. Create or update GitHub Issues for all visible non-closed Beads from the public-safe `github-publish-manifest.json`. Completed for the current set; closed ORKA-zy2o mirror #24 is retained as history.
2. Add those Issues to the team Project and expose the listed project fields from `project_item_operations`. Prepared; gated on explicit Project/field approval.
3. Sync local `main` to GitHub through the protected-branch PR process. Completed by PR #123.
4. Push selected Bead branches or create tracked review artifacts. Review artifacts are generated for the current 35 candidates.
5. Open draft PRs for active, blocked, QA-ready, or review-worthy Beads. Started with ORKA-7ff6 draft PR #122.

## First Batch

| Bead | Status | Priority | Surface | Branch Or Artifact | Needs PR |
| --- | --- | --- | --- | --- | --- |
| ORKA-7ff6 | in_progress | P1 | draft_pr | bead/ORKA-7ff6-github-visibility-export | yes |
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
| ORKA-0x85 | blocked | P3 | review_packet_pr | governance/bead-reviews/ORKA-0x85.md | yes |

## Safety Rules

- Do not publish raw `.beads` internals.
- Do not use GitHub status to overwrite Beads status in this pass.
- Do not create fake implementation PRs for backlog-only Beads.
- Prefer a small first batch before publishing the entire backlog.
