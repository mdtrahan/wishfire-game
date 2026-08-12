const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

for (const modulePath of [
  path.join('file://', __dirname, '..', 'src', 'core', 'pendingSuperGemHandoff.mjs'),
  path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'pendingSuperGemHandoff.mjs'),
]) {
  test(`pending target actor recovery preserves or reconstructs hero ownership in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const actors = new Map([
      [101, { uid: 101, kind: 'hero', hp: 50 }],
      [102, { uid: 102, kind: 'hero', hp: 50 }],
      [201, { uid: 201, kind: 'enemy', hp: 50 }],
    ]);
    const getActorByUID = (uid) => actors.get(Number(uid || 0)) || null;

    const preserved = { PendingActor: 101 };
    assert.equal(mod.recoverPendingTargetActor({
      globals: preserved,
      currentTurnUID: 102,
      selectedHeroUID: 102,
      getActorByUID,
    }), 101);
    assert.equal(preserved.PendingActor, 101);

    const recoveredCurrent = { PendingActor: 0 };
    assert.equal(mod.recoverPendingTargetActor({
      globals: recoveredCurrent,
      currentTurnUID: 102,
      selectedHeroUID: 101,
      getActorByUID,
    }), 102);
    assert.equal(recoveredCurrent.PendingActor, 102);

    const recoveredSelected = { PendingActor: 0 };
    assert.equal(mod.recoverPendingTargetActor({
      globals: recoveredSelected,
      currentTurnUID: 201,
      selectedHeroUID: 101,
      getActorByUID,
    }), 101);
    assert.equal(recoveredSelected.PendingActor, 101);
  });

  test(`manual target intent validates actor, UID, and slot ownership in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const target = { uid: 201, kind: 'enemy', hp: 50, slotIndex: 0 };
    const actors = new Map([
      [101, { uid: 101, kind: 'hero', hp: 50 }],
      [201, target],
      [202, { uid: 202, kind: 'enemy', hp: 50, slotIndex: 2 }],
    ]);
    const globals = {
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 101,
      EnemyIDs: [201, 0, 202],
      EnemySlots: [202, 0, 203],
    };
    const intent = mod.capturePendingEnemyTargetIntent({ globals, actorUID: 101, target, now: 12.5 });
    assert.deepEqual(intent, {
      sequence: 1,
      actorUID: 101,
      targetUID: 201,
      slotIndex: 0,
      selectedAt: 12.5,
    });
    assert.equal(globals.SelectedEnemyUID, 201);
    assert.equal(globals.SelectedEnemyUIDOwner, 101);

    const valid = mod.validatePendingEnemyTargetIntent({
      globals,
      actorUID: 101,
      getActorByUID: (uid) => actors.get(Number(uid || 0)) || null,
    });
    assert.equal(valid.ok, true);
    assert.equal(valid.targetUID, 201);

    globals.SelectedEnemyUID = 202;
    const changed = mod.validatePendingEnemyTargetIntent({
      globals,
      actorUID: 101,
      getActorByUID: (uid) => actors.get(Number(uid || 0)) || null,
    });
    assert.equal(changed.ok, false);
    assert.equal(changed.reason, 'selection_changed');

    globals.SelectedEnemyUID = 201;
    globals.EnemyIDs[0] = 202;
    const rosterChanged = mod.validatePendingEnemyTargetIntent({
      globals,
      actorUID: 101,
      getActorByUID: (uid) => actors.get(Number(uid || 0)) || null,
    });
    assert.equal(rosterChanged.ok, false);
    assert.equal(rosterChanged.reason, 'enemy_id_map_changed');
  });

  test(`rejected pending supergem handoff clears stale supergem action in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const globals = {
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 101,
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 1, actorUID: 101 },
      SelectedEnemyUID: 202,
      SelectedEnemyUIDOwner: 101,
      CanPickGems: false,
      IsPlayerBusy: 1,
      DeferAdvance: 0,
      AdvanceAfterAction: 0,
      ActionOwnerUID: 0,
    };
    let executeSkillCalls = 0;
    let hideCalls = 0;

    const result = mod.resolvePendingSuperGemHandoff({
      globals,
      actorUID: 101,
      executePendingSuperGemAction: () => false,
      executeSkill: () => {
        executeSkillCalls += 1;
        return 1;
      },
      hideAttackUI: () => {
        hideCalls += 1;
      },
    });

    assert.equal(result.recoveredRejectedPendingSuperGem, true);
    assert.equal(result.resolvedPendingSuperGem, false);
    assert.equal(result.executeSkillResult, null);
    assert.equal(executeSkillCalls, 0);
    assert.equal(hideCalls, 1);
    assert.equal(globals.PendingSkillID, '');
    assert.equal(globals.PendingActor, 0);
    assert.equal(globals.PendingSuperGemAction, null);
    assert.equal(globals.SelectedEnemyUID, 0);
    assert.equal(globals.SelectedEnemyUIDOwner, 0);
    assert.equal(globals.PendingManualTargetIntent, null);
    assert.equal(globals.CanPickGems, false);
    assert.equal(globals.IsPlayerBusy, 0);
    assert.equal(globals.DeferAdvance, 0);
    assert.equal(globals.AdvanceAfterAction, 0);
    assert.equal(globals.ActionOwnerUID, 0);
    assert.equal(globals.LastPendingSuperGemReject.source, 'pending-supergem-handoff');
  });

  test(`resolved pending supergem handoff preserves busy handoff behavior in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const globals = {
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 101,
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 1, actorUID: 101 },
      SelectedEnemyUID: 202,
      SelectedEnemyUIDOwner: 101,
      CanPickGems: false,
      IsPlayerBusy: 0,
    };

    const result = mod.resolvePendingSuperGemHandoff({
      globals,
      actorUID: 101,
      executePendingSuperGemAction: () => {
        globals.PendingSuperGemAction = null;
        return true;
      },
      executeSkill: () => {
        throw new Error('normal skill fallback should not run for resolved supergem');
      },
      hideAttackUI: () => {},
    });

    assert.equal(result.recoveredRejectedPendingSuperGem, false);
    assert.equal(result.resolvedPendingSuperGem, true);
    assert.equal(globals.PendingSkillID, '');
    assert.equal(globals.PendingActor, 0);
    assert.equal(globals.SelectedEnemyUID, 0);
    assert.equal(globals.SelectedEnemyUIDOwner, 0);
    assert.equal(globals.PendingManualTargetIntent, null);
    assert.equal(globals.CanPickGems, false);
    assert.equal(globals.IsPlayerBusy, 1);
  });

  test(`normal pending skill handoff still executes skill in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const globals = {
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 101,
      PendingSuperGemAction: null,
      SelectedEnemyUID: 202,
      SelectedEnemyUIDOwner: 101,
      CanPickGems: false,
      IsPlayerBusy: 0,
    };
    let executeSkillCalls = 0;

    const result = mod.resolvePendingSuperGemHandoff({
      globals,
      actorUID: 101,
      executePendingSuperGemAction: () => false,
      executeSkill: (skillID, actorUID) => {
        executeSkillCalls += 1;
        assert.equal(skillID, 'HERO_SINGLE');
        assert.equal(actorUID, 101);
        return 1;
      },
      hideAttackUI: () => {},
    });

    assert.equal(result.recoveredRejectedPendingSuperGem, false);
    assert.equal(result.resolvedPendingSuperGem, false);
    assert.equal(result.executeSkillResult, 1);
    assert.equal(executeSkillCalls, 1);
    assert.equal(globals.PendingSkillID, '');
    assert.equal(globals.PendingActor, 0);
    assert.equal(globals.SelectedEnemyUID, 0);
    assert.equal(globals.SelectedEnemyUIDOwner, 0);
    assert.equal(globals.PendingManualTargetIntent, null);
    assert.equal(globals.CanPickGems, false);
    assert.equal(globals.IsPlayerBusy, 1);
  });

  test(`pending skill handoff resolves with pending actor instead of stale current actor in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const globals = {
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 101,
      PendingSuperGemAction: null,
      SelectedEnemyUID: 202,
      SelectedEnemyUIDOwner: 101,
      CanPickGems: false,
      IsPlayerBusy: 0,
    };
    const calls = [];

    const result = mod.resolvePendingSuperGemHandoff({
      globals,
      actorUID: 404,
      executePendingSuperGemAction: () => false,
      executeSkill: (skillID, actorUID) => {
        calls.push({ skillID, actorUID });
        return 1;
      },
      hideAttackUI: () => {},
    });

    assert.equal(result.executeSkillResult, 1);
    assert.deepEqual(calls, [{ skillID: 'HERO_SINGLE', actorUID: 101 }]);
    assert.equal(globals.PendingSkillID, '');
    assert.equal(globals.PendingActor, 0);
    assert.equal(globals.SelectedEnemyUID, 0);
    assert.equal(globals.SelectedEnemyUIDOwner, 0);
  });
}

