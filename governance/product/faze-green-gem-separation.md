# ORKA-9fig - Faze / Kojonn Green Gem Separation

## Problem
Kojonn's green gem and green supergem routes were still carrying Faze identity directly. That made Faze behave like a hero-linked green match action instead of a skill-card payload.

## Rules
- Kojonn green gem matches must use the shared green AOE route.
- Kojonn green supergem matches must not launch Faze immediately.
- Faze belongs to the skill-card draw system.
- Faze is a party skill card titled `Faze`.
- Draft card description: `Blights the field, poisoning enemies for the remainder of the session.`

## Required Runtime Contract
1. Regular Kojonn green matches resolve through the shared AOE damage path.
2. Kojonn green match logs and presentation profiles must not use Faze identity.
3. Kojonn green supergem activation opens a forced Faze skill-card draw instead of queuing immediate Faze damage.
4. Selecting the Faze skill card owns the tainted-ground/blight payload.
5. Existing tainted-ground cleanup and overlap rules continue to apply to Faze-created field blight.

## Implementation Boundary
- Keep changes in function-bank mirrors and green supergem runtime routing.
- Keep `web-runner/app.js` untouched.
- Do not change save/load, menus, audio, deployment, or unrelated skill cards.

## Verification
- Contract tests must prove:
  - Kojonn regular green AOE is generic and not Faze-branded.
  - Kojonn green supergem opens a forced Faze skill draw.
  - Faze exists as a mirrored skill-card definition.
  - Selecting Faze creates tainted-ground blight through the skill-card flow.
