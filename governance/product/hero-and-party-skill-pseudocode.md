# Hero and Party Skill Pseudocode

Purpose:
- Give the game team one stable pseudocode reference for the current hero, party, Vault, and affinity skill set.
- Mirror the repo's actual runtime language where possible so later implementation can land without needless renaming.
- Stay high-level enough to allow tuning changes without rewriting the whole document.
- Treat this as a subordinate implementation sketch. `abilities.html` owns taxonomy, timing, lifetimes, risk class, and drift warnings.

Companion references:
- ability-system map: [abilities.html](./abilities.html)
- skill definitions: [hero-and-party-skills.md](./hero-and-party-skills.md)
- proc QA: [skill-proc-qa-guide.md](./skill-proc-qa-guide.md)
- runtime behavior: [game-function-reference.md](./game-function-reference.md)

## Mechanical Contract And Timing

- `abilities.html` owns category, lifetime, timing stack, risk containment, and current drift.
- `hero-and-party-skills.md` owns canonical IDs, owners, card text, risk bands, and raw rank increments.
- This file owns human-readable payload sketches. It must not override timing or category rules from `abilities.html`.
- Player-guide wording is public shorthand and not mechanical taxonomy.

Current runtime boundary:
- Several helpers, events, and result shapes below are design-target seams, not guaranteed current runtime APIs.
- Current runtime has partial proc helpers, Destiny-specific result objects, trait-hook traces, boolean supergem returns, and numeric damage returns.
- Before feature work depends on canonical ability events, source-tag propagation, cumulative chance, or shared resolver execution, that seam must be implemented or adapter-mapped and proven with focused tests.

Design target: rank growth arrays are additive increments. Effective chance is the cumulative sum by rank:

| Risk | Rank increments | Effective by rank | Max chance |
| --- | --- | --- | --- |
| LOW | `6%/6%/7%/8%` | `6%/12%/19%/27%` | `27%` |
| MED | `4%/4%/5%/5%` | `4%/8%/13%/18%` | `18%` |
| HIGH | `2%/2%/3%/3%` | `2%/4%/7%/10%` | `10%` |

Current runtime may still read the active rank slot rather than the cumulative total. Do not rely on cumulative behavior in implementation until that seam is proven or adapted.

Use these design-target event names when specifying future work. Some are not live runtime hooks yet; map or implement the event envelope before relying on them:

| Event | Meaning |
| --- | --- |
| `combat_start` | A combat encounter starts and pre-combat/session passives may check. |
| `gem_match_resolved` | A valid gem match has resolved its base color action. |
| `blue_match_consumed` | Blue board value was consumed and can feed Astral Flow or blue-specific effects. |
| `hero_attack_declared` | A hero attack has target and action context but has not applied damage yet. |
| `enemy_damage_applied` | Incoming enemy damage has changed true hero/party HP. |
| `hero_positive_damage_dealt` | A hero-origin payload applied positive enemy damage. |
| `special_hit_applied` | A special payload hit a valid target. |
| `supergem_spent` | A supergem was spent and native/non-native behavior must be selected. |
| `combo_finisher_resolved` | A combo finisher resolved and can feed finisher-only skills. |
| `enemy_hit_declared` | An enemy hit has target and raw damage before mitigation, shield, or HP apply. |
| `ally_action_resolved` | A party ally action resolved and can feed support choreography. |
| `party_status_checked` | A low-HP, weak-board, or similar party status gate is checked. |

Incoming damage reactions resolve in this order unless a later product decision changes it:

1. Incoming hit declared.
2. Redirect/intercept decision.
3. Heavy-hit threshold check.
4. Mitigation/guard.
5. Temporary shield absorption.
6. True HP damage apply.
7. Post-damage reactions such as Reprisal or Ward Bash.
8. Player feedback.

For each payload, describe its system role in plain terms: source, drain, converter, gate, delay, or feedback loop. If a skill converts one resource into another, its sketch should name the input, output, loss/cap, and any rule that prevents the output from immediately becoming its own fuel.

Event payloads should carry compact envelopes, not ad hoc fields. These envelopes are target contracts; current helpers may not accept every field yet:

| Event | Required payload fields |
| --- | --- |
| `enemy_hit_declared` | `sourceUID`, `targetUID`, `rawDamage`, `sourceTag`, `generatedBySkillId`, `alreadyRedirected` |
| `enemy_damage_applied` | `sourceUID`, `targetUID`, `appliedDamage`, `trueHpDamageApplied`, `sourceTag`, `generatedBySkillId`, `alreadyCounteredThisHit` |
| `hero_positive_damage_dealt` | `sourceUID`, `targetUID`, `appliedDamage`, `sourceTag`, `generatedBySkillId` |
| `gem_match_resolved` | `actorUID`, `color`, `consumedCount`, `chainIndex`, `sourceTag`, `generatedBySkillId` |
| `special_hit_applied` | `sourceUID`, `targetUID`, `specialId`, `appliedDamage`, `sourceTag`, `generatedBySkillId`, `eligibleEffectId` |
| `hero_attack_declared` | `actorUID`, `targetUID`, `actionType`, `color`, `sourceTag`, `generatedBySkillId` |
| `supergem_spent` | `actorUID`, `color`, `consumedCount`, `isNativeOwner`, `fallbackMode`, `sourceTag`, `generatedBySkillId` |
| `combo_finisher_resolved` | `actorUID`, `targetUID`, `chainIndex`, `sourceTag`, `generatedBySkillId` |
| `blue_match_consumed` | `actorUID`, `consumedBlue`, `sourceTag`, `generatedBySkillId` |
| `ally_action_resolved` | `actorUID`, `allyUID`, `actionType`, `sourceTag`, `generatedBySkillId` |
| `party_status_checked` | `statusType`, `partyHpPct`, `boardQuality`, `sourceTag` |

## Shared Runtime Shape

Use existing runtime/state language when implementing:

