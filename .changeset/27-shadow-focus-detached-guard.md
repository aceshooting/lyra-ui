---
'@aceshooting/lyra-ui': patch
'@aceshooting/lyra-docs': patch
---

Components no longer read their own shadow root's focused element while disconnected. A Lit update queued before a host was removed now skips focus bookkeeping instead of reading `activeElement` on a detached host, which threw under Happy DOM and surfaced as an unhandled rejection.
