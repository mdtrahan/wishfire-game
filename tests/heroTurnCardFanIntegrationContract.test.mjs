import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { resolveIncomingNativeHit, resolveNativeCommandStep, rulesContext, settleDefeat } from '../web-runner/modules/heroCommands.mjs';
import { createQuestCombatSession } from '../web-runner/systems/questCombatSession.mjs';
import { hasStatus, resolveSkill, turnStart } from '../web-runner/src/core/combatRules.mjs';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated ${name}`);
}

function createCardSelectionHarness({ startResult = 1, cards = [{ id: 'fara_alley_jab', name: 'Alley Jab' }] } = {}) {
  const source = read('web-runner/modules/functionBank.js');
  const context = {
    getGlobals: ctx => ctx.state.globals,
    getEntities: ctx => ctx.state.entities,
    GetActorByUID: (ctx, uid) => ctx.state.entities.find(actor => Number(actor.uid) === Number(uid)) || null,
    GetCurrentTurn: () => 1,
    StartHeroLunge: () => startResult,
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunctionSource(source, 'clearHeroTurnCardFan'),
    extractFunctionSource(source, 'cardSkillFromDefinition'),
    extractFunctionSource(source, 'heroTurnCardTargets'),
    extractFunctionSource(source, 'getHeroTurnCardFanState'),
    extractFunctionSource(source, 'selectHeroTurnCard'),
    'this.selectHeroTurnCard = selectHeroTurnCard;',
  ].join('\n'), context);
  const hero = { uid: 1, baseHeroName: 'Falie', kind: 'hero', hp: 20, maxHP: 20 };
  const enemy = { uid: 9, kind: 'enemy', hp: 20, maxHP: 20 };
  const globals = {
    CombatSessionId: 3,
    TurnSerial: 7,
    TurnPhase: 0,
    NativeBattleEnded: 0,
    HeroTurnCardFanOpen: 1,
    HeroTurnCardFanHeroUID: 1,
    HeroTurnCardFanCards: cards,
    HeroTurnCardFanSelectedCardId: '',
    HeroTurnCardFanTargetUID: 0,
    HeroTurnCardFanPendingCardIndex: -1,
    HeroTurnCardFanPendingCardId: '',
    HeroTurnCardFanPendingTarget: 0,
    HeroTurnCardFanPendingTargetKind: '',
    HeroTurnCardFanBlockedCardId: '',
  };
  const ctx = { state: { globals, entities: [hero, enemy] } };
  return { context, ctx, globals, cards };
}

test('combat integration exposes the fan lifecycle in both runtime mirrors and app wiring', () => {
  for (const file of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const source = read(file);
    for (const name of ['OpenHeroTurnCardFan', 'ReopenHeroTurnCardFan', 'CancelHeroTurnCardFan', 'SelectHeroTurnCard', 'GetHeroTurnCardFanState']) {
      assert.match(source, new RegExp(`(?:export const|export function) ${name}`), `${file} ${name}`);
    }
  }
  const app = read('web-runner/app.js');
  assert.match(app, /createHeroTurnCardFanUI/);
  assert.match(app, /SelectHeroTurnCard/);
  assert.match(app, /HeroTurnCardFanOpen/);
  assert.match(app, /SettleCombatDefeat/);
  assert.match(app, /no_living_heroes/);
  const reset = read('web-runner/systems/combatSessionReset.mjs');
  assert.match(reset, /HeroTurnCardFanOpen:\s*0/);
  assert.match(reset, /HeroTurnCardFanCards:\s*\[\]/);
  assert.match(reset, /HeroTurnCardFanPendingTarget:\s*0/);
});

test('targeted card selection hands off to the existing battlefield selectors', () => {
  const app = read('web-runner/app.js');
  const fan = read('web-runner/systems/heroTurnCardFanUI.mjs');
  assert.doesNotMatch(app, /getTargets\s*:/, 'app does not provide a duplicate fan target menu');
  assert.doesNotMatch(fan, /fan-target|targetsHost|targeting/, 'fan UI has no duplicate target controls');
  assert.match(app, /HeroTurnCardFanPendingTarget/);
  assert.match(app, /fanBlocked/);
  assert.match(app, /heroCommandUI\.selectBattlefieldActor\(enemyTarget\)/);
  assert.match(app, /heroCommandUI\.selectBattlefieldAlly\(/);
  const commandUpdate = app.slice(app.indexOf('heroCommandUI.update({'), app.indexOf('      worldToCanvas, layoutScale, portraits: heroPortraitImages,', app.indexOf('heroCommandUI.update({')));
  assert.doesNotMatch(commandUpdate, /\|\| !!fanState\.open/, 'fan visibility must not disable battlefield selection');
  assert.match(app, /SelectHeroTurnCard', state\.globals\.HeroTurnCardFanPendingCardIndex/);
  assert.match(app, /ev\.key === 'Escape'.*HeroTurnCardFanPendingTarget/s);
  assert.match(app, /Falie: 'Fara'.*Huun: 'Hondo'.*Kojonn: 'Kaja'/s);
  const source = read('web-runner/modules/functionBank.js');
  assert.match(source, /HeroTurnCardFanPendingTargetKind = skill\.targetType/);
  assert.match(source, /!resolvedTargetUID && skill\.targetType === 'ally'/);
  assert.match(source, /SelectedEnemyUIDOwner = Number\(actor\.uid\)/);
  assert.match(source, /HeroTurnCardFanPendingCardId/);
  assert.match(source, /HeroTurnCardFanPendingExcludeSelf/);
});

test('single enemy cards use the battle selection on card tap and fall back to a living enemy', () => {
  const withSelection = createCardSelectionHarness({ cards: [{ id: 'fara_brass_strike', name: 'Brass Strike' }] });
  withSelection.globals.SelectedEnemyUID = 9;
  withSelection.globals.SelectedEnemyUIDOwner = 77;
  assert.equal(withSelection.context.selectHeroTurnCard(withSelection.ctx, 0), true);
  assert.equal(withSelection.globals.HeroTurnCardFanPendingTarget, 0);
  assert.deepEqual(Array.from(withSelection.globals.NativeCommandSequence.targetIds), [9]);
  assert.equal(withSelection.globals.SelectedEnemyUIDOwner, 1);

  const fallback = createCardSelectionHarness({ cards: [{ id: 'fara_brass_strike', name: 'Brass Strike' }] });
  assert.equal(fallback.context.selectHeroTurnCard(fallback.ctx, 0), true);
  assert.equal(fallback.globals.HeroTurnCardFanPendingTarget, 0);
  assert.deepEqual(Array.from(fallback.globals.NativeCommandSequence.targetIds), [9]);
});

test('single ally cards preselect the active hero and resolve the tapped ally', () => {
  const harness = createCardSelectionHarness({ cards: [{ id: 'kaja_moonwell_flask', name: 'Moonwell Flask' }] });
  const ally = { uid: 2, kind: 'hero', hp: 10, maxHP: 20 };
  harness.ctx.state.entities.push(ally);
  assert.equal(harness.context.selectHeroTurnCard(harness.ctx, 0), true);
  assert.equal(harness.globals.HeroTurnCardFanPendingTarget, 1);
  assert.equal(harness.globals.HeroTurnCardFanTargetUID, 1);
  assert.equal(harness.globals.SelectedAllyUID, 1);
  assert.deepEqual(Array.from(harness.globals.NativeCommandSequence || []), []);
  assert.equal(harness.context.selectHeroTurnCard(harness.ctx, 0, ally.uid), true);
  assert.deepEqual(Array.from(harness.globals.NativeCommandSequence.targetIds), [ally.uid]);
  assert.equal(harness.globals.HeroTurnCardFanPendingTarget, 0);
});

test('hero card healing and barriers emit presentation from the real resolved delta', () => {
  const hero = { uid: 1, kind: 'hero', hp: 18, maxHP: 20, heroIndex: 0, currentLevel: 1, stats: { MAG: 10 }, statuses: [] };
  const ally = { uid: 2, kind: 'hero', hp: 10, maxHP: 20, currentLevel: 1, stats: { MAG: 10 }, statuses: [] };
  const enemy = { uid: 9, kind: 'enemy', hp: 20, maxHP: 20, currentLevel: 1, stats: { MAG: 10 }, statuses: [] };
  const globals = { time: 4, PartyMaxHP: 40, HeroPortraitPosByIndex: [{ x: 12, y: 34 }], DamageTexts: [] };
  const calls = [];
  const ctx = {
    state: { globals, entities: [hero, ally, enemy] },
    callFunction(name, ...args) {
      if (name === 'SpawnDamageText') {
        calls.push([name, ...args]);
        globals.DamageTexts.push({ amount: args[0], x: args[1], y: args[2], kind: args[3], targetKind: args[4] });
      }
    },
  };
  const rules = rulesContext(ctx);
  assert.equal(resolveSkill(rules, hero, { skillId: 'hero_card:heal', targetType: 'ally', effects: [{ effectType: 'heal', potency: .5 }] }, [hero.uid]), true);
  assert.deepEqual(calls.map(call => call.slice(0, 5)), [['SpawnDamageText', 2, 12, 34, 'heal']]);
  assert.deepEqual(globals.DamageTexts[0], { amount: 2, x: 12, y: 34, kind: 'heal', targetKind: 'hero', targetUID: 1, targetSlotIndex: 0 });
  assert.equal(resolveSkill(rules, hero, { skillId: 'hero_card:ward', targetType: 'ally', effects: [{ effectType: 'status', statusEffect: 'barrier', magnitude: .2, duration: 2 }] }, [ally.uid]), true);
  assert.equal(ally.statuses.find(status => status.statusEffect === 'barrier')?.remaining, 4);
  assert.equal(globals.PartyWardBarrierVisualsByUID[2].source, 'hero_turn_card');
  assert.equal(globals.PartyTempHPShield, undefined);
  ally.hp = 10;
  assert.equal(resolveSkill(rules, hero, { skillId: 'hero_card:hot', targetType: 'ally', effects: [{ effectType: 'status', statusEffect: 'hot', magnitude: .25, duration: 1, potency: .25 }] }, [ally.uid]), true);
  turnStart(rules, ally, 1);
  assert.equal(calls.some(call => call[0] === 'SpawnDamageText' && call[1] === 2 && call[4] === 'heal'), true);
});

test('hero status cards cannot open the retired command editor and reopen the active fan', () => {
  const app = read('web-runner/app.js');
  const commandUI = read('web-runner/systems/heroCommandUI.mjs');
  assert.match(app, /onActiveHeroClick: \(\) => \{[\s\S]*ReopenHeroTurnCardFan/);
  assert.match(app, /onBack: \(\) => \{[\s\S]*CancelHeroTurnCardFan'[\s\S]*ReopenHeroTurnCardFan/);
  assert.match(commandUI, /aria-label', 'Party status'/);
  assert.doesNotMatch(commandUI, /openEditor|\.editor|data-skill|Queued skills|\bAct\b|\bReload\b/);
  assert.doesNotMatch(commandUI, /button\(footer,/);
});

test('pending fan targets reuse existing battlefield selector feedback', () => {
  const render = read('web-runner/systems/renderRuntime.js');
  assert.match(render, /heroCardFanPendingEnemy/);
  assert.match(render, /selectedAllyUID = Number\(state\.globals\.HeroTurnCardFanTargetUID \|\| state\.globals\.SelectedAllyUID/);
  assert.match(render, /showHeroCardAllySelector/);
  assert.match(render, /HeroTurnCardFanPendingExcludeSelf/);
  assert.match(render, /heroCardFanPending && hero\?\.uid === heroCardFanHeroUID/);
  assert.doesNotMatch(render, /const targets = heroCardFanPendingEnemy/);
  assert.match(render, /cardBarrier = Array\.isArray\(hero\.statuses\)/);
  assert.match(render, /!cardBarrier && wardState !== 'fadeOut'/);
});

test('combat-entry transition hides a fan without consuming its same-turn draw', () => {
  const app = read('web-runner/app.js');
  assert.match(app, /storyEntry\.pending/,
    'story-entry transition remains part of the fan visibility block');
  assert.doesNotMatch(app, /fanBlocked && !gameState\.storyEntry\.pending && \(fanState\.open \|\| fanState\.pendingTarget\)/,
    'pausing or opening a menu must preserve the runtime fan state for reopen after the fade');
});

test('cancel and active-hero reopen preserve the same three-card draw', () => {
  const source = read('web-runner/modules/functionBank.js');
  const context = {
    getGlobals: ctx => ctx.state.globals,
    GetActorByUID: (ctx, uid) => ctx.state.entities.find(actor => Number(actor.uid) === Number(uid)) || null,
    GetCurrentTurn: () => 1,
    createHeroTurnCardState: () => ({}),
    drawHeroTurnCards: () => { throw new Error('reopen must not redraw'); },
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunctionSource(source, 'openHeroTurnCardFan'),
    extractFunctionSource(source, 'reopenHeroTurnCardFan'),
    extractFunctionSource(source, 'cancelHeroTurnCardFan'),
    'this.reopenHeroTurnCardFan = reopenHeroTurnCardFan; this.cancelHeroTurnCardFan = cancelHeroTurnCardFan;',
  ].join('\n'), context);
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const globals = {
    CombatSessionId: 3, TurnSerial: 7, TurnPhase: 0, NativeBattleEnded: 0,
    HeroTurnCardFanOpen: 0, HeroTurnCardFanHeroUID: 1, HeroTurnCardFanCards: cards,
    HeroTurnCardFanSessionId: 3, HeroTurnCardFanTurnSerial: 7,
    HeroTurnCardFanPendingTarget: 1, HeroTurnCardFanPendingCardIndex: 1,
    HeroTurnCardFanPendingCardId: 'b', HeroTurnCardFanSelectedCardId: 'b',
    HeroTurnCardFanTargetUID: 0, HeroTurnCardFanPendingTargetKind: 'enemy',
    HeroTurnCardFanPendingExcludeSelf: 0, HeroTurnCardFanBlockedCardId: '',
  };
  const ctx = { state: { globals, entities: [{ uid: 1, kind: 'hero', hp: 20 }] } };
  assert.equal(context.cancelHeroTurnCardFan(ctx), true);
  assert.deepEqual(globals.HeroTurnCardFanCards, cards);
  assert.equal(context.reopenHeroTurnCardFan(ctx), true);
  assert.equal(globals.HeroTurnCardFanOpen, 1);
  assert.deepEqual(globals.HeroTurnCardFanCards, cards);
  assert.equal(globals.HeroTurnCardFanPendingTarget, 0);
});

test('active hero decision keeps its exact draw across turn serial and repeated entry updates', () => {
  const source = read('web-runner/modules/functionBank.js');
  const context = {
    getGlobals: ctx => ctx.state.globals,
    GetActorByUID: (ctx, uid) => ctx.state.entities.find(actor => Number(actor.uid) === Number(uid)) || null,
    GetCurrentTurn: () => 1,
    createHeroTurnCardState: () => ({}),
    drawHeroTurnCards: () => { throw new Error('an active decision must not redraw'); },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunctionSource(source, 'openHeroTurnCardFan')}\nthis.openHeroTurnCardFan = openHeroTurnCardFan;`, context);
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const globals = {
    CombatSessionId: 3, TurnSerial: 8, TurnPhase: 0, NativeBattleEnded: 0,
    HeroTurnCardFanOpen: 1, HeroTurnCardFanHeroUID: 1, HeroTurnCardFanCards: cards,
    HeroTurnCardFanSessionId: 3, HeroTurnCardFanTurnSerial: 7,
    HeroTurnCardFanPendingTarget: 0, HeroTurnCardFanPendingCardIndex: -1,
    HeroTurnCardFanPendingCardId: '', HeroTurnCardFanSelectedCardId: 'b',
    HeroTurnCardFanTargetUID: 0, HeroTurnCardFanPendingTargetKind: '',
    HeroTurnCardFanPendingExcludeSelf: 0, HeroTurnCardFanBlockedCardId: '',
  };
  const ctx = { state: { globals, entities: [{ uid: 1, kind: 'hero', hp: 20 }] } };
  assert.equal(context.openHeroTurnCardFan(ctx, 1), true);
  assert.deepEqual(globals.HeroTurnCardFanCards, cards);
  assert.equal(globals.HeroTurnCardFanSelectedCardId, 'b');
  assert.equal(globals.HeroTurnCardFanTurnSerial, 7);
  globals.HeroTurnCardFanPendingTarget = 1;
  assert.equal(context.openHeroTurnCardFan(ctx, 1), true);
  assert.deepEqual(globals.HeroTurnCardFanCards, cards);
  assert.equal(globals.HeroTurnCardFanPendingTarget, 1);
});

