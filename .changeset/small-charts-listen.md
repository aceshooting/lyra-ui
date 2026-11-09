---
'@aceshooting/lyra-ui': patch
---

Ignore chart and box-plot activation hits when native hit testing or hit-result validation disconnects or replaces the chart instance. A reconnected chart accepts fresh clicks without emitting stale activation events. Box plots also contain native hit-testing failures so subsequent valid clicks still work.
