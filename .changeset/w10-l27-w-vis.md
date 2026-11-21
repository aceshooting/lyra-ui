---
'@aceshooting/lyra-ui': minor
---

- `lr-pagination` wraps its controls onto their own line instead of crushing the summary into a one-glyph strip between the 320px baseline and roughly 600px; layout regions of `lr-dashboard-grid`, `lr-page`, `lr-details`, `lr-accordion-item`, `lr-responsive-panel`, `lr-breadcrumb-item` and `lr-navigation-menu-item` use `overflow-wrap: break-word`, so slotted flex, grid and table content keeps its own min-content size.
- Truncation, capability and load notices in `lr-graph`, `lr-knowledge-graph-explorer`, `lr-embedding-explorer`, `lr-json-schema-viewer`, `lr-eval-run` and `lr-eval-result` render as quiet small text with token margins; `lr-graph`'s 2D notices stay inside the host box; `load-error` is painted as an error; `lr-email-viewer`'s expanded quote wraps like the message body.
- The `lr-page` and `lr-app-rail` mobile drawers, the `lr-responsive-panel` overlay and the `lr-widget` fullscreen panel paint from `--lr-overlay-surface` behind their own hooks; they, `lr-drawer` and `lr-toast-item` read `--lr-overlay-shadow-modal` (default unchanged). `lr-flow-minimap` uses the same subtle frame edge as the other flow chrome.
- A consumer `--lr-xml-viewer-max-height` / `--lr-json-viewer-max-height` now sizes the source-mode tree unless `max-height` is set; `lr-drilldown-panel` no longer overrides a consumer `--lr-breadcrumb-item-color`.
- `lr-flow-canvas` fit, focus, wheel zoom, pan, drag and connection math, `lr-timeline` trailing extent, `lr-heatmap` hit testing, `lr-tree` drop indicator and `lr-video` scrub thumbnail work in layout pixels under a scaled or zoomed ancestor.
- Disabled `lr-map` scene, pick, drawing and legend actions look disabled and show no hover or press fill; `lr-embedding-explorer` page buttons and `lr-av-player` placeholder transcript rows (new `cue-unavailable` part) no longer react to hover.
- A vertical `lr-card` and `lr-agent-trace` size by content in shrink-to-fit contexts (only the horizontal card is a query container).
- Search, anchor and record reveal in `lr-xml-viewer`, `lr-docx-viewer`, `lr-document-preview`, `lr-svg-viewer`, `lr-archive-viewer`, the table viewers and `lr-flow-canvas` scroll only the component's own scrollport, never the page or an outer scroller.
