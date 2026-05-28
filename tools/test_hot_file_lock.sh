#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREPARE_SCRIPT="${ROOT}/tools/prepare_hot_file_commit.sh"
ENFORCE_SCRIPT="${ROOT}/tools/enforce_hot_file_scope.sh"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hot-file-lock-test.XXXXXX")"
TEST_ROOT="${TMP_DIR}/repo"
BD_SHIM_DIR="${TMP_DIR}/bin"
BD_STATE="${TMP_DIR}/bd-state.json"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TEST_ROOT/web-runner/modules" "$TEST_ROOT/web-runner" "$TEST_ROOT/Scripts" "$TEST_ROOT/.beads/hot-file-lock" "$BD_SHIM_DIR"
cd "$TEST_ROOT"

git init -q
git config user.name "Codex Test"
git config user.email "codex@example.com"

cat > web-runner/modules/functionBank.js <<'EOF'
function getDropRate() {
  const base = 10;
  return base;
}

function queueConfiguredDoubleAttackFollowUp() {
  return 2;
}
EOF

cat > Scripts/functionBank.js <<'EOF'
function getDropRate() {
  const base = 10;
  return base;
}

function queueConfiguredDoubleAttackFollowUp() {
  return 2;
}
EOF

cat > web-runner/app.js <<'EOF'
function refreshCombatSessionFromDevTooling() {
  return 'refresh';
}

function resetCombatRuntimeForFreshSession() {
  return 'reset';
}
EOF

git add web-runner/modules/functionBank.js Scripts/functionBank.js web-runner/app.js
git commit -q -m "test: seed fixture"

cat > "$BD_STATE" <<'EOF'
{"statuses":{"ORKA-a":"in_progress","ORKA-b":"in_progress","ORKA-c":"open","ORKA-test":"open"}}
EOF

cat > "${BD_SHIM_DIR}/bd" <<'EOF'
#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

state_path = Path(os.environ["HOT_FILE_LOCK_TEST_STATE"])
state = json.loads(state_path.read_text())
statuses = state["statuses"]

args = sys.argv[1:]
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
export HOT_FILE_LOCK_TEST_STATE="$BD_STATE"

set_bd_state() {
  local json="$1"
  printf '%s\n' "$json" > "$BD_STATE"
}

run_prepare() {
  "$PREPARE_SCRIPT" "$@"
}

run_enforce() {
  "$ENFORCE_SCRIPT"
}

