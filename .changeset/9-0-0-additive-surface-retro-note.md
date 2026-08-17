---
"@aceshooting/lyra-ui": patch
---

Document 18 additive public surface additions from 9.0.0 that had no changelog entry:

- `<lr-chip>`: new `end` slot (trailing content, typically an icon, after the label).
- `<lr-claim-evidence>`: new `compact` and `frame` properties.
- `<lr-code-editor>`: new `size` property.
- `<lr-ebook-viewer>`, `<lr-pptx-viewer>`, `<lr-spreadsheet-viewer>`: new `maxHeight` property on
  each.
- `<lr-token-input>`: new `start` and `end` adornment slots.
- New CSS custom-property indirection (a themeable `--lr-*` hook backing a previously
  hardcoded/token-only value) on `<lr-dock-panel>`, `<lr-retrieval-compare>`,
  `<lr-spreadsheet-viewer>`, `<lr-stream-status>`, `<lr-code-block>`/`<lr-code-block-core>`,
  `<lr-page-rail>`, and `<lr-pdf-viewer>`.

All 18 are additive and backward-compatible — nothing removed or renamed, no behavior change when
left unset — but none were individually called out in the 9.0.0 changelog entry, unlike the many
other opt-in additions from the same release that are documented by exact component/property name.
