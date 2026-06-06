# Fallow Technical Debt Backlog

Status: backlog only. No cleanup, refactor, deletion, or auto-fix is approved by this document.

Source evidence:
- Raw Fallow report backup: `governance/audit/reports/fallow-raw-report-2026-06-04.md`
- Original local generated report: `reports/➜  codex-orka git:(main) ✗ npx fallow.md`
- Observed scanner version in report: `fallow@2.87.0`

## Purpose

The Fallow report claims that most of the repo is dead or duplicated:

- Dead files: 97.3% (`320 of 329`)
- Dead exports: 90.3% (`970 of 1074`)
- Duplicates: 450 clone groups
- Unresolved imports: 1
- Refactoring targets: 106

Those numbers are too large to act on directly. This backlog preserves the cleanup strategy so the work can be decomposed safely later. The report is treated as evidence requiring triage, not as authority to delete or rewrite code.

## Non-Negotiable Safety Boundary

Do not perform any direct cleanup from the raw report.

Forbidden until a specific bead, rollback point, and validation plan exist:

- deleting files
- running `fallow fix --yes`
- removing exports
- deduplicating mirror directories
- refactoring `web-runner/app.js`
- refactoring `Scripts/functionBank.js`
- refactoring `web-runner/modules/functionBank.js`
- refactoring `web-runner/systems/simulationCoreShadow.js`
- suppressing whole directories without written justification

Every future work packet must identify the exact report slice, exact paths, rollback checkpoint, validation commands, and stop conditions before implementation begins.

## Required Evidence Archive

Before future implementation starts, create a dated archive under `/private/tmp/codex-orka-fallow-cleanup-YYYYMMDD/` containing:

- raw Fallow markdown report
- Fallow JSON outputs for `list`, `config`, `dead-code`, `dupes`, `health`, and `fix --dry-run`
- `git status --short --branch`
- `git branch --all --verbose`
- `git worktree list --porcelain`
- `bd ready`
- `bd list --status in_progress --limit 0`
- manifest mapping each proposed bead to report lines and generated JSON issue ids

The archive path must be recorded in the related bead notes before edits begin.

## Decomposition Backlog

### 1. Fallow Credibility Bead

Goal: prove whether Fallow is modeling the repo correctly.

Required commands:

```bash
npx fallow@2.87.0 list --entry-points --format json
npx fallow@2.87.0 list --plugins --format json
npx fallow@2.87.0 list --workspaces --format json
npx fallow@2.87.0 config --path
npx fallow@2.87.0 dead-code --unresolved-imports --format json --summary
```

Exit criteria:

- Entry points are explicitly understood.
- Missing browser/runtime/test entry points are identified.
- The `97.3% dead files` claim is classified as credible, false-positive-likely, or blocked.
- No deletion is performed.

### 2. Repo Lane Safety Bead

Goal: reduce process risk before opening more cleanup lanes.

Required inventory:

```bash
git status --short --branch
git worktree list --porcelain
bd list --status in_progress --limit 0
```

Exit criteria:

- Active worktrees are classified one by one as active, merged/reachable, archival unique, blocked, or unknown.
- Any cleanup of worktrees happens one bead at a time using the repo worktree lifecycle process.
- No runtime code is changed.

### 3. Unresolved Import Bead

Goal: address the only crisp dependency defect in the raw report.

Report finding:

- `Scripts/functionBank.js`
- unresolved import at line 25: `../src/core/initiativeGuards.mjs`

Required prework:

```bash
npx fallow@2.87.0 dead-code --unresolved-imports --format json --summary
npx fallow@2.87.0 dead-code --trace-file Scripts/functionBank.js
```

Exit criteria:

- The missing import is either repaired or documented as scanner/config false positive.
- Focused module import validation passes.
- No function-bank mirror dedupe is attempted.

### 4. Dead-Code Candidate Triage Bead

Goal: turn the massive unused-file/export lists into small reviewed candidate packets.

Required commands:

```bash
npx fallow@2.87.0 dead-code --unused-files --format json
npx fallow@2.87.0 dead-code --unused-exports --format json
npx fallow@2.87.0 dead-code --trace-file <candidate-path>
```

Every candidate must be classified as one of:

- `delete`
- `keep`
- `configure`
- `trace-needed`
- `blocked`

Exit criteria:

- No candidate under `Scripts/`, `src/`, `web-runner/`, `tests/`, or `tools/` is deleted without trace evidence and focused validation.
- The candidate list is split into multiple implementation beads.

### 5. Mirror Policy Bead

Goal: decide whether mirrored trees are generated, source-owned, or intentionally duplicated.

Report families:

- `Scripts/` and `web-runner/modules/`
- `src/core/` and `web-runner/src/core/`

Required command:

```bash
npx fallow@2.87.0 dupes --format json
```

Exit criteria:

- One source-of-truth policy exists for each mirror family.
- Any future dedupe bead has one ownership lane and one validation surface.
- No mirror removal happens in this policy bead.

### 6. Health Hotspot Beads

Goal: convert health findings into separate refactor backlogs.

Required command:

```bash
npx fallow@2.87.0 health --format json
```

Known hotspot lanes from the raw report:

- `web-runner/app.js`
- `web-runner/systems/simulationCoreShadow.js`
- `Scripts/functionBank.js`
- `web-runner/modules/functionBank.js`
- `web-runner/systems/renderRuntime.js`

Exit criteria:

- Each hotspot has a separate bead.
- Each bead has a rollback point, touched-path list, focused test plan, and browser QA requirement if runtime behavior changes.

### 7. Fallow Guardrail Bead

Goal: prevent new debt without pretending legacy debt is already fixed.

Required commands:

```bash
npx fallow@2.87.0 fix --dry-run --format json
npx fallow@2.87.0 audit --base main --gate new-only --format json
```

Exit criteria:

- `fix --dry-run` output is reviewed candidate by candidate.
- Existing legacy debt is baselined.
- Future changes are gated with `audit --gate new-only`.
- `fix --yes` remains forbidden unless a future bead explicitly approves it with rollback.

## Rollback Requirements

Before any future mutation:

- Create a bead-scoped worktree.
- Confirm touched paths are clean or explicitly owned.
- Create a rollback branch or tag from the exact starting commit.
- Record the rollback reference and evidence archive path in bead notes.
- Run `fix --dry-run` before any Fallow automated edit.

After each mutation:

- Run focused tests first.
- Run broader tests only after focused validation passes.
- Use Browser QA for `web-runner` behavior changes.
- Stop on any unexplained validation failure.

## Review Requirements

Each future cleanup bead needs two adversarial reviews:

- Deletion/refactor advocate: argues why the candidate is safe and valuable.
- Preservation/risk advocate: argues why the candidate may be live, generated, mirrored, or under-modeled.

No candidate proceeds unless both reviews are attached to the bead or summarized in the handoff.

## Current Decision

This document and the raw report backup are the only approved repo changes from the June 2026 Fallow planning discussion. The nuclear cleanup itself is not approved.
