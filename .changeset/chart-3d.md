---
'@aceshooting/lyra-ui': minor
---

Add `<lr-chart-3d>`, a bounded three-dimensional scatter, bubble and line chart over immutable typed columns of up to one million rows. It always renders an accessible, paginated data table with a keyboard cursor, and loads the optional `@aceshooting/lyra-3d` points renderer only for an explicit `engine="webgl"`, falling back to the table with a localized notice and `lr-engine-fallback`.
