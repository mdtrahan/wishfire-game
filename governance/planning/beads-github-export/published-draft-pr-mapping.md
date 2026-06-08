# Beads GitHub Published Draft PR Mapping

Published: `2026-06-08T16:01:01Z`

Repository: `mdtrahan/wishfire-game`

Beads remains source of truth. These draft PRs are public-safe review surfaces; they do not replace Beads status or Beads implementation flow.

## Summary

- Published draft PR review surfaces: `1`
- First published draft PR: [#122](https://github.com/mdtrahan/wishfire-game/pull/122)
- Public-safe review packet artifacts: `32`
- GitHub Project field insertion is still gated because no Project V2 write tool is available in this session and local `gh` auth is invalid.
- Other Bead-lane draft PRs remain gated until their branches or review artifacts are ready and the local `main` baseline is aligned with GitHub `main`.

## Published Draft PRs

| PR | Bead | Linked Issue | Branch | Base | State | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| [#122](https://github.com/mdtrahan/wishfire-game/pull/122) | ORKA-7ff6 | [#23](https://github.com/mdtrahan/wishfire-game/issues/23) | `bead/ORKA-7ff6-github-visibility-export-clean-pr` | `main` | draft | Clean branch replayed only the export-flow commits onto `origin/main`, avoiding unrelated local-only gameplay commits. |

## Safety

- Published PR body omits Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, and `.beads` internals.
- This mapping records GitHub visibility only; Beads remains the source of truth for ownership, status, scope, rollback, and implementation flow.
