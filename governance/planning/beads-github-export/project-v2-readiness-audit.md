# Beads GitHub Project V2 Readiness Audit

Generated: `2026-06-08T19:25:53Z`

Repository: `mdtrahan/wishfire-game`

Target Project: `https://github.com/users/mdtrahan/projects/2`

Beads remains source of truth. This audit records whether the current GitHub Project can safely display the Beads visibility mirror. It does not apply Project writes.

## Current Project State

- Owner: `mdtrahan`
- Project number: `2`
- Title: `@mdtrahan's untitled project`
- Items: `0`
- Existing fields: `13`
- Project field state: GitHub default fields only
- Apply status: not approved and not applied

## Current Export State

- Publication safety: `public-safe`
- Current non-closed Beads: `98`
- Current open Bead mirror issues: `98`
- Total Bead mirror issues: `99`
- Closed historical mirror issues: `#24` for ORKA-zy2o
- Project item operations prepared: `98`
- Review packet artifacts: `35`

## Existing Project Fields

| Field | Type | Options |
| --- | --- | --- |
| Title | ProjectV2Field |  |
| Assignees | ProjectV2Field |  |
| Status | ProjectV2SingleSelectField | Todo, In Progress, Done |
| Labels | ProjectV2Field |  |
| Linked pull requests | ProjectV2Field |  |
| Milestone | ProjectV2Field |  |
| Repository | ProjectV2Field |  |
| Reviewers | ProjectV2Field |  |
| Parent issue | ProjectV2Field |  |
| Sub-issues progress | ProjectV2Field |  |
| Created | ProjectV2Field |  |
| Updated | ProjectV2Field |  |
| Closed | ProjectV2Field |  |

## Missing Bead Fields

| Field | Type | Options |
| --- | --- | --- |
| Bead ID | TEXT |  |
| Beads Status | SINGLE_SELECT | open, in_progress, blocked, recovery, deferred |
| Priority | SINGLE_SELECT | P1, P2, P3, P4 |
| Type | SINGLE_SELECT | task, bug, feature, epic, chore |
| Parent/Epic | TEXT |  |
| Blockers | TEXT |  |
| Blocks | TEXT |  |
| GitHub Surface | SINGLE_SELECT | draft_pr, review_packet_pr, issue_project |
| Branch | TEXT |  |
| Overlap Risk | TEXT |  |

## Safe Apply Stages

Run only after explicit approval to use Project #2 as the Beads visibility board.

1. Create the missing Bead fields only:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --skip-project-items --ensure-project-fields --project-owner mdtrahan --project-owner-type user --project-number 2
```

2. Add current open Bead mirror Issues to the confirmed Project:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --project-owner mdtrahan --project-owner-type user --project-number 2
```

## Guardrail

The publisher refuses to insert Project items when the public-safe Bead field schema is missing. The guarded apply check was validated against Project #2 and refused before writing; Project #2 remained at `0` items.

Do not use `--allow-missing-project-fields` unless the team explicitly wants a deliberately partial Project view.

## Omitted From GitHub

Detailed Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, and `.beads` internals stay in Beads/local repo context.
