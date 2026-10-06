---
"@aceshooting/lyra-ui": patch
---
Theme-aware canvas components (`lr-chart`, `lr-box-plot`, `lr-heatmap`, `lr-graph`, `lr-map`, `lr-markdown`, `lr-code-block`, `lr-qr-code`, `lr-word-cloud` and the other theme-watching viewers and players) now share one theme observer per page root and one listener per media query instead of each instance observing the whole document, scanning every stylesheet on connect and re-checking its ancestry on every inline style write; long transcripts or dashboards of them no longer slow down every DOM or style change on the page. They also re-read the theme when a slot reassignment changes the container they inherit tokens from.
