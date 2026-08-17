---
"@aceshooting/lyra-ui": minor
---

Re-export `LyraNodeTypeStyle` from every component module whose public API types a property
against it (`lr-graph`, `lr-knowledge-graph-explorer`, `lr-drilldown-panel`, `lr-agent-trace`,
`lr-entity-dossier`, `lr-entity-card`, `lr-memory-panel`, `lr-provenance-panel`,
`lr-graph-legend`). The type was previously only reachable from the package root barrel
(`@aceshooting/lyra-ui`'s `LyraNodeTypeStyle` export); a consumer importing one of these
components from its own granular subpath, as this library's own examples do, had no local type
to import against and had to either duplicate the shape by hand or reach into the disallowed
`internal/` path.
