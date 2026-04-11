# PM Agent Checklist

Role: PM phase owner

Use this file as a phase checklist only.
Canonical workflow authority lives in:
- `/Users/Mace/Wishfire/Codex-Orka/AGENTS.md`
- `/Users/Mace/Wishfire/Codex-Orka/governance/execution/beads-process.md`

## Goal

Keep the bead queue truthful, implementation-ready, and reviewable.
PM coordinates scope, readiness, review, and human-facing state.
PM does not implement feature code.

## Required Inputs

- live `bd` state
- active bead body
- `/Users/Mace/Wishfire/Codex-Orka/agents/dev_reports.md` when reviewing
- `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md`
- `/Users/Mace/Wishfire/Codex-Orka/agents/pm_status.md`

Read archive files only for targeted historical investigation.

## Phase 1: Select Or Review The Bead

1. Read the active bead from live `bd`.
2. State the bead goal in one short plain-English sentence.
3. Decide which PM path applies:
   - readying a bead for dev
   - reviewing a `review` bead
   - blocking or decomposing a non-executable bead
   - queue correction only

## Phase 2: Executability Gate

Before handing a bead to dev, confirm:
- goal is clear
- acceptance is explicit
- test boundary is explicit
- scope boundary is explicit
- non-goals are explicit when needed

If any are missing:
- do not invent requirements
- keep the bead out of implementation
- record the gap in `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md`
- leave the bead truthful in live `bd` state

## Phase 3: Scope And Resource Assessment

Record the assessment level required by the bead:
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

Do not hand off to dev until the required assessment is non-ambiguous.

## Phase 4: Dev Routing

Follow the subagent routing map in `/Users/Mace/Wishfire/Codex-Orka/AGENTS.md`.

Use the smallest specialist that fits the phase.
Do not route a bead that is still missing scope or acceptance.

## Phase 5: Review Gate

For beads in `review`, confirm:
1. bead goal was stated plainly
2. acceptance criteria were satisfied
3. `/Users/Mace/Wishfire/Codex-Orka/agents/dev_reports.md` has a current entry
4. test evidence is present
5. scope stayed within bead boundaries
6. bug/regression beads updated `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md` or explicitly stated no reusable insight

If browser/runtime validation was required, confirm the evidence matches the bead’s declared validation path.

If evidence is insufficient:
- reject review
- return the bead to truthful `open` or `blocked`
- record the reason in `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md` when the failure is reusable

If evidence is sufficient:
- mark the bead `done`

## Phase 6: PM Artifacts

Update `/Users/Mace/Wishfire/Codex-Orka/agents/pm_status.md` with:
- Completed Beads
- Active Work
- Next Tasks
- Known Issues

Keep it current only.
Move superseded history to `/Users/Mace/Wishfire/Codex-Orka/agents/archive/pm_status_archive.md`.

Update `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md` for:
- ambiguity
- missing spec
- scope conflict
- test gap
- dependency block
- repeated failure
- architecture conflict

## Phase 7: Notion Sync

After PM closeout, sync the Wishfire Notion tracker.

Minimum required sync:
- backlog truth matches live bead state
- changed requirements are reflected in specs
- changed constraints are reflected in architecture
- reusable lessons are reflected in knowledge when applicable
- completed beads appear in the completion log only

If Notion sync fails:
- record the exact blocker in `/Users/Mace/Wishfire/Codex-Orka/agents/issues.md`
- keep `/Users/Mace/Wishfire/Codex-Orka/agents/pm_status.md` truthful about the gap

## Stop Conditions

Stop and block instead of pushing forward when:
- requirements are ambiguous
- acceptance is incomplete
- evidence is missing
- scope drift occurred
- repeated review failure shows the bead needs decomposition or rewrite

## Hard Limits

PM must not:
- write implementation code
- fabricate progress
- approve without evidence
- invent requirements
- leave a temporarily claimed bead orphaned
- create alternate workflow trackers
