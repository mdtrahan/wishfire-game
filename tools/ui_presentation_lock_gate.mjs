#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fsPromises from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { classifyPlaywrightFailure, detectChromeExecutable } = require('./playwright_support.js');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewports = [
  { name: 'compact', width: 216, height: 384, dpr: 1 },
  { name: 'reference', width: 360, height: 640, dpr: 1 },
  { name: 'natural-preview', width: 316, height: 452, dpr: 1 },
  { name: 'live-narrow', width: 233, height: 452, dpr: 1 },
  { name: 'compact-retina', width: 216, height: 384, dpr: 2 },
];
const focusedContracts = [
  'tests/uiPresentationLockGateContract.test.js',
  'tests/compactViewportContainmentContract.test.js',
  'tests/devToolingModalContract.test.js',
  'tests/legacyCombatBackdropContract.test.js',
];
const APPROVED = Object.freeze({
  logical: { width: 360, height: 640 },
  text: { normalizedPx: 18, tolerancePx: 0.5 },
  launchers: {
    dev: { width: 31.36, height: 18 },
    dev2: { width: 36.7, height: 18 },
    tolerancePx: 0.8,
  },
  panels: { gutterPx: 32, widthTolerancePx: 1.5, actionHeightPx: 28, actionTolerancePx: 0.5 },
  combat: {
    heroSelectorWidthRatio: 0.07314,
    heroPulseTolerance: 0.004,
    targetSelectorWidthRatio: 0.07217,
    attackWidthRatio: 0.13713,
    controlTolerance: 0.002,
    progressHeightPx: 8,
    progressTolerancePx: 0.5,
    skillCard: { width: 96.8, height: 179.2, strokeSafeInsetPx: 2, tolerancePx: 0.5 },
    skillTitlePx: 30,
    skillTitleTolerancePx: 0.5,
  },
});
const proveRejection = process.argv.includes('--prove-rejection');

function invariant(name, pass, measured, allowed) {
  return { name, pass: Boolean(pass), measured, allowed };
}

function between(value, minimum, maximum) {
  return Number.isFinite(Number(value)) && Number(value) >= minimum && Number(value) <= maximum;
}

function within(value, expected, tolerance) {
  return Number.isFinite(Number(value)) && Math.abs(Number(value) - expected) <= tolerance;
}

function computeContainedStage(viewport) {
  const { width: layoutW, height: layoutH } = APPROVED.logical;
  const ratio = layoutW / layoutH;
  let width = Math.min(viewport.width, viewport.height * ratio);
  let height = width / ratio;
  if (height > viewport.height) {
    height = viewport.height;
    width = height * ratio;
  }
  return { width: Math.floor(width), height: Math.floor(height) };
}

function parseFontPx(font) {
  const match = String(font || '').match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|$)/);
  return match ? Number(match[1]) : 0;
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function waitForHttp(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
          resolve();
          return;
        }
        retry(new Error(`HTTP ${response.statusCode || 0}`));
      });
      request.on('error', retry);
      request.setTimeout(1000, () => request.destroy(new Error('request timeout')));
    };
    const retry = (error) => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`UI lock server failed to start: ${error.message}`));
        return;
      }
      setTimeout(tryRequest, 150);
    };
    tryRequest();
  });
}

