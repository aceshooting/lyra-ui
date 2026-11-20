---
'@aceshooting/lyra-ui': major
---

- **Breaking:** `lr-chat-viewport` no longer emits `lr-follow-change` for a direct `follow` assignment or a `scrollToBottom()` call; only a reader's scroll or a jump-pill click emits it, matching `lr-transcript-feed`, `lr-terminal`, `lr-activity-feed` and `lr-thinking-panel`. Migration: code that relied on the echo to learn about its own write already knows the new value; update local state where you assign `follow` or call `scrollToBottom()`.
- `lr-transcript-feed` scrolls to the latest entry as soon as `follow` is set from `false` to `true`, without waiting for a new entry.
- `lr-realtime-session` `captureOptions` accepts `streamOnly` and `levelEvents` (default `true`), so a long chunked take no longer has to be retained in memory.
- `lr-message-parts` forwards `html-mode`, `without-images`, `link-target`, `link-schemes` and `max-height` to its built-in text and reasoning Markdown parts, with `lr-markdown`'s defaults.
- `lr-conversation-item` names its row from the visible title, excerpt, meta and timestamp unless a host `aria-label` is set; `lr-thread-list` rows announce the pinned status and include `renderExcerpt`, `renderMeta` and `renderRowContent` text in that name.
- `lr-markdown` and `lr-markdown-core`: a highlighted code block evicted from the shared highlight cache is highlighted again on the next render instead of staying plain.
- `lr-markdown` and `lr-markdown-core`: `--lr-markdown-content-min-size` now defaults to `0`, so a one-line reply no longer reserves an icon-button-sized box.
- `lr-model-select` and `lr-voice-picker` no longer list the inert `--lr-picker-*` custom properties; use the per-component `--lr-model-select-*` and `--lr-voice-picker-*` names.
- `lr-thread-list` `--lr-thread-list-search-clear-size` defaults to `var(--lr-icon-button-size)`; `lr-branch-picker`, `lr-message-feedback` and thread-list row actions drop fixed sizes the shared target floor always overrode.
