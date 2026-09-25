---
"@aceshooting/lyra-ui": patch
---

`lr-chat-viewport` with `live="polite"` or `live="assertive"` now announces a newly appended `lr-chat-message` that was created and appended in one step. The viewport previously read the message before its first render, found no accessible text, and never announced it. It now retries once after the message has rendered, and it still announces each message only once. A child that is appended and removed again before the viewport observes it is no longer announced.
