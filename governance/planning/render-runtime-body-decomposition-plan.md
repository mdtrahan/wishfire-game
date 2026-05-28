# Render Runtime Body Decomposition Refactor Plan

## Goal
Make `web-runner/systems/renderRuntime.js` patchable and reviewable by decomposing the giant generated `const body` string inside the same file, with no runtime behavior changes.

## Current Finding
`web-runner/systems/renderRuntime.js` is only about 9 physical lines. Line 5 is a generated quoted JavaScript body around 118k characters long. That shape makes patch matching brittle: small edits inside the generated body become giant-line diffs, and ordinary patch context has almost no line anchors.

The recent SG Faze / tainted-ground renderer work appears inside that generated body as escaped string content, not as normal source lines. The string currently appears syntactically escaped; the problem is patchability and review safety, not necessarily a broken string.

## Scope
- Edit only `web-runner/systems/renderRuntime.js`.
- Keep the refactor inside the same file.
- Do not touch `web-runner/app.js`.
- Do not touch `web-runner/systems/superGemRuntime.js`.
- Do not touch tests, docs, or governance files unless validation proves a direct need.
- Treat this as a QA/lint-facing refactor, not feature work.

## Beads Process
1. First command: `pwd`.
2. Confirm repo root is `/Users/Mace/Codex-Orka`.
3. Resolve the active bead from live `bd` state only to confirm this work is not being folded into that lane.
4. Create a new dedicated bead for this refactor even if another bead is active:
   - Suggested title: `Refactor render runtime generated body for patchability`
5. Do not proceed on an existing feature, bug, or SG Faze behavior bead. This task is a separate QA/refactor lane because it changes patchability and rollback shape, not feature behavior.
6. Mark the new refactor bead `in_progress`.
7. Add a Beads comment before editing:
   - `Non-behavioral same-file decomposition of generated render body. Rollback protected by file backup and extracted body hash.`

Hard stop if `bd` cannot be resolved or the new dedicated refactor bead cannot be created and confirmed.

## Backup Checkpoint
Before editing, create timestamped backups outside the repo:

```bash
ts=$(date +%Y%m%d-%H%M%S)
cp web-runner/systems/renderRuntime.js /private/tmp/codex-orka-renderRuntime-$ts.current.js
git show HEAD:web-runner/systems/renderRuntime.js > /private/tmp/codex-orka-renderRuntime-$ts.HEAD.js
git diff -- web-runner/systems/renderRuntime.js > /private/tmp/codex-orka-renderRuntime-$ts.diff.patch
shasum -a 256 web-runner/systems/renderRuntime.js /private/tmp/codex-orka-renderRuntime-$ts.HEAD.js
```

Also extract and hash the current generated `body` string before editing. This is the hard equivalence gate.

## Implementation Approach
Replace the single giant assignment:

```js
const body = "...giant generated body...";
```

with same-file chunking:

```js
const body = [
  "...chunk 1...",
  "...chunk 2...",
  "...chunk 3...",
].join("");
```

Rules:
- Preserve the embedded generated body byte-for-byte.
- Use quoted strings with escaped `\n`, matching the existing style.
- Do not use template literals; the generated body contains backticks and `${...}` expressions.
- Split only at safe escaped newline boundaries near natural renderer sections.
- Keep `renderRuntime(deps)` unchanged.
- Keep the `new Function(...)` wrapper unchanged.
- Keep the first pass mechanical. Do not rename functions or alter renderer logic.

Suggested chunk boundaries:
- runtime prelude and cadence
- yellow casino sequence
- combat visual helpers
- hit flash and blight helpers
- tainted-ground renderer block
- enemy renderer block
- damage text renderer
- hero renderer
- modal/HUD tail

## Equivalence Gate
After editing:

1. Extract the generated `body` string from the pre-refactor backup.
2. Extract the generated `body` string from the refactored file.
3. Compare hashes.
4. Compile the generated body through the existing `new Function` wrapper.
5. Inspect the diff to ensure it is localized and reviewable.

Required result:
- Old extracted body hash equals new extracted body hash.
- Generated body compiles.
- No behavior-bearing code changes.

If the body hash differs unexpectedly, stop and restore from the backup. Do not fix-forward casually.

## Focused Validation
Run focused tests only:

```bash
node tests/kojonnSuperGemBlightContract.test.js
node tests/hitFlashFeedbackContract.test.js
node tests/superGemAppContract.test.js
```

If there is an existing render-runtime syntax or body smoke test, run that too. Avoid broad full-suite churn unless focused validation passes and there is a concrete reason to widen.

## Bead Wrap
Add a final Beads comment with:
- backup file paths
- before and after generated-body hash result
- changed file: `web-runner/systems/renderRuntime.js`
- tests run
- behavior changed: `NO`
- rollback instruction: restore `/private/tmp/codex-orka-renderRuntime-<timestamp>.current.js` over the file, or revert the isolated commit

## Commit
Commit only this refactor file.

Commit message:

```text
refactor(render): decompose generated render runtime body bd-<id>

- Split generated render body into reviewable same-file chunks
- Preserve generated body equivalence for rollback-safe patching
- No runtime behavior changes
```

## Hard Stops
Stop immediately if:
- the new dedicated refactor bead cannot be created and confirmed
- dirty state suggests someone else is editing `web-runner/systems/renderRuntime.js` concurrently
- extracted body hash changes
- focused tests fail behaviorally
- the task starts pulling in `web-runner/app.js`, `web-runner/systems/superGemRuntime.js`, or unrelated docs/tests

The intended outcome is one file, one bead, backup first, body-equivalence proof, focused validation, and an isolated rollback-safe commit.
