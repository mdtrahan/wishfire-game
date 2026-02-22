# TASK-011 Execution Plan

## Objective
Execute legacy test-pipeline cleanup for `test-results/` only, using a non-destructive assessment-first workflow, then approved archive/flush with rollback safety.

## Scope Boundaries
- In scope (only):
  - `test-results/` inventory, age/size profiling, and repo reference scan.
  - Classification into keep/archive/delete candidates with explicit rationale.
  - Execute approved archive/flush set only after classification output is reviewed.
  - Produce rollback manifest for every moved/deleted file.
- Explicit exclusions:
  - no runtime/source code edits
  - no gameplay logic changes
  - no governance file deletion/mutation beyond directive artifact updates
  - no deletion outside `test-results/`

## Phase 1
- Perform recursive `test-results/` inventory.
- Capture age/size summary and reference scan against repo usage.
- Produce candidate matrix: keep/archive/delete with reason.

## Phase 2
- Execute approved archive/flush set only.
- Ensure protected files (runtime/governance/tooling referenced) are preserved.
- Record exact file operations in rollback manifest.

## Phase 3
- Validate post-cleanup integrity:
  - expected retained files still present
  - archived/deleted files match approved set
  - rollback manifest is complete and deterministic
- Publish artifacts under:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/`

## Verifiable Success Criteria
- Cleanup is restricted to `test-results/` scope.
- No referenced runtime/tooling files are removed.
- Archive/flush actions match approved candidate matrix.
- Rollback manifest fully reconstructs cleanup actions.

## Lead Phase 1 Review (2026-02-20)
- Status: APPROVED FOR STEP 2 WITH CONSTRAINTS
- Review outcome:
  - Phase 1 artifact package is present and complete:
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/inventory.tsv`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/age-size-summary.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/reference-scan.tsv`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/candidate-matrix.tsv`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/candidate-summary.json`
  - Safety adjustment required:
    - `test-results/.last-run.json` must be protected (referenced in governance artifacts) and is not approved for deletion.
- Step 2 approved action set:
  - Archive approved (15 files):
    - `test-results/task005-phase3/layout1-check/state-0.json`
    - `test-results/task005-phase3/layout1-check/probe.json`
    - `test-results/task005-phase3/layout1-check/startup-layout1.png`
    - `test-results/task005-phase3/layout1-check/post-blue-trigger-layout1.png`
    - `test-results/task005-phase3/layout1-check/runtime-trace.json`
    - `test-results/task005-closeout/layout1-final-after-clamp.png`
    - `test-results/task007/phase1-hero-audit-after-match.json`
    - `test-results/task007/phase1-hero-audit-post.json`
    - `test-results/task007/phase1-start-state.json`
    - `test-results/task007/phase1-audit-after-match.json`
    - `test-results/task007/phase1-audit-post.json`
    - `test-results/task007/phase1-baseline.json`
    - `test-results/task007/phase2-audit-after-match.json`
    - `test-results/task007/phase2-start-state.json`
    - `test-results/task007/phase2-audit-post.json`
  - Delete approved (1 file):
    - `test-results/.DS_Store`
  - Keep protected:
    - `test-results/.last-run.json`

## Lead Closure Gate (2026-02-20)
- Verdict: PASS
- Basis:
  - Step 2 executed exactly as approved:
    - 15 approved files archived to `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/archive/`
    - only `test-results/.DS_Store` deleted
    - protected `test-results/.last-run.json` kept
  - Deterministic operation and rollback evidence is present:
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/approved-archive-list.txt`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/operation-log.tsv`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/rollback-manifest.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/post-cleanup-assertions.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/post-inventory.txt`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/closure-recommendation.json`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011-cleanup/post-cleanup-assertions.json` reports `pass: true`.
