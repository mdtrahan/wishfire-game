# Insights (Canonical, Minimal)

## Purpose
- This is the only active insights log.
- Capture only decisions that change future behavior.
- Do not log routine execution history, file lists, or status chatter.

## Operating Constraints
- Beads are the sole work authorization channel.
- Use one lane at a time; mirror deterministic rule edits in both runtime mirrors when required.
- When a problem appears, check this file for prior fixes before expanding scope.

## Product Model (Current)
- ORKA progression is mobile-casual leaning: power should come from skills, trait passives, and booster/meta systems.
- Avoid reintroducing classic RPG-style timed character buff/debuff stacks unless explicitly approved in bead acceptance.
- Blue gem flow is wallet/progression oriented (Astral Flow), not direct party-stat buff application.
- Progression-family scaffolds (tomes/relics/vault/chests/etc.) should ship as deterministic layout/state shells first, with map-locale entry mappings where menu pointers are intentionally absent.

## Bead Triage Guidance
- Prefer: skill/passive/trait behavior beads (`ORKA-6gt`, `ORKA-2sa`, `ORKA-mo4`, `ORKA-hvj`).
- Reframe before implementation when acceptance language implies persistent timed stat stacks (`ORKA-9ri`, `ORKA-zih`, residual wording in `ORKA-69r`).

## Regression Triggers
- Before starting combat-system beads, scan acceptance + code for: `buff`, `debuff`, `duration`, `turns`, `stack`.
- If these imply outdated model assumptions, pause and rewrite bead scope before coding.
