# ORKA-azwx — Crimson Ward / Red Supergem Isolation

## Problem
Falie was granting or sustaining party ward (Crimson Ward behavior) from the red supergem path. This violates combat rules and creates cross-system coupling between supergem attacks and skill-card flow.

## Rules
- Red supergem is a single-target cluster attack.
- Red supergem is not a skill trigger.
- Crimson Ward belongs to skill-card selection flow.
- Crimson Ward is party-scoped and not linked to any hero identity.

## Required Runtime Contract
1. Activating a red supergem queues or resolves only red supergem attack behavior.
2. Red supergem activation must not:
   - open skill draught,
   - select skills,
   - grant or sustain Crimson Ward shields.
3. Crimson Ward shield/barrier state can only be created through the skill-card system (party skill selection).

## Implementation Boundary
- Keep changes scoped to contextual runtime modules and function-bank mirrors.
- Do not alter green gem, green supergem, Faze, or Kojonn-specific behavior.
- Keep `web-runner/app.js` untouched unless unavoidable for minimal wiring.

## Verification
- Contract tests must prove:
  - Falie red supergem does not trigger Crimson Ward.
  - Red supergem remains single-target cluster behavior.
  - Crimson Ward still activates via skill-card selection flow.
