# Wishfire conditional-skill implementation goal

Bead: ORKA-ood. Lane: codex/ORKA-ood-conditional-skills. Base: 0a24c72, the newest realtime checkout.

## Objective

Implement the approved [33-skill catalog](../governance/planning/conditional-skill-catalog.md) with reusable conditions, current-stat target selection, bounded modifiers, explicit unlocks and deterministic effect lifecycles. Skill names remain placeholders. Owner request authorizes the catalog V1 unlock/bounds proposals as implementation defaults. Preserve earned levels, EXP, gear and canonical hero identities.

## Scope

Shared pure condition/modifier rules; canonical definitions; realtime selection/cast/reaction hooks; damage/heal/KO/revival; stage-attempt resets; skill disclosure; tests and browser proof. Weather/biome runtime, new commerce, deployment and unrelated integration remain outside this goal.

## Completion evidence

- All 33 stable skill IDs and four awakenings match owner/unlock mappings.
- Current-state predicates and eligible-target revalidation drive success-only cooldowns.
- Strongest-per-stat overlap and shared numeric bounds prevent compounding.
- Source/target KO, expiry, waves, boss entry and attempt reset follow the catalog.
- Existing saves, EXP and gear survive load/progression.
- Focused deterministic rule, scheduler, effect, progression and lifecycle tests pass.
- Natural-size in-app browser inspection confirms active combat, changed skills/availability and clean controls.
- Scoped checkpoint/implementation commits and completion receipts identify remaining merge dependencies separately.

## Progress

Design checkpoint prepared; implementation active.
