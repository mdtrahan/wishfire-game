#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { classifyPlaywrightFailure, readBool } = require('./playwright_support');

const REPO_ROOT = process.cwd();
const START_WORLD_POINT = Object.freeze({ x: 184.5, y: 427 });
function sourceFingerprint(root = REPO_ROOT) {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const diff = execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: root });
  const untrackedPaths = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).sort();
  const untracked = untrackedPaths.map(file => {
    const absolute = path.join(root, file);
    const content = fs.lstatSync(absolute).isSymbolicLink() ? Buffer.from(fs.readlinkSync(absolute)) : fs.readFileSync(absolute);
    return { path: file, sha256: createHash('sha256').update(content).digest('hex') };
  });
  return { head, patchSha256: createHash('sha256').update(diff).update(JSON.stringify(untracked)).digest('hex'), untracked };
}
const DEFAULTS = Object.freeze({
  sessions: 12,
  maxWaves: 8,
  maxBossClears: 0,
  maxBossTimeouts: 0,
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
  autoEquip: false,
  captureFrames: false,
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
    cwd: config.serveRoot,
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
    return {
      async createIsolatedPage() {
        const context = await browser.newContext({ viewport: config.viewport });
        return { page: await context.newPage(), close: () => context.close() };
      },
      async close() {
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
  return {
    async createIsolatedPage() {
      const context = await browser.newContext({ viewport: config.viewport });
      return { page: await context.newPage(), close: () => context.close() };
    },
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
    () => typeof window.render_game_to_text === 'function' && typeof window.__codexGame?.setEncounterRequest === 'function' && typeof window.__codexGame?.applyDevToolingConfig === 'function',
    null,
    { timeout: config.readyTimeoutMs },
  );
}

async function readRuntimeState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

function isRealtimeCombatReadyState(state) {
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

async function enterRealtimeCombat(page, config, seed) {
  await waitForGameHooks(page, config);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text())?.flags?.layout0Ready === true, null, { timeout: config.readyTimeoutMs });
  await page.evaluate(({ encounterSeed, heroSlots }) => {
    window.__codexGame.setEncounterRequest({ seed: encounterSeed, maxSlots: 3, policy: 'mixed' });
    window.__codexGame.globals.DevBalanceCapture = true;
    window.__codexGame.globals.BalanceCombatEventSeq = 0;
    window.__codexGame.globals.BalanceCombatEvents = [];
    return window.__codexGame.applyDevToolingConfig({ combatSpeed: 4, ...(heroSlots ? { heroSlots } : {}) });
  }, { encounterSeed: seed, heroSlots: config.heroSlots });
  if (config.heroSlots) {
    const applied = (await readRuntimeState(page)).heroScreen?.activePartySlots;
    if (JSON.stringify(applied) !== JSON.stringify(config.heroSlots)) throw new Error(`Requested hero slots were not applied: ${JSON.stringify(applied)}`);
  }
  await clickCanvasWorld(page, START_WORLD_POINT);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state?.flags?.layoutId === 'combat'
      && state?.quest?.phase === 'combat'
      && state?.heroes?.some((hero) => Number(hero?.hp || 0) > 0)
      && state?.enemies?.some((enemy) => Number(enemy?.hp || 0) > 0);
  }, null, { timeout: config.readyTimeoutMs + config.sessionTimeoutMs });
  const state = await readRuntimeState(page);
  if (!isRealtimeCombatReadyState(state)) throw new Error(`Combat did not reach realtime combat readiness: ${JSON.stringify(state)}`);
  return state;
}

async function readBalanceSnapshot(page, afterEventId = 0) {
  return page.evaluate((seenEventId) => {
    const state = JSON.parse(window.render_game_to_text());
    const globals = window.__codexGame.globals;
    const actors = new Map((window.__codexGame.state.entities || []).map(actor => [Number(actor.uid || 0), actor]));
    return {
      layout: String(state.flags?.layoutId || ''),
      questPhase: String(state.quest?.phase || ''),
      time: Number(state.time || 0),
      continuousProgression: state.continuousProgression ? { ...state.continuousProgression,
        bossSummonRequired: !!globals.ContinuousCombatStage?.bossSummonRequired,
        bossTransitionEndsAtMs: Number(globals.ContinuousCombatStage?.bossTransitionEndsAtMs || 0),
        bossTimeLimitSec: Number(globals.ContinuousCombatStage?.bossTimeLimitSec || 0),
        bossTimerStartedAt: globals.ContinuousCombatStage?.bossTimerStartedAt ?? null,
        bossTimeouts: Number(globals.ContinuousCombatStage?.bossTimeouts || 0),
        lastBossTimeout: globals.ContinuousCombatStage?.lastBossTimeout || null,
        stageTransitions: Number(globals.ContinuousCombatStage?.transitions || 0),
      } : null,
      encounterSummary: state.encounterSummary || null,
      loadouts: state.loadouts || {},
      lampSequence: Number(state.lamp?.sequence || 0),
      lampSeed: Number(globals.Equipment?.lamp?.seed ?? state.lamp?.seed ?? 0),
      lampPendingIds: (state.lamp?.pending || []).map(String),
      heroes: state.heroes.map((hero) => {
        const uid = Number(hero.uid || 0), actor = actors.get(uid);
        return { uid, instanceKey: String(actor?.heroInstanceKey || ''), name: String(hero.name || ''), x: Number(hero.x || 0), y: Number(hero.y || 0),
          footX: Number(actor?.footX ?? hero.x ?? 0), arenaTargetUID: Number(actor?.arenaTargetUID || 0),
          hp: Number(hero.hp || 0), maxHp: Number(hero.maxHp || 0),
          currentLevel: Number(actor?.currentLevel ?? hero.currentLevel ?? 1),
          currentEXP: Number(actor?.currentEXP ?? hero.currentEXP ?? 0),
          combatPower: Number(actor?.combatPower ?? hero.combatPower ?? 0),
          attackType: String(actor?.attackType || hero.attackType || ''),
          stats: { ...(actor?.stats || hero.stats || {}) }, recoveryRevealActive: !!hero.recoveryRevealActive };
      }),
      enemies: state.enemies.map((enemy) => ({ uid: Number(enemy.uid || 0), name: String(enemy.name || ''), slot: Number(enemy.slot || 0), x: Number(enemy.x || 0), y: Number(enemy.y || 0), streamState: String(enemy.streamState || ''), streamEngageX: Number(enemy.streamEngageX || 0), arenaTargetUID: Number(actors.get(Number(enemy.uid || 0))?.arenaTargetUID || 0), arenaInReach: !!actors.get(Number(enemy.uid || 0))?.arenaInReach, hp: Number(enemy.hp || 0), maxHp: Number(enemy.maxHp || 0) })),
      damageEvents: (state.damageEvents || []).map((event) => ({ id: Number(event.id || 0), targetUID: Number(event.targetUID || 0), sourceUID: Number(event.sourceUID || 0), hpBefore: Number(event.hpBefore || 0), hpAfter: Number(event.hpAfter || 0), amount: Number(event.amount || 0) })),
      combatEventSeq: Number(globals.BalanceCombatEventSeq || 0),
      initialRoam: globals.ContinuousCombatInitialRoam ? { ...globals.ContinuousCombatInitialRoam } : null,
      combatEvents: (globals.BalanceCombatEvents || []).filter(event => Number(event.id || 0) > seenEventId).map(event => ({ id: Number(event.id || 0), time: Number(event.time || 0), type: String(event.type || ''), reason: String(event.reason || ''), recoveryIndex: Number(event.recoveryIndex || 0), targetUID: Number(event.targetUID || 0), sourceUID: Number(event.sourceUID || 0), damageType: String(event.damageType || ''), amount: Number(event.amount || 0), hpBefore: Number(event.hpBefore || 0), hpAfter: Number(event.hpAfter || 0), wave: event.wave == null ? null : Number(event.wave), impactGeometry: event.impactGeometry || null })),
      readiness: {
        heroBasics: Object.entries(globals.RealtimeHeroBasicClocks || {}).sort(([a], [b]) => Number(a) - Number(b)).map(([uid, clock]) => [Number(uid), Math.max(0, Number((clock?.basicReadyAt ?? 0) - Number(globals.time || 0)).toFixed(2))]),
        enemies: Object.entries(globals.RealtimeEnemyActionReadyAt || {}).sort(([a], [b]) => Number(a) - Number(b)).map(([uid, readyAt]) => [Number(uid), Math.max(0, Number((readyAt - Number(globals.time || 0)).toFixed(2)))]),
        activeEnemies: Object.entries(globals.RealtimeEnemyActionsByUID || {}).sort(([a], [b]) => Number(a) - Number(b)).map(([uid, action]) => [Number(uid), String(action?.state || '')]),
      },
      nativeBattleEnded: !!globals.NativeBattleEnded,
      pendingRespawns: Array.isArray(globals.PendingEnemyRespawnSlots) ? [...globals.PendingEnemyRespawnSlots] : [],
    };
  }, afterEventId);
}

