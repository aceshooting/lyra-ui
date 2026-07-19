---
"@aceshooting/lyra-ui": minor
---

New `<lr-context-inspector>` component: an inspection view of the exact context assembled for a
model call. Renders per-segment token estimates through an embedded `<lr-context-meter>`, source
attribution through `<lr-citation-badge>`, and copy/export affordances through
`<lr-copy-button>`/`<lr-export-button>` -- composing all four rather than re-implementing any of
their rendering. Adds two small, purpose-built presentational features no existing primitive
covers: a truncation-boundary marker for a segment cut short of its original content
(`ContextInspectorSegment.truncated`/`omittedTokens`), and titled `<mark part="redaction">`
highlighting for character ranges a segment's `text` already carries a redaction placeholder in
(`ContextInspectorSegment.redactions`) -- this component never receives or renders unredacted
content, only marks where a host-side redaction already happened. Pure projection: never fetches,
estimates tokens, or performs redaction itself.