function runFocusedContracts() {
  const result = spawnSync(process.execPath, ['--test', ...focusedContracts], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Focused UI contracts failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function installCanvasTrace(page) {
  await page.addInitScript(() => {
    const calls = [];
    const maxCalls = 12000;
    const record = (entry) => {
      calls.push({ at: performance.now(), ...entry });
      if (calls.length > maxCalls) calls.splice(0, calls.length - maxCalls);
    };
    const describeSource = (source) => String(
      source?.currentSrc || source?.src || source?.id || source?.tagName || '',
    );
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;
    const originalRoundRect = CanvasRenderingContext2D.prototype.roundRect;

    CanvasRenderingContext2D.prototype.drawImage = function drawImage(...args) {
      const hasSourceCrop = args.length >= 9;
      const offset = hasSourceCrop ? 5 : 1;
      record({
        kind: 'drawImage',
        canvasId: String(this.canvas?.id || ''),
        source: describeSource(args[0]),
        x: Number(args[offset] || 0),
        y: Number(args[offset + 1] || 0),
        w: Number(args[offset + 2] ?? args[0]?.width ?? 0),
        h: Number(args[offset + 3] ?? args[0]?.height ?? 0),
      });
      return originalDrawImage.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.fillText = function fillText(text, x, y, maxWidth) {
      const transform = this.getTransform();
      record({
        kind: 'fillText',
        canvasId: String(this.canvas?.id || ''),
        text: String(text ?? ''),
        font: String(this.font || ''),
        x: Number(x || 0),
        y: Number(y || 0),
        maxWidth: maxWidth == null ? null : Number(maxWidth),
        transformA: Number(transform.a || 1),
        transformD: Number(transform.d || 1),
      });
      return originalFillText.call(this, text, x, y, maxWidth);
    };
    CanvasRenderingContext2D.prototype.fillRect = function fillRect(x, y, w, h) {
      record({
        kind: 'fillRect',
        canvasId: String(this.canvas?.id || ''),
        fillStyle: String(this.fillStyle || ''),
        x: Number(x || 0),
        y: Number(y || 0),
        w: Number(w || 0),
        h: Number(h || 0),
      });
      return originalFillRect.call(this, x, y, w, h);
    };
    CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, ...rest) {
      const transform = this.getTransform();
      record({
        kind: 'roundRect',
        canvasId: String(this.canvas?.id || ''),
        x: Number(x || 0),
        y: Number(y || 0),
        w: Number(w || 0),
        h: Number(h || 0),
        transformA: Number(transform.a || 1),
        transformD: Number(transform.d || 1),
        transformE: Number(transform.e || 0),
        transformF: Number(transform.f || 0),
      });
      return originalRoundRect.call(this, x, y, w, h, ...rest);
    };
    window.__orkaUiLockTrace = {
      read: () => calls.map((entry) => ({ ...entry })),
      reset: () => { calls.length = 0; },
    };
  });
}

async function waitForReady(page) {
  await page.waitForFunction(() => (
    window.__codexGame
    && window.__orkaUiLockTrace
    && typeof window.render_game_to_text === 'function'
  ), null, { timeout: 30000 });
  await page.waitForFunction(() => {
    try {
      return JSON.parse(window.render_game_to_text())?.flags?.layout0Ready === true;
    } catch {
      return false;
    }
  }, null, { timeout: 30000 });
}

async function readTrace(page) {
  return page.evaluate(() => window.__orkaUiLockTrace.read());
}

async function resetTrace(page) {
  await page.evaluate(() => window.__orkaUiLockTrace.reset());
}

function latestText(trace, pattern) {
  return [...trace].reverse().find((entry) => entry.kind === 'fillText' && pattern.test(entry.text));
}

function latestImage(trace, pattern) {
  return [...trace].reverse().find((entry) => entry.kind === 'drawImage' && pattern.test(entry.source));
}

async function readViewportMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('view');
    const controlScale = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--orka-control-scale'),
    );
    const readBox = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        backing: element instanceof HTMLCanvasElement
          ? { width: element.width, height: element.height }
          : null,
      };
    };
    const visual = window.visualViewport;
    return {
      requestedViewport: null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      visualViewport: visual ? { width: visual.width, height: visual.height, scale: visual.scale } : null,
      dpr: window.devicePixelRatio,
      controlScale,
      appViewport: window.__orkaAppViewport || null,
      canvas: readBox(canvas),
      devLauncher: readBox(Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'DEV')),
      dev2Launcher: readBox(document.getElementById('dev2-toggle')),
    };
  });
}

async function captureStoryAndTown(page, viewport, artifactDir) {
  await page.waitForFunction(() => {
    const calls = window.__orkaUiLockTrace?.read?.() || [];
    return calls.some((entry) => entry.kind === 'fillText' && /Story Mock/.test(entry.text));
  });
  const storyTrace = await readTrace(page);
  const story = latestText(storyTrace, /Story Mock/);
  const metrics = await readViewportMetrics(page);
  metrics.requestedViewport = { width: viewport.width, height: viewport.height, dpr: viewport.dpr };
  const layoutScale = Number(metrics.appViewport?.layoutScale || 0);
  const storyFontPx = parseFontPx(story?.font);
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-01-story.png`) });

  await resetTrace(page);
  const canvasBox = await page.locator('#view').boundingBox();
  if (!canvasBox) throw new Error('Canvas #view has no browser box');
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.waitForFunction(() => {
    try {
      return JSON.parse(window.render_game_to_text())?.flags?.layoutId === 'town';
    } catch {
      return false;
    }
  });
  await page.waitForFunction(() => (
    window.__orkaUiLockTrace.read().some((entry) => entry.kind === 'fillText' && /Town/.test(entry.text))
  ));
  const townTrace = await readTrace(page);
  const town = latestText(townTrace, /Town/);
  const townFontPx = parseFontPx(town?.font);
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-02-town.png`) });

  const expectedStage = computeContainedStage(viewport);
  const pageFits = metrics.document.scrollWidth <= metrics.document.clientWidth;
  const actualViewportMatches = metrics.viewport.width === viewport.width
    && metrics.viewport.height === viewport.height
    && metrics.document.clientWidth === metrics.viewport.width
    && metrics.document.clientHeight === metrics.viewport.height
    && metrics.dpr === viewport.dpr
    && (!metrics.visualViewport || (
      within(metrics.visualViewport.width, metrics.viewport.width, 1)
      && within(metrics.visualViewport.height, metrics.viewport.height, 1)
      && within(metrics.visualViewport.scale, 1, 0.01)
    ));
  const canvas = metrics.canvas;
  const stageMatches = canvas
    && within(canvas.width, expectedStage.width, 1)
    && within(canvas.height, expectedStage.height, 1)
    && within(canvas.x, (metrics.viewport.width - expectedStage.width) / 2, 1)
    && within(canvas.y, (metrics.viewport.height - expectedStage.height) / 2, 1)
    && within(canvas.backing?.width, Math.round(canvas.width * metrics.dpr), 1)
    && within(canvas.backing?.height, Math.round(canvas.height * metrics.dpr), 1);

  return {
    metrics,
    invariants: [
      invariant(
        'actual-viewport-metrics',
        actualViewportMatches,
        metrics,
        { requestedViewport: viewport, clientMatchesWindow: true, visualScale: 1 },
      ),
      invariant(
        'page-horizontal-overflow',
        pageFits,
        metrics.document,
        { scrollWidthAtMostClientWidth: true },
      ),
      invariant(
        'stage-contained-reference-aspect',
        stageMatches,
        { canvas, appViewport: metrics.appViewport },
        { expectedStage, centered: true, backingMatchesDpr: true },
      ),
      invariant(
        'story-mock-text-scale',
        within(storyFontPx / layoutScale, APPROVED.text.normalizedPx, APPROVED.text.tolerancePx),
        { text: story?.text || null, font: story?.font || null, normalizedFontPx: storyFontPx / layoutScale },
        APPROVED.text,
      ),
      invariant(
        'town-text-scale',
        within(townFontPx / layoutScale, APPROVED.text.normalizedPx, APPROVED.text.tolerancePx),
        { text: town?.text || null, font: town?.font || null, normalizedFontPx: townFontPx / layoutScale },
        APPROVED.text,
      ),
    ],
  };
}

