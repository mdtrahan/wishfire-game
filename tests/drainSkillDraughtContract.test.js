const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const appPath = path.join(repoRoot, 'web-runner', 'app.js');
const renderRuntimePath = path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js');

function loadModule(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ForceAstralFlowSkillDraught,
  GetEffectiveStat,
  GetPartySkillDefinitions,
  GetSkillDraughtState,
  SelectSkillDraughtCard,
  SyncDrainFieldZones,
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
    stats: { ATK: 4, DEF: 0, MAG: 40, RES: 0, SPD: 10 },
  };
  const enemies = [
    { uid: 201, kind: 'enemy', name: 'Djinn', hp: 60, slotIndex: 0, x: 240, y: 88, stats: { SPD: 10 } },
    { uid: 202, kind: 'enemy', name: 'Marid', hp: 60, slotIndex: 1, x: 242, y: 144, stats: { SPD: 20 } },
  ];
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
  return {
    ctx: {
      state: { globals, entities: [hero, ...enemies] },
      callFunction() {
        return undefined;
      },
    },
    hero,
    enemies,
  };
}

function selectDrain(mod, ctx, heroUID = 100) {
  const opened = mod.ForceAstralFlowSkillDraught(ctx, heroUID, 'party_drain');
  assert.equal(opened.ok, true);
  assert.equal(opened.candidates[0].id, 'party_drain');
  const selected = mod.SelectSkillDraughtCard(ctx, 0);
  assert.equal(selected.ok, true);
  assert.equal(selected.skill.id, 'party_drain');
  return selected;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('Drain is a mirrored party draw option with separate speed-down field state', () => {
  for (const filePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /id: 'party_drain'[\s\S]*title: 'Drain'/);
    assert.match(src, /status: 'speed_down'/);
    assert.match(src, /stacking: 'refresh_only'/);
    assert.match(src, /function activateDrainSkill\(ctx, actorUID\)/);
    assert.match(src, /export function SyncDrainFieldZones\(ctx\)/);
  }

  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const partyIds = Array.from(mod.GetPartySkillDefinitions(), skill => skill.id);
    assert.ok(partyIds.includes('party_faze'), `${modulePath} keeps Faze`);
    assert.ok(partyIds.includes('party_drain'), `${modulePath} exposes Drain`);

    const { ctx, hero, enemies } = makeContext();
    selectDrain(mod, ctx);

    assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__[0].id, 'party_drain');
    assert.equal(ctx.state.globals.PendingHeroHits.length, 0, 'Drain does not queue Faze poison hit packets');
    assert.equal(ctx.state.globals.TaintedGroundZones, undefined, 'Drain does not reuse Faze tainted ground');
    assert.equal(ctx.state.globals.DrainFieldZones.length, 2);
    assert.deepEqual(
      plain(ctx.state.globals.DrainFieldZones.map(zone => ({
        slotIndex: zone.slotIndex,
        sourceUID: zone.sourceUID,
        remainingTurns: zone.remainingTurns,
        durationHeroTeamTurns: zone.durationHeroTeamTurns,
        heroTeamTurnSpan: zone.heroTeamTurnSpan,
        createdHeroTeamTurnSerial: zone.createdHeroTeamTurnSerial,
        expiresAtHeroTeamTurnSerial: zone.expiresAtHeroTeamTurnSerial,
        drainSlowPct: zone.drainSlowPct,
        effectName: zone.effectName,
        visual: zone.visual,
        visualStartsAt: zone.visualStartsAt,
      }))),
      [
        { slotIndex: 0, sourceUID: 100, remainingTurns: 3, durationHeroTeamTurns: 3, heroTeamTurnSpan: 1, createdHeroTeamTurnSerial: 4, expiresAtHeroTeamTurnSerial: 7, drainSlowPct: 10, effectName: 'Drain', visual: 'drain_lines', visualStartsAt: 6.07 },
        { slotIndex: 1, sourceUID: 100, remainingTurns: 3, durationHeroTeamTurns: 3, heroTeamTurnSpan: 1, createdHeroTeamTurnSerial: 4, expiresAtHeroTeamTurnSerial: 7, drainSlowPct: 10, effectName: 'Drain', visual: 'drain_lines', visualStartsAt: 6.07 },
      ],
    );

    ctx.state.globals.time = 6.07;
    assert.equal(mod.GetEffectiveStat(ctx, enemies[0], 'SPD'), 9);
    assert.equal(mod.GetEffectiveStat(ctx, enemies[1], 'SPD'), 18);
    assert.equal(mod.GetEffectiveStat(ctx, hero, 'SPD'), 10);

    enemies[0].hp = 0;
    assert.equal(mod.GetEffectiveStat(ctx, enemies[0], 'SPD'), 10, 'dead enemies are not affected');
    const enteringEnemy = { uid: 203, kind: 'enemy', name: 'Ifrit', hp: 50, slotIndex: 0, x: 240, y: 88, stats: { SPD: 30 } };
    ctx.state.entities.push(enteringEnemy);
    assert.equal(mod.GetEffectiveStat(ctx, enteringEnemy, 'SPD'), 27, 'entering enemies standing in a Drain slot are slowed');

    assert.match(ctx.state.globals.CombatLog.join('\n'), /Kojonn uses Drain on enemies!/);
    assert.equal(ctx.state.globals.ActionOwnerUID, 100);
    assert.equal(ctx.state.globals.DeferAdvance, 1);
    assert.equal(ctx.state.globals.AdvanceAfterAction, 1);
  }
});

