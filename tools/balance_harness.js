#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { classifyPlaywrightFailure, readBool } = require('./playwright_support');

const REPO_ROOT = process.cwd();
const START_WORLD_POINT = Object.freeze({ x: 184.5, y: 427 });
const DEFAULTS = Object.freeze({
  sessions: 12,
  maxWaves: 8,
  enemiesPerWave: 3,
  serverHost: '127.0.0.1',
  serverPort: 8080,
  statePollMs: 40,
  readyTimeoutMs: 15000,
  sessionTimeoutMs: 90000,
  deadlockTimeoutMs: 15000,
  cleanupTimeoutMs: 5000,
  outputDir: path.join(REPO_ROOT, 'output', 'balance-harness'),
  viewport: { width: 360, height: 640 },
  cdpUrl: '',
  closeAttachedBrowser: false,
});

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

function readNumber(input, fallback) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function clampInt(value, min, fallback) {
  const safe = Math.floor(readNumber(value, fallback));
  return safe >= min ? safe : fallback;
}

function readText(input, fallback = '') {
  return typeof input === 'string' && input.trim() ? input.trim() : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function closeAttachedBrowserViaCDP(cdpUrl) {
  const endpoint = readText(cdpUrl);
  if (!endpoint) return;
  const meta = await httpGetJson(`${endpoint.replace(/\/$/, '')}/json/version`);
  const ws = new WebSocket(meta.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.send(JSON.stringify({ id: 1, method: 'Browser.close', params: {} }));
  await sleep(300);
  ws.close();
}

function detectPreferredBrowserExecutable() {
  return [
    process.env.BALANCE_BROWSER_EXECUTABLE,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || null;
}

async function findOpenPort(start, host) {
  for (let port = start; port < start + 100; port += 1) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, host);
    });
    if (available) return port;
  }
  throw new Error(`Unable to find open port near ${start}`);
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode && res.statusCode < 500); });
      req.on('error', () => resolve(false));
    });
    if (ok) return;
    await sleep(100);
  }
  throw new Error(`Server did not respond in time: ${url}`);
}

async function startServer(config) {
  const port = await findOpenPort(config.serverPort, config.serverHost);
  const child = spawn(process.execPath, ['tools/serve_web.js', '--host', config.serverHost, '--port', String(port)], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(String(chunk)));
  child.stderr.on('data', (chunk) => process.stderr.write(String(chunk)));
  const origin = `http://${config.serverHost}:${port}`;
  try {
    await waitForServer(`${origin}/web-runner/index.html`, config.readyTimeoutMs);
  } catch (error) {
    await stopServer({ child }, config.cleanupTimeoutMs);
    throw error;
  }
  return { child, origin };
}

async function stopServer(serverHandle, timeoutMs = DEFAULTS.cleanupTimeoutMs) {
  const child = serverHandle?.child;
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(timeoutMs)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(timeoutMs)]);
  }
}

async function settleWithin(task, timeoutMs) {
  return Promise.race([
    Promise.resolve().then(task).then(() => true, () => false),
    sleep(timeoutMs).then(() => false),
  ]);
}

async function acquireBrowserSession(config) {
  const cdpUrl = readText(config.cdpUrl);
  if (cdpUrl) {
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0] || await browser.newContext();
    const page = await context.newPage();
    return {
      page,
      async close() {
        try { await page.close({ runBeforeUnload: false }); } catch {}
        try { await browser.close(); } catch {}
        if (config.closeAttachedBrowser) {
          try { await closeAttachedBrowserViaCDP(cdpUrl); } catch {}
        }
      },
    };
  }
  const executablePath = detectPreferredBrowserExecutable();
  const browserServer = await chromium.launchServer(executablePath ? { headless: true, executablePath } : { headless: true });
  const browser = await chromium.connect(browserServer.wsEndpoint());
  const page = await browser.newPage({ viewport: config.viewport });
  return {
    page,
    async close() {
      const closed = await settleWithin(() => browserServer.close(), config.cleanupTimeoutMs);
      if (!closed && browserServer.process().exitCode === null) {
        await settleWithin(() => browserServer.kill(), config.cleanupTimeoutMs);
      }
    },
  };
}

