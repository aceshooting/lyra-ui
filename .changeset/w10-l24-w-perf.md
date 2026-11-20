---
'@aceshooting/lyra-ui': minor
'@aceshooting/lyra-3d': patch
---

- `lr-env-list` renders the first 500 entries; `[part="limit"]` counts every entry not shown.
- `lr-file-input` renders the first 200 held files; new `[part="file-more"]` counts the rest.
- `lr-agent-eval-dashboard` renders at most 100 metric cards (plus the active one); new `[part="metrics-limit"]` note.
- `lr-path-strip` and `lr-graph-legend` render at most 200 elements or types; new `[part="limit"]` note.
- `lr-email-viewer` renders the first 200 attachments with a new `[part="attachments-limit"]` note, and `[part="to"]` ends with a `+N` count of recipients past the position ceiling.
- `lr-xml-viewer` renders at most 256 attributes per element row; new `[part="attribute-more"]` `+N` marker.
- `lr-highlight-layer` reads at most 1,000 rectangle positions per item.
- New `omittedViews` on `lr-widget` and `omittedCells` on `lr-dashboard-grid` report input positions beyond their admission limits.
- `lr-accordion` no longer re-checks item availability for attribute changes inside an item's content.
- 3D engines (`lr-embedding-explorer`, `lr-chart` 3D, `lr-model-viewer`, panorama media) share the realm's theme watcher, restyle when a stylesheet or contrast preference changes, and skip pushing an unchanged style; ancestor fence observation shares one observer per root.
- Map point-icon and image rasterization and the panorama media probe create their readback canvas contexts with `willReadFrequently`.
