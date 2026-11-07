#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# One verifier run per PR against the complete diff from the pinned main base: the retained Node
# suite (tooling contracts) and every Rust crate, including the wf_app client over the packed atlas.
case "${1:-}" in
  --staged) [ "$#" -eq 1 ] || exit 2; CHANGED="$(git diff --cached --name-only --diff-filter=ACMRD)" ;;
  --all) [ "$#" -eq 1 ] || exit 2; CHANGED="" ;;
  --base) [ "$#" -eq 2 ] || { echo 'Expected --base <ref>' >&2; exit 2; }; CHANGED="$(git diff --name-only --diff-filter=ACMRD "$2"...HEAD)" ;;
  "") CHANGED="$(git diff --name-only --diff-filter=ACMRD origin/main...HEAD)" ;;
  *) echo 'Usage: run_merge_tests.sh [--base <ref>|--staged|--all]' >&2; exit 2 ;;
esac
echo "Retained Node suite..."
npm test
echo "Rust crates (packed atlas first for wf_app)..."
cargo run -q -p wf_pack --manifest-path rust/Cargo.toml --release -- --src web-runner/assets --out rust/wf_app/gen
for manifest in rust/*/Cargo.toml; do cargo test --manifest-path "$manifest" --color never; done
echo "Merge tier passed for $(printf '%s\n' "$CHANGED" | grep -c . || true) changed files."
