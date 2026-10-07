---
"@aceshooting/lyra-ui": major
---
lr-handoff-divider no longer announces itself on mount, so restored or virtualized transcripts stay silent and live viewports announce a handoff once. Migration: render dividers inside a live container such as `<lr-chat-viewport live="polite">` to announce new handoffs.
