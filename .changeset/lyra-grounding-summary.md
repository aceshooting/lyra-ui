---
"@aceshooting/lyra-ui": minor
---

New `<lr-grounding-summary>` component: the claim-level scorecard for one generated answer,
consuming `GroundingAssessment` from `@aceshooting/lyra-ui`'s `src/ai/types.ts` directly as its
`assessment` property. Composes `lr-stat` for the supported/unsupported claim counts, citation
coverage, and optional confidence numeric displays (tone-mapped via a `thresholds` property), and
`lr-citation-badge` for an optional `citations` list linking each evidence entry back to its exact
`span`. Activating a citation badge emits `lr-citation-select` (detail: `{ citation }`, the
`CitationSelectEventDetail` shape from `src/ai/types.ts`) carrying the full citation record, in
addition to the badge's own `lr-citation-activate` still bubbling through unmodified. Warnings
render verbatim as caller-supplied data; every other label is localized via `this.localize()`.
