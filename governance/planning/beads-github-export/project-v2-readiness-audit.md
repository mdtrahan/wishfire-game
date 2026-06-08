# Beads GitHub Project V2 Apply Report

Generated: `2026-06-08T19:25:53Z`

Applied: `2026-06-08T20:15:42Z`

Repository: `mdtrahan/wishfire-game`

Target Project: `https://github.com/users/mdtrahan/projects/2`

Beads remains source of truth. This report records the live GitHub Project V2 visibility board after applying the public-safe Beads mirror.

## Current Project State

- Owner: `mdtrahan`
- Project number: `2`
- Title: `Wishfire Beads`
- Items: `98`
- Existing fields: `23`
- Project field state: GitHub default fields plus Bead visibility fields
- Apply status: complete

## Current Export State

- Publication safety: `public-safe`
- Current non-closed Beads: `98`
- Current open Bead mirror issues: `98`
- Total Bead mirror issues: `99`
- Closed historical mirror issues: `#24` for ORKA-zy2o
- Project item operations applied: `98`
- Review packet artifacts: `35`

## Verification

- `gh project item-list 2 --owner mdtrahan --limit 100 --format json --jq '.items | length'` returned `98`.
- `gh project field-list 2 --owner mdtrahan --format json --jq '.totalCount'` returned `23`.
- `gh issue list --repo mdtrahan/wishfire-game --state open --limit 200 --json number,title --jq '[.[] | select(.title | startswith("ORKA-"))] | length'` returned `98`.

## Bead Fields Applied

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

## Applied Stages

Project #2 was approved as the Beads visibility board during ORKA-7ff6 goal execution.

1. Renamed Project #2 to `Wishfire Beads`.
2. Created the missing Bead fields only:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --skip-project-items --ensure-project-fields --project-owner mdtrahan --project-owner-type user --project-number 2
```

3. Added current open Bead mirror Issues to the confirmed Project:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --project-owner mdtrahan --project-owner-type user --project-number 2
```

## Guardrail

The publisher refuses to insert Project items when the public-safe Bead field schema is missing. The guarded apply check was validated against Project #2 before this apply pass and refused before writing while the Project had only default fields.

Do not use `--allow-missing-project-fields` unless the team explicitly wants a deliberately partial Project view.

## Omitted From GitHub

Detailed Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, and `.beads` internals stay in Beads/local repo context.
