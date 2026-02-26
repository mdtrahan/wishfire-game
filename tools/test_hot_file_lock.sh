#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

HOT_FILE="web-runner/modules/functionBank.js"
IN_SCOPE_FN="getDropRate"
OUT_OF_SCOPE_MARKER="/* hot-file-lock-self-test-case1 */"
IN_SCOPE_MARKER="// hot-file-lock-self-test-case2"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hot-file-lock-test.XXXXXX")"
ISSUE_ID="${HOT_FILE_LOCK_TEST_ISSUE_ID:-ORKA-900}"
SCOPE_FILE=".beads/hot-file-lock/${ISSUE_ID}.scope"

HOT_BACKUP="${TMP_DIR}/hot.backup"
SCOPE_BACKUP="${TMP_DIR}/scope.backup"
BD_SHIM_DIR="${TMP_DIR}/bin"

CASE1_PASS=0
CASE2_PASS=0

HOT_WORK_EXISTS=0
HOT_INDEX_EXISTS=0
HOT_INDEX_MODE=""
HOT_INDEX_BLOB=""

SCOPE_WORK_EXISTS=0
SCOPE_INDEX_EXISTS=0
SCOPE_INDEX_MODE=""
SCOPE_INDEX_BLOB=""

capture_index_state() {
  local file="$1"
  local prefix="$2"
  local line
  line="$(git ls-files -s -- "$file" | head -n1 || true)"
  if [[ -n "$line" ]]; then
    eval "${prefix}_INDEX_EXISTS=1"
    eval "${prefix}_INDEX_MODE=\"\$(printf '%s' \"$line\" | awk '{print \$1}')\""
    eval "${prefix}_INDEX_BLOB=\"\$(printf '%s' \"$line\" | awk '{print \$2}')\""
  else
    eval "${prefix}_INDEX_EXISTS=0"
  fi
}

cleanup() {
  set +e

  if [[ "$HOT_WORK_EXISTS" -eq 1 && -f "$HOT_BACKUP" ]]; then
    cp "$HOT_BACKUP" "$HOT_FILE" >/dev/null 2>&1 || true
  else
    rm -f "$HOT_FILE" >/dev/null 2>&1 || true
  fi

  if [[ "$SCOPE_WORK_EXISTS" -eq 1 && -f "$SCOPE_BACKUP" ]]; then
    mkdir -p "$(dirname "$SCOPE_FILE")" >/dev/null 2>&1 || true
    cp "$SCOPE_BACKUP" "$SCOPE_FILE" >/dev/null 2>&1 || true
  else
    rm -f "$SCOPE_FILE" >/dev/null 2>&1 || true
  fi

  if [[ "$HOT_INDEX_EXISTS" -eq 1 ]]; then
    git update-index --cacheinfo "${HOT_INDEX_MODE},${HOT_INDEX_BLOB},${HOT_FILE}" >/dev/null 2>&1 || true
  else
    git rm --cached --ignore-unmatch "$HOT_FILE" >/dev/null 2>&1 || true
  fi

  if [[ "$SCOPE_INDEX_EXISTS" -eq 1 ]]; then
    git update-index --cacheinfo "${SCOPE_INDEX_MODE},${SCOPE_INDEX_BLOB},${SCOPE_FILE}" >/dev/null 2>&1 || true
  else
    git rm --cached --ignore-unmatch "$SCOPE_FILE" >/dev/null 2>&1 || true
  fi

  rm -rf "$TMP_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

mkdir -p "$BD_SHIM_DIR"
cat > "${BD_SHIM_DIR}/bd" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "list" ]]; then
  shift || true
  status_ok=0
  json_ok=0
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --status=in_progress) status_ok=1 ;;
      --json) json_ok=1 ;;
    esac
    shift || true
  done
  if [[ "$status_ok" -eq 1 && "$json_ok" -eq 1 ]]; then
    echo "[{\"id\":\"${HOT_FILE_LOCK_TEST_ISSUE_ID:-ORKA-900}\"}]"
    exit 0
  fi
