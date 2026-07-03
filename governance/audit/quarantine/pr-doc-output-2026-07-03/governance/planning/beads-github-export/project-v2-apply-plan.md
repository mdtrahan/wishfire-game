# Beads GitHub Project V2 Apply Plan

Repository: `mdtrahan/wishfire-game`

Beads remains source of truth. GitHub Project V2 is a visibility board only.

## Prepared Operations

- Project item operations: `98`
- Source manifest: `github-publish-manifest.json`
- Source issues: GitHub Issues `#23` through `#121`
- Public-safe fields: `Bead ID`, `Beads Status`, `Priority`, `Type`, `Parent/Epic`, `Blockers`, `Blocks`, `GitHub Surface`, `Branch`, `Overlap Risk`

## Apply Result

Project writes are applied to `https://github.com/users/mdtrahan/projects/2`.

- Local `gh` auth has Project scope.
- Open `mdtrahan` Project #2 was renamed to `Wishfire Beads`.
- The board contains `98` current non-closed Bead mirror issues.
- The board contains `23` fields: GitHub defaults plus the `10` public-safe Bead visibility fields.
- Current apply evidence is recorded in `project-v2-readiness-audit.md`.

## Dry Run

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json
```

Audit Project #2 field readiness without writing:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --skip-issues --project-owner mdtrahan --project-owner-type user --project-number 2
```

## Apply Stages

These were the applied stages for Project #2:

Create missing Bead fields only:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --skip-project-items --ensure-project-fields --project-owner mdtrahan --project-owner-type user --project-number 2
```

Add current mirror Issues to the confirmed Project:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --project-owner mdtrahan --project-owner-type user --project-number 2
```

## Safety

- The publisher refuses to apply a manifest unless `publication_safety` is `public-safe`.
- Project item operations use existing GitHub issue mirrors; they do not publish raw Beads descriptions, acceptance criteria, comments, changed-file paths, worktree paths, or `.beads` internals.
- Project item insertion refuses to proceed when public-safe Bead fields are missing, unless `--allow-missing-project-fields` is explicitly passed for a deliberately partial board.
