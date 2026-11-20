---
'@aceshooting/lyra-ui': major
---

- `lr-streaming-text` and `lr-message-parts` no longer let the composed Markdown or JSON viewer's generic `lr-error` escape; listen for the typed `lr-copy-error` instead.
- `lr-chat-message` names its retry button by the localized author instead of the raw `message-id`; `lr-message-parts` part retry/resume buttons are named by the part's own failure or interruption text.
- `lr-message-parts` audio parts bind `src` on the `<audio>` element so a replaced source reloads; the ignored `type` attribute on the source is gone.
- `lr-widget-renderer` row/col/text layout moved from inline styles to the stylesheet, so `::part(row|col|text)` rules can override it.
- `lr-thread-list` search input turns off spell-check, autocorrect, autocapitalize and autofill.
- `lr-push-to-talk` hold mode ignores the click some engines synthesize on Space release.
- `lr-stream-status` no longer shifts layout when a stall begins; `lr-usage-badge` rounds its focusable base so the hover tint and focus ring are rounded.
