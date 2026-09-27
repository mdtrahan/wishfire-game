# Document Lifecycle Policy

Keep one current document per purpose and update it in place. Live Beads state owns task status. Current product decisions belong in `governance/product/`; current execution rules belong in `governance/execution/`.

Historical revisions remain available in Git history and the isolated recovery store. Do not copy completed plans, generated review packets, or obsolete policy into current main. Use an explicit temporary directory for generated reports, then retain only evidence required by current work or an established QA gate.

`governance/metrics/stability-metrics.md` remains a current append-only record.
