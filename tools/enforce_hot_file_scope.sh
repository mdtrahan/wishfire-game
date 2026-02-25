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

build_function_ranges() {
  local file="$1"
  awk '
    {
      if (match($0, /^[[:space:]]*(export[[:space:]]+)?function[[:space:]]+([A-Za-z0-9_$]+)[[:space:]]*\(/, m)) {
        if (name != "") {
          print name "\t" start "\t" NR-1
        }
        name = m[2]
        start = NR
      }
    }
    END {
      if (name != "") {
        print name "\t" start "\t" NR
      }
    }
  ' "$file"
}

changed_lines_for_file() {
  local file="$1"
  git diff --cached -U0 -- "$file" | awk '
    /^@@ / {
      if (match($0, /\+([0-9]+)(,([0-9]+))?/, m)) {
        s = m[1] + 0
        c = (m[3] == "" ? 1 : m[3] + 0)
        if (c > 0) {
          for (i = 0; i < c; i++) print s + i
        }
      }
    }
  '
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

  FN_RANGES=""
  while IFS= read -r r; do
    [[ -z "$r" ]] && continue
    FN_RANGES="${FN_RANGES}${r}"$'\n'
  done < <(build_function_ranges "$file")

  CHANGED_LINES=""
  while IFS= read -r ln; do
    [[ -z "$ln" ]] && continue
    CHANGED_LINES="${CHANGED_LINES}${ln}"$'\n'
  done < <(changed_lines_for_file "$file")

  while IFS= read -r ln; do
    [[ -z "$ln" ]] && continue
    in_fn=0
    fn_name=""
    while IFS= read -r row; do
      [[ -z "$row" ]] && continue
      name="$(printf "%s" "$row" | cut -f1)"
      start="$(printf "%s" "$row" | cut -f2)"
      end="$(printf "%s" "$row" | cut -f3)"
      if [[ "$ln" -ge "$start" && "$ln" -le "$end" ]]; then
        in_fn=1
        fn_name="$name"
        break
      fi
    done <<<"$FN_RANGES"

    if [[ "$in_fn" -eq 0 ]]; then
      echo "ERROR: ${file}:${ln} is outside any function scope. Hot files require function-scoped edits only." >&2
      exit 1
    fi

    if ! csv_has_value "$declared_csv" "$fn_name"; then
      echo "ERROR: ${file}:${ln} is inside undeclared function '${fn_name}'." >&2
      echo "Declared for ${file}: ${declared_csv}" >&2
      exit 1
    fi
  done <<<"$CHANGED_LINES"
done <<<"$HOT_STAGED"

exit 0
