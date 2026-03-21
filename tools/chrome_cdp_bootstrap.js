#!/usr/bin/env node
const { spawn } = require('node:child_process');

const {
  createFreshChromeProfileDir,
  detectChromeExecutable,
  parseArgs,
  readText,
  waitForJsonEndpoint,
} = require('./playwright_support');

function readPort(input, fallback) {
  const value = Number(input);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function buildChromeLaunchArgs({ port, profileDir, startUrl }) {
  return [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    startUrl,
  ];
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const port = readPort(args.port || env.PLAYWRIGHT_CDP_PORT, 9222);
  const timeoutMs = readPort(args.timeoutMs || env.PLAYWRIGHT_CDP_TIMEOUT_MS, 15000);
  const profileDir = readText(args.profileDir) || createFreshChromeProfileDir();
  const executablePath = detectChromeExecutable();
  if (!executablePath) {
    throw new Error('Google Chrome executable not found. Install Chrome or set BALANCE_BROWSER_EXECUTABLE.');
  }

  const launchArgs = buildChromeLaunchArgs({
    port,
    profileDir,
    startUrl: readText(args.startUrl, 'about:blank'),
  });
  const child = spawn(executablePath, launchArgs, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const cdpUrl = `http://127.0.0.1:${port}`;
  const meta = await waitForJsonEndpoint(`${cdpUrl}/json/version`, timeoutMs);
  const payload = {
    executablePath,
    pid: child.pid,
    profileDir,
    cdpUrl,
    browser: meta.Browser || '',
    webSocketDebuggerUrl: meta.webSocketDebuggerUrl || '',
    nextStep: `BALANCE_CDP_URL=${cdpUrl} npm run playwright:doctor -- --only cdp --cdpUrl ${cdpUrl}`,
  };
  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[chrome:cdp] failed:', error);
    process.exitCode = 1;
  });
} else {
  module.exports = {
    buildChromeLaunchArgs,
    main,
  };
}