test('a new living hero gets one draw after the prior decision owner is gone', () => {
  const source = read('web-runner/modules/functionBank.js');
  const context = {
    getGlobals: ctx => ctx.state.globals,
    GetActorByUID: (ctx, uid) => ctx.state.entities.find(actor => Number(actor.uid) === Number(uid)) || null,
    GetCurrentTurn: () => 2,
    heroTurnCardName: actor => actor.name,
    createHeroTurnCardState: () => ({}),
    random01: () => 0,
    drawHeroTurnCards: () => ({ cards: [{ id: 'new-hero-card' }], state: { drawn: 1 } }),
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunctionSource(source, 'openHeroTurnCardFan')}\nthis.openHeroTurnCardFan = openHeroTurnCardFan;`, context);
  const globals = {
    CombatSessionId: 3, TurnSerial: 9, TurnPhase: 0, NativeBattleEnded: 0,
    HeroTurnCardFanOpen: 1, HeroTurnCardFanHeroUID: 1, HeroTurnCardFanCards: [{ id: 'old-card' }],
    HeroTurnCardFanSessionId: 3, HeroTurnCardFanTurnSerial: 8,
    HeroTurnCardFanPendingTarget: 0, HeroTurnCardFanPendingCardIndex: -1,
    HeroTurnCardFanPendingCardId: '', HeroTurnCardFanSelectedCardId: '', HeroTurnCardFanTargetUID: 0,
    HeroTurnCardFanPendingTargetKind: '', HeroTurnCardFanPendingExcludeSelf: 0, HeroTurnCardFanBlockedCardId: '',
  };
  const ctx = { state: { globals, entities: [{ uid: 1, kind: 'hero', hp: 0 }, { uid: 2, kind: 'hero', name: 'Kaja', hp: 20 }] } };
  assert.equal(context.openHeroTurnCardFan(ctx, 2), true);
  assert.deepEqual(globals.HeroTurnCardFanCards, [{ id: 'new-hero-card' }]);
  assert.equal(globals.HeroTurnCardFanHeroUID, 2);
  assert.equal(globals.HeroTurnCardFanOpen, 1);
});

test('target validation accepts only the selected battlefield side', () => {
  const source = read('web-runner/modules/functionBank.js');
  const context = { getEntities: ctx => ctx.entities };
  vm.createContext(context);
  vm.runInContext(`${extractFunctionSource(source, 'heroTurnCardTargets')}\nthis.heroTurnCardTargets = heroTurnCardTargets;`, context);
  const entities = [
    { uid: 1, kind: 'hero', hp: 20 },
    { uid: 2, kind: 'hero', hp: 20 },
    { uid: 9, kind: 'enemy', hp: 20 },
  ];
  assert.deepEqual(Array.from(context.heroTurnCardTargets({ entities }, entities[0], { targetType: 'ally' }, 2)), [2]);
  assert.deepEqual(Array.from(context.heroTurnCardTargets({ entities }, entities[0], { targetType: 'ally', excludeSelf: true }, 1)), []);
  assert.deepEqual(Array.from(context.heroTurnCardTargets({ entities }, entities[0], { targetType: 'ally' }, 9)), []);
  assert.deepEqual(Array.from(context.heroTurnCardTargets({ entities }, entities[0], { targetType: 'enemy' }, 9)), [9]);
  assert.deepEqual(Array.from(context.heroTurnCardTargets({ entities }, entities[0], { targetType: 'enemy' }, 2)), []);
});

test('canonical defensive and recovery payloads use native interception, counter and cleanse effects', () => {
  const fara = { uid: 1, name: 'Falie', kind: 'hero', hp: 20, maxHP: 20, stats: { ATK: 10, DEF: 2, MAG: 2, RES: 2, SPD: 10 }, statuses: [] };
  const ally = { uid: 2, name: 'Runa', kind: 'hero', hp: 5, maxHP: 20, stats: { ATK: 5, DEF: 2, MAG: 2, RES: 2, SPD: 8 }, statuses: [{ statusEffect: 'atkDown', magnitude: .25, duration: 1 }] };
  const enemy = { uid: 9, kind: 'enemy', hp: 30, maxHP: 30, stats: { ATK: 2, DEF: 1, MAG: 1, RES: 1, SPD: 4 }, statuses: [] };
  const ctx = {
    actors: [fara, ally, enemy], state: { statusOrder: 0 }, random: () => 0,
    calculateDamage: () => 3,
    applyDamage: (_source, target, amount) => { target.hp = Math.max(0, target.hp - amount); return amount; },
  };
  resolveSkill(ctx, fara, { skillId: 'hero_card:fara_sovereigns_intercession', targetType: 'ally', tags: ['defensive'], effects: [
    { effectType: 'status', statusEffect: 'cover', magnitude: 1, duration: 2, coverOnce: true },
    { effectType: 'status', statusEffect: 'counter', magnitude: 2, duration: 2, recipient: 'self', counterArmedByCover: true },
  ] }, [ally.uid]);
  resolveSkill(ctx, enemy, { skillId: 'enemy_strike', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage' }] }, [fara.uid]);
  assert.equal(fara.hp, 17, 'an un-intercepted attack does not trigger Sovereign counter');
  assert.equal(enemy.hp, 30, 'the armed counter waits for the intercepted attacker');
  resolveSkill(ctx, enemy, { skillId: 'enemy_strike', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage' }] }, [ally.uid]);
  assert.equal(ally.hp, 5, 'cover leaves the protected ally unharmed');
  assert.equal(fara.hp, 14, 'cover routes the incoming hit to Fara');
  assert.equal(enemy.hp, 24, 'Fara counterattacks the intercepted attacker');
  resolveSkill(ctx, enemy, { skillId: 'enemy_strike', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage' }] }, [ally.uid]);
  assert.equal(ally.hp, 2, 'one-shot cover is consumed after the intercepted attack');
  resolveSkill(ctx, fara, { skillId: 'hero_card:kaja_last_light_reservoir', targetType: 'allAllies', tags: ['magic'], effects: [{ effectType: 'heal', potency: .5 }, { effectType: 'cleanse' }] }, [fara.uid, ally.uid]);
  assert.equal(ally.hp, 12, 'living allies receive the large heal');
  assert.equal(hasStatus(ally, 'atkDown'), false, 'living allies are cleansed');
});

test('commanding challenge taunts only its selected enemy until Fara next turn', () => {
  const fara = { uid: 1, kind: 'hero', hp: 20, maxHP: 20, stats: { ATK: 5, DEF: 2, MAG: 2, RES: 2, SPD: 10 }, statuses: [] };
  const ally = { uid: 2, kind: 'hero', hp: 20, maxHP: 20, stats: { ATK: 5, DEF: 2, MAG: 2, RES: 2, SPD: 8 }, statuses: [] };
  const challenged = { uid: 9, kind: 'enemy', hp: 20, maxHP: 20, stats: { ATK: 2, DEF: 1, MAG: 1, RES: 1, SPD: 4 }, statuses: [] };
  const other = { uid: 10, kind: 'enemy', hp: 20, maxHP: 20, stats: { ATK: 2, DEF: 1, MAG: 1, RES: 1, SPD: 3 }, statuses: [] };
  const ctx = { actors: [fara, ally, challenged, other], state: { statusOrder: 0 }, random: () => 0, calculateDamage: () => 3, applyDamage: (_source, target, amount) => { target.hp = Math.max(0, target.hp - amount); return amount; } };
  resolveSkill(ctx, fara, { skillId: 'hero_card:fara_commanding_challenge', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'status', statusEffect: 'taunted', magnitude: 1, duration: 1, expiresOnSourceTurn: true }] }, [challenged.uid]);
  resolveSkill(ctx, challenged, { skillId: 'enemy_strike', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage' }] }, [ally.uid]);
  resolveSkill(ctx, other, { skillId: 'enemy_strike', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage' }] }, [ally.uid]);
  assert.equal(fara.hp, 17, 'only the selected enemy follows the taunt');
  assert.equal(ally.hp, 17, 'the other enemy keeps its selected target');
  turnStart(ctx, fara, 1);
  assert.equal(hasStatus(challenged, 'taunted'), false, 'taunt expires when Fara starts her next turn');
});

test('delay payloads preserve SPD and postpone the queued occurrence', () => {
  const source = read('web-runner/modules/functionBank.js');
  assert.match(source, /statusEffect: 'delayNextTurn', delaySlots: 1/);
  assert.match(source, /statusEffect: 'delayNextTurn', delaySlots: 2/);
  assert.match(source, /applyPendingTurnDelays/);
  assert.doesNotMatch(source, /sandlock'.*spdDown|borrowedstarlight'.*spdDown|sealedhorizon'.*spdDown/);
});

test('delay queue reorder preserves every actor and actor Speed', () => {
  const source = read('web-runner/modules/functionBank.js');
  const context = { GetActorByUID: (ctx, uid) => ctx.entities.find(actor => Number(actor.uid) === Number(uid)) };
  vm.createContext(context);
  vm.runInContext(`${extractFunctionSource(source, 'applyPendingTurnDelays')}\nthis.applyPendingTurnDelays = applyPendingTurnDelays;`, context);
  const entities = [
    { uid: 1, kind: 'hero', stats: { SPD: 20 }, statuses: [] },
    { uid: 9, kind: 'enemy', stats: { SPD: 12 }, statuses: [{ statusEffect: 'delayNextTurn', delaySlots: 1, duration: 1 }] },
    { uid: 10, kind: 'enemy', stats: { SPD: 8 }, statuses: [] },
  ];
  const queue = [{ uid: 1, spd: 20 }, { uid: 9, spd: 12 }, { uid: 10, spd: 8 }];
  const result = context.applyPendingTurnDelays({ entities }, queue, 1);
  assert.deepEqual(Array.from(result.queue, slot => slot.uid), [1, 10, 9], 'the delayed occurrence moves behind the next actor');
  assert.deepEqual(Array.from(result.applied, entry => ({ uid: entry.uid, slots: entry.slots })), [{ uid: 9, slots: 1 }]);
  assert.equal(entities[1].stats.SPD, 12, 'delay does not mutate actor Speed');
  assert.deepEqual(Array.from(result.queue, slot => slot.uid).sort((a, b) => a - b), [1, 9, 10], 'the delayed actor keeps its earned occurrence');
});

test('rewritten four cards route through supported combat effects without resource blockers', () => {
  const source = read('web-runner/modules/functionBank.js');
  assert.doesNotMatch(source, /UNRESOLVED_HERO_TURN_CARD_IDS/);
  assert.match(source, /id === 'rooftopcut'.*statusEffect: 'mark'/s);
  assert.match(source, /id === 'borrowedbreath'.*ifTargetStatus: 'mark'/s);
  assert.match(source, /id === 'borrowedstarlight'.*statusEffect: 'delayNextTurn'/s);
  assert.match(source, /id === 'borrowedstarlight'.*statusEffect: 'atkDown'/s);
  assert.match(source, /id === 'sparespark'.*allyBarrier\(\.2\)/s);
});

test('rewritten card definitions produce exact native effect payloads', () => {
  const source = read('web-runner/modules/functionBank.js');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractFunctionSource(source, 'cardSkillFromDefinition')}\nthis.cardSkillFromDefinition = cardSkillFromDefinition;`, context);
  const actor = { uid: 1, kind: 'hero' };
  const skill = id => context.cardSkillFromDefinition({ id, name: id }, actor);
  const rooftop = skill('hondo_rooftop_cut');
  assert.equal(rooftop.effects[0].effectType, 'damage');
  assert.equal(rooftop.effects[1].statusEffect, 'mark');
  const breath = skill('hondo_borrowed_breath');
  assert.equal(breath.effects[0].ifTargetStatus, 'mark');
  assert.equal(breath.effects[0].conditionalMultiplier, 1.4);
  const starlight = skill('runa_borrowed_starlight');
  assert.deepEqual(Array.from(starlight.effects, effect => effect.statusEffect), ['delayNextTurn', 'atkDown']);
  assert.equal(starlight.effects[0].delaySlots, 1);
  const spark = skill('kaja_spare_spark');
  assert.equal(spark.targetType, 'ally');
  assert.equal(spark.excludeSelf, true);
  assert.equal(spark.effects[0].statusEffect, 'barrier');
  assert.equal(spark.effects[0].magnitude, .2);
});

