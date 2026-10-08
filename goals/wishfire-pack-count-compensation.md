# Wishfire: compensate weaker packs with more enemies

Bead: ORKA-aee. Baseline checkpoint: 075cc37e (boss-progress HUD and actor-owned HP depth).

## Approved behavior

For each ordinary roaming pack, compare its total CP after existing stat scaling with the full deployed party total CP. If the pack is lower, roll once for one, two or three extra enemies. Equal or stronger packs keep their existing count. Use the existing seeded random machinery so an encounter can be reproduced.

Added enemies retain the pack's scaled stats and share its sector. Give them unique slots and valid identities. Keep all six pack sectors, the committed-local-threat rule and four completed waves before automatic boss entry. Boss count and boss stats remain unchanged; ordinary density must not inflate the boss formula.

The comparison uses full party capability, including a temporarily KO hero's ordinary stats. It does not fall as heroes take HP damage. One random count adjustment occurs per pack construction; later combat updates do not reroll it or keep adding enemies until CP matches.

## Execution and proof

- Trace fresh entry, later wave spawning and defeat recovery through the shared spawn-plan owner. Preserve explicit sector metadata when pack sizes differ.
- Verify +1/+2/+3 outcomes, strict lower-than threshold, unchanged source stats, valid slots/sector membership, deterministic repeats and unchanged boss count/stats.
- Run the relevant combat contracts, then inspect the active in-app preview. Preserve the HUD sizing and HP rendering checkpoint.
- Use an independent Luna review, checkpoint the result and retain main integration gates. Keep only the current preview running; close temporary test servers once their checks finish.

## Boundaries

This change adds encounter pressure and ordinary enemy reward opportunities through count. Hero stats, skills, boss balancing and the existing introductory-boss exception are outside this scope. Confirm actual runtime outcomes through tests and screenshots before reporting success.
