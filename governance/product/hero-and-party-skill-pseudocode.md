# Hero and Party Skill Pseudocode

Purpose:
- Give Codex and future implementers one stable pseudocode reference for the current hero, party, Vault, and affinity skill set.
- Mirror the repo's actual runtime language where possible so later implementation can land in `web-runner/modules/functionBank.js`, `web-runner/modules/skillSheet.js`, and `web-runner/modules/state.js` without needless renaming.
- Stay high-level enough to allow tuning changes without rewriting the whole document.
- Treat this as the implementation-start surface for future skill coding work.

Companion references:
- skill definitions: [hero-and-party-skills.md](/Users/Mace/Codex-Orka/governance/product/hero-and-party-skills.md)
- runtime behavior: [game-function-reference.md](/Users/Mace/Codex-Orka/governance/product/game-function-reference.md)

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

These helpers do not all exist yet. They are the intended shaping seams.

```js
function RollSkillProc(ctx, ownerUID, skillId) {
  const chance = GetSkillProcChance(ctx, ownerUID, skillId);
  return random01(ctx) <= chance;
}

function GetSkillGrowthBonus(ctx, ownerUID, skillId) {
  // Read tier growth from the skill definition layer.
  // Return a tuned scalar or flat amount based on current skill tier.
}

function AddEnemyDebuff(ctx, enemyUID, stat, amount, turns) {
  const g = getGlobals(ctx);
  if (!g.EnemyDebuffs) g.EnemyDebuffs = {};
  if (!g.EnemyDebuffs[enemyUID]) g.EnemyDebuffs[enemyUID] = {};
  g.EnemyDebuffs[enemyUID][stat] = Math.max(0, (g.EnemyDebuffs[enemyUID][stat] || 0) + amount);
  SetEnemyDebuffTurns(ctx, enemyUID, stat, turns);
}

function AddHeroTempState(ctx, heroUID, key, value, turns) {
  const g = getGlobals(ctx);
  if (!g.HeroTempStates) g.HeroTempStates = {};
  if (!g.HeroTempStates[heroUID]) g.HeroTempStates[heroUID] = {};
  g.HeroTempStates[heroUID][key] = { value, turns };
}

function GetHeroTempState(ctx, heroUID, key) {
  return getGlobals(ctx).HeroTempStates?.[heroUID]?.[key] || null;
}

function AddSessionPassive(ctx, key, amount) {
  const g = getGlobals(ctx);
  if (!g.SessionPassives) g.SessionPassives = {};
  g.SessionPassives[key] = (g.SessionPassives[key] || 0) + amount;
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
  AddSessionPassive(ctx, 'GoldGainFlat', bonus);
}

function ApplyRunaAffinity(ctx) {
  const bonus = GetAffinityValue(ctx, 'Runa');
  if (bonus <= 0) return;
  AddSessionPassive(ctx, 'HeroMAG_Runa', bonus);
}

function ApplyKojonnAffinity(ctx) {
  const bonus = GetAffinityValue(ctx, 'Kojonn');
  if (bonus <= 0) return;
  AddSessionPassive(ctx, 'AllyPower_Kojonn', bonus);
}
```

## Falie

### Ward Bash

```js
function Skill_Falie_WardBash(ctx, falieUID, attackerUID) {
  if (!RollSkillProc(ctx, falieUID, 'WardBash')) return;
  PlayReactionPose(ctx, falieUID, 'ward_bash');
  SpawnCounterStrike(ctx, falieUID, attackerUID);
  const dmg = CalculateDamage(ctx, falieUID, attackerUID, 'physical');
  ApplyDamageToTarget(ctx, attackerUID, dmg);
  LogCombat(ctx, 'Falie counters with Ward Bash.');
}
```

### Cover / Block

```js
function Skill_Falie_CoverBlock(ctx, falieUID, allyUID, incomingDamage) {
  if (!RollSkillProc(ctx, falieUID, 'CoverBlock')) return incomingDamage;
  PlayReactionPose(ctx, falieUID, 'intercept');
  PlayInterceptMove(ctx, falieUID, allyUID);
  SpawnImpactVFX(ctx, falieUID, 'cover_block');
  RedirectIncomingDamage(ctx, allyUID, falieUID, incomingDamage);
  AddHeroTempState(ctx, falieUID, 'CoveredAllyThisTurn', 1, 1);
  RestoreInterceptMove(ctx, falieUID);
  LogCombat(ctx, 'Falie steps in and takes the hit.');
  return 0;
}
```

