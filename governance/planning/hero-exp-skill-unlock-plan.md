# Hero EXP spending and skill unlocks — proposal for review

Status: **proposed, not approved for implementation**. This plan changes progression; it does not change the approved effects, targeting, cooldowns, or durations of the twenty hero skills.

## Why this changes

Today, enemy defeats are recorded once by enemy UID. At settlement, every participating hero receives the full battle EXP total; a KO'd participant still receives it. `awardHeroEXP` immediately consumes each level threshold, and the Hero screen shows the leftover EXP. All five active skills are available at level 1. The current threshold is `ceil(100 × level^1.5)`, with a level cap of 99 and 25 EXP per enemy when no enemy-specific value is supplied. Quests and Gold currently add no hero EXP.

The [Legend of Mushroom skill guide](https://legendofmushroom.ru/books/4-snariazenie/page/navykiskilly-kak-ix-otkryt-i-prokacivat) describes skill capacity increasing during progression up to five. That supports a staggered reveal, but does not establish Wishfire's levels or EXP economy. The milestones below are Wishfire proposals.

## Proposed player contract

- Level 1: each hero has a basic attack and no active skill. Basic attacks continue automatically when a living enemy is in range.
- Defeating an enemy banks its EXP once for every battle participant. Settlement, retry recovery, and save/load retain the existing exactly-once reward rules. An unused hero earns none.
- EXP is held **per hero** until the player selects **Spend EXP** on that hero's Hero screen. One press buys all levels currently affordable, subtracting each level's cost in order and carrying the remainder. This is a level purchase, not an EXP cost on each skill cast. Skill unlocks are automatic rewards of purchased levels; no skill points, SP, FLOW, draw, or random unlock step is added.
- The hero's level and stats change only when EXP is spent. A KO'd hero remains KO'd; a living hero gains the increase in maximum HP without a full heal. At level 99, the EXP meter reads **MAX** and later EXP is discarded.
- Unlocks become eligible for auto-cast on the next normal scheduling opportunity. They never interrupt a cast or create catch-up attacks. The basic attack remains available throughout.

## Proposed unlock schedule

Milestones use the current EXP curve. Cumulative EXP assumes starting at level 1 with zero EXP; enemy counts use the 25-EXP fallback and are pacing estimates, not target kill quotas. The skill order puts simple, visible actions first and more conditional or broad effects later.

| Unlock level | Cumulative EXP | Approx. default enemies | Fara (Falie) | Hondo (Huun) | Runa (Runa) | Kaja (Kojonn) |
| --- | ---: | ---: | --- | --- | --- | --- |
| 2 | 100 | 4 | Challenge Bolt | Ambush | Frost Reversal | Quickload |
| 3 | 383 | 16 | Shield Slam | Cheap Shot | Hex Beacon | Wishgrant |
| 4 | 903 | 37 | Shield Relay | Razor Sweep | Burn Sigil | Patchwork |
| 6 | 2,822 | 113 | Brace | Piercing Throw | Null Field | Split Feed |
| 8 | 6,145 | 246 | Retaliation Burst | Finish the Job | Return Gate | Fortune's Blessing |

The fifth unlock's pace must be checked against actual enemy EXP values and stage clear times before these numbers become final. Bosses should use authored `expValue` if one exists; no new boss bonus is assumed here.

## Hero screen and feature descriptions

- Each hero gets an independently filled EXP meter, explicit **Banked EXP / cost to next level**, level number, and a **Spend EXP** button. When enough EXP is banked, the meter stays full while the numeric bank continues above the threshold. The button preview states the resulting level and any skill unlocks. When short, show the exact EXP still needed.
- Show all five named skills from day one as a visible progression path. Locked cards show **Unlocks at Lv. N** and the full description. Unlocked cards show **Available**. A press or tap opens the same details for either state.
- Each detail includes a plain-language effect and magnitude, target/area, useful auto-cast condition, cooldown, duration, and what happens when there is no useful target. Use the canonical skill definition as the source; write player-facing wording where the current description omits a condition. For example, **Quickload** should say whom it picks, that the ally fires every 0.4 seconds for 4 seconds, and that it waits when no ally is engaged.
- When one spend unlocks multiple skills, present each newly unlocked skill in level order with its effect summary. The Hero screen remains the permanent place to inspect them. Mark the next locked skill and its level beside the EXP meter.
- Label Kaja's basic attack separately from his five ally-support skills. Keep display names Fara, Hondo, Runa, Kaja and internal save keys Falie, Huun, Runa, Kojonn.

## Implementation sequence after approval

1. **Progression and saves:** separate earning EXP from spending it in the hero progression owner. Preserve existing `currentLevel`, equipment, HP, earned rewards, and carried EXP during a versioned save migration. Derive unlocked skills from level rather than storing a second unlock ledger. Existing saves below a gate would use their current level under the new schedule; review this migration effect before implementation.
2. **Combat gate:** add `unlockLevel` to each active definition. Filter scheduled skills by the hero's purchased level, and enforce the same gate at direct cast and reaction entry points, including Retaliation Burst. Do not gate basic attacks or change approved skill behavior.
3. **Hero UI:** render the banked EXP meter, spend preview/action, next unlock, locked cards, and complete feature descriptions. Persist spend and earned EXP atomically so reload cannot duplicate rewards or levels.
4. **Player guide:** update `player-living-guide.md` only after the schedule and spending rule are approved. Retire its current “all five available from the start” sentence and explain the new earn/spend/unlock loop.

## Acceptance proof

- At level 1, all four heroes use basics and no active skills. At each milestone, exactly the named skill unlocks for the correct hero; locked direct casts and reaction paths fail closed.
- Enemy reward sources (basic, skill, counter, damage over time, boss) credit once. Victory, defeat/retry, continuous wave settlement, and reload neither duplicate nor lose banked EXP. KO'd participants earn EXP; unused heroes do not.
- Spending 100 EXP at level 1 reaches level 2 and unlocks the first skill; spending a large bank crosses several levels, unlocks each milestone once, and retains the correct remainder. Stats and HP follow the existing level-up rule. Level 99 cannot spend or unlock again.
- The ordinary Hero screen visibly shows all four heroes' separate meters and skill descriptions at locked, affordable, unlocked, and capped states. Validate one mobile viewport and one desktop viewport in the in-app Browser, plus focused progression and combat tests.

## Decisions requested

Approve or revise: **(1)** levels 2/3/4/6/8 and the named skill order, **(2)** one-tap spending of all affordable levels, and **(3)** level-derived unlocks for existing saves below the gates. No runtime or player-guide change should begin before those decisions are settled.
