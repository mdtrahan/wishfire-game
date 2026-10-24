import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isHeroBasicTargetInRange, resolveHeroAttackTarget } from '../src/core/heroAttackTargetingRules.mjs';

test('a basic attack acquires and retargets only enemies already inside the firing line', () => {
  const enemies = [
    { uid: 1, hp: 10, x: 350, streamState: 'approaching' },
    { uid: 2, hp: 10, x: 289, streamState: 'in_range' },
    { uid: 3, hp: 10, x: 280, streamState: 'engaged' },
  ];
  const hero = { kind: 'hero', hp: 10, footX: 230, footY: 0, attackType: 'magic' };
  const pick = () => resolveHeroAttackTarget({ hero, enemies, inRange: enemy => isHeroBasicTargetInRange(enemy, hero) });
  assert.equal(pick(1), enemies[2]);
  enemies[2].hp = 0;
  assert.equal(pick(2), enemies[1]);
  enemies[1].hp = 0;
  assert.equal(pick(3), null);
  enemies[0].x = 289;
  enemies[0].footX = 289;
  enemies[0].streamState = 'in_range';
  assert.equal(pick(3), enemies[0]);
});

test('continuous heroes choose their own closest living foe, including behind the party', () => {
 const left={uid:11,hp:10,footX:0,footY:0},right={uid:12,hp:10,footX:100,footY:0},enemies=[right,left];
 const neverRandom=()=>{throw Error('nearest targeting does not draw RNG');};
 assert.equal(resolveHeroAttackTarget({hero:{footX:10,footY:0},enemies,randomPick:neverRandom}),left);
 assert.equal(resolveHeroAttackTarget({hero:{footX:90,footY:0},enemies,randomPick:neverRandom}),right);
 left.hp=0;assert.equal(resolveHeroAttackTarget({hero:{footX:10,footY:0},enemies}),right);
 right.hp=0;assert.equal(resolveHeroAttackTarget({hero:{footX:10,footY:0},enemies}),null);
});

test('runtime sends each Hero to nearest targeting and keeps per-actor range validation', () => {
  const source = readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');
  const basics = source.slice(source.indexOf('export function TickRealtimeHeroBasics('), source.indexOf('function HeroAttackSplit('));
  assert.match(basics, /hero, enemies, inRange: enemy => isHeroBasicTargetInRange\(enemy, hero\)/);
  assert.doesNotMatch(basics, /focusTarget|RealtimeHeroFocusTargetUID/);
  assert.match(basics, /scheduleRealtimeActions\(\{ actors, clocks, now, frameSeconds: 1 \/ 60 \}\)/);
  assert.match(basics, /inRange: enemy => isHeroBasicTargetInRange\(enemy, hero\)/);
  assert.match(basics, /fireBasic\(hero\.uid\)/);
  assert.match(source, /if \(realtimeBasic && !isHeroBasicTargetInRange\(target, actor\)\) return;/);
  assert.doesNotMatch(basics, /randomPick/);
  const enemies = [{ uid: 11, hp: 10 }, { uid: 12, hp: 10 }];
  assert.equal(resolveHeroAttackTarget({ enemies, randomPick: living => living[1] }), enemies[1]);
});

test('realtime basics launch visible travel immediately and redraw before a redirected hit', () => {
  for (const path of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /const hitDelay = realtimeBasic \? 0\.52 : Math\.max/);
  }
  const runtime = readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');
  const basics = runtime.slice(runtime.indexOf('export function TickRealtimeHeroBasics('), runtime.indexOf('function HeroAttackSplit('));
  assert.match(basics, /hit\.targetUID = replacement\.uid;\s*hit\.at = Number\(g\.time \|\| 0\) \+ 0\.52;/);
  assert.match(basics, /if \(hit\.effectType \|\| hit\.actionName \|\| hit\.generatedBySkillId \|\| hit\.attackVfxKind === 'split'\) continue;/);
  const simulationTick = readFileSync(new URL('../web-runner/systems/combatSimulationTick.mjs', import.meta.url), 'utf8');
  assert.match(simulationTick, /const sourceEntity = callFunctionWithContext\(fnContext, 'GetActorByUID', hit\.heroUID \|\| hit\.sourceUID\)/);
  assert.match(simulationTick, /const impactSource = hit\.allowSourceKO && Number\(sourceEntity\?\.hp \|\| 0\) <= 0/);
  assert.match(simulationTick, /hit\.realtimeBasic && Number\(state\.globals\.ContinuousCombatStageLoop \|\| 0\) === 1 && !isActorRanged\(impactSource\) && !isHeroBasicTargetInRange\(targetEntity, impactSource\)/);
  assert.match(simulationTick, /Number\(state\.globals\.ContinuousCombatStageLoop \|\| 0\) !== 1 \|\| isHeroBasicTargetInRange\(entity, impactSource\)/);
  assert.match(simulationTick, /targetEntity = replacement;\s*if \(hit\.realtimeBasic\) \{\s*hit\.at = now \+ 0\.52;\s*continue;/);
});

test('continuous enemies acquire living heroes after spatial contact', () => {
  const source = readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');
  const picker = source.slice(source.indexOf('function pickEnemyTargetHero('), source.indexOf('function applyRunaMagicResist('));
  assert.match(picker, /enemy\?\.streamState !== 'engaged' \|\| enemy\.arenaInReach === false/);
  assert.match(picker, /selectContinuousEnemyTarget\(\{[\s\S]*heroes: getHeroes\(ctx\),[\s\S]*requireInReach: true/);
  const action = source.slice(source.indexOf('export function StartEnemyAction('), source.indexOf('export function SpawnDamageText('));
  assert.match(action, /const target = pickEnemyTargetHero\(ctx, enemyUID\);\s*if \(!target\) return;/);
});
