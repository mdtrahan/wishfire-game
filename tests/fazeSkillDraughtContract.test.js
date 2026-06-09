const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');

function loadModule(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ForceAstralFlowSkillDraught,
  GetPartySkillDefinitions,
  GetSkillDraughtState,
  SelectSkillDraughtCard,
};`;
  const context = {
    console,
    Math,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext() {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Kojonn',
    baseHeroName: 'Kojonn',
    heroIndex: 3,
    attackType: 'magic',
    hp: 50,
    maxHP: 50,
    stats: { ATK: 4, DEF: 0, MAG: 40, RES: 0, SPD: 1 },
  };
  const enemies = [
    { uid: 201, kind: 'enemy', name: 'Djinn', hp: 60, slotIndex: 0, x: 240, y: 88 },
    { uid: 202, kind: 'enemy', name: 'Marid', hp: 60, slotIndex: 1, x: 242, y: 144 },
  ];
  const calls = [];
  const globals = {
    time: 5,
    TurnSerial: 12,
    HeroTeamTurnSerial: 4,
    TurnOrderArray: [
      { uid: 100, type: 0 },
      { uid: 201, type: 1 },
      { uid: 202, type: 1 },
    ],
    CombatLog: [],
    CombatActionLines: ['', '', '', ''],
    SkillDraughtOpen: 0,
    SkillDraughtHeroUID: 0,
    SkillDraughtCandidates: [],
    SkillDraughtHitZones: [],
    SkillDraughtSelectedSkillId: '',
    SessionSkillsByHeroUID: {},
    SkillDraughtTrace: [],
    SkillDraughtTraceSeq: 0,
    AstralFlowAmpPoints: 18,
    AstralFlowAmpMax: 18,
    AstralFlowAmpReady: 1,
    PendingHeroHits: [],
  };
  const ctx = {
    state: { globals, entities: [hero, ...enemies] },
    callFunction(name, ...args) {
      calls.push({ name, args });
      return undefined;
    },
  };
  return { ctx, calls };
}

function dotTickSeries(totalDamage, totalTicks = 3) {
  const ticks = [];
  let remainingDamage = Math.max(1, Math.floor(Number(totalDamage || 0) || 1));
  let remainingTicks = Math.max(1, Math.floor(Number(totalTicks || 1) || 1));
  while (remainingTicks > 0 && remainingDamage > 0) {
    const dmg = Math.max(1, Math.floor(remainingDamage / remainingTicks) + ((remainingDamage % remainingTicks) > 0 ? 1 : 0));
    ticks.push(dmg);
    remainingDamage = Math.max(0, remainingDamage - dmg);
    remainingTicks -= 1;
  }
  return ticks;
}

test('Faze is a mirrored party draw option that owns the tainted-ground payload', () => {
  const expectedExistingPartyIds = [
    'party_fresh_start',
    'party_second_chance',
    'party_momentum',
    'party_guard_rail',
    'party_blue_spark',
    'party_weaken',
    'party_destiny',
    'party_hot_streak',
    'party_last_push',
    'party_chain_pop',
    'party_magic_fruit',
    'party_crimson_ward',
  ];

  for (const filePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /id: 'party_faze'[\s\S]*title: 'Faze'/);
    assert.match(src, /cardText: 'Blights the field, poisoning enemies for the remainder of the session\.'/);
    assert.match(src, /payloadImplemented: true/);
    assert.match(src, /function activateFazeSkill\(ctx, actorUID\)/);
  }

  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const partyIds = Array.from(mod.GetPartySkillDefinitions(), skill => skill.id);
    assert.deepEqual(partyIds.slice(0, expectedExistingPartyIds.length), expectedExistingPartyIds);
    assert.equal(partyIds[expectedExistingPartyIds.length], 'party_faze');

    const { ctx, calls } = makeContext();
    const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_faze');
    assert.equal(opened.ok, true);
    assert.equal(opened.candidates[0].id, 'party_faze');
    assert.equal(opened.candidates[0].title, 'Faze');
    assert.equal(opened.candidates[0].cardText, 'Blights the field, poisoning enemies for the remainder of the session.');
    assert.equal(opened.candidates[0].description, 'Blights the field, poisoning enemies for the remainder of the session.');

    const selected = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selected.ok, true);
    assert.equal(selected.skill.id, 'party_faze');
    assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__[0].id, 'party_faze');
    assert.equal(calls.some(call => call.name === 'ApplyPartyHeal'), false);

    assert.equal(ctx.state.globals.PendingHeroHits.length, 2);
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => hit.effectType === 'dot_apply'));
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => hit.effectName === 'Blight'));
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => hit.actionName === 'Faze'));
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => hit.calcPath === 'magicCalc'));
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => hit.dotTotalDamage === 3));
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => JSON.stringify(dotTickSeries(hit.dotTotalDamage)) === JSON.stringify([1, 1, 1])));
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => hit.fazeStackCount === 1));
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => /^Kojonn uses Faze on .+!$/.test(String(hit.msg || ''))));
    assert.ok(ctx.state.globals.PendingHeroHits.every(hit => String(hit.taintedGroundZoneId || '').startsWith('tg-')));

    assert.equal(ctx.state.globals.TaintedGroundZones.length, 2);
    assert.equal(
      JSON.stringify(ctx.state.globals.TaintedGroundZones.map(zone => ({
        slotIndex: zone.slotIndex,
        sourceUID: zone.sourceUID,
        remainingTurns: zone.remainingTurns,
        durationHeroTeamTurns: zone.durationHeroTeamTurns,
        heroTeamTurnSpan: zone.heroTeamTurnSpan,
        createdHeroTeamTurnSerial: zone.createdHeroTeamTurnSerial,
        expiresAtHeroTeamTurnSerial: zone.expiresAtHeroTeamTurnSerial,
        dotTotalDamage: zone.dotTotalDamage,
        fazeStackCount: zone.fazeStackCount,
        effectName: zone.effectName,
        visual: zone.visual,
        visualStartsAt: zone.visualStartsAt,
      }))),
      JSON.stringify([
        { slotIndex: 0, sourceUID: 100, remainingTurns: 3, durationHeroTeamTurns: 3, heroTeamTurnSpan: 1, createdHeroTeamTurnSerial: 4, expiresAtHeroTeamTurnSerial: 7, dotTotalDamage: 3, fazeStackCount: 1, effectName: 'TaintedGround', visual: 'blight_disc', visualStartsAt: 6.07 },
        { slotIndex: 1, sourceUID: 100, remainingTurns: 3, durationHeroTeamTurns: 3, heroTeamTurnSpan: 1, createdHeroTeamTurnSerial: 4, expiresAtHeroTeamTurnSerial: 7, dotTotalDamage: 3, fazeStackCount: 1, effectName: 'TaintedGround', visual: 'blight_disc', visualStartsAt: 6.07 },
      ]),
    );

    assert.match(ctx.state.globals.CombatLog.join('\n'), /Kojonn uses Faze on enemies!/);
    assert.equal(ctx.state.globals.ActionOwnerUID, 100);
    assert.equal(ctx.state.globals.DeferAdvance, 1);
    assert.equal(ctx.state.globals.AdvanceAfterAction, 1);

    const stateAfterSelect = mod.GetSkillDraughtState(ctx);
    assert.equal(stateAfterSelect.open, 0);
    assert.equal(stateAfterSelect.candidates.length, 0);
  }
});

test('repeated Faze refreshes pending per-enemy dot presentation instead of stacking it', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const { ctx } = makeContext();

    const firstOpen = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_faze');
    assert.equal(firstOpen.ok, true);
    const firstSelect = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(firstSelect.ok, true);

    const firstPending = ctx.state.globals.PendingHeroHits.map(hit => ({
      targetUID: hit.targetUID,
      zoneId: hit.taintedGroundZoneId,
      at: hit.at,
    }));
    assert.equal(firstPending.length, 2);

    ctx.state.globals.time += 0.5;
    const secondOpen = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_faze');
    assert.equal(secondOpen.ok, true);
    const secondSelect = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(secondSelect.ok, true);

    const pending = ctx.state.globals.PendingHeroHits;
    assert.equal(pending.length, 2, 'repeat Faze should keep one pending dot presentation per enemy');
    assert.deepEqual(
      pending.map(hit => hit.targetUID).sort((a, b) => a - b),
      [201, 202],
    );
    assert.deepEqual(
      pending.map(hit => hit.taintedGroundZoneId).sort(),
      firstPending.map(hit => hit.zoneId).sort(),
    );
    assert.ok(pending.every(hit => hit.effectType === 'dot_apply'));
    assert.ok(pending.every(hit => hit.actionName === 'Faze'));
    assert.ok(pending.every(hit => hit.dotTotalDamage === 6));
    assert.ok(pending.every(hit => JSON.stringify(dotTickSeries(hit.dotTotalDamage)) === JSON.stringify([2, 2, 2])));
    assert.ok(pending.every(hit => hit.fazeStackCount === 2));
    assert.ok(pending.every(hit => hit.at > firstPending[0].at));
    assert.equal(ctx.state.globals.TaintedGroundZones.length, 2);
    assert.ok(ctx.state.globals.TaintedGroundZones.every(zone => zone.dotTotalDamage === 6));
    assert.ok(ctx.state.globals.TaintedGroundZones.every(zone => zone.fazeStackCount === 2));
  }
});

test('Faze activated by different heroes shares one visual pool per enemy and increments tick count', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const { ctx } = makeContext();
    ctx.state.entities.push({
      uid: 101,
      kind: 'hero',
      name: 'Huun',
      baseHeroName: 'Huun',
      heroIndex: 1,
      attackType: 'magic',
      hp: 50,
      maxHP: 50,
      stats: { ATK: 4, DEF: 0, MAG: 40, RES: 0, SPD: 1 },
    });

    const firstOpen = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_faze');
    assert.equal(firstOpen.ok, true);
    assert.equal(mod.SelectSkillDraughtCard(ctx, 0).ok, true);

    const firstZones = ctx.state.globals.TaintedGroundZones.map(zone => ({
      id: zone.id,
      slotIndex: zone.slotIndex,
    }));
    assert.equal(firstZones.length, 2);

    ctx.state.globals.time += 0.5;
    const secondOpen = mod.ForceAstralFlowSkillDraught(ctx, 101, 'party_faze');
    assert.equal(secondOpen.ok, true);
    assert.equal(mod.SelectSkillDraughtCard(ctx, 0).ok, true);

    const zones = ctx.state.globals.TaintedGroundZones;
    assert.equal(zones.length, 2, 'repeat Faze should not create stacked field pools per enemy slot');
    assert.equal(
      JSON.stringify(zones.map(zone => zone.id).sort()),
      JSON.stringify(firstZones.map(zone => zone.id).sort()),
    );
    assert.equal(
      JSON.stringify(zones.map(zone => zone.slotIndex).sort((a, b) => a - b)),
      JSON.stringify([0, 1]),
    );
    assert.ok(zones.every(zone => zone.dotTotalDamage === 6));
    assert.ok(zones.every(zone => zone.fazeStackCount === 2));

    const pending = ctx.state.globals.PendingHeroHits;
    assert.equal(pending.length, 2, 'repeat Faze should keep one pending dot float per enemy target');
    assert.equal(
      JSON.stringify(pending.map(hit => hit.targetUID).sort((a, b) => a - b)),
      JSON.stringify([201, 202]),
    );
    assert.ok(pending.every(hit => hit.effectType === 'dot_apply'));
    assert.ok(pending.every(hit => hit.actionName === 'Faze'));
    assert.ok(pending.every(hit => hit.dotTotalDamage === 6));
    assert.ok(pending.every(hit => JSON.stringify(dotTickSeries(hit.dotTotalDamage)) === JSON.stringify([2, 2, 2])));
    assert.ok(pending.every(hit => hit.fazeStackCount === 2));
    assert.ok(pending.every(hit => /^Huun uses Faze on .+!$/.test(String(hit.msg || ''))));
  }
});

test('Faze damage scaling is linear and capped by activation count', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const { ctx } = makeContext();
    const expectedDamageByActivation = [3, 6, 9, 12, 12];
    const expectedStackByActivation = [1, 2, 3, 4, 4];
    const expectedTicksByActivation = [[1, 1, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4], [4, 4, 4]];

    for (let i = 0; i < expectedDamageByActivation.length; i += 1) {
      const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_faze');
      assert.equal(opened.ok, true);
      assert.equal(mod.SelectSkillDraughtCard(ctx, 0).ok, true);

      const zones = ctx.state.globals.TaintedGroundZones;
      const pending = ctx.state.globals.PendingHeroHits;
      assert.equal(zones.length, 2, `${modulePath} activation ${i + 1} keeps one field per enemy`);
      assert.equal(pending.length, 2, `${modulePath} activation ${i + 1} keeps one pending packet per enemy`);
      assert.ok(zones.every(zone => zone.dotTotalDamage === expectedDamageByActivation[i]));
      assert.ok(pending.every(hit => hit.dotTotalDamage === expectedDamageByActivation[i]));
      assert.ok(pending.every(hit => JSON.stringify(dotTickSeries(hit.dotTotalDamage)) === JSON.stringify(expectedTicksByActivation[i])));
      assert.ok(zones.every(zone => zone.fazeStackCount === expectedStackByActivation[i]));
      assert.ok(pending.every(hit => hit.fazeStackCount === expectedStackByActivation[i]));
      ctx.state.globals.time += 0.5;
    }
  }
});
