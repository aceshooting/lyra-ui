---
'@aceshooting/lyra-ui': patch
---

Fix `lr-branch-picker`, `lr-chat-viewport`, `lr-realtime-session`, `lr-selection-toolbar`, `lr-message-actions`, `lr-prompt-queue`, `lr-prompt-input`, `lr-audio-visualizer`, and `lr-map` so an explicitly empty `label` (`label=""` or `.label = ''`) suppresses their localized default accessible name instead of silently falling back to it, matching how the other conversation-family copy-override properties already behave.
