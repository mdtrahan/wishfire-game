#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESENTATION_PATHS = [
  'web-runner/index.html',
  'web-runner/systems/appShellViewport.js',
  'web-runner/systems/devToolingRuntime.js',
  'web-runner/systems/combatPresentationScale.mjs',
  'web-runner/systems/renderHarnessFallback.js',
  'web-runner/systems/renderRuntime.js',
];
const PRESENTATION_PATH_PATTERN = /^(?:package\.json|tools\/(?:prepare_commit_check\.sh|qa_presentation_gate\.mjs)|web-runner\/index\.html|web-runner\/systems\/(?:appShellViewport|combatPresentationScale|devToolingRuntime|render[^/]*)\.(?:m?js))$/;
const SCENARIOS = [
  { id: 'compact-landscape', width: 514, height: 289, dpr: 2.49 },
  { id: 'compact-portrait', width: 281, height: 472, dpr: 2.49 },
  { id: 'reference', width: 1024, height: 768, dpr: 1 },
];
const MIME = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.mjs': 'application/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function parseArgs(argv) {
  const parsed = { bead: '', approve: false, verifyOnly: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--bead') parsed.bead = String(argv[index += 1] || '');
    else if (value === '--approve') parsed.approve = true;
    else if (value === '--verify-only') parsed.verifyOnly = true;
    else if (value === '--help' || value === '-h') parsed.help = true;
    else throw new Error(`unknown argument: ${value}`);
  }
  return parsed;
}

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: options.encoding ?? 'utf8' });
}

function currentBranch() {
  return String(git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
}

function gitUser() {
  try {
    return String(git(['config', 'user.name'])).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function buildSourceHashFromEntries(entries) {
  const hash = createHash('sha256');
  for (const [name, content] of entries) {
    hash.update(String(name));
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function sourceHash() {
  const entries = presentationPaths().map((relPath) => {
    const content = execFileSync('git', ['show', `:${relPath}`], { cwd: ROOT });
    return [relPath, content];
  });
  return buildSourceHashFromEntries(entries);
}

function presentationPaths() {
  const staged = String(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])).trim().split('\n').filter(Boolean);
  return [...new Set([...PRESENTATION_PATHS, ...staged.filter((relPath) => PRESENTATION_PATH_PATTERN.test(relPath))])].sort();
}

function ensurePresentationIndexMatchesWorktree() {
  const changed = String(git(['diff', '--name-only', '--', ...presentationPaths()])).trim();
  if (changed) {
    throw new Error(`stage presentation files before QA:\n${changed}`);
  }
}

function artifactPath(bead) {
  return path.join(ROOT, '.beads', 'commit-check', `${bead}-presentation.json`);
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function rectsOverlap(a, b) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) > 0
    && Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)) > 0;
}

export function ratioDrift(actual, reference) {
  if (!(reference > 0)) return Number.POSITIVE_INFINITY;
  return Math.abs(actual - reference) / reference;
}

function runtimeFingerprint(branch, bead) {
  return `window.__ORKA_RUNTIME_FINGERPRINT__=${JSON.stringify({
    worktree: path.basename(ROOT),
    branch,
    issueId: bead,
    contracts: { ORKA69R_READY: true },
    generatedAt: new Date().toISOString(),
  })};`;
}

