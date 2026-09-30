import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { recordEnemyDefeatReward, resolveRealtimeBasicImpact } from '../web-runner/modules/heroCommands.mjs';
import { processPendingHeroHits } from '../web-runner/systems/combatSimulationTick.mjs';

const bankSource = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');

function loadHeroAttackSingle() {
  const start = bankSource.indexOf('export function HeroAttackSingle(');
  const end = bankSource.indexOf('\nexport function HeroAttackAOE(', start);
  const body = bankSource.slice(start, end).replace('export function', 'function');
  return new Function(
    'getActorNameByUID', 'GetActorByUID', 'isHeroBasicTargetInRange', 'LogCombat', 'IsPartySkillActive', 'PARTY_SPLIT_ID',
    'GetPowerAmpMultiplierForActor', 'ConsumePowerAmpForActor', 'ensurePowerAmpByUID', 'CalculateDamage', 'getGlobals',
    'ensureActorRedAttackSkillStore', 'combatAttackVfxKind', 'queuePartyChainStrikeBounce', 'queuePartyArcanePulse',
    `${body}; return HeroAttackSingle;`,
  )(
    () => 'Falie',
    (ctx, uid) => ctx.state.entities.find(actor => Number(actor.uid) === Number(uid)) || null,
    () => true,
    () => {},
    () => false,
    'party_split',
    () => 0,
    () => 0,
    () => ({}),
    () => 23,
    ctx => ctx.state.globals,
    () => ({}),
    () => 'melee_crescent',
    () => {},
    () => {},
  );
}

function fixture({ heroStatuses = [], enemyStatuses = [], heroHP = 100, enemyHP = 100, damage = 20, random = 0.1 } = {}) {
  const hero = { uid: 1, kind: 'hero', name: 'Falie', hp: heroHP, maxHP: 100, currentLevel: 1, statuses: heroStatuses, attackType: 'melee' };
  const enemy = { uid: 2, kind: 'enemy', name: 'Gobloc', hp: enemyHP, maxHP: 100, statuses: enemyStatuses, x: 100, y: 100, expValue: 7, goldValue: 4 };
  const hit = { at: 5, heroUID: 1, targetUID: 2, dmg: damage, finalDmg: damage, msg: 'Falie hit Gobloc for 20!', realtimeBasic: 1, combatRulesBasic: 1, retargetOnDeath: 1, attackVfxKind: 'melee_crescent' };
  const globals = {
    time: 5,
    ContinuousCombatStageLoop: 1,
    PendingHeroHits: [hit],
    RuntimeRandom: () => random,
    ProgressionBattle: { id: 'basic-reward', participants: ['Falie'], defeated: {}, defeatedGold: {}, persistPendingRewards() { this.rewardFlushes = Number(this.rewardFlushes || 0) + 1; } },
    DamageTexts: [], SpawnDamageText: 0,
    BasicHitHookCount: 0,
  };
  const state = { globals, entities: [hero, enemy] };
  const context = { state, callFunction(name, ...args) {
    if (name === 'CalculateDamage') return 10 * Number(args[3] || 100) / 100;
    if (name === 'ApplyDamageToTarget') {
      const target = state.entities.find(actor => Number(actor.uid) === Number(args[0]));
      const before = Number(target?.hp || 0);
      target.hp = Math.max(0, before - Number(args[1] || 0));
      if (target?.kind === 'enemy' && before > target.hp && Number(args[2]?.suppressPartySkillHitHooks || 0) === 0) globals.BasicHitHookCount += 1;
      if (target?.kind === 'enemy' && before > 0 && target.hp === 0) recordEnemyDefeatReward(globals.ProgressionBattle, target);
      return before - target.hp;
    }
    return undefined;
  }};
  const calls = [];
  const callFunctionWithContext = (_fnContext, name, ...args) => {
    calls.push([name, ...args]);
    if (name === 'GetActorByUID') return state.entities.find(actor => Number(actor.uid) === Number(args[0])) || null;
    if (name === 'ResolveRealtimeHeroBasicImpact') return resolveRealtimeBasicImpact(context, args[0]);
    if (name === 'ApplyDamageToTarget') return context.callFunction(name, ...args);
    if (name === 'LogCombat') return undefined;
    return undefined;
  };
  const run = (rangeCheck = () => true) => processPendingHeroHits({
    state, fnContext: {}, callFunctionWithContext,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_IMPACT_HANDOFF_SEC: 0.1 },
    queueImpactVfx: (...args) => calls.push(['impactVfx', ...args]),
    isHeroBasicTargetInRange: rangeCheck,
  });
  return { state, hero, enemy, hit, calls, run };
}