### Reprisal / Bounce

```js
function Skill_Falie_ReprisalBounce(ctx, falieUID, attackerUID, damageTaken) {
  if (!RollSkillProc(ctx, falieUID, 'ReprisalBounce')) return;
  const pct = GetSkillGrowthBonus(ctx, falieUID, 'ReprisalBounce');
  const reflectDamage = Math.max(1, Math.floor(damageTaken * pct));
  PlayReactionPose(ctx, falieUID, 'reprisal');
  SpawnReflectArc(ctx, falieUID, attackerUID);
  ApplyDamageToTarget(ctx, attackerUID, reflectDamage);
  LogCombat(ctx, 'Falie reflects part of the blow.');
}
```

### Phalanx

```js
function Skill_Falie_Phalanx(ctx, falieUID, incomingDamage) {
  if (!IsHeavyHit(ctx, incomingDamage)) return incomingDamage;
  if (!RollSkillProc(ctx, falieUID, 'Phalanx')) return incomingDamage;
  const denyPct = GetSkillGrowthBonus(ctx, falieUID, 'Phalanx');
  const reduced = Math.max(1, incomingDamage - Math.floor(incomingDamage * denyPct));
  PlayReactionPose(ctx, falieUID, 'phalanx');
  SpawnImpactVFX(ctx, falieUID, 'heavy_block');
  LogCombat(ctx, 'Falie cuts down a crushing hit.');
  return reduced;
}
```

## Huun

### Bell

```js
function Skill_Huun_Bell(ctx, huunUID, targetUID, baseDamage) {
  if (!WasComboFinisher(ctx, huunUID)) return baseDamage;
  if (!RollSkillProc(ctx, huunUID, 'Bell')) return baseDamage;
  const multiplier = 2 + GetSkillGrowthBonus(ctx, huunUID, 'Bell');
  return Math.ceil(baseDamage * multiplier);
}
```

### Glare

```js
function Skill_Huun_Glare(ctx, huunUID, targetUID) {
  if (!RollSkillProc(ctx, huunUID, 'Glare')) return;
  DelayEnemyTurn(ctx, targetUID, 2);
  SpawnImpactVFX(ctx, targetUID, 'glare_stagger');
  ShowTurnShiftVFX(ctx, targetUID, 'back');
  LogCombat(ctx, 'Huun pushes the enemy back.');
}
```

### Trinity

```js
function Skill_Huun_Trinity(ctx, huunUID, targetUID) {
  if (!WasComboFinisher(ctx, huunUID)) return;
  if (!RollSkillProc(ctx, huunUID, 'Trinity')) return;
  PlayReactionPose(ctx, huunUID, 'trinity');
  RepeatHeroAttack(ctx, huunUID, targetUID, 2);
  LogCombat(ctx, 'Huun unleashes Trinity.');
}
```

### Growth

```js
function Skill_Huun_Growth(ctx, huunUID, dealtDamage) {
  if (dealtDamage <= 0) return;
  if (!RollSkillProc(ctx, huunUID, 'Growth')) return;
  const gain = ConvertDamageToAstralFlow(ctx, dealtDamage, huunUID, 'Growth');
  AddAstralFlowWallet(ctx, gain);
  LogCombat(ctx, 'Huun turns damage into Astral Flow.');
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
  if (!RollSkillProc(ctx, runaUID, 'AuraTotemBlast')) return;
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
    destructible: true,
  });
  SpawnTotemVFX(ctx, runaUID, targetUID, 'runa_blast_detonate_totem');
  LogCombat(ctx, 'Runa summons a charged blast totem.');
}
```

### Aura Totem: Burn

