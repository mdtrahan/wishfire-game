import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8011/web-runner/index.html?devtest=true&target-continuous=1';
const passCount = Math.max(6, Number(process.argv[3] || 18));
const runLabel = String(new URL(url).searchParams.get('target-continuous') || 'run').replace(/[^a-z0-9_-]+/gi, '-');
const outputDir = path.resolve('test-results/ORKA-d1k/target-continuous', `${runLabel}-${Date.now()}`);

await mkdir(outputDir, { recursive: true });

async function waitForGame(page) {
  await page.waitForFunction(
    () => window.__codexGame && typeof window.render_game_to_text === 'function',
    null,
    { timeout: 30000 },
  );
}

function canvasPoint(box, logicalCanvas, logicalX, logicalY) {
  return {
    x: box.x + (logicalX * box.width / logicalCanvas.width),
    y: box.y + (logicalY * box.height / logicalCanvas.height),
  };
}

async function initializeContinuousScenario(page) {
  const result = await page.evaluate(async () => {
    const game = window.__codexGame;
    const setup = await game.setupChainStrikeIIScenario();
    if (!setup?.ok) return setup;
    const g = game.globals;
    g.SessionSkillsByHeroUID = {};
    g.PendingHeroHits = [];
    g.ChainStrikeVisuals = [];
    g.ArcanePulseVisuals = [];
    g.DamageTexts = [];
    g.HitFlashByUID = {};
    g.PendingSkillID = '';
    g.PendingActor = 0;
    g.PendingSuperGemAction = null;
    g.PendingManualTargetIntent = null;
    g.SelectedEnemyUID = 0;
    g.SelectedEnemyUIDOwner = 0;
    g.ActiveManualTargetTraceSequence = 0;
    g.DevAutoplayActive = 0;
    g.DevAutoplayStopRequested = 0;
    g.EnemyLineClearPressureActive = 0;
    g.DynamicInitiativeAuthorityEnabled = 0;
    for (const enemy of game.state.entities.filter((entry) => entry?.kind === 'enemy')) {
      enemy.maxHP = 1000;
      enemy.hp = 1000;
      enemy.isAlive = true;
      enemy.pendingOfficialDeath = 0;
    }
    game.stepFrames(3);
    return {
      ok: true,
      heroes: game.state.entities
        .filter((entry) => entry?.kind === 'hero' && Number(entry.hp ?? 0) > 0)
        .map((entry) => ({ uid: Number(entry.uid || 0), name: String(entry.name || '') })),
    };
  });
  assert(result?.ok, `continuous scenario setup failed: ${JSON.stringify(result)}`);
  assert(result.heroes.length > 0, 'continuous scenario has no living heroes');
  return result;
}

