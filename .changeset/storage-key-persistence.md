---
"@aceshooting/lyra-ui": minor
---

Add opt-in `storage-key` persistence to `<lr-table>`, `<lr-widget>`, and `<lr-app-rail>`, so layout
state survives a reload without every application rebuilding the same `localStorage` plumbing.

Set `storage-key` to persist `<lr-table>`'s `showAllColumns`, `<lr-widget>`'s `collapsed` state, and
`<lr-app-rail>`'s open state and width. The attribute is unset by default — behavior without it is
unchanged. All three share one internal helper with the `try`/`catch` handling needed for
environments where `localStorage` throws (private mode, disabled storage, cross-origin frames).