```js
function Skill_Runa_AuraTotemBurn(ctx, runaUID, targetUID) {
  if (!RollSkillProc(ctx, runaUID, 'AuraTotemBurn')) return;
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
  ApplyDamageToTarget(ctx, totem.targetUID, totem.tickDamage);
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
  ApplyDamageToTarget(ctx, totem.targetUID, payload);
}

function OnRunaTotemDestroyed(ctx, totemUID) {
  if (!IsRunaTotem(ctx, totemUID)) return;
  const totem = GetTotemState(ctx, totemUID);
  if (totem.totemType !== 'Detonate') return;
  const baseBurst = totem.detonationBase || 0;
  const storedCharge = (totem.charge || 0) * (1 + (totem.deathBurstRetentionBonus || 0));
  const payload = baseBurst + storedCharge;
  ApplyDamageToTarget(ctx, totem.targetUID, payload);
}
```

### Invert

```js
function Skill_Runa_Invert(ctx, runaUID, targetUID) {
  if (!RollSkillProc(ctx, runaUID, 'Invert')) return;
  const enemy = GetActorByUID(ctx, targetUID);
  if (!enemy) return;
  const enemyATK = GetBaseStat(ctx, enemy, 'ATK');
  const enemyRES = GetBaseStat(ctx, enemy, 'RES');
  enemy.stats.ATK = enemyRES;
  enemy.stats.RES = enemyATK;
  SpawnStatusAura(ctx, targetUID, 'invert');
  LogCombat(ctx, 'Runa inverts the enemy matchup.');
}
```

### Intensify

```js
function Skill_Runa_Intensify(ctx, runaUID) {
  if (!WasRedMatch(ctx, runaUID)) return;
  if (!RollSkillProc(ctx, runaUID, 'Intensify')) return;
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
  if (!RollSkillProc(ctx, kojonnUID, 'Lock')) return;
  AddHeroTempState(ctx, kojonnUID, 'FreeGemUse', 1, 1);
  SpawnStatusAura(ctx, kojonnUID, 'free_cast');
  LogCombat(ctx, 'Kojonn uses the next gem action at no cost.');
}
```

### Lift

```js
function Skill_Kojonn_Lift(ctx, kojonnUID, allyUID) {
  if (!RollSkillProc(ctx, kojonnUID, 'Lift')) return;
  const amt = GetSkillGrowthBonus(ctx, kojonnUID, 'Lift');
  AddHeroTempState(ctx, allyUID, 'AttackPowerBoost', amt, 1);
  SpawnStatusAura(ctx, allyUID, 'lift');
  LogCombat(ctx, 'Kojonn raises an ally\'s power.');
}
```

### Step

```js
function Skill_Kojonn_Step(ctx, kojonnUID, allyUID) {
  if (!RollSkillProc(ctx, kojonnUID, 'Step')) return;
  AdvanceAllyTurn(ctx, allyUID, 2);
  ShowTurnShiftVFX(ctx, allyUID, 'forward');
  LogCombat(ctx, 'Kojonn moves an ally forward.');
}
```

### Elevate

```js
function Skill_Kojonn_Elevate(ctx, kojonnUID, allyUID) {
  if (!RollSkillProc(ctx, kojonnUID, 'Elevate')) return;
  AddHeroTempState(ctx, allyUID, 'EffectTierUp', 1, 1);
  SpawnStatusAura(ctx, allyUID, 'elevate');
  LogCombat(ctx, 'Kojonn elevates an ally effect.');
}
```

## Party Skills

### Fresh Start

```js
function PartySkill_FreshStart(ctx) {
  if (!RollPartySkillProc(ctx, 'FreshStart')) return;
  AddPartyTimedBuff(ctx, 'ATK', GetPartySkillAmount(ctx, 'FreshStart'), 1);
  LogCombat(ctx, 'The party opens strong.');
}
```

### Second Chance

```js
function PartySkill_SecondChance(ctx) {
  if (!IsWeakBoardState(ctx)) return;
  if (!RollPartySkillProc(ctx, 'SecondChance')) return;
  RerollRandomSelectedGemSubset(ctx, 3);
  ShowBoardEffectVFX(ctx, 'reroll');
  LogCombat(ctx, 'Second Chance refreshes part of the board.');
}
```

### Momentum

```js
function PartySkill_Momentum(ctx) {
  if (!WasComboFinisherChain(ctx)) return;
  if (!RollPartySkillProc(ctx, 'Momentum')) return;
  AddPartyTimedBuff(ctx, 'ATK', GetPartySkillAmount(ctx, 'Momentum'), 1);
  LogCombat(ctx, 'Momentum carries into the next action.');
}
```

