#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { classifyPlaywrightFailure, readBool } = require('./playwright_support');

const REPO_ROOT = process.cwd();
const DEFAULTS = Object.freeze({
  sessions: 2000,
  minWaves: 3,
  maxWaves: 7,
  enemiesPerWave: 3,
  startingEnergy: 150,
  energyStopFloor: 0,
  tapCost: 3,
  serverHost: '127.0.0.1',
  serverPort: 8080,
  statePollMs: 75,
  readyTimeoutMs: 12000,
  actionTimeoutMs: 30000,
  outputDir: path.join(REPO_ROOT, 'output', 'balance-harness'),
  viewport: { width: 1200, height: 900 },
  cdpUrl: '',
  closeAttachedBrowser: false,
});

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
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

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
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
  const candidates = [
    process.env.BALANCE_BROWSER_EXECUTABLE,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function readText(input, fallback = '') {
  return typeof input === 'string' && input.trim() ? input.trim() : fallback;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n';
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function summarizePowerAmpTelemetry(events) {
  const summary = {
    total_events: 0,
    by_phase: {},
    hero_actions_with_amp: 0,
    hero_actions_without_amp: 0,
    observed_heroes: [],
  };
  const heroes = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    const phase = String(event?.phase || 'unknown');
    summary.total_events += 1;
    summary.by_phase[phase] = Number(summary.by_phase[phase] || 0) + 1;
    if (event?.heroId) heroes.add(String(event.heroId));
    if (phase === 'action_observed' && String(event?.actorKind || '') === 'hero') {
      if (Number(event?.powerAmpVisible || 0) > 0 || String(event?.powerAmpState || '') === 'active_this_turn') {
        summary.hero_actions_with_amp += 1;
      } else {
        summary.hero_actions_without_amp += 1;
      }
    }
  }
  summary.observed_heroes = Array.from(heroes).sort();
  return summary;
}

function attachConsoleTrail(page) {
  const trail = [];
  page.on('console', (message) => {
    trail.push({
      type: message.type(),
      text: message.text(),
    });
    if (trail.length > 80) trail.splice(0, trail.length - 80);
  });
  page.__balanceConsoleTrail = trail;
}

function getConsoleTrail(page) {
  return Array.isArray(page.__balanceConsoleTrail) ? page.__balanceConsoleTrail : [];
}

async function findOpenPort(start, host) {
  let port = start;
  while (port < start + 100) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, host);
    });
    if (available) return port;
    port += 1;
  }
  throw new Error(`Unable to find open port near ${start}`);
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });
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
  await waitForServer(`${origin}/web-runner/index.html`, config.readyTimeoutMs);
  return { child, origin };
}

async function stopServer(serverHandle) {
  if (!serverHandle || !serverHandle.child || serverHandle.child.killed) return;
  serverHandle.child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => serverHandle.child.once('exit', resolve)),
    sleep(2000),
  ]);
  if (!serverHandle.child.killed) serverHandle.child.kill('SIGKILL');
}

async function waitForGameHooks(page, config) {
  const started = Date.now();
  while (Date.now() - started < config.readyTimeoutMs) {
    const ready = await page.evaluate(() => typeof window.render_game_to_text === 'function');
    if (ready) return;
    await sleep(50);
  }
  throw new Error('render_game_to_text hook did not become available');
}

async function readRuntimeState(page) {
  return await page.evaluate(() => {
    const raw = typeof window.render_game_to_text === 'function' ? window.render_game_to_text() : '{}';
    return JSON.parse(raw);
  });
}

async function clickCanvasWorld(page, x, y) {
  const box = await page.locator('#view').boundingBox();
  if (!box) throw new Error('Canvas bounding box unavailable');
  const screenX = box.x + (Number(x || 0) * (box.width / 360));
  const screenY = box.y + (Number(y || 0) * (box.height / 640));
  await page.mouse.click(screenX, screenY, { delay: 20 });
}

async function maybeResolvePendingHeroAction(page, state, rng) {
  if (Number(state?.turn?.type || 0) !== 0) return false;
  if (!state?.flags?.pendingSkillId) return false;
  const enemies = (state?.enemies || []).filter((enemy) => Number(enemy?.hp || 0) > 0);
  if (!enemies.length) return false;
  const target = enemies[Math.floor(rng() * enemies.length)];
  await clickCanvasWorld(page, Number(target.x || 0), Number(target.y || 0));
  await sleep(120);
  // Verified live against the runtime attack button flow.
  await clickCanvasWorld(page, 180, 190);
  await sleep(400);
  return true;
}