- `PartyHP`, `PartyMaxHP`, `PartyHPByIndex`, `PartyMaxHPByIndex`
- `PartyBuff_ATK`, `PartyBuff_DEF`, `PartyBuff_MAG`, `PartyBuff_RES`, `PartyBuff_SPD`
- `EnemyDebuffs[enemyUID][stat]`
- `ApplyPartyHeal(ctx, healAmount)`
- `ApplyDamageToTarget(ctx, uid, dmg)`
- `GetActorByUID(ctx, uid)`
- `GetEffectiveStat(ctx, inst, stat)`
- `CalculateDamage(ctx, attackerUID, targetUID, mode)`
- `Party_ATK_UP`, `Party_DEF_UP`, `Party_MAG_UP`, `Party_RES_UP`, `Party_SPD_UP`
- `RefreshPartyBuffUI(ctx)`, `UpdateHeroHPUI(ctx)`, `UpdatePartyHPText(ctx)`, `UpdatePartyHPBar(ctx)`

## Shared Helper Seams

These helpers do not all exist yet. They are intended shaping seams. Do not create bespoke per-skill functions when a shared resolver family would express the same action shape, and do not assume a universal `ActionResult` exists until foundation work maps it.

```js
function RollSkillProc(ctx, ownerUID, skillId) {
  // Intended helper.
  const chance = GetSkillProcChance(ctx, ownerUID, skillId);
  return random01(ctx) <= chance;
}

function GetSkillProcChance(ctx, ownerUID, skillId) {
  // Intended helper.
  // Read raw rank increments from the skill definition layer.
  // Return cumulative effective chance for the current rank.
  // Example LOW rank 4: 6% + 6% + 7% + 8% = 27%.
}

function GetSkillPayloadValue(ctx, ownerUID, skillId, valueKey) {
  // Intended helper.
  // Return rank-scaled payload values such as amount, duration, target count,
  // cooldown, cap, or conversion rate. Do not use proc chance as payload value.
}

function WasEvent(ctx, eventName) {
  // Intended helper. Read the current event envelope and compare its stable
  // event name before any eligibility, roll, or payload code runs.
  return GetCurrentAbilityEvent(ctx)?.name === eventName;
}

function RollPartySkillProc(ctx, skillId) {
  // Intended helper. Requires the party skill to be selected in the current
  // session before rolling. Current session picks use rank 1 chance unless a
  // party-rank system is explicitly added.
  if (!IsPartySessionSkillActive(ctx, skillId)) return false;
  const chance = GetPartySessionSkillChance(ctx, skillId, 1);
  return random01(ctx) <= chance;
}

function GetSkillGrowthBonus(ctx, ownerUID, skillId) {
  // Legacy pseudocode alias. New skill specs should call GetSkillPayloadValue
  // with a named valueKey so chance scaling and payload scaling do not drift.
  return GetSkillPayloadValue(ctx, ownerUID, skillId, 'amount');
}

function AddEnemyDebuff(ctx, enemyUID, stat, amount, turns) {
  const g = getGlobals(ctx);
  if (!g.EnemyDebuffs) g.EnemyDebuffs = {};
  if (!g.EnemyDebuffs[enemyUID]) g.EnemyDebuffs[enemyUID] = {};
  g.EnemyDebuffs[enemyUID][stat] = Math.max(0, (g.EnemyDebuffs[enemyUID][stat] || 0) + amount);
  SetEnemyDebuffTurns(ctx, enemyUID, stat, turns);
}

function AddHeroTempState(ctx, heroUID, key, value, turns) {
  // Existing runtime state seam: HeroTempSkillStateByUID.
  return SetHeroTempSkillState(ctx, heroUID, key, value, TurnsFromNow(ctx, turns));
}

function GetHeroTempState(ctx, heroUID, key) {
  // Existing runtime state seam: HeroTempSkillStateByUID.
  return GetHeroTempSkillState(ctx, heroUID, key);
}

function AddPartySessionPassive(ctx, key, amount, sourceSkillId = '') {
  // Existing runtime state seam: SessionSkillPassivesByHeroUID.
  return AddSessionPassive(ctx, 0, key, amount, sourceSkillId);
}

function GetMatchContext(ctx) {
  // Return resolved color, actorUID, targets, consumed gems, chain data,
  // and whether the match was red, green, blue, yellow, heal, or purple.
}

function DelayEnemyTurn(ctx, enemyUID, slots) {
  // Push enemy action later in the turn queue.
}

function AdvanceAllyTurn(ctx, heroUID, slots) {
  // Pull ally action earlier in the turn queue.
}

function PlayReactionPose(ctx, actorUID, poseId) {
  // Brief JRPG-style reaction pose: guard, intercept, stagger, chant, etc.
}

function PlayInterceptMove(ctx, moverUID, protectedUID) {
  // Move the protector in front of the protected ally before damage resolves.
}

function RestoreInterceptMove(ctx, moverUID) {
  // Return the protector to their anchor slot after the reaction finishes.
}

function SpawnImpactVFX(ctx, targetUID, effectId) {
  // Spawn a hit, ward, block, or heavy-impact visual on target.
}

function SpawnReflectArc(ctx, sourceUID, targetUID) {
  // Draw a visible bounce arc or reflected strike back to the attacker.
}

function SpawnCounterStrike(ctx, sourceUID, targetUID) {
  // Spawn a retaliatory slash, bash, or spike strike visual.
}

function SpawnHealPulse(ctx, targetUID, effectId = 'heal') {
  // Spawn a restorative pulse on a hero or on the shared party HP bar.
}

function SpawnStatusAura(ctx, actorUID, auraId) {
  // Show a brief aura for amplify, protect, lock, or other temporary states.
}

function SpawnTotemVFX(ctx, ownerUID, targetUID, totemId) {
  // Show totem summon placement and idle loop.
}

function ShowTurnShiftVFX(ctx, actorUID, direction) {
  // Show turn-order movement forward or backward.
}

function ShowBoardEffectVFX(ctx, effectId) {
  // Show chain pop, reroll, or other board-side effect.
}
```

