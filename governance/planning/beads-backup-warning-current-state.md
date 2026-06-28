# Beads Backup Warning Current State

Bead: `ORKA-yib8.11`

## Scope

This document records the current Beads backup/export warning after `ORKA-hzz4` closed. It does not delete `.beads` backups, untrack credentials, run broad fixer commands, change backup destinations, or change runtime code.

## Current Result

Representative Beads reads still complete successfully, but several emit the same auto-backup warning afterward:

```text
Warning: auto-backup failed: sync to backup: sync backup backup_export: Error 1105 (HY000): strconv.ParseUint: parsing "305\n": invalid syntax
```

That means the tracker read/write path is usable, but backup/export health is not proven. Treat Beads mutations as live, but do not claim backup safety until this warning is repaired or explicitly accepted by the owner.

## Evidence

| Command | Result | Warning |
|---|---|---|
| `bd info --json` | Reported Dolt mode/direct info and `Issue Count: 530`. The CLI emitted human-readable output despite the flag. | Present: `ParseUint` warning. |
| `bd show ORKA-hzz4` | Shows `ORKA-hzz4` closed with a close reason claiming the ParseUint warning was fixed. | Present: `ParseUint` warning still appears. |
| `bd list --limit 5` | Returned 5 issues normally. | Present: `ParseUint` warning. |
| `bd doctor` | Exited non-zero with 54 passed, 18 warnings, 1 error. | The doctor output itself did not print the auto-backup warning in this run. |

`bd doctor` also reported:

- Beads CLI `0.63.3` while latest reported by the tool is `1.0.4`.
- missing project identity in metadata.
- `beads.role` not configured.
- one pending Dolt comments change after this Bead status update.
- 37 tracked Beads runtime/sensitive files, including the credential key and backup files.
- outdated Beads and project ignore patterns.

Those doctor findings are relevant but not safe to fix blindly in this bead.

## Local Config Observed

`metadata.json` currently contains:

```json
{
  "database": "dolt",
  "jsonl_export": "interactions.jsonl",
  "backend": "dolt",
  "dolt_mode": "server",
  "dolt_server_port": 3306,
  "dolt_database": "beads_ORKA"
}
```

The `ORKA-hzz4` close reason says it fixed a tracked metadata `jsonl_export` mismatch and that commands no longer emitted the ParseUint warning. Current evidence disproves the second claim.

## Classification

| Finding | Classification | Rationale |
|---|---|---|
| Beads commands complete but warn after backup sync | Unresolved backup/export issue | The command result is usable, but backup success is not proven. |
| `ORKA-hzz4` says warning was fixed | Stale closeout evidence | Current `bd show ORKA-hzz4` itself emits the warning. |
| `bd doctor` tracked sensitive/runtime file error | Separate owner-approved cleanup | Fixing it may untrack credential/backup files and alter ignore policy. That is outside this bead. |
| CLI version warning | Possible contributing factor, not proven cause | Upgrading Beads is global tooling work and needs owner approval if it changes behavior. |
| Metadata `jsonl_export=interactions.jsonl` | Suspicious but not enough for a blind edit | Prior bead likely touched this field; current warning still points at `backup_export` parsing. |

## Safe Repair Path

Open a separate owner-approved Beads infrastructure repair lane before mutating `.beads` backup state:

1. Preserve a rollback copy of `.beads` outside the repo and record the restore command.
2. Capture `bd doctor`, `bd info`, `bd show ORKA-hzz4`, and `bd list --limit 5` before repair.
3. Decide explicitly whether Beads CLI upgrade is allowed.
4. Decide explicitly whether tracked credential/backup files may be untracked and ignore rules updated.
5. Only then run targeted fixer commands or manual config edits.
6. Repeat the same representative Beads reads.
7. Commit only reviewed metadata/ignore changes, never raw credential material or backup archive churn.

## Stop Conditions

Stop before repair if:

- the proposed fix deletes backup archives;
- the proposed fix untracks credential or backup files without owner approval;
- the proposed fix requires `bd doctor --fix` with unclear side effects;
- backup state cannot be restored from a documented copy;
- Beads reads stop returning valid issue data.

## Validation

Validation for this documentation PR:

- `bd info --json`
- `bd show ORKA-hzz4`
- `bd list --limit 5`
- `bd doctor`
- read-only metadata/config inspection
- `git diff --check`
