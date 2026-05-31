const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const runtimeRulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'statusEffectRules.mjs');
const sourceRulesPath = path.join(__dirname, '..', 'src', 'core', 'statusEffectRules.mjs');
const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const renderRuntimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');

function assertJsonSafe(value, label) {
  assert.deepEqual(JSON.parse(JSON.stringify(value)), value, label);
}

test('status effect rule module mirrors runtime and source copies exactly', () => {
  assert.equal(
    fs.readFileSync(runtimeRulesPath, 'utf8'),
    fs.readFileSync(sourceRulesPath, 'utf8'),
  );
});

test('enemy debuff icon renderer receives loaded debuff images from app scope', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const renderRuntimeSrc = fs.readFileSync(renderRuntimePath, 'utf8');

  assert.match(renderRuntimeSrc, /debuffIconImages\[key\]/);
  assert.match(appSrc, /debuffIconImages: \(typeof debuffIconImages !== 'undefined' \? debuffIconImages : \{\}\)/);
});

test('status effect packet functions expose JSON-safe SimulationCore requests and responses', async () => {
  const rules = await import(pathToFileURL(runtimeRulesPath));
  const cases = [
    {
      name: 'enemy dot application',
      create: rules.createEnemyDotPacketSimulationPacket,
      actionType: 'status.enemyDotPacket',
      ruleFamily: 'enemyDotPacket',
      result: 'enemy_dot_packet',
      payload: {
        source: 'test.enemyDotPacket',
        actorUID: 1,
        enemyUID: 2,
        totalDamage: 25,
        totalTicks: 3,
        nowTick: 4,
        nowTurnSerial: 8,
        firesEveryTicks: 2,
        startAfterTicks: 1,
        firesEveryTurns: 2,
        startAfterTurns: 1,
        cadence: 'turn',
        effectName: 'Blight',
        taintedGroundZoneId: 'tg-a',
        jsTargetUID: 2,
        jsSourceUID: 1,
        jsRemainingFires: 3,
        jsTotalDamageRemaining: 25,
        jsFiresEveryTicks: 2,
        jsNextFireTick: 5,
        jsFiresEveryTurns: 2,
        jsNextFireTurnSerial: 9,
        jsLastProcessedTurnSerial: 8,
        ownerHook: () => ({
          owner: 'rust',
          targetUID: 2,
          sourceUID: 1,
          remainingFires: 4,
          totalDamageRemaining: 40,
          firesEveryTicks: 3,
          nextFireTick: 6,
          firesEveryTurns: 3,
          nextFireTurnSerial: 10,
          lastProcessedTurnSerial: 8,
        }),
      },
    },
    {
      name: 'enemy dot tick',
      create: rules.createEnemyDotTickSimulationPacket,
      actionType: 'status.enemyDotTick',
      ruleFamily: 'enemyDotTick',
      result: 'enemy_dot_tick',
      payload: {
        source: 'test.enemyDotTick',
        totalDamageRemaining: 30,
        remainingFires: 3,
        damagePerFire: 0,
        hasTotalDamageRemaining: 1,
        nextFireTurnSerial: 10,
        firesEveryTurns: 2,
        jsDamage: 10,
        jsTotalDamageRemaining: 20,
        jsRemainingFires: 2,
        jsNextFireTurnSerial: 12,
        ownerHook: () => ({
          owner: 'rust',
          damage: 7,
          totalDamageRemaining: 23,
          remainingFires: 2,
          nextFireTurnSerial: 14,
        }),
      },
    },
    {
      name: 'enemy dot lifecycle',
      create: rules.createEnemyDotLifecycleSimulationPacket,
      actionType: 'status.enemyDotLifecycle',
      ruleFamily: 'enemyDotLifecycle',
      result: 'enemy_dot_lifecycle',
      payload: {
        source: 'test.enemyDotLifecycle',
        cadenceIsTurn: 1,
        dotTargetUID: 2,
        targetUID: 2,
        remainingFires: 3,
        hasTotalDamageRemaining: 1,
        totalDamageRemaining: 30,
        targetAlive: 1,
        currentTurnSerial: 10,
        nextFireTurnSerial: 10,
        lastProcessedTurnSerial: 9,
        jsAction: 2,
        ownerHook: () => ({ owner: 'rust', action: 1 }),
      },
    },
    {
      name: 'enemy debuff apply',
      create: rules.createEnemyDebuffApplySimulationPacket,
      actionType: 'status.enemyDebuffApply',
      ruleFamily: 'enemyDebuffApply',
      result: 'enemy_debuff_apply',
      payload: {
        source: 'test.enemyDebuffApply',
        stat: 'ATK',
        amountBefore: 2,
        turnsBefore: 1,
        addAmount: 2,
        durationTurns: 3,
        jsAmountAfter: 4,
        jsTurnsAfter: 3,
        jsActive: 1,
        ownerHook: () => ({ owner: 'rust', amountAfter: 9, turnsAfter: 8, active: 1 }),
      },
    },
    {
      name: 'enemy debuff decay',
      create: rules.createEnemyDebuffDecaySimulationPacket,
      actionType: 'status.enemyDebuffDecay',
      ruleFamily: 'enemyDebuffDecay',
      result: 'enemy_debuff_decay',
      payload: {
        source: 'test.enemyDebuffDecay',
        stat: 'DEF',
        amountBefore: 3,
        turnsBefore: 1,
        jsAmountAfter: 0,
        jsTurnsAfter: 0,
        jsActive: 0,
        ownerHook: () => ({ owner: 'rust', amountAfter: 0, turnsAfter: 0, active: 0 }),
      },
    },
    {
      name: 'enemy debuff slot',
      create: rules.createEnemyDebuffSlotSimulationPacket,
      actionType: 'status.enemyDebuffSlot',
      ruleFamily: 'enemyDebuffSlot',
      result: 'enemy_debuff_slot',
      payload: {
        source: 'test.enemyDebuffSlot',
        stat: 'SPD',
        statIndex: 4,
        active: 1,
        slotCount: 3,
        slot0Index: 0,
        slot1Index: 1,
        slot2Index: 2,
        jsAction: 2,
        jsDropSlotIndex: 0,
        jsAppendSlotIndex: 4,
        ownerHook: () => ({ owner: 'rust', action: 2, dropSlotIndex: 1, appendSlotIndex: 4 }),
      },
    },
    {
      name: 'party regen lifecycle',
      create: rules.createPartyRegenLifecycleSimulationPacket,
      actionType: 'status.partyRegenLifecycle',
      ruleFamily: 'partyRegenLifecycle',
      result: 'party_regen_lifecycle',
      payload: {
        source: 'test.partyRegenLifecycle',
        remainingFires: 3,
        hasTotalHealRemaining: 1,
        totalHealRemaining: 12,
        currentSerial: 6,
        nextFireSerial: 6,
        appliedOnSerial: 4,
        lastProcessedSerial: 5,
        jsAction: 2,
        ownerHook: () => ({ owner: 'rust', action: 2 }),
      },
    },
    {
      name: 'party regen tick',
      create: rules.createPartyRegenTickSimulationPacket,
      actionType: 'status.partyRegenTick',
      ruleFamily: 'partyRegenTick',
      result: 'party_regen_tick',
      payload: {
        source: 'test.partyRegenTick',
        totalHealRemaining: 12,
        remainingFires: 3,
        healPerFire: 0,
        hasTotalHealRemaining: 1,
        nextFireSerial: 6,
        firesEvery: 2,
        distributionMode: 1,
        jsHeal: 4,
        jsTotalHealRemaining: 8,
        jsRemainingFires: 2,
        jsNextFireSerial: 8,
        ownerHook: () => ({
          owner: 'rust',
          heal: 5,
          totalHealRemaining: 7,
          remainingFires: 2,
          nextFireSerial: 8,
        }),
      },
    },
  ];

  for (const item of cases) {
    const packet = item.create(item.payload);
    assert.equal(packet.owner, 'rust', `${item.name} owner`);
    assert.equal(packet.simulationCoreRequest.action.type, item.actionType, `${item.name} action type`);
    assert.equal(packet.simulationCoreRequest.context.ruleFamily, item.ruleFamily, `${item.name} rule family`);
    assert.equal(packet.simulationCoreResponse.result, item.result, `${item.name} result`);
    assert.equal(packet.simulationCoreResponse.diagnostics.ruleFamily, item.ruleFamily, `${item.name} diagnostics`);
    assertJsonSafe(packet.simulationCoreRequest, `${item.name} request JSON-safe`);
    assertJsonSafe(packet.simulationCoreResponse, `${item.name} response JSON-safe`);
  }
});
