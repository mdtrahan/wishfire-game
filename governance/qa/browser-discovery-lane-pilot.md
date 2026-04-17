# Browser Discovery Lane Pilot

## Purpose
- Add a third set of eyes for runtime QA without changing workflow authority.
- Keep the current repo-owned harness as the shipping gate.
- Make the experiment cheap to remove if it burns time or tokens without adding signal.

## Authority
- Live `bd` state remains the only task authority.
- `AGENTS.md` and `governance/execution/beads-process.md` remain the only active routing/workflow authority.
- `npm run balance-harness` remains the shipping browser lane and pass/fail gate for bead completion.
- The discovery lane is an optional diagnostic lane. It does not redefine pass, close beads, or create alternate status tracking.

## Two Browser Lanes

### 1. Shipping lane
- Use the existing repo-owned harness and current Playwright/CDP flow.
- This lane produces bead closeout evidence.
- If browser evidence is required for acceptance, this lane is still the authoritative proof path.

### 2. Discovery lane
- Use a persistent browser session or interactive browser tooling to inspect the same runtime under the same bead.
- Focus on bounded, player-like scenarios that are flaky, interaction-heavy, or hard to classify in the shipping lane.
- The discovery lane may:
  - hold longer-lived browser state
  - vary action pacing and inspection cadence
  - produce richer observations or failure taxonomies
  - compare its findings against the shipping lane
- The discovery lane must not:
  - replace the shipping lane as pass/fail authority
  - become mandatory for non-runtime beads
  - introduce a second backlog, status tracker, or execution contract

## Entry Criteria
- Use the discovery lane only when the bead is:
  - player-facing runtime work
  - interaction-heavy
  - repeatedly flaky or hard to classify
  - blocked by ambiguity in current Playwright or `agent-browser` behavior

- Do not use the discovery lane for:
  - pure tooling or docs beads
  - deterministic non-UI logic with sufficient contract coverage
  - hot-file ownership problems that are not browser-diagnosis problems

## Run Shape
- Run one bounded scenario at a time.
- Use the same local runtime URL and active bead context as the shipping lane.
- Record the outcome in one of three buckets:
  - `found more`
  - `found same`
  - `found less`

- Also record lightweight value signals:
  - time-to-understand failure: faster / same / slower
  - token cost: low / medium / high
  - operator overhead: low / medium / high
  - reusable output produced: yes / no

## Selective Subagent And Worktree Use
- Subagents are allowed only as read-only support for the active bead:
  - summarize browser findings
  - compare shipping-lane and discovery-lane outputs
  - review candidate QA scripts or checklists
- Subagents must not claim beads, edit gameplay hot files in parallel, or own status transitions.

- Worktrees are allowed only for disposable support lanes such as:
  - QA tooling spikes
  - browser support scripts
  - documentation of improved QA patterns
- Keep gameplay/runtime implementation in the active bead lane unless file ownership is clearly disjoint.

## Promotion Rules
- Promote only stable outputs from the discovery lane into repo-owned assets:
  - better QA checklist
  - better failure taxonomy
  - better pacing rules
  - better harness/bootstrap docs

- Do not promote a second browser pipeline unless the repo explicitly chooses to replace the current gate later.

## Unwind Rules
- Keep the pilot only if it:
  - finds meaningful issues or classifications the shipping lane missed
  - reduces browser-test confusion across several beads
  - yields reusable repo-owned QA guidance

- Kill the pilot if it:
  - mostly duplicates the shipping lane
  - costs more time or tokens than it returns
  - creates ambiguity about which lane is authoritative
  - produces interesting outputs that do not materially help delivery

- Unwind by:
  - stopping discovery-lane runs
  - deleting unpromoted support scripts or worktree artifacts
  - retaining only the repo-owned improvements worth keeping