test('a selected hero card resolves once through the native action resolver', () => {
  const hero = { uid: 1, name: 'Falie', kind: 'hero', hp: 10, maxHP: 10, stats: { ATK: 10, DEF: 2, MAG: 2, RES: 2, SPD: 10 } };
  const enemy = { uid: 9, kind: 'enemy', hp: 20, maxHP: 20, stats: { ATK: 2, DEF: 1, MAG: 1, RES: 1, SPD: 4 } };
  const globals = { CombatSessionId: 4, NativeCommandSequence: null, NativeBattleEnded: 0 };
  const ctx = {
    state: { globals, entities: [hero, enemy] },
    callFunction(name, uid, amount) {
      if (name === 'UpdateHeroHPUI' || name === 'UpdateEnemyHPUI') return undefined;
      if (name === 'LogCombat') return undefined;
      if (name === 'ApplyDamageToTarget') { enemy.hp = Math.max(0, enemy.hp - Number(amount || 0)); return undefined; }
      throw new Error(`unexpected ${name}`);
    },
  };
  const skill = { skillId: 'hero_card:fara_brass_strike', targetType: 'enemy', tags: ['physical'], effects: [{ effectType: 'damage', fixedDamage: 4 }] };
  const sequence = { kind: 'hero_turn_card', actorUID: 1, cardId: 'fara_brass_strike', skill, targetIds: [9], sessionId: 4 };
  globals.NativeCommandSequence = sequence;
  assert.equal(resolveNativeCommandStep(ctx, { sequence }), true);
  assert.equal(enemy.hp, 16);
  assert.equal(globals.NativeCommandSequence, undefined);
});

