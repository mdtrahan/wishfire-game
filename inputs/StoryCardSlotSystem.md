# StoryCardSlotSystem — Hardened Agent-Ready Technical Spec (v3)

> Goal: remove ambiguity so probabilistic AI coders can’t “helpfully” invent behavior.

---

## 0. Scope and Intent

This system injects **Encounter Cards** between stages/days of a run:

* **MINOR**: single-action reward card (no choice)
* **MAJOR**: slot-style mini-game (reel slot or card flip)
* **NARRATIVE**: choice card (risk/reward)

### 0.1 Non-Goals (Hard)

* No pity logic in chapter encounters
* No dynamic difficulty adjustment
* No RNG in UI layer
* No economy balancing logic beyond stated formulas

### 0.2 Definitions (Agents must not reinterpret)

* **Day**: integer step counter starting at 1. Increments exactly once per stage transition (or explicit design step). Not wall-clock time.
* **Encounter Trigger Point**: the exact moment after combat stage resolves and before the next stage begins.
* **Encounter Instance**: a committed encounter with a unique ID that can be replayed deterministically.

---

# 1) Deterministic RNG Contract (No Exceptions)

## 1.1 RNG Interface

```ts
interface IRng {
  nextFloat(streamId: string): number;   // returns x where 0 <= x < 1
  nextInt(streamId: string, min: number, max: number): number; // inclusive min/max
}
```

### 1.1.1 Forbidden

* `Math.random()`
* RNG calls in UI, animation, rendering, layout measurement
* RNG calls in logging/telemetry

## 1.2 Seed Strategy

```
seed = hash(runId + playerId + chapterId + sessionStartTimestamp)
```

### 1.2.1 Seed Inputs Must Be Stable

* `runId` must be unique and persisted
* `sessionStartTimestamp` must be persisted (not re-derived)

## 1.3 Stream Discipline

Streams are logically separated and **must be deterministic in call count**.

| Stream ID    | Usage                    | Call Count Rule                   |
| ------------ | ------------------------ | --------------------------------- |
| scheduler    | encounter planning rolls | fixed per plan attempt            |
| outcome      | outcome tier roll        | exactly 1 per mini-game instance  |
| presentation | generate reels/grid      | fixed per instance by rules below |
| loot         | spawn table              | fixed per item spawned            |
| obtain       | obtain-rate roll         | exactly 1 per spawned item        |

### 1.3.1 RNG Draw Budget

To prevent accidental desync:

* Every function that draws RNG must document its exact draw count.
* No early-return path may change the number of RNG calls unless explicitly stated.

---

# 2) Canonical State Contracts

## 2.1 RunEncounterState (Single Source of Truth)

```ts
interface RunEncounterState {
  schemaVersion: '3.0';

  // progression
  currentDay: number;
  encounterCount: number;
  lastEncounterDay: number;      // day of most recent committed encounter
  lastMajorDay: number;          // day of most recent committed MAJOR encounter

  // bookkeeping
  fortuneMinor: number;
  fortuneMajor: number;

  // persistence
  runId: string;
  seed: string;

  // history
  encounterHistory: EncounterInstance[];
}
```

## 2.2 EncounterInstance

```ts
type EncounterTier = 'MINOR' | 'MAJOR' | 'NARRATIVE';

interface EncounterInstance {
  encounterInstanceId: string;     // unique, deterministic format below
  encounterKey: string;
  tier: EncounterTier;
  plannedDay: number;
  committedAtDay: number;

  // outcome snapshot (for deterministic replay)
  outcomeTier?: string;            // e.g., SlotOutcome or FlipOutcome
  rewardsPlanned?: RewardSpec[];    // what should be granted
  rewardsGranted?: boolean;         // idempotency flag
}
```

### 2.2.1 encounterInstanceId Format (Do not improvise)

```
encounterInstanceId = `${runId}:${plannedDay}:${encounterKey}:${encounterCount+1}`
```

Rationale: stable, readable, collision-resistant within a run.

## 2.3 Invariants (Hard Assertions)

* `encounterCount <= maxEncountersPerRun`
* `fortuneMajor == count(history where tier=='MAJOR')`
* `fortuneMinor == count(history where tier=='MINOR')`
* `plannedDay == committedAtDay` (no delayed commits)
* `No two committed encounters occur within minDaysBetweenEncounters`
* `encounterHistory` is append-only

Simulation and tests must fail fast if violated.

---

# 3) Planning vs Commitment (Two-Phase, Always)

## 3.1 Planning Phase (Pure)