async function captureDevPanels(page, viewport, artifactDir, metrics) {
  const launchers = [metrics.devLauncher, metrics.dev2Launcher].filter(Boolean);
  const canvasRight = (metrics.canvas?.x || 0) + (metrics.canvas?.width || 0);
  const canvasIsNarrowerThanViewport = (metrics.canvas?.width || 0) < metrics.viewport.width - 1;
  const launcherResults = launchers.map((box, index) => ({
    name: index === 0 ? 'DEV' : 'DEV2',
    width: box.width,
    height: box.height,
    normalizedWidth: box.width / metrics.controlScale,
    normalizedHeight: box.height / metrics.controlScale,
  }));
  const launcherPass = launchers.length === 2
    && within(launcherResults[0]?.normalizedWidth, APPROVED.launchers.dev.width, APPROVED.launchers.tolerancePx)
    && within(launcherResults[1]?.normalizedWidth, APPROVED.launchers.dev2.width, APPROVED.launchers.tolerancePx)
    && launcherResults.every((box) => within(box.normalizedHeight, APPROVED.launchers.dev.height, APPROVED.launchers.tolerancePx))
    && (!canvasIsNarrowerThanViewport || launchers.every((box) => (
      box.x >= canvasRight - 1
      && box.x + box.width <= metrics.viewport.width + 1
    )));

  await page.evaluate(() => window.__codexGame.toggleDevToolingModal(true));
  await page.waitForFunction(() => getComputedStyle(document.getElementById('orka-dev-tooling-modal')).display !== 'none');
  const panel1 = await page.evaluate(() => {
    const root = document.getElementById('orka-dev-tooling-modal');
    const panel = root?.firstElementChild;
    const close = panel?.querySelector('[data-devtool-close]');
    const title = panel?.querySelector('[data-devtool-title]');
    const actions = panel?.querySelector('[data-devtool-button-row]');
    const settings = panel?.querySelector('[data-devtool-control-grid]');
    const box = panel?.getBoundingClientRect();
    const actionBox = panel?.querySelector('[data-devtool-apply]')?.getBoundingClientRect();
    const titleBox = title?.getBoundingClientRect();
    const closeBox = close?.getBoundingClientRect();
    return {
      rect: box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null,
      scrollWidth: panel?.scrollWidth || 0,
      clientWidth: panel?.clientWidth || 0,
      scrollHeight: panel?.scrollHeight || 0,
      clientHeight: panel?.clientHeight || 0,
      actionButton: actionBox ? { width: actionBox.width, height: actionBox.height } : null,
      title: titleBox ? { right: titleBox.right, height: titleBox.height, whiteSpace: getComputedStyle(title).whiteSpace } : null,
      close: closeBox ? { left: closeBox.left } : null,
      order: { close: close?.compareDocumentPosition(actions) || 0, actions: actions?.compareDocumentPosition(settings) || 0 },
    };
  });
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-03-dev-panel-1.png`) });
  await page.evaluate(() => window.__codexGame.toggleDevToolingModal(false));

  await page.evaluate(() => window.__orkaDev2Diagnostics.open());
  await page.waitForFunction(() => !document.getElementById('dev2-diagnostics').hidden);
  const panel2 = await page.evaluate(() => {
    const panel = document.querySelector('#dev2-diagnostics .dev2-panel');
    const box = panel?.getBoundingClientRect();
    return {
      rect: box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null,
      scrollWidth: panel?.scrollWidth || 0,
      clientWidth: panel?.clientWidth || 0,
      scrollHeight: panel?.scrollHeight || 0,
      clientHeight: panel?.clientHeight || 0,
    };
  });
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-04-dev-panel-2.png`) });
  await page.evaluate(() => window.__orkaDev2Diagnostics.close());

  const contained = (panel) => (
    panel.rect
    && panel.rect.left >= -1
    && panel.rect.right <= viewport.width + 1
    && panel.rect.top >= -1
    && panel.rect.bottom <= viewport.height + 1
    && panel.scrollWidth <= panel.clientWidth + 1
  );
  const panelWidthMatches = (panel, maximumWidth) => within(
    panel.rect?.width || 0,
    Math.min(maximumWidth * metrics.controlScale, metrics.viewport.width - APPROVED.panels.gutterPx),
    APPROVED.panels.widthTolerancePx,
  );
  const follows = 4;
  return [
    invariant('dev-launcher-scale', launcherPass, { launchers: launcherResults, canvasRight, canvasIsNarrowerThanViewport }, { ...APPROVED.launchers, narrowCanvasUsesRightGutter: true }),
    invariant('dev-panel-1-containment', contained(panel1) && panelWidthMatches(panel1, 520), panel1, { fullyInsideViewport: true, horizontalOverflowPx: 0, physicalWidth: 'viewport minus 32px gutter' }),
    invariant('dev-panel-1-title-single-line', panel1.title?.whiteSpace === 'nowrap' && panel1.close && panel1.title.right <= panel1.close.left + 1, { title: panel1.title, close: panel1.close }, { whiteSpace: 'nowrap', clearsCloseButton: true }),
    invariant(
      'dev-panel-1-action-scale',
      within((panel1.actionButton?.height || 0) / metrics.controlScale, APPROVED.panels.actionHeightPx, APPROVED.panels.actionTolerancePx),
      { ...panel1.actionButton, normalizedHeight: (panel1.actionButton?.height || 0) / metrics.controlScale },
      APPROVED.panels,
    ),
    invariant('dev-panel-2-containment', contained(panel2) && panelWidthMatches(panel2, 760), panel2, { fullyInsideViewport: true, horizontalOverflowPx: 0, physicalWidth: 'viewport minus 32px gutter' }),
    invariant(
      'dev-panel-1-action-order',
      Boolean((panel1.order.close & follows) && (panel1.order.actions & follows)),
      panel1.order,
      'close before action buttons before settings fields',
    ),
  ];
}

