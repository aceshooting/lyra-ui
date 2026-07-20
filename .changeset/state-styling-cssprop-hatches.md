---
"@aceshooting/lyra-ui": minor
---

Add component-scoped CSS custom properties for state styling across thirteen conversation, retrieval, viewer and media components. Each of these components previously painted a selected/active/current state straight from a library-wide `--lr-color-*` token, which left the state unrestylable from outside: `::part(x)[data-active]` is invalid CSS, so the only lever was hijacking the shared token — repainting every other surface on the page that read it.

Every new property uses the inline `var()` fallback form and is deliberately **not** declared on `:host`, so a value set on the element or any ancestor is honoured rather than shadowed. With none of them set, rendering is byte-identical to before.

- `lr-conversation-item` — `--lr-conversation-item-active-bg`, `--lr-conversation-item-active-color`
- `lr-push-to-talk` — `--lr-push-to-talk-recording-color`
- `lr-chunk-inspector` — `--lr-chunk-inspector-current-bg`, `--lr-chunk-inspector-current-color`
- `lr-retrieval-results` — `--lr-retrieval-results-selected-border`
- `lr-retrieval-trace` — `--lr-retrieval-trace-active-border`
- `lr-source-picker` — `--lr-source-picker-checked-bg`, `--lr-source-picker-checked-border`, `--lr-source-picker-mixed-bg`
- `lr-page-rail` — `--lr-page-rail-current-bg`
- `lr-notebook-viewer` — `--lr-notebook-viewer-active-bg`
- `lr-svg-viewer` — `--lr-svg-viewer-active-border`
- `lr-document-preview` — `--lr-document-preview-active-border`
- `lr-xml-viewer` — `--lr-xml-viewer-active-match-color`
- `lr-av-player` — `--lr-av-player-marker-active-color`, `--lr-av-player-cue-current-bg`, `--lr-av-player-cue-active-match-color`
- `lr-image-viewer` — `--lr-image-viewer-annotate-active-bg`, `--lr-image-viewer-annotate-active-border`, `--lr-image-viewer-highlight-active-color`

`--lr-conversation-item-active-*` and `--lr-chunk-inspector-current-*` are documented as contrast-sensitive pairs: each background is half of a WCAG-AA dependency with the text color rendered on it.

Also fixes a WCAG-AA contrast failure in `lr-chunk-inspector`: the current (`active-id`) chunk's score line rendered in `--lr-color-text-quiet`, which reaches only ~4.24:1 against the `--lr-color-brand-quiet` current-row background — under the 4.5:1 floor for normal-size text. It now uses full-strength text while current, matching the identical fix already carried by `lr-attachment-chip`, `lr-chat-message` and `lr-conversation-item`. Non-current rows keep the quiet treatment.
