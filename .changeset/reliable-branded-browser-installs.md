---
'@aceshooting/lyra-ui': patch
---

Retry transient failures when installing Chrome and Edge for browser qualification, with bounded attempts and unchanged signature verification. Installation exhaustion and timeouts still fail the check.
