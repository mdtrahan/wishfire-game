const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');

function readCurrentParserResults() {
  const probe = String.raw`
import importlib.util
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
sys.path.insert(0, str(root / "tools"))
module_paths = {
    "commit_compliance": root / "tools" / "commit_compliance.py",
    "hot_file_scope": root / "tools" / "hot_file_scope.py",
}
diff_text = "\n".join([
    "@@ -1,0 +2,3 @@",
    "+alpha",
    "+beta",
    "+gamma",
    "@@ -8 +9 @@",
    "+delta",
    "@@ -12,2 +20,0 @@",
])
source_lines = [
    "// module header",
    "export function alpha() {",
    "  return 1;",
    "}",
    "const beta = async () => {",
    "  return 2;",
    "}",
    "let gamma = function () {",
    "  return 3;",
    "}",
    "var delta = value => {",
    "  return value;",
    "}",
]

results = {}
for module_name, module_path in module_paths.items():
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    results[module_name] = {
        "changed_lines": module.parse_changed_lines(diff_text),
        "function_ranges": module.parse_function_ranges(source_lines),
    }

print(json.dumps(results))
`;
  const result = spawnSync('python3', ['-c', probe, repoRoot], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('commit-gate parsers agree on diff hunks and JavaScript function ranges', () => {
  const results = readCurrentParserResults();
  const expected = {
    changed_lines: [2, 3, 4, 9],
    function_ranges: [
      ['alpha', 2, 4],
      ['beta', 5, 7],
      ['gamma', 8, 10],
      ['delta', 11, 13],
    ],
  };

  assert.deepEqual(results.commit_compliance, expected);
  assert.deepEqual(results.hot_file_scope, expected);
});
