---
'@aceshooting/lyra-ui': minor
'@aceshooting/lyra-docs': patch
'@aceshooting/lyra-gen': patch
---

- `lr-diff-view` no longer paints a highlight whose start lies outside the diff on the last line; painting and `scrollToAnchor()` now agree.
- `lr-email-viewer` shows a localized note instead of a blank body when an HTML-only message sanitizes to nothing.
- `lr-include` resolves a same-page `#id` inside the shadow root that contains it before falling back to the document.
- `lr-format-bytes` and `formatBytes()` show a value that rounds up to the next unit step on that unit (`1 MB`, not `1,000 kB`).
- `lr-image-comparer` drops a pending keyboard change when it is disconnected.
- `lr-model-viewer` keeps the loaded model when only `name` changes and the detected format stays the same.
- `lr-word-cloud` keeps words legible in a narrow host (scrolls instead of shrinking) via the new `--lr-word-cloud-legible-font-size` token.
- `lyra-docs` and `lyra-gen` publish a `custom-elements.json` for `lr-docx-editor` and `lr-gen-view`.
