# Governance Product DOX

## Purpose
- Own Wishfire gameplay truth, player-facing explanations, hero/party skill design, progression intent, and known design boundaries.

## Ownership
- `player-living-guide.md` is the player-facing source for how Wishfire works.
- `hero-and-party-skills.md`, `hero-and-party-skill-pseudocode.md`, and `skill-bead-map.md` own skill design, implementation-start language, and bead mapping.
- `combat-vfx-index.md` owns the attack-to-impact visual inventory, completion gates, and preserve list for combat effects.
- `vault-progression.md` owns Vault/relic passive progression lanes.
- `../../inputs/design/idle-stage-migration-atlas/` holds the owner-approved planning reference. It does not authorize runtime changes or override current implementation contracts.
- Historical supergem and skill isolation docs retain the retired gem/card rules for reference.

## Local Contracts
- The player guide changes only when the user asks for it to change.
- The approved combat contract has four heroes in a tight roaming formation with independent basic attacks and five auto-active skills each. Actors act on independent cooldowns; effects use seconds. There are no playable turns, action slots, gem matches, SP or FLOW in supported combat. The root combat cleanup plan owns the approved skill tables during migration.
- Ordinary waves carry hero HP and KO state forward. Clearing a boss fully restores and revives the party, removes harmful statuses and keeps beneficial effects.
- The player guide describes the approved player-facing combat. Runtime migration remains in progress. Historical hero-and-party skill documents retain paused content only.
- Affinity is passive and progression-facing. It is not a combat meter or separate in-battle progression track.
- Vault/relic passives remain a separate progression layer.
- Preserve Falie, Huun, Runa and Kojonn as internal save keys while displaying Fara, Hondo, Runa and Kaja.
- Kaja's five active skills target allies; his separate basic attack targets an enemy.
- Every nearby enemy can engage a living hero within its delivery range across pack boundaries; party focus never caps simultaneous attackers. Heroes clear all local threats before roaming onward.

- Ordinary pack count compares final scaled pack CP with full deployed party CP, including KO members. A weaker pack gains a single seeded +1/+2/+3 count adjustment at construction; equality, stronger packs and bosses keep their count.

## Work Guidance
- For new skill beads, require canonical skill ID, owner, target and useful-trigger rules, cooldown and duration in seconds, effect, and focused runtime and Browser proof.
- Keep invented or unresolved mechanics visibly marked; do not silently promote them to implementation truth.
- Use canonical names from product docs. Avoid duplicate aliases such as old placeholder skill names unless explicitly retired or mapped.
- When code contradicts product docs, report both current implementation and intended design before changing either.

## Verification
- Product-only changes: `git diff --check`.
- Skill/runtime changes: focused combat, progression and Browser proof required by the bead.

## Child DOX Index
- None.

- Progression correction: A clean approach through four completed waves automatically enters a boss. Each ordinary wave also has six seeded low-CP Gobloc/Skeleton solo enemies, one per sector; they wander alone until detected, count toward the sector's saved clear mask, and use a separate runtime encounter group from the pack. Ordinary roaming KO recovery keeps the current wave and each earned pack clear through reload, then respawns only unfinished packs. The squad returns at section B midpoint; ordinary packs keep their loose clouds outside a compact 150-logical-pixel-diameter recovery buffer, so nearby groups can engage sooner. Any stage KO and boss defeat preserve readiness and latch manual boss retry for that stage, including across reload and active attempts. Ready stages keep looping fodder waves at 100% until explicit Summon Boss; boss victory advances the stage and clears the latch. Lamp upgrades require four paid stages followed by seven-hour construction. Hero actives use canonical level gates, currently 1/5/10/15/25 as a configurable default.

- Lamp storage accelerates with level; four paid notches start at 100 Essence each and grow geometrically by 20% per level before seven-hour construction. Cache display orders rarity first, CP within rarity; Auto Equip retains its independent positive-CP comparison.
