const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');
const appPath = path.join(repoRoot, 'web-runner', 'app.js');
const contractPath = path.join(repoRoot, 'governance', 'planning', 'app-js-ownership-contract.json');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function lineCount(text) {
  return text.split(/\r?\n/).length;
}

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('app.js stays below the orchestration boundary line ceiling', () => {
  const appSrc = readText(appPath);
  const contract = JSON.parse(readText(contractPath));
  const actualLines = lineCount(appSrc);

  assert.equal(contract.target, 'web-runner/app.js');
  assert.ok(
    actualLines <= contract.maxLines,
    `web-runner/app.js has ${actualLines} lines; max allowed is ${contract.maxLines}. Move implementation to an owned module instead of growing the orchestrator.`,
  );
});

test('app.js keeps extracted responsibilities in their owner modules', () => {
  const appSrc = readText(appPath);
  const contract = JSON.parse(readText(contractPath));

  for (const delegate of contract.requiredDelegates) {
    assert.match(
      appSrc,
      new RegExp(`\\b${delegate}\\b`),
      `app.js must keep delegating through ${delegate}`,
    );
  }

  for (const entry of contract.forbiddenAppJsPatterns) {
    assert.doesNotMatch(
      appSrc,
      new RegExp(entry.pattern),
      `${entry.reason}; forbidden pattern: ${entry.pattern}`,
    );
  }
});

test('app.js wrappers for moved responsibilities stay thin', () => {
  const appSrc = readText(appPath);
  const contract = JSON.parse(readText(contractPath));

  for (const wrapper of contract.smallWrapperContracts) {
    const source = extractFunctionSource(appSrc, wrapper.functionName);
    const lines = lineCount(source);
    assert.ok(
      lines <= wrapper.maxLines,
      `${wrapper.functionName} is ${lines} lines; max allowed is ${wrapper.maxLines}. Keep this as wiring only.`,
    );
    assert.match(
      source,
      new RegExp(wrapper.mustInclude.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${wrapper.functionName} must delegate to its owner module`,
    );
  }
});

test('app.js ownership contract names real owner modules', () => {
  const contract = JSON.parse(readText(contractPath));
  const owners = [
    'web-runner/systems/devToolingRuntime.js',
    'web-runner/systems/appShellViewport.js',
    'web-runner/systems/storyCardPresentation.js',
    'web-runner/systems/runtimeLayoutRegistry.js',
    'web-runner/systems/surfaceRenderRouter.js',
    'web-runner/systems/pointerRoutingShell.js',
    'web-runner/systems/combatSessionInitializer.js',
    'web-runner/systems/runtimeVisualAssetLoader.js',
    'web-runner/systems/devBrowserTestHooks.js',
  ];

  for (const owner of owners) {
    assert.equal(fs.existsSync(path.join(repoRoot, owner)), true, `${owner} must exist`);
  }
  assert.ok(Array.isArray(contract.allowedResponsibilities));
  assert.ok(Array.isArray(contract.forbiddenResponsibilities));
});