```ts
planEncounter(day: number, state: RunEncounterState, config: SchedulerConfig, rng: IRng)
  : EncounterPlan | null
```

```ts
interface EncounterPlan {
  encounterKey: string;
  tier: EncounterTier;
  plannedDay: number;
}
```

Planning must not mutate state.

## 3.2 Commitment Phase (Mutable)

```ts
commitEncounter(plan: EncounterPlan, state: RunEncounterState)
  : EncounterInstance
```

Commitment updates exactly once:

* `encounterCount++`
* `lastEncounterDay = day`
* if tier==MAJOR → `lastMajorDay = day`
* fortune counters increment based on tier
* append EncounterInstance

### 3.2.1 Double-Commit Protection

If an encounter for the same day is already committed, commitment must return the existing instance (idempotent commit).

---

# 4) Scheduler Rules (Precedence + Edge Cases)

## 4.1 Evaluation Order (Exact)

1. If `encounterCount >= maxEncountersPerRun` → return null
2. If an encounter already committed on `day` → return null
3. If `anchoredEncounters` contains `day` → plan that encounter (subject to spacing rule below)
4. If `day - lastEncounterDay < minDaysBetweenEncounters` → return null
5. Roll tier (weighted)
6. If rolled MAJOR but `day - lastMajorDay < majorFortuneMinInterval` → downgrade to MINOR (not reroll)
7. Pick encounterKey from tier pool by weights

### 4.1.1 Anchored Encounters vs Spacing

Anchored encounters **DO respect** `minDaysBetweenEncounters`.

* If anchored would violate spacing, anchored is **skipped** (not delayed).

### 4.1.2 Weight Normalization

* Weights are normalized at load.
* If weights sum to 0 or contain NaN → config load fails.

---

# 5) Versioned Config + Validation

## 5.1 Config Must Be Validated at Load

If invalid, system must refuse to start the run.

```ts
interface SchedulerConfig {
  schemaVersion: '3.0';
  minorFortuneWeight: number;
  majorFortuneWeight: number;
  narrativeWeight: number;
  anchoredEncounters: { encounterKey: string; triggerDay: number }[];
  minDaysBetweenEncounters: number;
  maxEncountersPerRun: number;
  majorFortuneMinInterval: number;
}
```

### 5.1.1 Migration Rule

* Only one active schemaVersion per run.
* If config schemaVersion changes between app versions, run resumes using the schema embedded in the saved run (no mid-run reinterpretation).

---

# 6) Mini-Games Are Outcome-First (No Skill Leakage)

## 6.1 Universal Resolution Flow

1. Determine outcome tier via `outcome` stream (exactly 1 RNG draw)
2. Generate presentation via `presentation` stream (fixed draw count)
3. Animate reveal (no RNG)
4. Plan rewards (pure)
5. Grant rewards (idempotent)

### 6.1.1 Replay Rule

Given the same seed + state history, the same encounter must resolve identically.

---

# 7) Major Fortune — Reel Slot

## 7.1 Types

```ts
type SlotOutcome = 'MISS' | 'TWO_MATCH' | 'THREE_MATCH';
```

## 7.2 Probabilities

* Configured probabilities must sum to 1.0 (±1e-6) or load fails.
* Probabilities apply to outcome tier only.

## 7.3 Presentation Generation (Fixed)

Given outcome:

* THREE_MATCH: select 1 symbol (weighted) and set all reels to it
* TWO_MATCH: select 1 symbol for the match (weighted), select 1 different symbol for the non-match (weighted from remaining)
* MISS: select 3 symbols with constraint **not all equal** and **not exactly two equal**

### 7.3.1 Symbol Weights

Symbol weights are only used to select which symbols appear once outcome is chosen.

### 7.3.2 RNG Draw Count (Must Match Implementation)

* THREE_MATCH: 1 symbol draw
* TWO_MATCH: 2 symbol draws
* MISS: up to 3 symbol draws, but must be implemented as a constraint-safe method with fixed draws (e.g., draw 3 then repair deterministically)

---

# 8) Major Fortune — Card Flip (Match-3)

## 8.1 Types

```ts
type FlipOutcome = 'SMALL' | 'BIG' | 'LEGENDARY';
```

## 8.2 Outcome Probabilities

Same validation rules as reel slot.

## 8.3 Grid Generation Contract

* Grid size is fixed per encounterKey (e.g., 3x4). Must be declared in config.
* After selecting outcome tier, generate a grid with:

  * exactly one guaranteed match-3 set for the target tier
  * no additional unintended match-3 sets

### 8.3.1 “Exactly One Match Path” Clarification

