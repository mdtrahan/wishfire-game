// Full `npm test` runner. Browser-driven files each launch Chromium and time out when the
// default node --test concurrency runs a dozen of them at once, so they run one at a time
// after the parallel pass over every other test file. Extra arguments pass through to both runs.
import { globSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = globSync('tests/**/*.test.{js,mjs,cjs}').sort();
const browser = file => /from ['"]playwright['"]|require\(['"]playwright['"]\)|playwright_support/.test(readFileSync(file, 'utf8'));
const browserFiles = files.filter(browser), otherFiles = files.filter(file => !browser(file));
const extra = process.argv.slice(2);

function run(label, args) {
  console.log(`\n# ${label}`);
  return spawnSync(process.execPath, ['--test', ...extra, ...args], { stdio: 'inherit' }).status ?? 1;
}

const parallel = run(`parallel: ${otherFiles.length} files`, otherFiles);
const serial = run(`browser, one at a time: ${browserFiles.length} files`, ['--test-concurrency=1', ...browserFiles]);
process.exit(parallel || serial);
