---
"@aceshooting/lyra-ui": minor
---

Improve large-collection rendering, interaction, search, and streaming performance across tables, charts, trees, pickers, graphs, viewers, and agent interfaces.

- Reuse collection projections, search indexes, geometry, and rendered content when their inputs are unchanged. Keep focus, selection, pointer, and scroll updates limited to affected or visible content.
- Add bounded collection-limit controls and disclose omitted content. Tail-following feeds retain the newest entries, and virtual lists support large logical scroll extents.
- Add host-owned collection source contracts and bounded tabular access, plus staged numeric preparation that preserves full-source counts, domains, distributions, and original point indices.
- Reduce repeated markdown parsing and syntax highlighting, bound expensive viewer inputs before parsing, and add in-memory tabular viewer inputs.
- Load optional graph features on demand and add `lr-map.updateSourceData()` for consumer-authored source diffs.
- Add deterministic scale-regression checks alongside the existing behavioral and accessibility tests.
- Preserve component styles when existing elements move between documents.

Complete-source navigation and summaries add bounded paging, hierarchy, graph and spatial controllers, numeric preparation utilities, and localized loading, error and coverage messages. These capabilities increase the affected component, family and full-registration bundles; public declarations, usage documentation and complete locale catalogs also increase unpacked package size.

Consult the component references for collection limits, configurable bounds, and input ownership contracts.
