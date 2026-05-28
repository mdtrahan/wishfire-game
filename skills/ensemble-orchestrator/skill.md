---
name: ensemble-orchestrator
description: For non-trivial engineering/design questions with multiple valid approaches, generate 3 genuinely different candidate solutions, score them with a rubric, then output the best plus a concise alternatives summary. Codex/VS Code compatible (no subagents; simulate parallel drafts).
version: 1.0.0
tags: [planning, architecture, codegen, evaluation]
---

# Ensemble Orchestrator (VS Code + Codex)

## Core idea
Because Codex in VS Code has no native “spawn subagents” feature, simulate an ensemble by producing **three independent drafts** with explicit diversification constraints, then **evaluate** and **select**.

## When to use
Trigger when the user asks for:
- options, alternatives, comparisons
- “best approach” decisions
- architecture/design with trade-offs
- code generation where patterns differ (strategy vs simple vs optimized)

Do NOT use for:
- obvious one-step fixes
- simple syntax/lookups
- deterministic “change X to Y” edits
- mechanical file ops / straightforward refactors with one correct path

## Step 0 — capture constraints (lightweight)
Before drafting, extract constraints from context:
- language/framework
- performance vs simplicity priorities
- dependency constraints
- repo conventions (lint, tests, folder structure)

If critical constraints are missing, ask **max 3** targeted questions; otherwise proceed.

## Step 1 — classify task type
Pick one:
1) Code generation (functions/classes/APIs/algorithms)
2) Architecture/design (system components, data models, interfaces)
3) Creative/docs (naming, doc structure, tone)

## Step 2 — generate 3 genuinely different drafts
Hard rules:
- The three drafts must differ in *core approach*, not just small tweaks.
- Label them Draft A / Draft B / Draft C.
- Each draft must include: concept, steps, pros/cons, complexity, risks.

### Diversification strategy by task type

**Code generation**
- Draft A: Simplicity (minimal, readable)
- Draft B: Performance (optimized, scalable)
- Draft C: Extensibility (abstractions, pluggable)

**Architecture/design**
- Draft A: Top-down (requirements → interfaces → implementation)
- Draft B: Bottom-up (primitives → composition)
- Draft C: Lateral (analogy-based pattern from another domain)

**Creative/docs**
- Draft A: Expert (precise, formal)
- Draft B: Pragmatic (ship-focused)
- Draft C: Innovative (unconventional but defensible)

## Step 3 — score each draft (0–10)
Use this rubric with base weights:
- Correctness (30%)
- Completeness (20%)
- Quality/maintainability (20%)
- Clarity (15%)
- Elegance (15%)

Adjust weights:
- Code gen: +10% Correctness, -5% Elegance, -5% Clarity (unless user asked “simple”)
- Architecture: +10% Quality, +5% Completeness, -15% Elegance
- Creative/docs: +10% Clarity, +10% Elegance, ignore Performance considerations

## Step 4 — select winner and present output
Return exactly this structure:

## Selected Solution
- 2–5 bullets: why it won
- the full implementation OR a clear skeleton (if constraints missing)

## Why This Solution Won
- tie reasoning to rubric criteria, not vibes

## Alternatives
- **Draft A**: when to prefer it + trade-off
- **Draft B**: when to prefer it + trade-off
- **Draft C**: when to prefer it + trade-off

## Scorecard
Provide a compact table:
- per-criterion scores and totals for A/B/C

## Quality bar
Success looks like:
- 3 truly different approaches
- clear, defensible winner selection
- alternatives are actionable (“choose this if…”)
- output respects repo conventions and constraints
