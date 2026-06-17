# Hero and Party Skills

Purpose: define the canon hero-skill pool for a skill draw system in the roguelite pattern. Use this as reference for skill-pool composition, hero-specific draw identity, and future design alignment.

Companion pseudocode:
- [hero-and-party-skill-pseudocode.md](/Users/Mace/Codex-Orka/governance/product/hero-and-party-skill-pseudocode.md)
- [vault-progression.md](/Users/Mace/Codex-Orka/governance/product/vault-progression.md)

## Affinity Notes

Affinity is a passive hero-definition lane tied to a hero's core identity.
It is not a combat meter or a separate in-battle progression track.
Affinity exists to strengthen each hero's identity outside of live skill draws.
Players increase Affinity through relics and related progression rewards.
Those upgrades deepen the hero's built-in affinity effect rather than adding a new combat subsystem.

## Skill Card Draw Classes

Every live skill-card definition must declare one runtime draw class. The class tells designers, QA, and implementation whether the card should stay in the draw pool after selection, whether selecting it can increase future power, and what repeated appearances mean to the player.

Use the class as the first decision when assigning a new skill, tuning its performance, and writing runtime draw tests.

| Class | Draw behavior | Runtime meaning | Example |
| --- | --- | --- | --- |
| `one_off` | Can appear once per combat session. After the card is exposed or selected, remove it from normal and forced draw candidates for that session. | Selection enables a session effect or unlocks a rule once. Duplicate entries should not be possible through normal draw. Dev/test activation should be idempotent. | `party_destiny` |
| `tiered` | Can continue appearing after selection until its cap. | Each selection increases a rank, stack, shield value, chance, duration, or other additive value. The skill must define its stacking formula and cap. | `party_grow` |
| `repeatable` | Can continue appearing after selection. | Each selection fires the payload once. It does not add a persistent duplicate rank, multiplier, or bonus unless the skill also defines a separate tiered state. | `party_magic_fruit` |

Required definition fields for live draw skills:

- canonical skill ID and owner
- draw class: `one_off`, `tiered`, or `repeatable`
- trigger and eligibility
- selection behavior: activate, stack, or fire-and-clear
- redraw behavior after selection
- proof cue: counter, state entry, visual, trace, or deterministic contract

Class rules prevent duplicate ambiguity. If an exposed or selected skill should disappear from the skill-card draw for the rest of the session, it is `one_off`. If repeated selection should improve the skill, it is `tiered`. If repeated selection should simply run the same payload again, it is `repeatable`.

## Falie - Tank

Hero Promise: Redirect pressure, survive the worst of it, and punish enemies for overcommitting.
Affinity Color: Red
Affinity Promise: Red matches make Falie harder to break and more dangerous to pressure.
Suggested passive shapes:
- Red match slightly reduces incoming damage for a short time.
- Red match slightly improves retaliation effects.
- Red match briefly strengthens ally-cover behavior.
Archetype: `ROOK` | Latent potential vs forced destiny.

1. `Ward Bash`: Chance to randomly counterattack enemy
   - Card Text: Counterattack with a ward strike after taking a hit.
   - Risk: `LOW`
   - Note: Usually safe unless proc frequency is too high.
   - Growth: `6% / 6% / 7% / 8% (27%)`
   - Proc Pattern: On defend.
   - Short Session: `Keep in draw.`
2. `Cover / Block`: Chance to receive damage for ally
   - Card Text: Step in and take a hit for an ally.
   - Risk: `MED`
   - Note: Risk rises with mitigation and retaliation stacking.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On ally hit.
   - Short Session: `Situational draw.`
3. `Reprisal / Bounce`: Chance to reflect damage to enemy
   - Card Text: Reflect part of the damage back to the attacker.
   - Risk: `MED`
   - Note: Large hits and multihit bosses can overfeed this.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On defend.
   - Short Session: `Keep in draw.`
4. `Phalanx`: Chance to deny percent damage taken
   - Card Text: Cut down a portion of heavy incoming damage.
   - Risk: `HIGH`
   - Note: Percent denial can trivialize boss spikes.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On heavy hit taken.
   - Short Session: `Keep in draw.`

Live Draw Core: `Ward Bash`, `Cover / Block`, `Reprisal / Bounce`, `Phalanx`
Sharpen: Keep each answer distinct by threat type: ally protection, counter-punish, and anti-spike defense.
Vault Lean: `Crusade`, `Protect`, `Shell`, `Formless`

## Huun - Melee DPS

