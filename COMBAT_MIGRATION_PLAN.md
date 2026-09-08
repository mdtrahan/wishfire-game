# Hero-command combat and progression migration

Status: runtime implementation delivered in the owned migration worktree. This contract supersedes conflicting earlier plans and comments. `COMBAT_MIGRATION_REPORT.md` records current implementation evidence and release scope; `MIGRATION_CHECKPOINT.md` retains history.

## 1. Scope and superseded decisions

Replace every existing hero skill kit using the role templates below. The owner explicitly authorized wiping the old skills; preserving the former three-skill kits is no longer required. Preserve hero identities and their assigned roles. Build a data-driven progression system, individual EXP, staged unlocks, SP-based active skills and unique personal FLOW specials. Initial combat math and costs are tuning data.

Retire puzzle-board combat and shared AF milestones. Pause roguelite party-card acquisition and effects, retaining their historical content only where useful for later restoration. Remove their active combat dependencies. Do not add gacha commerce, catch-up progression, extra recruitable heroes or multi-hero combination systems in this migration.

Earlier direct role-based FLOW gain, empty-on-use SP, deferred SP regeneration, automatic retargeting, periodic-tick FLOW generation and legacy-skill preservation rules are superseded. The new SP economy is a configurable baseline, not final balance. No automatic role substitution for a smaller party: Kaja remains Comrade when alone.

## 2. Heroes and kit data

| Current hero | Role | FLOW archetype |
| --- | --- | --- |
| Fara | Tank | Stoic |
| Hondo | DPS / Fighter | Warrior |
| Runa | Debuffer / Controller | Tactician |
| Kaja | Support / Guardian | Comrade |

Each completed base kit has exactly seven active skills, six passives, one unique FLOW special and one basic attack. The charge archetype defines how FLOW is earned; it does not select the special's effect. Each current hero gets an individually defined special appropriate to that hero's role.

Use the supplied templates as behavior guidance. Names may be authored as part of this now-authorized replacement. Put effects and placeholder magnitudes in data; reuse established damage calculations. Do not add elaborate balance formulas.

| Role | Seven active behavior templates | Passive emphasis | Unique FLOW direction |
| --- | --- | --- | --- |
| Tank / Stoic | Guard, Provoke, Shield Bash, Cover, Counter Stance, defensive strike, Fortress | HP, DEF, threat, guarding, counters, survival | Protection, party cover, retaliation |
| Fighter / Warrior | Power Attack, Combo, Armor Break, Follow-Up, Heavy Blow, Finisher, offensive utility | ATK, critical hits, combo scaling, sustained damage | Offensive assault |
| Assassin / Slayer | Quick Strike, Mark, Backstab, Execute, poison/bleed, Ambush, Deathblow | SPEED, critical hits, execution, kill momentum | Single-target execution |
| Healer | Heal, Group Heal, Regen, Cleanse, Revive, Barrier, Emergency Heal | Healing, sustain, status resistance, recovery | Restoration/revival |
| Controller / Tactician | Weaken, Slow, Blind, Silence, DEF Down, Dispel, Lockdown | Status success, duration, resistance reduction, debuff synergy | Group control/debuff |
| Support / Comrade | ATK buff, DEF buff, Haste, Protect Ally, Rally, Cleanse, Team Barrier | Buffs, ally protection, rescue | Party empowerment/protection |
| Evasion Tank / Dancer | Quick Strike, Taunt, Dodge Stance, Riposte, Blind, Shadowstep, Flurry | Evasion, SPEED, dodge counters, threat | Evasion and counters while drawing attacks |
| Mitigation Tank / Rook | Guard, Protect, Damage Cut, Magic Ward, Intercept, Nullify, Reflect | DEF, RES, blocking, barriers, mitigation | Party mitigation/nullification |
| Berserker / Daredevil | Slash, Blood Strike, Reckless Attack, HP Sacrifice, Frenzy, Drain, Deathwish | Low-HP power, lifesteal, critical hits, survival | Risk/reward attack |
| Soloist / Loner | Strike, Self Heal, Self Buff, Counter, Survival Stance, Desperate Blow, Final Strike | Fallen-ally scaling, self-sustain | Last-stand attack |

