const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

for (const modulePath of [
  path.join('file://', __dirname, '..', 'src', 'core', 'pendingSuperGemHandoff.mjs'),
  path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'pendingSuperGemHandoff.mjs'),
]) {
  test(`rejected pending supergem handoff clears stale supergem action in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const globals = {
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 101,
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 1, actorUID: 101 },
      SelectedEnemyUID: 202,
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
    assert.equal(globals.CanPickGems, false);
    assert.equal(globals.IsPlayerBusy, 1);
  });
}

test('app routes manual and dev autoplay pending target handoffs through shared supergem recovery', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');

  assert.match(src, /import \{ resolvePendingSuperGemHandoff \} from '\.\/src\/core\/pendingSuperGemHandoff\.mjs';/);
  assert.match(src, /function resolvePendingTargetHandoff\(\{ actorUID, source \}\)/);
  assert.match(src, /resolvePendingTargetHandoff\(\{\s*actorUID,\s*source: 'dev-autoplay',\s*\}\)/s);
  assert.match(src, /resolvePendingTargetHandoff\(\{\s*actorUID,\s*source: 'manual-button',\s*\}\)/s);
});
