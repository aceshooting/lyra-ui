---
'@aceshooting/lyra-ui': patch
---

Respect cancellation, stopping, or removal during push-to-talk state notifications: avoid requesting microphone permission for a retired request and suppress obsolete recording-start effects for a take already stopping or disconnected.
