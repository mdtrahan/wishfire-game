const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

for (const schedulerPath of ['src/core/schedulerRules.mjs', 'web-runner/src/core/schedulerRules.mjs']) {
test(`team phase scheduler always starts heroes, alternates teams, and sorts only within active team in ${schedulerPath}`, async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', schedulerPath)).href);
  const roster = [
    { uid: 1, type: 0, spd: 11, name: 'Falie' },
    { uid: 2, type: 0, spd: 20, name: 'Huun' },
    { uid: 3, type: 0, spd: 15, name: 'Runa' },
    { uid: 4, type: 0, spd: 8, name: 'Kojonn' },
    { uid: 101, type: 1, spd: 18, name: 'Djinn' },
    { uid: 102, type: 1, spd: 12, name: 'Marid' },
    { uid: 103, type: 1, spd: 3, name: 'Chimerilass' },
  ];

  const heroPhase = scheduler.buildTeamPhaseSlots(roster, 0).map(slot => slot.uid);
  const enemyPhase = scheduler.buildTeamPhaseSlots(roster, scheduler.nextTeamPhaseType(0)).map(slot => slot.uid);
  const nextHeroPhase = scheduler.buildTeamPhaseSlots(roster, scheduler.nextTeamPhaseType(1)).map(slot => slot.uid);

  assert.deepEqual(heroPhase, [2, 3, 1, 4]);
  assert.deepEqual(enemyPhase, [101, 102, 103]);
  assert.deepEqual(nextHeroPhase, [2, 3, 1, 4]);
});

test(`team phase ownership does not depend on team size in ${schedulerPath}`, async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', schedulerPath)).href);
  const roster = [
    { uid: 2, type: 0, spd: 20, hp: 35, name: 'Huun' },
    { uid: 101, type: 1, spd: 18, hp: 20, name: 'Djinn' },
    { uid: 102, type: 1, spd: 12, hp: 20, name: 'Marid' },
    { uid: 103, type: 1, spd: 3, hp: 20, name: 'Chimerilass' },
  ];

  assert.deepEqual(scheduler.buildTeamPhaseSlots(roster, 0).map(slot => slot.uid), [2]);
  assert.deepEqual(scheduler.buildTeamPhaseSlots(roster, 1).map(slot => slot.uid), [101, 102, 103]);
  assert.equal(scheduler.nextTeamPhaseType(0), 1);
  assert.equal(scheduler.nextTeamPhaseType(1), 0);
});


test(`team phase scheduler excludes dead and disabled actors from phase queues in ${schedulerPath}`, async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', schedulerPath)).href);
  const roster = [
    { uid: 1, type: 0, spd: 11, hp: 40, name: 'Falie' },
    { uid: 2, type: 0, spd: 20, hp: 35, stunned: true, name: 'Huun' },
    { uid: 3, type: 0, spd: 15, hp: 0, name: 'Runa' },
    { uid: 4, type: 0, spd: 8, hp: 30, statusEffects: ['paralyzed'], name: 'Kojonn' },
    { uid: 101, type: 1, spd: 18, hp: 20, name: 'Djinn' },
    { uid: 102, type: 1, spd: 12, hp: 20, disabled: true, name: 'Marid' },
  ];

  assert.deepEqual(scheduler.buildTeamPhaseSlots(roster, 0).map(slot => slot.uid), [1]);
  assert.deepEqual(scheduler.buildTeamPhaseSlots(roster, 1).map(slot => slot.uid), [101]);
});
}

test('runtime mirrors build team phases instead of mixed global speed queues', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /buildTeamPhaseSlots/);
    assert.match(src, /nextTeamPhaseType/);
    assert.match(src, /g\.TeamPhaseType = 0;/);
    assert.match(src, /createRoundPointerAdvanceSimulationPacket/);
    assert.match(src, /g\.TeamPhaseType = Number\(pointerAdvance\.nextTeamPhaseType \|\| 0\);/);
    assert.doesNotMatch(src, /deriveBattleStartRoundPartition\(withInit, startMode\)/);
  }
});
