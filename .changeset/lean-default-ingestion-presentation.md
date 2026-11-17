---
'@aceshooting/lyra-ui': patch
---

Reuse a frozen empty presentation for ingestion rows without optional metadata, preserving descriptor validation, cancellation guards and row ownership. A 5,000-row diagnostic reduced returned presentation objects from 5,000 to one while retaining all 10,000 validity checks.

The initial seven-sample comparison against 31.0.0 observed ingestion update median/p95 increases of 26.6/29.6 to 33.8/48.7 ms and total p95 of 60.4 to 77.3 ms. Chart total p95 increased from 95.8 to 111.9 ms, no-op paint median/p95 from 21.2/25.9 to 24.9/32.7 ms, and no-op total from 22.3/27.0 to 26.0/33.9 ms. Chart production source was unchanged; the elapsed metrics include animation-frame waits.

The fixed-order, 21-sample before/after ingestion comparisons showed mixed timing results: update medians of 32.5 to 28.9 ms and 30.2 to 30.3 ms, with one comparison observing a 3.9 ms paint-wait increase. The refactor establishes reduced allocation, not a sustained wall-time improvement. The final matched 21-sample comparison against 31.0.0 did not flag ingestion or chart metrics. Its only material increase was evaluation-dataset selection update p95, from 2.1 to 3.3 ms, while median improved from 1.8 to 1.5 ms. This unchanged component's tail timing remains observational. All original samples are retained, and benchmark thresholds are unchanged.
