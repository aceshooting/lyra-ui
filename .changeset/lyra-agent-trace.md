---
"@aceshooting/lyra-ui": minor
---

New `<lr-agent-trace>` component: a provider-neutral agent/LLM trace view combining a span-kind
filter row, a handoff quick-jump list, and the full trace hierarchy, all driven by one shared
`LyraSpan[]` array. All trace rendering -- hierarchy, expand/collapse, keyboard navigation,
duration bars, empty state -- is entirely `<lr-trace-tree>`'s own; this component only ever hands
it a (possibly filtered) `spans` array plus pass-through properties, never building its own row
markup. The filter row composes `<lr-graph-legend>` (the same type/visibility-toggle legend
pattern already established for `<lr-graph>` node types, reused here for `LyraSpan.kind`
visibility) and the handoff list composes `<lr-handoff-divider>` for each visible `'agent'`-kind
span. Selection (`activeSpanId`) is controlled end-to-end for deep-linking: both a tree-row click
and a handoff quick-jump activation update it and fire the identical `lr-span-select` `{ id }`
shape.