## Prototype Resolver Recipe

Use this shape when sketching a new skill or refactoring an existing sketch. The recipe describes a shared action shape; it is not a demand for one new bespoke runtime function per skill.

```js
const skillRecipe = {
  id: 'stable_skill_id',
  owner: 'hero_or_party_or_system',
  actionCategory: 'hero_rank_skill | party_draw_skill | supergem | enemy_skill | combo_finisher | passive',
  playerVerb: 'protect | punish | cash_out | delay | invert | fortify | coordinate',
  event: 'design_target_event_name',
  gates: ['eligible_state', 'rejected_state_rule'],
  selector: 'self | ally | enemy_single | party | board | field',
  resolverFamily: 'instant_damage | instant_status | reaction_counter | rhythmic_tick | field_effect | resource_conversion | board_aftermath',
  payload: {
    facet: 'damage | heal | buff | debuff | guard | board | resource',
    valueKey: 'chance | amount | duration | target_count | cooldown | cap',
  },
  bounds: {
    stackPolicy: 'reject | replace | refresh | extend_to_cap | add_stack_to_cap | strongest_wins | coexist_by_source',
    capKey: 'rootActionId + skillId + actorUID + targetUID',
    resetBoundary: 'action | turn | combat | session',
    cooldownGroup: 'named_balance_group',
    cleanupHook: 'action_resolve | turn_end | combat_end | owner_dead | target_dead | board_refill',
    antiRecursion: true,
  },
  presentation: 'visible cue, combat text, icon, board change, or modal state',
  proof: 'trace/counter/rejected-state evidence plus player-visible result',
};
```

If the recipe needs a design-target event, source tag, resolver family, or result packet that the runtime does not already expose, record that as a foundation requirement instead of hiding it inside the skill sketch.

## Affinity Pseudocode

Affinity is passive and progression-facing. It is not a combat meter.

```js
function ApplyHeroAffinityPassives(ctx) {
  ApplyFalieAffinity(ctx);
  ApplyHuunAffinity(ctx);
  ApplyRunaAffinity(ctx);
  ApplyKojonnAffinity(ctx);
}

function ApplyFalieAffinity(ctx) {
  const bonus = GetAffinityValue(ctx, 'Falie');
  if (bonus <= 0) return;
  const g = getGlobals(ctx);
  g.PartyMaxHP += bonus;
  g.PartyHP += bonus;
  UpdateHeroHPUI(ctx);
  UpdatePartyHPText(ctx);
  UpdatePartyHPBar(ctx);
}

function ApplyHuunAffinity(ctx) {
  const bonus = GetAffinityValue(ctx, 'Huun');
  if (bonus <= 0) return;
  AddPartySessionPassive(ctx, 'GoldGainFlat', bonus);
}

function ApplyRunaAffinity(ctx) {
  const bonus = GetAffinityValue(ctx, 'Runa');
  if (bonus <= 0) return;
  AddPartySessionPassive(ctx, 'HeroMAG_Runa', bonus);
}

function ApplyKojonnAffinity(ctx) {
  const bonus = GetAffinityValue(ctx, 'Kojonn');
  if (bonus <= 0) return;
  AddPartySessionPassive(ctx, 'AllyPower_Kojonn', bonus);
}
```

## Falie

Falie reactions share the incoming damage stack from `abilities.html`: redirect/intercept,
heavy-hit check, mitigation/guard, temporary shield absorption, true HP damage, then post-damage
reactions. Shield-only absorption is not true HP damage unless a skill explicitly says so.

### Ward Bash

```js
function Skill_Falie_WardBash(ctx, falieUID, attackerUID, reactionCtx) {
  if (!WasEvent(ctx, 'enemy_damage_applied')) return;
  if (!reactionCtx.trueHpDamageApplied) return;
  if (reactionCtx.alreadyCounteredThisHit) return;
  if (!RollSkillProc(ctx, falieUID, 'falie_ward_bash')) return;
  PlayReactionPose(ctx, falieUID, 'ward_bash');
  SpawnCounterStrike(ctx, falieUID, attackerUID);
  const dmg = CalculateDamage(ctx, falieUID, attackerUID, 'physical');
  ApplyDamageToTarget(ctx, attackerUID, dmg, { sourceTag: 'falie_ward_bash', generatedBySkillId: 'falie_ward_bash' });
  LogCombat(ctx, 'Falie counters with Ward Bash.');
}
```

### Cover / Block

```js
function Skill_Falie_CoverBlock(ctx, falieUID, allyUID, incomingHit) {
  const incomingDamage = incomingHit.rawDamage;
  if (!WasEvent(ctx, 'enemy_hit_declared')) return incomingDamage;
  if (HasInterceptedThisHit(ctx)) return incomingDamage;
  if (!RollSkillProc(ctx, falieUID, 'falie_cover_block')) return incomingDamage;
  PlayReactionPose(ctx, falieUID, 'intercept');
  PlayInterceptMove(ctx, falieUID, allyUID);
  SpawnImpactVFX(ctx, falieUID, 'cover_block');
  RedirectIncomingDamage(ctx, {
    fromUID: allyUID,
    toUID: falieUID,
    damage: incomingDamage,
    sourceTag: incomingHit.sourceTag,
    redirectSourceTag: 'falie_cover_block',
  });
  AddHeroTempState(ctx, falieUID, 'CoveredAllyThisTurn', 1, 1);
  RestoreInterceptMove(ctx, falieUID);
  LogCombat(ctx, 'Falie steps in and takes the hit.');
  return {
    redirected: true,
    targetUID: falieUID,
    damage: incomingDamage,
    sourceTag: incomingHit.sourceTag,
    redirectSourceTag: 'falie_cover_block',
  };
}
```

### Reprisal / Bounce

