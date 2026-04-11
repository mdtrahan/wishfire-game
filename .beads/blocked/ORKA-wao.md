id: ORKA-wao
title: [FEAT] Hero screen masked skill-image presentation pass
priority: P2
status: done

description: Implement hero-screen presentation-only masked skill images inside the skill frames for each hero. This bead is visual/content scope only: place text and images for the revised skill set, but do not wire gameplay logic, proc behavior, or runtime skill execution yet.

acceptance_criteria:
1. Add masked entry/presentation of new skill images inside the hero-screen skill frames for each hero.
2. Treat this bead as presentation-only: no skill wiring, no combat logic, no proc implementation.
3. Update hero-screen skill text to the following class-skill (CS) and job-skill (JS) set:
   - Falie
     - Block (CS): "Chance to receive damage for ally"
     - Shield Bash (CS): "Chance to counterattack an attacker"
     - Bounce (JS): "Chance reflect damage to attacker"
   - Huun
     - Steal (CS): "Chance to convert damage into Astral Flow"
     - Lift (CS): "Chance to get more gold"
     - Assault (JS): "Chance to triple attack an enemy"
   - Rune
     - Burn (CS): "Chance to drop totem doing magic damage over time"
     - Inspire (CS): "Chance to raise party RES"
     - Destiny (JS): "Chance for gem match to heal"
   - Kojonn
     - Avoid (CS): "Chance to use gems at no cost"
     - Enhance (CS): "Chance to increase ally MAG"
     - Gift (JS): "Chance to increase ally power 2x"
4. Preserve the distinction between the two class skills (CS) and the class-defining job skill (JS) in the presentation.
5. Any future skill-system/runtime bead must be separate; this bead should remain safe to ship as UI/content only.

notes: Created 2026-04-09 from user-provided hero skill rewrite and hero-screen masked-image presentation request.

Closed after wiring masked hero-skill node art from the provided sprite sheet into the live hero screen, updating the three-skill CS/JS presentation map, and validating Falie + Huun in the running browser runtime.