reset_fixture() {
  git reset --hard -q HEAD
  rm -f .beads/hot-file-lock/*
}

CASE1_PASS=0
CASE2_PASS=0
CASE3_PASS=0
CASE4_PASS=0
CASE5_PASS=0
CASE6_PASS=0

# Case 1: enforce without prepared metadata fails once with actionable instruction.
reset_fixture
python3 - <<'PY'
from pathlib import Path
p = Path("web-runner/modules/functionBank.js")
text = p.read_text()
p.write_text(text.replace("const base = 10;", "const base = 11;"))
PY
git add web-runner/modules/functionBank.js
set_bd_state '{"statuses":{"ORKA-test":"in_progress"}}'
if run_enforce >/tmp/hot-lock-case1.out 2>/tmp/hot-lock-case1.err; then
  CASE1_PASS=0
else
  if grep -q "Run tools/prepare_hot_file_commit.sh ORKA-test" /tmp/hot-lock-case1.err; then
    CASE1_PASS=1
  fi
fi

# Case 2: prepare fails once with actionable alignment commands when active bead state is wrong.
reset_fixture
python3 - <<'PY'
from pathlib import Path
p = Path("web-runner/modules/functionBank.js")
text = p.read_text()
p.write_text(text.replace("const base = 10;", "const base = 12;"))
PY
git add web-runner/modules/functionBank.js
set_bd_state '{"statuses":{"ORKA-a":"in_progress","ORKA-b":"in_progress","ORKA-test":"open"}}'
if run_prepare ORKA-test >/tmp/hot-lock-case2.out 2>/tmp/hot-lock-case2.err; then
  CASE2_PASS=0
else
  if grep -q "bd update ORKA-a --status open" /tmp/hot-lock-case2.err && grep -q "bd update ORKA-test --status in_progress" /tmp/hot-lock-case2.err; then
    CASE2_PASS=1
  fi
fi

# Case 3: prepare generates multi-file, multi-function scope and aligned restore guidance.
reset_fixture
python3 - <<'PY'
from pathlib import Path
p = Path("web-runner/modules/functionBank.js")
text = p.read_text()
text = text.replace("const base = 10;", "const base = 13;")
text = text.replace("return 2;", "return 3;")
p.write_text(text)
p = Path("Scripts/functionBank.js")
text = p.read_text()
text = text.replace("return 2;", "return 4;")
p.write_text(text)
PY
git add web-runner/modules/functionBank.js Scripts/functionBank.js
set_bd_state '{"statuses":{"ORKA-a":"in_progress","ORKA-test":"open"}}'
if run_prepare ORKA-test --align-active >/tmp/hot-lock-case3.out 2>/tmp/hot-lock-case3.err; then
  if grep -q "web-runner/modules/functionBank.js:getDropRate,queueConfiguredDoubleAttackFollowUp" .beads/hot-file-lock/ORKA-test.scope && \
     grep -q "Scripts/functionBank.js:queueConfiguredDoubleAttackFollowUp" .beads/hot-file-lock/ORKA-test.scope && \
     grep -q "bd update ORKA-test --status open" /tmp/hot-lock-case3.out && \
     grep -q "bd update ORKA-a --status in_progress" /tmp/hot-lock-case3.out; then
    CASE3_PASS=1
  fi
else
  CASE3_PASS=0
fi

# Case 4: prepare generates module scope for top-level hot-file edits.
reset_fixture
python3 - <<'PY'
from pathlib import Path
for file_name, marker in [
    ("web-runner/modules/functionBank.js", "// top-level-a\n"),
    ("Scripts/functionBank.js", "// top-level-b\n"),
]:
    p = Path(file_name)
    p.write_text(marker + p.read_text())
PY
git add web-runner/modules/functionBank.js Scripts/functionBank.js
set_bd_state '{"statuses":{"ORKA-test":"in_progress"}}'
if run_prepare ORKA-test >/tmp/hot-lock-case4.out 2>/tmp/hot-lock-case4.err; then
  if grep -q "web-runner/modules/functionBank.js:__MODULE__" .beads/hot-file-lock/ORKA-test.scope && \
     grep -q "Scripts/functionBank.js:__MODULE__" .beads/hot-file-lock/ORKA-test.scope; then
    CASE4_PASS=1
  fi
else
  CASE4_PASS=0
fi

# Case 5: enforce reports undeclared module/function drift in one pass after manual scope tamper.
reset_fixture
python3 - <<'PY'
from pathlib import Path
p = Path("web-runner/modules/functionBank.js")
text = p.read_text()
text = "// top-level-c\n" + text
text = text.replace("const base = 10;", "const base = 14;")
text = text.replace("return 2;", "return 5;")
p.write_text(text)
PY
git add web-runner/modules/functionBank.js
set_bd_state '{"statuses":{"ORKA-test":"in_progress"}}'
run_prepare ORKA-test >/tmp/hot-lock-case5-prepare.out 2>/tmp/hot-lock-case5-prepare.err
cat > .beads/hot-file-lock/ORKA-test.scope <<'EOF'
web-runner/modules/functionBank.js:getDropRate
EOF
if run_enforce >/tmp/hot-lock-case5.out 2>/tmp/hot-lock-case5.err; then
  CASE5_PASS=0
else
  if grep -q "declare __MODULE__" /tmp/hot-lock-case5.err && \
     grep -q "undeclared function 'queueConfiguredDoubleAttackFollowUp'" /tmp/hot-lock-case5.err; then
    CASE5_PASS=1
  fi
fi

# Case 6: prepared scope passes, then stale staged diff requires regeneration.
reset_fixture
python3 - <<'PY'
from pathlib import Path
p = Path("web-runner/app.js")
text = p.read_text()
text = text.replace("return 'refresh';", "return 'refresh-now';")
p.write_text(text)
PY
git add web-runner/app.js
set_bd_state '{"statuses":{"ORKA-test":"in_progress"}}'
if run_prepare ORKA-test >/tmp/hot-lock-case6-prepare.out 2>/tmp/hot-lock-case6-prepare.err && run_enforce >/tmp/hot-lock-case6-pass.out 2>/tmp/hot-lock-case6-pass.err; then
  python3 - <<'PY'
from pathlib import Path
p = Path("web-runner/app.js")
text = p.read_text()
text = text.replace("return 'reset';", "return 'reset-now';")
p.write_text(text)
PY
  git add web-runner/app.js
  if run_enforce >/tmp/hot-lock-case6.out 2>/tmp/hot-lock-case6.err; then
    CASE6_PASS=0
  else
    if grep -q "Prepared hot-file scope for ORKA-test is stale." /tmp/hot-lock-case6.err; then
      CASE6_PASS=1
    fi
  fi
else
  CASE6_PASS=0
fi

echo "Hot-file lock self-test summary"
echo "  CASE 1 (missing preparation fails once with actionable instruction): $([[ "$CASE1_PASS" -eq 1 ]] && echo PASS || echo FAIL)"
echo "  CASE 2 (wrong active bead state fails once with exact alignment commands): $([[ "$CASE2_PASS" -eq 1 ]] && echo PASS || echo FAIL)"
echo "  CASE 3 (prepare generates multi-function scope and restore guidance): $([[ "$CASE3_PASS" -eq 1 ]] && echo PASS || echo FAIL)"
echo "  CASE 4 (prepare generates module scope for top-level edits): $([[ "$CASE4_PASS" -eq 1 ]] && echo PASS || echo FAIL)"
echo "  CASE 5 (undeclared module/function drift is reported): $([[ "$CASE5_PASS" -eq 1 ]] && echo PASS || echo FAIL)"
echo "  CASE 6 (prepared scope passes and stale staged diff requires regeneration): $([[ "$CASE6_PASS" -eq 1 ]] && echo PASS || echo FAIL)"

if [[ "$CASE1_PASS" -eq 1 && "$CASE2_PASS" -eq 1 && "$CASE3_PASS" -eq 1 && "$CASE4_PASS" -eq 1 && "$CASE5_PASS" -eq 1 && "$CASE6_PASS" -eq 1 ]]; then
  echo "RESULT: PASS"
  exit 0
fi

echo "RESULT: FAIL"
exit 1