function progressSignature(snapshot) {
  return JSON.stringify({
    layout: snapshot.layout,
    phase: snapshot.questPhase,
    continuousProgression: snapshot.continuousProgression,
    heroHp: snapshot.heroes.map((hero) => [hero.uid, hero.hp]),
    enemyHp: snapshot.enemies.map((enemy) => [enemy.uid, enemy.hp]),
    enemyStream: snapshot.enemies.map((enemy) => [enemy.uid, enemy.streamState]),
    respawns: snapshot.pendingRespawns,
    readiness: snapshot.readiness,
  });
}

function observedOrdinaryWaveClear(before, after) {
  if (!before || !after || before.bossActive || after.bossActive) return 0;
  if (before.region !== after.region || before.stage !== after.stage) return 0;
  const transitionDelta = Number(after.stageTransitions || 0) - Number(before.stageTransitions || 0);
  if (transitionDelta <= 0) return 0;
  if (transitionDelta !== 1) return null;
  if (after.wave === before.wave + 1) return 1;
  if (before.wave === 4 && after.wave === 1 && after.bossAvailable && !after.bossSummonRequired) return 1;
  if (before.wave !== after.wave) return null;
  return 0;
}

function recoveryProgressionView(progression) {
  if (!progression) return null;
  const bossAvailable = progression.bossAvailable == null ? null : !!progression.bossAvailable;
  const bossSummonRequired = progression.bossSummonRequired == null ? null : !!progression.bossSummonRequired;
  return {
    region: progression.region ?? null,
    stage: progression.stage ?? null,
    wave: progression.wave ?? null,
    clearedPackMask: progression.clearedPackMask ?? null,
    bossReadiness: bossAvailable == null || bossSummonRequired == null ? null : { available: bossAvailable, summonRequired: bossSummonRequired, ready: bossAvailable },
    counters: {
      defeatRecoveries: Number.isSafeInteger(progression.defeatRecoveries) ? progression.defeatRecoveries : null,
      ordinaryWaveClears: Number.isSafeInteger(progression.ordinaryWaveClears) ? progression.ordinaryWaveClears : null,
      stageTransitions: Number.isSafeInteger(progression.stageTransitions) ? progression.stageTransitions : null,
      clearedBosses: Number.isSafeInteger(progression.clearedBosses) ? progression.clearedBosses : null,
    },
  };
}

function recoveryCounterDelta(before, after) {
  const left = recoveryProgressionView(before)?.counters;
  const right = recoveryProgressionView(after)?.counters;
  if (!left || !right || Object.values(left).some(value => value == null) || Object.values(right).some(value => value == null)) return null;
  return Object.fromEntries(Object.keys(left).map((key) => [key, right[key] - left[key]]));
}

function observeRecoveryTransition(before, after) {
  const counterDelta = recoveryCounterDelta(before, after);
  if (!counterDelta || counterDelta.defeatRecoveries <= 0) return null;
  const base = { before: recoveryProgressionView(before), after: recoveryProgressionView(after), counterDelta, recoveryEventId: null, firstEnemyKoAfterRecovery: { status: 'unknown_recovery_event_pending' }, laterOrdinaryWaveClear: { status: 'unknown_future_transition' } };
  if (counterDelta.defeatRecoveries === 1) return { ...base, index: after.defeatRecoveries, transition: 'observed' };
  return { ...base, indices: Array.from({ length: counterDelta.defeatRecoveries }, (_, offset) => before.defeatRecoveries + offset + 1), transition: 'unknown_poll_gap' };
}

function applyPostRecoveryWaveClear(attempts, existingAttemptCount, ordinaryWaveClearDelta, progression) {
  const existingAttempts = attempts.slice(0, existingAttemptCount);
  if (ordinaryWaveClearDelta === 1) {
    for (const attempt of existingAttempts) if (attempt.transition === 'observed' && attempt.laterOrdinaryWaveClear.status === 'unknown_future_transition') {
      attempt.laterOrdinaryWaveClear = { status: 'observed', after: recoveryProgressionView(progression) };
    }
  } else if (ordinaryWaveClearDelta == null || ordinaryWaveClearDelta > 1) {
    for (const attempt of existingAttempts) if (attempt.laterOrdinaryWaveClear.status === 'unknown_future_transition') {
      attempt.laterOrdinaryWaveClear = { status: 'unknown_poll_gap', observedDelta: ordinaryWaveClearDelta };
    }
  }
}

async function useAvailableLampEquipment(page, allowCollect) {
  return page.evaluate((collectAllowed) => {
    const visible = button => button && !button.disabled && button.getClientRects().length > 0;
    const overlay = document.querySelector('#lamp-overlay:not([hidden])');
    if (overlay) {
      const equip = overlay.querySelector('button[data-action="auto-equip"]');
      if (visible(equip)) { equip.click(); return 'auto_equip'; }
      const close = overlay.querySelector('button[data-action="close"]');
      if (visible(close)) { close.click(); return 'close'; }
      return null;
    }
    if (!collectAllowed) return null;
    const collect = document.querySelector('#wishfire-lamp button[data-action="collect"]');
    if (visible(collect) && Number(collect.textContent?.trim() || 0) > 0) {
      collect.click();
      return 'collect';
    }
    return null;
  }, allowCollect);
}

async function summonReadyBoss(page) {
  return page.evaluate(() => {
    const button = document.querySelector('#combat-boss-fallback button');
    if (!button || button.disabled || !button.getClientRects().length) return false;
    button.click();
    return true;
  });
}