async function captureCombat(page, viewport, artifactDir) {
  const setup = await page.evaluate(() => window.__codexGame.setupDynamicInitiativeAuthorityScenario());
  if (!setup?.ok) throw new Error(`Combat QA setup failed: ${JSON.stringify(setup)}`);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text())?.flags?.layoutId === 'combat');
  await page.evaluate(() => {
    const game = window.__codexGame;
    const globals = game.globals;
    const hero = game.state.entities.find((entity) => entity?.kind === 'hero');
    const enemies = game.state.entities.filter((entity) => entity?.kind === 'enemy' && Number(entity.hp || 0) > 0);
    globals.GamePhase = 'RUNTIME';
    globals.DynamicInitiativeAuthorityEnabled = 0;
    globals.DynamicInitiativeAuthority = null;
    globals.DynamicInitiative = null;
    globals.RoundActive = 0;
    globals.TurnOrderArray = [
      { uid: Number(hero?.uid || 0), type: 0 },
      ...enemies.map((enemy) => ({ uid: Number(enemy.uid || 0), type: 1 })),
    ];
    globals.CurrentTurnIndex = 0;
    globals.CurrentHeroUID = Number(hero?.uid || 0);
    globals.TurnPhase = 0;
    globals.HideHeroSelector = 0;
    globals.CanPickGems = 1;
    globals.IsPlayerBusy = 0;
    globals.ActionInProgress = 0;
    globals.PendingSkillID = '';
    globals.PendingActor = 0;
    game.stepFrames(1);
  });
  await resetTrace(page);
  await page.evaluate(() => window.__codexGame.stepFrames(2));
  const heroTrace = await readTrace(page);
  const heroSelector = latestImage(heroTrace, /selector-animation/i);
  const partyHealthBar = [...heroTrace].reverse().find((entry) => entry.kind === 'fillRect' && entry.fillStyle.toLowerCase() === '#a0fe0b');
  const ampBar = [...heroTrace].reverse().find((entry) => entry.kind === 'fillRect' && entry.fillStyle.toLowerCase() === '#1e7bd6');
  const layoutScale = await page.evaluate(() => Number(window.__orkaAppViewport?.layoutScale || 0));
  const legacyPanels = heroTrace.filter((entry) => (
    entry.kind === 'fillRect'
    && entry.canvasId === 'view'
    && /rgba\(240,\s*240,\s*240,\s*0\.92\)/.test(entry.fillStyle)
  ));
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-05-hero-selector.png`) });

  await resetTrace(page);
  const targeting = await page.evaluate(() => {
    const game = window.__codexGame;
    const globals = game.globals;
    const heroes = game.state.entities.filter((entity) => entity?.kind === 'hero');
    const enemies = game.state.entities.filter((entity) => entity?.kind === 'enemy' && Number(entity.hp || 0) > 0);
    const hero = heroes.find((entity) => Number(entity.uid || 0) === Number(globals.CurrentHeroUID || 0)) || heroes[0];
    const enemy = enemies[0];
    globals.CurrentHeroUID = Number(hero?.uid || 0);
    globals.PendingSkillID = 'HERO_SINGLE';
    globals.PendingActor = Number(hero?.uid || 0);
    globals.SelectedEnemyUID = Number(enemy?.uid || 0);
    globals.SelectedEnemyUIDOwner = Number(hero?.uid || 0);
    globals.HideHeroSelector = 1;
    globals.CanPickGems = 0;
    globals.IsPlayerBusy = 1;
    game.stepFrames(2);
    return game.getTargetDebugGeometry();
  });
  const targetTrace = await readTrace(page);
  const targetSelector = latestImage(targetTrace, /heroselect|selector/i);
  const attackButton = latestImage(targetTrace, /attackbutton|atk_down/i);
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-06-target-and-attack.png`) });

  await resetTrace(page);
  await page.evaluate(() => {
    const game = window.__codexGame;
    const globals = game.globals;
    const enemy = game.state.entities.find((entity) => entity?.kind === 'enemy' && Number(entity.hp || 0) > 0);
    globals.DamageTexts = [{
      amount: 20,
      partyMaxHP: Number(globals.PartyMaxHP || 147),
      zIndex: 4,
      x: Number(enemy?.x || 250),
      y: Number(enemy?.y || 160),
      baseX: Number(enemy?.x || 250),
      baseY: Number(enemy?.y || 160),
      kind: 'damage',
      targetKind: 'enemy',
      canvasAnchored: false,
      domSpawned: false,
      floatAngleDeg: 0,
      floatVectorX: 0,
      floatVectorY: -26,
      age: 0,
      phase: 0,
      opacity: 1,
      riseInSec: 0.18,
      holdSec: 0.7,
      fadeSec: 0.45,
    }];
    game.stepFrames(1);
  });
  await page.waitForSelector('.damage-number canvas', { timeout: 3000 });
  await page.waitForTimeout(50);
  const damage = await page.evaluate(() => {
    const canvas = document.querySelector('.damage-number canvas');
    const box = canvas?.getBoundingClientRect();
    const trace = window.__orkaUiLockTrace.read();
    const text = [...trace].reverse().find((entry) => entry.kind === 'fillText' && entry.text === '20');
    return {
      rect: box ? { width: box.width, height: box.height } : null,
      backing: canvas ? { width: canvas.width, height: canvas.height } : null,
      font: text?.font || null,
      fontPx: Number((String(text?.font || '').match(/(\d+(?:\.\d+)?)px/) || [])[1] || 0),
    };
  });
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-07-damage-text.png`) });

  await resetTrace(page);
  await page.evaluate(() => {
    window.__codexGame.toggleDevToolingModal(true);
    document.querySelector('[data-devtool-force-skill-draught]')?.click();
    window.__codexGame.stepFrames(1);
  });
  await page.waitForFunction(() => (
    window.__orkaUiLockTrace.read().some((entry) => entry.kind === 'fillText' && entry.text === 'Choose a Skill')
  ));
  const skillTrace = await readTrace(page);
  const skillTitle = latestText(skillTrace, /^Choose a Skill$/);
  const skillCardDrawsRaw = skillTrace.filter((entry) => (
    entry.kind === 'roundRect'
    && within(entry.w, APPROVED.combat.skillCard.width, APPROVED.combat.skillCard.tolerancePx)
    && within(entry.h, APPROVED.combat.skillCard.height, APPROVED.combat.skillCard.tolerancePx)
  ));
  const skill = await page.evaluate(() => ({
    dpr: window.devicePixelRatio,
    zones: window.__codexGame.globals.SkillDraughtHitZones,
  }));
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-08-skill-draught.png`) });

  const skillHitZone = skill.zones?.[0] || null;
  const skillCanvas = await page.locator('#view').boundingBox();
  if (!skillHitZone || !skillCanvas) throw new Error('Skill draught is missing a scaled hit zone or Canvas box');
  await page.mouse.click(
    skillCanvas.x + skillHitZone.x + skillHitZone.w / 2,
    skillCanvas.y + skillHitZone.y + skillHitZone.h / 2,
  );
  await page.waitForFunction(() => Number(window.__codexGame.globals.SkillDraughtOpen || 0) === 0);
  const skillRoute = await page.evaluate(() => ({
    open: Number(window.__codexGame.globals.SkillDraughtOpen || 0),
    zones: window.__codexGame.globals.SkillDraughtHitZones,
  }));

  const canvasWidth = Number(targeting?.canvas?.width || 0);
  const sizeResult = (entry) => entry ? {
    source: entry.source,
    width: entry.w,
    height: entry.h,
    widthRatio: entry.w / canvasWidth,
    heightRatio: entry.h / Number(targeting?.canvas?.height || 1),
  } : null;
  const heroSize = sizeResult(heroSelector);
  const targetSize = sizeResult(targetSelector);
  const attackSize = sizeResult(attackButton);
  const damageRatio = damage.fontPx / canvasWidth;
  const damageDensity = (damage.backing?.width || 0) / Math.max(1, damage.rect?.width || 0);
  const skillCards = Array.isArray(skill.zones) ? skill.zones : [];
  // Rendering can occur more than once while the modal settles. The final
  // complete frame shares the live hit-zone geometry we are proving.
  const skillCardDraws = skillCardDrawsRaw.slice(-skillCards.length);
  const skillTitleCssPx = parseFontPx(skillTitle?.font) * Number(skillTitle?.transformA || 1) / Math.max(1, Number(skill.dpr || 1));
  const skillCardGeometry = skillCards.map((hitZone, index) => {
    const draw = skillCardDraws[index] || null;
    const dpr = Math.max(1, Number(skill.dpr || 1));
    const scaleX = Number(draw?.transformA || 0) / dpr;
    const scaleY = Number(draw?.transformD || 0) / dpr;
    const offsetX = Number(draw?.transformE || 0) / dpr;
    const offsetY = Number(draw?.transformF || 0) / dpr;
    const drawMatchesHit = draw
      && within(hitZone.x, draw.x * scaleX + offsetX, 0.5)
      && within(hitZone.y, draw.y * scaleY + offsetY, 0.5)
      && within(hitZone.w, draw.w * scaleX, 0.5)
      && within(hitZone.h, draw.h * scaleY, 0.5);
    const normalizedWidth = hitZone.w / layoutScale;
    const normalizedHeight = hitZone.h / layoutScale;
    return {
      draw,
      hitZone,
      cssScale: { x: scaleX, y: scaleY },
      normalizedWidth,
      normalizedHeight,
      aspect: hitZone.h / hitZone.w,
      drawMatchesHit,
      fullyInsideCanvas: hitZone.x >= APPROVED.combat.skillCard.strokeSafeInsetPx * layoutScale
        && hitZone.y >= APPROVED.combat.skillCard.strokeSafeInsetPx * layoutScale
        && hitZone.x + hitZone.w <= canvasWidth - APPROVED.combat.skillCard.strokeSafeInsetPx * layoutScale
        && hitZone.y + hitZone.h <= Number(targeting?.canvas?.height || 0) - APPROVED.combat.skillCard.strokeSafeInsetPx * layoutScale,
    };
  });
  const allSkillCardsMatchApprovedSize = skillCardGeometry.every((card) => (
    within(card.normalizedWidth, APPROVED.combat.skillCard.width, APPROVED.combat.skillCard.tolerancePx)
    && within(card.normalizedHeight, APPROVED.combat.skillCard.height, APPROVED.combat.skillCard.tolerancePx)
    && within(card.aspect, APPROVED.combat.skillCard.height / APPROVED.combat.skillCard.width, 0.01)
  ));
  const expectedDamageFontPx = Math.max(4, Math.round(14 * layoutScale));
  const expectedDamageWidth = Math.ceil(expectedDamageFontPx * 3.12);
  const expectedDamageHeight = Math.max(12, Math.ceil(expectedDamageFontPx * 2.6));

  return [
    invariant('hero-selector-scale', heroSize && within(heroSize.widthRatio, APPROVED.combat.heroSelectorWidthRatio, APPROVED.combat.heroPulseTolerance), heroSize, APPROVED.combat),
    invariant('target-selector-scale', targetSize && within(targetSize.widthRatio, APPROVED.combat.targetSelectorWidthRatio, APPROVED.combat.controlTolerance), targetSize, APPROVED.combat),
    invariant('attack-button-scale', attackSize && within(attackSize.widthRatio, APPROVED.combat.attackWidthRatio, APPROVED.combat.controlTolerance), attackSize, APPROVED.combat),
    invariant('damage-text-scale', within(damage.fontPx, expectedDamageFontPx, 0.1) && within(damage.rect?.width, expectedDamageWidth, 1) && within(damage.rect?.height, expectedDamageHeight, 1), { ...damage, fontRatio: damageRatio }, { fontPx: expectedDamageFontPx, cssWidth: expectedDamageWidth, cssHeight: expectedDamageHeight }),
    invariant('damage-text-density', between(damageDensity, viewport.dpr * 0.99, viewport.dpr * 1.01), { density: damageDensity, dpr: viewport.dpr, ...damage }, { density: [viewport.dpr * 0.99, viewport.dpr * 1.01] }),
    invariant('party-progress-bar-height', within((partyHealthBar?.h || 0) / layoutScale, APPROVED.combat.progressHeightPx, APPROVED.combat.progressTolerancePx), { height: partyHealthBar?.h || 0, normalizedHeight: (partyHealthBar?.h || 0) / layoutScale }, APPROVED.combat),
    invariant('astral-progress-bar-height', within((ampBar?.h || 0) / layoutScale, APPROVED.combat.progressHeightPx, APPROVED.combat.progressTolerancePx), { height: ampBar?.h || 0, normalizedHeight: (ampBar?.h || 0) / layoutScale }, APPROVED.combat),
    invariant('skill-card-count-parity', skillCardDraws.length === skillCards.length && skillCards.length === 3, { draws: skillCardDraws.length, hitZones: skillCards.length }, { draws: 3, hitZones: 3 }),
    invariant('skill-card-proportions', skillCardGeometry.length === 3 && allSkillCardsMatchApprovedSize, skillCardGeometry, APPROVED.combat.skillCard),
    invariant('skill-card-draw-hit-geometry', skillCardGeometry.length === 3 && skillCardGeometry.every((card) => card.drawMatchesHit), skillCardGeometry, { sharedCanvasTransform: true }),
    invariant('skill-card-canvas-containment', skillCardGeometry.length === 3 && skillCardGeometry.every((card) => card.fullyInsideCanvas), skillCardGeometry, { strokeSafeInsetPx: APPROVED.combat.skillCard.strokeSafeInsetPx }),
    invariant('skill-card-hit-routing', skillRoute.open === 0 && skillRoute.zones.length === 0, { before: skillHitZone, after: skillRoute }, { selectionClosesDraught: true, hitZonesCleared: true }),
    invariant('skill-title-scale', within(skillTitleCssPx / layoutScale, APPROVED.combat.skillTitlePx, APPROVED.combat.skillTitleTolerancePx), { cssFontPx: skillTitleCssPx, normalizedFontPx: skillTitleCssPx / layoutScale }, APPROVED.combat),
    invariant('legacy-backdrop-absent', legacyPanels.length === 0, { forbiddenPanelDraws: legacyPanels }, { forbiddenPanelDraws: 0 }),
  ];
}

