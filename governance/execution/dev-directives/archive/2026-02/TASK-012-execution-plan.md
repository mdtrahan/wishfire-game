# TASK-012 Execution Plan

## Objective
Publish a deterministic asset-prune manifest from current audit state, including keep/delete rationale and protected-file constraints.

## Scope Boundaries
- In scope (only):
  - Use current asset audit outputs as source of truth.
  - Produce manifest with keep/archive/delete rationale.
  - Mark protected files that cannot be deleted.
- Explicit exclusions:
  - no runtime/gameplay logic edits
  - no non-asset file deletions
  - no governance board mutation

## Phase 1
- Ingest current asset audit artifacts.
- Produce manifest with explicit rationale per file.

## Phase 2
- Review manifest for protected-file safety.
- Finalize approved deletion set (only approved files).

## Phase 3
- Publish finalized manifest artifacts for handoff to TASK-013.

## Verifiable Success Criteria
- Manifest exists and is deterministic.
- Every listed file has keep/delete rationale.
- Protected files are explicitly excluded from delete set.
