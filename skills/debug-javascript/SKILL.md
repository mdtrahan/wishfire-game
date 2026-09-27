---
name: debug-javascript
description: Use to investigate and fix JavaScript failures in browser or Node.js code.
---

# Debug JavaScript

Use the available project, reported symptoms, and logs to reproduce the failure and trace the responsible behavior. A vague initial report is a reason to gather evidence; ask the user only for information that available inspection or reproduction cannot supply.

Trace callers and relevant state transitions before choosing the fix. Establish the cause or interacting causes from evidence, keeping confirmed observations separate from unresolved hypotheses. Preserve unrelated work and keep the change within the user's requested scope.

For a fix request, implement the correction and run the smallest relevant regression check. Fix failures introduced by the change and repeat affected checks until the requested behavior is verified or a concrete blocker remains. For an explanation-only request, explain the diagnosis without editing files.

Report what caused the failure, what changed, and the observed verification result. If investigation remains blocked, identify the evidence already gathered and the specific missing input.
