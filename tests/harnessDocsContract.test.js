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

test('pm and dev prompt files are removed from the active repo surface', () => {
  const removedPaths = ['agents/prompts/pm_agent.md', 'agents/prompts/dev_agent.md'];
  for (const removedPath of removedPaths) {
    const entry = registry.entries.find((candidate) => candidate.path === removedPath);
    assert.equal(entry, undefined, `${removedPath} should not remain in the registry`);
    assert.equal(fs.existsSync(path.join(repoRoot, removedPath)), false, `${removedPath} should be removed`);
  }
});

test('AGENTS.md exposes the default subagent escalation map', () => {
  const agents = readRepoFile('AGENTS.md');
  assert.match(agents, /## Subagent Escalation/);
  assert.match(agents, /`search-specialist`: ownership lookup and fast codebase search\./);
  assert.match(agents, /`debugger`: deep root-cause isolation\./);
  assert.match(agents, /`game-developer`: gameplay\/runtime\/render-loop implementation\./);
  assert.match(agents, /`refactoring-specialist`: behavior-preserving structural cleanup\./);
  assert.match(agents, /`reviewer`: optional escalation for large or risky diffs only\./);
});

test('AGENTS.md makes jcodemunch the first path for large or hot code surfaces', () => {
  const agents = readRepoFile('AGENTS.md');
  assert.match(agents, /## Retrieval Order/);
  assert.match(agents, /Use `jcodemunch` first on hot or large files, then open the smallest owning seam before broad reads\./);
  assert.match(agents, /`web-runner\/app\.js`/);
  assert.match(agents, /`web-runner\/modules\/functionBank\.js`/);
  assert.match(agents, /`Scripts\/functionBank\.js`/);
});

test('AGENTS.md routes noisy shell output through rtk without replacing jcodemunch', () => {
  const agents = readRepoFile('AGENTS.md');
  assert.match(agents, /## Hot Surfaces \+ Retrieval Rules/);
  assert.match(agents, /Use `rtk` for noisy shell output when available:/);
  assert.match(agents, /`rtk git status`/);
  assert.match(agents, /`rtk git diff`/);
  assert.match(agents, /`rtk grep`/);
  assert.match(agents, /`rtk test`/);
  assert.match(agents, /If the owning seam explains the behavior, do not open or edit a larger hot surface\./);
});

test('AGENTS.md stays map-like by pushing strategy into the refactor vectors reference', () => {
  const agents = readRepoFile('AGENTS.md');
  assert.doesNotMatch(agents, /## Refactor Vectors/);
  assert.doesNotMatch(agents, /## Safe Cleanup Order/);
  assert.match(agents, /## Operational Links/);
  assert.match(agents, /docs\/references\/refactor-vectors\.md/);
});

test('project subagent configs use the lean default model split', () => {
  const expectedModels = new Map([
    ['.codex/agents/search-specialist.toml', 'gpt-5.4-mini'],
    ['.codex/agents/product-manager.toml', 'gpt-5.2'],
    ['.codex/agents/debugger.toml', 'gpt-5.2'],
    ['.codex/agents/game-developer.toml', 'gpt-5.2'],
    ['.codex/agents/javascript-pro.toml', 'gpt-5.2'],
    ['.codex/agents/refactoring-specialist.toml', 'gpt-5.2'],
    ['.codex/agents/reviewer.toml', 'gpt-5.2'],
  ]);

  for (const [relPath, model] of expectedModels) {
    const contents = readRepoFile(relPath);
    assert.match(contents, new RegExp(`model = "${model.replace('.', '\\.')}"`));
    assert.ok(lineCount(relPath) <= 30, `${relPath} exceeds lean agent budget`);
  }
});