Hero Promise: Burst hard, exploit momentum, and turn fast play into kill pressure.
Affinity Color: Yellow
Affinity Promise: Yellow matches turn Huun’s opportunism into stronger payoff.
Suggested passive shapes:
- Yellow match slightly improves the next attack.
- Yellow match slightly increases burst/finisher output.
- Yellow match slightly improves gold payout or reward conversion.
Archetype: `KING` | Optimization under decay and constant risk calculus.

1. `Bell`: Chance for Swipe to deal 2x damage to 1 enemy
   - Card Text: Slam one enemy with a much stronger finishing hit.
   - Risk: `MED`
   - Note: Burst spikes if Swipe scaling is already high.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On combo finisher.
   - Short Session: `Keep in draw.`
2. `Glare`: Chance to push random enemy turn +2
   - Card Text: Push an enemy back in the turn order.
   - Risk: `MED`
   - Note: Repeated turn push can become soft lock.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On attack.
   - Short Session: `Keep in draw.`
3. `Trinity`: Chance to triple attack up
   - Card Text: Unleash a burst of repeated attacks.
   - Risk: `HIGH`
   - Note: Extra actions scale too well with all offense.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On combo finisher.
   - Short Session: `Keep in draw.`
4. `Growth`: Chance to convert damage percent to Astral Flow
   - Card Text: Turn dealt damage into Astral Flow.
   - Risk: `HIGH`
   - Note: Damage into resource can snowball fast.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On damage dealt.
   - Short Session: `Keep in draw.`

Live Draw Core: `Bell`, `Glare`, `Trinity`, `Growth`
Sharpen: Keep burst, turn disruption, and Astral Flow momentum separate so one lane does not eat the others.
Vault Lean: `Rabbithole`, `Consume`, `Scout`, `Steal`

Yellow Supergem: `Goldstrike`
- Trigger: Huun is the active hero and the player spends a yellow supergem.
- Payload: Huun converts the consumed yellow board value into a single-enemy strike.
- Damage basis: `current banked gold before award + yellow gems consumed by the supergem action`.
- Roll table: `0-50` deals base damage; `51-99` deals base damage x3; exact `100` deals 100 damage to all enemies.
- Example: bank `15g` plus `10` consumed yellow gems deals `25` on a low roll, `75` on a high roll, or `100` to all enemies on a perfect roll.

## Runa - Magic DPS

Hero Promise: Warp the rules of combat through spell pressure, conversion, and persistent magic effects.
Affinity Color: Blue
Affinity Promise: Blue matches deepen Runa’s spell flow and magical pressure.
Suggested passive shapes:
- Blue match slightly improves spell-linked effects.
- Blue match slightly strengthens totems or magic pressure.
- Blue match slightly improves blue-result efficiency without accelerating draw too much.
Archetype: `KNIGHT` | Chaotic breakthroughs and narrative pivots.

1. `Aura Totem: Blast`: Chance to drop a destructible melee DoT totem at 1/10 sec
   - Card Text: Summon a totem that deals melee damage over time.
   - Risk: `HIGH`
   - Note: Persistent damage can scale out of band.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On attack.
   - Short Session: `Keep in draw.`
2. `Aura Totem: Burn`: Chance to drop a destructible magic DoT totem at 1/10 sec
   - Card Text: Summon a totem that deals magic damage over time.
   - Risk: `HIGH`
   - Note: Persistent damage plus magic scaling risk.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On attack.
   - Short Session: `Keep in draw.`
3. `Invert`: Chance to swap self ATK / enemy RES
   - Card Text: Switch an enemy's physical attack and magic resistance to weaken them and deal more magic damage.
   - Risk: `HIGH`
   - Note: Stat swap is highly breakable.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On special trigger.
   - Short Session: `Keep in draw.`
4. `Intensify`: Chance to 2x heal / red match effects
   - Card Text: Double the payoff of red fire matches.
   - Risk: `HIGH`
   - Note: Broad multiplier on sustain and offense.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On red fire match.
   - Short Session: `Keep in draw.`

Live Draw Core: `Aura Totem: Blast`, `Aura Totem: Burn`, `Invert`, `Intensify`
Sharpen: Keep piercing, stat-bending, and persistent spell pressure as separate magic lanes.
Vault Lean: `Inspire`, `Ignore`, `Insight`

## Kojonn - Support

Hero Promise: Rig the flow of battle by reshaping resources, boosting allies, and forcing favorable timing.
Affinity Color: Green
Affinity Promise: Green matches improve Kojonn’s setup and support shaping.
Suggested passive shapes:
- Green match slightly improves ally support effects.
- Green match slightly strengthens control/setup outcomes.
- Green match slightly improves board shaping or buff quality.
Archetype: `PAWN` | Inevitability arc and transformation payoff.

