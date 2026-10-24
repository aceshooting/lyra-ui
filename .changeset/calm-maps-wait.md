---
'@aceshooting/lyra-ui': patch
---

Wait for URL style replacements to commit before reporting map readiness and restoring owned overlays, images and style overrides. URL replacements now rebuild the native basemap instead of diffing it, so unchanged responses also have a reliable completion event. This trades the native style-diff optimization for correct replacement readiness. Pending replacements can also be superseded repeatedly by inline styles without attempting to diff an unloaded basemap.