test('the last enemy action settles party defeat and clears the same-turn fan without victory EXP', () => {
  const hero = { uid: 1, kind: 'hero', hp: 2, maxHP: 20, stats: { ATK: 4, DEF: 1, MAG: 1, RES: 1, SPD: 10 }, statuses: [] };
  const enemy = { uid: 9, kind: 'enemy', hp: 20, maxHP: 20, stats: { ATK: 4, DEF: 1, MAG: 1, RES: 1, SPD: 4 }, statuses: [] };
  const globals = {
    NativeBattleEnded: 0,
    HeroTurnCardFanOpen: 1,
    HeroTurnCardFanHeroUID: 1,
    HeroTurnCardFanCards: [{ id: 'hondo_borrowed_breath' }],
    HeroTurnCardFanSelectedCardId: 'hondo_borrowed_breath',
    HeroTurnCardFanTargetUID: 9,
    HeroTurnCardFanPendingCardIndex: -1,
    HeroTurnCardFanPendingCardId: '',
    HeroTurnCardFanPendingTarget: 0,
    HeroTurnCardFanPendingTargetKind: '',
    HeroTurnCardFanPendingExcludeSelf: 0,
    NativeCommandSequence: null,
    ProgressionBattle: { id: 'battle-1', settled: false, defeated: {}, defeatedGold: {} },
  };
  const ctx = {
    state: { globals, entities: [hero, enemy] },
    callFunction(name, uid, amount) {
      if (name === 'ApplyDamageToTarget') {
        const target = this.state.entities.find(actor => Number(actor.uid) === Number(uid));
        const before = Number(target?.hp || 0);
        if (target) target.hp = Math.max(0, before - Number(amount || 0));
        return before - Number(target?.hp || 0);
      }
      if (name === 'UpdateHeroHPUI' || name === 'UpdateEnemyHPUI') return 0;
      return 0;
    },
  };
  resolveIncomingNativeHit(ctx, enemy, hero, 4);
  assert.equal(hero.hp, 0);
  assert.equal(globals.NativeBattleEnded, true);
  assert.equal(globals.HeroTurnCardFanOpen, 0);
  assert.deepEqual(globals.HeroTurnCardFanCards, []);
  assert.deepEqual(globals.ProgressionResults, []);
  assert.equal(globals.ProgressionBattle.settled, true, 'defeat is terminal until Continue explicitly retries');
  assert.equal(globals.ProgressionBattle.outcome, 'defeat');
  assert.equal(globals.ProgressionBattle.goldReward, 0);
});