function equippedSlotCount(loadouts = {}) {
  return Object.values(loadouts).reduce((count, slots) => count + Object.values(slots || {}).filter(Boolean).length, 0);
}

async function loadLampFixture(config) {
  if (config.lampSeed === null && !config.lampFixture) return null;
  const lampModule = pathToFileURL(path.join(config.serveRoot, 'web-runner/src/core/lampGear.mjs')).href;
  const conveyorModule = pathToFileURL(path.join(config.serveRoot, 'web-runner/src/core/lampConveyor.mjs')).href;
  const [{ createLampEconomy }, { validateConveyorState }] = await Promise.all([import(lampModule), import(conveyorModule)]);
  const raw = config.lampFixture
    ? fs.readFileSync(config.lampFixture)
    : Buffer.from(JSON.stringify(createLampEconomy(config.lampSeed)));
  const save = raw.toString('utf8');
  const fixture = JSON.parse(save);
  validateConveyorState(fixture);
  return { save, sha256: createHash('sha256').update(raw).digest('hex'), seed: fixture.lamp.seed };
}

function writeLampFixture(file, save) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, save, 'utf8');
  return { path: file, sha256: createHash('sha256').update(Buffer.from(save, 'utf8')).digest('hex') };
}

function validateHeroFixture(fixture, store) {
  if (!fixture || fixture.version !== 2 || !fixture.heroes || typeof fixture.heroes !== 'object' || Array.isArray(fixture.heroes)) {
    throw new Error('Hero fixture must be an orka.hero_progress.v2 store');
  }
  const fixtureIds = Object.keys(fixture.heroes).sort();
  if (!fixtureIds.length || fixtureIds.length !== Object.keys(store.heroes).length) throw new Error('Hero fixture has an unexpected hero roster');
  for (const id of fixtureIds) {
    const saved = fixture.heroes[id];
    const restored = store.heroes[id];
    if (!saved || typeof saved !== 'object' || !restored
      || saved.heroInstanceKey !== id || saved.baseHeroName !== restored.baseHeroName || saved.name !== restored.name
      || !Number.isInteger(saved.currentLevel) || saved.currentLevel !== restored.currentLevel
      || !Number.isFinite(saved.hp) || saved.hp < 0 || saved.hp > restored.maxHP || saved.hp !== restored.hp
      || !Number.isFinite(saved.maxHP) || saved.maxHP !== restored.maxHP) {
      throw new Error(`Hero fixture was normalized or invalid for ${id}`);
    }
  }
  return fixtureIds.map((id) => ({ id, name: store.heroes[id].name, currentLevel: store.heroes[id].currentLevel, hp: store.heroes[id].hp, maxHp: store.heroes[id].maxHP }));
}

async function loadHeroFixture(config) {
  if (!config.heroFixture) return null;
  const progressModule = pathToFileURL(path.join(config.serveRoot, 'web-runner/src/core/heroProgression.mjs')).href;
  const { createHeroProgressStore, HERO_PROGRESS_VERSION } = await import(progressModule);
  const raw = fs.readFileSync(config.heroFixture);
  const save = raw.toString('utf8');
  const fixture = JSON.parse(save);
  if (fixture?.version !== HERO_PROGRESS_VERSION) throw new Error('Hero fixture version is unsupported');
  const store = createHeroProgressStore(fixture);
  return { save, sha256: createHash('sha256').update(raw).digest('hex'), heroes: validateHeroFixture(fixture, store) };
}

function writeHeroFixture(file, save) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, save, 'utf8');
  return { path: file, sha256: createHash('sha256').update(Buffer.from(save, 'utf8')).digest('hex') };
}

