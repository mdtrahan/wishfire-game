# PM Status

Active snapshot only. Historical PM snapshots live in `/agents/archive/pm_status_archive.md` and should not be read during normal startup unless historical investigation is required.

_Last updated: 2026-03-19_

## Completed Beads
- ORKA-3nlw (dirty worktree inventoried into explicit cleanup buckets and commit order)
- ORKA-8w4u (historical PM/dev logs split into `/agents/archive/`; active coordination files reduced to current-state guidance only)
- ORKA-zys (repo-side `.beads` open/in-progress mirrors reconciled to live `bd` state)

## Active Work
- ORKA-47nj (`in_progress`): stop combat when energy is depleted or the party wipes while idle rewards restore energy
- ORKA-t2h3 (`in_progress`): restore encounter enemy randomization breadth
- ORKA-tvn5 (`in_progress`): fix Djinn/Marid line-clears invalidating board playability

## Next Tasks
- Commit governance cleanup separately from runtime/test work; do not mix the `idleFarmRuntime` bug-fix bundle into the coordination patch.
- Rewrite ORKA-6opp before assigning it again; the live bead lacks explicit acceptance/test detail for safe implementation.
- Keep using live `bd` for queue decisions instead of `.beads/`.

## Known Issues
- Unresolved missing-spec debt is still high enough that PM should prefer clarification over claiming new READY beads casually.
- Shell PATH still needs `export PATH="$HOME/.local/bin:$PATH"` before `bd` commands in automation turns.
