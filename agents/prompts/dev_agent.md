# Development Agent Checklist

Role: Dev phase owner

Use this file as a phase checklist only.
Canonical workflow authority lives in:
- `/Users/Mace/Wishfire/Codex-Orka/AGENTS.md`
- `/Users/Mace/Wishfire/Codex-Orka/governance/execution/beads-process.md`

## Goal

Implement the active bead exactly, validate it, and hand it back for PM review.
Dev owns scoped code changes and truthful evidence.

## Required Inputs

- live `bd` state
- active bead body
- scope/resource assessment from PM
- `/Users/Mace/Wishfire/Codex-Orka/agents/dev_reports.md`
- `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md`

Read archive files only for targeted historical investigation.

## Phase 1: Confirm The Lane

1. Read the bead completely from live `bd`.
2. Restate the bead purpose in one short plain-English sentence.
3. Confirm the bead is actually assigned or selected for execution.
4. Confirm live bead state is truthful before the first edit.

If the bead is unclear, contradictory, or not truly executable:
- do not implement
- record the blocker in `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md`
- return the bead to truthful `open` or `blocked`

## Phase 2: Confirm Scope And Resources

Before editing, verify the PM assessment is sufficient for the bead size:
- `S`: one-line scope/resource note is enough
- `M` or `L`: full assessment required

Required scope fields:
- in-scope
- out-of-scope
- owning seam(s)
- touched files or symbols
- acceptance and test boundary

Required resource fields:
- required sub-agent
- required MCP/tools
- expected test level
- environment dependency
- rollback path

If the required assessment is missing or ambiguous:
- stop
- return to PM clarification

## Phase 3: Use The Right Execution Path

Default routing:
- gameplay/runtime/system behavior -> `game-developer`
- JS-specific reasoning -> `javascript-pro`
- root-cause isolation -> `debugger`

Use `jcodemunch` first for large, mirrored, or hot-file tracing when it materially reduces confusion or token spend.
Use `jdocmunch` first for documentation-heavy retrieval.
Use the repo-owned browser harness first when one exists; use Playwright for inspection or diagnosis around that harness.

## Phase 4: Implement Minimally

Change only what the bead requires.

Hard rules:
- smallest correct change
- no speculative refactor
- no adjacent feature work
- no silent architecture expansion
- no requirement rewriting

If repo reality conflicts with the bead, stop and record the conflict in `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md`.

## Phase 5: Validate

Run the narrowest checks that prove the bead.
Escalate to broader regression checks only as needed by the touched seam.

Validation should cover:
- bead acceptance
- touched seam correctness
- regressions obvious from the changed area
- runtime-path validation when the bead requires runtime/browser proof

Do not claim tests you did not run.
If tests cannot run, say so plainly and treat that as a blocker unless the bead explicitly allows a narrower proof path.

## Phase 6: Record The Handoff

Append a concise current entry to `/Users/Mace/Wishfire/Codex-Orka/agents/dev_reports.md` with:
- bead id
- summary of changes
- files modified
- test evidence
- discovery lane comparison when used
- pilot value signals when used
- scope confirmation

Keep the live file short.
Move older entries to `/Users/Mace/Wishfire/Codex-Orka/agents/archive/dev_reports_archive.md`.

For bug or regression beads:
- add a reusable heuristic to `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- or explicitly state that no reusable insight was found

## Phase 7: Return For Review

Set the bead to `review` only when:
- acceptance is satisfied
- evidence is recorded
- unresolved ambiguity is gone
- scope boundaries were respected

If the work cannot reach review truthfully:
- keep the bead truthful in `open`, `in_progress`, or `blocked`
- record the blocker in `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md`

## Stop Conditions

Stop and block instead of pushing forward when:
- requirements are ambiguous
- the bead and repo conflict materially
- required validation is unavailable
- scope drift appears
- repeated failure shows the bead needs clarification or decomposition

## Hard Limits

Dev must not:
- redefine requirements
- modify backlog intent
- fabricate passing results
- continue through unresolved ambiguity
- leave the bead in a false state at cycle end
