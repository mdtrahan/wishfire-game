const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

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

function readText(input, fallback = '') {
  return typeof input === 'string' && input.trim() ? input.trim() : fallback;
}

function readBool(input, fallback = false) {
  if (typeof input === 'boolean') return input;
  const normalized = readText(typeof input === 'number' ? String(input) : input).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
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
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode || 0} while reading ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function waitForJsonEndpoint(url, timeoutMs = 5000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await httpGetJson(url);
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw lastError || new Error(`Endpoint did not respond in time: ${url}`);
}

function detectChromeExecutable() {
  const candidates = [
    process.env.BALANCE_BROWSER_EXECUTABLE,
    process.env.PLAYWRIGHT_BROWSER_EXECUTABLE,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function createFreshChromeProfileDir(prefix = 'orka-chrome-cdp-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function normalizeCdpUrl(cdpUrl) {
  return readText(cdpUrl).replace(/\/$/, '');
}

function getErrorText(error) {
  return String(error?.stack || error?.message || error || '').trim();
}

function classifyPlaywrightFailure(error) {
  const text = getErrorText(error);
  const lower = text.toLowerCase();
  if (!lower) {
    return {
      code: 'unknown_failure',
      summary: 'Unknown Playwright/browser failure',
      detail: '',
    };
  }
  if (
    /machportrendezvousserver/.test(lower) ||
    /bootstrap_check_in/.test(lower) ||
    /crashpad\/settings\.dat/.test(lower) ||
    /child_port_handshake/.test(lower) ||
    /transformprocesstype/.test(lower) ||
    /registerapplication/.test(lower) ||
    /hiservices/.test(lower) ||
    /operation not permitted from sandbox/.test(lower) ||
    /klsnoexecutableerr/.test(lower)
  ) {
    return {
      code: 'sandbox_browser_startup_denied',
      summary: 'Browser startup was denied by the Codex/macOS sandbox',
      detail: text.split('\n').slice(0, 4).join(' | '),
    };
  }
  if (
    /not authorized to send apple events/.test(lower) ||
    /appleevents/.test(lower) ||
    /apple events/.test(lower) ||
    /erraeventnotpermitted/.test(lower)
  ) {
    return {
      code: 'automation_permission_denied',
      summary: 'macOS Automation permission denied app-to-app control',
      detail: text.split('\n').slice(0, 4).join(' | '),
    };
  }
  if (
    (/accessibility/.test(lower) || /tcc/.test(lower)) &&
    (/denied/.test(lower) || /not permitted/.test(lower) || /unauthorized/.test(lower))
  ) {
    return {
      code: 'accessibility_permission_denied',
      summary: 'macOS Accessibility/TCC permission denied browser control',
      detail: text.split('\n').slice(0, 4).join(' | '),
    };
  }
  if (
    /econnrefused/.test(lower) ||
    /econnreset/.test(lower) ||
    /ehostunreach/.test(lower) ||
    /retrieving websocket url/.test(lower)
  ) {
    return {
      code: 'cdp_unreachable',
      summary: 'CDP endpoint was unreachable from Codex',
      detail: text.split('\n').slice(0, 4).join(' | '),
    };
  }
  if (/target page, context or browser has been closed/.test(lower)) {
    return {
      code: 'browser_closed_before_control',
      summary: 'Browser closed before Playwright established control',
      detail: text.split('\n').slice(0, 4).join(' | '),
    };
  }
  if (/sigabrt/.test(lower) || /sigtrap/.test(lower) || /abort trap/.test(lower)) {
    return {
      code: 'browser_crashed',
      summary: 'Browser crashed during startup or attach',
      detail: text.split('\n').slice(0, 4).join(' | '),
    };
  }
  return {
    code: 'unknown_failure',
    summary: 'Unknown Playwright/browser failure',
    detail: text.split('\n').slice(0, 4).join(' | '),
  };
}

module.exports = {
  classifyPlaywrightFailure,
  createFreshChromeProfileDir,
  detectChromeExecutable,
  getErrorText,
  httpGetJson,
  normalizeCdpUrl,
  parseArgs,
  readBool,
  readText,
  sleep,
  waitForJsonEndpoint,
};
