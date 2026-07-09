# Integration Ready Gate

## Purpose
- Prevent beads from becoming feature-complete but unmergeable.
- Keep QA PASS focused on feature quality.
- Require a separate Integration Ready gate before merge.
- Treat Beads as workflow metadata during repository audits; current Git state decides merge readiness.

## Gate Model
Every bead moves through these gates in order:

1. Development Complete
2. QA PASS
3. Integration Ready
4. Merge

QA PASS preserves the feature. The Integration Ready audit classifies the branch's repository state so consolidation work can see the real blocker.

## 1. Development Complete
Development Complete means:
- acceptance criteria are implemented
- scoped work is complete
- no known blocking defects remain

Do not request QA PASS while implementation scope is still open.

## 2. QA PASS
QA PASS validates the feature itself.

Required evidence:
- human QA complete when the feature needs human judgment
- acceptance criteria verified
- automated tests passing
- feature behavior verified
- no known regressions
- ready to preserve

QA PASS does not certify merge readiness. A QA PASS branch that has not passed Integration Ready is preserved work, not mergeable work.

## 3. Integration Ready
Run Integration Ready immediately after QA PASS and again before merge if `main` has moved.

Required evidence:
- branch clean
- worktree clean, except explicitly documented preserved artifacts
- latest `main` identified by SHA
- branch builds against latest `main`
- merge or rebase check succeeds without unexpected non-metadata conflicts
- validation is compared against the current `main` baseline
- no unrelated commits
- branch scope matches bead scope
- dependency beads are already merged or explicitly ordered
- smoke tests pass after integration with current `main`, except for documented inherited baseline failures
- merge source is unambiguous, such as a named branch or PR

Before evaluating a candidate branch, run the complete validation suite on current `main` and record every existing failure as the `Baseline Failure` set. A branch fails Integration Ready only when it introduces a `New Regression`, worsens an existing baseline failure, breaks the build, fails its own feature-specific validation, introduces merge conflicts, or contains unrelated changes.

A branch does not fail solely because it inherits unrelated failures that already exist on `main`.

Every candidate branch must end in exactly one state:

| State | Meaning |
| --- | --- |
| `Already Integrated` | Branch has no unique patches relative to `main`. |
| `Integration Ready` | No new regressions, no merge conflicts, and branch scope is clean. |
| `Mechanical Conflict` | Git cannot merge automatically, but there is no evidence of overlapping feature ownership or behavioral disagreement. Expected manual merge only. |
| `Semantic Conflict` | Multiple branches modify the same feature or system in incompatible ways. Owner review is required before integration. |
| `New Regression` | Introduces one or more failures beyond the established `main` baseline. |
| `Active Development` | Dirty worktree or incomplete implementation. |
| `Dependency Blocked` | Waiting on another branch to merge first. |
| `Unknown` | Insufficient evidence. |

Do not collapse merge conflicts, dependency ordering, or inherited baseline failures into generic validation failure. When conflicts exist, classify the conflict type instead of treating all conflicts equally. `Mechanical Conflict` branches remain strong integration candidates; `Semantic Conflict` branches need owner review before integration.

When more than one condition is present, use the state that identifies the first required intervention: active dirty work first, then new regressions, then dependency ordering, then semantic conflicts, then mechanical conflicts. Use `Integration Ready` only when no intervention remains.

## Metadata Conflict Policy
Some repository files are workflow metadata rather than feature implementation. Current metadata conflict files:

- `.beads/interactions.jsonl`
- `ai-memory/insights.md`

Metadata-only conflicts are expected. They do not create a `Semantic Conflict`, do not prevent `Integration Ready`, and should be resolved immediately before or during merge using the current repository state.

Only conflicts affecting implementation files, assets, tests, runtime behavior, or feature ownership participate in Integration Ready state classification.

Report conflict class separately from state:

- `Metadata Conflict`: conflicts only in metadata files.
- `Mechanical Conflict`: routine Git merge required for implementation files with no behavioral disagreement.
- `Semantic Conflict`: competing behavior or overlapping ownership requires design review.

## 4. Merge
Only Integration Ready beads may be merged.

After merge, verify:
- the feature exists on `main`
- the branch is fully contained in `main`
- repository is clean
- smoke tests pass on `main`
- integration is recorded in the chosen workflow metadata or audit report

## Repository Audit Rule
Every repository audit must identify branches that are:
- QA PASS
- not Integration Ready
- drifting from current `main`

Report these separately as `Integration Drift`.

For each Integration Drift item include:
- bead or workflow ID
- branch
- worktree, if any
- state
- drift from current `main`
- missing Integration Ready evidence
- exact blocker
- recommended next action
- whether the blocker is a `Baseline Failure` or `New Regression`

At the end of every repository audit, include these buckets:

- `Ready to Merge`: branches that could be merged immediately with owner approval.
- `Metadata Conflicts`: Integration Ready branches with metadata-only conflicts to resolve during merge.
- `Mechanical Conflicts`: technically complete branches blocked only by routine Git conflict resolution.
- `Semantic Conflicts`: branches blocked by overlapping feature ownership or behavioral disagreement.
- `Needs Bug Fixes`: branches introducing new regressions.
- `Active Development`: branches with dirty worktrees or incomplete implementation.
- `Already Integrated`: branches with no remaining unique implementation.
- `Unknown`: branches with insufficient evidence.

## Integration Debt Metrics
Integration Debt measures completed or integration-blocked work that is not yet part of `main`. It exists to prevent branch accumulation.

Report these metrics after every repository audit:

- Integration Ready branches
- Metadata Conflicts
- Mechanical Conflicts
- Semantic Conflicts
- Needs Bug Fixes
- Active Development
- Already Integrated
- Total Integration Debt
- Oldest Integration Ready branch
- Oldest Semantic Conflict
- Average age of Integration Ready branches

For metric totals, count `Metadata Conflict` branches inside Integration Ready, not as a separate additive debt bucket. By default, Total Integration Debt is:

```text
Integration Ready + Mechanical Conflicts + Semantic Conflicts + Needs Bug Fixes
```

Active Development and Unknown branches are reported separately because they are not yet completed integration candidates.

Default age threshold: 7 calendar days from branch tip unless the owner sets a different threshold for the audit.

Flag `Integration Debt Increasing` when more than three Integration Ready branches exist at the same time.

Flag `Integration Drift Risk` when any Integration Ready branch remains unmerged beyond the age threshold.

Do not rewrite historical bead state during an audit. Audit reports may classify the current branch reality even when Beads, GitHub Issues, PR draft status, or old notes disagree.

## Recommended Evidence Commands
Use focused commands and record the results, not raw logs.

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
Use these terms consistently:

- `Baseline Failure`: a failing validation item already present on current `main` before the candidate branch is evaluated.
- `New Regression`: a failure that appears on the candidate branch but is not present in the current `main` baseline, or an existing baseline failure that becomes broader, more severe, or blocks feature-specific validation.

Inherited `Baseline Failure` items are repository debt. They are not by themselves branch blockers.

## Output Contract
Use this shape when reporting the gate:

```text
INTEGRATION READY: YES|NO
Bead: <id or none>
Branch: <branch>
State: Already Integrated|Integration Ready|Mechanical Conflict|Semantic Conflict|New Regression|Active Development|Dependency Blocked|Unknown
Conflict Class: none|Metadata Conflict|Mechanical Conflict|Semantic Conflict
Main Base: <sha>
Merge Source: <branch or PR>
Dependencies: merged|ordered|blocked|none
Feature QA: PASS|BLOCKED|NOT CHECKED
Baseline Failures: <count and summary>
New Regressions: <count and summary>
Validation: <commands and baseline-relative results>
Blocking Reason: <state-specific blocker or none>
```