* The grid must contain exactly one set of 3 matching target icons.
* Player flip order is cosmetic; the game reveals the predetermined outcome.

### 8.3.2 RNG Draw Count

Grid generation must use a fixed draw count:

* pick target icon: 1 draw
* place match positions: 1 draw (from a predefined list)
* fill remaining: N draws (one per remaining slot)

---

# 9) Reward System Contract (Math + Idempotency + Failure Modes)

## 9.1 RewardSpec

```ts
type RewardType = 'STAT_BUFF' | 'HP_RESTORE' | 'EXP_GRANT' | 'GOLD' | 'EVENT_CURRENCY' | 'ITEM';

type Duration = 'INSTANT' | 'RUN_END';

interface RewardSpec {
  type: RewardType;
  stat?: 'ATK' | 'DEF' | 'MAX_HP' | 'MAG' | 'RES' | 'SPD';
  value?: number;              // for % buffs and restores (0.07, 0.20)
  amount?: number;             // for currency/exp/item counts
  duration?: Duration;
  itemKey?: string;
}
```

## 9.2 Buff Stacking Rules (No Guessing)

* All % stat buffs stack **multiplicatively**: `final = base * Π(1 + buff)`
* Caps apply after stacking.
* Caps are per-stat config values.

## 9.3 Gold Formula

```
gold = clamp(baseGold * (1 + chapterDepth * scalingFactor), minGold, maxGold)
```

* `chapterDepth` is integer
* `scalingFactor` is decimal
* Use integer rounding rule: `floor(gold)` (explicit)

## 9.4 Reward Grant Idempotency

```
rewardGrantId = `${runId}:${encounterInstanceId}`
```

Granting rules:

* If rewardGrantId already granted → do nothing and return success
* If grant fails mid-way → record failure and retry must be safe (transactional or compensating)

### 9.4.1 Transaction Semantics (Pick One and Implement)

* Preferred: **atomic grant** (all-or-nothing)
* If atomic not feasible: **stepwise grant** with per-step idempotency keys

---

# 10) Dual-Layer RNG (Conveyor/Loot Systems)

## 10.1 Contract

1. Spawn roll (loot stream)
2. Obtain roll (obtain stream)

Rules:

* Spawn and obtain use different streams
* Obtain roll must occur for every spawned item (even if common) to keep draw counts stable

---

# 11) Telemetry (Debuggable, Not Optional)

## 11.1 Required Events + Payload

* `encounter_planned { runId, day, encounterKey, tier, encounterCountBefore }`
* `encounter_committed { runId, day, encounterInstanceId, encounterKey, tier, encounterCountAfter }`
* `encounter_resolved { runId, day, encounterInstanceId, outcomeTier }`
* `reward_granted { runId, encounterInstanceId, rewardGrantId, rewardsPlanned }`
* `reward_grant_failed { runId, encounterInstanceId, rewardGrantId, errorCode }`

### 11.1.1 Privacy

No player PII in telemetry payload.

---

# 12) Save/Load and Concurrency Hazards

## 12.1 Save/Load Contract

* `RunEncounterState` must be serializable JSON.
* On load, validate invariants. If violated → hard fail with error code.

## 12.2 Concurrency Rules

* Encounter commit and reward grant are protected by a run-level mutex/lock.
* UI double-tap and resume-from-background must not duplicate commits or rewards.

---

# 13) Simulation Harness (Required, With Metrics)

```ts
simulateRun(seed: string, config: SchedulerConfig, days: number): SimulationResult
```

```ts
interface SimulationResult {
  runs: number;
  encounterTierCounts: Record<EncounterTier, number>;
  outcomeTierCounts: Record<string, number>;
  averageRewards: Record<string, number>;
  invariantViolations: { code: string; count: number }[];
}
```

Must support:

* 10,000-run batch
* deterministic test vectors (fixed seed)

---

# 14) Testing Requirements (Specific)

## 14.1 Deterministic Replay Test

* Given identical saved state + seed, replay 100 encounters and compare:

  * encounterKeys
  * tiers
  * outcomeTiers
  * rewardsPlanned

## 14.2 RNG Draw Count Test

* Assert expected draw counts per encounter type.

## 14.3 Invariant Validation Test

* Ensure all invariants hold across 10,000-run simulation.

## 14.4 Idempotency Tests

* Commit called twice for same day returns same instance.
* Reward grant called twice grants once.

---

# 15) Module Boundaries (Enforced)

> Purpose: prevent AI agents from “just wiring it up” with cross-layer calls that break determinism.

## 15.1 Layering Rules (Hard)

**Allowed dependency direction (only):**

