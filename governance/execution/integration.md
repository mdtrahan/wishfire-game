# Integration

## Purpose
- Keep Beads scope, Git isolation, QA PASS, Integration Ready, merge, and cleanup in one lifecycle contract.
- Prevent implementation lanes, stale branches, and merge candidates from becoming ambiguous.
- Treat Beads as workflow metadata during repository audits; current Git state decides merge readiness.

## Lane Rules
- One implementation bead gets one bead-scoped branch/worktree unless a minor exemption applies.
- Include the bead id in branch and worktree names.
- Create or select the bead, create the branch/worktree, then mark the bead `in_progress`.
- Never mix multiple implementation beads in one worktree.
- Do not block new bead work solely because many bead worktrees exist; assess ownership, overlap, and repo-state risk directly.
- Make periodic commits for historical safety when work is long-lived.
- Preserve unrelated dirty files; do not stage, reset, clean, or remove them.

## Branch Disposition Gate
Every branch, worktree, or PR found during audit must receive an explicit owner-facing disposition. Do not leave branches in an ambiguous "maybe merge later" state.

Allowed dispositions:
- `backlog` - preserve idea, not active now
- `needs-spec` - intent or acceptance criteria unclear
- `active` - current implementation lane
- `complete` - QA passed and integration is intended
- `closed` - merged, superseded, or intentionally ended
- `legacy` - preserved for reference, not merge-bound
- `deprecated` - obsolete due to newer product or architecture direction
- `delete-candidate` - safe to remove only after owner approval
- `needs-owner-decision` - Codex cannot infer disposition

Rules:
- No branch is `active` unless it has a live bead and current owner intent.
- No branch is `complete` unless it has QA PASS or explicit owner acceptance.
- No branch may be merged unless it is `complete` and has Integration Ready evidence.
- If merge readiness is unclear, classify it as `needs-spec`, `legacy`, `deprecated`, or `delete-candidate`; do not keep it floating.
- If Codex cannot infer disposition, mark `needs-owner-decision` and ask for one decision.

Required audit fields: Branch, Bead, Current disposition, Recommended disposition, Merge intent, Reason, Blocking issue, Next action, Owner decision required.

## Gate Model
Every bead moves through these gates in order:

1. Development Complete
2. QA PASS
3. Integration Ready
4. Merge
5. Cleanup

QA PASS validates the feature. Integration Ready validates merge readiness against current `main`.

## Development Complete
Development Complete means acceptance criteria are implemented, scoped work is complete, and no known blocking defects remain. Do not request QA PASS while implementation scope is still open.

## QA PASS
Required evidence:
- human QA complete when the feature needs human judgment
- acceptance criteria verified
- automated tests passing
- feature behavior verified
- no known regressions
- ready to preserve

QA PASS does not certify merge readiness. A QA PASS branch that has not passed Integration Ready is preserved work, not mergeable work.

## Integration Ready
Run Integration Ready immediately after QA PASS and again before merge if `main` has moved.

Required evidence:
- branch and worktree clean, except explicitly documented preserved artifacts
- latest `main` identified by SHA
- branch builds against latest `main`
- merge or rebase check succeeds without unexpected non-metadata conflicts
- validation is compared against the current `main` baseline
- no unrelated commits
- branch scope matches bead scope
- dependency beads are merged or explicitly ordered
- smoke tests pass after integration with current `main`, except documented inherited baseline failures
- merge source is unambiguous, such as a named branch or PR

Before evaluating a candidate branch, run the complete validation suite on current `main` and record every existing failure as the `Baseline Failure` set. A branch fails Integration Ready only when it introduces a `New Regression`, worsens an existing baseline failure, breaks the build, fails feature-specific validation, introduces non-metadata conflicts, or contains unrelated changes.

A branch does not fail solely because it inherits unrelated failures already present on `main`.

## States And Conflicts
Every candidate branch must end in exactly one state:

