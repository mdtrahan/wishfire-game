id: ORKA-vlt
title: [UI] Rename Mission nav to Vault and move retention locale entries to Chests top rail
priority: P1
status: done

## Objective
Consolidate long-term gallery entry points under Chests and update combat nav label from Mission to Vault.

## Scope
- Change Mission nav semantics/text to Vault.
- Remove map-side retention entry buttons.
- Add top-rail retention entry buttons in Chests with lazy routing to target layouts.

## Acceptance
- Combat nav shows/uses Vault.
- Map layout no longer shows retention-entry stack.
- Chests layout shows the stack and routes to target layouts.

## Completion Note (2026-03-08)
- Mission nav semantics/text now route as Vault.
- Retention entry stack removed from Map layout.
- Retention entry stack added to Chests top rail with lazy routing to target layouts.

## Reopen Note (2026-03-08)
- Retention gallery back routes still return to map; should return to vault home (`chestsLayout`).

## Completion Note (2026-03-08, Reopen Fix)
- Retention gallery `Back To Map` routes are now `Back To Vault` and return to `chestsLayout`.
- Retention layout transition allow-lists updated to include `chestsLayout` as home.

## Final Closure (2026-03-08)
- User QA confirmed vault-home routing behavior is correct.
