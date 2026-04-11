id: ORKA-ksw
title: [FEAT] Blue gem -> SP skill proc progression loop
priority: P1
status: open

description: Reframe the current hero-skill loop so blue gem matches feed a meaningful combat/progression lane. Blue gems convert to SP at 100:1. SP unlocks and upgrades hero skills. Unlocked skills are proc-based, not deterministic casts, so each skill exposes a current chance value and effect summary that scales with invested SP.

acceptance_criteria:
1. Rewrite the skill/progression design around `100 blue gems = 1 SP`; SP is not time-based income.
2. Skill unlock/upgrade state must produce player-readable current values such as skill name, effect summary, current proc chance, current SP toward next upgrade, and unlocked upgrade count.
3. Hero skills are chance-to-proc abilities, not guaranteed once-per-session actions.
4. The spec must connect blue gem matches to both long-term progression (SP accumulation) and moment-to-moment skill fantasy (higher proc chance / stronger skill expression), so blue turns no longer read as dead-value actions.
5. Scope the bead to the actual progression/combat system definition, not generic hero-screen flavor text.
6. Any future implementation bead spawned from this must define deterministic validation for blue-to-SP conversion and runtime/browser validation for visible player-facing skill state.

notes: Rewritten 2026-04-09 from a vague hero-screen messaging bead into a concrete progression-system bead centered on blue gem conversion, SP spend, and skill proc chance.
