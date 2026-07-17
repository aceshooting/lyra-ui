---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-push-to-talk>`: a mic capture button owning the full `getUserMedia`/`MediaRecorder`
lifecycle — permission request, hold or toggle recording, optional chunked streaming
(`lyra-record-chunk`) for streaming STT, an opt-in RMS level meter (`lyra-level`), a `max-duration-ms`
auto-stop guard, and `lyra-record-start`/`lyra-record-stop`/`lyra-record-cancel`/`lyra-record-error`
events. No SDK dependency — native browser APIs only. Previously lyra-ui had no voice-capture
component at all; every agentic voice UI had to hand-roll this lifecycle from scratch.