```js
function Skill_Falie_ReprisalBounce(ctx, falieUID, attackerUID, damageTaken, reactionCtx) {
  if (!WasEvent(ctx, 'enemy_damage_applied')) return;
  if (!reactionCtx.trueHpDamageApplied) return;
  if (reactionCtx.sourceTag === 'falie_reprisal_bounce' || reactionCtx.generatedBySkillId === 'falie_reprisal_bounce') return;
  if (!RollSkillProc(ctx, falieUID, 'falie_reprisal_bounce')) return;
  const pct = GetSkillPayloadValue(ctx, falieUID, 'falie_reprisal_bounce', 'reflectPct');
  const reflectDamage = Math.max(1, Math.floor(damageTaken * pct));
  PlayReactionPose(ctx, falieUID, 'reprisal');
  SpawnReflectArc(ctx, falieUID, attackerUID);
  ApplyDamageToTarget(ctx, attackerUID, reflectDamage, { sourceTag: 'falie_reprisal_bounce', generatedBySkillId: 'falie_reprisal_bounce' });
  LogCombat(ctx, 'Falie reflects part of the blow.');
}
```

### Phalanx

```js
function Skill_Falie_Phalanx(ctx, falieUID, incomingDamage) {
  if (!WasEvent(ctx, 'enemy_hit_declared')) return incomingDamage;
  if (!IsHeavyHit(ctx, incomingDamage)) return incomingDamage;
  if (!RollSkillProc(ctx, falieUID, 'falie_phalanx')) return incomingDamage;
  const denyPct = GetSkillPayloadValue(ctx, falieUID, 'falie_phalanx', 'denyPct');
  const reduced = Math.max(1, incomingDamage - Math.floor(incomingDamage * denyPct));
  PlayReactionPose(ctx, falieUID, 'phalanx');
  SpawnImpactVFX(ctx, falieUID, 'heavy_block');
  LogCombat(ctx, 'Falie cuts down a crushing hit.');
  return reduced;
}
```

### Red Supergem: Temporary Shield

```js
function Skill_Falie_RedSupergemTemporaryShield(ctx, falieUID, consumedRedGemCount) {
  if (!WasEvent(ctx, 'supergem_spent')) return false;
  if (!IsNativeSupergemOwner(ctx, falieUID, 'red')) return false;
  const shieldAmount = GetSupergemShieldAmount(ctx, falieUID, consumedRedGemCount);
  AddPartyTemporaryShield(ctx, shieldAmount, { sourceTag: 'falie_red_supergem_temporary_shield' });
  SpawnStatusAura(ctx, 'party_bar', 'temporary_shield');
  LogCombat(ctx, 'Falie turns red power into a temporary shield.');
  return true;
}
```

## Huun

### Bell

```js
function Skill_Huun_Bell(ctx, huunUID, targetUID, baseDamage) {
  if (!WasEvent(ctx, 'combo_finisher_resolved')) return baseDamage;
  if (!WasComboFinisher(ctx, huunUID)) return baseDamage;
  if (HasPayloadMultiplierSource(ctx, 'huun_bell')) return baseDamage;
  if (!RollSkillProc(ctx, huunUID, 'huun_bell')) return baseDamage;
  const multiplier = 2 + GetSkillPayloadValue(ctx, huunUID, 'huun_bell', 'multiplierBonus');
  return Math.ceil(baseDamage * multiplier);
}
```

### Glare

```js
function Skill_Huun_Glare(ctx, huunUID, targetUID) {
  if (!WasEvent(ctx, 'hero_attack_declared')) return;
  if (HasTurnDelayCap(ctx, targetUID, 'huun_glare')) return;
  if (!RollSkillProc(ctx, huunUID, 'huun_glare')) return;
  DelayEnemyTurn(ctx, targetUID, 2);
  SpawnImpactVFX(ctx, targetUID, 'glare_stagger');
  ShowTurnShiftVFX(ctx, targetUID, 'back');
  LogCombat(ctx, 'Huun pushes the enemy back.');
}
```

### Trinity

```js
function Skill_Huun_Trinity(ctx, huunUID, targetUID) {
  if (!WasEvent(ctx, 'combo_finisher_resolved')) return;
  if (!WasComboFinisher(ctx, huunUID)) return;
  if (IsGeneratedAttack(ctx)) return;
  if (!RollSkillProc(ctx, huunUID, 'huun_trinity')) return;
  PlayReactionPose(ctx, huunUID, 'trinity');
  RepeatHeroAttack(ctx, huunUID, targetUID, 2, { sourceTag: 'huun_trinity', generatedBySkillId: 'huun_trinity', suppressSkillIds: ['huun_trinity'] });
  LogCombat(ctx, 'Huun unleashes Trinity.');
}
```

### Growth

```js
function Skill_Huun_Growth(ctx, huunUID, dealtDamage) {
  if (!WasEvent(ctx, 'hero_positive_damage_dealt')) return;
  if (dealtDamage <= 0) return;
  if (DamageSourceWasGeneratedByAstralFlow(ctx)) return;
  if (!RollSkillProc(ctx, huunUID, 'huun_growth')) return;
  const gain = ConvertDamageToAstralFlow(ctx, dealtDamage, huunUID, 'huun_growth');
  AddAstralFlowWallet(ctx, Math.min(gain, GetSkillPayloadValue(ctx, huunUID, 'huun_growth', 'flowGainCap')));
  LogCombat(ctx, 'Huun turns damage into Astral Flow.');
}
```

### Yellow Supergem: Goldstrike

