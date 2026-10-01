# Arrival spacing review

Served lane: codex/ORKA-0ln-lamp at localhost:8027. Presentation-only CSS adjustment. Natural screenshot dimensions 755×1025; existing four-size guard also passes.

| Request | Evidence | Status |
|---|---|---|
| Roughly 10px between items | Four art-box gaps measure 9.62px at 755×1025 | Observed |
| Reduce oversized art | Art width 118% → 112.1%, a 5% reduction; grid cells also narrow to accommodate wider gaps | Observed |
| Keep lamp/control anchors | Existing four-width anchor guard passes | Supplemental |
| Fully populated row stays readable | Video at 00:17 shows all five manual arrivals, item levels and lamp controls contained | Observed |

Video: lamp-spacing.webm. Five manual draws in a disposable save, no seeded gear. In-app tab reloaded and returned to combat; user cache remains 19 items and transient arrival positions reset on reload. Existing save untouched. Before/after comparison uses the same five items; before restores the previous gap/art rules in the disposable capture only. Final screenshot inspected. No merge or publication.