test('repeated Drain refreshes field duration without stacking speed-down', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const { ctx, enemies } = makeContext();

    selectDrain(mod, ctx);
    const firstZones = ctx.state.globals.DrainFieldZones.map(zone => ({ id: zone.id, slotIndex: zone.slotIndex }));
    ctx.state.globals.time = 6.07;
    assert.equal(mod.GetEffectiveStat(ctx, enemies[0], 'SPD'), 9);

    ctx.state.globals.time += 0.5;
    selectDrain(mod, ctx);

    const zones = ctx.state.globals.DrainFieldZones;
    assert.equal(zones.length, 2, 'repeat Drain keeps one field per enemy slot');
    assert.deepEqual(
      zones.map(zone => zone.id).sort(),
      firstZones.map(zone => zone.id).sort(),
    );
    assert.ok(zones.every(zone => zone.drainSlowPct === 10));
    assert.ok(zones.every(zone => !Object.prototype.hasOwnProperty.call(zone, 'drainStackCount')));
    assert.equal(mod.GetEffectiveStat(ctx, enemies[0], 'SPD'), 9);
    assert.equal(mod.GetEffectiveStat(ctx, enemies[1], 'SPD'), 18);
  }
});

test('Drain speed-down expires on Faze-mirrored hero-team duration while visuals fade out', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const { ctx, enemies } = makeContext();

    selectDrain(mod, ctx);
    ctx.state.globals.time = 6.07;
    assert.equal(mod.GetEffectiveStat(ctx, enemies[0], 'SPD'), 9);

    ctx.state.globals.HeroTeamTurnSerial = 7;
    assert.equal(mod.SyncDrainFieldZones(ctx), 0);
    assert.equal(ctx.state.globals.DrainFieldZones.length, 2, 'expired Drain zones remain briefly for fade-out visuals');
    assert.ok(ctx.state.globals.DrainFieldZones.every(zone => zone.fadeStartedAt != null));
    assert.equal(mod.GetEffectiveStat(ctx, enemies[0], 'SPD'), 10, 'expired Drain no longer slows');

    ctx.state.globals.time += 0.56;
    assert.equal(mod.SyncDrainFieldZones(ctx), 0);
    assert.equal(ctx.state.globals.DrainFieldZones, undefined);
  }
});

test('Drain visual presentation uses blue downward lines and app overlay helpers', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const renderSrc = fs.readFileSync(renderRuntimePath, 'utf8');

  assert.match(appSrc, /function getPersistentDrainFieldOverlays\(\)/);
  assert.match(appSrc, /function hasPersistentEnemyDrainOverlay\(uid\)/);
  assert.match(appSrc, /callFunctionWithContext\(fnContext, 'SyncDrainFieldZones'\)/);
  assert.match(appSrc, /getPersistentDrainFieldOverlays,\s+hasPersistentEnemyTaintedGroundOverlay,\s+hasPersistentEnemyBlightOverlay,\s+hasPersistentEnemyDrainOverlay,/s);

  assert.match(renderSrc, /const renderEnemyDrainLines = \(drawX, drawY, enemyW, enemyH, seed = 0, alphaScale = 1\) => \{/);
  assert.match(renderSrc, /tone === 'blue'/);
  assert.match(renderSrc, /fillStyle = '#A9EEFF'/);
  assert.match(renderSrc, /renderEnemyDrainLines\(drawX, drawY, enemyW, enemyH, enemy\.uid, drainAlpha\)/);
  const drainPainterStart = renderSrc.indexOf('const renderEnemyDrainLines');
  const drainPainterEnd = renderSrc.indexOf('const renderHealBlooms', drainPainterStart);
  assert.notEqual(drainPainterStart, -1);
  assert.notEqual(drainPainterEnd, -1);
  const drainPainterSrc = renderSrc.slice(drainPainterStart, drainPainterEnd);
  assert.doesNotMatch(drainPainterSrc, /arc\(/);
  assert.doesNotMatch(drainPainterSrc, /#8D37FF|#4B176F/);
});