### Guard Rail

```js
function PartySkill_GuardRail(ctx, incomingDamage) {
  if (!IsHeavyHit(ctx, incomingDamage)) return incomingDamage;
  if (!RollPartySkillProc(ctx, 'GuardRail')) return incomingDamage;
  const pct = GetPartySkillAmount(ctx, 'GuardRail');
  SpawnImpactVFX(ctx, 'party_bar', 'guard_rail');
  return Math.max(1, incomingDamage - Math.floor(incomingDamage * pct));
}
```

### Blue Spark

```js
function PartySkill_BlueSpark(ctx, consumedBlue) {
  if (consumedBlue <= 0) return;
  if (!RollPartySkillProc(ctx, 'BlueSpark')) return;
  const bonus = GetPartySkillAmount(ctx, 'BlueSpark');
  AddPartyTimedBuff(ctx, 'MAG', bonus, 1);
  LogCombat(ctx, 'Blue Spark charges the party.');
}
```

### Weaken

```js
function PartySkill_Weaken(ctx, targetUID) {
  if (!WasSpecialHit(ctx)) return;
  if (!RollPartySkillProc(ctx, 'Weaken')) return;
  AddEnemyDebuff(ctx, targetUID, 'DEF', GetPartySkillAmount(ctx, 'Weaken'), 2);
  LogCombat(ctx, 'The enemy is weakened.');
}
```

### Destiny

```js
function PartySkill_Destiny(ctx) {
  if (!WasValidGemMatch(ctx)) return;
  if (!RollPartySkillProc(ctx, 'Destiny')) return;
  ApplyPartyHeal(ctx, GetPartySkillAmount(ctx, 'Destiny'));
  SpawnHealPulse(ctx, 'party_bar', 'destiny');
  LogCombat(ctx, 'Destiny restores party health.');
}
```

### Hot Streak

```js
function PartySkill_HotStreak(ctx) {
  if (!WasConsecutiveMatchChain(ctx, 2)) return;
  if (!RollPartySkillProc(ctx, 'HotStreak')) return;
  AddSessionPassive(ctx, 'RewardChainBonus', GetPartySkillAmount(ctx, 'HotStreak'));
  LogCombat(ctx, 'Hot Streak improves the next payoff.');
}
```

### Last Push

```js
function PartySkill_LastPush(ctx) {
  if (!IsLowPartyHP(ctx)) return;
  if (!RollPartySkillProc(ctx, 'LastPush')) return;
  AddPartyTimedBuff(ctx, 'ATK', GetPartySkillAmount(ctx, 'LastPush'), 1);
  AddPartyTimedBuff(ctx, 'MAG', GetPartySkillAmount(ctx, 'LastPush'), 1);
  SpawnStatusAura(ctx, 'party_bar', 'last_push');
  LogCombat(ctx, 'The party finds a last push.');
}
```

### Chain Pop

```js
function PartySkill_ChainPop(ctx) {
  if (!WasValidGemMatch(ctx)) return;
  if (!RollPartySkillProc(ctx, 'ChainPop')) return;
  TriggerExtraBoardEffect(ctx);
  ShowBoardEffectVFX(ctx, 'chain_pop');
  LogCombat(ctx, 'Chain Pop triggers an extra board effect.');
}
```

## Vault Skills

Vault skills are passive by default. They should hook into stat query, reward gain, encounter init, or receive/heal seams rather than combat-side proc loops.

### Falie Vault

```js
function Vault_Crusade(ctx) {
  AddSessionPassive(ctx, 'EnmityBias', GetVaultSkillAmount(ctx, 'Crusade'));
}

function Vault_Protect(ctx) {
  AddSessionPassive(ctx, 'PhysicalMitigation', GetVaultSkillAmount(ctx, 'Protect'));
}

function Vault_Shell(ctx) {
  AddSessionPassive(ctx, 'MagicMitigation', GetVaultSkillAmount(ctx, 'Shell'));
}

function Vault_Formless(ctx) {
  AddSessionPassive(ctx, 'DotMitigation', GetVaultSkillAmount(ctx, 'Formless'));
}
```

### Huun Vault