```js
function Skill_Huun_YellowSupergemGoldstrike(ctx, huunUID, selectedEnemyUID, consumedYellowGemCount) {
  if (!IsActiveHero(ctx, huunUID)) return false;
  if (!WasEvent(ctx, 'supergem_spent')) return false;
  if (!WasYellowSupergemSpent(ctx)) return false;
  const bankedGoldBeforeAward = GetBankedGold(ctx);
  const boardGold = Math.max(0, consumedYellowGemCount);
  const spendMode = GetGoldstrikeSpendMode(ctx); // measure, spend, tax, or capped-measure; must be specified by the feature spec.
  if (!IsGoldstrikeSpendModeResolved(ctx, spendMode)) return BlockedDesignStub('huun_yellow_supergem_goldstrike', 'Resolve spend mode before implementation.');
  const baseDamage = Math.max(1, bankedGoldBeforeAward + boardGold);
  const roll = RollInclusive(ctx, 0, 100);
  AwardGold(ctx, boardGold);
  ApplyGoldstrikeGoldCost(ctx, spendMode, bankedGoldBeforeAward);
  if (roll === 100) {
    QueueHuunGoldstrikeAoe(ctx, huunUID, 100, { sourceTag: 'huun_yellow_supergem_goldstrike', generatedBySkillId: 'huun_yellow_supergem_goldstrike' });
    LogCombat(ctx, 'Huun hit a perfect goldstrike.');
    return true;
  }
  const targetUID = selectedEnemyUID || PickDefaultEnemyTarget(ctx);
  const finalDamage = roll <= 50 ? baseDamage : baseDamage * 3;
  QueueHuunGoldstrikeSingle(ctx, huunUID, targetUID, finalDamage, { sourceTag: 'huun_yellow_supergem_goldstrike', generatedBySkillId: 'huun_yellow_supergem_goldstrike' });
  LogCombat(ctx, `Huun rolled ${roll} for Goldstrike.`);
  return true;
}
```

## Runa

```js
function BuildRunaTotemProgression(ctx) {
  return {
    damageScalar: GetSessionPassive(ctx, 'RunaTotemDamageScalar') || 0,
    durationBonus: GetSessionPassive(ctx, 'RunaTotemDurationBonus') || 0,
    hpBonus: GetSessionPassive(ctx, 'RunaTotemHpBonus') || 0,
    chargeGain: GetSessionPassive(ctx, 'RunaTotemChargeGain') || 0,
    detonationBurst: GetSessionPassive(ctx, 'RunaTotemDetonationBurst') || 0,
    expiryBurst: GetSessionPassive(ctx, 'RunaTotemExpiryBurst') || 0,
    deathBurstRetention: GetSessionPassive(ctx, 'RunaTotemDeathBurstRetention') || 0,
  };
}
```

### Aura Totem: Blast

```js
function Skill_Runa_AuraTotemBlast(ctx, runaUID, targetUID) {
  if (!WasEvent(ctx, 'hero_attack_declared')) return;
  if (CountActiveRunaTotems(ctx, runaUID) >= GetSkillPayloadValue(ctx, runaUID, 'runa_aura_totem_blast', 'maxTotems')) return;
  if (!RollSkillProc(ctx, runaUID, 'runa_aura_totem_blast')) return;
  const prog = BuildRunaTotemProgression(ctx);
  const baseDmg = GetBaseTotemTickDamage(ctx, runaUID, 'Blast');
  SummonRunaTotem(ctx, {
    ownerUID: runaUID,
    totemType: 'Detonate',
    totemSubType: 'Blast',
    targetUID,
    durationTurns: 2 + prog.durationBonus,
    tickIntervalSec: 1,
    maxHP: 1 + prog.hpBonus,
    tickDamage: baseDmg * (1 + prog.damageScalar),
    chargeGainPerTick: 1 + prog.chargeGain,
    detonationBase: baseDmg * 2 * (1 + prog.detonationBurst),
    expiryDetonationBonus: prog.expiryBurst,
    deathBurstRetentionBonus: prog.deathBurstRetention,
    sourceSkillId: 'runa_aura_totem_blast',
    destructible: true,
  });
  SpawnTotemVFX(ctx, runaUID, targetUID, 'runa_blast_detonate_totem');
  LogCombat(ctx, 'Runa summons a charged blast totem.');
}
```

### Aura Totem: Burn

```js
function Skill_Runa_AuraTotemBurn(ctx, runaUID, targetUID) {
  if (!WasEvent(ctx, 'hero_attack_declared')) return;
  if (CountActiveRunaTotems(ctx, runaUID) >= GetSkillPayloadValue(ctx, runaUID, 'runa_aura_totem_burn', 'maxTotems')) return;
  if (!RollSkillProc(ctx, runaUID, 'runa_aura_totem_burn')) return;
  const prog = BuildRunaTotemProgression(ctx);
  const baseDmg = GetBaseTotemTickDamage(ctx, runaUID, 'Burn');
  SummonRunaTotem(ctx, {
    ownerUID: runaUID,
    totemType: 'PersistentDot',
    totemSubType: 'Burn',
    targetUID,
    durationTurns: 3 + prog.durationBonus,
    tickIntervalSec: 1,
    maxHP: 1 + prog.hpBonus,
    tickDamage: baseDmg * (1 + prog.damageScalar),
    sourceSkillId: 'runa_aura_totem_burn',
    destructible: true,
  });
  SpawnTotemVFX(ctx, runaUID, targetUID, 'runa_burn_dot_totem');
  LogCombat(ctx, 'Runa summons a persistent damage totem.');
}
```

### Runa Totem Tick/Detonation

```js
function OnRunaTotemTick(ctx, totemUID) {
  if (!IsRunaTotem(ctx, totemUID)) return;
  const totem = GetTotemState(ctx, totemUID);
  ApplyDamageToTarget(ctx, totem.targetUID, totem.tickDamage, { sourceTag: 'runa_totem_tick', generatedBySkillId: totem.sourceSkillId });
  if (totem.totemType === 'Detonate') {
    const chargeGain = totem.chargeGainPerTick || 0;
    totem.charge = (totem.charge || 0) + chargeGain;
  }
}

function OnRunaTotemExpired(ctx, totemUID) {
  if (!IsRunaTotem(ctx, totemUID)) return;
  const totem = GetTotemState(ctx, totemUID);
  if (totem.totemType !== 'Detonate') return;
  const storedCharge = totem.charge || 0;
  const baseBurst = totem.detonationBase || 0;
  const bonus = totem.expiryDetonationBonus || 0;
  const payload = (baseBurst + storedCharge) * (1 + bonus);
  ApplyDamageToTarget(ctx, totem.targetUID, payload, { sourceTag: 'runa_totem_expiry_burst', generatedBySkillId: totem.sourceSkillId });
}

function OnRunaTotemDestroyed(ctx, totemUID) {
  if (!IsRunaTotem(ctx, totemUID)) return;
  const totem = GetTotemState(ctx, totemUID);
  if (totem.totemType !== 'Detonate') return;
  const baseBurst = totem.detonationBase || 0;
  const storedCharge = (totem.charge || 0) * (1 + (totem.deathBurstRetentionBonus || 0));
  const payload = baseBurst + storedCharge;
  ApplyDamageToTarget(ctx, totem.targetUID, payload, { sourceTag: 'runa_totem_death_burst', generatedBySkillId: totem.sourceSkillId });
}
```

