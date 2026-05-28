# Skill Harness Notes

## Proc QA
- Reference: `governance/product/skill-proc-qa-guide.md`
- Rule: activation is not a proc; Browser/AutoPlay side-panel evidence is the final proof for proc behavior.
- TDD gate: define skill ID, owner, trigger, eligibility, roll, payload, counters, and Browser proof path before runtime edits.
- Required contracts: activation, eligibility rejection, roll accounting, and payload result.
- Debug shape: counters must distinguish checks, procs, misses, and payload results.
- UI split: dev-panel controls mutate QA state; side-panel readouts only report state.

## Double Attack
- Type: follow-up strike harness
- Current behavior:
  - duplicates `HERO_SINGLE` as a free second strike
  - no extra gem selection
  - no extra turn cost
  - retargets if the first target dies before the second strike lands
  - waits for the first strike readout to finish before starting the second attack sequence
- Expansion note:
  - should be extensible to enemies with future tooling

## Incinerate
- Type: red single-target presentation harness
- Current behavior:
  - preserves the old 4-hit clustered red burst
  - no longer lives in the default red attack path
  - default red attack is one direct strike unless this harness is explicitly assigned
- Expansion note:
  - candidate for future dev-panel assignment once more skill harnesses accumulate