async function waitForGameHooks(page, config) {
  await page.waitForFunction(
    () => typeof window.render_game_to_text === 'function' && typeof window.__codexGame?.runDevAutoplayUntilDepleted === 'function',
    null,
    { timeout: config.readyTimeoutMs },
  );
}

async function readRuntimeState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

function isAutoplayReadyState(state) {
  return state?.flags?.layoutId === 'combat'
    && state?.quest?.phase === 'combat'
    && Array.isArray(state?.heroes)
    && state.heroes.some((hero) => Number(hero?.hp || 0) > 0)
    && Array.isArray(state?.enemies)
    && state.enemies.some((enemy) => Number(enemy?.hp || 0) > 0);
}

async function clickCanvasWorld(page, point) {
  const box = await page.locator('#view').boundingBox();
  if (!box) throw new Error('Canvas bounding box unavailable');
  await page.mouse.click(
    box.x + (point.x * (box.width / 360)),
    box.y + (point.y * (box.height / 640)),
    { delay: 20 },
  );
}

async function enterCurrentAutoplayCombat(page, config, seed) {
  await waitForGameHooks(page, config);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text())?.flags?.layout0Ready === true, null, { timeout: config.readyTimeoutMs });
  await page.evaluate((encounterSeed) => {
    window.__codexGame.setEncounterRequest({ seed: encounterSeed, maxSlots: 3, policy: 'mixed' });
    return window.__codexGame.applyDevToolingConfig({ combatSpeed: 4 });
  }, seed);
  await clickCanvasWorld(page, START_WORLD_POINT);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state?.flags?.layoutId === 'combat'
      && state?.quest?.phase === 'combat'
      && state?.heroes?.some((hero) => Number(hero?.hp || 0) > 0)
      && state?.enemies?.some((enemy) => Number(enemy?.hp || 0) > 0);
  }, null, { timeout: config.readyTimeoutMs + config.sessionTimeoutMs });
  const state = await readRuntimeState(page);
  if (!isAutoplayReadyState(state)) throw new Error(`Combat did not reach autoplay readiness: ${JSON.stringify(state)}`);
  await page.evaluate(() => { void window.__codexGame.runDevAutoplayUntilDepleted(); });
  return state;
}

async function readBalanceSnapshot(page) {
  return page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text());
    const globals = window.__codexGame.globals;
    return {
      layout: String(state.flags?.layoutId || ''),
      questPhase: String(state.quest?.phase || ''),
      time: Number(state.time || 0),
      turnSerial: Number(globals.TurnSerial || 0),
      turnUID: Number(state.turn?.uid || 0),
      turnType: Number(state.turn?.type || 0),
      heroes: state.heroes.map((hero) => ({ uid: Number(hero.uid || 0), name: String(hero.name || ''), hp: Number(hero.hp || 0), maxHp: Number(hero.maxHp || 0) })),
      enemies: state.enemies.map((enemy) => ({ uid: Number(enemy.uid || 0), name: String(enemy.name || ''), slot: Number(enemy.slot || 0), hp: Number(enemy.hp || 0), maxHp: Number(enemy.maxHp || 0) })),
      autoplay: state.devTools?.autoplay || {},
      nativeBattleEnded: !!globals.NativeBattleEnded,
      pendingRespawns: Array.isArray(globals.PendingEnemyRespawnSlots) ? [...globals.PendingEnemyRespawnSlots] : [],
      pendingSkillId: String(globals.PendingSkillID || ''),
      busy: Number(globals.IsPlayerBusy || 0),
      actionInProgress: Number(globals.ActionInProgress || 0),
    };
  });
}