### Invert

```js
function Skill_Runa_Invert(ctx, runaUID, targetUID) {
  if (!WasEvent(ctx, 'special_hit_applied')) return;
  const enemy = GetActorByUID(ctx, targetUID);
  if (!enemy) return;
  if (HasBossStatSwapResistance(ctx, enemy)) return;
  if (!IsInvertStatPairResolved(ctx)) return BlockedDesignStub('runa_invert', 'Resolve stat pair, duration, restoration, and boss rules before implementation.');
  if (!RollSkillProc(ctx, runaUID, 'runa_invert')) return;
  const enemyATK = GetBaseStat(ctx, enemy, 'ATK');
  const enemyRES = GetBaseStat(ctx, enemy, 'RES');
  AddEnemyTempStatSwap(ctx, targetUID, 'ATK', enemyRES, 'RES', enemyATK, GetSkillPayloadValue(ctx, runaUID, 'runa_invert', 'durationTurns'));
  SpawnStatusAura(ctx, targetUID, 'invert');
  LogCombat(ctx, 'Runa inverts the enemy matchup.');
}
```

### Intensify

```js
function Skill_Runa_Intensify(ctx, runaUID) {
  if (!WasEvent(ctx, 'gem_match_resolved')) return;
  if (!WasRedMatch(ctx, runaUID)) return;
  if (GetHeroTempState(ctx, runaUID, 'DoubleRedPayoff')) return;
  if (!RollSkillProc(ctx, runaUID, 'runa_intensify')) return;
  AddHeroTempState(ctx, runaUID, 'DoubleRedPayoff', 1, 1);
  AddHeroTempState(ctx, runaUID, 'DoubleNextHeal', 1, 1);
  SpawnStatusAura(ctx, runaUID, 'intensify');
  LogCombat(ctx, 'Runa intensifies the next red payoff.');
}
```

## Kojonn

### Lock

```js
function Skill_Kojonn_Lock(ctx, kojonnUID) {
  if (!WasEvent(ctx, 'gem_match_resolved')) return;
  if (WasFreeActionGeneratedByLock(ctx)) return;
  if (GetHeroTempState(ctx, kojonnUID, 'FreeGemUse')) return;
  if (!RollSkillProc(ctx, kojonnUID, 'kojonn_lock')) return;
  AddHeroTempState(ctx, kojonnUID, 'FreeGemUse', { charges: 1, sourceTag: 'kojonn_lock', suppressSkillIds: ['kojonn_lock'] }, 1);
  SpawnStatusAura(ctx, kojonnUID, 'free_cast');
  LogCombat(ctx, 'Kojonn uses the next gem action at no cost.');
}
```

### Lift

```js
function Skill_Kojonn_Lift(ctx, kojonnUID, allyUID) {
  if (!WasEvent(ctx, 'ally_action_resolved')) return;
  if (HasPayloadMultiplierSource(ctx, 'kojonn_lift', allyUID)) return;
  if (!RollSkillProc(ctx, kojonnUID, 'kojonn_lift')) return;
  const amt = GetSkillPayloadValue(ctx, kojonnUID, 'kojonn_lift', 'attackBoost');
  AddHeroTempState(ctx, allyUID, 'AttackPowerBoost', amt, 1);
  SpawnStatusAura(ctx, allyUID, 'lift');
  LogCombat(ctx, 'Kojonn raises an ally\'s power.');
}
```

### Step

```js
function Skill_Kojonn_Step(ctx, kojonnUID, allyUID) {
  if (!WasEvent(ctx, 'ally_action_resolved')) return;
  if (HasTurnAdvanceCap(ctx, allyUID, 'kojonn_step')) return;
  if (!RollSkillProc(ctx, kojonnUID, 'kojonn_step')) return;
  AdvanceAllyTurn(ctx, allyUID, 2, { sourceTag: 'kojonn_step', generatedBySkillId: 'kojonn_step', cannotCreateImmediateTurn: true });
  ShowTurnShiftVFX(ctx, allyUID, 'forward');
  LogCombat(ctx, 'Kojonn moves an ally forward.');
}
```

### Elevate

```js
function Skill_Kojonn_Elevate(ctx, kojonnUID, allyUID) {
  if (!WasEvent(ctx, 'special_hit_applied')) return;
  if (!IsEligibleForEffectTierUp(ctx, allyUID)) return;
  if (HasEffectTierCap(ctx, allyUID)) return;
  if (!RollSkillProc(ctx, kojonnUID, 'kojonn_elevate')) return;
  AddHeroTempState(ctx, allyUID, 'EffectTierUp', 1, 1);
  SpawnStatusAura(ctx, allyUID, 'elevate');
  LogCombat(ctx, 'Kojonn elevates an ally effect.');
}
```

## Party Skills

### Fresh Start

```js
function PartySkill_FreshStart(ctx) {
  if (!WasEvent(ctx, 'combat_start')) return;
  if (!RollPartySkillProc(ctx, 'party_fresh_start')) return;
  AddPartyTimedBuff(ctx, 'ATK', GetPartySkillAmount(ctx, 'party_fresh_start'), 1, { sourceSkillId: 'party_fresh_start' });
  LogCombat(ctx, 'The party opens strong.');
}
```

### Second Chance

