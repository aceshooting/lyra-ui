---
"@aceshooting/lyra-ui": minor
---

New `<lr-entity-dossier>` component: a full knowledge-graph entity detail surface combining
properties, relationships, supporting chunks, confidence, and provenance into one composed
layout. A persistent header renders `<lr-entity-card>` (the entity's summary/properties) next to
an optional confidence `<lr-stat>`, above an `<lr-tabs>` strip for Relationships
(`<lr-neighbor-list>`), Supporting chunks (`<lr-chunk-inspector>`), and Provenance
(`<lr-provenance-panel>`). Pure layout -- it never fetches, ranks, or mutates graph/document state,
and never re-renders what any of those five composed components already render themselves; every
one of their own events bubbles through unmodified rather than being re-declared as this
component's own. Tab labels reuse the exact `localize()` keys the composed child underneath
already uses for its own accessible name (`neighborListLabel`, `chunkInspectorLabel`,
`provenancePanelLabel`), so no new localization keys were needed and a translated locale only has
to cover each string once.