function startStaticServer(branch, bead) {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(String(request.url || '/').split('?')[0]);
    if (pathname === '/') {
      response.writeHead(302, { Location: '/web-runner/index.html' });
      response.end();
      return;
    }
    if (pathname === '/web-runner/runtime-fingerprint.js') {
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(runtimeFingerprint(branch, bead));
      return;
    }
    const candidate = path.normalize(path.join(ROOT, pathname));
    if (!candidate.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.stat(candidate, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      const contentType = MIME[path.extname(candidate)] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      fs.createReadStream(candidate).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/web-runner/index.html` });
    });
  });
}

async function captureMetrics(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height };
    };
    const canvas = document.querySelector('canvas');
    const canvasRect = rect(canvas);
    const overlays = [
      document.querySelector('[aria-label="Open developer tooling modal"]'),
      document.querySelector('#dev2-toggle'),
    ].filter(Boolean).map((element) => ({
      label: String(element.textContent || '').trim(),
      rect: rect(element),
      transform: getComputedStyle(element).transform,
    }));
    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      canvas: {
        rect: canvasRect,
        backing: { width: canvas.width, height: canvas.height },
        aspectRatio: canvasRect.width / canvasRect.height,
      },
      overlays,
      controlScale: getComputedStyle(document.documentElement).getPropertyValue('--orka-control-scale').trim(),
      canvasTextAudit: Array.isArray(window.__orkaCanvasTextAudit) ? window.__orkaCanvasTextAudit : [],
      combatTextAudit: Array.isArray(window.__orkaCombatTextAudit) ? window.__orkaCombatTextAudit : [],
      fingerprint: window.__ORKA_RUNTIME_FINGERPRINT__ || null,
    };
  });
}

function validateFrame(frame, scenario, bead, branch) {
  const failures = [];
  const canvas = frame.canvas.rect;
  if (Math.abs(frame.canvas.aspectRatio - (360 / 640)) > 0.01) failures.push('Canvas aspect ratio drifted');
  if (canvas.x < -0.5 || canvas.y < -0.5 || canvas.x + canvas.width > frame.viewport.width + 0.5 || canvas.y + canvas.height > frame.viewport.height + 0.5) {
    failures.push('Canvas is outside the viewport');
  }
  if (frame.overlays.length !== 2) failures.push('DEV launchers are missing');
  for (const overlay of frame.overlays) {
    const value = overlay.rect;
    if (rectsOverlap(canvas, value)) failures.push(`${overlay.label} overlaps the Canvas`);
    if (value.x < 0 || value.y < 0 || value.x + value.width > frame.viewport.width || value.y + value.height > frame.viewport.height) {
      failures.push(`${overlay.label} is outside the viewport`);
    }
  }
  if (frame.viewport.width !== scenario.width || frame.viewport.height !== scenario.height) {
    failures.push(`measured viewport ${frame.viewport.width}x${frame.viewport.height} differs from ${scenario.width}x${scenario.height}`);
  }
  if (frame.fingerprint?.issueId !== bead || frame.fingerprint?.branch !== branch) failures.push('runtime fingerprint mismatch');
  for (const text of frame.canvasTextAudit || []) {
    if ((text.widths || []).some(width => width > Number(text.maximumWidth || 0) + 0.5)) failures.push(`${text.key} text exceeds its Canvas bound`);
    if (text.truncated && !text.allowTruncate) failures.push(`${text.key} text was truncated`);
  }
  for (const text of frame.combatTextAudit || []) {
    if (Number(text.maximumWidth || 0) > 0 && Number(text.width || 0) > Number(text.maximumWidth || 0) + 0.5) failures.push(`${text.key} text exceeds its combat bound`);
  }
  const navigation = (frame.combatTextAudit || []).filter((text) => text.group === 'navigation').sort((a, b) => a.left - b.left);
  for (let index = 1; index < navigation.length; index += 1) {
    if (navigation[index].left < navigation[index - 1].right - 0.5) failures.push(`${navigation[index - 1].key} overlaps ${navigation[index].key}`);
  }
  return failures;
}

function writeContactSheet(outputDir, results) {
  const cards = results.flatMap((result) => result.frames.map((frame) => `
    <article>
      <h2>${result.scenario.id} / ${frame.state}</h2>
      <img src="${path.basename(frame.screenshot.path)}" alt="${result.scenario.id} ${frame.state}">
      <pre>${escapeHtml(JSON.stringify(frame.metrics, null, 2))}</pre>
    </article>`)).join('');
  const body = `<!doctype html><meta charset="utf-8"><title>Wishfire presentation gate</title>
  <style>body{margin:20px;background:#111;color:#eee;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}article{border:1px solid #555;padding:12px;background:#1b1b1b}img{display:block;max-width:100%;max-height:520px;margin:auto;background:#000}pre{overflow:auto;font-size:11px}</style>
  <h1>Wishfire presentation gate</h1><main>${cards}</main>`;
  const filePath = path.join(outputDir, 'report.html');
  fs.writeFileSync(filePath, body);
  return filePath;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character]));
}

async function runGate(bead) {
  ensurePresentationIndexMatchesWorktree();
  const branch = currentBranch();
  const hash = sourceHash();
  const outputDir = path.join('/tmp', 'codex-orka-presentation-gate', bead, hash.slice(0, 12));
  fs.mkdirSync(outputDir, { recursive: true });
  const { chromium } = await import('playwright');
  const { server, url } = await startStaticServer(branch, bead);
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const scenario of SCENARIOS) {
      const context = await browser.newContext({
        viewport: { width: scenario.width, height: scenario.height },
        deviceScaleFactor: scenario.dpr,
      });
      const page = await context.newPage();
      const browserProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') browserProblems.push(`${message.type()}: ${message.text()}`);
      });
      page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('canvas').waitFor({ state: 'visible' });
      await page.waitForFunction(() => window.__ORKA_RUNTIME_FINGERPRINT__?.issueId);
      await page.waitForTimeout(500);

      const frames = [];
      for (const state of ['startup', 'town', 'combat']) {
        if (state !== 'startup') {
          await page.locator('canvas').click({ position: { x: Math.max(1, scenario.width / 4), y: Math.max(1, scenario.height / 2) } });
          await page.waitForTimeout(state === 'town' ? 350 : 800);
        }
        const screenshotPath = path.join(outputDir, `${scenario.id}-${state}.png`);
        await page.screenshot({ path: screenshotPath });
        const metrics = await captureMetrics(page);
        frames.push({
          state,
          metrics,
          screenshot: { path: screenshotPath, sha256: sha256File(screenshotPath) },
          failures: validateFrame(metrics, scenario, bead, branch),
        });
      }
      results.push({ scenario, browserProblems, frames });
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const reference = results.find((result) => result.scenario.id === 'reference').frames[0].metrics;
  const referenceRatios = Object.fromEntries(reference.overlays.map((overlay) => [overlay.label, overlay.rect.width / reference.canvas.rect.width]));
  const failures = [];
  for (const result of results) {
    failures.push(...result.browserProblems.map((problem) => `${result.scenario.id}: ${problem}`));
    for (const frame of result.frames) {
      failures.push(...frame.failures.map((failure) => `${result.scenario.id}/${frame.state}: ${failure}`));
      for (const overlay of frame.metrics.overlays) {
        const drift = ratioDrift(overlay.rect.width / frame.metrics.canvas.rect.width, referenceRatios[overlay.label]);
        if (drift > 0.2) failures.push(`${result.scenario.id}/${frame.state}: ${overlay.label} ratio drift ${(drift * 100).toFixed(1)}%`);
      }
    }
  }
  const reportHtml = writeContactSheet(outputDir, results);
  const artifact = {
    bead,
    branch,
    generatedAt: new Date().toISOString(),
    sourceHash: hash,
    status: failures.length ? 'failed' : 'automated-pass',
    failures,
    reportHtml,
    referenceRatios,
    scenarios: results,
    visualReview: { status: 'required' },
  };
  fs.writeFileSync(artifactPath(bead), `${JSON.stringify(artifact, null, 2)}\n`);
  if (failures.length) throw new Error(`presentation gate failed:\n${failures.join('\n')}`);
  return artifact;
}

function readAndVerifyArtifact(bead, requireApproval) {
  ensurePresentationIndexMatchesWorktree();
  const filePath = artifactPath(bead);
  if (!fs.existsSync(filePath)) throw new Error(`missing presentation evidence: ${filePath}`);
  const artifact = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (artifact.status !== 'automated-pass') throw new Error(`presentation evidence status is ${artifact.status}`);
  if (artifact.sourceHash !== sourceHash()) throw new Error('presentation evidence is stale for the staged presentation source');
  for (const result of artifact.scenarios || []) {
    for (const frame of result.frames || []) {
      if (!fs.existsSync(frame.screenshot.path) || sha256File(frame.screenshot.path) !== frame.screenshot.sha256) {
        throw new Error(`missing or changed screenshot: ${frame.screenshot.path}`);
      }
    }
  }
  if (requireApproval && artifact.visualReview?.status !== 'approved') throw new Error(`visual review required: ${artifact.reportHtml}`);
  return { artifact, filePath };
}

function approveArtifact(bead) {
  const { artifact, filePath } = readAndVerifyArtifact(bead, false);
  artifact.visualReview = { status: 'approved', approvedAt: new Date().toISOString(), reviewer: gitUser() };
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

function usage() {
  return `Usage:\n  node tools/qa_presentation_gate.mjs --bead ORKA-id\n  node tools/qa_presentation_gate.mjs --approve --bead ORKA-id\n  node tools/qa_presentation_gate.mjs --verify-only --bead ORKA-id`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!/^ORKA-[A-Za-z0-9]+(?:\.[0-9]+)?$/.test(options.bead)) throw new Error('valid --bead is required');
  if (options.approve) {
    const artifact = approveArtifact(options.bead);
    console.log(`Visual evidence approved: ${artifact.reportHtml}`);
    return;
  }
  if (options.verifyOnly) {
    const { artifact } = readAndVerifyArtifact(options.bead, true);
    console.log(`Presentation evidence verified: ${artifact.reportHtml}`);
    return;
  }
  const artifact = await runGate(options.bead);
  console.log(`Automated presentation checks passed. Inspect before approval: ${artifact.reportHtml}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`[qa:presentation] ${error.message}`);
    process.exitCode = 1;
  });
}