async function maybeClearSelectedGems(page, state) {
  const selected = (state?.gems || []).filter((gem) => gem && gem.selected);
  if (!selected.length || !state?.flags?.canPickGems || state?.flags?.isPlayerBusy) return false;
  for (const gem of selected) {
    await clickCanvasWorld(page, gem.x, gem.y);
    await sleep(40);
  }
  await sleep(120);
  return true;
}

async function enterCombat(page, config) {
  await waitForGameHooks(page, config);
  const started = Date.now();
  const timeoutMs = config.readyTimeoutMs + config.actionTimeoutMs;
  while (Date.now() - started < timeoutMs) {
    const state = await readRuntimeState(page);
    if (
      state.flags?.layoutId === 'combat' &&
      Array.isArray(state.enemies) &&
      state.enemies.length > 0 &&
      (state.flags?.canPickGems || Number(state.resources?.energy || 0) <= 0)
    ) {
      return state;
    }
    if (state.flags?.layoutId !== 'combat') {
      await clickCanvasWorld(page, 180, 320);
    }
    await sleep(150);
  }
  throw new Error('Combat did not become actionable from story screen');
}

function buildCandidateMatches(state) {
  const groups = new Map();
  for (const gem of Array.isArray(state.gems) ? state.gems : []) {
    const color = Number(gem && gem.color);
    if (!Number.isFinite(color) || color < 0 || color > 5) continue;
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color).push(gem);
  }
  return Array.from(groups.entries())
    .filter(([, gems]) => gems.length >= 3)
    .map(([color, gems]) => ({ color, gems }));
}

