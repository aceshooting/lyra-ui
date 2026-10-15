---
'@aceshooting/lyra-ui': minor
---

Add an optional perspective 3D view to `lr-graph` and `lr-knowledge-graph-explorer`, with explicit node coordinates, orbit and pan controls, keyboard navigation, and a visible paginated list fallback. The existing 2D view remains the default. Spatial and list views work without the optional 2D layout dependencies, and their controls are translated across all supported locales.

The spatial renderer and controls add about 8.3 KiB gzip to the standalone graph entry and 8.5 KiB to the explorer. Bundle ceilings increase only for the nine affected entries that exceed their previous limits, using their exact measured sizes with no added headroom; passing component, CSS and initial-route ceilings stay unchanged.
