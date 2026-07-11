import re
from typing import List, Optional, Sequence, Tuple


FUNCTION_PATTERNS = [
    re.compile(r"^\s*(?:export\s+)?function\s+([A-Za-z0-9_$]+)\s*\("),
    re.compile(
        r"^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?(?:function\b|\()"
    ),
    re.compile(r"^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?[A-Za-z0-9_$]*\s*=>"),
    re.compile(
        r"^\s*(?:export\s+)?(?:let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?(?:function\b|\()"
    ),
    re.compile(
        r"^\s*(?:export\s+)?(?:let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?[A-Za-z0-9_$]*\s*=>"
    ),
]


def parse_changed_lines(diff_text: str) -> List[int]:
    changed: List[int] = []
    pattern = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
    for line in diff_text.splitlines():
        match = pattern.match(line)
        if not match:
            continue
        start = int(match.group(1))
        count = int(match.group(2) or "1")
        if count <= 0:
            continue
        changed.extend(range(start, start + count))
    return changed


def parse_function_ranges(lines: Sequence[str]) -> List[Tuple[str, int, int]]:
    ranges: List[Tuple[str, int, int]] = []
    active_name: Optional[str] = None
    active_start: Optional[int] = None
    for idx, line in enumerate(lines, start=1):
        matched = None
        for pattern in FUNCTION_PATTERNS:
            matched = pattern.match(line)
            if matched:
                break
        if not matched:
            continue
        if active_name is not None and active_start is not None:
            ranges.append((active_name, active_start, idx - 1))
        active_name = matched.group(1)
        active_start = idx
    if active_name is not None and active_start is not None:
        ranges.append((active_name, active_start, len(lines)))
    return ranges
