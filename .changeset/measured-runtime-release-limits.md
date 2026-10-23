---
'@aceshooting/lyra-ui': patch
---

Record the observed limits of the release's runtime benchmarks. A matched quick Chromium
comparison against 29.2.2 passed all 15 semantic workloads with unchanged workload counts, but
12 of 150 timing metrics exceeded both the 15% and 1 ms material-regression thresholds. These
include document filtering paint, table assignment and sorting paint/no-op phases, chart
assignment, select metadata paint, and combobox metadata updates. For 1,000-record chart
assignment, observed p95 rose from 112.7 to 148.3 ms while the median remained 77.7 versus
77.5 ms; update and settlement tails increased in the same sample. Each run contained seven
samples, so its reported p95 is the largest observation.

One matched diagnostic trace pair recorded frame waiting in the scheduling control and real
layout and garbage-collection work in both chart implementations. The largest chart tail did
not recur in that pair, and its cause remains unestablished. The original comparison remains
a documented performance limitation. The traced workloads and unchanged counts do not establish
equivalent performance for every workload or device.
