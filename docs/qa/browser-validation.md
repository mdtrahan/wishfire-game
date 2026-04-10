# Browser Validation Guide

Role: qa
Status: canonical

## Purpose

- Give one default route for browser-visible verification.

## Default Path

1. Confirm the backend policy: [browser-policy.md](browser-policy.md)
2. Use the repo-owned browser harness or battery for the current bead.
3. Use the combat control model when input timing matters.
4. Use generated screenshots or snapshots only as artifacts, not as sources of truth.

## Related Docs

- Battery details: [../../governance/qa/browser-battery-minimal.md](../../governance/qa/browser-battery-minimal.md)
- Combat control model: [../../governance/qa/combat-playwright-control-model.md](../../governance/qa/combat-playwright-control-model.md)
