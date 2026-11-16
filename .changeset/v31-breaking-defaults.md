---
"@aceshooting/lyra-ui": major
---

Major release collecting behavior and type changes that can affect existing pages:

- `lr-attachment-trigger`'s `lr-files` event `capability` now includes `'camera'`, so code typing it as `'files' | 'image'` must widen.
- `lr-json-viewer` defaults to `layout="auto"`, which stacks values under keys below 30rem; set `layout="inline"` for the previous layout.
- `lr-chat-viewport`'s slotted content wrapper is a flex column, so vertical margins between adjacent messages add instead of collapsing.
- `lr-attachment-chip` honors `thumbnail-src` and `preview-src` while `file` is set.
- `lr-button` and `lr-icon-button` render real links for author-written `tel:` and `sms:` hrefs.
- A failed `system` `lr-chat-message` uses `--lr-chat-message-failed-color` for its text.