Only the four current heroes require playable kits now. Other archetypes are supported role definitions, not authorization to create six more heroes.

Active data supports `skillId`, `displayName`, `description`, `unlockLevel`, `spCost`, `targetType`, `effectType`, `potency`, `duration`, `statusEffect`, optional cooldown, tags and upgrade data. Passives support ID, unlock level, trigger, conditions, effect, magnitude and tags. FLOW specials support unique ID, charge archetype, meter requirement, effects, target rules, scaling and upgrade data. Optional behavior flags are defined in the relevant sections below. Do not make optional fields mandatory when unused.

## 3. Levels, acquisition and EXP

Each persistent hero instance owns `currentLevel`, `currentEXP`, `EXPToNextLevel`, `maxLevel`, base stats, growth data and unlocked abilities. Newly acquired heroes start at level 1, EXP 0, unless explicitly configured otherwise. Existing heroes reset to level 1 and EXP 0 once during migration. Do not reset them again on reload or combat initialization. Acquisition never copies party level.

Central defaults:

| Setting | Placeholder |
| --- | --- |
| Maximum level | 50 |
| EXP needed from level L to L+1 | `100 × L^1.5` |
| Max SP | 100 |
| Starting SP | 100 |
| SP regeneration on own turn start | 5 |

Keep the EXP curve behind one data-backed lookup so a level table can replace the formula. Choose and document one consistent integer rounding rule during implementation. EXP represents progress toward the next threshold; subtract each threshold and continue checking for multiple level-ups. At maximum level, use a centrally defined cap state, stop accumulation and discard excess EXP. No EXP banking for future cap increases.

Victory reward is the sum of configured EXP values of defeated enemies. Every participating hero receives that full amount, including KO'd participants. Nonparticipants receive zero. Never divide the reward by party size. Record actual encounter participants and credited enemy defeats so duplicate callbacks cannot award EXP twice.

Victory order is strict:

1. Final enemy is defeated; victory is triggered immediately.
2. Cancel all unexecuted actions and refund their reserved SP.
3. End combat; no later healing, buffs, attacks or reactions run.
4. Award EXP once to participants.
5. Process all earned levels, stat growth and unlocks.
6. Show progression results, including EXP, levels, stat changes and newly unlocked abilities.

Per-hero data defines growth for HP, ATK, DEF, MAG, RES and SPD. Max SP growth may be supported as optional data; baseline SP need not grow. Avoid cumulative rounding drift by deriving level stats consistently from base/growth data.

On each level-up, living heroes receive `currentHP = min(newMaxHP, currentHP + newMaxHP - oldMaxHP)`. A hero at 0 HP remains at 0. Leveling never revives or fully heals. Recovery and revival have separate owners.

### Configurable unlock schedule

| Level | Unlocks |
| --- | --- |
| 1 | Basic Attack, actives 1–2, passive 1, FLOW special available |
| 5 | Active 3 |
| 10 | Passive 2 |
| 15 | Active 4 |
| 20 | Active 5, passive 3 |
| 25 | Passive 4 |
| 30 | Active 6 |
| 35 | Passive 5 |
| 40 | Active 7 |
| 45 | Passive 6 |
| 50 | Level cap; full base kit already unlocked |

Abilities declare their own configurable unlock levels. Generic progression evaluates them; combat must not hard-code level-to-skill branches. Locked abilities cannot be queued or executed. Do not implement catch-up items, training or account-level boosts.

## 4. SP and FLOW resources