1. `Lock`: Chance to use gems at no cost
   - Card Text: Use a gem action without paying its cost.
   - Risk: `HIGH`
   - Note: Cost bypass can break pacing immediately.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On gem use.
   - Short Session: `Keep in draw.`
2. `Lift`: Chance to buff ally ATK (2x)
   - Card Text: Greatly increase an ally's physical damage.
   - Risk: `HIGH`
   - Note: Flat doubling is a major multiplier.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On ally attack.
   - Short Session: `Keep in draw.`
3. `Step`: Chance to pull ally turn ahead x num of slots
   - Card Text: Move an ally forward in the turn order.
   - Risk: `HIGH`
   - Note: Turn acceleration can create loop play.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On ally action.
   - Short Session: `Keep in draw.`
4. `Elevate`: Chance to increase ally amp (+1)
   - Card Text: Raise an ally's effect power to the next tier.
   - Risk: `HIGH`
   - Note: Amp escalation compounds too easily.
   - Growth: `2% / 2% / 3% / 3% (10%)`
   - Proc Pattern: On special trigger.
   - Short Session: `Keep in draw.`

Live Draw Core: `Lock`, `Lift`, `Step`, `Elevate`
Sharpen: Keep cost bypass, turn control, and ally amplification as clearly different support promises.
Vault Lean: `Scrolls`, `Exchange`

## Party Skills

Party Promise: Smooth the run, create short burst windows, and rescue weak states without becoming a permanent aura stack.

1. `Fresh Start`: Chance for the first few turns of combat to be slightly stronger
   - Card Text: Start combat with a small burst of power.
   - Risk: `LOW`
   - Note: Frontloaded power is easy to tune and contain.
   - Growth: `6% / 6% / 7% / 8% (27%)`
   - Proc Pattern: On battle start.
   - Short Session: `Keep in draw.`
2. `Second Chance`: Chance for a bad board state to reroll a few gems
   - Card Text: Reroll part of a weak board into a better setup.
   - Risk: `MED`
   - Note: Can over-stabilize weak boards if too frequent.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On weak board state.
   - Short Session: `Keep in draw.`
3. `Momentum`: Chance for a strong turn to slightly boost the next turn
   - Card Text: Carry one strong turn into the next.
   - Risk: `MED`
   - Note: Can snowball if it chains too easily.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On combo finisher.
   - Short Session: `Keep in draw.`
4. `Guard Rail`: Chance to soften a large incoming hit
   - Card Text: Reduce the impact of a dangerous hit.
   - Risk: `MED`
   - Note: Strong safety valve if threshold is too generous.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On heavy hit taken.
   - Short Session: `Keep in draw.`
5. `Blue Spark`: Chance for blue gain to spill a small bonus into the party
   - Card Text: Turn blue water gains into a bonus for the whole party.
   - Risk: `MED`
   - Note: Resource spillover can snowball with blue-focused builds.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On blue water match.
   - Short Session: `Situational draw.`
6. `Weaken`: Chance for Faze to decrease enemy DEF
   - Card Text: Lower enemy defense so your hits land harder.
   - Risk: `MED`
   - Note: Gets stronger in burst-stacked teams.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On special hit.
   - Short Session: `Keep in draw.`
7. `Destiny`: Chance for hero attacks to heal the source hero
   - Card Text: Attacks have a chance to restore 2.5% health on impact.
   - Draw Class: `one_off`
   - Risk: `MED`
   - Note: Can erase attrition if always on.
   - Growth: `32% proc chance`
   - Proc Pattern: On hero hit against an enemy with positive applied damage.
   - Short Session: `Remove from draw once exposed or selected.`
8. `Hot Streak`: Chance for consecutive matches to increase reward or effect slightly
   - Card Text: Build up a better payoff with consecutive matches.
   - Risk: `MED`
   - Note: Reward loops can scale fast in high-consistency runs.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On consecutive matches.
   - Short Session: `Situational draw.`
9. `Last Push`: Chance for low party HP to trigger a brief comeback bump
   - Card Text: Gain a brief comeback burst when the party nears defeat.
   - Risk: `MED`
   - Note: Good comeback tool; watch abuse near threshold play.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On low party HP.
   - Short Session: `Keep in draw.`
10. `Chain Pop`: Chance for a match to trigger a small extra board effect
   - Card Text: Trigger an extra board effect from a match.
   - Risk: `MED`
   - Note: Board-effect chaining can become too consistent.
   - Growth: `4% / 4% / 5% / 5% (18%)`
   - Proc Pattern: On match.
   - Short Session: `Keep in draw.`