function progressSignature(snapshot) {
  return JSON.stringify({
    layout: snapshot.layout,
    phase: snapshot.questPhase,
    turn: snapshot.turnSerial,
    heroHp: snapshot.heroes.map((hero) => [hero.uid, hero.hp]),
    enemyHp: snapshot.enemies.map((enemy) => [enemy.uid, enemy.hp]),
    respawns: snapshot.pendingRespawns,
    skill: snapshot.pendingSkillId,
    busy: snapshot.busy,
    action: snapshot.actionInProgress,
    autoplay: snapshot.autoplay.matchesPlayed,
  });
}

async function runSession(page, config, sessionId) {
  const seed = config.seedStart + sessionId - 1;
  await page.goto(`${config.origin}/web-runner/index.html`, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize(config.viewport);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await enterCurrentAutoplayCombat(page, config, seed);

  let snapshot = await readBalanceSnapshot(page);
  const startTurnSerial = snapshot.turnSerial;
  const initialHeroes = snapshot.heroes.map((hero) => ({ uid: hero.uid, name: hero.name }));
  const defeatedEnemyUIDs = new Set();
  const heroCasualties = new Map();
  const knownEnemyBySlot = new Map(snapshot.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => [enemy.slot, enemy.uid]));
  let firstKo = null;
  let deadlockCount = 0;
  let lastSignature = progressSignature(snapshot);
  let lastProgressAt = Date.now();
  const startedAt = Date.now();
  const defeatLimit = config.maxWaves * config.enemiesPerWave;
  let endReason = 'max_waves';

  while (Date.now() - startedAt < config.sessionTimeoutMs) {
    await sleep(config.statePollMs);
    snapshot = await readBalanceSnapshot(page);
    const koEvents = [];

    for (const enemy of snapshot.enemies) {
      const priorUID = knownEnemyBySlot.get(enemy.slot);
      if (priorUID && priorUID !== enemy.uid && !defeatedEnemyUIDs.has(priorUID)) {
        defeatedEnemyUIDs.add(priorUID);
        koEvents.push({ side: 'enemy', uid: priorUID });
      }
      if (enemy.hp <= 0 && !defeatedEnemyUIDs.has(enemy.uid)) {
        defeatedEnemyUIDs.add(enemy.uid);
        koEvents.push({ side: 'enemy', uid: enemy.uid });
      }
      if (enemy.hp > 0) knownEnemyBySlot.set(enemy.slot, enemy.uid);
    }
    for (const hero of snapshot.heroes) {
      if (hero.hp <= 0 && !heroCasualties.has(hero.uid)) {
        heroCasualties.set(hero.uid, hero.name);
        koEvents.push({ side: 'hero', uid: hero.uid });
      }
    }
    if (!firstKo && koEvents.length) {
      const preferredSide = snapshot.turnType === 0 ? 'enemy' : 'hero';
      const event = koEvents.find((candidate) => candidate.side === preferredSide) || koEvents[0];
      firstKo = { side: event.side, uid: event.uid, turn: snapshot.turnSerial - startTurnSerial, time: Number(snapshot.time.toFixed(3)) };
    }

    if (defeatedEnemyUIDs.size >= defeatLimit) {
      await page.evaluate(() => window.__codexGame.stopDevAutoplay());
      endReason = 'max_waves';
      break;
    }
    const livingHeroes = snapshot.heroes.filter((hero) => hero.hp > 0).length;
    if (!livingHeroes || snapshot.nativeBattleEnded || snapshot.questPhase === 'defeat') {
      endReason = 'party_defeated';
      break;
    }
    const signature = progressSignature(snapshot);
    if (signature !== lastSignature) {
      lastSignature = signature;
      lastProgressAt = Date.now();
    } else if (Date.now() - lastProgressAt >= config.deadlockTimeoutMs) {
      deadlockCount += 1;
      endReason = 'deadlock';
      await page.evaluate(() => window.__codexGame.stopDevAutoplay());
      break;
    }
  }

  if (Date.now() - startedAt >= config.sessionTimeoutMs && endReason === 'max_waves' && defeatedEnemyUIDs.size < defeatLimit) {
    endReason = 'timeout';
    await page.evaluate(() => window.__codexGame.stopDevAutoplay());
  }
  return {
    sessionId,
    seed,
    enemiesDefeated: defeatedEnemyUIDs.size,
    wavesCompleted: Number((defeatedEnemyUIDs.size / config.enemiesPerWave).toFixed(2)),
    turnsSurvived: Math.max(0, snapshot.turnSerial - startTurnSerial),
    firstKoSide: firstKo?.side || 'none',
    firstKoTurn: firstKo?.turn ?? null,
    firstKoTime: firstKo?.time ?? null,
    heroCasualties: [...heroCasualties.values()],
    livingHeroes: snapshot.heroes.filter((hero) => hero.hp > 0).length,
    deadlockCount,
    endReason,
    initialHeroes,
  };
}

