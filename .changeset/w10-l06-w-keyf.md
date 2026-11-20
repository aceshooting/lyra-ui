---
'@aceshooting/lyra-ui': patch
---

- `lr-widget`, `lr-artifact-panel`, `lr-details`, `lr-responsive-panel`, `lr-stack-trace` and the `lr-agent-workspace` details pane give their scroll body a named keyboard tab stop while, and only while, its content overflows (dashboard stat cells included). `lr-document-compare` panes and the `lr-lightbox` caption no longer add a tab stop when nothing scrolls.
- The shared scroll-region helper now also watches slotted content, and keeps focus (at `tabindex="-1"`) on a body that stops overflowing while focused.
- `lr-lightbox`, `lr-pan-zoom`, `lr-zoomable-frame`, `lr-pagination`, `lr-chart-3d`, the `lr-map` scene list and the `lr-image-viewer`/`lr-video` panorama pager keep keyboard focus on a sibling control when the focused button disables itself at a limit. `lr-tab-group` moves focus to the newly selected tab when a programmatic selection hides the panel that held it.
- A blank numeric attribute (`""`) now keeps the declared default instead of becoming `0` on `lr-token-input`, `lr-time-range`, `lr-navigation-menu`, `lr-app-rail`, `lr-model-settings-panel`, `lr-audio-visualizer`, `lr-markdown`, `lr-markdown-core`, `lr-streaming-text`, `lr-code-editor`, `lr-agent-workspace` and `lr-realtime-session`.
- `lr-spreadsheet-viewer` renders a source-backed workbook's active sheet inside the tab panel its selected tab controls.