SP and FLOW are independent balances. Fresh combat initializes full configured starting SP and FLOW 0. Personal FLOW ranges 0–100; no shared bar or milestones. KO and revival preserve FLOW. No charge is granted merely for entering combat.

Basic Attack costs 0 SP and is exclusive with a skill sequence. A FLOW special replaces the entire prepared sequence, costs 0 SP, consumes its full personal meter when it executes and spends one turn. A legality failure before execution consumes no FLOW. A rejected commit does not spend the turn; an accepted sequence that begins execution spends the turn even if all actions later become invalid.

Reserve/deduct the affordable total when a sequence commits. Final SP spending equals only executed actions' costs: 100 minus a 42-SP executed sequence leaves 58. Refund each action that never executes exactly once. A started, partially resolved or missed action remains paid. Clamp restoration/refunds to max SP and prevent duplicate settlement.

Initial cost bands are tuning guidance: basic/minor 0–10, light 11–15, standard 16–25, strong 26–35, major 36–45, exceptional 46–60. Aim provisionally for 4–6 standard or 2–3 major uses per full pool. Centralize max SP, starting SP, turn regeneration, costs and restoration effects.

Once at a living hero's actual turn start, after periodic effects and KO determination: `currentSP = min(maxSP, currentSP + passiveSPRegenPerTurn)`. Revival and counters do not grant turn-start regeneration. Party size and enemy speed cannot directly add regeneration events.

## 5. Turns, queues and targeting

Valid combat groups contain 1–6 actual heroes. Empty slots never create actors. Individual HP and stable hero identity persist through KO. SPEED determines scheduling. Haste/Slow updates future scheduling immediately while the current actor completes their sequence. Revival restores normal scheduling eligibility without a bonus turn or implicit initiative reset.

Each hero declares `actionSlotsPerTurn` independently of SP and known skills. Current kits use a configurable placeholder of 3; groups may mix capacities. At the hero's own turn start reset `remainingActionSlots`. Selecting a legal skill queues it immediately and reserves its SP, consuming one slot. Removing it restores the slot and reservation. At zero remaining slots, commit automatically during that hero's turn. ACT commits a nonempty legal queue early and discards unused slots. SP left over never adds actions. The CTB scheduler remains unchanged.

Battlefield enemy taps/clicks update persistent `SelectedEnemyUID`; the first living enemy is the default. There is no target dropdown. Each skill captures the current selection when queued. AoE captures its defined living group. Changing selection does not rewrite earlier queued actions.

Each queued action stores skill ID, its own target ID or target set, reserved SP cost and sequence order. A sequence may attack one enemy, heal an ally, then debuff another enemy. Validate actor, unlocks, tags/status restrictions, targets, repeat rules and full affordability at commit. Reject an unaffordable sequence without spending SP or the turn; do not silently truncate it.

An active skill is usable once per actor turn by default. Only an explicit `multiCast`/repeat flag permits repeat entries, with each use paid. Queued actions execute in authored order. Before each action, revalidate actor eligibility and targets:

| Condition before execution | Result |
| --- | --- |
| Single target invalid | Skip action; refund its full reserved cost |
| Some members of stored target set invalid | Filter invalid members; execute remaining set at full cost |
| All targets invalid | Skip action; refund full cost |
| Acting hero KO'd | Cancel remainder, refund unexecuted actions, end turn |
| Victory | Cancel remainder and refund before post-combat EXP |
| All committed actions skipped | Refund unexecuted costs; turn still ends |

Auto-retargeting is off by default. Only explicit `retargetOnInvalid = true` may change that behavior. Do not silently add new targets to a stored group target set.

Resolve an action's full skill, resulting counter/passive reactions and KO checks before the next queued action. Victory interrupts immediately, including during a multi-hit skill. Partially executed skills receive no refund. A new combat session invalidates old pending events.

## 6. Status and periodic effects