```js
function PartySkill_SecondChance(ctx) {
  if (!WasEvent(ctx, 'party_status_checked')) return;
  if (!IsWeakBoardState(ctx)) return;
  if (WasBoardGeneratedBySecondChance(ctx)) return;
  if (!RollPartySkillProc(ctx, 'party_second_chance')) return;
  RerollRandomSelectedGemSubset(ctx, 3, { sourceTag: 'party_second_chance', generatedBySkillId: 'party_second_chance' });
  ShowBoardEffectVFX(ctx, 'reroll');
  LogCombat(ctx, 'Second Chance refreshes part of the board.');
}
```

### Momentum

```js
function PartySkill_Momentum(ctx) {
  if (!WasEvent(ctx, 'combo_finisher_resolved')) return;
  if (!WasComboFinisherChain(ctx)) return;
  if (HasPartyTimedBuffSource(ctx, 'ATK', 'party_momentum')) return;
  if (!RollPartySkillProc(ctx, 'party_momentum')) return;
  AddPartyTimedBuff(ctx, 'ATK', GetPartySkillAmount(ctx, 'party_momentum'), 1, { sourceSkillId: 'party_momentum' });
  LogCombat(ctx, 'Momentum carries into the next action.');
}
```

### Guard Rail

```js
function PartySkill_GuardRail(ctx, incomingDamage) {
  if (!WasEvent(ctx, 'enemy_hit_declared')) return incomingDamage;
  if (!IsHeavyHit(ctx, incomingDamage)) return incomingDamage;
  if (!RollPartySkillProc(ctx, 'party_guard_rail')) return incomingDamage;
  const pct = GetPartySkillAmount(ctx, 'party_guard_rail');
  SpawnImpactVFX(ctx, 'party_bar', 'guard_rail');
  return Math.max(1, incomingDamage - Math.floor(incomingDamage * Math.min(pct, GetPartySkillCap(ctx, 'party_guard_rail'))));
}
```

### Blue Spark

```js
function PartySkill_BlueSpark(ctx, consumedBlue) {
  if (consumedBlue <= 0) return;
  if (!WasEvent(ctx, 'blue_match_consumed')) return;
  if (!RollPartySkillProc(ctx, 'party_blue_spark')) return;
  const bonus = GetPartySkillAmount(ctx, 'party_blue_spark');
  AddPartyTimedBuff(ctx, 'MAG', bonus, 1, { sourceSkillId: 'party_blue_spark' });
  LogCombat(ctx, 'Blue Spark charges the party.');
}
```

### Weaken

```js
function PartySkill_Weaken(ctx, targetUID) {
  if (!WasEvent(ctx, 'special_hit_applied')) return;
  if (!IsValidEnemyTarget(ctx, targetUID)) return;
  if (!RollPartySkillProc(ctx, 'party_weaken')) return;
  AddEnemyDebuff(ctx, targetUID, 'DEF', GetPartySkillAmount(ctx, 'party_weaken'), 2);
  LogCombat(ctx, 'The enemy is weakened.');
}
```

### Destiny

Destiny is implemented proc evidence, not the blueprint for all future skills. Keep its design read narrow: positive applied enemy damage may trigger a party heal; zero damage, blocked damage, invalid targets, and resisted states should not count as proof.

```js
function PartySkill_Destiny(ctx, damageEvent) {
  if (!WasEvent(ctx, 'hero_positive_damage_dealt')) return;
  if (!damageEvent || damageEvent.appliedDamage <= 0) return;
  if (!IsEnemyUID(ctx, damageEvent.targetUID)) return;
  if (!RollPartySkillProc(ctx, 'party_destiny')) return;
  ApplyPartyHeal(ctx, GetPartySkillAmount(ctx, 'party_destiny'));
  SpawnHealPulse(ctx, 'party_bar', 'destiny');
  LogCombat(ctx, 'Destiny restores party health.');
}
```

### Hot Streak

```js
function PartySkill_HotStreak(ctx) {
  if (!WasEvent(ctx, 'gem_match_resolved')) return;
  if (!WasConsecutiveMatchChain(ctx, 2)) return;
  if (HasSessionPassiveSource(ctx, 'RewardChainBonus', 'party_hot_streak')) return;
  if (!RollPartySkillProc(ctx, 'party_hot_streak')) return;
  AddPartySessionPassive(ctx, 'RewardChainBonus', GetPartySkillAmount(ctx, 'party_hot_streak'), 'party_hot_streak', { consumeAfterNextReward: true });
  LogCombat(ctx, 'Hot Streak improves the next payoff.');
}
```

### Last Push

```js
function PartySkill_LastPush(ctx) {
  if (!WasEvent(ctx, 'party_status_checked')) return;
  if (!IsLowPartyHP(ctx)) return;
  if (IsOnCooldown(ctx, 'party_last_push')) return;
  if (!RollPartySkillProc(ctx, 'party_last_push')) return;
  AddPartyTimedBuff(ctx, 'ATK', GetPartySkillAmount(ctx, 'party_last_push'), 1, { sourceSkillId: 'party_last_push' });
  AddPartyTimedBuff(ctx, 'MAG', GetPartySkillAmount(ctx, 'party_last_push'), 1, { sourceSkillId: 'party_last_push' });
  SetCooldown(ctx, 'party_last_push', GetPartySkillCooldown(ctx, 'party_last_push'));
  SpawnStatusAura(ctx, 'party_bar', 'last_push');
  LogCombat(ctx, 'The party finds a last push.');
}
```

### Chain Pop

```js
function PartySkill_ChainPop(ctx) {
  if (!WasEvent(ctx, 'gem_match_resolved')) return;
  if (!WasValidGemMatch(ctx)) return;
  if (WasBoardEffectGeneratedByChainPop(ctx)) return;
  if (!RollPartySkillProc(ctx, 'party_chain_pop')) return;
  TriggerExtraBoardEffect(ctx, { sourceTag: 'party_chain_pop', generatedBySkillId: 'party_chain_pop', suppressSkillIds: ['party_chain_pop'] });
  ShowBoardEffectVFX(ctx, 'chain_pop');
  LogCombat(ctx, 'Chain Pop triggers an extra board effect.');
}
```