test('natural defeat skips victory results and Continue resets the same encounter to active', () => {
  const hero = { uid: 1, kind: 'hero', hp: 0, maxHP: 20, isAlive: false };
  const globals = {
    QuestFiniteEncounter: 1,
    NativeBattleEnded: true,
    ProgressionBattle: { id: 'battle-natural-defeat', outcome: 'defeat', defeatSettled: true, settled: true },
    FlowOrbs: [],
  };
  const calls = [];
  const state = { globals, entities: [hero] };
  const session = createQuestCombatSession({
    state,
    gameState: { combatFailExitRequested: true },
    call(name) { calls.push(name); },
    sync() { calls.push('sync'); },
  });

  assert.equal(session.isCleared(), false, 'a defeat cannot render the victory result dialog');
  session.resurrect();
  assert.equal(hero.hp, 20);
  assert.equal(hero.isAlive, true);
  assert.equal(globals.NativeBattleEnded, false);
  assert.equal(globals.ProgressionBattle.outcome, 'active');
  assert.equal(globals.ProgressionBattle.defeatSettled, false);
  assert.equal(globals.ProgressionBattle.settled, false);
  assert.ok(calls.includes('RebuildTurnOrderPreserveCurrent'));
  assert.ok(calls.includes('ProcessTurn'));
});