Default duration counts the affected unit's turns. Decrement at that unit's turn end and remove at 0. A self-buff applied during the current turn counts that turn: duration 1 expires at its end. Use duration 2 when it should also survive the next turn. Additional duration types remain future work.

Default reapplication keeps one instance, refreshes duration and retains the stronger magnitude. Only `stackable = true` permits stacking. An unchanged duration is not an actual refresh for FLOW accounting.

On KO, clear ordinary buffs/debuffs. Preserve only `persistsThroughKO = true`. FLOW remains untouched. Caster KO does not remove effects already applied to other targets; `requiresCasterActive = true` is an explicit exception.

DoT/HoT snapshots relevant caster potency at application in `snapshotPotency`. Ticks use that stored value throughout the effect's lifetime. Do not recalculate from later caster stats or buffs.

Turn-start order:

1. Resolve the entire same-phase DoT/HoT group together: `finalHP = clamp(startHP + totalHealing - totalDamage, 0, maxHP)`.
2. Determine KO from final HP; intermediate tick ordering cannot decide survival.
3. If alive, regenerate SP.
4. Resolve other turn-start effects and their consequences.
5. Allow action selection if still eligible.

Routine periodic ticks generate no FLOW. This applies to both caster rewards and ordinary damage/heal role triggers. Genuine outcome events, such as a DoT kill credited to Slayer, remain eligible; a KO'd source gains none. Keep source identity and FLOW-special ancestry attached to delayed effects. Future periodic-specific mechanics may explicitly opt in.

Silence blocks `magic`-tagged skills and FLOW specials at queue/execute checks. It does not inspect whether damage scales from MAG. `ignoresSilence = true` bypasses the restriction. Blind applies a configurable accuracy penalty only to `physical`-tagged actions unless `ignoresBlind = true`.

## 7. FLOW orb contract

This section supersedes direct role-based charge. Each hero retains a 100-point personal FLOW gauge. Combat events spawn orbs; only collection increases FLOW. SP spending and action capacity never generate charge.

A successful normal damaging action has a 35% chance of one 10-FLOW orb, capped at one base drop per action across all targets and hits. Each queued skill gets its own check. Data in `FLOW_ORB_TUNING` and skill fields supports `limitOrbDropChance`, `limitOrbValue`, `limitOrbDropCount`, `orbChancePer` (`action` or `hit`), `maxDropsPerAction`, `guaranteedDrops` and `limitOrbChanceBonus`. Guaranteed and random base drops share the configured base cap. Passive bonus drops are separate.

Each orb independently chooses a random living eligible hero, including heroes other than its generator. Full gauges remain eligible and clamp at 100, discarding excess. A recipient who becomes KO or ineligible before collection receives no charge; that flight dissipates. New encounters clear flights and begin at zero FLOW. FLOW-special ancestry excludes its caster from receiving its own generated orbs, including delayed descendants; other heroes remain eligible.

| Preserved passive name | Orb effect | Proc boundary |
| --- | --- | --- |
| Stoic | 25% chance of one bonus orb after hostile damage, including a lethal hit | Once per incoming action |
| Warrior | Basic Attack chance gains 15 percentage points, reaching 50% | Base action cap |
| Slayer | One guaranteed bonus orb plus 25% chance of a second | Per enemy killed |
| Healer | 30% chance of one orb after actual immediate HP restoration, including self/revival | Once per healing action |
| Tactician | 35% chance of one orb after a successful enemy debuff or actual refresh | Once per action |
| Comrade | 15% chance of one orb when another ally takes hostile damage | Once per enemy action |
| Dancer | 50% chance of one orb from actual defender evasion | Once per incoming action |
| Rook | 35% chance of one orb when owned mitigation prevents at least 1 damage | Once per incoming action |
| Daredevil | Add 25 percentage points to normal action chance at HP ≤25%, reaching 60% | Base action cap |
| Loner | Normal action chance becomes 70% while sole living hero | Base action cap; sole hero receives orbs |

