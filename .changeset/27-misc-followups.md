---
'@aceshooting/lyra-ui': patch
---

`lr-random-content` now shares the label observer used by the other label-reading components, including its `aria-labelledby` tracking, and `lr-export-button` shares the popup outside-press binding. Chart legend-position styles are shared between `lr-chart` and `lr-box-plot`. No API change.
