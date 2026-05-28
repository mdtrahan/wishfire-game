Milestone Extension:
Combat state must remain deterministic and resumable
across layout transitions while tick timers are active.

Definition of Done Additions:
- Layout transition does not corrupt turn order
- No silent layout-change failures
- Snapshot/resume integrity verified
- Transition atomicity preserved
- Pointer + tick loop remain active across transitions
