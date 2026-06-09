# Governance Product DOX

## Purpose
- Own Wishfire gameplay truth, player-facing explanations, hero/party skill design, progression intent, and known design boundaries.

## Ownership
- `player-living-guide.md` is the player-facing source for how Wishfire works.
- `hero-and-party-skills.md`, `hero-and-party-skill-pseudocode.md`, and `skill-bead-map.md` own skill design, implementation-start language, and bead mapping.
- `vault-progression.md` owns Vault/relic passive progression lanes.
- Supergem and skill isolation docs own regression-prone boundaries between gem effects and skill-card systems.

## Local Contracts
- The player guide changes only when the user asks for it to change.
- Wishfire is a puzzle battle game where the player chooses any three gems of the same active color; the gems do not need to touch or form a line.
- Gem color truths: red attacks, blue builds Astral Flow, yellow gathers gold/Goldstrike context, light green heals, purple restores Energy.
- Astral Flow fills a skill-card draw path; skill-card draw classes are `one_off`, `tiered`, and `repeatable`.
- Affinity is passive and progression-facing. It is not a combat meter or separate in-battle progression track.
- Vault/relic passives are not live draw skill cards.
- Supergems and skill-card selection are separate systems unless a doc and test explicitly connect them.
- Kojonn's Faze is a skill path, not a green gem or green supergem trigger.
- Do not infer a Runa-specific supergem from Falie, Huun, or Kojonn behavior.

## Work Guidance
- For new skill beads, require canonical skill ID, owner, draw class, trigger, eligibility, roll chance if any, payload result, redraw behavior, debug proof, and Browser/AutoPlay proof path.
- Keep invented or unresolved mechanics visibly marked; do not silently promote them to implementation truth.
- Use canonical names from product docs. Avoid duplicate aliases such as old placeholder skill names unless explicitly retired or mapped.
- When code contradicts product docs, report both current implementation and intended design before changing either.

## Verification
- Product-only changes: `git diff --check`.
- Skill/runtime changes: focused skill, SkillDraught, supergem, or progression contracts plus Browser proof when required by the bead.

## Child DOX Index
- None.