11. `Grow`: Grow all living heroes: more power, less Max HP.
   - Card Text: Grow all living heroes: more power, less Max HP.
   - Draw Class: `tiered`
   - Risk: `HIGH`
   - Note: Deterministic glass-cannon specialization. Grow trades survivability capacity for offensive power; it never rolls acquisition and never reduces DEF or RES.
   - Growth: `+8% / +14% / +20% Power Amp`
   - Tradeoff: `-8% / -14% / -20% Max HP`
   - HP Handling: Recalculate Max HP and Current HP proportionally when acquired or tiered up, using existing HP rounding conventions. Grow is a stat conversion, not a damage event.
   - Proc Pattern: On selection; all living heroes immediately receive or advance Grow with no RNG gate, miss, or sequential acceptance presentation.
   - Short Session: `Tier up to 3 selections, then remove from draw.`

Active Runtime Draw Pool: `party_crimson_ward`, `party_magic_fruit`, `party_destiny`, `party_faze`, `party_grow`
Sharpen: Favor board rescue, short bursts, and comeback windows over passive smoothing.
Vault Lean: `Lucky Break`, `Clean Slate`

## Vault Skills

1. `Crusade`
   - Card Text: Draw enemy attacks toward your frontline.
   - Risk: `LOW`
   - Note: Mostly role identity; watch permanent taunt uptime.
   - Growth: `6% / 6% / 7% / 8% (27%)`
2. `Protect`
   - Card Text: Take less damage from physical attacks.
   - Risk: `LOW`
   - Note: Narrow mitigation is usually safe.
   - Growth: `6% / 6% / 7% / 8% (27%)`
3. `Shell`
   - Card Text: Take less damage from magical attacks.
   - Risk: `LOW`
   - Note: Narrow mitigation is usually safe.
   - Growth: `6% / 6% / 7% / 8% (27%)`
4. `Formless`
   - Card Text: Negate damage over time before it ticks.
   - Risk: `MED`
   - Note: Can invalidate attrition lanes if too reliable.
   - Growth: `4% / 4% / 5% / 5% (18%)`
5. `Rabbithole`
   - Card Text: Gain extra gold from your matches and wins.
   - Risk: `LOW`
   - Note: Low combat risk; watch economy scaling.
   - Growth: `6% / 6% / 7% / 8% (27%)`
6. `Consume`
   - Card Text: Break enemy healing and turn it into gain.
   - Risk: `MED`
   - Note: Can hard-counter healer enemies.
   - Growth: `4% / 4% / 5% / 5% (18%)`
7. `Inspire`
   - Card Text: Increase your party's magic resistance.
   - Risk: `LOW`
   - Note: Usually safe unless stack rate is high.
   - Growth: `6% / 6% / 7% / 8% (27%)`
8. `Scrolls`
   - Card Text: Increase your party's magic power.
   - Risk: `MED`
   - Note: Safe early; scales up in long fights.
   - Growth: `4% / 4% / 5% / 5% (18%)`
9. `Scout`
   - Card Text: Increase your damage by adding a random enemy's speed to your attacks.
   - Risk: `MED`
   - Note: Fast enemies can make this spike hard.
   - Growth: `4% / 4% / 5% / 5% (18%)`
10. `Steal`
   - Card Text: Turn blue water progress into attack power.
   - Risk: `HIGH`
   - Note: Strong self-feeding stat loop risk.
   - Growth: `2% / 2% / 3% / 3% (10%)`
11. `Ignore`
   - Card Text: Let your earth matches punch through enemy magic resistance.
   - Risk: `MED`
   - Note: Strong if full bypass is reliable.
   - Growth: `4% / 4% / 5% / 5% (18%)`
12. `Insight`
   - Card Text: Increase your magic power by adding enemy magic attack to your red fire attacks.
   - Risk: `HIGH`
   - Note: Enemy stat borrowing can explode on bosses.
   - Growth: `2% / 2% / 3% / 3% (10%)`
13. `Lucky`
   - Card Text: Reshape blue water gems into green earth gems.
   - Risk: `MED`
   - Note: Can over-stabilize desired board colors.
   - Growth: `4% / 4% / 5% / 5% (18%)`
14. `Exchange`
   - Card Text: Steal power from a stronger enemy and turn it against them.
   - Risk: `MED`
   - Note: Swingy against elite-stat enemies.
   - Growth: `4% / 4% / 5% / 5% (18%)`
15. `Lucky Break`
   - Card Text: Gain a small extra reward from a match.
   - Risk: `LOW`
   - Note: Low combat risk; watch reward inflation.
   - Growth: `6% / 6% / 7% / 8% (27%)`
16. `Clean Slate`
   - Card Text: Clear one harmful effect from the party.
   - Risk: `LOW`
   - Note: Usually safe unless cleanse coverage becomes too broad.
   - Growth: `6% / 6% / 7% / 8% (27%)`
