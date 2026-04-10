const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, 'docs', 'knowledge-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function lineCount(relPath) {
  return readRepoFile(relPath).trimEnd().split('\n').length;
}

test('AGENTS.md is the only active map and stays within budget', () => {
  const activeMaps = registry.entries.filter((entry) => entry.role === 'map' && entry.status === 'active');
  assert.equal(activeMaps.length, 1);
  assert.equal(activeMaps[0].path, 'AGENTS.md');
  assert.ok(lineCount('AGENTS.md') <= 180, 'AGENTS.md exceeds hard line budget');
});

test('compatibility shims stay short and point to canonical replacements', () => {
  const shimPaths = ['README.md', 'claude.md', 'ai-memory/project.md', 'docs/backend/browser-backend-policy.md'];
  for (const shimPath of shimPaths) {
    const entry = registry.entries.find((candidate) => candidate.path === shimPath);
    assert.ok(entry, `Missing registry entry for ${shimPath}`);
    assert.equal(entry.status, 'superseded');
    const contents = readRepoFile(shimPath);
    assert.match(contents, /Canonical replacement:/);
    assert.ok(lineCount(shimPath) <= 20, `${shimPath} is too large for a shim`);
  }
});

test('active registry entries exist and generated paths stay out of AGENTS.md', () => {
  for (const entry of registry.entries.filter((candidate) => candidate.status === 'active')) {
    assert.ok(fs.existsSync(path.join(repoRoot, entry.path)), `Missing active doc ${entry.path}`);
    assert.ok(entry.role, `Missing role for ${entry.path}`);
  }

  const agents = readRepoFile('AGENTS.md');
  for (const generatedRoot of registry.generatedRoots) {
    assert.ok(!agents.includes(generatedRoot), `AGENTS.md should not route through generated root ${generatedRoot}`);
  }
});

test('browser policy has one canonical active owner', () => {
  const activeBrowserPolicies = registry.entries.filter((entry) =>
    entry.path.includes('browser-policy') && entry.status === 'active' && entry.canonical
  );
  assert.equal(activeBrowserPolicies.length, 1);
  assert.equal(activeBrowserPolicies[0].path, 'docs/qa/browser-policy.md');
});

test('active dev handoff file stays small and recent', () => {
  const devReports = readRepoFile('agents/dev_reports.md');
  const liveEntries = [...devReports.matchAll(/^- bead id:/gm)].slice(1);
  assert.ok(liveEntries.length <= 7, 'agents/dev_reports.md should keep only a short recent window');
  assert.ok(lineCount('agents/dev_reports.md') <= 120, 'agents/dev_reports.md exceeds live handoff budget');
  assert.match(
    devReports,
    /agents\/archive\/dev_reports_archive\.md/,
    'agents/dev_reports.md must point to the historical archive'
  );
});

test('pm and dev prompts stay thin and defer durable policy', () => {
  const promptPaths = ['agents/prompts/pm_agent.md', 'agents/prompts/dev_agent.md'];
  for (const promptPath of promptPaths) {
    const contents = readRepoFile(promptPath);
    assert.ok(lineCount(promptPath) <= 180, `${promptPath} exceeds prompt budget`);
    assert.match(contents, /AGENTS\.md/);
    assert.match(contents, /governance\/execution\/beads-process\.md/);
  }
});
