// Full `npm test` runner. Browser-driven files each launch Chromium and time out when the
// default node --test concurrency runs a dozen of them at once, so they run one at a time
// after the parallel pass over every other test file. Extra arguments pass through to both runs.
import './ensure_simulation_core.cjs';
import { globSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requested = process.argv.slice(2).filter(arg => /^tests\/.*\.test\.[cm]?js$/.test(arg));
const files = requested.length ? requested : globSync('tests/**/*.test.{js,mjs,cjs}').sort();
const browser = file => /from ['"]playwright['"]|require\(['"]playwright['"]\)|playwright_support/.test(readFileSync(file, 'utf8'));
const browserFiles = files.filter(browser), otherFiles = files.filter(file => !browser(file));
const extra = process.argv.slice(2).filter(arg => !requested.includes(arg));

function run(label, args) {
  console.log(`\n# ${label}`);
  return spawnSync(process.execPath, ['--test', ...extra, ...args], { stdio: 'inherit' }).status ?? 1;
}

const parallel = otherFiles.length ? run(`parallel: ${otherFiles.length} files`, otherFiles) : 0;
const serial = browserFiles.length ? run(`browser, one at a time: ${browserFiles.length} files`, ['--test-concurrency=1', ...browserFiles]) : 0;
process.exit(parallel || serial);