function aggregateSessions(config, sessions) {
  const defeats = sessions.map((session) => session.enemiesDefeated);
  const turns = sessions.map((session) => session.turnsSurvived);
  const casualtyDistribution = {};
  const firstHeroCasualtyDistribution = {};
  const firstKoSides = {};
  const endReasons = {};
  for (const session of sessions) {
    for (const hero of session.heroCasualties) casualtyDistribution[hero] = Number(casualtyDistribution[hero] || 0) + 1;
    const firstHeroCasualty = session.heroCasualties[0];
    if (firstHeroCasualty) firstHeroCasualtyDistribution[firstHeroCasualty] = Number(firstHeroCasualtyDistribution[firstHeroCasualty] || 0) + 1;
    firstKoSides[session.firstKoSide] = Number(firstKoSides[session.firstKoSide] || 0) + 1;
    endReasons[session.endReason] = Number(endReasons[session.endReason] || 0) + 1;
  }
  return {
    sessionCount: sessions.length,
    seeds: sessions.map((session) => session.seed),
    averageEnemiesDefeated: Number((defeats.reduce((sum, value) => sum + value, 0) / Math.max(1, defeats.length)).toFixed(2)),
    medianEnemiesDefeated: Number(median(defeats).toFixed(2)),
    minimumEnemiesDefeated: defeats.length ? Math.min(...defeats) : 0,
    averageTurnsSurvived: Number((turns.reduce((sum, value) => sum + value, 0) / Math.max(1, turns.length)).toFixed(2)),
    medianTurnsSurvived: Number(median(turns).toFixed(2)),
    partyDefeats: sessions.filter((session) => session.endReason === 'party_defeated').length,
    deadlockCount: sessions.reduce((sum, session) => sum + session.deadlockCount, 0),
    casualtyDistribution,
    firstHeroCasualtyDistribution,
    firstKoSides,
    endReasons,
    acceptance: {
      everySeedDefeatsOne: sessions.every((session) => session.enemiesDefeated >= 1),
      zeroDeadlocks: sessions.every((session) => session.deadlockCount === 0),
      medianDefeatsMultiple: median(defeats) >= 2,
      somePartyDefeats: sessions.some((session) => session.endReason === 'party_defeated'),
      variedHeroCasualties: Object.keys(firstHeroCasualtyDistribution).length > 1,
    },
    bounds: { maxWaves: config.maxWaves, enemiesPerWave: config.enemiesPerWave },
  };
}

