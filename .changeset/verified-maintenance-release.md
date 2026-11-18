---
"@aceshooting/lyra-ui": patch
---

Improve release verification by separating package publication from registry availability checks, validating release budgets on hosted runners, and recording reproducible pre-release benchmarks. Refresh the tested Svelte integration and build-tool dependencies.

Clarify withdrawn dependency advisories while retaining the tested parser and formatting hardening.

The hosted Chromium quick comparison against 31.2.0 passed the semantic checks for all 15 workloads.
It flagged 8 of 150 timing metrics as slower and 5 as faster. Seven slower metrics were flagged only
at p95, the maximum of seven samples. Their maxima came from three candidate samples across ingestion,
table filtering, and chart no-op timings. The ingestion update median rose from 8.9 to 10.9 ms, and
its end-to-end median held at 30.9 ms. All 2,953 published distribution files matched the candidate
byte for byte, including the 277 package files reached by the quick fixtures. The timing observations
are advisory.
