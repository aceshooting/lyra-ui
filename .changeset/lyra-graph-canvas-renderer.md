---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains `renderer: 'svg' | 'canvas'` (default `'svg'`, unchanged). `'canvas'` swaps the
per-node/per-link SVG DOM for a single DPR-aware `<canvas>` (reusing `lyra-heatmap`'s proven backing-
store/resize/DPR-watch machinery), targeting roughly 5,000 nodes / 10,000 links versus SVG's ~500/
~1,500 ceiling. Hit-testing uses an offscreen color-picking canvas (exact hits for all three node
shapes, stroked/dashed links, and hull blobs, one code path, zero new dependencies); pointer drag,
click, double-click-to-expand, and hover tooltips all work via that same hit-test. Keyboard/screen-
reader parity is preserved through an offscreen virtual-cursor button list driving the identical
roving/announcement logic as SVG mode — the honest v1 trade-off is no `::part(node)`/`::part(link)`
styling (pixels, not elements) and a drawn focus ring instead of a CSS one, both documented. Fully
additive — the default `renderer: 'svg'` reproduces today's DOM exactly.