```js
function Vault_Rabbithole(ctx) {
  AddSessionPassive(ctx, 'GoldGainFlat', GetVaultSkillAmount(ctx, 'Rabbithole'));
}

function Vault_Consume(ctx) {
  AddSessionPassive(ctx, 'EnemyHealInvert', GetVaultSkillAmount(ctx, 'Consume'));
}

function Vault_Scout(ctx) {
  AddSessionPassive(ctx, 'SpeedToAttackScalar', GetVaultSkillAmount(ctx, 'Scout'));
}

function Vault_Steal(ctx) {
  AddSessionPassive(ctx, 'BlueToAttackScalar', GetVaultSkillAmount(ctx, 'Steal'));
}

function Vault_Lucky(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'Lucky');
  if (amount <= 0) return;
  AddSessionPassive(ctx, 'BlueToGreenConvert', amount);
}
```

### Runa Vault

```js
function Vault_Inspire(ctx) {
  AddSessionPassive(ctx, 'PartyResBonus', GetVaultSkillAmount(ctx, 'Inspire'));
}

function Vault_Ignore(ctx) {
  AddSessionPassive(ctx, 'MagicResPierceOnGreen', GetVaultSkillAmount(ctx, 'Ignore'));
}

function Vault_Insight(ctx) {
  AddSessionPassive(ctx, 'EnemyMagToRedScalar', GetVaultSkillAmount(ctx, 'Insight'));
}

function Vault_RunaTotemDamageUp(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'AuraTotemDamageUp');
  if (amount <= 0) return;
  AddSessionPassive(ctx, 'RunaTotemDamageScalar', amount);
}

function Vault_RunaTotemDurationUp(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'AuraTotemDurationUp');
  if (amount <= 0) return;
  AddSessionPassive(ctx, 'RunaTotemDurationBonus', amount);
}

function Vault_RunaTotemHPUp(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'AuraTotemHpUp');
  if (amount <= 0) return;
  AddSessionPassive(ctx, 'RunaTotemHpBonus', amount);
}

function Vault_RunaDetonationChargeGainUp(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'RunaTotemChargeGainUp');
  if (amount <= 0) return;
  AddSessionPassive(ctx, 'RunaTotemChargeGain', amount);
}

function Vault_RunaDetonationBurstUp(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'RunaTotemDetonationBurstUp');
  if (amount <= 0) return;
  AddSessionPassive(ctx, 'RunaTotemDetonationBurst', amount);
}

function Vault_RunaTotemExpiryBurstUp(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'RunaTotemExpiryBurstUp');
  if (amount <= 0) return;
  AddSessionPassive(ctx, 'RunaTotemExpiryBurst', amount);
}

function Vault_RunaTotemDeathBurstRetentionUp(ctx) {
  const amount = GetVaultSkillAmount(ctx, 'RunaTotemDeathBurstRetentionUp');
  if (amount <= 0) return;
  AddSessionPassive(ctx, 'RunaTotemDeathBurstRetention', amount);
}
```

### Kojonn Vault

```js
function Vault_Scrolls(ctx) {
  AddSessionPassive(ctx, 'PartyMagBonus', GetVaultSkillAmount(ctx, 'Scrolls'));
}

function Vault_Exchange(ctx) {
  AddSessionPassive(ctx, 'PowerSwapVsStrongerTarget', GetVaultSkillAmount(ctx, 'Exchange'));
}
```

### Party Vault

```js
function Vault_LuckyBreak(ctx) {
  AddSessionPassive(ctx, 'RewardBonus', GetVaultSkillAmount(ctx, 'LuckyBreak'));
}

function Vault_CleanSlate(ctx) {
  AddSessionPassive(ctx, 'AutoCleanseCharges', GetVaultSkillAmount(ctx, 'CleanSlate'));
}
```

## Implementation Rules

- Keep affinity passive.
- Keep hero elite skills proc-driven and momentary.
- Keep party skills readable through one clear trigger and one clear payoff.
- Keep Vault skills passive and backgrounded.
- Do not let affinity or Vault alter skill draw cadence unless that is a deliberate separate relic design.
- Any counterattack, intercept, reflect, spike block, heal-on-hit, or turn-shift skill should ship with an explicit visual handler, not text-only feedback.
