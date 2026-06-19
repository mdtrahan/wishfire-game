#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREPARE_SCRIPT="${ROOT}/tools/prepare_commit_check.sh"
ENFORCE_SCRIPT="${ROOT}/tools/enforce_commit_check.sh"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/commit-compliance-test.XXXXXX")"
TEST_ROOT="${TMP_DIR}/repo"
BD_SHIM_DIR="${TMP_DIR}/bin"
BD_STATE="${TMP_DIR}/bd-state.json"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TEST_ROOT/src" "$TEST_ROOT/web-runner/modules" "$TEST_ROOT/web-runner" "$TEST_ROOT/Scripts" "$TEST_ROOT/.beads/hot-file-lock" "$BD_SHIM_DIR"
cd "$TEST_ROOT"

git init -q
git config user.name "Codex Test"
git config user.email "codex@example.com"

cat > src/a.js <<'EOF'
function alpha() {
  return 1;
}
EOF

cat > src/b.js <<'EOF'
function beta() {
  return 2;
}
EOF

cat > src/c.js <<'EOF'
function gamma() {
  return 3;
}
EOF

cat > web-runner/modules/functionBank.js <<'EOF'
function getDropRate() {
  const base = 10;
  return base;
}
EOF

cat > Scripts/functionBank.js <<'EOF'
function getDropRate() {
  const base = 10;
  return base;
}
EOF

cat > web-runner/app.js <<'EOF'
function refreshCombatSessionFromDevTooling() {
  return 'refresh';
}
EOF

git add src/a.js src/b.js src/c.js web-runner/modules/functionBank.js Scripts/functionBank.js web-runner/app.js
git commit -q -m "test: seed fixture bd-ORKA-seed"

cat > "$BD_STATE" <<'EOF'
{"statuses":{"ORKA-test":"closed","ORKA-other":"in_progress"}}
EOF

cat > "${BD_SHIM_DIR}/bd" <<'EOF'
#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

state_path = Path(os.environ["COMMIT_COMPLIANCE_TEST_STATE"])
state = json.loads(state_path.read_text())
statuses = state["statuses"]
args = sys.argv[1:]

if args[:1] == ["ready"] and "--json" in args:
    print("[]")
    raise SystemExit(0)

if args[:1] == ["list"] and "--status=in_progress" in args and "--json" in args:
    rows = [{"id": issue_id} for issue_id, status in statuses.items() if status == "in_progress"]
    print(json.dumps(rows))
    raise SystemExit(0)

if args[:1] == ["show"] and len(args) >= 2:
    issue_id = args[1]
    status = statuses.get(issue_id)
    if not status:
        raise SystemExit(1)
    print(f"◐ {issue_id} · test [{status.upper()}]")
    raise SystemExit(0)

if args[:1] == ["update"] and len(args) >= 4 and args[2] == "--status":
    issue_id = args[1]
    status = args[3]
    statuses[issue_id] = status
    state_path.write_text(json.dumps(state))
    print(f"updated {issue_id} -> {status}")
    raise SystemExit(0)

print("unsupported bd shim args", args, file=sys.stderr)
raise SystemExit(1)
EOF
chmod +x "${BD_SHIM_DIR}/bd"

export PATH="${BD_SHIM_DIR}:$PATH"
export HOT_FILE_SCOPE_REPO_ROOT="$TEST_ROOT"
export COMMIT_COMPLIANCE_TEST_STATE="$BD_STATE"

reset_fixture() {
  git reset --hard -q HEAD
  rm -rf .beads/commit-check .beads/hot-file-lock
  mkdir -p .beads/hot-file-lock
}

CASE1_PASS=0
CASE2_PASS=0
CASE3_PASS=0

# Case 1: significant non-hot diff requires prepared metadata.
reset_fixture
python3 - <<'PY'
from pathlib import Path
for file_name, value in [("src/a.js", "11"), ("src/b.js", "22"), ("src/c.js", "33")]:
    p = Path(file_name)
    p.write_text(p.read_text().replace("return", f"const x = {value};\n  return"))
PY
git add src/a.js src/b.js src/c.js
if "$ENFORCE_SCRIPT" >/tmp/commit-compliance-case1.out 2>/tmp/commit-compliance-case1.err; then
  CASE1_PASS=0
else
  if grep -q "Run tools/prepare_commit_check.sh <bd-id>" /tmp/commit-compliance-case1.err; then
    CASE1_PASS=1
  fi
fi

# Case 2: prepare + enforce succeed for significant non-hot diff.
if "$PREPARE_SCRIPT" ORKA-test >/tmp/commit-compliance-case2-prepare.out 2>/tmp/commit-compliance-case2-prepare.err && \
   "$ENFORCE_SCRIPT" >/tmp/commit-compliance-case2.out 2>/tmp/commit-compliance-case2.err; then
  if grep -q '"src/a.js"' .beads/commit-check/ORKA-test.json && \
     grep -q '"alpha"' .beads/commit-check/ORKA-test.json; then
    CASE2_PASS=1
  fi
fi

# Case 3: hot-file diff prepare delegates to hot-file lock and stale metadata must be regenerated.
reset_fixture
python3 - <<'PY'
from pathlib import Path
p = Path("web-runner/modules/functionBank.js")
p.write_text(p.read_text().replace("const base = 10;", "const base = 12;"))
PY
git add web-runner/modules/functionBank.js
if "$PREPARE_SCRIPT" ORKA-test >/tmp/commit-compliance-case3-prepare.out 2>/tmp/commit-compliance-case3-prepare.err && \
   test -f .beads/hot-file-lock/ORKA-test.scope; then
  python3 - <<'PY'
from pathlib import Path
p = Path("web-runner/modules/functionBank.js")
p.write_text(p.read_text().replace("return base;", "return base + 1;"))
PY
  git add web-runner/modules/functionBank.js
  if "$ENFORCE_SCRIPT" >/tmp/commit-compliance-case3.out 2>/tmp/commit-compliance-case3.err; then
    CASE3_PASS=0
  else
    if grep -q "metadata is stale" /tmp/commit-compliance-case3.err; then
      CASE3_PASS=1
    fi
  fi
fi

if [[ "$CASE1_PASS" -ne 1 || "$CASE2_PASS" -ne 1 || "$CASE3_PASS" -ne 1 ]]; then
  echo "Commit compliance test failures: case1=$CASE1_PASS case2=$CASE2_PASS case3=$CASE3_PASS" >&2
  exit 1
fi

echo "commit compliance tests: PASS"
