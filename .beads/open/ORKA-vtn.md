id: ORKA-vtn
title: [FEAT] Hero skill progression economy tiers
priority: P2
status: open

description: Define the hero skill progression economy across unlocks, upgrades, stars, and moons. This bead captures the progression logic and tier gates for skill investment, not UI art or proc wiring.

acceptance_criteria:
1. Skill unlock costs are defined as:
   - skill 1: 10 SP
   - skill 2: 30 SP
   - skill 3 (JS): 50 SP
2. All skills have upgrade cap 15.
3. Post-max progression is tiered:
   - 10 SP -> 1 star
   - 15 SP -> 1 moon
   - 6 stars -> 6 moons progression path
4. Progression flow is explicitly tiered as:
   - SP -> star -> moon
5. Players may unlock skills in any order, including the Job Skill.
6. Star evolution is locked until all three skills are unlocked at minimum level 1.
7. Moon progression is locked until all three skills have at least 1 star.
8. The bead must preserve the intent that this is a tiered progression path, not a single linear upgrade rail.
9. Any future implementation bead must define deterministic validation for unlock cost, upgrade cap, and tier-gate enforcement.

notes: Created 2026-04-09 from user-provided hero skill economy and tier-gating rules.
