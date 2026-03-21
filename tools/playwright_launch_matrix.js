#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const {
  classifyPlaywrightFailure,
  createFreshChromeProfileDir,
  detectChromeExecutable,
  parseArgs,
  readText,
  sleep,
  waitForJsonEndpoint,
} = require('./playwright_support');
const { runLaunchProbe } = require('./playwright_doctor');

function readTimeout(input, fallback) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function buildChromeSpawnArgs({ port, profileDir, headless }) {
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
  if (headless) args.push('--headless=new');
  args.push('about:blank');
  return args;
}

function loadRecentCrashReport(prefixes, startedAt) {
  const crashDir = path.join(os.homedir(), 'Library', 'Logs', 'DiagnosticReports');
  try {
    const candidates = fs.readdirSync(crashDir)
      .filter((name) => prefixes.some((prefix) => name.startsWith(prefix)) && name.endsWith('.ips'))
      .map((name) => {
        const fullPath = path.join(crashDir, name);
        const stat = fs.statSync(fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs };
      })
      .filter((entry) => entry.mtimeMs >= startedAt - 5000)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (!candidates.length) return null;
    return fs.readFileSync(candidates[0].fullPath, 'utf8').slice(0, 4000);
  } catch {
    return null;
  }
}

async function stopChild(child) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {}
  await sleep(500);
  if (!child.killed) {
    try {
      child.kill('SIGKILL');
    } catch {}
  }
}

async function runSpawnProbe(name, executablePath, { port, headless, timeoutMs }) {
  const started = Date.now();
  const profileDir = createFreshChromeProfileDir(`orka-${name}-`);
  const args = buildChromeSpawnArgs({ port, profileDir, headless });
  const child = spawn(executablePath, args, { stdio: 'ignore' });
  let exitInfo = null;
  child.once('exit', (code, signal) => {
    exitInfo = { code, signal };
  });

  try {
    const meta = await waitForJsonEndpoint(`http://127.0.0.1:${port}/json/version`, timeoutMs);
    await stopChild(child);
    return {
      name,
      status: 'pass',
      durationMs: Date.now() - started,
      browserVersion: meta.Browser || '',
      mode: headless ? 'spawn-headless' : 'spawn-ui',
    };
  } catch (error) {
    await stopChild(child);
    const crashPreview = loadRecentCrashReport(['Google Chrome', 'chrome_crashpad_handler'], started);
    const failure = crashPreview
      ? classifyPlaywrightFailure(crashPreview)
      : classifyPlaywrightFailure(error);
    return {
      name,
      status: 'fail',
      durationMs: Date.now() - started,
      mode: headless ? 'spawn-headless' : 'spawn-ui',
      exitInfo,
      failure,
    };
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const timeoutMs = readTimeout(args.timeoutMs, 8000);
  const executablePath = detectChromeExecutable();
  const results = [];

  results.push(await runLaunchProbe(
    'pw_bundled_chromium',
    () => chromium.launch({ headless: true }),
    timeoutMs,
    ['chrome-headless-shell'],
  ));

  if (!executablePath) {
    results.push({
      name: 'pw_system_chrome',
      status: 'skipped',
      message: 'Chrome executable not found',
    });
    results.push({
      name: 'spawn_system_chrome_ui',
      status: 'skipped',
      message: 'Chrome executable not found',
    });
    results.push({
      name: 'spawn_system_chrome_headless',
      status: 'skipped',
      message: 'Chrome executable not found',
    });
  } else {
    results.push(await runLaunchProbe(
      'pw_system_chrome',
      () => chromium.launch({ headless: true, executablePath }),
      timeoutMs,
      ['Google Chrome'],
    ));
    results.push(await runSpawnProbe('spawn_system_chrome_ui', executablePath, {
      port: 9331,
      headless: false,
      timeoutMs,
    }));
    results.push(await runSpawnProbe('spawn_system_chrome_headless', executablePath, {
      port: 9332,
      headless: true,
      timeoutMs,
    }));
  }

  let recommendation = 'Review launch matrix output.';
  const passingSpawnProbe = results.find((result) => result.name.startsWith('spawn_system_chrome') && result.status === 'pass');
  const passingPlaywrightProbe = results.find((result) => result.name.startsWith('pw_') && result.status === 'pass');
  if (passingSpawnProbe && !passingPlaywrightProbe) {
    recommendation = 'Plain child-process Chrome launch still works under Codex; investigate Playwright-specific launch flags and startup mode changes.';
  } else if (!passingSpawnProbe && !passingPlaywrightProbe) {
    recommendation = 'Any Codex-owned Chrome startup appears blocked here; keep external Terminal bootstrap as the reliable path and treat direct launch recovery as a platform issue.';
  } else if (passingSpawnProbe && passingPlaywrightProbe) {
    recommendation = 'Direct launch paths are healthy in this environment.';
  }

  console.log(JSON.stringify({ results, recommendation }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[playwright:launch-matrix] failed:', error);
    process.exitCode = 1;
  });
} else {
  module.exports = {
    buildChromeSpawnArgs,
    main,
  };
}