All chances and the Rook minimum are centralized tuning. Role names and current assignments are preserved as orb passives. There is no simultaneous direct meter reward. Failed proc checks also consume that action's check. Rook credits the mitigation provider. Self/friendly/environmental damage is ineligible for Stoic, Comrade and Rook. Blind misses do not trigger Dancer. Pure HoT, overheal and routine periodic ticks create no orbs. A DoT kill can trigger living-source Slayer. Counters remain distinct actions and retain source exclusions.

Orbs pop from the damaged enemy (or the relevant passive event source), then travel to the randomly assigned hero's arena portrait. Collection occurs after 0.14 seconds of release and 0.38 seconds of flight; a 0.12-second arrival flash follows. Use the game's gem artwork with a red glow. These events never own a turn barrier, action slot, SP reservation or initiative change. Orb RNG uses its own runtime stream so proc rolls cannot alter later combat rolls. Full FLOW retains the existing ready indication and manually selected special command.

## 8. Accuracy, Provoke and Cover

Default multi-hit accuracy checks once per target for the skill. `accuracyPerHit = true` checks each hit independently. Blind modifies whichever accuracy checks are used.

Provoke forces eligible enemy single-target attacks onto the provoking hero. AoE is unaffected; `ignoresProvoke = true` bypasses it. Newest valid Provoke wins; when removed, expired or its hero is KO'd, fall back through older valid Provokes, then normal targeting.

Default Cover intercepts eligible single-target skills only, after targeting/Provoke and successful original-target accuracy/evasion. Newest valid eligible Cover wins, falling back through older effects. No cover-priority feature now. AoE bypasses normal Cover; `coversAoE = true` is reserved for an explicitly authored exception.

After interception, use the coverer's DEF/RES, mitigation, barriers and on-damage effects. Do not repeat evasion by default; `coverCanEvade = true` permits a specialized exception.

Choose Cover once for a multi-hit skill. All hits use that defender until the coverer is KO'd. Remaining hits then return to the original target, never another coverer. If the original target is also invalid, terminate remaining hits; the skill's SP remains spent. Per-hit accuracy remains independent of this once-per-skill Cover selection.

## 9. Counter and passive reaction ordering

After the triggering skill finishes, collect surviving eligible defenders. Each may counter at most once for that skill. Sort the counter queue by current modified SPEED descending, with stable actor ID as deterministic tie-breaker. Use SPEED after the triggering skill's modifiers have resolved.

Immediately before each counter, revalidate the countering actor and its original target. If either is invalid, cancel without replacement targeting. An earlier counter may invalidate a later counter or the attacker's remaining skill queue.

`isCounter = true` prohibits counter-to-counter reactions. Other legitimate passives may resolve. Ordinary counters cost 0 SP, grant no turn-start SP regeneration, consume no scheduled turn, and do not reset initiative or change the countering hero's upcoming turn. Do not add override mechanics until explicitly authored.

Finish all reactions and KO checks before advancing to the next queued skill. If the attacker is KO'd, refund all unexecuted actions and end their turn. Victory cancels remaining combat work immediately.

## 10. UI contract

Keep black hero cards under the arena, small cropped portrait/name upper-left, compact red FLOW upper-right labeled FLOW, and HP/blue SP along the bottom row. Active actor highlight remains steady and prominent throughout their turn, including queued actions and reactions. FLOW readiness has a distinct visible state without changing the red resource identity.

Six slots fill the left column top-to-bottom, then the right column. Empty slots have no fake actors or resources. Cards open a native action editor with mouse, touch or keyboard. No swipe/drag commands, separate card Attack/Actions buttons or global Execute Round button.

Editor displays unlocked actions, the battlefield target, ordered removable entries, queued/remaining slots and unreserved SP. Enforce repeat and legality rules in both UI and execution boundary. FLOW replaces the draft sequence. Display locked progression and next unlocks in hero/progression views, without advertising locked actions as usable.