async function runSession(page, config, sessionId) {
  const seed = config.seedStart + sessionId - 1;
  const lampFixture = await loadLampFixture(config);
  const heroFixture = await loadHeroFixture(config);
  if (lampFixture) {
    await page.addInitScript(({ value }) => {
      if (sessionStorage.getItem('__balanceLampFixture') === '1') return;
      localStorage.setItem('wishfire.equipment-economy.v5', value);
      sessionStorage.setItem('__balanceLampFixture', '1');
    }, { value: lampFixture.save });
  }
  if (heroFixture) {
    await page.addInitScript(({ value }) => {
      if (sessionStorage.getItem('__balanceHeroFixture') === '1') return;
      localStorage.setItem('orka.hero_progress.v2', value);
      sessionStorage.setItem('__balanceHeroFixture', '1');
    }, { value: heroFixture.save });
  }
  await page.goto(`${config.origin}/web-runner/index.html`, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize(config.viewport);
  const combatState = await enterRealtimeCombat(page, config, seed);

  let snapshot = await readBalanceSnapshot(page);
  if (lampFixture && snapshot.lampSeed !== lampFixture.seed) throw new Error('Lamp fixture was not loaded');
  if (heroFixture) {
    const deployedNames = combatState.heroScreen?.activePartySlots?.filter(Boolean);
    if (!deployedNames?.length) throw new Error('Deployed hero slots were unavailable for fixture verification');
    const fixtureById = new Map(heroFixture.heroes.map((hero) => [hero.id, hero]));
    const observed = snapshot.heroes.map((hero) => ({ id: hero.instanceKey, name: hero.name, currentLevel: hero.currentLevel, hp: hero.hp })).sort((a, b) => a.id.localeCompare(b.id));
    const expected = snapshot.heroes.map((hero) => fixtureById.get(hero.instanceKey)).filter(Boolean).map(({ id, name, currentLevel, hp }) => ({ id, name, currentLevel, hp })).sort((a, b) => a.id.localeCompare(b.id));
    if (JSON.stringify(observed) !== JSON.stringify(expected)) {
      const persisted = await page.evaluate(() => {
        const raw = localStorage.getItem('orka.hero_progress.v2');
        const saved = raw ? JSON.parse(raw) : null;
        return { savedLevels: Object.fromEntries(Object.entries(saved?.heroes || {}).map(([id, hero]) => [id, hero.currentLevel])), runtimeLevels: Object.fromEntries(Object.entries(window.__codexGame.globals.HeroProgress?.heroes || {}).map(([id, hero]) => [id, hero.currentLevel])), storageError: String(window.__codexGame.globals.HeroProgressStorageError || '') };
      });
      throw new Error(`Hero fixture was not applied: ${JSON.stringify({ expected, observed, persisted })}`);
    }
  }
  const startSimulationTime = snapshot.time;
  const heroMetrics = snapshot.heroes.map((hero) => ({ uid: hero.uid, instanceKey: hero.instanceKey, name: hero.name, currentLevel: hero.currentLevel, endLevel: hero.currentLevel, startEXP: hero.currentEXP, endEXP: hero.currentEXP, combatPower: hero.combatPower, endCombatPower: hero.combatPower, attackType: hero.attackType, stats: hero.stats, startHp: hero.hp, minSampledHp: hero.hp, minEventHp: hero.hp, endHp: hero.hp, sampledHpLoss: 0, largestSampleWindowHpLoss: 0, sampledRecovery: 0, physicalIncomingDamage: 0, magicIncomingDamage: 0, unknownIncomingDamage: 0, effectiveHealing: 0, healingBySourceUID: {}, healingByReason: {}, firstKoTime: null, lastHp: hero.hp, startMaxHp: hero.maxHp, maxHp: hero.maxHp }));
  const defeatedEnemyUIDs = new Set();
  const heroCasualties = new Map();
  const incomingDamageEvents = [];
  const recoveryRecords = [];
  const recoveryByIndex = new Map();
  const recoveryAttempts = [];
  let lastHeroKo = null;
  let firstOrderedHeroCasualty = null;
  let lastCombatEventId = snapshot.combatEventSeq;
  const startCombatEventId = lastCombatEventId;
  let missingCombatEvents = 0;
  const knownEnemyBySlot = new Map(snapshot.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => [enemy.slot, enemy.uid]));
  let firstKo = null;
  const startOrdinaryWaveClears = Number(snapshot.continuousProgression?.ordinaryWaveClears || 0);
  const exactWaveCounterAvailable = snapshot.continuousProgression?.ordinaryWaveClears != null;
  let previousProgression = snapshot.continuousProgression;
  let observedWaveClears = 0;
  let ambiguousWaveTransitions = 0;
  const startClearedBosses = Number(snapshot.continuousProgression?.clearedBosses || 0);
  const startBossTimeouts = Number(snapshot.continuousProgression?.bossTimeouts || 0);
  const startDefeatRecoveries = Number(snapshot.continuousProgression?.defeatRecoveries || 0);
  const snapshotAtStart = snapshot.continuousProgression;
  const openingRoam = { start: snapshot.initialRoam, release: null };
  const startingEquipment = { slots: equippedSlotCount(snapshot.loadouts), lampSeed: snapshot.lampSeed, lampSequence: snapshot.lampSequence, loadouts: snapshot.loadouts };
  const equipmentActions = { collect: 0, auto_equip: 0, close: 0 };
  const captures = {};
  async function capture(label) {
    if (!config.captureFrames || captures[label]) return;
    if (await page.locator('#lamp-overlay:not([hidden])').count()) return;
    const file = path.join(config.outputDir, `session-${sessionId}-${label}.png`);
    fs.mkdirSync(config.outputDir, { recursive: true });
    await page.screenshot({ path: file });
    captures[label] = file;
  }
  if (config.captureFrames) await sleep(650);
  await capture('combat_start');
  let lastEquipmentCheckAt = 0;
  let lastEquipmentReviewKey = '';
  let lastBossCheckAt = 0;
  let bossSummonClicks = 0;
  let bossActiveTransitions = 0;
  let previousBossActive = !!snapshot.continuousProgression?.bossActive;
  let previousClearedBosses = Number(snapshot.continuousProgression?.clearedBosses || 0);
  let previousBossTimeouts = startBossTimeouts;
  let previousDefeatRecoveries = Number(snapshot.continuousProgression?.defeatRecoveries || 0);
  const bossAttemptRecords = [];
  let activeBossAttempt = null;
  let lowestBossHp = null;
  let highestBossHp = null;
  let completedOrdinaryWaves = 0;
  let completedBosses = 0;
  let firstRecoveryObservedAt = null;
  let deadlockCount = 0;
  let lastSignature = progressSignature(snapshot);
  let lastProgressAt = Date.now();
  const startedAt = Date.now();
  let endReason = 'max_waves';

  while (Date.now() - startedAt < config.sessionTimeoutMs) {
    await sleep(config.statePollMs);
    if (config.autoEquip && Date.now() - lastEquipmentCheckAt >= 1000) {
      lastEquipmentCheckAt = Date.now();
      const pendingKey = snapshot.lampPendingIds.join('|');
      const action = await useAvailableLampEquipment(page, !!pendingKey && pendingKey !== lastEquipmentReviewKey);
      if (action) {
        equipmentActions[action] += 1;
        if (action === 'collect') lastEquipmentReviewKey = pendingKey;
        lastProgressAt = Date.now();
      }
    }
    snapshot = await readBalanceSnapshot(page, lastCombatEventId);
    if (openingRoam.start && !openingRoam.release && !snapshot.initialRoam
      && snapshotAtStart?.defeatRecoveries != null && !snapshot.continuousProgression?.bossActive
      && Number(snapshot.continuousProgression?.defeatRecoveries || 0) === startDefeatRecoveries) {
      const centerX = snapshot.heroes.reduce((sum, hero) => sum + hero.footX, 0) / Math.max(1, snapshot.heroes.length);
      openingRoam.release = {
        time: Number((snapshot.time - startSimulationTime).toFixed(3)),
        centerX,
        distanceWalked: Number(openingRoam.start.direction || 0) * (centerX - Number(openingRoam.start.originX || 0)),
      };
    }
    let ordinaryWaveClearDelta = null;
    if (exactWaveCounterAvailable) {
      completedOrdinaryWaves = Math.max(0, Number(snapshot.continuousProgression?.ordinaryWaveClears || 0) - startOrdinaryWaveClears);
      const beforeClears = previousProgression?.ordinaryWaveClears;
      const afterClears = snapshot.continuousProgression?.ordinaryWaveClears;
      ordinaryWaveClearDelta = Number.isSafeInteger(beforeClears) && Number.isSafeInteger(afterClears) ? afterClears - beforeClears : null;
    } else {
      const clear = observedOrdinaryWaveClear(previousProgression, snapshot.continuousProgression);
      if (clear == null) ambiguousWaveTransitions += 1;
      else observedWaveClears += clear;
      completedOrdinaryWaves = observedWaveClears;
      ordinaryWaveClearDelta = clear;
    }
    const recoveryAttemptsBeforePoll = recoveryAttempts.length;
    const recoveryTransition = observeRecoveryTransition(previousProgression, snapshot.continuousProgression);
    if (recoveryTransition) {
      recoveryTransition.sampledPartyState = {
        source: 'post_recovery_poll',
        observedAt: Number((snapshot.time - startSimulationTime).toFixed(3)),
        lampSequence: snapshot.lampSequence,
        loadouts: structuredClone(snapshot.loadouts),
        heroes: snapshot.heroes.map(hero => ({ instanceKey: hero.instanceKey, name: hero.name, currentLevel: hero.currentLevel, hp: hero.hp, maxHp: hero.maxHp, stats: hero.stats, combatPower: hero.combatPower })),
      };
      recoveryAttempts.push(recoveryTransition);
    }
    applyPostRecoveryWaveClear(recoveryAttempts, recoveryAttemptsBeforePoll, ordinaryWaveClearDelta, snapshot.continuousProgression);
    previousProgression = snapshot.continuousProgression;
    completedBosses = Math.max(0, Number(snapshot.continuousProgression?.clearedBosses || 0) - startClearedBosses);
    const bossActive = !!snapshot.continuousProgression?.bossActive;
    if (bossActive && !previousBossActive) bossActiveTransitions += 1;
    const bossEnemy = snapshot.enemies.find(enemy => enemy.uid === Number(snapshot.continuousProgression?.bossUID || 0));
    if (bossActive && !activeBossAttempt) {
      activeBossAttempt = { startedAt: Number((snapshot.time - startSimulationTime).toFixed(3)), bossUID: bossEnemy?.uid || null, hpAtStart: bossEnemy?.hp ?? null, lowestHp: bossEnemy?.hp ?? null, hpAtEnd: null, endedAt: null, outcome: null, gameTimeLimitSec: Number(snapshot.continuousProgression?.bossTimeLimitSec || 0) || null };
    }
    if (bossActive && activeBossAttempt && bossEnemy) {
      activeBossAttempt.bossUID = bossEnemy.uid;
      if (activeBossAttempt.hpAtStart == null) activeBossAttempt.hpAtStart = bossEnemy.hp;
      activeBossAttempt.lowestHp = activeBossAttempt.lowestHp == null ? bossEnemy.hp : Math.min(activeBossAttempt.lowestHp, bossEnemy.hp);
      activeBossAttempt.hpAtEnd = bossEnemy.hp;
    }
    if (!bossActive && activeBossAttempt) {
      activeBossAttempt.endedAt = Number((snapshot.time - startSimulationTime).toFixed(3));
      const bossTimeout = snapshot.continuousProgression?.lastBossTimeout;
      const timedOut = Number(snapshot.continuousProgression?.bossTimeouts || 0) > previousBossTimeouts;
      if (timedOut && bossTimeout) {
        activeBossAttempt.hpAtEnd = bossTimeout.bossHp;
        activeBossAttempt.bossMaxHp = bossTimeout.bossMaxHp;
        activeBossAttempt.livingHeroesAtEnd = bossTimeout.heroes.filter(hero => hero.hp > 0).length;
        activeBossAttempt.heroHpAtEnd = bossTimeout.heroes;
        activeBossAttempt.gameElapsedSec = bossTimeout.elapsedSec;
        activeBossAttempt.gameTimeLimitSec = bossTimeout.timeLimitSec;
      }
      activeBossAttempt.outcome = Number(snapshot.continuousProgression?.clearedBosses || 0) > previousClearedBosses ? 'clear'
        : timedOut ? 'timeout'
        : Number(snapshot.continuousProgression?.defeatRecoveries || 0) > previousDefeatRecoveries ? 'ko_recovery' : 'other_exit';
      bossAttemptRecords.push(activeBossAttempt);
      activeBossAttempt = null;
    }
    previousBossActive = bossActive;
    previousClearedBosses = Number(snapshot.continuousProgression?.clearedBosses || 0);
    previousBossTimeouts = Number(snapshot.continuousProgression?.bossTimeouts || 0);
    previousDefeatRecoveries = Number(snapshot.continuousProgression?.defeatRecoveries || 0);
    if (completedOrdinaryWaves > 0) await capture('first_wave_clear');
    if (bossActive && Date.now() >= Number(snapshot.continuousProgression?.bossTransitionEndsAtMs || 0) + 100) await capture('boss_active');
    if (bossActive && snapshot.continuousProgression?.bossTimerStartedAt != null
      && snapshot.time - snapshot.continuousProgression.bossTimerStartedAt >= snapshot.continuousProgression.bossTimeLimitSec / 2) await capture('boss_timer_half');
    if (snapshot.heroes.some(hero => hero.hp <= 0)) await capture('visible_hero_ko');
    if (Number(snapshot.continuousProgression?.defeatRecoveries || 0) > startDefeatRecoveries) {
      if (firstRecoveryObservedAt == null) firstRecoveryObservedAt = snapshot.time;
      if (snapshot.heroes.some(hero => hero.recoveryRevealActive)) await capture('recovery_reveal');
      if (snapshot.time >= firstRecoveryObservedAt + 0.5) await capture('post_recovery');
    }
    if (completedBosses > 0) await capture('after_boss_clear');
    if (bossActive) for (const enemy of snapshot.enemies.filter(candidate => candidate.hp > 0)) {
      lowestBossHp = lowestBossHp == null ? enemy.hp : Math.min(lowestBossHp, enemy.hp);
      highestBossHp = highestBossHp == null ? enemy.maxHp : Math.max(highestBossHp, enemy.maxHp);
    }
    if (config.maxBossClears > 0 && snapshot.continuousProgression?.bossAvailable && snapshot.continuousProgression?.bossSummonRequired && Date.now() - lastBossCheckAt >= 1000) {
      lastBossCheckAt = Date.now();
      if (await summonReadyBoss(page)) { bossSummonClicks += 1; lastProgressAt = Date.now(); }
    }
    for (const enemy of snapshot.enemies) {
      const priorUID = knownEnemyBySlot.get(enemy.slot);
      if (priorUID && priorUID !== enemy.uid && !defeatedEnemyUIDs.has(priorUID)) {
        defeatedEnemyUIDs.add(priorUID);
      }
      if (enemy.hp <= 0 && !defeatedEnemyUIDs.has(enemy.uid)) {
        defeatedEnemyUIDs.add(enemy.uid);
      }
      if (enemy.hp > 0) knownEnemyBySlot.set(enemy.slot, enemy.uid);
    }
    for (const hero of snapshot.heroes) {
      const tracked = heroMetrics.find((candidate) => candidate.uid === hero.uid);
      if (tracked) {
        tracked.minSampledHp = Math.min(tracked.minSampledHp, hero.hp);
        tracked.endHp = hero.hp;
        tracked.endLevel = hero.currentLevel;
        tracked.endEXP = hero.currentEXP;
        tracked.endCombatPower = hero.combatPower;
        tracked.sampledHpLoss += Math.max(0, tracked.lastHp - hero.hp);
        tracked.largestSampleWindowHpLoss = Math.max(tracked.largestSampleWindowHpLoss, tracked.lastHp - hero.hp);
        tracked.sampledRecovery += Math.max(0, hero.hp - tracked.lastHp);
        tracked.lastHp = hero.hp;
        tracked.maxHp = hero.maxHp;
      }
      if (hero.hp <= 0 && !heroCasualties.has(hero.uid)) {
        heroCasualties.set(hero.uid, hero.name);
      }
    }
    for (const event of snapshot.combatEvents || []) {
      if (event.id <= lastCombatEventId) continue;
      if (event.id > lastCombatEventId + 1) {
        missingCombatEvents += event.id - lastCombatEventId - 1;
        for (const attempt of recoveryAttempts) if (attempt.recoveryEventId != null && event.id > attempt.recoveryEventId && attempt.firstEnemyKoAfterRecovery.status === 'unknown_future_event') {
          attempt.firstEnemyKoAfterRecovery = { status: 'unknown_event_gap' };
        }
      }
      lastCombatEventId = event.id;
      if (event.type === 'enemy_ko') {
        if (!firstKo) firstKo = { side: 'enemy', uid: event.targetUID, time: Number(Math.max(0, event.time - startSimulationTime).toFixed(3)) };
        defeatedEnemyUIDs.add(event.targetUID);
        for (const attempt of recoveryAttempts) if (attempt.recoveryEventId != null && event.id > attempt.recoveryEventId && attempt.firstEnemyKoAfterRecovery.status === 'unknown_future_event') {
          attempt.firstEnemyKoAfterRecovery = { status: 'observed', eventId: event.id, uid: event.targetUID, time: Number(Math.max(0, event.time - startSimulationTime).toFixed(3)) };
        }
        continue;
      }
      const tracked = heroMetrics.find(hero => hero.uid === event.targetUID);
      if (!tracked) continue;
      if (event.type === 'recovery') {
        let record = recoveryByIndex.get(event.recoveryIndex);
        if (!record) {
          const recoveryTime = Number(Math.max(0, event.time - startSimulationTime).toFixed(3));
          record = { index: event.recoveryIndex, time: recoveryTime, reason: event.reason, precedingKo: lastHeroKo && recoveryTime - lastHeroKo.time <= 0.5 ? lastHeroKo : null, heroes: [] };
          recoveryByIndex.set(event.recoveryIndex, record);
          recoveryRecords.push(record);
        }
        record.heroes.push({ uid: tracked.uid, name: tracked.name, hpBefore: event.hpBefore, hpAfter: event.hpAfter, restoredHp: event.amount });
        const attempt = recoveryAttempts.find((candidate) => candidate.index === event.recoveryIndex && candidate.recoveryEventId == null);
        if (attempt) {
          attempt.recoveryEventId = event.id;
          attempt.firstEnemyKoAfterRecovery = { status: 'unknown_future_event' };
        }
        continue;
      }
      if (!(event.amount > 0)) continue;
      tracked.minEventHp = Math.min(tracked.minEventHp, event.hpAfter);
      if (event.type === 'heal') {
        tracked.effectiveHealing += event.amount;
        const key = String(event.sourceUID || 'unknown');
        tracked.healingBySourceUID[key] = Number(tracked.healingBySourceUID[key] || 0) + event.amount;
        const reason = String(event.reason || 'unspecified');
        tracked.healingByReason[reason] = Number(tracked.healingByReason[reason] || 0) + event.amount;
      } else if (event.type === 'damage') {
        const damageKey = event.damageType === 'physical' ? 'physicalIncomingDamage' : event.damageType === 'magic' ? 'magicIncomingDamage' : 'unknownIncomingDamage';
        tracked[damageKey] += event.amount;
        incomingDamageEvents.push({ time: Number(Math.max(0, event.time - startSimulationTime).toFixed(3)), targetUID: event.targetUID, target: tracked.name, amount: event.amount, hpBefore: event.hpBefore, hpAfter: event.hpAfter, targetHpFraction: Number((event.amount / tracked.maxHp).toFixed(4)), sourceUID: event.sourceUID, damageType: event.damageType, wave: event.wave ?? Number(snapshot.continuousProgression?.wave || 0), impactGeometry: event.impactGeometry });
        if (event.hpAfter <= 0) {
          if (!firstKo) firstKo = { side: 'hero', uid: event.targetUID, time: Number(Math.max(0, event.time - startSimulationTime).toFixed(3)) };
          if (!firstOrderedHeroCasualty) firstOrderedHeroCasualty = tracked.name;
          if (tracked.firstKoTime == null) tracked.firstKoTime = Number(Math.max(0, event.time - startSimulationTime).toFixed(3));
          lastHeroKo = { uid: tracked.uid, name: tracked.name, time: Number(Math.max(0, event.time - startSimulationTime).toFixed(3)) };
          if (!heroCasualties.has(event.targetUID)) heroCasualties.set(event.targetUID, tracked.name);
        }
      }
    }

    if (config.maxBossTimeouts > 0 && Number(snapshot.continuousProgression?.bossTimeouts || 0) - startBossTimeouts >= config.maxBossTimeouts) {
      endReason = 'max_boss_timeouts';
      break;
    }
    if (config.maxBossClears > 0 ? completedBosses >= config.maxBossClears : completedOrdinaryWaves >= config.maxWaves) {
      endReason = config.maxBossClears > 0 ? 'max_bosses' : 'max_waves';
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
      break;
    }
  }

  if (Date.now() - startedAt >= config.sessionTimeoutMs && endReason === 'max_waves'
    && !(config.maxBossClears > 0 ? completedBosses >= config.maxBossClears : completedOrdinaryWaves >= config.maxWaves)) {
    endReason = 'timeout';
  }
  if (endReason === 'deadlock' || endReason === 'timeout') {
    if (config.captureFrames) {
      await page.evaluate(() => {
        const overlay = document.querySelector('#lamp-overlay:not([hidden])');
        overlay?.querySelector('button[data-action="close"]')?.click();
      });
    }
    await capture(`final_${endReason}`);
  }
  if (activeBossAttempt) {
    activeBossAttempt.endedAt = Number((snapshot.time - startSimulationTime).toFixed(3));
    activeBossAttempt.outcome = endReason === 'timeout' ? 'harness_timeout' : endReason;
    bossAttemptRecords.push(activeBossAttempt);
  }
  let savedLampFixture = null;
  if (config.saveLampFixture) {
    const save = await page.evaluate(() => localStorage.getItem('wishfire.equipment-economy.v5'));
    if (!save) throw new Error('Lamp save was unavailable for fixture export');
    savedLampFixture = writeLampFixture(config.saveLampFixture, save);
  }
  let savedHeroFixture = null;
  if (config.saveHeroFixture) {
    const save = await page.evaluate(() => localStorage.getItem('orka.hero_progress.v2'));
    if (!save) throw new Error('Hero progression save was unavailable for fixture export');
    savedHeroFixture = writeHeroFixture(config.saveHeroFixture, save);
  }
  return {
    sessionId,
    seed,
    enemiesDefeated: defeatedEnemyUIDs.size,
    wavesCompleted: completedOrdinaryWaves,
    openingRoam,
    continuousProgressionStart: snapshotAtStart,
    continuousProgressionEnd: snapshot.continuousProgression,
    partyFixture: { requested: config.heroSlots, activeSlots: combatState.heroScreen?.activePartySlots || null, heroProgress: heroFixture ? { source: config.heroFixture, sha256: heroFixture.sha256, expected: heroFixture.heroes, observed: heroMetrics.map(({ instanceKey, name, currentLevel, startHp, startMaxHp, stats, combatPower }) => ({ id: instanceKey, name, currentLevel, hp: startHp, maxHp: startMaxHp, stats, combatPower })) } : null, savedHeroFixture },
    equipment: { scenario: config.autoEquip ? 'collect_auto_equip' : 'observe_only', fixture: lampFixture ? { source: config.lampFixture || 'seeded_new_save', sha256: lampFixture.sha256 } : null, savedFixture: savedLampFixture, start: startingEquipment, end: { slots: equippedSlotCount(snapshot.loadouts), lampSeed: snapshot.lampSeed, lampSequence: snapshot.lampSequence, loadouts: snapshot.loadouts }, actions: equipmentActions },
    captures,
    finalArena: ['deadlock', 'timeout'].includes(endReason) ? { heroes: snapshot.heroes.map(hero => ({ uid: hero.uid, name: hero.name, x: hero.x, y: hero.y, hp: hero.hp, arenaTargetUID: hero.arenaTargetUID })), enemies: snapshot.enemies.map(enemy => ({ uid: enemy.uid, name: enemy.name, x: enemy.x, y: enemy.y, hp: enemy.hp, slot: enemy.slot, streamState: enemy.streamState, streamEngageX: enemy.streamEngageX, arenaTargetUID: enemy.arenaTargetUID, arenaInReach: enemy.arenaInReach })), initialRoam: snapshot.initialRoam, readiness: snapshot.readiness } : null,
    bossAttempts: { summonClicks: bossSummonClicks, activeTransitions: bossActiveTransitions, highestHpObserved: highestBossHp, lowestHpObserved: lowestBossHp, records: bossAttemptRecords, gameTimer: bossAttemptRecords.some(record => record.gameTimeLimitSec > 0) ? { limitSec: bossAttemptRecords.find(record => record.gameTimeLimitSec > 0).gameTimeLimitSec, source: 'runtime' } : 'unavailable' },
    bossesCleared: Number(snapshot.continuousProgression?.clearedBosses || 0) - startClearedBosses,
    bossTimeouts: Number(snapshot.continuousProgression?.bossTimeouts || 0) - startBossTimeouts,
    defeatRecoveries: snapshot.continuousProgression?.defeatRecoveries == null ? null : Number(snapshot.continuousProgression.defeatRecoveries) - startDefeatRecoveries,
    recoveryRecords,
    recoveryAttempts,
    simulationSecondsSurvived: Number(Math.max(0, snapshot.time - startSimulationTime).toFixed(3)),
    firstKoSide: firstKo?.side || (defeatedEnemyUIDs.size || heroCasualties.size ? 'unobserved' : 'none'),
    firstKoTime: firstKo?.time ?? null,
    firstHeroCasualty: firstOrderedHeroCasualty ?? (lastCombatEventId === startCombatEventId ? heroCasualties.values().next().value ?? null : null),
    heroCasualties: [...heroCasualties.values()],
    livingHeroes: snapshot.heroes.filter((hero) => hero.hp > 0).length,
    deadlockCount,
    endReason,
    heroes: heroMetrics.map(({ lastHp, ...hero }) => hero),
    recordedHeroDamageEvents: {
      count: incomingDamageEvents.length,
      maximumAppliedDamage: incomingDamageEvents.reduce((maximum, event) => !maximum || event.amount > maximum.amount ? event : maximum, null),
      impactPositionSamples: incomingDamageEvents.filter((event) => event.impactGeometry).slice(0, 100),
      firstKoImpact: incomingDamageEvents.find((event) => event.hpAfter <= 0 && event.impactGeometry) || null,
      byCombatTier: incomingDamageEvents.reduce((summary, event) => {
        const tier = String(event.impactGeometry?.source?.combatTier || 'unknown');
        const totals = summary[tier] ||= { hits: 0, appliedDamage: 0 };
        totals.hits += 1;
        totals.appliedDamage += event.amount;
        return summary;
      }, {}),
      perHero: Object.fromEntries([...new Set(incomingDamageEvents.map((event) => event.targetUID))].map((targetUID) => {
        const events = incomingDamageEvents.filter((event) => event.targetUID === targetUID);
        return [targetUID, {
          name: events[0]?.target || null,
          count: events.length,
          maximumAppliedDamage: events.reduce((maximum, event) => !maximum || event.amount > maximum.amount ? event : maximum, null),
        }];
      })),
      attributionLimit: 'mechanical damage type is unknown for paths that do not supply it',
    },
    measurementLimits: {
      samplingIntervalMs: config.statePollMs,
      hpChangesAreSampledNetChanges: true,
      waveClearSource: exactWaveCounterAvailable ? 'runtime_counter' : 'observed_stage_transition',
      ambiguousWaveTransitions,
      stageTransitionsObserved: Number(snapshot.continuousProgression?.stageTransitions || 0) - Number(snapshotAtStart?.stageTransitions || 0),
      orderedCombatEventStreamObserved: lastCombatEventId > startCombatEventId,
      damageAndHealingTotals: lastCombatEventId > startCombatEventId ? 'recorded_events' : 'unavailable_without_events',
      missingCombatEvents,
      damageTypeAttribution: 'unknown for damage paths without a mechanical type',
      recoveryHealingAttribution: 'full-party defeat recovery is counted separately from skill healing',
    },
  };
}