test('defeat settlement is idempotent and records no victory progression', () => {
  const globals = {
    NativeBattleEnded: 0,
    HeroTurnCardFanOpen: 1,
    HeroTurnCardFanCards: [{ id: 'a' }],
    ProgressionBattle: { settled: false, defeated: { 9: 25 }, defeatedGold: { 9: 10 } },
    NativeCommandSequence: null,
  };
  const ctx = { state: { globals, entities: [{ uid: 1, kind: 'hero', hp: 0 }] } };
  assert.equal(settleDefeat(ctx), true);
  assert.equal(settleDefeat(ctx), true);
  assert.equal(globals.NativeBattleEnded, true);
  assert.deepEqual(globals.ProgressionResults, []);
  assert.equal(globals.ProgressionBattle.goldReward, 0);
});

test('failed native lunge keeps the same fan draw available for retry', () => {
  const { context, ctx, globals, cards } = createCardSelectionHarness({ startResult: 0 });
  assert.equal(context.selectHeroTurnCard(ctx, 0, 9), false);
  assert.equal(globals.HeroTurnCardFanOpen, 1, 'a refused lunge leaves the fan open');
  assert.deepEqual(globals.HeroTurnCardFanCards, cards, 'a refused lunge keeps the exact draw');
  assert.equal(globals.HeroTurnCardFanSelectedCardId, '', 'a refused lunge does not consume the selection');
  assert.equal(globals.HeroTurnCardFanTargetUID, 0, 'a refused lunge leaves target state clear');
});