function writeOutputs(config, sessions, aggregate) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  const jsonPath = path.join(config.outputDir, 'balance_metrics.json');
  const csvPath = path.join(config.outputDir, 'session_results.csv');
  fs.writeFileSync(jsonPath, `${JSON.stringify({ aggregate, sessions }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(csvPath, toCsv([
    ['session_id', 'seed', 'enemies_defeated', 'turns_survived', 'first_ko_side', 'first_ko_turn', 'first_ko_time', 'hero_casualties', 'deadlock_count', 'end_reason'],
    ...sessions.map((session) => [session.sessionId, session.seed, session.enemiesDefeated, session.turnsSurvived, session.firstKoSide, session.firstKoTurn, session.firstKoTime, session.heroCasualties.join('|'), session.deadlockCount, session.endReason]),
  ]), 'utf8');
  return { jsonPath, csvPath };
}

function buildConfig(argSource = parseArgs(process.argv.slice(2)), env = process.env) {
  const args = Array.isArray(argSource) ? parseArgs(argSource) : (argSource || {});
  return {
    sessions: clampInt(args.sessions || env.BALANCE_SESSION_COUNT, 1, DEFAULTS.sessions),
    maxWaves: clampInt(args.maxWaves || env.BALANCE_MAX_WAVES, 1, DEFAULTS.maxWaves),
    enemiesPerWave: clampInt(args.enemiesPerWave || env.BALANCE_ENEMIES_PER_WAVE, 1, DEFAULTS.enemiesPerWave),
    seedStart: clampInt(args.seedStart || env.BALANCE_SEED_START, 1, 0xC0DE0001),
    serverHost: env.BALANCE_SERVER_HOST || DEFAULTS.serverHost,
    serverPort: clampInt(args.port || env.BALANCE_SERVER_PORT, 1, DEFAULTS.serverPort),
    statePollMs: clampInt(args.pollMs || env.BALANCE_POLL_MS, 10, DEFAULTS.statePollMs),
    readyTimeoutMs: clampInt(args.readyTimeoutMs || env.BALANCE_READY_TIMEOUT_MS, 1000, DEFAULTS.readyTimeoutMs),
    sessionTimeoutMs: clampInt(args.sessionTimeoutMs || env.BALANCE_SESSION_TIMEOUT_MS, 1000, DEFAULTS.sessionTimeoutMs),
    deadlockTimeoutMs: clampInt(args.deadlockTimeoutMs || env.BALANCE_DEADLOCK_TIMEOUT_MS, 1000, DEFAULTS.deadlockTimeoutMs),
    cleanupTimeoutMs: clampInt(args.cleanupTimeoutMs || env.BALANCE_CLEANUP_TIMEOUT_MS, 1000, DEFAULTS.cleanupTimeoutMs),
    outputDir: path.resolve(args.outputDir || env.BALANCE_OUTPUT_DIR || DEFAULTS.outputDir),
    viewport: DEFAULTS.viewport,
    cdpUrl: readText(args.cdpUrl || env.BALANCE_CDP_URL || DEFAULTS.cdpUrl),
    closeAttachedBrowser: readBool(args.closeAttachedBrowser ?? env.BALANCE_CLOSE_ATTACHED_BROWSER, DEFAULTS.closeAttachedBrowser),
  };
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const config = buildConfig(argv, env);
  const serverHandle = await startServer(config);
  config.origin = serverHandle.origin;
  let browserSession = null;
  const sessions = [];
  try {
    browserSession = await acquireBrowserSession(config);
    for (let sessionId = 1; sessionId <= config.sessions; sessionId += 1) {
      sessions.push(await runSession(browserSession.page, config, sessionId));
      console.log(`[balance-harness] completed ${sessionId}/${config.sessions}`);
    }
    const aggregate = aggregateSessions(config, sessions);
    const outputs = writeOutputs(config, sessions, aggregate);
    console.log(JSON.stringify({ aggregate, outputs }, null, 2));
  } finally {
    if (browserSession) await browserSession.close();
    await stopServer(serverHandle, config.cleanupTimeoutMs);
  }
}

if (require.main === module) {
  main().catch((error) => {
    const failure = classifyPlaywrightFailure(error);
    if (failure.code !== 'unknown_failure') console.error('[balance-harness] diagnostic:', failure);
    console.error('[balance-harness] failed:', error);
    process.exitCode = 1;
  });
} else {
  module.exports = {
    START_WORLD_POINT,
    aggregateSessions,
    acquireBrowserSession,
    buildConfig,
    closeAttachedBrowserViaCDP,
    isAutoplayReadyState,
    parseArgs,
  };
}
