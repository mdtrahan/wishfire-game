# Wishfire Player Living Guide

## Combat

Fara, Hondo, Runa and Kaja roam together through a three-screen arena to clear six spaced enemy packs. HERO opens a Formation modal with eight slots arranged as two centered slots above four, with two centered slots below. Any hero can occupy any slot from level 1; four slots remain empty with the current roster. Drag a hero or tap the hero and its destination, then Save. Presets, Copy and Undo preserve that placement. The board spans 105.6 world units between the outer middle-row centers and travels as one rigid unit. Each hero can ease up to 1.6 world units from a 32-unit slot center while keeping ally circles separate. Its slot stays fixed around the center through direction changes. Heroes face their closest living enemy, using horizontal movement when the field is empty. Fara leads by default; Formation can select another camera leader, with living successors in board order. Ordinary travel stays in the central patrol band. The chosen distant enemy approaches when the squad reaches its bounded search point. Enemy packs retain their seeded clouds, weak lone Goblocs and Skeletons, and at least 200 logical pixels between pack footprints. Nearby enemies can attack independently within their delivery ranges and may overlap. Recovery restores the saved formation at the arena midpoint before a short seeded opening walk. Each hero fires on its own clock. Bosses move inside their existing local bounds.

Each hero independently prefers the closest living enemy in any direction. Basic attacks reach one visible-screen width from that hero. Specials keep larger authored ranges and reach at least 211.2 world units from the hero's slot center. Every hero attack can reach an active boss. Party-wide support Specials keep their whole-party effect. Attacks wait ready while no eligible target is available.

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

Each hero earns up to eight stars through Star Up on HERO. Stars cost that hero's own Hero Tickets: 50 for the first, rising by 50 per star. Every star adds 2% to that hero's HP, ATK, DEF, MATK and RES, reaching 16% at eight stars. Stars 1–2 belong to Special, 3–4 to Passive, 5–6 to Resonance 1 and 7–8 to Resonance 2. Star 1 adds 10% Special damage/healing magnitude. Star 2 multiplies Special cooldown by 0.92. Stars 3 and 4 each add 15% Passive magnitude, for 30% total, with the same activation conditions, duration and cadence. Existing combat caps still apply. Stars 5–8 say “Unlocks with Resonance crystals” and add no skill effect while those slots remain empty. The Resonance tab has two empty future crystal slots with no source or stat effect. Gear retains an empty Accessory slot for Orb, also without a source.

Gold buys equipment from the shop. Purchased gear enters the shared inventory under Hero → Gear. A hero can equip a Weapon, Head, Armor, Boots and two Accessories; their stats affect that hero in combat. Shop offers expire in real time and are reconstructed when you return.

## Places

Quests provide story and combat encounters. The HERO screen shows owned heroes and their progression. Vault and other navigation remain available where implemented.

The equip cache groups items by rarity, highest first, then CP within each rarity. Lamp storage starts at 20 slots and grows faster at higher levels. Lamp upgrades require four Essence purchases; each notch starts at 100 Essence and grows about 20% per lamp level. The fourth starts seven hours of construction; the level completes automatically when that timer expires. SPD UP ALL spends available five-minute tickets to shorten construction. Banked Essence alone grants no lamp levels. Lamp Auto keeps its saved ON state while the cache is full, resumes after Dismantle All frees space, and turns off when you explicitly toggle it off or exit battle.
