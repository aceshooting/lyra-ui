---
"@aceshooting/lyra-ui": patch
---

Correct published API reference entries where a documented IDL default contradicted the shipped
declaration. `accessibleLabel` on `lr-breadcrumb`, `lr-carousel`, `lr-command-palette`, `lr-table`
and `lr-timeline`, `label` on `lr-breadcrumb`, `lr-pagination`, `lr-file-tree`, `lr-artifact-panel`,
`lr-subagent-panel` and `lr-pptx-viewer`, and `lr-attachment-chip`'s five label overrides are all
optional: an unset property reads back `undefined` and falls through to a localized default, rather
than the empty string or the literal English text the reference claimed. `lr-details` now documents
`header-actions` as rendering inside the `<summary>` header row — the shape that actually ships and
keeps the controls hit-testable while collapsed — and `lr-eval-dataset`'s `lr-example-add-request`
is documented with the `detail: null` that `emit()` produces.
