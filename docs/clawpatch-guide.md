# Clawpatch Guide

Source:
- https://clawpatch.ai/
- https://github.com/openclaw/clawpatch
- https://github.com/openclaw/clawpatch/tree/main/docs

## What It Is
Clawpatch is an automated code-review CLI. It maps a repository into semantic feature slices, asks a local AI provider to review bounded feature context, records findings in `.clawpatch/`, and can run one explicit fix attempt for a chosen finding.

Use it here as review input, not as the workflow authority. In this repo, Beads still controls scope, ownership, branch/worktree flow, validation, and completion.

## Fit For This Repo
Good uses:
- Find bug, security, performance, test-gap, docs-gap, and maintainability findings across mapped feature slices.
- Generate a report that can be converted into Beads.
- Re-check a finding after manual work.
- Try a single explicit fix only inside a bead-scoped implementation lane.

Avoid:
- Running `clawpatch fix` in a dirty or shared workspace.
- Treating Clawpatch findings as permission to implement without a Beads item.
- Auto-accepting Clawpatch patches without normal repo validation.
- Committing `.clawpatch/` output by accident before deciding whether it belongs in version control.

## Install
```bash
npm install -g clawpatch
```

Alternative package managers and source install are supported upstream:
```bash
pnpm add -g clawpatch

git clone https://github.com/openclaw/clawpatch.git
cd clawpatch
pnpm install
pnpm run build
pnpm link --global
```

The default provider uses the local Codex CLI:
```bash
codex --version
clawpatch doctor
```

## First Run In Codex-Orka
Run from the repo root:
```bash
cd /Users/Mace/Codex-Orka
git status --short
bd ready
bd list
```

Initialize Clawpatch state:
```bash
clawpatch init
clawpatch status
```

Map reviewable features:
```bash
clawpatch map --dry-run
clawpatch map
clawpatch status --json
```

Review a small batch first:
```bash
clawpatch review --limit 3 --jobs 3
clawpatch report
```

For a larger pass:
```bash
clawpatch review --limit 999 --jobs 4
clawpatch report -o .clawpatch/reports/codex-orka-review.md
```

## Finding Triage
List open findings:
```bash
clawpatch report --status open
clawpatch next
```

Inspect one finding:
```bash
clawpatch show --finding <finding-id>
```

If the finding should become implementation work, create or select a Beads item before editing. Keep the Clawpatch finding id in the bead notes so the audit trail stays connected.

Mark findings after human review:
```bash
clawpatch triage --finding <finding-id> --status false-positive --note "covered by existing test"
clawpatch triage --finding <finding-id> --status wont-fix --note "not product-relevant"
```

## Fix Workflow
Only use this inside a clean bead-scoped branch/worktree or after explicit user override:
```bash
git status --short
clawpatch fix --finding <finding-id>
git diff
npm test
clawpatch revalidate --finding <finding-id>
```

Important behavior:
- `fix` is finding-scoped and explicit.
- It may edit the working tree.
- It runs configured validation commands in this order when present: format, typecheck, lint, test.
- It records patch attempts under `.clawpatch/`.
- It does not commit, push, open a PR, or land changes.
- A passing patch attempt is still not a repo-level QA pass.

## Common Commands
```bash
clawpatch init                         # Create .clawpatch config and project metadata
clawpatch init --force                 # Re-detect and replace init output
clawpatch map                          # Build semantic feature records
clawpatch map --dry-run                # Preview mapping without writing
clawpatch status                       # Show project, feature, finding, and dirty state
clawpatch status --json                # Machine-readable state
clawpatch review --limit 10            # Review pending features
clawpatch review --limit 12 --jobs 4   # Review with parallel workers
clawpatch review --feature <id>        # Review one mapped feature
clawpatch review --since origin/main   # Review features touched by branch diff
clawpatch review --project web         # Scope by mapped project
clawpatch report                       # Print Markdown report
clawpatch report --severity high       # Filter report
clawpatch report --category security   # Filter by category
clawpatch report --status open         # Filter by finding status
clawpatch report -o report.md          # Write report to file
clawpatch next                         # Show next actionable finding
clawpatch show --finding <id>          # Show one finding with evidence
clawpatch triage --finding <id> --status <status> --note "<note>"
clawpatch fix --finding <id>           # Run one explicit fix attempt
clawpatch revalidate --finding <id>    # Re-check one finding
clawpatch revalidate --all             # Re-check filtered open findings
clawpatch doctor                       # Check provider setup
clawpatch clean-locks                  # Clear stale feature locks
```

Useful global flags:
```bash
--root <path>
--state-dir <path>
--config <path>
--json
--plain
--limit <n>
--jobs <n>
--feature <id>
--project <name>
--finding <id>
--status <status>
--severity <level>
--provider <name>
--model <model>
--output <path>
-o <path>
--dry-run
--force
```

## Configuration Notes
`clawpatch init` writes `.clawpatch/config.json`. The important repo-local fields are:
```json
{
  "commands": {
    "format": null,
    "lint": null,
    "typecheck": null,
    "test": null
  },
  "git": {
    "requireCleanWorktreeForFix": true,
    "commit": false,
    "openPr": false
  }
}
```

For Codex-Orka, prefer a conservative validation setup:
```json
{
  "commands": {
    "test": "npm test"
  }
}
```

Do not add broad format/lint commands unless the repo already uses them reliably; noisy mechanical rewrites make Clawpatch findings harder to triage.

## Safety Checklist
Before `review`:
- Confirm the repo root with `pwd`.
- Run `git status --short`.
- Run `bd ready` and `bd list`.
- Decide whether `.clawpatch/` should be local-only or committed.

Before `fix`:
- Confirm a selected bead.
- Use a bead-scoped branch/worktree unless explicitly waived.
- Confirm `git status --short` is clean except intended `.clawpatch/` state.
- Fix one finding at a time.

After `fix`:
- Inspect `git diff`.
- Run focused validation.
- Revalidate the finding.
- Convert remaining work into Beads instead of expanding scope inside the same pass.

