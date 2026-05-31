import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('output/playwright/huun-yellow-supergem');
const url = process.argv[2] || 'http://127.0.0.1:8000/web-runner/index.html?devtest=true&debug_gems=true&gemlog=full';

const scenarios = [
  { label: 'low-01', rollUnit: 0.30, expectedBranch: 'low', expectAllEnemies: false, proof: true },
  { label: 'low-02', rollUnit: 0.30, expectedBranch: 'low', expectAllEnemies: false },
  { label: 'low-03', rollUnit: 0.30, expectedBranch: 'low', expectAllEnemies: false },
  { label: 'high-01', rollUnit: 0.60, expectedBranch: 'high', expectAllEnemies: false, proof: true },
  { label: 'high-02', rollUnit: 0.60, expectedBranch: 'high', expectAllEnemies: false },
  { label: 'high-03', rollUnit: 0.60, expectedBranch: 'high', expectAllEnemies: false },
  { label: 'high-04', rollUnit: 0.60, expectedBranch: 'high', expectAllEnemies: false },
  { label: 'jackpot-01', rollUnit: 0.999, expectedBranch: 'jackpot', expectAllEnemies: true, proof: true },
  { label: 'jackpot-02', rollUnit: 0.999, expectedBranch: 'jackpot', expectAllEnemies: true },
  { label: 'jackpot-03', rollUnit: 0.999, expectedBranch: 'jackpot', expectAllEnemies: true },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForGame(page) {
  await page.waitForFunction(() => window.__codexGame && typeof window.render_game_to_text === 'function', null, { timeout: 30000 });
  await page.waitForFunction(() => {
    try {
      const parsed = JSON.parse(window.render_game_to_text());
      return parsed?.flags?.layout0Ready === true && parsed?.flags?.layoutId === 'combat' && parsed?.gems?.length >= 24;
    } catch {
      return false;
    }
  }, null, { timeout: 30000 });
}

async function setupScenario(page, scenario) {
  return page.evaluate(async ({ rollUnit }) => {
    const game = window.__codexGame;
    const state = game.state;
    const globals = game.globals;
    await game.applyDevToolingConfig({
      heroSlots: ['Falie', 'Huun', 'Runa', 'Kojonn'],
      enemySlots: ['Djinn', 'Marid', 'Ifrit'],
      boardGemColor: 3,
      goldAmount: 15,
      combatSpeed: 1,
    });
    for (let i = 0; i < 10; i += 1) {
      game.stepFrames(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const heroes = state.entities.filter((entity) => entity && entity.kind === 'hero');
    const enemies = state.entities.filter((entity) => entity && entity.kind === 'enemy' && Number(entity.hp || 0) > 0);
    const huun = heroes.find((hero) => String(hero.name || '') === 'Huun');
    const falie = heroes.find((hero) => String(hero.name || '') === 'Falie') || heroes[0];
    if (!huun) throw new Error('Huun not present after dev tooling setup');
    if (!enemies.length) throw new Error('No live enemies after dev tooling setup');
    globals.CurrentHeroUID = huun.uid;
    globals.SelectedEnemyUID = enemies[0].uid;
    globals.GamePhase = 'RUNTIME';
    globals.CanPickGems = true;
    globals.IsPlayerBusy = 0;
    globals.TurnPhase = 0;
    globals.PendingSkillID = '';
    globals.PendingActor = 0;
    globals.PendingSuperGemAction = null;
    globals.DeferAdvance = 0;
    globals.AdvanceAfterAction = 0;
    globals.ActionLockUntil = 0;
    globals.BoardFillActive = 0;
    globals.Player_Energy = 150;
    globals.goldTotal = 15;
    globals.RuntimeRandom = () => rollUnit;
    globals.RoundActive = 0;
    globals.InitiativeCurrentUID = 0;
    globals.TurnOrderArray = [
      { uid: falie.uid, type: 0 },
      { uid: huun.uid, type: 0 },
      ...enemies.map((enemy) => ({ uid: enemy.uid, type: 1 })),
    ];
    globals.CurrentTurnIndex = 0;
    const yellowGems = game.gems.filter((gem) => Number(gem.color ?? gem.elementIndex) === 3);
    if (yellowGems.length < 24) throw new Error(`Expected fully yellow board, got ${yellowGems.length}`);
    game.stepFrames(2);
    return {
      huunUID: huun.uid,
      turnActorUID: falie.uid,
      targetUID: enemies[0].uid,
      enemyUIDs: enemies.map((enemy) => enemy.uid),
      yellowGemCount: yellowGems.length,
      text: JSON.parse(window.render_game_to_text()),
    };
  }, scenario);
}

async function clickYellowSupergem(page) {
  const gem = await page.evaluate(() => {
    const parsed = JSON.parse(window.render_game_to_text());
    return parsed.gems.find((item) => Number(item.color) === 3 && item.r === 0 && item.c === 0)
      || parsed.gems.find((item) => Number(item.color) === 3);
  });
  assert(gem, 'No yellow gem found to click');
  const box = await page.locator('#view').boundingBox();
  assert(box, 'Canvas #view missing');
  const x = box.x + Number(gem.x || 0) * (box.width / 360);
  const y = box.y + Number(gem.y || 0) * (box.height / 640);
  await page.mouse.click(x, y);
  return { gem, x, y };
}

async function readEvidence(page) {
  return page.evaluate(() => {
    const game = window.__codexGame;
    const globals = game.globals;
    const state = game.state;
    const text = JSON.parse(window.render_game_to_text());
    const hits = Array.isArray(globals.PendingHeroHits)
      ? globals.PendingHeroHits.map((hit) => ({
          heroUID: hit.heroUID,
          targetUID: hit.targetUID,
          finalDmg: hit.finalDmg,
          branch: hit.huunGoldstrikeBranch,
          roll: hit.huunGoldstrikeRoll,
          msg: hit.msg,
        }))
      : [];
    return {
      text,
      goldTotal: globals.goldTotal,
      currentHeroUID: globals.CurrentHeroUID,
      lastGoldstrike: globals.LastHuunYellowSuperGemGoldstrike || null,
      lastSpend: globals.LastSuperGemSpend || null,
      pendingHits: hits,
      enemies: state.entities
        .filter((entity) => entity && entity.kind === 'enemy')
        .map((enemy) => ({ uid: enemy.uid, name: enemy.name, hp: enemy.hp, maxHP: enemy.maxHP })),
      storyCard: typeof game.getStoryCardDebugLine === 'function' ? game.getStoryCardDebugLine() : null,
    };
  });
}

async function installProofOverlay(page, scenario, evidence, clickInfo) {
  await page.evaluate(({ scenario, evidence, clickInfo }) => {
    let overlay = document.getElementById('qa-huun-yellow-proof');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'qa-huun-yellow-proof';
      overlay.style.cssText = [
        'position:fixed',
        'left:12px',
        'bottom:12px',
        'z-index:20000',
        'max-width:520px',
        'padding:10px 12px',
        'border:2px solid #111827',
        'background:rgba(255,255,255,0.94)',
        'color:#111827',
        'font:700 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace',
        'box-shadow:0 6px 24px rgba(0,0,0,0.25)',
      ].join(';');
      document.body.appendChild(overlay);
    }
    const gs = evidence.lastGoldstrike || {};
    overlay.textContent = [
      `QA ${scenario.label} PASS`,
      `branch=${gs.branch} roll=${gs.roll} base=${gs.baseDamage} dmg=${gs.finalDmg}`,
      `bank=${gs.bankedGold} yellowBoard=${gs.boardGold} targets=${gs.targetCount}`,
      `currentHeroUID=${evidence.currentHeroUID} goldTotal=${evidence.goldTotal}`,
      `click=(${Math.round(clickInfo.x)},${Math.round(clickInfo.y)})`,
    ].join('\n');
  }, { scenario, evidence, clickInfo });
}

async function runScenario(browser, scenario, index) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 1 });
  const consoleLines = [];
  const pageErrors = [];
  page.on('console', (msg) => consoleLines.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push(String(err?.stack || err?.message || err)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForGame(page);
  const setup = await setupScenario(page, scenario);
  const beforePath = scenario.proof ? path.join(outputDir, `${String(index + 1).padStart(2, '0')}-${scenario.label}-before.png`) : null;
  if (beforePath) await page.screenshot({ path: beforePath, fullPage: true });
  const clickInfo = await clickYellowSupergem(page);
  const immediate = await readEvidence(page);
  await installProofOverlay(page, scenario, immediate, clickInfo);
  if (scenario.proof) {
    await page.screenshot({ path: path.join(outputDir, `${String(index + 1).padStart(2, '0')}-${scenario.label}-after.png`), fullPage: true });
  }
  await page.evaluate(() => window.advanceTime(1400));
  await page.waitForTimeout(150);
  const afterFrames = await readEvidence(page);
  const gs = immediate.lastGoldstrike;
  assert(gs, `${scenario.label}: LastHuunYellowSuperGemGoldstrike missing`);
  assert(gs.branch === scenario.expectedBranch, `${scenario.label}: expected ${scenario.expectedBranch}, got ${gs.branch}`);
  assert(gs.bankedGold === 15, `${scenario.label}: expected banked gold 15, got ${gs.bankedGold}`);
  assert(gs.boardGold === 24, `${scenario.label}: expected 24 consumed yellow gems, got ${gs.boardGold}`);
  assert(gs.baseDamage === 39, `${scenario.label}: expected base damage 39, got ${gs.baseDamage}`);
  const expectedDamage = scenario.expectedBranch === 'low' ? 39 : (scenario.expectedBranch === 'high' ? 117 : 100);
  assert(gs.finalDmg === expectedDamage, `${scenario.label}: expected damage ${expectedDamage}, got ${gs.finalDmg}`);
  assert(gs.targetCount === (scenario.expectAllEnemies ? setup.enemyUIDs.length : 1), `${scenario.label}: wrong target count ${gs.targetCount}`);
  assert(immediate.pendingHits.length === gs.targetCount, `${scenario.label}: pending hit count mismatch`);
  assert(immediate.pendingHits.every((hit) => hit.heroUID === setup.huunUID), `${scenario.label}: a pending hit was not owned by Huun`);
  assert(immediate.pendingHits.every((hit) => hit.branch === scenario.expectedBranch), `${scenario.label}: hit branch mismatch`);
  assert(!consoleLines.some((line) => /found \d+ gold/i.test(line.text)), `${scenario.label}: generic gold log observed`);
  assert(pageErrors.length === 0, `${scenario.label}: page errors observed`);
  await page.close();
  return {
    label: scenario.label,
    pass: true,
    setup,
    immediate,
    afterFrames,
    consoleLines: consoleLines.slice(-25),
    pageErrors,
    proofArtifacts: scenario.proof
      ? [
          `${String(index + 1).padStart(2, '0')}-${scenario.label}-before.png`,
          `${String(index + 1).padStart(2, '0')}-${scenario.label}-after.png`,
        ]
      : [],
  };
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (let i = 0; i < scenarios.length; i += 1) {
    const result = await runScenario(browser, scenarios[i], i);
    results.push(result);
    console.log(`[QA_PASS] ${result.label} branch=${result.immediate.lastGoldstrike.branch} roll=${result.immediate.lastGoldstrike.roll} damage=${result.immediate.lastGoldstrike.finalDmg} targets=${result.immediate.lastGoldstrike.targetCount}`);
  }
} finally {
  await browser.close();
}

const report = {
  url,
  generatedAt: new Date().toISOString(),
  passCount: results.filter((result) => result.pass).length,
  requiredPassCount: 10,
  results,
};
await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`[QA_REPORT] ${path.join(outputDir, 'report.json')}`);
