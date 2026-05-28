#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const {
  classifyPlaywrightFailure,
  detectChromeExecutable,
  getErrorText,
  normalizeCdpUrl,
  parseArgs,
  readText,
  waitForJsonEndpoint,
} = require('./playwright_support');

function readTimeout(input, fallback) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function summarizeError(error) {
  return getErrorText(error).split('\n')[0] || 'Unknown failure';
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
    const preview = fs.readFileSync(candidates[0].fullPath, 'utf8').slice(0, 4000);
    return {
      path: candidates[0].fullPath,
      preview,
    };
  } catch {
    return null;
  }
}

function buildFailurePayload(error, startedAt, crashPrefixes = []) {
  let failure = classifyPlaywrightFailure(error);
  const crashReport = loadRecentCrashReport(crashPrefixes, startedAt);
  if (crashReport) {
    const crashFailure = classifyPlaywrightFailure(crashReport.preview);
    if (
      failure.code === 'browser_closed_before_control' &&
      crashFailure.code !== 'unknown_failure'
    ) {
      failure = {
        ...crashFailure,
        detail: `${crashFailure.detail} | crashReport=${crashReport.path}`,
      };
    }
  }
  return {
    message: summarizeError(error),
    failure,
  };
}

async function withTimeout(promise, timeoutMs, label) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runLaunchProbe(name, launchFn, timeoutMs, crashPrefixes = []) {
  const started = Date.now();
  let browser = null;
  try {
    browser = await withTimeout(launchFn(), timeoutMs, `${name} launch`);
    const page = await withTimeout(browser.newPage(), timeoutMs, `${name} newPage`);
    await withTimeout(
      page.goto(`data:text/html,<title>${name}-ok</title><h1>${name}</h1>`, { waitUntil: 'load' }),
      timeoutMs,
      `${name} goto`,
    );
    const title = await page.title();
    await page.close({ runBeforeUnload: false });
    await browser.close();
    return {
      name,
      status: 'pass',
      title,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    try {
      if (browser) await browser.close();
    } catch {}
    const failurePayload = buildFailurePayload(error, started, crashPrefixes);
    return {
      name,
      status: 'fail',
      durationMs: Date.now() - started,
      ...failurePayload,
    };
  }
}

async function runCdpProbe(cdpUrl, timeoutMs) {
  if (!readText(cdpUrl)) {
    return {
      name: 'cdp_attach',
      status: 'skipped',
      message: 'No --cdpUrl provided',
    };
  }
  const started = Date.now();
  let browser = null;
  let page = null;
  try {
    const normalized = normalizeCdpUrl(cdpUrl);
    const meta = await waitForJsonEndpoint(`${normalized}/json/version`, timeoutMs);
    browser = await withTimeout(chromium.connectOverCDP(normalized), timeoutMs, 'cdp attach');
    const context = browser.contexts()[0] || await browser.newContext();
    page = await withTimeout(context.newPage(), timeoutMs, 'cdp newPage');
    await withTimeout(
      page.goto('data:text/html,<title>codex-cdp-probe</title><h1>cdp probe</h1>', { waitUntil: 'load' }),
      timeoutMs,
      'cdp goto',
    );
    const title = await page.title();
    await page.close({ runBeforeUnload: false });
    await browser.close();
    return {
      name: 'cdp_attach',
      status: 'pass',
      title,
      durationMs: Date.now() - started,
      browserVersion: meta.Browser || '',
    };
  } catch (error) {
    try {
      if (page) await page.close({ runBeforeUnload: false });
    } catch {}
    try {
      if (browser) await browser.close();
    } catch {}
    return {
      name: 'cdp_attach',
      status: 'fail',
      durationMs: Date.now() - started,
      message: summarizeError(error),
      failure: classifyPlaywrightFailure(error),
    };
  }
}

function deriveRecommendation(results, cdpUrl) {
  const cdpResult = results.find((result) => result.name === 'cdp_attach');
  const directFailures = results.filter((result) => result.status === 'fail' && result.name !== 'cdp_attach');
  const directLaunchBlocked = directFailures.length > 0 && directFailures.every((result) => (
    result.failure?.code === 'sandbox_browser_startup_denied' ||
    result.failure?.code === 'browser_closed_before_control' ||
    result.failure?.code === 'browser_crashed'
  ));

  if (cdpResult?.status === 'pass') {
    return 'CDP attach is available. Treat direct launch as optional and run game tests through BALANCE_CDP_URL.';
  }
  if (readText(cdpUrl) && cdpResult?.status === 'fail') {
    return `CDP attach is blocked (${cdpResult.failure?.code || 'unknown_failure'}). Fix that before running the game harness.`;
  }
  if (!readText(cdpUrl) && directLaunchBlocked) {
    return 'Direct launch is sandbox-blocked here. Start Chrome externally with npm run chrome:cdp, then rerun this doctor with --cdpUrl.';
  }
  return 'Review the failing probes and fix the first startup/attach blocker before running the game harness.';
}

function printHumanSummary(results, recommendation) {
  console.log('Playwright doctor');
  for (const result of results) {
    if (result.status === 'pass') {
      console.log(`- ${result.name}: pass (${result.title || result.browserVersion || 'ok'})`);
      continue;
    }
    if (result.status === 'skipped') {
      console.log(`- ${result.name}: skipped (${result.message})`);
      continue;
    }
    console.log(`- ${result.name}: fail (${result.failure?.code || 'unknown_failure'})`);
    console.log(`  ${result.failure?.summary || result.message}`);
  }
  console.log(`Recommendation: ${recommendation}`);
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const only = readText(args.only, 'all');
  const timeoutMs = readTimeout(args.timeoutMs || env.PLAYWRIGHT_DOCTOR_TIMEOUT_MS, 12000);
  const cdpUrl = readText(args.cdpUrl || env.BALANCE_CDP_URL);
  const executablePath = detectChromeExecutable();
  const results = [];

  if (only === 'all' || only === 'direct' || only === 'bundled') {
    results.push(await runLaunchProbe(
      'bundled_chromium',
      () => chromium.launch({ headless: true }),
      timeoutMs,
      ['chrome-headless-shell'],
    ));
  }
  if (only === 'all' || only === 'direct' || only === 'chrome') {
    if (!executablePath) {
      results.push({
        name: 'system_chrome',
        status: 'skipped',
        message: 'Chrome executable not found',
      });
    } else {
      results.push(
        await runLaunchProbe(
          'system_chrome',
          () => chromium.launch({ headless: true, executablePath }),
          timeoutMs,
          ['Google Chrome'],
        ),
      );
    }
  }
  if (only === 'all' || only === 'cdp') {
    results.push(await runCdpProbe(cdpUrl, timeoutMs));
  }

  const recommendation = deriveRecommendation(results, cdpUrl);
  const payload = {
    results,
    recommendation,
  };

  if (args.json === 'true') {
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  }
  printHumanSummary(results, recommendation);
  console.log(JSON.stringify(payload, null, 2));
  return payload;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[playwright:doctor] failed:', error);
    process.exitCode = 1;
  });
} else {
  module.exports = {
    deriveRecommendation,
    main,
    runCdpProbe,
    runLaunchProbe,
  };
}