function pickThree(rng, gems) {
  const pool = [...gems];
  const picked = [];
  while (picked.length < 3 && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

async function waitForCombatReady(page, config, rng) {
  const started = Date.now();
  let latest = null;
  let lastPendingResolveAt = 0;
  let lastSelectionClearAt = 0;
  while (Date.now() - started < config.actionTimeoutMs) {
    const state = await readRuntimeState(page);
    latest = state;
    const energy = Number(state.resources?.energy || 0);
    const canAct = !!state.flags?.canPickGems;
    const isBusy = !!state.flags?.isPlayerBusy;
    const turnPhase = Number(state.flags?.turnPhase || 0);
    const selectedCount = (state.gems || []).filter((gem) => gem && gem.selected).length;
    const livingEnemies = (state.enemies || []).filter((enemy) => Number(enemy?.hp || 0) > 0).length;
    if (energy <= 0) {
      return state;
    }
    if (livingEnemies === 0) {
      await sleep(config.statePollMs);
      continue;
    }
    if (canAct && !isBusy && turnPhase === 0 && selectedCount === 0 && energy > 0 && !state?.flags?.pendingSkillId) {
      return state;
    }
    if (rng && state?.flags?.pendingSkillId && Date.now() - lastPendingResolveAt >= 350) {
      const attemptedPendingResolve = await maybeResolvePendingHeroAction(page, state, rng);
      if (attemptedPendingResolve) {
        lastPendingResolveAt = Date.now();
        await sleep(config.statePollMs);
        continue;
      }
    }
    if (canAct && selectedCount > 0 && Date.now() - lastSelectionClearAt >= 250) {
      const attemptedSelectionClear = await maybeClearSelectedGems(page, state);
      if (attemptedSelectionClear) {
        lastSelectionClearAt = Date.now();
        await sleep(config.statePollMs);
        continue;
      }
    }
    await sleep(config.statePollMs);
  }
  const debugState = latest ? {
    time: Number(latest.time || 0),
    layout: String(latest.flags?.layoutId || ''),
    canPickGems: latest.flags?.canPickGems,
    isPlayerBusy: latest.flags?.isPlayerBusy,
    turnPhase: Number(latest.flags?.turnPhase || 0),
    actionInProgress: latest.flags?.actionInProgress,
    energy: Number(latest.resources?.energy || 0),
    pendingSkillId: latest.flags?.pendingSkillId || null,
    turn: latest.turn ? {
      uid: Number(latest.turn.uid || 0),
      type: Number(latest.turn.type || 0),
      name: String(latest.turn.name || ''),
    } : null,
    enemies: Array.isArray(latest.enemies) ? latest.enemies.map((enemy) => ({
      uid: Number(enemy.uid || 0),
      name: String(enemy.name || ''),
      hp: Number(enemy.hp || 0),
    })) : [],
    selectedGemIds: (latest.gems || []).filter((gem) => gem && gem.selected).map((gem) => Number(gem.uid || 0)),
    consoleTrail: getConsoleTrail(page),
  } : null;
  throw new Error(`Combat did not return to an actionable hero state: ${JSON.stringify(debugState)}`);
}

async function waitForLivingEnemies(page, config) {
  const started = Date.now();
  let latest = null;
  while (Date.now() - started < config.actionTimeoutMs) {
    latest = await readRuntimeState(page);
    const energy = Number(latest.resources?.energy || 0);
    const livingEnemies = (latest.enemies || []).filter((enemy) => Number(enemy?.hp || 0) > 0).length;
    if (energy <= config.energyStopFloor) return latest;
    if (livingEnemies > 0) return latest;
    await sleep(config.statePollMs);
  }
  const debugState = latest ? {
    time: Number(latest.time || 0),
    layout: String(latest.flags?.layoutId || ''),
    energy: Number(latest.resources?.energy || 0),
    turnPhase: Number(latest.flags?.turnPhase || 0),
    actionInProgress: latest.flags?.actionInProgress,
    pendingSkillId: latest.flags?.pendingSkillId || null,
    turn: latest.turn ? {
      uid: Number(latest.turn.uid || 0),
      type: Number(latest.turn.type || 0),
      name: String(latest.turn.name || ''),
    } : null,
    consoleTrail: getConsoleTrail(page),
  } : null;
  throw new Error(`Wave did not repopulate living enemies: ${JSON.stringify(debugState)}`);
}

function diffDefeatedEnemies(before, after) {
  const afterById = new Map((after.enemies || []).map((enemy) => [Number(enemy.uid || 0), enemy]));
  return (before.enemies || []).filter((enemy) => {
    if (!enemy) return false;
    const uid = Number(enemy.uid || 0);
    const beforeHp = Number(enemy.hp || 0);
    const current = afterById.get(uid);
    if (!current) return beforeHp > 0;
    const afterHp = Number(current.hp || 0);
    return beforeHp > 0 && afterHp <= 0;
  });
}

async function resolveMatch(page, config, rng) {
  const state = await waitForCombatReady(page, config, rng);
  const candidates = buildCandidateMatches(state);
  if (!candidates.length) {
    return { state, defeated: [], energyBefore: Number(state.resources?.energy || 0), energyAfter: Number(state.resources?.energy || 0), chosen: null };
  }
  const candidate = candidates[Math.floor(rng() * candidates.length)];
  const gems = pickThree(rng, candidate.gems);
  const energyBefore = Number(state.resources?.energy || 0);
  for (const gem of gems) {
    await clickCanvasWorld(page, gem.x, gem.y);
    await sleep(40);
  }
  const started = Date.now();
  let latest = state;
  while (Date.now() - started < config.actionTimeoutMs) {
    latest = await readRuntimeState(page);
    const energyAfter = Number(latest.resources?.energy || 0);
    const selectedCount = (latest.gems || []).filter((gem) => gem && gem.selected).length;
    const defeated = diffDefeatedEnemies(state, latest);
    const progressed =
      energyAfter !== energyBefore ||
      defeated.length > 0 ||
      (!latest.flags?.canPickGems && selectedCount === 0) ||
      Number(latest.time || 0) !== Number(state.time || 0);
    if (progressed) {
      return {
        state: latest,
        defeated,
        energyBefore,
        energyAfter,
        chosen: { color: candidate.color, gemIds: gems.map((gem) => gem.uid) },
      };
    }
    await sleep(config.statePollMs);
  }
  return {
    state: latest,
    defeated: diffDefeatedEnemies(state, latest),
    energyBefore,
    energyAfter: Number(latest.resources?.energy || 0),
    chosen: { color: candidate.color, gemIds: gems.map((gem) => gem.uid) },
  };
}

async function runSession(page, config, sessionId) {
  const sessionSeed = 0xC0DE0000 + sessionId;
  const rng = mulberry32(sessionSeed);
  await page.goto(`${config.origin}/web-runner/index.html`, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize(config.viewport);
  await page.evaluate(() => {
    try { window.localStorage.clear(); } catch {}
  });
  let state = await enterCombat(page, config);
  let enemiesDefeated = 0;
  const fightRows = [];
  const powerAmpEvents = [];
  const powerAmpEventKeys = new Set();
  const maxEnemyDefeats = config.maxWaves * config.enemiesPerWave;
  let endReason = 'max_waves';

  while (Number(state.resources?.energy || 0) > config.energyStopFloor && enemiesDefeated < maxEnemyDefeats) {
    if ((state.enemies || []).filter((enemy) => Number(enemy?.hp || 0) > 0).length === 0) {
      state = await waitForLivingEnemies(page, config);
      if (Number(state.resources?.energy || 0) <= config.energyStopFloor) {
        endReason = 'energy_depleted';
        break;
      }
    }
    const resolution = await resolveMatch(page, config, rng);
    state = resolution.state;
    if (Array.isArray(state.resources?.powerAmpTelemetry)) {
      for (const event of state.resources.powerAmpTelemetry) {
        const key = JSON.stringify([
          sessionId,
          event?.phase || '',
          Number(event?.uid || 0),
          Number(event?.time || 0),
          Number(event?.turnSerial || 0),
          Number(event?.lifecycle || event?.powerAmpLifecycleId || 0),
          String(event?.skillId || ''),
        ]);
        if (powerAmpEventKeys.has(key)) continue;
        powerAmpEventKeys.add(key);
        powerAmpEvents.push({ session_id: sessionId, ...event });
      }
      if (powerAmpEvents.length > 400) powerAmpEvents.splice(0, powerAmpEvents.length - 400);
    }
    for (const enemy of resolution.defeated) {
      fightRows.push({
        session_id: sessionId,
        enemy_id: Number(enemy.uid || 0),
        enemy_name: String(enemy.name || ''),
        enemy_cp: Number(enemy.combatPower || 0),
        energy_before: resolution.energyBefore,
        energy_after: resolution.energyAfter,
        enemy_defeated: true,
      });
      enemiesDefeated += 1;
      if (enemiesDefeated >= maxEnemyDefeats) break;
    }
    if (Number(state.resources?.energy || 0) <= config.energyStopFloor) {
      endReason = 'energy_depleted';
      break;
    }
    await sleep(config.statePollMs);
  }

  if (enemiesDefeated >= maxEnemyDefeats) {
    endReason = 'max_waves';
  }

  const wavesCompleted = Math.min(config.maxWaves, Math.floor(enemiesDefeated / config.enemiesPerWave));
  return {
    sessionId,
    wavesCompleted,
    enemiesDefeated,
    finalEnergy: Math.max(0, Number(state.resources?.energy || 0)),
    endReason,
    powerAmpSummary: summarizePowerAmpTelemetry(powerAmpEvents),
    powerAmpEvents,
    fightRows,
  };
}

async function acquireBrowserSession(config) {
  const cdpUrl = readText(config.cdpUrl);
  if (cdpUrl) {
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0] || await browser.newContext();
    const page = await context.newPage();
    attachConsoleTrail(page);
    return {
      browser,
      page,
      attached: true,
      closeAttachedBrowser: !!config.closeAttachedBrowser,
      async close() {
        try {
          await page.close({ runBeforeUnload: false });
        } catch {}
        try {
          await browser.close();
        } catch {}
        if (config.closeAttachedBrowser) {
          try {
            await closeAttachedBrowserViaCDP(cdpUrl);
          } catch {}
        }
      },
    };
  }

  const executablePath = detectPreferredBrowserExecutable();
  const browser = await chromium.launch(executablePath
    ? { headless: true, executablePath }
    : { headless: true });
  const page = await browser.newPage();
  attachConsoleTrail(page);
  return {
    browser,
    page,
    attached: false,
    async close() {
      await browser.close();
    },
  };
}

function aggregateSessions(config, sessions) {
  const waveDistribution = {};
  for (let wave = 0; wave <= config.maxWaves; wave++) waveDistribution[wave] = 0;
  for (const result of sessions) {
    const key = String(Math.max(0, Math.min(config.maxWaves, result.wavesCompleted)));
    waveDistribution[key] = (waveDistribution[key] || 0) + 1;
  }
  const counts = sessions.map((row) => row.wavesCompleted);
  const averageWaves = counts.length
    ? counts.reduce((sum, value) => sum + value, 0) / counts.length
    : 0;
  const medianWaves = median(counts);
  const averageEnemiesDefeated = sessions.length
    ? sessions.reduce((sum, row) => sum + row.enemiesDefeated, 0) / sessions.length
    : 0;
  const sessionEndReasons = sessions.reduce((acc, row) => {
    const key = String(row.endReason || 'unknown');
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  const distributionPercent = Object.fromEntries(
    Object.entries(waveDistribution).map(([wave, count]) => [wave, sessions.length ? Number(((count / sessions.length) * 100).toFixed(2)) : 0])
  );

  let recommendedMultiplier = 1.0;
  let reason = 'Average session depth is inside the target range.';
  if (averageWaves > 6) {
    recommendedMultiplier = 1.12;
    reason = `Average session depth is too high (${averageWaves.toFixed(2)} waves). Increase enemy CP globally.`;
  } else if (averageWaves < 4) {
    recommendedMultiplier = 0.88;
    reason = `Average session depth is too low (${averageWaves.toFixed(2)} waves). Decrease enemy CP globally.`;
  }

  return {
    averageWaves: Number(averageWaves.toFixed(2)),
    medianWaves: Number(medianWaves.toFixed(2)),
    averageEnemiesDefeated: Number(averageEnemiesDefeated.toFixed(2)),
    sessionEndReasons,
    waveDistribution,
    waveDistributionPercent: distributionPercent,
    recommendation: {
      recommended_enemy_cp_multiplier: Number(recommendedMultiplier.toFixed(2)),
      reason,
      average_waves: Number(averageWaves.toFixed(2)),
      median_waves: Number(medianWaves.toFixed(2)),
    },
  };
}

function writeOutputs(config, sessions, aggregate) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  const sessionCsvPath = path.join(config.outputDir, 'session_results.csv');
  const waveJsonPath = path.join(config.outputDir, 'wave_distribution.json');
  const recommendationPath = path.join(config.outputDir, 'balance_recommendations.json');
  const reportPath = path.join(config.outputDir, 'balance_report.md');
  const powerAmpPath = path.join(config.outputDir, 'power_amp_trace.json');

  const sessionRows = [
    ['session_id', 'waves_completed', 'enemies_defeated', 'final_energy', 'end_reason'],
    ...sessions.map((result) => [
      result.sessionId,
      result.wavesCompleted,
      result.enemiesDefeated,
      result.finalEnergy,
      result.endReason,
    ]),
  ];
  fs.writeFileSync(sessionCsvPath, toCsv(sessionRows), 'utf8');

  fs.writeFileSync(waveJsonPath, JSON.stringify({
    harness_contract: {
      session_stop_rule: `energy <= ${config.energyStopFloor}`,
      note: 'This stop condition is enforced by the balance harness because the live runtime does not yet hard-stop gameplay on energy depletion.',
    },
    average_waves: aggregate.averageWaves,
    median_waves: aggregate.medianWaves,
    average_enemies_defeated: aggregate.averageEnemiesDefeated,
    session_end_reasons: aggregate.sessionEndReasons,
    distribution_counts: aggregate.waveDistribution,
    distribution_percent: aggregate.waveDistributionPercent,
  }, null, 2) + '\n', 'utf8');

  fs.writeFileSync(recommendationPath, JSON.stringify({
    harness_contract: {
      session_stop_rule: `energy <= ${config.energyStopFloor}`,
      note: 'Recommendation is based on harness-managed energy termination, not a live runtime gameplay lockout.',
    },
    ...aggregate.recommendation,
  }, null, 2) + '\n', 'utf8');

  const distributionLines = Object.entries(aggregate.waveDistributionPercent)
    .map(([wave, percent]) => `${wave} waves: ${percent}%`)
    .join('\n');
  const report = [
    `Simulated Sessions: ${sessions.length}`,
    '',
    `Average Waves Cleared: ${aggregate.averageWaves}`,
    `Median Waves Cleared: ${aggregate.medianWaves}`,
    `Average Enemies Defeated: ${aggregate.averageEnemiesDefeated}`,
    `Session Stop Rule: energy <= ${config.energyStopFloor} (harness-managed)`,
    '',
    'Distribution:',
    distributionLines,
    '',
    'Session End Reasons:',
    Object.entries(aggregate.sessionEndReasons).map(([reason, count]) => `${reason}: ${count}`).join('\n'),
    '',
    'Recommendation:',
    aggregate.recommendation.reason,
    `Recommended Enemy CP Multiplier: ${aggregate.recommendation.recommended_enemy_cp_multiplier}`,
  ].join('\n');
  fs.writeFileSync(reportPath, report + '\n', 'utf8');
  fs.writeFileSync(powerAmpPath, JSON.stringify({
    harness_contract: {
      note: 'Read-only trace of Power Amp lifecycle events captured from render_game_to_text during harness sessions.',
    },
    sessions: sessions.map((result) => ({
      session_id: result.sessionId,
      power_amp_summary: result.powerAmpSummary,
      recent_events: result.powerAmpEvents,
    })),
  }, null, 2) + '\n', 'utf8');

  return {
    sessionCsvPath,
    waveJsonPath,
    recommendationPath,
    reportPath,
    powerAmpPath,
  };
}

function buildConfig(argSource = parseArgs(process.argv.slice(2)), env = process.env) {
  const args = Array.isArray(argSource) ? parseArgs(argSource) : (argSource || {});
  return {
    sessions: clampInt(args.sessions || env.BALANCE_SESSION_COUNT, 1, DEFAULTS.sessions),
    minWaves: DEFAULTS.minWaves,
    maxWaves: clampInt(args.maxWaves || env.BALANCE_MAX_WAVES, DEFAULTS.minWaves, DEFAULTS.maxWaves),
    enemiesPerWave: clampInt(args.enemiesPerWave || env.BALANCE_ENEMIES_PER_WAVE, 1, DEFAULTS.enemiesPerWave),
    startingEnergy: DEFAULTS.startingEnergy,
    energyStopFloor: readNumber(args.energyStopFloor || env.BALANCE_ENERGY_STOP_FLOOR, DEFAULTS.energyStopFloor),
    tapCost: DEFAULTS.tapCost,
    serverHost: env.BALANCE_SERVER_HOST || DEFAULTS.serverHost,
    serverPort: clampInt(args.port || env.BALANCE_SERVER_PORT, 1, DEFAULTS.serverPort),
    statePollMs: clampInt(args.pollMs || env.BALANCE_POLL_MS, 10, DEFAULTS.statePollMs),
    readyTimeoutMs: clampInt(args.readyTimeoutMs || env.BALANCE_READY_TIMEOUT_MS, 1000, DEFAULTS.readyTimeoutMs),
    actionTimeoutMs: clampInt(args.actionTimeoutMs || env.BALANCE_ACTION_TIMEOUT_MS, 1000, DEFAULTS.actionTimeoutMs),
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
  const browserSession = await acquireBrowserSession(config);
  const page = browserSession.page;
  const sessions = [];

  try {
    for (let sessionId = 1; sessionId <= config.sessions; sessionId++) {
      const result = await runSession(page, config, sessionId);
      sessions.push(result);
      if (sessionId % 25 === 0 || sessionId === config.sessions) {
        console.log(`[balance-harness] completed ${sessionId}/${config.sessions} sessions`);
      }
    }
  } finally {
    await browserSession.close();
    await stopServer(serverHandle);
  }

  const aggregate = aggregateSessions(config, sessions);
  const outputs = writeOutputs(config, sessions, aggregate);
  console.log(JSON.stringify({
    sessions: config.sessions,
    average_waves: aggregate.averageWaves,
    median_waves: aggregate.medianWaves,
    recommendation: aggregate.recommendation,
    outputs,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    const failure = classifyPlaywrightFailure(error);
    if (failure.code !== 'unknown_failure') {
      console.error('[balance-harness] diagnostic:', failure);
    }
    console.error('[balance-harness] failed:', error);
    process.exitCode = 1;
  });
} else {
  module.exports = {
    acquireBrowserSession,
    buildConfig,
    closeAttachedBrowserViaCDP,
    parseArgs,
  };
}