async function prepareManualRedTurn(page, heroUID, { killSlot = -1 } = {}) {
  return page.evaluate(({ heroUID, killSlot }) => {
    const game = window.__codexGame;
    const g = game.globals;
    const hero = game.state.entities.find((entry) => entry?.kind === 'hero' && Number(entry.uid || 0) === Number(heroUID || 0));
    if (!hero) return { ok: false, reason: 'hero_missing' };
    g.TurnOrderArray = Array.isArray(g.TurnOrderArray) ? g.TurnOrderArray : [];
    let turnIndex = g.TurnOrderArray.findIndex((slot) => Number(slot?.uid || 0) === Number(heroUID || 0));
    if (turnIndex < 0) {
      g.TurnOrderArray.push({
        uid: Number(heroUID || 0),
        type: 0,
        spd: Number(hero.stats?.SPD ?? hero.SPD ?? 0),
      });
      turnIndex = g.TurnOrderArray.length - 1;
    }
    assertNoOutstandingHit(g);
    g.CurrentTurnIndex = turnIndex;
    g.InitiativeCurrentUID = Number(heroUID || 0);
    g.CurrentHeroUID = Number(heroUID || 0);
    g.DynamicInitiativeAuthority = { active: 0, current: null };
    g.DynamicInitiative = {
      ...(g.DynamicInitiative || {}),
      active: 1,
      current: { uid: Number(heroUID || 0), type: 0, name: String(hero.name || '') },
    };
    g.PendingSkillID = '';
    g.PendingActor = 0;
    g.PendingSuperGemAction = null;
    g.PendingManualTargetIntent = null;
    g.SelectedEnemyUID = 0;
    g.SelectedEnemyUIDOwner = 0;
    g.ActiveManualTargetTraceSequence = 0;
    g.CanPickGems = true;
    g.IsPlayerBusy = 0;
    g.TurnPhase = 0;
    g.DeferAdvance = 0;
    g.AdvanceAfterAction = 0;
    g.ActionInProgress = 0;
    g.ActionActorUID = 0;
    g.ActionOwnerUID = 0;
    g.ActionLockUntil = 0;
    g.HeroAction = null;
    g.EnemyAction = null;
    g.BoardFillActive = 0;
    g.MatchedColorValue = -1;
    g.HideHeroSelector = 0;
    g.DamageTexts = [];
    g.HitFlashByUID = {};
    const enemies = game.state.entities.filter((entry) => entry?.kind === 'enemy' && Number(entry.hp ?? 0) > 0);
    g.EnemyIDs = Array.isArray(g.EnemyIDs) ? g.EnemyIDs : [];
    g.EnemySlots = Array.isArray(g.EnemySlots) ? g.EnemySlots : [];
    for (const enemy of enemies) {
      enemy.maxHP = 1000;
      enemy.hp = Number(enemy.slotIndex ?? -1) === Number(killSlot) ? 1 : 1000;
      enemy.isAlive = true;
      enemy.pendingOfficialDeath = 0;
      const slotIndex = Number(enemy.slotIndex ?? -1);
      if (slotIndex >= 0) {
        g.EnemyIDs[slotIndex] = Number(enemy.uid || 0);
        g.EnemySlots[slotIndex] = Number(enemy.uid || 0) + 1;
      }
    }
    game.clearSelection();
    const gems = (game.gems || []).filter(Boolean).slice(0, 3);
    if (gems.length < 3) return { ok: false, reason: 'not_enough_gems' };
    for (const gem of game.gems || []) {
      gem.color = 2;
      gem.elementIndex = 2;
      gem.selected = false;
      gem.Selected = 0;
    }
    for (const gem of gems) {
      gem.color = 1;
      gem.elementIndex = 1;
    }
    game.stepFrames(4);
    const viewport = window.__orkaAppViewport || { layoutScale: 1, layoutOffsetX: 0, layoutOffsetY: 0 };
    const canvas = document.getElementById('view');
    const rect = canvas?.getBoundingClientRect();
    return {
      ok: true,
      heroUID: Number(heroUID || 0),
      canvas: rect ? { width: rect.width, height: rect.height } : null,
      gemPoints: gems.map((gem) => ({
        x: Number(viewport.layoutOffsetX || 0) + Number(gem.x || 0) * Number(viewport.layoutScale || 1),
        y: Number(viewport.layoutOffsetY || 0) + Number(gem.y || 0) * Number(viewport.layoutScale || 1),
      })),
    };

    function assertNoOutstandingHit(globals) {
      if (Array.isArray(globals.PendingHeroHits) && globals.PendingHeroHits.length > 0) {
        throw new Error(`outstanding hero hits before arming: ${globals.PendingHeroHits.length}`);
      }
    }
  }, { heroUID, killSlot });
}

async function openManualTargetWindow(page, heroUID, options = {}) {
  const prepared = await prepareManualRedTurn(page, heroUID, options);
  assert(prepared?.ok, `failed to prepare red turn: ${JSON.stringify(prepared)}`);
  assert(prepared.canvas && prepared.gemPoints.length === 3, 'red turn click geometry missing');
  const canvasBox = await page.locator('#view').boundingBox();
  assert(canvasBox, 'canvas #view missing');
  for (const gemPoint of prepared.gemPoints) {
    const point = canvasPoint(canvasBox, prepared.canvas, gemPoint.x, gemPoint.y);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(35);
  }
  await page.waitForFunction(({ heroUID }) => {
    const g = window.__codexGame?.globals;
    return String(g?.PendingSkillID || '') === 'HERO_SINGLE' && Number(g?.PendingActor || 0) === Number(heroUID || 0);
  }, { heroUID }, { timeout: 5000 });
  const trace = await readTrace(page);
  assert.equal(trace.pendingActorUID, Number(heroUID || 0), 'red-gem flow armed the wrong hero');
  const geometry = await page.evaluate(() => window.__codexGame.getTargetDebugGeometry());
  assert(geometry?.canvas && geometry?.attackButton, 'target geometry missing');
  return { canvasBox, geometry, trace };
}

