---
'@aceshooting/lyra-ui': patch
---

- Slot-driven chrome in `lr-chat-message`, `lr-conversation-item`, `lr-handoff-divider`, `lr-stream-status`, `lr-usage-badge`, `lr-thread-list`, `lr-avatar`, `lr-result-field`, `lr-tour`, `lr-kbd`, `lr-app-rail`, `lr-app-rail-item`, `lr-document-preview`, `lr-confirm-bar`, `lr-chat-composer` and `lr-agent-run` now uses one shared presence check: a wrapper that forwards an empty `<slot>` no longer renders an empty box (gap or padding), and forwarded content still shows.
- Roving keyboard focus in suggestion chips, mention popovers, sequence strips, flow canvases, video playlists and graphs keeps exactly one reachable tab stop even when its internal position is not a finite number. The flow canvas page field now uses the same page bounds as the request it sends.
- `lr-select` end adornments now line up at the row end, like `lr-combobox`. The labelled `lr-chat-viewport` jump pill keeps the shared minimum hit area.
- `lr-voice-picker`: calling `click()` on the host in free-text mode now relays a click from the inner input, matching `lr-model-select`.
