const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const harnessPath = path.join(__dirname, '..', 'tools', 'balance_harness.js');
const source = fs.readFileSync(harnessPath, 'utf8');
const hookSource = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js'), 'utf8');
const { START_WORLD_POINT, aggregateSessions, buildConfig, isRealtimeCombatReadyState, loadHeroFixture, loadLampFixture, observedOrdinaryWaveClear, sourceFingerprint, writeHeroFixture, writeLampFixture } = require(harnessPath);

test('source fingerprint changes when an untracked capture module changes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orka-balance-fingerprint-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    fs.writeFileSync(path.join(root, 'tracked.txt'), 'baseline');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: root });
    execFileSync('git', ['-c', 'user.name=Balance Test', '-c', 'user.email=balance@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'baseline'], { cwd: root });
    const baseline = sourceFingerprint(root);
    fs.writeFileSync(path.join(root, 'capture.mjs'), 'one');
    const first = sourceFingerprint(root);
    fs.writeFileSync(path.join(root, 'capture.mjs'), 'two');
    const second = sourceFingerprint(root);
    assert.notEqual(first.patchSha256, baseline.patchSha256);
    assert.notEqual(second.patchSha256, first.patchSha256);
    assert.deepEqual(first.untracked.map(entry => entry.path), ['capture.mjs']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('balance harness enters through Canvas START and observes automatic realtime combat', () => {
  assert.deepEqual(START_WORLD_POINT, { x: 184.5, y: 427 });
  assert.match(source, /setEncounterRequest\(\{ seed: encounterSeed/);
  assert.match(source, /async function enterRealtimeCombat/);
  assert.doesNotMatch(source, /runDevAutoplayUntilDepleted|stopDevAutoplay/);
  assert.doesNotMatch(source, /TurnSerial|turnType|turnUID|turnOrder|astralFlowWallet|pendingSkillId/);
  assert.doesNotMatch(source, /buildCandidateMatches|pickThree|maybeClearSelectedGems|canPickGems|180, 320/);
});

test('balance harness creates and closes an isolated browser context for each seed', () => {
  assert.match(source, /async createIsolatedPage\(\)/);
  assert.match(source, /const context = await browser\.newContext\(\{ viewport: config\.viewport \}\)/);
  assert.match(source, /await isolated\.close\(\)/);
  assert.doesNotMatch(source, /localStorage\.clear\(\)/);
});

test('optional progression scenario uses visible lamp collection and auto-equip controls', () => {
  assert.match(source, /async function useAvailableLampEquipment\(page, allowCollect\)/);
  assert.match(source, /pendingKey !== lastEquipmentReviewKey/);
  assert.match(source, /#wishfire-lamp button\[data-action="collect"\]/);
  assert.match(source, /button\[data-action="auto-equip"\]/);
  assert.match(source, /equipment: \{ scenario: config\.autoEquip \? 'collect_auto_equip' : 'observe_only'/);
});

test('optional four-slot party fixture is applied and checked before combat', () => {
  const slots = ['Falie', 'Huun', 'Runa', ''];
  assert.deepEqual(buildConfig({ heroSlots: 'Falie,Huun,Runa,' }, {}).heroSlots, slots);
  assert.equal(buildConfig({}, {}).heroSlots, null);
  assert.throws(() => buildConfig({ heroSlots: 'Falie,Huun,Runa' }, {}), /heroSlots must list four/);
  assert.throws(() => buildConfig({ heroSlots: ',,,' }, {}), /heroSlots must list four/);
  assert.throws(() => buildConfig({ heroSlots: 'Falie,Falie,Runa,' }, {}), /heroSlots must list four/);
  assert.match(source, /applyDevToolingConfig\(\{ combatSpeed: 4, \.\.\.\(heroSlots \? \{ heroSlots \} : \{\}\) \}\)/);
  assert.ok(source.indexOf('Requested hero slots were not applied') < source.indexOf('await clickCanvasWorld(page, START_WORLD_POINT)'));
  assert.match(source, /partyFixture: \{ requested: config\.heroSlots, activeSlots: combatState\.heroScreen\?\.activePartySlots \|\| null, heroProgress:/);
});

test('fixed lamp seed fixture uses the game save constructor and reports the loaded seed', async () => {
  assert.equal(buildConfig({ lampSeed: '4242' }, {}).lampSeed, 4242);
  assert.equal(buildConfig({}, {}).lampSeed, null);
  assert.throws(() => buildConfig({ lampSeed: '-1' }, {}), /lampSeed must be a uint32/);
  assert.throws(() => buildConfig({ lampSeed: '1.5' }, {}), /lampSeed must be a uint32/);
  assert.throws(() => buildConfig({ lampSeed: '42', lampFixture: '/tmp/gear.json' }, {}), /Choose lampSeed or lampFixture/);
  assert.throws(() => buildConfig({ sessions: '2', saveLampFixture: '/tmp/gear.json' }, {}), /saveLampFixture requires one session/);
  assert.match(source, /createLampEconomy\(config\.lampSeed\)/);
  assert.match(source, /validateConveyorState\(fixture\)/);
  assert.match(source, /page\.addInitScript/);
  assert.ok(source.indexOf('page.addInitScript') < source.indexOf('await page.goto'));
  assert.match(source, /snapshot\.lampSeed !== lampFixture\.seed/);
  assert.match(source, /lampSeed: snapshot\.lampSeed/);
  assert.match(source, /stats: \{ \.\.\.\(actor\?\.stats \|\| hero\.stats \|\| \{\}\) \}/);
  assert.match(source, /savedLampFixture = writeLampFixture\(config\.saveLampFixture, save\)/);
  const { createLampEconomy } = await import('../web-runner/src/core/lampGear.mjs');
  const { validateConveyorState } = await import('../web-runner/src/core/lampConveyor.mjs');
  assert.doesNotThrow(() => validateConveyorState(createLampEconomy(4242)));
});

test('lamp fixture import and export preserve raw bytes, loadout, and reject corrupt saves', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orka-lamp-fixture-'));
  try {
    const { createLampEconomy } = await import('../web-runner/src/core/lampGear.mjs');
    const fixture = createLampEconomy(4242);
    const raw = `${JSON.stringify(fixture, null, 2)}\n`;
    const file = path.join(root, 'gear.json');
    const exported = writeLampFixture(file, raw);
    const actualSha = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(exported.sha256, actualSha);
    const loaded = await loadLampFixture({ serveRoot: path.join(__dirname, '..'), lampSeed: null, lampFixture: file });
    assert.equal(loaded.save, raw);
    assert.equal(loaded.sha256, actualSha);
    assert.equal(loaded.seed, 4242);
    assert.deepEqual(JSON.parse(loaded.save).loadouts, fixture.loadouts);
    assert.equal(await loadLampFixture({ serveRoot: path.join(__dirname, '..'), lampSeed: null, lampFixture: '' }), null);
    fs.writeFileSync(file, '{bad json');
    await assert.rejects(loadLampFixture({ serveRoot: path.join(__dirname, '..'), lampSeed: null, lampFixture: file }), SyntaxError);
    fs.writeFileSync(file, '{}');
    await assert.rejects(loadLampFixture({ serveRoot: path.join(__dirname, '..'), lampSeed: null, lampFixture: file }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('hero fixture import and export preserve raw bytes and reject normalized progression', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orka-hero-fixture-'));
  try {
    const { createHeroProgressStore, newHeroProgress, refreshHeroStats } = await import('../web-runner/src/core/heroProgression.mjs');
    const fixture = createHeroProgressStore();
    fixture.heroes.Falie.currentLevel = 4;
    fixture.heroes.Falie.currentEXP = 0;
    refreshHeroStats(fixture.heroes.Falie);
    fixture.heroes.Falie.hp = 21;
    fixture.heroes['falie#1'] = newHeroProgress('Falie', 'falie#1');
    fixture.heroes['falie#1'].currentLevel = 7;
    refreshHeroStats(fixture.heroes['falie#1']);
    fixture.heroes['falie#1'].hp = 30;
    const raw = `${JSON.stringify(fixture, null, 2)}\n`;
    const file = path.join(root, 'hero.json');
    const exported = writeHeroFixture(file, raw);
    const actualSha = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(exported.sha256, actualSha);
    const loaded = await loadHeroFixture({ serveRoot: path.join(__dirname, '..'), heroFixture: file });
    assert.equal(loaded.save, raw);
    assert.equal(loaded.sha256, actualSha);
    assert.deepEqual(loaded.heroes.find((hero) => hero.id === 'Falie'), { id: 'Falie', name: 'Falie', currentLevel: 4, hp: 21, maxHp: 99 });
    assert.deepEqual(loaded.heroes.find((hero) => hero.id === 'falie#1'), { id: 'falie#1', name: 'Falie', currentLevel: 7, hp: 30, maxHp: 123 });
    assert.equal(await loadHeroFixture({ serveRoot: path.join(__dirname, '..'), heroFixture: '' }), null);
    fs.writeFileSync(file, '{bad json');
    await assert.rejects(loadHeroFixture({ serveRoot: path.join(__dirname, '..'), heroFixture: file }), SyntaxError);
    fs.writeFileSync(file, JSON.stringify({ ...fixture, heroes: { ...fixture.heroes, Falie: { ...fixture.heroes.Falie, currentLevel: 999 } } }));
    await assert.rejects(loadHeroFixture({ serveRoot: path.join(__dirname, '..'), heroFixture: file }), /normalized or invalid/);
    fs.writeFileSync(file, JSON.stringify({ ...fixture, heroes: { ...fixture.heroes, Falie: { ...fixture.heroes.Falie, maxHP: 999 } } }));
    await assert.rejects(loadHeroFixture({ serveRoot: path.join(__dirname, '..'), heroFixture: file }), /normalized or invalid/);
    fs.writeFileSync(file, JSON.stringify({ ...fixture, version: 1 }));
    await assert.rejects(loadHeroFixture({ serveRoot: path.join(__dirname, '..'), heroFixture: file }), /version is unsupported/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('hero fixture options preload before navigation and only export one isolated session', () => {
  assert.equal(buildConfig({ heroFixture: '/tmp/heroes.json' }, {}).heroFixture, '/tmp/heroes.json');
  assert.throws(() => buildConfig({ sessions: '2', saveHeroFixture: '/tmp/heroes.json' }, {}), /saveHeroFixture requires one session/);
  assert.match(source, /localStorage\.setItem\('orka\.hero_progress\.v2', value\)/);
  assert.ok(source.indexOf("localStorage.setItem('orka.hero_progress.v2', value)") < source.indexOf('await page.goto'));
  assert.match(source, /Hero fixture was not applied/);
  assert.match(source, /fixtureById\.get\(hero\.instanceKey\)/);
  assert.match(source, /savedHeroFixture = writeHeroFixture\(config\.saveHeroFixture, save\)/);
});

test('boss target uses the visible manual Summon Boss control after a recovery', () => {
  assert.match(source, /async function summonReadyBoss\(page\)/);
  assert.match(source, /#combat-boss-fallback button/);
  assert.match(source, /config\.maxBossClears > 0 \? completedBosses >= config\.maxBossClears/);
  assert.match(source, /bossAttemptRecords\.push\(activeBossAttempt\)/);
  assert.match(source, /outcome = Number\(snapshot\.continuousProgression\?\.clearedBosses/);
  assert.match(source, /gameTimer: 'unavailable'/);
});

test('optional frame capture records real combat, recovery, and boss states', () => {
  assert.match(source, /await page\.screenshot\(\{ path: file \}\)/);
  assert.match(source, /#lamp-overlay:not\(\[hidden\]\)/);
  assert.match(source, /await capture\('combat_start'\)/);
  assert.match(source, /await capture\('post_recovery'\)/);
  assert.match(source, /snapshot\.heroes\.some\(hero => hero\.recoveryRevealActive\)\) await capture\('recovery_reveal'\)/);
  assert.match(hookSource, /recoveryRevealActive: isActorRecoveryRevealActive\(e, state\.globals\.time\)/);
  assert.match(source, /await capture\('boss_active'\)/);
  assert.match(source, /await capture\('after_boss_clear'\)/);
  assert.match(source, /await capture\(`final_\$\{endReason\}`\)/);
  assert.match(source, /captureFrames: readBool\(args\.captureFrames/);
});

test('opening roam report retains its starting state and observed release before recovery', () => {
  assert.match(source, /const openingRoam = \{ start: snapshot\.initialRoam, release: null \}/);
  assert.match(source, /!snapshot\.initialRoam/);
  assert.match(source, /snapshot\.continuousProgression\?\.defeatRecoveries \|\| 0\) === startDefeatRecoveries/);
  assert.match(source, /openingRoam\.release = \{/);
  assert.match(source, /distanceWalked: Number\(openingRoam\.start\.direction \|\| 0\)/);
  assert.match(source, /openingRoam,\n/);
});

test('balance harness waits for active realtime combat with a living party and target', () => {
  const ready = {
    flags: { layoutId: 'combat' },
    quest: { phase: 'combat' },
    heroes: [{ hp: 1 }],
    enemies: [{ hp: 1 }],
  };
  assert.equal(isRealtimeCombatReadyState(ready), true);
  assert.equal(isRealtimeCombatReadyState({ ...ready, quest: { phase: 'map' } }), false);
  assert.equal(isRealtimeCombatReadyState({ ...ready, heroes: [{ hp: 0 }] }), false);
  assert.equal(isRealtimeCombatReadyState({ ...ready, enemies: [] }), false);
});

test('balance harness writes its completed summary before managed cleanup', () => {
  const mainBody = source.slice(source.indexOf('async function main('), source.indexOf('if (require.main === module)'));
  assert.ok(mainBody.indexOf('writeOutputs(config, sessions, aggregate)') < mainBody.indexOf('await browserSession.close()'));
  assert.match(source, /settleWithin\(\(\) => browserServer\.close\(\), config\.cleanupTimeoutMs\)/);
  assert.match(source, /browserServer\.kill\(\)/);
});

test('balance harness records exact damage and healing events alongside sampled HP', () => {
  assert.match(source, /startHp: hero\.hp, minSampledHp: hero\.hp, minEventHp: hero\.hp, endHp: hero\.hp/);
  assert.match(source, /sampledHpLoss: 0, largestSampleWindowHpLoss: 0, sampledRecovery: 0, physicalIncomingDamage: 0, magicIncomingDamage: 0/);
  assert.match(source, /tracked\.sampledHpLoss \+= Math\.max\(0, tracked\.lastHp - hero\.hp\)/);
  assert.match(source, /tracked\.sampledRecovery \+= Math\.max\(0, hero\.hp - tracked\.lastHp\)/);
  assert.match(source, /globals\.BalanceCombatEvents \|\| \[\]/);
  assert.match(source, /let lastCombatEventId = snapshot\.combatEventSeq/);
  assert.match(source, /tracked\.effectiveHealing \+= event\.amount/);
  assert.match(source, /tracked\[damageKey\] \+= event\.amount/);
  assert.match(source, /missingCombatEvents/);
  assert.match(source, /heroes: heroMetrics\.map\(\(\{ lastHp, \.\.\.hero \}\) => hero\)/);
  assert.match(source, /recordedHeroDamageEvents/);
  assert.match(source, /maximumAppliedDamage: incomingDamageEvents\.reduce/);
  assert.match(source, /snapshot\.combatEvents/);
  assert.match(source, /recoveryRecords\.push\(record\)/);
  assert.match(hookSource, /zIndex: Number\(d\.zIndex \|\| 0\)/);
  assert.match(hookSource, /targetUID: Number\(d\.targetUID \|\| 0\)/);
  assert.match(hookSource, /sourceUID: Number\(d\.sourceUID \|\| 0\)/);
});

test('first KO follows ordered applied damage events across heroes and enemies', () => {
  const browserBank = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  const scriptBank = fs.readFileSync(path.join(__dirname, '..', 'Scripts', 'functionBank.js'), 'utf8');
  for (const bank of [browserBank, scriptBank]) {
    assert.match(bank, /type: 'enemy_ko', sourceUID: Number\(source\?\.uid \|\| 0\), targetUID: Number\(uid \|\| 0\)/);
  }
  assert.match(source, /if \(event\.type === 'enemy_ko'\)/);
  assert.match(source, /if \(!firstKo\) firstKo = \{ side: 'hero', uid: event\.targetUID/);
  assert.doesNotMatch(source, /firstKo = \{ side: event\.side/);
});

test('unchanged builds count observed wave transitions without treating defeat reset as a clear', () => {
  const before = { region: 1, stage: 1, wave: 1, stageTransitions: 0, bossActive: false, bossAvailable: false };
  assert.equal(observedOrdinaryWaveClear(before, { ...before, wave: 2, stageTransitions: 1 }), 1);
  assert.equal(observedOrdinaryWaveClear({ ...before, wave: 4, stageTransitions: 3 }, { ...before, wave: 1, stageTransitions: 4, bossAvailable: true, bossSummonRequired: false }), 1);
  assert.equal(observedOrdinaryWaveClear({ ...before, wave: 4, stageTransitions: 3 }, { ...before, wave: 1, stageTransitions: 4, bossAvailable: true, bossSummonRequired: true }), null);
  assert.equal(observedOrdinaryWaveClear(before, { ...before, stageTransitions: 1 }), 0);
  assert.equal(observedOrdinaryWaveClear(before, { ...before, wave: 3, stageTransitions: 2 }), null);
});

test('legacy reports keep missing recovery telemetry unknown', () => {
  const aggregate = aggregateSessions({ maxWaves: 4, maxBossClears: 0 }, [
    { seed: 1, enemiesDefeated: 1, wavesCompleted: 1, bossesCleared: 0, defeatRecoveries: null, simulationSecondsSurvived: 10, heroCasualties: [], firstKoSide: 'unobserved', endReason: 'timeout', deadlockCount: 0 },
  ]);
  assert.equal(aggregate.totalDefeatRecoveries, null);
  assert.equal(aggregate.medianDefeatRecoveries, null);
  assert.equal(aggregate.firstKoSides.unobserved, 1);
});

test('balance harness counts completed continuous stages from stage transitions, not enemy counts', () => {
  assert.match(source, /continuousProgression: state\.continuousProgression \? \{ \.\.\.state\.continuousProgression,/);
  assert.match(source, /const startOrdinaryWaveClears = Number\(snapshot\.continuousProgression\?\.ordinaryWaveClears \|\| 0\)/);
  assert.match(source, /completedOrdinaryWaves = Math\.max\(0, Number\(snapshot\.continuousProgression\?\.ordinaryWaveClears \|\| 0\) - startOrdinaryWaveClears\)/);
  assert.doesNotMatch(source, /defeatedEnemyUIDs\.size \/ config\.enemiesPerWave/);
  assert.match(source, /if \(Date\.now\(\) - startedAt >= config\.sessionTimeoutMs && endReason === 'max_waves'/);
  assert.doesNotMatch(source, /defeatLimit/);
  assert.match(source, /continuousProgressionStart: snapshotAtStart/);
  assert.match(source, /continuousProgressionEnd: snapshot\.continuousProgression/);
  assert.match(hookSource, /clearedPackMask: Number\(state\.globals\.ContinuousCombatStage\.clearedPackMask \|\| 0\)/);
  assert.match(hookSource, /spawnedPackMask: Number\(state\.globals\.ContinuousCombatStage\.spawnedPackMask \|\| 0\)/);
  assert.match(hookSource, /transitions: Number\(state\.globals\.ContinuousCombatStage\.transitions \|\| 0\)/);
  assert.match(hookSource, /defeatRecoveries: Number\(state\.globals\.ContinuousCombatStage\.defeatRecoveries \|\| 0\)/);
  assert.match(source, /defeatRecoveries: snapshot\.continuousProgression\?\.defeatRecoveries == null \? null : Number\(snapshot\.continuousProgression\.defeatRecoveries\) - startDefeatRecoveries/);
  assert.match(source, /everySeedCompletesTarget: sessions\.length > 0 && sessions\.every/);
  assert.doesNotMatch(source, /noDefeatRecoveries:/);
  assert.match(source, /'waves_completed', 'bosses_cleared', 'defeat_recoveries'/);
  assert.match(source, /'continuous_progression_start', 'continuous_progression_end'/);
  assert.doesNotMatch(source, /enemiesPerWave|BALANCE_ENEMIES_PER_WAVE/);
  assert.match(source, /endReason === 'max_waves'/);
});

test('casualty variation measures the first hero lost in each session', () => {
  const aggregate = aggregateSessions({ maxWaves: 5 }, [
    { seed: 1, enemiesDefeated: 2, wavesCompleted: 1, bossesCleared: 0, defeatRecoveries: 3, simulationSecondsSurvived: 20, heroCasualties: ['Runa', 'Falie'], firstKoSide: 'enemy', endReason: 'party_defeated', deadlockCount: 0 },
    { seed: 2, enemiesDefeated: 2, wavesCompleted: 0, bossesCleared: 0, defeatRecoveries: 2, simulationSecondsSurvived: 21, heroCasualties: ['Huun', 'Falie'], firstKoSide: 'hero', endReason: 'party_defeated', deadlockCount: 0 },
  ]);
  assert.deepEqual(aggregate.firstHeroCasualtyDistribution, { Runa: 1, Huun: 1 });
  assert.equal(aggregate.averageSimulationSecondsSurvived, 20.5);
  assert.equal(aggregate.acceptance.everySeedCompletesTarget, false);
  assert.equal(aggregate.totalDefeatRecoveries, 5);
  assert.equal(aggregate.coverage.bossClearObserved, false);
  assert.equal(aggregate.coverage.defeatRecoveryObserved, true);
  assert.deepEqual(aggregate.coverage.separateFixturesRequired, ['boss_trials', 'recovery_trials']);
  assert.equal(aggregate.totalDefeatRecoveries, 5);
  assert.equal(aggregate.medianDefeatRecoveries, 2.5);
});