async function readTrace(page) {
  return page.evaluate(() => {
    const game = window.__codexGame;
    const g = game.globals;
    return {
      selectedUID: Number(g.SelectedEnemyUID || 0),
      selectedOwnerUID: Number(g.SelectedEnemyUIDOwner || 0),
      pendingActorUID: Number(g.PendingActor || 0),
      pendingSkillID: String(g.PendingSkillID || ''),
      intent: g.PendingManualTargetIntent ? { ...g.PendingManualTargetIntent } : null,
      queuedHits: (g.PendingHeroHits || []).map((hit) => ({
        heroUID: Number(hit?.heroUID || 0),
        targetUID: Number(hit?.targetUID || 0),
        targetTraceSequence: Number(hit?.targetTraceSequence || 0),
      })),
      damageTexts: (g.DamageTexts || []).map((text) => ({
        amount: Number(text?.amount || 0),
        targetUID: Number(text?.targetUID || 0),
        targetSlotIndex: Number(text?.targetSlotIndex ?? -1),
        targetTraceSequence: Number(text?.targetTraceSequence || 0),
        x: Number(text?.x || 0),
        y: Number(text?.y || 0),
      })),
      hitFlashUIDs: Object.keys(g.HitFlashByUID || {}).map(Number),
      enemyIDs: Array.isArray(g.EnemyIDs) ? [...g.EnemyIDs] : [],
      enemySlots: Array.isArray(g.EnemySlots) ? [...g.EnemySlots] : [],
      enemies: game.state.entities
        .filter((entry) => entry?.kind === 'enemy')
        .map((enemy) => ({
          uid: Number(enemy.uid || 0),
          name: String(enemy.name || ''),
          slotIndex: Number(enemy.slotIndex ?? -1),
          hp: Number(enemy.hp ?? 0),
          maxHP: Number(enemy.maxHP ?? 0),
          x: Number(enemy.x || 0),
          y: Number(enemy.y || 0),
        }))
        .sort((left, right) => left.slotIndex - right.slotIndex),
    };
  });
}

async function readBarPixels(page, geometry) {
  return page.evaluate(({ enemies, enemySize }) => {
    const canvas = document.getElementById('view');
    const ctx = canvas?.getContext('2d');
    const viewport = window.__orkaAppViewport || { dpr: 1, layoutScale: 1 };
    if (!canvas || !ctx) return {};
    const dpr = Math.max(1, Number(viewport.dpr || 1));
    const enemyH = Math.max(1, Number(enemySize || 40) * Number(viewport.layoutScale || 1));
    const result = {};
    for (const enemy of enemies) {
      const centerX = Number(enemy.x || 0);
      const centerY = Number(enemy.y || 0) - (enemyH / 2) - (10 * Number(viewport.layoutScale || 1));
      const logicalW = Math.max(28, enemyH * 0.9);
      const logicalH = 8;
      const x = Math.max(0, Math.floor((centerX - logicalW / 2) * dpr));
      const y = Math.max(0, Math.floor((centerY - logicalH / 2) * dpr));
      const w = Math.max(1, Math.min(canvas.width - x, Math.ceil(logicalW * dpr)));
      const h = Math.max(1, Math.min(canvas.height - y, Math.ceil(logicalH * dpr)));
      const pixels = ctx.getImageData(x, y, w, h).data;
      let hash = 2166136261;
      let opaque = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        hash ^= pixels[index]; hash = Math.imul(hash, 16777619);
        hash ^= pixels[index + 1]; hash = Math.imul(hash, 16777619);
        hash ^= pixels[index + 2]; hash = Math.imul(hash, 16777619);
        if (pixels[index + 3] > 0) opaque += 1;
      }
      result[Number(enemy.uid || 0)] = { hash: hash >>> 0, opaque, x, y, w, h };
    }
    return result;
  }, geometry);
}

