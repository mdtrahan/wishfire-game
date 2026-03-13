# ORKA-cpc to Weekly War Balance Loop

## Purpose
Define what `ORKA-cpc` already delivers, what remains stubbed, and the minimum systems needed to turn CP-budget encounters into a weekly live-ops balance loop.

## Current State (What ORKA-cpc Gives Us)
- CP-budget encounter builder (`targetCP`, `maxSlots`, `policy`, `seed`, optional `faction`).
- Deterministic reproducibility via encounter seeds.
- Doctrine-aware composition (`enemyRole`: `fodder|bodyguard|commander`).
- Locale/faction metadata normalization (`localeTags`, `faction`) with defaults.
- Strict filter contracts in tests.

This is a selection engine scaffold, not a full war-balance economy.

## First Principles (Irreducible Components)
1. Budget authority: one source that sets expected battle difficulty.
2. Roster authority: eligible enemy pool for the current narrative location.
3. Composition policy: how role mix fills a budget.
4. Outcome feedback: battle result data that updates future budget targets.
5. Weekly control loop: reset window + tuning knobs + guardrails.

Without all five, balance cannot self-correct week over week.

## What Is Still Stubbed
- No real per-locale content diversity yet (placeholder tags dominate).
- No weekly target curve tied to progression/session layer.
- No persistent difficulty adjustment from win/loss performance.
- No live tuning surface for PM (weights/caps/floors) outside code edits.
- No explicit economy coupling to commander/bodyguard pressure over a week.

## Required Systems for Weekly Session Loop

### 1) Weekly Balance Config (Data, Not Hardcoded)
Add a config object/file with:
- `weekId`
- CP lane targets by progression band (early/mid/late).
- Composition weights by policy (`mixed`, `fodder_only`, `solo_commander`).
- Role caps/floors (min fodder, max commanders, etc.).
- Allowed locale->faction sets for narrative consistency.
- Safety clamps (`minCP`, `maxCPDeltaPerBattle`, `maxLossStreakRelief`).

### 2) Session Difficulty Controller
Per player/session state:
- `recentResults` (N battles: win/loss, turns, damage taken).
- `currentTargetCP`.
- `adjustmentState` (up/down pressure).

Adjustment rule (simple):
- Strong wins increase next target CP slightly.
- Consecutive losses reduce CP within floor.
- Clamp changes per battle to avoid spikes.

### 3) Encounter Request Authority Layer
Before combat:
- Resolve `locale` from map node.
- Resolve `targetCP` from weekly config + session controller.
- Resolve `policy` from progression band / node type (normal vs commander node).
- Call `setEncounterRequest(...)`.

This makes map/tower flows consumers of policy, not owners.

### 4) Telemetry + Audit Surface
Log per battle:
- request: `targetCP`, `locale`, `policy`, `seed`.
- output: selected enemies, final CP, delta from target.
- result: win/loss + pacing indicators.

Weekly review metrics:
- win rate by CP band
- average CP delta
- commander appearance rate
- churn-risk proxy (loss streak frequency)

### 5) Weekly Operations Routine
- Weekly reset publishes new config (`weekId`).
- Mid-week hotfix can tune only config values (no code deploy).
- End-week report compares planned vs observed difficulty.

## Suggested Bead Breakdown
1. `WAR-001` Weekly config schema + loader + validation tests.
2. `WAR-002` Session difficulty controller (bounded CP adjustments).
3. `WAR-003` Map/tower authority wiring into `setEncounterRequest`.
4. `WAR-004` Telemetry capture for request/output/result.
5. `WAR-005` Weekly report script/summary artifact generation.
6. `WAR-006` Content pass: real locale tags and faction coverage.

## Acceptance Criteria for “Not Stub Anymore”
- `targetCP` is driven by weekly config + session outcomes, not static defaults.
- Encounter composition varies by policy/band with deterministic replay support.
- Locale/faction mismatches are prevented by data constraints, not manual checks.
- PM can retune weekly difficulty by config update only.
- Balance outcomes are observable in weekly metrics artifacts.

## Risks and Guardrails
- Risk: narrow roster causes repetitive encounters.
  - Guardrail: enforce minimum candidate count per locale/policy or degrade gracefully.
- Risk: overcorrection from streak logic creates oscillation.
  - Guardrail: per-battle delta clamp + smoothing window.
- Risk: commander spikes feel unfair.
  - Guardrail: commander frequency cap per session band.

## Immediate Next Decision
Choose where weekly config lives:
- Option A: `web-runner/assets/war_balance_weekly.json` (runtime-owned).
- Option B: `governance/planning/` source + build/export step.

Recommended: Option A for fastest live-ops iteration.