```
Pure Logic  →  Presentation  →  UI
```

### 15.1.1 Forbidden Dependencies

* UI importing Pure Logic modules directly
* UI importing IRng, RewardMath, RewardPlanner, Scheduler
* Presentation importing UI
* Any layer calling RNG except Pure Logic + Presentation generators (as specified)

### 15.1.2 Allowed Communication Pattern

UI may only interact with the system via a single façade:

```ts
interface IEncounterFacade {
  maybePlanAndCommitEncounter(day: number): EncounterInstance | null;
  resolveMiniGame(encounterInstanceId: string): EncounterInstance; // fills outcomeTier + rewardsPlanned
  grantRewards(encounterInstanceId: string): { ok: boolean; errorCode?: string };
  getEncounterViewModel(encounterInstanceId: string): EncounterViewModel;
}
```

* UI calls façade methods.
* Façade is responsible for locking, idempotency, and layering.

## 15.2 Package / Folder Boundary Recommendation

Agents must implement boundaries with separate modules (TS) or assemblies/namespaces (C#). Example:

```
/encounters-core       // Pure Logic
  /scheduler
  /outcomes
  /rewards
  /rng
  /telemetry

/encounters-present    // Presentation generators
  /reels
  /grid
  /viewmodels

/encounters-ui         // UI only
  /screens
  /animations
  /bindings
```

## 15.3 Import Guards (Must Exist)

At least one of the following must be implemented:

* **TS**: ESLint rule(s) or path alias restrictions preventing forbidden imports
* **C#**: separate assemblies with reference restrictions
* **Unity**: Assembly Definition (.asmdef) boundaries enforcing references

If guardrails are not feasible, code review must explicitly prove compliance.

---

# 16) Implementation Readiness Checklist (Acceptance Criteria)

> Problem: AI coders will treat checklists as “nice to have.” Fix: convert checklist into **gated acceptance tests + required artifacts** that block merge.

## 16.0 Definition of Done (DoD)

An implementation is **not complete** until ALL of the following exist and pass in CI:

1. **Automated tests** for determinism, draw-count, invariants, idempotency
2. **Simulation artifact** checked into repo with reproducible command
3. **Import boundary guardrails** (lint/asmdef/assemblies) actively blocking forbidden imports
4. **PR Evidence**: a machine-readable `encounters-proof.json` produced by CI

If any item is missing, the feature is considered **incomplete**, even if the UI works.

## 16.1 Determinism and RNG (Gated)

*

## 16.2 State and Persistence (Gated)

*

## 16.3 Scheduling (Gated)

*

## 16.4 Mini-Game Resolution (Gated)

*

## 16.5 Rewards (Gated)

*

## 16.6 Concurrency / Idempotency (Gated)

*

## 16.7 Telemetry (Gated)

*

## 16.8 Simulation (Gated)

*

## 16.9 Boundary Enforcement (Gated)

*

## 16.10 Deliverables (Required Outputs)

*

---

# 17) Enforcement Mechanism (Merge Gates)

> This section exists because “should” is a hallucination magnet.

## 17.1 CI Must Produce a Proof Artifact

CI must generate a JSON file at a fixed path:

```
/encounters-proof.json
```

Schema:

```json
{
  "specVersion": "3.0",
  "commit": "<git sha>",
  "tests": {
    "determinism": {"pass": true},
    "drawCount": {"pass": true},
    "invariants": {"pass": true},
    "idempotency": {"pass": true},
    "imports": {"pass": true}
  },
  "simulation": {
    "runs": 10000,
    "pass": true,
    "artifactPath": "./artifacts/simulations/encounters-sim.json"
  }
}
```

If the proof artifact is missing or any `pass` is false, CI fails.

## 17.2 PR Template Requirement (Hard)

PR must include a section titled **“Spec v3 Compliance”** with:

* Link/path to `encounters-proof.json`
* One sentence stating chosen reward transaction semantics (atomic vs stepwise)
* Confirmation that UI imports only the façade

If missing, PR is rejected.

## 17.3 Test Vector Lock-In

A deterministic test vector file must exist:

```
/test-vectors/encounters-v3.json
```

It must include:

* seed
* initial state
* expected first N encounterInstanceIds + keys + tiers + outcomes

If this file changes, PR must explain why (expected behavior change).

---

# 18) Agent Instructions (Mandatory Reading)

Agents implementing this spec must:

* Implement merge gates (Section 17) before UI polish.
* Refuse to mark work “done” until `encounters-proof.json` is produced.
* Treat any missing numeric rule as a blocker (do not invent).

---

End of Spec v3
