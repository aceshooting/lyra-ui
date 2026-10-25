---
'@aceshooting/lyra-ui': patch
---

Retain map-anchor placement subscriptions across camera movement, recover failed placement sessions, and avoid repeated overflow-admission scans. Consolidate hierarchy-source, prepared-chart, and default-label helpers while preserving cancellation, accessibility, and query bounds. Correct maturity metadata for published experimental components.

Use cancellable asynchronous model preparation when the model companion supports it, retaining compatibility with older companion versions.

Shared lifecycle helpers and regenerated component metadata increase several bundle and package measurements. Advance only exceeded byte ceilings to the next 64-byte boundary; retain the existing download, unpacked-reduction, artifact, and optional-peer policies.

The current-harness Chromium quick comparison against published 30.1.0 retains all functional assertions and recorded operation counts, but reports material timing increases in dataset selection, table filtering and no-op painting, chart assignment, and select metadata painting. Chart-assignment total p95 rises from 94.0 to 147.4 ms while its median remains approximately 77 ms; table-filter no-op total median rises from 8.2 to 10.7 ms, and select metadata paint median from 11.7 to 15.0 ms. These seven-sample measurements do not isolate the cause, and no general timing improvement is claimed. Wall-clock results remain advisory; deterministic scale budgets and release A/B qualification remain required.
