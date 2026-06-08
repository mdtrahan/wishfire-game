# Beads to GitHub Export Safety Checklist

Use this before creating or updating GitHub Issues, Project items, or draft PRs from Beads.

## Before Export
- Run `bd list --json --limit 0` from the target repo.
- Confirm the Bead export lane is active and scoped.
- Confirm local Git status and preserve unrelated dirty files.
- Confirm no runtime/gameplay files will be edited by the export pass.

## Data Rules
- Public GitHub issue and PR bodies may export Bead ID, title, status, priority, type, labels, parent, blockers, blocks, GitHub surface, branch presence, and branch-overlap signals.
- Do not export Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, `.beads` credentials, backup files, database internals, or private local metadata to GitHub.
- Redact local user paths before publishing text to GitHub.
- Keep Beads as source of truth for status.

## GitHub Surface Rules
- Use one GitHub Issue or Project item per visible non-closed Bead.
- Apply Project V2 operations only from a `publication_safety=public-safe` manifest.
- Use draft PRs for active, blocked, QA-ready, or review-worthy Beads.
- Use a tracked review artifact when a Bead needs review but has no code branch.
- Generate tracked review artifacts only from the public-safe mapping/manifest.
- Do not create fake implementation PRs for plain backlog items.

## Batch Rules
- Publish a small first batch before mirroring the full backlog.
- Prioritize in-progress Beads, local branches with commits ahead of main, blocked P1 Beads, and recovery lanes.
- Check branch file overlap before requesting human review.
- Include the Bead ID in every GitHub title.

## After Export
- Record the GitHub issue/project/PR mapping.
- Confirm every active Bead is visible in GitHub.
- Confirm Project item count matches the visible non-closed Bead count when Project V2 apply is available.
- Confirm review packet artifact count matches `requires_review_artifact` draft PR operations.
- Confirm backlog-only Beads are visible without PR noise.
- Confirm no closed Beads were exported unless explicitly requested.
