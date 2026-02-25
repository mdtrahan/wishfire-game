# Hot-File Lock Declarations

When a commit touches any hot file:

- `web-runner/modules/functionBank.js`
- `Scripts/functionBank.js`
- `web-runner/app.js`

the pre-commit hook requires a declaration file for the active Beads issue:

- `.beads/hot-file-lock/<ISSUE_ID>.scope`

Format:

```text
<file-path>:<functionA>,<functionB>,<functionC>
```

Example:

```text
web-runner/modules/functionBank.js:AwardMonsterDrop,getDropRate,getDropRateBracket
Scripts/functionBank.js:AwardMonsterDrop,getDropRate,getDropRateBracket
```

Rules:

- One active `in_progress` issue is required.
- Every touched hot file must be declared in the issue scope file.
- Every changed line in hot files must fall inside one declared function.
- Any out-of-scope hot-file edit fails pre-commit.