function aggregateSessions(config, sessions) {
  const defeats = sessions.map((session) => session.enemiesDefeated);
  const waves = sessions.map((session) => session.wavesCompleted);
  const durations = sessions.map((session) => session.simulationSecondsSurvived);
  const casualtyDistribution = {};
  const firstHeroCasualtyDistribution = {};
  const firstKoSides = {};
  const endReasons = {};
  for (const session of sessions) {
    for (const hero of session.heroCasualties) casualtyDistribution[hero] = Number(casualtyDistribution[hero] || 0) + 1;
    const firstHeroCasualty = session.firstHeroCasualty === undefined ? session.heroCasualties[0] : session.firstHeroCasualty;
    if (firstHeroCasualty) firstHeroCasualtyDistribution[firstHeroCasualty] = Number(firstHeroCasualtyDistribution[firstHeroCasualty] || 0) + 1;
    firstKoSides[session.firstKoSide] = Number(firstKoSides[session.firstKoSide] || 0) + 1;
    endReasons[session.endReason] = Number(endReasons[session.endReason] || 0) + 1;
  }
  return {
    sessionCount: sessions.length,
    seeds: sessions.map((session) => session.seed),
    averageEnemiesDefeated: Number((defeats.reduce((sum, value) => sum + value, 0) / Math.max(1, defeats.length)).toFixed(2)),
    medianEnemiesDefeated: Number(median(defeats).toFixed(2)),
    averageWavesCompleted: Number((waves.reduce((sum, value) => sum + value, 0) / Math.max(1, waves.length)).toFixed(2)),
    medianWavesCompleted: Number(median(waves).toFixed(2)),
    minimumWavesCompleted: waves.length ? Math.min(...waves) : 0,
    totalDefeatRecoveries: sessions.every((session) => session.defeatRecoveries != null) ? sessions.reduce((sum, session) => sum + session.defeatRecoveries, 0) : null,
    totalBossTimeouts: sessions.reduce((sum, session) => sum + Number(session.bossTimeouts || 0), 0),
    medianDefeatRecoveries: sessions.every((session) => session.defeatRecoveries != null) ? Number(median(sessions.map((session) => session.defeatRecoveries)).toFixed(2)) : null,
    minimumEnemiesDefeated: defeats.length ? Math.min(...defeats) : 0,
    averageSimulationSecondsSurvived: Number((durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length)).toFixed(2)),
    medianSimulationSecondsSurvived: Number(median(durations).toFixed(2)),
    partyDefeats: sessions.filter((session) => session.endReason === 'party_defeated').length,
    deadlockCount: sessions.reduce((sum, session) => sum + session.deadlockCount, 0),
    casualtyDistribution,
    firstHeroCasualtyDistribution,
    firstKoSides,
    endReasons,
    acceptance: {
      everySeedCompletesTarget: sessions.length > 0 && sessions.every((session) => config.maxBossClears > 0 ? session.bossesCleared >= config.maxBossClears : session.wavesCompleted >= config.maxWaves),
      everySeedCompletesUninterruptedOrdinaryTarget: Number(config.maxBossClears || 0) === 0 && sessions.length > 0 && sessions.every((session) => session.wavesCompleted >= config.maxWaves && session.defeatRecoveries === 0 && Array.isArray(session.heroCasualties) && session.heroCasualties.length === 0 && session.deadlockCount === 0 && session.measurementLimits?.waveClearSource === 'runtime_counter' && session.measurementLimits?.orderedCombatEventStreamObserved === true && session.measurementLimits?.missingCombatEvents === 0 && session.measurementLimits?.ambiguousWaveTransitions === 0),
      zeroDeadlocks: sessions.every((session) => session.deadlockCount === 0),
    },
    coverage: {
      bossClearObserved: sessions.some((session) => session.bossesCleared > 0),
      defeatRecoveryObserved: sessions.some((session) => session.defeatRecoveries > 0),
      firstHeroCasualtyDistribution,
      separateFixturesRequired: ['boss_trials', 'recovery_trials'],
    },
    bounds: { maxWaves: config.maxWaves, maxBossClears: config.maxBossClears, maxBossTimeouts: config.maxBossTimeouts },
  };
}