Auto uses basic attacks. Repeat revalidates the previous command; invalid drafts return to editing before commit without spending. Reload restores selections without executing. Show post-victory progression only after queue settlement and EXP processing.

## 11. Implementation boundaries and migration order

Existing owners are starting points to inspect, not proof that the behavior is complete:

| Responsibility | Existing seam / required ownership |
| --- | --- |
| Personal resources and mode data | `web-runner/src/core/personalFlow.mjs` |
| Queue orchestration | `web-runner/modules/heroCommands.mjs` |
| Damage and scheduling | Existing function registries and Rust-owned rules |
| Combat creation/reset | `combatSessionInitializer.js`, `combatSessionReset.mjs` |
| Hero cards/editor | `heroCommandUI.mjs` |
| Presentation timing | `renderRuntime.js` |
| Persistent hero EXP/growth/unlocks | Inspect existing hero storage/progression first; add generic data-driven ownership at that seam |
| Shell wiring | `app.js`, orchestration only |

1. Checkpoint the owned worktree; inventory existing persistence and runtime consumers. Implement the one-time level/skill migration without damaging unrelated saves.
2. Establish central hero/skill/passive/FLOW/progression tuning data. Replace competing skill sources and removed-kit consumers. Define the four role-correct kits and validate counts/unlocks.
3. Implement independent resources, cost reservation/refunds, action-specific targets, repeat/legality rules and action identity.
4. Route generic effects, statuses, periodic resolution, targeting, Cover, reactions and FLOW attribution through established rule owners. Avoid a second hero-name switch beside a data-driven catalog.
5. Integrate persistent victory EXP, multi-level growth and unlocks with once-only settlement and progression results.
6. Remove active board/refill/shared-AF/draw dependencies and obsolete developer controls. Keep the paused party-card content explicitly disconnected. Preserve native targeting and animation seams used by supported consumers.
7. Update product docs and owning DOX, run proof, make a scoped local checkpoint, and publish the final local report. No merge or external deployment is implied.

## 12. Acceptance evidence

Use focused deterministic checks plus the existing browser QA harness. Cover these behavior groups without treating placeholder balance as validated design:

- Exact kit counts, four role assignments, configurable unlock levels, locked-action rejection and one-time migration to level 1.
- Individual EXP for participants including KO, zero for nonparticipants, summed enemy rewards, once-only victory, multi-level gains, cap/excess handling, living HP delta and KO staying zero.
- Groups 1–6, full starting SP/zero FLOW, own-turn regeneration once, no regeneration on KO/revive/counter, independent resources and costs retained after partial execution.
- Per-action targets, multicasting flag, affordability, invalid-target refunds, partial group validity, actor KO, all-skipped turn, and immediate victory cancellation before EXP.
- Status refresh/stronger magnitude, self-turn expiry, KO clearing, snapshot periodic effects after caster KO, simultaneous DoT/HoT survival, and no routine tick FLOW.
- FLOW deduplication, once-per-action orb passive checks, true HP restoration, hostile origin, lethal Stoic/Comrade timing, mitigation ownership and inherited special-source exclusion.
- Tag-based Silence/Blind, accuracy versus evasion, Provoke recency, Cover recency/defense ownership, coverer KO fallback and partial-skill no-refund.
- Counter timing, one per defender, current SPEED order, per-counter validity, no chains and no initiative/SP side effects.
- Live browser proof for current hero kits, queued mixed targets, resources, progression results, defeat/revival and victory; persistent active glow and approved reference/compact/natural/Retina layout.
- Retired board flags cannot block native combat; paused card content cannot grant live buffs; runtime mirrors preserve required current contracts.

Update `COMBAT_MIGRATION_REPORT.md` with actual delivered scope, test counts, skipped historical checks and remaining issues after implementation. Earlier passing tests do not certify these newly consolidated requirements.
