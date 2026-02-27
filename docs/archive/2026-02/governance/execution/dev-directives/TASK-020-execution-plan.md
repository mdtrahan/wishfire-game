# Archived (2026-02-23)

Reason: Historical archive

Original path: `governance/execution/dev-directives/TASK-020-execution-plan.md`

---

# TASK-020 Execution Plan

## Objective
Ensure initiative text (`Enemy Ambush` / `Hero Surprise`) fades once and does not reappear for the rest of the same combat session.

## Scope Boundaries
- In scope only:
  - initiative text show/fade lifecycle wiring
  - in-session no-resurrection guard after fade completion
  - deterministic validation artifacts for fade permanence
- Out of scope:
  - no power-amp lifecycle edits
  - no story-card/yellow-match output edits
  - no combat balance/turn-order refactors

## Phase 1
- Trace initiative text path from initial show trigger to fade completion.
- Identify any re-trigger/resurrection path during same combat session.

## Phase 2
- Apply minimal lifecycle guard:
  - initiative text may display once per combat session
  - after fade completion, suppress for remainder of session
  - allow fresh display only on new combat session start

## Phase 3
- Publish deterministic evidence proving once-only fade behavior per session.

## Required Validation Artifacts
- `task020-initiative-lifecycle-path.json`
- `task020-initiative-fade-trace.json`
- `task020-no-resurrection-assertions.json`
- `task020-session-reset-guard.json`
- `task020-closure-recommendation.json` (PASS/FAIL)

## Verifiable Success Criteria
- Initiative text appears once, fades out, and does not reappear in same combat session.
- New combat session allows one fresh initiative display.

## Lead Closure Verdict
- Verdict: PASS
- Date: 2026-02-22
- Authority: Lead (QA PASS)
- Notes:
  - QA confirms initiative fade-out does not refresh in-session.
