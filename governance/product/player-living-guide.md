# Wishfire Player Living Guide

## Combat

Fara, Hondo, Runa and Kaja roam together through a three-screen arena to clear six spaced enemy packs. Their ordinary travel stays in a central horizontal patrol band while the camera follows across the arena. Enemies retain the full field: when the squad reaches its patrol approach point, the selected distant group moves into reach, including ranged enemies waiting beyond the patrol. Boss fights use their own local formation bounds. Seeded pack clouds stay loose, with at least 200 logical pixels between their full footprints; weaker lone Goblocs and Skeletons wander through the gaps. After their existing weak-CP scaling, lone enemies have half HP, rounded up to at least one, and keep their other scaled stats. At fresh entry and after full-squad recovery, the party forms at the arena midpoint and makes a seeded short walk to the left or right, with Fara and Hondo leading and Runa and Kaja behind. An enemy entering anyone's actual attack reach, or an incoming enemy attack already in flight, hands movement to normal combat. Each living hero runs to melee contact or stops at ranged reach, then fires basics and unlocked active skills automatically when their cooldowns are ready and the skill has a useful target. Nearby enemies notice the squad within about 230 logical pixels or when they can reach a hero; other remote packs stay dormant while the squad approaches its selected group. Every nearby enemy joins from its own delivery range, so local groups can attack together without a count cap. Each ordinary wave also places one weaker lone enemy in every sector; it wanders by itself until the party approaches and counts toward that sector's clear. Heroes and enemies act on their own clocks. Combat has no turns, action slots, gem matching, SP or FLOW.

Ordinary hero attacks retain a living focus while that enemy remains within the hero’s current reach. Area skills use their own targeting rules from the caster’s current position. Enemies attack a living hero after spatial contact unless a skill redirects or covers that attack. An attack with no eligible target waits ready.

When an ordinary pack's total CP is below the full deployed party's total CP, it receives one, two or three extra enemies from a single seeded random roll. Those enemies keep the pack's existing scaled strength. Bosses keep their single-enemy layout.

Continuous combat advances by chapter, with one stage/checkpoint and one boss at the end of each chapter. Chapter 1 has 10 waves and Chapter 2 has 15. Chapters 3 onward have 20 waves except every fifth chapter, which has 5. The combat UI labels the current chapter as Chapter N. Five-wave chapters may use three packs/sectors and 1.5× enemy HP; both are provisional candidates. A passive recovery rate of 1.5% max HP per second and filling gear max-HP increases are also provisional runtime candidates, not accepted player-facing rules.

The adventure bar shows ordinary-wave progress and the active Chapter N. Clearing all waves in a chapter earns its boss encounter; each chapter has one boss, and victory advances to the next chapter. Heroes keep their HP between waves and on boss entry. Defeating a boss restores the whole party to full HP, revives KO heroes and clears their debuffs before the next chapter. During ordinary roaming, the first deployed hero to reach zero HP ends the attempt. The full squad revives, clears debuffs and returns at the midpoint of the arena in its authored huddle with a shared brief fade. Recovery keeps the same chapter, wave and earned cleared packs; unfinished packs return with a fresh seeded loadout and the current party’s CP compensation is recalculated. Reload keeps earned progress, so each pack counts once. The recovery moat remains centered on the huddle while packs stay spread across the rest of the arena. Boss attempts use a fixed 30-second timer; surrender and defeat retain their recovery behavior. Defeat costs no resource.

## Heroes

Each hero has individual HP, stats, level, EXP and equipment. Heroes begin at level 1 with zero EXP. Basic attacks and the first active are available at level 1; the remaining actives unlock at levels 5, 10, 15 and 25 under the current configurable milestone schedule. Levels and gear increase their power.

| Hero | What they do |
| --- | --- |
| Fara | Absorbs pressure, covers allies, provokes attackers and pushes groups away with Shield Slam. |
| Hondo | Exploits vulnerable enemies with precise hits, piercing throws and area sweeps. |
| Runa | Shapes enemy space with magic circles, forced retreat and Return Gate teleportation. |
| Kaja | Fires a separate basic magic attack and gives allies damage, speed, splash, healing and a short random-stat blessing. His five active skills target allies. |

Each skill waits when its target or trigger would have no useful effect. Effects and cooldowns count seconds of active combat. Pausing or backgrounding the game freezes combat until play resumes.

## Progression and Gold

Defeated enemies grant Gold and EXP once. Participating heroes receive the full EXP value even if they finish KO'd; unused heroes receive none. Newly acquired heroes start at level 1 with zero EXP. Level-ups raise stats. Living heroes gain the increase in maximum HP without a full heal, and KO heroes stay at zero HP. The current level cap is 99.

Gold buys equipment from the shop. Purchased gear enters the shared inventory under Hero → Gear. A hero can equip a Weapon, Head, Armor, Boots and two Accessories; their stats affect that hero in combat. Shop offers expire in real time and are reconstructed when you return.

## Places

Quests provide story and combat encounters. The HERO screen shows owned heroes and their progression. Vault and other navigation remain available where implemented.

The equip cache groups items by rarity, highest first, then CP within each rarity. Lamp storage starts at 20 slots and grows faster at higher levels. Lamp upgrades require four Essence purchases; each notch starts at 100 Essence and grows about 20% per lamp level. The fourth starts seven hours of construction; the level completes automatically when that timer expires. SPD UP ALL spends available five-minute tickets to shorten construction. Banked Essence alone grants no lamp levels. Lamp Auto keeps its saved ON state while the cache is full, resumes after Dismantle All frees space, and turns off when you explicitly toggle it off or exit battle.