| State | Meaning |
| --- | --- |
| `Already Integrated` | Branch has no unique patches relative to `main`. |
| `Integration Ready` | No new regressions, no merge conflicts, and branch scope is clean. |
| `Mechanical Conflict` | Git cannot merge automatically, but there is no evidence of overlapping feature ownership or behavioral disagreement. |
| `Semantic Conflict` | Multiple branches modify the same feature or system in incompatible ways. Owner review is required before integration. |
| `New Regression` | Introduces one or more failures beyond the established `main` baseline. |
| `Active Development` | Dirty worktree or incomplete implementation. |
| `Dependency Blocked` | Waiting on another branch to merge first. |
| `Unknown` | Insufficient evidence. |

Do not collapse merge conflicts, dependency ordering, or inherited baseline failures into generic validation failure. When more than one condition is present, use the first required intervention: active dirty work, new regressions, dependency ordering, semantic conflicts, then mechanical conflicts.

Metadata-only conflicts in `.beads/interactions.jsonl` or `ai-memory/insights.md` do not create a `Semantic Conflict`, do not prevent `Integration Ready`, and should be resolved immediately before or during merge using current repository state.

Report conflict class separately from state: `none`, `Metadata Conflict`, `Mechanical Conflict`, or `Semantic Conflict`.

## Merge And Cleanup
- Only Integration Ready beads may be merged.
- Use `$bead-worktree-lifecycle` for QA PASS cleanup, safe merge, worktree removal, and merged branch deletion.
- Never merge without validation, current Integration Ready evidence, and a rollback checkpoint.
- Never remove a worktree unless it is clean and its branch has been merged.
- Never delete a branch unless its tip is reachable from `main`.
- After merge, verify the feature exists on `main`, branch containment, clean repo state, smoke tests, and workflow metadata or audit record.

## Repository Audits
Every repository audit must identify branches that are QA PASS, not Integration Ready, and drifting from current `main`. Report these separately as `Integration Drift`.

Audit buckets: `Ready to Merge`, `Metadata Conflicts`, `Mechanical Conflicts`, `Semantic Conflicts`, `Needs Bug Fixes`, `Active Development`, `Already Integrated`, `Unknown`.

Report Integration Debt metrics: Integration Ready, Metadata Conflicts, Mechanical Conflicts, Semantic Conflicts, Needs Bug Fixes, Active Development, Already Integrated, Total Integration Debt, oldest Integration Ready branch, oldest Semantic Conflict, and average age of Integration Ready branches.

Count `Metadata Conflict` branches inside Integration Ready, not as a separate additive debt bucket. Default Total Integration Debt is:

```text
Integration Ready + Mechanical Conflicts + Semantic Conflicts + Needs Bug Fixes
```

Active Development and Unknown branches are reported separately because they are not yet completed integration candidates.

Do not rewrite historical bead state during an audit. Audit reports may classify current branch reality even when Beads, GitHub Issues, PR draft status, or old notes disagree.

## Evidence Commands
Use focused commands and record the results, not raw logs:

- `git status --short --branch`
- `git rev-parse main origin/main HEAD`
- `git rev-list --left-right --count main...<branch>`
- `git cherry -v main <branch>`
- `git diff --name-status main...<branch>`
- `git merge-tree main <branch>` when available, or a disposable integration worktree
- repo build command required by the touched files
- repo smoke tests required by the touched files
- complete validation suite on `main` to capture `Baseline Failure`
- complete validation suite on the candidate branch to identify `New Regression`

Prefer a disposable integration worktree for risky or conflict-prone branches. Do not perform the real merge as the Integration Ready check.

## Validation Classification
- `Baseline Failure`: a failing validation item already present on current `main` before the candidate branch is evaluated.
- `New Regression`: a failure that appears on the candidate branch but is not present in the current `main` baseline, or an existing baseline failure that becomes broader, more severe, or blocks feature-specific validation.

Inherited `Baseline Failure` items are repository debt. They are not by themselves branch blockers.
