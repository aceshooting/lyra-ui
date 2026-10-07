---
"@aceshooting/lyra-ui": patch
---
lr-prompt-queue, lr-thread-list, lr-suggestion-chips: internal child events no longer escape the host — editing a queued prompt no longer fires lr-prompt-input's own `lr-change`, row rename focus/blur and the internal list's scroll events stay inside lr-thread-list, and lr-suggestion-chips no longer leaks `lr-scroll`.
