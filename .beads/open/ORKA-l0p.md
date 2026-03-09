id: ORKA-l0p
title: [UI] Adjust Layout 0 loading UX to bottom mobile-style progress bar
priority: P1
status: done

## Objective
Align startup loading presentation to mobile convention with bottom-anchored progress bar.

## Scope
- Keep existing bootstrap progress plumbing.
- Redesign loading-screen composition to place progress bar near bottom of viewport.
- No changes to combat bootstrap logic.

## Acceptance
- Progress bar is rendered near bottom of Layout 0 screen.
- Progress percentage remains visible and updates through bootstrap.

## Completion Note (2026-03-08)
- Layout 0 loading screen now uses a bottom-anchored mobile-style progress bar.
- Progress percent remains visible and updates during bootstrap.

## Reopen Fix Note (2026-03-08)
- Startup preload now runs while on layout 0 (storyMock) and shows bottom loading bar there.
- StoryMock click-to-combat is gated until preload completes.
- Effective flow now: layout 0 (with loading bar) -> layout 1 -> layout 2.

## Final Closure (2026-03-08)
- User QA confirmed loading flow and layout ordering are correct.