function writeOutputs(config, sessions, aggregate) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  const jsonPath = path.join(config.outputDir, 'balance_metrics.json');
  const csvPath = path.join(config.outputDir, 'session_results.csv');
  const run = { source: config.source, harnessSource: config.harnessSource, serveRoot: config.serveRoot, seedStart: config.seedStart, lampSeed: config.lampSeed, lampFixture: config.lampFixture || null, heroFixture: config.heroFixture || null, heroSlots: config.heroSlots, sessions: config.sessions, maxWaves: config.maxWaves, maxBossClears: config.maxBossClears, maxBossTimeouts: config.maxBossTimeouts, autoEquip: config.autoEquip, captureFrames: config.captureFrames, statePollMs: config.statePollMs, sessionTimeoutMs: config.sessionTimeoutMs, deadlockTimeoutMs: config.deadlockTimeoutMs, viewport: config.viewport };
  fs.writeFileSync(jsonPath, `${JSON.stringify({ run, aggregate, sessions }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(csvPath, toCsv([
    ['session_id', 'seed', 'enemies_defeated', 'waves_completed', 'bosses_cleared', 'boss_timeouts', 'defeat_recoveries', 'simulation_seconds_survived', 'first_ko_side', 'first_ko_time', 'first_hero_casualty', 'hero_casualties', 'deadlock_count', 'end_reason', 'continuous_progression_start', 'continuous_progression_end'],
    ...sessions.map((session) => [session.sessionId, session.seed, session.enemiesDefeated, session.wavesCompleted, session.bossesCleared, session.bossTimeouts, session.defeatRecoveries, session.simulationSecondsSurvived, session.firstKoSide, session.firstKoTime, session.firstHeroCasualty ?? '', session.heroCasualties.join('|'), session.deadlockCount, session.endReason, JSON.stringify(session.continuousProgressionStart), JSON.stringify(session.continuousProgressionEnd)]),
  ]), 'utf8');
  return { jsonPath, csvPath };
}

function buildConfig(argSource = parseArgs(process.argv.slice(2)), env = process.env) {
  const args = Array.isArray(argSource) ? parseArgs(argSource) : (argSource || {});
  const sessions = clampInt(args.sessions || env.BALANCE_SESSION_COUNT, 1, DEFAULTS.sessions);
  const lampSeedInput = args.lampSeed ?? env.BALANCE_LAMP_SEED;
  const lampSeed = lampSeedInput == null || lampSeedInput === '' ? null : Number(lampSeedInput);
  if (lampSeed !== null && (!Number.isInteger(lampSeed) || lampSeed < 0 || lampSeed > 0xffffffff)) throw new Error('lampSeed must be a uint32');
  const lampFixture = readText(args.lampFixture ?? env.BALANCE_LAMP_FIXTURE);
  const saveLampFixture = readText(args.saveLampFixture ?? env.BALANCE_SAVE_LAMP_FIXTURE);
  const heroFixture = readText(args.heroFixture ?? env.BALANCE_HERO_FIXTURE);
  const saveHeroFixture = readText(args.saveHeroFixture ?? env.BALANCE_SAVE_HERO_FIXTURE);
  const heroSlotsInput = readText(args.heroSlots ?? env.BALANCE_HERO_SLOTS);
  const heroSlots = heroSlotsInput ? heroSlotsInput.split(',').map(name => name.trim()) : null;
  if (heroSlots && (heroSlots.length !== 4 || !heroSlots.some(Boolean) || new Set(heroSlots.filter(Boolean)).size !== heroSlots.filter(Boolean).length)) throw new Error('heroSlots must list four distinct slots with at least one hero');
  if (lampSeed !== null && lampFixture) throw new Error('Choose lampSeed or lampFixture');
  if (saveLampFixture && sessions !== 1) throw new Error('saveLampFixture requires one session');
  if (saveHeroFixture && sessions !== 1) throw new Error('saveHeroFixture requires one session');
  return {
    sessions,
    maxWaves: clampInt(args.maxWaves || env.BALANCE_MAX_WAVES, 1, DEFAULTS.maxWaves),
    maxBossClears: clampInt(args.maxBossClears ?? env.BALANCE_MAX_BOSS_CLEARS, 0, DEFAULTS.maxBossClears),
    maxBossTimeouts: clampInt(args.maxBossTimeouts ?? env.BALANCE_MAX_BOSS_TIMEOUTS, 0, DEFAULTS.maxBossTimeouts),
    seedStart: clampInt(args.seedStart || env.BALANCE_SEED_START, 1, 0xC0DE0001),
    lampSeed,
    lampFixture: lampFixture ? path.resolve(lampFixture) : '',
    heroFixture: heroFixture ? path.resolve(heroFixture) : '',
    heroSlots,
    saveLampFixture: saveLampFixture ? path.resolve(saveLampFixture) : '',
    saveHeroFixture: saveHeroFixture ? path.resolve(saveHeroFixture) : '',
    serveRoot: path.resolve(args.serveRoot || env.BALANCE_SERVE_ROOT || REPO_ROOT),
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
    autoEquip: readBool(args.autoEquip ?? env.BALANCE_AUTO_EQUIP, DEFAULTS.autoEquip),
    captureFrames: readBool(args.captureFrames ?? env.BALANCE_CAPTURE_FRAMES, DEFAULTS.captureFrames),
  };
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const config = buildConfig(argv, env);
  config.source = sourceFingerprint(config.serveRoot);
  config.harnessSource = sourceFingerprint(REPO_ROOT);
  const serverHandle = await startServer(config);
  config.origin = serverHandle.origin;
  let browserSession = null;
  const sessions = [];
  try {
    browserSession = await acquireBrowserSession(config);
    for (let sessionId = 1; sessionId <= config.sessions; sessionId += 1) {
      const isolated = await browserSession.createIsolatedPage();
      try {
        sessions.push(await runSession(isolated.page, config, sessionId));
      } finally {
        await isolated.close();
      }
      const result = sessions.at(-1);
      console.log(`[balance-harness] completed ${sessionId}/${config.sessions} waves=${result.wavesCompleted} recoveries=${result.defeatRecoveries} firstHero=${result.firstHeroCasualty || 'none'} end=${result.endReason}`);
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
    isRealtimeCombatReadyState,
    loadHeroFixture,
    loadLampFixture,
    applyPostRecoveryWaveClear,
    observeRecoveryTransition,
    parseArgs,
    sourceFingerprint,
    observedOrdinaryWaveClear,
    recoveryProgressionView,
    writeHeroFixture,
    writeLampFixture,
    writeOutputs,
  };
}