async function injectStateDrift(page, kind, intended, trace, heroUID) {
  return page.evaluate(({ kind, intended, trace, heroUID }) => {
    const game = window.__codexGame;
    const g = game.globals;
    const otherEnemy = trace.enemies.find((enemy) => Number(enemy.uid || 0) !== Number(intended.uid || 0) && Number(enemy.hp || 0) > 0);
    const otherHero = game.state.entities.find((entry) => entry?.kind === 'hero' && Number(entry.uid || 0) !== Number(heroUID || 0));
    if (kind === 'selection_changed' && otherEnemy) g.SelectedEnemyUID = Number(otherEnemy.uid || 0);
    if (kind === 'selection_owner_changed' && otherHero) g.SelectedEnemyUIDOwner = Number(otherHero.uid || 0);
    if (kind === 'actor_changed' && otherHero) {
      const index = (g.TurnOrderArray || []).findIndex((slot) => Number(slot?.uid || 0) === Number(otherHero.uid || 0));
      if (index >= 0) g.CurrentTurnIndex = index;
      g.InitiativeCurrentUID = Number(otherHero.uid || 0);
      g.CurrentHeroUID = Number(otherHero.uid || 0);
    }
    if (kind === 'enemy_id_map_changed' && otherEnemy) g.EnemyIDs[Number(intended.slotIndex || 0)] = Number(otherEnemy.uid || 0);
    return true;
  }, { kind, intended, trace, heroUID });
}

async function waitForReplacement(page, slotIndex, oldUID) {
  await page.waitForFunction(({ slotIndex, oldUID }) => {
    const game = window.__codexGame;
    const replacement = game.state.entities.find((entry) => (
      entry?.kind === 'enemy'
      && Number(entry.hp ?? 0) > 0
      && Number(entry.slotIndex ?? -1) === Number(slotIndex)
      && Number(entry.uid || 0) !== Number(oldUID || 0)
    ));
    return !!replacement;
  }, { slotIndex, oldUID }, { timeout: 7000 });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 580, height: 964 }, deviceScaleFactor: 2 });
const pageErrors = [];
const consoleLines = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
page.on('console', (message) => {
  const value = message.text();
  if (/MANUAL_TARGET|TARGET_DAMAGE_JSON|PENDING_ATTACK_RESOLVE/.test(value)) consoleLines.push(value);
});

