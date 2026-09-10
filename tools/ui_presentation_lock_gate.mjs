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
  'tests/heroCommandsContract.test.js',
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
    controlTolerance: 0.002,
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
  await page.waitForFunction(() => window.__orkaUiLockTrace.read().some(e => e.kind === 'fillText' && e.text === 'QUESTS'));
  const story = latestText(await readTrace(page), /^QUESTS$/);
  const metrics = await readViewportMetrics(page);
  metrics.requestedViewport = { width: viewport.width, height: viewport.height, dpr: viewport.dpr };
  const layoutScale = Number(metrics.appViewport?.layoutScale || 0);
  const storyFontPx = parseFontPx(story?.font) * Number(story?.transformA || 1) / metrics.dpr;
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-01-map.png`)});
  const canvasBox = await page.locator('#view').boundingBox();
  await page.mouse.click(canvasBox.x + canvasBox.width * 184.5/360, canvasBox.y + canvasBox.height * 427/640);
  await page.locator('#quest-ui .chapter h1').waitFor();
  const town = await page.locator('#quest-ui .chapter h1').evaluate(el => ({text:el.textContent,font:getComputedStyle(el).font,fontSize:parseFloat(getComputedStyle(el).fontSize)}));
  const townFontPx = town.fontSize * layoutScale;
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-02-ladder.png`)});

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
        'quests-banner-text-scale',
        within(storyFontPx / layoutScale, 13, APPROVED.text.tolerancePx),
        { text: story?.text || null, font: story?.font || null, normalizedFontPx: storyFontPx / layoutScale },
        APPROVED.text,
      ),
      invariant(
        'chapter-text-scale',
        within(townFontPx / layoutScale, 18, APPROVED.text.tolerancePx),
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
  await page.locator('[aria-label="Entering combat"]').waitFor({state:'hidden'});
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
  const commands = await page.evaluate(() => {
    const host = document.getElementById('hero-commands');
    const rect = host.getBoundingClientRect(), canvas = document.getElementById('view').getBoundingClientRect();
    const cards = [...host.querySelectorAll('article')].map(card => ({
      uid: Number(card.dataset.uid || 0), box: card.getBoundingClientRect().toJSON(),
      portrait: card.querySelector('.face')?.getBoundingClientRect().toJSON(),
      hp: card.querySelector('[data-hp]')?.textContent,
      flow: card.querySelector('[data-flow]')?.getBoundingClientRect().toJSON(),
      sp: card.querySelector('[data-sp]')?.textContent,
      name: card.querySelector('strong')?.getBoundingClientRect().toJSON(),
      flowRow: card.querySelector('.flow')?.getBoundingClientRect().toJSON(),
      healthRow: card.querySelector('.health')?.getBoundingClientRect().toJSON(),
      spRow: card.querySelector('.sp')?.getBoundingClientRect().toJSON(),
      buttonHeight: card.querySelector('[data-open]')?.getBoundingClientRect().height,
      overflow: card.scrollWidth > card.clientWidth,
    }));
    return { box: rect.toJSON(), canvas: canvas.toJSON(), cards,
      overflow: host.scrollWidth > host.clientWidth, visible: !host.hidden,
      nativeButtons: host.querySelectorAll('button').length,
      boardMembers: window.__codexGame.globals.Gems?.length || 0,
    };
  });
  const scale = layoutScale;
  const commandInvariants = [
    invariant('hero-command-containment', commands.visible && !commands.overflow && commands.cards.every(card => !card.overflow)
      && commands.box.left >= commands.canvas.left && commands.box.right <= commands.canvas.right + 1
      && commands.box.bottom <= commands.canvas.bottom + 1, commands, { contained: true }),
    invariant('hero-command-column-order', commands.cards.length === 6 && commands.cards.slice(0,4).every(card => card.uid > 0)
      && commands.cards.slice(4).every(card => card.uid === 0)
      && within(commands.cards[0].box.left, commands.cards[2].box.left, 1)
      && commands.cards[2].box.top > commands.cards[1].box.top
      && within(commands.cards[0].box.top, commands.cards[3].box.top, 1), commands.cards, { loaded: 4, empty: 2, fill: 'column' }),
    invariant('hero-command-scale', commands.cards.filter(card => card.uid).every(card =>
      within(card.box.height / scale, 58, .5) && within(card.buttonHeight / scale, 58, .5)
      && within(card.portrait.width / scale, 18, .5)), commands.cards, { card: 58, button: 58, portrait: 18 }),
    invariant('hero-command-two-row-layout', commands.cards.filter(card => card.uid).every(card =>
      card.flowRow.left >= card.name.right && card.healthRow.top >= card.portrait.bottom
      && within(card.healthRow.top, card.spRow.top, 1) && card.spRow.left >= card.healthRow.right),
      commands.cards, { firstRow: 'portrait/name and FLOW', secondRow: 'HP and SP' }),
    invariant('hero-command-native-input', commands.nativeButtons === 8 && commands.boardMembers === 0,
      { buttons: commands.nativeButtons, gems: commands.boardMembers }, { buttons: 8, gems: 0 }),
  ];
  await page.locator('#hero-commands article[data-uid] [data-open]').first().click();
  await page.getByRole('button', { name: 'Act', exact: true }).waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-05b-action-editor.png`) });
  const editorBounds = await page.locator('#hero-commands .editor').evaluate(el => ({
    rect: el.getBoundingClientRect().toJSON(), overflow: el.scrollWidth > el.clientWidth,
  }));
  commandInvariants.push(invariant('hero-editor-containment', !editorBounds.overflow
    && editorBounds.rect.left >= commands.box.left && editorBounds.rect.right <= commands.box.right + 1
    && editorBounds.rect.bottom <= commands.box.bottom + 1, editorBounds, { contained: true }));
  await page.getByRole('button', { name: 'Back', exact: true }).click();

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
    document.querySelectorAll('.damage-number canvas').forEach(el => el.dataset.uiLockExisting = 'true');
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
  await page.waitForSelector('.damage-number canvas:not([data-ui-lock-existing])', { timeout: 3000 });
  await page.waitForTimeout(50);
  const damage = await page.evaluate(() => {
    const canvas = document.querySelector('.damage-number canvas:not([data-ui-lock-existing])');
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
  const damageRatio = damage.fontPx / canvasWidth;
  const damageDensity = (damage.backing?.width || 0) / Math.max(1, damage.rect?.width || 0);
  const expectedDamageFontPx = Math.max(4, Math.round(14 * layoutScale));
  const expectedDamageWidth = Math.ceil(expectedDamageFontPx * 3.12);
  const expectedDamageHeight = Math.max(12, Math.ceil(expectedDamageFontPx * 2.6));

  return [
    ...commandInvariants,
    invariant('hero-selector-scale', heroSize && within(heroSize.widthRatio, APPROVED.combat.heroSelectorWidthRatio, APPROVED.combat.heroPulseTolerance), heroSize, APPROVED.combat),
    invariant('target-selector-scale', targetSize && within(targetSize.widthRatio, APPROVED.combat.targetSelectorWidthRatio, APPROVED.combat.controlTolerance), targetSize, APPROVED.combat),
    invariant('global-attack-absent', !attackButton, attackButton, { count: 0 }),
    invariant('damage-text-scale', within(damage.fontPx, expectedDamageFontPx, 0.1) && within(damage.rect?.width, expectedDamageWidth, 1) && within(damage.rect?.height, expectedDamageHeight, 1), { ...damage, fontRatio: damageRatio }, { fontPx: expectedDamageFontPx, cssWidth: expectedDamageWidth, cssHeight: expectedDamageHeight }),
    invariant('damage-text-density', between(damageDensity, viewport.dpr * 0.99, viewport.dpr * 1.01), { density: damageDensity, dpr: viewport.dpr, ...damage }, { density: [viewport.dpr * 0.99, viewport.dpr * 1.01] }),
    invariant('pooled-health-bar-absent', !partyHealthBar, partyHealthBar, { count: 0 }),
    invariant('gem-board-backdrop-absent', !heroTrace.some(entry => entry.kind==='fillRect'
      && within(entry.w / layoutScale, 300, .5) && within(entry.h / layoutScale, 210, .5)), null, { count: 0 }),
    invariant('shared-astral-bar-absent', !ampBar, ampBar, { count: 0 }),
    invariant('personal-flow-meters', commands.cards.filter(card => card.uid).every(card => card.flow && within(card.flow.height / scale, 4, .5) && /^SP \d+$/.test(card.sp)), commands.cards, { normalizedHeight: 4, perHero: true }),
    invariant('party-card-draw-controls-absent', await page.locator('[data-devtool-force-skill-draught], [data-devtool-clear-session-skills], [data-devtool-skill-id]').count() === 0, null, { count: 0 }),
    invariant('legacy-backdrop-absent', legacyPanels.length === 0, { forbiddenPanelDraws: legacyPanels }, { forbiddenPanelDraws: 0 }),
  ];
}

async function captureCommandTurns(page, viewport, artifactDir) {
  const results = [];
  const arrange = async (count, flow = 0) => page.evaluate(({count, flow}) => {
    const game = window.__codexGame, g = game.globals;
    const seed = game.state.entities.find(actor => actor.kind === 'hero');
    const enemies = game.state.entities.filter(actor => actor.kind === 'enemy');
    for (const enemy of enemies) { enemy.hp = 10000; enemy.maxHP = 10000; }
    const heroes = Array.from({length:count}, (_,slot) => ({ ...seed, name:'Falie', baseHeroName:'Falie',
      stats:{...seed.stats}, uid:100+slot, heroDisplaySlot:slot, hp:5000, maxHP:5000,
      flow:slot === count-1 ? flow : 0, flowMode:'Stoic', spMax:100, sp:100, currentLevel:50, statuses:[], nativeWard:0,
      nativeCover:false, nativeReprisal:false,
    }));
    game.state.entities = [...heroes, ...enemies];
    Object.assign(g, { GamePhase:'RUNTIME', NativeBattleEnded:false, BattleStartActive:0, TurnPhase:0, CurrentTurnIndex:0,
      CombatSessionId:Number(g.CombatSessionId || 0)+1,
      DynamicInitiativeAuthorityEnabled:0, DynamicInitiativeAuthority:null, DynamicInitiative:null, RoundActive:0,
      CurrentHeroUID:heroes.at(-1).uid, IsPlayerBusy:0, CanPickGems:1, ActionInProgress:0, ActionActorUID:0,
      ActionLockUntil:0, DeferAdvance:0, AdvanceAfterAction:0, PendingSkillID:'', PendingActor:0,
      SkillDraughtOpen:0, SkillDraughtPendingOpen:0, TextAnimating:0, TextAnimEndAt:0,
      HeroAction:null, EnemyAction:null, PendingHeroHits:[], PendingDeaths:{}, NativeCommandSequence:null,
      TurnOrderArray:[{uid:heroes.at(-1).uid,type:0},...enemies.map(enemy=>({uid:enemy.uid,type:1}))],
    });
    game.callFunction('InitPartyHPFromHeroes');
    game.callFunction('ProcessTurn');
    game.stepFrames(2);
    return {actorUID:heroes.at(-1).uid, hp:enemies.map(enemy=>({uid:enemy.uid,hp:enemy.hp})),
      energy:g.Player_Energy, flow:heroes.at(-1).flow, turn:Number(g.TurnSerial || 0)};
  }, {count,flow});
  const open = async uid => page.locator(`#hero-commands article[data-uid="${uid}"] [data-open]`).click();
  const settled = async before => {
    try {
      await page.waitForFunction(before => {
        const g = window.__codexGame.globals;
        return Number(g.TurnSerial || 0) > Number(before.turn || 0) && !g.NativeCommandSequence && !g.HeroAction?.active;
      }, before, {timeout:15000});
    } catch (error) {
      const state = await page.evaluate(() => {
        const g = window.__codexGame.globals;
        return Object.fromEntries(['time','TurnSerial','TurnPhase','IsPlayerBusy','CanPickGems','ActionInProgress','ActionActorUID','ActionOwnerUID','ActionLockUntil','DeferAdvance','AdvanceAfterAction','PendingSkillID','HeroAction','EnemyAction','PendingHeroHits','NativeCommandSequence','CurrentTurnIndex','TurnOrderArray','SkillDraughtOpen','SkillDraughtPendingOpen','EnemyRosterRefillPending'].map(key=>[key,g[key]]));
      });
      await page.screenshot({path:path.join(artifactDir,`${viewport.name}-command-failure.png`)});
      throw new Error(`Command did not complete: ${JSON.stringify({before,state})}`, {cause:error});
    }
  };
  const snapshot = async uid => page.evaluate(uid => {
    const game = window.__codexGame, g = game.globals;
    const hero = game.state.entities.find(actor=>actor.uid===uid);
    return {flow:hero.flow, sp:hero.sp, spMax:hero.spMax, turn:Number(g.TurnSerial || 0), owner:g.ActionOwnerUID,
      deferred:g.DeferAdvance, energy:g.Player_Energy, pending:!!g.NativeCommandSequence,
      busy:g.ActionInProgress, current:Number(document.querySelector('#hero-commands article[data-current="true"]')?.dataset.uid || 0),
      hp:game.state.entities.filter(actor=>actor.kind==='hero').map(actor=>actor.hp),
      cards:[...document.querySelectorAll('#hero-commands article')].map(card=>Number(card.dataset.uid || 0)),
      gems:g.Gems.length, positions:g.HeroPortraitPosByIndex,
      draw:Number(g.SkillDraughtOpen || 0), pendingDraw:Number(g.SkillDraughtPendingOpen || 0)};
  },uid);
  for (let count = 1; count <= 6; count++) {
    const before = await arrange(count);
    await open(before.actorUID);
    const targetUID = before.hp.at(-1).uid;
    const point = await page.evaluate(uid => window.__codexGame.getTargetDebugGeometry().enemies.find(enemy=>enemy.uid===uid), targetUID);
    await page.locator('#view').click({position:{x:point.x,y:point.y}});
    const selected = await page.evaluate(() => window.__codexGame.globals.SelectedEnemyUID);
    if(selected!==targetUID) throw new Error(`Battlefield target click failed: ${selected} != ${targetUID}`);
    await page.getByRole('button',{name:'Attack',exact:true}).click();
    const prepared = await snapshot(before.actorUID);
    await page.getByRole('button', {name:'Act',exact:true}).click();
    const selectedTarget = await page.evaluate(() => window.__codexGame.globals.NativeCommandSequence?.actions[0]?.targetIds[0]);
    const acting = await snapshot(before.actorUID);
    results.push(invariant(`hero-command-active-highlight-${count}`, acting.busy===1 && acting.current===before.actorUID,
      acting, {activeDuringOwnAction:true, actorUID:before.actorUID}));
    await settled(before);
    const after = await snapshot(before.actorUID);
    const damaged = await page.evaluate(uid => window.__codexGame.state.entities.find(actor=>actor.uid===uid)?.hp,targetUID);
    results.push(invariant(`hero-command-group-${count}`, prepared.turn === before.turn && prepared.energy === before.energy
      && prepared.flow === before.flow && after.energy === before.energy && after.gems === 0
      && selectedTarget === targetUID && damaged < before.hp.at(-1).hp
      && after.cards.filter(Boolean).length === count && after.cards[count-1] === before.actorUID
      && after.positions[count-1] != null, {before, prepared, after, selectedTarget, targetUID, damaged},
      {preparesWithoutSpend:true,attackCompletes:true,count}));
    if (count === 1 || count === 6) await page.screenshot({path:path.join(artifactDir,`${viewport.name}-09-group-${count}.png`)});
  }
  const orbBefore = await arrange(3);
  await page.evaluate(() => {
    const g=window.__codexGame.globals;
    g.FlowRandom=()=>0;g.FlowOrbs=[];
    for(const enemy of window.__codexGame.state.entities.filter(a=>a.kind==='enemy')) enemy.hp=1;
    window.__codexGame.state.entities.find(a=>a.uid===100).flow=90;
  });
  await open(orbBefore.actorUID);
  await page.getByRole('button',{name:'Attack',exact:true}).click();
  await page.getByRole('button',{name:'Act',exact:true}).click();
  await page.waitForFunction(()=>window.__codexGame.globals.FlowOrbs?.some(o=>!o.collected));
  const flight=await page.evaluate(()=>{
    const game=window.__codexGame,g=game.globals,o=g.FlowOrbs[0];
    return {orb:{...o},flow:game.state.entities.find(a=>a.uid===o.recipientUID).flow,age:g.time-o.born};
  });
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-orb-flight.png`)});
  await page.waitForFunction(()=>window.__codexGame.globals.FlowOrbs?.some(o=>!o.collected&&window.__codexGame.globals.time-o.born>=.3));
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-orb-bounce.png`)});
  await page.waitForFunction(()=>window.__codexGame.globals.FlowOrbs?.some(o=>!o.collected&&window.__codexGame.globals.time-o.born>=.85));
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-orb-travel.png`)});
  await page.waitForFunction(()=>window.__codexGame.state.entities.find(a=>a.uid===100).flow===100);
  await settled(orbBefore);
  const collected=await page.evaluate(()=>({ready:document.querySelector('#hero-commands article[data-uid="100"]').dataset.ready,heroes:window.__codexGame.state.entities.filter(a=>a.kind==='hero').map(a=>({uid:a.uid,flow:a.flow,sp:a.sp})),turn:window.__codexGame.globals.TurnSerial}));
  results.push(invariant('flow-orb-flight-and-collection',flight.flow===90&&flight.orb.recipientUID===100&&flight.orb.sourceKind==='enemy'&&flight.orb.value===10&&collected.ready==='true'&&collected.heroes.every(h=>h.sp===100)&&collected.turn===orbBefore.turn+1,{flight,collected},{visibleFlight:true,randomNonAttacker:true,chargeOnArrival:true,SPUnchanged:true,oneTurn:true}));
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-orb-collected.png`)});
  await page.evaluate(()=>{delete window.__codexGame.globals.FlowRandom;});
  const flowBefore = await arrange(6,100);
  await open(flowBefore.actorUID);
  await page.getByRole('button',{name:'FLOW',exact:true}).click();
  const flowPrepared = await snapshot(flowBefore.actorUID);
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-10-flow-editor.png`)});
  await page.getByRole('button',{name:'Act',exact:true}).focus();
  await page.keyboard.press('Enter');
  const flowCommitted = await snapshot(flowBefore.actorUID);
  await settled(flowBefore);
  const flowAfter = await snapshot(flowBefore.actorUID);
  results.push(invariant('hero-command-personal-flow', flowPrepared.flow===100 && flowPrepared.turn===flowBefore.turn
    && flowAfter.flow===0 && flowCommitted.owner===flowBefore.actorUID
    && flowAfter.turn===flowBefore.turn+1 && !flowAfter.pending && !flowAfter.draw && !flowAfter.pendingDraw,
    {flowBefore,flowPrepared,flowCommitted,flowAfter},{fullChargeConsumed:true,turns:1,keyboardAct:true,draw:false}));

  const sequenceBefore = await arrange(6,0);
  await open(sequenceBefore.actorUID);
  await page.locator('#hero-commands [data-skill="guard"]').click();
  await page.locator('#hero-commands [data-skill="provoke"]').click();
  const queue = await page.locator('#hero-commands .queue').innerText();
  const budget = await page.locator('#hero-commands .editor h2 span').innerText();
  const sequencePrepared = await snapshot(sequenceBefore.actorUID);
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-11-paid-sequence.png`)});
  await page.getByRole('button',{name:'Act',exact:true}).click();
  const sequenceCommitted = await snapshot(sequenceBefore.actorUID);
  await settled(sequenceBefore);
  const sequenceAfter = await snapshot(sequenceBefore.actorUID);
  results.push(invariant('hero-command-paid-sequence', sequencePrepared.flow===0 && sequencePrepared.sp===100 && sequencePrepared.turn===sequenceBefore.turn
    && sequenceCommitted.flow===0 && sequenceCommitted.sp===80 && sequenceCommitted.owner===sequenceBefore.actorUID
    && sequenceAfter.turn===sequenceBefore.turn+1 && !sequenceAfter.pending && !sequenceAfter.draw && !sequenceAfter.pendingDraw
    && budget==='2/3 actions · 1 left · 80 SP' && /1\. Guard/.test(queue) && /2\. Provoke/.test(queue),
    {sequenceBefore,sequencePrepared,sequenceCommitted,sequenceAfter,budget,queue},
    {budget:20,spMax:100,remaining:80,turns:1,queueOrder:['guard','provoke'],draw:false}));
  for (const capacity of [1,2,3]) {
    const before = await arrange(3);
    await page.evaluate(({uid,capacity})=>{const hero=window.__codexGame.state.entities.find(a=>a.uid===uid);hero.actionSlotsPerTurn=capacity;}, {uid:before.actorUID,capacity});
    await open(before.actorUID);
    for(const id of ['guard','provoke','cover'].slice(0,capacity)) await page.locator(`#hero-commands [data-skill="${id}"]`).click();
    const committed=await snapshot(before.actorUID);
    await settled(before);
    const after=await snapshot(before.actorUID);
    results.push(invariant(`action-slots-auto-commit-${capacity}`,committed.pending&&after.turn===before.turn+1&&after.sp>0,{committed,after},{capacity,automatic:true,oneTurn:true}));
  }
  {
    const before=await arrange(2);
    await page.evaluate(async()=>{
      const game=window.__codexGame,g=game.globals;
      const {createHeroProgressStore,newHeroProgress}=await import('./src/core/heroProgression.mjs');
      const heroes=game.state.entities.filter(a=>a.kind==='hero');
      Object.assign(heroes[0],newHeroProgress('Huun'));heroes[0].hp=0;
      Object.assign(heroes[1],newHeroProgress('Falie'));
      const enemies=game.state.entities.filter(a=>a.kind==='enemy').slice(0,1);enemies[0].hp=1;enemies[0].expValue=3000;enemies[0].slotIndex=0;game.state.entities=[...heroes,...enemies];g.EnemySlots=[enemies[0].uid+1];g.EnemyIDs=[enemies[0].uid];g.Slots=1;g.QuestFiniteEncounter=1;
      g.HeroProgress=createHeroProgressStore();g.ProgressionBattle={id:'ui-victory',participants:['Huun','Falie'],defeated:{},settled:false};
      g.SelectedEnemyUID=enemies[0].uid;
    });
    await open(before.actorUID);
    await page.getByRole('button',{name:'Attack',exact:true}).click();
    await page.getByRole('button',{name:'Act',exact:true}).click();
    await page.waitForFunction(()=>window.__codexGame.globals.ProgressionBattle.settled);
    const progression=await page.evaluate(async()=>{
      const game=window.__codexGame;
      return {heroes:game.state.entities.filter(a=>a.kind==='hero').map(a=>({level:a.currentLevel,hp:a.hp,exp:a.currentEXP})),results:game.globals.ProgressionResults};
    });
    await page.getByRole('dialog',{name:'Battle progression'}).waitFor({state:'visible'});
    await page.screenshot({path:path.join(artifactDir,`${viewport.name}-victory-progression.png`)});
    const geometry=await page.evaluate(()=>{
      const panel=document.querySelector('#battle-results'),shade=document.querySelector('#battle-results-shade');
      return {canvas:document.querySelector('#view').getBoundingClientRect().toJSON(),panel:panel.getBoundingClientRect().toJSON(),shade:shade.getBoundingClientRect().toJSON(),darkness:getComputedStyle(shade).backgroundColor,overflow:panel.scrollWidth>panel.clientWidth};
    });
    const {canvas:c,panel:p,shade:d}=geometry;
    results.push(invariant('results-canvas-relative-layout',Math.abs(p.width/c.width-.8)<.01&&Math.abs(p.height/c.height-.8)<.01&&Math.abs(p.x+p.width/2-c.x-c.width/2)<1&&Math.abs(p.y+p.height/2-c.y-c.height/2)<1&&Math.abs(d.width-c.width)<1&&Math.abs(d.height-c.height)<1&&Math.abs(d.x-c.x)<1&&Math.abs(d.y-c.y)<1&&geometry.darkness==='rgba(0, 0, 0, 0.4)'&&!geometry.overflow,geometry,{widthRatio:.8,heightRatio:.8,centered:true,combatShade:.4}));
    results.push(invariant('victory-progression-with-ko',progression.heroes.every(h=>h.level===6)&&progression.heroes[0].hp===0&&progression.results.every(r=>r.exp===3000&&r.unlocks.length>0),progression,{fullEXPForKO:true,level:6,unlocks:true}));
    await page.getByRole('dialog',{name:'Battle progression'}).getByRole('button',{name:'Continue',exact:true}).click();
  }
  const menu=page.getByRole('button',{name:'Menu',exact:true});

  await page.getByRole('button',{name:'HERO',exact:true}).click();
  await page.locator('#hero-details').waitFor({state:'visible'});
  const heroDetails=await page.locator('#hero-details').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth,text:el.innerText}));
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-hero-overview.png`)});
  const rosterBounds=await page.locator('#hero-details').evaluate(el=>{const p=el.getBoundingClientRect(),r=el.querySelector('.roster').getBoundingClientRect();return {contained:r.bottom<=p.bottom&&r.left>=p.left&&r.right<=p.right,articles:el.querySelectorAll('article').length};});
  results.push(invariant('hero-overview-disclosure',rosterBounds.contained&&rosterBounds.articles===0,rosterBounds,{contained:true,articles:0}));
  await page.locator('#hero-details').getByRole('button',{name:'SKILLS',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#hero-details article').length===7);
  const activeCount=await page.locator('#hero-details article').count();
  await page.getByRole('button',{name:'Passive',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#hero-details article').length===6);
  const passiveCount=await page.locator('#hero-details article').count();
  await page.locator('#hero-details').getByRole('button',{name:'FLOW',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#hero-details article').length===1);
  const specialCount=await page.locator('#hero-details article').count();
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-hero-details.png`)});
  results.push(invariant('hero-detail-canonical-kit',!heroDetails.overflow&&activeCount===7&&passiveCount===6&&specialCount===1&&heroDetails.text.includes('Coming next')&&!heroDetails.text.includes('How FLOW builds'),{heroDetails,activeCount,passiveCount,specialCount},{overflow:false,activeSkills:7,passives:6,special:1}));
  await page.locator('#hero-details').getByRole('button',{name:'Back',exact:true}).click();
  await page.evaluate(async()=>{
    const {createMarket,marketOffers}=await import('/web-runner/src/core/astralMarket.mjs');
    const {EQUIPMENT}=await import('/web-runner/src/core/equipment.mjs');
    const key='wishfire.equipment-economy.v1',record=JSON.parse(localStorage.getItem(key));record.gold=5000;record.items=[];record.loadouts={};
    let seed=1;do{record.market=createMarket(seed++,Date.now());}while(!marketOffers(record.market,Date.now()).some(o=>EQUIPMENT[o.equipmentId].type==='weapon'&&o.progress>.2&&o.progress<.65));
    localStorage.setItem(key,JSON.stringify(record));
  });
  await page.getByRole('button',{name:'FLOW',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#astral-market header')?.textContent.includes('5,000'));
  const offer=await page.evaluate(async()=>{
    const {EQUIPMENT}=await import('/web-runner/src/core/equipment.mjs');const {marketOffers}=await import('/web-runner/src/core/astralMarket.mjs');const g=window.__codexGame.globals;
    const o=marketOffers(g.Equipment.market,Date.now()).find(o=>EQUIPMENT[o.equipmentId].type==='weapon'&&o.progress>.2&&o.progress<.7);return {...o,name:EQUIPMENT[o.equipmentId].name};
  });
  await page.locator(`[data-offer="${offer.id}"]`).click({force:true});
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-astral-market.png`)});
  const marketGeometry=await page.locator('#astral-market').evaluate(p=>({overflow:p.scrollWidth>p.clientWidth,tracks:new Set([...p.querySelectorAll('.offer')].map(c=>c.style.getPropertyValue('--track'))).size,price:p.querySelector('[data-buy]').textContent}));
  await page.locator('#astral-market [data-buy]').click();
  await page.waitForFunction(id=>window.__codexGame.globals.Equipment.items.some(i=>i.instanceId===id),offer.id);
  const purchase=await page.evaluate(()=>({gold:window.__codexGame.globals.goldTotal,items:window.__codexGame.globals.Equipment.items}));
  results.push(invariant('astral-equipment-purchase',!marketGeometry.overflow&&marketGeometry.tracks===4&&marketGeometry.price.includes(String(offer.price))&&purchase.gold===5000-offer.price&&purchase.items.length===1&&purchase.items[0].equipmentId===offer.equipmentId,{marketGeometry,purchase,offer},{tracks:4,exactGold:true,exactItem:true}));
  await page.locator('#astral-market').getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'HERO',exact:true}).click();
  await page.locator('#hero-details').getByRole('button',{name:'GEAR',exact:true}).click();
  await page.locator('.equipment-grid').getByRole('button',{name:`Inspect ${offer.name}`,exact:true}).click();
  await page.locator('.equipment-detail').getByRole('button',{name:'Equip',exact:true}).click();
  await page.waitForFunction(id=>Object.values(window.__codexGame.globals.Equipment.loadouts).some(l=>l.weapon===id),offer.id);
  const equipped=await page.evaluate(()=>{const g=window.__codexGame.globals;const [heroId]=Object.entries(g.Equipment.loadouts).find(([,l])=>l.weapon);return {hero:g.HeroProgress.heroes[heroId],loadout:g.Equipment.loadouts[heroId],overflow:document.querySelector('#hero-details').scrollWidth>document.querySelector('#hero-details').clientWidth};});
  results.push(invariant('gear-canonical-stat-effect',!equipped.overflow&&equipped.loadout.weapon===offer.id&&Object.values(equipped.hero.equipmentStats||{}).some(v=>v>0),equipped,{canonicalGearStats:true}));
  await page.screenshot({path:path.join(artifactDir,`${viewport.name}-hero-gear.png`)});
  return results;
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
    const commandTurnInvariants = injectStageDrift ? [] : await captureCommandTurns(page, viewport, artifactDir);
    const results = [
      ...presentation.invariants,
      ...panelInvariants,
      ...combatInvariants,
      ...commandTurnInvariants,
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
    await page.locator('[aria-label="Entering combat"]').waitFor({state:'hidden'});
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
      await page.waitForFunction(() => window.__codexGame.state.entities.filter(actor => actor.kind === 'hero').every(hero => Number(hero.flow || 0) === 0));
      await page.waitForFunction(name => window.__codexGame.state.entities.filter(e=>e.kind==='enemy').length===1 && window.__codexGame.state.entities.some(e=>e.kind==='enemy' && e.name===name),enemy);
      await page.locator('[aria-label="Entering combat"]').waitFor({state:'hidden'});
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
      invariant('quest-outcome-and-cost',progress.revealed===2 && progress.resources===170 && progress.energy===200,progress,'one unlock, 30 spent, 50 awarded'),
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
