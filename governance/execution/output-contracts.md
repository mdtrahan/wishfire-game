# Output Contracts

## Purpose
- Keep repeated report shapes out of root `AGENTS.md`.
- Preserve concise, bounded, evidence-first output.

## Output Discipline
Cap large output.

Prefer:
- `rg -l`
- `rg -n -m`
- focused diffs
- targeted logs

Avoid:
- recursive dumps
- unbounded output
- unnecessary full test suites

## `commit check <bd-id>`
```text
COMMIT: YES|NO
Reason: <one line>
If YES: Commit Message: <summary bd-<id>>
```

## `qa handoff <bd-id>`
```text
Test URL
Steps
Expected
```

## `integration ready <bd-id>`
```text
INTEGRATION READY: YES|NO
Bead: <id>
Branch: <branch>
State: Already Integrated|Integration Ready|Mechanical Conflict|Semantic Conflict|New Regression|Active Development|Dependency Blocked|Unknown
Conflict Class: none|Metadata Conflict|Mechanical Conflict|Semantic Conflict
Main Base: <sha>
Merge Source: <branch or PR>
Dependencies: merged|ordered|blocked|none
Feature QA: PASS|BLOCKED|NOT CHECKED
Baseline Failures: <count/summary>
New Regressions: <count/summary>
Validation: <commands/baseline-relative results>
Blocking Reason: <one line or none>
```

## `repository audit integration drift`
```text
Integration Drift
Bead
Branch
Drift From Main
Missing Integration Ready Evidence
Baseline Failure / New Regression
Conflict Class
Disposition: backlog|needs-spec|active|complete|closed|legacy|deprecated|delete-candidate|needs-owner-decision
Blocking Reason
Next Action
Summary Buckets: Ready to Merge|Metadata Conflicts|Mechanical Conflicts|Semantic Conflicts|Needs Bug Fixes|Active Development|Already Integrated|Unknown
Integration Debt Metrics: counts, total debt, oldest ready branch, oldest semantic conflict, average ready age, flags
```

## Child AGENTS Shape
Use this section order for child `AGENTS.md` files:

- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

Leave sections empty only when there is no stable local guidance yet.