async function runViewport(browser, baseUrl, viewport, artifactDir, { injectStageDrift = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error?.message || error)));
  await installCanvasTrace(page);
  await page.goto(`${baseUrl}/web-runner/index.html?devtest=true&qa=ui-lock`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await waitForReady(page);
  if (injectStageDrift) {
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'orka-ui-lock-rejection-drift';
      style.textContent = '#view { transform: scale(1.1) !important; transform-origin: top left !important; } #orka-dev-tooling-modal > div, .dev2-panel { width:50% !important; }';
      document.head.appendChild(style);
    });
  }
  try {
    const presentation = await captureStoryAndTown(page, viewport, artifactDir);
    const panelInvariants = await captureDevPanels(page, viewport, artifactDir, presentation.metrics);
    const combatInvariants = await captureCombat(page, viewport, artifactDir);
    const results = [
      ...presentation.invariants,
      ...panelInvariants,
      ...combatInvariants,
      invariant('page-runtime-errors', pageErrors.length === 0, pageErrors, { count: 0 }),
    ];
    return { viewport, metrics: presentation.metrics, invariants: results };
  } finally {
    if (injectStageDrift) {
      await page.evaluate(() => document.getElementById('orka-ui-lock-rejection-drift')?.remove());
    }
    await context.close();
  }
}

