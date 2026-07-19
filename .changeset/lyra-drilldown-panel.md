---
"@aceshooting/lyra-ui": minor
---

New `<lr-drilldown-panel>` component: controlled navigation from a chart/table datum to its related
evidence, documents, entities, or agent runs. A navigation shell only -- an `lr-breadcrumb` trail
over a host-owned `path`, plus, for whichever categories the current node actually has content for,
the one existing primitive that already renders that content type (`lr-source-card` for evidence,
`lr-document-preview` for documents, `lr-entity-card` for entities), wrapped in an `lr-tabs` strip
only when more than one category has content. Agent-run content has no dedicated rendering primitive
yet in this library, so it composes via a `runs` slot instead of inventing bespoke rendering.
Activating a non-current breadcrumb step fires `lr-drilldown-navigate` (`detail: { id, index }`) --
the component never mutates `path` itself.
