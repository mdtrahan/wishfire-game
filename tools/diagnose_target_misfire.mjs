#!/usr/bin/env node
import { chromium } from 'playwright';

const url = process.argv[2]
  || 'http://127.0.0.1:8011/web-runner/index.html?devtest=true&targettrace=true';
const passCount = Math.max(1, Number(process.argv[3] || 6));
const forceMissingPendingActor = process.argv[4] === 'missing-pending-actor';
const compactOutput = process.argv.includes('compact');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForGame(page) {
  await page.waitForFunction(
    () => window.__codexGame && typeof window.render_game_to_text === 'function',
    null,
    { timeout: 30000 },
  );
}

async function resetScenario(page, { missingPendingActor = false } = {}) {
  const result = await page.evaluate(async ({ missingPendingActor }) => {
    const game = window.__codexGame;
    const setup = await game.setupChainStrikeIIScenario();
    if (!setup?.ok) return setup;
    const g = game.globals;
    const heroes = game.state.entities.filter((entity) => entity?.kind === 'hero');
    const enemies = game.state.entities
      .filter((entity) => entity?.kind === 'enemy' && Number(entity.hp || 0) > 0)
      .sort((left, right) => Number(left.slotIndex || 0) - Number(right.slotIndex || 0));
    const hero = heroes.find((entity) => Number(entity.uid || 0) === Number(setup.heroUID || 0)) || heroes[0];
    g.SessionSkillsByHeroUID = {};
    g.PendingHeroHits = [];
    g.ChainStrikeVisuals = [];
    g.DamageTexts = [];
    g.PendingSkillID = 'HERO_SINGLE';
    g.PendingActor = Number(hero.uid || 0);
    g.PendingSuperGemAction = null;
    g.SelectedEnemyUID = 0;
    g.SelectedEnemyUIDOwner = 0;
    g.CanPickGems = 0;
    g.IsPlayerBusy = 1;
    g.TurnPhase = 1;
    g.EnemyLineClearPressureActive = 0;
    g.PendingEnemyRespawnTimerActive = 0;
    g.PendingEnemyRespawnSlots = [0, 0, 0];
    g.HeroAction = null;
    g.EnemyAction = null;
    g.DynamicInitiativeAuthorityEnabled = 0;
    g.DynamicInitiativeAuthority = null;
    g.DynamicInitiative = {
      active: 1,
      current: { uid: Number(hero.uid || 0), type: 0, name: String(hero.name || '') },
      progress: {},
      queue: g.TurnOrderArray.map((slot) => ({ ...slot })),
      openingPolicy: null,
      openingPolicyInitialized: true,
      traces: [],
      actionCount: 0,
      lastTraceText: '',
      sessionId: Number(g.CombatSessionId || g.BattleId || 0),
    };
    g.RuntimeRandom = () => 0;
    if (missingPendingActor) {
      g.PendingActor = 0;
      g.SelectedEnemyUIDOwner = 0;
    }
    for (const enemy of enemies) {
      enemy.maxHP = 1000;
      enemy.hp = 1000;
      enemy.isAlive = true;
      enemy.pendingOfficialDeath = 0;
    }
    game.stepFrames(2);
    return {
      ok: true,
      heroUID: Number(hero.uid || 0),
      enemySize: Number(g.EnemySize || 40),
      enemies: enemies.map((enemy, entityIndex) => ({
        uid: Number(enemy.uid || 0),
        name: String(enemy.name || ''),
        slotIndex: Number(enemy.slotIndex || 0),
        entityIndex,
        x: Number(enemy.x || 0),
        y: Number(enemy.y || 0),
        hp: Number(enemy.hp || 0),
      })),
    };
  }, { missingPendingActor });
  assert(result?.ok, `scenario setup failed: ${JSON.stringify(result)}`);
  return result;
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
      queuedTargets: (g.PendingHeroHits || []).map((hit) => Number(hit?.targetUID || 0)),
      enemies: game.state.entities
        .filter((entity) => entity?.kind === 'enemy')
        .map((enemy, entityIndex) => ({
          uid: Number(enemy.uid || 0),
          name: String(enemy.name || ''),
          slotIndex: Number(enemy.slotIndex || 0),
          entityIndex,
          x: Number(enemy.x || 0),
          y: Number(enemy.y || 0),
          hp: Number(enemy.hp || 0),
        })),
    };
  });
}

