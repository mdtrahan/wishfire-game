# Beads GitHub Project V2 Apply Plan

Repository: `mdtrahan/wishfire-game`

Beads remains source of truth. GitHub Project V2 is a visibility board only.

## Prepared Operations

- Project item operations: `99`
- Source manifest: `github-publish-manifest.json`
- Source issues: GitHub Issues `#23` through `#121`
- Public-safe fields: `Bead ID`, `Beads Status`, `Priority`, `Type`, `Parent/Epic`, `Blockers`, `Blocks`, `GitHub Surface`, `Branch`, `Overlap Risk`

## Apply Gate

Project writes are prepared but not applied.

- Local `gh` auth has Project scope.
- No open `mdtrahan` user Project currently exists for this repository.
- Do not create a new Project as part of this export without explicit user approval.
- Apply requires an existing GitHub Project URL or Project number and owner.

## Dry Run

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json
```

## Apply

Run only after the team provides an existing Project owner and Project number:

```sh
python3 tools/publish_beads_github_visibility.py --manifest governance/planning/beads-github-export/github-publish-manifest.json --apply --skip-issues --project-owner mdtrahan --project-owner-type user --project-number <project-number>
```

## Safety

- The publisher refuses to apply a manifest unless `publication_safety` is `public-safe`.
- Project item operations use existing GitHub issue mirrors; they do not publish raw Beads descriptions, acceptance criteria, comments, changed-file paths, worktree paths, or `.beads` internals.
- Missing Project fields are skipped rather than invented by the publisher.