fi
echo "bd shim only supports: bd list --status=in_progress --json" >&2
exit 1
EOF
chmod +x "${BD_SHIM_DIR}/bd"

run_enforcer() {
  PATH="${BD_SHIM_DIR}:$PATH" HOT_FILE_LOCK_TEST_ISSUE_ID="${ISSUE_ID}" ./tools/enforce_hot_file_scope.sh
}

reset_case_state() {
  cp "$HOT_BACKUP" "$HOT_FILE"
  rm -f "$SCOPE_FILE"
  git add "$HOT_FILE" >/dev/null 2>&1 || true
  git add "$SCOPE_FILE" >/dev/null 2>&1 || true
}

# Snapshot pre-run state for guaranteed restoration.
cp "$HOT_FILE" "$HOT_BACKUP"
HOT_WORK_EXISTS=1
if [[ -f "$SCOPE_FILE" ]]; then
  SCOPE_WORK_EXISTS=1
  cp "$SCOPE_FILE" "$SCOPE_BACKUP"
else
  SCOPE_WORK_EXISTS=0
fi
capture_index_state "$HOT_FILE" "HOT"
capture_index_state "$SCOPE_FILE" "SCOPE"

# Case 1: out-of-scope hot-file edit must fail.
reset_case_state
mkdir -p "$(dirname "$SCOPE_FILE")"
cat > "$SCOPE_FILE" <<EOF
${HOT_FILE}:${IN_SCOPE_FN}
EOF
{
  printf "%s\n" "$OUT_OF_SCOPE_MARKER"
  cat "$HOT_BACKUP"
} > "$HOT_FILE"
git add "$HOT_FILE" "$SCOPE_FILE"
if run_enforcer >/tmp/hot-file-lock-case1.out 2>/tmp/hot-file-lock-case1.err; then
  CASE1_PASS=0
else
  CASE1_PASS=1
fi

# Case 2: declared in-scope function edit must pass.
reset_case_state
mkdir -p "$(dirname "$SCOPE_FILE")"
cat > "$SCOPE_FILE" <<EOF
${HOT_FILE}:${IN_SCOPE_FN}
EOF
awk '
BEGIN { done = 0 }
{
  if (!done && $0 ~ /const base = sanitizeBps\(dropRate\);/) {
    sub(/const base = sanitizeBps\(dropRate\);/, "const base = sanitizeBps(dropRate); '"${IN_SCOPE_MARKER}"'")
    done = 1
  }
  print
}
' "$HOT_FILE" > "${TMP_DIR}/hot.case2.js"
mv "${TMP_DIR}/hot.case2.js" "$HOT_FILE"
git add "$HOT_FILE" "$SCOPE_FILE"
if run_enforcer >/tmp/hot-file-lock-case2.out 2>/tmp/hot-file-lock-case2.err; then
  CASE2_PASS=1
else
  CASE2_PASS=0
fi

echo "Hot-file lock self-test summary"
echo "  Issue context: ${ISSUE_ID}"
if [[ "$CASE1_PASS" -eq 1 ]]; then
  echo "  CASE 1 (out-of-scope hot-file edit must fail): PASS"
else
  echo "  CASE 1 (out-of-scope hot-file edit must fail): FAIL"
  echo "    stdout: $(cat /tmp/hot-file-lock-case1.out 2>/dev/null || true)"
  echo "    stderr: $(cat /tmp/hot-file-lock-case1.err 2>/dev/null || true)"
fi
if [[ "$CASE2_PASS" -eq 1 ]]; then
  echo "  CASE 2 (declared in-scope function edit must pass): PASS"
else
  echo "  CASE 2 (declared in-scope function edit must pass): FAIL"
  echo "    stdout: $(cat /tmp/hot-file-lock-case2.out 2>/dev/null || true)"
  echo "    stderr: $(cat /tmp/hot-file-lock-case2.err 2>/dev/null || true)"
fi

if [[ "$CASE1_PASS" -eq 1 && "$CASE2_PASS" -eq 1 ]]; then
  echo "RESULT: PASS"
  exit 0
fi

echo "RESULT: FAIL"
exit 1
