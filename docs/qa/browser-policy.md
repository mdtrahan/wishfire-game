# Browser Backend Policy

Role: qa
Status: canonical

## Backend

- Default browser automation backend is `agent-browser`.
- Legacy Playwright references are compatibility-only unless a task explicitly requires a transitional diagnostic path.

## Default Rule

- Use the repo-owned browser path first.
- Treat diagnostic helpers as support tools, not alternate shipping lanes.
- Keep generated browser artifacts outside the default read path.

## Related Docs

- Validation guide: [browser-validation.md](browser-validation.md)
- Combat control model: [../../governance/qa/combat-playwright-control-model.md](../../governance/qa/combat-playwright-control-model.md)
- Battery details: [../../governance/qa/browser-battery-minimal.md](../../governance/qa/browser-battery-minimal.md)
