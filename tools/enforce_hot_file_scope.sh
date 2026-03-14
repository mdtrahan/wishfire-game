#!/usr/bin/env bash
set -eo pipefail

HOT_FILES="
web-runner/modules/functionBank.js
Scripts/functionBank.js
web-runner/app.js
"

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf "%s" "$s"
}

is_hot_file() {
  local target="$1"
  local f
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    [[ "$f" == "$target" ]] && return 0
  done <<<"$HOT_FILES"
  return 1
}

normalize_csv() {
  local raw="$1"
  local out=""
  local part
  IFS=',' read -r -a parts <<<"$raw"
  for part in "${parts[@]}"; do
    part="$(trim "$part")"
    [[ -z "$part" ]] && continue
    if [[ -z "$out" ]]; then
      out="$part"
    else
      out="$out,$part"
    fi
  done
  printf "%s" "$out"
}

csv_has_value() {
  local csv="$1"
  local needle="$2"
  local token
  IFS=',' read -r -a parts <<<"$csv"
  for token in "${parts[@]}"; do
    [[ "$token" == "$needle" ]] && return 0
  done
  return 1
}

changed_lines_for_file() {
  local file="$1"
  git diff --cached -U0 -- "$file" | awk '
    /^@@ / {
      line = $0
      sub(/^.*\+/, "", line)
      sub(/ .*/, "", line)
      n = split(line, arr, ",")
      s = arr[1] + 0
      c = (n < 2 || arr[2] == "" ? 1 : arr[2] + 0)
      if (c > 0) {
        for (i = 0; i < c; i++) print s + i
      }
    }
  '
}

validate_changed_lines_for_file() {
  local file="$1"
  local declared_csv="$2"
  local tmp_changed
  tmp_changed="$(mktemp)"
  changed_lines_for_file "$file" > "$tmp_changed"

  if [[ ! -s "$tmp_changed" ]]; then
    rm -f "$tmp_changed"
    return 0
  fi

  python3 - "$file" "$declared_csv" "$tmp_changed" <<'PY'
import re
import sys
from pathlib import Path

file_path = Path(sys.argv[1])
declared_csv = sys.argv[2]
changed_path = Path(sys.argv[3])

declared = {part.strip() for part in declared_csv.split(",") if part.strip()}
changed_lines = [int(line.strip()) for line in changed_path.read_text().splitlines() if line.strip()]
changed_lines.sort()
if not changed_lines:
    sys.exit(0)

lines = file_path.read_text().splitlines()
pattern = re.compile(r'^\s*(?:export\s+)?function\s+([A-Za-z0-9_$]+)\s*\(')
ranges = []
name = None
start = None
for idx, line in enumerate(lines, start=1):
    m = pattern.match(line)
    if m:
        if name is not None:
            ranges.append((name, start, idx - 1))
        name = m.group(1)
        start = idx
if name is not None:
    ranges.append((name, start, len(lines)))

range_idx = 0
range_count = len(ranges)
for ln in changed_lines:
    while range_idx < range_count and ranges[range_idx][2] < ln:
        range_idx += 1
    if range_idx >= range_count or ranges[range_idx][1] > ln:
        print(f"ERROR: {file_path}:{ln} is outside any function scope. Hot files require function-scoped edits only.", file=sys.stderr)
        sys.exit(1)
    fn_name = ranges[range_idx][0]
    if fn_name not in declared:
        print(f"ERROR: {file_path}:{ln} is inside undeclared function '{fn_name}'.", file=sys.stderr)
        print(f"Declared for {file_path}: {declared_csv}", file=sys.stderr)
        sys.exit(1)
sys.exit(0)
PY
  local rc=$?
  rm -f "$tmp_changed"
  return "$rc"
}

STAGED_FILES=""
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  STAGED_FILES="${STAGED_FILES}${line}"$'\n'
done < <(git diff --cached --name-only --diff-filter=ACMR)

HOT_STAGED=""
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  if is_hot_file "$file"; then
    HOT_STAGED="${HOT_STAGED}${file}"$'\n'
  fi
done <<<"$STAGED_FILES"

if [[ -z "$HOT_STAGED" ]]; then
  exit 0
fi

if ! command -v bd >/dev/null 2>&1; then
  echo "ERROR: bd command not found. Hot-file lock requires active Beads issue context." >&2
  exit 1
fi

ACTIVE_JSON="$(bd list --status=in_progress --json 2>/dev/null || echo '[]')"
ACTIVE_IDS=""
while IFS= read -r id; do
  [[ -z "$id" ]] && continue
  ACTIVE_IDS="${ACTIVE_IDS}${id}"$'\n'
done < <(printf "%s" "$ACTIVE_JSON" | jq -r '.[].id' 2>/dev/null || true)

ACTIVE_COUNT="$(printf "%s" "$ACTIVE_IDS" | awk 'NF{n++} END{print n+0}')"
if [[ "$ACTIVE_COUNT" -ne 1 ]]; then
  echo "ERROR: Hot-file lock requires exactly one in-progress Beads issue." >&2
  echo "Set a single active issue before committing hot-file edits." >&2
  exit 1
fi
ISSUE_ID="$(printf "%s" "$ACTIVE_IDS" | awk 'NF{print; exit}')"

DECL_FILE=".beads/hot-file-lock/${ISSUE_ID}.scope"
if [[ ! -f "$DECL_FILE" ]]; then
  echo "ERROR: Hot-file lock declaration missing for ${ISSUE_ID}." >&2
  echo "Create ${DECL_FILE} with lines like:" >&2
  echo "  web-runner/modules/functionBank.js:AwardMonsterDrop,getDropRate" >&2
  echo "  Scripts/functionBank.js:AwardMonsterDrop,getDropRate" >&2
  exit 1
fi

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  declared_csv=""
  while IFS= read -r raw; do
    line="$(trim "$raw")"
    [[ -z "$line" ]] && continue
    [[ "${line:0:1}" == "#" ]] && continue
    if [[ "$line" != *:* ]]; then
      echo "ERROR: Invalid declaration line in ${DECL_FILE}: ${line}" >&2
      echo "Expected format: <file>:<func1>,<func2>" >&2
      exit 1
    fi
    file_part="$(trim "${line%%:*}")"
    funcs_part="$(trim "${line#*:}")"
    if [[ "$file_part" == "$file" ]]; then
      declared_csv="$funcs_part"
    fi
  done <"$DECL_FILE"

  declared_csv="$(normalize_csv "$declared_csv")"
  if [[ -z "$declared_csv" ]]; then
    echo "ERROR: Hot-file ${file} modified but no declaration found in ${DECL_FILE}." >&2
    exit 1
  fi

  validate_changed_lines_for_file "$file" "$declared_csv"
done <<<"$HOT_STAGED"

exit 0
