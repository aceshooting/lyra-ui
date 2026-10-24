---
'@aceshooting/lyra-ui': patch
---

Load the zoom, data-label and annotation add-ons for a chart whose `zoomable`, `data-labels`, `stack-totals` or `annotations` setting is assigned right after it connects, before its charting library has finished loading, instead of leaving them silently unloaded until the setting changes again.
