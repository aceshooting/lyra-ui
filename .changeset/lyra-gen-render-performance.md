---
"@aceshooting/lyra-gen": patch
---

`<lr-gen-view>` renders large views and live dashboards faster. Preparation slices are time-budgeted instead of capped at a fixed step count, so a small view commits in one frame and a 500-node view in a few instead of about twenty. A `liveData`, state or query-result update re-prepares only the nodes whose `liveReads`, `reads`, `bindings`, `itemReads`, `visible`, `checks`, `computes` or `dataQuery` read the changed source and reuses every other prepared node and its element. Live data that changes while a render is in flight no longer restarts it: the render commits, then re-prepares the affected nodes, so frequent ticks cannot starve a large view. Rendered output, events and readiness are unchanged; `lr-gen-ready` still fires once per document revision, not on live ticks.