const rows = [];
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForGame(page);
  const setup = await initializeContinuousScenario(page);
  const slots = [0, 2, 1];
  const delays = [0, 250, 1000];
  const driftKinds = new Map([[2, 'selection_changed'], [8, 'selection_owner_changed'], [14, 'enemy_id_map_changed']]);
  const turnPointerDriftPass = Math.min(5, passCount - 1);
  const killPass = Math.min(6, passCount - 1);

  for (let pass = 0; pass < passCount; pass += 1) {
    const desiredSlot = slots[pass % slots.length];
    const hero = setup.heroes[pass % setup.heroes.length];
    const killsTarget = pass === killPass;
    let targetWindow = await openManualTargetWindow(page, hero.uid, { killSlot: killsTarget ? desiredSlot : -1 });
    let { canvasBox, geometry } = targetWindow;
    const intended = geometry.enemies.find((enemy) => Number(enemy.slotIndex) === desiredSlot);
    assert(intended, `slot ${desiredSlot} has no living enemy on pass ${pass + 1}`);
    const targetPoint = canvasPoint(canvasBox, geometry.canvas, intended.x, intended.y);
    let attackPoint = canvasPoint(
      canvasBox,
      geometry.canvas,
      Number(geometry.attackButton.x || 0) + (Number(geometry.attackButton.w || 0) / 2),
      Number(geometry.attackButton.y || 0) + (Number(geometry.attackButton.h || 0) / 2),
    );
    const beforePixels = await readBarPixels(page, geometry);
    await page.locator('#view').screenshot({ path: path.join(outputDir, `${String(pass + 1).padStart(2, '0')}-before.png`) });
    await page.mouse.click(targetPoint.x, targetPoint.y);
    await page.waitForTimeout(30);
    const selected = await readTrace(page);
    assert.equal(selected.selectedUID, Number(intended.uid), `pass ${pass + 1}: pointer selected wrong UID`);
    assert.equal(selected.intent?.targetUID, Number(intended.uid), `pass ${pass + 1}: captured intent UID drift`);
    assert.equal(selected.intent?.slotIndex, desiredSlot, `pass ${pass + 1}: captured intent slot drift`);
    await page.locator('#view').screenshot({ path: path.join(outputDir, `${String(pass + 1).padStart(2, '0')}-selected.png`) });

    const driftKind = driftKinds.get(pass);
    if (driftKind) {
      await injectStateDrift(page, driftKind, intended, selected, hero.uid);
      await page.mouse.click(attackPoint.x, attackPoint.y);
      await page.waitForTimeout(50);
      const rejected = await readTrace(page);
      assert.equal(rejected.queuedHits.length, 0, `pass ${pass + 1}: ${driftKind} queued a fallback hit`);
      assert.equal(rejected.pendingSkillID, 'HERO_SINGLE', `pass ${pass + 1}: ${driftKind} cleared target UI`);
      targetWindow = await openManualTargetWindow(page, hero.uid, { killSlot: killsTarget ? desiredSlot : -1 });
      canvasBox = targetWindow.canvasBox;
      geometry = targetWindow.geometry;
      const retryTarget = geometry.enemies.find((enemy) => Number(enemy.slotIndex) === desiredSlot);
      assert(retryTarget, `pass ${pass + 1}: target missing after rejected drift`);
      const retryPoint = canvasPoint(canvasBox, geometry.canvas, retryTarget.x, retryTarget.y);
      attackPoint = canvasPoint(
        canvasBox,
        geometry.canvas,
        Number(geometry.attackButton.x || 0) + (Number(geometry.attackButton.w || 0) / 2),
        Number(geometry.attackButton.y || 0) + (Number(geometry.attackButton.h || 0) / 2),
      );
      await page.mouse.click(retryPoint.x, retryPoint.y);
      await page.waitForTimeout(30);
    }

    const turnPointerDrifted = pass === turnPointerDriftPass;
    if (turnPointerDrifted) {
      await injectStateDrift(page, 'actor_changed', intended, await readTrace(page), hero.uid);
    }

    const delay = delays[pass % delays.length];
    if (delay > 0) await page.waitForTimeout(delay);
    const beforeConfirm = await readTrace(page);
    const expectedSequence = Number(beforeConfirm.intent?.sequence || 0);
    const expectedUID = Number(beforeConfirm.intent?.targetUID || 0);
    assert(expectedSequence > 0, `pass ${pass + 1}: missing trace sequence before confirm`);
    assert.equal(expectedUID, Number(intended.uid), `pass ${pass + 1}: retry intent target drift`);
    assert.equal(Number(beforeConfirm.intent?.actorUID || 0), Number(hero.uid), `pass ${pass + 1}: pending actor intent drift`);
    await page.mouse.click(attackPoint.x, attackPoint.y);
    await page.waitForTimeout(35);
    const queued = await readTrace(page);
    const rootHit = queued.queuedHits.find((hit) => hit.targetTraceSequence === expectedSequence);
    if (!rootHit) {
      console.error(JSON.stringify({
        stage: 'missing_root_hit',
        pass: pass + 1,
        hero,
        intended,
        beforeConfirm,
        queued,
        recentTraceLines: consoleLines.slice(-12),
      }, null, 2));
    }
    assert(rootHit, `pass ${pass + 1}: no queued root hit for sequence ${expectedSequence}`);
    assert.equal(rootHit.heroUID, Number(hero.uid), `pass ${pass + 1}: queued actor drift`);
    assert.equal(rootHit.targetUID, expectedUID, `pass ${pass + 1}: queued target drift`);
    await page.evaluate(() => window.advanceTime(1050));
    await page.waitForTimeout(40);
    const impacted = await readTrace(page);
    const damageText = impacted.damageTexts.find((text) => text.targetTraceSequence === expectedSequence);
    assert(damageText, `pass ${pass + 1}: no damage text for sequence ${expectedSequence}`);
    assert.equal(damageText.targetUID, expectedUID, `pass ${pass + 1}: rendered damage-text target drift`);
    assert.equal(damageText.targetSlotIndex, desiredSlot, `pass ${pass + 1}: rendered damage-text slot drift`);
    assert.deepEqual([...impacted.hitFlashUIDs].sort((a, b) => a - b), [expectedUID], `pass ${pass + 1}: hit flash target drift`);
    const beforeEnemyByUID = new Map(beforeConfirm.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => [enemy.uid, enemy]));
    const impactedEnemyByUID = new Map(impacted.enemies.map((enemy) => [enemy.uid, enemy]));
    const beforeTarget = beforeEnemyByUID.get(expectedUID);
    const impactedTarget = impactedEnemyByUID.get(expectedUID);
    assert(beforeTarget, `pass ${pass + 1}: intended UID missing before damage`);
    for (const [uid, beforeEnemy] of beforeEnemyByUID) {
      if (uid === expectedUID) continue;
      const afterEnemy = impactedEnemyByUID.get(uid);
      assert(afterEnemy, `pass ${pass + 1}: non-target UID ${uid} disappeared`);
      assert.equal(afterEnemy.hp, beforeEnemy.hp, `pass ${pass + 1}: non-target UID ${uid} lost HP`);
    }
    if (killsTarget) {
      assert(!impactedTarget || impactedTarget.hp <= 0, `pass ${pass + 1}: intended UID survived lethal hit`);
    } else {
      assert(impactedTarget && impactedTarget.hp < beforeTarget.hp, `pass ${pass + 1}: intended UID did not lose HP`);
    }
    const afterPixels = await readBarPixels(page, geometry);
    if (!killsTarget && beforePixels[expectedUID] && afterPixels[expectedUID]) {
      assert.notEqual(afterPixels[expectedUID].hash, beforePixels[expectedUID].hash, `pass ${pass + 1}: intended HP bar pixels did not change`);
    }
    for (const enemy of beforeConfirm.enemies.filter((entry) => entry.hp > 0 && entry.uid !== expectedUID)) {
      if (!beforePixels[enemy.uid] || !afterPixels[enemy.uid]) continue;
      assert.equal(afterPixels[enemy.uid].hash, beforePixels[enemy.uid].hash, `pass ${pass + 1}: non-target UID ${enemy.uid} HP bar pixels changed`);
    }
    await page.locator('#view').screenshot({ path: path.join(outputDir, `${String(pass + 1).padStart(2, '0')}-impact.png`) });
    if (killsTarget) {
      await waitForReplacement(page, desiredSlot, expectedUID);
      await page.evaluate(() => window.advanceTime(250));
    } else {
      await page.evaluate(() => window.advanceTime(500));
    }
    await page.waitForTimeout(40);
    const settled = await readTrace(page);
    rows.push({
      pass: pass + 1,
      heroUID: hero.uid,
      intendedSlot: desiredSlot,
      intendedUID: expectedUID,
      sequence: expectedSequence,
      delayMs: delay,
      rejectedDrift: driftKind || null,
      turnPointerDrifted,
      killedAndRespawned: killsTarget,
      queuedUID: rootHit.targetUID,
      damageTextUID: damageText.targetUID,
      hitFlashUIDs: impacted.hitFlashUIDs,
      settledSlots: settled.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => ({ uid: enemy.uid, slot: enemy.slotIndex })),
    });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  verdict: pageErrors.length === 0 && rows.length === passCount ? 'PASS' : 'FAIL',
  url,
  passCount: rows.length,
  continuousPageLoads: 1,
  rows,
  traceLines: consoleLines,
  pageErrors,
  screenshots: outputDir,
}, null, 2));
process.exitCode = pageErrors.length === 0 && rows.length === passCount ? 0 : 1;