async function runRejectionProof(browser, baseUrl, artifactDir) {
  const run = await runViewport(
    browser,
    baseUrl,
    viewports.find((viewport) => viewport.name === 'live-narrow'),
    artifactDir,
    { injectStageDrift: true },
  );
  const failures = run.invariants.filter((entry) => !entry.pass);
  const stageFailure = failures.find((entry) => entry.name === 'stage-contained-reference-aspect');
  const panelFailure = failures.find((entry) => entry.name === 'dev-panel-1-containment');
  if (!stageFailure || !panelFailure) {
    throw new Error(`UI lock rejected no stage or panel drift: ${JSON.stringify(failures)}`);
  }
  return { pass: true, expectedFailures: [stageFailure, panelFailure], allFailures: failures };
}

async function runQuestViewport(browser, baseUrl, viewport, artifactDir) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.dpr });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/web-runner/index.html?questQA=1`);
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    const clickCanvas = async (x,y) => {
      const box = await page.locator('canvas').boundingBox();
      await page.mouse.click(box.x + box.width*x/360,box.y+box.height*y/640);
    };
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).flags.layout0Ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const label of ['HERO', 'VAULT', 'FLOW', 'QUESTS']) {
      await page.getByRole('button', {name:label, exact:true}).click();
      await page.waitForFunction(label => document.querySelector('#game-meta-nav [aria-current="page"]')?.textContent === label, label);
    }
    await page.waitForFunction(() => [...document.querySelectorAll('#game-meta-nav img')].length === 6 && [...document.querySelectorAll('#game-meta-nav img')].every(img => img.complete && img.naturalWidth > 0));
    const nav = await page.locator('#game-meta-nav').evaluate(el => ({labels:[...el.children].map(b=>b.textContent),width:el.offsetWidth,height:el.offsetHeight,daily:el.firstChild.disabled,overflow:el.scrollWidth>el.clientWidth}));
    if (nav.labels.join(',') !== 'DAILY,HERO,QUESTS,VAULT,SHOP,FLOW' || nav.width !== 360 || nav.height !== 60 || !nav.daily || nav.overflow) throw new Error('Shared navigation geometry/labels failed: '+JSON.stringify(nav));
    await page.getByRole('button', {name:/Main Story/}).waitFor();
    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector('canvas').getBoundingClientRect();
      const card = document.querySelector('#quest-ui .card');
      const box = card.getBoundingClientRect();
      return { rowHeight: box.height / canvas.height * 640, rowRatio: box.height/canvas.height, contained: box.left >= canvas.left && box.right <= canvas.right, overflow: document.documentElement.scrollWidth > innerWidth, cardOverflow: card.scrollWidth > card.clientWidth || card.scrollHeight > card.clientHeight, canvas:canvas.toJSON(), dpr:devicePixelRatio };
    });
    await page.screenshot({path:path.join(artifactDir,`${viewport.name}-quest-ladder.png`)});
    await page.getByRole('button',{name:/Main Story/}).click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).quest.canSkip);
    if (!await page.locator('#game-meta-nav').evaluate(el => el.hidden && el.inert && [...el.children].every(b=>b.disabled))) throw new Error('Dialogue navigation must be hidden and disabled');
    await clickCanvas(304,453);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await clickCanvas(304,453);
    await page.getByRole('button',{name:'Skip',exact:true}).click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).quest.phase === 'combat');
    await page.getByRole('button', {name:'QUESTS',exact:true}).waitFor();
    await page.getByRole('button',{name:'QA defeat',exact:true}).click();
    await page.getByRole('button',{name:'Continue · 30',exact:true}).waitFor();
    await page.screenshot({path:path.join(artifactDir,`${viewport.name}-quest-continue.png`)});
    await page.getByRole('button',{name:'Continue · 30',exact:true}).click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).quest.phase === 'combat');
    await page.getByRole('button',{name:'QA clear monsters',exact:true}).click();
    await page.locator('[data-action="card:1"]').waitFor();
    const progress = await page.evaluate(() => JSON.parse(window.render_game_to_text()).quest.progress);
    await page.screenshot({path:path.join(artifactDir,`${viewport.name}-quest-unlocked.png`)});
    for (let i=1; i<=10; i++) {
      const card = page.locator(`[data-action="card:${i <= 5 ? i : i+1}"]`);
      await card.waitFor();
      await card.locator('img').evaluate(img => img.decode());
      if(i===1 || i===10) await page.screenshot({path:path.join(artifactDir,`${viewport.name}-stage-${i}.png`)});
      const column = await card.evaluate(el => {
        const panel = document.querySelector('#quest-ui .chapter').getBoundingClientRect();
        const row = el.getBoundingClientRect();
        return Math.abs(row.width-panel.width)<1 && Math.abs(row.right-panel.right)<1;
      });
      if (!column) throw new Error(`Quest card column drift at ${viewport.name}, Stage ${i}`);
      const enemy = await card.locator('img').getAttribute('alt');
      await card.click();
      await page.waitForFunction(() => window.__codexGame.globals.AstralFlowAmpPoints===0);
      await page.waitForFunction(name => window.__codexGame.state.entities.filter(e=>e.kind==='enemy').length===1 && window.__codexGame.state.entities.some(e=>e.kind==='enemy' && e.name===name),enemy);
      await page.getByRole('button',{name:'QA clear monsters',exact:true}).click();
      await page.waitForFunction(index => JSON.parse(window.render_game_to_text()).quest.progress.completed.length===index+1+(index>5 ? 1 : 0),i);
      if (i===5) {
        await page.screenshot({path:path.join(artifactDir,`${viewport.name}-midpoint-story.png`)});
        await page.getByRole('button',{name:/Main Story 2/}).click();
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).quest.canSkip);
        await clickCanvas(304,453);
        await page.getByRole('button',{name:'Skip',exact:true}).click();
      }
    }
    return {viewport, metrics, invariants:[
      invariant('quest-card-height',within(metrics.rowHeight,56,0.5),metrics.rowHeight,56),
      invariant('quest-card-contained',metrics.contained && !metrics.overflow && !metrics.cardOverflow,metrics,'contained'),
      invariant('quest-outcome-and-cost',progress.revealed===2 && progress.resources===170 && progress.energy===95,progress,'one unlock, 30 spent, 50 awarded'),
    ]};
  } catch(error) { await page.screenshot({path:path.join(artifactDir,'quest-failure.png')}); throw error; } finally { await context.close(); }
}

async function main() {
  runFocusedContracts();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifactDir = path.join(repoRoot, 'test-results', 'ui-lock', timestamp);
  await fsPromises.mkdir(artifactDir, { recursive: true });
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const release = process.argv.includes('--release');
  const server = spawn(release ? 'python3' : process.execPath, release
    ? ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', path.join(repoRoot, 'dist')]
    : ['tools/serve_web.js', '--port', String(port)], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const serverOutput = [];
  server.stdout.on('data', (chunk) => serverOutput.push(String(chunk)));
  server.stderr.on('data', (chunk) => serverOutput.push(String(chunk)));

  let browser = null;
  let report = null;
  try {
    await waitForHttp(`${baseUrl}/web-runner/index.html`);
    const executablePath = detectChromeExecutable();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
    const runs = [];
    for (const viewport of viewports) {
      runs.push(await (process.argv.includes('--quest') ? runQuestViewport : runViewport)(browser, baseUrl, viewport, artifactDir));
    }
    const failed = runs.flatMap((run) => run.invariants.filter((entry) => !entry.pass).map((entry) => ({ viewport: run.viewport.name, ...entry })));
    const rejectionProof = proveRejection ? await runRejectionProof(browser, baseUrl, artifactDir) : null;
    report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      artifactDir,
      focusedContracts,
      runs,
      failed,
      pass: failed.length === 0,
      rejectionProof,
      serverOutput,
    };
  } catch (error) {
    report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      artifactDir,
      focusedContracts,
      pass: false,
      error: String(error?.stack || error?.message || error),
      browserFailure: classifyPlaywrightFailure(error),
      serverOutput,
    };
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }

  const reportPath = path.join(artifactDir, 'ui-lock-report.json');
  await fsPromises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (!report.pass) {
    console.error(`[UI_LOCK_FAIL] report=${reportPath}`);
    for (const failure of report.failed || []) {
      console.error(`[UI_LOCK_FAIL] viewport=${failure.viewport} invariant=${failure.name} measured=${JSON.stringify(failure.measured)} allowed=${JSON.stringify(failure.allowed)}`);
    }
    if (report.error) console.error(report.error);
    process.exitCode = 1;
    return;
  }
  const total = report.runs.reduce((sum, run) => sum + run.invariants.length, 0);
  console.log(`[UI_LOCK_PASS] ${total}/${total} rendered invariants passed`);
  if (report.rejectionProof?.pass) console.log('[UI_LOCK_REJECTION_PROOF_PASS] intentional stage and panel drift were rejected');
  console.log(`[UI_LOCK_REPORT] ${reportPath}`);
}

await main();