function canvasPoint(box, logicalCanvas, logicalX, logicalY) {
  return {
    x: box.x + (logicalX * box.width / logicalCanvas.width),
    y: box.y + (logicalY * box.height / logicalCanvas.height),
  };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
const pageErrors = [];
const consoleLines = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
page.on('console', (message) => {
  const text = message.text();
  if (/TARGET|PENDING_ATTACK_RESOLVE|DMG_AUDIT/.test(text)) {
    consoleLines.push({ type: message.type(), text });
  }
});

const rows = [];
let servedSourceMarker = null;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForGame(page);
  servedSourceMarker = await page.evaluate(async () => {
    const response = await fetch(`/web-runner/src/core/pendingSuperGemHandoff.mjs?target-trace-probe=${Date.now()}`, { cache: 'no-store' });
    const source = await response.text();
    return { status: response.status, bytes: source.length, hasActorRecovery: source.includes('recoverPendingTargetActor') };
  });
  for (let pass = 0; pass < passCount; pass += 1) {
    if (pass > 0) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForGame(page);
    }
    const setup = await resetScenario(page, { missingPendingActor: forceMissingPendingActor });
    const canvasBox = await page.locator('#view').boundingBox();
    assert(canvasBox, 'canvas #view missing');
    const geometry = await page.evaluate(() => window.__codexGame.getTargetDebugGeometry());
    assert(geometry?.canvas && geometry?.attackButton, 'target debug geometry missing');
    const targetIndex = pass % setup.enemies.length;
    const target = setup.enemies[targetIndex];
    const targetGeometry = geometry.enemies.find((enemy) => Number(enemy.uid || 0) === target.uid);
    assert(targetGeometry, `target geometry missing for UID ${target.uid}`);
    const offsets = [0, -0.3, 0.3, -0.75];
    const offset = offsets[Math.floor(pass / setup.enemies.length) % offsets.length];
    const targetPoint = canvasPoint(
      canvasBox,
      geometry.canvas,
      targetGeometry.x,
      targetGeometry.y + (offset * setup.enemySize),
    );
    await page.mouse.click(targetPoint.x, targetPoint.y);
    await page.waitForTimeout(20);
    const afterSelection = await readTrace(page);
    const selectionDelayMs = [0, 250, 1000][pass % 3];
    if (selectionDelayMs > 0) await page.waitForTimeout(selectionDelayMs);
    const attackPoint = canvasPoint(
      canvasBox,
      geometry.canvas,
      geometry.attackButton.x + (geometry.attackButton.w / 2),
      geometry.attackButton.y + (geometry.attackButton.h / 2),
    );
    await page.mouse.click(attackPoint.x, attackPoint.y);
    await page.waitForTimeout(20);
    const afterQueue = await readTrace(page);
    await page.evaluate(() => window.advanceTime(1600));
    await page.waitForTimeout(20);
    const afterDamage = await readTrace(page);
    const damagedUIDs = afterDamage.enemies
      .filter((enemy) => Number(enemy.hp || 0) < 1000)
      .map((enemy) => Number(enemy.uid || 0));
    rows.push({
      pass: pass + 1,
      missingPendingActor: forceMissingPendingActor,
      intendedUID: target.uid,
      intendedName: target.name,
      intendedSlot: target.slotIndex,
      clickOffsetEnemyHeights: offset,
      selectionDelayMs,
      click: targetPoint,
      selectedUID: afterSelection.selectedUID,
      selectedOwnerUID: afterSelection.selectedOwnerUID,
      pendingActorUID: afterSelection.pendingActorUID,
      queuedTargets: afterQueue.queuedTargets,
      damagedUIDs,
      hpAfter: afterDamage.enemies.map((enemy) => ({ uid: enemy.uid, hp: enemy.hp })),
      selectionDrift: afterSelection.selectedUID !== target.uid,
      queueDrift: afterQueue.queuedTargets[0] !== target.uid,
      damageDrift: damagedUIDs.length !== 1 || damagedUIDs[0] !== target.uid,
    });
  }
} finally {
  await browser.close();
}

const driftRows = rows.filter((row) => row.selectionDrift || row.queueDrift || row.damageDrift);
const reportRows = compactOutput
  ? rows.map((row) => ({
      pass: row.pass,
      missingPendingActor: row.missingPendingActor,
      intendedUID: row.intendedUID,
      selectedUID: row.selectedUID,
      queuedTargetUID: row.queuedTargets[0] || 0,
      damagedUIDs: row.damagedUIDs,
      clickOffsetEnemyHeights: row.clickOffsetEnemyHeights,
      selectionDelayMs: row.selectionDelayMs,
      drift: row.selectionDrift || row.queueDrift || row.damageDrift,
    }))
  : rows;
console.log(JSON.stringify({
  url,
  passCount: rows.length,
  servedSourceMarker,
  driftCount: driftRows.length,
  rows: reportRows,
  consoleLines,
  pageErrors,
}, null, 2));
process.exitCode = driftRows.length || pageErrors.length ? 1 : 0;