test('app routes manual and dev autoplay pending target handoffs through shared supergem recovery', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');

  assert.match(src, /capturePendingEnemyTargetIntent,[\s\S]*recoverPendingTargetActor,[\s\S]*resolvePendingSuperGemHandoff,[\s\S]*validatePendingEnemyTargetIntent,[\s\S]*from '\.\/src\/core\/pendingSuperGemHandoff\.mjs';/);
  assert.match(src, /function resolvePendingTargetHandoff\(\{ actorUID, source \}\)/);
  assert.match(src, /function recoverPendingTargetActorUID\(\)/);
  assert.match(src, /const targetOwnerUID = recoverPendingTargetActorUID\(\);/);
  assert.match(src, /capturePendingEnemyTargetIntent\(\{[\s\S]*actorUID: targetOwnerUID,[\s\S]*target: hit,/);
  assert.match(src, /validatePendingEnemyTargetIntent\(\{[\s\S]*globals: state\.globals,[\s\S]*actorUID,/);
  assert.match(src, /if \(!targetCheck\.ok\) \{[\s\S]*drawFrame\(\);[\s\S]*return;/);
  assert.match(src, /resolvePendingTargetHandoff\(\{\s*actorUID,\s*source: 'dev-autoplay',\s*\}\)/s);
  assert.match(src, /resolvePendingTargetHandoff\(\{\s*actorUID,\s*source: 'manual-button',\s*\}\)/s);
});