test('HeroAttackSingle marks only the ordinary realtime basic packet for rules resolution', () => {
  const hero = { uid: 1, kind: 'hero', name: 'Falie', attackType: 'melee' };
  const enemy = { uid: 2, kind: 'enemy', name: 'Gobloc', hp: 100, x: 100, y: 100 };
  const globals = { time: 3, PendingHeroHits: [] };
  const ctx = { state: { globals, entities: [hero, enemy] } };
  loadHeroAttackSingle()(ctx, hero.uid, enemy.uid, true);
  assert.equal(globals.PendingHeroHits[0].combatRulesBasic, 1);
  assert.equal(globals.PendingHeroHits[0].finalDmg, 23);
  assert.equal(globals.PendingHeroHits[0].effectType, undefined);
});

test('basic impact applies the launch-computed numeric damage and keeps impact VFX timing', () => {
  const { state, enemy, calls, run } = fixture({ damage: 23 });
  run();
  assert.equal(enemy.hp, 77);
  assert.equal(state.globals.BasicHitHookCount, 1, 'the legacy on-hit hook still runs once');
  assert.equal(calls.filter(([name]) => name === 'impactVfx').length, 1);
});

test('basic impact resolves Blind at impact while retaining the attack impact presentation', () => {
  const { enemy, calls, run } = fixture({ heroStatuses: [{ statusEffect: 'blind', magnitude: 0.35 }], random: 0.99 });
  run();
  assert.equal(enemy.hp, 100);
  assert.equal(calls.filter(([name]) => name === 'impactVfx').length, 1);
  assert.ok(calls.some(([name, message]) => name === 'LogCombat' && message.endsWith('for 0!')));
});

test('basic impact applies damage cut and barrier before HP damage', () => {
  const result = fixture({ enemyStatuses: [{ statusEffect: 'damageCut', magnitude: 0.5 }, { statusEffect: 'barrier', magnitude: 0.2, remaining: 5 }] });
  result.run();
  assert.equal(result.enemy.hp, 95);
  assert.equal(result.enemy.statuses.find(status => status.statusEffect === 'barrier').remaining, 0);
  assert.ok(result.calls.some(([name, message]) => name === 'LogCombat' && message.endsWith('for 5!')));
});

test('basic impact uses the rules counter reaction and records KO rewards through onKO', () => {
  const counter = fixture({ enemyStatuses: [{ statusEffect: 'counter', magnitude: 0.5 }], damage: 20 });
  counter.run();
  assert.equal(counter.hero.hp, 95);

  const lethal = fixture({ enemyHP: 20, damage: 20 });
  lethal.run();
  assert.deepEqual({ ...lethal.state.globals.ProgressionBattle.defeated }, { 2: 7 });
  assert.deepEqual({ ...lethal.state.globals.ProgressionBattle.defeatedGold }, { 2: 4 });
  assert.equal(lethal.state.globals.ProgressionBattle.rewardFlushes, 1, 'the duplicate KO callback does not flush a second receipt');
});

test('an already launched basic still resolves when its hero is KO at projectile impact', () => {
  const { hero, enemy, run } = fixture({ damage: 13 });
  hero.hp = 0;
  run();
  assert.equal(enemy.hp, 87);
});

test('a launched basic loses its hit and impact VFX when its target crosses outside the line', () => {
  const { state, enemy, calls, run } = fixture({ damage: 13 });
  enemy.x = 340;
  run(target => target === enemy && target.x <= 290);
  assert.equal(enemy.hp, 100);
  assert.equal(state.globals.PendingHeroHits?.length || 0, 0);
  assert.equal(calls.filter(([name]) => name === 'impactVfx').length, 0);
});

test('a dead or out-of-range captured target waits for an eligible retarget before resolving', () => {
  const { state, hit, enemy, calls, run } = fixture();
  enemy.hp = 0;
  const outOfRange = { uid: 3, kind: 'enemy', hp: 50, x: 500, y: 100 };
  const inRange = { uid: 4, kind: 'enemy', hp: 50, x: 100, y: 100 };
  state.entities.push(outOfRange, inRange);
  run(target => target === inRange);
  assert.equal(hit.targetUID, 4);
  assert.equal(hit.at, 5.52);
  assert.equal(inRange.hp, 50);
  assert.equal(calls.filter(([name]) => name === 'ResolveRealtimeHeroBasicImpact').length, 0);
});
