---
"@aceshooting/lyra-ui": minor
---

New `<lr-retrieval-search>` component: the query bar for a retrieval/RAG surface, composing
`lr-input` (query text), `lr-segmented` (vector/keyword/hybrid mode), `lr-chip`/`lr-chip-group`
(removable active-filter/scope chips), `lr-spinner` (loading), and `lr-empty` (empty results).
Fully controlled and network-free -- `query`/`mode`/`filters`/`scope` are host-owned properties,
and the component only emits `lr-search` (detail: a `RetrievalQuery` from `@aceshooting/lyra-ui`'s
`src/ai/types.ts`) on Enter or the submit button; the host performs the actual retrieval and
toggles `loading` around it. Because this component has no way to know when a request resolves,
submitting again while already `loading` is treated as superseding the in-flight request:
`lr-cancel` fires immediately before the new `lr-search`, and the submit button itself doubles as
an explicit Cancel affordance while `loading`. Filter/scope chip removal updates this component's
own copy first, then emits `lr-filters-change` with the complete next `{ filters, scope }` state,
mirroring `lr-source-picker`'s existing round-trip convention.