## Vault Skills

Vault skills are passive by default. They should hook into stat query, reward gain, encounter init, or receive/heal seams rather than combat-side proc loops.

### Falie Vault

```js
function vault_crusade(ctx) {
  AddPartySessionPassive(ctx, 'EnmityBias', GetVaultSkillAmount(ctx, 'vault_crusade'), 'vault_crusade');
}

function vault_protect(ctx) {
  AddPartySessionPassive(ctx, 'PhysicalMitigation', GetVaultSkillAmount(ctx, 'vault_protect'), 'vault_protect');
}

function vault_shell(ctx) {
  AddPartySessionPassive(ctx, 'MagicMitigation', GetVaultSkillAmount(ctx, 'vault_shell'), 'vault_shell');
}

function vault_formless(ctx) {
  AddPartySessionPassive(ctx, 'DotMitigation', GetVaultSkillAmount(ctx, 'vault_formless'), 'vault_formless');
}
```

### Huun Vault

```js
function vault_rabbithole(ctx) {
  AddPartySessionPassive(ctx, 'GoldGainFlat', GetVaultSkillAmount(ctx, 'vault_rabbithole'), 'vault_rabbithole');
}

function vault_consume(ctx) {
  AddPartySessionPassive(ctx, 'EnemyHealInvert', GetVaultSkillAmount(ctx, 'vault_consume'), 'vault_consume');
}

function vault_scout(ctx) {
  AddPartySessionPassive(ctx, 'SpeedToAttackScalar', GetVaultSkillAmount(ctx, 'vault_scout'), 'vault_scout');
}

function vault_steal(ctx) {
  AddPartySessionPassive(ctx, 'BlueToAttackScalar', GetVaultSkillAmount(ctx, 'vault_steal'), 'vault_steal');
}

function vault_lucky(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'vault_lucky');
  if (amount <= 0) return;
  AddPartySessionPassive(ctx, 'BlueToGreenConvert', amount, 'vault_lucky');
}
```

### Runa Vault

```js
function vault_inspire(ctx) {
  AddPartySessionPassive(ctx, 'PartyResBonus', GetVaultSkillAmount(ctx, 'vault_inspire'), 'vault_inspire');
}

function vault_ignore(ctx) {
  AddPartySessionPassive(ctx, 'MagicResPierceOnGreen', GetVaultSkillAmount(ctx, 'vault_ignore'), 'vault_ignore');
}

function vault_insight(ctx) {
  AddPartySessionPassive(ctx, 'EnemyMagToRedScalar', GetVaultSkillAmount(ctx, 'vault_insight'), 'vault_insight');
}

function vault_runa_totem_damage_up(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'vault_runa_totem_damage_up');
  if (amount <= 0) return;
  AddPartySessionPassive(ctx, 'RunaTotemDamageScalar', amount, 'vault_runa_totem_damage_up');
}

function vault_runa_totem_duration_up(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'vault_runa_totem_duration_up');
  if (amount <= 0) return;
  AddPartySessionPassive(ctx, 'RunaTotemDurationBonus', amount, 'vault_runa_totem_duration_up');
}

function vault_runa_totem_hp_up(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'vault_runa_totem_hp_up');
  if (amount <= 0) return;
  AddPartySessionPassive(ctx, 'RunaTotemHpBonus', amount, 'vault_runa_totem_hp_up');
}

function vault_runa_detonation_charge_gain_up(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'vault_runa_detonation_charge_gain_up');
  if (amount <= 0) return;
  AddPartySessionPassive(ctx, 'RunaTotemChargeGain', amount, 'vault_runa_detonation_charge_gain_up');
}

function vault_runa_detonation_burst_up(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'vault_runa_detonation_burst_up');
  if (amount <= 0) return;
  AddPartySessionPassive(ctx, 'RunaTotemDetonationBurst', amount, 'vault_runa_detonation_burst_up');
}

function vault_runa_totem_expiry_burst_up(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'vault_runa_totem_expiry_burst_up');
  if (amount <= 0) return;
  AddPartySessionPassive(ctx, 'RunaTotemExpiryBurst', amount, 'vault_runa_totem_expiry_burst_up');
}

function vault_runa_totem_death_burst_retention_up(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'vault_runa_totem_death_burst_retention_up');
  if (amount <= 0) return;
  AddPartySessionPassive(ctx, 'RunaTotemDeathBurstRetention', amount, 'vault_runa_totem_death_burst_retention_up');
}
```

### Kojonn Vault

```js
function vault_scrolls(ctx) {
  AddPartySessionPassive(ctx, 'PartyMagBonus', GetVaultSkillAmount(ctx, 'vault_scrolls'), 'vault_scrolls');
}

function vault_exchange(ctx) {
  AddPartySessionPassive(ctx, 'PowerSwapVsStrongerTarget', GetVaultSkillAmount(ctx, 'vault_exchange'), 'vault_exchange');
}
```

### Party Vault

```js
function vault_lucky_break(ctx) {
  AddPartySessionPassive(ctx, 'RewardBonus', GetVaultSkillAmount(ctx, 'vault_lucky_break'), 'vault_lucky_break');
}

function vault_clean_slate(ctx) {
  AddPartySessionPassive(ctx, 'AutoCleanseCharges', GetVaultSkillAmount(ctx, 'vault_clean_slate'), 'vault_clean_slate');
}
```

## Pseudocode Guardrails

- Keep affinity passive.
- Keep hero elite skills proc-driven and momentary.
- Keep party skills readable through one clear trigger and one clear payoff.
- Keep Vault skills passive and backgrounded.
- Do not let affinity or Vault alter skill draw cadence unless that is a deliberate separate relic design.
- Any counterattack, intercept, reflect, spike block, heal-on-hit, or turn-shift skill should ship with an explicit visual handler, not text-only feedback.
