const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

const HOST = '127.0.0.1';
const PORT = 8000;
const GAME_URL = `http://${HOST}:${PORT}/web-runner/index.html?harness=true&devtest=true`;
const BOARD_ROWS = 4;
const BOARD_COLS = 6;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(port, host = HOST) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function ensureServer() {
  if (await isPortOpen(PORT)) {
    return { child: null, started: false };
  }
  const child = spawn('node', ['tools/serve_web.js', '--host', HOST, '--port', String(PORT)], {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isPortOpen(PORT)) {
      return { child, started: true };
    }
    await delay(250);
  }
  throw new Error('serve_web.js did not start on port 8000');
}

async function enterCombat(page) {
  for (let i = 0; i < 4; i += 1) {
    const layoutId = await page.evaluate(() => window.__codexGame?.globals?.LayoutID || '');
    if (layoutId === 'combat') return;
    await page.mouse.click(150, 150);
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(
    () => {
      try {
        const payload = JSON.parse(window.render_game_to_text());
        return payload.flags && payload.flags.layoutId === 'combat';
      } catch {
        return false;
      }
    },
    { timeout: 5000 }
  );
}

function evaluateIterationScript() {
  return async (skillId) => {
    const api = window.__codexGame;
    const cfg = api.getDevToolingState().config;
    await api.applyDevToolingConfig({
      ...cfg,
      heroSlots: ['Falie', 'Huun', 'Runa', 'Kojonn'],
      enemySlots: ['Djinn', '', ''],
    });
    api.stepFrames(50);
    await api.applyDevToolingConfig({
      ...cfg,
      heroSlots: ['Falie', 'Huun', 'Runa', 'Kojonn'],
      enemySlots: ['Djinn', 'Marid', ''],
    });
    api.stepFrames(100);

    const snapshot = () => {
      const gems = Array.isArray(api.gems) ? api.gems.map((gem) => ({
        uid: Number(gem.uid || 0),
        r: Number(gem.cellR),
        c: Number(gem.cellC),
      })) : [];
      const coords = gems.map((gem) => `${gem.r}:${gem.c}`);
      const uniqueCoords = new Set(coords);
      return {
        gemCount: gems.length,
        uniqueCellCount: uniqueCoords.size,
        fullBoard: gems.length === 24 && uniqueCoords.size === 24,
        inBounds: gems.every((gem) => (
          Number.isInteger(gem.r)
          && Number.isInteger(gem.c)
          && gem.r >= 0
          && gem.r < 4
          && gem.c >= 0
          && gem.c < 6
        )),
        boardFillActive: Number(api.globals.BoardFillActive || 0),
        pressureActive: Number(api.globals.EnemyLineClearPressureActive || 0),
        canPickGems: Number(api.globals.CanPickGems || 0),
      };
    };

    const enemies = api.state.entities.filter((entity) => entity.kind === 'enemy');
    const actorName = skillId === 'Enemy_Scathe' ? 'Djinn' : 'Marid';
    const actor = enemies.find((entity) => entity.name === actorName);
    if (!actor) {
      throw new Error(`missing enemy actor for ${skillId}`);
    }

    const before = snapshot();
    api.callFunction(skillId, actor.uid);
    api.stepFrames(25);
    const after = snapshot();
    return {
      actorName,
      before,
      after,
    };
  };
}

test('live browser runtime keeps Marid/Djinn line clears within valid gem bounds', { timeout: 120000 }, async () => {
  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && !!window.__codexGame, {
      timeout: 60000,
    });
    await enterCombat(page);

    const totals = {
      Enemy_Scathe: { runs: 0, expectedGemCount: BOARD_ROWS * (BOARD_COLS - 1) },
      Enemy_Sweep: { runs: 0, expectedGemCount: BOARD_COLS * (BOARD_ROWS - 1) },
    };

    for (const skillId of ['Enemy_Scathe', 'Enemy_Sweep']) {
      for (let iteration = 0; iteration < 25; iteration += 1) {
        const result = await page.evaluate(evaluateIterationScript(), skillId);
        totals[skillId].runs += 1;
        assert.equal(result.before.fullBoard, true, `${skillId} iteration ${iteration} must start from a full board`);
        assert.equal(result.before.inBounds, true, `${skillId} iteration ${iteration} board must start in bounds`);
        assert.equal(
          result.after.gemCount,
          totals[skillId].expectedGemCount,
          `${skillId} iteration ${iteration} must remove exactly one line of gems`
        );
        assert.equal(
          result.after.uniqueCellCount,
          result.after.gemCount,
          `${skillId} iteration ${iteration} must not duplicate gem cells`
        );
        assert.equal(result.after.inBounds, true, `${skillId} iteration ${iteration} must keep gems in bounds`);
        assert.equal(result.after.pressureActive, 1, `${skillId} iteration ${iteration} must set line-clear pressure`);
      }
    }

    assert.deepEqual(
      totals,
      {
        Enemy_Scathe: { runs: 25, expectedGemCount: 20 },
        Enemy_Sweep: { runs: 25, expectedGemCount: 18 },
      }
    );
  } finally {
    await browser.close();
    if (server.started && server.child && server.child.pid) {
      try {
        process.kill(-server.child.pid, 'SIGTERM');
      } catch {}
    }
  }
});
